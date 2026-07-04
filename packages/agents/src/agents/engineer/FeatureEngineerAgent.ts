/**
 * Feature Engineer Agent
 * =======================
 * 
 * Stage 1 - Engineer
 * 
 * Responsible for creating advanced features from existing data.
 * Implements polynomial features, interaction terms, and domain-specific transformations.
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
import { mean, stdev, min, max, correlation } from '../../math';

// ============================================================================
// Agent Metadata
// ============================================================================

const metadata = createAgentMetadata({
  // Identity
  id: 'feature_engineer',
  name: 'Feature Engineer',
  description: 'Creates advanced features including polynomial terms, interaction terms, and domain-specific transformations to enhance model performance.',
  version: '1.0.0',
  
  // Classification
  stage: 'engineer' as AgentStage,
  stageNumber: 1,
  tier: 'advanced' as AgentTier,
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
    'polynomial_features',
    'interaction_terms',
    'domain_features',
    'feature_transformation',
    'feature_selection',
  ],
  category: 'data',
  tags: ['feature-engineering', 'polynomial', 'interaction', 'transformation'],
  
  // Input/Output
  inputDescription: 'Engineered dataframe with schema from previous agents',
  outputDescription: 'Dataframe with advanced features and feature engineering report',
  inputSchema: {
    schema: z.object({
      dataframe: z.array(z.record(z.unknown())),
      schema: z.record(z.string(), z.object({
        type: z.string(),
        confidence: z.number(),
        nullCount: z.number(),
        uniqueCount: z.number(),
      })),
      engineeringReport: z.object({}).optional(),
    }),
    description: 'Engineered dataframe and schema from previous agents',
  },
  outputSchema: {
    schema: z.object({
      featureEngineeredDataframe: z.array(z.record(z.unknown())),
      featureEngineeringReport: z.object({
        featuresAdded: z.array(z.string()),
        polynomialFeatures: z.array(z.string()),
        interactionFeatures: z.array(z.string()),
        domainFeatures: z.array(z.string()),
        featureImportance: z.record(z.string(), z.number()),
        featureCorrelations: z.record(z.string(), z.record(z.string(), z.number())),
      }),
    }),
    description: 'Feature-engineered dataframe with detailed report',
  },
  configSchema: {
    schema: z.object({
      // Polynomial features
      polynomial: z.object({
        enabled: z.boolean().default(true),
        degree: z.number().int().positive().max(5).default(2),
        includeBias: z.boolean().default(false),
        columns: z.array(z.string()).optional(),
      }).default({}),
      
      // Interaction features
      interactions: z.object({
        enabled: z.boolean().default(true),
        maxDegree: z.number().int().positive().max(3).default(2),
        columns: z.array(z.string()).optional(),
        includeSelf: z.boolean().default(false),
      }).default({}),
      
      // Domain-specific features
      domainFeatures: z.object({
        enabled: z.boolean().default(true),
        datetimeFeatures: z.boolean().default(true),
        textFeatures: z.boolean().default(false),
        numericBins: z.boolean().default(false),
        binCount: z.number().int().positive().max(20).default(5),
      }).default({}),
      
      // Feature transformation
      transformations: z.object({
        enabled: z.boolean().default(true),
        logTransform: z.array(z.string()).optional(),
        sqrtTransform: z.array(z.string()).optional(),
        expTransform: z.array(z.string()).optional(),
        boxCox: z.array(z.string()).optional(),
      }).default({}),
      
      // Feature selection
      selection: z.object({
        enabled: z.boolean().default(false),
        method: z.enum(['variance', 'correlation', 'importance']).default('variance'),
        threshold: z.number().min(0).max(1).default(0.1),
        targetColumn: z.string().optional(),
        maxFeatures: z.number().int().positive().max(100).default(20),
      }).default({}),
      
      // Advanced options
      advanced: z.object({
        removeOriginal: z.boolean().default(false),
        prefix: z.string().default('fe_'),
        suffix: z.string().default(''),
      }).default({}),
    }),
    defaults: {
      polynomial: {
        enabled: true,
        degree: 2,
        includeBias: false,
      },
      interactions: {
        enabled: true,
        maxDegree: 2,
        includeSelf: false,
      },
      domainFeatures: {
        enabled: true,
        datetimeFeatures: true,
        textFeatures: false,
        numericBins: false,
        binCount: 5,
      },
      transformations: {
        enabled: true,
      },
      selection: {
        enabled: false,
      },
      advanced: {
        removeOriginal: false,
        prefix: 'fe_',
        suffix: '',
      },
    },
    description: 'Feature engineering configuration',
  },
  
  // Technical requirements
  memoryLimitMB: 1024,
  cpuLimit: 4,
  gpuRequired: false,
  
  // UI
  icon: 'Cpu',
  color: '#10b981',
});

// ============================================================================
// Agent Implementation
// ============================================================================

/**
 * FeatureEngineerAgent creates advanced features from existing data.
 */
