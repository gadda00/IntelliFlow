/**
 * Causal Architect Agent
 * ======================
 * 
 * Stage 2 - Detect
 * 
 * Responsible for causal inference analysis including correlation, regression,
 * and Granger causality tests to identify relationships between variables.
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
import { mean, stdev, correlation, covariance, correlation as pearsonCorrelation } from '../../math';

// ============================================================================
// Agent Metadata
// ============================================================================

const metadata = createAgentMetadata({
  // Identity
  id: 'causal_architect',
  name: 'Causal Architect',
  description: 'Performs causal inference analysis using correlation, regression, and Granger-style causality tests to identify relationships and dependencies between variables.',
  version: '1.0.0',
  
  // Classification
  stage: 'detect' as AgentStage,
  stageNumber: 2,
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
    'causal_inference',
    'correlation_analysis',
    'regression_analysis',
    'granger_causality',
    'causal_graph',
    'relationship_mapping',
  ],
  category: 'analysis',
  tags: ['causal', 'correlation', 'regression', 'granger', 'relationships'],
  
  // Input/Output
  inputDescription: 'Cleaned and engineered dataframe with schema',
  outputDescription: 'Causal analysis results with relationships and causal graph',
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
      correlationMatrix: z.record(z.string(), z.record(z.string(), z.number())),
      correlationAnalysis: z.array(z.object({
        variable1: z.string(),
        variable2: z.string(),
        correlation: z.number(),
        pValue: z.number().nullable(),
        strength: z.enum(['weak', 'moderate', 'strong']),
        direction: z.enum(['positive', 'negative', 'none']),
        significance: z.enum(['not_significant', 'significant', 'highly_significant']),
      })),
      regressionAnalysis: z.array(z.object({
        target: z.string(),
        predictors: z.array(z.string()),
        coefficients: z.record(z.string(), z.number()),
        intercept: z.number(),
        rSquared: z.number(),
        adjustedRSquared: z.number(),
        fStatistic: z.number().nullable(),
        pValue: z.number().nullable(),
        significance: z.enum(['not_significant', 'significant', 'highly_significant']),
      })),
      grangerAnalysis: z.array(z.object({
        cause: z.string(),
        effect: z.string(),
        fStatistic: z.number().nullable(),
        pValue: z.number().nullable(),
        lags: z.number(),
        significance: z.enum(['not_significant', 'significant', 'highly_significant']),
        direction: z.enum(['unidirectional', 'bidirectional', 'none']),
      })),
      causalGraph: z.object({
        nodes: z.array(z.string()),
        edges: z.array(z.object({
          from: z.string(),
          to: z.string(),
          strength: z.number(),
          direction: z.enum(['positive', 'negative']),
          type: z.enum(['correlation', 'regression', 'granger']),
        })),
      }),
      summary: z.object({
        totalVariables: z.number(),
        numericVariables: z.number(),
        significantCorrelations: z.number(),
        significantRegressions: z.number(),
        significantGrangerTests: z.number(),
        strongestRelationships: z.array(z.object({
          variable1: z.string(),
          variable2: z.string(),
          strength: z.number(),
          type: z.string(),
        })),
      }),
      recommendations: z.array(z.string()),
    }),
    description: 'Causal analysis results with relationships and causal graph',
  },
  configSchema: {
    schema: z.object({
      // Correlation analysis
      correlation: z.object({
        enabled: z.boolean().default(true),
        significanceLevel: z.number().min(0).max(1).default(0.05),
        includePValues: z.boolean().default(true),
      }).optional().default(undefined as any),
      
      // Regression analysis
      regression: z.object({
        enabled: z.boolean().default(true),
        targetColumns: z.array(z.string()).optional(),
        maxPredictors: z.number().int().positive().max(20).default(10),
        includeIntercept: z.boolean().default(true),
        significanceLevel: z.number().min(0).max(1).default(0.05),
      }).optional().default(undefined as any),
      
      // Granger causality
      granger: z.object({
        enabled: z.boolean().default(true),
        maxLags: z.number().int().positive().max(20).default(5),
        significanceLevel: z.number().min(0).max(1).default(0.05),
      }).optional().default(undefined as any),
      
      // Causal graph
      causalGraph: z.object({
        enabled: z.boolean().default(true),
        minStrength: z.number().min(0).max(1).default(0.3),
        includeDirections: z.boolean().default(true),
      }).optional().default(undefined as any),
      
      // Variable selection
      variables: z.object({
        include: z.array(z.string()).optional(),
        exclude: z.array(z.string()).optional(),
        numericOnly: z.boolean().default(true),
      }).optional().default(undefined as any),
      
      // Output
      includeAllPairs: z.boolean().default(false),
      maxResults: z.number().int().positive().max(1000).default(100),
    }),
    defaults: {
      correlation: {
        enabled: true,
        significanceLevel: 0.05,
        includePValues: true,
      },
      regression: {
        enabled: true,
        maxPredictors: 10,
        includeIntercept: true,
        significanceLevel: 0.05,
      },
      granger: {
        enabled: true,
        maxLags: 5,
        significanceLevel: 0.05,
      },
      causalGraph: {
        enabled: true,
        minStrength: 0.3,
        includeDirections: true,
      },
      variables: {
        numericOnly: true,
      },
      includeAllPairs: false,
      maxResults: 100,
    },
    description: 'Causal analysis configuration',
  },
  
  // Technical requirements
  memoryLimitMB: 1024,
  cpuLimit: 4,
  gpuRequired: false,
  
  // UI
  icon: 'Network',
  color: '#8b5cf6',
});

// ============================================================================
// Agent Implementation
// ============================================================================

/**
 * CausalArchitectAgent performs causal inference analysis.
 */
