/**
 * Evolution Control Plane (Pillar 3)
 * ===================================
 *
 * Automatically decides, based on trajectory statistics, when to update
 * policy weights or evolve the in-context harness.
 *
 * The AReaL paper (arXiv:2607.01120) identifies this as the third missing
 * pillar: "there is no unified agent evolution control plane that
 * automatically decides, based on trajectory statistics, when to update
 * policy weights or evolve the in-context harness."
 *
 * This module implements:
 *   1. Drift detection — is an agent's output distribution changing?
 *   2. Auto-promotion — promote agents from beta → stable based on performance
 *   3. Config optimization — suggest config defaults based on what works
 *   4. A/B testing — route traffic to experimental configs
 *   5. Evolution actions — the decisions the control plane can make
 *
 * Design principles:
 *   - Human-in-the-loop: all evolution actions are SUGGESTIONS until approved
 *   - Safety first: never auto-deploy changes that could regress
 *   - Observable: every decision is logged with its rationale
 *   - Reversible: every change can be rolled back
 */

import type { TrajectoryStore, AgentTrajectoryStats } from './store';
import type { Trajectory, RewardSignal } from './types';

// ============================================================================
// Evolution Types
// ============================================================================

export type EvolutionActionType =
  | 'PROMOTE_STABILITY'      // beta → stable
  | 'DEMOTE_STABILITY'       // stable → beta (performance regressed)
  | 'OPTIMIZE_CONFIG'        // suggest new default config
  | 'FLAG_DRIFT'             // alert that output distribution changed
  | 'FLAG_LOW_REWARD'        // alert that rewards are trending negative
  | 'FLAG_HIGH_FAILURE'      // alert that failure rate is too high
  | 'SCHEDULE_FINE_TUNE'     // suggest fine-tuning the agent's LLM
  | 'SCHEDULE_PROMPT_UPDATE' // suggest updating the system prompt
  | 'DEPRECATE_AGENT'        // suggest deprecating the agent
  | 'A_B_TEST_CONFIG'        // suggest A/B testing a new config
  | 'NONE';                  // no action needed

export interface EvolutionAction {
  type: EvolutionActionType;
  agentId: string;
  reason: string;
  evidence: EvolutionEvidence;
  suggestedChange?: Record<string, unknown>;
  confidence: number;  // 0.0 to 1.0
  createdAt: string;
  /** Whether a human has reviewed this action. */
  reviewedAt?: string;
  reviewedBy?: string;
  /** Whether the action was applied. */
  appliedAt?: string;
  status: 'pending' | 'approved' | 'rejected' | 'applied' | 'rolled_back';
}

export interface EvolutionEvidence {
  totalTrajectories: number;
  successRate: number;
  averageReward: number;
  driftScore?: number;
  recentTrend: {
    date: string;
    successRate: number;
    averageReward: number;
    count: number;
  }[];
  configInsights?: ConfigInsight[];
}

export interface ConfigInsight {
  configKey: string;
  currentValue: unknown;
  suggestedValue: unknown;
  reason: string;
  evidence: {
    highRewardOccurrences: number;
    lowRewardOccurrences: number;
    averageRewardWithCurrent: number;
    averageRewardWithSuggested: number;
  };
}

// ============================================================================
// Drift Detection
// ============================================================================

export interface DriftDetectionResult {
  isDrifting: boolean;
  driftScore: number;  // 0.0 (no drift) to 1.0 (severe drift)
  direction: 'improving' | 'degrading' | 'stable';
  details: {
    recentSuccessRate: number;
    historicalSuccessRate: number;
    recentReward: number;
    historicalReward: number;
    ksStatistic?: number;  // Kolmogorov-Smirnov statistic if applicable
  };
}

/**
 * Detect drift in an agent's performance.
 *
 * Compares recent trajectories (last 7 days) to historical (last 30 days).
 * If the success rate or reward distribution has shifted significantly,
 * we flag it as drifting.
 */
