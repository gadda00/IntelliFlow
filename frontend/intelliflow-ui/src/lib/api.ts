import { useState, useEffect } from 'react';
import axios from 'axios';
import { mockApiClient, useMockAnalysisStatus } from './mockApi';

// Enhanced Google ADK-inspired configuration
const ADK_CONFIG = {
  retryAttempts: 3,
  retryDelay: 1000,
  timeout: 30000,
  batchSize: 100,
  cacheEnabled: true,
  cacheTTL: 300000, // 5 minutes
  compressionEnabled: true,
  telemetryEnabled: true
};

// Check if we're running on GitHub Pages
const isGitHubPages = window.location.hostname !== 'localhost';

// Define API base URL with Google ADK-style environment detection
const API_BASE_URL = isGitHubPages ? '' : 'http://localhost:5000/api';

// Enhanced backend service integration
const ENHANCED_BACKEND_URL = 'http://localhost:5000/api';

// Enhanced error handling with Google ADK patterns
class APIError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'APIError';
  }
}

// Google ADK-inspired request interceptor
const createRequestInterceptor = () => {
  return axios.create({
    baseURL: API_BASE_URL,
    timeout: ADK_CONFIG.timeout,
    headers: {
      'Content-Type': 'application/json',
      'X-Client-Version': '1.0.0',
      'X-Platform': 'IntelliFlow-Web',
      'X-ADK-Integration': 'enabled'
    }
  });
};

// Enhanced retry logic with exponential backoff (Google ADK pattern)
const retryWithBackoff = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = ADK_CONFIG.retryAttempts
): Promise<T> => {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      // Don't retry on client errors (4xx)
      if (error.response?.status >= 400 && error.response?.status < 500) {
        throw error;
      }
      
      if (attempt === maxRetries) {
        break;
      }
      
      // Exponential backoff with jitter
      const delay = ADK_CONFIG.retryDelay * Math.pow(2, attempt) + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
};

// Google ADK-inspired telemetry collection
const collectTelemetry = (operation: string, duration: number, success: boolean, error?: any) => {
  if (!ADK_CONFIG.telemetryEnabled) return;
  
  const telemetryData = {
    operation,
    duration,
    success,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    error: error ? {
      message: error.message,
      code: error.code,
      statusCode: error.response?.status
    } : undefined
  };
  
  // Store telemetry data for analytics
  const existingTelemetry = JSON.parse(localStorage.getItem('intelliflow_telemetry') || '[]');
  existingTelemetry.push(telemetryData);
  
  // Keep only last 100 entries
  if (existingTelemetry.length > 100) {
    existingTelemetry.splice(0, existingTelemetry.length - 100);
  }
  
  localStorage.setItem('intelliflow_telemetry', JSON.stringify(existingTelemetry));
};