export class CausalArchitectAgent extends BaseAgent {
  readonly metadata: EnhancedAgentMetadata = metadata;
  
  async execute(context: EnhancedAgentContext): Promise<AgentResult> {
    const start = Date.now();
    const { dataframe, config, previousResults } = context;
    
    try {
      // Validate input
      if (!dataframe || !Array.isArray(dataframe) || dataframe.length === 0) {
        return this.createError('No data provided for causal analysis', Date.now() - start);
      }
      
      // Get schema from previous results
      const schemaResult = previousResults.get('schema_inference');
      const schema = (schemaResult?.output as any)?.schema ?? {};
      
      // Get configuration
      const correlationConfig = config.correlation ?? {};
      const regressionConfig = config.regression ?? {};
      const grangerConfig = config.granger ?? {};
      const causalGraphConfig = config.causalGraph ?? {};
      const variablesConfig = config.variables ?? {};
      const includeAllPairs = config.includeAllPairs ?? false;
      const maxResults = config.maxResults ?? 100;
      
      // Get variables to analyze
      const allColumns = Object.keys(dataframe[0] || {});
      const numericColumns = Object.entries(schema as Record<string, any>)
        .filter(([col, colSchema]: [string, any]) => 
          (colSchema.type === 'integer' || colSchema.type === 'float') &&
          allColumns.includes(col))
        .map(([col]) => col);
      
      // Apply variable filters
      let variablesToAnalyze = variablesConfig.numericOnly ? numericColumns : allColumns;
      
      if (variablesConfig.include?.length > 0) {
        variablesToAnalyze = variablesToAnalyze.filter(col => variablesConfig.include!.includes(col));
      }
      
      if (variablesConfig.exclude?.length > 0) {
        variablesToAnalyze = variablesToAnalyze.filter(col => !variablesConfig.exclude!.includes(col));
      }
      
      if (variablesToAnalyze.length < 2) {
        return this.createError('At least 2 variables are required for causal analysis', Date.now() - start);
      }
      
      // Calculate correlation matrix
      const correlationMatrix = this.calculateCorrelationMatrix(dataframe, variablesToAnalyze);
      
      // Perform correlation analysis
      const correlationAnalysis = correlationConfig.enabled
        ? this.performCorrelationAnalysis(
            correlationMatrix,
            variablesToAnalyze,
            correlationConfig.significanceLevel ?? 0.05,
            correlationConfig.includePValues ?? true)
        : [];
      
      // Perform regression analysis
      const regressionAnalysis = regressionConfig.enabled
        ? this.performRegressionAnalysis(
            dataframe,
            variablesToAnalyze,
            regressionConfig)
        : [];
      
      // Perform Granger causality analysis
      const grangerAnalysis = grangerConfig.enabled
        ? this.performGrangerAnalysis(
            dataframe,
            variablesToAnalyze,
            grangerConfig)
        : [];
      
      // Build causal graph
      const causalGraph = causalGraphConfig.enabled
        ? this.buildCausalGraph(
            correlationAnalysis,
            regressionAnalysis,
            grangerAnalysis,
            causalGraphConfig)
        : { nodes: [], edges: [] };
      
      // Generate summary
      const summary = this.generateSummary(
        variablesToAnalyze,
        numericColumns,
        correlationAnalysis,
        regressionAnalysis,
        grangerAnalysis,
        causalGraph
      );
      
      // Generate recommendations
      const recommendations = this.generateRecommendations(
        correlationAnalysis,
        regressionAnalysis,
        grangerAnalysis,
        causalGraph
      );
      
      const output = {
        correlationMatrix,
        correlationAnalysis,
        regressionAnalysis,
        grangerAnalysis,
        causalGraph,
        summary,
        recommendations,
      };
      
      const executionTimeMs = Date.now() - start;
      
      return this.createResult(output, {
        variablesAnalyzed: variablesToAnalyze.length,
        significantCorrelations: summary.significantCorrelations,
        significantRegressions: summary.significantRegressions,
        significantGrangerTests: summary.significantGrangerTests,
        edgesInGraph: causalGraph.edges.length,
      }, executionTimeMs);
      
    } catch (error) {
      const executionTimeMs = Date.now() - start;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return this.createError(errorMessage, executionTimeMs);
    }
  }
  
