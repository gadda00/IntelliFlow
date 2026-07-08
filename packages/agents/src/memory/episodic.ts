/**
 * EpisodicMemoryStore — concrete Memory implementation.
 *
 * Wraps a TrajectoryStore and answers similarity queries by:
 *   1. Pulling every trajectory for the queried agent (capped at 500 for
 *      dev performance — a production store would push this filter into SQL).
 *   2. Scoring each candidate against the query's DataProfile + config.
 *   3. Optionally filtering out low-reward trajectories.
 *   4. Returning the top-N, ranked by reward (similarity is the tie-breaker).
 *
 * `getBestPractice` aggregates the configs of the top-5 highest-reward
 * trajectories whose reward > 0.5, taking the most common value per config
 * key. This is the "what config should I try first on this kind of data?"
 * primitive that the Evolution Control Plane can use as a starting point.
 */

import type { TrajectoryStore } from '../trajectory/store';
import type { Trajectory } from '../trajectory/types';
import type {
  DataProfile,
  Memory,
  MemoryEntry,
  MemoryQuery,
  MemorySearchResult,
} from './types';

export class EpisodicMemoryStore implements Memory {
  constructor(private trajectoryStore: TrajectoryStore) {}

  /**
   * Search past trajectories for situations similar to the current one.
   * Returns the most relevant past experiences, ranked by reward.
   */
  async search(query: MemoryQuery): Promise<MemorySearchResult[]> {
    const limit = query.limit ?? 10;

    // 1. Pull every trajectory for this agent (capped for dev performance).
    const { trajectories: summaries } = await this.trajectoryStore.query({
      agentId: query.agentId,
      limit: 500,
    });

    // 2. Hydrate full trajectories (we need config + metadata).
    const candidates: MemoryEntry[] = [];
    for (const summary of summaries) {
      const t = await this.trajectoryStore.get(summary.id);
      if (!t) continue;
      candidates.push(this.toMemoryEntry(t));
    }

    // 3. Score each candidate for similarity to the query.
    const scored = candidates
      .map(entry => ({
        entry,
        similarity: this.similarity(entry, query),
        reward: entry.reward,
      }))
      // 4. Filter by similarity (drop anything with zero overlap) and minReward.
      .filter(({ similarity, reward }) => {
        if (similarity <= 0) return false;
        if (query.minReward !== undefined && reward < query.minReward) {
          return false;
        }
        return true;
      })
      // 5. Rank by reward (highest first); similarity is the tie-breaker.
      .sort((a, b) => {
        if (b.reward !== a.reward) return b.reward - a.reward;
        return b.similarity - a.similarity;
      });

    return scored.slice(0, limit).map(({ entry, similarity, reward }) => ({
      trajectoryId: entry.trajectoryId,
      similarity: round3(similarity),
      reward: round3(reward),
      config: entry.config,
      summary: entry.summary,
    }));
  }

  /**
   * Get the "best practice" config for an agent on a specific data type.
   * Aggregates the config from the highest-reward trajectories.
   *
   * Returns null if there aren't enough high-reward trajectories (fewer
   * than 1 trajectory with reward > 0.5).
   */
  async getBestPractice(
    agentId: string,
    dataProfile: DataProfile,
  ): Promise<Record<string, unknown> | null> {
    // Find the top 5 trajectories with rewards > 0.5, ranked by reward.
    const results = await this.search({
      agentId,
      dataProfile,
      minReward: 0.5,
      limit: 5,
    });

    if (results.length === 0) return null;

    // Merge their configs: for each key, take the most common value.
    // We weight by reward so a trajectory with reward 1.0 counts more than
    // one with reward 0.55.
    const weightedTallies = new Map<string, Map<string, number>>();
    for (const r of results) {
      for (const [key, value] of Object.entries(r.config)) {
        if (!weightedTallies.has(key)) weightedTallies.set(key, new Map());
        const valueKey = stableStringify(value);
        const tally = weightedTallies.get(key)!;
        tally.set(valueKey, (tally.get(valueKey) ?? 0) + Math.max(r.reward, 0));
      }
    }

    const merged: Record<string, unknown> = {};
    for (const [key, tally] of weightedTallies) {
      let bestValueKey = '';
      let bestWeight = -Infinity;
      for (const [valueKey, weight] of tally) {
        if (weight > bestWeight) {
          bestWeight = weight;
          bestValueKey = valueKey;
        }
      }
      if (bestValueKey) {
        merged[key] = JSON.parse(bestValueKey);
      }
    }

    return merged;
  }

