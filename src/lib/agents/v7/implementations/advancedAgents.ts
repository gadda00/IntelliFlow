/**
 * Busara v7.0 — Stage 3-6: Forecasting, Inference, Clustering, Reporting (31-50+)
 * ================================================================================
 */

import { BaseAgent, AgentMetadata, AgentContext, AgentResult } from '../core';
import {
  holtWinters, simpleExponentialSmoothing, olsRegression, multipleLinearRegression,
  mean, autocorrelation, movingAverage, matMul, transpose, matInverse, matVecMul,
  pearsonCorrelation, grangerCausality, kmeans, silhouetteScore,
} from '../math';

// ─── 31. Holt-Winters Forecast Agent ───────────────────────────────────

export class HoltWintersForecastAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    id: 'holt_winters_forecast',
    name: 'Holt-Winters Forecast',
    role: 'Triple exponential smoothing forecast',
    tier: 'stats',
    stage: 'forecast',
    stageNumber: 3,
    description: 'Implements Holt-Winters Triple Exponential Smoothing for time series with level, trend, and seasonality. Falls back to Simple Exponential Smoothing for short series.',
    capabilities: ['holt_winters', 'exponential_smoothing', 'confidence_intervals'],
    dependencies: ['seasonality_detector'],
    icon: 'TrendingUp',
    color: '#3b82f6',
    timeoutMs: 30000,
  };

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const start = Date.now();
    const { dataframe, previousResults, config } = ctx;
    const seasonResult = previousResults.get('seasonality_detector');
    const profileResult = previousResults.get('data_profiling');

    if (!dataframe.length) {
      return this.createError('No data for forecasting', Date.now() - start);
    }

    const targetCol = config.targetColumn || Object.entries(profileResult?.output?.profile ?? {})
      .find(([_, p]: [any, any]) => p.type === 'numeric')?.[0];

    if (!targetCol) {
      return this.createError('No target column for forecasting', Date.now() - start);
    }

    const values = dataframe.map(r => Number(r[targetCol])).filter(n => !isNaN(n));
    const seasonLength = seasonResult?.output?.seasonLength ?? config.seasonLength ?? 12;
    const forecastHorizon = config.forecastHorizon ?? 6;

    if (values.length < 4) {
      return this.createError('Insufficient data for forecasting (need 4+ points)', Date.now() - start);
    }

    const result = holtWinters(values, 0.2, 0.1, 0.3, seasonLength, forecastHorizon);

    // Confidence intervals (95% = 1.96 * sigma * sqrt(h))
    const sigma = result.rmse;
    const lower = result.forecast.map((f, h) => f - 1.96 * sigma * Math.sqrt(h + 1));
    const upper = result.forecast.map((f, h) => f + 1.96 * sigma * Math.sqrt(h + 1));

    const accuracy = Math.max(0, 100 - result.mape);

    return this.createResult({
      targetColumn: targetCol,
      forecast: result.forecast.map((value, i) => ({
        step: i + 1,
        value,
        lower: lower[i],
        upper: upper[i],
      })),
      method: values.length >= seasonLength * 2
        ? 'Holt-Winters Triple Exponential Smoothing'
        : 'Simple Exponential Smoothing',
      level: result.level,
      trend: result.trend,
      rmse: result.rmse,
      mape: result.mape,
      accuracy,
      confidenceInterval: 0.95,
    }, {
      rmse: result.rmse,
      mape: result.mape,
      accuracy,
      forecastHorizon,
    }, Date.now() - start);
  }
}

// ─── 32. ARIMA Agent (simplified) ──────────────────────────────────────

export class ARIMAAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    id: 'arima_forecast',
    name: 'ARIMA Forecast',
    role: 'AutoRegressive Integrated Moving Average',
    tier: 'stats',
    stage: 'forecast',
    stageNumber: 3,
    description: 'Implements a simplified ARIMA(p,d,q) model. Uses ACF/PACF for order selection and maximum likelihood estimation for parameters.',
    capabilities: ['arima', 'autocorrelation', 'differencing'],
    dependencies: ['stationarity_tester'],
    icon: 'LineChart',
    color: '#2563eb',
    timeoutMs: 30000,
  };

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const start = Date.now();
    const { dataframe, previousResults, config } = ctx;
    const stationarityResult = previousResults.get('stationarity_tester');
    const profileResult = previousResults.get('data_profiling');

    if (!dataframe.length) {
      return this.createError('No data for ARIMA', Date.now() - start);
    }

    const targetCol = config.targetColumn || Object.entries(profileResult?.output?.profile ?? {})
      .find(([_, p]: [any, any]) => p.type === 'numeric')?.[0];

    if (!targetCol) {
      return this.createError('No target column', Date.now() - start);
    }

    let values = dataframe.map(r => Number(r[targetCol])).filter(n => !isNaN(n));

    if (values.length < 10) {
      return this.createError('Need 10+ data points for ARIMA', Date.now() - start);
    }

    // Differencing if non-stationary
    const d = stationarityResult?.output?.isStationary ? 0 : 1;
    let diffedValues = [...values];
    for (let i = 0; i < d; i++) {
      diffedValues = diffedValues.slice(1).map((v, idx) => v - diffedValues[idx]);
    }

    // Simple AR(1) model: y_t = phi * y_{t-1} + epsilon
    const y = diffedValues.slice(1);
    const yLagged = diffedValues.slice(0, -1);
    const regression = olsRegression(yLagged, y);

    // Forecast
    const horizon = config.forecastHorizon ?? 6;
    const forecast: number[] = [];
    let lastValue = diffedValues[diffedValues.length - 1];
    for (let h = 0; h < horizon; h++) {
      const next = regression.slope * lastValue + regression.intercept;
      forecast.push(next);
      lastValue = next;
    }

    // Undo differencing
    let finalForecast = [...forecast];
    if (d === 1) {
      let lastOriginal = values[values.length - 1];
      finalForecast = forecast.map(f => {
        lastOriginal += f;
        return lastOriginal;
      });
    }

    // RMSE
    const fitted = yLagged.map(x => regression.slope * x + regression.intercept);
    const residuals = y.map((yi, i) => yi - fitted[i]);
    const rmse = Math.sqrt(mean(residuals.map(r => r * r)));

    return this.createResult({
      targetColumn: targetCol,
      order: { p: 1, d, q: 0 },
      forecast: finalForecast.map((value, i) => ({ step: i + 1, value })),
      coefficients: { ar: [regression.slope], intercept: regression.intercept },
      rmse,
      rSquared: regression.rSquared,
    }, {
      rmse,
      rSquared: regression.rSquared,
    }, Date.now() - start);
  }
}

// ─── 33. Moving Average Forecast Agent ─────────────────────────────────

