/**
 * Data Engineer Agent
 * ====================
 * 
 * Stage 1 - Engineer
 * 
 * Responsible for feature engineering and data transformation.
 * Creates new features from existing data to improve analysis quality.
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
import { mean, median, stdev, min, max, correlation, covariance } from '../../math';

// ============================================================================
// Agent Metadata
// ============================================================================

const metadata = createAgentMetadata({
  // Identity
  id: 'data_engineer',
  name: 'Data Engineer',
  description: 'Performs feature engineering by creating new features from existing data, including scaling, encoding, and transformation.',
  version: '1.0.0',
  
  // Classification
  stage: 'engineer' as AgentStage,
  stageNumber: 1,
  tier: 'core' as AgentTier,
  stability: 'stable' as AgentStability,
  
  // Author
  author: 'Busara Team',
  license: 'MIT',
  
  // Dependencies
  dependencies: ['data_ingestion', 'schema_inference', 'data_cleaner'],
  
  // Execution
  timeoutMs: 30000,
  maxRetries: 3,
  
  // Capabilities
  capabilities: [
    'feature_scaling',
    'feature_encoding',
    'feature_selection',
    'dimensionality_reduction',
    'feature_creation',
  ],
  category: 'data',
  tags: ['feature-engineering', 'transformation', 'scaling', 'encoding'],
  
  // Input/Output
  inputDescription: 'Cleaned dataframe with schema from previous agents',
  outputDescription: 'Dataframe with engineered features and transformation report',
  inputSchema: {
    schema: z.object({
      dataframe: z.array(z.record(z.string(), z.unknown())),
      schema: z.record(z.string(), z.object({
        type: z.string(),
        confidence: z.number(),
        nullCount: z.number(),
        uniqueCount: z.number(),
      })),
      cleaningReport: z.object({}).optional(),
    }),
    description: 'Cleaned dataframe and schema from previous agents',
  },
  outputSchema: {
    schema: z.object({
      engineeredDataframe: z.array(z.record(z.string(), z.unknown())),
      engineeringReport: z.object({
        featuresAdded: z.array(z.string()),
        featuresRemoved: z.array(z.string()),
        scalingApplied: z.record(z.string(), z.string()),
        encodingApplied: z.record(z.string(), z.string()),
        transformationsApplied: z.record(z.string(), z.array(z.string())),
        featureStatistics: z.record(z.string(), z.record(z.string(), z.number())),
        correlationMatrix: z.record(z.string(), z.record(z.string(), z.number())).optional(),
      }),
    }),
    description: 'Engineered dataframe with feature engineering report',
  },
  configSchema: {
    schema: z.object({
      // Scaling
      scaling: z.object({
        enabled: z.boolean().default(true),
        method: z.enum(['standard', 'minmax', 'robust', 'none']).default('standard'),
        columns: z.array(z.string()).optional(),
        exclude: z.array(z.string()).optional(),
      }).optional().default(undefined as any),
      
      // Encoding
      encoding: z.object({
        enabled: z.boolean().default(true),
        method: z.enum(['onehot', 'label', 'ordinal', 'none']).default('onehot'),
        columns: z.array(z.string()).optional(),
        dropFirst: z.boolean().default(false),
      }).optional().default(undefined as any),
      
      // Feature selection
      featureSelection: z.object({
        enabled: z.boolean().default(false),
        method: z.enum(['variance', 'correlation', 'none']).default('variance'),
        threshold: z.number().min(0).max(1).default(0.1),
        targetColumn: z.string().optional(),
      }).optional().default(undefined as any),
      
      // Dimensionality reduction
      dimensionalityReduction: z.object({
        enabled: z.boolean().default(false),
        method: z.enum(['pca', 'none']).default('none'),
        nComponents: z.number().int().positive().max(10).default(2),
      }).optional().default(undefined as any),
      
      // Feature creation
      featureCreation: z.object({
        enabled: z.boolean().default(true),
        polynomialFeatures: z.boolean().default(false),
        polynomialDegree: z.number().int().positive().max(3).default(2),
        interactionFeatures: z.boolean().default(false),
        timeFeatures: z.boolean().default(true),
        datetimeColumns: z.array(z.string()).optional(),
      }).optional().default(undefined as any),
      
      // Outlier handling
      outlierHandling: z.object({
        enabled: z.boolean().default(false),
        method: z.enum(['clip', 'winsorize', 'none']).default('clip'),
        threshold: z.number().min(0).max(10).default(3),
      }).optional().default(undefined as any),
    }),
    defaults: {
      scaling: {
        enabled: true,
        method: 'standard',
      },
      encoding: {
        enabled: true,
        method: 'onehot',
      },
      featureSelection: {
        enabled: false,
      },
      dimensionalityReduction: {
        enabled: false,
      },
      featureCreation: {
        enabled: true,
        polynomialFeatures: false,
        interactionFeatures: false,
        timeFeatures: true,
      },
      outlierHandling: {
        enabled: false,
      },
    },
    description: 'Feature engineering configuration',
  },
  
  // Technical requirements
  memoryLimitMB: 512,
  cpuLimit: 2,
  gpuRequired: false,
  
  // UI
  icon: 'Settings',
  color: '#84cc16',
});

// ============================================================================
// Agent Implementation
// ============================================================================

/**
 * DataEngineerAgent performs feature engineering on the dataset.
 * It creates new features from existing data to improve analysis quality.
 */
