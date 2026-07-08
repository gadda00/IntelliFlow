import { describe, it, expect, beforeEach } from 'vitest';
import { ForecastingOracleAgent } from '../agents/detect/ForecastingOracleAgent';
import { buildContextWithSchema } from './testUtils';

// Build a small time series
const tsDataframe = Array.from({ length: 20 }, (_, i) => ({
  date: new Date(2023, 0, i + 1).toISOString().slice(0, 10),
  value: 10 + i + Math.sin(i / 2) * 3,
}));

const tsSchema = {
  date: { type: 'datetime', confidence: 1, nullCount: 0, uniqueCount: 20 },
  value: { type: 'float', confidence: 1, nullCount: 0, uniqueCount: 20 },
};

describe('ForecastingOracleAgent', () => {
  let agent: ForecastingOracleAgent;

  beforeEach(() => {
    agent = new ForecastingOracleAgent();
  });

  it('exposes correct metadata', () => {
    expect(agent.metadata.id).toBe('forecasting_oracle');
    expect(agent.metadata.stage).toBe('detect');
  });

  it('generates a forecast for time series data', async () => {
    const result = await agent.execute(buildContextWithSchema(tsSchema, { dataframe: tsDataframe }));
    expect(result.status).toBe('success');
    const output = result.output as {
      forecasts: unknown[];
      summary: { forecastHorizon: number; datetimeColumns: string[]; targetColumns: string[] };
    };
    expect(Array.isArray(output.forecasts)).toBe(true);
    expect(output.summary.forecastHorizon).toBe(10);
    expect(output.summary.datetimeColumns).toContain('date');
    expect(output.summary.targetColumns).toContain('value');
  });

  it('respects forecastHorizon config', async () => {
    const result = await agent.execute(
      buildContextWithSchema(tsSchema, {
        dataframe: tsDataframe,
        config: { forecastHorizon: 5 },
      }),
    );
    const output = result.output as { forecasts: unknown[]; summary: { forecastHorizon: number } };
    expect(output.summary.forecastHorizon).toBe(5);
    expect(output.forecasts.length).toBe(5);
  });

  it('returns error for empty dataframe', async () => {
    const result = await agent.execute(buildContextWithSchema({}, { dataframe: [] }));
    expect(result.status).toBe('failed');
    expect(result.error).toMatch(/no data/i);
  });

  it('returns error when no datetime column is available', async () => {
    const result = await agent.execute(
      buildContextWithSchema(
        { value: { type: 'float', confidence: 1, nullCount: 0, uniqueCount: 20 } },
        { dataframe: [{ value: 1 }, { value: 2 }] },
      ),
    );
    expect(result.status).toBe('failed');
    expect(result.error).toMatch(/datetime/i);
  });

  it('returns error when no numeric column is available', async () => {
    const result = await agent.execute(
      buildContextWithSchema(
        { date: { type: 'datetime', confidence: 1, nullCount: 0, uniqueCount: 2 } },
        { dataframe: [{ date: '2023-01-01' }, { date: '2023-01-02' }] },
      ),
    );
    expect(result.status).toBe('failed');
    expect(result.error).toMatch(/numeric/i);
  });

  it('returns error for null input', async () => {
    const result = await agent.execute(buildContextWithSchema({}, { dataframe: null as unknown as Record<string, unknown>[] }));
    expect(result.status).toBe('failed');
  });

  it('can analyze trend when configured', async () => {
    const result = await agent.execute(
      buildContextWithSchema(tsSchema, {
        dataframe: tsDataframe,
        config: { trendAnalysis: { enabled: true } },
      }),
    );
    const output = result.output as { trendAnalysis: { hasTrend: boolean; trendStrength: number } };
    expect(output.trendAnalysis).toBeDefined();
    expect(typeof output.trendAnalysis.hasTrend).toBe('boolean');
  });

  it('reports metrics in result', async () => {
    const result = await agent.execute(buildContextWithSchema(tsSchema, { dataframe: tsDataframe }));
    expect(result.metrics.dataPoints).toBe(20);
    expect(result.metrics.forecastHorizon).toBe(10);
  });
});
