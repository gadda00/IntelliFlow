/**
 * Data Profiler Agent
 * ====================
 * 
 * Stage 0 - Ingest
 * 
 * Responsible for creating a comprehensive profile of the dataset.
 * Calculates statistics, distributions, and other metadata for each column.
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
import { mean, median, stdev, min, max, range, skewness, kurtosis, iqr } from '../../math';

// ============================================================================
// Agent Metadata
// ============================================================================

const metadata = createAgentMetadata({
  // Identity
  id: 'data_profiler',
  name: 'Data Profiler',
  description: 'Creates a comprehensive profile of the dataset including statistics, distributions, and metadata for each column.',
  version: '1.0.0',
  
  // Classification
  stage: 'ingest' as AgentStage,
  stageNumber: 0,
  tier: 'core' as AgentTier,
  stability: 'stable' as AgentStability,
  
  // Author
  author: 'Busara Team',
  license: 'MIT',
  
  // Dependencies
  dependencies: ['data_ingestion', 'schema_inference'],
  
  // Execution
  timeoutMs: 20000,
  maxRetries: 3,
  
  // Capabilities
  capabilities: ['statistics', 'distribution_analysis', 'data_profiling'],
  category: 'data',
  tags: ['profiling', 'statistics', 'analysis'],
  
  // Input/Output
  inputDescription: 'Dataframe with schema information',
  outputDescription: 'Comprehensive data profile with column statistics',
  inputSchema: {
    schema: z.object({
      dataframe: z.array(z.record(z.string(), z.unknown())),
      schema: z.record(z.string(), z.object({
        type: z.string(),
        confidence: z.number(),
        nullCount: z.number(),
        uniqueCount: z.number(),
      })),
    }),
    description: 'Dataframe and schema from previous agents',
  },
  outputSchema: {
    schema: z.object({
      profile: z.record(z.string(), z.object({
        type: z.string(),
        count: z.number(),
        nullCount: z.number(),
        nullPercentage: z.number(),
        uniqueCount: z.number(),
        uniquePercentage: z.number(),
        statistics: z.record(z.string(), z.number()).optional(),
        distribution: z.record(z.string(), z.number()).optional(),
      })),
      summary: z.object({
        rowCount: z.number(),
        columnCount: z.number(),
        memorySize: z.number(),
        completeness: z.number(),
        numericColumns: z.number(),
        categoricalColumns: z.number(),
        datetimeColumns: z.number(),
        booleanColumns: z.number(),
      }),
    }),
    description: 'Comprehensive data profile',
  },
  configSchema: {
    schema: z.object({
      includeDistributions: z.boolean().default(false),
      distributionBins: z.number().int().positive().max(100).default(10),
    }),
    defaults: {
      includeDistributions: false,
      distributionBins: 10,
    },
    description: 'Data profiler configuration',
  },
  
  // Technical requirements
  memoryLimitMB: 512,
  cpuLimit: 2,
  gpuRequired: false,
  
  // UI
  icon: 'BarChart3',
  color: '#8b5cf6',
});

// ============================================================================
// Agent Implementation
// ============================================================================

/**
 * DataProfilerAgent creates a comprehensive profile of the dataset.
 */
export class DataProfilerAgent extends BaseAgent {
  readonly metadata: EnhancedAgentMetadata = metadata;
  
  async execute(context: EnhancedAgentContext): Promise<AgentResult> {
    const start = Date.now();
    const { dataframe, config, previousResults } = context;
    
    // Get configuration
    const includeDistributions = config.includeDistributions ?? false;
    const distributionBins = config.distributionBins ?? 10;
    
    try {
      // Validate input
      if (!dataframe || !Array.isArray(dataframe) || dataframe.length === 0) {
        return this.createError('No data provided for profiling', Date.now() - start);
      }
      
      const columns = Object.keys(dataframe[0]);
      const rowCount = dataframe.length;
      const memorySize = JSON.stringify(dataframe).length;
      
      // Get schema from previous results
      const schemaResult = previousResults.get('schema_inference');
      const schema = ((schemaResult?.output as any)?.schema) ?? {};
      
      const profile: Record<string, any> = {};
      let numericColumns = 0;
      let categoricalColumns = 0;
      let datetimeColumns = 0;
      let booleanColumns = 0;
      
      // Profile each column
      for (const col of columns) {
        const columnProfile = this.profileColumn(
          dataframe,
          col,
          schema[col]?.type,
          includeDistributions,
          distributionBins
        );
        profile[col] = columnProfile;
        
        // Update column type counts
        switch (columnProfile.type) {
          case 'integer':
          case 'float':
          case 'numeric':
            numericColumns++;
            break;
          case 'datetime':
            datetimeColumns++;
            break;
          case 'boolean':
            booleanColumns++;
            break;
          case 'categorical':
          case 'text':
            categoricalColumns++;
            break;
        }
      }
      
      // Calculate completeness
      const totalCells = rowCount * columns.length;
      let nullCells = 0;
      for (const col of columns) {
        nullCells += profile[col].nullCount;
      }
      const completeness = 1 - (nullCells / totalCells);
      
      const output = {
        profile,
        summary: {
          rowCount,
          columnCount: columns.length,
          memorySize,
          completeness,
          numericColumns,
          categoricalColumns,
          datetimeColumns,
          booleanColumns,
        },
      };
      
      const executionTimeMs = Date.now() - start;
      
      return this.createResult(output, {
        rowCount,
        columnCount: columns.length,
        completeness,
      }, executionTimeMs);
      
    } catch (error) {
      const executionTimeMs = Date.now() - start;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return this.createError(errorMessage, executionTimeMs);
    }
  }
  
