import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  TrajectoryRecorder,
  InMemoryTrajectoryStore,
  DataProxy,
  createContextSnapshot,
  createMetadata,
} from '../trajectory';
import {
  TrainingDataFormatter,
  FineTuneScheduler,
  FineTuneRunner,
} from '../finetune';
import type { Trajectory } from '../trajectory/types';
import type { FineTuneConfig } from '../finetune/types';

// ============================================================================
// Test fixtures
// ============================================================================

/**
 * Build a complete trajectory for testing the fine-tune pipeline.
 *
 * Each trajectory has one LLM-call step (the atom the formatter extracts)
 * and an optional reward that drives SFT inclusion / DPO pairing.
 */
function makeTrajectory(opts: {
  analysisId: string;
  agentId: string;
  reward?: number;
  systemPrompt?: string;
  userPrompt?: string;
  response?: string;
  startedAt?: string;
}): Trajectory {
  const recorder = new TrajectoryRecorder({
    analysisId: opts.analysisId,
    userId: 'u1',
    agentId: opts.agentId,
    agentVersion: '1.0.0',
    agentStability: 'beta',
    contextSnapshot: createContextSnapshot({}),
    metadata: createMetadata([]),
  });
  recorder.llmCall({
    provider: 'glm',
    model: 'glm-4.6',
    systemPrompt: opts.systemPrompt ?? 'You are a data analyst.',
    userPrompt: opts.userPrompt ?? 'Analyze this dataset',
    response: opts.response ?? 'Here is the analysis.',
    tokensIn: 10,
    tokensOut: 5,
    latencyMs: 100,
  });
  recorder.result({ ok: true });
  const trajectory = recorder.complete('success');
  if (opts.reward !== undefined) {
    trajectory.rewards.push({
      timestamp: new Date().toISOString(),
      type: 'explicit',
      source: opts.reward > 0 ? 'user_thumbs_up' : 'user_thumbs_down',
      value: opts.reward,
    });
  }
  if (opts.startedAt) {
    // Override for the scheduler's recency check.
    trajectory.startedAt = opts.startedAt;
  }
  return trajectory;
}

/** A minimal valid FineTuneConfig for the runner tests. */
function makeConfig(overrides: Partial<FineTuneConfig> = {}): FineTuneConfig {
  return {
    method: 'sft',
    agentId: 'test-agent',
    baseModel: 'glm-4.6',
    outputModelName: 'test-agent-finetuned',
    hyperparameters: {
      learningRate: 5e-5,
      epochs: 1, // keep the mock fast
      batchSize: 8,
      warmupRatio: 0.1,
      weightDecay: 0.01,
      maxSeqLength: 2048,
    },
    dataConfig: {
      minTrajectories: 200,
      minReward: 0,
      minQualityScore: 0.5,
      maxAge: 30,
    },
    evalConfig: {
      holdoutPercentage: 20,
      evalMetrics: ['accuracy'],
    },
    deploymentConfig: {
      autoDeploy: false,
      canaryPercentage: 10,
      rollbackOnRegression: true,
    },
    ...overrides,
  };
}

// ============================================================================
// TrainingDataFormatter
// ============================================================================

