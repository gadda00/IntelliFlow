/**
 * Data Ingestion Agent
 * ====================
 * 
 * Stage 0 - Ingest
 * 
 * Responsible for parsing and validating incoming data.
 * This is the first agent in the pipeline and ensures data is properly formatted.
 */

import { z } from 'zod';
import {
  AgentStage,
  AgentTier,
  AgentStability,
  ID,
  ISODateString,
} from '@busara/core';
import {
  BaseAgent,
  EnhancedAgentMetadata,
  EnhancedAgentContext,
  AgentResult,
  createAgentMetadata,
} from '../../core';
import { mean, median, stdev, min, max, range } from '../../math';

// ============================================================================
// Agent Metadata
// ============================================================================

const metadata = createAgentMetadata({
  // Identity
  id: 'data_ingestion',
  name: 'Data Ingestion',
  description: 'Validates the uploaded dataset, checks for structural integrity, and prepares it for downstream analysis.',
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
  dependencies: [],
  
  // Execution
  timeoutMs: 15000,
  maxRetries: 3,
  
  // Capabilities
  capabilities: ['data_validation', 'structure_check', 'format_detection'],
  category: 'data',
  tags: ['ingestion', 'validation', 'parsing'],
  
  // Input/Output
  inputDescription: 'Raw data in various formats (CSV, JSON, Excel)',
  outputDescription: 'Validated and parsed data with metadata',
  inputSchema: {
    schema: z.union([
      z.array(z.record(z.unknown())),
      z.string(),
      z.object({}),
    ]),
    description: 'Raw data to be ingested',
  },
  outputSchema: {
    schema: z.object({
      rowCount: z.number().int().nonnegative(),
      columnCount: z.number().int().nonnegative(),
      columns: z.array(z.string()),
      memorySize: z.number().int().nonnegative(),
      isEmpty: z.boolean(),
      hasHeaders: z.boolean(),
      sampleRows: z.array(z.record(z.unknown())),
      dataTypes: z.record(z.string(), z.string()).optional(),
      statistics: z.record(z.string(), z.record(z.string(), z.number())).optional(),
    }),
    description: 'Ingestion result with data metadata',
  },
  configSchema: {
    schema: z.object({
      sampleSize: z.number().int().positive().max(100).default(5),
      inferTypes: z.boolean().default(true),
      validateRows: z.boolean().default(true),
    }),
    defaults: {
      sampleSize: 5,
      inferTypes: true,
      validateRows: true,
    },
    description: 'Data ingestion configuration',
  },
  
  // Technical requirements
  memoryLimitMB: 256,
  cpuLimit: 1,
  gpuRequired: false,
  
  // UI
  icon: 'FileInput',
  color: '#10b981',
});

// ============================================================================
// Agent Implementation
// ============================================================================

/**
 * DataIngestionAgent validates and parses incoming data.
 * It performs the following checks:
 * - Data is not empty
 * - Data has consistent structure
 * - Data types are inferred (if enabled)
 * - Sample rows are extracted
 */
export class DataIngestionAgent extends BaseAgent {
  readonly metadata: EnhancedAgentMetadata = metadata;
  
