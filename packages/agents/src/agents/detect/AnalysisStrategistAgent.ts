/**
 * Analysis Strategist Agent
 * ==========================
 * 
 * Stage 2 - Detect
 * 
 * Responsible for analyzing data characteristics and recommending optimal analysis methods.
 * Generates hypotheses and creates a strategic analysis plan.
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
import { mean, median, stdev, min, max, range, correlation, skewness, kurtosis } from '../../math';

// ============================================================================
// Agent Metadata
// ============================================================================

const metadata = createAgentMetadata({
  // Identity
  id: 'analysis_strategist',
  name: 'Analysis Strategist',
  description: 'Analyzes data characteristics and recommends optimal analysis methods, generates hypotheses, and creates a strategic analysis plan.',
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
  timeoutMs: 20000,
  maxRetries: 3,
  
  // Capabilities
  capabilities: [
    'data_analysis',
    'method_recommendation',
    'hypothesis_generation',
    'strategy_planning',
    'feature_analysis',
  ],
  category: 'analysis',
  tags: ['strategy', 'recommendation', 'hypothesis', 'planning'],
  
  // Input/Output
  inputDescription: 'Cleaned and engineered dataframe with schema',
  outputDescription: 'Strategic analysis plan with recommendations and hypotheses',
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
      analysisPlan: z.object({
        dataOverview: z.object({
          rowCount: z.number(),
          columnCount: z.number(),
          memorySize: z.number(),
          dataTypes: z.record(z.string(), z.number()),
          completeness: z.number(),
        }),
        featureAnalysis: z.array(z.object({
          column: z.string(),
          type: z.string(),
          importance: z.number(),
          recommendations: z.array(z.string()),
        })),
        recommendedMethods: z.array(z.object({
          method: z.string(),
          category: z.string(),
          priority: z.number(),
          reason: z.string(),
          expectedImpact: z.string(),
        })),
        hypotheses: z.array(z.object({
          id: z.string(),
          statement: z.string(),
          type: z.string(),
          confidence: z.number(),
          testMethod: z.string(),
          variables: z.array(z.string()),
        })),
        executionPlan: z.array(z.object({
          stage: z.number(),
          agents: z.array(z.string()),
          priority: z.number(),
          estimatedTime: z.number(),
        })),
      }),
      dataQualityScore: z.number(),
      analysisComplexity: z.enum(['low', 'medium', 'high']),
    }),
    description: 'Strategic analysis plan with recommendations and hypotheses',
  },
  configSchema: {
    schema: z.object({
      // Analysis focus
      focusAreas: z.array(z.enum([
        'descriptive',
        'diagnostic',
        'predictive',
        'prescriptive',
        'exploratory',
        'confirmatory',
      ])).default(['exploratory', 'descriptive']),
      
      // Hypothesis generation
      generateHypotheses: z.boolean().default(true),
      hypothesisCount: z.number().int().positive().max(20).default(5),
      hypothesisConfidenceThreshold: z.number().min(0).max(1).default(0.7),
      
      // Method recommendations
      recommendMethods: z.boolean().default(true),
      methodCategories: z.array(z.string()).default(['statistical', 'machine_learning', 'visualization']),
      
      // Feature analysis
      analyzeFeatures: z.boolean().default(true),
      featureImportanceMethod: z.enum(['variance', 'correlation', 'entropy']).default('variance'),
      targetColumn: z.string().optional(),
      
      // Complexity assessment
      assessComplexity: z.boolean().default(true),
    }),
    defaults: {
      focusAreas: ['exploratory', 'descriptive'],
      generateHypotheses: true,
      hypothesisCount: 5,
      hypothesisConfidenceThreshold: 0.7,
      recommendMethods: true,
      methodCategories: ['statistical', 'machine_learning', 'visualization'],
      analyzeFeatures: true,
      featureImportanceMethod: 'variance',
      assessComplexity: true,
    },
    description: 'Analysis strategist configuration',
  },
  
  // Technical requirements
  memoryLimitMB: 512,
  cpuLimit: 2,
  gpuRequired: false,
  
  // UI
  icon: 'Target',
  color: '#8b5cf6',
});

// ============================================================================
// Agent Implementation
// ============================================================================

/**
 * AnalysisStrategistAgent analyzes data and creates a strategic analysis plan.
 */