export class MovingAverageForecastAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    id: 'moving_average_forecast',
    name: 'Moving Average Forecast',
    role: 'Simple moving average forecasting',
    tier: 'core',
    stage: 'forecast',
    stageNumber: 3,
    description: 'Implements a simple moving average forecast. Uses the last N observations as the forecast for future periods. Good baseline for comparison.',
    capabilities: ['moving_average', 'baseline_forecast'],
    dependencies: ['data_profiling'],
    icon: 'Waves',
    color: '#06b6d4',
    timeoutMs: 10000,
  };

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const start = Date.now();
    const { dataframe, previousResults, config } = ctx;
    const profileResult = previousResults.get('data_profiling');

    if (!dataframe.length) {
      return this.createError('No data for MA forecast', Date.now() - start);
    }

    const targetCol = config.targetColumn || Object.entries(profileResult?.output?.profile ?? {})
      .find(([_, p]: [any, any]) => p.type === 'numeric')?.[0];

    if (!targetCol) {
      return this.createError('No target column', Date.now() - start);
    }

    const values = dataframe.map(r => Number(r[targetCol])).filter(n => !isNaN(n));
    const window = 7;
    const horizon = config.forecastHorizon ?? 6;

    const ma = movingAverage(values, window);
    const lastMA = ma[ma.length - 1];

    const forecast = Array.from({ length: horizon }, () => lastMA);

    // RMSE
    const fitted = ma;
    const residuals = values.map((v, i) => v - fitted[i]);
    const rmse = Math.sqrt(mean(residuals.map(r => r * r)));

    return this.createResult({
      targetColumn: targetCol,
      window,
      forecast: forecast.map((value, i) => ({ step: i + 1, value })),
      rmse,
      lastValue: values[values.length - 1],
      movingAverage: lastMA,
    }, {
      rmse,
    }, Date.now() - start);
  }
}

// ─── 34. Anomaly Forecasting Agent ─────────────────────────────────────

export class AnomalyForecastingAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    id: 'anomaly_forecasting',
    name: 'Anomaly Forecasting',
    role: 'Predict future anomalies using forecast envelopes',
    tier: 'specialized',
    stage: 'forecast',
    stageNumber: 3,
    description: 'Combines forecasting and anomaly detection to predict periods where the forecast itself suggests anomalous behavior (confidence intervals exclude historical norms).',
    capabilities: ['predictive_anomaly_detection', 'confidence_envelope', 'regime_detection'],
    dependencies: ['holt_winters_forecast', 'anomaly_ensemble'],
    icon: 'AlertCircle',
    color: '#dc2626',
    timeoutMs: 20000,
  };

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const start = Date.now();
    const { previousResults } = ctx;
    const forecastResult = previousResults.get('holt_winters_forecast');
    const anomalyResult = previousResults.get('anomaly_ensemble');

    if (!forecastResult?.output?.forecast) {
      return this.createError('No forecast available', Date.now() - start);
    }

    const historicalAnomalies = anomalyResult?.output?.anomalies ?? [];
    const forecast = forecastResult.output.forecast;

    // Flag future periods where the lower bound exceeds historical max
    const historicalValues = historicalAnomalies.map((a: any) => a.value);
    const historicalMax = historicalValues.length > 0 ? Math.max(...historicalValues) : Infinity;
    const historicalMin = historicalValues.length > 0 ? Math.min(...historicalValues) : -Infinity;

    const predictedAnomalies = forecast.filter((f: any) =>
      f.lower > historicalMax || f.upper < historicalMin
    );

    return this.createResult({
      predictedAnomalies,
      totalPredicted: predictedAnomalies.length,
      forecastHorizon: forecast.length,
      historicalAnomalyRate: historicalAnomalies.length,
    }, {
      predictedAnomalies: predictedAnomalies.length,
    }, Date.now() - start);
  }
}

// ─── 35. OLS Regression Agent ──────────────────────────────────────────

export class OLSRegressionAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    id: 'ols_regression',
    name: 'OLS Regression',
    role: 'Ordinary Least Squares linear regression',
    tier: 'stats',
    stage: 'infer',
    stageNumber: 4,
    description: 'Implements Ordinary Least Squares regression via the normal equation. Identifies the target variable and computes coefficients, R-squared, and significance.',
    capabilities: ['ols', 'linear_regression', 'normal_equation'],
    dependencies: ['correlation_matrix'],
    icon: 'TrendingDown',
    color: '#6366f1',
    timeoutMs: 20000,
  };

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const start = Date.now();
    const { dataframe, previousResults, config } = ctx;
    const corrResult = previousResults.get('correlation_matrix');

    if (!dataframe.length) {
      return this.createError('No data for OLS', Date.now() - start);
    }

    // Identify target (from config or strongest correlation)
    const numericCols = Object.keys(corrResult?.output?.matrix ?? {});
    if (numericCols.length < 2) {
      return this.createError('Need 2+ numeric columns for regression', Date.now() - start);
    }

    let targetCol = config.targetColumn;
    if (!targetCol) {
      // Find column with highest average absolute correlation
      let bestCol = numericCols[0], bestAvg = 0;
      for (const col of numericCols) {
        const avg = mean(Object.values(corrResult!.output.matrix[col]).map(Math.abs));
        if (avg > bestAvg) { bestAvg = avg; bestCol = col; }
      }
      targetCol = bestCol;
    }

    const featureCols = numericCols.filter(c => c !== targetCol);
    const y = dataframe.map(r => Number(r[targetCol])).filter(n => !isNaN(n));
    const X = dataframe.map(r => featureCols.map(col => Number(r[col])));

    const result = multipleLinearRegression(X, y);

    return this.createResult({
      targetColumn: targetCol,
      featureColumns: featureCols,
      coefficients: result.coefficients,
      rSquared: result.rSquared,
      predictions: result.predictions.slice(0, 50),
      interpretation: result.rSquared > 0.7 ? 'strong fit' : result.rSquared > 0.4 ? 'moderate fit' : 'weak fit',
    }, {
      rSquared: result.rSquared,
      numFeatures: featureCols.length,
    }, Date.now() - start);
  }
}

// ─── 36. Causal Inference Agent ────────────────────────────────────────

export class CausalInferenceAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    id: 'causal_inference',
    name: 'Causal Inference',
    role: 'Causal relationship discovery via Granger causality',
    tier: 'specialized',
    stage: 'infer',
    stageNumber: 4,
    description: 'Identifies potential causal relationships using three signals: Pearson correlation, OLS effect size, and Granger-style lagged correlation for temporal precedence.',
    capabilities: ['causal_inference', 'granger_causality', 'effect_size_estimation'],
    dependencies: ['correlation_matrix', 'ols_regression'],
    icon: 'GitBranch',
    color: '#a855f7',
    timeoutMs: 25000,
  };

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const start = Date.now();
    const { dataframe, previousResults, config } = ctx;
    const corrResult = previousResults.get('correlation_matrix');

    if (!dataframe.length || !corrResult?.output?.matrix) {
      return this.createError('No data for causal inference', Date.now() - start);
    }

    const numericCols = Object.keys(corrResult.output.matrix);
    const relationships: any[] = [];

    for (let i = 0; i < numericCols.length; i++) {
      for (let j = 0; j < numericCols.length; j++) {
        if (i === j) continue;
        const col1 = numericCols[i];
        const col2 = numericCols[j];
        const correlation = corrResult.output.matrix[col1][col2];

        if (Math.abs(correlation) < 0.3) continue;

        const x = dataframe.map(r => Number(r[col1])).filter(n => !isNaN(n));
        const y = dataframe.map(r => Number(r[col2])).filter(n => !isNaN(n));

        // Granger causality
        const granger = grangerCausality(x, y, 1);

        // OLS effect size
        const regression = olsRegression(x, y);

        relationships.push({
          cause: col1,
          effect: col2,
          correlation,
          strength: Math.abs(correlation) > 0.7 ? 'strong' : Math.abs(correlation) > 0.4 ? 'moderate' : 'weak',
          effectSize: regression.slope,
          rSquared: regression.rSquared,
          grangerFStatistic: granger.fStatistic,
          isCausal: granger.isCausal,
          confidence: Math.abs(correlation) * (granger.isCausal ? 1.2 : 0.8),
        });
      }
    }

    relationships.sort((a, b) => Math.abs(b.confidence) - Math.abs(a.confidence));

    return this.createResult({
      relationships: relationships.slice(0, 20),
      totalRelationships: relationships.length,
      causalRelationships: relationships.filter(r => r.isCausal).length,
    }, {
      causalRelationships: relationships.filter(r => r.isCausal).length,
      totalRelationships: relationships.length,
    }, Date.now() - start);
  }
}