describe('TrainingDataFormatter', () => {
  let formatter: TrainingDataFormatter;

  beforeEach(() => {
    formatter = new TrainingDataFormatter();
  });

  describe('toSFT', () => {
    it('includes LLM calls from positive-reward trajectories', () => {
      const trajectories = [
        makeTrajectory({
          analysisId: 'a1',
          agentId: 'agent-A',
          reward: 0.8,
          response: 'good response',
        }),
      ];
      const result = formatter.toSFT(trajectories);
      expect(result.format).toBe('sft');
      expect(result.samples).toHaveLength(1);
      expect(result.samples[0].prompt).toContain('You are a data analyst.');
      expect(result.samples[0].prompt).toContain('Analyze this dataset');
      expect(result.samples[0].completion).toBe('good response');
      expect(result.samples[0].metadata).toMatchObject({
        agentId: 'agent-A',
        reward: 0.8,
      });
    });

    it('skips trajectories with negative rewards', () => {
      const trajectories = [
        makeTrajectory({ analysisId: 'a1', agentId: 'agent-A', reward: -0.5 }),
        makeTrajectory({ analysisId: 'a2', agentId: 'agent-A', reward: 0.5 }),
      ];
      const result = formatter.toSFT(trajectories);
      expect(result.samples).toHaveLength(1);
      expect((result.samples[0].metadata as { reward: number }).reward).toBe(0.5);
    });

    it('skips trajectories with no rewards (avg = 0, not > 0)', () => {
      const trajectories = [
        makeTrajectory({ analysisId: 'a1', agentId: 'agent-A' /* no reward */ }),
      ];
      const result = formatter.toSFT(trajectories);
      expect(result.samples).toHaveLength(0);
    });

    it('emits one sample per LLM call (multiple calls → multiple samples)', () => {
      // Build a trajectory with two LLM calls by using the recorder directly.
      const recorder = new TrajectoryRecorder({
        analysisId: 'a1',
        userId: 'u1',
        agentId: 'agent-A',
        agentVersion: '1.0.0',
        agentStability: 'beta',
        contextSnapshot: createContextSnapshot({}),
        metadata: createMetadata([]),
      });
      recorder.llmCall({
        provider: 'glm',
        model: 'glm-4.6',
        systemPrompt: 'sys',
        userPrompt: 'q1',
        response: 'r1',
        tokensIn: 1,
        tokensOut: 1,
        latencyMs: 1,
      });
      recorder.llmCall({
        provider: 'glm',
        model: 'glm-4.6',
        systemPrompt: 'sys',
        userPrompt: 'q2',
        response: 'r2',
        tokensIn: 1,
        tokensOut: 1,
        latencyMs: 1,
      });
      const trajectory = recorder.complete('success');
      trajectory.rewards.push({
        timestamp: new Date().toISOString(),
        type: 'explicit',
        source: 'user_thumbs_up',
        value: 0.9,
      });
      const result = formatter.toSFT([trajectory]);
      expect(result.samples).toHaveLength(2);
      expect(result.samples[0].completion).toBe('r1');
      expect(result.samples[1].completion).toBe('r2');
    });

    it('concatenates system prompt and user prompt', () => {
      const trajectories = [
        makeTrajectory({
          analysisId: 'a1',
          agentId: 'agent-A',
          reward: 0.5,
          systemPrompt: 'SYSTEM',
          userPrompt: 'USER',
        }),
      ];
      const result = formatter.toSFT(trajectories);
      expect(result.samples[0].prompt).toBe('SYSTEM\n\nUSER');
    });
  });

  describe('toDPO', () => {
    it('pairs positive and negative trajectories for the same agent', () => {
      const trajectories = [
        makeTrajectory({
          analysisId: 'pos1',
          agentId: 'agent-A',
          reward: 0.8,
          response: 'chosen response',
        }),
        makeTrajectory({
          analysisId: 'neg1',
          agentId: 'agent-A',
          reward: -0.8,
          response: 'rejected response',
        }),
      ];
      const result = formatter.toDPO(trajectories);
      expect(result.format).toBe('dpo');
      expect(result.samples).toHaveLength(1);
      expect(result.samples[0].chosen).toBe('chosen response');
      expect(result.samples[0].rejected).toBe('rejected response');
      expect(result.samples[0].metadata).toMatchObject({
        agentId: 'agent-A',
        positiveId: expect.any(String),
        negativeId: expect.any(String),
      });
    });

    it('does not pair across agents', () => {
      const trajectories = [
        makeTrajectory({ analysisId: 'pos1', agentId: 'agent-A', reward: 0.8 }),
        makeTrajectory({ analysisId: 'neg1', agentId: 'agent-B', reward: -0.8 }),
      ];
      const result = formatter.toDPO(trajectories);
      expect(result.samples).toHaveLength(0);
    });

    it('skips pairs when prompts differ by more than 200 chars', () => {
      const shortPrompt = 'short';
      const longPrompt = 'x'.repeat(300); // 300 chars longer than shortPrompt
      const trajectories = [
        makeTrajectory({
          analysisId: 'pos1',
          agentId: 'agent-A',
          reward: 0.8,
          userPrompt: shortPrompt,
        }),
        makeTrajectory({
          analysisId: 'neg1',
          agentId: 'agent-A',
          reward: -0.8,
          userPrompt: longPrompt,
        }),
      ];
      const result = formatter.toDPO(trajectories);
      expect(result.samples).toHaveLength(0);
    });

    it('only pairs one negative per positive', () => {
      const trajectories = [
        makeTrajectory({
          analysisId: 'pos1',
          agentId: 'agent-A',
          reward: 0.8,
        }),
        makeTrajectory({ analysisId: 'neg1', agentId: 'agent-A', reward: -0.8 }),
        makeTrajectory({ analysisId: 'neg2', agentId: 'agent-A', reward: -0.7 }),
      ];
      const result = formatter.toDPO(trajectories);
      expect(result.samples).toHaveLength(1);
    });

    it('ignores rewards in the neutral band (-0.3..0.3)', () => {
      const trajectories = [
        makeTrajectory({ analysisId: 'pos1', agentId: 'agent-A', reward: 0.2 }),
        makeTrajectory({ analysisId: 'neg1', agentId: 'agent-A', reward: -0.2 }),
      ];
      const result = formatter.toDPO(trajectories);
      expect(result.samples).toHaveLength(0);
    });
  });

  describe('toRLHF', () => {
    it('includes every LLM call with the trajectory reward', () => {
      const trajectories = [
        makeTrajectory({ analysisId: 'a1', agentId: 'agent-A', reward: 0.5 }),
        makeTrajectory({ analysisId: 'a2', agentId: 'agent-A', reward: -0.5 }),
      ];
      const result = formatter.toRLHF(trajectories);
      expect(result.format).toBe('rlhf');
      expect(result.samples).toHaveLength(2);
      expect(result.samples[0].reward).toBe(0.5);
      expect(result.samples[1].reward).toBe(-0.5);
    });

    it('tokenizes prompt and response by whitespace', () => {
      const trajectories = [
        makeTrajectory({
          analysisId: 'a1',
          agentId: 'agent-A',
          reward: 0.5,
          userPrompt: 'analyze this data',
          response: 'the result is good',
        }),
      ];
      const result = formatter.toRLHF(trajectories);
      expect(result.samples[0].promptTokens).toEqual(['analyze', 'this', 'data']);
      expect(result.samples[0].responseTokens).toEqual(['the', 'result', 'is', 'good']);
    });

    it('assigns reward 0 to trajectories with no rewards', () => {
      const trajectories = [
        makeTrajectory({ analysisId: 'a1', agentId: 'agent-A' /* no reward */ }),
      ];
      const result = formatter.toRLHF(trajectories);
      expect(result.samples).toHaveLength(1);
      expect(result.samples[0].reward).toBe(0);
    });
  });
});

