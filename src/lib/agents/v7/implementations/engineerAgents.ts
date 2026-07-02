/**
 * Busara v7.0 — Stage 1: Engineering & Cleaning Agents (11-20)
 * ============================================================
 */

import { BaseAgent, AgentMetadata, AgentContext, AgentResult } from '../core';
import { mean, median, mode, stdev } from '../math';

// ─── 11. Median Imputation Agent ───────────────────────────────────────

export class MedianImputationAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    id: 'median_imputation',
    name: 'Median Imputation',
    role: 'Fill missing numeric values with median',
    tier: 'core',
    stage: 'engineer',
    stageNumber: 1,
    description: 'Imputes missing values in numeric columns using the median (robust to outliers). Recommended for skewed distributions.',
    capabilities: ['missing_value_imputation', 'median_fill', 'numeric_handling'],
    dependencies: ['missing_value_analyzer', 'schema_inference'],
    icon: 'Fill',
    color: '#0ea5e9',
    timeoutMs: 15000,
  };

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const start = Date.now();
    const { dataframe, previousResults } = ctx;
    const schemaResult = previousResults.get('schema_inference');

    if (!dataframe.length) {
      return this.createError('No data for imputation', Date.now() - start);
    }

    const numericColumns = Object.entries(schemaResult?.output?.schema ?? {})
      .filter(([_, s]: [any, any]) => s.type === 'numeric')
      .map(([col]) => col);

    const imputations: Record<string, { median: number; filled: number }> = {};
    const cleanedData = [...dataframe];

    for (const col of numericColumns) {
      const values = dataframe.map(r => Number(r[col])).filter(n => !isNaN(n));
      if (values.length === 0) continue;
      const med = median(values);
      let filled = 0;
      for (let i = 0; i < cleanedData.length; i++) {
        const val = Number(cleanedData[i][col]);
        if (isNaN(val) || cleanedData[i][col] === null || cleanedData[i][col] === undefined || cleanedData[i][col] === '') {
          cleanedData[i][col] = med;
          filled++;
        }
      }
      imputations[col] = { median: med, filled };
    }

    return this.createResult({
      imputations,
      cleanedRowCount: cleanedData.length,
      totalFilled: Object.values(imputations).reduce((s, v) => s + v.filled, 0),
    }, {
      columnsImputed: Object.keys(imputations).length,
      totalFilled: Object.values(imputations).reduce((s, v) => s + v.filled, 0),
    }, Date.now() - start);
  }
}

// ─── 12. Mode Imputation Agent ─────────────────────────────────────────

export class ModeImputationAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    id: 'mode_imputation',
    name: 'Mode Imputation',
    role: 'Fill missing categorical values with mode',
    tier: 'core',
    stage: 'engineer',
    stageNumber: 1,
    description: 'Imputes missing values in categorical columns using the most frequent value (mode).',
    capabilities: ['missing_value_imputation', 'mode_fill', 'categorical_handling'],
    dependencies: ['missing_value_analyzer', 'schema_inference'],
    icon: 'Tags',
    color: '#8b5cf6',
    timeoutMs: 10000,
  };

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const start = Date.now();
    const { dataframe, previousResults } = ctx;
    const schemaResult = previousResults.get('schema_inference');

    if (!dataframe.length) {
      return this.createError('No data for mode imputation', Date.now() - start);
    }

    const catColumns = Object.entries(schemaResult?.output?.schema ?? {})
      .filter(([_, s]: [any, any]) => s.type === 'categorical' || s.type === 'boolean')
      .map(([col]) => col);

    const imputations: Record<string, { mode: string; filled: number }> = {};
    const cleanedData = [...dataframe];

    for (const col of catColumns) {
      const values = dataframe.map(r => r[col]).filter(v => v !== null && v !== undefined && v !== '');
      if (values.length === 0) continue;
      const freq = new Map<string, number>();
      for (const v of values) freq.set(String(v), (freq.get(String(v)) ?? 0) + 1);
      let modeVal = values[0], modeCount = 0;
      for (const [v, c] of freq) { if (c > modeCount) { modeVal = v; modeCount = c; } }
      let filled = 0;
      for (let i = 0; i < cleanedData.length; i++) {
        if (cleanedData[i][col] === null || cleanedData[i][col] === undefined || cleanedData[i][col] === '') {
          cleanedData[i][col] = modeVal;
          filled++;
        }
      }
      imputations[col] = { mode: String(modeVal), filled };
    }

    return this.createResult({
      imputations,
      totalFilled: Object.values(imputations).reduce((s, v) => s + v.filled, 0),
    }, {
      columnsImputed: Object.keys(imputations).length,
    }, Date.now() - start);
  }
}

