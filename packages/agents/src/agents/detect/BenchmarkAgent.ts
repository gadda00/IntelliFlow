/**
 * Benchmark Agent
 * ================
 * 
 * Stage 2 - Detect
 * 
 * Responsible for comparing data against industry benchmarks and best practices.
 * Provides performance metrics, gap analysis, and recommendations.
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
import { mean, median, stdev, min, max, quantile } from '../../math';

// ============================================================================
// Industry Benchmarks (simplified for demonstration)
// In a production environment, these would come from a database or API
// ============================================================================

const INDUSTRY_BENCHMARKS: Record<string, Record<string, any>> = {
  'ecommerce': {
    name: 'E-commerce',
    metrics: {
      conversion_rate: { mean: 0.025, median: 0.02, q1: 0.015, q3: 0.035, min: 0.005, max: 0.08 },
      average_order_value: { mean: 85, median: 75, q1: 50, q3: 120, min: 20, max: 500 },
      bounce_rate: { mean: 0.45, median: 0.42, q1: 0.35, q3: 0.55, min: 0.2, max: 0.8 },
      cart_abandonment_rate: { mean: 0.72, median: 0.70, q1: 0.65, q3: 0.78, min: 0.5, max: 0.9 },
      customer_retention_rate: { mean: 0.35, median: 0.32, q1: 0.25, q3: 0.45, min: 0.1, max: 0.7 },
    },
  },
  'saas': {
    name: 'SaaS',
    metrics: {
      monthly_recurring_revenue: { mean: 50000, median: 20000, q1: 5000, q3: 100000, min: 1000, max: 1000000 },
      churn_rate: { mean: 0.05, median: 0.04, q1: 0.02, q3: 0.08, min: 0.01, max: 0.2 },
      customer_acquisition_cost: { mean: 200, median: 150, q1: 50, q3: 400, min: 10, max: 2000 },
      lifetime_value: { mean: 1200, median: 800, q1: 300, q3: 2000, min: 100, max: 10000 },
      gross_margin: { mean: 0.75, median: 0.78, q1: 0.70, q3: 0.85, min: 0.5, max: 0.95 },
    },
  },
  'finance': {
    name: 'Finance',
    metrics: {
      return_on_investment: { mean: 0.12, median: 0.10, q1: 0.05, q3: 0.18, min: -0.1, max: 0.5 },
      return_on_assets: { mean: 0.08, median: 0.07, q1: 0.03, q3: 0.12, min: -0.05, max: 0.3 },
      debt_to_equity: { mean: 1.2, median: 1.0, q1: 0.5, q3: 1.8, min: 0.1, max: 5 },
      current_ratio: { mean: 1.8, median: 1.6, q1: 1.2, q3: 2.2, min: 0.5, max: 5 },
      profit_margin: { mean: 0.08, median: 0.07, q1: 0.03, q3: 0.12, min: -0.1, max: 0.3 },
    },
  },
  'healthcare': {
    name: 'Healthcare',
    metrics: {
      patient_satisfaction: { mean: 4.2, median: 4.3, q1: 3.8, q3: 4.5, min: 1, max: 5 },
      readmission_rate: { mean: 0.15, median: 0.14, q1: 0.10, q3: 0.20, min: 0.05, max: 0.4 },
      average_length_of_stay: { mean: 5.5, median: 5.0, q1: 3.5, q3: 7.5, min: 1, max: 30 },
      bed_occupancy_rate: { mean: 0.75, median: 0.78, q1: 0.65, q3: 0.85, min: 0.4, max: 1 },
      patient_to_nurse_ratio: { mean: 5.5, median: 5.0, q1: 4.0, q3: 7.0, min: 2, max: 15 },
    },
  },
  'education': {
    name: 'Education',
    metrics: {
      graduation_rate: { mean: 0.75, median: 0.78, q1: 0.65, q3: 0.85, min: 0.4, max: 0.98 },
      student_retention_rate: { mean: 0.85, median: 0.88, q1: 0.75, q3: 0.92, min: 0.5, max: 0.99 },
      student_to_faculty_ratio: { mean: 15, median: 14, q1: 10, q3: 20, min: 5, max: 50 },
      average_gpa: { mean: 3.0, median: 3.1, q1: 2.7, q3: 3.3, min: 2.0, max: 4.0 },
      employment_rate: { mean: 0.85, median: 0.88, q1: 0.75, q3: 0.92, min: 0.5, max: 0.99 },
    },
  },
};

// ============================================================================
// Agent Metadata
// ============================================================================

const metadata = createAgentMetadata({
  // Identity
  id: 'benchmark',
  name: 'Benchmark',
  description: 'Compares data against industry benchmarks and best practices, providing performance metrics, gap analysis, and actionable recommendations.',
  version: '1.0.0',
  
  // Classification
  stage: 'detect' as AgentStage,
  stageNumber: 2,
  tier: 'specialized' as AgentTier,
  stability: 'stable' as AgentStability,
  
  // Author
  author: 'Busara Team',
  license: 'MIT',
  
  // Dependencies
  dependencies: ['data_ingestion', 'schema_inference', 'data_cleaner'],
  
  // Execution
  timeoutMs: 20000,
  maxRetries: 3,
  
  // Capabilities
  capabilities: [
    'benchmarking',
    'performance_metrics',
    'gap_analysis',
    'industry_comparison',
    'best_practices',
  ],
  category: 'analysis',
  tags: ['benchmark', 'performance', 'comparison', 'industry', 'metrics'],
  
  // Input/Output
  inputDescription: 'Cleaned dataframe with schema',
  outputDescription: 'Benchmark analysis with performance metrics and recommendations',
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
    description: 'Cleaned dataframe with schema',
  },
  outputSchema: {
    schema: z.object({
      industry: z.string(),
      metrics: z.array(z.object({
        name: z.string(),
        value: z.number(),
        unit: z.string().optional(),
        benchmark: z.object({
          mean: z.number(),
          median: z.number(),
          q1: z.number(),
          q3: z.number(),
          min: z.number(),
          max: z.number(),
        }),
        percentile: z.number(),
        zScore: z.number(),
        performance: z.enum(['poor', 'below_average', 'average', 'above_average', 'excellent']),
        gap: z.number(),
        gapPercentage: z.number(),
      })),
      summary: z.object({
        overallPerformance: z.enum(['poor', 'below_average', 'average', 'above_average', 'excellent']),
        averagePercentile: z.number(),
        metricsAboveAverage: z.number(),
        metricsBelowAverage: z.number(),
        totalMetrics: z.number(),
      }),
      recommendations: z.array(z.object({
        metric: z.string(),
        currentValue: z.number(),
        benchmarkValue: z.number(),
        gap: z.number(),
        priority: z.enum(['low', 'medium', 'high']),
        action: z.string(),
      })),
      bestPractices: z.array(z.string()),
    }),
    description: 'Benchmark analysis with performance metrics and recommendations',
  },
  configSchema: {
    schema: z.object({
      // Industry selection
      industry: z.enum(Object.keys(INDUSTRY_BENCHMARKS) as [string, ...string[]]).default('ecommerce'),
      
      // Metric mapping
      metricMappings: z.record(z.string(), z.string()).optional().default(undefined as any),
      
      // Benchmark settings
      benchmarkSettings: z.object({
        useCustomBenchmarks: z.boolean().default(false),
        customBenchmarks: z.record(z.string(), z.object({
          mean: z.number(),
          median: z.number(),
          q1: z.number(),
          q3: z.number(),
          min: z.number(),
          max: z.number(),
        })).optional().default(undefined as any),
      }).optional().default(undefined as any),
      
      // Analysis settings
      analysisSettings: z.object({
        includeGapAnalysis: z.boolean().default(true),
        includePerformanceRating: z.boolean().default(true),
        includeRecommendations: z.boolean().default(true),
        includeBestPractices: z.boolean().default(true),
        performanceThresholds: z.object({
          poor: z.number().min(0).max(100).default(20),
          below_average: z.number().min(0).max(100).default(40),
          average: z.number().min(0).max(100).default(60),
          above_average: z.number().min(0).max(100).default(80),
        }).optional().default(undefined as any),
      }).optional().default(undefined as any),
    }),
    defaults: {
      industry: 'ecommerce',
      metricMappings: {},
      benchmarkSettings: {
        useCustomBenchmarks: false,
      },
      analysisSettings: {
        includeGapAnalysis: true,
        includePerformanceRating: true,
        includeRecommendations: true,
        includeBestPractices: true,
        performanceThresholds: {
          poor: 20,
          below_average: 40,
          average: 60,
          above_average: 80,
        },
      },
    },
    description: 'Benchmark analysis configuration',
  },
  
  // Technical requirements
  memoryLimitMB: 512,
  cpuLimit: 2,
  gpuRequired: false,
  
  // UI
  icon: 'BarChart3',
  color: '#10b981',
});

// ============================================================================
// Agent Implementation
// ============================================================================

/**
 * BenchmarkAgent compares data against industry benchmarks.
 */