export class DataEngineerAgent extends BaseAgent {
  readonly metadata: EnhancedAgentMetadata = metadata;
  
  async execute(context: EnhancedAgentContext): Promise<AgentResult> {
    const start = Date.now();
    const { dataframe, config, previousResults } = context;
    
    try {
      // Validate input
      if (!dataframe || !Array.isArray(dataframe) || dataframe.length === 0) {
        return this.createError('No data provided for feature engineering', Date.now() - start);
      }
      
      // Get schema from previous results
      const schemaResult = previousResults.get('schema_inference');
      const schema = (schemaResult?.output as any)?.schema ?? {};
      
      // Get configuration
      const scalingConfig = config.scaling ?? {};
      const encodingConfig = config.encoding ?? {};
      const featureSelectionConfig = config.featureSelection ?? {};
      const dimensionalityReductionConfig = config.dimensionalityReduction ?? {};
      const featureCreationConfig = config.featureCreation ?? {};
      const outlierHandlingConfig = config.outlierHandling ?? {};
      
      // Initialize report
      const engineeringReport = {
        featuresAdded: [] as string[],
        featuresRemoved: [] as string[],
        scalingApplied: {} as Record<string, string>,
        encodingApplied: {} as Record<string, string>,
        transformationsApplied: {} as Record<string, string[]>,
        featureStatistics: {} as Record<string, Record<string, number>>,
        correlationMatrix: {} as Record<string, Record<string, number>>,
      };
      
      // Create a copy to modify
      let engineeredDataframe = JSON.parse(JSON.stringify(dataframe));
      
      // Step 1: Handle outliers
      if (outlierHandlingConfig.enabled) {
        engineeredDataframe = this.handleOutliers(
          engineeredDataframe,
          schema,
          outlierHandlingConfig.method,
          outlierHandlingConfig.threshold,
          engineeringReport
        );
      }
      
      // Step 2: Create new features
      if (featureCreationConfig.enabled) {
        engineeredDataframe = this.createFeatures(
          engineeredDataframe,
          schema,
          featureCreationConfig,
          engineeringReport.featuresAdded
        );
      }
      
      // Step 3: Apply scaling
      if (scalingConfig.enabled) {
        engineeredDataframe = this.applyScaling(
          engineeredDataframe,
          schema,
          scalingConfig,
          engineeringReport.scalingApplied
        );
      }
      
      // Step 4: Apply encoding
      if (encodingConfig.enabled) {
        engineeredDataframe = this.applyEncoding(
          engineeredDataframe,
          schema,
          encodingConfig,
          engineeringReport.encodingApplied,
          engineeringReport.featuresAdded
        );
      }
      
      // Step 5: Feature selection
      if (featureSelectionConfig.enabled) {
        engineeredDataframe = this.applyFeatureSelection(
          engineeredDataframe,
          schema,
          featureSelectionConfig,
          engineeringReport.featuresRemoved
        );
      }
      
      // Step 6: Dimensionality reduction
      if (dimensionalityReductionConfig.enabled && dimensionalityReductionConfig.method === 'pca') {
        engineeredDataframe = this.applyPCA(
          engineeredDataframe,
          schema,
          dimensionalityReductionConfig.nComponents,
          engineeringReport
        );
      }
      
      // Calculate feature statistics
      engineeringReport.featureStatistics = this.calculateFeatureStatistics(
        engineeredDataframe,
        schema
      );
      
      // Calculate correlation matrix for numeric columns
      engineeringReport.correlationMatrix = this.calculateCorrelationMatrix(
        engineeredDataframe,
        schema
      );
      
      const output = {
        engineeredDataframe,
        engineeringReport,
      };
      
      const executionTimeMs = Date.now() - start;
      
      return this.createResult(output, {
        featuresAdded: engineeringReport.featuresAdded.length,
        featuresRemoved: engineeringReport.featuresRemoved.length,
        featuresScaled: Object.keys(engineeringReport.scalingApplied).length,
        featuresEncoded: Object.keys(engineeringReport.encodingApplied).length,
        totalFeatures: Object.keys(engineeredDataframe[0] || {}).length,
      }, executionTimeMs);
      
    } catch (error) {
      const executionTimeMs = Date.now() - start;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return this.createError(errorMessage, executionTimeMs);
    }
  }
  