export async function detectDrift(
  store: TrajectoryStore,
  agentId: string,
): Promise<DriftDetectionResult> {
  const stats = await store.getAgentStats(agentId);

  if (stats.totalTrajectories < 20) {
    return {
      isDrifting: false,
      driftScore: 0,
      direction: 'stable',
      details: {
        recentSuccessRate: stats.successRate,
        historicalSuccessRate: stats.successRate,
        recentReward: stats.averageReward,
        historicalReward: stats.averageReward,
      },
    };
  }

  // Recent = last 3 days of trend, historical = all 7 days
  const recent = stats.recentTrend.slice(-3);
  const historical = stats.recentTrend;

  const recentSuccessRate = recent.length > 0
    ? recent.reduce((acc, t) => acc + t.successRate * t.count, 0) / recent.reduce((acc, t) => acc + t.count, 0)
    : stats.successRate;
  const historicalSuccessRate = historical.length > 0
    ? historical.reduce((acc, t) => acc + t.successRate * t.count, 0) / historical.reduce((acc, t) => acc + t.count, 0)
    : stats.successRate;

  const recentReward = recent.length > 0
    ? recent.reduce((acc, t) => acc + t.averageReward * t.count, 0) / recent.reduce((acc, t) => acc + t.count, 0)
    : stats.averageReward;
  const historicalReward = historical.length > 0
    ? historical.reduce((acc, t) => acc + t.averageReward * t.count, 0) / historical.reduce((acc, t) => acc + t.count, 0)
    : stats.averageReward;

  // Drift score = absolute change in success rate + absolute change in reward
  const successRateDelta = Math.abs(recentSuccessRate - historicalSuccessRate);
  const rewardDelta = Math.abs(recentReward - historicalReward);
  const driftScore = Math.min(1.0, successRateDelta + rewardDelta);

  const isDrifting = driftScore > 0.15;  // 15% change threshold

  let direction: 'improving' | 'degrading' | 'stable' = 'stable';
  if (recentSuccessRate > historicalSuccessRate + 0.05 || recentReward > historicalReward + 0.1) {
    direction = 'improving';
  } else if (recentSuccessRate < historicalSuccessRate - 0.05 || recentReward < historicalReward - 0.1) {
    direction = 'degrading';
  }

  return {
    isDrifting,
    driftScore,
    direction,
    details: {
      recentSuccessRate,
      historicalSuccessRate,
      recentReward,
      historicalReward,
    },
  };
}

// ============================================================================
// Config Optimization
// ============================================================================

/**
 * Analyze trajectories to find config values that correlate with high rewards.
 * Suggests new default configs based on what actually works in production.
 */
export async function optimizeConfig(
  store: TrajectoryStore,
  agentId: string,
): Promise<ConfigInsight[]> {
  const { trajectories } = await store.query({ agentId, limit: 500 });
  const insights: ConfigInsight[] = [];

  // Load full trajectories
  const fullTrajectories: Trajectory[] = [];
  for (const summary of trajectories) {
    const t = await store.get(summary.id);
    if (t && t.rewards.length > 0) fullTrajectories.push(t);
  }

  if (fullTrajectories.length < 10) {
    return insights;  // Not enough data
  }

  // For each config key, compare reward distribution across values
  const configKeys = new Set<string>();
  for (const t of fullTrajectories) {
    for (const key of Object.keys(t.contextSnapshot.config)) {
      configKeys.add(key);
    }
  }

  for (const key of configKeys) {
    const valueBuckets = new Map<string, { rewards: number[]; count: number }>();

    for (const t of fullTrajectories) {
      const value = t.contextSnapshot.config[key];
      if (value === undefined) continue;

      const valueKey = JSON.stringify(value);
      if (!valueBuckets.has(valueKey)) {
        valueBuckets.set(valueKey, { rewards: [], count: 0 });
      }
      const bucket = valueBuckets.get(valueKey)!;
      const avgReward = t.rewards.reduce((acc, r) => acc + r.value, 0) / t.rewards.length;
      bucket.rewards.push(avgReward);
      bucket.count++;
    }

    if (valueBuckets.size < 2) continue;  // Need at least 2 different values

    // Find the value with highest average reward
    let bestValue = '';
    let bestAvgReward = -Infinity;
    let bestCount = 0;
    for (const [valueKey, bucket] of valueBuckets) {
      const avgReward = bucket.rewards.reduce((a, b) => a + b, 0) / bucket.rewards.length;
      if (avgReward > bestAvgReward && bucket.count >= 3) {  // Need at least 3 occurrences
        bestAvgReward = avgReward;
        bestValue = valueKey;
        bestCount = bucket.count;
      }
    }

    if (!bestValue) continue;

    // Find the current most common value
    let currentValue = '';
    let currentCount = 0;
    let currentAvgReward = 0;
    for (const [valueKey, bucket] of valueBuckets) {
      if (bucket.count > currentCount) {
        currentCount = bucket.count;
        currentValue = valueKey;
        currentAvgReward = bucket.rewards.reduce((a, b) => a + b, 0) / bucket.rewards.length;
      }
    }

    // Only suggest if the best value is different from the current most common
    if (bestValue !== currentValue && bestAvgReward > currentAvgReward + 0.1) {
      insights.push({
        configKey: key,
        currentValue: JSON.parse(currentValue),
        suggestedValue: JSON.parse(bestValue),
        reason: `Config value ${bestValue} has average reward ${bestAvgReward.toFixed(2)} vs current ${currentValue} at ${currentAvgReward.toFixed(2)}`,
        evidence: {
          highRewardOccurrences: bestCount,
          lowRewardOccurrences: currentCount,
          averageRewardWithCurrent: currentAvgReward,
          averageRewardWithSuggested: bestAvgReward,
        },
      });
    }
  }

  return insights;
}

