'use client';

import { useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useApi, postJson } from '@/components/dashboard/useApi';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft,
  Brain,
  Check,
  Cog,
  DollarSign,
  GitBranch,
  Sparkles,
  Timer,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  AgentTrajectoryStats,
  EvolutionAction,
  EvolutionActionType,
  TrajectorySummary,
} from '@busara/agents';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface V7Agent {
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
  stability?: string;
}

interface AgentListResponse {
  total: number;
  agents: V7Agent[];
}

interface TrajectoryListResponse {
  trajectories: TrajectorySummary[];
  total: number;
}

const CHART_AXIS = { stroke: '#475569', fontSize: 11 };
const CHART_TOOLTIP_STYLE = {
  background: 'rgb(15 23 42)',
  border: '1px solid rgb(51 65 85)',
  borderRadius: 8,
  fontSize: 12,
  color: '#e2e8f0',
};

const STABILITY_STYLES: Record<string, { label: string; className: string }> = {
  experimental: { label: 'EXPERIMENTAL', className: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  beta: { label: 'BETA', className: 'bg-sky-500/10 text-sky-400 border-sky-500/30' },
  stable: { label: 'STABLE', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  deprecated: { label: 'DEPRECATED', className: 'bg-rose-500/10 text-rose-400 border-rose-500/30' },
};

const ACTION_TYPE_LABELS: Record<EvolutionActionType, string> = {
  PROMOTE_STABILITY: 'Promote Stability',
  DEMOTE_STABILITY: 'Demote Stability',
  OPTIMIZE_CONFIG: 'Optimize Config',
  FLAG_DRIFT: 'Drift Detected',
  FLAG_LOW_REWARD: 'Low Reward',
  FLAG_HIGH_FAILURE: 'High Failure Rate',
  SCHEDULE_FINE_TUNE: 'Schedule Fine-Tune',
  SCHEDULE_PROMPT_UPDATE: 'Update Prompt',
  DEPRECATE_AGENT: 'Deprecate Agent',
  A_B_TEST_CONFIG: 'A/B Test Config',
  NONE: 'No Action',
};

function inferStability(tier: string, stabilityFromMeta?: string): 'experimental' | 'beta' | 'stable' | 'deprecated' {
  if (stabilityFromMeta && ['experimental', 'beta', 'stable', 'deprecated'].includes(stabilityFromMeta)) {
    return stabilityFromMeta as 'experimental' | 'beta' | 'stable' | 'deprecated';
  }
  if (tier === 'experimental') return 'experimental';
  if (tier === 'core' || tier === 'advanced') return 'stable';
  return 'beta';
}

function formatMs(ms: number): string {
  if (!ms || ms <= 0) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

function formatDateShort(d: string): string {
  return d.slice(5);
}

export default function AgentDetailPage() {
  const params = useParams<{ agentId: string }>();
  const router = useRouter();
  const agentId = params?.agentId ?? '';
  const encodedId = encodeURIComponent(agentId);

  // Fetch agent metadata (filter from /api/v7/agents)
  const { data: agentListData } = useApi<AgentListResponse>('/api/v7/agents');
  const agent = useMemo(
    () => agentListData?.agents.find(a => a.id === agentId),
    [agentListData, agentId],
  );

  // Fetch agent stats
  const { data: stats, loading: statsLoading, refetch: refetchStats } = useApi<AgentTrajectoryStats>(
    `/api/v2/trajectory/agent/${encodedId}/stats`,
  );

  // Fetch recent trajectories (last 5)
  const { data: recentTrj, loading: trjLoading } = useApi<TrajectoryListResponse>(
    `/api/v2/trajectory?agentId=${encodedId}&limit=5&orderBy=startedAt&orderDirection=desc`,
  );

  // Fetch evolution actions for this agent
  const { data: evolutionActions, refetch: refetchEvolution } = useApi<EvolutionAction[]>(
    `/api/v2/evolution?agentId=${encodedId}`,
  );

  const handleApprove = useCallback(
    async (action: EvolutionAction, actionIndex: number) => {
      try {
        await postJson('/api/v2/evolution', {
          actionType: 'apply',
          agentId: action.agentId,
          actionIndex,
        });
        toast.success(`Applied ${ACTION_TYPE_LABELS[action.type] ?? action.type} for ${action.agentId}`);
        setTimeout(() => void refetchEvolution(), 500);
      } catch (err) {
        toast.error('Failed to apply action', {
          description: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    },
    [refetchEvolution],
  );

  const handleReject = useCallback(
    async (action: EvolutionAction, actionIndex: number) => {
      try {
        await postJson('/api/v2/evolution', {
          actionType: 'reject',
          agentId: action.agentId,
          actionIndex,
        });
        toast.success(`Rejected ${ACTION_TYPE_LABELS[action.type] ?? action.type}`);
        setTimeout(() => void refetchEvolution(), 500);
      } catch (err) {
        toast.error('Failed to reject action', {
          description: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    },
    [refetchEvolution],
  );

  const stability = agent ? inferStability(agent.tier, agent.stability) : 'beta';
  const stabStyle = STABILITY_STYLES[stability];
  const trend = stats?.recentTrend ?? [];
  const driftAction = (evolutionActions ?? []).find(a => a.type === 'FLAG_DRIFT');
  const isDrifting = !!driftAction;
  const driftDirection = driftAction?.evidence.driftScore !== undefined
    ? (driftAction.reason.includes('improving') ? 'improving' : driftAction.reason.includes('degrading') ? 'degrading' : 'stable')
    : 'stable';

  return (
    <>
      <DashboardPageHeader
        title={agent?.name ?? agentId}
        description={agent?.role ?? `Agent ${agentId}`}
        badge={stabStyle.label}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/dashboard/agents')}
            className="border-slate-700 text-slate-300"
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            All Agents
          </Button>
        }
      />

      {/* Summary header */}
      <Card className="bg-slate-900/60 border-slate-800 p-5 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Stage</p>
            <p className="text-sm text-slate-200 mt-1">{agent?.stage ?? '—'}</p>
            {agent?.stageNumber !== undefined && <p className="text-[10px] text-slate-600">Stage #{agent.stageNumber}</p>}
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Tier</p>
            <p className="text-sm text-slate-200 mt-1">{agent?.tier ?? '—'}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Trajectories</p>
            <p className="text-sm text-emerald-400 mt-1 tabular-nums">
              {(stats?.totalTrajectories ?? 0).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Success Rate</p>
            <p className={cn('text-sm mt-1 tabular-nums', (stats?.successRate ?? 0) >= 0.8 ? 'text-emerald-400' : (stats?.successRate ?? 0) < 0.6 ? 'text-rose-400' : 'text-amber-400')}>
              {((stats?.successRate ?? 0) * 100).toFixed(1)}%
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Avg Reward</p>
            <p className={cn('text-sm mt-1 tabular-nums', (stats?.averageReward ?? 0) >= 0.1 ? 'text-emerald-400' : (stats?.averageReward ?? 0) < -0.1 ? 'text-rose-400' : 'text-slate-300')}>
              {(stats?.averageReward ?? 0).toFixed(3)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Total Cost</p>
            <p className="text-sm text-amber-400 mt-1 tabular-nums">
              ${(stats?.totalCost ?? 0).toFixed(4)}
            </p>
          </div>
        </div>

        {agent?.description && (
          <p className="mt-4 pt-4 border-t border-slate-800 text-sm text-slate-400">{agent.description}</p>
        )}

        {agent?.capabilities && agent.capabilities.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {agent.capabilities.slice(0, 12).map(c => (
              <Badge key={c} variant="outline" className="text-[10px] border-slate-700 text-slate-400">
                {c}
              </Badge>
            ))}
          </div>
        )}
      </Card>

      {/* Drift indicator */}
      <Card
        className={cn(
          'p-5 mb-6 border',
          isDrifting
            ? 'bg-amber-500/5 border-amber-500/30'
            : 'bg-emerald-500/5 border-emerald-500/30',
        )}
      >
        <div className="flex items-center gap-3">
          {isDrifting ? (
            driftDirection === 'improving' ? (
              <TrendingUp className="h-6 w-6 text-emerald-400" />
            ) : (
              <TrendingDown className="h-6 w-6 text-amber-400" />
            )
          ) : (
            <Sparkles className="h-6 w-6 text-emerald-400" />
          )}
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-100">
              {isDrifting
                ? `Performance is ${driftDirection}`
                : 'Performance is stable'}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {driftAction?.reason ?? 'No drift detected in recent vs. historical performance.'}
            </p>
          </div>
          {driftAction && (
            <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-400">
              Drift score: {(driftAction.evidence.driftScore ?? 0).toFixed(3)}
            </Badge>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* 7-day trend chart */}
        <Card className="lg:col-span-2 bg-slate-900/60 border-slate-800 p-5">
          <h2 className="font-semibold text-slate-100 mb-1">7-Day Trend</h2>
          <p className="text-xs text-slate-500 mb-4">Success rate and average reward over time</p>
          {statsLoading ? (
            <Skeleton className="h-64 w-full bg-slate-800" />
          ) : trend.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-sm text-slate-500">
              No trend data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={trend} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" tickFormatter={formatDateShort} tick={CHART_AXIS} stroke="#334155" />
                <YAxis
                  yAxisId="left"
                  domain={[0, 1]}
                  tick={CHART_AXIS}
                  stroke="#334155"
                  tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[-1, 1]}
                  tick={CHART_AXIS}
                  stroke="#334155"
                />
                <Tooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  formatter={(value: number, name: string) => {
                    if (name === 'Success Rate') return [`${(value * 100).toFixed(1)}%`, name];
                    return [value.toFixed(3), name];
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11, color: '#94a3b8' }}
                  formatter={(v: string) => <span style={{ color: '#94a3b8' }}>{v}</span>}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="successRate"
                  name="Success Rate"
                  stroke="#34d399"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#34d399' }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="averageReward"
                  name="Avg Reward"
                  stroke="#38bdf8"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#38bdf8' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Stats sidebar */}
        <Card className="bg-slate-900/60 border-slate-800 p-5">
          <h2 className="font-semibold text-slate-100 mb-4">Statistics</h2>
          {statsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => (
                <Skeleton key={i} className="h-12 w-full bg-slate-800" />
              ))}
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              <StatRow label="Avg Duration" value={formatMs(stats?.averageDurationMs ?? 0)} icon={<Timer className="h-3.5 w-3.5" />} />
              <StatRow label="Total Tokens" value={(stats?.totalTokens ?? 0).toLocaleString()} icon={<GitBranch className="h-3.5 w-3.5" />} />
              <StatRow label="Total Cost" value={`$${(stats?.totalCost ?? 0).toFixed(4)}`} icon={<DollarSign className="h-3.5 w-3.5" />} />
              <StatRow label="Success / Fail" value={`${stats?.successCount ?? 0} / ${stats?.failureCount ?? 0}`} icon={<Check className="h-3.5 w-3.5" />} />
              <StatRow label="Unique Datasets" value={String(stats?.uniqueDataframeCount ?? 0)} icon={<Brain className="h-3.5 w-3.5" />} />
              <div className="pt-3 border-t border-slate-800">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Reward Distribution</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded bg-emerald-500/5 border border-emerald-500/20 p-2">
                    <p className="text-lg font-bold text-emerald-400 tabular-nums">{stats?.rewardDistribution.positive ?? 0}</p>
                    <p className="text-[10px] text-slate-500">Positive</p>
                  </div>
                  <div className="rounded bg-slate-500/5 border border-slate-500/20 p-2">
                    <p className="text-lg font-bold text-slate-300 tabular-nums">{stats?.rewardDistribution.neutral ?? 0}</p>
                    <p className="text-[10px] text-slate-500">Neutral</p>
                  </div>
                  <div className="rounded bg-rose-500/5 border border-rose-500/20 p-2">
                    <p className="text-lg font-bold text-rose-400 tabular-nums">{stats?.rewardDistribution.negative ?? 0}</p>
                    <p className="text-[10px] text-slate-500">Negative</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent trajectories */}
        <Card className="bg-slate-900/60 border-slate-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-100">Recent Trajectories</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/dashboard/trajectories?agentId=${encodedId}`)}
              className="text-slate-400"
            >
              View all →
            </Button>
          </div>
          {trjLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-12 w-full bg-slate-800" />
              ))}
            </div>
          ) : (recentTrj?.trajectories ?? []).length === 0 ? (
            <p className="text-sm text-slate-500 italic">No trajectories recorded for this agent.</p>
          ) : (
            <div className="space-y-2">
              {(recentTrj?.trajectories ?? []).map(t => (
                <Link
                  key={t.id}
                  href={`/dashboard/trajectories/${encodeURIComponent(t.id)}`}
                  className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/40 p-2.5 hover:border-emerald-500/40 transition-colors"
                >
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[9px] font-semibold shrink-0',
                      t.status === 'success'
                        ? 'border-emerald-500/30 text-emerald-400'
                        : t.status === 'failed'
                          ? 'border-rose-500/30 text-rose-400'
                          : 'border-slate-700 text-slate-400',
                    )}
                  >
                    {t.status.toUpperCase()}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono text-slate-300 truncate">{t.id}</p>
                    <p className="text-[10px] text-slate-500">{new Date(t.startedAt).toLocaleString()}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p
                      className={cn(
                        'text-sm font-semibold tabular-nums',
                        t.averageReward > 0.1 ? 'text-emerald-400' : t.averageReward < -0.1 ? 'text-rose-400' : 'text-slate-400',
                      )}
                    >
                      {t.averageReward.toFixed(2)}
                    </p>
                    <p className="text-[10px] text-slate-600">{formatMs(t.totalDurationMs)}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* Evolution history */}
        <Card className="bg-slate-900/60 border-slate-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-100">Evolution History</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void refetchEvolution()}
              className="text-slate-400"
            >
              Refresh
            </Button>
          </div>
          {(evolutionActions ?? []).length === 0 ? (
            <div className="py-6 text-center">
              <Sparkles className="h-8 w-8 text-emerald-400/60 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No evolution actions suggested for this agent.</p>
              <p className="text-xs text-slate-600 mt-1">
                Actions appear once trajectory data accumulates.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {(evolutionActions ?? []).map((action, i) => {
                const isPending = action.status === 'pending';
                return (
                  <div
                    key={`${action.type}-${i}`}
                    className="rounded-lg border border-slate-800 bg-slate-950/40 p-3"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <Cog className="h-3.5 w-3.5 text-slate-500" />
                        <span className="text-sm font-medium text-slate-200">
                          {ACTION_TYPE_LABELS[action.type] ?? action.type}
                        </span>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[9px] font-semibold',
                          action.status === 'pending' && 'border-amber-500/30 text-amber-400',
                          action.status === 'approved' && 'border-sky-500/30 text-sky-400',
                          action.status === 'applied' && 'border-emerald-500/30 text-emerald-400',
                          action.status === 'rejected' && 'border-rose-500/30 text-rose-400',
                        )}
                      >
                        {action.status.toUpperCase()}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 mb-2">{action.reason}</p>
                    {isPending && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReject(action, i)}
                          className="h-7 text-[11px] border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
                        >
                          <X className="h-3 w-3 mr-1" /> Reject
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleApprove(action, i)}
                          className="h-7 text-[11px] bg-emerald-500/90 hover:bg-emerald-500 text-slate-950"
                        >
                          <Check className="h-3 w-3 mr-1" /> Apply
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Config insights */}
      {evolutionActions && evolutionActions.some(a => a.evidence.configInsights && a.evidence.configInsights.length > 0) && (
        <Card className="mt-6 bg-slate-900/60 border-slate-800 p-5">
          <h2 className="font-semibold text-slate-100 mb-4">Config Insights</h2>
          <div className="space-y-3">
            {evolutionActions
              .flatMap(a => a.evidence.configInsights ?? [])
              .map((insight, i) => (
                <div
                  key={i}
                  className="rounded-md bg-slate-950/40 border border-slate-800 p-3"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <code className="text-sky-300 font-semibold text-sm">{insight.configKey}</code>
                    <span className="text-slate-500 text-xs">→</span>
                    <code className="text-emerald-300 text-sm">
                      {JSON.stringify(insight.suggestedValue)}
                    </code>
                  </div>
                  <p className="text-xs text-slate-400">{insight.reason}</p>
                  <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px] text-slate-500">
                    <span>Current: <code className="text-slate-300">{JSON.stringify(insight.currentValue)}</code></span>
                    <span>High-reward uses: {insight.evidence.highRewardOccurrences}</span>
                    <span>Low-reward uses: {insight.evidence.lowRewardOccurrences}</span>
                    <span>Δ reward: <span className="text-emerald-400">+{(insight.evidence.averageRewardWithSuggested - insight.evidence.averageRewardWithCurrent).toFixed(3)}</span></span>
                  </div>
                </div>
              ))}
          </div>
        </Card>
      )}
    </>
  );
}

function StatRow({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="flex items-center gap-2 text-slate-400">
        {icon}
        {label}
      </span>
      <span className="text-slate-200 tabular-nums">{value}</span>
    </div>
  );
}
