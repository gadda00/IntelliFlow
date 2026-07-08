/**
 * CheckpointManager — save and restore pipeline state across stage boundaries.
 *
 * Usage pattern (inside the DAG orchestrator's stage loop):
 *
 *   for (const [stageIdx, stageAgents] of plan.stages.entries()) {
 *     // ... run stage agents, collect results into a Map ...
 *     await checkpointManager.saveCheckpoint(
 *       analysisId, stageName, stageIdx, resultsSoFar,
 *     );
 *   }
 *
 *   // On resume (e.g. after a crash):
 *   const ckpt = await checkpointManager.restoreCheckpoint(analysisId);
 *   if (ckpt) {
 *     // Rehydrate `results` Map from ckpt.agentResults, skip to stage ckpt.stageNumber + 1.
 *   }
 *
 * The manager itself is storage-agnostic — pass it any CheckpointStore.
 * `InMemoryCheckpointStore` is provided for dev/test; a Prisma or Redis
 * backend would implement the same interface for production.
 */

import type {
  AgentResult,
  Checkpoint,
  CheckpointStatus,
  CheckpointStore,
} from './types';

export class CheckpointManager {
  constructor(private store: CheckpointStore) {}

  /**
   * Persist a checkpoint after a stage completes.
   *
   * `results` is the cumulative map of all agent results produced so far
   * (not just this stage's), so a resumed run has every prior-stage output
   * available to downstream agents.
   */
  async saveCheckpoint(
    analysisId: string,
    stage: string,
    stageNumber: number,
    results: Map<string, AgentResult>,
    status: CheckpointStatus = 'in_progress',
  ): Promise<Checkpoint> {
    const checkpoint: Checkpoint = {
      id: `ckpt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      analysisId,
      stage,
      stageNumber,
      agentResults: Object.fromEntries(results),
      timestamp: new Date().toISOString(),
      status,
    };
    await this.store.save(checkpoint);
    return checkpoint;
  }

  /**
   * Load the latest checkpoint for an analysis, or null if none exists.
   *
   * The returned checkpoint's `agentResults` can be reconstructed into a
   * Map and fed back into the orchestrator so downstream agents see the
   * same prior-stage outputs they would have seen in the original run.
   */
  async restoreCheckpoint(analysisId: string): Promise<Checkpoint | null> {
    return this.store.load(analysisId);
  }

  /**
   * Delete the checkpoint for an analysis (e.g. after a successful run,
   * to avoid unbounded growth).
   */
  async deleteCheckpoint(analysisId: string): Promise<void> {
    await this.store.delete(analysisId);
  }
}

/**
 * In-memory CheckpointStore — for dev, tests, and single-process deployments.
 *
 * Keyed by `analysisId`; `save` overwrites the previous checkpoint for the
 * same analysis (one live checkpoint per run).
 */
export class InMemoryCheckpointStore implements CheckpointStore {
  private checkpoints = new Map<string, Checkpoint>();

  async save(checkpoint: Checkpoint): Promise<void> {
    // Store a shallow clone so external mutation of the input doesn't
    // silently change what `load` returns later.
    this.checkpoints.set(checkpoint.analysisId, { ...checkpoint });
  }

  async load(analysisId: string): Promise<Checkpoint | null> {
    const cp = this.checkpoints.get(analysisId);
    return cp ? { ...cp } : null;
  }

  async delete(analysisId: string): Promise<void> {
    this.checkpoints.delete(analysisId);
  }

  /** Test helper: how many checkpoints are currently stored. */
  get size(): number {
    return this.checkpoints.size;
  }
}
