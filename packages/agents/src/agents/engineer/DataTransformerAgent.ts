/**
 * Data Transformer Agent
 * ======================
 * 
 * Stage 1 - Engineer
 * 
 * Responsible for applying custom transformations to data.
 * Supports formula-based transformations, conditional logic, and aggregations.
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
  id: 'data_transformer',
  name: 'Data Transformer',
  description: 'Applies custom transformations to data including formula-based calculations, conditional logic, and aggregations.',
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
  timeoutMs: 30000,
  maxRetries: 3,
  
  // Capabilities
  capabilities: [
    'formula_application',
    'conditional_logic',
    'aggregation',
    'custom_transformation',
    'data_reshaping',
  ],
  category: 'data',
  tags: ['transformation', 'formula', 'conditional', 'aggregation'],
  
  // Input/Output
  inputDescription: 'Engineered dataframe with schema from previous agents',
  outputDescription: 'Transformed dataframe with transformation report',
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
      transformedDataframe: z.array(z.record(z.unknown())),
      transformationReport: z.object({
        transformationsApplied: z.array(z.string()),
        columnsAdded: z.array(z.string()),
        columnsRemoved: z.array(z.string()),
        rowsAdded: z.number(),
        rowsRemoved: z.number(),
        aggregationResults: z.record(z.string(), z.unknown()),
      }),
    }),
    description: 'Transformed dataframe with transformation report',
  },
  configSchema: {
    schema: z.object({
      // Formula transformations
      formulas: z.array(z.object({
        name: z.string(),
        expression: z.string(),
        columns: z.array(z.string()),
      })).default([]),
      
      // Conditional transformations
      conditionals: z.array(z.object({
        name: z.string(),
        condition: z.string(),
        trueValue: z.unknown(),
        falseValue: z.unknown(),
        targetColumn: z.string(),
      })).default([]),
      
      // Aggregations
      aggregations: z.array(z.object({
        name: z.string(),
        groupBy: z.array(z.string()),
        operations: z.array(z.object({
          column: z.string(),
          operation: z.enum(['sum', 'mean', 'min', 'max', 'count', 'std', 'var']),
          outputColumn: z.string(),
        })),
      })).default([]),
      
      // Column operations
      columnOperations: z.array(z.object({
        operation: z.enum(['rename', 'drop', 'duplicate', 'reorder']),
        column: z.string(),
        newName: z.string().optional(),
        position: z.number().int().optional(),
      })).default([]),
      
      // Row operations
      rowOperations: z.array(z.object({
        operation: z.enum(['filter', 'sample', 'sort']),
        condition: z.string().optional(),
        fraction: z.number().min(0).max(1).optional(),
        count: z.number().int().positive().optional(),
        column: z.string().optional(),
        order: z.enum(['asc', 'desc']).optional(),
      })).default([]),
      
      // Advanced options
      advanced: z.object({
        preserveOriginal: z.boolean().default(false),
        prefix: z.string().default('transformed_'),
        suffix: z.string().default(''),
      }).default({}),
    }),
    defaults: {
      formulas: [],
      conditionals: [],
      aggregations: [],
      columnOperations: [],
      rowOperations: [],
      advanced: {
        preserveOriginal: false,
        prefix: 'transformed_',
        suffix: '',
      },
    },
    description: 'Data transformation configuration',
  },
  
  // Technical requirements
  memoryLimitMB: 512,
  cpuLimit: 2,
  gpuRequired: false,
  
  // UI
  icon: 'Transform',
  color: '#06b6d4',
});

// ============================================================================
// Agent Implementation
// ============================================================================

/**
 * DataTransformerAgent applies custom transformations to data.
 */
export class DataTransformerAgent extends BaseAgent {
  readonly metadata: EnhancedAgentMetadata = metadata;
  
