/**
 * Forecasting Oracle Agent
 * ========================
 * 
 * Stage 2 - Detect
 * 
 * Responsible for time series forecasting using Holt-Winters triple exponential smoothing.
 * Provides trend analysis, seasonality detection, and confidence intervals.
 */

import { z } from 'zod';
import {
  AgentStage,
  AgentTier,
  AgentStability,
} from '@busara/core';
import {
  BaseAgent,
  EnhancedAgentMetadata,
  EnhancedAgentContext,
  AgentResult,
  createAgentMetadata,
} from '../../core';
import { mean, stdev, movingAverage, ewma } from '../../math';

// ============================================================================
// Agent Metadata
// ============================================================================

const metadata = createAgentMetadata({
  // Identity
  id: 'forecasting_oracle',
  name: 'Forecasting Oracle',
  description: 'Performs time series forecasting using Holt-Winters triple exponential smoothing with trend and seasonality detection, providing confidence intervals and forecast horizons.',
  version: '1.0.0',
  
  // Classification
  stage: 'detect' as AgentStage,
  stageNumber: 2,
  tier: 'core' as AgentTier,
  stability: 'stable' as AgentStability,
  
  // Author
  author: 'Busara Team',
  license: 'MIT',
  
  // Dependencies
  dependencies: ['data_ingestion', 'schema_inference', 'data_cleaner', 'data_engineer'],
  
  // Execution
  timeoutMs: 45000,
  maxRetries: 3,
  
  // Capabilities
  capabilities: [
    'time_series_forecasting',
    'holt_winters',
    'trend_analysis',
    'seasonality_detection',
    'confidence_intervals',
    'forecast_horizon',
  ],
  category: 'analysis',
  tags: ['forecasting', 'time-series', 'holt-winters', 'trend', 'seasonality'],
  
  // Input/Output
  inputDescription: 'Cleaned and engineered dataframe with datetime columns',
  outputDescription: 'Forecasting results with trend, seasonality, and confidence intervals',
  inputSchema: {
    schema: z.object({
      dataframe: z.array(z.record(z.unknown())),
      schema: z.record(z.string(), z.object({
        type: z.string(),
        confidence: z.number(),
        nullCount: z.number(),
        uniqueCount: z.number(),
      })),
      cleaningReport: z.object({}).optional(),
      engineeringReport: z.object({}).optional(),
    }),
    description: 'Cleaned and engineered dataframe with schema and reports',
  },
  outputSchema: {
    schema: z.object({
      forecasts: z.array(z.object({
        datetimeColumn: z.string(),
        targetColumn: z.string(),
        timePeriod: z.string(),
        actualValue: z.number().nullable(),
        forecastedValue: z.number(),
        confidenceInterval: z.object({
          lower: z.number(),
          upper: z.number(),
          width: z.number(),
        }),
        components: z.object({
          level: z.number(),
          trend: z.number(),
          seasonality: z.number(),
        }),
        error: z.number().nullable(),
        errorPercentage: z.number().nullable(),
      })),
      summary: z.object({
        datetimeColumns: z.array(z.string()),
        targetColumns: z.array(z.string()),
        forecastHorizon: z.number(),
        overallAccuracy: z.number().nullable(),
        trendStrength: z.number(),
        seasonalityStrength: z.number(),
        seasonalityPeriod: z.number().nullable(),
        modelParameters: z.object({
          alpha: z.number(),
          beta: z.number(),
          gamma: z.number(),
          seasonLength: z.number(),
        }),
      }),
      trendAnalysis: z.object({
        hasTrend: z.boolean(),
        trendDirection: z.enum(['increasing', 'decreasing', 'stable']).nullable(),
        trendStrength: z.number(),
        trendSlope: z.number().nullable(),
        trendEquation: z.string().nullable(),
      }),
      seasonalityAnalysis: z.object({
        hasSeasonality: z.boolean(),
        seasonalityPeriod: z.number().nullable(),
        seasonalityStrength: z.number(),
        seasonalPattern: z.array(z.number()).nullable(),
      }),
      recommendations: z.array(z.string()),
    }),
    description: 'Forecasting results with trend, seasonality, and confidence intervals',
  },
  configSchema: {
    schema: z.object({
      // Target column
      targetColumn: z.string().optional(),
      datetimeColumn: z.string().optional(),
      
      // Forecast settings
      forecastHorizon: z.number().int().positive().max(100).default(10),
      confidenceLevel: z.number().min(0).max(1).default(0.95),
      
      // Model parameters
      model: z.object({
        type: z.enum(['simple', 'holt', 'winters']).default('winters'),
        alpha: z.number().min(0).max(1).default(0.3),
        beta: z.number().min(0).max(1).default(0.1),
        gamma: z.number().min(0).max(1).default(0.1),
        seasonLength: z.number().int().positive().max(50).default(12),
      }).default({}),
      
      // Trend analysis
      trendAnalysis: z.object({
        enabled: z.boolean().default(true),
        method: z.enum(['linear', 'polynomial', 'ewma']).default('linear'),
        degree: z.number().int().positive().max(5).default(1),
      }).default({}),
      
      // Seasonality analysis
      seasonalityAnalysis: z.object({
        enabled: z.boolean().default(true),
        maxPeriod: z.number().int().positive().max(50).default(24),
        minStrength: z.number().min(0).max(1).default(0.3),
      }).default({}),
      
      // Validation
      validate: z.object({
        enabled: z.boolean().default(true),
        trainTestSplit: z.number().min(0).max(1).default(0.8),
      }).default({}),
      
      // Output
      includeComponents: z.boolean().default(true),
      includeConfidenceIntervals: z.boolean().default(true),
      includeRecommendations: z.boolean().default(true),
    }),
    defaults: {
      forecastHorizon: 10,
      confidenceLevel: 0.95,
      model: {
        type: 'winters',
        alpha: 0.3,
        beta: 0.1,
        gamma: 0.1,
        seasonLength: 12,
      },
      trendAnalysis: {
        enabled: true,
        method: 'linear',
        degree: 1,
      },
      seasonalityAnalysis: {
        enabled: true,
        maxPeriod: 24,
        minStrength: 0.3,
      },
      validate: {
        enabled: true,
        trainTestSplit: 0.8,
      },
      includeComponents: true,
      includeConfidenceIntervals: true,
      includeRecommendations: true,
    },
    description: 'Forecasting configuration',
  },
  
  // Technical requirements
  memoryLimitMB: 1024,
  cpuLimit: 4,
  gpuRequired: false,
  
  // UI
  icon: 'TrendingUp',
  color: '#06b6d4',
});

