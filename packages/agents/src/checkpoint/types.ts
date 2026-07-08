/**
 * Pipeline Checkpointing — Types
 * ===============================
 *
 * A Checkpoint captures the complete state of an analysis pipeline at the
 * boundary between two stages: every agent result produced so far, the stage
 * that just finished, and a timestamp. With a checkpoint, an interrupted run
 * (server crash, OOM, deployment) can resume from the last completed stage
 * instead of restarting from scratch.
 *
 * Design:
 *   - Checkpoints are keyed by `analysisId` (one live checkpoint per run).
 *   - The `agentResults` map is keyed by agentId and stores the full
 *     AgentResult, so resuming agents can consume prior-stage outputs exactly
 *     as if the run had never stopped.
 *   - The `CheckpointStore` interface is storage-agnostic — the in-memory
 *     implementation is for dev/test; a Prisma or Redis backend would plug
 *     in behind the same surface.
 *
 * We reuse the canonical `AgentResult` from `@busara/core` (rather than
 * defining a parallel type) so checkpoints hold exactly the same shape the
 * orchestrator produces — no marshalling, no drift.
 */

// Re-export the canonical AgentResult so consumers can `import { AgentResult } from '@busara/agents'`
// without caring whether it came from core or checkpoint.
export type { AgentResult, AgentStatus } from '@busara/core';

export type CheckpointStatus = 'in_progress' | 'completed' | 'failed';

/**
 * A single pipeline checkpoint.
 *
 * `stage` is the human-readable stage name (e.g. "ingest", "engineer");
 * `stageNumber` is the zero-indexed position. Together they let the
 * orchestrator know exactly where to resume.
 */
export interface Checkpoint {
  id: string;
  analysisId: string;
  stage: string;
  stageNumber: number;
  agentResults: Record<string, import('@busara/core').AgentResult>;
  timestamp: string;
  status: CheckpointStatus;
}

/**
 * Storage interface for checkpoints.
 *
 * The contract is one live checkpoint per `analysisId` — `save` overwrites
 * any previous checkpoint for the same analysis (i.e. each save advances the
 * cursor to the latest completed stage).
 */
export interface CheckpointStore {
  save(checkpoint: Checkpoint): Promise<void>;
  load(analysisId: string): Promise<Checkpoint | null>;
  delete(analysisId: string): Promise<void>;
}