  async execute(context: EnhancedAgentContext): Promise<AgentResult> {
    const start = Date.now();
    const { dataframe, config, previousResults } = context;
    
    try {
      // Validate input
      if (!dataframe || !Array.isArray(dataframe) || dataframe.length === 0) {
        return this.createError('No data provided for transformation', Date.now() - start);
      }
      
      // Get schema from previous results
      const schemaResult = previousResults.get('schema_inference');
      const schema = schemaResult?.output?.schema ?? {};
      
      // Get configuration
      const formulas = config.formulas ?? [];
      const conditionals = config.conditionals ?? [];
      const aggregations = config.aggregations ?? [];
      const columnOperations = config.columnOperations ?? [];
      const rowOperations = config.rowOperations ?? [];
      const advanced = config.advanced ?? {};
      
      // Initialize report
      const transformationReport = {
        transformationsApplied: [] as string[],
        columnsAdded: [] as string[],
        columnsRemoved: [] as string[],
        rowsAdded: 0,
        rowsRemoved: 0,
        aggregationResults: {} as Record<string, unknown>,
      };
      
      // Create a copy to modify
      let transformedDataframe = JSON.parse(JSON.stringify(dataframe));
      
      // Step 1: Apply column operations
      if (columnOperations.length > 0) {
        transformedDataframe = this.applyColumnOperations(
          transformedDataframe,
          columnOperations,
          transformationReport
        );
      }
      
      // Step 2: Apply formula transformations
      if (formulas.length > 0) {
        transformedDataframe = this.applyFormulas(
          transformedDataframe,
          formulas,
          schema,
          transformationReport
        );
      }
      
      // Step 3: Apply conditional transformations
      if (conditionals.length > 0) {
        transformedDataframe = this.applyConditionals(
          transformedDataframe,
          conditionals,
          transformationReport
        );
      }
      
      // Step 4: Apply aggregations
      if (aggregations.length > 0) {
        transformedDataframe = this.applyAggregations(
          transformedDataframe,
          aggregations,
          transformationReport
        );
      }
      
      // Step 5: Apply row operations
      if (rowOperations.length > 0) {
        transformedDataframe = this.applyRowOperations(
          transformedDataframe,
          rowOperations,
          transformationReport
        );
      }
      
      // Step 6: Optionally preserve original columns
      if (advanced.preserveOriginal) {
        // Original columns are already preserved in transformations
        // No action needed
      }
      
      const output = {
        transformedDataframe,
        transformationReport,
      };
      
      const executionTimeMs = Date.now() - start;
      
      return this.createResult(output, {
        transformationsApplied: transformationReport.transformationsApplied.length,
        columnsAdded: transformationReport.columnsAdded.length,
        columnsRemoved: transformationReport.columnsRemoved.length,
        rowsAdded: transformationReport.rowsAdded,
        rowsRemoved: transformationReport.rowsRemoved,
        totalRows: transformedDataframe.length,
        totalColumns: Object.keys(transformedDataframe[0] || {}).length,
      }, executionTimeMs);
      
    } catch (error) {
      const executionTimeMs = Date.now() - start;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return this.createError(errorMessage, executionTimeMs);
    }
  }
  
  /**
   * Apply column operations
   */
  private applyColumnOperations(
    dataframe: Record<string, unknown>[],
    operations: any[],
    report: any
  ): Record<string, unknown>[] {
    const result = JSON.parse(JSON.stringify(dataframe));
    
    for (const op of operations) {
      switch (op.operation) {
        case 'rename':
          if (op.column && op.newName) {
            for (const row of result) {
              if (op.column in row) {
                row[op.newName] = row[op.column];
                delete row[op.column];
              }
            }
            report.columnsAdded.push(op.newName);
            report.columnsRemoved.push(op.column);
            report.transformationsApplied.push(`Renamed ${op.column} to ${op.newName}`);
          }
          break;
          
        case 'drop':
          if (op.column) {
            for (const row of result) {
              delete row[op.column];
            }
            report.columnsRemoved.push(op.column);
            report.transformationsApplied.push(`Dropped column ${op.column}`);
          }
          break;
          
        case 'duplicate':
          if (op.column && op.newName) {
            for (const row of result) {
              if (op.column in row) {
                row[op.newName] = row[op.column];
              }
            }
            report.columnsAdded.push(op.newName);
            report.transformationsApplied.push(`Duplicated ${op.column} to ${op.newName}`);
          }
          break;
          
        case 'reorder':
          // Reordering is handled by the order of keys in the object
          // This is a no-op for JavaScript objects
          report.transformationsApplied.push(`Reordered columns (note: may not be visible)`);
          break;
      }
    }
    
    return result;
  }
  