// ============================================================================
// FineTuneScheduler
// ============================================================================

describe('FineTuneScheduler', () => {
  let store: InMemoryTrajectoryStore;
  let scheduler: FineTuneScheduler;

  beforeEach(() => {
    store = new InMemoryTrajectoryStore();
    const dataProxy = new DataProxy(store);
    scheduler = new FineTuneScheduler(store, dataProxy);
  });

  it('returns null when total trajectories < 200', async () => {
    // 100 positive trajectories — below the 200 minimum.
    for (let i = 0; i < 100; i++) {
      await store.save(
        makeTrajectory({
          analysisId: `a${i}`,
          agentId: 'agent-A',
          reward: 0.8,
        }),
      );
    }
    const config = await scheduler.checkReadiness('agent-A');
    expect(config).toBeNull();
  });

  it('returns null when negative reward count < 20', async () => {
    // 200 trajectories: 150 positive, 10 negative, 40 neutral.
    for (let i = 0; i < 150; i++) {
      await store.save(
        makeTrajectory({ analysisId: `p${i}`, agentId: 'agent-A', reward: 0.8 }),
      );
    }
    for (let i = 0; i < 10; i++) {
      await store.save(
        makeTrajectory({ analysisId: `n${i}`, agentId: 'agent-A', reward: -0.8 }),
      );
    }
    for (let i = 0; i < 40; i++) {
      await store.save(
        makeTrajectory({ analysisId: `z${i}`, agentId: 'agent-A', reward: 0 }),
      );
    }
    const config = await scheduler.checkReadiness('agent-A');
    expect(config).toBeNull();
  });

  it('returns null when positive reward count < 50', async () => {
    // 200 trajectories: 40 positive, 100 negative, 60 neutral.
    for (let i = 0; i < 40; i++) {
      await store.save(
        makeTrajectory({ analysisId: `p${i}`, agentId: 'agent-A', reward: 0.8 }),
      );
    }
    for (let i = 0; i < 100; i++) {
      await store.save(
        makeTrajectory({ analysisId: `n${i}`, agentId: 'agent-A', reward: -0.8 }),
      );
    }
    for (let i = 0; i < 60; i++) {
      await store.save(
        makeTrajectory({ analysisId: `z${i}`, agentId: 'agent-A', reward: 0 }),
      );
    }
    const config = await scheduler.checkReadiness('agent-A');
    expect(config).toBeNull();
  });

  it('returns null when recent activity < 20 (all trajectories are old)', async () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    for (let i = 0; i < 120; i++) {
      await store.save(
        makeTrajectory({
          analysisId: `p${i}`,
          agentId: 'agent-A',
          reward: 0.8,
          startedAt: thirtyDaysAgo,
        }),
      );
    }
    for (let i = 0; i < 80; i++) {
      await store.save(
        makeTrajectory({
          analysisId: `n${i}`,
          agentId: 'agent-A',
          reward: -0.8,
          startedAt: thirtyDaysAgo,
        }),
      );
    }
    const config = await scheduler.checkReadiness('agent-A');
    expect(config).toBeNull();
  });

  it('returns a config when all readiness gates pass (SFT when negatives <= 50)', async () => {
    // 200 trajectories: 150 positive, 50 negative (exactly at the DPO threshold
    // but not above it — should pick SFT).
    for (let i = 0; i < 150; i++) {
      await store.save(
        makeTrajectory({ analysisId: `p${i}`, agentId: 'agent-A', reward: 0.8 }),
      );
    }
    for (let i = 0; i < 50; i++) {
      await store.save(
        makeTrajectory({ analysisId: `n${i}`, agentId: 'agent-A', reward: -0.8 }),
      );
    }
    const config = await scheduler.checkReadiness('agent-A');
    expect(config).not.toBeNull();
    expect(config!.method).toBe('sft');
    expect(config!.agentId).toBe('agent-A');
    expect(config!.baseModel).toBe('glm-4.6');
    expect(config!.hyperparameters.epochs).toBe(3);
    expect(config!.dataConfig.minTrajectories).toBe(200);
    expect(config!.outputModelName).toContain('agent-A-finetuned-');
  });

  it('returns a DPO config when negatives > 50', async () => {
    // 220 trajectories: 140 positive, 80 negative.
    for (let i = 0; i < 140; i++) {
      await store.save(
        makeTrajectory({ analysisId: `p${i}`, agentId: 'agent-A', reward: 0.8 }),
      );
    }
    for (let i = 0; i < 80; i++) {
      await store.save(
        makeTrajectory({ analysisId: `n${i}`, agentId: 'agent-A', reward: -0.8 }),
      );
    }
    const config = await scheduler.checkReadiness('agent-A');
    expect(config).not.toBeNull();
    expect(config!.method).toBe('dpo');
  });

  it('findReadyAgents returns only agents that pass readiness', async () => {
    // agent-A: ready (200+ trajectories, mixed rewards, recent).
    for (let i = 0; i < 120; i++) {
      await store.save(
        makeTrajectory({ analysisId: `pa${i}`, agentId: 'agent-A', reward: 0.8 }),
      );
    }
    for (let i = 0; i < 80; i++) {
      await store.save(
        makeTrajectory({ analysisId: `na${i}`, agentId: 'agent-A', reward: -0.8 }),
      );
    }
    // agent-B: not ready (too few trajectories).
    for (let i = 0; i < 10; i++) {
      await store.save(
        makeTrajectory({ analysisId: `pb${i}`, agentId: 'agent-B', reward: 0.8 }),
      );
    }
    const ready = await scheduler.findReadyAgents(['agent-A', 'agent-B', 'agent-C']);
    expect(ready).toHaveLength(1);
    expect(ready[0].agentId).toBe('agent-A');
    expect(ready[0].config).toBeDefined();
  });
});