  /**
   * Handle outliers in numeric columns
   */
  private handleOutliers(
    dataframe: Record<string, unknown>[],
    schema: Record<string, any>,
    method: string,
    threshold: number,
    report: any
  ): Record<string, unknown>[] {
    const result = JSON.parse(JSON.stringify(dataframe));
    
    for (const [col, colSchema] of Object.entries(schema as Record<string, any>)) {
      if (colSchema.type !== 'integer' && colSchema.type !== 'float') continue;
      
      const values = this.extractNumericColumn(result, col);
      if (values.length === 0) continue;
      
      const sorted = [...values].sort((a, b) => a - b);
      const q1 = sorted[Math.floor(sorted.length * 0.25)];
      const q3 = sorted[Math.floor(sorted.length * 0.75)];
      const iqr = q3 - q1;
      
      switch (method) {
        case 'clip':
          const lowerBound = q1 - threshold * iqr;
          const upperBound = q3 + threshold * iqr;
          
          for (let i = 0; i < result.length; i++) {
            const val = Number(result[i][col]);
            if (!Number.isNaN(val) && Number.isFinite(val)) {
              if (val < lowerBound) result[i][col] = lowerBound;
              if (val > upperBound) result[i][col] = upperBound;
            }
          }
          break;
          
        case 'winsorize':
          const lowerPercentile = 0.05;
          const upperPercentile = 0.95;
          const lowerIndex = Math.floor(sorted.length * lowerPercentile);
          const upperIndex = Math.floor(sorted.length * upperPercentile);
          const winsorLower = sorted[lowerIndex];
          const winsorUpper = sorted[upperIndex];
          
          for (let i = 0; i < result.length; i++) {
            const val = Number(result[i][col]);
            if (!Number.isNaN(val) && Number.isFinite(val)) {
              if (val < winsorLower) result[i][col] = winsorLower;
              if (val > winsorUpper) result[i][col] = winsorUpper;
            }
          }
          break;
      }
    }
    
    return result;
  }
  