  /**
   * Calculate correlation matrix
   */
  private calculateCorrelationMatrix(
    dataframe: Record<string, unknown>[],
    variables: string[]
  ): Record<string, Record<string, number>> {
    const matrix: Record<string, Record<string, number>> = {};
    
    for (const var1 of variables) {
      matrix[var1] = {};
      const values1 = this.extractNumericColumn(dataframe, var1);
      
      for (const var2 of variables) {
        const values2 = this.extractNumericColumn(dataframe, var2);
        matrix[var1][var2] = pearsonCorrelation(values1, values2);
      }
    }
    
    return matrix;
  }
  
  /**
   * Perform correlation analysis
   */
  private performCorrelationAnalysis(
    correlationMatrix: Record<string, Record<string, number>>,
    variables: string[],
    significanceLevel: number,
    includePValues: boolean,
    sampleSize: number = 100,
  ): any[] {
    const analysis: any[] = [];
    
    for (let i = 0; i < variables.length; i++) {
      for (let j = i + 1; j < variables.length; j++) {
        const var1 = variables[i];
        const var2 = variables[j];
        const correlation = correlationMatrix[var1][var2];
        
        // Calculate p-value (approximate)
        let pValue: number | null = null;
        if (includePValues) {
          pValue = this.calculateCorrelationPValue(correlation, sampleSize);
        }
        
        // Determine strength
        const strength = Math.abs(correlation) > 0.7 ? 'strong' :
                         Math.abs(correlation) > 0.4 ? 'moderate' : 'weak';
        
        // Determine direction
        const direction = correlation > 0.1 ? 'positive' :
                          correlation < -0.1 ? 'negative' : 'none';
        
        // Determine significance
        const significance = pValue !== null && pValue < significanceLevel ?
                              (pValue < 0.01 ? 'highly_significant' : 'significant') :
                              'not_significant';
        
        analysis.push({
          variable1: var1,
          variable2: var2,
          correlation,
          pValue,
          strength,
          direction,
          significance,
        });
      }
    }
    
    // Sort by absolute correlation
    return analysis.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
  }
  
  /**
   * Calculate p-value for correlation coefficient
   */
  private calculateCorrelationPValue(correlation: number, sampleSize: number): number {
    // Two-tailed p-value for Pearson correlation
    // Using Fisher transformation approximation
    if (Math.abs(correlation) >= 1) {
      return 0;
    }
    
    const fisherZ = 0.5 * Math.log((1 + correlation) / (1 - correlation));
    const stdError = 1 / Math.sqrt(sampleSize - 3);
    const zScore = fisherZ / stdError;
    
    // Two-tailed p-value from z-score
    return 2 * (1 - this.normalCDF(Math.abs(zScore)));
  }
  
  /**
   * Cumulative distribution function for standard normal distribution
   */
  private normalCDF(z: number): number {
    // Abramowitz and Stegun approximation
    const t = 1.0 / (1.0 + 0.2316419 * Math.abs(z));
    const d = 0.3989422804014327;
    const p = d * Math.exp(-z * z / 2.0);
    const q = p * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
    
    if (z > 0) {
      return 1.0 - q;
    } else {
      return q;
    }
  }
  
  /**
   * Perform regression analysis
   */
  private performRegressionAnalysis(
    dataframe: Record<string, unknown>[],
    variables: string[],
    config: any
  ): any[] {
    const analysis: any[] = [];
    
    // Determine target columns
    const targetColumns = config.targetColumns?.length > 0
      ? config.targetColumns.filter((col: string) => variables.includes(col))
      : variables;
    
    // For each target, try all possible combinations of predictors
    for (const target of targetColumns) {
      const targetValues = this.extractNumericColumn(dataframe, target);
      if (targetValues.length === 0) continue;
      
      const predictorCandidates = variables.filter(col => col !== target);
      
      // Limit the number of predictors to consider
      const maxPredictors = Math.min(config.maxPredictors ?? 10, predictorCandidates.length);
      const predictors = predictorCandidates.slice(0, maxPredictors);
      
      // Perform multiple linear regression
      const result = this.performMultipleRegression(
        dataframe,
        target,
        predictors,
        config.includeIntercept ?? true
      );
      
      if (result) {
        analysis.push(result);
      }
    }
    
    // Sort by R-squared
    return analysis.sort((a, b) => b.rSquared - a.rSquared);
  }
  
