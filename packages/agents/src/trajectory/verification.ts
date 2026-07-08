/**
 * Verification Gates & Replanning
 * ================================
 *
 * Inspired by: "Verified Multi-Agent Orchestration: A Plan-Execute-Verify-Replan
 * Approach" (2026) and the AReaL paper's emphasis on trajectory quality.
 *
 * Currently, Busara's DAGOrchestrator executes agents in topological order
 * but has NO verification between stages. If an agent produces garbage output,
 * that garbage flows to downstream agents, contaminating the entire pipeline.
 *
 * This module adds:
 *   1. VerificationGate — validates an agent's output before passing it downstream
 *   2. ReplanningStrategy — what to do when verification fails
 *   3. VerifiedExecutor — wraps the existing DAGOrchestrator with verification
 *
 * Verification types:
 *   - Schema verification (does output match the Zod outputSchema?)
 *   - Statistical verification (is the output within expected ranges?)
 *   - Semantic verification (does the output make sense for the input?)
 *   - Cross-agent verification (do multiple agents agree?)
 *
 * Replanning strategies:
 *   - RETRY: re-run the agent with the same config (transient errors)
 *   - RETRY_ADJUSTED: re-run with adjusted config (e.g., lower sensitivity)
 *   - FALLBACK: use a simpler/different agent
 *   - SKIP: skip the agent and continue (mark result as missing)
 *   - ABORT: stop the entire pipeline
 */

import { z } from 'zod';
import type { TrajectoryRecorder } from './recorder';
import type { AgentResult } from '@busara/core';

// ============================================================================
// Verification Types
// ============================================================================

export type VerificationStatus = 'pass' | 'fail' | 'warn' | 'skip';

export interface VerificationResult {
  status: VerificationStatus;
  checks: VerificationCheck[];
  message?: string;
  /** Suggested config adjustment if verification failed. */
  suggestedConfigAdjustment?: Record<string, unknown>;
}

export interface VerificationCheck {
  name: string;
  status: VerificationStatus;
  message?: string;
  details?: Record<string, unknown>;
}

export interface VerificationGate {
  /** Unique name for this gate. */
  name: string;
  /** Run the verification. */
  verify(result: AgentResult, context: VerificationContext): VerificationResult;
}

export interface VerificationContext {
  agentId: string;
  agentName: string;
  stage: string;
  config: Record<string, unknown>;
  dataframe: unknown[];
  previousResults: Map<string, AgentResult>;
  trajectoryRecorder?: TrajectoryRecorder;
}

// ============================================================================
// Built-in Verification Gates
// ============================================================================

/**
 * Schema verification — validates output against a Zod schema.
 * This is the most basic and important gate.
 */
export class SchemaVerificationGate implements VerificationGate {
  name = 'schema';

  constructor(private schema?: z.ZodSchema) {}

  verify(result: AgentResult, _context: VerificationContext): VerificationResult {
    if (!this.schema) {
      return {
        status: 'skip',
        checks: [{ name: 'schema', status: 'skip', message: 'No schema defined' }],
      };
    }

    const parseResult = this.schema.safeParse(result.output);
    if (parseResult.success) {
      return {
        status: 'pass',
        checks: [{ name: 'schema', status: 'pass' }],
      };
    }

    return {
      status: 'fail',
      checks: [
        {
          name: 'schema',
          status: 'fail',
          message: `Output failed schema validation: ${parseResult.error.issues.length} issues`,
          details: {
            issues: parseResult.error.issues.slice(0, 5).map(i => ({
              path: i.path.join('.'),
              message: i.message,
            })),
          },
        },
      ],
    };
  }
}

/**
 * Status verification — checks if the agent reported success.
 */
export class StatusVerificationGate implements VerificationGate {
  name = 'status';

  verify(result: AgentResult, _context: VerificationContext): VerificationResult {
    if (result.status === 'success') {
      return {
        status: 'pass',
        checks: [{ name: 'status', status: 'pass' }],
      };
    }

    return {
      status: 'fail',
      checks: [
        {
          name: 'status',
          status: 'fail',
          message: `Agent status is '${result.status}', expected 'success'`,
          details: { error: result.error },
        },
      ],
    };
  }
}