export class FeatureEngineerAgent extends BaseAgent {
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
      const schema = schemaResult?.output?.schema ?? {};
      
      // Get configuration
      const polyConfig = config.polynomial ?? {};
      const interactionConfig = config.interactions ?? {};
      const domainConfig = config.domainFeatures ?? {};
      const transformConfig = config.transformations ?? {};
      const selectionConfig = config.selection ?? {};
      const advancedConfig = config.advanced ?? {};
      
      // Initialize report
      const featureEngineeringReport = {
        featuresAdded: [] as string[],
        polynomialFeatures: [] as string[],
        interactionFeatures: [] as string[],
        domainFeatures: [] as string[],
        featureImportance: {} as Record<string, number>,
        featureCorrelations: {} as Record<string, Record<string, number>>,
      };
      
      // Create a copy to modify
      let featureEngineeredDataframe = JSON.parse(JSON.stringify(dataframe));
      
      // Step 1: Apply transformations
      if (transformConfig.enabled) {
        featureEngineeredDataframe = this.applyTransformations(
          featureEngineeredDataframe,
          schema,
          transformConfig,
          featureEngineeringReport.featuresAdded
        );
      }
      
      // Step 2: Create domain-specific features
      if (domainConfig.enabled) {
        featureEngineeredDataframe = this.createDomainFeatures(
          featureEngineeredDataframe,
          schema,
          domainConfig,
          featureEngineeringReport.domainFeatures
        );
      }
      
      // Step 3: Create polynomial features
      if (polyConfig.enabled) {
        featureEngineeredDataframe = this.createPolynomialFeatures(
          featureEngineeredDataframe,
          schema,
          polyConfig,
          featureEngineeringReport.polynomialFeatures,
          advancedConfig.prefix
        );
      }
      
      // Step 4: Create interaction features
      if (interactionConfig.enabled) {
        featureEngineeredDataframe = this.createInteractionFeatures(
          featureEngineeredDataframe,
          schema,
          interactionConfig,
          featureEngineeringReport.interactionFeatures,
          advancedConfig.prefix
        );
      }
      
      // Step 5: Feature selection
      if (selectionConfig.enabled) {
        featureEngineeredDataframe = this.applyFeatureSelection(
          featureEngineeredDataframe,
          schema,
          selectionConfig,
          featureEngineeringReport.featureImportance,
          featureEngineeringReport.featuresAdded
        );
      }
      
      // Step 6: Optionally remove original features
      if (advancedConfig.removeOriginal) {
        featureEngineeredDataframe = this.removeOriginalFeatures(
          featureEngineeredDataframe,
          schema,
          featureEngineeringReport
        );
      }
      
      // Calculate feature correlations
      featureEngineeringReport.featureCorrelations = this.calculateFeatureCorrelations(
        featureEngineeredDataframe,
        schema
      );
      
      // Update featuresAdded with all new features
      featureEngineeringReport.featuresAdded = [
        ...new Set([
          ...featureEngineeringReport.polynomialFeatures,
          ...featureEngineeringReport.interactionFeatures,
          ...featureEngineeringReport.domainFeatures,
        ]),
      ];
      
      const output = {
        featureEngineeredDataframe,
        featureEngineeringReport,
      };
      
      const executionTimeMs = Date.now() - start;
      
