import { describe, it, expect, beforeEach } from 'vitest';
import { DataTransformerAgent } from '../agents/engineer/DataTransformerAgent';
import { buildContextWithSchema, sampleDataframe, sampleSchema } from './testUtils';

describe('DataTransformerAgent', () => {
  let agent: DataTransformerAgent;

  beforeEach(() => {
    agent = new DataTransformerAgent();
  });

  it('exposes correct metadata', () => {
    expect(agent.metadata.id).toBe('data_transformer');
    expect(agent.metadata.stage).toBe('engineer');
    expect(agent.metadata.tier).toBe('advanced');
  });

  it('passes data through unchanged when no transformations are configured', async () => {
    const result = await agent.execute(buildContextWithSchema(sampleSchema, { dataframe: sampleDataframe }));
    expect(result.status).toBe('success');
    const output = result.output as { transformedDataframe: Record<string, unknown>[] };
    expect(output.transformedDataframe.length).toBe(5);
  });

  it('renames a column when configured', async () => {
    const result = await agent.execute(
      buildContextWithSchema(sampleSchema, {
        dataframe: sampleDataframe,
        config: {
          columnOperations: [
            { operation: 'rename', column: 'name', newName: 'full_name' },
          ],
        },
      }),
    );
    const output = result.output as {
      transformedDataframe: Record<string, unknown>[],
      transformationReport: { columnsAdded: string[]; columnsRemoved: string[] }
    };
    expect(output.transformationReport.columnsRemoved).toContain('name');
    expect(output.transformationReport.columnsAdded).toContain('full_name');
    expect(output.transformedDataframe[0]).toHaveProperty('full_name');
    expect(output.transformedDataframe[0]).not.toHaveProperty('name');
  });

  it('drops a column when configured', async () => {
    const result = await agent.execute(
      buildContextWithSchema(sampleSchema, {
        dataframe: sampleDataframe,
        config: {
          columnOperations: [{ operation: 'drop', column: 'joined' }],
        },
      }),
    );
    const output = result.output as {
      transformedDataframe: Record<string, unknown>[],
      transformationReport: { columnsRemoved: string[] }
    };
    expect(output.transformationReport.columnsRemoved).toContain('joined');
    expect(output.transformedDataframe[0]).not.toHaveProperty('joined');
  });

  it('applies a formula to create a new column', async () => {
    const result = await agent.execute(
      buildContextWithSchema(sampleSchema, {
        dataframe: sampleDataframe,
        config: {
          formulas: [
            { name: 'score_doubled', expression: 'score * 2', columns: ['score'] },
          ],
        },
      }),
    );
    const output = result.output as {
      transformedDataframe: Record<string, unknown>[],
      transformationReport: { columnsAdded: string[]; transformationsApplied: string[] }
    };
    expect(output.transformationReport.columnsAdded).toContain('score_doubled');
    expect(output.transformedDataframe[0].score_doubled).toBeCloseTo(171, 0);
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
        { dataframe: [{ x: 10 }] },
      ),
    );
    expect(result.status).toBe('success');
  });

  it('sorts rows when configured', async () => {
    const df = [{ x: 5 }, { x: 1 }, { x: 9 }, { x: 3 }];
    const schema = { x: { type: 'integer', confidence: 1, nullCount: 0, uniqueCount: 4 } };
    const result = await agent.execute(
      buildContextWithSchema(schema, {
        dataframe: df,
        config: {
          rowOperations: [{ operation: 'sort', column: 'x', order: 'asc' }],
        },
      }),
    );
    const output = result.output as { transformedDataframe: { x: number }[] };
    expect(output.transformedDataframe.map(r => r.x)).toEqual([1, 3, 5, 9]);
  });
});
