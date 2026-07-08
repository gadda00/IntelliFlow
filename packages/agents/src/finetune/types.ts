/**
 * Fine-Tuning Pipeline — Types
 * ============================
 *
 * Closes the AReaL self-evolution loop (arXiv:2607.01120, Pillars 1–3):
 *   Pillar 1 (trajectory protocol)  → produces the raw learning signal
 *   Pillar 2 (data proxy)           → filters + scrubs + dedupes it
 *   Pillar 3 (evolution control)    → decides WHEN to evolve
 *   THIS module                     → decides HOW to evolve (weights update)
 *
 * The DataProxy (Pillar 2) already exports filtered datasets of trajectories.
 * This module converts those exports into the canonical training formats
 * (SFT / DPO / RLHF), decides when an agent has accumulated enough signal
 * to warrant a fine-tune, and runs the training job itself.
 *
 * The Runner is currently a MOCK — it walks through the lifecycle states
 * and emits log entries, but doesn't touch a real training framework.
 * The intent is that the same FineTuneJob / FineTuneConfig surface plugs
 * into AReaL, Axolotl, or any other training backend once one is wired up.
 */

// ============================================================================
// Methods & Status
// ============================================================================

/**
 * The fine-tuning algorithm.
 *
 *   - sft  — Supervised Fine-Tuning. Use positive-reward trajectories as
 *            (prompt, completion) pairs and train the policy to imitate them.
 *   - dpo  — Direct Preference Optimization. Pair a chosen (positive reward)
 *            response against a rejected (negative reward) response for the
 *            same/similar prompt and train the policy to prefer chosen.
 *   - rlhf — Reinforcement Learning from Human Feedback. Train a reward
 *            model on (prompt, response, reward) tuples, then PPO against it.
 *   - ppo  — Proximal Policy Optimization. The on-policy RL step that
 *            consumes the reward model from RLHF.
 */
export type FineTuneMethod = 'sft' | 'dpo' | 'rlhf' | 'ppo';

/**
 * Lifecycle of a FineTuneJob.
 *
 * The runner walks through these states in order:
 *   pending → preparing → training → evaluating → (deploying?) → completed
 *
 * Any state can transition to `failed` (on error) or `cancelled` (on user
 * request) except `completed` itself.
 */
export type FineTuneStatus =
  | 'pending'
  | 'preparing'
  | 'training'
  | 'evaluating'
  | 'deploying'
  | 'completed'
  | 'failed'
  | 'cancelled';

// ============================================================================
// Config
// ============================================================================

/**
 * Full configuration for a fine-tune job.
 *
 * A config is produced by `FineTuneScheduler.checkReadiness` once an agent
 * has accumulated enough trajectory signal; it can also be hand-crafted
 * and submitted directly via the API.
 */
export interface FineTuneConfig {
  /** The training algorithm. */
  method: FineTuneMethod;

  /** Which agent this fine-tune targets. */
  agentId: string;

  /** The base model to fine-tune (e.g. 'glm-4.6'). */
  baseModel: string;

  /** The output model name (used for the artifact path / registry entry). */
  outputModelName: string;

  /** Optimizer / training hyperparameters. */
  hyperparameters: {
    learningRate: number;
    epochs: number;
    batchSize: number;
    warmupRatio: number;
    weightDecay: number;
    maxSeqLength: number;
  };

  /** Data selection criteria — feeds back into the DataProxy filters. */
  dataConfig: {
    minTrajectories: number;
    minReward: number;
    minQualityScore: number;
    maxAge: number; // days
  };

  /** Evaluation configuration. */
  evalConfig: {
    holdoutPercentage: number;
    evalMetrics: string[];
  };

  /** Deployment configuration (only used if autoDeploy is true). */
  deploymentConfig: {
    autoDeploy: boolean;
    canaryPercentage: number;
    rollbackOnRegression: boolean;
  };
}

// ============================================================================
// Job
// ============================================================================

/**
 * A running or completed fine-tune job.
 *
 * The job object is mutable: the runner updates `status`, `progress`,
 * `currentStep`, `metrics`, `logs`, and `result` as the job progresses.
 * Callers should treat the returned job as a snapshot — re-fetch via
 * `runner.getJob(id)` for the latest state.
 */
export interface FineTuneJob {
  /** Unique job ID (e.g. `ft_<timestamp>_<rand>`). */
  id: string;

  /** The config this job was started with. */
  config: FineTuneConfig;

  /** Current lifecycle status. */
  status: FineTuneStatus;

  /** ISO timestamp of job creation. */
  createdAt: string;

  /** ISO timestamp when training began (status → preparing). */
  startedAt?: string;

  /** ISO timestamp when the job reached a terminal state. */
  completedAt?: string;

  /** Overall progress, 0.0 to 1.0. */
  progress: number;

  /** Human-readable description of the current step. */
  currentStep?: string;

  /** Training + evaluation metrics, populated as the job runs. */
  metrics?: {
    trainingLoss?: number[];
    evalLoss?: number[];
    rewardImprovement?: number;
    sampleCount?: number;
  };

  /** Job result, populated on completion (or partial, on cancel). */
  result?: {
    modelPath?: string;
    modelUrl?: string;
    evalResults?: Record<string, number>;
    deployedAt?: string;
  };

  /** Error message, set if status === 'failed'. */
  error?: string;

  /** Append-only log of everything that happened during the job. */
  logs: FineTuneLogEntry[];
}

/**
 * A single log entry in a FineTuneJob's log.
 */
export interface FineTuneLogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  data?: Record<string, unknown>;
}

// ============================================================================
// Training Data Formats
// ============================================================================

/**
 * A formatted training dataset, ready to feed into a training framework.
 *
 * The `format` field determines which fields on each `TrainingSample` are
 * populated.
 */
export interface TrainingDataFormat {
  format: 'sft' | 'dpo' | 'rlhf';
  samples: TrainingSample[];
}

/**
 * A single training sample.
 *
 * Different formats populate different fields:
 *
 *   SFT:  `prompt` + `completion`
 *   DPO:  `prompt` + `chosen` + `rejected`
 *   RLHF: `promptTokens` + `responseTokens` + `reward`
 *
 * The `metadata` field is always optional and is for provenance tracking
 * (which trajectory / agent / reward this sample came from).
 */
export interface TrainingSample {
  // ─── SFT format ────────────────────────────────────────────────────
  /** SFT: the input prompt (system + user). */
  prompt?: string;
  /** SFT: the target completion. */
  completion?: string;

  // ─── DPO format ────────────────────────────────────────────────────
  /** DPO: the preferred (positive-reward) completion. */
  chosen?: string;
  /** DPO: the rejected (negative-reward) completion. */
  rejected?: string;

  // ─── RLHF format ───────────────────────────────────────────────────
  /** RLHF: tokenized prompt. */
  promptTokens?: string[];
  /** RLHF: tokenized response. */
  responseTokens?: string[];
  /** RLHF: scalar reward for this (prompt, response) pair. */
  reward?: number;

  // ─── Common ────────────────────────────────────────────────────────
  /** Provenance / metadata for this sample. */
  metadata?: Record<string, unknown>;
}
