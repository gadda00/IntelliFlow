/**
 * Time Series Decomposition Agent
 * ===============================
 *
 * Stage 3 - Forecast
 *
 * Decomposes time-series into trend, seasonal, and residual components
 * using STL-like (Seasonal-Trend decomposition using Loess) approach.
 * Implements classical additive and multiplicative decomposition.
 */

import { z } from 'zod';
import { AgentStage, AgentTier, AgentStability } from '@busara/core';
import {
  BaseAgent, EnhancedAgentMetadata, EnhancedAgentContext,
  AgentResult, createAgentMetadata,
} from '../../core';
import { mean, median, stdev } from '../../math';

const metadata = createAgentMetadata({
  id: 'time_series_decomposition',
  name: 'Time Series Decomposition',
  description: 'Decomposes time-series into trend, seasonal, and residual components using additive or multiplicative STL-like decomposition.',
  version: '1.0.0',
  stage: 'forecast' as AgentStage,
  stageNumber: 3,
  tier: 'core' as AgentTier,
  stability: 'stable' as AgentStability,
  author: 'Busara Team',
  license: 'MIT',
  dependencies: ['trend_detector', 'seasonality_detector'],
  timeoutMs: 45000,
  maxRetries: 2,
  capabilities: ['time_series_decomposition', 'stl', 'trend_extraction', 'seasonal_extraction'],
  category: 'forecasting',
  tags: ['decomposition', 'stl', 'trend', 'seasonal', 'residual', 'time-series'],
  inputDescription: 'Engineered dataframe with a target column and optional period',
  outputDescription: 'Decomposed components (trend, seasonal, residual) with reconstruction metrics',
  inputSchema: {
    schema: z.object({
      dataframe: z.array(z.record(z.string(), z.unknown())),
      targetColumn: z.string(),
      period: z.number().int().positive().optional(),
    }),
    description: 'Dataframe, target column, and optional seasonal period',
  },
  outputSchema: {
    schema: z.object({
      decomposition: z.object({
        column: z.string(),
        model: z.enum(['additive', 'multiplicative']),
        period: z.number(),
        trend: z.array(z.number()),
        seasonal: z.array(z.number()),
        residual: z.array(z.number()),
        original: z.array(z.number()),
        reconstructed: z.array(z.number()),
      }),
      metrics: z.object({
        rmse: z.number(),
        mae: z.number(),
        rSquared: z.number(),
        trendStrength: z.number(),
        seasonalStrength: z.number(),
        residualStrength: z.number(),
      }),
    }),
    description: 'Decomposition results with quality metrics',
  },
  configSchema: {
    schema: z.object({
      model: z.enum(['additive', 'multiplicative', 'auto']).default('auto'),
      period: z.number().int().positive().optional(),
      smoothingWindow: z.number().int().positive().default(7),
    }),
    defaults: { model: 'auto', smoothingWindow: 7 },
  },
});

export class TimeSeriesDecompositionAgent extends BaseAgent {
  readonly metadata = metadata;

  async execute(context: EnhancedAgentContext): Promise<AgentResult> {
    const { dataframe, targetColumn, period: inputPeriod } = context.inputs as {
      dataframe: Record<string, unknown>[];
      targetColumn: string;
      period?: number;
    };
    const config = { ...metadata.configSchema.defaults, ...(context.config || {}) };

    const values = dataframe
      .map(row => Number(row[targetColumn]))
      .filter(v => !isNaN(v) && isFinite(v));

    if (values.length < 4) {
      return this.createError(`Need at least 4 data points for decomposition, got ${values.length}`);
    }

    // Determine period (use input, config, or auto-detect)
    const period = inputPeriod || config.period || this.detectPeriod(values);

    // Determine model type (auto = check for multiplicative vs additive)
    const model = config.model === 'auto'
      ? this.detectModel(values)
      : config.model;

    // Decompose
    const decomposed = this.decompose(values, period, model, config.smoothingWindow);

    // Calculate quality metrics
    const metrics = this.calculateMetrics(values, decomposed);

        return this.createResult({
        decomposition: {
          column: targetColumn,
          model,
          period,
          trend: decomposed.trend,
          seasonal: decomposed.seasonal,
          residual: decomposed.residual,
          original: values,
          reconstructed: decomposed.reconstructed,
        },
        metrics,
      }, { rmse: metrics.rmse, mae: metrics.mae, rSquared: metrics.rSquared, inputRows: values.length, outputRows: decomposed.trend.length });
  }

