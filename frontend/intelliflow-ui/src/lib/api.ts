import { useState, useEffect } from 'react';
import axios from 'axios';
import { mockApiClient, useMockAnalysisStatus } from './mockApi';

// Check if we're running on GitHub Pages
const isGitHubPages = window.location.hostname !== 'localhost';

// Define API base URL
const API_BASE_URL = isGitHubPages ? '' : 'http://localhost:5000/api';

// API client for IntelliFlow
export const apiClient = isGitHubPages ? mockApiClient : {
  // Health check
  healthCheck: async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/health`);
      return response.data;
    } catch (error: any) {
      console.error('Health check failed:', error);
      throw error;
    }
  },
  
  // Start a new analysis
  startAnalysis: async (analysisConfig: any) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/analysis/start`, analysisConfig);
      return response.data;
    } catch (error: any) {
      console.error('Failed to start analysis:', error);
      throw error;
    }
  },
  
  // Get analysis status and results
  getAnalysis: async (analysisId: string) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/analysis/${analysisId}`);
      return response.data;
    } catch (error: any) {
      console.error(`Failed to get analysis ${analysisId}:`, error);
      throw error;
    }
  },
  
  // Get analysis history
  getAnalysisHistory: async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/analysis/history`);
      return response.data;
    } catch (error: any) {
      console.error('Failed to get analysis history:', error);
      throw error;
    }
  },
  
  // Get available data sources
  getDataSources: async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/data-sources`);
      return response.data;
    } catch (error: any) {
      console.error('Failed to get data sources:', error);
      throw error;
    }
  },
  
  // Get available analysis types
  getAnalysisTypes: async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/analysis-types`);
      return response.data;
    } catch (error: any) {
      console.error('Failed to get analysis types:', error);
      throw error;
    }
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