/**
 * Non-empty output verification — ensures the agent produced some output.
 */
export class NonEmptyOutputGate implements VerificationGate {
  name = 'non-empty-output';

  verify(result: AgentResult, _context: VerificationContext): VerificationResult {
    const output = result.output;

    if (output === null || output === undefined) {
      return {
        status: 'fail',
        checks: [{ name: 'non-empty', status: 'fail', message: 'Output is null/undefined' }],
      };
    }

    if (typeof output === 'object' && !Array.isArray(output)) {
      const keys = Object.keys(output as object);
      if (keys.length === 0) {
        return {
          status: 'fail',
          checks: [{ name: 'non-empty', status: 'fail', message: 'Output object is empty' }],
        };
      }
    }

    if (Array.isArray(output) && output.length === 0) {
      return {
        status: 'warn',
        checks: [{ name: 'non-empty', status: 'warn', message: 'Output array is empty' }],
      };
    }

    return {
      status: 'pass',
      checks: [{ name: 'non-empty', status: 'pass' }],
    };
  }
}

/**
 * Execution time verification — flags agents that took too long.
 */
export class DurationVerificationGate implements VerificationGate {
  name = 'duration';

  constructor(private maxDurationMs: number = 60_000) {}

  verify(result: AgentResult, _context: VerificationContext): VerificationResult {
    if (result.executionTimeMs <= this.maxDurationMs) {
      return {
        status: 'pass',
        checks: [{ name: 'duration', status: 'pass', details: { durationMs: result.executionTimeMs } }],
      };
    }

    return {
      status: 'warn',
      checks: [
        {
          name: 'duration',
          status: 'warn',
          message: `Agent took ${result.executionTimeMs}ms (max ${this.maxDurationMs}ms)`,
          details: { durationMs: result.executionTimeMs, maxMs: this.maxDurationMs },
        },
      ],
    };
  }
}

/**
 * Statistical sanity verification — checks if numeric outputs are within
 * expected ranges. Useful for anomaly detection agents that might produce
 * impossible values (e.g., correlation > 1.0, negative count, NaN).
 */
export class StatisticalSanityGate implements VerificationGate {
  name = 'statistical-sanity';

  verify(result: AgentResult, _context: VerificationContext): VerificationResult {
    const checks: VerificationCheck[] = [];
    const output = result.output as Record<string, unknown> | null;

    if (!output || typeof output !== 'object') {
      return {
        status: 'skip',
        checks: [{ name: 'statistical-sanity', status: 'skip', message: 'Output is not an object' }],
      };
    }

    // Check for NaN values in common numeric fields
    const numericFields = ['correlation', 'r', 'rSquared', 'pValue', 'slope', 'mean', 'median', 'stdev'];
    let hasNaN = false;
    let hasOutOfRange = false;

    for (const field of numericFields) {
      const value = this.findNestedValue(output, field);
      if (value !== undefined && typeof value === 'number') {
        if (Number.isNaN(value)) {
          hasNaN = true;
          checks.push({
            name: `nan-check-${field}`,
            status: 'fail',
            message: `${field} is NaN`,
          });
        }
        // Correlation/r/rSquared should be in [-1, 1]
        if (['correlation', 'r', 'rSquared'].includes(field) && Math.abs(value) > 1.0) {
          hasOutOfRange = true;
          checks.push({
            name: `range-check-${field}`,
            status: 'fail',
            message: `${field} is ${value}, expected [-1, 1]`,
          });
        }
        // pValue should be in [0, 1]
        if (field === 'pValue' && (value < 0 || value > 1)) {
          hasOutOfRange = true;
          checks.push({
            name: `range-check-${field}`,
            status: 'fail',
            message: `${field} is ${value}, expected [0, 1]`,
          });
        }
      }
    }

    if (hasNaN || hasOutOfRange) {
      return {
        status: 'fail',
        checks,
        message: 'Statistical sanity checks failed',
      };
    }

    checks.push({ name: 'statistical-sanity', status: 'pass' });
    return { status: 'pass', checks };
  }

  private findNestedValue(obj: Record<string, unknown>, key: string): unknown {
    if (key in obj) return obj[key];
    for (const v of Object.values(obj)) {
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        const found = this.findNestedValue(v as Record<string, unknown>, key);
        if (found !== undefined) return found;
      }
    }
    return undefined;
  }
}

