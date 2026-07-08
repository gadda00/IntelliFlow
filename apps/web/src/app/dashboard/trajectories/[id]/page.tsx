'use client';

import { useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useApi } from '@/components/dashboard/useApi';
import { TrajectoryTimeline } from '@/components/dashboard/TrajectoryTimeline';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft,
  Code,
  Database,
  Download,
  FileJson,
  Layers,
  ThumbsDown,
  ThumbsUp,
  Timer,
} from 'lucide-react';
import type { Trajectory, RewardSource, TrajectoryStatus } from '@busara/agents';
import { cn } from '@/lib/utils';

const STATUS_STYLES: Record<TrajectoryStatus, { label: string; className: string }> = {
  running: { label: 'RUNNING', className: 'bg-sky-500/10 text-sky-400 border-sky-500/30' },
  success: { label: 'SUCCESS', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  failed: { label: 'FAILED', className: 'bg-rose-500/10 text-rose-400 border-rose-500/30' },
  cancelled: { label: 'CANCELLED', className: 'bg-slate-500/10 text-slate-400 border-slate-500/30' },
  timeout: { label: 'TIMEOUT', className: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
};

const REWARD_SOURCE_LABELS: Record<RewardSource, string> = {
  user_thumbs_up: '👍 User Thumbs Up',
  user_thumbs_down: '👎 User Thumbs Down',
  user_cited_insight: '💬 User Cited Insight',
  user_returned: '🔄 User Returned',
  user_shared: '📤 User Shared',
  user_ignored: '🚫 User Ignored',
  quality_score: '⭐ Quality Score',
  validation_pass: '✅ Validation Pass',
  validation_fail: '❌ Validation Fail',
  peer_agreement: '🤝 Peer Agreement',
  peer_disagreement: '⚔️ Peer Disagreement',
  custom: 'Custom',
};

function formatMs(ms?: number): string {
  if (!ms || ms <= 0) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

/**
 * Minimal client-side OTel GenAI export. Mirrors the server-side
 * trajectoryToOTel from @busara/agents but with enough detail for
 * the dashboard's "Download as OTel" button.
 */
function trajectoryToOTelJSON(t: Trajectory) {
  const traceId = t.id.replace(/[^a-f0-9]/gi, '').padEnd(32, '0').slice(0, 32);
  const spans = t.steps.map(step => {
    const spanId = (step.id || String(step.stepIndex)).replace(/[^a-f0-9]/gi, '').padEnd(16, '0').slice(0, 16);
    const parentSpanId =
      step.causalParentSteps.length > 0
        ? step.causalParentSteps[0].replace(/[^a-f0-9]/gi, '').padEnd(16, '0').slice(0, 16)
        : undefined;
    const startMs = new Date(step.timestamp).getTime();
    const startTimeUnixNano = `${startMs * 1_000_000}`;
    const endTimeUnixNano = step.durationMs
      ? `${(startMs + step.durationMs) * 1_000_000}`
      : startTimeUnixNano;
    const attrs: Record<string, string | number | boolean | string[]> = {
      'gen_ai.operation.name': step.type,
      'gen_ai.agent.id': t.agentId,
      'gen_ai.agent.version': t.agentVersion,
      'trajectory.id': t.id,
      'step.index': step.stepIndex,
    };
    if (step.llmCall) {
      attrs['gen_ai.provider.name'] = step.llmCall.provider;
      attrs['gen_ai.request.model'] = step.llmCall.model;
      attrs['gen_ai.usage.input_tokens'] = step.llmCall.tokensIn;
      attrs['gen_ai.usage.output_tokens'] = step.llmCall.tokensOut;
      if (step.llmCall.cost !== undefined) attrs['llm.cost.usd'] = step.llmCall.cost;
    }
    if (step.toolCall) attrs['gen_ai.tool.name'] = step.toolCall.tool;
    return {
      traceId,
      spanId,
      parentSpanId,
      name: `${step.type} ${t.agentId}`,
      kind: step.type === 'llm_call' || step.type === 'tool_call' ? 'CLIENT' : 'INTERNAL',
      startTimeUnixNano,
      endTimeUnixNano,
      attributes: attrs,
      status: step.error
        ? { code: 'ERROR' as const, message: step.error }
        : { code: 'OK' as const },
      events: [] as Array<{ name: string; timeUnixNano: string; attributes?: Record<string, unknown> }>,
    };
  });
  return { traceId, spans };
}

function download(filename: string, content: string, mime = 'application/json') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function TrajectoryDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id ?? '';
  const { data: trajectory, loading, error } = useApi<Trajectory>(`/api/v2/trajectory/${encodeURIComponent(id)}`);

  const handleExportJSON = useCallback(() => {
    if (!trajectory) return;
    download(`trajectory-${trajectory.id}.json`, JSON.stringify(trajectory, null, 2));
  }, [trajectory]);

  const handleExportOTel = useCallback(() => {
    if (!trajectory) return;
    const otel = trajectoryToOTelJSON(trajectory);
    download(`trajectory-${trajectory.id}-otel.json`, JSON.stringify(otel, null, 2));
  }, [trajectory]);

  const handleReward = useCallback(
    async (value: number, source: RewardSource) => {
      await fetch(`/api/v2/trajectory/${encodeURIComponent(id)}/reward`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'explicit', source, value }),
      });
      // Trigger a soft refresh by reloading
      window.location.reload();
    },
    [id],
  );

  const statusStyle = trajectory ? STATUS_STYLES[trajectory.status] : null;

  return (
    <>
      <DashboardPageHeader
        title="Trajectory Detail"
        description={trajectory ? `ID: ${trajectory.id}` : 'Loading trajectory…'}
        badge={statusStyle?.label}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/dashboard/trajectories')}
              className="border-slate-700 text-slate-300"
            >
              <ArrowLeft className="h-3.5 w-3.5 mr-1" />
              Back
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportJSON}
              disabled={!trajectory}
              className="border-slate-700 text-slate-300"
            >
              <FileJson className="h-3.5 w-3.5 mr-1" />
              JSON
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportOTel}
              disabled={!trajectory}
              className="border-slate-700 text-slate-300"
            >
              <Download className="h-3.5 w-3.5 mr-1" />
              OTel
            </Button>
          </>
        }
      />

      {error && (
        <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-sm text-rose-300">
          Failed to load trajectory: {error}
        </div>
      )}

      {loading && (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full bg-slate-800" />
          <Skeleton className="h-64 w-full bg-slate-800" />
          <Skeleton className="h-64 w-full bg-slate-800" />
        </div>
      )}

      {!loading && trajectory && (
        <div className="space-y-6">
          {/* Header card */}
          <Card className="bg-slate-900/60 border-slate-800 p-5">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Agent</p>
                <p className="text-sm font-semibold text-slate-100 mt-1">{trajectory.agentId}</p>
                <p className="text-[10px] text-slate-600">v{trajectory.agentVersion} · {trajectory.agentStability}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Status</p>
                {statusStyle && (
                  <Badge variant="outline" className={cn('mt-1 text-[10px] font-semibold', statusStyle.className)}>
                    {statusStyle.label}
                  </Badge>
                )}
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Started</p>
                <p className="text-sm text-slate-300 mt-1">{new Date(trajectory.startedAt).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Duration</p>
                <p className="text-sm text-slate-300 mt-1 tabular-nums">
                  <Timer className="h-3 w-3 inline mr-1 text-slate-500" />
                  {formatMs(trajectory.metrics.totalDurationMs)}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Tokens</p>
                <p className="text-sm text-emerald-400 mt-1 tabular-nums">
                  {trajectory.metrics.totalTokens.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Cost</p>
                <p className="text-sm text-amber-400 mt-1 tabular-nums">
                  ${trajectory.metrics.estimatedCost.toFixed(4)}
                </p>
              </div>
            </div>

            {trajectory.error && (
              <div className="mt-4 rounded-md border border-rose-500/30 bg-rose-500/5 p-3 text-xs text-rose-300 font-mono">
                {trajectory.error.message}
                {trajectory.error.code && <span className="ml-2 text-rose-500">[{trajectory.error.code}]</span>}
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2 pt-3 border-t border-slate-800">
              <span className="text-xs text-slate-500 mr-2">Add reward:</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleReward(1, 'user_thumbs_up')}
                className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
              >
                <ThumbsUp className="h-3.5 w-3.5 mr-1" />
                Up
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleReward(-1, 'user_thumbs_down')}
                className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
              >
                <ThumbsDown className="h-3.5 w-3.5 mr-1" />
                Down
              </Button>
              <span className="text-xs text-slate-600 ml-2">
                {trajectory.rewards.length} reward{trajectory.rewards.length === 1 ? '' : 's'} recorded
              </span>
            </div>
          </Card>

          {/* Timeline */}
          <Card className="bg-slate-900/60 border-slate-800 p-5">
            <h2 className="font-semibold text-slate-100 mb-4 flex items-center gap-2">
              <Layers className="h-4 w-4 text-emerald-400" />
              Execution Timeline
            </h2>
            <TrajectoryTimeline trajectory={trajectory} />
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Rewards */}
            <Card className="bg-slate-900/60 border-slate-800 p-5">
              <h2 className="font-semibold text-slate-100 mb-4 flex items-center gap-2">
                <ThumbsUp className="h-4 w-4 text-emerald-400" />
                Rewards
              </h2>
              {trajectory.rewards.length === 0 ? (
                <p className="text-sm text-slate-500 italic">No rewards recorded yet.</p>
              ) : (
                <div className="space-y-2">
                  {trajectory.rewards.map((r, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3"
                    >
                      <span
                        className={cn(
                          'text-lg font-bold tabular-nums w-14',
                          r.value > 0 ? 'text-emerald-400' : r.value < 0 ? 'text-rose-400' : 'text-slate-400',
                        )}
                      >
                        {r.value > 0 ? '+' : ''}{r.value.toFixed(2)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-200">
                          {REWARD_SOURCE_LABELS[r.source] ?? r.source}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {r.type} · {new Date(r.timestamp).toLocaleString()}
                          {r.provider ? ` · ${r.provider}` : ''}
                        </p>
                        {r.text && <p className="text-xs text-slate-400 mt-1 italic">"{r.text}"</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Context snapshot */}
            <Card className="bg-slate-900/60 border-slate-800 p-5">
              <h2 className="font-semibold text-slate-100 mb-4 flex items-center gap-2">
                <Database className="h-4 w-4 text-sky-400" />
                Context Snapshot
              </h2>
              <div className="space-y-3 text-xs">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Config Hash</p>
                  <code className="text-slate-300 font-mono break-all">{trajectory.contextSnapshot.configHash}</code>
                </div>

                {trajectory.contextSnapshot.dagContext && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">DAG Context</p>
                    <div className="rounded-md bg-slate-950 border border-slate-800 p-2 space-y-0.5">
                      <p>
                        <span className="text-slate-500">Stage:</span>{' '}
                        <span className="text-slate-300">{trajectory.contextSnapshot.dagContext.stage}</span>{' '}
                        <span className="text-slate-600">#{trajectory.contextSnapshot.dagContext.stageNumber}</span>
                      </p>
                      <p>
                        <span className="text-slate-500">Available prior results:</span>{' '}
                        <span className="text-slate-300">
                          {trajectory.contextSnapshot.dagContext.availablePriorResults.length > 0
                            ? trajectory.contextSnapshot.dagContext.availablePriorResults.join(', ')
                            : '—'}
                        </span>
                      </p>
                    </div>
                  </div>
                )}

                {trajectory.contextSnapshot.systemPrompt && (
                  <details className="group">
                    <summary className="cursor-pointer text-[10px] uppercase tracking-wider text-slate-500 flex items-center gap-1 select-none">
                      <Code className="h-3 w-3" />
                      System Prompt
                    </summary>
                    <pre className="mt-1 rounded-md bg-slate-950 border border-slate-800 p-2 text-xs text-slate-300 overflow-auto max-h-40 scrollbar-thin font-mono whitespace-pre-wrap">
                      {trajectory.contextSnapshot.systemPrompt}
                    </pre>
                  </details>
                )}

                <details className="group" open>
                  <summary className="cursor-pointer text-[10px] uppercase tracking-wider text-slate-500 flex items-center gap-1 select-none">
                    <Code className="h-3 w-3" />
                    Config
                  </summary>
                  <pre className="mt-1 rounded-md bg-slate-950 border border-slate-800 p-2 text-xs text-slate-300 overflow-auto max-h-60 scrollbar-thin font-mono">
                    {JSON.stringify(trajectory.contextSnapshot.config, null, 2)}
                  </pre>
                </details>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Rows</p>
                    <p className="text-slate-300 tabular-nums">{trajectory.metadata.rowCount.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Columns</p>
                    <p className="text-slate-300 tabular-nums">{trajectory.metadata.columnCount}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Dataframe Hash</p>
                    <code className="text-slate-400 font-mono text-[10px] break-all">
                      {trajectory.metadata.dataframeHash.slice(0, 16)}…
                    </code>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">PII</p>
                    <p className={trajectory.metadata.piiDetected ? 'text-amber-400' : 'text-emerald-400'}>
                      {trajectory.metadata.piiDetected ? 'Detected' : 'None'}
                      {trajectory.metadata.piiScrubbed && ' · Scrubbed'}
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