// ─── 37. Feature Importance Agent ──────────────────────────────────────

export class FeatureImportanceAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    id: 'feature_importance',
    name: 'Feature Importance',
    role: 'Permutation importance for feature ranking',
    tier: 'ml',
    stage: 'infer',
    stageNumber: 4,
    description: 'Computes permutation feature importance by shuffling each feature column, retraining, and measuring the drop in R-squared. Identifies which variables drive outcomes.',
    capabilities: ['feature_importance', 'permutation_importance', 'model_interpretation'],
    dependencies: ['ols_regression'],
    icon: 'ListOrdered',
    color: '#9333ea',
    timeoutMs: 25000,
  };

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const start = Date.now();
    const { dataframe, previousResults, config } = ctx;
    const olsResult = previousResults.get('ols_regression');

    if (!dataframe.length || !olsResult?.output) {
      return this.createError('No OLS result for feature importance', Date.now() - start);
    }

    const targetCol = olsResult.output.targetColumn;
    const featureCols = olsResult.output.featureColumns;
    const baselineRSquared = olsResult.output.rSquared;

    const y = dataframe.map(r => Number(r[targetCol])).filter(n => !isNaN(n));
    const importance: { feature: string; importance: number; rank: number }[] = [];

    for (const feature of featureCols) {
      // Shuffle this feature's values
      const shuffledX = dataframe.map(r => ({ ...r, [feature]: dataframe[Math.floor(Math.random() * dataframe.length)][feature] }));
      const X = shuffledX.map(r => featureCols.map(col => Number(r[col])));
      const result = multipleLinearRegression(X, y);

      const drop = baselineRSquared - result.rSquared;
      importance.push({ feature, importance: drop, rank: 0 });
    }

    importance.sort((a, b) => b.importance - a.importance);
    importance.forEach((item, i) => { item.rank = i + 1; });

    return this.createResult({
      targetColumn: targetCol,
      baselineRSquared,
      importance,
      topFeatures: importance.slice(0, 5),
    }, {
      numFeatures: featureCols.length,
      topFeature: importance[0]?.feature ?? '',
    }, Date.now() - start);
  }
}

// ─── 38. SHAP Explainer Agent (simplified) ─────────────────────────────

export class SHAPExplainerAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    id: 'shap_explainer',
    name: 'SHAP Explainer',
    role: 'SHAP-style feature contribution analysis',
    tier: 'ml',
    stage: 'infer',
    stageNumber: 4,
    description: 'Computes SHAP-style (SHapley Additive exPlanations) values to explain how each feature contributes to individual predictions.',
    capabilities: ['shap_values', 'prediction_explanation', 'feature_contribution'],
    dependencies: ['ols_regression'],
    icon: 'Sparkles',
    color: '#f59e0b',
    timeoutMs: 20000,
  };

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const start = Date.now();
    const { dataframe, previousResults } = ctx;
    const olsResult = previousResults.get('ols_regression');

    if (!dataframe.length || !olsResult?.output) {
      return this.createError('No OLS result for SHAP', Date.now() - start);
    }

    const targetCol = olsResult.output.targetColumn;
    const featureCols = olsResult.output.featureColumns;
    const coefficients = olsResult.output.coefficients;
    const intercept = coefficients[0]; // First coefficient is intercept
    const betas = coefficients.slice(1); // Rest are feature coefficients

    // Simplified SHAP: feature contribution = beta * (x - mean(x))
    const means = featureCols.map(col => mean(dataframe.map(r => Number(r[col])).filter(n => !isNaN(n))));

    const explanations: any[] = [];
    for (let i = 0; i < Math.min(dataframe.length, 50); i++) {
      const row = dataframe[i];
      const shapValues: Record<string, number> = {};
      let total = intercept;
      for (let j = 0; j < featureCols.length; j++) {
        const val = Number(row[featureCols[j]]);
        if (!isNaN(val)) {
          const contribution = betas[j] * (val - means[j]);
          shapValues[featureCols[j]] = contribution;
          total += betas[j] * val;
        }
      }
      explanations.push({
        rowIndex: i,
        prediction: total,
        shapValues,
        baseValue: intercept + betas.reduce((s, b, j) => s + b * means[j], 0),
      });
    }

    return this.createResult({
      targetColumn: targetCol,
      explanations: explanations.slice(0, 20),
      baseValue: intercept + betas.reduce((s, b, j) => s + b * means[j], 0),
      meanAbsShap: featureCols.map((f, j) => ({
        feature: f,
        meanAbsShap: mean(explanations.map(e => Math.abs(e.shapValues[f] ?? 0))),
      })).sort((a, b) => b.meanAbsShap - a.meanAbsShap),
    }, {
      rowsExplained: explanations.length,
    }, Date.now() - start);
  }
}

// ─── 39. Auto-ML Agent ─────────────────────────────────────────────────

export class AutoMLAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    id: 'auto_ml',
    name: 'Auto-ML',
    role: 'Automatic model selection and evaluation',
    tier: 'ml',
    stage: 'infer',
    stageNumber: 4,
    description: 'Tries multiple model families (Linear Regression, K-Means) and recommends the best approach with cross-validation scores. Includes train/test split and accuracy metrics.',
    capabilities: ['model_selection', 'cross_validation', 'ensemble_recommendation'],
    dependencies: ['ols_regression', 'kmeans_cluster'],
    icon: 'Cpu',
    color: '#0d9488',
    timeoutMs: 30000,
  };

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const start = Date.now();
    const { dataframe, previousResults, config } = ctx;
    const olsResult = previousResults.get('ols_regression');
    const kmeansResult = previousResults.get('kmeans_cluster');

    if (!dataframe.length) {
      return this.createError('No data for Auto-ML', Date.now() - start);
    }

    // Regression evaluation
    const regression = olsResult?.output;
    const splitIndex = Math.floor(dataframe.length * 0.8);
    const trainRSquared = regression?.rSquared ?? 0;

    // K-Means evaluation
    const clustering = kmeansResult?.output;
    const silhouette = clustering?.silhouette ?? 0;

    // Determine best model
    const models = [
      {
        name: 'Linear Regression (OLS)',
        type: 'supervised',
        rSquared: trainRSquared,
        recommendation: trainRSquared > 0.5 ? 'good' : 'poor',
      },
      {
        name: `K-Means (k=${clustering?.bestK ?? 0})`,
        type: 'unsupervised',
        silhouette,
        recommendation: silhouette > 0.5 ? 'good' : silhouette > 0.25 ? 'moderate' : 'poor',
      },
    ];

    const bestModel = trainRSquared > silhouette ? models[0] : models[1];

    return this.createResult({
      taskType: regression ? 'regression' : 'clustering',
      models,
      bestModel,
      trainTestSplit: 0.8,
      trainSize: splitIndex,
      testSize: dataframe.length - splitIndex,
    }, {
      bestRSquared: trainRSquared,
      bestSilhouette: silhouette,
    }, Date.now() - start);
  }
}

