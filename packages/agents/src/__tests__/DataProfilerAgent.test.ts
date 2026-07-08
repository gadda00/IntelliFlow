import { describe, it, expect, beforeEach } from 'vitest';
import { DataProfilerAgent } from '../agents/ingest/DataProfilerAgent';
import { buildContext, buildContextWithSchema, sampleDataframe, sampleSchema, missingDataDataframe } from './testUtils';

describe('DataProfilerAgent', () => {
  let agent: DataProfilerAgent;

  beforeEach(() => {
    agent = new DataProfilerAgent();
  });

  it('exposes correct metadata', () => {
    expect(agent.metadata.id).toBe('data_profiler');
    expect(agent.metadata.stage).toBe('ingest');
  });

  it('profiles a dataframe and returns column profiles', async () => {
    const result = await agent.execute(buildContextWithSchema(sampleSchema, { dataframe: sampleDataframe }));
    expect(result.status).toBe('success');
    const output = result.output as { profile: Record<string, unknown>, summary: Record<string, number> };
    expect(output.profile).toBeDefined();
    expect(Object.keys(output.profile).length).toBe(6);
    expect(output.summary.rowCount).toBe(5);
    expect(output.summary.columnCount).toBe(6);
  });

  it('computes completeness from null percentage', async () => {
    const result = await agent.execute(
      buildContextWithSchema(
        {
          id: { type: 'integer', confidence: 1, nullCount: 0, uniqueCount: 5 },
          value: { type: 'integer', confidence: 1, nullCount: 2, uniqueCount: 3 },
          label: { type: 'string', confidence: 1, nullCount: 1, uniqueCount: 4 },
        },
        { dataframe: missingDataDataframe },
      ),
    );
    const output = result.output as { summary: { completeness: number } };
    // 15 total cells, 3 null → completeness = 1 - 3/15 = 0.8
    expect(output.summary.completeness).toBeCloseTo(0.8, 2);
  });

  it('computes statistics for numeric columns', async () => {
    const result = await agent.execute(buildContextWithSchema(sampleSchema, { dataframe: sampleDataframe }));
    const output = result.output as { profile: Record<string, { statistics?: Record<string, number> }> };
    expect(output.profile.age.statistics).toBeDefined();
    expect(output.profile.age.statistics!.mean).toBeCloseTo(31.6, 1);
    expect(output.profile.age.statistics!.min).toBe(25);
    expect(output.profile.age.statistics!.max).toBe(40);
  });

  it('returns error for empty dataframe', async () => {
    const result = await agent.execute(buildContextWithSchema({}, { dataframe: [] }));
    expect(result.status).toBe('failed');
    expect(result.error).toMatch(/no data/i);
  });

  it('returns error for null input', async () => {
    const result = await agent.execute(buildContextWithSchema({}, { dataframe: null as unknown as Record<string, unknown>[] }));
    expect(result.status).toBe('failed');
  });

  it('handles single row', async () => {
    const result = await agent.execute(
      buildContextWithSchema(
        { x: { type: 'integer', confidence: 1, nullCount: 0, uniqueCount: 1 } },
        { dataframe: [{ x: 42 }] },
      ),
    );
    expect(result.status).toBe('success');
    const output = result.output as { summary: { rowCount: number } };
    expect(output.summary.rowCount).toBe(1);
  });

  it('includes distributions when configured', async () => {
    const result = await agent.execute(
      buildContextWithSchema(sampleSchema, {
        dataframe: sampleDataframe,
        config: { includeDistributions: true, distributionBins: 5 },
      }),
    );
    const output = result.output as { profile: Record<string, { distribution?: Record<string, number> }> };
    expect(output.profile.age.distribution).toBeDefined();
  });

  it('categorizes numeric vs categorical columns in summary', async () => {
    const result = await agent.execute(buildContextWithSchema(sampleSchema, { dataframe: sampleDataframe }));
    const output = result.output as { summary: { numericColumns: number; categoricalColumns: number; booleanColumns: number; datetimeColumns: number } };
    expect(output.summary.numericColumns).toBe(3); // id, age, score
    expect(output.summary.booleanColumns).toBe(1); // active
    expect(output.summary.datetimeColumns).toBe(1); // joined
  });
});
