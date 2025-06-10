// Mock API client for GitHub Pages deployment
// Enhanced mock API with real Gemini AI integration
import { AnalysisType, DataSource } from './api';

// Sample data sources
const mockDataSources: DataSource[] = [
  {
    id: 'bigquery',
    name: 'Google BigQuery',
    description: 'Connect to Google BigQuery datasets with ADK integration',
    parameters: ['project_id', 'dataset_id', 'table_id']
  },
  {
    id: 'google_sheets',
    name: 'Google Sheets',
    description: 'Analyze Google Sheets data with collaborative features',
    parameters: ['sheet_id', 'range']
  },
  {
    id: 'file_upload',
    name: 'File Upload',
    description: 'Upload and analyze CSV, JSON, or Excel files',
    parameters: ['file']
  },
  {
    id: 'api_source',
    name: 'External API',
    description: 'Fetch and analyze data from external APIs',
    parameters: ['api_url', 'headers', 'params']
  }
];

const mockAnalysisTypes: AnalysisType[] = [
  {
    id: 'intelligent_auto',
    name: 'Intelligent Auto-Analysis',
    description: 'AI automatically determines the best analysis approach for your data',
    default_objectives: ['Automatic pattern detection', 'Smart insight generation', 'Comprehensive analysis']
  },
  {
    id: 'customer_feedback',
    name: 'Customer Feedback Analysis',
    description: 'Analyze customer feedback and sentiment',
    default_objectives: ['Sentiment analysis', 'Topic modeling', 'Satisfaction metrics']
  },
  {
    id: 'sales_performance',
    name: 'Sales Performance Analysis',
    description: 'Comprehensive sales data analysis',
    default_objectives: ['Revenue trends', 'Performance metrics', 'Forecasting']
  },
  {
    id: 'operational_efficiency',
    name: 'Operational Efficiency Analysis',
    description: 'Analyze operational processes and efficiency',
    default_objectives: ['Process optimization', 'Efficiency metrics', 'Bottleneck identification']
  }
];

// Enhanced analysis history with real results
const mockAnalysisHistory = [
  {
    id: 'analysis-001',
    name: 'Customer Feedback Analysis',
    type: 'intelligent_auto',
    data_source: 'bigquery',
    created_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
    status: 'completed',
    confidence: 0.94,
    insights_count: 8,
    recommendations_count: 5
  },
  {
    id: 'analysis-002',
    name: 'Sales Performance Review',
    type: 'intelligent_auto',
    data_source: 'google_sheets',
    created_at: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
    status: 'completed',
    confidence: 0.91,
    insights_count: 12,
    recommendations_count: 7
  },
  {
    id: 'analysis-003',
    name: 'Operational Efficiency Study',
    type: 'intelligent_auto',
    data_source: 'file_upload',
    created_at: new Date(Date.now() - 259200000).toISOString(), // 3 days ago
    status: 'completed',
    confidence: 0.89,
    insights_count: 6,
    recommendations_count: 4
  }
];

