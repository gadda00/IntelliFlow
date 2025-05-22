// Mock API client for GitHub Pages deployment
// This replaces the real API with mock data when deployed to GitHub Pages

import { AnalysisType, DataSource } from './api';

// Sample data
const mockDataSources: DataSource[] = [
  {
    id: 'csv_data',
    name: 'CSV Data',
    description: 'Upload and analyze CSV files',
    parameters: ['file_path', 'delimiter']
  },
  {
    id: 'google_sheets',
    name: 'Google Sheets',
    description: 'Connect to and analyze Google Sheets data',
    parameters: ['sheet_id', 'range']
  },
  {
    id: 'database',
    name: 'Database Connection',
    description: 'Connect to SQL databases for analysis',
    parameters: ['connection_string', 'query']
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
    id: 'descriptive',
    name: 'Descriptive Analysis',
    description: 'Statistical summary of data including mean, median, mode, etc.',
    default_objectives: ['Identify central tendencies', 'Measure data dispersion', 'Detect outliers']
  },
  {
    id: 'correlation',
    name: 'Correlation Analysis',
    description: 'Identify relationships between variables in the dataset',
    default_objectives: ['Calculate correlation coefficients', 'Generate correlation matrix', 'Visualize relationships']
  },
  {
    id: 'trend',
    name: 'Trend Analysis',
    description: 'Identify patterns and trends over time',
    default_objectives: ['Detect seasonality', 'Identify long-term trends', 'Forecast future values']
  },
  {
    id: 'clustering',
    name: 'Clustering Analysis',
    description: 'Group similar data points together',
    default_objectives: ['Identify natural groupings', 'Segment customer base', 'Detect anomalies']
  }
];

const mockAnalysisHistory = [
  {
    id: 'analysis-001',
    name: 'Customer Segmentation',
    type: 'clustering',
    data_source: 'csv_data',
    created_at: '2025-05-15T10:30:00Z',
    status: 'completed'
  },
  {
    id: 'analysis-002',
    name: 'Sales Trend Analysis',
    type: 'trend',
    data_source: 'google_sheets',
    created_at: '2025-05-18T14:45:00Z',
    status: 'completed'
  },
  {
    id: 'analysis-003',
    name: 'Product Correlation Study',
    type: 'correlation',
    data_source: 'database',
    created_at: '2025-05-20T09:15:00Z',
    status: 'completed'
  }
];

// Mock analysis results
const mockResults = {
  'analysis-001': {
    clusters: [
      { name: 'High Value', count: 342, avg_purchase: '$120.45', loyalty: 'High' },
      { name: 'Regular', count: 1205, avg_purchase: '$45.30', loyalty: 'Medium' },
      { name: 'Occasional', count: 2103, avg_purchase: '$22.15', loyalty: 'Low' }
    ],
    visualizations: [
      { type: 'scatter', title: 'Customer Segments' },
      { type: 'pie', title: 'Segment Distribution' }
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

// Delay function to simulate API latency
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Mock API client
export const mockApiClient = {
  // Health check
  healthCheck: async () => {
    await delay(500);
    return { status: 'success', message: 'API is healthy' };
  },
  
  // Start a new analysis
  startAnalysis: async (_analysisConfig: any) => {
    await delay(1500);
    const analysisId = `analysis-${Math.floor(Math.random() * 1000)}`;
    return { 
      status: 'success', 
      message: 'Analysis started successfully', 
      analysis_id: analysisId 
    };
  },
  
  // Get analysis status and results
  getAnalysis: async (analysisId: string) => {
    await delay(800);
    
    // For demo purposes, return one of the mock results
    const mockResultId = Object.keys(mockResults)[Math.floor(Math.random() * Object.keys(mockResults).length)];
    const mockResult = mockResults[mockResultId as keyof typeof mockResults];
    
    return { 
      status: 'success', 
      analysis: {
        id: analysisId,
        status: 'completed',
        result: mockResult
      }
    };
  },
  
  // Get analysis history
  getAnalysisHistory: async () => {
    await delay(700);
    return { 
      status: 'success', 
      history: mockAnalysisHistory 
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

// Custom hook for analysis status polling with mock data
export const useMockAnalysisStatus = (_analysisId: string | null) => {
  // Implementation would be similar to the real hook but using mock data
  // For brevity, we're not implementing the full hook logic here
  
  return {
    status: 'completed',
    result: mockResults[Object.keys(mockResults)[0] as keyof typeof mockResults],
    error: null
  };
};
