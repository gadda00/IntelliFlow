/**
 * Data Cleaner Agent
 * ==================
 * 
 * Stage 1 - Engineer
 * 
 * Responsible for cleaning and normalizing data.
 * Handles missing values, duplicates, outliers, and type conversions.
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
import { mean, median, stdev } from '../../math';

// ============================================================================
// Agent Metadata
// ============================================================================

const metadata = createAgentMetadata({
  // Identity
  id: 'data_cleaner',
  name: 'Data Cleaner',
  description: 'Cleans and normalizes data by handling missing values, removing duplicates, standardizing formats, and converting types.',
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
  dependencies: ['data_ingestion', 'schema_inference'],
  
  // Execution
  timeoutMs: 30000,
  maxRetries: 3,
  
  // Capabilities
  capabilities: [
    'missing_value_handling',
    'duplicate_removal',
    'type_conversion',
    'data_normalization',
    'outlier_detection',
  ],
  category: 'data',
  tags: ['cleaning', 'normalization', 'preprocessing'],
  
  // Input/Output
  inputDescription: 'Dataframe with schema information from ingestion agents',
  outputDescription: 'Cleaned dataframe with cleaning report',
  inputSchema: {
    schema: z.object({
      dataframe: z.array(z.record(z.unknown())),
      schema: z.record(z.string(), z.object({
        type: z.string(),
        confidence: z.number(),
        nullCount: z.number(),
        uniqueCount: z.number(),
      })),
    }),
    description: 'Dataframe and schema from ingestion agents',
  },
  outputSchema: {
    schema: z.object({
      cleanedDataframe: z.array(z.record(z.unknown())),
      cleaningReport: z.object({
        originalRowCount: z.number(),
        cleanedRowCount: z.number(),
        rowsRemoved: z.number(),
        duplicatesRemoved: z.number(),
        missingValuesHandled: z.record(z.string(), z.number()),
        typeConversions: z.record(z.string(), z.number()),
        outliersHandled: z.record(z.string(), z.number()),
        columnsAdded: z.array(z.string()),
        columnsRemoved: z.array(z.string()),
      }),
      statistics: z.record(z.string(), z.record(z.string(), z.number())),
    }),
    description: 'Cleaned dataframe with detailed cleaning report',
  },
  configSchema: {
    schema: z.object({
      // Missing value handling
      missingValueStrategy: z.enum([
        'drop',
        'mean',
        'median',
        'mode',
        'zero',
        'empty',
        'custom',
      ]).default('drop'),
      customMissingValue: z.unknown().optional(),
      
      // Duplicate handling
      removeDuplicates: z.boolean().default(true),
      duplicateColumns: z.array(z.string()).optional(),
      
      // Outlier handling
      handleOutliers: z.boolean().default(false),
      outlierMethod: z.enum(['zscore', 'iqr', 'none']).default('zscore'),
      outlierThreshold: z.number().min(0).max(10).default(3),
      
      // Type conversion
      convertTypes: z.boolean().default(true),
      typeConversions: z.record(z.string(), z.string()).optional(),
      
      // Standardization
      standardize: z.boolean().default(false),
      standardizeColumns: z.array(z.string()).optional(),
      
      // Normalization
      normalize: z.boolean().default(false),
      normalizeColumns: z.array(z.string()).optional(),
      
      // Column handling
      dropColumns: z.array(z.string()).optional(),
      keepColumns: z.array(z.string()).optional(),
    }),
    defaults: {
      missingValueStrategy: 'drop',
      removeDuplicates: true,
      handleOutliers: false,
      outlierMethod: 'zscore',
      outlierThreshold: 3,
      convertTypes: true,
      standardize: false,
      normalize: false,
    },
    description: 'Data cleaning configuration',
  },
  
  // Technical requirements
  memoryLimitMB: 512,
  cpuLimit: 2,
  gpuRequired: false,
  
  // UI
  icon: 'Broom',
  color: '#f59e0b',
});

// ============================================================================
// Agent Implementation
// ============================================================================

/**
 * DataCleanerAgent cleans and normalizes data for analysis.
 * It handles:
 * - Missing values (drop, impute, or custom)
 * - Duplicates (identify and remove)
 * - Outliers (detect and handle)
 * - Type conversions (based on schema)
 * - Standardization and normalization
 */
