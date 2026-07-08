import { describe, it, expect, beforeEach } from 'vitest';
import { DataEngineerAgent } from '../agents/engineer/DataEngineerAgent';
import { buildContextWithSchema, sampleDataframe, sampleSchema } from './testUtils';

/**
 * DataEngineerAgent performs scaling, encoding, feature selection,
 * dimensionality reduction (PCA), and feature creation. Output shape:
 *
 *   {
 *     engineeredDataframe: Record<string, unknown>[],
 *     engineeringReport: {
 *       featuresAdded:          string[],
 *       featuresRemoved:        string[],
 *       scalingApplied:         Record<string, string>,
 *       encodingApplied:        Record<string, string>,
 *       transformationsApplied: Record<string, string[]>,
 *       featureStatistics:      Record<string, Record<string, number>>,
 *       correlationMatrix:      Record<string, Record<string, number>>,
 *     },
 *   }
 *
 * Every step is opt-in via config.<step>.enabled. With no config the agent
 * just deep-clones the dataframe and computes featureStatistics + the
 * correlation matrix over the numeric columns.
 */
describe('DataEngineerAgent', () => {
  let agent: DataEngineerAgent;

  beforeEach(() => {
    agent = new DataEngineerAgent();
  });

  it('exposes correct metadata', () => {
    expect(agent.metadata.id).toBe('data_engineer');
    expect(agent.metadata.stage).toBe('engineer');
    expect(agent.metadata.stageNumber).toBe(1);
    expect(agent.metadata.tier).toBe('core');
  });

  it('passes data through unchanged when no transformations are enabled', async () => {
    const result = await agent.execute(buildContextWithSchema(sampleSchema, { dataframe: sampleDataframe }));
    expect(result.status).toBe('success');
    const output = result.output as {
      engineeredDataframe: Record<string, unknown>[];
      engineeringReport: {
        featuresAdded: string[];
        featuresRemoved: string[];
        scalingApplied: Record<string, string>;
        encodingApplied: Record<string, string>;
        transformationsApplied: Record<string, string[]>;
        featureStatistics: Record<string, Record<string, number>>;
        correlationMatrix: Record<string, Record<string, number>>;
      };
    };
    expect(output.engineeredDataframe.length).toBe(5);
    expect(output.engineeringReport.featuresAdded).toEqual([]);
    expect(output.engineeringReport.featuresRemoved).toEqual([]);
    expect(output.engineeringReport.scalingApplied).toEqual({});
    expect(output.engineeringReport.encodingApplied).toEqual({});
    // featureStatistics computed for every numeric column (id, age, score)
    expect(output.engineeringReport.featureStatistics.age).toBeDefined();
    expect(output.engineeringReport.featureStatistics.age.mean).toBeCloseTo(31.6, 1);
    // correlationMatrix is symmetric and has all numeric columns
    expect(Object.keys(output.engineeringReport.correlationMatrix)).toEqual(
      expect.arrayContaining(['id', 'age', 'score']),
    );
  });

  it('reports totalFeatures metric', async () => {
    const result = await agent.execute(buildContextWithSchema(sampleSchema, { dataframe: sampleDataframe }));
    expect(result.metrics.totalFeatures).toBe(6);
    expect(result.metrics.featuresAdded).toBe(0);
    expect(result.metrics.featuresRemoved).toBe(0);
    expect(result.metrics.featuresScaled).toBe(0);
    expect(result.metrics.featuresEncoded).toBe(0);
  });

  it('applies scaling when scaling.enabled=true', async () => {
    const result = await agent.execute(
      buildContextWithSchema(sampleSchema, {
        dataframe: sampleDataframe,
        config: { scaling: { enabled: true, method: 'standard' } },
      }),
    );
    expect(result.status).toBe('success');
    const output = result.output as {
      engineeredDataframe: Record<string, unknown>[];
      engineeringReport: { scalingApplied: Record<string, string> };
    };
    // Standardization applied to every numeric column (id, age, score)
    expect(Object.keys(output.engineeringReport.scalingApplied).length).toBe(3);
    expect(output.engineeringReport.scalingApplied.age).toBeDefined();
    // Standardized values are numbers
    expect(typeof output.engineeredDataframe[0].age).toBe('number');
  });

  it('applies one-hot encoding when encoding.enabled=true', async () => {
    const result = await agent.execute(
      buildContextWithSchema(sampleSchema, {
        dataframe: sampleDataframe,
        config: { encoding: { enabled: true, method: 'onehot' } },
      }),
    );
    expect(result.status).toBe('success');
    const output = result.output as {
      engineeredDataframe: Record<string, unknown>[];
      engineeringReport: { encodingApplied: Record<string, string>; featuresAdded: string[] };
    };
    // Encoding applied to categorical/string columns
    expect(Object.keys(output.engineeringReport.encodingApplied).length).toBeGreaterThan(0);
    expect(output.engineeringReport.featuresAdded.length).toBeGreaterThan(0);
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

  it('handles a single row', async () => {
    const result = await agent.execute(
      buildContextWithSchema(
        { x: { type: 'integer', confidence: 1, nullCount: 0, uniqueCount: 1 } },
        { dataframe: [{ x: 42 }] },
      ),
    );
    expect(result.status).toBe('success');
    const output = result.output as { engineeredDataframe: Record<string, unknown>[] };
    expect(output.engineeredDataframe.length).toBe(1);
  });

  it('computes a correlation matrix between numeric columns', async () => {
    const result = await agent.execute(buildContextWithSchema(sampleSchema, { dataframe: sampleDataframe }));
    const output = result.output as { engineeringReport: { correlationMatrix: Record<string, Record<string, number>> } };
    const cm = output.engineeringReport.correlationMatrix;
    // Diagonal is always 1
    expect(cm.id.id).toBeCloseTo(1, 5);
    expect(cm.age.age).toBeCloseTo(1, 5);
    // Symmetric
    expect(cm.id.age).toBeCloseTo(cm.age.id, 5);
  });
});