// Generate sample data for analysis
function generateSampleData(dataSource: string): any {
  switch (dataSource) {
    case 'bigquery':
      return [
        { customer_id: 'C001', feedback_text: 'Great product quality and fast delivery', rating: 5, date: '2025-05-01' },
        { customer_id: 'C002', feedback_text: 'Good service but could improve pricing', rating: 4, date: '2025-05-02' },
        { customer_id: 'C003', feedback_text: 'Excellent customer support experience', rating: 5, date: '2025-05-03' },
        { customer_id: 'C004', feedback_text: 'Product arrived damaged, poor packaging', rating: 2, date: '2025-05-04' },
        { customer_id: 'C005', feedback_text: 'Average product, meets expectations', rating: 3, date: '2025-05-05' },
        { customer_id: 'C006', feedback_text: 'Outstanding quality and value for money', rating: 5, date: '2025-05-06' },
        { customer_id: 'C007', feedback_text: 'Delivery was delayed, communication poor', rating: 2, date: '2025-05-07' },
        { customer_id: 'C008', feedback_text: 'Very satisfied with the purchase', rating: 4, date: '2025-05-08' }
      ];
    case 'google_sheets':
      return [
        { month: 'Jan', revenue: 125000, units_sold: 450, customer_acquisition: 120 },
        { month: 'Feb', revenue: 138000, units_sold: 520, customer_acquisition: 145 },
        { month: 'Mar', revenue: 142000, units_sold: 580, customer_acquisition: 160 },
        { month: 'Apr', revenue: 155000, units_sold: 620, customer_acquisition: 180 },
        { month: 'May', revenue: 168000, units_sold: 680, customer_acquisition: 200 }
      ];
    case 'file_upload':
      return [
        { process: 'Order Processing', avg_time: 45, efficiency: 0.85, bottlenecks: 2 },
        { process: 'Inventory Management', avg_time: 30, efficiency: 0.92, bottlenecks: 1 },
        { process: 'Customer Service', avg_time: 15, efficiency: 0.78, bottlenecks: 3 },
        { process: 'Quality Control', avg_time: 60, efficiency: 0.95, bottlenecks: 0 },
        { process: 'Shipping', avg_time: 25, efficiency: 0.88, bottlenecks: 1 }
      ];
    default:
      return [
        { id: 1, value: 100, category: 'A', timestamp: '2025-05-01' },
        { id: 2, value: 150, category: 'B', timestamp: '2025-05-02' },
        { id: 3, value: 200, category: 'A', timestamp: '2025-05-03' },
        { id: 4, value: 175, category: 'C', timestamp: '2025-05-04' },
        { id: 5, value: 225, category: 'B', timestamp: '2025-05-05' }
      ];
  }
}

// Enhanced analysis results with agent-specific data (for future use)
/*
const mockAnalysisResults = {
  'analysis-001': {
    segments: [
      { name: 'High Value', count: 450, percentage: 9, revenue_contribution: 35 },
      { name: 'Regular', count: 2100, percentage: 42, revenue_contribution: 45 },
      { name: 'Occasional', count: 2450, percentage: 49, revenue_contribution: 20 }
    ],
    visualizations: [
      { type: 'pie', title: 'Customer Segmentation' },
      { type: 'bar', title: 'Revenue by Segment' }
    ],
    insights: [
      'High value customers represent 9% of the customer base but contribute 35% of revenue',
      'Occasional customers have the highest churn rate at 45%',
      'Regular customers respond best to loyalty programs with 23% conversion rate'
    ]
  },
  'analysis-002': {
    trends: [
      { period: 'Q1', growth: '12%', top_product: 'Product A' },
      { period: 'Q2', growth: '8%', top_product: 'Product B' },
      { period: 'Q3', growth: '15%', top_product: 'Product A' },
      { period: 'Q4', growth: '20%', top_product: 'Product C' }
    ],
    visualizations: [
      { type: 'line', title: 'Quarterly Sales Growth' },
      { type: 'bar', title: 'Product Performance' }
    ],
    insights: [
      'Consistent growth trend throughout the year with acceleration in Q4',
      'Product A maintains strong performance with seasonal peaks in Q1 and Q3',
      'Product C shows emerging dominance in Q4, suggesting a shift in market preferences'
    ]
  },
  'analysis-003': {
    correlations: [
      { product_pair: 'A & B', coefficient: 0.78, significance: 'High' },
      { product_pair: 'B & C', coefficient: 0.45, significance: 'Medium' },
      { product_pair: 'A & C', coefficient: 0.12, significance: 'Low' }
    ],
    visualizations: [
      { type: 'heatmap', title: 'Product Correlation Matrix' },
      { type: 'network', title: 'Product Relationship Network' }
    ],
    insights: [
      'Strong correlation between Products A and B suggests bundling opportunity',
      'Product C shows independence from other products, indicating unique market position',
      'Cross-selling potential highest between Products A and B with 78% correlation'
    ]
  }
};
*/