export class DataCleanerAgent extends BaseAgent {
  readonly metadata: EnhancedAgentMetadata = metadata;
  
  async execute(context: EnhancedAgentContext): Promise<AgentResult> {
    const start = Date.now();
    const { dataframe, config, previousResults } = context;
    
    try {
      // Validate input
      if (!dataframe || !Array.isArray(dataframe) || dataframe.length === 0) {
        return this.createError('No data provided for cleaning', Date.now() - start);
      }
      
      // Get schema from previous results
      const schemaResult = previousResults.get('schema_inference');
      const schema = schemaResult?.output?.schema ?? {};
      
      // Get configuration
      const missingValueStrategy = config.missingValueStrategy ?? 'drop';
      const removeDuplicates = config.removeDuplicates ?? true;
      const handleOutliers = config.handleOutliers ?? false;
      const outlierMethod = config.outlierMethod ?? 'zscore';
      const outlierThreshold = config.outlierThreshold ?? 3;
      const convertTypes = config.convertTypes ?? true;
      const standardize = config.standardize ?? false;
      const normalize = config.normalize ?? false;
      const dropColumns = config.dropColumns ?? [];
      const keepColumns = config.keepColumns ?? [];
      
      // Initialize report
      const cleaningReport = {
        originalRowCount: dataframe.length,
        cleanedRowCount: 0,
        rowsRemoved: 0,
        duplicatesRemoved: 0,
        missingValuesHandled: {} as Record<string, number>,
        typeConversions: {} as Record<string, number>,
        outliersHandled: {} as Record<string, number>,
        columnsAdded: [] as string[],
        columnsRemoved: [] as string[],
      };
      
      // Create a copy to modify
      let cleanedDataframe = JSON.parse(JSON.stringify(dataframe));
      
      // Step 1: Drop specified columns
      if (dropColumns.length > 0) {
        for (const col of dropColumns) {
          if (cleanedDataframe[0] && col in cleanedDataframe[0]) {
            for (const row of cleanedDataframe) {
              delete row[col];
            }
            cleaningReport.columnsRemoved.push(col);
          }
        }
      }
      
      // Step 2: Keep only specified columns
      if (keepColumns.length > 0) {
        const columnsToRemove = Object.keys(cleanedDataframe[0] || {}).filter(
          col => !keepColumns.includes(col)
        );
        for (const col of columnsToRemove) {
          for (const row of cleanedDataframe) {
            delete row[col];
          }
          cleaningReport.columnsRemoved.push(col);
        }
      }
      
      // Step 3: Convert types based on schema
      if (convertTypes) {
        cleanedDataframe = this.convertTypes(cleanedDataframe, schema, cleaningReport.typeConversions);
      }
      
      // Step 4: Handle missing values
      cleanedDataframe = this.handleMissingValues(
        cleanedDataframe,
        schema,
        missingValueStrategy,
        config.customMissingValue,
        cleaningReport.missingValuesHandled
      );
      
      // Step 5: Remove duplicates
      if (removeDuplicates) {
        cleanedDataframe = this.removeDuplicates(
          cleanedDataframe,
          config.duplicateColumns,
          cleaningReport
        );
      }
      
      // Step 6: Handle outliers
      if (handleOutliers) {
        cleanedDataframe = this.handleOutliers(
          cleanedDataframe,
          schema,
          outlierMethod,
          outlierThreshold,
          cleaningReport.outliersHandled
        );
      }
      
      // Step 7: Standardize numeric columns
      if (standardize) {
        cleanedDataframe = this.standardizeColumns(
          cleanedDataframe,
          config.standardizeColumns,
          schema
        );
      }
      
      // Step 8: Normalize numeric columns
      if (normalize) {
        cleanedDataframe = this.normalizeColumns(
          cleanedDataframe,
          config.normalizeColumns,
          schema
        );
      }
      
      // Update report
      cleaningReport.cleanedRowCount = cleanedDataframe.length;
      cleaningReport.rowsRemoved = cleaningReport.originalRowCount - cleaningReport.cleanedRowCount;
      
      // Calculate statistics
      const statistics = this.calculateStatistics(cleanedDataframe, schema);
      
      const output = {
        cleanedDataframe,
        cleaningReport,
        statistics,
      };
      
      const executionTimeMs = Date.now() - start;
      
      return this.createResult(output, {
        rowsProcessed: cleaningReport.originalRowCount,
        rowsCleaned: cleaningReport.cleanedRowCount,
        rowsRemoved: cleaningReport.rowsRemoved,
        duplicatesRemoved: cleaningReport.duplicatesRemoved,
        missingValuesHandled: Object.values(cleaningReport.missingValuesHandled).reduce((a, b) => a + b, 0),
        typeConversions: Object.values(cleaningReport.typeConversions).reduce((a, b) => a + b, 0),
        outliersHandled: Object.values(cleaningReport.outliersHandled).reduce((a, b) => a + b, 0),
      }, executionTimeMs);
      
    } catch (error) {
      const executionTimeMs = Date.now() - start;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return this.createError(errorMessage, executionTimeMs);
    }
  }
  