// ============================================================================
// Agent Implementation
// ============================================================================

/**
 * ForecastingOracleAgent performs time series forecasting.
 */
export class ForecastingOracleAgent extends BaseAgent {
  readonly metadata: EnhancedAgentMetadata = metadata;
  
  async execute(context: EnhancedAgentContext): Promise<AgentResult> {
    const start = Date.now();
    const { dataframe, config, previousResults } = context;
    
    try {
      // Validate input
      if (!dataframe || !Array.isArray(dataframe) || dataframe.length === 0) {
        return this.createError('No data provided for forecasting', Date.now() - start);
      }
      
      // Get schema from previous results
      const schemaResult = previousResults.get('schema_inference');
      const schema = schemaResult?.output?.schema ?? {};
      
      // Get configuration
      const targetColumn = config.targetColumn;
      const datetimeColumn = config.datetimeColumn;
      const forecastHorizon = config.forecastHorizon ?? 10;
      const confidenceLevel = config.confidenceLevel ?? 0.95;
      const modelConfig = config.model ?? {};
      const trendConfig = config.trendAnalysis ?? {};
      const seasonalityConfig = config.seasonalityAnalysis ?? {};
      const validateConfig = config.validate ?? {};
      const includeComponents = config.includeComponents ?? true;
      const includeConfidenceIntervals = config.includeConfidenceIntervals ?? true;
      const includeRecommendations = config.includeRecommendations ?? true;
      
      // Find datetime and target columns if not specified
      const detectedDatetimeColumns = Object.entries(schema)
        .filter(([_, s]) => s.type === 'datetime')
        .map(([col]) => col);
      
      const detectedNumericColumns = Object.entries(schema)
        .filter(([_, s]) => s.type === 'integer' || s.type === 'float')
        .map(([col]) => col);
      
      const finalDatetimeColumn = datetimeColumn ?? detectedDatetimeColumns[0];
      const finalTargetColumn = targetColumn ?? detectedNumericColumns[0];
      
      if (!finalDatetimeColumn) {
        return this.createError('No datetime column found for forecasting', Date.now() - start);
      }
      
      if (!finalTargetColumn) {
        return this.createError('No numeric column found for forecasting', Date.now() - start);
      }
      
      // Extract time series data
      const timeSeriesData = this.extractTimeSeries(
        dataframe,
        finalDatetimeColumn,
        finalTargetColumn
      );
      
      if (timeSeriesData.length === 0) {
        return this.createError('No valid time series data found', Date.now() - start);
      }
      
      // Sort by datetime
      timeSeriesData.sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
      
      // Analyze trend
      const trendAnalysis = trendConfig.enabled
        ? this.analyzeTrend(timeSeriesData, trendConfig)
        : {
            hasTrend: false,
            trendDirection: null,
            trendStrength: 0,
            trendSlope: null,
            trendEquation: null,
          };
      
      // Analyze seasonality
      const seasonalityAnalysis = seasonalityConfig.enabled
        ? this.analyzeSeasonality(timeSeriesData, seasonalityConfig)
        : {
            hasSeasonality: false,
            seasonalityPeriod: null,
            seasonalityStrength: 0,
            seasonalPattern: null,
          };
      
      // Determine model type based on analysis
      const modelType = this.determineModelType(
        trendAnalysis.hasTrend,
        seasonalityAnalysis.hasSeasonality,
        modelConfig.type
      );
      
      // Train the model
      const model = this.trainModel(
        timeSeriesData,
        modelType,
        modelConfig,
        seasonalityAnalysis.seasonalityPeriod
      );
      
      // Generate forecasts
      const forecasts = this.generateForecasts(
        timeSeriesData,
        model,
        forecastHorizon,
        confidenceLevel,
        includeComponents,
        includeConfidenceIntervals
      );
      
      // Validate the model if enabled
      let overallAccuracy: number | null = null;
      if (validateConfig.enabled && timeSeriesData.length > 10) {
        overallAccuracy = this.validateModel(
          timeSeriesData,
          model,
          validateConfig.trainTestSplit
        );
      }
      
      // Generate recommendations
      const recommendations = includeRecommendations
        ? this.generateRecommendations(
            trendAnalysis,
            seasonalityAnalysis,
            overallAccuracy,
            modelType
          )
        : [];
      
      const summary = {
        datetimeColumns: [finalDatetimeColumn],
        targetColumns: [finalTargetColumn],
        forecastHorizon,
        overallAccuracy,
        trendStrength: trendAnalysis.trendStrength,
        seasonalityStrength: seasonalityAnalysis.seasonalityStrength,
        seasonalityPeriod: seasonalityAnalysis.seasonalityPeriod,
        modelParameters: {
          alpha: modelConfig.alpha ?? 0.3,
          beta: modelConfig.beta ?? 0.1,
          gamma: modelConfig.gamma ?? 0.1,
          seasonLength: modelConfig.seasonLength ?? 12,
        },
      };
      
      const output = {
        forecasts,
        summary,
        trendAnalysis,
        seasonalityAnalysis,
        recommendations,
      };
      
      const executionTimeMs = Date.now() - start;
      
      return this.createResult(output, {
        dataPoints: timeSeriesData.length,
        forecastHorizon,
        trendStrength: trendAnalysis.trendStrength,
        seasonalityStrength: seasonalityAnalysis.seasonalityStrength,
        overallAccuracy: overallAccuracy ?? 0,
      }, executionTimeMs);
      
    } catch (error) {
      const executionTimeMs = Date.now() - start;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return this.createError(errorMessage, executionTimeMs);
    }
  }
  
