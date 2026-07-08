import { describe, it, expect, beforeEach } from 'vitest';
import {
  TrajectoryRecorder,
  InMemoryTrajectoryStore,
  createContextSnapshot,
  createMetadata,
  withTrajectory,
  DataProxy,
  EvolutionControlPlane,
  SchemaVerificationGate,
  executeWithVerification,
} from '../trajectory';
import { defaultAgentPool } from '../agents';

describe('TrajectoryRecorder', () => {
  it('records steps with causal links', () => {
    const recorder = new TrajectoryRecorder({
      analysisId: 'test-1',
      userId: 'user-1',
      agentId: 'test-agent',
      agentVersion: '1.0.0',
      agentStability: 'beta',
      contextSnapshot: createContextSnapshot({}),
      metadata: createMetadata([]),
    });

    const step1 = recorder.observe({ input: 'data' });
    recorder.pushStep(step1);
    const step2 = recorder.compute('mean', [1, 2, 3], 2);
    recorder.pushStep(step2);
    const step3 = recorder.result({ mean: 2 });

    const trajectory = recorder.complete('success');

    expect(trajectory.steps).toHaveLength(3);
    expect(trajectory.steps[0].causalParentSteps).toEqual([]);
    expect(trajectory.steps[1].causalParentSteps).toContain(step1);
    expect(trajectory.steps[2].causalParentSteps).toContain(step2);
    expect(trajectory.status).toBe('success');
  });

  it('records LLM calls with token usage', () => {
    const recorder = new TrajectoryRecorder({
      analysisId: 'test-2',
      userId: 'user-1',
      agentId: 'test-agent',
      agentVersion: '1.0.0',
      agentStability: 'beta',
      contextSnapshot: createContextSnapshot({}),
      metadata: createMetadata([]),
    });

    recorder.llmCall({
      provider: 'glm',
      model: 'glm-4.6',
      systemPrompt: 'You are helpful',
      userPrompt: 'What is 2+2?',
      response: '4',
      tokensIn: 20,
      tokensOut: 5,
      latencyMs: 500,
      cost: 0.001,
    });

    const trajectory = recorder.complete('success');
    expect(trajectory.metrics.llmCallCount).toBe(1);
    expect(trajectory.metrics.totalTokens).toBe(25);
    expect(trajectory.metrics.estimatedCost).toBe(0.001);
  });

  it('records rewards and computes aggregate', () => {
    const recorder = new TrajectoryRecorder({
      analysisId: 'test-3',
      userId: 'user-1',
      agentId: 'test-agent',
      agentVersion: '1.0.0',
      agentStability: 'beta',
      contextSnapshot: createContextSnapshot({}),
      metadata: createMetadata([]),
    });

    recorder.addReward({
      timestamp: new Date().toISOString(),
      type: 'explicit',
      source: 'user_thumbs_up',
      value: 1.0,
    });

    recorder.addReward({
      timestamp: new Date().toISOString(),
      type: 'implicit',
      source: 'user_returned',
      value: 0.5,
    });

    const aggregate = recorder.getAggregateReward();
    // Explicit weighs 3.0, implicit weighs 1.5
    // (1.0 * 3.0 + 0.5 * 1.5) / (3.0 + 1.5) = 3.75 / 4.5 = 0.833...
    expect(aggregate).toBeCloseTo(0.833, 2);
  });
});

describe('InMemoryTrajectoryStore', () => {
  let store: InMemoryTrajectoryStore;

  beforeEach(() => {
    store = new InMemoryTrajectoryStore();
  });

  it('saves and retrieves trajectories', async () => {
    const recorder = new TrajectoryRecorder({
      analysisId: 'a1',
      userId: 'u1',
      agentId: 'agent-1',
      agentVersion: '1.0.0',
      agentStability: 'beta',
      contextSnapshot: createContextSnapshot({}),
      metadata: createMetadata([]),
    });
    recorder.observe({ test: true });
    const trajectory = recorder.complete('success');

    await store.save(trajectory);
    const retrieved = await store.get(trajectory.id);
    expect(retrieved).toBeTruthy();
    expect(retrieved!.agentId).toBe('agent-1');
  });

  it('queries by agentId', async () => {
    for (let i = 0; i < 3; i++) {
      const recorder = new TrajectoryRecorder({
        analysisId: `a${i}`,
        userId: 'u1',
        agentId: 'agent-A',
        agentVersion: '1.0.0',
        agentStability: 'beta',
        contextSnapshot: createContextSnapshot({}),
        metadata: createMetadata([]),
      });
      recorder.observe({ i });
      await store.save(recorder.complete('success'));
    }

    const result = await store.query({ agentId: 'agent-A' });
    expect(result.trajectories).toHaveLength(3);
    expect(result.total).toBe(3);
  });

  it('computes agent stats', async () => {
    for (let i = 0; i < 10; i++) {
      const recorder = new TrajectoryRecorder({
        analysisId: `a${i}`,
        userId: 'u1',
        agentId: 'agent-B',
        agentVersion: '1.0.0',
        agentStability: 'beta',
        contextSnapshot: createContextSnapshot({}),
        metadata: createMetadata([]),
      });
      recorder.observe({ i });
      const status = i < 8 ? 'success' : 'failed';
      const trajectory = recorder.complete(status);
      await store.save(trajectory);
    }

    const stats = await store.getAgentStats('agent-B');
    expect(stats.totalTrajectories).toBe(10);
    expect(stats.successCount).toBe(8);
    expect(stats.successRate).toBe(0.8);
  });
});

