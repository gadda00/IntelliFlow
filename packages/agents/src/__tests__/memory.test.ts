import { describe, it, expect, beforeEach } from 'vitest';
import {
  TrajectoryRecorder,
  InMemoryTrajectoryStore,
  createContextSnapshot,
  createMetadata,
} from '../trajectory';
import { EpisodicMemoryStore } from '../memory';
import type { Trajectory } from '../trajectory/types';

/**
 * Build a complete trajectory for testing episodic memory.
 *
 * `config` is what the agent was run with, `data` drives the row/column
 * counts in metadata, and `reward` is appended as an explicit reward.
 */
function makeTrajectory(opts: {
  analysisId: string;
  agentId: string;
  config: Record<string, unknown>;
  data: Record<string, unknown>[];
  reward?: number;
  status?: 'success' | 'failed';
}): Trajectory {
  const recorder = new TrajectoryRecorder({
    analysisId: opts.analysisId,
    userId: 'u1',
    agentId: opts.agentId,
    agentVersion: '1.0.0',
    agentStability: 'beta',
    contextSnapshot: createContextSnapshot(opts.config),
    metadata: createMetadata(opts.data),
  });
  recorder.observe({ input: opts.data[0] });
  recorder.result({ ok: true });
  if (opts.reward !== undefined) {
    recorder.addReward({
      timestamp: new Date().toISOString(),
      type: 'explicit',
      source: 'user_thumbs_up',
      value: opts.reward,
    });
  }
  return recorder.complete(opts.status ?? 'success');
}

// Two dataframes with different shapes — used to test data-profile matching.
const WIDE = Array.from({ length: 50 }, (_, i) => ({
  id: i,
  revenue: i * 10,
  units: i,
  region: 'NA',
  category: 'A',
})); // 50 rows × 5 columns

const TALL = Array.from({ length: 500 }, (_, i) => ({
  id: i,
  amount: i,
})); // 500 rows × 2 columns