  /**
   * Create new features from existing data
   */
  private createFeatures(
    dataframe: Record<string, unknown>[],
    schema: Record<string, any>,
    config: any,
    featuresAdded: string[]
  ): Record<string, unknown>[] {
    const result = JSON.parse(JSON.stringify(dataframe));
    
    // Add time-based features from datetime columns
    if (config.timeFeatures) {
      const datetimeColumns = config.datetimeColumns?.length > 0
        ? config.datetimeColumns
        : Object.entries(schema as Record<string, any>)
            .filter(([_, s]) => s.type === 'datetime')
            .map(([col]) => col);
      
      for (const col of datetimeColumns) {
        for (let i = 0; i < result.length; i++) {
          const date = new Date(String(result[i][col]));
          if (!Number.isNaN(date.getTime())) {
            // Add time-based features
            const year = date.getFullYear();
            const month = date.getMonth() + 1;
            const day = date.getDate();
            const dayOfWeek = date.getDay();
            const dayOfYear = this.getDayOfYear(date);
            const weekOfYear = this.getWeekOfYear(date);
            const quarter = Math.floor((month - 1) / 3) + 1;
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            
            // Add features with column-specific names
            const baseName = col.replace(/[^a-zA-Z0-9]/g, '_');
            
            result[i][`${baseName}_year`] = year;
            result[i][`${baseName}_month`] = month;
            result[i][`${baseName}_day`] = day;
            result[i][`${baseName}_day_of_week`] = dayOfWeek;
            result[i][`${baseName}_day_of_year`] = dayOfYear;
            result[i][`${baseName}_week_of_year`] = weekOfYear;
            result[i][`${baseName}_quarter`] = quarter;
            result[i][`${baseName}_is_weekend`] = isWeekend;
            
            // Track added features
            if (!featuresAdded.includes(`${baseName}_year`)) {
              featuresAdded.push(
                `${baseName}_year`,
                `${baseName}_month`,
                `${baseName}_day`,
                `${baseName}_day_of_week`,
                `${baseName}_day_of_year`,
                `${baseName}_week_of_year`,
                `${baseName}_quarter`,
                `${baseName}_is_weekend`
              );
            }
          }
        }
      }
    }
    
    // Add polynomial features
    if (config.polynomialFeatures && config.polynomialDegree > 1) {
      const numericColumns = Object.entries(schema as Record<string, any>)
        .filter(([_, s]) => s.type === 'integer' || s.type === 'float')
        .map(([col]) => col);
      
      for (const col of numericColumns) {
        for (let degree = 2; degree <= config.polynomialDegree; degree++) {
          const newCol = `${col}^${degree}`;
          for (let i = 0; i < result.length; i++) {
            const val = Number(result[i][col]);
            if (!Number.isNaN(val) && Number.isFinite(val)) {
              result[i][newCol] = Math.pow(val, degree);
            }
          }
          if (!featuresAdded.includes(newCol)) {
            featuresAdded.push(newCol);
          }
        }
      }
    }
    
    // Add interaction features
    if (config.interactionFeatures) {
      const numericColumns = Object.entries(schema as Record<string, any>)
        .filter(([_, s]) => s.type === 'integer' || s.type === 'float')
        .map(([col]) => col);
      
      // Create interactions between all pairs
      for (let i = 0; i < numericColumns.length; i++) {
        for (let j = i + 1; j < numericColumns.length; j++) {
          const col1 = numericColumns[i];
          const col2 = numericColumns[j];
          const newCol = `${col1}_x_${col2}`;
          
          for (let k = 0; k < result.length; k++) {
            const val1 = Number(result[k][col1]);
            const val2 = Number(result[k][col2]);
            if (!Number.isNaN(val1) && !Number.isNaN(val2) && 
                Number.isFinite(val1) && Number.isFinite(val2)) {
              result[k][newCol] = val1 * val2;
            }
          }
          if (!featuresAdded.includes(newCol)) {
            featuresAdded.push(newCol);
          }
        }
      }
    }
    
    return result;
  }
  
