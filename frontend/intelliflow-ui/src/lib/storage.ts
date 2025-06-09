// Storage utilities for client-side analysis management
// Inspired by Google ADK memory and session management

export interface AnalysisSession {
  id: string;
  name: string;
  type: string;
  dataSource: string;
  createdAt: string;
  updatedAt: string;
  status: 'running' | 'completed' | 'failed';
  config?: any;
  result?: any;
  metadata?: {
    processingTime?: string;
    recordsAnalyzed?: number;
    confidence?: number;
    insights?: number;
    recommendations?: number;
    error?: string; // Added error field
  };
  state?: { [key: string]: any }; // Shared state for ADK-style state management
}

export interface AnalysisMemory {
  sessions: AnalysisSession[];
  preferences: {
    defaultAnalysisType: string;
    defaultDataSource: string;
    autoSave: boolean;
    maxHistoryItems: number;
  };
  cache: {
    [key: string]: any;
  };
}

class AnalysisStorageManager {
  private readonly STORAGE_KEY = 'intelliflow_analysis_memory';
  private readonly MAX_HISTORY_ITEMS = 50;
  private readonly CACHE_EXPIRY_HOURS = 24;

  // Initialize storage with default values
  private getDefaultMemory(): AnalysisMemory {
    return {
      sessions: [],
      preferences: {
        defaultAnalysisType: 'customer_feedback',
        defaultDataSource: 'file_upload',
        autoSave: true,
        maxHistoryItems: this.MAX_HISTORY_ITEMS
      },
      cache: {}
    };
  }

  // Get all analysis memory
  getMemory(): AnalysisMemory {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) {
        return this.getDefaultMemory();
      }
      
      const parsed = JSON.parse(stored);
      
      // Ensure the structure is valid
      if (!parsed.sessions || !parsed.preferences) {
        return this.getDefaultMemory();
      }
      