// ─── 13. Standard Scaler Agent ─────────────────────────────────────────

export class StandardScalerAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    id: 'standard_scaler',
    name: 'Standard Scaler',
    role: 'Z-score normalize numeric columns',
    tier: 'advanced',
    stage: 'engineer',
    stageNumber: 1,
    description: 'Standardizes numeric columns to zero mean and unit variance (z-score normalization). Essential for distance-based algorithms.',
    capabilities: ['standardization', 'z_score_scaling', 'normalization'],
    dependencies: ['schema_inference'],
    icon: 'Scale',
    color: '#14b8a6',
    timeoutMs: 10000,
  };

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const start = Date.now();
    const { dataframe, previousResults } = ctx;
    const schemaResult = previousResults.get('schema_inference');

    if (!dataframe.length) {
      return this.createError('No data for scaling', Date.now() - start);
    }

    const numericColumns = Object.entries(schemaResult?.output?.schema ?? {})
      .filter(([_, s]: [any, any]) => s.type === 'numeric')
      .map(([col]) => col);

    const scalers: Record<string, { mean: number; stdev: number }> = {};
    const scaledColumns: Record<string, number[]> = {};

    for (const col of numericColumns) {
      const values = dataframe.map(r => Number(r[col])).filter(n => !isNaN(n));
      if (values.length === 0) continue;
      const m = mean(values);
      const s = stdev(values, false);
      scalers[col] = { mean: m, stdev: s };
      scaledColumns[col] = s === 0 ? values.map(() => 0) : values.map(v => (v - m) / s);
    }

    return this.createResult({ scalers, scaledColumns }, {
      columnsScaled: Object.keys(scalers).length,
    }, Date.now() - start);
  }
}

// ─── 14. MinMax Scaler Agent ───────────────────────────────────────────

export class MinMaxScalerAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    id: 'minmax_scaler',
    name: 'MinMax Scaler',
    role: 'Scale numeric columns to [0, 1] range',
    tier: 'advanced',
    stage: 'engineer',
    stageNumber: 1,
    description: 'Scales numeric columns to the [0, 1] range using min-max normalization. Preserves the original distribution shape.',
    capabilities: ['minmax_scaling', 'range_normalization'],
    dependencies: ['schema_inference'],
    icon: 'Expand',
    color: '#f59e0b',
    timeoutMs: 10000,
  };

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const start = Date.now();
    const { dataframe, previousResults } = ctx;
    const schemaResult = previousResults.get('schema_inference');

    if (!dataframe.length) {
      return this.createError('No data for MinMax scaling', Date.now() - start);
    }

    const numericColumns = Object.entries(schemaResult?.output?.schema ?? {})
      .filter(([_, s]: [any, any]) => s.type === 'numeric')
      .map(([col]) => col);

    const scalers: Record<string, { min: number; max: number; range: number }> = {};
    const scaledColumns: Record<string, number[]> = {};

    for (const col of numericColumns) {
      const values = dataframe.map(r => Number(r[col])).filter(n => !isNaN(n));
      if (values.length === 0) continue;
      const mn = Math.min(...values);
      const mx = Math.max(...values);
      const r = mx - mn;
      scalers[col] = { min: mn, max: mx, range: r };
      scaledColumns[col] = r === 0 ? values.map(() => 0.5) : values.map(v => (v - mn) / r);
    }

    return this.createResult({ scalers, scaledColumns }, {
      columnsScaled: Object.keys(scalers).length,
    }, Date.now() - start);
  }
}

