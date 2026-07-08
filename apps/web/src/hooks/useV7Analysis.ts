'use client';

import { useState, useCallback, useRef } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────

export interface V7Agent {
  id: string;
  name: string;
  role: string;
  tier: string;
  stage: string;
  stageNumber: number;
  description: string;
  capabilities: string[];
  dependencies: string[];
  icon: string;
  color: string;
  timeoutMs: number;
}

export interface V7AgentState {
  agentId: string;
  agentName: string;
  stage: string;
  stageNumber: number;
  status: 'idle' | 'pending' | 'running' | 'success' | 'failed' | 'skipped' | 'timeout';
  progress: number;
  result?: any;
  error?: string;
  durationMs?: number;
  timestamp: string;
}

export interface V7AnalysisConfig {
  targetColumn?: string;
  timeColumn?: string;
  seasonLength?: number;
  forecastHorizon?: number;
  anomalyThreshold?: number;
  clusterCount?: number;
  nlqQuery?: string;
  objectives?: string[];
  fileName?: string;
  sensitivity?: 'low' | 'medium' | 'high';
}

export interface V7ExecutionSummary {
  status: 'success' | 'partial' | 'failed';
  totalDurationMs: number;
  agentsSucceeded: number;
  agentsFailed: number;
  agentsSkipped: number;
  stageTimings: Record<number, number>;
  cacheStats: { size: number; maxSize: number; hitRate: number };
}

interface UseV7AnalysisResult {
  agentStates: Record<string, V7AgentState>;
  isStreaming: boolean;
  isComplete: boolean;
  error: string | null;
  executionSummary: V7ExecutionSummary | null;
  startAnalysis: (data: Record<string, any>[], config: V7AnalysisConfig) => Promise<void>;
  cancelAnalysis: () => void;
  reset: () => void;
}

// ─── Hook ──────────────────────────────────────────────────────────────

export function useV7Analysis(): UseV7AnalysisResult {
  const [agentStates, setAgentStates] = useState<Record<string, V7AgentState>>({});
  const [isStreaming, setIsStreaming] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [executionSummary, setExecutionSummary] = useState<V7ExecutionSummary | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    setAgentStates({});
    setIsStreaming(false);
    setIsComplete(false);
    setError(null);
    setExecutionSummary(null);
  }, []);

  const cancelAnalysis = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const startAnalysis = useCallback(async (data: Record<string, any>[], config: V7AnalysisConfig) => {
    // Reset state
    setAgentStates({});
    setIsComplete(false);
    setError(null);
    setExecutionSummary(null);
    setIsStreaming(true);

    const analysisId = `analysis_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch('/api/v7/analyze-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysisId, dataframe: data, config }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`Analysis failed: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let currentEvent = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7);
          } else if (line.startsWith('data: ') && currentEvent) {
            try {
              const data = JSON.parse(line.slice(6));

              if (currentEvent === 'progress') {
                setAgentStates(prev => ({
                  ...prev,
                  [data.agentId]: {
                    agentId: data.agentId,
                    agentName: data.agentName,
                    stage: data.stage,
                    stageNumber: data.stageNumber,
                    status: data.status,
                    progress: data.progress,
                    result: data.result,
                    error: data.error,
                    durationMs: data.durationMs,
                    timestamp: data.timestamp,
                  },
                }));
              } else if (currentEvent === 'complete') {
                setExecutionSummary({
                  status: data.status,
                  totalDurationMs: data.totalDurationMs,
                  agentsSucceeded: data.agentsSucceeded,
                  agentsFailed: data.agentsFailed,
                  agentsSkipped: data.agentsSkipped,
                  stageTimings: data.stageTimings,
                  cacheStats: data.cacheStats,
                });
                setIsComplete(true);
                setIsStreaming(false);
              } else if (currentEvent === 'error') {
                setError(data.error || 'Unknown error');
                setIsStreaming(false);
              }
            } catch {
              // Ignore partial JSON
            }
            currentEvent = '';
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message ?? 'Analysis failed');
      }
      setIsStreaming(false);
    } finally {
      abortControllerRef.current = null;
    }
  }, []);

  return {
    agentStates,
    isStreaming,
    isComplete,
    error,
    executionSummary,
    startAnalysis,
    cancelAnalysis,
    reset,
  };
}

// ─── Agent List Fetcher ────────────────────────────────────────────────

export function useV7Agents() {
  const [agents, setAgents] = useState<V7Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v7/agents');
      if (!res.ok) throw new Error('Failed to fetch agents');
      const data = await res.json();
      setAgents(data.agents || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { agents, loading, error, fetchAgents };
}
