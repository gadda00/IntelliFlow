import { describe, it, expect, beforeEach } from 'vitest';
import { DataIngestionAgent } from '../agents/ingest/DataIngestionAgent';
import { buildContext, sampleDataframe, missingDataDataframe } from './testUtils';

describe('DataIngestionAgent', () => {
  let agent: DataIngestionAgent;

  beforeEach(() => {
    agent = new DataIngestionAgent();
  });

  it('exposes correct metadata', () => {
    expect(agent.metadata.id).toBe('data_ingestion');
    expect(agent.metadata.stage).toBe('ingest');
    expect(agent.metadata.stageNumber).toBe(0);
  });

  it('profiles a simple dataframe', async () => {
    const result = await agent.execute(buildContext({ dataframe: sampleDataframe }));
    expect(result.status).toBe('success');
    expect(result.output).toBeDefined();
    const output = result.output as Record<string, unknown>;
    expect(output.rowCount).toBe(5);
    expect(output.columnCount).toBe(6);
    expect(output.isEmpty).toBe(false);
    expect(output.hasHeaders).toBe(true);
    expect(Array.isArray(output.sampleRows)).toBe(true);
  });

  it('extracts sample rows respecting sampleSize config', async () => {
    const result = await agent.execute(
      buildContext({ dataframe: sampleDataframe, config: { sampleSize: 2 } }),
    );
    expect(result.status).toBe('success');
    const output = result.output as Record<string, unknown>;
    expect((output.sampleRows as unknown[]).length).toBe(2);
  });

  it('infers data types when inferTypes is enabled', async () => {
    const result = await agent.execute(
      buildContext({ dataframe: sampleDataframe, config: { inferTypes: true } }),
    );
    const output = result.output as Record<string, { dataTypes?: Record<string, string> }>;
    expect(output.dataTypes).toBeDefined();
    expect(output.dataTypes!.id).toBe('integer');
    expect(output.dataTypes!.active).toBe('boolean');
    expect(output.dataTypes!.name).toBe('string');
  });

  it('computes statistics for numeric columns', async () => {
    const result = await agent.execute(
      buildContext({ dataframe: sampleDataframe, config: { validateRows: true } }),
    );
    const output = result.output as Record<string, { statistics?: Record<string, Record<string, number>> }>;
    expect(output.statistics).toBeDefined();
    expect(output.statistics!.age.mean).toBeCloseTo(31.6, 1);
    expect(output.statistics!.age.min).toBe(25);
    expect(output.statistics!.age.max).toBe(40);
  });

  it('returns error for empty dataframe', async () => {
    const result = await agent.execute(buildContext({ dataframe: [] }));
    expect(result.status).toBe('failed');
    expect(result.error).toMatch(/empty/i);
  });

  it('returns error for non-array input', async () => {
    const result = await agent.execute(buildContext({ dataframe: null as unknown as Record<string, unknown>[] }));
    expect(result.status).toBe('failed');
    expect(result.error).toBeDefined();
  });

  it('returns error for inconsistent structure', async () => {
    const result = await agent.execute(
      buildContext({
        dataframe: [
          { a: 1, b: 'x' },
          { a: 2, c: 'y' },
        ],
      }),
    );
    expect(result.status).toBe('failed');
    expect(result.error).toMatch(/inconsistent/i);
  });

  it('handles single row', async () => {
    const result = await agent.execute(buildContext({ dataframe: [{ a: 1 }] }));
    expect(result.status).toBe('success');
    const output = result.output as Record<string, unknown>;
    expect(output.rowCount).toBe(1);
  });

  it('records executionTimeMs in metrics', async () => {
    const result = await agent.execute(buildContext({ dataframe: sampleDataframe }));
    expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
    expect(result.metrics.rowCount).toBe(5);
    expect(result.metrics.columnCount).toBe(6);
  });

  it('handles rows with null values', async () => {
    const result = await agent.execute(buildContext({ dataframe: missingDataDataframe }));
    expect(result.status).toBe('success');
    const output = result.output as Record<string, unknown>;
    expect(output.rowCount).toBe(5);
  });
});