  /**
   * Apply scaling to numeric columns
   */
  private applyScaling(
    dataframe: Record<string, unknown>[],
    schema: Record<string, any>,
    config: any,
    scalingApplied: Record<string, string>
  ): Record<string, unknown>[] {
    const result = JSON.parse(JSON.stringify(dataframe));
    
    const columnsToScale = config.columns?.length > 0
      ? config.columns.filter((col: string) => 
          schema[col]?.type === 'integer' || schema[col]?.type === 'float')
      : Object.entries(schema as Record<string, any>)
          .filter(([_, s]) => s.type === 'integer' || s.type === 'float')
          .map(([col]) => col);
    
    // Exclude specified columns
    const excludeColumns = config.exclude ?? [];
    const finalColumns = columnsToScale.filter((col: string) => !excludeColumns.includes(col));
    
    for (const col of finalColumns) {
      const values = this.extractNumericColumn(result, col);
      if (values.length === 0) continue;
      
      switch (config.method) {
        case 'standard':
          const avg = mean(values);
          const std = stdev(values);
          if (std > 0) {
            for (let i = 0; i < result.length; i++) {
              const val = Number(result[i][col]);
              if (!Number.isNaN(val) && Number.isFinite(val)) {
                result[i][col] = (val - avg) / std;
              }
            }
            scalingApplied[col] = 'standard';
          }
          break;
          
        case 'minmax':
          const minVal = min(values);
          const maxVal = max(values);
          const range = maxVal - minVal;
          if (range > 0) {
            for (let i = 0; i < result.length; i++) {
              const val = Number(result[i][col]);
              if (!Number.isNaN(val) && Number.isFinite(val)) {
                result[i][col] = (val - minVal) / range;
              }
            }
            scalingApplied[col] = 'minmax';
          }
          break;
          
        case 'robust':
          const sorted = [...values].sort((a, b) => a - b);
          const q1 = sorted[Math.floor(sorted.length * 0.25)];
          const q3 = sorted[Math.floor(sorted.length * 0.75)];
          const iqr = q3 - q1;
          if (iqr > 0) {
            for (let i = 0; i < result.length; i++) {
              const val = Number(result[i][col]);
              if (!Number.isNaN(val) && Number.isFinite(val)) {
                result[i][col] = (val - q1) / iqr;
              }
            }
            scalingApplied[col] = 'robust';
          }
          break;
      }
    }
    
    return result;
  }
  
  /**
   * Apply encoding to categorical columns
   */
  private applyEncoding(
    dataframe: Record<string, unknown>[],
    schema: Record<string, any>,
    config: any,
    encodingApplied: Record<string, string>,
    featuresAdded: string[]
  ): Record<string, unknown>[] {
    const result = JSON.parse(JSON.stringify(dataframe));
    
    const columnsToEncode = config.columns?.length > 0
      ? config.columns.filter((col: string) => 
          schema[col]?.type === 'categorical' || schema[col]?.type === 'string')
      : Object.entries(schema as Record<string, any>)
          .filter(([_, s]) => s.type === 'categorical' || s.type === 'string')
          .map(([col]) => col);
    
    for (const col of columnsToEncode) {
      const values = dataframe.map(row => row[col]);
      const uniqueValues = [...new Set(values.filter(v => v !== null && v !== undefined))];
      
      switch (config.method) {
        case 'onehot':
          // One-hot encoding
          for (const value of uniqueValues) {
            const newCol = `${col}_${String(value).replace(/[^a-zA-Z0-9]/g, '_')}`;
            for (let i = 0; i < result.length; i++) {
              result[i][newCol] = result[i][col] === value ? 1 : 0;
            }
            if (!featuresAdded.includes(newCol)) {
              featuresAdded.push(newCol);
            }
          }
          encodingApplied[col] = 'onehot';
          
          // Optionally drop first category to avoid multicollinearity
          if (config.dropFirst && uniqueValues.length > 0) {
            const firstValue = uniqueValues[0];
            const firstCol = `${col}_${String(firstValue).replace(/[^a-zA-Z0-9]/g, '_')}`;
            for (let i = 0; i < result.length; i++) {
              delete result[i][firstCol];
            }
            featuresAdded = featuresAdded.filter(c => c !== firstCol);
          }
          break;
          
        case 'label':
          // Label encoding
          const valueToIndex = new Map(uniqueValues.map((v, i) => [v, i]));
          for (let i = 0; i < result.length; i++) {
            const value = result[i][col];
            result[i][col] = valueToIndex.get(value) ?? -1;
          }
          encodingApplied[col] = 'label';
          break;
          
        case 'ordinal':
          // Ordinal encoding (for ordered categories)
          // For now, use the same as label encoding
          const valueToIndexOrdinal = new Map(uniqueValues.map((v, i) => [v, i]));
          for (let i = 0; i < result.length; i++) {
            const value = result[i][col];
            result[i][col] = valueToIndexOrdinal.get(value) ?? -1;
          }
          encodingApplied[col] = 'ordinal';
          break;
      }
    }
    
    return result;
  }
  
