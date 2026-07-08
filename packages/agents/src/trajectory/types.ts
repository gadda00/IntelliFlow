/**
 * Busara Trajectory Data Protocol
 * ===============================
 *
 * Inspired by: "Next-Generation Agentic Reinforcement Learning Systems Enable
 * Self-Evolving Agents" (arXiv:2607.01120, Yan et al., 2026)
 *
 * The paper identifies three pillars missing from current agentic RL systems:
 *   (i)  No standardized agent trajectory data protocol
 *   (ii) No enterprise-grade data proxy
 *   (iii) No unified agent evolution control plane
 *
 * This module implements Pillar (i): a standardized trajectory format that
 * captures RL learning signals at step granularity across heterogeneous agent
 * paradigms.
 *
 * A Trajectory is the complete record of a single agent execution:
 *   - The context snapshot (what the agent was configured with)
 *   - Every step (observation → action → result) with causal links
 *   - The reward signal (explicit user feedback or implicit behavioral signal)
 *   - Metadata for dedup, governance, and replay
 *
 * Trajectories are the substrate on which the Data Proxy (Pillar ii) and the
 * Evolution Control Plane (Pillar iii) operate. Without trajectories, there
 * is no learning data. Without learning data, agents remain static.
 */

// ============================================================================
// Core Types
// ============================================================================

/** Unique identifier for a trajectory (CUID-style). */
export type TrajectoryId = string;

/** Unique identifier for a single step within a trajectory. */
export type StepId = string;

/** ISO 8601 timestamp. */
import type { ISODateString } from '@busara/core';
export type { ISODateString };

/**
 * A Trajectory is the complete, step-level record of one agent execution.
 * It is the atomic unit of learning data in the Busara self-evolution system.
 */
export interface Trajectory {
  /** Unique trajectory ID. */
  id: TrajectoryId;

  /** The analysis run this trajectory belongs to. */
  analysisId: string;

  /** The user who triggered the analysis. */
  userId: string;

  /** Optional workspace/org for multi-tenant isolation. */
  workspaceId?: string;
  organizationId?: string;

  /** Which agent produced this trajectory. */
  agentId: string;

  /** Agent version (semantic version, e.g. "1.2.0"). */
  agentVersion: string;

  /** Agent stability at time of execution. */
  agentStability: 'experimental' | 'beta' | 'stable' | 'deprecated';

  /** When the trajectory started. */
  startedAt: ISODateString;

  /** When it completed (set on success/failure). */
  completedAt?: ISODateString;

  /** Final status. */
  status: TrajectoryStatus;

  /** Ordered list of steps. */
  steps: TrajectoryStep[];

  /** Reward signals (can accumulate over time — user feedback comes later). */
  rewards: RewardSignal[];

  /** Snapshot of the agent's context at execution time. */
  contextSnapshot: TrajectoryContextSnapshot;

  /** Metadata for dedup, governance, replay. */
  metadata: TrajectoryMetadata;

  /** Execution metrics. */
  metrics: TrajectoryMetrics;

  /** Any errors that occurred. */
  error?: TrajectoryError;
}

export type TrajectoryStatus =
  | 'running'
  | 'success'
  | 'failed'
  | 'cancelled'
  | 'timeout';

// ============================================================================
// Step Types
// ============================================================================

/**
 * A single step in a trajectory. Steps are the atom of the RL learning signal.
 * Each step records what the agent observed, what it did, and what happened.
 */
export interface TrajectoryStep {
  /** Unique step ID within the trajectory. */
  id: StepId;

  /** Zero-indexed position in the trajectory. */
  stepIndex: number;

  /** When this step started. */
  timestamp: ISODateString;

  /** Duration in milliseconds. */
  durationMs?: number;

  /** What kind of step is this? */
  type: StepType;

  /**
   * Which prior steps causally influenced this one.
   * Empty array = root step (no dependencies).
   * This is the "causal structure" the AReaL paper emphasizes must be
   * preserved for RL training — without it, credit assignment is impossible.
   */
  causalParentSteps: StepId[];

  /** What the agent observed (input data, prior results, etc.). */
  observation?: unknown;

  /** What the agent decided to do. */
  action?: unknown;

  /** If this step involved an LLM call, the call details. */
  llmCall?: TrajectoryLLMCall;

  /** If this step involved a tool/function call, the call details. */
  toolCall?: TrajectoryToolCall;

  /** The step's output (what it produced). */
  result?: unknown;

  /** Step-level reward (if any — most rewards are trajectory-level). */
  reward?: number;

  /** Step-level error (if any). */
  error?: string;

  /** Arbitrary metadata for this step. */
  metadata?: Record<string, unknown>;
}

export type StepType =
  | 'observation'    // agent received input
  | 'reasoning'      // agent thought about what to do
  | 'llm_call'       // agent called an LLM
  | 'tool_call'      // agent called a tool/function
  | 'computation'    // agent did a pure computation
  | 'output'         // agent produced final output
  | 'error';         // something went wrong

/** Details of an LLM call within a step. */
export interface TrajectoryLLMCall {
  provider: string;        // 'glm' | 'openai' | 'anthropic' | 'google'
  model: string;           // 'glm-4.6' | 'gpt-4o' | etc.
  systemPrompt: string;
  userPrompt: string;
  response: string;
  tokensIn: number;
  tokensOut: number;
  temperature?: number;
  latencyMs: number;
  cost?: number;           // estimated cost in USD
}

/** Details of a tool/function call within a step. */
export interface TrajectoryToolCall {
  tool: string;            // function name
  input: unknown;
  output: unknown;
  latencyMs: number;
  error?: string;
}

// ============================================================================
// Reward Types
// ============================================================================