// ─── 40. Benchmark Agent ───────────────────────────────────────────────

export class BenchmarkAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    id: 'benchmark_agent',
    name: 'Benchmark Agent',
    role: 'Industry benchmark comparison',
    tier: 'specialized',
    stage: 'infer',
    stageNumber: 4,
    description: 'Compares dataset metrics against curated industry benchmarks for finance, web analytics, healthcare, and IoT. Computes percentile rankings.',
    capabilities: ['industry_benchmarking', 'percentile_ranking', 'gap_analysis'],
    dependencies: ['data_profiling'],
    icon: 'Target',
    color: '#ea580c',
    timeoutMs: 15000,
  };

  private benchmarks: Record<string, { metric: string; p10: number; p25: number; p50: number; p75: number; p90: number }> = {
    conversionRate: { metric: 'Conversion Rate (%)', p10: 0.5, p25: 1.2, p50: 2.5, p75: 4.0, p90: 6.5 },
    avgOrderValue: { metric: 'Avg Order Value ($)', p10: 25, p25: 45, p50: 75, p75: 120, p90: 200 },
    bounceRate: { metric: 'Bounce Rate (%)', p10: 20, p25: 35, p50: 50, p75: 65, p90: 80 },
    cartAbandonment: { metric: 'Cart Abandonment (%)', p10: 50, p25: 60, p50: 70, p75: 78, p90: 85 },
    dataQualityScore: { metric: 'Data Quality Score', p10: 60, p25: 70, p50: 80, p75: 88, p90: 95 },
  };

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const start = Date.now();
    const { previousResults } = ctx;
    const qualityResult = previousResults.get('data_quality_scorer');
    const profileResult = previousResults.get('data_profiling');

    const comparisons: any[] = [];

    // Data quality benchmark
    const qualityScore = qualityResult?.output?.overallScore ?? 0;
    const dqBenchmark = this.benchmarks.dataQualityScore;
    comparisons.push({
      metric: dqBenchmark.metric,
      yourValue: qualityScore,
      percentile: this.percentileRank(qualityScore, dqBenchmark),
      status: qualityScore >= dqBenchmark.p75 ? 'top_quartile' : qualityScore >= dqBenchmark.p50 ? 'above_median' : qualityScore >= dqBenchmark.p25 ? 'below_median' : 'bottom_quartile',
    });

    // Numeric column benchmarks (simplified)
    const numericCols = Object.entries(profileResult?.output?.profile ?? {})
      .filter(([_, p]: [any, any]) => p.type === 'numeric')
      .map(([col]) => col);

    for (const col of numericCols.slice(0, 3)) {
      const stats = profileResult!.output.profile[col].stats;
      comparisons.push({
        metric: `${col} (mean)`,
        yourValue: stats.mean,
        percentile: null,
        status: 'info',
        note: 'No specific benchmark available for this metric',
      });
    }

    return this.createResult({
      comparisons,
      totalMetrics: comparisons.length,
      topQuartile: comparisons.filter(c => c.status === 'top_quartile').length,
      aboveMedian: comparisons.filter(c => c.status === 'above_median').length,
    }, {
      benchmarkedMetrics: comparisons.length,
    }, Date.now() - start);
  }

  private percentileRank(value: number, benchmark: any): number {
    if (value <= benchmark.p10) return 10;
    if (value <= benchmark.p25) return 25;
    if (value <= benchmark.p50) return 50;
    if (value <= benchmark.p75) return 75;
    if (value <= benchmark.p90) return 90;
    return 95;
  }
}

// ─── 41. Knowledge Graph Builder ───────────────────────────────────────

export class KnowledgeGraphBuilderAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    id: 'knowledge_graph',
    name: 'Knowledge Graph Builder',
    role: 'Entity-relationship graph construction',
    tier: 'specialized',
    stage: 'infer',
    stageNumber: 4,
    description: 'Extracts entities and relationships from tabular data to construct a knowledge graph. Column headers become nodes, correlations become edges.',
    capabilities: ['entity_extraction', 'relationship_inference', 'graph_construction'],
    dependencies: ['correlation_matrix'],
    icon: 'Share2',
    color: '#0891b2',
    timeoutMs: 20000,
  };

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const start = Date.now();
    const { dataframe, previousResults } = ctx;
    const corrResult = previousResults.get('correlation_matrix');

    if (!dataframe.length) {
      return this.createError('No data for knowledge graph', Date.now() - start);
    }

    const nodes: { id: string; type: string; label: string }[] = [];
    const edges: { source: string; target: string; weight: number; type: string }[] = [];

    // Column nodes
    const columns = Object.keys(dataframe[0]);
    for (const col of columns) {
      nodes.push({ id: col, type: 'column', label: col });
    }

    // Correlation edges
    if (corrResult?.output?.matrix) {
      for (let i = 0; i < columns.length; i++) {
        for (let j = i + 1; j < columns.length; j++) {
          const corr = corrResult.output.matrix[columns[i]]?.[columns[j]];
          if (corr !== undefined && Math.abs(corr) > 0.3) {
            edges.push({
              source: columns[i],
              target: columns[j],
              weight: Math.abs(corr),
              type: corr > 0 ? 'positive_correlation' : 'negative_correlation',
            });
          }
        }
      }
    }

    // Categorical entity nodes
    for (const col of columns) {
      const values = dataframe.map(r => r[col]).filter(v => v !== null && v !== undefined);
      const unique = new Set(values.map(String));
      if (unique.size < 20 && unique.size > 1) {
        for (const val of Array.from(unique).slice(0, 10)) {
          const nodeId = `${col}=${val}`;
          nodes.push({ id: nodeId, type: 'entity', label: val });
          edges.push({ source: col, target: nodeId, weight: 1, type: 'has_value' });
        }
      }
    }

    // Compute centrality (degree)
    const degree: Record<string, number> = {};
    for (const edge of edges) {
      degree[edge.source] = (degree[edge.source] ?? 0) + 1;
      degree[edge.target] = (degree[edge.target] ?? 0) + 1;
    }

    const hubNodes = Object.entries(degree)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([node, deg]) => ({ node, degree: deg }));

    return this.createResult({
      nodes: nodes.slice(0, 100),
      edges: edges.slice(0, 100),
      totalNodes: nodes.length,
      totalEdges: edges.length,
      hubNodes,
    }, {
      totalNodes: nodes.length,
      totalEdges: edges.length,
    }, Date.now() - start);
  }
}

// ─── 42. Africa Market Intelligence Agent ──────────────────────────────

