/**
 * Anomaly Sentinel Agent
 * ======================
 * 
 * Stage 2 - Detect
 * 
 * Responsible for detecting anomalies in the dataset using multiple methods.
 * Implements Z-score, IQR, and EWMA ensemble detection with configurable thresholds.
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
import { mean, median, stdev, min, max, range, quantile, iqr } from '../../math';

// ============================================================================
// Agent Metadata
// ============================================================================

const metadata = createAgentMetadata({
  // Identity
  id: 'anomaly_sentinel',
  name: 'Anomaly Sentinel',
  description: 'Detects anomalies in the dataset using a 3-algorithm ensemble (Z-score, IQR, EWMA) with configurable thresholds and sensitivity.',
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
  timeoutMs: 30000,
  maxRetries: 3,
  
  // Capabilities
  capabilities: [
    'anomaly_detection',
    'outlier_detection',
    'zscore_analysis',
    'iqr_analysis',
    'ewma_analysis',
    'ensemble_methods',
  ],
  category: 'analysis',
  tags: ['anomaly', 'outlier', 'detection', 'zscore', 'iqr', 'ewma'],
  
  // Input/Output
  inputDescription: 'Cleaned and engineered dataframe with schema',
  outputDescription: 'Anomaly detection results with scores and explanations',
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
      engineeringReport: z.object({}).optional(),
    }),
    description: 'Cleaned and engineered dataframe with schema and reports',
  },
  outputSchema: {
    schema: z.object({
      anomalies: z.array(z.object({
        rowIndex: z.number(),
        column: z.string(),
        value: z.unknown(),
        methods: z.record(z.string(), z.object({
          score: z.number(),
          threshold: z.number(),
          isAnomaly: z.boolean(),
          explanation: z.string(),
        })),
        ensembleScore: z.number(),
        isAnomaly: z.boolean(),
        confidence: z.number(),
        severity: z.enum(['low', 'medium', 'high', 'critical']),
      })),
      summary: z.object({
        totalAnomalies: z.number(),
        anomaliesByColumn: z.record(z.string(), z.number()),
        anomaliesByMethod: z.record(z.string(), z.number()),
        anomaliesBySeverity: z.record(z.string(), z.number()),
        anomalyRate: z.number(),
        mostAnomalousColumns: z.array(z.string()),
        mostAnomalousRows: z.array(z.number()),
      }),
      thresholds: z.object({
        zscore: z.number(),
        iqr: z.number(),
        ewma: z.number(),
        ensemble: z.number(),
      }),
      statistics: z.object({
        mean: z.number(),
        median: z.number(),
        stdev: z.number(),
        min: z.number(),
        max: z.number(),
        q1: z.number(),
        q3: z.number(),
        iqr: z.number(),
      }),
    }),
    description: 'Anomaly detection results with detailed information',
  },
  configSchema: {
    schema: z.object({
      // Detection methods
      methods: z.object({
        zscore: z.object({
          enabled: z.boolean().default(true),
          threshold: z.number().min(0).max(10).default(3),
          twoTailed: z.boolean().default(true),
        }).optional().default(undefined as any),
        iqr: z.object({
          enabled: z.boolean().default(true),
          multiplier: z.number().min(0).max(10).default(1.5),
        }).optional().default(undefined as any),
        ewma: z.object({
          enabled: z.boolean().default(true),
          lambda: z.number().min(0).max(1).default(0.3),
          threshold: z.number().min(0).max(10).default(3),
          windowSize: z.number().int().positive().max(100).default(10),
        }).optional().default(undefined as any),
      }).optional().default(undefined as any),
      
      // Ensemble settings
      ensemble: z.object({
        method: z.enum(['any', 'majority', 'weighted']).default('majority'),
        weights: z.record(z.string(), z.number()).default({
          zscore: 1,
          iqr: 1,
          ewma: 1,
        }),
        threshold: z.number().min(0).max(1).default(0.67),
      }).optional().default(undefined as any),
      
      // Sensitivity
      sensitivity: z.enum(['low', 'medium', 'high']).default('medium'),
      
      // Column selection
      columns: z.array(z.string()).optional(),
      excludeColumns: z.array(z.string()).optional(),
      
      // Output
      includeExplanations: z.boolean().default(true),
      includeStatistics: z.boolean().default(true),
      maxAnomalies: z.number().int().positive().max(1000).default(100),
    }),
    defaults: {
      methods: {
        zscore: {
          enabled: true,
          threshold: 3,
          twoTailed: true,
        },
        iqr: {
          enabled: true,
          multiplier: 1.5,
        },
        ewma: {
          enabled: true,
          lambda: 0.3,
          threshold: 3,
          windowSize: 10,
        },
      },
      ensemble: {
        method: 'majority',
        weights: {
          zscore: 1,
          iqr: 1,
          ewma: 1,
        },
        threshold: 0.67,
      },
      sensitivity: 'medium',
      includeExplanations: true,
      includeStatistics: true,
      maxAnomalies: 100,
    },
    description: 'Anomaly detection configuration',
  },
  
  // Technical requirements
  memoryLimitMB: 512,
  cpuLimit: 2,
  gpuRequired: false,
  
  // UI
  icon: 'AlertTriangle',
  color: '#ef4444',
});

// ============================================================================
// Agent Implementation
// ============================================================================

/**
 * AnomalySentinelAgent detects anomalies using multiple methods.
 */
