import { describe, it, expect, beforeEach } from 'vitest';
import { AnalysisStrategistAgent } from '../agents/detect/AnalysisStrategistAgent';
import { buildContextWithSchema, sampleDataframe, sampleSchema } from './testUtils';

/**
 * AnalysisStrategistAgent reads a previously-computed schema (from the
 * schema_inference agent's previousResult) and emits:
 *
 *   {
 *     analysisPlan: {
 *       dataOverview:       { rowCount, columnCount, memorySize, dataTypes,
 *                             completeness, nullCount, cleanedRowCount, rowsRemoved },
 *       featureAnalysis:    [{ column, type, importance, recommendations, ... }],
 *       recommendedMethods: [{ method, category, priority, reason, expectedImpact }],
 *       hypotheses:         [{ id, statement, type, confidence, testMethod, variables }],
 *       executionPlan:      [{ stage, agents, priority, estimatedTime }],
 *     },
 *     dataQualityScore:    number (0-100),
 *     analysisComplexity:  'low' | 'medium' | 'high',
 *   }
 *
 * NOTE: the schema passed in via previousResults is whatever the upstream
 * schema_inference agent produced. Tests pass an explicit schema so the agent's
 * downstream behaviour is deterministic regardless of the (quirky) inference.
 */
describe('AnalysisStrategistAgent', () => {
  let agent: AnalysisStrategistAgent;

  beforeEach(() => {
    agent = new AnalysisStrategistAgent();
  });

  it('exposes correct metadata', () => {
    expect(agent.metadata.id).toBe('analysis_strategist');
    expect(agent.metadata.stage).toBe('detect');
    expect(agent.metadata.stageNumber).toBe(2);
    expect(agent.metadata.tier).toBe('core');
  });

  it('produces an analysis plan with overview, methods, hypotheses, and execution plan', async () => {
    const result = await agent.execute(buildContextWithSchema(sampleSchema, { dataframe: sampleDataframe }));
    expect(result.status).toBe('success');

    const output = result.output as {
      analysisPlan: {
        dataOverview: { rowCount: number; columnCount: number; completeness: number; dataTypes: Record<string, number> };
        featureAnalysis: Array<{ column: string; type: string; importance: number; recommendations: string[] }>;
        recommendedMethods: Array<{ method: string; category: string; priority: number; reason: string; expectedImpact: string }>;
        hypotheses: Array<{ id: string; statement: string; type: string; confidence: number; testMethod: string; variables: string[] }>;
        executionPlan: Array<{ stage: number; agents: string[]; priority: number; estimatedTime: number }>;
      };
      dataQualityScore: number;
      analysisComplexity: 'low' | 'medium' | 'high';
    };

    expect(output.analysisPlan).toBeDefined();
    expect(output.analysisPlan.dataOverview.rowCount).toBe(5);
    expect(output.analysisPlan.dataOverview.columnCount).toBe(6);
    expect(output.analysisPlan.dataOverview.completeness).toBe(1);
    // sampleSchema has 2 integer, 1 float, 1 string, 1 boolean, 1 datetime
    expect(output.analysisPlan.dataOverview.dataTypes.integer).toBe(2);
    expect(output.analysisPlan.dataOverview.dataTypes.float).toBe(1);
    expect(output.analysisPlan.dataOverview.dataTypes.boolean).toBe(1);
    expect(output.analysisPlan.dataOverview.dataTypes.string).toBe(1);
    expect(output.analysisPlan.dataOverview.dataTypes.datetime).toBe(1);

    // feature analysis covers every column
    expect(output.analysisPlan.featureAnalysis.length).toBe(6);
    // importance is sorted descending
    const importances = output.analysisPlan.featureAnalysis.map(f => f.importance);
    const sorted = [...importances].sort((a, b) => b - a);
    expect(importances).toEqual(sorted);

    // recommended methods should always include descriptive_statistics and visualization
    const methods = output.analysisPlan.recommendedMethods.map(m => m.method);
    expect(methods).toContain('descriptive_statistics');
    expect(methods).toContain('data_visualization');

    // execution plan should start at stage 0
    expect(output.analysisPlan.executionPlan[0].stage).toBe(0);
    expect(output.analysisPlan.executionPlan[0].agents).toContain('data_ingestion');

    expect(output.dataQualityScore).toBeGreaterThanOrEqual(0);
    expect(output.dataQualityScore).toBeLessThanOrEqual(100);
    expect(['low', 'medium', 'high']).toContain(output.analysisComplexity);
  });

  it('reports rowCount/columnCount/hypothesesGenerated/methodsRecommended metrics', async () => {
    const result = await agent.execute(buildContextWithSchema(sampleSchema, { dataframe: sampleDataframe }));
    expect(result.metrics.rowCount).toBe(5);
    expect(result.metrics.columnCount).toBe(6);
    expect(result.metrics.hypothesesGenerated).toBe(result.output!.analysisPlan.hypotheses.length);
    expect(result.metrics.methodsRecommended).toBe(result.output!.analysisPlan.recommendedMethods.length);
    expect(['low', 'medium', 'high']).toContain(result.metrics.analysisComplexity);
  });

  it('skips hypothesis generation when generateHypotheses=false', async () => {
    const result = await agent.execute(
      buildContextWithSchema(sampleSchema, {
        dataframe: sampleDataframe,
        config: { generateHypotheses: false },
      }),
    );
    expect(result.status).toBe('success');
    const output = result.output as { analysisPlan: { hypotheses: unknown[] } };
    expect(output.analysisPlan.hypotheses).toEqual([]);
    expect(result.metrics.hypothesesGenerated).toBe(0);
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
    const output = result.output as { analysisPlan: { dataOverview: { rowCount: number; columnCount: number } }; analysisComplexity: string };
    expect(output.analysisPlan.dataOverview.rowCount).toBe(1);
    expect(output.analysisPlan.dataOverview.columnCount).toBe(1);
    expect(['low', 'medium', 'high']).toContain(output.analysisComplexity);
  });

  it('recommends correlation_analysis when there are >= 3 numeric features', async () => {
    const result = await agent.execute(buildContextWithSchema(sampleSchema, { dataframe: sampleDataframe }));
    const output = result.output as { analysisPlan: { recommendedMethods: Array<{ method: string }> } };
    const methods = output.analysisPlan.recommendedMethods.map(m => m.method);
    // sampleSchema has id, age, score (3 numeric) → correlation_analysis
    expect(methods).toContain('correlation_analysis');
  });
});