  /**
   * Apply feature selection
   */
  private applyFeatureSelection(
    dataframe: Record<string, unknown>[],
    schema: Record<string, any>,
    config: any,
    featuresRemoved: string[]
  ): Record<string, unknown>[] {
    const result = JSON.parse(JSON.stringify(dataframe));
    
    const numericColumns = Object.entries(schema as Record<string, any>)
      .filter(([_, s]) => s.type === 'integer' || s.type === 'float')
      .map(([col]) => col);
    
    const columnsToRemove: string[] = [];
    
    switch (config.method) {
      case 'variance':
        // Remove low-variance features
        for (const col of numericColumns) {
          const values = this.extractNumericColumn(result, col);
          if (values.length === 0) continue;
          
          const variance = this.calculateVariance(values);
          if (variance < config.threshold) {
            columnsToRemove.push(col);
          }
        }
        break;
        
      case 'correlation':
        // Remove highly correlated features
        if (config.targetColumn) {
          const targetValues = this.extractNumericColumn(result, config.targetColumn);
          if (targetValues.length > 0) {
            for (const col of numericColumns) {
              if (col === config.targetColumn) continue;
              
              const colValues = this.extractNumericColumn(result, col);
              if (colValues.length === 0) continue;
              
              const corr = correlation(targetValues, colValues);
              if (Math.abs(corr) < config.threshold) {
                columnsToRemove.push(col);
              }
            }
          }
        }
        break;
    }
    
    // Remove the columns
    for (const col of columnsToRemove) {
      for (const row of result) {
        delete row[col];
      }
      featuresRemoved.push(col);
    }
    
    return result;
  }
  
  /**
   * Apply PCA (simplified version)
   */
  private applyPCA(
    dataframe: Record<string, unknown>[],
    schema: Record<string, any>,
    nComponents: number,
    report: any
  ): Record<string, unknown>[] {
    const result = JSON.parse(JSON.stringify(dataframe));
    
    // Get numeric columns
    const numericColumns = Object.entries(schema as Record<string, any>)
      .filter(([_, s]) => s.type === 'integer' || s.type === 'float')
      .map(([col]) => col);
    
    if (numericColumns.length === 0 || nComponents <= 0) {
      return result;
    }
    
    // Standardize the data
    const standardizedData: number[][] = [];
    const means: number[] = [];
    const stds: number[] = [];
    
    for (const col of numericColumns) {
      const values = this.extractNumericColumn(result, col);
      const avg = mean(values);
      const std = stdev(values);
      means.push(avg);
      stds.push(std > 0 ? std : 1);
    }
    
    for (let i = 0; i < result.length; i++) {
      const row: number[] = [];
      for (let j = 0; j < numericColumns.length; j++) {
        const col = numericColumns[j];
        const val = Number(result[i][col]);
        row.push(!Number.isNaN(val) && Number.isFinite(val) ? (val - means[j]) / stds[j] : 0);
      }
      standardizedData.push(row);
    }
    
    // Calculate covariance matrix
    const n = standardizedData.length;
    const covarianceMatrix: number[][] = [];
    
    for (let i = 0; i < numericColumns.length; i++) {
      covarianceMatrix[i] = [];
      for (let j = 0; j < numericColumns.length; j++) {
        let sum = 0;
        for (let k = 0; k < n; k++) {
          sum += standardizedData[k][i] * standardizedData[k][j];
        }
        covarianceMatrix[i][j] = sum / (n - 1);
      }
    }
    
    // Calculate eigenvalues and eigenvectors (simplified power iteration)
    const { eigenvalues, eigenvectors } = this.powerIteration(covarianceMatrix, nComponents);
    
    // Project data onto principal components
    for (let i = 0; i < result.length; i++) {
      for (let j = 0; j < nComponents; j++) {
        let sum = 0;
        for (let k = 0; k < numericColumns.length; k++) {
          sum += standardizedData[i][k] * eigenvectors[k][j];
        }
        result[i][`PC${j + 1}`] = sum;
        if (!report.featuresAdded.includes(`PC${j + 1}`)) {
          report.featuresAdded.push(`PC${j + 1}`);
        }
      }
    }
    
    // Optionally remove original columns
    // for (const col of numericColumns) {
    //   for (const row of result) {
    //     delete row[col];
    //   }
    //   report.featuresRemoved.push(col);
    // }
    
    return result;
  }
  
