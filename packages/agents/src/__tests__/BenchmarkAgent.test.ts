import { describe, it, expect, beforeEach } from 'vitest';
import { BenchmarkAgent } from '../agents/detect/BenchmarkAgent';
import { buildContextWithSchema, sampleDataframe, sampleSchema } from './testUtils';

describe('BenchmarkAgent', () => {
  let agent: BenchmarkAgent;

  beforeEach(() => {
    agent = new BenchmarkAgent();
  });

  it('exposes correct metadata', () => {
    expect(agent.metadata.id).toBe('benchmark');
    expect(agent.metadata.stage).toBe('detect');
  });

  it('benchmarks data against an industry', async () => {
    const result = await agent.execute(
      buildContextWithSchema(sampleSchema, {
        dataframe: sampleDataframe,
        config: { industry: 'ecommerce' },
      }),
    );
    expect(result.status).toBe('success');
    const output = result.output as {
      industry: string;
      metrics: unknown[];
      summary: { overallPerformance: string; averagePercentile: number; totalMetrics: number };
      recommendations: unknown[];
    };
    expect(typeof output.industry).toBe('string');
    expect(Array.isArray(output.metrics)).toBe(true);
    expect(output.summary).toBeDefined();
  });

  it('returns error for empty dataframe', async () => {
    const result = await agent.execute(buildContextWithSchema({}, { dataframe: [] }));
    expect(result.status).toBe('failed');
    expect(result.error).toMatch(/no data/i);
  });

  it('returns error for unknown industry', async () => {
    const result = await agent.execute(
      buildContextWithSchema(sampleSchema, {
        dataframe: sampleDataframe,
        config: { industry: 'nonexistent_industry_xyz' },
      }),
    );
    expect(result.status).toBe('failed');
    expect(result.error).toMatch(/no benchmarks/i);
  });

  it('returns error when no numeric columns are available', async () => {
    const result = await agent.execute(
      buildContextWithSchema(
        { name: { type: 'string', confidence: 1, nullCount: 0, uniqueCount: 2 } },
        { dataframe: [{ name: 'a' }, { name: 'b' }] },
      ),
    );
    expect(result.status).toBe('failed');
    expect(result.error).toMatch(/no numeric/i);
  });

  it('returns error for null input', async () => {
    const result = await agent.execute(buildContextWithSchema({}, { dataframe: null as unknown as Record<string, unknown>[] }));
    expect(result.status).toBe('failed');
  });

  it('supports metricMappings config', async () => {
    const result = await agent.execute(
      buildContextWithSchema(sampleSchema, {
        dataframe: sampleDataframe,
        config: {
          industry: 'ecommerce',
          metricMappings: { revenue: 'age' },
        },
      }),
    );
    expect(result.status).toBe('success');
  });

  it('reports metrics in result', async () => {
    const result = await agent.execute(
      buildContextWithSchema(sampleSchema, {
        dataframe: sampleDataframe,
        config: { industry: 'ecommerce' },
      }),
    );
    expect(result.metrics).toHaveProperty('metricsAnalyzed');
    expect(result.metrics).toHaveProperty('averagePercentile');
  });
});
