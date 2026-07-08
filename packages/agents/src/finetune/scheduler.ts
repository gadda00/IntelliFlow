/**
 * Fine-Tuning Pipeline — Scheduler
 * ================================
 *
 * Decides WHEN an agent has accumulated enough trajectory signal to
 * warrant a fine-tune, and produces a `FineTuneConfig` describing the
 * suggested job.
 *
 * Readiness gates (all must pass):
 *   1. At least 200 trajectories total for the agent.
 *   2. At least 50 positive-reward AND 20 negative-reward trajectories
 *      (DPO needs contrast; SFT alone can relax the negative minimum
 *      but we keep the same bar for consistency).
 *   3. At least 20 trajectories in the last 7 days (recency — we don't
 *      want to fine-tune on stale data).
 *
 * The scheduler does NOT execute jobs — it only produces configs. The
 * FineTuneRunner is what actually runs them.
 */

import type { TrajectoryStore } from '../trajectory/store';
import type { DataProxy } from '../trajectory/dataProxy';
import type { FineTuneConfig, FineTuneMethod } from './types';

export class FineTuneScheduler {
  constructor(
    private store: TrajectoryStore,
    // The DataProxy is held for future use (e.g. exporting the exact
    // filtered dataset the runner will train on). It isn't needed for
    // the readiness check itself, which only reads aggregate stats.
    private dataProxy: DataProxy,
  ) {}

  /**
   * Check if an agent is ready for fine-tuning.
   * Returns a FineTuneConfig if ready, null otherwise.
   */
  async checkReadiness(agentId: string): Promise<FineTuneConfig | null> {
    const stats = await this.store.getAgentStats(agentId);

    // 1. Need at least 200 trajectories.
    if (stats.totalTrajectories < 200) return null;

    // 2. Need mixed rewards (both positive and negative — DPO needs contrast).
    if (stats.rewardDistribution.positive < 50 || stats.rewardDistribution.negative < 20) {
      return null;
    }

    // 3. Need recent activity (last 7 days).
    const recentTrend = stats.recentTrend.slice(-7);
    const recentCount = recentTrend.reduce((a, t) => a + t.count, 0);
    if (recentCount < 20) return null;

    // 4. Choose the method: DPO if we have enough negatives to pair,
    //    otherwise SFT. (PPO/RLHF are reserved for explicit opt-in.)
    const method: FineTuneMethod = stats.rewardDistribution.negative > 50 ? 'dpo' : 'sft';

    return {
      method,
      agentId,
      baseModel: 'glm-4.6',
      outputModelName: `${agentId}-finetuned-${Date.now()}`,
      hyperparameters: {
        learningRate: 5e-5,
        epochs: 3,
        batchSize: 8,
        warmupRatio: 0.1,
        weightDecay: 0.01,
        maxSeqLength: 2048,
      },
      dataConfig: {
        minTrajectories: 200,
        minReward: 0.0,
        minQualityScore: 0.5,
        maxAge: 30,
      },
      evalConfig: {
        holdoutPercentage: 20,
        evalMetrics: ['accuracy', 'reward_correlation', 'hallucination_rate'],
      },
      deploymentConfig: {
        autoDeploy: false,
        canaryPercentage: 10,
        rollbackOnRegression: true,
      },
    };
  }

  /**
   * Check all agents and return those ready for fine-tuning.
   *
   * Iterates `agentIds` sequentially (the in-memory store is fast; for a
   * Prisma-backed store this should be batched / parallelized with care
   * to avoid hammering the DB).
   */
  async findReadyAgents(
    agentIds: string[],
  ): Promise<Array<{ agentId: string; config: FineTuneConfig }>> {
    const ready: Array<{ agentId: string; config: FineTuneConfig }> = [];
    for (const agentId of agentIds) {
      const config = await this.checkReadiness(agentId);
      if (config) ready.push({ agentId, config });
    }
    return ready;
  }
}