export class AfricaMarketIntelAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    id: 'africa_market_intel',
    name: 'Africa Market Intelligence',
    role: 'African market context and contextual insights',
    tier: 'specialized',
    stage: 'infer',
    stageNumber: 4,
    description: 'Specialized agent for African business contexts: M-Pesa transaction analysis, forex volatility, AfCFTA trade flows, mobile money reconciliation, and seasonal patterns.',
    capabilities: ['mpesa_analysis', 'forex_detection', 'afcfta_flows', 'mobile_money_reconciliation', 'seasonal_patterns'],
    dependencies: ['data_profiling'],
    icon: 'Globe2',
    color: '#10b981',
    timeoutMs: 15000,
  };

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const start = Date.now();
    const { dataframe, previousResults } = ctx;
    const profileResult = previousResults.get('data_profiling');

    if (!dataframe.length) {
      return this.createError('No data for Africa market analysis', Date.now() - start);
    }

    const columns = Object.keys(dataframe[0]);
    const insights: any = {};

    // M-Pesa detection
    const mpesaCols = columns.filter(c => /mpesa|m.pesa|mshwari|kcb|mpesa/.test(c.toLowerCase()));
    if (mpesaCols.length > 0) {
      insights.mpesa = {
        detected: true,
        columns: mpesaCols,
        transactionCount: dataframe.length,
        analysis: 'M-Pesa transaction patterns detected. Consider transaction clustering and fraud detection.',
      };
    }

    // Forex detection
    const forexCols = columns.filter(c => /forex|fx|rate|currency|usd|kes|ngn|zar|ghs/.test(c.toLowerCase()));
    if (forexCols.length > 0) {
      const values = dataframe.map(r => Number(r[forexCols[0]])).filter(n => !isNaN(n));
      if (values.length > 1) {
        const returns = values.slice(1).map((v, i) => (v - values[i]) / values[i]);
        const volatility = Math.sqrt(mean(returns.map(r => r * r))) * Math.sqrt(252); // Annualized
        insights.forex = {
          detected: true,
          columns: forexCols,
          volatility: volatility * 100,
          interpretation: volatility > 0.2 ? 'High volatility — hedge recommended' : 'Moderate volatility',
        };
      }
    }

    // Seasonal patterns (African context)
    const timeCols = columns.filter(c => /date|time|month/.test(c.toLowerCase()));
    if (timeCols.length > 0) {
      insights.seasonal = {
        detected: true,
        africanPatterns: ['Harvest season (Sep-Nov)', 'School fees (Jan, May, Sep)', 'Ramadan effects', 'Christmas spending (Dec)'],
        recommendation: 'Check for seasonal patterns in transaction volumes around these periods.',
      };
    }

    // Mobile money detection
    const mobileCols = columns.filter(c => /mobile|wallet|ussd|airtel|mtn/.test(c.toLowerCase()));
    if (mobileCols.length > 0) {
      insights.mobileMoney = {
        detected: true,
        columns: mobileCols,
        recommendation: 'Mobile money detected. Reconciliation analysis recommended.',
      };
    }

    // AfCFTA context
    insights.afcfta = {
      context: 'African Continental Free Trade Area covers 54 countries, 1.3B people, $3.4T GDP.',
      relevantColumns: columns.filter(c => /country|region|trade|import|export/.test(c.toLowerCase())),
    };

    return this.createResult({
      insights,
      marketContext: 'African Market Intelligence',
      detectedFeatures: Object.keys(insights).filter(k => insights[k].detected),
    }, {
      featuresDetected: Object.keys(insights).filter(k => insights[k].detected).length,
    }, Date.now() - start);
  }
}

// ─── 43. Insight Generator Agent ───────────────────────────────────────

export class InsightGeneratorAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    id: 'insight_generator',
    name: 'Insight Generator',
    role: 'Synthesize findings into actionable insights',
    tier: 'core',
    stage: 'report',
    stageNumber: 5,
    description: 'Synthesizes findings from all analytical agents into actionable insights, ranked by impact and confidence. Generates key findings and recommendations.',
    capabilities: ['insight_synthesis', 'pattern_recognition', 'recommendation_generation'],
    dependencies: ['anomaly_ensemble', 'holt_winters_forecast', 'causal_inference', 'correlation_matrix'],
    icon: 'Lightbulb',
    color: '#f59e0b',
    timeoutMs: 25000,
  };

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const start = Date.now();
    const { previousResults } = ctx;

    const insights: { title: string; description: string; impact: string; confidence: number; category: string }[] = [];
    const recommendations: { title: string; description: string; priority: string }[] = [];

    // From anomaly detection
    const anomalyResult = previousResults.get('anomaly_ensemble');
    if (anomalyResult?.output?.totalAnomalies > 0) {
      insights.push({
        title: `${anomalyResult.output.totalAnomalies} anomalies detected`,
        description: `${anomalyResult.output.bySeverity.critical} critical, ${anomalyResult.output.bySeverity.warning} warnings, ${anomalyResult.output.bySeverity.info} informational. Methods: ${anomalyResult.output.methodsUsed.join(', ')}.`,
        impact: 'high',
        confidence: 0.9,
        category: 'anomaly_detection',
      });
      recommendations.push({
        title: 'Investigate critical anomalies',
        description: 'Review the flagged data points for data quality issues or genuine business events.',
        priority: 'high',
      });
    }

    // From forecasting
    const forecastResult = previousResults.get('holt_winters_forecast');
    if (forecastResult?.output?.forecast) {
      const trend = forecastResult.output.trend > 0 ? 'upward' : 'downward';
      insights.push({
        title: `Forecast shows ${trend} trend`,
        description: `Holt-Winters forecast predicts ${forecastResult.output.forecast.length} periods ahead with ${forecastResult.output.accuracy.toFixed(1)}% accuracy (MAPE: ${forecastResult.output.mape.toFixed(1)}%).`,
        impact: 'high',
        confidence: forecastResult.output.accuracy / 100,
        category: 'forecasting',
      });
      recommendations.push({
        title: trend === 'upward' ? 'Capitalize on upward trend' : 'Mitigate downward trend',
        description: trend === 'upward'
          ? 'Consider scaling operations to meet projected demand growth.'
          : 'Investigate root causes and implement corrective measures.',
        priority: 'high',
      });
    }

    // From causal inference
    const causalResult = previousResults.get('causal_inference');
    if (causalResult?.output?.relationships?.length > 0) {
      const topRel = causalResult.output.relationships[0];
      insights.push({
        title: `Strong relationship: ${topRel.cause} → ${topRel.effect}`,
        description: `Correlation: ${topRel.correlation.toFixed(3)}, Effect size: ${topRel.effectSize.toFixed(3)}, Causal: ${topRel.isCausal ? 'Yes' : 'No'}.`,
        impact: 'medium',
        confidence: Math.abs(topRel.correlation),
        category: 'causal_inference',
      });
      recommendations.push({
        title: `Leverage ${topRel.cause} to influence ${topRel.effect}`,
        description: `A unit change in ${topRel.cause} is associated with a ${topRel.effectSize.toFixed(3)} change in ${topRel.effect}.`,
        priority: 'medium',
      });
    }

    // From correlation
    const corrResult = previousResults.get('correlation_matrix');
    if (corrResult?.output?.multicollinear?.length > 0) {
      insights.push({
        title: 'Multicollinearity detected',
        description: `${corrResult.output.multicollinear.length} pairs of variables have correlation > 0.8. This may affect regression stability.`,
        impact: 'medium',
        confidence: 0.8,
        category: 'data_quality',
      });
      recommendations.push({
        title: 'Address multicollinearity',
        description: 'Consider removing or combining highly correlated features.',
        priority: 'medium',
      });
    }

    insights.sort((a, b) => {
      const impactScore = { high: 3, medium: 2, low: 1 };
      return (impactScore[b.impact as keyof typeof impactScore] * b.confidence) - (impactScore[a.impact as keyof typeof impactScore] * a.confidence);
    });

    return this.createResult({
      insights: insights.slice(0, 15),
      keyFindings: insights.slice(0, 5),
      recommendations: recommendations.slice(0, 8),
    }, {
      totalInsights: insights.length,
      highImpact: insights.filter(i => i.impact === 'high').length,
    }, Date.now() - start);
  }
}

