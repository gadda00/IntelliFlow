/**
 * Seasonality Detector Agent
 * ==========================
 *
 * Stage 3 - Forecast
 *
 * Detects seasonal patterns in time-series data using autocorrelation (ACF)
 * analysis and the Cooley-Tukey FFT. Identifies dominant seasonal periods
 * and their strength.
 */

import { z } from 'zod';
import { AgentStage, AgentTier, AgentStability } from '@busara/core';
import {
  BaseAgent, EnhancedAgentMetadata, EnhancedAgentContext,
  AgentResult, createAgentMetadata,
} from '../../core';
import { mean } from '../../math';

const metadata = createAgentMetadata({
  id: 'seasonality_detector',
  name: 'Seasonality Detector',
  description: 'Detects seasonal patterns using autocorrelation (ACF) and FFT analysis to identify dominant seasonal periods.',
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
  capabilities: ['seasonality_detection', 'autocorrelation', 'fft', 'spectral_analysis'],
  category: 'forecasting',
  tags: ['seasonality', 'acf', 'fft', 'periodicity', 'time-series'],
  inputDescription: 'Engineered dataframe with at least one numeric column',
  outputDescription: 'Seasonality analysis with detected periods, ACF peaks, and spectral density',
  inputSchema: {
    schema: z.object({
      dataframe: z.array(z.record(z.string(), z.unknown())),
      targetColumn: z.string().optional(),
    }),
    description: 'Dataframe and optional target column',
  },
  outputSchema: {
    schema: z.object({
      seasonalities: z.array(z.object({
        column: z.string(),
        detectedPeriods: z.array(z.object({
          period: z.number(),
          strength: z.number(),
          confidence: z.number(),
        })),
        dominantPeriod: z.number().nullable(),
        seasonalityStrength: z.number(),
        isSeasonal: z.boolean(),
      })),
      summary: z.object({
        totalColumns: z.number(),
        seasonalColumns: z.number(),
        averageStrength: z.number(),
      }),
    }),
    description: 'Seasonality analysis results',
  },
  configSchema: {
    schema: z.object({
      maxLag: z.number().int().min(2).max(100).default(40),
      minStrength: z.number().min(0).max(1).default(0.3),
      columns: z.array(z.string()).optional(),
    }),
    defaults: { maxLag: 40, minStrength: 0.3 },
  },
});

export class SeasonalityDetectorAgent extends BaseAgent {
  readonly metadata = metadata;

  async execute(context: EnhancedAgentContext): Promise<AgentResult> {
    const { dataframe, targetColumn } = context.inputs as {
      dataframe: Record<string, unknown>[];
      targetColumn?: string;
    };
    const config = { ...metadata.configSchema.defaults, ...(context.config || {}) };
    const maxLag = config.maxLag ?? 40;
    const minStrength = config.minStrength ?? 0.3;

    const numericCols = this.getNumericColumns(dataframe);
    const colsToAnalyze = config.columns
      ? numericCols.filter(c => config.columns!.includes(c))
      : targetColumn
        ? numericCols.includes(targetColumn) ? [targetColumn] : numericCols
        : numericCols;

    const seasonalities = colsToAnalyze.map(col => {
      const values = dataframe
        .map(row => Number(row[col]))
        .filter(v => !isNaN(v) && isFinite(v));

      const acf = this.autocorrelation(values, Math.min(maxLag, Math.floor(values.length / 2)));
      const peaks = this.findPeaks(acf);
      const fft = this.fftMagnitude(values);
      const spectralPeaks = this.findSpectralPeaks(fft, values.length);

      // Combine ACF and FFT results
      const detectedPeriods = peaks.map(p => ({
        period: p.lag,
        strength: p.value,
        confidence: Math.min(p.value * 1.5, 1),
      })).concat(spectralPeaks.map(p => ({
        period: p.period,
        strength: p.magnitude,
        confidence: Math.min(p.magnitude * 1.2, 1),
      }))).sort((a, b) => b.strength - a.strength).slice(0, 5);

      const dominantPeriod = detectedPeriods[0]?.period ?? null;
      const seasonalityStrength = detectedPeriods[0]?.strength ?? 0;
      const isSeasonal = seasonalityStrength >= minStrength;

      return {
        column: col,
        detectedPeriods,
        dominantPeriod,
        seasonalityStrength,
        isSeasonal,
      };
    });

    const seasonalColumns = seasonalities.filter(s => s.isSeasonal).length;
    const avgStrength = seasonalities.length > 0
      ? seasonalities.reduce((sum, s) => sum + s.seasonalityStrength, 0) / seasonalities.length
      : 0;

    return this.createResult({ seasonalities, summary: { totalColumns: colsToAnalyze.length, seasonalColumns, averageStrength: avgStrength } }, { inputRows: dataframe.length, outputRows: seasonalities.length });
  }

