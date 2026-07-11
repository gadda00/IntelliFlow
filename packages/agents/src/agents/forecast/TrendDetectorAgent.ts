/**
 * Trend Detector Agent
 * ====================
 *
 * Stage 3 - Forecast
 *
 * Detects trends in time-series data using the Mann-Kendall non-parametric test
 * and Sen's slope estimator. Determines whether a series has a monotonic
 * upward or downward trend and quantifies its magnitude.
 */

import { z } from 'zod';
import { AgentStage, AgentTier, AgentStability } from '@busara/core';
import {
  BaseAgent, EnhancedAgentMetadata, EnhancedAgentContext,
  AgentResult, createAgentMetadata,
} from '../../core';
import { mean, median } from '../../math';

// ─── Metadata ────────────────────────────────────────────────────────
const metadata = createAgentMetadata({
  id: 'trend_detector',
  name: 'Trend Detector',
  description: 'Detects monotonic trends in time-series data using the Mann-Kendall test and Sen\'s slope estimator.',
  version: '1.0.0',
  stage: 'forecast' as AgentStage,
  stageNumber: 3,
  tier: 'core' as AgentTier,
  stability: 'stable' as AgentStability,
  author: 'Busara Team',
  license: 'MIT',
  dependencies: ['data_engineer', 'feature_engineer'],
  timeoutMs: 30000,
  maxRetries: 2,
  capabilities: ['trend_detection', 'mann_kendall', 'sens_slope'],
  category: 'forecasting',
  tags: ['trend', 'mann-kendall', 'sen-slope', 'time-series'],
  inputDescription: 'Engineered dataframe with at least one numeric column',
  outputDescription: 'Trend analysis with Mann-Kendall statistic, Sen\'s slope, and significance',
  inputSchema: {
    schema: z.object({
      dataframe: z.array(z.record(z.string(), z.unknown())),
      targetColumn: z.string().optional(),
    }),
    description: 'Dataframe and optional target column',
  },
  outputSchema: {
    schema: z.object({
      trends: z.array(z.object({
        column: z.string(),
        mannKendallS: z.number(),
        mannKendallP: z.number(),
        sensSlope: z.number(),
        trendDirection: z.enum(['increasing', 'decreasing', 'no_trend']),
        significance: z.boolean(),
        confidence: z.number(),
      })),
      summary: z.object({
        totalColumns: z.number(),
        columnsWithTrend: z.number(),
        increasingTrends: z.number(),
        decreasingTrends: z.number(),
      }),
    }),
    description: 'Trend analysis results',
  },
  configSchema: {
    schema: z.object({
      significanceLevel: z.number().min(0).max(1).default(0.05),
      columns: z.array(z.string()).optional(),
    }),
    defaults: { significanceLevel: 0.05 },
  },
});

// ─── Agent ───────────────────────────────────────────────────────────
export class TrendDetectorAgent extends BaseAgent {
  readonly metadata = metadata;

  async execute(context: EnhancedAgentContext): Promise<AgentResult> {
    const { dataframe, targetColumn } = context.inputs as {
      dataframe: Record<string, unknown>[];
      targetColumn?: string;
    };
    const config = { ...metadata.configSchema.defaults, ...(context.config || {}) };
    const sigLevel = config.significanceLevel ?? 0.05;

    // Determine which numeric columns to analyze
    const numericCols = this.getNumericColumns(dataframe);
    const colsToAnalyze = config.columns
      ? numericCols.filter(c => config.columns!.includes(c))
      : targetColumn
        ? numericCols.includes(targetColumn) ? [targetColumn] : numericCols
        : numericCols;

    const trends = colsToAnalyze.map(col => {
      const values = dataframe
        .map(row => Number(row[col]))
        .filter(v => !isNaN(v) && isFinite(v));

      const result = this.mannKendallTest(values);
      return {
        column: col,
        mannKendallS: result.S,
        mannKendallP: result.pValue,
        sensSlope: this.sensSlope(values),
        trendDirection: result.trendDirection,
        significance: result.pValue < sigLevel,
        confidence: 1 - result.pValue,
      };
    });

    const summary = {
      totalColumns: colsToAnalyze.length,
      columnsWithTrend: trends.filter(t => t.significance).length,
      increasingTrends: trends.filter(t => t.trendDirection === 'increasing' && t.significance).length,
      decreasingTrends: trends.filter(t => t.trendDirection === 'decreasing' && t.significance).length,
    };

    return this.createResult({ trends, summary }, { inputRows: dataframe.length, outputRows: trends.length });
  }

  // ─── Mann-Kendall non-parametric trend test ──────────────────────
  private mannKendallTest(values: number[]): {
    S: number; pValue: number; trendDirection: 'increasing' | 'decreasing' | 'no_trend';
  } {
    const n = values.length;
    if (n < 3) return { S: 0, pValue: 1, trendDirection: 'no_trend' };

    // Calculate S statistic
    let S = 0;
    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        if (values[j] > values[i]) S++;
        else if (values[j] < values[i]) S--;
      }
    }

    // Calculate variance (accounting for ties)
    const uniqueVals = [...new Set(values)];
    let tieCorrection = 0;
    for (const val of uniqueVals) {
      const ti = values.filter(v => v === val).length;
      if (ti > 1) tieCorrection += ti * (ti - 1) * (2 * ti + 5);
    }
    const varS = (n * (n - 1) * (2 * n + 5) - tieCorrection) / 18;

    // Calculate Z statistic and two-tailed p-value
    let Z: number;
    if (S > 0) Z = (S - 1) / Math.sqrt(varS);
    else if (S < 0) Z = (S + 1) / Math.sqrt(varS);
    else Z = 0;

    // Two-tailed p-value from standard normal
    const pValue = 2 * (1 - this.normalCDF(Math.abs(Z)));

    let trendDirection: 'increasing' | 'decreasing' | 'no_trend';
    if (pValue < 0.05) {
      trendDirection = S > 0 ? 'increasing' : 'decreasing';
    } else {
      trendDirection = 'no_trend';
    }

    return { S, pValue, trendDirection };
  }

  // ─── Sen's slope estimator ───────────────────────────────────────
  private sensSlope(values: number[]): number {
    const n = values.length;
    if (n < 2) return 0;

    const slopes: number[] = [];
    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        slopes.push((values[j] - values[i]) / (j - i));
      }
    }
    slopes.sort((a, b) => a - b);
    return median(slopes);
  }

  // ─── Standard normal CDF ─────────────────────────────────────────
  private normalCDF(z: number): number {
    // Abramowitz & Stegun approximation (7.1.26)
    const t = 1 / (1 + 0.2316419 * z);
    const d = 0.3989423 * Math.exp(-z * z / 2);
    return d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  }

  // ─── Helper: get numeric columns ─────────────────────────────────
  private getNumericColumns(dataframe: Record<string, unknown>[]): string[] {
    if (dataframe.length === 0) return [];
    const sample = dataframe[0];
    return Object.keys(sample).filter(key => {
      const val = sample[key];
      return typeof val === 'number' || (!isNaN(Number(val)) && val !== null && val !== '');
    });
  }
}

export default TrendDetectorAgent;
