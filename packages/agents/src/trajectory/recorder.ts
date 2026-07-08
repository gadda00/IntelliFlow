/**
 * TrajectoryRecorder — wraps agent execution to capture step-level trajectories.
 *
 * This is the runtime component of Pillar 1 (trajectory data protocol).
 * It sits between the DAGOrchestrator and the agent's execute() method,
 * intercepting every observation, action, LLM call, tool call, and result
 * to build a Trajectory object.
 *
 * Usage:
 *   const recorder = new TrajectoryRecorder({
 *     analysisId, userId, agentId, agentVersion, agentStability,
 *     contextSnapshot, metadata,
 *   });
 *   recorder.start();
 *   recorder.observe('input', dataframe);
 *   recorder.llmCall({ provider: 'glm', model: 'glm-4.6', ... });
 *   recorder.toolCall({ tool: 'parseCSV', input, output });
 *   recorder.result(output);
 *   const trajectory = recorder.complete('success');
 *
 * Design principles from the AReaL paper:
 *   1. Step granularity — every meaningful action is a step
 *   2. Causal links — each step records which prior steps influenced it
 *   3. Context snapshot — full reproducibility
 *   4. Reward-ready — rewards can be added after completion
 *   5. Low overhead — recording should not materially slow down execution
 */

import { createHash } from 'crypto';
import type {
  Trajectory,
  TrajectoryId,
  TrajectoryStep,
  StepId,
  TrajectoryStatus,
  TrajectoryContextSnapshot,
  TrajectoryMetadata,
  TrajectoryMetrics,
  TrajectoryError,
  RewardSignal,
  TrajectoryLLMCall,
  TrajectoryToolCall,
  StepType,
} from './types';

// ============================================================================
// Configuration
// ============================================================================

export interface TrajectoryRecorderConfig {
  analysisId: string;
  userId: string;
  agentId: string;
  agentVersion: string;
  agentStability: 'experimental' | 'beta' | 'stable' | 'deprecated';
  workspaceId?: string;
  organizationId?: string;
  contextSnapshot: TrajectoryContextSnapshot;
  metadata: TrajectoryMetadata;
}

// ============================================================================
// TrajectoryRecorder
// ============================================================================

export class TrajectoryRecorder {
  private trajectory: Trajectory;
  private stepCounter = 0;
  private activeStepStack: StepId[] = [];
  private llmCallCount = 0;
  private toolCallCount = 0;
  private totalTokens = 0;
  private estimatedCost = 0;
  private errorCount = 0;
  private retryCount = 0;