export class AnalysisStrategistAgent extends BaseAgent {
  readonly metadata: EnhancedAgentMetadata = metadata;
  
  async execute(context: EnhancedAgentContext): Promise<AgentResult> {
    const start = Date.now();
    const { dataframe, config, previousResults } = context;
    
    try {
      // Validate input
      if (!dataframe || !Array.isArray(dataframe) || dataframe.length === 0) {
        return this.createError('No data provided for analysis strategy', Date.now() - start);
      }
      
      // Get schema from previous results
      const schemaResult = previousResults.get('schema_inference');
      const schema = (schemaResult?.output as any)?.schema ?? {};
      
      // Get cleaning and engineering reports
      const cleaningReport = (previousResults.get('data_cleaner')?.output as any)?.cleaningReport ?? {};
      const engineeringReport = (previousResults.get('data_engineer')?.output as any)?.engineeringReport ?? {};
      
      // Get configuration
      const focusAreas = config.focusAreas ?? ['exploratory', 'descriptive'];
      const generateHypotheses = config.generateHypotheses ?? true;
      const hypothesisCount = config.hypothesisCount ?? 5;
      const hypothesisConfidenceThreshold = config.hypothesisConfidenceThreshold ?? 0.7;
      const recommendMethods = config.recommendMethods ?? true;
      const methodCategories = config.methodCategories ?? ['statistical', 'machine_learning', 'visualization'];
      const analyzeFeatures = config.analyzeFeatures ?? true;
      const featureImportanceMethod = config.featureImportanceMethod ?? 'variance';
      const targetColumn = config.targetColumn;
      const assessComplexity = config.assessComplexity ?? true;
      
      // Analyze data
      const dataOverview = this.analyzeDataOverview(dataframe, schema, cleaningReport);
      
      // Analyze features
      const featureAnalysis = analyzeFeatures 
        ? this.analyzeFeatures(dataframe, schema, featureImportanceMethod, targetColumn)
        : [];
      
      // Generate hypotheses
      const hypotheses = generateHypotheses
        ? this.generateHypotheses(dataframe, schema, featureAnalysis, hypothesisCount, hypothesisConfidenceThreshold)
        : [];
      
      // Recommend methods
      const recommendedMethods = recommendMethods
        ? this.recommendMethods(dataOverview, featureAnalysis, focusAreas, methodCategories)
        : [];
      
      // Create execution plan
      const executionPlan = this.createExecutionPlan(recommendedMethods, focusAreas);
      
      // Assess complexity
      const analysisComplexity = assessComplexity
        ? this.assessComplexity(dataOverview, featureAnalysis, hypotheses)
        : 'medium';
      
      // Calculate data quality score
      const dataQualityScore = this.calculateDataQualityScore(dataOverview, cleaningReport);
      
      const analysisPlan = {
        dataOverview,
        featureAnalysis,
        recommendedMethods,
        hypotheses,
        executionPlan,
      };
      
      const output = {
        analysisPlan,
        dataQualityScore,
        analysisComplexity,
      };
      
      const executionTimeMs = Date.now() - start;
      
      return this.createResult(output, {
        rowCount: dataOverview.rowCount,
        columnCount: dataOverview.columnCount,
        dataQualityScore,
        hypothesesGenerated: hypotheses.length,
        methodsRecommended: recommendedMethods.length,
        analysisComplexity: analysisComplexity as any,
      }, executionTimeMs);
      
    } catch (error) {
      const executionTimeMs = Date.now() - start;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return this.createError(errorMessage, executionTimeMs);
    }
  }
  