export class AnomalySentinelAgent extends BaseAgent {
  readonly metadata: EnhancedAgentMetadata = metadata;
  
  async execute(context: EnhancedAgentContext): Promise<AgentResult> {
    const start = Date.now();
    const { dataframe, config, previousResults } = context;
    
    try {
      // Validate input
      if (!dataframe || !Array.isArray(dataframe) || dataframe.length === 0) {
        return this.createError('No data provided for anomaly detection', Date.now() - start);
      }
      
      // Get schema from previous results
      const schemaResult = previousResults.get('schema_inference');
      const schema = (schemaResult?.output as any)?.schema ?? {};
      
      // Get configuration
      const methodsConfig = config.methods ?? {};
      const ensembleConfig = config.ensemble ?? {};
      const sensitivity = config.sensitivity ?? 'medium';
      const columns = config.columns;
      const excludeColumns = config.excludeColumns ?? [];
      const includeExplanations = config.includeExplanations ?? true;
      const includeStatistics = config.includeStatistics ?? true;
      const maxAnomalies = config.maxAnomalies ?? 100;
      
      // Adjust thresholds based on sensitivity
      const sensitivityMultipliers = this.getSensitivityMultipliers(sensitivity);
      
      // Get numeric columns to analyze
      const numericColumns = Object.entries(schema as Record<string, any>)
        .filter(([col, colSchema]: [string, any]) => 
          (colSchema.type === 'integer' || colSchema.type === 'float') &&
          !excludeColumns.includes(col) &&
          (columns?.length === 0 || columns.includes(col)))
        .map(([col]) => col);
      
      if (numericColumns.length === 0) {
        return this.createError('No numeric columns found for anomaly detection', Date.now() - start);
      }
      
      // Initialize results
      const anomalies: any[] = [];
      const anomaliesByColumn: Record<string, number> = {};
      const anomaliesByMethod: Record<string, number> = {};
      const anomaliesBySeverity: Record<string, number> = {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0,
      };
      
      // Process each numeric column
      for (const col of numericColumns) {
        const columnAnomalies = this.detectColumnAnomalies(
          dataframe,
          col,
          methodsConfig,
          ensembleConfig,
          sensitivityMultipliers,
          includeExplanations
        );
        
        anomalies.push(...columnAnomalies);
        
        // Update counts
        const columnCount = columnAnomalies.filter(a => a.isAnomaly).length;
        if (columnCount > 0) {
          anomaliesByColumn[col] = columnCount;
        }
      }
      
      // Sort anomalies by ensemble score
      anomalies.sort((a, b) => b.ensembleScore - a.ensembleScore);
      
      // Limit to maxAnomalies
      const limitedAnomalies = anomalies.slice(0, maxAnomalies);
      
      // Update counts based on limited anomalies
      for (const anomaly of limitedAnomalies) {
        if (anomaly.isAnomaly) {
          for (const [method, result] of Object.entries(anomaly.methods as Record<string, any>)) {
            if (result.isAnomaly) {
              anomaliesByMethod[method] = (anomaliesByMethod[method] ?? 0) + 1;
            }
          }
          anomaliesBySeverity[anomaly.severity]++;
        }
      }
      
      // Calculate statistics
      const statistics = includeStatistics 
        ? this.calculateStatistics(dataframe, numericColumns)
        : {};
      
      // Get thresholds
      const thresholds = {
        zscore: methodsConfig.zscore?.threshold ?? 3,
        iqr: methodsConfig.iqr?.multiplier ?? 1.5,
        ewma: methodsConfig.ewma?.threshold ?? 3,
        ensemble: ensembleConfig.threshold ?? 0.67,
      };
      
      // Get most anomalous columns and rows
      const mostAnomalousColumns = Object.entries(anomaliesByColumn)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([col]) => col);
      
      const mostAnomalousRows = limitedAnomalies
        .filter(a => a.isAnomaly)
        .map(a => a.rowIndex)
        .reduce((acc: Record<number, number>, rowIndex) => {
          acc[rowIndex] = (acc[rowIndex] ?? 0) + 1;
          return acc;
        }, {})
        .entries()
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([rowIndex]) => Number(rowIndex));
      