  /**
   * Calculate variance
   */
  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const avg = mean(values);
    let sum = 0;
    for (const val of values) {
      sum += Math.pow(val - avg, 2);
    }
    return sum / values.length;
  }
  
  /**
   * Power iteration for eigenvalue decomposition (simplified)
   */
  private powerIteration(
    matrix: number[][],
    nComponents: number
  ): { eigenvalues: number[]; eigenvectors: number[][] } {
    const n = matrix.length;
    const eigenvalues: number[] = [];
    const eigenvectors: number[][] = [];
    
    // Simple power iteration for the first nComponents eigenvectors
    for (let comp = 0; comp < nComponents; comp++) {
      // Initialize random vector
      let vector = new Array(n).fill(0).map(() => Math.random() * 2 - 1);
      
      // Normalize
      let norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
      if (norm > 0) {
        vector = vector.map(v => v / norm);
      }
      
      // Power iteration
      for (let iter = 0; iter < 100; iter++) {
        const newVector = new Array(n).fill(0);
        
        for (let i = 0; i < n; i++) {
          for (let j = 0; j < n; j++) {
            newVector[i] += matrix[i][j] * vector[j];
          }
        }
        
        // Normalize
        norm = Math.sqrt(newVector.reduce((sum, v) => sum + v * v, 0));
        if (norm > 0) {
          vector = newVector.map(v => v / norm);
        }
      }
      
      // Calculate eigenvalue (Rayleigh quotient)
      let eigenvalue = 0;
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          eigenvalue += vector[i] * matrix[i][j] * vector[j];
        }
      }
      
      eigenvalues.push(eigenvalue);
      eigenvectors.push(vector);
      
      // Deflate the matrix (optional, for better accuracy)
      // This is a simplified version
    }
    
    return { eigenvalues, eigenvectors };
  }
  
  /**
   * Calculate feature statistics
   */
  private calculateFeatureStatistics(
    dataframe: Record<string, unknown>[],
    schema: Record<string, any>
  ): Record<string, Record<string, number>> {
    const statistics: Record<string, Record<string, number>> = {};
    
    for (const col of Object.keys(dataframe[0] || {})) {
      const colSchema = schema[col];
      
      if (colSchema?.type === 'integer' || colSchema?.type === 'float') {
        const values = this.extractNumericColumn(dataframe, col);
        
        if (values.length > 0) {
          statistics[col] = {
            count: values.length,
            mean: mean(values),
            median: median(values),
            min: min(values),
            max: max(values),
            stdev: stdev(values),
            nullCount: dataframe.length - values.length,
          };
        }
      }
    }
    
    return statistics;
  }
  
  /**
   * Calculate correlation matrix
   */
  private calculateCorrelationMatrix(
    dataframe: Record<string, unknown>[],
    schema: Record<string, any>
  ): Record<string, Record<string, number>> {
    const correlationMatrix: Record<string, Record<string, number>> = {};
    
    const numericColumns = Object.entries(schema as Record<string, any>)
      .filter(([_, s]) => s.type === 'integer' || s.type === 'float')
      .map(([col]) => col);
    
    for (const col1 of numericColumns) {
      correlationMatrix[col1] = {};
      const values1 = this.extractNumericColumn(dataframe, col1);
      
      for (const col2 of numericColumns) {
        const values2 = this.extractNumericColumn(dataframe, col2);
        correlationMatrix[col1][col2] = correlation(values1, values2);
      }
    }
    
    return correlationMatrix;
  }
  
  /**
   * Get day of year
   */
  private getDayOfYear(date: Date): number {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date.getTime() - start.getTime();
    const oneDay = 1000 * 60 * 60 * 24;
    return Math.floor(diff / oneDay);
  }
  
  /**
   * Get week of year
   */
  private getWeekOfYear(date: Date): number {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
    const week1 = new Date(d.getFullYear(), 0, 4);
    return Math.floor(1.5 + (d.getTime() - week1.getTime()) / 604800000);
  }
}

// ============================================================================
// Exports
// ============================================================================

export { metadata as dataEngineerAgentMetadata };
export default DataEngineerAgent;