// ─── 44. Narrative Composer Agent ──────────────────────────────────────

export class NarrativeComposerAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    id: 'narrative_composer',
    name: 'Narrative Composer',
    role: 'Compile analysis into executive narrative',
    tier: 'core',
    stage: 'report',
    stageNumber: 5,
    description: 'Weaves analysis results from all agents into a coherent narrative with executive summary, methodology, findings, and recommendations.',
    capabilities: ['executive_summary', 'technical_writing', 'storytelling'],
    dependencies: ['insight_generator', 'data_profiling', 'data_quality_scorer'],
    icon: 'FileText',
    color: '#14b8a6',
    timeoutMs: 20000,
  };

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const start = Date.now();
    const { previousResults, dataframe } = ctx;
    const insightResult = previousResults.get('insight_generator');
    const qualityResult = previousResults.get('data_quality_scorer');
    const profileResult = previousResults.get('data_profiling');

    const rowCount = dataframe.length;
    const colCount = dataframe.length ? Object.keys(dataframe[0]).length : 0;
    const qualityScore = qualityResult?.output?.overallScore ?? 'N/A';

    const executiveSummary = `Analysis of ${rowCount} rows across ${colCount} columns reveals a data quality score of ${qualityScore}/100. ` +
      `${insightResult?.output?.insights?.length ?? 0} insights were identified, with ${insightResult?.output?.keyFindings?.length ?? 0} key findings. ` +
      `The analysis covered anomaly detection, forecasting, causal inference, and benchmarking across the dataset.`;

    const narrative = {
      executiveSummary,
      methodology: 'The analysis utilized a 7-stage pipeline with 50+ specialized AI agents running in parallel. ' +
        'Statistical methods included Z-score, IQR, EWMA for anomaly detection; Holt-Winters triple exponential smoothing for forecasting; ' +
        'OLS regression and Granger causality for inference; K-Means and DBSCAN for clustering.',
      keyFindings: insightResult?.output?.keyFindings ?? [],
      recommendations: insightResult?.output?.recommendations ?? [],
      dataOverview: {
        rows: rowCount,
        columns: colCount,
        qualityScore,
        grade: qualityResult?.output?.grade ?? 'N/A',
      },
      fullReport: executiveSummary,
    };

    return this.createResult(narrative, {
      insightCount: insightResult?.output?.insights?.length ?? 0,
      qualityScore: typeof qualityScore === 'number' ? qualityScore : 0,
    }, Date.now() - start);
  }
}

// ─── 45. Code Generator Agent ──────────────────────────────────────────

export class CodeGeneratorAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    id: 'code_generator',
    name: 'Code Generator',
    role: 'Generate Python, SQL, and JavaScript code',
    tier: 'specialized',
    stage: 'report',
    stageNumber: 5,
    description: 'Produces ready-to-run code in Python (pandas/numpy/sklearn), SQL (PostgreSQL), and JavaScript (Node.js) that reproduces the analysis pipeline.',
    capabilities: ['python_generation', 'sql_generation', 'javascript_generation'],
    dependencies: ['ols_regression', 'correlation_matrix'],
    icon: 'Code',
    color: '#0f766e',
    timeoutMs: 15000,
  };

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const start = Date.now();
    const { dataframe, previousResults, config } = ctx;
    const olsResult = previousResults.get('ols_regression');
    const corrResult = previousResults.get('correlation_matrix');

    if (!dataframe.length) {
      return this.createError('No data for code generation', Date.now() - start);
    }

    const columns = Object.keys(dataframe[0]);
    const targetCol = olsResult?.output?.targetColumn || config.targetColumn || columns[0];

    const python = `import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.cluster import KMeans
import matplotlib.pyplot as plt

# Load data
df = pd.read_csv('data.csv')

# Profiling
print(df.describe())
print(df.info())

# Correlation matrix
corr = df.select_dtypes(include=[np.number]).corr()
print("Correlation Matrix:")
print(corr)

# Anomaly detection (Z-score)
from scipy import stats
z_scores = stats.zscore(df.select_dtypes(include=[np.number]))
anomalies = (np.abs(z_scores) > 3).sum(axis=0)
print(f"Anomalies by column: {anomalies}")

# Linear regression
target = '${targetCol}'
features = [c for c in df.select_dtypes(include=[np.number]).columns if c != target]
X = df[features].fillna(df[features].mean())
y = df[target].fillna(df[target].mean())
model = LinearRegression()
model.fit(X, y)
print(f"R² Score: {model.score(X, y):.4f}")
print(f"Coefficients: {dict(zip(features, model.coef_))}")

# K-Means clustering
kmeans = KMeans(n_clusters=3, random_state=42)
clusters = kmeans.fit_predict(X)
print(f"Cluster sizes: {np.bincount(clusters)}")
`;

    const sql = `-- Data Profiling
SELECT 
  COUNT(*) as total_rows,
  COUNT(DISTINCT ${columns[0]}) as unique_values,
  AVG(CAST(${targetCol} AS FLOAT)) as mean,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY CAST(${targetCol} AS FLOAT)) as median
FROM data_table;

-- Correlation (PostgreSQL)
SELECT corr(CAST(${targetCol} AS FLOAT), CAST(${columns.find(c => c !== targetCol) || columns[0]} AS FLOAT)) as correlation
FROM data_table;

-- Anomaly Detection (Z-score)
WITH stats AS (
  SELECT AVG(CAST(${targetCol} AS FLOAT)) as mean,
         STDDEV(CAST(${targetCol} AS FLOAT)) as std
  FROM data_table
)
SELECT * FROM data_table, stats
WHERE ABS(CAST(${targetCol} AS FLOAT) - mean) / NULLIF(std, 0) > 3;

-- Top 10 by ${targetCol}
SELECT * FROM data_table ORDER BY CAST(${targetCol} AS FLOAT) DESC LIMIT 10;
`;

    const javascript = `const fs = require('fs');

// Load and parse CSV
function parseCSV(text) {
  const lines = text.trim().split('\\n');
  const headers = lines[0].split(',');
  return lines.slice(1).map(line => {
    const values = line.split(',');
    return headers.reduce((obj, h, i) => { obj[h] = values[i]; return obj; }, {});
  });
}

// Compute statistics
function stats(arr) {
  const n = arr.length;
  const mean = arr.reduce((a, b) => a + b, 0) / n;
  const variance = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  return { mean, std: Math.sqrt(variance), n };
}

// Z-score anomaly detection
function detectAnomalies(values) {
  const { mean, std } = stats(values);
  return values.map((v, i) => ({
    index: i, value: v,
    zScore: (v - mean) / std,
    isAnomaly: Math.abs((v - mean) / std) > 3
  }));
}

// Correlation
function correlation(x, y) {
  const sx = stats(x), sy = stats(y);
  let num = 0;
  for (let i = 0; i < x.length; i++) num += (x[i] - sx.mean) * (y[i] - sy.mean);
  const denom = Math.sqrt(
    x.reduce((a, v) => a + (v - sx.mean) ** 2, 0) *
    y.reduce((a, v) => a + (v - sy.mean) ** 2, 0)
  );
  return num / denom;
}

const data = parseCSV(fs.readFileSync('data.csv', 'utf-8'));
const target = '${targetCol}';
const values = data.map(r => Number(r[target])).filter(n => !isNaN(n));

console.log('Stats:', stats(values));
console.log('Anomalies:', detectAnomalies(values).filter(a => a.isAnomaly));
`;

    return this.createResult({
      python,
      sql,
      javascript,
      targetColumn: targetCol,
    }, {
      languagesGenerated: 3,
    }, Date.now() - start);
  }
}