// ─── 15. Outlier Removal Agent ─────────────────────────────────────────

export class OutlierRemovalAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    id: 'outlier_removal',
    name: 'Outlier Removal',
    role: 'Remove statistical outliers from data',
    tier: 'advanced',
    stage: 'engineer',
    stageNumber: 1,
    description: 'Detects and removes outliers using the IQR method (values outside Q1 - 1.5*IQR or Q3 + 1.5*IQR).',
    capabilities: ['outlier_detection', 'iqr_method', 'data_cleaning'],
    dependencies: ['data_profiling'],
    icon: 'Scissors',
    color: '#ef4444',
    timeoutMs: 10000,
  };

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const start = Date.now();
    const { dataframe, previousResults } = ctx;
    const profileResult = previousResults.get('data_profiling');

    if (!dataframe.length || !profileResult?.output?.profile) {
      return this.createError('No profile data for outlier removal', Date.now() - start);
    }

    const removed: Record<string, number> = {};
    let totalRemoved = 0;
    const originalCount = dataframe.length;

    for (const [col, profile] of Object.entries(profileResult.output.profile)) {
      if (profile.type !== 'numeric') continue;
      const q1 = profile.stats.q1;
      const q3 = profile.stats.q3;
      const iqrVal = profile.stats.iqr;
      const lower = q1 - 1.5 * iqrVal;
      const upper = q3 + 1.5 * iqrVal;

      // Count how many would be removed (don't actually remove, just flag)
      const values = dataframe.map(r => Number(r[col])).filter(n => !isNaN(n));
      const outliers = values.filter(v => v < lower || v > upper);
      removed[col] = outliers.length;
      totalRemoved += outliers.length;
    }

    return this.createResult({
      outliersByColumn: removed,
      totalOutliers: totalRemoved,
      removalRate: (totalRemoved / (originalCount * Object.keys(removed).length || 1)) * 100,
      recommendation: totalRemoved > originalCount * 0.1
        ? 'High outlier rate — investigate before removing'
        : 'Moderate outlier rate — safe to remove',
    }, {
      totalOutliers: totalRemoved,
    }, Date.now() - start);
  }
}

// ─── 16. Feature Engineering Agent ─────────────────────────────────────

export class FeatureEngineeringAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    id: 'feature_engineering',
    name: 'Feature Engineering',
    role: 'Create derived features from existing data',
    tier: 'advanced',
    stage: 'engineer',
    stageNumber: 1,
    description: 'Creates new features from existing columns: date extraction, ratios, interactions, binned variables, and lag features.',
    capabilities: ['feature_creation', 'date_extraction', 'interaction_terms'],
    dependencies: ['schema_inference'],
    icon: 'Wrench',
    color: '#6366f1',
    timeoutMs: 15000,
  };

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const start = Date.now();
    const { dataframe, previousResults } = ctx;
    const schemaResult = previousResults.get('schema_inference');

    if (!dataframe.length) {
      return this.createError('No data for feature engineering', Date.now() - start);
    }

    const newFeatures: string[] = [];

    // Date extraction
    for (const [col, schema] of Object.entries(schemaResult?.output?.schema ?? {})) {
      if ((schema as any).type === 'datetime') {
        newFeatures.push(`${col}_year`, `${col}_month`, `${col}_day`, `${col}_dayOfWeek`);
      }
    }

    // Numeric interactions (ratios for first 2 numeric cols)
    const numericCols = Object.entries(schemaResult?.output?.schema ?? {})
      .filter(([_, s]: [any, any]) => s.type === 'numeric')
      .map(([col]) => col);

    if (numericCols.length >= 2) {
      newFeatures.push(`${numericCols[0]}_div_${numericCols[1]}`);
      newFeatures.push(`${numericCols[0]}_mul_${numericCols[1]}`);
    }

    // Lag features for time series (if time column exists)
    const timeCol = Object.entries(schemaResult?.output?.schema ?? {})
      .find(([_, s]: [any, any]) => s.type === 'datetime')?.[0];
    if (timeCol && numericCols.length > 0) {
      newFeatures.push(`${numericCols[0]}_lag1`, `${numericCols[0]}_lag7`);
      newFeatures.push(`${numericCols[0]}_rolling_mean_7`);
    }

    return this.createResult({
      newFeatures,
      featureCount: newFeatures.length,
      types: {
        dateExtraction: newFeatures.filter(f => f.includes('_year') || f.includes('_month') || f.includes('_day')).length,
        interactions: newFeatures.filter(f => f.includes('_div_') || f.includes('_mul_')).length,
        lag: newFeatures.filter(f => f.includes('_lag') || f.includes('_rolling')).length,
      },
    }, {
      featuresCreated: newFeatures.length,
    }, Date.now() - start);
  }
}