  /**
   * Perform multiple linear regression
   */
  private performMultipleRegression(
    dataframe: Record<string, unknown>[],
    target: string,
    predictors: string[],
    includeIntercept: boolean
  ): any | null {
    const n = dataframe.length;
    const p = predictors.length + (includeIntercept ? 1 : 0);
    
    if (n <= p) {
      return null; // Not enough data
    }
    
    // Prepare data matrices
    const X: number[][] = [];
    const y: number[] = [];
    
    for (const row of dataframe) {
      const xRow: number[] = [];
      
      if (includeIntercept) {
        xRow.push(1); // Intercept term
      }
      
      for (const predictor of predictors) {
        const value = Number(row[predictor]);
        xRow.push(Number.isNaN(value) || !Number.isFinite(value) ? 0 : value);
      }
      
      const targetValue = Number(row[target]);
      if (Number.isNaN(targetValue) || !Number.isFinite(targetValue)) {
        continue;
      }
      
      X.push(xRow);
      y.push(targetValue);
    }
    
    if (X.length === 0 || X.length <= p) {
      return null;
    }
    
    // Calculate coefficients using ordinary least squares
    // X'Xβ = X'y
    // β = (X'X)^-1 X'y
    
    const Xt = this.transpose(X);
    const XtX = this.matrixMultiply(Xt, X);
    const Xty = this.matrixMultiply(Xt, [y]);
    
    // Invert XtX
    const XtXInv = this.matrixInverse(XtX);
    if (!XtXInv) {
      return null; // Matrix is singular
    }
    
    // Calculate coefficients
    const coefficientsMatrix = this.matrixMultiply(XtXInv, Xty);
    const coefficients: Record<string, number> = {};
    
    if (includeIntercept) {
      coefficients.intercept = coefficientsMatrix[0][0];
    }
    
    for (let i = 0; i < predictors.length; i++) {
      coefficients[predictors[i]] = coefficientsMatrix[includeIntercept ? i + 1 : i][0];
    }
    
    // Calculate predictions and residuals
    const predictions: number[] = [];
    const residuals: number[] = [];
    
    for (let i = 0; i < X.length; i++) {
      let prediction = 0;
      for (let j = 0; j < X[i].length; j++) {
        prediction += X[i][j] * coefficientsMatrix[j][0];
      }
      predictions.push(prediction);
      residuals.push(y[i] - prediction);
    }
    
    // Calculate R-squared
    const yMean = mean(y);
    const ssTotal = y.reduce((sum, val) => sum + Math.pow(val - yMean, 2), 0);
    const ssResidual = residuals.reduce((sum, val) => sum + Math.pow(val, 2), 0);
    const rSquared = ssTotal > 0 ? 1 - (ssResidual / ssTotal) : 0;
    
    // Calculate adjusted R-squared
    const adjustedRSquared = 1 - (ssResidual / ssTotal) * (X.length - 1) / (X.length - p);
    
    // Calculate F-statistic
    const ssRegression = ssTotal - ssResidual;
    const msRegression = ssRegression / (p - 1);
    const msResidual = ssResidual / (X.length - p);
    const fStatistic = msResidual > 0 ? msRegression / msResidual : null;
    
    // Calculate p-value for F-statistic
    const pValue = fStatistic !== null ? this.calculateFTestPValue(fStatistic, p - 1, X.length - p) : null;
    
    // Determine significance
    const significanceLevel = 0.05;
    const significance = pValue !== null && pValue < significanceLevel ?
                          (pValue < 0.01 ? 'highly_significant' : 'significant') :
                          'not_significant';
    
    return {
      target,
      predictors,
      coefficients,
      intercept: coefficients.intercept ?? 0,
      rSquared,
      adjustedRSquared,
      fStatistic,
      pValue,
      significance,
    };
  }
  
  /**
   * Calculate p-value for F-test
   */
  private calculateFTestPValue(fStatistic: number, df1: number, df2: number): number {
    // Approximate p-value for F-distribution
    // Using a simplified approximation
    if (fStatistic <= 0) return 1;
    
    const x = df2 / (df2 + df1 * fStatistic);
    const p = this.incompleteBetaFunction(0.5 * df2, 0.5 * df1, x);
    
    return 1 - p;
  }
  