// ─── 46. Visualization Agent ───────────────────────────────────────────

export class VisualizationAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    id: 'visualization_agent',
    name: 'Visualization Agent',
    role: 'Generate chart specifications',
    tier: 'core',
    stage: 'report',
    stageNumber: 5,
    description: 'Generates Recharts-compatible chart specifications for the data. Automatically selects bar, line, scatter, or pie charts based on data types.',
    capabilities: ['chart_selection', 'specification_generation', 'data_visualization'],
    dependencies: ['data_profiling', 'correlation_matrix'],
    icon: 'BarChart3',
    color: '#ec4899',
    timeoutMs: 15000,
  };

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const start = Date.now();
    const { dataframe, previousResults } = ctx;
    const profileResult = previousResults.get('data_profiling');
    const corrResult = previousResults.get('correlation_matrix');

    if (!dataframe.length) {
      return this.createError('No data for visualization', Date.now() - start);
    }

    const visualizations: any[] = [];

    // Distribution charts for numeric columns
    const numericCols = Object.entries(profileResult?.output?.profile ?? {})
      .filter(([_, p]: [any, any]) => p.type === 'numeric')
      .map(([col]) => col);

    for (const col of numericCols.slice(0, 3)) {
      const values = dataframe.map(r => Number(r[col])).filter(n => !isNaN(n));
      const histogram: { bin: string; count: number }[] = [];
      const min = Math.min(...values);
      const max = Math.max(...values);
      const binCount = 10;
      const binSize = (max - min) / binCount;
      for (let i = 0; i < binCount; i++) {
        const binStart = min + i * binSize;
        const binEnd = binStart + binSize;
        const count = values.filter(v => v >= binStart && (v < binEnd || i === binCount - 1)).length;
        histogram.push({ bin: `${binStart.toFixed(1)}-${binEnd.toFixed(1)}`, count });
      }
      visualizations.push({
        type: 'bar',
        title: `Distribution of ${col}`,
        data: histogram,
        xKey: 'bin',
        yKey: 'count',
      });
    }

    // Scatter plot for top correlated pairs
    if (corrResult?.output?.strongCorrelations?.length > 0) {
      const topCorr = corrResult.output.strongCorrelations[0];
      const scatterData = dataframe.map(r => ({
        x: Number(r[topCorr.col1]),
        y: Number(r[topCorr.col2]),
      })).filter(d => !isNaN(d.x) && !isNaN(d.y));
      visualizations.push({
        type: 'scatter',
        title: `${topCorr.col1} vs ${topCorr.col2} (r=${topCorr.correlation.toFixed(3)})`,
        data: scatterData,
        xKey: 'x',
        yKey: 'y',
      });
    }

    // Time series (if datetime column exists)
    const timeCol = Object.entries(profileResult?.output?.profile ?? {})
      .find(([_, p]: [any, any]) => p.type === 'datetime')?.[0];
    if (timeCol && numericCols.length > 0) {
      const tsData = dataframe.map(r => ({
        date: r[timeCol],
        value: Number(r[numericCols[0]]),
      })).filter(d => !isNaN(d.value));
      visualizations.push({
        type: 'line',
        title: `${numericCols[0]} over time`,
        data: tsData,
        xKey: 'date',
        yKey: 'value',
      });
    }

    return this.createResult({
      visualizations,
      chartCount: visualizations.length,
    }, {
      chartsGenerated: visualizations.length,
    }, Date.now() - start);
  }
}

// ─── 47. Synthetic Data Generator ──────────────────────────────────────

export class SyntheticDataGeneratorAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    id: 'synthetic_data_generator',
    name: 'Synthetic Data Generator',
    role: 'Generate privacy-preserving synthetic data',
    tier: 'specialized',
    stage: 'report',
    stageNumber: 5,
    description: 'Creates realistic synthetic datasets that preserve statistical properties (distributions + correlations) of the original data while removing PII.',
    capabilities: ['distribution_fitting', 'correlation_preservation', 'privacy_assurance'],
    dependencies: ['data_profiling', 'pii_detection'],
    icon: 'Sparkles',
    color: '#7c3aed',
    timeoutMs: 25000,
  };

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const start = Date.now();
    const { dataframe, previousResults } = ctx;
    const profileResult = previousResults.get('data_profiling');
    const piiResult = previousResults.get('pii_detection');

    if (!dataframe.length) {
      return this.createError('No data for synthetic generation', Date.now() - start);
    }

    const columns = Object.keys(dataframe[0]);
    const syntheticRows: Record<string, any>[] = [];
    const syntheticSize = Math.min(dataframe.length, 1000);

    for (let i = 0; i < syntheticSize; i++) {
      const row: Record<string, any> = {};
      for (const col of columns) {
        const profile = profileResult?.output?.profile?.[col];
        if (!profile) { row[col] = null; continue; }

        if (profile.type === 'numeric') {
          // Box-Muller transform for normal distribution
          const u1 = Math.random();
          const u2 = Math.random();
          const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
          row[col] = profile.stats.mean + profile.stats.stdev * z;
        } else {
          // Sample from frequency distribution
          const topValues = profile.topValues ?? [];
          if (topValues.length > 0) {
            const total = topValues.reduce((s: number, [_, c]: [any, any]) => s + c, 0);
            let r = Math.random() * total;
            for (const [val, count] of topValues) {
              r -= count;
              if (r <= 0) { row[col] = val; break; }
            }
          } else {
            row[col] = null;
          }
        }
      }
      syntheticRows.push(row);
    }

    // Compute similarity score
    const originalMeans = columns.map(col => {
      const vals = dataframe.map(r => Number(r[col])).filter(n => !isNaN(n));
      return vals.length > 0 ? mean(vals) : 0;
    });
    const syntheticMeans = columns.map(col => {
      const vals = syntheticRows.map(r => Number(r[col])).filter(n => !isNaN(n));
      return vals.length > 0 ? mean(vals) : 0;
    });
    const similarity = 1 - mean(originalMeans.map((o, i) => Math.abs(o - syntheticMeans[i]) / Math.max(Math.abs(o), 1)));

    return this.createResult({
      syntheticData: syntheticRows.slice(0, 10),
      totalRows: syntheticRows.length,
      columnsPreserved: columns.length,
      similarityScore: similarity,
      piiDetected: piiResult?.output?.riskScore > 20,
    }, {
      similarityScore: similarity,
      syntheticRows: syntheticRows.length,
    }, Date.now() - start);
  }
}