/**
 * A reward signal for a trajectory.
 *
 * The AReaL paper emphasizes that rewards can be scalar (RLHF-style) or
 * textual (LLM-as-judge). We support both, plus the distinction between
 * explicit (user-provided) and implicit (behavioral) rewards.
 */
export interface RewardSignal {
  /** When the reward was recorded. */
  timestamp: ISODateString;

  /** How was this reward generated? */
  type: RewardType;

  /** What was the source of the reward? */
  source: RewardSource;

  /** Scalar reward value, normalized to [-1.0, 1.0]. */
  value: number;

  /** Optional textual feedback (for LLM-as-judge or user comments). */
  text?: string;

  /** Who or what provided this reward. */
  provider?: string;

  /** Additional metadata. */
  metadata?: Record<string, unknown>;
}

export type RewardType =
  | 'explicit'      // user directly rated the result
  | 'implicit'      // inferred from user behavior
  | 'automated';    // computed by a reward model or heuristic

export type RewardSource =
  | 'user_thumbs_up'
  | 'user_thumbs_down'
  | 'user_cited_insight'     // user referenced this result later
  | 'user_returned'          // user came back to view this analysis again
  | 'user_shared'            // user shared/exported this analysis
  | 'user_ignored'           // user didn't interact with the result at all
  | 'quality_score'          // automated quality assessment
  | 'validation_pass'        // output passed schema validation
  | 'validation_fail'        // output failed schema validation
  | 'peer_agreement'         // other agents agreed with this result
  | 'peer_disagreement'      // other agents contradicted this result
  | 'custom';

// ============================================================================
// Context Snapshot
// ============================================================================

/**
 * A snapshot of the agent's context at execution time.
 *
 * This is critical for reproducibility: if we want to replay a trajectory
 * or fine-tune on it, we need to know exactly what the agent was working with.
 */
export interface TrajectoryContextSnapshot {
  /** The system prompt that was in effect. */
  systemPrompt?: string;

  /** The agent's configuration at execution time. */
  config: Record<string, unknown>;

  /** Config hash for dedup — same hash = same config. */
  configHash: string;

  /** Tool versions (so we know if a tool changed between runs). */
  toolVersions?: Record<string, string>;

  /** In-context examples that were provided. */
  inContextExamples?: unknown[];

  /** The DAG context (what stage, what prior results were available). */
  dagContext?: {
    stage: string;
    stageNumber: number;
    availablePriorResults: string[];  // agent IDs whose results were available
  };
}

// ============================================================================
// Metadata
// ============================================================================

export interface TrajectoryMetadata {
  /** Hash of the input dataframe — for dedup across runs on same data. */
  dataframeHash: string;

  /** Number of rows in the input data. */
  rowCount: number;

  /** Number of columns. */
  columnCount: number;

  /** File name (if data came from a file upload). */
  fileName?: string;

  /** File type (csv, json, etc.). */
  fileType?: string;

  /** Whether PII was detected in the input (for governance). */
  piiDetected: boolean;

  /** Whether the trajectory has been scrubbed of PII (for the data proxy). */
  piiScrubbed: boolean;

  /** Tags for categorization. */
  tags?: string[];

  /** Free-form labels. */
  labels?: Record<string, string>;
}

export interface TrajectoryMetrics {
  /** Total execution time in ms. */
  totalDurationMs: number;

  /** Number of steps. */
  stepCount: number;

  /** Number of LLM calls. */
  llmCallCount: number;

  /** Total tokens consumed (input + output). */
  totalTokens: number;

  /** Estimated cost in USD. */
  estimatedCost: number;

  /** Number of tool calls. */
  toolCallCount: number;

  /** Number of errors. */
  errorCount: number;

  /** Number of retries. */
  retryCount: number;
}

export interface TrajectoryError {
  message: string;
  stack?: string;
  code?: string;
  stepId?: StepId;
}

// ============================================================================
// Query Types
// ============================================================================

export interface TrajectoryQuery {
  agentId?: string;
  userId?: string;
  workspaceId?: string;
  status?: TrajectoryStatus;
  startDate?: ISODateString;
  endDate?: ISODateString;
  minReward?: number;
  maxReward?: number;
  tags?: string[];
  limit?: number;
  offset?: number;
  orderBy?: 'startedAt' | 'completedAt' | 'reward' | 'duration';
  orderDirection?: 'asc' | 'desc';
}

export interface TrajectoryQueryResult {
  trajectories: TrajectorySummary[];
  total: number;
  limit: number;
  offset: number;
}

/** A summarized trajectory (without steps — for list views). */
export interface TrajectorySummary {
  id: TrajectoryId;
  analysisId: string;
  agentId: string;
  agentVersion: string;
  status: TrajectoryStatus;
  startedAt: ISODateString;
  completedAt?: ISODateString;
  totalDurationMs: number;
  rewardCount: number;
  averageReward: number;
  stepCount: number;
  tags?: string[];
}

// ============================================================================
// OpenTelemetry GenAI Export (for interoperability)
// ============================================================================

/**
 * OpenTelemetry GenAI semantic conventions export format.
 * This allows trajectories to be consumed by any OTel-compatible observability
 * tool (Langfuse, Arize, Phoenix, MLflow, etc.).
 */
export interface OTelGenAISpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: 'INTERNAL' | 'CLIENT' | 'SERVER';
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  attributes: Record<string, string | number | boolean | string[]>;
  status: { code: 'OK' | 'ERROR'; message?: string };
  events: Array<{ name: string; timeUnixNano: string; attributes?: Record<string, unknown> }>;
}

export interface OTelGenAITrace {
  traceId: string;
  spans: OTelGenAISpan[];
}