  /**
   * Incomplete beta function approximation
   */
  private incompleteBetaFunction(a: number, b: number, x: number): number {
    // Continued fraction approximation
    // This is a simplified version
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    
    const epsilon = 1e-10;
    const maxIterations = 1000;
    
    let result = 0;
    let term = 1;
    let m = 0;
    
    while (m < maxIterations) {
      if (Math.abs(term) < epsilon) break;
      
      result += term;
      term *= x * (a + m) * (b + m) / ((a + 2 * m) * (a + 2 * m + 1) * (m + 1));
      m++;
    }
    
    return result * Math.pow(x, a) * Math.pow(1 - x, b) / a;
  }
  
  /**
   * Perform Granger causality analysis
   */
  private performGrangerAnalysis(
    dataframe: Record<string, unknown>[],
    variables: string[],
    config: any
  ): any[] {
    const analysis: any[] = [];
    const maxLags = config.maxLags ?? 5;
    const significanceLevel = config.significanceLevel ?? 0.05;
    
    // Perform Granger test for all pairs
    for (let i = 0; i < variables.length; i++) {
      for (let j = 0; j < variables.length; j++) {
        if (i === j) continue;
        
        const cause = variables[i];
        const effect = variables[j];
        
        // Perform Granger test
        const result = this.performGrangerTest(
          dataframe,
          cause,
          effect,
          maxLags,
          significanceLevel
        );
        
        if (result) {
          analysis.push(result);
        }
      }
    }
    
    // Sort by p-value
    return analysis.sort((a, b) => (a.pValue ?? 1) - (b.pValue ?? 1));
  }
  
  /**
   * Perform Granger causality test
   */
  private performGrangerTest(
    dataframe: Record<string, unknown>[],
    cause: string,
    effect: string,
    maxLags: number,
    significanceLevel: number
  ): any | null {
    const causeValues = this.extractNumericColumn(dataframe, cause);
    const effectValues = this.extractNumericColumn(dataframe, effect);
    
    if (causeValues.length === 0 || effectValues.length === 0 || causeValues.length !== effectValues.length) {
      return null;
    }
    
    const n = causeValues.length;
    if (n <= maxLags * 2) {
      return null; // Not enough data
    }
    
    // Find optimal lag using AIC or BIC
    const optimalLag = this.findOptimalLag(causeValues, effectValues, maxLags);
    
    // Fit restricted model (effect only)
    const restrictedSSR = this.fitAutoregression(effectValues, optimalLag);
    
    // Fit unrestricted model (effect + cause)
    const unrestrictedSSR = this.fitAutoregressionWithCause(
      effectValues,
      causeValues,
      optimalLag
    );
    
    // Calculate F-statistic
    const fStatistic = this.calculateGrangerFStatistic(
      restrictedSSR,
      unrestrictedSSR,
      n,
      optimalLag
    );
    
    // Calculate p-value
    const pValue = this.calculateFTestPValue(fStatistic, optimalLag, n - 2 * optimalLag - 1);
    
    // Determine significance
    const significance = pValue < significanceLevel ?
                          (pValue < 0.01 ? 'highly_significant' : 'significant') :
                          'not_significant';
    
    // Determine direction
    let direction: 'unidirectional' | 'bidirectional' | 'none' = 'none';
    if (pValue < significanceLevel) {
      // Check reverse direction
      const reversePValue = this.calculateFTestPValue(
        this.calculateGrangerFStatistic(
          this.fitAutoregression(causeValues, optimalLag),
          this.fitAutoregressionWithCause(causeValues, effectValues, optimalLag),
          n,
          optimalLag
        ),
        optimalLag,
        n - 2 * optimalLag - 1
      );
      
      if (reversePValue < significanceLevel) {
        direction = 'bidirectional';
      } else {
        direction = 'unidirectional';
      }
    }
    
    return {
      cause,
      effect,
      fStatistic,
      pValue,
      lags: optimalLag,
      significance,
      direction,
    };
  }
  
  /**
   * Find optimal lag for Granger test
   */
  private findOptimalLag(cause: number[], effect: number[], maxLags: number): number {
    let bestLag = 1;
    let bestAIC = Infinity;
    
    for (let lag = 1; lag <= maxLags; lag++) {
      const aic = this.calculateAIC(effect, lag);
      if (aic < bestAIC) {
        bestAIC = aic;
        bestLag = lag;
      }
    }
    
    return bestLag;
  }
  
  /**
   * Calculate Akaike Information Criterion
   */
  private calculateAIC(values: number[], lag: number): number {
    const n = values.length;
    const ssr = this.fitAutoregression(values, lag);
    const k = lag + 1; // Number of parameters
    
    return n * Math.log(ssr / n) + 2 * k;
  }
  