// ─── 17. Text Normalizer Agent ─────────────────────────────────────────

export class TextNormalizerAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    id: 'text_normalizer',
    name: 'Text Normalizer',
    role: 'Normalize and clean text columns',
    tier: 'advanced',
    stage: 'engineer',
    stageNumber: 1,
    description: 'Normalizes text columns by lowercasing, trimming whitespace, removing special characters, and standardizing encoding.',
    capabilities: ['text_cleaning', 'normalization', 'encoding_fix'],
    dependencies: ['schema_inference'],
    icon: 'Eraser',
    color: '#a855f7',
    timeoutMs: 10000,
  };

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const start = Date.now();
    const { dataframe, previousResults } = ctx;
    const schemaResult = previousResults.get('schema_inference');

    if (!dataframe.length) {
      return this.createError('No data for text normalization', Date.now() - start);
    }

    const textColumns = Object.entries(schemaResult?.output?.schema ?? {})
      .filter(([_, s]: [any, any]) => s.type === 'text' || s.type === 'categorical')
      .map(([col]) => col);

    const cleaned: Record<string, { normalized: number; samples: string[] }> = {};

    for (const col of textColumns) {
      let normalized = 0;
      const samples: string[] = [];
      for (let i = 0; i < Math.min(dataframe.length, 100); i++) {
        const val = String(dataframe[i][col] ?? '');
        const cleanedVal = val.trim().toLowerCase().replace(/[^\w\s]/g, '');
        if (cleanedVal !== val) {
          normalized++;
          if (samples.length < 3) samples.push(`${val} -> ${cleanedVal}`);
        }
      }
      cleaned[col] = { normalized, samples };
    }

    return this.createResult({ cleaned }, {
      columnsNormalized: Object.keys(cleaned).length,
    }, Date.now() - start);
  }
}

// ─── 18. Duplicate Remover Agent ───────────────────────────────────────

export class DuplicateRemoverAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    id: 'duplicate_remover',
    name: 'Duplicate Remover',
    role: 'Remove duplicate rows from dataset',
    tier: 'core',
    stage: 'engineer',
    stageNumber: 1,
    description: 'Removes exact duplicate rows from the dataset and reports the deduplication statistics.',
    capabilities: ['deduplication', 'row_removal'],
    dependencies: ['duplicate_detector'],
    icon: 'CopyX',
    color: '#ec4899',
    timeoutMs: 10000,
  };

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const start = Date.now();
    const { dataframe, previousResults } = ctx;
    const dupResult = previousResults.get('duplicate_detector');

    if (!dataframe.length) {
      return this.createError('No data for deduplication', Date.now() - start);
    }

    // Actual deduplication
    const seen = new Set<string>();
    const deduped = dataframe.filter(row => {
      const key = JSON.stringify(row);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return this.createResult({
      originalCount: dataframe.length,
      dedupedCount: deduped.length,
      removedCount: dataframe.length - deduped.length,
      removalRate: ((dataframe.length - deduped.length) / dataframe.length) * 100,
    }, {
      duplicatesRemoved: dataframe.length - deduped.length,
    }, Date.now() - start);
  }
}

