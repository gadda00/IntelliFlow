import { describe, it, expect, beforeEach } from 'vitest';
import { AnomalySentinelAgent } from '../agents/detect/AnomalySentinelAgent';
import { buildContextWithSchema, sampleDataframe, sampleSchema } from './testUtils';

/**
 * AnomalySentinelAgent runs a 3-method ensemble (Z-score, IQR, EWMA) over the
 * numeric columns of the dataframe. Output shape:
 *
 *   {
 *     anomalies: Array<{
 *       rowIndex, column, value,
 *       methods: Record<string, { score, threshold, isAnomaly, explanation }>,
 *       ensembleScore, isAnomaly, confidence, severity,
 *     }>,
 *     summary: {
 *       totalAnomalies, anomaliesByColumn, anomaliesByMethod,
 *       anomaliesBySeverity: { low, medium, high, critical },
 *       anomalyRate, mostAnomalousColumns, mostAnomalousRows,
 *     },
 *     thresholds:  { zscore, iqr, ewma, ensemble },
 *     statistics:  { mean, median, stdev, min, max, q1, q3, iqr, byColumn },
 *   }
 *
 * IMPORTANT agent quirks:
 *   1. The column filter is `(columns?.length === 0 || columns.includes(col))`
 *      — if `config.columns` is undefined this throws (TypeError on
 *      `undefined.includes`). Tests pass `columns: []` to opt into
 *      "use every numeric column" semantics.
 *   2. The three detection methods are gated on `methodsConfig.<method>.enabled`.
 *      The configSchema's defaults are NOT auto-applied at runtime, so when
 *      `config.methods` is undefined, NO methods run and every entry's
 *      `methods` map is empty. Tests that need actual detection must enable
 *      methods explicitly.
 */
const ENABLE_ALL_METHODS = {
  zscore: { enabled: true, threshold: 3, twoTailed: true },
  iqr: { enabled: true, multiplier: 1.5 },
  ewma: { enabled: true, lambda: 0.3, threshold: 3, windowSize: 10 },
};