      const summary = {
        totalAnomalies: limitedAnomalies.filter(a => a.isAnomaly).length,
        anomaliesByColumn,
        anomaliesByMethod,
        anomaliesBySeverity,
        anomalyRate: limitedAnomalies.filter(a => a.isAnomaly).length / (dataframe.length * numericColumns.length),
        mostAnomalousColumns,
        mostAnomalousRows,
      };
      
      const output = {
        anomalies: limitedAnomalies,
        summary,
        thresholds,
        statistics,
      };
      
      const executionTimeMs = Date.now() - start;
      
      return this.createResult(output, {
        totalAnomalies: summary.totalAnomalies,
        anomalyRate: summary.anomalyRate,
        columnsAnalyzed: numericColumns.length,
        methodsUsed: Object.keys(methodsConfig).filter(m => methodsConfig[m as keyof typeof methodsConfig]?.enabled).length,
      }, executionTimeMs);
      
    } catch (error) {
      const executionTimeMs = Date.now() - start;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return this.createError(errorMessage, executionTimeMs);
    }
  }
  
  /**
   * Detect anomalies in a single column
   */
  private detectColumnAnomalies(
    dataframe: Record<string, unknown>[],
    column: string,
    methodsConfig: any,
    ensembleConfig: any,
    sensitivityMultipliers: Record<string, number>,
    includeExplanations: boolean
  ): any[] {
    const anomalies: any[] = [];
    const values = this.extractNumericColumn(dataframe, column);
    
    if (values.length === 0) return anomalies;
    
    // Calculate statistics
    const meanVal = mean(values);
    const medianVal = median(values);
    const stdVal = stdev(values);
    const minVal = min(values);
    const maxVal = max(values);
    const q1 = quantile(values, 0.25);
    const q3 = quantile(values, 0.75);
    const iqrVal = iqr(values);
    
    // Calculate EWMA
    const ewmaValues = this.calculateEWMA(values, methodsConfig.ewma?.lambda ?? 0.3);
    const ewmaStd = stdev(ewmaValues);
    
    // Process each row
    for (let i = 0; i < dataframe.length; i++) {
      const value = Number(dataframe[i][column]);
      
      if (Number.isNaN(value) || !Number.isFinite(value)) {
        continue;
      }
      
      const rowAnomaly: any = {
        rowIndex: i,
        column,
        value,
        methods: {},
        ensembleScore: 0,
        isAnomaly: false,
        confidence: 0,
        severity: 'low',
      };
      
      // Z-score method
      if (methodsConfig.zscore?.enabled && stdVal > 0) {
        const zscore = Math.abs((value - meanVal) / stdVal);
        const threshold = (methodsConfig.zscore.threshold ?? 3) * sensitivityMultipliers.zscore;
        const isAnomaly = methodsConfig.zscore.twoTailed 
          ? zscore > threshold 
          : (value - meanVal) / stdVal > threshold;
        
        rowAnomaly.methods.zscore = {
          score: zscore,
          threshold,
          isAnomaly,
          explanation: includeExplanations 
            ? `Z-score of ${zscore.toFixed(2)} exceeds threshold of ${threshold.toFixed(2)}`
            : '',
        };
        
        if (isAnomaly) {
          rowAnomaly.ensembleScore += ensembleConfig.weights?.zscore ?? 1;
        }
      }
      
      // IQR method
      if (methodsConfig.iqr?.enabled && iqrVal > 0) {
        const multiplier = (methodsConfig.iqr.multiplier ?? 1.5) * sensitivityMultipliers.iqr;
        const lowerBound = q1 - multiplier * iqrVal;
        const upperBound = q3 + multiplier * iqrVal;
        const isAnomaly = value < lowerBound || value > upperBound;
        
        rowAnomaly.methods.iqr = {
          score: Math.max(
            Math.abs(value - lowerBound),
            Math.abs(value - upperBound)
          ) / iqrVal,
          threshold: multiplier,
          isAnomaly,
          explanation: includeExplanations 
            ? `Value ${value.toFixed(2)} is outside IQR bounds [${lowerBound.toFixed(2)}, ${upperBound.toFixed(2)}]`
            : '',
        };
        
        if (isAnomaly) {
          rowAnomaly.ensembleScore += ensembleConfig.weights?.iqr ?? 1;
        }
      }
      
      // EWMA method
      if (methodsConfig.ewma?.enabled && ewmaStd > 0) {
        const ewmaValue = ewmaValues[i];
        const ewmaDiff = Math.abs(value - ewmaValue);
        const threshold = (methodsConfig.ewma.threshold ?? 3) * sensitivityMultipliers.ewma * ewmaStd;
        const isAnomaly = ewmaDiff > threshold;
        
        rowAnomaly.methods.ewma = {
          score: ewmaDiff / ewmaStd,
          threshold: threshold / ewmaStd,
          isAnomaly,
          explanation: includeExplanations 
            ? `EWMA deviation of ${ewmaDiff.toFixed(2)} exceeds threshold of ${threshold.toFixed(2)}`
            : '',
        };
        
        if (isAnomaly) {
          rowAnomaly.ensembleScore += ensembleConfig.weights?.ewma ?? 1;
        }
      }
      
      // Calculate ensemble result
      const methodCount = Object.keys(rowAnomaly.methods).length;
      if (methodCount > 0) {
        rowAnomaly.ensembleScore /= methodCount;
        
        // Determine if anomaly based on ensemble method
        switch (ensembleConfig.method) {
          case 'any':
            rowAnomaly.isAnomaly = Object.values(rowAnomaly.methods).some((m: any) => m.isAnomaly);
            break;
          case 'majority':
            const trueCount = Object.values(rowAnomaly.methods).filter((m: any) => m.isAnomaly).length;
            rowAnomaly.isAnomaly = trueCount > methodCount / 2;
            break;
          case 'weighted':
            rowAnomaly.isAnomaly = rowAnomaly.ensembleScore >= (ensembleConfig.threshold ?? 0.67);
            break;
        }
        
        // Calculate confidence
        if (rowAnomaly.isAnomaly) {
          rowAnomaly.confidence = rowAnomaly.ensembleScore;
          
          // Determine severity
          if (rowAnomaly.ensembleScore >= 0.9) {
            rowAnomaly.severity = 'critical';
          } else if (rowAnomaly.ensembleScore >= 0.7) {
            rowAnomaly.severity = 'high';
          } else if (rowAnomaly.ensembleScore >= 0.5) {
            rowAnomaly.severity = 'medium';
          } else {
            rowAnomaly.severity = 'low';
          }
        }
      }
      
      anomalies.push(rowAnomaly);
    }
    
    return anomalies;
  }
  
  /**
   * Calculate EWMA (Exponentially Weighted Moving Average)
   */
  private calculateEWMA(values: number[], lambda: number): number[] {
    const ewma: number[] = [values[0]];
    
    for (let i = 1; i < values.length; i++) {
      ewma.push(lambda * values[i] + (1 - lambda) * ewma[i - 1]);
    }
    
    return ewma;
  }
  
  /**
   * Get sensitivity multipliers
   */
  private getSensitivityMultipliers(sensitivity: string): Record<string, number> {
    switch (sensitivity) {
      case 'low':
        return { zscore: 0.8, iqr: 0.8, ewma: 0.8 };
      case 'medium':
        return { zscore: 1.0, iqr: 1.0, ewma: 1.0 };
      case 'high':
        return { zscore: 1.2, iqr: 1.2, ewma: 1.2 };
      default:
        return { zscore: 1.0, iqr: 1.0, ewma: 1.0 };
    }
  }
  
  /**
   * Calculate statistics for all numeric columns
   */
  private calculateStatistics(
    dataframe: Record<string, unknown>[],
    columns: string[]
  ): any {
    const stats: any = {};
    
    for (const col of columns) {
      const values = this.extractNumericColumn(dataframe, col);
      
      if (values.length > 0) {
        stats[col] = {
          mean: mean(values),
          median: median(values),
          stdev: stdev(values),
          min: min(values),
          max: max(values),
          q1: quantile(values, 0.25),
          q3: quantile(values, 0.75),
          iqr: iqr(values),
        };
      }
    }
    
    // Calculate overall statistics
    const allValues = columns.flatMap(col => this.extractNumericColumn(dataframe, col));
    
    if (allValues.length > 0) {
      return {
        mean: mean(allValues),
        median: median(allValues),
        stdev: stdev(allValues),
        min: min(allValues),
        max: max(allValues),
        q1: quantile(allValues, 0.25),
        q3: quantile(allValues, 0.75),
        iqr: iqr(allValues),
        byColumn: stats,
      };
    }
    
    return stats;
  }
}

// ============================================================================
// Exports
// ============================================================================

export { metadata as anomalySentinelAgentMetadata };
export default AnomalySentinelAgent;
