import { describe, it, expect, beforeEach } from 'vitest';
import { AutoMLAgent } from '../agents/detect/AutoMLAgent';
import { buildContextWithSchema, sampleDataframe, sampleSchema } from './testUtils';

/**
 * AutoMLAgent auto-detects a problem type, preprocesses features, trains a
 * handful of simple models in-process, and ranks them. Output shape:
 *
 *   {
 *     problemType:    'regression' | 'classification' | 'clustering',
 *     targetColumn:   string,
 *     features:       string[],
 *     models:         Array<{ modelType, name, parameters, trainingMetrics,
 *                             validationMetrics, testMetrics, featureImportance,
 *                             crossValidation, trainingTime, predictionTime, modelSize }>,
 *     bestModel:      object | null,
 *     featureImportance: Record<string, number>,
 *     recommendations:   Array<unknown>,
 *     warnings:        string[],
 *   }
 *
 * The agent's modelsToTry / trainModel pipeline is intentionally lightweight
 * (linear models only, no sklearn) so small datasets may train 0 models and
 * return bestModel=null. Tests therefore assert structural properties rather
 * than specific scores.
 */
describe('AutoMLAgent', () => {
  let agent: AutoMLAgent;

  beforeEach(() => {
    agent = new AutoMLAgent();
  });

  it('exposes correct metadata', () => {
    expect(agent.metadata.id).toBe('auto_ml');
    expect(agent.metadata.stage).toBe('detect');
    expect(agent.metadata.stageNumber).toBe(2);
    expect(agent.metadata.tier).toBe('advanced');
  });

  it('auto-detects classification when a string column is present', async () => {
    // sampleSchema has `name` as the only string column — auto-detection picks
    // it as the target and reports `classification`.
    const result = await agent.execute(buildContextWithSchema(sampleSchema, { dataframe: sampleDataframe }));
    expect(result.status).toBe('success');

    const output = result.output as {
      problemType: string;
      targetColumn: string;
      features: string[];
      models: unknown[];
      bestModel: unknown;
      featureImportance: Record<string, number>;
      recommendations: unknown[];
      warnings: string[];
    };
    expect(output.problemType).toBe('classification');
    expect(output.targetColumn).toBe('name');
    // All non-target columns become features
    expect(output.features.length).toBe(5);
    expect(output.features).not.toContain('name');
    expect(Array.isArray(output.models)).toBe(true);
    expect(Array.isArray(output.recommendations)).toBe(true);
    expect(Array.isArray(output.warnings)).toBe(true);
  });

  it('honors an explicit regression problemType config', async () => {
    const result = await agent.execute(
      buildContextWithSchema(sampleSchema, {
        dataframe: sampleDataframe,
        config: { problemType: 'regression', targetColumn: 'score' },
      }),
    );
    expect(result.status).toBe('success');
    const output = result.output as { problemType: string; targetColumn: string; features: string[] };
    expect(output.problemType).toBe('regression');
    expect(output.targetColumn).toBe('score');
    expect(output.features).not.toContain('score');
  });

  it('honors an explicit clustering problemType config', async () => {
    const result = await agent.execute(
      buildContextWithSchema(sampleSchema, {
        dataframe: sampleDataframe,
        config: { problemType: 'clustering' },
      }),
    );
    expect(result.status).toBe('success');
    const output = result.output as { problemType: string; targetColumn: string };
    expect(output.problemType).toBe('clustering');
    // clustering has no target column
    expect(output.targetColumn).toBe('');
  });

  it('reports metrics about the run', async () => {
    const result = await agent.execute(buildContextWithSchema(sampleSchema, { dataframe: sampleDataframe }));
    expect(result.metrics.problemType).toBe('classification');
    expect(result.metrics.modelsTrained).toBeDefined();
    expect(result.metrics.featuresUsed).toBe(5);
    expect(typeof result.metrics.trainingTime).toBe('number');
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

  it('returns "No valid features" error when there is only one column', async () => {
    // With only a single column (which becomes the target), there are no features.
    const result = await agent.execute(
      buildContextWithSchema(
        { x: { type: 'integer', confidence: 1, nullCount: 0, uniqueCount: 1 } },
        { dataframe: [{ x: 42 }] },
      ),
    );
    expect(result.status).toBe('failed');
    expect(result.error).toMatch(/no valid features/i);
  });

  it('returns "Could not determine problem type" when schema is empty', async () => {
    // No columns → no target → unknown problem type
    const result = await agent.execute(
      buildContextWithSchema({}, { dataframe: [{ foo: 1 }, { foo: 2 }] }),
    );
    expect(result.status).toBe('failed');
    expect(result.error).toMatch(/could not determine problem type/i);
  });
});