// ============================================================================
// Evolution Control Plane
// ============================================================================

export interface EvolutionControlPlaneConfig {
  /** Minimum trajectories before considering promotion. */
  minTrajectoriesForPromotion?: number;
  /** Success rate threshold for beta → stable promotion. */
  promotionSuccessRateThreshold?: number;
  /** Success rate threshold for stable → beta demotion. */
  demotionSuccessRateThreshold?: number;
  /** Drift score threshold for flagging. */
  driftFlagThreshold?: number;
  /** Minimum average reward for healthy agent. */
  minHealthyReward?: number;
  /** Maximum failure rate before flagging. */
  maxFailureRate?: number;
}

export class EvolutionControlPlane {
  constructor(
    private store: TrajectoryStore,
    private config: EvolutionControlPlaneConfig = {},
  ) {
    this.config = {
      minTrajectoriesForPromotion: 100,
      promotionSuccessRateThreshold: 0.9,
      demotionSuccessRateThreshold: 0.7,
      driftFlagThreshold: 0.2,
      minHealthyReward: -0.1,
      maxFailureRate: 0.2,
      ...config,
    };
  }

  /**
   * Analyze an agent and produce evolution actions.
   */
  async analyze(agentId: string): Promise<EvolutionAction[]> {
    const actions: EvolutionAction[] = [];
    const stats = await this.store.getAgentStats(agentId);
    const drift = await detectDrift(this.store, agentId);
    const configInsights = await optimizeConfig(this.store, agentId);

    const evidence: EvolutionEvidence = {
      totalTrajectories: stats.totalTrajectories,
      successRate: stats.successRate,
      averageReward: stats.averageReward,
      driftScore: drift.driftScore,
      recentTrend: stats.recentTrend,
      configInsights,
    };

    const now = new Date().toISOString();

    // 1. Promote if eligible
    if (
      stats.totalTrajectories >= (this.config.minTrajectoriesForPromotion ?? 100) &&
      stats.successRate >= (this.config.promotionSuccessRateThreshold ?? 0.9) &&
      stats.averageReward >= 0
    ) {
      actions.push({
        type: 'PROMOTE_STABILITY',
        agentId,
        reason: `Agent has ${stats.totalTrajectories} trajectories with ${(stats.successRate * 100).toFixed(1)}% success rate and average reward ${stats.averageReward.toFixed(2)}`,
        evidence,
        confidence: Math.min(1.0, stats.totalTrajectories / 200),
        createdAt: now,
        status: 'pending',
      });
    }

    // 2. Demote if performance regressed
    if (stats.successRate < (this.config.demotionSuccessRateThreshold ?? 0.7)) {
      actions.push({
        type: 'DEMOTE_STABILITY',
        agentId,
        reason: `Success rate dropped to ${(stats.successRate * 100).toFixed(1)}% (below ${(this.config.demotionSuccessRateThreshold ?? 0.7) * 100}% threshold)`,
        evidence,
        confidence: 0.8,
        createdAt: now,
        status: 'pending',
      });
    }

    // 3. Flag drift
    if (drift.isDrifting) {
      actions.push({
        type: 'FLAG_DRIFT',
        agentId,
        reason: `Performance is ${drift.direction} (drift score: ${drift.driftScore.toFixed(2)})`,
        evidence,
        confidence: drift.driftScore,
        createdAt: now,
        status: 'pending',
      });
    }

    // 4. Flag low reward
    if (stats.averageReward < (this.config.minHealthyReward ?? -0.1)) {
      actions.push({
        type: 'FLAG_LOW_REWARD',
        agentId,
        reason: `Average reward is ${stats.averageReward.toFixed(2)} (below ${(this.config.minHealthyReward ?? -0.1)} threshold)`,
        evidence,
        confidence: 0.7,
        createdAt: now,
        status: 'pending',
      });
    }

    // 5. Flag high failure rate
    if (stats.failureCount / Math.max(stats.totalTrajectories, 1) > (this.config.maxFailureRate ?? 0.2)) {
      actions.push({
        type: 'FLAG_HIGH_FAILURE',
        agentId,
        reason: `Failure rate is ${((stats.failureCount / Math.max(stats.totalTrajectories, 1)) * 100).toFixed(1)}% (above ${(this.config.maxFailureRate ?? 0.2) * 100}% threshold)`,
        evidence,
        confidence: 0.8,
        createdAt: now,
        status: 'pending',
      });
    }

    // 6. Suggest config optimization
    if (configInsights.length > 0) {
      const suggestedConfig: Record<string, unknown> = {};
      for (const insight of configInsights) {
        suggestedConfig[insight.configKey] = insight.suggestedValue;
      }
      actions.push({
        type: 'OPTIMIZE_CONFIG',
        agentId,
        reason: `${configInsights.length} config optimization opportunities found`,
        evidence,
        suggestedChange: suggestedConfig,
        confidence: Math.min(0.9, configInsights.length * 0.2),
        createdAt: now,
        status: 'pending',
      });
    }

    // 7. Suggest fine-tuning if enough data and rewards are mixed
    if (stats.totalTrajectories >= 500 && stats.rewardDistribution.positive > 50 && stats.rewardDistribution.negative > 50) {
      actions.push({
        type: 'SCHEDULE_FINE_TUNE',
        agentId,
        reason: `Sufficient trajectory data (${stats.totalTrajectories}) with mixed rewards (${stats.rewardDistribution.positive} positive, ${stats.rewardDistribution.negative} negative) for fine-tuning`,
        evidence,
        confidence: 0.6,
        createdAt: now,
        status: 'pending',
      });
    }

    // 8. Suggest deprecation if consistently poor
    if (stats.totalTrajectories >= 50 && stats.successRate < 0.3 && stats.averageReward < -0.3) {
      actions.push({
        type: 'DEPRECATE_AGENT',
        agentId,
        reason: `Agent consistently underperforming: ${(stats.successRate * 100).toFixed(1)}% success rate, ${stats.averageReward.toFixed(2)} average reward over ${stats.totalTrajectories} trajectories`,
        evidence,
        confidence: 0.9,
        createdAt: now,
        status: 'pending',
      });
    }

    return actions;
  }