  /**
   * Create a profile for a single column
   */
  private profileColumn(
    dataframe: Record<string, unknown>[],
    column: string,
    inferredType: string | undefined,
    includeDistributions: boolean,
    distributionBins: number
  ): Record<string, any> {
    const values = dataframe.map(row => row[column]);
    const nonNull = values.filter(v => v !== null && v !== undefined && v !== '');
    const nullCount = values.length - nonNull.length;
    const uniqueCount = new Set(nonNull).size;
    
    const type = inferredType ?? this.inferType(nonNull);
    
    const profile: Record<string, any> = {
      type,
      count: values.length,
      nullCount,
      nullPercentage: values.length > 0 ? nullCount / values.length : 0,
      uniqueCount,
      uniquePercentage: values.length > 0 ? uniqueCount / values.length : 0,
    };
    
    // Add statistics for numeric columns
    if (['integer', 'float', 'numeric'].includes(type)) {
      const numericValues = nonNull.filter(v => typeof v === 'number') as number[];
      if (numericValues.length > 0) {
        profile.statistics = {
          mean: mean(numericValues),
          median: median(numericValues),
          min: min(numericValues),
          max: max(numericValues),
          range: range(numericValues),
          stdev: stdev(numericValues),
          variance: stdev(numericValues) ** 2,
          iqr: iqr(numericValues),
          skewness: skewness(numericValues),
          kurtosis: kurtosis(numericValues),
        };
        
        // Add distribution if requested
        if (includeDistributions) {
          profile.distribution = this.calculateDistribution(numericValues, distributionBins);
        }
      }
    }
    
    // Add distribution for categorical columns
    if (['categorical', 'text'].includes(type) && includeDistributions) {
      profile.distribution = this.calculateCategoricalDistribution(nonNull);
    }
    
    return profile;
  }
  
  /**
   * Infer the type of a column
   */
  private inferType(values: unknown[]): string {
    if (values.length === 0) return 'null';
    
    // Check for numeric
    const numericCount = values.filter(v => {
      if (typeof v === 'number') return true;
      if (typeof v === 'string') {
        const num = Number(v);
        return !Number.isNaN(num) && Number.isFinite(num);
      }
      return false;
    }).length;
    
    if (numericCount / values.length > 0.8) {
      const integerCount = values.filter(v => {
        if (typeof v === 'number') return Number.isInteger(v);
        if (typeof v === 'string') {
          const num = Number(v);
          return !Number.isNaN(num) && Number.isInteger(num);
        }
        return false;
      }).length;
      
      return integerCount / numericCount > 0.8 ? 'integer' : 'float';
    }
    
    // Check for boolean
    const booleanCount = values.filter(v => {
      if (typeof v === 'boolean') return true;
      if (typeof v === 'string') {
        return ['true', 'false', 'yes', 'no', '1', '0'].includes(v.toLowerCase());
      }
      return false;
    }).length;
    
    if (booleanCount / values.length > 0.8) {
      return 'boolean';
    }
    
    // Check for datetime
    const dateCount = values.filter(v => {
      if (v instanceof Date) return true;
      if (typeof v === 'string') {
        const date = new Date(String(v));
        return !Number.isNaN(date.getTime());
      }
      return false;
    }).length;
    
    if (dateCount / values.length > 0.8) {
      return 'datetime';
    }
    
    // Check for categorical (low cardinality)
    const uniqueRatio = values.length > 0 ? new Set(values).size / values.length : 0;
    if (uniqueRatio < 0.1) {
      return 'categorical';
    }
    
    return 'text';
  }
  
  /**
   * Calculate distribution for numeric values
   */
  private calculateDistribution(values: number[], bins: number): Record<string, number> {
    if (values.length === 0) return {};
    
    const minVal = min(values);
    const maxVal = max(values);
    const binSize = (maxVal - minVal) / bins;
    
    const distribution: Record<string, number> = {};
    
    for (let i = 0; i < bins; i++) {
      const binStart = minVal + i * binSize;
      const binEnd = minVal + (i + 1) * binSize;
      const count = values.filter(v => v >= binStart && v < binEnd).length;
      distribution[`${binStart.toFixed(2)}-${binEnd.toFixed(2)}`] = count;
    }
    
    return distribution;
  }
  
  /**
   * Calculate distribution for categorical values
   */
  private calculateCategoricalDistribution(values: unknown[]): Record<string, number> {
    const distribution: Record<string, number> = {};
    
    for (const value of values) {
      const key = String(value);
      distribution[key] = (distribution[key] ?? 0) + 1;
    }
    
    return distribution;
  }
}

// ============================================================================
// Exports
// ============================================================================

export { metadata as dataProfilerAgentMetadata };
export default DataProfilerAgent;