      return this.createResult(output, {
        featuresAdded: featureEngineeringReport.featuresAdded.length,
        polynomialFeatures: featureEngineeringReport.polynomialFeatures.length,
        interactionFeatures: featureEngineeringReport.interactionFeatures.length,
        domainFeatures: featureEngineeringReport.domainFeatures.length,
        totalFeatures: Object.keys(featureEngineeredDataframe[0] || {}).length,
      }, executionTimeMs);
      
    } catch (error) {
      const executionTimeMs = Date.now() - start;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return this.createError(errorMessage, executionTimeMs);
    }
  }
  
  /**
   * Apply transformations to numeric columns
   */
  private applyTransformations(
    dataframe: Record<string, unknown>[],
    schema: Record<string, any>,
    config: any,
    featuresAdded: string[]
  ): Record<string, unknown>[] {
    const result = JSON.parse(JSON.stringify(dataframe));
    
    // Log transform
    if (config.logTransform?.length > 0) {
      for (const col of config.logTransform) {
        if (schema[col]?.type === 'integer' || schema[col]?.type === 'float') {
          const newCol = `${config.prefix ?? 'fe_'}log_${col}`;
          for (let i = 0; i < result.length; i++) {
            const val = Number(result[i][col]);
            if (val > 0) {
              result[i][newCol] = Math.log(val);
            }
          }
          if (!featuresAdded.includes(newCol)) {
            featuresAdded.push(newCol);
          }
        }
      }
    }
    
    // Square root transform
    if (config.sqrtTransform?.length > 0) {
      for (const col of config.sqrtTransform) {
        if (schema[col]?.type === 'integer' || schema[col]?.type === 'float') {
          const newCol = `${config.prefix ?? 'fe_'}sqrt_${col}`;
          for (let i = 0; i < result.length; i++) {
            const val = Number(result[i][col]);
            if (val >= 0) {
              result[i][newCol] = Math.sqrt(val);
            }
          }
          if (!featuresAdded.includes(newCol)) {
            featuresAdded.push(newCol);
          }
        }
      }
    }
    
    // Exponential transform
    if (config.expTransform?.length > 0) {
      for (const col of config.expTransform) {
        if (schema[col]?.type === 'integer' || schema[col]?.type === 'float') {
          const newCol = `${config.prefix ?? 'fe_'}exp_${col}`;
          for (let i = 0; i < result.length; i++) {
            const val = Number(result[i][col]);
            result[i][newCol] = Math.exp(val);
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
   * Create domain-specific features
   */
  private createDomainFeatures(
    dataframe: Record<string, unknown>[],
    schema: Record<string, any>,
    config: any,
    domainFeatures: string[]
  ): Record<string, unknown>[] {
    const result = JSON.parse(JSON.stringify(dataframe));
    
    // Datetime features
    if (config.datetimeFeatures) {
      const datetimeColumns = Object.entries(schema)
        .filter(([_, s]) => s.type === 'datetime')
        .map(([col]) => col);
      
      for (const col of datetimeColumns) {
        for (let i = 0; i < result.length; i++) {
          const date = new Date(String(result[i][col]));
          if (!Number.isNaN(date.getTime())) {
            // Advanced datetime features
            const hour = date.getHours();
            const minute = date.getMinutes();
            const second = date.getSeconds();
            const isMorning = hour >= 6 && hour < 12;
            const isAfternoon = hour >= 12 && hour < 18;
            const isEvening = hour >= 18 && hour < 24;
            const isNight = hour >= 0 && hour < 6;
            const isWeekday = date.getDay() >= 1 && date.getDay() <= 5;
            const isBusinessHours = isWeekday && isMorning;
            
            const baseName = col.replace(/[^a-zA-Z0-9]/g, '_');
            
            result[i][`${baseName}_hour`] = hour;
            result[i][`${baseName}_minute`] = minute;
            result[i][`${baseName}_second`] = second;
            result[i][`${baseName}_is_morning`] = isMorning;
            result[i][`${baseName}_is_afternoon`] = isAfternoon;
            result[i][`${baseName}_is_evening`] = isEvening;
            result[i][`${baseName}_is_night`] = isNight;
            result[i][`${baseName}_is_weekday`] = isWeekday;
            result[i][`${baseName}_is_business_hours`] = isBusinessHours;
            
            if (!domainFeatures.includes(`${baseName}_hour`)) {
              domainFeatures.push(
                `${baseName}_hour`,
                `${baseName}_minute`,
                `${baseName}_second`,
                `${baseName}_is_morning`,
                `${baseName}_is_afternoon`,
                `${baseName}_is_evening`,
                `${baseName}_is_night`,
                `${baseName}_is_weekday`,
                `${baseName}_is_business_hours`
              );
            }
          }
        }
      }
    }
    
    // Numeric binning
    if (config.numericBins) {
      const numericColumns = Object.entries(schema)
        .filter(([_, s]) => s.type === 'integer' || s.type === 'float')
        .map(([col]) => col);
      
      for (const col of numericColumns) {
        const values = this.extractNumericColumn(result, col);
        if (values.length === 0) continue;
        
        const minVal = min(values);
        const maxVal = max(values);
        const binSize = (maxVal - minVal) / config.binCount;
        
        for (let i = 0; i < result.length; i++) {
          const val = Number(result[i][col]);
          if (!Number.isNaN(val) && Number.isFinite(val)) {
            const bin = Math.min(Math.floor((val - minVal) / binSize), config.binCount - 1);
            result[i][`${col}_bin`] = bin;
          }
        }
        
        if (!domainFeatures.includes(`${col}_bin`)) {
          domainFeatures.push(`${col}_bin`);
        }
      }
    }
    
    return result;
  }
  
  /**
   * Create polynomial features
   */
  private createPolynomialFeatures(
    dataframe: Record<string, unknown>[],
    schema: Record<string, any>,
    config: any,
    polynomialFeatures: string[],
    prefix: string
  ): Record<string, unknown>[] {
    const result = JSON.parse(JSON.stringify(dataframe));
    
    const columns = config.columns?.length > 0
      ? config.columns.filter((col: string) => 
          schema[col]?.type === 'integer' || schema[col]?.type === 'float')
      : Object.entries(schema)
          .filter(([_, s]) => s.type === 'integer' || s.type === 'float')
          .map(([col]) => col);
    
    for (const col of columns) {
      for (let degree = 2; degree <= config.degree; degree++) {
        const newCol = `${prefix}${col}^${degree}`;
        for (let i = 0; i < result.length; i++) {
          const val = Number(result[i][col]);
          if (!Number.isNaN(val) && Number.isFinite(val)) {
            result[i][newCol] = Math.pow(val, degree);
          }
        }
        if (!polynomialFeatures.includes(newCol)) {
          polynomialFeatures.push(newCol);
        }
      }
    }
    
    // Add bias term if requested
    if (config.includeBias) {
      const biasCol = `${prefix}bias`;
      for (let i = 0; i < result.length; i++) {
        result[i][biasCol] = 1;
      }
      if (!polynomialFeatures.includes(biasCol)) {
        polynomialFeatures.push(biasCol);
      }
    }
    
    return result;
  }
  
  /**
   * Create interaction features
   */
  private createInteractionFeatures(
    dataframe: Record<string, unknown>[],
    schema: Record<string, any>,
    config: any,
    interactionFeatures: string[],
    prefix: string
  ): Record<string, unknown>[] {
    const result = JSON.parse(JSON.stringify(dataframe));
    
    const columns = config.columns?.length > 0
      ? config.columns.filter((col: string) => 
          schema[col]?.type === 'integer' || schema[col]?.type === 'float')
      : Object.entries(schema)
          .filter(([_, s]) => s.type === 'integer' || s.type === 'float')
          .map(([col]) => col);
    
    // Create interactions of specified degree
    for (let degree = 2; degree <= config.maxDegree; degree++) {
      this.createInteractionsOfDegree(
        result,
        columns,
        degree,
        config.includeSelf,
        interactionFeatures,
        prefix
      );
    }
    
    return result;
  }
  
  /**
   * Create interactions of a specific degree
   */
  private createInteractionsOfDegree(
    dataframe: Record<string, unknown>[],
    columns: string[],
    degree: number,
    includeSelf: boolean,
    interactionFeatures: string[],
    prefix: string
  ): void {
    // Generate all combinations of 'degree' columns
    const combinations = this.generateCombinations(columns, degree, includeSelf);
    
    for (const combo of combinations) {
      const newCol = `${prefix}${combo.join('_x_')}`;
      
      for (let i = 0; i < dataframe.length; i++) {
        let product = 1;
        let valid = true;
        
        for (const col of combo) {
          const val = Number(dataframe[i][col]);
          if (Number.isNaN(val) || !Number.isFinite(val)) {
            valid = false;
            break;
          }
          product *= val;
        }
        
        if (valid) {
          dataframe[i][newCol] = product;
        }
      }
      
      if (!interactionFeatures.includes(newCol)) {
        interactionFeatures.push(newCol);
      }
    }
  }
  
  /**
   * Generate all combinations of columns for interactions
   */
  private generateCombinations(
    columns: string[],
    degree: number,
    includeSelf: boolean
  ): string[][] {
    const combinations: string[][] = [];
    
    if (degree === 1) {
      return columns.map(col => [col]);
    }
    
    if (degree === 2) {
      for (let i = 0; i < columns.length; i++) {
        for (let j = includeSelf ? 0 : i + 1; j < columns.length; j++) {
          if (includeSelf || i !== j) {
            combinations.push([columns[i], columns[j]]);
          }
        }
      }
      return combinations;
    }
    
    // For higher degrees, use recursive approach
    return this.generateCombinationsRecursive(columns, degree, includeSelf, 0, []);
  }
  
  /**
   * Recursively generate combinations
   */
  private generateCombinationsRecursive(
    columns: string[],
    degree: number,
    includeSelf: boolean,
    start: number,
    current: string[]
  ): string[][] {
    if (current.length === degree) {
      return [current];
    }
    
    const combinations: string[][] = [];
    
    for (let i = start; i < columns.length; i++) {
      // Check if we can include this column (allow self-interaction if enabled)
      if (!includeSelf && current.includes(columns[i])) {
        continue;
      }
      
      const newCurrent = [...current, columns[i]];
      combinations.push(...this.generateCombinationsRecursive(
        columns,
        degree,
        includeSelf,
        includeSelf ? 0 : i + 1,
        newCurrent
      ));
    }
    
    return combinations;
  }
  
  /**
   * Apply feature selection
   */
  private applyFeatureSelection(
    dataframe: Record<string, unknown>[],
    schema: Record<string, any>,
    config: any,
    featureImportance: Record<string, number>,
    featuresAdded: string[]
  ): Record<string, unknown>[] {
    const result = JSON.parse(JSON.stringify(dataframe));
    
    const allColumns = Object.keys(result[0] || {});
    const numericColumns = allColumns.filter(col => 
      schema[col]?.type === 'integer' || schema[col]?.type === 'float' || 
      featuresAdded.includes(col)
    );
    
    // Calculate feature importance based on method
    switch (config.method) {
      case 'variance':
        for (const col of numericColumns) {
          const values = this.extractNumericColumn(result, col);
          if (values.length > 0) {
            const variance = this.calculateVariance(values);
            featureImportance[col] = variance;
          }
        }
        break;
        
      case 'correlation':
        if (config.targetColumn) {
          const targetValues = this.extractNumericColumn(result, config.targetColumn);
          if (targetValues.length > 0) {
            for (const col of numericColumns) {
              if (col === config.targetColumn) continue;
              const colValues = this.extractNumericColumn(result, col);
              if (colValues.length > 0) {
                featureImportance[col] = Math.abs(correlation(targetValues, colValues));
              }
            }
          }
        }
        break;
        
      case 'importance':
        // Use variance as a proxy for importance
        for (const col of numericColumns) {
          const values = this.extractNumericColumn(result, col);
          if (values.length > 0) {
            featureImportance[col] = this.calculateVariance(values);
          }
        }
        break;
    }
    
    // Sort features by importance
    const sortedFeatures = Object.entries(featureImportance)
      .sort(([, a], [, b]) => b - a)
      .map(([col]) => col);
    
    // Select top features
    const selectedFeatures = sortedFeatures.slice(0, config.maxFeatures);
    const featuresToRemove = numericColumns.filter(col => !selectedFeatures.includes(col));
    
    // Remove unselected features
    for (const col of featuresToRemove) {
      for (const row of result) {
        delete row[col];
      }
    }
    
    return result;
  }
  
  /**
   * Remove original features
   */
  private removeOriginalFeatures(
    dataframe: Record<string, unknown>[],
    schema: Record<string, any>,
    report: any
  ): Record<string, unknown>[] {
    const result = JSON.parse(JSON.stringify(dataframe));
    
    const originalColumns = Object.keys(schema);
    
    for (const col of originalColumns) {
      for (const row of result) {
        delete row[col];
      }
      report.featuresRemoved.push(col);
    }
    
    return result;
  }
  
  /**
   * Calculate feature correlations
   */
  private calculateFeatureCorrelations(
    dataframe: Record<string, unknown>[],
    schema: Record<string, any>
  ): Record<string, Record<string, number>> {
    const correlationMatrix: Record<string, Record<string, number>> = {};
    
    const allColumns = Object.keys(dataframe[0] || {});
    const numericColumns = allColumns.filter(col => {
      const values = this.extractNumericColumn(dataframe, col);
      return values.length > 0;
    });
    
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
}

// ============================================================================
// Exports
// ============================================================================

export { metadata as featureEngineerAgentMetadata };
export default FeatureEngineerAgent;