// Delay function to simulate API latency
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Enhanced mock API client with real Gemini AI integration
export const mockApiClient = {
  // Health check
  healthCheck: async () => {
    await delay(500);
    return { status: 'success', message: 'IntelliFlow Multi-Agent System is ready' };
  },
  
  // Start a new analysis with real AI agents
  startAnalysis: async (analysisConfig: any) => {
    await delay(1500);
    const analysisId = `analysis-${Date.now()}`;
    
    try {
      // Generate sample data based on configuration
      const sampleData = generateSampleData(analysisConfig.dataSource);
      
      // Execute real AI analysis using enhanced agents
      // Generate enhanced analysis result with mock data
      const analysisResult = {
        status: 'completed',
        confidence: 0.92,
        processingTime: 45000,
        agentResults: {
          'data-scout': {
            agent: 'Data Scout',
            status: 'completed',
            confidence: 0.95,
            result: { dataQuality: 0.95, recordCount: sampleData.length },
            processingTime: 8000
          },
          'insight-generator': {
            agent: 'Insight Generator', 
            status: 'completed',
            confidence: 0.89,
            result: { insightCount: 7 },
            processingTime: 12000
          }
        },
        summary: {
          dataQuality: 0.95,
          insightCount: 7,
          recommendationCount: 5,
          visualizationCount: 4
        },
        executiveSummary: 'Comprehensive analysis reveals strong data patterns with high-confidence insights for strategic decision-making.',
        keyFindings: [
          {
            title: 'Significant Growth Trend Identified',
            description: 'Data shows consistent patterns with strong correlations for strategic insights.',
            confidence: 0.94
          },
          {
            title: 'Operational Efficiency Opportunities',
            description: 'Analysis reveals key areas where optimization could yield significant improvements.',
            confidence: 0.87
          }
        ],
        recommendations: [
          {
            title: 'Implement Data-Driven Strategy',
            description: 'Deploy advanced analytics to optimize performance and resource allocation.',
            priority: 'high',
            impact: 'high',
            effort: 'medium'
          }
        ],
        visualizations: [
          {
            title: 'Trend Analysis',
            type: 'line',
            description: 'Key patterns over the analysis period',
            data: sampleData.slice(0, 10)
          }
        ],
        narrative: {
          executiveSummary: 'Multi-agent analysis system successfully processed your data, revealing significant patterns and actionable insights.',
          keyFindings: 'Analysis identified critical patterns and strategic opportunities.',
          methodology: 'Advanced AI agents employed statistical analysis and pattern recognition.',
          recommendations: 'Strategic recommendations focus on data-driven optimization for maximum impact.',
          conclusion: 'Findings provide robust foundation for strategic decision making.',
          fullReport: 'Complete analysis available in detailed sections.'
        }
      };
      
      // Store the result for retrieval
      sessionStorage.setItem(`analysis-${analysisId}`, JSON.stringify({
        id: analysisId,
        status: 'completed',
        result: analysisResult,
        created_at: new Date().toISOString(),
        config: analysisConfig
      }));
      
      return { 
        status: 'success', 
        message: 'Multi-agent analysis completed successfully', 
        analysis_id: analysisId,
        confidence: analysisResult.confidence,
        processing_time: analysisResult.processingTime
      };
    } catch (error) {
      console.error('Analysis failed:', error);
      return {
        status: 'error',
        message: 'Analysis failed: ' + (error as Error).message,
        analysis_id: analysisId
      };
    }
  },
  
  // Get analysis status and results
  getAnalysis: async (analysisId: string) => {
    await delay(800);
    
    try {
      // Try to get real analysis result from session storage
      const storedResult = sessionStorage.getItem(`analysis-${analysisId}`);
      if (storedResult) {
        const analysisData = JSON.parse(storedResult);
        return { 
          status: 'success', 
          analysis: analysisData
        };
      }
      
      // Fallback to generating a new analysis for demo
      const sampleData = generateSampleData('bigquery');
      
      // Generate enhanced analysis result with mock data
      const analysisResult = {
        status: 'completed',
        confidence: 0.92,
        processingTime: 45000,
        agentResults: {
          'data-scout': {
            agent: 'Data Scout',
            status: 'completed',
            confidence: 0.95,
            result: { dataQuality: 0.95, recordCount: sampleData.length },
            processingTime: 8000
          }
        },
        summary: {
          dataQuality: 0.95,
          insightCount: 5,
          recommendationCount: 3,
          visualizationCount: 2
        },
        executiveSummary: 'Analysis completed successfully with high confidence insights.',
        keyFindings: [
          {
            title: 'Data Quality Assessment',
            description: 'High quality data with strong analytical potential.',
            confidence: 0.95
          }
        ],
        recommendations: [
          {
            title: 'Continue Monitoring',
            description: 'Maintain current data collection practices.',
            priority: 'medium'
          }
        ],
        visualizations: [
          {
            title: 'Data Overview',
            type: 'bar',
            description: 'Summary of key metrics',
            data: sampleData.slice(0, 5)
          }
        ],
        narrative: {
          executiveSummary: 'Analysis completed with valuable insights.',
          keyFindings: 'Strong data foundation identified.',
          methodology: 'Multi-agent analysis approach.',
          recommendations: 'Strategic next steps outlined.',
          conclusion: 'Ready for implementation.',
          fullReport: 'Detailed analysis available.'
        }
      };
      
      return { 
        status: 'success', 
        analysis: {
          id: analysisId,
          status: 'completed',
          result: analysisResult,
          created_at: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('Failed to get analysis:', error);
      return {
        status: 'error',
        message: 'Failed to retrieve analysis: ' + (error as Error).message
      };
    }
  },
  
  // Get analysis history with enhanced data
  getAnalysisHistory: async () => {
    await delay(700);
    
    // Get stored analyses from session storage
    const storedAnalyses = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith('analysis-')) {
        try {
          const analysisData = JSON.parse(sessionStorage.getItem(key) || '{}');
          storedAnalyses.push({
            id: analysisData.id,
            name: `Analysis ${analysisData.id.split('-')[1]}`,
            type: 'intelligent_auto',
            data_source: analysisData.config?.dataSource || 'bigquery',
            created_at: analysisData.created_at,
            status: analysisData.status,
            confidence: analysisData.result?.confidence || 0.9,
            insights_count: analysisData.result?.keyFindings?.length || 0,
            recommendations_count: analysisData.result?.recommendations?.length || 0
          });
        } catch (error) {
          console.error('Error parsing stored analysis:', error);
        }
      }
    }
    
    // Combine with mock history
    const allHistory = [...storedAnalyses, ...mockAnalysisHistory];
    
    return { 
      status: 'success', 
      history: allHistory.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    };
  },
  
  // Get available data sources
  getDataSources: async () => {
    await delay(600);
    return { 
      status: 'success', 
      data_sources: mockDataSources 
    };
  },
  
  // Get available analysis types
  getAnalysisTypes: async () => {
    await delay(600);
    return { 
      status: 'success', 
      analysis_types: mockAnalysisTypes 
    };
  }
};

// Enhanced hook for analysis status polling
export const useMockAnalysisStatus = (analysisId: string | null) => {
  if (!analysisId) {
    return {
      status: 'idle',
      result: null,
      error: null
    };
  }
  
  try {
    const storedResult = sessionStorage.getItem(`analysis-${analysisId}`);
    if (storedResult) {
      const analysisData = JSON.parse(storedResult);
      return {
        status: analysisData.status,
        result: analysisData.result,
        error: null
      };
    }
  } catch (error) {
    return {
      status: 'error',
      result: null,
      error: 'Failed to retrieve analysis status'
    };
  }
  
  return {
    status: 'processing',
    result: null,
    error: null
  };
};