  // ─── Decompose into trend, seasonal, residual ────────────────────
  private decompose(
    values: number[],
    period: number,
    model: 'additive' | 'multiplicative',
    smoothingWindow: number,
  ): {
    trend: number[]; seasonal: number[]; residual: number[]; reconstructed: number[];
  } {
    const n = values.length;
    const effectivePeriod = Math.min(period, Math.floor(n / 2));

    // Step 1: Extract trend using centered moving average
    const trend = this.centeredMovingAverage(values, effectivePeriod);

    // Step 2: Detrend
    let detrended: number[];
    if (model === 'multiplicative') {
      detrended = values.map((v, i) => trend[i] !== 0 ? v / trend[i] : 1);
    } else {
      detrended = values.map((v, i) => v - trend[i]);
    }

    // Step 3: Extract seasonal component (average by period position)
    const seasonalAverages: number[] = new Array(effectivePeriod).fill(0);
    const counts: number[] = new Array(effectivePeriod).fill(0);
    for (let i = 0; i < n; i++) {
      const idx = i % effectivePeriod;
      seasonalAverages[idx] += detrended[i];
      counts[idx]++;
    }
    for (let i = 0; i < effectivePeriod; i++) {
      seasonalAverages[i] = counts[i] > 0 ? seasonalAverages[i] / counts[i] : 0;
    }

    // Normalize seasonal component (sum to 0 for additive, sum to period for multiplicative)
    const seasonalSum = seasonalAverages.reduce((a, b) => a + b, 0);
    const seasonalMean = seasonalSum / effectivePeriod;
    if (model === 'multiplicative') {
      const factor = effectivePeriod / seasonalSum;
      for (let i = 0; i < effectivePeriod; i++) seasonalAverages[i] *= factor;
    } else {
      for (let i = 0; i < effectivePeriod; i++) seasonalAverages[i] -= seasonalMean;
    }

    // Tile seasonal component to full length
    const seasonal: number[] = new Array(n);
    for (let i = 0; i < n; i++) seasonal[i] = seasonalAverages[i % effectivePeriod];

    // Step 4: Calculate residual
    let residual: number[];
    let reconstructed: number[];
    if (model === 'multiplicative') {
      reconstructed = trend.map((t, i) => t * seasonal[i]);
      residual = values.map((v, i) => reconstructed[i] !== 0 ? v / reconstructed[i] : 1);
    } else {
      reconstructed = trend.map((t, i) => t + seasonal[i]);
      residual = values.map((v, i) => v - reconstructed[i]);
    }

    return { trend, seasonal, residual, reconstructed };
  }

  // ─── Centered moving average for trend extraction ────────────────
  private centeredMovingAverage(values: number[], period: number): number[] {
    const n = values.length;
    const trend: number[] = new Array(n).fill(0);
    const half = Math.floor(period / 2);

    for (let i = 0; i < n; i++) {
      let sum = 0;
      let count = 0;
      for (let j = Math.max(0, i - half); j <= Math.min(n - 1, i + half); j++) {
        sum += values[j];
        count++;
      }
      trend[i] = sum / count;
    }
    return trend;
  }

  // ─── Auto-detect seasonal period using autocorrelation ───────────
  private detectPeriod(values: number[]): number {
    const n = values.length;
    if (n < 6) return 3;

    const avg = mean(values);
    const variance = values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / n;
    if (variance === 0) return 3;

    const maxLag = Math.min(Math.floor(n / 2), 50);
    const acf: number[] = [];
    for (let lag = 0; lag <= maxLag; lag++) {
      let sum = 0;
      for (let i = 0; i < n - lag; i++) {
        sum += (values[i] - avg) * (values[i + lag] - avg);
      }
      acf.push(sum / (variance * n));
    }

    // Find first major peak after lag 1
    for (let i = 2; i < acf.length - 1; i++) {
      if (acf[i] > acf[i - 1] && acf[i] > acf[i + 1] && acf[i] > 0.3) {
        return i;
      }
    }
    return 7; // Default weekly period
  }

  // ─── Auto-detect additive vs multiplicative model ────────────────
  private detectModel(values: number[]): 'additive' | 'multiplicative' {
    // If all values are positive and variance increases with level, use multiplicative
    const allPositive = values.every(v => v > 0);
    if (!allPositive) return 'additive';

    const n = values.length;
    const firstHalf = values.slice(0, Math.floor(n / 2));
    const secondHalf = values.slice(Math.floor(n / 2));

    const mean1 = mean(firstHalf);
    const mean2 = mean(secondHalf);
    const stdev1 = stdev(firstHalf);
    const stdev2 = stdev(secondHalf);

    // If variance scales with mean, multiplicative
    const cv1 = mean1 !== 0 ? stdev1 / Math.abs(mean1) : 0;
    const cv2 = mean2 !== 0 ? stdev2 / Math.abs(mean2) : 0;

    // If coefficient of variation is similar across halves, multiplicative
    return Math.abs(cv1 - cv2) / Math.max(cv1, cv2) < 0.2 ? 'multiplicative' : 'additive';
  }

  // ─── Calculate decomposition quality metrics ─────────────────────
  private calculateMetrics(original: number[], decomposed: {
    reconstructed: number[]; trend: number[]; seasonal: number[]; residual: number[];
  }): {
    rmse: number; mae: number; rSquared: number;
    trendStrength: number; seasonalStrength: number; residualStrength: number;
  } {
    const n = original.length;
    const errors = original.map((v, i) => v - decomposed.reconstructed[i]);

    const rmse = Math.sqrt(errors.reduce((sum, e) => sum + e * e, 0) / n);
    const mae = errors.reduce((sum, e) => sum + Math.abs(e), 0) / n;

    const originalMean = mean(original);
    const ssTot = original.reduce((sum, v) => sum + (v - originalMean) ** 2, 0);
    const ssRes = errors.reduce((sum, e) => sum + e * e, 0);
    const rSquared = ssTot > 0 ? 1 - (ssRes / ssTot) : 0;

    // Strength metrics (0-1, higher = stronger component)
    const trendVar = decomposed.trend.length > 0 ? this.variance(decomposed.trend) : 0;
    const seasonalVar = decomposed.seasonal.length > 0 ? this.variance(decomposed.seasonal) : 0;
    const residualVar = decomposed.residual.length > 0 ? this.variance(decomposed.residual) : 0;
    const totalVar = trendVar + seasonalVar + residualVar;

    return {
      rmse,
      mae,
      rSquared: Math.max(0, Math.min(1, rSquared)),
      trendStrength: totalVar > 0 ? trendVar / totalVar : 0,
      seasonalStrength: totalVar > 0 ? seasonalVar / totalVar : 0,
      residualStrength: totalVar > 0 ? residualVar / totalVar : 0,
    };
  }

  private variance(values: number[]): number {
    const avg = mean(values);
    return values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / values.length;
  }
}

export default TimeSeriesDecompositionAgent;
