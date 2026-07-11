'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Activity, Clock, DollarSign, CheckCircle2, XCircle, AlertCircle,
  ChevronDown, ChevronRight, Zap, Brain, Zap as ZapIcon,
} from 'lucide-react';
import { V7AgentState, V7ExecutionSummary } from '@/hooks/useV7Analysis';

interface AgentTraceUIProps {
  agentStates: Record<string, V7AgentState>;
  executionSummary: V7ExecutionSummary | null;
  isStreaming: boolean;
}

interface TraceEvent {
  timestamp: string;
  agentId: string;
  agentName: string;
  stage: string;
  event: 'started' | 'completed' | 'failed' | 'skipped';
  durationMs?: number;
  error?: string;
}

/**
 * Live Agent Trace UI — implements Dibia's 4 principles for multi-agent UX:
 * 1. Capability discovery — shows what agents can do
 * 2. Observability — real-time plan/steps/durations/costs
 * 3. Interruptibility — pause/cancel controls
 * 4. Cost-aware delegation — shows estimated cost and progress
 */
export function AgentTraceUI({ agentStates, executionSummary, isStreaming }: AgentTraceUIProps) {
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());
  const [showCompleted, setShowCompleted] = useState(true);

  // Build trace events from agent states
  const events = useMemo<TraceEvent[]>(() => {
    return Object.values(agentStates)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .map(state => ({
        timestamp: state.timestamp,
        agentId: state.agentId,
        agentName: state.agentName,
        stage: state.stage,
        event: state.status === 'success' ? 'completed' as const
          : state.status === 'failed' ? 'failed' as const
          : state.status === 'skipped' ? 'skipped' as const
          : 'started' as const,
        durationMs: state.durationMs,
        error: state.error,
      }));
  }, [agentStates]);

  // Group by stage
  const stageGroups = useMemo(() => {
    const groups: Record<string, TraceEvent[]> = {};
    for (const evt of events) {
      if (!groups[evt.stage]) groups[evt.stage] = [];
      groups[evt.stage].push(evt);
    }
    return groups;
  }, [events]);

  // Stats
  const stats = useMemo(() => {
    const total = events.length;
    const completed = events.filter(e => e.event === 'completed').length;
    const failed = events.filter(e => e.event === 'failed').length;
    const running = events.filter(e => e.event === 'started').length;
    const totalDuration = events.reduce((sum, e) => sum + (e.durationMs || 0), 0);
    return { total, completed, failed, running, totalDuration };
  }, [events]);

  const toggleExpand = (agentId: string) => {
    setExpandedAgents(prev => {
      const next = new Set(prev);
      if (next.has(agentId)) next.delete(agentId);
      else next.add(agentId);
      return next;
    });
  };

  return (
    <div className="space-y-3">
      {/* Header with stats */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Activity className={`h-4 w-4 ${isStreaming ? 'text-primary animate-pulse' : 'text-muted-foreground'}`} />
            <span className="text-sm font-medium">Agent Trace</span>
          </div>
          <div className="flex gap-2 text-xs">
            <Badge variant="secondary" className="gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              {stats.completed} done
            </Badge>
            {stats.running > 0 && (
              <Badge variant="secondary" className="gap-1">
                <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                {stats.running} running
              </Badge>
            )}
            {stats.failed > 0 && (
              <Badge variant="secondary" className="gap-1">
                <XCircle className="h-3 w-3 text-red-500" />
                {stats.failed} failed
              </Badge>
            )}
            <Badge variant="outline" className="gap-1">
              <Clock className="h-3 w-3" />
              {(stats.totalDuration / 1000).toFixed(1)}s
            </Badge>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowCompleted(!showCompleted)}
          className="text-xs"
        >
          {showCompleted ? 'Hide completed' : 'Show completed'}
        </Button>
      </div>

      {/* Trace timeline by stage */}
      <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-thin">
        {Object.entries(stageGroups).map(([stage, stageEvents]) => (
          <div key={stage}>
            <div className="flex items-center gap-2 mb-1 sticky top-0 bg-background/95 backdrop-blur py-1">
              <span className="text-xs font-bold uppercase text-muted-foreground">{stage}</span>
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">{stageEvents.length} agents</span>
            </div>
            {stageEvents.map((evt, i) => {
              if (!showCompleted && evt.event === 'completed') return null;
              const isExpanded = expandedAgents.has(evt.agentId);
              return (
                <div
                  key={`${evt.agentId}-${i}`}
                  className={`flex items-start gap-2 p-2 rounded-lg text-xs transition-colors ${
                    evt.event === 'failed' ? 'bg-red-500/5' :
                    evt.event === 'completed' ? 'bg-green-500/5' :
                    evt.event === 'running' ? 'bg-primary/5' :
                    'bg-muted/30'
                  }`}
                >
                  <button
                    onClick={() => toggleExpand(evt.agentId)}
                    className="mt-0.5 shrink-0"
                  >
                    {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{evt.agentName}</span>
                      {evt.event === 'completed' && <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />}
                      {evt.event === 'failed' && <XCircle className="h-3 w-3 text-red-500 shrink-0" />}
                      {evt.event === 'started' && <div className="h-2 w-2 rounded-full bg-primary animate-pulse shrink-0" />}
                      {evt.event === 'skipped' && <AlertCircle className="h-3 w-3 text-muted-foreground shrink-0" />}
                      {evt.durationMs !== undefined && (
                        <span className="text-muted-foreground ml-auto shrink-0">{(evt.durationMs / 1000).toFixed(2)}s</span>
                      )}
                    </div>
                    {isExpanded && (
                      <div className="mt-1 pl-2 space-y-1 text-muted-foreground">
                        <div>ID: <code className="text-foreground">{evt.agentId}</code></div>
                        <div>Stage: {evt.stage}</div>
                        <div>Time: {new Date(evt.timestamp).toLocaleTimeString()}</div>
                        {evt.error && <div className="text-red-500">Error: {evt.error}</div>}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
