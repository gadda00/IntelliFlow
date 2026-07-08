'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { useApi, postJson } from '@/components/dashboard/useApi';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  ArrowLeft,
  Brain,
  Check,
  Cog,
  DollarSign,
  GitBranch,
  Save,
  Sparkles,
  Timer,
  TrendingDown,
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

interface AgentDetail {
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
  stability: 'experimental' | 'beta' | 'stable' | 'deprecated';
  enabled: boolean;
  configDefaults: Record<string, unknown>;
  overrideUpdatedAt?: string;
  stats: AgentTrajectoryStats;
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

function formatMs(ms: number): string {
  if (!ms || ms <= 0) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

function formatDateShort(d: string): string {
  return d.slice(5);
}

function safeStringify(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default function AdminAgentDetailPage() {
  const params = useParams<{ agentId: string }>();
  const router = useRouter();
  const agentId = params?.agentId ?? '';
  const encodedId = encodeURIComponent(agentId);

  const { data: agent, loading, error, refetch } = useApi<AgentDetail>(`/api/v2/agents/${encodedId}`, {
    refreshMs: 60_000,
  });

  const { data: recentTrj, loading: trjLoading } = useApi<TrajectoryListResponse>(
    `/api/v2/trajectory?agentId=${encodedId}&limit=5&orderBy=startedAt&orderDirection=desc`,
  );

  const { data: evolutionActions, refetch: refetchEvolution } = useApi<EvolutionAction[]>(
    `/api/v2/evolution?agentId=${encodedId}`,
  );

  // Editable form state (driven from fetched agent data)
  const [stability, setStability] = useState<string>('');
  const [enabled, setEnabled] = useState<boolean>(true);
  const [configDraft, setConfigDraft] = useState<string>('');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDisable, setConfirmDisable] = useState(false);

  // Sync form state once data loads
  useEffect(() => {
    if (agent) {
      setStability(agent.stability);
      setEnabled(agent.enabled);
      setConfigDraft(safeStringify(agent.configDefaults ?? {}));
      setDirty(false);
    }
  }, [agent]);

  const handleSave = useCallback(async () => {
    if (!agent) return;
    setSaving(true);
    try {
      let parsedConfig: Record<string, unknown> | undefined;
      if (configDraft.trim()) {
        try {
          parsedConfig = JSON.parse(configDraft);
        } catch {
          toast.error('Config defaults must be valid JSON');
          setSaving(false);
          return;
        }
      }
      await postJson(`/api/v2/agents/${encodedId}`, {
        stability: stability as 'experimental' | 'beta' | 'stable' | 'deprecated',
        enabled,
        configDefaults: parsedConfig ?? {},
        updatedBy: 'admin-console',
      });
      toast.success(`Saved changes to ${agent.name}`);
      setDirty(false);
      setTimeout(() => void refetch(), 250);
    } catch (err) {
      toast.error('Failed to save', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setSaving(false);
    }
  }, [agent, configDraft, enabled, encodedId, refetch, stability]);

  const handleApprove = useCallback(
    async (action: EvolutionAction, actionIndex: number) => {
      try {
        await postJson('/api/v2/evolution', {
          actionType: 'apply',
          agentId: action.agentId,
          actionIndex,
        });
        toast.success(`Applied ${ACTION_TYPE_LABELS[action.type] ?? action.type}`);
        setTimeout(() => void refetchEvolution(), 250);
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
        setTimeout(() => void refetchEvolution(), 250);
      } catch (err) {
        toast.error('Failed to reject action', {
          description: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    },
    [refetchEvolution],
  );

  if (error) {
    return (
      <>
        <AdminPageHeader title="Agent not found" description={agentId} />
        <Card className="bg-slate-900/60 border-slate-800 p-8 text-center">
          <p className="text-sm text-rose-300">{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/admin/agents')}
            className="mt-4 border-slate-700 text-slate-300"
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            Back to agents
          </Button>
        </Card>
      </>
    );
  }

  const stats = agent?.stats;
  const trend = stats?.recentTrend ?? [];
  const driftAction = (evolutionActions ?? []).find(a => a.type === 'FLAG_DRIFT');
  const isDrifting = !!driftAction;

  return (
    <>
      <AdminPageHeader
        title={agent?.name ?? agentId}
        description={agent?.role ?? `Agent ${agentId}`}
        badge={agent ? agent.stability.toUpperCase() : '…'}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/admin/agents')}
            className="border-slate-700 text-slate-300"
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            All Agents
          </Button>
        }
      />

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full bg-slate-800" />
          <Skeleton className="h-64 w-full bg-slate-800" />
        </div>
      ) : agent ? (
        <>
          {/* Summary header */}
          <Card className="bg-slate-900/60 border-slate-800 p-5 mb-6">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Stage</p>
                <p className="text-sm text-slate-200 mt-1">{agent.stage}</p>
                <p className="text-[10px] text-slate-600">Stage #{agent.stageNumber}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Tier</p>
                <p className="text-sm text-slate-200 mt-1">{agent.tier}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Trajectories</p>
                <p className="text-sm text-emerald-400 mt-1 tabular-nums">
                  {(stats?.totalTrajectories ?? 0).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Success Rate</p>
                <p
                  className={cn(
                    'text-sm mt-1 tabular-nums',
                    (stats?.successRate ?? 0) >= 0.8
                      ? 'text-emerald-400'
                      : (stats?.successRate ?? 0) < 0.6
                        ? 'text-rose-400'
                        : 'text-amber-400',
                  )}
                >
                  {((stats?.successRate ?? 0) * 100).toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Avg Reward</p>
                <p
                  className={cn(
                    'text-sm mt-1 tabular-nums',
                    (stats?.averageReward ?? 0) >= 0.1
                      ? 'text-emerald-400'
                      : (stats?.averageReward ?? 0) < -0.1
                        ? 'text-rose-400'
                        : 'text-slate-300',
                  )}
                >
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

            {agent.description && (
              <p className="mt-4 pt-4 border-t border-slate-800 text-sm text-slate-400">
                {agent.description}
              </p>
            )}

            {agent.capabilities && agent.capabilities.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {agent.capabilities.slice(0, 12).map(c => (
                  <Badge key={c} variant="outline" className="text-[10px] border-slate-700 text-slate-400">
                    {c}
                  </Badge>
                ))}
              </div>
            )}

            {agent.dependencies && agent.dependencies.length > 0 && (
              <p className="mt-3 text-[11px] text-slate-500">
                <span className="font-semibold">Dependencies:</span>{' '}
                {agent.dependencies.map(d => (
                  <Link
                    key={d}
                    href={`/admin/agents/${encodeURIComponent(d)}`}
                    className="text-sky-300 hover:text-sky-200 mr-1.5"
                  >
                    {d}
                  </Link>
                ))}
              </p>
            )}
          </Card>

          {/* Admin controls */}
          <Card className="bg-slate-900/60 border-slate-800 p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold text-slate-100">Admin Controls</h2>
                <p className="text-xs text-slate-500">
                  Change agent stability, enable/disable, or override config defaults.
                  {agent.overrideUpdatedAt && (
                    <span className="ml-1.5 text-slate-600">
                      · Last override: {new Date(agent.overrideUpdatedAt).toLocaleString()}
                    </span>
                  )}
                </p>
              </div>
              <Button
                onClick={handleSave}
                disabled={!dirty || saving}
                className="bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40"
                size="sm"
              >
                <Save className="h-3.5 w-3.5 mr-1" />
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Stability selector */}
              <div>
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Stability Tier
                </label>
                <Select
                  value={stability}
                  onValueChange={v => {
                    setStability(v);
                    setDirty(true);
                  }}
                >
                  <SelectTrigger className="mt-1.5 bg-slate-950/60 border-slate-700 text-slate-100">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700">
                    <SelectItem value="experimental">Experimental</SelectItem>
                    <SelectItem value="beta">Beta</SelectItem>
                    <SelectItem value="stable">Stable</SelectItem>
                    <SelectItem value="deprecated">Deprecated</SelectItem>
                  </SelectContent>
                </Select>
                <div className="mt-2">
                  <StatusBadge status={stability} />
                </div>
              </div>

              {/* Enable/disable */}
              <div>
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Enabled
                </label>
                <div className="mt-1.5 flex items-center gap-3 h-9 rounded-md border border-slate-700 bg-slate-950/60 px-3">
                  <Switch
                    checked={enabled}
                    onCheckedChange={v => {
                      if (!v) {
                        // Destructive — show confirm
                        setConfirmDisable(true);
                      } else {
                        setEnabled(true);
                        setDirty(true);
                      }
                    }}
                  />
                  <span className={cn('text-sm', enabled ? 'text-emerald-400' : 'text-rose-400')}>
                    {enabled ? 'Active in pool' : 'Disabled — will not execute'}
                  </span>
                </div>
                <p className="mt-2 text-[10px] text-slate-500">
                  Disabling removes the agent from the orchestrator&apos;s pool.
                </p>
              </div>

              {/* Config defaults editor */}
              <div className="lg:col-span-1">
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Config Defaults (JSON)
                </label>
                <Textarea
                  value={configDraft}
                  onChange={e => {
                    setConfigDraft(e.target.value);
                    setDirty(true);
                  }}
                  rows={5}
                  placeholder='{\n  "threshold": 0.5\n}'
                  className="mt-1.5 font-mono text-xs bg-slate-950/60 border-slate-700 text-slate-100"
                />
              </div>
            </div>
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
                <TrendingDown className="h-6 w-6 text-amber-400" />
              ) : (
                <Sparkles className="h-6 w-6 text-emerald-400" />
              )}
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-100">
                  {isDrifting ? 'Drift detected in recent performance' : 'Performance is stable'}
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
            {/* 7-day trend */}
            <Card className="lg:col-span-2 bg-slate-900/60 border-slate-800 p-5">
              <h2 className="font-semibold text-slate-100 mb-1">7-Day Performance Trend</h2>
              <p className="text-xs text-slate-500 mb-4">Success rate (left) and average reward (right)</p>
              {trend.length === 0 ? (
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
              <h2 className="font-semibold text-slate-100 mb-4">Trajectory Stats</h2>
              <div className="space-y-3 text-sm">
                <StatRow label="Avg Duration" value={formatMs(stats?.averageDurationMs ?? 0)} icon={<Timer className="h-3.5 w-3.5" />} />
                <StatRow label="Total Tokens" value={(stats?.totalTokens ?? 0).toLocaleString()} icon={<GitBranch className="h-3.5 w-3.5" />} />
                <StatRow label="Total Cost" value={`$${(stats?.totalCost ?? 0).toFixed(4)}`} icon={<DollarSign className="h-3.5 w-3.5" />} />
                <StatRow
                  label="Success / Fail"
                  value={`${stats?.successCount ?? 0} / ${stats?.failureCount ?? 0}`}
                  icon={<Check className="h-3.5 w-3.5" />}
                />
                <StatRow
                  label="Unique Datasets"
                  value={String(stats?.uniqueDataframeCount ?? 0)}
                  icon={<Brain className="h-3.5 w-3.5" />}
                />
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
                  onClick={() => router.push(`/admin/trajectories?agentId=${encodedId}`)}
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
                      href={`/admin/trajectories`}
                      className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/40 p-2.5 hover:border-emerald-500/40 transition-colors"
                    >
                      <StatusBadge
                        status={t.status}
                        className="shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-mono text-slate-300 truncate">{t.id}</p>
                        <p className="text-[10px] text-slate-500">{new Date(t.startedAt).toLocaleString()}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p
                          className={cn(
                            'text-sm font-semibold tabular-nums',
                            t.averageReward > 0.1
                              ? 'text-emerald-400'
                              : t.averageReward < -0.1
                                ? 'text-rose-400'
                                : 'text-slate-400',
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
                <h2 className="font-semibold text-slate-100">Evolution Actions</h2>
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
                  <p className="text-xs text-slate-600 mt-1">Actions appear once trajectory data accumulates.</p>
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
                          <StatusBadge status={action.status} />
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
        </>
      ) : null}

      <ConfirmDialog
        open={confirmDisable}
        onOpenChange={setConfirmDisable}
        title={`Disable ${agent?.name ?? agentId}?`}
        description={
          <>
            Disabling the agent will remove it from the orchestrator&apos;s pool. Existing
            trajectories remain queryable but new executions will fail with{' '}
            <code className="text-rose-300">AGENT_DISABLED</code>. You can re-enable
            it at any time.
          </>
        }
        confirmLabel="Disable agent"
        onConfirm={() => {
          setEnabled(false);
          setDirty(true);
          setConfirmDisable(false);
          toast.info(`Marked ${agent?.name ?? agentId} for disable. Click Save to persist.`);
        }}
      />
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
