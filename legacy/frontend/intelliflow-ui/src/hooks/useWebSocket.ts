// hooks/useWebSocket.ts
// Real-time agent pipeline updates via Socket.IO

import { useEffect, useRef, useState, useCallback } from 'react';

interface AgentUpdate {
  analysis_id: string;
  agent: string;
  status: 'running' | 'completed' | 'error' | 'skipped' | 'timeout';
  progress: number;
  result?: any;
  timestamp: string;
}

interface UseWebSocketReturn {
  agentUpdates: Record<string, AgentUpdate>;
  isConnected: boolean;
  subscribe: (analysisId: string) => void;
  clearUpdates: () => void;
  connectionError: string | null;
}

const WS_URL = import.meta.env.VITE_WS_URL || window.location.origin;

export function useWebSocket(): UseWebSocketReturn {
  const [agentUpdates, setAgentUpdates] = useState<Record<string, AgentUpdate>>({});
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const socketRef = useRef<any>(null);
  const currentRoomRef = useRef<string | null>(null);

  useEffect(() => {
    // Dynamically load Socket.IO client to avoid SSR issues
    const loadSocket = async () => {
      try {
        // Try to use Socket.IO if available
        const script = document.createElement('script');
        script.src = `${WS_URL}/socket.io/socket.io.js`;
        script.onload = () => initSocket();
        script.onerror = () => {
          console.warn('Socket.IO not available, using polling fallback');
          setConnectionError('WebSocket unavailable — using REST polling');
        };
        document.head.appendChild(script);
      } catch (e) {
        setConnectionError('WebSocket connection failed');
      }
    };

    const initSocket = () => {
      if (!(window as any).io) return;
      const socket = (window as any).io(WS_URL, {
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
      });

      socket.on('connect', () => {
        setIsConnected(true);
        setConnectionError(null);
        // Re-subscribe to current room on reconnect
        if (currentRoomRef.current) {
          socket.emit('subscribe_analysis', { analysis_id: currentRoomRef.current });
        }
      });

      socket.on('disconnect', () => setIsConnected(false));
      socket.on('connect_error', () => {
        setConnectionError('Connection error — retrying…');
        setIsConnected(false);
      });

      socket.on('agent_update', (update: AgentUpdate) => {
        setAgentUpdates(prev => ({
          ...prev,
          [update.agent]: update
        }));
      });

      socketRef.current = socket;
    };

    loadSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  const subscribe = useCallback((analysisId: string) => {
    currentRoomRef.current = analysisId;
    if (socketRef.current?.connected) {
      socketRef.current.emit('subscribe_analysis', { analysis_id: analysisId });
    }
  }, []);

  const clearUpdates = useCallback(() => {
    setAgentUpdates({});
    currentRoomRef.current = null;
  }, []);

  return { agentUpdates, isConnected, subscribe, clearUpdates, connectionError };
}


// ─── Polling fallback (used when WebSocket is unavailable) ────────────────────

interface UsePollingReturn {
  data: any;
  isLoading: boolean;
  error: string | null;
  startPolling: (analysisId: string) => void;
  stopPolling: () => void;
}

export function useAnalysisPolling(intervalMs = 2000): UsePollingReturn {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const analysisIdRef = useRef<string | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setIsLoading(false);
  }, []);

  const startPolling = useCallback((analysisId: string) => {
    analysisIdRef.current = analysisId;
    setIsLoading(true);
    setError(null);

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/analysis/${analysisId}/status`);
        const result = await res.json();
        setData(result);
        if (result.status === 'success' || result.status === 'error') {
          stopPolling();
        }
      } catch (e) {
        setError('Polling failed');
        stopPolling();
      }
    }, intervalMs);
  }, [intervalMs, stopPolling]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  return { data, isLoading, error, startPolling, stopPolling };
}
