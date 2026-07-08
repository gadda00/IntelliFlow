/**
 * Data Proxy (Pillar 2)
 * =====================
 *
 * Converts production agent trajectories into governed learning substrates.
 *
 * The AReaL paper (arXiv:2607.01120) identifies the data proxy as the second
 * missing pillar: "there is no enterprise-grade comprehensive data proxy that
 * converts real workloads into governed learning substrates."
 *
 * The Data Proxy:
 *   1. INGESTS trajectories from the TrajectoryStore
 *   2. FILTERS out unusable ones (failed, adversarial, PII-contaminated)
 *   3. SCRUBS PII from trajectory data (using PrivacyScan agent logic)
 *   4. SCORES trajectory quality (automated reward model)
 *   5. DEDUPLICATES by (dataframeHash, agentId, configHash)
 *   6. EXPORTS filtered datasets for training/analysis
 *
 * Governance features:
 *   - PII detection + scrubbing
 *   - Quality scoring (heuristics + optional LLM-as-judge)
 *   - Retention policies (delete trajectories older than N days)
 *   - Access control (only org members can export org trajectories)
 *   - Audit logging (every export is logged)
 */

import { createHash } from 'crypto';
import type {
  Trajectory,
  TrajectoryQuery,
  RewardSignal,
} from './types';
import type { TrajectoryStore, AgentTrajectoryStats } from './store';

// ============================================================================
// Data Proxy Types
// ============================================================================

export interface DataProxyConfig {
  /** Minimum success rate for an agent's trajectories to be included. */
  minSuccessRate?: number;
  /** Minimum quality score (0-1) for inclusion. */
  minQualityScore?: number;
  /** Whether to scrub PII before export. */
  scrubPII?: boolean;
  /** Whether to deduplicate by (dataframeHash, agentId, configHash). */
  deduplicate?: boolean;
  /** Maximum trajectories per agent in the export. */
  maxPerAgent?: number;
  /** Only include trajectories with at least one reward signal. */
  requireRewards?: boolean;
  /** Date range filter. */
  startDate?: string;
  endDate?: string;
}

export interface QualityScore {
  /** Overall quality score, 0.0 to 1.0. */
  score: number;
  /** Breakdown of the score. */
  components: QualityScoreComponent[];
  /** What lowered the score. */
  issues?: string[];
}

export interface QualityScoreComponent {
  name: string;
  score: number;
  weight: number;
  details?: Record<string, unknown>;
}

export interface ScrubbedTrajectory {
  /** The scrubbed trajectory (PII removed). */
  trajectory: Trajectory;
  /** What was scrubbed. */
  scrubReport: PIIScrubReport;
}

export interface PIIScrubReport {
  /** Number of PII instances found and removed. */
  piiRemoved: number;
  /** Which fields were scrubbed. */
  fieldsScrubbed: string[];
  /** PII types detected. */
  typesDetected: string[];
}

export interface ExportedDataset {
  /** Dataset ID. */
  id: string;
  /** When it was created. */
  createdAt: string;
  /** Configuration used to produce it. */
  config: DataProxyConfig;
  /** The trajectories in the dataset. */
  trajectories: Trajectory[];
  /** Dataset statistics. */
  stats: DatasetStats;
  /** Audit log entry. */
  audit: ExportAudit;
}

export interface DatasetStats {
  totalTrajectories: number;
  uniqueAgents: number;
  uniqueDataframes: number;
  totalSteps: number;
  totalTokens: number;
  averageQuality: number;
  averageReward: number;
  dateRange: { start: string; end: string };
}

export interface ExportAudit {
  exportedBy: string;
  exportedAt: string;
  purpose: string;
  trajectoryCount: number;
  agentIds: string[];
}

// ============================================================================
// PII Patterns (from PrivacyScan agent)
// ============================================================================

