'use client';

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, Loader2, Clock, AlertCircle, Zap, ArrowRight, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { V7AgentState, V7ExecutionSummary } from '@/hooks/useV7Analysis';
import { PipelineVisualizer, PipelineLegend, StageSummaryBar } from '@/components/busara/PipelineVisualizer';

interface PipelineStepProps {
  agentStates: Record<string, V7AgentState>;
  isStreaming: boolean;
  isComplete: boolean;
  error: string | null;
  executionSummary: V7ExecutionSummary | null;
  onProceed: () => void;
  onCancel: () => void;
}

const STAGE_INFO: Record<string, { label: string; color: string }> = {
  ingest: { label: 'Stage 0: Ingest', color: 'text-chart-3' },
  engineer: { label: 'Stage 1: Engineer', color: 'text-primary' },
  detect: { label: 'Stage 2: Detect', color: 'text-chart-2' },
  forecast: { label: 'Stage 3: Forecast', color: 'text-chart-4' },
  infer: { label: 'Stage 4: Infer', color: 'text-chart-5' },
  report: { label: 'Stage 5: Report', color: 'text-accent-foreground' },
};

export function PipelineStep({
  agentStates,
  isStreaming,
  isComplete,
  error,
  executionSummary,
  onProceed,
  onCancel,
}: PipelineStepProps) {
  const states = Object.values(agentStates);

  const stats = useMemo(() => {
    const total = states.length;
    const completed = states.filter(s => s.status === 'success').length;
    const running = states.filter(s => s.status === 'running').length;
    const failed = states.filter(s => s.status === 'failed').length;
    const skipped = states.filter(s => s.status === 'skipped').length;
    const pending = states.filter(s => s.status === 'pending' || s.status === 'idle').length;
    const progress = total > 0 ? (completed / total) * 100 : 0;
    return { total, completed, running, failed, skipped, pending, progress };
  }, [states]);

  // Convert to PipelineVisualizer format
  const visualizerAgents = useMemo(() => {
    return states.map(s => ({
      id: s.agentId,
      name: s.agentName,
      stage: s.stage,
      stageNumber: s.stageNumber,
      dependencies: [],
      tier: '',
      color: '',
      icon: '',
    }));
  }, [states]);

  const visualizerStatuses = useMemo(() => {
    const result: Record<string, any> = {};
    for (const s of states) {
      result[s.agentId] = s.status;
    }
    return result;
  }, [states]);

  const visualizerResults = useMemo(() => {
    const result: Record<string, any> = {};
    for (const s of states) {
      result[s.agentId] = {
        metrics: s.result?.metrics,
        executionTimeMs: s.durationMs,
        error: s.error,
      };
    }
    return result;
  }, [states]);

  // Live log (last 15 events)
  const logEntries = useMemo(() => {
    return states
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 15);
  }, [states]);

  return (
    <div className="space-y-4">
      {/* Status Banner */}
      <Card className={`p-4 border-2 ${
        error ? 'border-destructive/40 bg-destructive/5' :
        isComplete ? 'border-primary/40 bg-primary/5' :
        'border-border/30'
      }`}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            {error ? (
              <AlertCircle className="h-6 w-6 text-destructive" />
            ) : isComplete ? (
              <CheckCircle2 className="h-6 w-6 text-primary" />
            ) : isStreaming ? (
              <Loader2 className="h-6 w-6 text-primary animate-spin" />
            ) : (
              <Clock className="h-6 w-6 text-muted-foreground" />
            )}
            <div>
              <p className="font-semibold text-sm">
                {error ? 'Analysis Failed' :
                 isComplete ? 'Analysis Complete!' :
                 isStreaming ? 'Running 50-Agent Pipeline...' :
                 'Initializing...'}
              </p>
              <p className="text-xs text-muted-foreground">
                {error ? error :
                 isComplete ? `${stats.completed} agents succeeded in ${(executionSummary?.totalDurationMs / 1000).toFixed(1)}s` :
                 `${stats.completed}/${stats.total} agents completed · ${stats.running} running`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isComplete ? (
              <Button onClick={onProceed} className="gap-2">
                View Results
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : isStreaming ? (
              <Button variant="outline" onClick={onCancel} className="gap-2">
                <XCircle className="h-4 w-4" />
                Cancel
              </Button>
            ) : null}
          </div>
        </div>

        {/* Progress Bar */}
        {!error && (
          <div className="mt-4 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Overall Progress</span>
              <span className="font-mono font-medium">{Math.round(stats.progress)}%</span>
            </div>
            <Progress value={stats.progress} className="h-2" />
            <div className="flex gap-4 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-primary" /> {stats.completed} succeeded</span>
              <span className="flex items-center gap-1"><Loader2 className="h-3 w-3 text-blue-500" /> {stats.running} running</span>
              {stats.failed > 0 && <span className="flex items-center gap-1"><XCircle className="h-3 w-3 text-destructive" /> {stats.failed} failed</span>}
              {stats.skipped > 0 && <span className="flex items-center gap-1"><Clock className="h-3 w-3 text-muted-foreground" /> {stats.skipped} skipped</span>}
            </div>
          </div>
        )}
      </Card>

      {/* DAG Visualizer */}
      {visualizerAgents.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Agent Pipeline DAG
            </h3>
            <Badge variant="secondary" className="text-[10px]">{stats.total} agents</Badge>
          </div>
          <StageSummaryBar agents={visualizerAgents} agentStatuses={visualizerStatuses} />
          <PipelineVisualizer
            agents={visualizerAgents}
            agentStatuses={visualizerStatuses}
            agentResults={visualizerResults}
            height={500}
          />
          <PipelineLegend />
        </div>
      )}

      {/* Live Agent Log */}
      {logEntries.length > 0 && (
        <Card className="p-4 border-border/30">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            Agent Activity Log
          </h3>
          <div className="space-y-1 max-h-64 overflow-y-auto scrollbar-thin font-mono text-[11px]">
            <AnimatePresence initial={false}>
              {logEntries.map((entry) => {
                const statusIcon = {
                  success: <CheckCircle2 className="h-3 w-3 text-primary" />,
                  running: <Loader2 className="h-3 w-3 text-blue-500 animate-spin" />,
                  failed: <XCircle className="h-3 w-3 text-destructive" />,
                  skipped: <Clock className="h-3 w-3 text-muted-foreground" />,
                  timeout: <AlertCircle className="h-3 w-3 text-orange-500" />,
                  pending: <Clock className="h-3 w-3 text-muted-foreground" />,
                  idle: <Clock className="h-3 w-3 text-muted-foreground" />,
                }[entry.status] ?? <Clock className="h-3 w-3 text-muted-foreground" />;

                const statusColor = {
                  success: 'text-primary',
                  running: 'text-blue-500',
                  failed: 'text-destructive',
                  skipped: 'text-muted-foreground',
                  timeout: 'text-orange-500',
                  pending: 'text-muted-foreground',
                  idle: 'text-muted-foreground',
                }[entry.status] ?? 'text-muted-foreground';

                return (
                  <motion.div
                    key={entry.agentId}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-2 py-1 px-2 rounded hover:bg-muted/30"
                  >
                    {statusIcon}
                    <span className={`font-medium ${statusColor}`}>{entry.agentName}</span>
                    <span className="text-muted-foreground">— {entry.status}</span>
                    {entry.durationMs && (
                      <span className="text-muted-foreground/70">
                        ({entry.durationMs < 1000 ? `${entry.durationMs}ms` : `${(entry.durationMs / 1000).toFixed(1)}s`})
                      </span>
                    )}
                    {entry.error && (
                      <span className="text-destructive truncate">· {entry.error}</span>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </Card>
      )}

      {/* Execution Summary (when complete) */}
      {isComplete && executionSummary && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="p-5 border-primary/30 bg-primary/5">
            <h3 className="font-semibold text-sm mb-3">Execution Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Duration</p>
                <p className="text-xl font-bold">{(executionSummary.totalDurationMs / 1000).toFixed(1)}s</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Agents Succeeded</p>
                <p className="text-xl font-bold text-primary">{executionSummary.agentsSucceeded}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Agents Failed</p>
                <p className="text-xl font-bold text-destructive">{executionSummary.agentsFailed}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Cache Hit Rate</p>
                <p className="text-xl font-bold">{(executionSummary.cacheStats.hitRate * 100).toFixed(0)}%</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-border/30">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-2">Stage Timings</p>
              <div className="space-y-1">
                {Object.entries(executionSummary.stageTimings).map(([stage, ms]) => (
                  <div key={stage} className="flex items-center gap-2 text-xs">
                    <span className="font-medium w-32">Stage {stage}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${Math.min((ms / executionSummary.totalDurationMs) * 100, 100)}%` }}
                      />
                    </div>
                    <span className="text-muted-foreground w-16 text-right">{(ms / 1000).toFixed(1)}s</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