  /**
   * Fit autoregression model and return SSR
   */
  private fitAutoregression(values: number[], lag: number): number {
    const n = values.length;
    if (n <= lag) return Infinity;
    
    // Create design matrix
    const X: number[][] = [];
    const y: number[] = [];
    
    for (let i = lag; i < n; i++) {
      const xRow = values.slice(i - lag, i);
      X.push([1, ...xRow]); // Include intercept
      y.push(values[i]);
    }
    
    // Calculate coefficients
    const Xt = this.transpose(X);
    const XtX = this.matrixMultiply(Xt, X);
    const Xty = this.matrixMultiply(Xt, [y]);
    
    const XtXInv = this.matrixInverse(XtX);
    if (!XtXInv) return Infinity;
    
    const coefficients = this.matrixMultiply(XtXInv, Xty);
    
    // Calculate predictions and SSR
    let ssr = 0;
    for (let i = 0; i < X.length; i++) {
      let prediction = 0;
      for (let j = 0; j < X[i].length; j++) {
        prediction += X[i][j] * coefficients[j][0];
      }
      ssr += Math.pow(y[i] - prediction, 2);
    }
    
    return ssr;
  }
  
  /**
   * Fit autoregression with cause variable
   */
  private fitAutoregressionWithCause(
    effect: number[],
    cause: number[],
    lag: number
  ): number {
    const n = effect.length;
    if (n <= lag || cause.length !== n) return Infinity;
    
    // Create design matrix
    const X: number[][] = [];
    const y: number[] = [];
    
    for (let i = lag; i < n; i++) {
      const xRow = effect.slice(i - lag, i);
      X.push([1, ...xRow, cause[i]]); // Include intercept, lags, and cause
      y.push(effect[i]);
    }
    
    // Calculate coefficients
    const Xt = this.transpose(X);
    const XtX = this.matrixMultiply(Xt, X);
    const Xty = this.matrixMultiply(Xt, [y]);
    
    const XtXInv = this.matrixInverse(XtX);
    if (!XtXInv) return Infinity;
    
    const coefficients = this.matrixMultiply(XtXInv, Xty);
    
    // Calculate predictions and SSR
    let ssr = 0;
    for (let i = 0; i < X.length; i++) {
      let prediction = 0;
      for (let j = 0; j < X[i].length; j++) {
        prediction += X[i][j] * coefficients[j][0];
      }
      ssr += Math.pow(y[i] - prediction, 2);
    }
    
    return ssr;
  }
  
  /**
   * Calculate Granger F-statistic
   */
  private calculateGrangerFStatistic(
    restrictedSSR: number,
    unrestrictedSSR: number,
    n: number,
    lag: number
  ): number {
    if (restrictedSSR <= unrestrictedSSR) return 0;
    
    const numerator = (restrictedSSR - unrestrictedSSR) / lag;
    const denominator = unrestrictedSSR / (n - 2 * lag - 1);
    
    return denominator > 0 ? numerator / denominator : 0;
  }
  
  /**
   * Build causal graph
   */
  private buildCausalGraph(
    correlationAnalysis: any[],
    regressionAnalysis: any[],
    grangerAnalysis: any[],
    config: any
  ): any {
    const nodes: string[] = [];
    const edges: any[] = [];
    
    // Collect all unique nodes
    const allNodes = new Set<string>();
    
    for (const corr of correlationAnalysis) {
      allNodes.add(corr.variable1);
      allNodes.add(corr.variable2);
    }
    
    for (const reg of regressionAnalysis) {
      allNodes.add(reg.target);
      for (const pred of reg.predictors) {
        allNodes.add(pred);
      }
    }
    
    for (const granger of grangerAnalysis) {
      allNodes.add(granger.cause);
      allNodes.add(granger.effect);
    }
    
    nodes.push(...Array.from(allNodes));
    
    // Add edges from correlation analysis
    for (const corr of correlationAnalysis) {
      if (Math.abs(corr.correlation) >= config.minStrength) {
        edges.push({
          from: corr.variable1,
          to: corr.variable2,
          strength: Math.abs(corr.correlation),
          direction: corr.direction,
          type: 'correlation',
        });
      }
    }
    
    // Add edges from regression analysis
    for (const reg of regressionAnalysis) {
      for (const [predictor, coefficient] of Object.entries(reg.coefficients as Record<string, number>)) {
        if (predictor !== 'intercept' && Math.abs(coefficient as number) >= (config.minStrength as number)) {
          edges.push({
            from: predictor,
            to: reg.target,
            strength: Math.abs(coefficient),
            direction: coefficient > 0 ? 'positive' : 'negative',
            type: 'regression',
          });
        }
      }
    }
    
    // Add edges from Granger analysis
    for (const granger of grangerAnalysis) {
      if (granger.significance !== 'not_significant') {
        edges.push({
          from: granger.cause,
          to: granger.effect,
          strength: 1 - (granger.pValue ?? 1),
          direction: 'positive', // Direction determined by test
          type: 'granger',
        });
        
        if (granger.direction === 'bidirectional') {
          edges.push({
            from: granger.effect,
            to: granger.cause,
            strength: 1 - (granger.pValue ?? 1),
            direction: 'positive',
            type: 'granger',
          });
        }
      }
    }
    
    // Remove duplicate edges and merge
    const uniqueEdges = this.mergeEdges(edges);
    
    return {
      nodes,
      edges: uniqueEdges,
    };
  }
  