  /**
   * Extract time series data from dataframe
   */
  private extractTimeSeries(
    dataframe: Record<string, unknown>[],
    datetimeColumn: string,
    targetColumn: string
  ): { datetime: string; value: number }[] {
    const timeSeries: { datetime: string; value: number }[] = [];
    
    for (const row of dataframe) {
      const datetime = String(row[datetimeColumn]);
      const value = Number(row[targetColumn]);
      
      if (datetime && !Number.isNaN(value) && Number.isFinite(value)) {
        timeSeries.push({ datetime, value });
      }
    }
    
    return timeSeries;
  }
  
  /**
   * Analyze trend in time series
   */
  private analyzeTrend(
    timeSeries: { datetime: string; value: number }[],
    config: any
  ): any {
    const values = timeSeries.map(ts => ts.value);
    const n = values.length;
    
    if (n < 2) {
      return {
        hasTrend: false,
        trendDirection: null,
        trendStrength: 0,
        trendSlope: null,
        trendEquation: null,
      };
    }
    
    // Calculate linear trend
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;
    
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += values[i];
      sumXY += i * values[i];
      sumX2 += i * i;
    }
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // Calculate R-squared
    const meanY = sumY / n;
    let ssTotal = 0;
    let ssResidual = 0;
    
    for (let i = 0; i < n; i++) {
      const predicted = slope * i + intercept;
      ssTotal += Math.pow(values[i] - meanY, 2);
      ssResidual += Math.pow(values[i] - predicted, 2);
    }
    