/**
 * Composite gate — runs multiple gates and aggregates results.
 */
export class CompositeVerificationGate implements VerificationGate {
  name = 'composite';

  constructor(private gates: VerificationGate[]) {}

  verify(result: AgentResult, context: VerificationContext): VerificationResult {
    const allChecks: VerificationCheck[] = [];
    let worstStatus: VerificationStatus = 'pass';

    for (const gate of this.gates) {
      const gateResult = gate.verify(result, context);
      allChecks.push(...gateResult.checks);
      if (this.statusRank(gateResult.status) > this.statusRank(worstStatus)) {
        worstStatus = gateResult.status;
      }
    }

    return { status: worstStatus, checks: allChecks };
  }

  private statusRank(s: VerificationStatus): number {
    return { pass: 0, skip: 1, warn: 2, fail: 3 }[s];
  }
}

// ============================================================================
// Replanning
// ============================================================================

export type ReplanningStrategy =
  | 'RETRY'            // re-run with same config
  | 'RETRY_ADJUSTED'   // re-run with adjusted config
  | 'FALLBACK'         // use a different agent
  | 'SKIP'             // skip and continue
  | 'ABORT';           // stop the pipeline

export interface ReplanningDecision {
  strategy: ReplanningStrategy;
  reason: string;
  adjustedConfig?: Record<string, unknown>;
  fallbackAgentId?: string;
  maxRetries?: number;
}

export interface ReplanningPolicy {
  /** Decide what to do when verification fails. */
  decide(
    failure: VerificationResult,
    context: VerificationContext,
    attempt: number,
  ): ReplanningDecision;
}

/**
 * Default replanning policy — progressive escalation.
 *
 * Attempt 1 failure → RETRY (transient errors)
 * Attempt 2 failure → RETRY_ADJUSTED (e.g., lower sensitivity)
 * Attempt 3 failure → SKIP (continue pipeline without this agent)
 */
export class DefaultReplanningPolicy implements ReplanningPolicy {
  decide(
    failure: VerificationResult,
    context: VerificationContext,
    attempt: number,
  ): ReplanningDecision {
    // If it's just a warning, continue
    if (failure.status === 'warn') {
      return { strategy: 'RETRY', reason: 'Warning — retry once', maxRetries: 1 };
    }

    // Hard failure progression
    if (attempt === 0) {
      return { strategy: 'RETRY', reason: 'First failure — retry for transient errors', maxRetries: 1 };
    }

    if (attempt === 1) {
      // Try adjusting config
      const adjustedConfig = this.adjustConfig(context);
      return {
        strategy: 'RETRY_ADJUSTED',
        reason: 'Second failure — retry with adjusted config',
        adjustedConfig,
        maxRetries: 1,
      };
    }

    // After 2 failures, skip
    return {
      strategy: 'SKIP',
      reason: `Agent failed after ${attempt + 1} attempts — skipping to preserve pipeline`,
    };
  }

  private adjustConfig(context: VerificationContext): Record<string, unknown> {
    const adjusted = { ...context.config };
    // Lower sensitivity if present
    if (adjusted.sensitivity === 'high') adjusted.sensitivity = 'medium';
    else if (adjusted.sensitivity === 'medium') adjusted.sensitivity = 'low';
    // Lower anomaly threshold
    if (typeof adjusted.anomalyThreshold === 'number') {
      adjusted.anomalyThreshold = (adjusted.anomalyThreshold as number) * 1.5;
    }
    // Increase max anomalies
    if (typeof adjusted.maxAnomalies === 'number') {
      adjusted.maxAnomalies = (adjusted.maxAnomalies as number) * 2;
    }
    return adjusted;
  }
}

// ============================================================================
// Verified Executor
// ============================================================================

export interface VerifiedExecutorOptions {
  gates: VerificationGate[];
  replanningPolicy?: ReplanningPolicy;
  maxRetries?: number;
  trajectoryRecorder?: TrajectoryRecorder;
}

export interface VerifiedExecutionResult {
  result: AgentResult;
  verification: VerificationResult;
  attempts: number;
  replanningHistory: ReplanningDecision[];
  skipped: boolean;
}