  /**
   * Analyze data overview
   */
  private analyzeDataOverview(
    dataframe: Record<string, unknown>[],
    schema: Record<string, any>,
    cleaningReport: any
  ): any {
    const rowCount = dataframe.length;
    const columnCount = Object.keys(dataframe[0] || {}).length;
    const memorySize = JSON.stringify(dataframe).length;
    
    // Count data types
    const dataTypes: Record<string, number> = {};
    for (const [col, colSchema] of Object.entries(schema as Record<string, any>)) {
      const type = colSchema.type;
      dataTypes[type] = (dataTypes[type] ?? 0) + 1;
    }
    
    // Calculate completeness
    let nullCount = 0;
    let totalCells = rowCount * columnCount;
    
    for (const col of Object.keys(dataframe[0] || {})) {
      const nulls = dataframe.filter(row => row[col] === null || row[col] === undefined).length;
      nullCount += nulls;
    }
    
    const completeness = totalCells > 0 ? 1 - (nullCount / totalCells) : 1;
    
    return {
      rowCount,
      columnCount,
      memorySize,
      dataTypes,
      completeness,
      nullCount,
      cleanedRowCount: cleaningReport.originalRowCount ?? rowCount,
      rowsRemoved: cleaningReport.rowsRemoved ?? 0,
    };
  }
  
  /**
   * Analyze features
   */
  private analyzeFeatures(
    dataframe: Record<string, unknown>[],
    schema: Record<string, any>,
    method: string,
    targetColumn?: string
  ): any[] {
    const featureAnalysis: any[] = [];
    
    for (const [col, colSchema] of Object.entries(schema as Record<string, any>)) {
      const analysis: any = {
        column: col,
        type: colSchema.type,
        importance: 0,
        recommendations: [],
      };
      
      // Calculate importance based on method
      if (colSchema.type === 'integer' || colSchema.type === 'float') {
        const values = this.extractNumericColumn(dataframe, col);
        
        if (values.length > 0) {
          switch (method) {
            case 'variance':
              analysis.importance = this.calculateVariance(values);
              break;
            case 'correlation':
              if (targetColumn) {
                const targetValues = this.extractNumericColumn(dataframe, targetColumn);
                analysis.importance = Math.abs(correlation(values, targetValues));
              } else {
                analysis.importance = this.calculateVariance(values);
              }
              break;
            case 'entropy':
              analysis.importance = this.calculateEntropy(values);
              break;
          }
          
          // Add statistics
          analysis.statistics = {
            mean: mean(values),
            median: median(values),
            min: min(values),
            max: max(values),
            stdev: stdev(values),
            skewness: skewness(values),
            kurtosis: kurtosis(values),
          };
        }
      } else if (colSchema.type === 'categorical' || colSchema.type === 'string') {
        const values = dataframe.map(row => row[col]).filter(v => v !== null && v !== undefined);
        const uniqueCount = new Set(values).size;
        analysis.importance = uniqueCount / values.length; // Inverse of uniqueness
        analysis.uniqueCount = uniqueCount;
      }
      
      // Generate recommendations
      analysis.recommendations = this.generateFeatureRecommendations(col, colSchema, analysis);
      
      featureAnalysis.push(analysis);
    }
    
    // Sort by importance
    return featureAnalysis.sort((a, b) => b.importance - a.importance);
  }
  