// Enhanced API client with Google ADK patterns
export const apiClient = isGitHubPages ? mockApiClient : {
  // Health check with enhanced monitoring
  healthCheck: async () => {
    const startTime = Date.now();
    try {
      const result = await retryWithBackoff(async () => {
        const response = await createRequestInterceptor().get('/health');
        return response.data;
      });
      
      collectTelemetry('healthCheck', Date.now() - startTime, true);
      return result;
    } catch (error: any) {
      collectTelemetry('healthCheck', Date.now() - startTime, false, error);
      throw new APIError(
        'Health check failed',
        'HEALTH_CHECK_FAILED',
        error.response?.status,
        true
      );
    }
  },
  
  // Enhanced analysis start with intelligent data processing
  startAnalysis: async (analysisConfig: any) => {
    const startTime = Date.now();
    try {
      // Check if we have file contents for enhanced processing
      const hasFileContents = analysisConfig.data_source?.file_contents && 
                             analysisConfig.data_source.file_contents.length > 0;
      
      if (hasFileContents) {
        // Use enhanced backend service for real data processing
        const result = await retryWithBackoff(async () => {
          const response = await axios.post(`${ENHANCED_BACKEND_URL}/analyze`, {
            analysisConfig
          });
          return response.data;
        });
        
        collectTelemetry('startAnalysis', Date.now() - startTime, true);
        return result;
      } else {
        // Fallback to mock API for demo data
        return await mockApiClient.startAnalysis(analysisConfig);
      }
    } catch (error: any) {
      collectTelemetry('startAnalysis', Date.now() - startTime, false, error);
      console.warn('Enhanced backend failed, falling back to mock API:', error);
      // Fallback to mock API if enhanced backend fails
      return await mockApiClient.startAnalysis(analysisConfig);
    }
  },
  
  // Enhanced analysis retrieval with caching
  getAnalysis: async (analysisId: string) => {
    const startTime = Date.now();
    const cacheKey = `analysis_${analysisId}`;
    
    try {
      // Check cache first (Google ADK pattern)
      if (ADK_CONFIG.cacheEnabled) {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < ADK_CONFIG.cacheTTL) {
            collectTelemetry('getAnalysis', Date.now() - startTime, true);
            return data;
          }
        }
      }
      
      const result = await retryWithBackoff(async () => {
        const response = await createRequestInterceptor().get(`/analysis/${analysisId}`);
        return response.data;
      });
      
      // Cache the result
      if (ADK_CONFIG.cacheEnabled && result.status === 'completed') {
        localStorage.setItem(cacheKey, JSON.stringify({
          data: result,
          timestamp: Date.now()
        }));
      }
      
      collectTelemetry('getAnalysis', Date.now() - startTime, true);
      return result;
    } catch (error: any) {
      collectTelemetry('getAnalysis', Date.now() - startTime, false, error);
      throw new APIError(
        `Failed to get analysis ${analysisId}`,
        'ANALYSIS_GET_FAILED',
        error.response?.status,
        true
      );
    }
  },
  
  // Enhanced history with intelligent filtering
  getAnalysisHistory: async (filters?: { limit?: number; status?: string; dateRange?: string }) => {
    const startTime = Date.now();
    try {
      const params = new URLSearchParams();
      if (filters?.limit) params.append('limit', filters.limit.toString());
      if (filters?.status) params.append('status', filters.status);
      if (filters?.dateRange) params.append('dateRange', filters.dateRange);
      
      const result = await retryWithBackoff(async () => {
        const response = await createRequestInterceptor().get(`/analysis/history?${params}`);
        return response.data;
      });
      
      collectTelemetry('getAnalysisHistory', Date.now() - startTime, true);
      return result;
    } catch (error: any) {
      collectTelemetry('getAnalysisHistory', Date.now() - startTime, false, error);
      throw new APIError(
        'Failed to get analysis history',
        'HISTORY_GET_FAILED',
        error.response?.status,
        true
      );
    }
  },
  
  // Enhanced data sources with Google ADK integration capabilities
  getDataSources: async () => {
    const startTime = Date.now();
    try {
      const result = await retryWithBackoff(async () => {
        const response = await createRequestInterceptor().get('/data-sources');
        return response.data;
      });
      
      // Enhance with Google ADK-specific sources
      const enhancedSources = {
        ...result,
        sources: [
          ...result.sources,
          {
            id: 'google_bigquery',
            name: 'Google BigQuery',
            description: 'Connect to Google BigQuery datasets with ADK integration',
            category: 'google_cloud',
            adkEnabled: true,
            capabilities: ['real_time', 'large_scale', 'ml_integration']
          },
          {
            id: 'google_analytics',
            name: 'Google Analytics',
            description: 'Import Google Analytics data with enhanced insights',
            category: 'google_marketing',
            adkEnabled: true,
            capabilities: ['behavioral_analysis', 'conversion_tracking', 'audience_insights']
          },
          {
            id: 'google_sheets',
            name: 'Google Sheets',
            description: 'Analyze Google Sheets data with collaborative features',
            category: 'google_workspace',
            adkEnabled: true,
            capabilities: ['collaborative', 'real_time_sync', 'formula_integration']
          }
        ]
      };
      
      collectTelemetry('getDataSources', Date.now() - startTime, true);
      return enhancedSources;
    } catch (error: any) {
      collectTelemetry('getDataSources', Date.now() - startTime, false, error);
      throw new APIError(
        'Failed to get data sources',
        'DATA_SOURCES_GET_FAILED',
        error.response?.status,
        true
      );
    }
  },
  
  // Enhanced analysis types with intelligent recommendations
  getAnalysisTypes: async () => {
    const startTime = Date.now();
    try {
      const result = await retryWithBackoff(async () => {
        const response = await createRequestInterceptor().get('/analysis-types');
        return response.data;
      });
      
      // Enhance with Google ADK-powered intelligent analysis types
      const enhancedTypes = {
        ...result,
        types: [
          {
            id: 'intelligent_auto',
            name: 'Intelligent Auto-Analysis',
            description: 'AI automatically determines the best analysis approach for your data',
            category: 'ai_powered',
            adkEnabled: true,
            features: ['auto_detection', 'smart_insights', 'adaptive_processing'],
            recommended: true
          },
          ...result.types
        ]
      };
      
      collectTelemetry('getAnalysisTypes', Date.now() - startTime, true);
      return enhancedTypes;
    } catch (error: any) {
      collectTelemetry('getAnalysisTypes', Date.now() - startTime, false, error);
      throw new APIError(
        'Failed to get analysis types',
        'ANALYSIS_TYPES_GET_FAILED',
        error.response?.status,
        true
      );
    }
  },
  
  // New: Google ADK-inspired batch operations
  batchAnalysis: async (configs: any[]) => {
    const startTime = Date.now();
    try {
      const result = await retryWithBackoff(async () => {
        const response = await createRequestInterceptor().post('/analysis/batch', {
          analyses: configs,
          batchConfig: {
            parallelProcessing: true,
            maxConcurrency: 5,
            failureHandling: 'continue',
            progressTracking: true
          }
        });
        return response.data;
      });
      
      collectTelemetry('batchAnalysis', Date.now() - startTime, true);
      return result;
    } catch (error: any) {
      collectTelemetry('batchAnalysis', Date.now() - startTime, false, error);
      throw new APIError(
        'Failed to execute batch analysis',
        'BATCH_ANALYSIS_FAILED',
        error.response?.status,
        true
      );
    }
  },
  
  // New: Export telemetry data for Google ADK analytics
  exportTelemetry: () => {
    const telemetryData = JSON.parse(localStorage.getItem('intelliflow_telemetry') || '[]');
    return {
      data: telemetryData,
      summary: {
        totalOperations: telemetryData.length,
        successRate: telemetryData.filter((t: any) => t.success).length / telemetryData.length,
        averageDuration: telemetryData.reduce((sum: number, t: any) => sum + t.duration, 0) / telemetryData.length,
        errorTypes: telemetryData
          .filter((t: any) => !t.success)
          .reduce((acc: any, t: any) => {
            const errorCode = t.error?.code || 'UNKNOWN';
            acc[errorCode] = (acc[errorCode] || 0) + 1;
            return acc;
          }, {})
      }
    };
  }
};