describe('AnomalySentinelAgent', () => {
  let agent: AnomalySentinelAgent;

  beforeEach(() => {
    agent = new AnomalySentinelAgent();
  });

  it('exposes correct metadata', () => {
    expect(agent.metadata.id).toBe('anomaly_sentinel');
    expect(agent.metadata.stage).toBe('detect');
    expect(agent.metadata.stageNumber).toBe(2);
    expect(agent.metadata.tier).toBe('core');
  });

  it('emits one anomaly entry per (row, numeric column) pair', async () => {
    const result = await agent.execute(
      buildContextWithSchema(sampleSchema, {
        dataframe: sampleDataframe,
        config: { columns: [], methods: ENABLE_ALL_METHODS },
      }),
    );
    expect(result.status).toBe('success');

    const output = result.output as {
      anomalies: Array<{ rowIndex: number; column: string; value: number; methods: Record<string, unknown>; ensembleScore: number; isAnomaly: boolean; confidence: number; severity: string }>;
      summary: { totalAnomalies: number; anomalyRate: number; anomaliesBySeverity: { low: number; medium: number; high: number; critical: number } };
      thresholds: { zscore: number; iqr: number; ewma: number; ensemble: number };
      statistics: Record<string, unknown>;
    };

    // sampleSchema has 3 numeric columns (id, age, score), 5 rows → 15 entries
    expect(output.anomalies.length).toBe(15);
    expect(output.thresholds.zscore).toBe(3);
    expect(output.thresholds.iqr).toBe(1.5);
    expect(output.thresholds.ewma).toBe(3);
    expect(output.thresholds.ensemble).toBeCloseTo(0.67, 2);
    expect(output.summary.anomaliesBySeverity).toBeDefined();
    expect(['low', 'medium', 'high', 'critical']).toContain(output.anomalies[0].severity);
  });

  it('detects an obvious outlier when methods are enabled', async () => {
    // 20 "normal" values clustered around 10, then an extreme outlier.
    // Use ensemble.method='any' so a single method flagging the value is enough.
    const df = Array.from({ length: 20 }, (_, i) => ({ x: 10 + (i % 3) }));
    df.push({ x: 10000 }); // extreme outlier at index 20
    const schema = { x: { type: 'integer', confidence: 1, nullCount: 0, uniqueCount: 4 } };
    const result = await agent.execute(
      buildContextWithSchema(schema, {
        dataframe: df,
        config: { columns: [], methods: ENABLE_ALL_METHODS, ensemble: { method: 'any' } },
      }),
    );
    expect(result.status).toBe('success');
    const output = result.output as { anomalies: Array<{ rowIndex: number; isAnomaly: boolean; column: string }>; summary: { totalAnomalies: number } };
    const outliers = output.anomalies.filter(a => a.isAnomaly);
    expect(outliers.length).toBeGreaterThan(0);
    expect(outliers.some(a => a.rowIndex === 20)).toBe(true);
    expect(output.summary.totalAnomalies).toBe(outliers.length);
  });

  it('reports columnsAnalyzed metric only for numeric columns', async () => {
    const result = await agent.execute(
      buildContextWithSchema(sampleSchema, {
        dataframe: sampleDataframe,
        config: { columns: [], methods: ENABLE_ALL_METHODS },
      }),
    );
    // sampleSchema has 3 numeric columns: id, age, score
    expect(result.metrics.columnsAnalyzed).toBe(3);
    expect(result.metrics.totalAnomalies).toBeDefined();
    expect(typeof result.metrics.anomalyRate).toBe('number');
  });

  it('returns error when no numeric columns are present', async () => {
    const result = await agent.execute(
      buildContextWithSchema(
        { name: { type: 'string', confidence: 1, nullCount: 0, uniqueCount: 2 } },
        { dataframe: [{ name: 'a' }, { name: 'b' }], config: { columns: [], methods: ENABLE_ALL_METHODS } },
      ),
    );
    expect(result.status).toBe('failed');
    expect(result.error).toMatch(/no numeric columns/i);
  });

  it('returns error for empty dataframe', async () => {
    const result = await agent.execute(buildContextWithSchema({}, { dataframe: [], config: { columns: [], methods: ENABLE_ALL_METHODS } }));
    expect(result.status).toBe('failed');
    expect(result.error).toMatch(/no data/i);
  });

  it('returns error for null input', async () => {
    const result = await agent.execute(
      buildContextWithSchema({}, { dataframe: null as unknown as Record<string, unknown>[], config: { columns: [], methods: ENABLE_ALL_METHODS } }),
    );
    expect(result.status).toBe('failed');
  });

  it('respects sensitivity config (higher sensitivity finds at least as many anomalies)', async () => {
    const df = Array.from({ length: 20 }, (_, i) => ({ x: 10 + (i % 3) }));
    df.push({ x: 50 });
    const schema = { x: { type: 'integer', confidence: 1, nullCount: 0, uniqueCount: 5 } };

    const lowResult = await agent.execute(
      buildContextWithSchema(schema, { dataframe: df, config: { columns: [], methods: ENABLE_ALL_METHODS, sensitivity: 'low' } }),
    );
    const highResult = await agent.execute(
      buildContextWithSchema(schema, { dataframe: df, config: { columns: [], methods: ENABLE_ALL_METHODS, sensitivity: 'high' } }),
    );
    const lowOut = lowResult.output as { summary: { totalAnomalies: number } };
    const highOut = highResult.output as { summary: { totalAnomalies: number } };
    expect(lowResult.status).toBe('success');
    expect(highResult.status).toBe('success');
    expect(highOut.summary.totalAnomalies).toBeGreaterThanOrEqual(lowOut.summary.totalAnomalies);
  });

  it('handles single row without throwing', async () => {
    const result = await agent.execute(
      buildContextWithSchema(
        { x: { type: 'integer', confidence: 1, nullCount: 0, uniqueCount: 1 } },
        { dataframe: [{ x: 42 }], config: { columns: [], methods: ENABLE_ALL_METHODS } },
      ),
    );
    expect(result.status).toBe('success');
    const output = result.output as { anomalies: unknown[]; summary: { anomalyRate: number } };
    expect(output.anomalies.length).toBe(1);
    expect(output.summary.anomalyRate).toBeGreaterThanOrEqual(0);
  });
});