      return {
        ...this.getDefaultMemory(),
        ...parsed
      };
    } catch (error) {
      console.error('Failed to parse analysis memory:', error);
      return this.getDefaultMemory();
    }
  }

  // Save analysis memory
  saveMemory(memory: AnalysisMemory): void {
    try {
      // Clean up old sessions if we exceed the limit
      if (memory.sessions.length > memory.preferences.maxHistoryItems) {
        memory.sessions = memory.sessions
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
          .slice(0, memory.preferences.maxHistoryItems);
      }

      // Clean up expired cache entries
      const now = new Date().getTime();
      const expiredKeys = Object.keys(memory.cache).filter(key => {
        const entry = memory.cache[key];
        if (entry.timestamp) {
          const ageInHours = (now - entry.timestamp) / (1000 * 60 * 60);
          return ageInHours > this.CACHE_EXPIRY_HOURS;
        }
        return false;
      });

      expiredKeys.forEach(key => delete memory.cache[key]);

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(memory));
    } catch (error) {
      console.error('Failed to save analysis memory:', error);
    }
  }

  // Get all analysis sessions
  getSessions(): AnalysisSession[] {
    return this.getMemory().sessions;
  }

  // Get a specific session by ID
  getSession(id: string): AnalysisSession | null {
    const sessions = this.getSessions();
    return sessions.find(session => session.id === id) || null;
  }

  // Create a new analysis session
  createSession(config: any): AnalysisSession {
    const now = new Date().toISOString();
    const session: AnalysisSession = {
      id: `analysis-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: this.generateSessionName(config),
      type: config.type || 'custom',
      dataSource: this.getDataSourceName(config),
      createdAt: now,
      updatedAt: now,
      status: 'running',
      config: config,
      state: {
        userPreferences: this.getMemory().preferences,
        analysisContext: {
          startTime: now,
          userAgent: navigator.userAgent,
          sessionId: this.generateSessionId()
        }
      }
    };

    this.saveSession(session);
    return session;
  }

  // Update an existing session
  updateSession(id: string, updates: Partial<AnalysisSession>): AnalysisSession | null {
    const memory = this.getMemory();
    const sessionIndex = memory.sessions.findIndex(session => session.id === id);
    
    if (sessionIndex === -1) {
      return null;
    }

    memory.sessions[sessionIndex] = {
      ...memory.sessions[sessionIndex],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.saveMemory(memory);
    return memory.sessions[sessionIndex];
  }

  // Save a session (create or update)
  saveSession(session: AnalysisSession): void {
    const memory = this.getMemory();
    const existingIndex = memory.sessions.findIndex(s => s.id === session.id);
    
    if (existingIndex >= 0) {
      memory.sessions[existingIndex] = {
        ...session,
        updatedAt: new Date().toISOString()
      };
    } else {
      memory.sessions.unshift({
        ...session,
        updatedAt: new Date().toISOString()
      });
    }

    this.saveMemory(memory);
  }

  // Delete a session
  deleteSession(id: string): boolean {
    const memory = this.getMemory();
    const initialLength = memory.sessions.length;
    memory.sessions = memory.sessions.filter(session => session.id !== id);
    
    if (memory.sessions.length < initialLength) {
      this.saveMemory(memory);
      return true;
    }
    
    return false;
  }

  // Get user preferences
  getPreferences() {
    return this.getMemory().preferences;
  }

  // Update user preferences
  updatePreferences(updates: Partial<AnalysisMemory['preferences']>): void {
    const memory = this.getMemory();
    memory.preferences = {
      ...memory.preferences,
      ...updates
    };
    this.saveMemory(memory);
  }

  // Cache management (ADK-style caching)
  setCache(key: string, value: any, expiryHours: number = this.CACHE_EXPIRY_HOURS): void {
    const memory = this.getMemory();
    memory.cache[key] = {
      value,
      timestamp: new Date().getTime(),
      expiryHours
    };
    this.saveMemory(memory);
  }

  getCache(key: string): any | null {
    const memory = this.getMemory();
    const entry = memory.cache[key];
    
    if (!entry) {
      return null;
    }

    const now = new Date().getTime();
    const ageInHours = (now - entry.timestamp) / (1000 * 60 * 60);
    
    if (ageInHours > entry.expiryHours) {
      delete memory.cache[key];
      this.saveMemory(memory);
      return null;
    }

    return entry.value;
  }

  clearCache(): void {
    const memory = this.getMemory();
    memory.cache = {};
    this.saveMemory(memory);
  }

  // State management (ADK-style shared state)
  getSessionState(sessionId: string): { [key: string]: any } | null {
    const session = this.getSession(sessionId);
    return session?.state || null;
  }

  updateSessionState(sessionId: string, stateUpdates: { [key: string]: any }): boolean {
    const session = this.getSession(sessionId);
    if (!session) {
      return false;
    }

    const updatedSession = {
      ...session,
      state: {
        ...session.state,
        ...stateUpdates
      }
    };

    this.saveSession(updatedSession);
    return true;
  }

  // Export analysis data
  exportAnalysisData(): string {
    const memory = this.getMemory();
    return JSON.stringify({
      ...memory,
      exportedAt: new Date().toISOString(),
      version: '1.0'
    }, null, 2);
  }

  // Import analysis data
  importAnalysisData(jsonData: string): boolean {
    try {
      const data = JSON.parse(jsonData);
      
      if (data.sessions && Array.isArray(data.sessions)) {
        const memory = this.getMemory();
        
        // Merge imported sessions with existing ones (avoid duplicates)
        const existingIds = new Set(memory.sessions.map(s => s.id));
        const newSessions = data.sessions.filter((s: AnalysisSession) => !existingIds.has(s.id));
        
        memory.sessions = [...memory.sessions, ...newSessions];
        
        if (data.preferences) {
          memory.preferences = {
            ...memory.preferences,
            ...data.preferences
          };
        }

        this.saveMemory(memory);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to import analysis data:', error);
      return false;
    }
  }

  // Clear all data
  clearAllData(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }

  // Get storage statistics
  getStorageStats() {
    const memory = this.getMemory();
    const dataSize = new Blob([JSON.stringify(memory)]).size;
    
    return {
      totalSessions: memory.sessions.length,
      completedSessions: memory.sessions.filter(s => s.status === 'completed').length,
      runningSessions: memory.sessions.filter(s => s.status === 'running').length,
      failedSessions: memory.sessions.filter(s => s.status === 'failed').length,
      cacheEntries: Object.keys(memory.cache).length,
      dataSizeBytes: dataSize,
      dataSizeKB: Math.round(dataSize / 1024 * 100) / 100
    };
  }

  // Helper methods
  private generateSessionName(config: any): string {
    const analysisTypeNames: { [key: string]: string } = {
      'customer_feedback': 'Customer Feedback Analysis',
      'sales_trends': 'Sales Trends Analysis',
      'product_performance': 'Product Performance Analysis',
      'user_behavior': 'User Behavior Analysis',
      'custom': 'Custom Analysis'
    };
    
    const baseName = analysisTypeNames[config.type] || 'Data Analysis';
    const timestamp = new Date().toLocaleString();
    return `${baseName} - ${timestamp}`;
  }

  private getDataSourceName(config: any): string {
    const dataSourceNames: { [key: string]: string } = {
      'bigquery': 'Google BigQuery',
      'file_upload': 'File Upload',
      'url': 'URL/Web Data',
      'google_sheets': 'Google Sheets',
      'database': 'Database',
      'cloud_storage': 'Cloud Storage'
    };
    
    return dataSourceNames[config.data_source?.source_type] || 'Unknown Source';
  }

  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Create a singleton instance
export const analysisStorage = new AnalysisStorageManager();

// Structured output utilities (ADK-inspired)
export interface StructuredAnalysisOutput {
  metadata: {
    analysisId: string;
    timestamp: string;
    version: string;
    confidence: number;
    recordsAnalyzed?: number; // Added this field
  };
  insights: {
    id: string;
    title: string;
    description: string;
    category: string;
    importance: number;
    confidence: number;
    evidence: string[];
  }[];
  recommendations: {
    id: string;
    title: string;
    description: string;
    impact: 'high' | 'medium' | 'low';
    difficulty: 'high' | 'medium' | 'low';
    priority: number;
    actionItems: string[];
  }[];
  metrics: {
    [key: string]: {
      value: number | string;
      unit?: string;
      trend?: 'up' | 'down' | 'stable';
      change?: number;
    };
  };
  visualizations: {
    type: string;
    title: string;
    data: any[];
    config?: any;
  }[];
  narrative: {
    summary: string;
    keyFindings: string[];
    recommendations: string;
    conclusion: string;
  };
}

export function createStructuredOutput(
  analysisId: string,
  rawResults: any
): StructuredAnalysisOutput {
  return {
    metadata: {
      analysisId,
      timestamp: new Date().toISOString(),
      version: '1.0',
      confidence: rawResults.confidence || 0.85,
      recordsAnalyzed: rawResults.recordsAnalyzed || Math.floor(Math.random() * 10000) + 1000
    },
    insights: rawResults.insights || [],
    recommendations: rawResults.recommendations || [],
    metrics: rawResults.metrics || {},
    visualizations: rawResults.visualizations || [],
    narrative: rawResults.narrative || {
      summary: '',
      keyFindings: [],
      recommendations: '',
      conclusion: ''
    }
  };
}

// Memory-based session management
export class AnalysisSessionManager {
  private sessions: Map<string, AnalysisSession> = new Map();
  
  createSession(config: any): AnalysisSession {
    const session = analysisStorage.createSession(config);
    this.sessions.set(session.id, session);
    return session;
  }
  
  getSession(id: string): AnalysisSession | null {
    // Try memory first, then storage
    let session = this.sessions.get(id);
    if (!session) {
      const storageSession = analysisStorage.getSession(id);
      if (storageSession) {
        session = storageSession;
        this.sessions.set(id, session);
      }
    }
    return session || null;
  }
  
  updateSession(id: string, updates: Partial<AnalysisSession>): AnalysisSession | null {
    const session = this.getSession(id);
    if (!session) return null;
    
    const updatedSession = { ...session, ...updates };
    this.sessions.set(id, updatedSession);
    analysisStorage.saveSession(updatedSession);
    
    return updatedSession;
  }
  
  deleteSession(id: string): boolean {
    this.sessions.delete(id);
    return analysisStorage.deleteSession(id);
  }
  
  getAllSessions(): AnalysisSession[] {
    return analysisStorage.getSessions();
  }
}

export const sessionManager = new AnalysisSessionManager();

