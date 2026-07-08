import { describe, it, expect, beforeEach } from 'vitest';
import { CausalArchitectAgent } from '../agents/detect/CausalArchitectAgent';
import { buildContextWithSchema, sampleDataframe, sampleSchema } from './testUtils';

describe('CausalArchitectAgent', () => {
  let agent: CausalArchitectAgent;

  beforeEach(() => {
    agent = new CausalArchitectAgent();
  });

  it('exposes correct metadata', () => {
    expect(agent.metadata.id).toBe('causal_architect');
    expect(agent.metadata.stage).toBe('detect');
  });

  it('computes correlation matrix for numeric variables', async () => {
    const result = await agent.execute(buildContextWithSchema(sampleSchema, { dataframe: sampleDataframe }));
    expect(result.status).toBe('success');
    const output = result.output as {
      correlationMatrix: Record<string, Record<string, number>>;
      summary: { significantCorrelations: number };
      causalGraph: { nodes: unknown[]; edges: unknown[] };
    };
    expect(output.correlationMatrix).toBeDefined();
    expect(Object.keys(output.correlationMatrix).length).toBeGreaterThan(0);
    expect(output.summary).toBeDefined();
    expect(output.causalGraph).toBeDefined();
  });

  it('returns error for empty dataframe', async () => {
    const result = await agent.execute(buildContextWithSchema({}, { dataframe: [] }));
    expect(result.status).toBe('failed');
    expect(result.error).toMatch(/no data/i);
  });

  it('returns error when fewer than 2 variables are available', async () => {
    const result = await agent.execute(
      buildContextWithSchema(
        { x: { type: 'integer', confidence: 1, nullCount: 0, uniqueCount: 1 } },
        { dataframe: [{ x: 1 }] },
      ),
    );
    expect(result.status).toBe('failed');
    expect(result.error).toMatch(/at least 2/i);
  });

  it('returns error for null input', async () => {
    const result = await agent.execute(buildContextWithSchema({}, { dataframe: null as unknown as Record<string, unknown>[] }));
    expect(result.status).toBe('failed');
  });

  it('respects variables.exclude config', async () => {
    const result = await agent.execute(
      buildContextWithSchema(sampleSchema, {
        dataframe: sampleDataframe,
        config: { variables: { numericOnly: true, exclude: ['score'] } },
      }),
    );
    const output = result.output as { correlationMatrix: Record<string, unknown> };
    expect(output.correlationMatrix).not.toHaveProperty('score');
  });

  it('performs correlation analysis when enabled', async () => {
    const result = await agent.execute(
      buildContextWithSchema(sampleSchema, {
        dataframe: sampleDataframe,
        config: { correlation: { enabled: true, significanceLevel: 0.05 } },
      }),
    );
    const output = result.output as { correlationAnalysis: unknown[] };
    expect(Array.isArray(output.correlationAnalysis)).toBe(true);
  });

  it('reports metrics in result', async () => {
    const result = await agent.execute(buildContextWithSchema(sampleSchema, { dataframe: sampleDataframe }));
    expect(result.metrics).toHaveProperty('variablesAnalyzed');
    expect(result.metrics).toHaveProperty('significantCorrelations');
  });
});