export class BenchmarkAgent extends BaseAgent {
  readonly metadata: EnhancedAgentMetadata = metadata;
  
  async execute(context: EnhancedAgentContext): Promise<AgentResult> {
    const start = Date.now();
    const { dataframe, config, previousResults } = context;
    
    try {
      // Validate input
      if (!dataframe || !Array.isArray(dataframe) || dataframe.length === 0) {
        return this.createError('No data provided for benchmarking', Date.now() - start);
      }
      
      // Get schema from previous results
      const schemaResult = previousResults.get('schema_inference');
      const schema = (schemaResult?.output as any)?.schema ?? {};
      
      // Get configuration
      const industry = config.industry ?? 'ecommerce';
      const metricMappings = config.metricMappings ?? {};
      const benchmarkSettings = config.benchmarkSettings ?? {};
      const analysisSettings = config.analysisSettings ?? {};
      
      // Get industry benchmarks
      const industryBenchmarks = benchmarkSettings.useCustomBenchmarks
        ? benchmarkSettings.customBenchmarks
        : INDUSTRY_BENCHMARKS[industry];
      
      if (!industryBenchmarks) {
        return this.createError(`No benchmarks found for industry: ${industry}`, Date.now() - start);
      }
      
      // Extract numeric columns
      const numericColumns = Object.entries(schema as Record<string, any>)
        .filter(([_, colSchema]: [string, any]) => colSchema.type === 'integer' || colSchema.type === 'float')
        .map(([col]) => col);
      
      if (numericColumns.length === 0) {
        return this.createError('No numeric columns found for benchmarking', Date.now() - start);
      }
      
      // Calculate metrics from data
      const calculatedMetrics: Record<string, number> = {};
      
      for (const col of numericColumns) {
        const values = this.extractNumericColumn(dataframe, col);
        if (values.length > 0) {
          calculatedMetrics[col] = mean(values);
        }
      }
      
      // Map calculated metrics to benchmark metrics
      const metrics: any[] = [];
      const performanceThresholds = analysisSettings.performanceThresholds ?? {
        poor: 20,
        below_average: 40,
        average: 60,
        above_average: 80,
      };
      
      for (const [benchmarkMetric, benchmarkData] of Object.entries(industryBenchmarks.metrics as Record<string, any>)) {
        // Find matching column
        let dataColumn = metricMappings[benchmarkMetric];
        
        if (!dataColumn) {
          // Try to find a matching column by name
          const matchingColumn = numericColumns.find(col => 
            col.toLowerCase().includes(benchmarkMetric.toLowerCase()) ||
            benchmarkMetric.toLowerCase().includes(col.toLowerCase()));
          dataColumn = matchingColumn;
        }
        
        if (dataColumn && calculatedMetrics[dataColumn] !== undefined) {
          const value = calculatedMetrics[dataColumn];
          
          // Calculate percentile
          const percentile = this.calculatePercentile(value, benchmarkData);
          
          // Calculate z-score
          const zScore = (value - benchmarkData.mean) / (benchmarkData.max - benchmarkData.min);
          
          // Determine performance
          let performance: 'poor' | 'below_average' | 'average' | 'above_average' | 'excellent';
          if (percentile < performanceThresholds.poor) {
            performance = 'poor';
          } else if (percentile < performanceThresholds.below_average) {
            performance = 'below_average';
          } else if (percentile < performanceThresholds.above_average) {
            performance = 'average';
          } else if (percentile < (performanceThresholds.excellent ?? 100)) {
            performance = 'above_average';
          } else {
            performance = 'excellent';
          }
          
          // Calculate gap
          const gap = value - benchmarkData.mean;
          const gapPercentage = benchmarkData.mean !== 0 ? (gap / Math.abs(benchmarkData.mean)) * 100 : 0;
          
          metrics.push({
            name: benchmarkMetric,
            value,
            unit: this.getUnit(benchmarkMetric),
            benchmark: benchmarkData,
            percentile,
            zScore,
            performance,
            gap,
            gapPercentage,
          });
        }
      }
      
      // Calculate summary
      const totalMetrics = metrics.length;
      const metricsAboveAverage = metrics.filter(m => m.performance === 'above_average' || m.performance === 'excellent').length;
      const metricsBelowAverage = metrics.filter(m => m.performance === 'poor' || m.performance === 'below_average').length;
      const averagePercentile = metrics.reduce((sum, m) => sum + m.percentile, 0) / totalMetrics;
      
      // Determine overall performance
      let overallPerformance: 'poor' | 'below_average' | 'average' | 'above_average' | 'excellent';
      if (averagePercentile < performanceThresholds.poor) {
        overallPerformance = 'poor';
      } else if (averagePercentile < performanceThresholds.below_average) {
        overallPerformance = 'below_average';
      } else if (averagePercentile < performanceThresholds.above_average) {
        overallPerformance = 'average';
      } else if (averagePercentile < (performanceThresholds.excellent ?? 100)) {
        overallPerformance = 'above_average';
      } else {
        overallPerformance = 'excellent';
      }
      
      // Generate recommendations
      const recommendations = analysisSettings.includeRecommendations
        ? this.generateRecommendations(metrics, performanceThresholds)
        : [];
      
      // Generate best practices
      const bestPractices = analysisSettings.includeBestPractices
        ? this.getBestPractices(industry)
        : [];
      
      const summary = {
        industry: industryBenchmarks.name,
        overallPerformance,
        averagePercentile,
        metricsAboveAverage,
        metricsBelowAverage,
        totalMetrics,
      };
      
      const output = {
        industry: industryBenchmarks.name,
        metrics,
        summary,
        recommendations,
        bestPractices,
      };
      
      const executionTimeMs = Date.now() - start;
      
      return this.createResult(output, {
        industry: industryBenchmarks.name as any,
        metricsAnalyzed: totalMetrics,
        averagePercentile,
        overallPerformance: overallPerformance as any,
      }, executionTimeMs);
      
    } catch (error) {
      const executionTimeMs = Date.now() - start;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return this.createError(errorMessage, executionTimeMs);
    }
  }
  