  // ------------------------------------------------------------------
  // Internals
  // ------------------------------------------------------------------

  private toMemoryEntry(t: Trajectory): MemoryEntry {
    const avgReward =
      t.rewards.length > 0
        ? t.rewards.reduce((acc, r) => acc + r.value, 0) / t.rewards.length
        : 0;

    return {
      trajectoryId: t.id,
      agentId: t.agentId,
      analysisId: t.analysisId,
      dataProfile: {
        rowCount: t.metadata.rowCount,
        columnCount: t.metadata.columnCount,
        // Column names aren't stored on the trajectory metadata — we leave
        // them undefined here. A production recorder would capture them.
      },
      config: t.contextSnapshot.config,
      reward: avgReward,
      status: t.status,
      timestamp: t.startedAt,
      summary: summarize(t),
    };
  }

  /**
   * Compute a similarity score in [0, 1] between a memory entry and a query.
   *
   * Components (each contributes up to its weight; total is clamped to 1):
   *   - columnCount match: 0.35
   *   - rowCount match (exact or within 50%): 0.25
   *   - columnNames overlap (Jaccard): up to 0.25
   *   - config key overlap: up to 0.15
   *
   * Returns 0 if there's no overlap at all (so the caller can filter).
   */
  private similarity(entry: MemoryEntry, query: MemoryQuery): number {
    let score = 0;
    const qp = query.dataProfile;
    if (!qp) {
      // No data profile in the query — every trajectory is equally (minimally)
      // similar. We return a small positive baseline so the search still
      // ranks by reward.
      return 0.1;
    }

    // Column count.
    if (
      qp.columnCount !== undefined &&
      entry.dataProfile.columnCount !== undefined
    ) {
      if (qp.columnCount === entry.dataProfile.columnCount) {
        score += 0.35;
      } else {
        // Partial credit proportional to how close the counts are.
        const ratio =
          Math.min(qp.columnCount, entry.dataProfile.columnCount) /
          Math.max(qp.columnCount, entry.dataProfile.columnCount);
        score += 0.35 * ratio * 0.5;
      }
    }

    // Row count — exact match or within 50% of each other.
    if (qp.rowCount !== undefined && entry.dataProfile.rowCount !== undefined) {
      const ratio =
        Math.min(qp.rowCount, entry.dataProfile.rowCount) /
        Math.max(qp.rowCount, entry.dataProfile.rowCount);
      if (ratio >= 0.5) {
        score += 0.25 * ratio;
      }
    }

    // Column names — Jaccard similarity.
    if (
      qp.columnNames &&
      qp.columnNames.length > 0 &&
      entry.dataProfile.columnNames &&
      entry.dataProfile.columnNames.length > 0
    ) {
      const a = new Set(qp.columnNames.map(c => c.toLowerCase()));
      const b = new Set(entry.dataProfile.columnNames.map(c => c.toLowerCase()));
      let intersection = 0;
      for (const c of a) if (b.has(c)) intersection++;
      const union = a.size + b.size - intersection;
      const jaccard = union > 0 ? intersection / union : 0;
      score += 0.25 * jaccard;
    }

    // Config overlap — fraction of query config keys that match.
    if (query.config) {
      const queryKeys = Object.keys(query.config);
      if (queryKeys.length > 0) {
        let matched = 0;
        for (const key of queryKeys) {
          const qv = stableStringify(query.config[key]);
          const ev = stableStringify(entry.config[key]);
          if (qv === ev) matched++;
        }
        score += 0.15 * (matched / queryKeys.length);
      }
    }

    return Math.min(1, score);
  }
}

// ----------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------

/** Deterministic JSON stringify (sorted keys) so config values compare equal regardless of key order. */
function stableStringify(value: unknown): string {
  if (value === undefined) return 'undefined';
  try {
    return JSON.stringify(value, Object.keys(value as object).sort());
  } catch {
    return JSON.stringify(value);
  }
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function summarize(t: Trajectory): string {
  const reward =
    t.rewards.length > 0
      ? t.rewards.reduce((acc, r) => acc + r.value, 0) / t.rewards.length
      : 0;
  const row = t.metadata.rowCount;
  const col = t.metadata.columnCount;
  return `${t.agentId} on ${row}r×${col}c → ${t.status} (reward ${reward.toFixed(2)})`;
}