  async execute(context: EnhancedAgentContext): Promise<AgentResult> {
    const start = Date.now();
    const { dataframe, config } = context;
    
    // Get configuration
    const sampleSize = config.sampleSize ?? 5;
    const inferTypes = config.inferTypes ?? true;
    const validateRows = config.validateRows ?? true;
    
    try {
      // Validate input
      if (!dataframe || !Array.isArray(dataframe)) {
        return this.createError('No data provided or data is not an array', Date.now() - start);
      }
      
      if (dataframe.length === 0) {
        return this.createError('Data is empty', Date.now() - start);
      }
      
      // Check for consistent structure
      const columnSets = dataframe.map(row => new Set(Object.keys(row ?? {})));
      const firstColumns = columnSets[0];
      
      for (const columns of columnSets) {
        if (columns.size !== firstColumns.size || 
            !Array.from(firstColumns).every(col => columns.has(col))) {
          return this.createError(
            'Inconsistent data structure: rows have different columns',
            Date.now() - start
          );
        }
      }
      
      const columns = Array.from(firstColumns);
      const rowCount = dataframe.length;
      const columnCount = columns.length;
      
      // Calculate memory size
      const memorySize = JSON.stringify(dataframe).length;
      
      // Extract sample rows
      const sampleRows = dataframe.slice(0, Math.min(sampleSize, rowCount));
      
      // Infer data types if enabled
      let dataTypes: Record<string, string> | undefined;
      if (inferTypes) {
        dataTypes = this.inferDataTypes(dataframe, columns);
      }
      
      // Calculate basic statistics if validation is enabled
      let statistics: Record<string, Record<string, number>> | undefined;
      if (validateRows) {
        statistics = this.calculateStatistics(dataframe, columns);
      }
      
      const output = {
        rowCount,
        columnCount,
        columns,
        memorySize,
        isEmpty: rowCount === 0,
        hasHeaders: columnCount > 0,
        sampleRows,
        dataTypes,
        statistics,
      };
      
      const executionTimeMs = Date.now() - start;
      
      return this.createResult(output, {
        rowCount,
        columnCount,
        memorySize,
      }, executionTimeMs);
      
    } catch (error) {
      const executionTimeMs = Date.now() - start;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return this.createError(errorMessage, executionTimeMs);
    }
  }
  
  /**
   * Infer data types for each column
   */
  private inferDataTypes(
    dataframe: Record<string, unknown>[],
    columns: string[]
  ): Record<string, string> {
    const dataTypes: Record<string, string> = {};
    
    for (const col of columns) {
      const values = dataframe.map(row => row[col]);
      dataTypes[col] = this.inferType(values);
    }
    
    return dataTypes;
  }
  
  /**
   * Infer the data type of a column
   */
  private inferType(values: unknown[]): string {
    const nonNull = values.filter(v => v !== null && v !== undefined && v !== '');
    
    if (nonNull.length === 0) {
      return 'null';
    }
    
    // Check for numeric
    const numericCount = nonNull.filter(v => {
      if (typeof v === 'number') return true;
      if (typeof v === 'string') {
        const num = Number(v);
        return !Number.isNaN(num) && Number.isFinite(num);
      }
      return false;
    }).length;
    
    if (numericCount / nonNull.length > 0.8) {
      // Check if all numeric values are integers
      const allIntegers = nonNull.every(v => {
        if (typeof v === 'number') return Number.isInteger(v);
        if (typeof v === 'string') {
          const num = Number(v);
          return !Number.isNaN(num) && Number.isInteger(num);
        }
        return false;
      });
      return allIntegers ? 'integer' : 'float';
    }
    
    // Check for boolean
    const booleanCount = nonNull.filter(v => {
      if (typeof v === 'boolean') return true;
      if (typeof v === 'string') {
        return ['true', 'false', 'yes', 'no', '1', '0'].includes(v.toLowerCase());
      }
      return false;
    }).length;
    
    if (booleanCount / nonNull.length > 0.8) {
      return 'boolean';
    }
    
    // Check for datetime
    const dateCount = nonNull.filter(v => {
      if (v instanceof Date) return true;
      if (typeof v === 'string') {
        const date = new Date(v);
        return !Number.isNaN(date.getTime());
      }
      return false;
    }).length;
    
    if (dateCount / nonNull.length > 0.8) {
      return 'datetime';
    }
    
    // Default to string
    return 'string';
  }
  
  /**
   * Calculate basic statistics for numeric columns
   */
  private calculateStatistics(
    dataframe: Record<string, unknown>[],
    columns: string[]
  ): Record<string, Record<string, number>> {
    const statistics: Record<string, Record<string, number>> = {};
    
    for (const col of columns) {
      const numericValues = this.extractNumericColumn(dataframe, col);
      
      if (numericValues.length > 0) {
        statistics[col] = {
          mean: mean(numericValues),
          median: median(numericValues),
          min: min(numericValues),
          max: max(numericValues),
          range: range(numericValues),
          stdev: stdev(numericValues),
        };
      }
    }
    
    return statistics;
  }
}

// ============================================================================
// Exports
// ============================================================================

export { metadata as dataIngestionAgentMetadata };
export default DataIngestionAgent;