  /**
   * Convert column types based on schema
   */
  private convertTypes(
    dataframe: Record<string, unknown>[],
    schema: Record<string, any>,
    typeConversions: Record<string, number>
  ): Record<string, unknown>[] {
    const result = JSON.parse(JSON.stringify(dataframe));
    
    for (const [col, colSchema] of Object.entries(schema)) {
      const type = colSchema.type;
      let conversions = 0;
      
      for (const row of result) {
        if (row[col] === null || row[col] === undefined) continue;
        
        try {
          switch (type) {
            case 'integer':
              row[col] = this.convertToInteger(row[col]);
              if (typeof row[col] === 'number' && Number.isInteger(row[col])) conversions++;
              break;
            case 'float':
              row[col] = this.convertToFloat(row[col]);
              if (typeof row[col] === 'number') conversions++;
              break;
            case 'boolean':
              row[col] = this.convertToBoolean(row[col]);
              if (typeof row[col] === 'boolean') conversions++;
              break;
            case 'datetime':
              row[col] = this.convertToDate(row[col]);
              if (row[col] instanceof Date) conversions++;
              break;
            case 'string':
              row[col] = this.convertToString(row[col]);
              if (typeof row[col] === 'string') conversions++;
              break;
          }
        } catch (error) {
          // Keep original value if conversion fails
        }
      }
      
      if (conversions > 0) {
        typeConversions[col] = conversions;
      }
    }
    
    return result;
  }
  
  /**
   * Handle missing values
   */
  private handleMissingValues(
    dataframe: Record<string, unknown>[],
    schema: Record<string, any>,
    strategy: string,
    customValue: unknown,
    missingValuesHandled: Record<string, number>
  ): Record<string, unknown>[] {
    const result = JSON.parse(JSON.stringify(dataframe));
    
    for (const [col, colSchema] of Object.entries(schema)) {
      let handled = 0;
      const type = colSchema.type;
      
      for (const row of result) {
        if (row[col] === null || row[col] === undefined || row[col] === '') {
          switch (strategy) {
            case 'drop':
              // Mark for removal (we'll remove rows with any nulls later)
              row[col] = null;
              handled++;
              break;
            case 'mean':
              if (type === 'integer' || type === 'float') {
                const values = this.extractNumericColumn(result, col);
                row[col] = mean(values);
                handled++;
              }
              break;
            case 'median':
              if (type === 'integer' || type === 'float') {
                const values = this.extractNumericColumn(result, col);
                row[col] = median(values);
                handled++;
              }
              break;
            case 'mode':
              row[col] = this.getMode(result, col);
              handled++;
              break;
            case 'zero':
              if (type === 'integer' || type === 'float') {
                row[col] = 0;
                handled++;
              }
              break;
            case 'empty':
              if (type === 'string') {
                row[col] = '';
                handled++;
              }
              break;
            case 'custom':
              row[col] = customValue;
              handled++;
              break;
          }
        }
      }
      
      if (handled > 0) {
        missingValuesHandled[col] = handled;
      }
    }
    
    // Remove rows with null values if strategy is 'drop'
    if (strategy === 'drop') {
      return result.filter(row => {
        return !Object.values(row).some(v => v === null || v === undefined);
      });
    }
    
    return result;
  }
  