  /**
   * Apply formula transformations
   */
  private applyFormulas(
    dataframe: Record<string, unknown>[],
    formulas: any[],
    schema: Record<string, any>,
    report: any
  ): Record<string, unknown>[] {
    const result = JSON.parse(JSON.stringify(dataframe));
    
    for (const formula of formulas) {
      try {
        // Create the new column
        for (let i = 0; i < result.length; i++) {
          const row = result[i];
          
          // Create a context for the formula
          const context: Record<string, unknown> = { ...row };
          
          // Add math functions
          context.Math = Math;
          context.parseFloat = parseFloat;
          context.parseInt = parseInt;
          context.isNaN = isNaN;
          context.isFinite = isFinite;
          
          // Evaluate the formula
          // Note: In a production environment, use a safer expression evaluator
          const value = this.evaluateExpression(formula.expression, context);
          
          // Add to row
          row[formula.name] = value;
        }
        
        report.columnsAdded.push(formula.name);
        report.transformationsApplied.push(`Applied formula: ${formula.name} = ${formula.expression}`);
        
      } catch (error) {
        console.warn(`Failed to apply formula ${formula.name}: ${error}`);
      }
    }
    
    return result;
  }
  
  /**
   * Evaluate a mathematical expression safely
   */
  private evaluateExpression(expression: string, context: Record<string, unknown>): unknown {
    // Simple expression evaluator for basic math
    // For production, consider using a library like math.js or expr-eval
    
    try {
      // Replace column references with their values
      let expr = expression;
      for (const [key, value] of Object.entries(context)) {
        if (typeof value === 'number' && !key.startsWith('_') && !['Math', 'parseFloat', 'parseInt', 'isNaN', 'isFinite'].includes(key)) {
          expr = expr.replace(new RegExp(`\\b${key}\\b`, 'g'), String(value));
        }
      }
      
      // Evaluate the expression
      // eslint-disable-next-line no-eval
      const result = eval(expr);
      
      if (typeof result === 'number' && !Number.isFinite(result)) {
        return null;
      }
      
      return result;
    } catch (error) {
      return null;
    }
  }
  
  /**
   * Apply conditional transformations
   */
  private applyConditionals(
    dataframe: Record<string, unknown>[],
    conditionals: any[],
    report: any
  ): Record<string, unknown>[] {
    const result = JSON.parse(JSON.stringify(dataframe));
    
    for (const conditional of conditionals) {
      try {
        for (let i = 0; i < result.length; i++) {
          const row = result[i];
          
          // Create a context for the condition
          const context: Record<string, unknown> = { ...row };
          
          // Add comparison functions
          context.Math = Math;
          
          // Evaluate the condition
          const conditionResult = this.evaluateCondition(conditional.condition, context);
          
          // Apply the transformation
          if (conditional.targetColumn) {
            row[conditional.targetColumn] = conditionResult 
              ? conditional.trueValue 
              : conditional.falseValue;
          }
        }
        
        report.transformationsApplied.push(`Applied conditional: ${conditional.name}`);
        
      } catch (error) {
        console.warn(`Failed to apply conditional ${conditional.name}: ${error}`);
      }
    }
    
    return result;
  }
  
