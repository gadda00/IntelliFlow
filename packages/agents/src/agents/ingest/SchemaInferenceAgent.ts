/**
 * Schema Inference Agent
 * ======================
 * 
 * Stage 0 - Ingest
 * 
 * Responsible for automatically detecting the data type of each column.
 * Uses statistical analysis to determine the most likely type for each column.
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

// ============================================================================
// Agent Metadata
// ============================================================================

const metadata = createAgentMetadata({
  // Identity
  id: 'schema_inference',
  name: 'Schema Inference',
  description: 'Automatically detects the data type of each column (numeric, categorical, datetime, boolean, text) based on value analysis.',
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
  dependencies: ['data_ingestion'],
  
  // Execution
  timeoutMs: 15000,
  maxRetries: 3,
  
  // Capabilities
  capabilities: ['type_detection', 'schema_inference', 'pattern_matching'],
  category: 'data',
  tags: ['schema', 'inference', 'types'],
  
  // Input/Output
  inputDescription: 'Dataframe from data ingestion',
  outputDescription: 'Schema definition with column types and statistics',
  inputSchema: {
    schema: z.object({
      dataframe: z.array(z.record(z.string(), z.unknown())),
      columns: z.array(z.string()),
    }),
    description: 'Dataframe and columns from ingestion',
  },
  outputSchema: {
    schema: z.object({
      schema: z.record(z.string(), z.object({
        type: z.string(),
        confidence: z.number().min(0).max(1),
        nullCount: z.number().int().nonnegative(),
        uniqueCount: z.number().int().nonnegative(),
        sampleValues: z.array(z.unknown()),
      })),
      summary: z.object({
        numericColumns: z.array(z.string()),
        categoricalColumns: z.array(z.string()),
        datetimeColumns: z.array(z.string()),
        booleanColumns: z.array(z.string()),
        textColumns: z.array(z.string()),
        nullColumns: z.array(z.string()),
      }),
    }),
    description: 'Schema with type information for each column',
  },
  configSchema: {
    schema: z.object({
      sampleSize: z.number().int().positive().max(10).default(5),
      confidenceThreshold: z.number().min(0).max(1).default(0.8),
    }),
    defaults: {
      sampleSize: 5,
      confidenceThreshold: 0.8,
    },
    description: 'Schema inference configuration',
  },
  
  // Technical requirements
  memoryLimitMB: 256,
  cpuLimit: 1,
  gpuRequired: false,
  
  // UI
  icon: 'Database',
  color: '#0ea5e9',
});

// ============================================================================
// Agent Implementation
// ============================================================================

/**
 * SchemaInferenceAgent detects column types using statistical analysis.
 * It examines the values in each column to determine the most likely type.
 */
export class SchemaInferenceAgent extends BaseAgent {
  readonly metadata: EnhancedAgentMetadata = metadata;
  
  async execute(context: EnhancedAgentContext): Promise<AgentResult> {
    const start = Date.now();
    const { dataframe, config } = context;
    
    // Get configuration
    const sampleSize = config.sampleSize ?? 5;
    const confidenceThreshold = config.confidenceThreshold ?? 0.8;
    
    try {
      // Validate input
      if (!dataframe || !Array.isArray(dataframe) || dataframe.length === 0) {
        return this.createError('No data provided for schema inference', Date.now() - start);
      }
      
      const columns = Object.keys(dataframe[0]);
      const schema: Record<string, {
        type: string;
        confidence: number;
        nullCount: number;
        uniqueCount: number;
        sampleValues: unknown[];
      }> = {};
      
      // Initialize summary
      const summary = {
        numericColumns: [] as string[],
        categoricalColumns: [] as string[],
        datetimeColumns: [] as string[],
        booleanColumns: [] as string[],
        textColumns: [] as string[],
        nullColumns: [] as string[],
      };
      
      // Analyze each column
      for (const col of columns) {
        const columnResult = this.analyzeColumn(dataframe, col, sampleSize, confidenceThreshold);
        schema[col] = columnResult;
        
        // Update summary
        switch (columnResult.type) {
          case 'numeric':
          case 'integer':
          case 'float':
            summary.numericColumns.push(col);
            break;
          case 'datetime':
            summary.datetimeColumns.push(col);
            break;
          case 'boolean':
            summary.booleanColumns.push(col);
            break;
          case 'categorical':
            summary.categoricalColumns.push(col);
            break;
          case 'text':
            summary.textColumns.push(col);
            break;
          case 'null':
            summary.nullColumns.push(col);
            break;
        }
      }
      
      const output = { schema, summary };
      const executionTimeMs = Date.now() - start;
      
      return this.createResult(output, {
        columnCount: columns.length,
        numericColumns: summary.numericColumns.length,
        categoricalColumns: summary.categoricalColumns.length,
        datetimeColumns: summary.datetimeColumns.length,
        booleanColumns: summary.booleanColumns.length,
      }, executionTimeMs);
      
    } catch (error) {
      const executionTimeMs = Date.now() - start;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return this.createError(errorMessage, executionTimeMs);
    }
  }
  