/**
 * Execute an agent with verification gates and replanning.
 *
 * This wraps the agent's execute() method:
 *   1. Run the agent
 *   2. Verify the output
 *   3. If verification fails, apply replanning policy
 *   4. Repeat until pass or max retries
 *   5. Record everything in the trajectory
 */
export async function executeWithVerification(
  agent: { execute(ctx: unknown): Promise<AgentResult>; metadata: { id: string; name: string; stage: string } },
  ctx: unknown,
  options: VerifiedExecutorOptions,
): Promise<VerifiedExecutionResult> {
  const policy = options.replanningPolicy ?? new DefaultReplanningPolicy();
  const maxRetries = options.maxRetries ?? 3;
  const compositeGate = new CompositeVerificationGate(options.gates);
  const replanningHistory: ReplanningDecision[] = [];

  const context = ctx as VerificationContext & { config: Record<string, unknown>; dataframe: unknown[]; previousResults: Map<string, AgentResult> };

  let currentCtx = ctx;
  let attempt = 0;

  while (attempt <= maxRetries) {
    // Execute the agent
    const result = await agent.execute(currentCtx);

    // Verify
    const verification = compositeGate.verify(result, {
      agentId: agent.metadata.id,
      agentName: agent.metadata.name,
      stage: agent.metadata.stage,
      config: (currentCtx as any).config ?? {},
      dataframe: (currentCtx as any).dataframe ?? [],
      previousResults: (currentCtx as any).previousResults ?? new Map(),
      trajectoryRecorder: options.trajectoryRecorder,
    });

    // Record verification in trajectory
    options.trajectoryRecorder?.observe(
      { verification, attempt },
      { verificationGate: compositeGate.name },
    );

    // If passed, return
    if (verification.status === 'pass' || verification.status === 'skip') {
      return {
        result,
        verification,
        attempts: attempt + 1,
        replanningHistory,
        skipped: false,
      };
    }

    // If warning, return but flag it
    if (verification.status === 'warn') {
      return {
        result,
        verification,
        attempts: attempt + 1,
        replanningHistory,
        skipped: false,
      };
    }

    // Hard failure — apply replanning
    const decision = policy.decide(verification, context, attempt);
    replanningHistory.push(decision);

    options.trajectoryRecorder?.observe(
      { replanningDecision: decision, attempt },
      { replanning: decision.strategy },
    );

    switch (decision.strategy) {
      case 'RETRY':
        attempt++;
        continue;

      case 'RETRY_ADJUSTED':
        attempt++;
        currentCtx = {
          ...(currentCtx as object),
          config: { ...(currentCtx as any).config, ...decision.adjustedConfig },
        } as typeof currentCtx;
        continue;

      case 'FALLBACK':
        // Caller handles fallback — return the failure
        return {
          result,
          verification,
          attempts: attempt + 1,
          replanningHistory,
          skipped: false,
        };

      case 'SKIP':
        // Return a skipped result
        return {
          result: {
            ...result,
            status: 'skipped',
            error: `Skipped after ${attempt + 1} failed attempts: ${verification.message ?? 'verification failed'}`,
          },
          verification,
          attempts: attempt + 1,
          replanningHistory,
          skipped: true,
        };

      case 'ABORT':
        throw new Error(`Pipeline aborted: ${verification.message ?? 'verification failed'}`);

      default:
        attempt++;
        continue;
    }
  }

  // Exhausted retries
  const lastResult = await agent.execute(currentCtx);
  const lastVerification = compositeGate.verify(lastResult, {
    agentId: agent.metadata.id,
    agentName: agent.metadata.name,
    stage: agent.metadata.stage,
    config: (currentCtx as any).config ?? {},
    dataframe: (currentCtx as any).dataframe ?? [],
    previousResults: (currentCtx as any).previousResults ?? new Map(),
    trajectoryRecorder: options.trajectoryRecorder,
  });

  return {
    result: {
      ...lastResult,
      status: 'failed',
      error: `Exhausted ${maxRetries} retries: ${lastVerification.message ?? 'verification failed'}`,
    },
    verification: lastVerification,
    attempts: attempt + 1,
    replanningHistory,
    skipped: false,
  };
}