  /**
   * Generate hypotheses
   */
  private generateHypotheses(
    dataframe: Record<string, unknown>[],
    schema: Record<string, any>,
    featureAnalysis: any[],
    count: number,
    confidenceThreshold: number
  ): any[] {
    const hypotheses: any[] = [];
    
    // Generate hypotheses based on feature relationships
    const numericColumns = featureAnalysis
      .filter(f => f.type === 'integer' || f.type === 'float')
      .map(f => f.column);
    
    // Generate correlation-based hypotheses
    for (let i = 0; i < numericColumns.length; i++) {
      for (let j = i + 1; j < numericColumns.length; j++) {
        const col1 = numericColumns[i];
        const col2 = numericColumns[j];
        
        const values1 = this.extractNumericColumn(dataframe, col1);
        const values2 = this.extractNumericColumn(dataframe, col2);
        
        if (values1.length > 0 && values2.length > 0) {
          const corr = correlation(values1, values2);
          
          if (Math.abs(corr) > confidenceThreshold) {
            const direction = corr > 0 ? 'positive' : 'negative';
            const strength = Math.abs(corr) > 0.7 ? 'strong' : Math.abs(corr) > 0.4 ? 'moderate' : 'weak';
            
            hypotheses.push({
              id: `hyp_corr_${col1}_${col2}`,
              statement: `There is a ${strength} ${direction} correlation between ${col1} and ${col2}`,
              type: 'correlation',
              confidence: Math.min(1, Math.abs(corr) * 1.2),
              testMethod: 'Pearson correlation test',
              variables: [col1, col2],
            });
          }
        }
      }
    }
    
    // Generate distribution-based hypotheses
    for (const feature of featureAnalysis) {
      if (feature.type === 'integer' || feature.type === 'float') {
        const values = this.extractNumericColumn(dataframe, feature.column);
        if (values.length > 0) {
          const skew = skewness(values);
          const kurt = kurtosis(values);
          
          if (Math.abs(skew) > 1) {
            const direction = skew > 0 ? 'right' : 'left';
            hypotheses.push({
              id: `hyp_skew_${feature.column}`,
              statement: `The distribution of ${feature.column} is skewed to the ${direction}`,
              type: 'distribution',
              confidence: Math.min(1, Math.abs(skew) / 2),
              testMethod: 'Skewness test',
              variables: [feature.column],
            });
          }
          
          if (Math.abs(kurt) > 1) {
            const type = kurt > 0 ? 'leptokurtic' : 'platykurtic';
            hypotheses.push({
              id: `hyp_kurt_${feature.column}`,
              statement: `The distribution of ${feature.column} is ${type}`,
              type: 'distribution',
              confidence: Math.min(1, Math.abs(kurt) / 2),
              testMethod: 'Kurtosis test',
              variables: [feature.column],
            });
          }
        }
      }
    }
    
    // Sort by confidence and limit to count
    return hypotheses
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, count);
  }
  
  /**
   * Recommend analysis methods
   */
  private recommendMethods(
    dataOverview: any,
    featureAnalysis: any[],
    focusAreas: string[],
    methodCategories: string[]
  ): any[] {
    const recommendations: any[] = [];
    
    // Descriptive statistics
    if (focusAreas.includes('descriptive') || focusAreas.includes('exploratory')) {
      recommendations.push({
        method: 'descriptive_statistics',
        category: 'statistical',
        priority: 10,
        reason: 'Provides fundamental understanding of data distribution and characteristics',
        expectedImpact: 'High - Essential for all analyses',
      });
      
      recommendations.push({
        method: 'data_profiling',
        category: 'statistical',
        priority: 9,
        reason: 'Comprehensive overview of data quality and structure',
        expectedImpact: 'High - Identifies data issues early',
      });
    }
    
    // Anomaly detection
    if (dataOverview.rowCount > 100) {
      recommendations.push({
        method: 'anomaly_detection',
        category: 'machine_learning',
        priority: 8,
        reason: `Large dataset (${dataOverview.rowCount} rows) may contain outliers`,
        expectedImpact: 'Medium - Identifies data quality issues',
      });
    }
    
    // Correlation analysis
    const numericFeatures = featureAnalysis.filter(f => f.type === 'integer' || f.type === 'float');
    if (numericFeatures.length >= 3) {
      recommendations.push({
        method: 'correlation_analysis',
        category: 'statistical',
        priority: 9,
        reason: `${numericFeatures.length} numeric features available for correlation analysis`,
        expectedImpact: 'High - Reveals relationships between variables',
      });
    }
    
    // Time series analysis
    const datetimeFeatures = featureAnalysis.filter(f => f.type === 'datetime');
    if (datetimeFeatures.length > 0) {
      recommendations.push({
        method: 'time_series_analysis',
        category: 'statistical',
        priority: 8,
        reason: `${datetimeFeatures.length} datetime feature(s) detected`,
        expectedImpact: 'High - Enables trend and seasonality analysis',
      });
      
      recommendations.push({
        method: 'forecasting',
        category: 'machine_learning',
        priority: 7,
        reason: 'Datetime features enable time-based predictions',
        expectedImpact: 'Medium - Provides future insights',
      });
    }
    
    // Categorical analysis
    const categoricalFeatures = featureAnalysis.filter(f => f.type === 'categorical' || f.type === 'string');
    if (categoricalFeatures.length > 0) {
      recommendations.push({
        method: 'categorical_analysis',
        category: 'statistical',
        priority: 7,
        reason: `${categoricalFeatures.length} categorical feature(s) available for analysis`,
        expectedImpact: 'Medium - Reveals patterns in categorical data',
      });
    }
    
    // Machine learning
    if (numericFeatures.length >= 5) {
      recommendations.push({
        method: 'clustering',
        category: 'machine_learning',
        priority: 6,
        reason: `${numericFeatures.length} numeric features suitable for clustering`,
        expectedImpact: 'Medium - Discovers natural groupings in data',
      });
      
      if (focusAreas.includes('predictive')) {
        recommendations.push({
          method: 'regression_analysis',
          category: 'machine_learning',
          priority: 8,
          reason: 'Multiple numeric features enable predictive modeling',
          expectedImpact: 'High - Enables predictive insights',
        });
      }
    }
    
    // Visualization
    if (methodCategories.includes('visualization')) {
      recommendations.push({
        method: 'data_visualization',
        category: 'visualization',
        priority: 10,
        reason: 'Visual representations enhance understanding of data patterns',
        expectedImpact: 'High - Essential for data exploration',
      });
      
      recommendations.push({
        method: 'interactive_dashboard',
        category: 'visualization',
        priority: 7,
        reason: 'Interactive exploration of analysis results',
        expectedImpact: 'Medium - Enhances user experience',
      });
    }
    
    // Sort by priority
    return recommendations.sort((a, b) => b.priority - a.priority);
  }
  
  /**
   * Create execution plan
   */
  private createExecutionPlan(
    recommendedMethods: any[],
    focusAreas: string[]
  ): any[] {
    const executionPlan: any[] = [];
    
    // Stage 0: Ingest
    executionPlan.push({
      stage: 0,
      agents: ['data_ingestion', 'schema_inference', 'data_profiler'],
      priority: 10,
      estimatedTime: 5000,
    });
    
    // Stage 1: Engineer
    executionPlan.push({
      stage: 1,
      agents: ['data_cleaner', 'data_engineer', 'feature_engineer', 'data_transformer'],
      priority: 9,
      estimatedTime: 10000,
    });
    
    // Stage 2: Detect
    const detectAgents = ['analysis_strategist'];
    
    // Add recommended agents based on methods
    for (const method of recommendedMethods) {
      switch (method.method) {
        case 'anomaly_detection':
          detectAgents.push('anomaly_sentinel');
          break;
        case 'correlation_analysis':
        case 'time_series_analysis':
          detectAgents.push('forecasting_oracle');
          break;
        case 'categorical_analysis':
          detectAgents.push('knowledge_graph_builder');
          break;
        case 'clustering':
        case 'regression_analysis':
          detectAgents.push('auto_ml');
          break;
      }
    }
    
    // Add all detect agents
    executionPlan.push({
      stage: 2,
      agents: [...new Set(detectAgents)],
      priority: 8,
      estimatedTime: 15000,
    });
    
    // Stage 3: Forecast
    if (recommendedMethods.some(m => m.method === 'forecasting' || m.method === 'time_series_analysis')) {
      executionPlan.push({
        stage: 3,
        agents: ['time_series_forecaster', 'seasonal_decomposer', 'trend_analyzer'],
        priority: 7,
        estimatedTime: 10000,
      });
    }
    
    // Stage 4: Infer
    executionPlan.push({
      stage: 4,
      agents: ['insight_generator', 'explainability', 'hypothesis_tester'],
      priority: 7,
      estimatedTime: 10000,
    });
    
    // Stage 5: Cluster
    if (recommendedMethods.some(m => m.method === 'clustering')) {
      executionPlan.push({
        stage: 5,
        agents: ['cluster_analyzer', 'segmenter', 'pattern_detector'],
        priority: 6,
        estimatedTime: 8000,
      });
    }
    
    // Stage 6: Report
    executionPlan.push({
      stage: 6,
      agents: ['narrative_composer', 'visualization_specialist', 'code_generator', 'orchestrator'],
      priority: 5,
      estimatedTime: 5000,
    });
    
    return executionPlan;
  }
  
  /**
   * Assess analysis complexity
   */
  private assessComplexity(
    dataOverview: any,
    featureAnalysis: any[],
    hypotheses: any[]
  ): 'low' | 'medium' | 'high' {
    let score = 0;
    
    // Data size
    if (dataOverview.rowCount > 10000) score += 2;
    else if (dataOverview.rowCount > 1000) score += 1;
    
    // Feature count
    if (dataOverview.columnCount > 20) score += 2;
    else if (dataOverview.columnCount > 10) score += 1;
    
    // Data types
    const dataTypeCount = Object.keys(dataOverview.dataTypes).length;
    if (dataTypeCount > 3) score += 1;
    
    // Feature importance variance
    const importances = featureAnalysis.map(f => f.importance);
    if (importances.length > 0) {
      const importanceVariance = this.calculateVariance(importances);
      if (importanceVariance > 0.1) score += 1;
    }
    
    // Hypothesis count
    if (hypotheses.length > 5) score += 1;
    
    // Complexity levels
    if (score >= 5) return 'high';
    if (score >= 3) return 'medium';
    return 'low';
  }
  
  /**
   * Calculate data quality score
   */
  private calculateDataQualityScore(
    dataOverview: any,
    cleaningReport: any
  ): number {
    let score = 100; // Start with perfect score
    
    // Penalize for missing values
    const missingPenalty = (1 - dataOverview.completeness) * 40;
    score -= missingPenalty;
    
    // Penalize for rows removed
    const rowsRemoved = cleaningReport.rowsRemoved ?? 0;
    const rowRemovalPenalty = Math.min(20, (rowsRemoved / dataOverview.rowCount) * 20);
    score -= rowRemovalPenalty;
    
    // Penalize for duplicates
    const duplicatesRemoved = cleaningReport.duplicatesRemoved ?? 0;
    const duplicatePenalty = Math.min(10, (duplicatesRemoved / dataOverview.rowCount) * 10);
    score -= duplicatePenalty;
    
    // Ensure score is between 0 and 100
    return Math.max(0, Math.min(100, score));
  }
  
  /**
   * Generate feature recommendations
   */
  private generateFeatureRecommendations(
    column: string,
    schema: any,
    analysis: any
  ): string[] {
    const recommendations: string[] = [];
    
    if (schema.type === 'integer' || schema.type === 'float') {
      if (analysis.statistics?.stdev > analysis.statistics?.mean * 0.5) {
        recommendations.push('High variance - consider standardization');
      }
      
      if (analysis.statistics?.skewness && Math.abs(analysis.statistics.skewness) > 1) {
        recommendations.push('Skewed distribution - consider transformation');
      }
      
      if (analysis.statistics?.nullCount > 0) {
        recommendations.push('Contains missing values - consider imputation');
      }
    } else if (schema.type === 'categorical' || schema.type === 'string') {
      if (analysis.uniqueCount > 50) {
        recommendations.push('High cardinality - consider grouping or encoding');
      }
      
      if (analysis.uniqueCount === 1) {
        recommendations.push('Constant value - consider dropping');
      }
    }
    
    return recommendations;
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
   * Calculate entropy
   */
  private calculateEntropy(values: number[]): number {
    if (values.length === 0) return 0;
    
    const frequencyMap = new Map<number, number>();
    for (const value of values) {
      frequencyMap.set(value, (frequencyMap.get(value) ?? 0) + 1);
    }
    
    let entropy = 0;
    for (const frequency of frequencyMap.values()) {
      const probability = frequency / values.length;
      entropy -= probability * Math.log2(probability);
    }
    
    return entropy;
  }
}

// ============================================================================
// Exports
// ============================================================================

export { metadata as analysisStrategistAgentMetadata };
export default AnalysisStrategistAgent;
