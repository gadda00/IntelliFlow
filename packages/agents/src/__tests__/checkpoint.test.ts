import { describe, it, expect, beforeEach } from 'vitest';
import {
  CheckpointManager,
  InMemoryCheckpointStore,
} from '../checkpoint/manager';
import type { AgentResult, Checkpoint } from '../checkpoint/types';

function makeResult(agentId: string, status: AgentResult['status'] = 'success'): AgentResult {
  return {
    agentId,
    agentName: agentId.replace(/-/g, ' '),
    status,
    output: { ok: true, agentId },
    metrics: { rows: 100 },
    executionTimeMs: 42,
    timestamp: new Date().toISOString(),
  };
}

describe('InMemoryCheckpointStore', () => {
  let store: InMemoryCheckpointStore;

  beforeEach(() => {
    store = new InMemoryCheckpointStore();
  });

  it('saves and loads a checkpoint by analysisId', async () => {
    const ckpt: Checkpoint = {
      id: 'ckpt_1',
      analysisId: 'analysis-1',
      stage: 'ingest',
      stageNumber: 0,
      agentResults: { 'data-ingestion': makeResult('data-ingestion') },
      timestamp: new Date().toISOString(),
      status: 'in_progress',
    };
    await store.save(ckpt);

    const loaded = await store.load('analysis-1');
    expect(loaded).not.toBeNull();
    expect(loaded!.analysisId).toBe('analysis-1');
    expect(loaded!.stage).toBe('ingest');
    expect(loaded!.agentResults['data-ingestion'].agentId).toBe('data-ingestion');
  });

  it('returns null when no checkpoint exists', async () => {
    const loaded = await store.load('nonexistent');
    expect(loaded).toBeNull();
  });

  it('save overwrites the previous checkpoint for the same analysisId', async () => {
    await store.save({
      id: 'ckpt_1',
      analysisId: 'a1',
      stage: 'ingest',
      stageNumber: 0,
      agentResults: {},
      timestamp: new Date().toISOString(),
      status: 'in_progress',
    });
    await store.save({
      id: 'ckpt_2',
      analysisId: 'a1',
      stage: 'engineer',
      stageNumber: 1,
      agentResults: { 'data-cleaner': makeResult('data-cleaner') },
      timestamp: new Date().toISOString(),
      status: 'in_progress',
    });

    const loaded = await store.load('a1');
    expect(loaded!.stage).toBe('engineer');
    expect(loaded!.stageNumber).toBe(1);
    expect(loaded!.agentResults['data-cleaner']).toBeDefined();
    expect(store.size).toBe(1);
  });

  it('deletes a checkpoint', async () => {
    await store.save({
      id: 'ckpt_1',
      analysisId: 'a1',
      stage: 'ingest',
      stageNumber: 0,
      agentResults: {},
      timestamp: new Date().toISOString(),
      status: 'in_progress',
    });
    expect(store.size).toBe(1);

    await store.delete('a1');
    expect(store.size).toBe(0);
    expect(await store.load('a1')).toBeNull();
  });

  it('delete is a no-op for an unknown analysisId', async () => {
    await expect(store.delete('nonexistent')).resolves.toBeUndefined();
    expect(store.size).toBe(0);
  });

  it('isolates checkpoints by analysisId', async () => {
    await store.save({
      id: 'ckpt_a',
      analysisId: 'a1',
      stage: 'ingest',
      stageNumber: 0,
      agentResults: {},
      timestamp: new Date().toISOString(),
      status: 'in_progress',
    });
    await store.save({
      id: 'ckpt_b',
      analysisId: 'a2',
      stage: 'ingest',
      stageNumber: 0,
      agentResults: {},
      timestamp: new Date().toISOString(),
      status: 'in_progress',
    });

    expect(store.size).toBe(2);
    expect((await store.load('a1'))!.id).toBe('ckpt_a');
    expect((await store.load('a2'))!.id).toBe('ckpt_b');
  });
});