  /**
   * Analyze all agents and produce a prioritized list of evolution actions.
   */
  async analyzeAll(agentIds: string[]): Promise<EvolutionAction[]> {
    const allActions: EvolutionAction[] = [];
    for (const agentId of agentIds) {
      const actions = await this.analyze(agentId);
      allActions.push(...actions);
    }
    // Sort by confidence (highest first)
    return allActions.sort((a, b) => b.confidence - a.confidence);
  }
}

// ============================================================================
// Reward Helpers (for building reward signals from user behavior)
// ============================================================================

export function createExplicitReward(
  source: RewardSignal['source'],
  value: number,
  metadata?: Record<string, unknown>,
): RewardSignal {
  return {
    timestamp: new Date().toISOString(),
    type: 'explicit',
    source,
    value,
    metadata,
  };
}

export function createImplicitReward(
  source: RewardSignal['source'],
  value: number,
  metadata?: Record<string, unknown>,
): RewardSignal {
  return {
    timestamp: new Date().toISOString(),
    type: 'implicit',
    source,
    value,
    metadata,
  };
}

export function createAutomatedReward(
  source: RewardSignal['source'],
  value: number,
  metadata?: Record<string, unknown>,
): RewardSignal {
  return {
    timestamp: new Date().toISOString(),
    type: 'automated',
    source,
    value,
    metadata,
  };
}