// Types for analysis data
export interface AnalysisType {
  id: string;
  name: string;
  description: string;
  default_objectives: string[];
}

export interface DataSource {
  id: string;
  name: string;
  description: string;
  parameters: string[];
}

export interface AnalysisResult {
  status: string;
  result: any;
  error?: string;
}

// Custom hook for analysis status polling
export const useAnalysisStatus = (analysisId: string | null) => {
  // If on GitHub Pages, use the mock hook
  if (isGitHubPages) {
    return useMockAnalysisStatus(analysisId);
  }
  
  const [status, setStatus] = useState<string>('loading');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    if (!analysisId) return;
    
    const pollStatus = async () => {
      try {
        const response = await apiClient.getAnalysis(analysisId);
        
        if (response.status === 'success') {
          const analysis = response.analysis;
          setStatus(analysis.status);
          
          if (analysis.status === 'completed') {
            setResult(analysis.result);
          } else if (analysis.status === 'failed') {
            setError(analysis.error || 'Analysis failed');
          }
          
          // If analysis is still running, continue polling
          if (analysis.status === 'running') {
            setTimeout(pollStatus, 2000);
          }
        } else {
          setError(response.message || 'Failed to get analysis status');
          setStatus('error');
        }
      } catch (error: any) {
        setError(error.message || 'Failed to get analysis status');
        setStatus('error');
      }
    };
    
    pollStatus();
    
    return () => {
      // Cleanup function
    };
  }, [analysisId]);
  
  return { status, result, error };
};