// ============================================================================
// FineTuneRunner
// ============================================================================

describe('FineTuneRunner', () => {
  let runner: FineTuneRunner;

  beforeEach(() => {
    vi.useFakeTimers();
    runner = new FineTuneRunner();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('startJob returns a job with an ID and the supplied config', async () => {
    const config = makeConfig();
    const job = await runner.startJob(config);
    expect(job.id).toMatch(/^ft_\d+_[a-z0-9]+$/);
    expect(job.config).toBe(config);
    expect(job.createdAt).toBeDefined();
    expect(job.progress).toBe(0);
    expect(job.logs).toHaveLength(1); // "Preparing training data..." entry
    // The mock runs synchronously up to the first sleep, so status is
    // already 'preparing' by the time startJob returns.
    expect(job.status).toBe('preparing');
    expect(job.startedAt).toBeDefined();
  });

  it('getJob returns the same job object', async () => {
    const job = await runner.startJob(makeConfig());
    const fetched = runner.getJob(job.id);
    expect(fetched).toBe(job);
  });

  it('getJob returns null for unknown IDs', () => {
    expect(runner.getJob('does-not-exist')).toBeNull();
  });

  it('listJobs returns all jobs', async () => {
    await runner.startJob(makeConfig());
    await runner.startJob(makeConfig());
    expect(runner.listJobs()).toHaveLength(2);
  });

  it('transitions through lifecycle to completed', async () => {
    const config = makeConfig({
      hyperparameters: {
        learningRate: 5e-5,
        epochs: 2,
        batchSize: 8,
        warmupRatio: 0.1,
        weightDecay: 0.01,
        maxSeqLength: 2048,
      },
      deploymentConfig: {
        autoDeploy: true,
        canaryPercentage: 10,
        rollbackOnRegression: true,
      },
    });
    const job = await runner.startJob(config);

    // Fast-forward through all sleeps:
    //   500 (prepare) + 500 (format) + 2 * 1000 (epochs) + 1000 (eval)
    //   + 1000 (deploy) = 5000ms
    await vi.advanceTimersByTimeAsync(6000);

    const fetched = runner.getJob(job.id);
    expect(fetched!.status).toBe('completed');
    expect(fetched!.progress).toBe(1.0);
    expect(fetched!.completedAt).toBeDefined();
    expect(fetched!.metrics?.trainingLoss).toHaveLength(2);
    expect(fetched!.metrics?.evalLoss).toEqual([1.2]);
    expect(fetched!.metrics?.rewardImprovement).toBe(0.15);
    expect(fetched!.metrics?.sampleCount).toBe(200);
    expect(fetched!.result?.modelPath).toBe(`/models/${config.outputModelName}`);
    expect(fetched!.result?.deployedAt).toBeDefined();
    expect(fetched!.result?.evalResults).toMatchObject({
      accuracy: 0.87,
      reward_correlation: 0.72,
      hallucination_rate: 0.05,
    });
  });

  it('does not set deployedAt when autoDeploy is false', async () => {
    const config = makeConfig({
      deploymentConfig: {
        autoDeploy: false,
        canaryPercentage: 10,
        rollbackOnRegression: true,
      },
    });
    const job = await runner.startJob(config);
    // 500 + 500 + 1000 (1 epoch) + 1000 (eval) = 3000ms, no deploy sleep.
    await vi.advanceTimersByTimeAsync(4000);
    const fetched = runner.getJob(job.id);
    expect(fetched!.status).toBe('completed');
    expect(fetched!.result?.deployedAt).toBeUndefined();
    expect(fetched!.result?.modelPath).toBeDefined();
  });

  it('cancelJob cancels a pending job and the mock exits early', async () => {
    const job = await runner.startJob(makeConfig());
    expect(runner.cancelJob(job.id)).toBe(true);

    // Let the suspended mock resume and see the cancellation.
    await vi.advanceTimersByTimeAsync(2000);

    const fetched = runner.getJob(job.id);
    expect(fetched!.status).toBe('cancelled');
    // The mock should have exited at the first cancel-check — no training logs.
    const trainingLogs = fetched!.logs.filter(l => l.message.includes('Epoch'));
    expect(trainingLogs).toHaveLength(0);
  });

  it('cancelJob returns false for a completed job', async () => {
    const job = await runner.startJob(makeConfig());
    await vi.advanceTimersByTimeAsync(4000);
    expect(runner.getJob(job.id)!.status).toBe('completed');
    expect(runner.cancelJob(job.id)).toBe(false);
  });

  it('cancelJob returns false for an unknown job', () => {
    expect(runner.cancelJob('does-not-exist')).toBe(false);
  });

  it('records decreasing training loss across epochs', async () => {
    const config = makeConfig({
      hyperparameters: {
        learningRate: 5e-5,
        epochs: 3,
        batchSize: 8,
        warmupRatio: 0.1,
        weightDecay: 0.01,
        maxSeqLength: 2048,
      },
    });
    const job = await runner.startJob(config);
    await vi.advanceTimersByTimeAsync(6000);
    const fetched = runner.getJob(job.id);
    const losses = fetched!.metrics!.trainingLoss!;
    expect(losses).toHaveLength(3);
    // 2.0 / epoch — strictly decreasing.
    expect(losses[0]).toBeGreaterThan(losses[1]);
    expect(losses[1]).toBeGreaterThan(losses[2]);
  });

  it('logs every lifecycle transition', async () => {
    const job = await runner.startJob(makeConfig());
    await vi.advanceTimersByTimeAsync(4000);
    const fetched = runner.getJob(job.id);
    const messages = fetched!.logs.map(l => l.message);
    expect(messages.some(m => m.includes('Preparing training data'))).toBe(true);
    expect(messages.some(m => m.includes('Formatting as SFT'))).toBe(true);
    expect(messages.some(m => m.includes('Epoch 1/1'))).toBe(true);
    expect(messages.some(m => m.includes('Evaluating on holdout'))).toBe(true);
    expect(messages.some(m => m.includes('Fine-tuning complete'))).toBe(true);
  });
});