  /**
   * Merge duplicate edges
   */
  private mergeEdges(edges: any[]): any[] {
    const edgeMap = new Map<string, any>();
    
    for (const edge of edges) {
      const key = `${edge.from}->${edge.to}`;
      const reverseKey = `${edge.to}->${edge.from}`;
      
      if (edgeMap.has(key)) {
        // Merge with existing edge
        const existing = edgeMap.get(key);
        existing.strength = Math.max(existing.strength, edge.strength);
        
        // If directions conflict, use the stronger one
        if (existing.direction !== edge.direction && edge.strength > existing.strength) {
          existing.direction = edge.direction;
        }
      } else if (edgeMap.has(reverseKey)) {
        // Merge with reverse edge
        const existing = edgeMap.get(reverseKey);
        existing.strength = Math.max(existing.strength, edge.strength);
        
        // If directions conflict, use the stronger one
        if (existing.direction !== edge.direction && edge.strength > existing.strength) {
          existing.direction = edge.direction;
        }
      } else {
        edgeMap.set(key, { ...edge });
      }
    }
    
    return Array.from(edgeMap.values());
  }
  
  /**
   * Generate summary
   */
  private generateSummary(
    variables: string[],
    numericVariables: string[],
    correlationAnalysis: any[],
    regressionAnalysis: any[],
    grangerAnalysis: any[],
    causalGraph: any
  ): any {
    const significantCorrelations = correlationAnalysis.filter(
      c => c.significance !== 'not_significant'
    ).length;
    
    const significantRegressions = regressionAnalysis.filter(
      r => r.significance !== 'not_significant'
    ).length;
    
    const significantGrangerTests = grangerAnalysis.filter(
      g => g.significance !== 'not_significant'
    ).length;
    
    // Find strongest relationships
    const allRelationships = [
      ...correlationAnalysis.map(c => ({
        variable1: c.variable1,
        variable2: c.variable2,
        strength: Math.abs(c.correlation),
        type: 'correlation',
      })),
      ...regressionAnalysis.flatMap(r =>
        Object.entries(r.coefficients as Record<string, number>)
          .filter(([k]) => k !== 'intercept')
          .map(([predictor, coefficient]) => ({
            variable1: predictor,
            variable2: r.target,
            strength: Math.abs(coefficient as number),
            type: 'regression',
          }))
      ),
      ...grangerAnalysis.map(g => ({
        variable1: g.cause,
        variable2: g.effect,
        strength: 1 - (g.pValue ?? 1),
        type: 'granger',
      })),
    ];
    
    const strongestRelationships = allRelationships
      .sort((a, b) => b.strength - a.strength)
      .slice(0, 5);
    
    return {
      totalVariables: variables.length,
      numericVariables: numericVariables.length,
      significantCorrelations,
      significantRegressions,
      significantGrangerTests,
      strongestRelationships,
    };
  }
  