  /**
   * Calculate percentile for a value
   */
  private calculatePercentile(value: number, benchmark: any): number {
    if (value <= benchmark.min) return 0;
    if (value >= benchmark.max) return 100;
    
    // Linear interpolation between min and max
    const range = benchmark.max - benchmark.min;
    const distanceFromMin = value - benchmark.min;
    
    return (distanceFromMin / range) * 100;
  }
  
  /**
   * Get unit for a metric
   */
  private getUnit(metric: string): string | undefined {
    const units: Record<string, string> = {
      conversion_rate: '%',
      average_order_value: 'USD',
      bounce_rate: '%',
      cart_abandonment_rate: '%',
      customer_retention_rate: '%',
      monthly_recurring_revenue: 'USD',
      churn_rate: '%',
      customer_acquisition_cost: 'USD',
      lifetime_value: 'USD',
      gross_margin: '%',
      return_on_investment: '%',
      return_on_assets: '%',
      debt_to_equity: 'ratio',
      current_ratio: 'ratio',
      profit_margin: '%',
      patient_satisfaction: 'stars',
      readmission_rate: '%',
      average_length_of_stay: 'days',
      bed_occupancy_rate: '%',
      patient_to_nurse_ratio: 'ratio',
      graduation_rate: '%',
      student_retention_rate: '%',
      student_to_faculty_ratio: 'ratio',
      average_gpa: 'GPA',
      employment_rate: '%',
    };
    
    return units[metric.toLowerCase()];
  }
  