  /**
   * Analyze a single column to determine its type
   */
  private analyzeColumn(
    dataframe: Record<string, unknown>[],
    column: string,
    sampleSize: number,
    confidenceThreshold: number
  ): {
    type: string;
    confidence: number;
    nullCount: number;
    uniqueCount: number;
    sampleValues: unknown[];
  } {
    const values = dataframe.map(row => row[column]);
    const nonNull = values.filter(v => v !== null && v !== undefined && v !== '');
    const nullCount = values.length - nonNull.length;
    const uniqueCount = new Set(nonNull).size;
    
    // Get sample values
    const sampleValues = nonNull.slice(0, sampleSize);
    
    // Determine type
    const typeAnalysis = this.determineType(nonNull);
    
    return {
      type: typeAnalysis.type,
      confidence: typeAnalysis.confidence,
      nullCount,
      uniqueCount,
      sampleValues,
    };
  }
  
  /**
   * Determine the type of a column based on its values
   */
  private determineType(values: unknown[]): { type: string; confidence: number } {
    if (values.length === 0) {
      return { type: 'null', confidence: 1 };
    }
    
    // Check for boolean
    const booleanAnalysis = this.checkBoolean(values);
    if (booleanAnalysis.confidence >= 0.8) {
      return booleanAnalysis;
    }
    
    // Check for datetime
    const datetimeAnalysis = this.checkDatetime(values);
    if (datetimeAnalysis.confidence >= 0.8) {
      return datetimeAnalysis;
    }
    
    // Check for numeric
    const numericAnalysis = this.checkNumeric(values);
    if (numericAnalysis.confidence >= 0.8) {
      return numericAnalysis;
    }
    
    // Check for categorical (low cardinality)
    const uniqueRatio = values.length > 0 ? new Set(values).size / values.length : 0;
    if (uniqueRatio < 0.1) {
      return { type: 'categorical', confidence: 1 - uniqueRatio };
    }
    
    // Default to text
    return { type: 'text', confidence: 0.9 };
  }
  
  /**
   * Check if values are boolean
   */
  private checkBoolean(values: unknown[]): { type: string; confidence: number } {
    const booleanValues = ['true', 'false', 'yes', 'no', '1', '0', true, false];
    const booleanCount = values.filter(v => booleanValues.includes(String(v).toLowerCase())).length;
    const confidence = booleanCount / values.length;
    
    return { type: 'boolean', confidence };
  }
  
  /**
   * Check if values are datetime
   */
  private checkDatetime(values: unknown[]): { type: string; confidence: number } {
    let dateCount = 0;
    
    for (const value of values) {
      if (value instanceof Date) {
        dateCount++;
        continue;
      }
      
      if (typeof value === 'string') {
        // Try to parse as date
        const date = new Date(String(value));
        if (!Number.isNaN(date.getTime())) {
          dateCount++;
        }
      }
      
      if (typeof value === 'number') {
        // Check if it's a Unix timestamp
        const date = new Date(value);
        if (!Number.isNaN(date.getTime())) {
          dateCount++;
        }
      }
    }
    
    const confidence = dateCount / values.length;
    return { type: 'datetime', confidence };
  }
  
  /**
   * Check if values are numeric
   */
  private checkNumeric(values: unknown[]): { type: string; confidence: number } {
    let numericCount = 0;
    let integerCount = 0;
    
    for (const value of values) {
      if (typeof value === 'number') {
        numericCount++;
        if (Number.isInteger(value)) {
          integerCount++;
        }
        continue;
      }
      
      if (typeof value === 'string') {
        const num = Number(value);
        if (!Number.isNaN(num) && Number.isFinite(num)) {
          numericCount++;
          if (Number.isInteger(num)) {
            integerCount++;
          }
        }
      }
    }
    
    const confidence = numericCount / values.length;
    
    if (confidence >= 0.8) {
      // If most numeric values are integers, return integer
      const integerRatio = numericCount > 0 ? integerCount / numericCount : 0;
      if (integerRatio >= 0.8) {
        return { type: 'integer', confidence };
      }
      return { type: 'float', confidence };
    }
    
    return { type: 'numeric', confidence };
  }
}

// ============================================================================
// Exports
// ============================================================================

export { metadata as schemaInferenceAgentMetadata };
export default SchemaInferenceAgent;