  /**
   * Generate recommendations
   */
  private generateRecommendations(
    correlationAnalysis: any[],
    regressionAnalysis: any[],
    grangerAnalysis: any[],
    causalGraph: any
  ): string[] {
    const recommendations: string[] = [];
    
    // Correlation recommendations
    const significantCorrelations = correlationAnalysis.filter(
      c => c.significance !== 'not_significant'
    );
    
    if (significantCorrelations.length > 0) {
      recommendations.push(
        `${significantCorrelations.length} significant correlation(s) found`
      );
      
      const strongestCorr = significantCorrelations[0];
      if (strongestCorr) {
        recommendations.push(
          `Strongest correlation: ${strongestCorr.variable1} ↔ ${strongestCorr.variable2} ` +
          `(r = ${strongestCorr.correlation.toFixed(3)}, ${strongestCorr.significance})`
        );
      }
    } else {
      recommendations.push('No significant correlations found');
    }
    
    // Regression recommendations
    const significantRegressions = regressionAnalysis.filter(
      r => r.significance !== 'not_significant'
    );
    
    if (significantRegressions.length > 0) {
      recommendations.push(
        `${significantRegressions.length} significant regression(s) found`
      );
      
      const strongestReg = significantRegressions[0];
      if (strongestReg) {
        recommendations.push(
          `Best model: ${strongestReg.target} ~ ${strongestReg.predictors.join(' + ')} ` +
          `(R² = ${strongestReg.rSquared.toFixed(3)}, ${strongestReg.significance})`
        );
      }
    } else {
      recommendations.push('No significant regressions found');
    }
    
    // Granger recommendations
    const significantGranger = grangerAnalysis.filter(
      g => g.significance !== 'not_significant'
    );
    
    if (significantGranger.length > 0) {
      recommendations.push(
        `${significantGranger.length} significant Granger causality test(s) found`
      );
      
      const strongestGranger = significantGranger[0];
      if (strongestGranger) {
        recommendations.push(
          `Strongest causality: ${strongestGranger.cause} → ${strongestGranger.effect} ` +
          `(p = ${strongestGranger.pValue?.toFixed(4)}, ${strongestGranger.direction})`
        );
      }
    } else {
      recommendations.push('No significant Granger causality relationships found');
    }
    
    // Graph recommendations
    if (causalGraph.edges.length > 0) {
      recommendations.push(
        `Causal graph contains ${causalGraph.edges.length} relationship(s)`
      );
      
      const strongestEdge = causalGraph.edges.sort((a: any, b: any) => b.strength - a.strength)[0];
      if (strongestEdge) {
        recommendations.push(
          `Strongest relationship: ${strongestEdge.from} → ${strongestEdge.to} ` +
          `(strength = ${strongestEdge.strength.toFixed(3)})`
        );
      }
    } else {
      recommendations.push('No relationships identified in causal graph');
    }
    
    return recommendations;
  }
  
  /**
   * Transpose matrix
   */
  private transpose(matrix: number[][]): number[][] {
    if (matrix.length === 0) return [];
    
    const rows = matrix.length;
    const cols = matrix[0].length;
    
    const result: number[][] = [];
    for (let j = 0; j < cols; j++) {
      result[j] = [];
      for (let i = 0; i < rows; i++) {
        result[j][i] = matrix[i][j];
      }
    }
    
    return result;
  }
  
  /**
   * Multiply matrices
   */
  private matrixMultiply(a: number[][], b: number[][]): number[][] {
    const aRows = a.length;
    const aCols = a[0]?.length ?? 0;
    const bRows = b.length;
    const bCols = b[0]?.length ?? 0;
    
    if (aCols !== bRows) {
      throw new Error(`Matrix dimensions don't match: ${aCols} !== ${bRows}`);
    }
    
    const result: number[][] = [];
    for (let i = 0; i < aRows; i++) {
      result[i] = [];
      for (let j = 0; j < bCols; j++) {
        let sum = 0;
        for (let k = 0; k < aCols; k++) {
          sum += a[i][k] * b[k][j];
        }
        result[i][j] = sum;
      }
    }
    
    return result;
  }
  
  /**
   * Invert matrix
   */
  private matrixInverse(matrix: number[][]): number[][] | null {
    const n = matrix.length;
    
    // Check if square
    for (const row of matrix) {
      if (row.length !== n) return null;
    }
    
    // Create augmented matrix
    const augmented: number[][] = [];
    for (let i = 0; i < n; i++) {
      augmented[i] = [...matrix[i], ...new Array(n).fill(0)];
      augmented[i][n + i] = 1;
    }
    
    // Gaussian elimination
    for (let i = 0; i < n; i++) {
      // Find pivot
      let maxRow = i;
      for (let j = i + 1; j < n; j++) {
        if (Math.abs(augmented[j][i]) > Math.abs(augmented[maxRow][i])) {
          maxRow = j;
        }
      }
      
      // Swap rows
      [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]];
      
      // Check for singular matrix
      if (Math.abs(augmented[i][i]) < 1e-10) {
        return null;
      }
      
      // Normalize pivot row
      const pivot = augmented[i][i];
      for (let j = 0; j < 2 * n; j++) {
        augmented[i][j] /= pivot;
      }
      
      // Eliminate other rows
      for (let k = 0; k < n; k++) {
        if (k !== i) {
          const factor = augmented[k][i];
          for (let j = 0; j < 2 * n; j++) {
            augmented[k][j] -= factor * augmented[i][j];
          }
        }
      }
    }
    
    // Extract inverse
    const inverse: number[][] = [];
    for (let i = 0; i < n; i++) {
      inverse[i] = augmented[i].slice(n);
    }
    
    return inverse;
  }
}

// ============================================================================
// Exports
// ============================================================================

export { metadata as causalArchitectAgentMetadata };
export default CausalArchitectAgent;
