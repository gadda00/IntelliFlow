/**
 * Shared test utilities for agent tests.
 *
 * Provides factories for building AgentContext instances with realistic
 * data so individual agent test files can stay focused on assertions.
 */

import type { EnhancedAgentContext } from '../core';
import type { AgentResult } from '@busara/core';

/**
 * Build a minimal but valid EnhancedAgentContext.
 *
 * Most fields are stubbed because the concrete agents only read a small
 * subset (dataframe, config, previousResults). The stubs let us avoid
 * pulling in the full logger/metrics/cache infrastructure for unit tests.
 */
export function buildContext(overrides: {
  dataframe?: Record<string, unknown>[];
  config?: Record<string, unknown>;
  previousResults?: Map<string, AgentResult>;
  analysisId?: string;
} = {}): EnhancedAgentContext {
  const previousResults = overrides.previousResults ?? new Map<string, AgentResult>();
  return {
    analysisId: overrides.analysisId ?? 'test-analysis',
    analysisName: 'Test Analysis',
    dataframe: overrides.dataframe ?? [],
    metadata: {},
    previousResults,
    config: (overrides.config ?? {}) as never,
    userId: 'test-user',
    orgId: 'test-org',
    startedAt: new Date().toISOString(),
    requestId: 'test-req',
    traceId: 'test-trace',
    // EnhancedAgentContext extras
    executionId: 'test-exec',
    attempt: 1,
    options: {},
    logger: {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
      child: () => ({ debug: () => {}, info: () => {}, warn: () => {}, error: () => {}, child: () => ({}) }),
    },
    metrics: {
      startTimer: () => {},
      endTimer: () => 0,
      increment: () => {},
      decrement: () => {},
      set: () => {},
      observe: () => {},
      getMetrics: () => ({}),
    },
    cache: {
      get: async () => null,
      set: async () => {},
      delete: async () => {},
      has: async () => false,
      clear: async () => {},
    },
  } as unknown as EnhancedAgentContext;
}

/**
 * Build a context whose `previousResults` map has a schema_inference entry,
 * which most engineer/detect agents depend on.
 */
export function buildContextWithSchema(
  schema: Record<string, { type: string; confidence: number; nullCount: number; uniqueCount: number }>,
  overrides: {
    dataframe?: Record<string, unknown>[];
    config?: Record<string, unknown>;
    analysisId?: string;
  } = {},
): EnhancedAgentContext {
  const previousResults = new Map<string, AgentResult>();
  previousResults.set('schema_inference', {
    agentId: 'schema_inference',
    agentName: 'Schema Inference',
    status: 'success',
    output: { schema, summary: {} },
    metrics: {},
    executionTimeMs: 0,
    timestamp: new Date().toISOString(),
  });
  return buildContext({ ...overrides, previousResults });
}

/** A small mixed-type dataframe used across many tests. */
export const sampleDataframe: Record<string, unknown>[] = [
  { id: 1, name: 'Alice', age: 30, score: 85.5, active: true, joined: '2023-01-15' },
  { id: 2, name: 'Bob', age: 25, score: 92.0, active: false, joined: '2023-02-20' },
  { id: 3, name: 'Charlie', age: 35, score: 78.3, active: true, joined: '2023-03-10' },
  { id: 4, name: 'Diana', age: 28, score: 88.9, active: true, joined: '2023-04-05' },
  { id: 5, name: 'Eve', age: 40, score: 95.2, active: false, joined: '2023-05-12' },
];

/** A schema describing the columns of `sampleDataframe`. */
export const sampleSchema = {
  id: { type: 'integer', confidence: 1, nullCount: 0, uniqueCount: 5 },
  name: { type: 'string', confidence: 0.9, nullCount: 0, uniqueCount: 5 },
  age: { type: 'integer', confidence: 1, nullCount: 0, uniqueCount: 5 },
  score: { type: 'float', confidence: 1, nullCount: 0, uniqueCount: 5 },
  active: { type: 'boolean', confidence: 1, nullCount: 0, uniqueCount: 2 },
  joined: { type: 'datetime', confidence: 0.95, nullCount: 0, uniqueCount: 5 },
};

/** A dataframe with some missing values. */
export const missingDataDataframe: Record<string, unknown>[] = [
  { id: 1, value: 10, label: 'a' },
  { id: 2, value: null, label: 'b' },
  { id: 3, value: 30, label: null },
  { id: 4, value: null, label: 'd' },
  { id: 5, value: 50, label: 'e' },
];

/** A dataframe with all-null values for a column. */
export const allNullDataframe: Record<string, unknown>[] = [
  { id: 1, value: null },
  { id: 2, value: null },
  { id: 3, value: null },
];