describe('DataProxy', () => {
  it('scrubs PII from trajectories', async () => {
    const store = new InMemoryTrajectoryStore();
    const proxy = new DataProxy(store);

    const recorder = new TrajectoryRecorder({
      analysisId: 'a1',
      userId: 'u1',
      agentId: 'agent-1',
      agentVersion: '1.0.0',
      agentStability: 'beta',
      contextSnapshot: createContextSnapshot({}),
      metadata: createMetadata([]),
    });

    recorder.observe({
      email: 'user@example.com',
      phone: '+1-555-123-4567',
      ssn: '123-45-6789',
    });
    const trajectory = recorder.complete('success');

    const scrubbed = proxy.scrubPII(trajectory);
    expect(scrubbed.scrubReport.piiRemoved).toBeGreaterThan(0);
    expect(scrubbed.scrubReport.typesDetected).toContain('email');
    expect(scrubbed.scrubReport.typesDetected).toContain('phone');
    expect(scrubbed.scrubReport.typesDetected).toContain('ssn');

    // Verify PII is actually gone
    const step0 = scrubbed.trajectory.steps[0];
    const obs = step0.observation as any;
    expect(obs.email).toBe('[EMAIL]');
    expect(obs.phone).toBe('[PHONE]');
    expect(obs.ssn).toBe('[SSN]');
  });

  it('scores trajectory quality', async () => {
    const store = new InMemoryTrajectoryStore();
    const proxy = new DataProxy(store);

    const recorder = new TrajectoryRecorder({
      analysisId: 'a1',
      userId: 'u1',
      agentId: 'agent-1',
      agentVersion: '1.0.0',
      agentStability: 'beta',
      contextSnapshot: createContextSnapshot({}),
      metadata: createMetadata([]),
    });
    recorder.observe({ input: 'data' });
    recorder.compute('mean', [1, 2, 3], 2);
    recorder.result({ mean: 2 });
    const trajectory = recorder.complete('success');

    const score = proxy.scoreQuality(trajectory);
    expect(score.score).toBeGreaterThan(0);
    expect(score.score).toBeLessThanOrEqual(1);
    expect(score.components).toHaveLength(4);
  });
});

describe('EvolutionControlPlane', () => {
  it('suggests promotion for high-performing agents', async () => {
    const store = new InMemoryTrajectoryStore();
    const controlPlane = new EvolutionControlPlane(store, {
      minTrajectoriesForPromotion: 5,
      promotionSuccessRateThreshold: 0.8,
    });

    // Add 5 successful trajectories
    for (let i = 0; i < 5; i++) {
      const recorder = new TrajectoryRecorder({
        analysisId: `a${i}`,
        userId: 'u1',
        agentId: 'agent-X',
        agentVersion: '1.0.0',
        agentStability: 'beta',
        contextSnapshot: createContextSnapshot({}),
        metadata: createMetadata([]),
      });
      recorder.observe({ i });
      recorder.addReward({
        timestamp: new Date().toISOString(),
        type: 'explicit',
        source: 'user_thumbs_up',
        value: 1.0,
      });
      await store.save(recorder.complete('success'));
    }

    const actions = await controlPlane.analyze('agent-X');
    expect(actions).toContainEqual(
      expect.objectContaining({ type: 'PROMOTE_STABILITY' })
    );
  });
});

describe('Verification Gates', () => {
  it('validates output with schema gate', () => {
    const { z } = require('zod');
    const schema = z.object({ mean: z.number() });
    const gate = new SchemaVerificationGate(schema);

    const goodResult = {
      agentId: 'test', agentName: 'Test', status: 'success',
      output: { mean: 5 }, metrics: {}, executionTimeMs: 100, timestamp: '',
    };
    expect(gate.verify(goodResult, {} as any).status).toBe('pass');

    const badResult = {
      agentId: 'test', agentName: 'Test', status: 'success',
      output: { mean: 'not a number' }, metrics: {}, executionTimeMs: 100, timestamp: '',
    };
    expect(gate.verify(badResult, {} as any).status).toBe('fail');
  });
});