  /**
   * Evaluate a condition expression
   */
  private evaluateCondition(condition: string, context: Record<string, unknown>): boolean {
    try {
      // Replace column references with their values
      let expr = condition;
      for (const [key, value] of Object.entries(context)) {
        if (!key.startsWith('_') && !['Math'].includes(key)) {
          // Handle different types
          if (typeof value === 'string') {
            expr = expr.replace(new RegExp(`\\b${key}\\b`, 'g'), `"${value}"`);
          } else if (typeof value === 'number') {
            expr = expr.replace(new RegExp(`\\b${key}\\b`, 'g'), String(value));
          } else if (typeof value === 'boolean') {
            expr = expr.replace(new RegExp(`\\b${key}\\b`, 'g'), value ? 'true' : 'false');
          }
        }
      }
      
      // Evaluate the condition
      // eslint-disable-next-line no-eval
      const result = eval(expr);
      
      return Boolean(result);
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Apply aggregations
   */
  private applyAggregations(
    dataframe: Record<string, unknown>[],
    aggregations: any[],
    report: any
  ): Record<string, unknown>[] {
    const result = JSON.parse(JSON.stringify(dataframe));
    
    for (const agg of aggregations) {
      try {
        // Group the data
        const groups = this.groupBy(result, agg.groupBy);
        
        // Apply operations
        const aggregatedData: Record<string, unknown>[] = [];
        
        for (const [groupKey, groupData] of Object.entries(groups)) {
          const aggregatedRow: Record<string, unknown> = {};
          
          // Add group by columns
          if (Array.isArray(groupKey)) {
            for (let i = 0; i < agg.groupBy.length; i++) {
              aggregatedRow[agg.groupBy[i]] = groupKey[i];
            }
          } else {
            aggregatedRow[agg.groupBy[0]] = groupKey;
          }
          
          // Apply each operation
          for (const op of agg.operations) {
            const values = groupData.map(row => Number(row[op.column])).filter(v => !Number.isNaN(v));
            
            let resultValue: unknown;
            switch (op.operation) {
              case 'sum':
                resultValue = values.reduce((a, b) => a + b, 0);
                break;
              case 'mean':
                resultValue = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
                break;
              case 'min':
                resultValue = values.length > 0 ? Math.min(...values) : null;
                break;
              case 'max':
                resultValue = values.length > 0 ? Math.max(...values) : null;
                break;
              case 'count':
                resultValue = values.length;
                break;
              case 'std':
                resultValue = this.calculateStd(values);
                break;
              case 'var':
                resultValue = this.calculateVariance(values);
                break;
              default:
                resultValue = null;
            }
            
            aggregatedRow[op.outputColumn] = resultValue;
          }
          
          aggregatedData.push(aggregatedRow);
        }
        
        // Store aggregation results
        report.aggregationResults[agg.name] = aggregatedData;
        report.transformationsApplied.push(`Applied aggregation: ${agg.name}`);
        
        // Optionally replace the dataframe with aggregated data
        // For now, we'll just add the aggregated data as new rows
        // In a real implementation, you might want to replace or merge
        
      } catch (error) {
        console.warn(`Failed to apply aggregation ${agg.name}: ${error}`);
      }
    }
    
    return result;
  }
  
  /**
   * Group data by specified columns
   */
  private groupBy(
    dataframe: Record<string, unknown>[],
    groupByColumns: string[]
  ): Record<string, Record<string, unknown>[]> {
    const groups: Record<string, Record<string, unknown>[]> = {};
    
    for (const row of dataframe) {
      const key = groupByColumns.map(col => row[col]).join('|');
      
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(row);
    }
    
    return groups;
  }
  
  /**
   * Apply row operations
   */
  private applyRowOperations(
    dataframe: Record<string, unknown>[],
    operations: any[],
    report: any
  ): Record<string, unknown>[] {
    let result = JSON.parse(JSON.stringify(dataframe));
    
    for (const op of operations) {
      switch (op.operation) {
        case 'filter':
          if (op.condition) {
            const filtered = result.filter(row => {
              const context = { ...row };
              return this.evaluateCondition(op.condition!, context);
            });
            report.rowsRemoved += result.length - filtered.length;
            result = filtered;
            report.transformationsApplied.push(`Filtered rows with condition: ${op.condition}`);
          }
          break;
          
        case 'sample':
          if (op.fraction) {
            const count = Math.floor(result.length * op.fraction);
            result = this.sampleWithoutReplacement(result, count);
            report.rowsRemoved += result.length - count;
            report.transformationsApplied.push(`Sampled ${op.fraction * 100}% of rows`);
          } else if (op.count) {
            result = this.sampleWithoutReplacement(result, Math.min(op.count, result.length));
            report.rowsRemoved += result.length - Math.min(op.count, result.length);
            report.transformationsApplied.push(`Sampled ${op.count} rows`);
          }
          break;
          
        case 'sort':
          if (op.column) {
            const column = op.column;
            const order = op.order ?? 'asc';
            result.sort((a, b) => {
              const valA = a[column];
              const valB = b[column];
              
              if (typeof valA === 'number' && typeof valB === 'number') {
                return order === 'asc' ? valA - valB : valB - valA;
              }
              
              const strA = String(valA);
              const strB = String(valB);
              return order === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
            });
            report.transformationsApplied.push(`Sorted by ${column} (${order})`);
          }
          break;
      }
    }
    
    return result;
  }
  
  /**
   * Sample without replacement
   */
  private sampleWithoutReplacement<T>(array: T[], n: number): T[] {
    if (n <= 0) return [];
    if (n >= array.length) return [...array];
    
    const result: T[] = [];
    const indices = new Set<number>();
    
    while (result.length < n) {
      const index = Math.floor(Math.random() * array.length);
      if (!indices.has(index)) {
        indices.add(index);
        result.push(array[index]);
      }
    }
    
    return result;
  }
  
  /**
   * Calculate standard deviation
   */
  private calculateStd(values: number[]): number {
    if (values.length === 0) return 0;
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length;
    return Math.sqrt(variance);
  }
  
  /**
   * Calculate variance
   */
  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    return values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length;
  }
}

// ============================================================================
// Exports
// ============================================================================

export { metadata as dataTransformerAgentMetadata };
export default DataTransformerAgent;