  /**
   * Remove duplicate rows
   */
  private removeDuplicates(
    dataframe: Record<string, unknown>[],
    duplicateColumns: string[] | undefined,
    cleaningReport: any
  ): Record<string, unknown>[] {
    if (!duplicateColumns || duplicateColumns.length === 0) {
      // Use all columns for duplicate detection
      duplicateColumns = Object.keys(dataframe[0] || {});
    }
    
    const seen = new Set();
    const result: Record<string, unknown>[] = [];
    let duplicatesRemoved = 0;
    
    for (const row of dataframe) {
      const key = duplicateColumns.map(col => row[col]).join('|');
      
      if (seen.has(key)) {
        duplicatesRemoved++;
      } else {
        seen.add(key);
        result.push(row);
      }
    }
    
    cleaningReport.duplicatesRemoved = duplicatesRemoved;
    return result;
  }
  
  /**
   * Handle outliers
   */
  private handleOutliers(
    dataframe: Record<string, unknown>[],
    schema: Record<string, any>,
    method: string,
    threshold: number,
    outliersHandled: Record<string, number>
  ): Record<string, unknown>[] {
    const result = JSON.parse(JSON.stringify(dataframe));
    
    for (const [col, colSchema] of Object.entries(schema)) {
      if (colSchema.type !== 'integer' && colSchema.type !== 'float') continue;
      
      const values = this.extractNumericColumn(result, col);
      if (values.length === 0) continue;
      
      let handled = 0;
      
      switch (method) {
        case 'zscore':
          const avg = mean(values);
          const std = stdev(values);
          
          if (std > 0) {
            for (let i = 0; i < result.length; i++) {
              const val = Number(result[i][col]);
              if (!Number.isNaN(val) && Number.isFinite(val)) {
                const zscore = Math.abs((val - avg) / std);
                if (zscore > threshold) {
                  result[i][col] = avg; // Replace with mean
                  handled++;
                }
              }
            }
          }
          break;
          
        case 'iqr':
          const sorted = [...values].sort((a, b) => a - b);
          const q1 = sorted[Math.floor(sorted.length * 0.25)];
          const q3 = sorted[Math.floor(sorted.length * 0.75)];
          const iqr = q3 - q1;
          const lowerBound = q1 - threshold * iqr;
          const upperBound = q3 + threshold * iqr;
          
          for (let i = 0; i < result.length; i++) {
            const val = Number(result[i][col]);
            if (!Number.isNaN(val) && Number.isFinite(val)) {
              if (val < lowerBound || val > upperBound) {
                result[i][col] = median(values); // Replace with median
                handled++;
              }
            }
          }
          break;
      }
      
      if (handled > 0) {
        outliersHandled[col] = handled;
      }
    }
    
    return result;
  }
  
  /**
   * Standardize numeric columns (z-score normalization)
   */
  private standardizeColumns(
    dataframe: Record<string, unknown>[],
    columns: string[] | undefined,
    schema: Record<string, any>
  ): Record<string, unknown>[] {
    const result = JSON.parse(JSON.stringify(dataframe));
    
    const colsToStandardize = columns?.length > 0 
      ? columns.filter(col => schema[col]?.type === 'integer' || schema[col]?.type === 'float')
      : Object.entries(schema)
          .filter(([_, s]) => s.type === 'integer' || s.type === 'float')
          .map(([col]) => col);
    
    for (const col of colsToStandardize) {
      const values = this.extractNumericColumn(result, col);
      if (values.length === 0) continue;
      
      const avg = mean(values);
      const std = stdev(values);
      
      if (std > 0) {
        for (let i = 0; i < result.length; i++) {
          const val = Number(result[i][col]);
          if (!Number.isNaN(val) && Number.isFinite(val)) {
            result[i][col] = (val - avg) / std;
          }
        }
      }
    }
    
    return result;
  }
  