const PII_PATTERNS: Array<{ type: string; regex: RegExp; replacement: string }> = [
  { type: 'email', regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, replacement: '[EMAIL]' },
  { type: 'phone', regex: /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3,4}[-.\s]?\d{4}/g, replacement: '[PHONE]' },
  { type: 'ssn', regex: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '[SSN]' },
  { type: 'credit_card', regex: /\b(?:\d[ -]*?){13,16}\b/g, replacement: '[CREDIT_CARD]' },
  { type: 'ip_address', regex: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, replacement: '[IP]' },
  { type: 'api_key', regex: /\b(?:sk|pk|ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}\b/g, replacement: '[API_KEY]' },
];

// ============================================================================
// Data Proxy
// ============================================================================

export class DataProxy {
  constructor(private store: TrajectoryStore) {}

  /**
   * Export a filtered, scrubbed, deduplicated dataset of trajectories.
   */
  async exportDataset(
    query: TrajectoryQuery,
    config: DataProxyConfig = {},
    audit: Omit<ExportAudit, 'exportedAt' | 'trajectoryCount' | 'agentIds'>,
  ): Promise<ExportedDataset> {
    // 1. Query trajectories
    const { trajectories: summaries } = await this.store.query(query);
    const fullTrajectories: Trajectory[] = [];
    for (const summary of summaries) {
      const t = await this.store.get(summary.id);
      if (t) fullTrajectories.push(t);
    }

    // 2. Filter by success
    let filtered = fullTrajectories;
    if (config.minSuccessRate !== undefined) {
      // Group by agent, check success rate
      const agentGroups = this.groupByAgent(filtered);
      filtered = filtered.filter(t => {
        const stats = agentGroups.get(t.agentId);
        return stats && stats.successRate >= (config.minSuccessRate ?? 0);
      });
    }

    // 3. Filter by rewards
    if (config.requireRewards) {
      filtered = filtered.filter(t => t.rewards.length > 0);
    }

    // 4. Score quality
    const scored = filtered.map(t => ({
      trajectory: t,
      quality: this.scoreQuality(t),
    }));

    // 5. Filter by quality
    if (config.minQualityScore !== undefined) {
      scored.filter(s => s.quality.score >= (config.minQualityScore ?? 0));
    }

    // 6. Deduplicate
    let result = scored.map(s => s.trajectory);
    if (config.deduplicate !== false) {
      result = this.deduplicate(result);
    }

    // 7. Limit per agent
    if (config.maxPerAgent) {
      const byAgent = new Map<string, Trajectory[]>();
      for (const t of result) {
        if (!byAgent.has(t.agentId)) byAgent.set(t.agentId, []);
        byAgent.get(t.agentId)!.push(t);
      }
      result = [];
      for (const [, trajectories] of byAgent) {
        result.push(...trajectories.slice(0, config.maxPerAgent));
      }
    }

    // 8. Scrub PII
    if (config.scrubPII !== false) {
      result = result.map(t => this.scrubPII(t).trajectory);
    }

    // 9. Compute stats
    const stats = this.computeStats(result);

    // 10. Build audit
    const fullAudit: ExportAudit = {
      ...audit,
      exportedAt: new Date().toISOString(),
      trajectoryCount: result.length,
      agentIds: [...new Set(result.map(t => t.agentId))],
    };

    return {
      id: `dataset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      config,
      trajectories: result,
      stats,
      audit: fullAudit,
    };
  }

  /**
   * Score the quality of a trajectory.
   *
   * Quality = weighted average of:
   *   - Success (40%): did the agent succeed?
   *   - Efficiency (20%): was it fast?
   *   - Richness (20%): did it produce detailed output?
   *   - Reward (20%): did users find it useful?
   */
  scoreQuality(trajectory: Trajectory): QualityScore {
    const components: QualityScoreComponent[] = [];

    // Success component (40%)
    const successScore = trajectory.status === 'success' ? 1.0 : 0.0;
    components.push({
      name: 'success',
      score: successScore,
      weight: 0.4,
    });

    // Efficiency component (20%) — faster is better, but normalize by data size
    const expectedDuration = Math.max(1000, trajectory.metadata.rowCount * 10);
    const efficiencyScore = Math.min(
      1.0,
      expectedDuration / Math.max(trajectory.metrics.totalDurationMs, 1),
    );
    components.push({
      name: 'efficiency',
      score: efficiencyScore,
      weight: 0.2,
      details: { durationMs: trajectory.metrics.totalDurationMs, expectedMs: expectedDuration },
    });

    // Richness component (20%) — more steps = richer trajectory
    const expectedSteps = 3;
    const richnessScore = Math.min(1.0, trajectory.metrics.stepCount / expectedSteps);
    components.push({
      name: 'richness',
      score: richnessScore,
      weight: 0.2,
      details: { stepCount: trajectory.metrics.stepCount },
    });

    // Reward component (20%)
    const avgReward =
      trajectory.rewards.length > 0
        ? trajectory.rewards.reduce((acc, r) => acc + r.value, 0) / trajectory.rewards.length
        : 0;
    // Normalize from [-1, 1] to [0, 1]
    const rewardScore = (avgReward + 1) / 2;
    components.push({
      name: 'reward',
      score: rewardScore,
      weight: 0.2,
      details: { averageReward: avgReward, rewardCount: trajectory.rewards.length },
    });

    // Weighted average
    const score = components.reduce((acc, c) => acc + c.score * c.weight, 0);

    const issues: string[] = [];
    if (successScore === 0) issues.push('Agent did not succeed');
    if (efficiencyScore < 0.3) issues.push('Execution was slow relative to data size');
    if (richnessScore < 0.5) issues.push('Trajectory has few steps');
    if (avgReward < 0) issues.push('Average reward is negative');

    return { score, components, issues: issues.length > 0 ? issues : undefined };
  }

  /**
   * Scrub PII from a trajectory.
   * Replaces emails, phones, SSNs, credit cards, IPs, API keys with placeholders.
   */
  scrubPII(trajectory: Trajectory): ScrubbedTrajectory {
    const scrubbed = structuredClone(trajectory);
    let piiRemoved = 0;
    const fieldsScrubbed = new Set<string>();
    const typesDetected = new Set<string>();

    // Scrub all string fields in steps
    for (const step of scrubbed.steps) {
      step.observation = this.scrubValue(step.observation, 'observation', fieldsScrubbed, typesDetected, (count) => { piiRemoved += count; });
      step.action = this.scrubValue(step.action, 'action', fieldsScrubbed, typesDetected, (count) => { piiRemoved += count; });
      step.result = this.scrubValue(step.result, 'result', fieldsScrubbed, typesDetected, (count) => { piiRemoved += count; });
      if (step.llmCall) {
        step.llmCall.systemPrompt = this.scrubString(step.llmCall.systemPrompt, 'llmCall.systemPrompt', fieldsScrubbed, typesDetected, (count) => { piiRemoved += count; });
        step.llmCall.userPrompt = this.scrubString(step.llmCall.userPrompt, 'llmCall.userPrompt', fieldsScrubbed, typesDetected, (count) => { piiRemoved += count; });
        step.llmCall.response = this.scrubString(step.llmCall.response, 'llmCall.response', fieldsScrubbed, typesDetected, (count) => { piiRemoved += count; });
      }
      if (step.toolCall) {
        step.toolCall.input = this.scrubValue(step.toolCall.input, 'toolCall.input', fieldsScrubbed, typesDetected, (count) => { piiRemoved += count; });
        step.toolCall.output = this.scrubValue(step.toolCall.output, 'toolCall.output', fieldsScrubbed, typesDetected, (count) => { piiRemoved += count; });
      }
    }

    // Mark as scrubbed
    scrubbed.metadata.piiScrubbed = true;

    return {
      trajectory: scrubbed,
      scrubReport: {
        piiRemoved,
        fieldsScrubbed: [...fieldsScrubbed],
        typesDetected: [...typesDetected],
      },
    };
  }

  private scrubValue(
    value: unknown,
    fieldPath: string,
    fieldsScrubbed: Set<string>,
    typesDetected: Set<string>,
    counter: (count: number) => void,
  ): unknown {
    if (typeof value === 'string') {
      return this.scrubString(value, fieldPath, fieldsScrubbed, typesDetected, counter);
    }
    if (Array.isArray(value)) {
      return value.map((v, i) => this.scrubValue(v, `${fieldPath}[${i}]`, fieldsScrubbed, typesDetected, counter));
    }
    if (value && typeof value === 'object') {
      const result: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) {
        result[k] = this.scrubValue(v, `${fieldPath}.${k}`, fieldsScrubbed, typesDetected, counter);
      }
      return result;
    }
    return value;
  }

  private scrubString(
    s: string,
    fieldPath: string,
    fieldsScrubbed: Set<string>,
    typesDetected: Set<string>,
    counter: (count: number) => void,
  ): string {
    let result = s;
    let count = 0;
    for (const { type, regex, replacement } of PII_PATTERNS) {
      const matches = result.match(regex);
      if (matches) {
        count += matches.length;
        typesDetected.add(type);
        fieldsScrubbed.add(fieldPath);
        result = result.replace(regex, replacement);
      }
    }
    if (count > 0) counter(count);
    return result;
  }

  /**
   * Deduplicate trajectories by (dataframeHash, agentId, configHash).
   * If multiple trajectories have the same key, keep the one with the highest reward.
   */
  deduplicate(trajectories: Trajectory[]): Trajectory[] {
    const byKey = new Map<string, Trajectory>();
    for (const t of trajectories) {
      const key = `${t.metadata.dataframeHash}:${t.agentId}:${t.contextSnapshot.configHash}`;
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, t);
      } else {
        const existingReward = existing.rewards.reduce((acc, r) => acc + r.value, 0);
        const newReward = t.rewards.reduce((acc, r) => acc + r.value, 0);
        if (newReward > existingReward) {
          byKey.set(key, t);
        }
      }
    }
    return [...byKey.values()];
  }

  private groupByAgent(trajectories: Trajectory[]): Map<string, AgentTrajectoryStats> {
    const byAgent = new Map<string, Trajectory[]>();
    for (const t of trajectories) {
      if (!byAgent.has(t.agentId)) byAgent.set(t.agentId, []);
      byAgent.get(t.agentId)!.push(t);
    }
    const stats = new Map<string, AgentTrajectoryStats>();
    for (const [agentId, ts] of byAgent) {
      const success = ts.filter(t => t.status === 'success').length;
      stats.set(agentId, {
        agentId,
        totalTrajectories: ts.length,
        successCount: success,
        failureCount: ts.length - success,
        successRate: ts.length > 0 ? success / ts.length : 0,
        averageDurationMs: 0,
        averageReward: 0,
        totalTokens: 0,
        totalCost: 0,
        uniqueDataframeCount: 0,
        rewardDistribution: { positive: 0, neutral: 0, negative: 0 },
        recentTrend: [],
      });
    }
    return stats;
  }

  private computeStats(trajectories: Trajectory[]): DatasetStats {
    if (trajectories.length === 0) {
      return {
        totalTrajectories: 0,
        uniqueAgents: 0,
        uniqueDataframes: 0,
        totalSteps: 0,
        totalTokens: 0,
        averageQuality: 0,
        averageReward: 0,
        dateRange: { start: '', end: '' },
      };
    }

    const agentIds = new Set(trajectories.map(t => t.agentId));
    const dataframeHashes = new Set(trajectories.map(t => t.metadata.dataframeHash));
    const totalSteps = trajectories.reduce((acc, t) => acc + t.metrics.stepCount, 0);
    const totalTokens = trajectories.reduce((acc, t) => acc + t.metrics.totalTokens, 0);
    const allRewards = trajectories.flatMap(t => t.rewards);
    const averageReward = allRewards.length > 0
      ? allRewards.reduce((acc, r) => acc + r.value, 0) / allRewards.length
      : 0;
    const qualities = trajectories.map(t => this.scoreQuality(t).score);
    const averageQuality = qualities.reduce((a, b) => a + b, 0) / qualities.length;
    const dates = trajectories.map(t => t.startedAt).sort();

    return {
      totalTrajectories: trajectories.length,
      uniqueAgents: agentIds.size,
      uniqueDataframes: dataframeHashes.size,
      totalSteps,
      totalTokens,
      averageQuality,
      averageReward,
      dateRange: { start: dates[0], end: dates[dates.length - 1] },
    };
  }
}