  /**
   * Generate recommendations
   */
  private generateRecommendations(
    metrics: any[],
    thresholds: any
  ): any[] {
    const recommendations: any[] = [];
    
    for (const metric of metrics) {
      if (metric.performance === 'poor' || metric.performance === 'below_average') {
        let priority: 'low' | 'medium' | 'high' = 'medium';
        if (metric.percentile < thresholds.poor) {
          priority = 'high';
        }
        
        let action = '';
        if (metric.gap < 0) {
          action = `Increase ${metric.name} from ${metric.value.toFixed(2)} to at least ${metric.benchmark.mean.toFixed(2)}`;
        } else {
          action = `Decrease ${metric.name} from ${metric.value.toFixed(2)} to at most ${metric.benchmark.mean.toFixed(2)}`;
        }
        
        recommendations.push({
          metric: metric.name,
          currentValue: metric.value,
          benchmarkValue: metric.benchmark.mean,
          gap: metric.gap,
          priority,
          action,
        });
      }
    }
    
    // Sort by priority and gap
    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      const aPriority = priorityOrder[a.priority];
      const bPriority = priorityOrder[b.priority];
      
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }
      
      return Math.abs(b.gap) - Math.abs(a.gap);
    });
  }
  
  /**
   * Get best practices for an industry
   */
  private getBestPractices(industry: string): string[] {
    const bestPractices: Record<string, string[]> = {
      'ecommerce': [
        'Optimize product pages with high-quality images and detailed descriptions',
        'Implement a seamless checkout process with minimal steps',
        'Use retargeting ads to recover abandoned carts',
        'Offer multiple payment options to reduce friction',
        'Provide excellent customer service to improve retention',
        'Use data analytics to personalize the shopping experience',
        'Optimize for mobile devices as mobile traffic continues to grow',
        'Implement SEO best practices to improve organic search rankings',
      ],
      'saas': [
        'Focus on customer success to improve retention',
        'Implement a freemium model to attract users',
        'Use inbound marketing to generate high-quality leads',
        'Offer multiple pricing tiers to cater to different customer segments',
        'Provide excellent onboarding to ensure users get value quickly',
        'Invest in product analytics to understand user behavior',
        'Build integrations with popular tools to increase adoption',
        'Focus on scalability to handle growth efficiently',
      ],
      'finance': [
        'Maintain a diversified investment portfolio',
        'Implement strong risk management practices',
        'Use data analytics for predictive modeling',
        'Automate processes to reduce operational costs',
        'Ensure compliance with all regulatory requirements',
        'Invest in cybersecurity to protect sensitive data',
        'Use scenario analysis for strategic planning',
        'Implement robust internal controls',
      ],
      'healthcare': [
        'Focus on patient-centered care',
        'Implement electronic health records for better data management',
        'Use telemedicine to expand access to care',
        'Invest in preventive care to reduce long-term costs',
        'Implement quality improvement initiatives',
        'Use data analytics to identify at-risk patients',
        'Ensure compliance with HIPAA and other regulations',
        'Invest in staff training and development',
      ],
      'education': [
        'Focus on student success and outcomes',
        'Use data analytics to identify at-risk students',
        'Implement personalized learning approaches',
        'Invest in technology to enhance the learning experience',
        'Build strong relationships with employers for job placement',
        'Offer flexible learning options to accommodate different needs',
        'Implement quality assurance processes for continuous improvement',
        'Invest in faculty development and support',
      ],
    };
    
    return bestPractices[industry] ?? [
      'Identify and focus on key performance indicators',
      'Use data-driven decision making',
      'Invest in technology and automation',
      'Focus on customer satisfaction',
      'Implement continuous improvement processes',
    ];
  }
}

// ============================================================================
// Exports
// ============================================================================

export { metadata as benchmarkAgentMetadata };
export default BenchmarkAgent;