  /**
   * Normalize numeric columns (min-max scaling)
   */
  private normalizeColumns(
    dataframe: Record<string, unknown>[],
    columns: string[] | undefined,
    schema: Record<string, any>
  ): Record<string, unknown>[] {
    const result = JSON.parse(JSON.stringify(dataframe));
    
    const colsToNormalize = columns?.length > 0
      ? columns.filter(col => schema[col]?.type === 'integer' || schema[col]?.type === 'float')
      : Object.entries(schema)
          .filter(([_, s]) => s.type === 'integer' || s.type === 'float')
          .map(([col]) => col);
    
    for (const col of colsToNormalize) {
      const values = this.extractNumericColumn(result, col);
      if (values.length === 0) continue;
      
      const minVal = Math.min(...values);
      const maxVal = Math.max(...values);
      const range = maxVal - minVal;
      
      if (range > 0) {
        for (let i = 0; i < result.length; i++) {
          const val = Number(result[i][col]);
          if (!Number.isNaN(val) && Number.isFinite(val)) {
            result[i][col] = (val - minVal) / range;
          }
        }
      }
    }
    
    return result;
  }
  
  /**
   * Calculate statistics for cleaned data
   */
  private calculateStatistics(
    dataframe: Record<string, unknown>[],
    schema: Record<string, any>
  ): Record<string, Record<string, number>> {
    const statistics: Record<string, Record<string, number>> = {};
    
    for (const [col, colSchema] of Object.entries(schema)) {
      if (colSchema.type === 'integer' || colSchema.type === 'float') {
        const values = this.extractNumericColumn(dataframe, col);
        
        if (values.length > 0) {
          statistics[col] = {
            count: values.length,
            mean: mean(values),
            median: median(values),
            min: Math.min(...values),
            max: Math.max(...values),
            stdev: stdev(values),
            nullCount: dataframe.length - values.length,
          };
        }
      }
    }
    
    return statistics;
  }
  
  /**
   * Type conversion helpers
   */
  private convertToInteger(value: unknown): number {
    if (typeof value === 'number') return Math.floor(value);
    if (typeof value === 'string') {
      const num = Number(value);
      if (!Number.isNaN(num) && Number.isFinite(num)) return Math.floor(num);
    }
    return 0;
  }
  
  private convertToFloat(value: unknown): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const num = Number(value);
      if (!Number.isNaN(num) && Number.isFinite(num)) return num;
    }
    return 0.0;
  }
  
  private convertToBoolean(value: unknown): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      return ['true', 'yes', '1'].includes(value.toLowerCase());
    }
    if (typeof value === 'number') return value !== 0;
    return false;
  }
  
  private convertToDate(value: unknown): Date {
    if (value instanceof Date) return value;
    if (typeof value === 'string') {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) return date;
    }
    if (typeof value === 'number') {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) return date;
    }
    return new Date();
  }
  
  private convertToString(value: unknown): string {
    if (value === null || value === undefined) return '';
    return String(value);
  }
  
  /**
   * Get mode (most frequent value) for a column
   */
  private getMode(dataframe: Record<string, unknown>[], col: string): unknown {
    const values = dataframe.map(row => row[col]).filter(v => v !== null && v !== undefined);
    if (values.length === 0) return null;
    
    const frequencyMap = new Map<unknown, number>();
    let maxFrequency = 0;
    let modeValue: unknown = values[0];
    
    for (const value of values) {
      const frequency = (frequencyMap.get(value) ?? 0) + 1;
      frequencyMap.set(value, frequency);
      
      if (frequency > maxFrequency) {
        maxFrequency = frequency;
        modeValue = value;
      }
    }
    
    return modeValue;
  }
}

// ============================================================================
// Exports
// ============================================================================

export { metadata as dataCleanerAgentMetadata };
export default DataCleanerAgent;
