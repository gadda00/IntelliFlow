import { describe, it, expect, beforeEach } from 'vitest';
import { FeatureEngineerAgent } from '../agents/engineer/FeatureEngineerAgent';
import { buildContextWithSchema, sampleDataframe, sampleSchema } from './testUtils';

/**
 * FeatureEngineerAgent creates polynomial, interaction, domain, and
 * transformed features. Output shape:
 *
 *   {
 *     featureEngineeredDataframe: Record<string, unknown>[],
 *     featureEngineeringReport: {
 *       featuresAdded:         string[],  // union of poly + interaction + domain
 *       polynomialFeatures:    string[],
 *       interactionFeatures:   string[],
 *       domainFeatures:        string[],
 *       featureImportance:     Record<string, number>,
 *       featureCorrelations:   Record<string, Record<string, number>>,
 *     },
 *   }
 *
 * Every step is opt-in via config.<step>.enabled. With no config the agent
 * deep-clones the dataframe and computes the featureCorrelations matrix.
 */
describe('FeatureEngineerAgent', () => {
  let agent: FeatureEngineerAgent;

  beforeEach(() => {
    agent = new FeatureEngineerAgent();
  });

  it('exposes correct metadata', () => {
    expect(agent.metadata.id).toBe('feature_engineer');
    expect(agent.metadata.stage).toBe('engineer');
    expect(agent.metadata.stageNumber).toBe(1);
    expect(agent.metadata.tier).toBe('advanced');
  });

  it('passes data through unchanged when no transformations are enabled', async () => {
    const result = await agent.execute(buildContextWithSchema(sampleSchema, { dataframe: sampleDataframe }));
    expect(result.status).toBe('success');
    const output = result.output as {
      featureEngineeredDataframe: Record<string, unknown>[];
      featureEngineeringReport: {
        featuresAdded: string[];
        polynomialFeatures: string[];
        interactionFeatures: string[];
        domainFeatures: string[];
        featureImportance: Record<string, number>;
        featureCorrelations: Record<string, Record<string, number>>;
      };
    };
    expect(output.featureEngineeredDataframe.length).toBe(5);
    expect(output.featureEngineeringReport.featuresAdded).toEqual([]);
    expect(output.featureEngineeringReport.polynomialFeatures).toEqual([]);
    expect(output.featureEngineeringReport.interactionFeatures).toEqual([]);
    expect(output.featureEngineeringReport.domainFeatures).toEqual([]);
    // Correlation matrix computed for every numeric column
    expect(Object.keys(output.featureEngineeringReport.featureCorrelations).length).toBeGreaterThan(0);
  });

  it('reports totalFeatures metric', async () => {
    const result = await agent.execute(buildContextWithSchema(sampleSchema, { dataframe: sampleDataframe }));
    expect(result.metrics.totalFeatures).toBe(6);
    expect(result.metrics.featuresAdded).toBe(0);
    expect(result.metrics.polynomialFeatures).toBe(0);
    expect(result.metrics.interactionFeatures).toBe(0);
    expect(result.metrics.domainFeatures).toBe(0);
  });

  it('creates polynomial features when polynomial.enabled=true', async () => {
    const result = await agent.execute(
      buildContextWithSchema(sampleSchema, {
        dataframe: sampleDataframe,
        config: {
          polynomial: { enabled: true, degree: 2, columns: ['age', 'score'] },
          advanced: { prefix: 'poly' },
        },
      }),
    );
    expect(result.status).toBe('success');
    const output = result.output as {
      featureEngineeredDataframe: Record<string, unknown>[];
      featureEngineeringReport: { polynomialFeatures: string[]; featuresAdded: string[] };
    };
    expect(output.featureEngineeringReport.polynomialFeatures.length).toBeGreaterThan(0);
    expect(output.featureEngineeringReport.featuresAdded.length).toBeGreaterThan(0);
    // The new columns actually appear on the dataframe
    const firstPolyCol = output.featureEngineeringReport.polynomialFeatures[0];
    expect(output.featureEngineeredDataframe[0]).toHaveProperty(firstPolyCol);
  });

  it('creates interaction features when interactions.enabled=true', async () => {
    const result = await agent.execute(
      buildContextWithSchema(sampleSchema, {
        dataframe: sampleDataframe,
        config: {
          interactions: { enabled: true, columns: ['age', 'score'], includeSelf: false, maxDegree: 2 },
          advanced: { prefix: 'inter' },
        },
      }),
    );
    expect(result.status).toBe('success');
    const output = result.output as {
      featureEngineeredDataframe: Record<string, unknown>[];
      featureEngineeringReport: { interactionFeatures: string[]; featuresAdded: string[] };
    };
    expect(output.featureEngineeringReport.interactionFeatures.length).toBeGreaterThan(0);
    const firstInterCol = output.featureEngineeringReport.interactionFeatures[0];
    expect(output.featureEngineeredDataframe[0]).toHaveProperty(firstInterCol);
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
    const output = result.output as { featureEngineeredDataframe: Record<string, unknown>[] };
    expect(output.featureEngineeredDataframe.length).toBe(1);
  });

  it('computes feature correlations for numeric columns', async () => {
    const result = await agent.execute(buildContextWithSchema(sampleSchema, { dataframe: sampleDataframe }));
    const output = result.output as {
      featureEngineeringReport: { featureCorrelations: Record<string, Record<string, number>> };
    };
    const fc = output.featureEngineeringReport.featureCorrelations;
    expect(fc.id).toBeDefined();
    expect(fc.id.id).toBeCloseTo(1, 5);
    // Symmetric
    expect(fc.age.score).toBeCloseTo(fc.score.age, 5);
  });
});
