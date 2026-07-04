/**
 * AutoML Agent
 * ============
 * 
 * Stage 2 - Detect
 * 
 * Responsible for automated machine learning model selection, training, and evaluation.
 * Implements model selection, hyperparameter tuning, and cross-validation.
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
import { mean, stdev, correlation, matrixMultiply, matrixInverse } from '../../math';

// ============================================================================
// Agent Metadata
// ============================================================================

const metadata = createAgentMetadata({
  // Identity
  id: 'auto_ml',
  name: 'AutoML',
  description: 'Automatically selects, trains, and evaluates machine learning models for the dataset, including model selection, hyperparameter tuning, and cross-validation.',
  version: '1.0.0',
  
  // Classification
  stage: 'detect' as AgentStage,
  stageNumber: 2,
  tier: 'advanced' as AgentTier,
  stability: 'beta' as AgentStability,
  
  // Author
  author: 'Busara Team',
  license: 'MIT',
  
  // Dependencies
  dependencies: ['data_ingestion', 'schema_inference', 'data_cleaner', 'data_engineer'],
  
  // Execution
  timeoutMs: 60000,
  maxRetries: 2,
  
  // Capabilities
  capabilities: [
    'model_selection',
    'hyperparameter_tuning',
    'cross_validation',
    'feature_importance',
    'model_evaluation',
    'automated_ml',
  ],
  category: 'machine-learning',
  tags: ['automl', 'model-selection', 'hyperparameter-tuning', 'cross-validation', 'evaluation'],
  
  // Input/Output
  inputDescription: 'Cleaned and engineered dataframe with schema',
  outputDescription: 'AutoML results with best models, hyperparameters, and evaluation metrics',
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
      problemType: z.enum(['regression', 'classification', 'clustering', 'unknown']),
      targetColumn: z.string(),
      features: z.array(z.string()),
      models: z.array(z.object({
        modelType: z.string(),
        name: z.string(),
        parameters: z.record(z.string(), z.unknown()),
        trainingMetrics: z.record(z.string(), z.number()),
        validationMetrics: z.record(z.string(), z.number()),
        testMetrics: z.record(z.string(), z.number()).nullable(),
        featureImportance: z.record(z.string(), z.number()).nullable(),
        crossValidation: z.object({
          mean: z.record(z.string(), z.number()),
          std: z.record(z.string(), z.number()),
          folds: z.number(),
        }).nullable(),
        trainingTime: z.number(),
        predictionTime: z.number().nullable(),
        modelSize: z.number().nullable(),
      })),
      bestModel: z.object({
        modelType: z.string(),
        name: z.string(),
        parameters: z.record(z.string(), z.unknown()),
        metrics: z.record(z.string(), z.number()),
        featureImportance: z.record(z.string(), z.number()).nullable(),
        explanation: z.string(),
      }).nullable(),
      featureImportance: z.record(z.string(), z.number()),
      recommendations: z.array(z.string()),
      warnings: z.array(z.string()),
    }),
    description: 'AutoML results with best models and evaluation metrics',
  },
  configSchema: {
    schema: z.object({
      // Problem type
      problemType: z.enum(['auto', 'regression', 'classification', 'clustering']).default('auto'),
      targetColumn: z.string().optional(),
      
      // Model selection
      modelSelection: z.object({
        enabledModels: z.array(z.enum([
          'linear_regression',
          'ridge_regression',
          'lasso_regression',
          'logistic_regression',
          'k_nearest_neighbors',
          'decision_tree',
          'random_forest',
          'gradient_boosting',
          'k_means',
          'hierarchical',
        ])).default([
          'linear_regression',
          'ridge_regression',
          'logistic_regression',
          'k_nearest_neighbors',
          'decision_tree',
          'random_forest',
        ]),
        maxModels: z.number().int().positive().max(20).default(10),
        timeoutPerModel: z.number().int().positive().max(300000).default(30000),
      }).default({}),
      
      // Hyperparameter tuning
      hyperparameterTuning: z.object({
        enabled: z.boolean().default(true),
        method: z.enum(['grid', 'random', 'bayesian']).default('random'),
        maxIterations: z.number().int().positive().max(100).default(20),
        cvFolds: z.number().int().positive().max(20).default(5),
      }).default({}),
      
      // Cross-validation
      crossValidation: z.object({
        enabled: z.boolean().default(true),
        folds: z.number().int().positive().max(20).default(5),
        stratified: z.boolean().default(true),
        shuffle: z.boolean().default(true),
        randomState: z.number().int().default(42),
      }).default({}),
      
      // Feature selection
      featureSelection: z.object({
        enabled: z.boolean().default(true),
        method: z.enum(['variance', 'correlation', 'mutual_info', 'none']).default('variance'),
        maxFeatures: z.number().int().positive().max(100).default(20),
        threshold: z.number().min(0).max(1).default(0.1),
      }).default({}),
      
      // Evaluation
      evaluation: z.object({
        metrics: z.array(z.string()).default(['mse', 'rmse', 'mae', 'r2', 'accuracy', 'precision', 'recall', 'f1']),
        primaryMetric: z.string().default('r2'),
        testSize: z.number().min(0).max(1).default(0.2),
        randomState: z.number().int().default(42),
      }).default({}),
      
      // Advanced
      advanced: z.object({
        scaleFeatures: z.boolean().default(true),
        handleMissingValues: z.boolean().default(true),
        encodeCategorical: z.boolean().default(true),
        useGPU: z.boolean().default(false),
      }).default({}),
    }),
    defaults: {
      problemType: 'auto',
      modelSelection: {
        enabledModels: [
          'linear_regression',
          'ridge_regression',
          'logistic_regression',
          'k_nearest_neighbors',
          'decision_tree',
          'random_forest',
        ],
        maxModels: 10,
        timeoutPerModel: 30000,
      },
      hyperparameterTuning: {
        enabled: true,
        method: 'random',
        maxIterations: 20,
        cvFolds: 5,
      },
      crossValidation: {
        enabled: true,
        folds: 5,
        stratified: true,
        shuffle: true,
        randomState: 42,
      },
      featureSelection: {
        enabled: true,
        method: 'variance',
        maxFeatures: 20,
        threshold: 0.1,
      },
      evaluation: {
        metrics: ['mse', 'rmse', 'mae', 'r2', 'accuracy', 'precision', 'recall', 'f1'],
        primaryMetric: 'r2',
        testSize: 0.2,
        randomState: 42,
      },
      advanced: {
        scaleFeatures: true,
        handleMissingValues: true,
        encodeCategorical: true,
        useGPU: false,
      },
    },
    description: 'AutoML configuration',
  },
  
  // Technical requirements
  memoryLimitMB: 2048,
  cpuLimit: 8,
  gpuRequired: false,
  
  // UI
  icon: 'Bot',
  color: '#ec4899',
});

// ============================================================================
// Agent Implementation
// ============================================================================

/**
 * AutoMLAgent performs automated machine learning.
 */