  // ─── Autocorrelation Function (ACF) ─────────────────────────────
  private autocorrelation(values: number[], maxLag: number): number[] {
    const n = values.length;
    const avg = mean(values);
    const variance = values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / n;

    if (variance === 0) return new Array(maxLag).fill(0);

    const acf: number[] = [];
    for (let lag = 0; lag <= maxLag; lag++) {
      let sum = 0;
      for (let i = 0; i < n - lag; i++) {
        sum += (values[i] - avg) * (values[i + lag] - avg);
      }
      acf.push(sum / (variance * n));
    }
    return acf;
  }

  // ─── Find peaks in ACF (seasonal lags) ──────────────────────────
  private findPeaks(acf: number[]): { lag: number; value: number }[] {
    const peaks: { lag: number; value: number }[] = [];
    // Skip lag 0 (always 1.0)
    for (let i = 2; i < acf.length - 1; i++) {
      if (acf[i] > acf[i - 1] && acf[i] > acf[i + 1] && acf[i] > 0.2) {
        peaks.push({ lag: i, value: acf[i] });
      }
    }
    return peaks.sort((a, b) => b.value - a.value);
  }

  // ─── Cooley-Tukey FFT (radix-2) ─────────────────────────────────
  private fftMagnitude(values: number[]): number[] {
    const n = values.length;
    // Pad to next power of 2
    const padded = this.nextPowerOf2(n);
    const real = new Array(padded).fill(0);
    const imag = new Array(padded).fill(0);

    // Copy and detrend (remove mean to reduce spectral leakage)
    const avg = mean(values);
    for (let i = 0; i < n; i++) real[i] = values[i] - avg;

    this.fftInPlace(real, imag);

    // Return magnitude of first half (symmetric)
    const half = Math.floor(padded / 2);
    const magnitudes: number[] = [];
    for (let i = 0; i < half; i++) {
      magnitudes.push(Math.sqrt(real[i] ** 2 + imag[i] ** 2) / padded);
    }
    return magnitudes;
  }

  private fftInPlace(real: number[], imag: number[]): void {
    const n = real.length;
    if (n <= 1) return;

    // Bit-reversal permutation
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) {
        [real[i], real[j]] = [real[j], real[i]];
        [imag[i], imag[j]] = [imag[j], imag[i]];
      }
    }

    // Cooley-Tukey
    for (let len = 2; len <= n; len <<= 1) {
      const angle = -2 * Math.PI / len;
      const wReal = Math.cos(angle);
      const wImag = Math.sin(angle);
      for (let i = 0; i < n; i += len) {
        let curReal = 1, curImag = 0;
        for (let j = 0; j < len / 2; j++) {
          const uReal = real[i + j];
          const uImag = imag[i + j];
          const vReal = real[i + j + len / 2] * curReal - imag[i + j + len / 2] * curImag;
          const vImag = real[i + j + len / 2] * curImag + imag[i + j + len / 2] * curReal;
          real[i + j] = uReal + vReal;
          imag[i + j] = uImag + vImag;
          real[i + j + len / 2] = uReal - vReal;
          imag[i + j + len / 2] = uImag - vImag;
          const newReal = curReal * wReal - curImag * wImag;
          curImag = curReal * wImag + curImag * wReal;
          curReal = newReal;
        }
      }
    }
  }

  private findSpectralPeaks(magnitudes: number[], signalLength: number): { period: number; magnitude: number }[] {
    const peaks: { period: number; magnitude: number }[] = [];
    for (let i = 2; i < magnitudes.length - 1; i++) {
      if (magnitudes[i] > magnitudes[i - 1] && magnitudes[i] > magnitudes[i + 1] && magnitudes[i] > 0.01) {
        // Convert frequency bin to period
        const period = signalLength / i;
        if (period > 1 && period < signalLength / 2) {
          peaks.push({ period: Math.round(period * 10) / 10, magnitude: magnitudes[i] });
        }
      }
    }
    return peaks.sort((a, b) => b.magnitude - a.magnitude).slice(0, 3);
  }

  private nextPowerOf2(n: number): number {
    let p = 1;
    while (p < n) p <<= 1;
    return p;
  }

  private getNumericColumns(dataframe: Record<string, unknown>[]): string[] {
    if (dataframe.length === 0) return [];
    const sample = dataframe[0];
    return Object.keys(sample).filter(key => {
      const val = sample[key];
      return typeof val === 'number' || (!isNaN(Number(val)) && val !== null && val !== '');
    });
  }
}

export default SeasonalityDetectorAgent;
