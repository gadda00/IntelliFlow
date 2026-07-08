'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────

export interface AgentStreamState {
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

export interface PipelineStreamResult {
  agentStates: Record<string, AgentStreamState>;
  isComplete: boolean;
  isStreaming: boolean;
  error: string | null;
  startStream: (analysisId: string, data: any[], config?: any) => Promise<void>;
  stopStream: () => void;
  clearState: () => void;
}

// ─── Hook ──────────────────────────────────────────────────────────────

/**
 * SSE streaming hook for real-time agent pipeline updates.
 *
 * Connects to the /api/v7/analyze-stream endpoint and receives
 * real-time progress updates as agents execute in the DAG pipeline.
 *
 * @example
 * const { agentStates, isComplete, isStreaming, startStream } = useAgentStream();
 *
 * const handleAnalyze = () => {
 *   startStream('analysis-123', myData, { targetColumn: 'sales' });
 * };
 */
export function useAgentStream(): PipelineStreamResult {
  const [agentStates, setAgentStates] = useState<Record<string, AgentStreamState>>({});
  const [isComplete, setIsComplete] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const stopStream = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const clearState = useCallback(() => {
    setAgentStates({});
    setIsComplete(false);
    setError(null);
  }, []);

  const startStream = useCallback(async (analysisId: string, data: any[], config?: any) => {
    // Reset state
    setAgentStates({});
    setIsComplete(false);
    setError(null);
    setIsStreaming(true);

    try {
      // Initiate the analysis via POST (returns SSE stream)
      const response = await fetch('/api/v7/analyze-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysisId,
          dataframe: data,
          config: config ?? {},
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Streaming failed: ${response.status}`);
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

              if (currentEvent === 'connected') {
                // Stream connected
              } else if (currentEvent === 'progress') {
                // Agent status update
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
                setIsComplete(true);
                setIsStreaming(false);
              } else if (currentEvent === 'error') {
                setError(data.error || 'Unknown error');
                setIsStreaming(false);
              }
            } catch {
              // Ignore JSON parse errors for partial chunks
            }
            currentEvent = '';
          }
        }
      }
    } catch (err: any) {
      setError(err.message ?? 'Streaming failed');
      setIsStreaming(false);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  return {
    agentStates,
    isComplete,
    isStreaming,
    error,
    startStream,
    stopStream,
    clearState,
  };
}

// ─── Helper: Compute Pipeline Progress ─────────────────────────────────

export function computePipelineProgress(agentStates: Record<string, AgentStreamState>): {
  totalAgents: number;
  completed: number;
  running: number;
  failed: number;
  skipped: number;
  overallProgress: number;
} {
  const states = Object.values(agentStates);
  const totalAgents = states.length;
  const completed = states.filter(s => s.status === 'success').length;
  const running = states.filter(s => s.status === 'running').length;
  const failed = states.filter(s => s.status === 'failed').length;
  const skipped = states.filter(s => s.status === 'skipped').length;

  const overallProgress = totalAgents > 0
    ? (completed / totalAgents) * 100
    : 0;

  return { totalAgents, completed, running, failed, skipped, overallProgress };
}

// ─── Helper: Get Agents by Stage ───────────────────────────────────────

export function getAgentsByStage(agentStates: Record<string, AgentStreamState>): Record<string, AgentStreamState[]> {
  const byStage: Record<string, AgentStreamState[]> = {};
  for (const state of Object.values(agentStates)) {
    if (!byStage[state.stage]) byStage[state.stage] = [];
    byStage[state.stage].push(state);
  }
  return byStage;
}