  constructor(config: TrajectoryRecorderConfig) {
    const now = new Date().toISOString();
    this.trajectory = {
      id: this.generateId(),
      analysisId: config.analysisId,
      userId: config.userId,
      workspaceId: config.workspaceId,
      organizationId: config.organizationId,
      agentId: config.agentId,
      agentVersion: config.agentVersion,
      agentStability: config.agentStability,
      startedAt: now,
      status: 'running',
      steps: [],
      rewards: [],
      contextSnapshot: config.contextSnapshot,
      metadata: config.metadata,
      metrics: {
        totalDurationMs: 0,
        stepCount: 0,
        llmCallCount: 0,
        totalTokens: 0,
        estimatedCost: 0,
        toolCallCount: 0,
        errorCount: 0,
        retryCount: 0,
      },
    };
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────

  /** Mark the trajectory as started (it's already running from constructor). */
  start(): void {
    // Already running — this is a no-op but makes the API explicit.
  }

  /**
   * Complete the trajectory with a final status.
   * Returns the full trajectory for storage.
   */
  complete(status: TrajectoryStatus, error?: TrajectoryError): Trajectory {
    this.trajectory.completedAt = new Date().toISOString();
    this.trajectory.status = status;
    this.trajectory.error = error;
    this.trajectory.metrics.totalDurationMs =
      Date.now() - new Date(this.trajectory.startedAt).getTime();
    this.trajectory.metrics.llmCallCount = this.llmCallCount;
    this.trajectory.metrics.totalTokens = this.totalTokens;
    this.trajectory.metrics.estimatedCost = this.estimatedCost;
    this.trajectory.metrics.toolCallCount = this.toolCallCount;
    this.trajectory.metrics.errorCount = this.errorCount;
    this.trajectory.metrics.retryCount = this.retryCount;
    this.trajectory.metrics.stepCount = this.trajectory.steps.length;
    return this.trajectory;
  }

  /** Get the current trajectory (for inspection without completing). */
  getTrajectory(): Trajectory {
    return { ...this.trajectory };
  }

  /** Get the trajectory ID. */
  get id(): TrajectoryId {
    return this.trajectory.id;
  }

  // ─── Step Recording ──────────────────────────────────────────────────

  /**
   * Record an observation step (agent received input).
   * Returns the step ID for use in causalParentSteps of later steps.
   */
  observe(observation: unknown, metadata?: Record<string, unknown>): StepId {
    return this.addStep({
      type: 'observation',
      observation,
      causalParentSteps: this.activeStepStack.slice(),
      metadata,
    });
  }

  /**
   * Record a reasoning step (agent thought about what to do).
   */
  reason(reasoning: unknown, metadata?: Record<string, unknown>): StepId {
    return this.addStep({
      type: 'reasoning',
      action: reasoning,
      causalParentSteps: this.activeStepStack.slice(),
      metadata,
    });
  }

  /**
   * Record an LLM call step.
   * This is the most important step type for RL — it captures the exact
   * prompt, response, and token usage that the policy produced.
   */
  llmCall(call: TrajectoryLLMCall, metadata?: Record<string, unknown>): StepId {
    this.llmCallCount++;
    this.totalTokens += call.tokensIn + call.tokensOut;
    if (call.cost) this.estimatedCost += call.cost;

    return this.addStep({
      type: 'llm_call',
      llmCall: call,
      observation: { systemPrompt: call.systemPrompt, userPrompt: call.userPrompt },
      action: { response: call.response },
      result: call.response,
      causalParentSteps: this.activeStepStack.slice(),
      metadata: { provider: call.provider, model: call.model, ...metadata },
    });
  }

  /**
   * Record a tool/function call step.
   */
  toolCall(call: TrajectoryToolCall, metadata?: Record<string, unknown>): StepId {
    this.toolCallCount++;
    if (call.error) this.errorCount++;

    return this.addStep({
      type: 'tool_call',
      toolCall: call,
      observation: call.input,
      action: { tool: call.tool },
      result: call.output,
      error: call.error,
      causalParentSteps: this.activeStepStack.slice(),
      metadata,
    });
  }

  /**
   * Record a pure computation step (no I/O, no LLM).
   */
  compute(
    computation: string,
    input: unknown,
    output: unknown,
    metadata?: Record<string, unknown>,
  ): StepId {
    return this.addStep({
      type: 'computation',
      observation: input,
      action: { computation },
      result: output,
      causalParentSteps: this.activeStepStack.slice(),
      metadata,
    });
  }

  /**
   * Record the final output step.
   */
  result(output: unknown, metadata?: Record<string, unknown>): StepId {
    return this.addStep({
      type: 'output',
      result: output,
      causalParentSteps: this.activeStepStack.slice(),
      metadata,
    });
  }

  /**
   * Record an error step.
   */
  error(message: string, metadata?: Record<string, unknown>): StepId {
    this.errorCount++;
    return this.addStep({
      type: 'error',
      error: message,
      causalParentSteps: this.activeStepStack.slice(),
      metadata,
    });
  }

  /**
   * Record a retry (increments retry counter).
   */
  retry(reason: string, metadata?: Record<string, unknown>): StepId {
    this.retryCount++;
    return this.addStep({
      type: 'computation',
      action: { retry: reason },
      causalParentSteps: this.activeStepStack.slice(),
      metadata,
    });
  }

  // ─── Step Stack Management ───────────────────────────────────────────

  /**
   * Push a step onto the active stack — subsequent steps will list it as
   * a causal parent until it's popped.
   */
  pushStep(stepId: StepId): void {
    this.activeStepStack.push(stepId);
  }

  /** Pop a step from the active stack. */
  popStep(): StepId | undefined {
    return this.activeStepStack.pop();
  }

  // ─── Reward Management ───────────────────────────────────────────────

  /**
   * Add a reward signal to the trajectory.
   * Rewards can be added after the trajectory is complete (e.g., when a user
   * gives feedback days later).
   */
  addReward(reward: RewardSignal): void {
    this.trajectory.rewards.push(reward);
  }

  /** Get all rewards. */
  getRewards(): RewardSignal[] {
    return [...this.trajectory.rewards];
  }

  /** Compute the aggregate reward (weighted average). */
  getAggregateReward(): number {
    if (this.trajectory.rewards.length === 0) return 0;
    const weighted = this.trajectory.rewards.reduce(
      (acc, r) => acc + r.value * this.rewardWeight(r),
      0,
    );
    const totalWeight = this.trajectory.rewards.reduce(
      (acc, r) => acc + this.rewardWeight(r),
      0,
    );
    return totalWeight > 0 ? weighted / totalWeight : 0;
  }

  private rewardWeight(r: RewardSignal): number {
    // Explicit rewards weigh more than implicit, which weigh more than automated.
    if (r.type === 'explicit') return 3.0;
    if (r.type === 'implicit') return 1.5;
    return 1.0;
  }

  // ─── Internal ────────────────────────────────────────────────────────

  private addStep(partial: Partial<TrajectoryStep> & { type: StepType; causalParentSteps: StepId[] }): StepId {
    const stepId = this.generateStepId();
    const step: TrajectoryStep = {
      id: stepId,
      stepIndex: this.stepCounter++,
      timestamp: new Date().toISOString(),
      durationMs: undefined,
      ...partial,
    };
    this.trajectory.steps.push(step);
    return stepId;
  }

  private generateId(): TrajectoryId {
    return `traj_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  private generateStepId(): StepId {
    return `step_${this.trajectory.id}_${this.stepCounter}`;
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Compute a stable hash of the input dataframe for dedup.
 * Two trajectories with the same dataframeHash + agentId + configHash
 * are equivalent and can be deduplicated.
 */
export function computeDataframeHash(data: unknown[]): string {
  // For large dataframes, hash a sample + row count to avoid O(n) hashing.
  const sample = data.length > 1000 ? data.slice(0, 1000) : data;
  const json = JSON.stringify({ sample, rowCount: data.length });
  return createHash('sha256').update(json).digest('hex').slice(0, 16);
}

/**
 * Compute a stable hash of the agent config.
 */
export function computeConfigHash(config: Record<string, unknown>): string {
  const sorted = Object.keys(config)
    .sort()
    .reduce<Record<string, unknown>>((acc, k) => {
      acc[k] = config[k];
      return acc;
    }, {});
  return createHash('sha256').update(JSON.stringify(sorted)).digest('hex').slice(0, 16);
}

/**
 * Create a TrajectoryContextSnapshot from raw inputs.
 */
export function createContextSnapshot(
  config: Record<string, unknown>,
  options?: {
    systemPrompt?: string;
    toolVersions?: Record<string, string>;
    inContextExamples?: unknown[];
    dagContext?: { stage: string; stageNumber: number; availablePriorResults: string[] };
  },
): TrajectoryContextSnapshot {
  return {
    systemPrompt: options?.systemPrompt,
    config,
    configHash: computeConfigHash(config),
    toolVersions: options?.toolVersions,
    inContextExamples: options?.inContextExamples,
    dagContext: options?.dagContext,
  };
}

/**
 * Create TrajectoryMetadata from raw inputs.
 */
export function createMetadata(
  data: unknown[],
  options?: {
    fileName?: string;
    fileType?: string;
    piiDetected?: boolean;
    tags?: string[];
  },
): TrajectoryMetadata {
  const firstRow = data[0];
  const columnCount =
    firstRow && typeof firstRow === 'object' ? Object.keys(firstRow as object).length : 0;
  return {
    dataframeHash: computeDataframeHash(data),
    rowCount: data.length,
    columnCount,
    fileName: options?.fileName,
    fileType: options?.fileType,
    piiDetected: options?.piiDetected ?? false,
    piiScrubbed: false,
    tags: options?.tags,
  };
}