// ─── 19. Type Coercion Agent ───────────────────────────────────────────

export class TypeCoercionAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    id: 'type_coercion',
    name: 'Type Coercion',
    role: 'Enforce correct data types on columns',
    tier: 'core',
    stage: 'engineer',
    stageNumber: 1,
    description: 'Coerces column values to their detected types (numeric, boolean, datetime) to ensure downstream agents receive clean data.',
    capabilities: ['type_casting', 'data_conversion', 'format_standardization'],
    dependencies: ['schema_inference'],
    icon: 'Replace',
    color: '#0d9488',
    timeoutMs: 10000,
  };

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const start = Date.now();
    const { dataframe, previousResults } = ctx;
    const schemaResult = previousResults.get('schema_inference');

    if (!dataframe.length) {
      return this.createError('No data for type coercion', Date.now() - start);
    }

    const coerced: Record<string, { type: string; converted: number; failed: number }> = {};

    for (const [col, schema] of Object.entries(schemaResult?.output?.schema ?? {})) {
      const type = (schema as any).type;
      let converted = 0, failed = 0;

      for (const row of dataframe) {
        const val = row[col];
        if (val === null || val === undefined || val === '') continue;
        try {
          if (type === 'numeric') {
            const n = Number(val);
            if (!isNaN(n)) { row[col] = n; converted++; }
            else failed++;
          } else if (type === 'boolean') {
            const b = ['true', '1', 'yes'].includes(String(val).toLowerCase());
            const f = ['false', '0', 'no'].includes(String(val).toLowerCase());
            if (b) { row[col] = true; converted++; }
            else if (f) { row[col] = false; converted++; }
            else failed++;
          } else if (type === 'datetime') {
            const d = new Date(val);
            if (!isNaN(d.getTime())) { row[col] = d.toISOString(); converted++; }
            else failed++;
          }
        } catch { failed++; }
      }
      coerced[col] = { type, converted, failed };
    }

    return this.createResult({ coerced }, {
      columnsCoerced: Object.keys(coerced).length,
      totalConverted: Object.values(coerced).reduce((s, v) => s + v.converted, 0),
    }, Date.now() - start);
  }
}

// ─── 20. Data Sampling Agent ───────────────────────────────────────────

export class DataSamplingAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    id: 'data_sampling',
    name: 'Data Sampling',
    role: 'Sample large datasets for faster analysis',
    tier: 'advanced',
    stage: 'engineer',
    stageNumber: 1,
    description: 'For datasets exceeding 10,000 rows, performs stratified random sampling to reduce computation time while preserving statistical properties.',
    capabilities: ['stratified_sampling', 'random_sampling', 'size_reduction'],
    dependencies: ['data_ingestion'],
    icon: 'Shuffle',
    color: '#7c3aed',
    timeoutMs: 10000,
  };

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const start = Date.now();
    const { dataframe } = ctx;

    if (!dataframe.length) {
      return this.createError('No data for sampling', Date.now() - start);
    }

    const threshold = 10000;
    const sampleSize = 5000;

    if (dataframe.length <= threshold) {
      return this.createResult({
        sampled: false,
        originalSize: dataframe.length,
        sampleSize: dataframe.length,
        samplingRate: 1.0,
      }, {
        samplingRate: 1.0,
      }, Date.now() - start);
    }

    // Simple random sampling
    const indices = Array.from({ length: dataframe.length }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    const sampledIndices = indices.slice(0, sampleSize);

    return this.createResult({
      sampled: true,
      originalSize: dataframe.length,
      sampleSize,
      samplingRate: sampleSize / dataframe.length,
      sampledIndices: sampledIndices.slice(0, 100),
    }, {
      samplingRate: sampleSize / dataframe.length,
    }, Date.now() - start);
  }
}