describe('CheckpointManager', () => {
  let store: InMemoryCheckpointStore;
  let manager: CheckpointManager;

  beforeEach(() => {
    store = new InMemoryCheckpointStore();
    manager = new CheckpointManager(store);
  });

  it('saveCheckpoint persists a checkpoint with the given stage and results', async () => {
    const results = new Map<string, AgentResult>([
      ['data-ingestion', makeResult('data-ingestion')],
      ['schema-inference', makeResult('schema-inference')],
    ]);

    const ckpt = await manager.saveCheckpoint(
      'analysis-1',
      'ingest',
      0,
      results,
    );

    expect(ckpt.analysisId).toBe('analysis-1');
    expect(ckpt.stage).toBe('ingest');
    expect(ckpt.stageNumber).toBe(0);
    expect(ckpt.status).toBe('in_progress');
    expect(ckpt.id).toMatch(/^ckpt_/);
    expect(Object.keys(ckpt.agentResults)).toHaveLength(2);
    expect(ckpt.agentResults['data-ingestion'].status).toBe('success');

    // Verify it round-trips through the store.
    const restored = await manager.restoreCheckpoint('analysis-1');
    expect(restored).not.toBeNull();
    expect(restored!.stage).toBe('ingest');
    expect(restored!.agentResults['schema-inference']).toBeDefined();
  });

  it('saveCheckpoint accepts an explicit status', async () => {
    const ckpt = await manager.saveCheckpoint(
      'analysis-1',
      'report',
      6,
      new Map(),
      'completed',
    );
    expect(ckpt.status).toBe('completed');
  });

  it('restoreCheckpoint returns null when no checkpoint exists', async () => {
    const restored = await manager.restoreCheckpoint('never-saved');
    expect(restored).toBeNull();
  });

  it('deleteCheckpoint removes the checkpoint', async () => {
    await manager.saveCheckpoint('analysis-1', 'ingest', 0, new Map());
    expect(await manager.restoreCheckpoint('analysis-1')).not.toBeNull();

    await manager.deleteCheckpoint('analysis-1');
    expect(await manager.restoreCheckpoint('analysis-1')).toBeNull();
  });

  it('saveCheckpoint overwrites the previous checkpoint for the same analysis', async () => {
    // Stage 0 completes.
    await manager.saveCheckpoint(
      'analysis-1',
      'ingest',
      0,
      new Map([['data-ingestion', makeResult('data-ingestion')]]),
    );
    // Stage 1 completes — should overwrite.
    await manager.saveCheckpoint(
      'analysis-1',
      'engineer',
      1,
      new Map([
        ['data-ingestion', makeResult('data-ingestion')],
        ['data-cleaner', makeResult('data-cleaner')],
      ]),
    );

    const restored = await manager.restoreCheckpoint('analysis-1');
    expect(restored!.stageNumber).toBe(1);
    expect(restored!.stage).toBe('engineer');
    expect(Object.keys(restored!.agentResults)).toHaveLength(2);
    // The store should hold exactly one checkpoint (the latest).
    expect(store.size).toBe(1);
  });

  it('restored checkpoint results can be rebuilt into a Map for the orchestrator', async () => {
    const original = new Map<string, AgentResult>([
      ['data-ingestion', makeResult('data-ingestion')],
      ['data-profiler', makeResult('data-profiler')],
    ]);
    await manager.saveCheckpoint('analysis-1', 'ingest', 0, original);

    const restored = await manager.restoreCheckpoint('analysis-1');
    expect(restored).not.toBeNull();

    // Rebuild a Map exactly as the orchestrator would on resume.
    const resultsMap = new Map(Object.entries(restored!.agentResults));
    expect(resultsMap.size).toBe(2);
    expect(resultsMap.get('data-profiler')!.agentId).toBe('data-profiler');
    // Downstream agents can consume the prior-stage output.
    expect((resultsMap.get('data-ingestion')!.output as any).ok).toBe(true);
  });
});