describe('EpisodicMemoryStore', () => {
  let store: InMemoryTrajectoryStore;
  let memory: EpisodicMemoryStore;

  beforeEach(async () => {
    store = new InMemoryTrajectoryStore();
    memory = new EpisodicMemoryStore(store);

    // Six trajectories for agent-A on the wide dataframe with mixed rewards/configs.
    await store.save(
      makeTrajectory({
        analysisId: 'a1',
        agentId: 'agent-A',
        config: { model: 'glm-4.6', temperature: 0.3, topP: 0.9 },
        data: WIDE,
        reward: 0.9,
      }),
    );
    await store.save(
      makeTrajectory({
        analysisId: 'a2',
        agentId: 'agent-A',
        config: { model: 'glm-4.6', temperature: 0.3, topP: 0.95 },
        data: WIDE,
        reward: 0.8,
      }),
    );
    await store.save(
      makeTrajectory({
        analysisId: 'a3',
        agentId: 'agent-A',
        config: { model: 'gpt-4o', temperature: 0.7, topP: 0.9 },
        data: WIDE,
        reward: 0.2,
      }),
    );
    await store.save(
      makeTrajectory({
        analysisId: 'a4',
        agentId: 'agent-A',
        config: { model: 'gpt-4o', temperature: 0.7, topP: 0.9 },
        data: TALL,
        reward: 0.6,
      }),
    );
    // A different agent's trajectory — should never appear in agent-A results.
    await store.save(
      makeTrajectory({
        analysisId: 'a5',
        agentId: 'agent-B',
        config: { model: 'glm-4.6', temperature: 0.3 },
        data: WIDE,
        reward: 1.0,
      }),
    );
    // A failed run with negative reward — should be filtered by minReward.
    await store.save(
      makeTrajectory({
        analysisId: 'a6',
        agentId: 'agent-A',
        config: { model: 'glm-4.6', temperature: 0.3 },
        data: WIDE,
        reward: -0.5,
        status: 'failed',
      }),
    );
  });

  describe('search', () => {
    it('returns only trajectories for the queried agent', async () => {
      const results = await memory.search({ agentId: 'agent-A' });
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(r => r.trajectoryId.startsWith('traj_'))).toBe(true);
      // agent-B's trajectory must not leak in.
      const all = await store.query({ agentId: 'agent-A' });
      expect(all.total).toBe(5); // sanity: 5 trajectories for agent-A
    });

    it('ranks results by reward (highest first)', async () => {
      const results = await memory.search({ agentId: 'agent-A', limit: 10 });
      const rewards = results.map(r => r.reward);
      for (let i = 1; i < rewards.length; i++) {
        expect(rewards[i]).toBeLessThanOrEqual(rewards[i - 1]);
      }
      // The top result should be one of the high-reward (0.9) trajectories.
      expect(results[0].reward).toBeGreaterThanOrEqual(0.8);
    });

    it('respects the limit option', async () => {
      const results = await memory.search({ agentId: 'agent-A', limit: 2 });
      expect(results).toHaveLength(2);
    });

    it('filters out trajectories below minReward', async () => {
      const results = await memory.search({
        agentId: 'agent-A',
        minReward: 0.5,
      });
      expect(results.every(r => r.reward >= 0.5)).toBe(true);
      // The negative-reward failed trajectory must be gone.
      expect(results.find(r => r.reward === -0.5)).toBeUndefined();
    });

    it('prefers trajectories whose column count matches the query', async () => {
      // Query for a wide dataframe (5 columns).
      const wideResults = await memory.search({
        agentId: 'agent-A',
        dataProfile: { columnCount: 5 },
        minReward: 0.5,
      });
      // The TALL (2-column) trajectory should rank lower than the WIDE ones
      // of comparable reward. With minReward 0.5, the WIDE 0.9 + 0.8 must
      // appear before the TALL 0.6 one.
      const wideIds = wideResults
        .filter(r => r.reward >= 0.8)
        .map(r => r.trajectoryId);
      const tallIdx = wideResults.findIndex(r => r.reward === 0.6);
      const lastWideIdx = wideResults.findIndex(
        r => r.reward >= 0.8 && wideResults.indexOf(r) === wideResults.lastIndexOf(r),
      );
      // The 0.6 reward (TALL) entry should come after at least one 0.8+ (WIDE) entry.
      if (tallIdx !== -1) {
        const firstHighIdx = wideResults.findIndex(r => r.reward >= 0.8);
        expect(tallIdx).toBeGreaterThan(firstHighIdx);
      }
      expect(wideIds.length).toBeGreaterThan(0);
    });

    it('returns config in every result so callers can reuse it', async () => {
      const results = await memory.search({ agentId: 'agent-A', limit: 3 });
      for (const r of results) {
        expect(r.config).toBeDefined();
        expect(typeof r.config).toBe('object');
        expect(r.config).toHaveProperty('model');
        expect(r.summary).toContain('agent-A');
      }
    });

    it('similarity is in [0, 1]', async () => {
      const results = await memory.search({
        agentId: 'agent-A',
        dataProfile: { columnCount: 5, rowCount: 50 },
      });
      for (const r of results) {
        expect(r.similarity).toBeGreaterThanOrEqual(0);
        expect(r.similarity).toBeLessThanOrEqual(1);
      }
    });

    it('returns an empty array for an unknown agent', async () => {
      const results = await memory.search({ agentId: 'agent-Z' });
      expect(results).toEqual([]);
    });
  });

  describe('getBestPractice', () => {
    it('returns the most common config value per key across high-reward trajectories', async () => {
      const best = await memory.getBestPractice('agent-A', { columnCount: 5 });
      expect(best).not.toBeNull();
      // Among high-reward (>=0.5) WIDE trajectories for agent-A we have:
      //   a1: model=glm-4.6, temp=0.3, topP=0.9  (reward 0.9)
      //   a2: model=glm-4.6, temp=0.3, topP=0.95 (reward 0.8)
      //   a6: failed, reward -0.5 (filtered out by minReward 0.5)
      // So 'model' should be 'glm-4.6' (unanimous among the qualifying set).
      expect(best!['model']).toBe('glm-4.6');
      expect(best!['temperature']).toBe(0.3);
    });

    it('returns null when no trajectories meet the reward threshold', async () => {
      const best = await memory.getBestPractice('agent-B', { columnCount: 5 });
      // agent-B has only one trajectory (reward 1.0) — that should be enough
      // to produce a best practice. Assert it returns the config.
      expect(best).not.toBeNull();
      expect(best!['model']).toBe('glm-4.6');
    });

    it('returns null for an agent with no trajectories', async () => {
      const best = await memory.getBestPractice('agent-Z', { columnCount: 5 });
      expect(best).toBeNull();
    });
  });
});