    const rSquared = ssTotal > 0 ? 1 - (ssResidual / ssTotal) : 0;
    
    // Determine trend characteristics
    const hasTrend = Math.abs(rSquared) > 0.1;
    const trendDirection = slope > 0.01 ? 'increasing' : slope < -0.01 ? 'decreasing' : 'stable';
    const trendStrength = Math.min(1, Math.abs(rSquared));
    
    // Generate trend equation
    const trendEquation = hasTrend 
      ? `y = ${slope.toFixed(4)}x + ${intercept.toFixed(4)}`
      : null;
    
    return {
      hasTrend,
      trendDirection,
      trendStrength,
      trendSlope: hasTrend ? slope : null,
      trendEquation,
    };
  }
  
  /**
   * Analyze seasonality in time series
   */
  private analyzeSeasonality(
    timeSeries: { datetime: string; value: number }[],
    config: any
  ): any {
    const values = timeSeries.map(ts => ts.value);
    const n = values.length;
    
    if (n < config.maxPeriod * 2) {
      return {
        hasSeasonality: false,
        seasonalityPeriod: null,
        seasonalityStrength: 0,
        seasonalPattern: null,
      };
    }
    
    // Try different periods
    let bestPeriod: number | null = null;
    let bestStrength = 0;
    let bestPattern: number[] | null = null;
    
    for (let period = 2; period <= config.maxPeriod; period++) {
      if (n < period * 2) continue;
      
      // Calculate seasonal pattern
      const pattern: number[] = [];
      for (let i = 0; i < period; i++) {
        let sum = 0;
        let count = 0;
        for (let j = i; j < n; j += period) {
          sum += values[j];
          count++;
        }
        pattern.push(count > 0 ? sum / count : 0);
      }
      
      // Calculate seasonality strength (variance of pattern)
      const patternMean = pattern.reduce((a, b) => a + b, 0) / pattern.length;
      const patternVariance = pattern.reduce((sum, val) => sum + Math.pow(val - patternMean, 2), 0) / pattern.length;
      const patternStd = Math.sqrt(patternVariance);
      
      // Normalize by overall variance
      const overallMean = values.reduce((a, b) => a + b, 0) / values.length;
      const overallVariance = values.reduce((sum, val) => sum + Math.pow(val - overallMean, 2), 0) / values.length;
      const overallStd = Math.sqrt(overallVariance);
      
      const strength = overallStd > 0 ? patternStd / overallStd : 0;
      
      if (strength > bestStrength && strength > config.minStrength) {
        bestStrength = strength;
        bestPeriod = period;
        bestPattern = pattern;
      }
    }
    
    return {
      hasSeasonality: bestPeriod !== null,
      seasonalityPeriod: bestPeriod,
      seasonalityStrength: bestStrength,
      seasonalPattern: bestPattern,
    };
  }
  
  /**
   * Determine the best model type
   */
  private determineModelType(
    hasTrend: boolean,
    hasSeasonality: boolean,
    preferredType?: string
  ): 'simple' | 'holt' | 'winters' {
    if (preferredType) {
      return preferredType;
    }
    
    if (hasTrend && hasSeasonality) {
      return 'winters';
    } else if (hasTrend) {
      return 'holt';
    } else {
      return 'simple';
    }
  }
  
  /**
   * Train the forecasting model
   */
  private trainModel(
    timeSeries: { datetime: string; value: number }[],
    modelType: 'simple' | 'holt' | 'winters',
    config: any,
    seasonalityPeriod?: number | null
  ): any {
    const values = timeSeries.map(ts => ts.value);
    const n = values.length;
    
    const model: any = {
      type: modelType,
      alpha: config.alpha ?? 0.3,
      beta: config.beta ?? 0.1,
      gamma: config.gamma ?? 0.1,
      seasonLength: seasonalityPeriod ?? config.seasonLength ?? 12,
      level: values[0],
      trend: 0,
      seasonal: new Array(modelType === 'winters' ? (seasonalityPeriod ?? 12) : 0).fill(0),
      lastSeasonalIndex: 0,
    };
    
    // Initialize seasonal component for Winters model
    if (modelType === 'winters' && model.seasonLength > 0) {
      // Calculate initial seasonal factors
      for (let i = 0; i < model.seasonLength; i++) {
        let sum = 0;
        let count = 0;
        for (let j = i; j < n; j += model.seasonLength) {
          sum += values[j];
          count++;
        }
        model.seasonal[i] = count > 0 ? sum / count : 0;
      }
      
      // Normalize seasonal factors
      const seasonalMean = model.seasonal.reduce((a: number, b: number) => a + b, 0) / model.seasonLength;
      for (let i = 0; i < model.seasonLength; i++) {
        model.seasonal[i] = model.seasonal[i] / seasonalMean;
      }
    }
    
    // Train the model
    for (let i = 1; i < n; i++) {
      const prevLevel = model.level;
      const prevTrend = model.trend;
      const prevSeasonal = modelType === 'winters' 
        ? model.seasonal[model.lastSeasonalIndex]
        : 0;
      
      // Forecast for current period
      const forecast = modelType === 'winters'
        ? (prevLevel + prevTrend) * prevSeasonal
        : modelType === 'holt'
          ? prevLevel + prevTrend
          : prevLevel;
      
      // Update model components
      const error = values[i] - forecast;
      
      switch (modelType) {
        case 'winters':
          model.level = model.alpha * values[i] + (1 - model.alpha) * (forecast);
          model.trend = model.beta * (model.level - prevLevel) + (1 - model.beta) * prevTrend;
          model.seasonal[model.lastSeasonalIndex] = model.gamma * (values[i] / model.level) + 
            (1 - model.gamma) * prevSeasonal;
          model.lastSeasonalIndex = (model.lastSeasonalIndex + 1) % model.seasonLength;
          break;
          
        case 'holt':
          model.level = model.alpha * values[i] + (1 - model.alpha) * (forecast);
          model.trend = model.beta * (model.level - prevLevel) + (1 - model.beta) * prevTrend;
          break;
          
        case 'simple':
          model.level = model.alpha * values[i] + (1 - model.alpha) * forecast;
          break;
      }
    }
    
    return model;
  }
  
  /**
   * Generate forecasts
   */
  private generateForecasts(
    timeSeries: { datetime: string; value: number }[],
    model: any,
    horizon: number,
    confidenceLevel: number,
    includeComponents: boolean,
    includeConfidenceIntervals: boolean
  ): any[] {
    const forecasts: any[] = [];
    const n = timeSeries.length;
    
    // Get the z-score for the confidence level
    const zScore = this.getZScore(confidenceLevel);
    
    // Calculate historical errors for confidence intervals
    const errors: number[] = [];
    for (let i = 1; i < n; i++) {
      const prevLevel = i > 1 ? model.level : timeSeries[0].value;
      const prevTrend = i > 1 ? model.trend : 0;
      const prevSeasonal = model.type === 'winters' && i > 1 
        ? model.seasonal[(i - 1) % model.seasonLength]
        : 0;
      
      const forecast = model.type === 'winters'
        ? (prevLevel + prevTrend) * prevSeasonal
        : model.type === 'holt'
          ? prevLevel + prevTrend
          : prevLevel;
      
      errors.push(timeSeries[i].value - forecast);
    }
    
    const errorStd = errors.length > 0 ? stdev(errors) : 0;
    
    // Generate forecasts
    for (let i = 0; i < horizon; i++) {
      const currentIndex = n + i;
      const prevLevel = model.level;
      const prevTrend = model.trend;
      const prevSeasonal = model.type === 'winters'
        ? model.seasonal[model.lastSeasonalIndex]
        : 0;
      
      // Calculate forecast
      const forecastValue = model.type === 'winters'
        ? (prevLevel + prevTrend) * prevSeasonal
        : model.type === 'holt'
          ? prevLevel + prevTrend
          : prevLevel;
      
      // Update model for next iteration
      switch (model.type) {
        case 'winters':
          model.level = prevLevel + prevTrend;
          model.trend = prevTrend;
          model.lastSeasonalIndex = (model.lastSeasonalIndex + 1) % model.seasonLength;
          break;
          
        case 'holt':
          model.level = prevLevel + prevTrend;
          model.trend = prevTrend;
          break;
          
        case 'simple':
          model.level = prevLevel;
          break;
      }
      
      // Calculate confidence interval
      let confidenceInterval = null;
      if (includeConfidenceIntervals && errorStd > 0) {
        const marginOfError = zScore * errorStd;
        confidenceInterval = {
          lower: forecastValue - marginOfError,
          upper: forecastValue + marginOfError,
          width: 2 * marginOfError,
        };
      }
      
      // Calculate components
      let components = null;
      if (includeComponents) {
        components = {
          level: prevLevel,
          trend: prevTrend,
          seasonality: model.type === 'winters' ? prevSeasonal : 0,
        };
      }
      
      forecasts.push({
        datetimeColumn: timeSeries[0]?.datetime ?? '',
        targetColumn: '',
        timePeriod: `Period ${currentIndex + 1}`,
        actualValue: null,
        forecastedValue: forecastValue,
        confidenceInterval,
        components,
        error: null,
        errorPercentage: null,
      });
    }
    
    return forecasts;
  }
  
  /**
   * Validate the model
   */
  private validateModel(
    timeSeries: { datetime: string; value: number }[],
    model: any,
    trainTestSplit: number
  ): number {
    const n = timeSeries.length;
    const splitIndex = Math.floor(n * trainTestSplit);
    
    if (splitIndex >= n) {
      return 0;
    }
    
    // Retrain on training data only
    const trainData = timeSeries.slice(0, splitIndex);
    const testData = timeSeries.slice(splitIndex);
    
    const trainedModel = this.trainModel(
      trainData,
      model.type,
      model,
      model.seasonLength
    );
    
    // Generate predictions for test data
    const predictions: number[] = [];
    let currentModel = { ...trainedModel };
    
    for (let i = 0; i < testData.length; i++) {
      const prevLevel = currentModel.level;
      const prevTrend = currentModel.trend;
      const prevSeasonal = currentModel.type === 'winters'
        ? currentModel.seasonal[currentModel.lastSeasonalIndex]
        : 0;
      
      const forecast = currentModel.type === 'winters'
        ? (prevLevel + prevTrend) * prevSeasonal
        : currentModel.type === 'holt'
          ? prevLevel + prevTrend
          : prevLevel;
      
      predictions.push(forecast);
      
      // Update model (as if we were training on this point)
      const actual = testData[i].value;
      const error = actual - forecast;
      
      switch (currentModel.type) {
        case 'winters':
          currentModel.level = currentModel.alpha * actual + (1 - currentModel.alpha) * forecast;
          currentModel.trend = currentModel.beta * (currentModel.level - prevLevel) + 
            (1 - currentModel.beta) * prevTrend;
          currentModel.seasonal[currentModel.lastSeasonalIndex] = currentModel.gamma * 
            (actual / currentModel.level) + (1 - currentModel.gamma) * prevSeasonal;
          currentModel.lastSeasonalIndex = (currentModel.lastSeasonalIndex + 1) % currentModel.seasonLength;
          break;
          
        case 'holt':
          currentModel.level = currentModel.alpha * actual + (1 - currentModel.alpha) * forecast;
          currentModel.trend = currentModel.beta * (currentModel.level - prevLevel) + 
            (1 - currentModel.beta) * prevTrend;
          break;
          
        case 'simple':
          currentModel.level = currentModel.alpha * actual + (1 - currentModel.alpha) * forecast;
          break;
      }
    }
    
    // Calculate accuracy metrics
    let sumAbsoluteError = 0;
    let sumSquaredError = 0;
    let sumAbsolutePercentageError = 0;
    
    for (let i = 0; i < testData.length; i++) {
      const actual = testData[i].value;
      const predicted = predictions[i];
      const error = actual - predicted;
      const absoluteError = Math.abs(error);
      const squaredError = error * error;
      const percentageError = actual !== 0 ? (absoluteError / Math.abs(actual)) * 100 : 0;
      
      sumAbsoluteError += absoluteError;
      sumSquaredError += squaredError;
      sumAbsolutePercentageError += percentageError;
    }
    
    const meanAbsoluteError = sumAbsoluteError / testData.length;
    const rootMeanSquaredError = Math.sqrt(sumSquaredError / testData.length);
    const meanAbsolutePercentageError = sumAbsolutePercentageError / testData.length;
    
    // Calculate R-squared
    const actualMean = testData.reduce((sum, ts) => sum + ts.value, 0) / testData.length;
    const ssTotal = testData.reduce((sum, ts) => sum + Math.pow(ts.value - actualMean, 2), 0);
    const ssResidual = sumSquaredError;
    const rSquared = ssTotal > 0 ? 1 - (ssResidual / ssTotal) : 0;
    
    // Return overall accuracy (weighted average)
    return (rSquared * 0.5 + (1 - meanAbsolutePercentageError / 100) * 0.3 + (1 - rootMeanSquaredError) * 0.2) * 100;
  }
  
  /**
   * Generate recommendations
   */
  private generateRecommendations(
    trendAnalysis: any,
    seasonalityAnalysis: any,
    overallAccuracy: number | null,
    modelType: string
  ): string[] {
    const recommendations: string[] = [];
    
    // Trend recommendations
    if (trendAnalysis.hasTrend) {
      recommendations.push(
        `Trend detected: ${trendAnalysis.trendDirection} (strength: ${(trendAnalysis.trendStrength * 100).toFixed(1)}%)`
      );
      
      if (trendAnalysis.trendEquation) {
        recommendations.push(
          `Trend equation: ${trendAnalysis.trendEquation}`
        );
      }
    } else {
      recommendations.push('No significant trend detected in the data');
    }
    
    // Seasonality recommendations
    if (seasonalityAnalysis.hasSeasonality) {
      recommendations.push(
        `Seasonality detected: Period ${seasonalityAnalysis.seasonalityPeriod} (strength: ${(seasonalityAnalysis.seasonalityStrength * 100).toFixed(1)}%)`
      );
    } else {
      recommendations.push('No significant seasonality detected in the data');
    }
    
    // Model recommendations
    recommendations.push(`Using ${modelType} model for forecasting`);
    
    if (overallAccuracy !== null) {
      recommendations.push(
        `Model accuracy: ${overallAccuracy.toFixed(1)}%`
      );
      
      if (overallAccuracy > 90) {
        recommendations.push('Excellent model fit - forecasts should be highly accurate');
      } else if (overallAccuracy > 70) {
        recommendations.push('Good model fit - forecasts should be reasonably accurate');
      } else if (overallAccuracy > 50) {
        recommendations.push('Moderate model fit - forecasts may have significant errors');
      } else {
        recommendations.push('Poor model fit - consider using a different model or transforming the data');
      }
    }
    
    // General recommendations
    if (trendAnalysis.hasTrend && seasonalityAnalysis.hasSeasonality) {
      recommendations.push('Both trend and seasonality are present - Holt-Winters model is appropriate');
    } else if (trendAnalysis.hasTrend) {
      recommendations.push('Trend is present but no seasonality - Holt linear model may be sufficient');
    } else if (seasonalityAnalysis.hasSeasonality) {
      recommendations.push('Seasonality is present but no trend - Consider seasonal decomposition');
    } else {
      recommendations.push('No trend or seasonality - Simple exponential smoothing may be sufficient');
    }
    
    return recommendations;
  }
  
  /**
   * Get z-score for a given confidence level
   */
  private getZScore(confidenceLevel: number): number {
    // Approximate z-scores for common confidence levels
    const zScores: Record<number, number> = {
      0.90: 1.645,
      0.95: 1.960,
      0.99: 2.576,
      0.995: 2.807,
      0.999: 3.291,
    };
    
    // Find the closest confidence level
    const levels = Object.keys(zScores).map(Number).sort((a, b) => a - b);
    let closestLevel = 0.95;
    let minDiff = Math.abs(confidenceLevel - 0.95);
    
    for (const level of levels) {
      const diff = Math.abs(confidenceLevel - level);
      if (diff < minDiff) {
        minDiff = diff;
        closestLevel = level;
      }
    }
    
    return zScores[closestLevel] ?? 1.96;
  }
}

// ============================================================================
// Exports
// ============================================================================

export { metadata as forecastingOracleAgentMetadata };
export default ForecastingOracleAgent;