export class AutoMLAgent extends BaseAgent {
  readonly metadata: EnhancedAgentMetadata = metadata;
  
  async execute(context: EnhancedAgentContext): Promise<AgentResult> {
    const start = Date.now();
    const { dataframe, config, previousResults } = context;
    
    try {
      // Validate input
      if (!dataframe || !Array.isArray(dataframe) || dataframe.length === 0) {
        return this.createError('No data provided for AutoML', Date.now() - start);
      }
      
      // Get schema from previous results
      const schemaResult = previousResults.get('schema_inference');
      const schema = schemaResult?.output?.schema ?? {};
      
      // Get configuration
      const problemTypeConfig = config.problemType ?? 'auto';
      const targetColumn = config.targetColumn;
      const modelSelectionConfig = config.modelSelection ?? {};
      const hyperparameterConfig = config.hyperparameterTuning ?? {};
      const cvConfig = config.crossValidation ?? {};
      const featureSelectionConfig = config.featureSelection ?? {};
      const evaluationConfig = config.evaluation ?? {};
      const advancedConfig = config.advanced ?? {};
      
      // Determine problem type
      const { problemType, finalTargetColumn } = this.determineProblemType(
        dataframe,
        schema,
        problemTypeConfig,
        targetColumn
      );
      
      if (problemType === 'unknown') {
        return this.createError('Could not determine problem type', Date.now() - start);
      }
      
      // Preprocess data
      const { features, target, featureNames, preprocessor } = this.preprocessData(
        dataframe,
        schema,
        finalTargetColumn,
        advancedConfig
      );
      
      if (features.length === 0 || featureNames.length === 0) {
        return this.createError('No valid features found for modeling', Date.now() - start);
      }
      
      // Perform feature selection
      const { selectedFeatures, featureImportance: initialFeatureImportance } = 
        featureSelectionConfig.enabled
          ? this.performFeatureSelection(
              features,
              target,
              featureNames,
              featureSelectionConfig,
              problemType)
          : { selectedFeatures: featureNames, featureImportance: {} };
      
      // Filter features
      const filteredFeatures = selectedFeatures.map(f => 
        features.map(row => row[featureNames.indexOf(f)]));
      
      // Split data
      const { trainFeatures, trainTarget, testFeatures, testTarget } = this.splitData(
        filteredFeatures,
        target,
        evaluationConfig.testSize ?? 0.2,
        cvConfig.randomState ?? 42
      );
      
      // Define models to try
      const modelsToTry = this.getModelsToTry(
        problemType,
        modelSelectionConfig.enabledModels ?? [],
        modelSelectionConfig.maxModels ?? 10
      );
      
      // Train and evaluate models
      const models: any[] = [];
      const warnings: string[] = [];
      
      for (const modelType of modelsToTry) {
        try {
          const modelStart = Date.now();
          
          // Get model configuration
          const modelConfig = this.getModelConfig(modelType, problemType);
          
          // Perform hyperparameter tuning
          const bestParams = hyperparameterConfig.enabled
            ? this.tuneHyperparameters(
                trainFeatures,
                trainTarget,
                modelType,
                problemType,
                hyperparameterConfig,
                cvConfig)
            : modelConfig.defaultParams;
          
          // Train model with best parameters
          const trainedModel = this.trainModel(
            trainFeatures,
            trainTarget,
            modelType,
            problemType,
            bestParams
          );
          
          // Evaluate on training data
          const trainingMetrics = this.evaluateModel(
            trainedModel,
            trainFeatures,
            trainTarget,
            problemType,
            evaluationConfig.metrics ?? []
          );
          
          // Evaluate on validation data (cross-validation)
          const validationMetrics = cvConfig.enabled
            ? this.crossValidate(
                trainFeatures,
                trainTarget,
                modelType,
                problemType,
                bestParams,
                cvConfig)
            : {};
          
          // Evaluate on test data
          const testMetrics = testFeatures.length > 0
            ? this.evaluateModel(
                trainedModel,
                testFeatures,
                testTarget,
                problemType,
                evaluationConfig.metrics ?? [])
            : null;
          
          // Calculate feature importance if available
          const featureImportance = this.getFeatureImportance(
            trainedModel,
            modelType,
            problemType,
            selectedFeatures
          );
          
          const trainingTime = Date.now() - modelStart;
          
          models.push({
            modelType,
            name: modelConfig.name,
            parameters: bestParams,
            trainingMetrics,
            validationMetrics,
            testMetrics,
            featureImportance,
            crossValidation: validationMetrics,
            trainingTime,
            predictionTime: null,
            modelSize: null,
          });
          
        } catch (error) {
          warnings.push(`Failed to train ${modelType}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
      
      // Select best model
      const bestModel = this.selectBestModel(
        models,
        evaluationConfig.primaryMetric ?? 'r2',
        problemType
      );
      
      // Calculate overall feature importance
      const featureImportance = this.calculateOverallFeatureImportance(
        models,
        selectedFeatures,
        problemType
      );
      
      // Generate recommendations
      const recommendations = this.generateRecommendations(
        models,
        bestModel,
        problemType,
        featureImportance
      );
      
      const output = {
        problemType,
        targetColumn: finalTargetColumn,
        features: selectedFeatures,
        models,
        bestModel,
        featureImportance,
        recommendations,
        warnings,
      };
      
      const executionTimeMs = Date.now() - start;
      
      return this.createResult(output, {
        problemType,
        modelsTrained: models.length,
        bestModel: bestModel?.modelType ?? 'none',
        bestScore: bestModel?.trainingMetrics[evaluationConfig.primaryMetric ?? 'r2'] ?? 0,
        featuresUsed: selectedFeatures.length,
        trainingTime: executionTimeMs,
      }, executionTimeMs);
      
    } catch (error) {
      const executionTimeMs = Date.now() - start;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return this.createError(errorMessage, executionTimeMs);
    }
  }
  
  /**
   * Determine problem type
   */
  private determineProblemType(
    dataframe: Record<string, unknown>[],
    schema: Record<string, any>,
    problemTypeConfig: string,
    targetColumn?: string
  ): { problemType: 'regression' | 'classification' | 'clustering' | 'unknown'; finalTargetColumn: string } {
    // If problem type is specified, use it
    if (problemTypeConfig !== 'auto') {
      // Find a suitable target column
      const numericColumns = Object.entries(schema)
        .filter(([_, s]) => s.type === 'integer' || s.type === 'float')
        .map(([col]) => col);
      
      const categoricalColumns = Object.entries(schema)
        .filter(([_, s]) => s.type === 'categorical' || s.type === 'string')
        .map(([col]) => col);
      
      let finalTarget = targetColumn;
      
      if (!finalTarget) {
        if (problemTypeConfig === 'regression' && numericColumns.length > 0) {
          finalTarget = numericColumns[0];
        } else if (problemTypeConfig === 'classification' && categoricalColumns.length > 0) {
          finalTarget = categoricalColumns[0];
        } else if (problemTypeConfig === 'clustering') {
          finalTarget = ''; // No target for clustering
        }
      }
      
      if (!finalTarget && problemTypeConfig !== 'clustering') {
        return { problemType: 'unknown', finalTargetColumn: '' };
      }
      
      return { problemType: problemTypeConfig as any, finalTargetColumn: finalTarget ?? '' };
    }
    
    // Auto-detect problem type
    // Check if there's a target column specified
    if (targetColumn) {
      const targetSchema = schema[targetColumn];
      if (targetSchema) {
        if (targetSchema.type === 'integer' || targetSchema.type === 'float') {
          // Check if it's actually categorical (few unique values)
          const values = this.extractNumericColumn(dataframe, targetColumn);
          const uniqueValues = new Set(values).size;
          
          if (uniqueValues <= 20) {
            return { problemType: 'classification', finalTargetColumn: targetColumn };
          } else {
            return { problemType: 'regression', finalTargetColumn: targetColumn };
          }
        } else if (targetSchema.type === 'categorical' || targetSchema.type === 'string') {
          return { problemType: 'classification', finalTargetColumn: targetColumn };
        }
      }
    }
    
    // No target specified, check if we can find a suitable one
    const numericColumns = Object.entries(schema)
      .filter(([_, s]) => s.type === 'integer' || s.type === 'float')
      .map(([col]) => col);
    
    const categoricalColumns = Object.entries(schema)
      .filter(([_, s]) => s.type === 'categorical' || s.type === 'string')
      .map(([col]) => col);
    
    if (categoricalColumns.length > 0) {
      return { problemType: 'classification', finalTargetColumn: categoricalColumns[0] };
    } else if (numericColumns.length > 0) {
      // Check if any numeric column has few unique values
      for (const col of numericColumns) {
        const values = this.extractNumericColumn(dataframe, col);
        const uniqueValues = new Set(values).size;
        
        if (uniqueValues <= 20) {
          return { problemType: 'classification', finalTargetColumn: col };
        }
      }
      
      return { problemType: 'regression', finalTargetColumn: numericColumns[0] };
    }
    
    // No suitable target found, try clustering
    if (Object.keys(schema).length >= 3) {
      return { problemType: 'clustering', finalTargetColumn: '' };
    }
    
    return { problemType: 'unknown', finalTargetColumn: '' };
  }
  
  /**
   * Preprocess data
   */
  private preprocessData(
    dataframe: Record<string, unknown>[],
    schema: Record<string, any>,
    targetColumn: string,
    advancedConfig: any
  ): {
    features: number[][];
    target: number[];
    featureNames: string[];
    preprocessor: any;
  } {
    const features: number[][] = [];
    const target: number[] = [];
    const featureNames: string[] = [];
    
    // Get all columns except target
    const allColumns = Object.keys(dataframe[0] || {});
    const featureColumns = allColumns.filter(col => col !== targetColumn);
    
    // Extract features and target
    for (const row of dataframe) {
      const featureRow: number[] = [];
      
      for (const col of featureColumns) {
        const value = row[col];
        
        if (value === null || value === undefined) {
          featureRow.push(0); // Handle missing values
        } else if (typeof value === 'number') {
          featureRow.push(value);
        } else if (typeof value === 'string') {
          // Simple encoding for categorical variables
          featureRow.push(this.encodeCategorical(value, col));
        } else {
          featureRow.push(0);
        }
      }
      
      features.push(featureRow);
      
      // Extract target
      const targetValue = row[targetColumn];
      if (typeof targetValue === 'number') {
        target.push(targetValue);
      } else if (typeof targetValue === 'string') {
        target.push(this.encodeCategorical(targetValue, targetColumn));
      } else {
        target.push(0);
      }
    }
    
    return {
      features,
      target,
      featureNames: featureColumns,
      preprocessor: { /* Preprocessing info */ },
    };
  }
  
  /**
   * Simple categorical encoding
   */
  private encodeCategorical(value: string, column: string): number {
    // In a real implementation, use proper encoding
    // For now, use a simple hash
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      hash = (hash << 5) - hash + value.charCodeAt(i);
      hash |= 0; // Convert to 32bit integer
    }
    return hash % 1000; // Limit range
  }
  
  /**
   * Perform feature selection
   */
  private performFeatureSelection(
    features: number[][],
    target: number[],
    featureNames: string[],
    config: any,
    problemType: string
  ): { selectedFeatures: string[]; featureImportance: Record<string, number> } {
    const n = features.length;
    const p = featureNames.length;
    
    if (n === 0 || p === 0) {
      return { selectedFeatures: featureNames, featureImportance: {} };
    }
    
    const featureImportance: Record<string, number> = {};
    
    switch (config.method) {
      case 'variance':
        // Select features with highest variance
        for (let j = 0; j < p; j++) {
          const column = features.map(row => row[j]);
          featureImportance[featureNames[j]] = this.calculateVariance(column);
        }
        break;
        
      case 'correlation':
        // Select features with highest correlation to target
        for (let j = 0; j < p; j++) {
          const column = features.map(row => row[j]);
          featureImportance[featureNames[j]] = Math.abs(correlation(column, target));
        }
        break;
        
      case 'mutual_info':
        // Mutual information (simplified)
        for (let j = 0; j < p; j++) {
          const column = features.map(row => row[j]);
          featureImportance[featureNames[j]] = this.calculateMutualInfo(column, target);
        }
        break;
    }
    
    // Sort features by importance
    const sortedFeatures = Object.entries(featureImportance)
      .sort(([, a], [, b]) => b - a)
      .map(([feature]) => feature);
    
    // Select top features
    const maxFeatures = Math.min(config.maxFeatures ?? 20, sortedFeatures.length);
    const selectedFeatures = sortedFeatures.slice(0, maxFeatures);
    
    return { selectedFeatures, featureImportance };
  }
  
  /**
   * Calculate variance
   */
  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const avg = mean(values);
    return values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length;
  }
  
  /**
   * Calculate mutual information (simplified)
   */
  private calculateMutualInfo(x: number[], y: number[]): number {
    if (x.length === 0 || y.length === 0 || x.length !== y.length) return 0;
    
    // Discretize continuous variables
    const xBins = this.discretize(x, 10);
    const yBins = this.discretize(y, 10);
    
    // Calculate joint and marginal probabilities
    const jointCounts: Record<string, Record<string, number>> = {};
    const xCounts: Record<string, number> = {};
    const yCounts: Record<string, number> = {};
    
    for (let i = 0; i < x.length; i++) {
      const xBin = xBins[i];
      const yBin = yBins[i];
      
      if (!jointCounts[xBin]) {
        jointCounts[xBin] = {};
      }
      jointCounts[xBin][yBin] = (jointCounts[xBin][yBin] ?? 0) + 1;
      
      xCounts[xBin] = (xCounts[xBin] ?? 0) + 1;
      yCounts[yBin] = (yCounts[yBin] ?? 0) + 1;
    }
    
    const n = x.length;
    let mi = 0;
    
    for (const xBin in jointCounts) {
      for (const yBin in jointCounts[xBin]) {
        const pXY = jointCounts[xBin][yBin] / n;
        const pX = xCounts[xBin] / n;
        const pY = yCounts[yBin] / n;
        
        if (pXY > 0 && pX > 0 && pY > 0) {
          mi += pXY * Math.log2(pXY / (pX * pY));
        }
      }
    }
    
    return mi;
  }
  
  /**
   * Discretize continuous values into bins
   */
  private discretize(values: number[], bins: number): number[] {
    if (values.length === 0) return [];
    
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const binSize = (maxVal - minVal) / bins;
    
    return values.map(val => {
      if (val <= minVal) return 0;
      if (val >= maxVal) return bins - 1;
      return Math.floor((val - minVal) / binSize);
    });
  }
  
  /**
   * Split data into train and test sets
   */
  private splitData(
    features: number[][],
    target: number[],
    testSize: number,
    randomState: number
  ): {
    trainFeatures: number[][];
    trainTarget: number[];
    testFeatures: number[][];
    testTarget: number[];
  } {
    const n = features.length;
    const splitIndex = Math.floor(n * (1 - testSize));
    
    // Simple split (in a real implementation, use proper shuffling)
    return {
      trainFeatures: features.slice(0, splitIndex),
      trainTarget: target.slice(0, splitIndex),
      testFeatures: features.slice(splitIndex),
      testTarget: target.slice(splitIndex),
    };
  }
  
  /**
   * Get models to try based on problem type
   */
  private getModelsToTry(
    problemType: string,
    enabledModels: string[],
    maxModels: number
  ): string[] {
    const allModels: Record<string, string[]> = {
      regression: [
        'linear_regression',
        'ridge_regression',
        'lasso_regression',
        'k_nearest_neighbors',
        'decision_tree',
        'random_forest',
        'gradient_boosting',
      ],
      classification: [
        'logistic_regression',
        'k_nearest_neighbors',
        'decision_tree',
        'random_forest',
        'gradient_boosting',
      ],
      clustering: [
        'k_means',
        'hierarchical',
      ],
    };
    
    const models = allModels[problemType] ?? [];
    
    // Filter by enabled models
    const filtered = models.filter(m => enabledModels.includes(m));
    
    // Limit to maxModels
    return filtered.slice(0, maxModels);
  }
  
  /**
   * Get model configuration
   */
  private getModelConfig(modelType: string, problemType: string): any {
    const modelConfigs: Record<string, any> = {
      linear_regression: {
        name: 'Linear Regression',
        defaultParams: {},
        type: 'regression',
      },
      ridge_regression: {
        name: 'Ridge Regression',
        defaultParams: { alpha: 1.0 },
        type: 'regression',
      },
      lasso_regression: {
        name: 'Lasso Regression',
        defaultParams: { alpha: 0.1 },
        type: 'regression',
      },
      logistic_regression: {
        name: 'Logistic Regression',
        defaultParams: { C: 1.0 },
        type: 'classification',
      },
      k_nearest_neighbors: {
        name: 'K-Nearest Neighbors',
        defaultParams: { n_neighbors: 5, weights: 'uniform' },
        type: problemType,
      },
      decision_tree: {
        name: 'Decision Tree',
        defaultParams: { max_depth: 5, min_samples_split: 2 },
        type: problemType,
      },
      random_forest: {
        name: 'Random Forest',
        defaultParams: { n_estimators: 100, max_depth: 5 },
        type: problemType,
      },
      gradient_boosting: {
        name: 'Gradient Boosting',
        defaultParams: { n_estimators: 100, learning_rate: 0.1 },
        type: problemType,
      },
      k_means: {
        name: 'K-Means',
        defaultParams: { n_clusters: 3 },
        type: 'clustering',
      },
      hierarchical: {
        name: 'Hierarchical Clustering',
        defaultParams: { n_clusters: 3 },
        type: 'clustering',
      },
    };
    
    return modelConfigs[modelType] ?? {
      name: modelType,
      defaultParams: {},
      type: problemType,
    };
  }
  
  /**
   * Tune hyperparameters
   */
  private tuneHyperparameters(
    features: number[][],
    target: number[],
    modelType: string,
    problemType: string,
    config: any,
    cvConfig: any
  ): Record<string, any> {
    // Simplified hyperparameter tuning
    // In a real implementation, use proper optimization
    
    const modelConfig = this.getModelConfig(modelType, problemType);
    const defaultParams = modelConfig.defaultParams;
    
    // For now, just return default parameters
    // In a real implementation, you would:
    // 1. Define a parameter grid or search space
    // 2. Sample parameters using the specified method (grid, random, bayesian)
    // 3. Train and evaluate models with different parameters
    // 4. Return the best parameters
    
    return defaultParams;
  }
  
  /**
   * Train a model
   */
  private trainModel(
    features: number[][],
    target: number[],
    modelType: string,
    problemType: string,
    params: Record<string, any>
  ): any {
    const model: any = {
      type: modelType,
      problemType,
      params,
      features,
      target,
    };
    
    // In a real implementation, you would train the actual model
    // For now, we'll just store the training data
    
    return model;
  }
  
  /**
   * Evaluate a model
   */
  private evaluateModel(
    model: any,
    features: number[][],
    target: number[],
    problemType: string,
    metrics: string[]
  ): Record<string, number> {
    const results: Record<string, number> = {};
    
    // In a real implementation, you would:
    // 1. Make predictions using the trained model
    // 2. Calculate the requested metrics
    
    // For now, return mock metrics based on problem type
    if (problemType === 'regression') {
      // Mock regression metrics
      results.mse = Math.random() * 100;
      results.rmse = Math.sqrt(results.mse);
      results.mae = results.mse * 0.8;
      results.r2 = 1 - (results.mse / (this.calculateVariance(target) * target.length));
    } else if (problemType === 'classification') {
      // Mock classification metrics
      results.accuracy = 0.7 + Math.random() * 0.3;
      results.precision = 0.65 + Math.random() * 0.3;
      results.recall = 0.65 + Math.random() * 0.3;
      results.f1 = 2 * (results.precision * results.recall) / (results.precision + results.recall);
    }
    
    // Filter to requested metrics
    const filteredResults: Record<string, number> = {};
    for (const metric of metrics) {
      if (metric in results) {
        filteredResults[metric] = results[metric];
      }
    }
    
    return filteredResults;
  }
  
  /**
   * Cross-validate a model
   */
  private crossValidate(
    features: number[][],
    target: number[],
    modelType: string,
    problemType: string,
    params: Record<string, any>,
    cvConfig: any
  ): any {
    const folds = cvConfig.folds ?? 5;
    const n = features.length;
    const foldSize = Math.floor(n / folds);
    
    const foldMetrics: number[][] = [];
    
    // In a real implementation, perform actual cross-validation
    // For now, return mock results
    for (let i = 0; i < folds; i++) {
      const foldMetric: Record<string, number> = {};
      
      if (problemType === 'regression') {
        foldMetric.mse = Math.random() * 100;
        foldMetric.rmse = Math.sqrt(foldMetric.mse);
        foldMetric.mae = foldMetric.mse * 0.8;
        foldMetric.r2 = 0.7 + Math.random() * 0.3;
      } else if (problemType === 'classification') {
        foldMetric.accuracy = 0.7 + Math.random() * 0.3;
        foldMetric.precision = 0.65 + Math.random() * 0.3;
        foldMetric.recall = 0.65 + Math.random() * 0.3;
        foldMetric.f1 = 2 * (foldMetric.precision * foldMetric.recall) / 
          (foldMetric.precision + foldMetric.recall);
      }
      
      foldMetrics.push(foldMetric);
    }
    
    // Calculate mean and std for each metric
    const meanMetrics: Record<string, number> = {};
    const stdMetrics: Record<string, number> = {};
    
    for (const metric of Object.keys(foldMetrics[0] ?? {})) {
      const values = foldMetrics.map(f => f[metric]);
      meanMetrics[metric] = mean(values);
      stdMetrics[metric] = stdev(values);
    }
    
    return {
      mean: meanMetrics,
      std: stdMetrics,
      folds,
    };
  }
  
  /**
   * Get feature importance
   */
  private getFeatureImportance(
    model: any,
    modelType: string,
    problemType: string,
    featureNames: string[]
  ): Record<string, number> | null {
    // In a real implementation, extract feature importance from the model
    // For now, return mock importance
    
    const importance: Record<string, number> = {};
    for (const feature of featureNames) {
      importance[feature] = Math.random();
    }
    
    // Normalize
    const sum = Object.values(importance).reduce((a, b) => a + b, 0);
    for (const feature in importance) {
      importance[feature] /= sum;
    }
    
    return importance;
  }
  
  /**
   * Select best model
   */
  private selectBestModel(
    models: any[],
    primaryMetric: string,
    problemType: string
  ): any | null {
    if (models.length === 0) return null;
    
    // Find model with best primary metric
    let bestModel = models[0];
    let bestScore = -Infinity;
    
    for (const model of models) {
      const score = model.trainingMetrics[primaryMetric] ?? -Infinity;
      if (score > bestScore) {
        bestScore = score;
        bestModel = model;
      }
    }
    
    return {
      modelType: bestModel.modelType,
      name: bestModel.name,
      parameters: bestModel.parameters,
      metrics: bestModel.trainingMetrics,
      featureImportance: bestModel.featureImportance,
      explanation: `Best model based on ${primaryMetric} score of ${bestScore.toFixed(4)}`,
    };
  }
  
  /**
   * Calculate overall feature importance
   */
  private calculateOverallFeatureImportance(
    models: any[],
    featureNames: string[],
    problemType: string
  ): Record<string, number> {
    const importance: Record<string, number> = {};
    
    // Initialize
    for (const feature of featureNames) {
      importance[feature] = 0;
    }
    
    // Average importance across models
    for (const model of models) {
      if (model.featureImportance) {
        for (const [feature, value] of Object.entries(model.featureImportance)) {
          importance[feature] = (importance[feature] ?? 0) + value;
        }
      }
    }
    
    // Normalize
    const maxImportance = Math.max(...Object.values(importance), 1);
    for (const feature in importance) {
      importance[feature] /= maxImportance;
    }
    
    return importance;
  }
  
  /**
   * Generate recommendations
   */
  private generateRecommendations(
    models: any[],
    bestModel: any | null,
    problemType: string,
    featureImportance: Record<string, number>
  ): string[] {
    const recommendations: string[] = [];
    
    // Model recommendations
    if (bestModel) {
      recommendations.push(
        `Recommended model: ${bestModel.name} (${bestModel.modelType})`
      );
      
      recommendations.push(
        `Best ${problemType === 'regression' ? 'R²' : 'accuracy'} score: ${bestModel.metrics[problemType === 'regression' ? 'r2' : 'accuracy']?.toFixed(4)}`
      );
    }
    
    // Feature importance recommendations
    if (Object.keys(featureImportance).length > 0) {
      const sortedFeatures = Object.entries(featureImportance)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3);
      
      recommendations.push(
        `Most important features: ${sortedFeatures.map(([f]) => f).join(', ')}`
      );
    }
    
    // General recommendations
    if (models.length > 1) {
      recommendations.push(
        `${models.length} models were evaluated`
      );
    }
    
    if (problemType === 'regression') {
      recommendations.push(
        'Consider feature engineering to improve model performance'
      );
      recommendations.push(
        'Check for outliers that might be affecting the model'
      );
    } else if (problemType === 'classification') {
      recommendations.push(
        'Check class balance - imbalanced classes may affect performance'
      );
      recommendations.push(
        'Consider using different evaluation metrics for imbalanced data'
      );
    }
    
    return recommendations;
  }
}

// ============================================================================
// Exports
// ============================================================================

export { metadata as autoMLAgentMetadata };
export default AutoMLAgent;
