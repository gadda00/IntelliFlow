import { describe, it, expect, beforeEach } from 'vitest';
import { SchemaInferenceAgent } from '../agents/ingest/SchemaInferenceAgent';
import { buildContext } from './testUtils';

/**
 * SchemaInferenceAgent determines each column's type by running (in order):
 *   1. boolean check — confidence >= 0.8 if every value is in
 *      ['true','false','yes','no','1','0', true, false] (case-insensitive)
 *   2. datetime check — confidence = fraction of values for which
 *      `new Date(value)` parses to a valid date. NOTE: `new Date(<number>)`
 *      is always valid, so any all-numeric column is detected as `datetime`.
 *   3. numeric check — confidence = fraction of values that are numbers or
 *      numeric strings; if >= 0.8 returns `integer` (>= 80% integers) or `float`.
 *   4. categorical — uniqueRatio < 0.1
 *   5. text — fallback
 *
 * The number-as-datetime quirk is intentional per the source and is asserted
 * here so regressions are caught.
 */
describe('SchemaInferenceAgent', () => {
  let agent: SchemaInferenceAgent;

  beforeEach(() => {
    agent = new SchemaInferenceAgent();
  });

  it('exposes correct metadata', () => {
    expect(agent.metadata.id).toBe('schema_inference');
    expect(agent.metadata.stage).toBe('ingest');
    expect(agent.metadata.stageNumber).toBe(0);
    expect(agent.metadata.tier).toBe('core');
  });

  it('detects numeric columns as datetime (new Date(number) is always valid)', async () => {
    // Three numeric columns + one ISO date column → all four are detected as
    // datetime because `new Date(<number>)` always parses to a valid date.
    const df = [
      { id: 1, age: 30, score: 85.5, joined: '2023-01-15' },
      { id: 2, age: 25, score: 92.0, joined: '2023-02-20' },
      { id: 3, age: 35, score: 78.3, joined: '2023-03-10' },
      { id: 4, age: 28, score: 88.9, joined: '2023-04-05' },
      { id: 5, age: 40, score: 95.2, joined: '2023-05-12' },
    ];
    const result = await agent.execute(buildContext({ dataframe: df }));
    expect(result.status).toBe('success');
    const output = result.output as {
      schema: Record<string, { type: string; confidence: number; nullCount: number; uniqueCount: number; sampleValues: unknown[] }>;
      summary: { numericColumns: string[]; datetimeColumns: string[]; booleanColumns: string[]; textColumns: string[]; categoricalColumns: string[]; nullColumns: string[] };
    };
    expect(output.schema.id.type).toBe('datetime');
    expect(output.schema.age.type).toBe('datetime');
    expect(output.schema.score.type).toBe('datetime');
    expect(output.schema.joined.type).toBe('datetime');
    expect(output.summary.datetimeColumns).toEqual(
      expect.arrayContaining(['id', 'age', 'score', 'joined']),
    );
    expect(output.summary.numericColumns).toEqual([]);
  });

  it('detects boolean columns including 0/1 numeric encoding', async () => {
    // active: true/false → boolean
    // flag: 1/0 → also boolean because '1' and '0' are in the boolean list
    const df = [
      { active: true, flag: 1, name: 'Alice' },
      { active: false, flag: 0, name: 'Bob' },
      { active: true, flag: 1, name: 'Charlie' },
      { active: false, flag: 0, name: 'Diana' },
      { active: true, flag: 1, name: 'Eve' },
    ];
    const result = await agent.execute(buildContext({ dataframe: df }));
    expect(result.status).toBe('success');
    const output = result.output as { schema: Record<string, { type: string }>; summary: { booleanColumns: string[] } };
    expect(output.schema.active.type).toBe('boolean');
    expect(output.schema.flag.type).toBe('boolean');
    expect(output.summary.booleanColumns).toEqual(expect.arrayContaining(['active', 'flag']));
  });

  it('detects text for high-cardinality string columns', async () => {
    // name: 5 distinct non-date, non-numeric strings → text (uniqueRatio = 1.0)
    const df = [
      { name: 'Alice', city: 'NYC' },
      { name: 'Bob', city: 'LA' },
      { name: 'Charlie', city: 'SF' },
      { name: 'Diana', city: 'DC' },
      { name: 'Eve', city: 'BO' },
    ];
    const result = await agent.execute(buildContext({ dataframe: df }));
    const output = result.output as { schema: Record<string, { type: string }> };
    expect(output.schema.name.type).toBe('text');
    expect(output.schema.city.type).toBe('text');
  });

  it('reports null type for an all-null column', async () => {
    const df = [
      { id: 1, empty: null },
      { id: 2, empty: null },
      { id: 3, empty: null },
    ];
    const result = await agent.execute(buildContext({ dataframe: df }));
    expect(result.status).toBe('success');
    const output = result.output as { schema: Record<string, { type: string; nullCount: number; uniqueCount: number }>; summary: { nullColumns: string[] } };
    expect(output.schema.empty.type).toBe('null');
    expect(output.schema.empty.nullCount).toBe(3);
    expect(output.schema.empty.uniqueCount).toBe(0);
    expect(output.summary.nullColumns).toContain('empty');
  });

  it('returns error for empty dataframe', async () => {
    const result = await agent.execute(buildContext({ dataframe: [] }));
    expect(result.status).toBe('failed');
    expect(result.error).toMatch(/no data/i);
  });

  it('returns error for null input', async () => {
    const result = await agent.execute(buildContext({ dataframe: null as unknown as Record<string, unknown>[] }));
    expect(result.status).toBe('failed');
  });

  it('handles single row and reports columnCount metric', async () => {
    const result = await agent.execute(
      buildContext({ dataframe: [{ x: 42, label: 'foo' }] }),
    );
    expect(result.status).toBe('success');
    expect(result.metrics.columnCount).toBe(2);
  });

  it('includes sample values per column', async () => {
    const df = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ];
    const result = await agent.execute(buildContext({ dataframe: df, config: { sampleSize: 2 } }));
    const output = result.output as { schema: Record<string, { sampleValues: unknown[] }> };
    expect(output.schema.id.sampleValues.length).toBeGreaterThan(0);
    expect(output.schema.name.sampleValues).toEqual(expect.arrayContaining(['Alice', 'Bob']));
  });
});