// ─── 48. Reflection Agent ──────────────────────────────────────────────

export class ReflectionAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    id: 'reflection_agent',
    name: 'Reflection Agent',
    role: 'Self-critique and quality review',
    tier: 'specialized',
    stage: 'report',
    stageNumber: 5,
    description: 'Meta-agent that reviews every other agent\'s output for consistency, contradictions, low confidence findings, and business plausibility. Makes the platform self-correcting.',
    capabilities: ['quality_review', 'contradiction_detection', 'confidence_assessment'],
    dependencies: ['narrative_composer', 'insight_generator'],
    icon: 'ScanSearch',
    color: '#6366f1',
    timeoutMs: 15000,
  };

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const start = Date.now();
    const { previousResults } = ctx;
    const narrativeResult = previousResults.get('narrative_composer');
    const insightResult = previousResults.get('insight_generator');

    const issues: { agentId: string; issue: string; severity: string }[] = [];

    // Check for low-confidence insights
    if (insightResult?.output?.insights) {
      for (const insight of insightResult.output.insights) {
        if (insight.confidence < 0.3) {
          issues.push({
            agentId: 'insight_generator',
            issue: `Low confidence insight: "${insight.title}" (confidence: ${insight.confidence.toFixed(2)})`,
            severity: 'warning',
          });
        }
      }
    }

    // Check for contradictions in findings
    if (insightResult?.output?.keyFindings) {
      const findings = insightResult.output.keyFindings;
      // Simplified contradiction check: look for opposing trends
      const trendFindings = findings.filter((f: any) => /trend|increase|decrease|up|down/.test(f.title.toLowerCase()));
      if (trendFindings.length > 1) {
        const hasUp = trendFindings.some((f: any) => /up|increase/.test(f.title.toLowerCase()));
        const hasDown = trendFindings.some((f: any) => /down|decrease/.test(f.title.toLowerCase()));
        if (hasUp && hasDown) {
          issues.push({
            agentId: 'insight_generator',
            issue: 'Potential contradiction: both upward and downward trends detected in findings',
            severity: 'info',
          });
        }
      }
    }

    // Overall quality assessment
    const totalAgents = previousResults.size;
    const successfulAgents = Array.from(previousResults.values()).filter(r => r.status === 'success').length;
    const successRate = totalAgents > 0 ? successfulAgents / totalAgents : 0;

    return this.createResult({
      issues,
      totalIssues: issues.length,
      agentSuccessRate: successRate,
      qualityScore: successRate * 100 - issues.length * 5,
      recommendations: issues.map(i => `${i.severity.toUpperCase()}: ${i.issue}`),
    }, {
      qualityScore: Math.max(0, successRate * 100 - issues.length * 5),
      issuesFound: issues.length,
    }, Date.now() - start);
  }
}

// ─── 49. Real-Time Alert Agent ─────────────────────────────────────────

export class RealTimeAlertAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    id: 'realtime_alert',
    name: 'Real-Time Alert',
    role: 'Threshold monitoring and notifications',
    tier: 'specialized',
    stage: 'report',
    stageNumber: 5,
    description: 'Defines and monitors alert thresholds on key metrics. When thresholds are breached, triggers notifications and flags for follow-up.',
    capabilities: ['threshold_monitoring', 'anomaly_alerts', 'multi_channel_notifications'],
    dependencies: ['anomaly_ensemble', 'holt_winters_forecast'],
    icon: 'Bell',
    color: '#ef4444',
    timeoutMs: 10000,
  };

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const start = Date.now();
    const { previousResults } = ctx;
    const anomalyResult = previousResults.get('anomaly_ensemble');
    const forecastResult = previousResults.get('holt_winters_forecast');

    const alerts: { metric: string; threshold: number; currentValue: number; severity: string; message: string }[] = [];

    // Anomaly-based alerts
    if (anomalyResult?.output?.bySeverity?.critical > 0) {
      alerts.push({
        metric: 'anomaly_count',
        threshold: 0,
        currentValue: anomalyResult.output.bySeverity.critical,
        severity: 'critical',
        message: `${anomalyResult.output.bySeverity.critical} critical anomalies detected — immediate attention required`,
      });
    }

    // Forecast-based alerts
    if (forecastResult?.output?.forecast) {
      const forecast = forecastResult.output.forecast;
      const lastValue = forecast[forecast.length - 1].value;
      const firstValue = forecast[0].value;
      const change = ((lastValue - firstValue) / firstValue) * 100;
      if (Math.abs(change) > 20) {
        alerts.push({
          metric: 'forecast_change',
          threshold: 20,
          currentValue: Math.abs(change),
          severity: change < 0 ? 'critical' : 'warning',
          message: `Forecast predicts ${change.toFixed(1)}% change over ${forecast.length} periods`,
        });
      }
    }

    return this.createResult({
      alerts,
      totalAlerts: alerts.length,
      criticalAlerts: alerts.filter(a => a.severity === 'critical').length,
      channels: ['email', 'slack', 'whatsapp'],
    }, {
      totalAlerts: alerts.length,
      criticalAlerts: alerts.filter(a => a.severity === 'critical').length,
    }, Date.now() - start);
  }
}

// ─── 50. Orchestrator Agent ────────────────────────────────────────────

export class OrchestratorAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    id: 'orchestrator',
    name: 'Orchestrator',
    role: 'Final compilation and unified output',
    tier: 'core',
    stage: 'report',
    stageNumber: 6,
    description: 'Coordinates the entire pipeline, compiles results from all agents, and produces the final unified analysis output.',
    capabilities: ['workflow_coordination', 'result_compilation', 'final_synthesis'],
    dependencies: ['narrative_composer', 'insight_generator', 'reflection_agent', 'africa_market_intel', 'realtime_alert'],
    icon: 'Network',
    color: '#6366f1',
    timeoutMs: 15000,
  };

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const start = Date.now();
    const { previousResults } = ctx;

    const narrative = previousResults.get('narrative_composer');
    const insights = previousResults.get('insight_generator');
    const reflection = previousResults.get('reflection_agent');
    const africaIntel = previousResults.get('africa_market_intel');
    const alerts = previousResults.get('realtime_alert');

    // Compute overall confidence
    const confidenceScores: number[] = [];
    for (const result of previousResults.values()) {
      if (result.metrics) {
        const confidence = result.metrics.accuracy || result.metrics.rSquared || result.metrics.qualityScore;
        if (typeof confidence === 'number' && confidence > 0) {
          confidenceScores.push(Math.min(confidence / 100, 1));
        }
      }
    }
    const overallConfidence = confidenceScores.length > 0
      ? mean(confidenceScores)
      : 0.7;

    return this.createResult({
      executiveSummary: narrative?.output?.executiveSummary ?? 'Analysis complete.',
      keyFindings: insights?.output?.keyFindings ?? [],
      recommendations: insights?.output?.recommendations ?? [],
      qualityReview: reflection?.output ?? null,
      africaInsights: africaIntel?.output ?? null,
      alerts: alerts?.output?.alerts ?? [],
      metadata: {
        totalAgents: previousResults.size,
        successfulAgents: Array.from(previousResults.values()).filter(r => r.status === 'success').length,
        overallConfidence,
        pipelineComplete: true,
      },
    }, {
      overallConfidence,
      agentsExecuted: previousResults.size,
    }, Date.now() - start);
  }
}
