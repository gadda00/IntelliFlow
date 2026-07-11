'use client';

import { useApi } from '@/components/dashboard/useApi';
import { StatCard } from '@/components/dashboard/StatCard';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PipelineVisualizer } from '@/components/busara/PipelineVisualizer';
import type { PipelineAgent } from '@/components/busara/PipelineVisualizer';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Brain,
  DollarSign,
  TrendingUp,
  Trophy,
} from 'lucide-react';
import Link from 'next/link';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { EvolutionAction } from '@busara/agents';

interface OverviewData {
  stats: {
    totalTrajectories: number;
    successRate: number;
    avgReward: number;
    llmCostToday: number;
  };
  trajectoriesPerDay: { date: string; count: number; successCount: number; failedCount: number }[];
  topAgents: { agentId: string; count: number }[];
  recentAlerts: EvolutionAction[];
  agentCount: number;
}

const CHART_AXIS = { stroke: '#475569', fontSize: 11 };
const CHART_TOOLTIP_STYLE = {
  background: 'rgb(15 23 42)',
  border: '1px solid rgb(51 65 85)',
  borderRadius: 8,
  fontSize: 12,
  color: '#e2e8f0',
};
const AGENT_COLORS = ['#34d399', '#38bdf8', '#a78bfa', '#fbbf24', '#fb7185'];

function formatDateShort(d: string): string {
  return d.slice(5); // MM-DD
}

export default function DashboardOverviewPage() {
  const { data, loading, error, refetch } = useApi<OverviewData>('/api/v2/dashboard/overview', {
    refreshMs: 30_000,
  });

  const stats = data?.stats;
  const trajectoriesPerDay = data?.trajectoriesPerDay ?? [];
  const topAgents = data?.topAgents ?? [];
  const recentAlerts = data?.recentAlerts ?? [];

  return (
    <>
      <DashboardPageHeader
        title="System Overview"
        description="Real-time health of the self-evolution system. Auto-refreshes every 30s."
        badge="LIVE"
        actions={
          <Button variant="outline" size="sm" onClick={() => void refetch()} className="border-slate-700 text-slate-300">
            <Activity className="h-3.5 w-3.5 mr-1.5" />
            Refresh
          </Button>
        }
      />

      {error && (
        <div className="mb-6 rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-sm text-rose-300">
          Failed to load overview: {error}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Total Trajectories"
          value={loading ? '—' : (stats?.totalTrajectories ?? 0).toLocaleString()}
          hint={`${data?.agentCount ?? 0} agents active`}
          icon={<Activity className="h-4 w-4" />}
          loading={loading}
        />
        <StatCard
          label="Success Rate"
          value={loading ? '—' : `${((stats?.successRate ?? 0) * 100).toFixed(1)}%`}
          hint="All agents, all time"
          trend={undefined}
          icon={<TrendingUp className="h-4 w-4" />}
          loading={loading}
        />
        <StatCard
          label="Avg Reward"
          value={loading ? '—' : (stats?.avgReward ?? 0).toFixed(3)}
          hint="Normalized [-1, 1]"
          icon={<Trophy className="h-4 w-4" />}
          loading={loading}
          accentClassName={(stats?.avgReward ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}
        />
        <StatCard
          label="LLM Cost Today"
          value={loading ? '—' : `$${(stats?.llmCostToday ?? 0).toFixed(4)}`}
          hint="Aggregated across providers"
          icon={<DollarSign className="h-4 w-4" />}
          loading={loading}
          trendPositiveUp={false}
          accentClassName="text-amber-400"
        />
      </div>

      {/* Pipeline Visualizer */}
      <Card className="mb-6 bg-slate-900/60 border-slate-800 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-slate-100 flex items-center gap-2">
              <Brain className="h-5 w-5 text-cyan-400" />
              Agent Pipeline Visualizer
            </h2>
            <p className="text-xs text-slate-500">Real-time DAG pipeline with 50 agents across 7 stages</p>
          </div>
          <Link href="/dashboard/agents">
            <Button variant="outline" size="sm" className="border-slate-700 text-slate-300 hover:text-cyan-400">
              Explore Agents <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </Link>
        </div>
        <div className="h-96 overflow-hidden rounded-lg border border-slate-800 bg-slate-950/50">
          <PipelineVisualizerWrapper />
        </div>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Trajectories per day — line chart */}
        <Card className="lg:col-span-2 bg-slate-900/60 border-slate-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-slate-100">Trajectories per Day</h2>
              <p className="text-xs text-slate-500">Last 7 days</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400" /> Success
              </span>
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="h-2 w-2 rounded-full bg-rose-400" /> Failed
              </span>
            </div>
          </div>
          {loading ? (
            <Skeleton className="h-64 w-full bg-slate-800" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={trajectoriesPerDay} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="g-success" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#34d399" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="g-failed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#fb7185" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#fb7185" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" tickFormatter={formatDateShort} tick={CHART_AXIS} stroke="#334155" />
                <YAxis tick={CHART_AXIS} stroke="#334155" allowDecimals={false} />
                <Tooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  labelFormatter={(l: string) => `Date: ${l}`}
                />
                <Area
                  type="monotone"
                  dataKey="successCount"
                  name="Success"
                  stroke="#34d399"
                  strokeWidth={2}
                  fill="url(#g-success)"
                />
                <Area
                  type="monotone"
                  dataKey="failedCount"
                  name="Failed"
                  stroke="#fb7185"
                  strokeWidth={2}
                  fill="url(#g-failed)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Top 5 agents — bar chart */}
        <Card className="bg-slate-900/60 border-slate-800 p-5">
          <div className="mb-4">
            <h2 className="font-semibold text-slate-100">Top Agents</h2>
            <p className="text-xs text-slate-500">By trajectory count</p>
          </div>
          {loading ? (
            <Skeleton className="h-64 w-full bg-slate-800" />
          ) : topAgents.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-sm text-slate-500">
              No trajectory data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={topAgents}
                layout="vertical"
                margin={{ top: 4, right: 16, left: 8, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                <XAxis type="number" tick={CHART_AXIS} stroke="#334155" allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="agentId"
                  tick={{ ...CHART_AXIS, fontSize: 10 }}
                  stroke="#334155"
                  width={100}
                  tickFormatter={(v: string) => (v.length > 14 ? v.slice(0, 13) + '…' : v)}
                />
                <Tooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  cursor={{ fill: '#1e293b80' }}
                />
                <Bar dataKey="count" name="Trajectories" radius={[0, 4, 4, 0]}>
                  {topAgents.map((_, i) => (
                    <Cell key={i} fill={AGENT_COLORS[i % AGENT_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Recent alerts */}
      <Card className="bg-slate-900/60 border-slate-800 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-slate-100 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              Recent Alerts
            </h2>
            <p className="text-xs text-slate-500">Drift, low-reward, and high-failure flags across all agents</p>
          </div>
          <Link href="/dashboard/evolution">
            <Button variant="ghost" size="sm" className="text-slate-300 hover:text-emerald-300">
              View all
              <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </Link>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-12 w-full bg-slate-800" />
            ))}
          </div>
        ) : recentAlerts.length === 0 ? (
          <div className="py-8 text-center">
            <Brain className="h-8 w-8 text-emerald-400/60 mx-auto mb-2" />
            <p className="text-sm text-slate-400">No active alerts. All agents are within healthy bounds.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentAlerts.map((a, i) => (
              <Link
                key={`${a.agentId}-${a.type}-${i}`}
                href="/dashboard/evolution"
                className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3 hover:border-amber-500/40 transition-colors"
              >
                <AlertTriangle
                  className={
                    a.type === 'FLAG_HIGH_FAILURE'
                      ? 'h-4 w-4 text-rose-400 shrink-0'
                      : 'h-4 w-4 text-amber-400 shrink-0'
                  }
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-200">{a.type.replace(/_/g, ' ')}</span>
                    <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-400">
                      {a.agentId}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">{a.reason}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs text-slate-500">Confidence</p>
                  <p className="text-sm font-semibold text-amber-400 tabular-nums">
                    {(a.confidence * 100).toFixed(0)}%
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}

// ─── Pipeline Visualizer Wrapper ─────────────────────────────────────
// Static demo agents for the dashboard pipeline visualization.
// In production, these would be populated from the useAgentStream hook
// connected to the /api/v7/analyze-stream SSE endpoint.

const DASHBOARD_AGENTS: PipelineAgent[] = [
  // Stage 0: Ingest
  { id: 'data_ingestion', name: 'Data Ingestion', stage: 'ingest', stageNumber: 0, dependencies: [], tier: 'core', color: '#3b82f6', icon: '📥' },
  { id: 'schema_inference', name: 'Schema Inference', stage: 'ingest', stageNumber: 0, dependencies: ['data_ingestion'], tier: 'core', color: '#3b82f6', icon: '🔤' },
  { id: 'data_profiler', name: 'Data Profiler', stage: 'ingest', stageNumber: 0, dependencies: ['data_ingestion'], tier: 'core', color: '#3b82f6', icon: '📊' },
  // Stage 1: Engineer
  { id: 'data_cleaner', name: 'Data Cleaner', stage: 'engineer', stageNumber: 1, dependencies: ['schema_inference'], tier: 'core', color: '#8b5cf6', icon: '🧹' },
  { id: 'data_engineer', name: 'Data Engineer', stage: 'engineer', stageNumber: 1, dependencies: ['data_cleaner'], tier: 'core', color: '#8b5cf6', icon: '⚙️' },
  { id: 'feature_engineer', name: 'Feature Engineer', stage: 'engineer', stageNumber: 1, dependencies: ['data_engineer'], tier: 'core', color: '#8b5cf6', icon: '🔧' },
  // Stage 2: Detect
  { id: 'anomaly_sentinel', name: 'Anomaly Sentinel', stage: 'detect', stageNumber: 2, dependencies: ['data_engineer'], tier: 'core', color: '#ef4444', icon: '🚨' },
  { id: 'analysis_strategist', name: 'Analysis Strategist', stage: 'detect', stageNumber: 2, dependencies: ['feature_engineer'], tier: 'core', color: '#ef4444', icon: '🧠' },
  { id: 'forecasting_oracle', name: 'Forecasting Oracle', stage: 'detect', stageNumber: 2, dependencies: ['feature_engineer'], tier: 'advanced', color: '#ef4444', icon: '🔮' },
  { id: 'causal_architect', name: 'Causal Architect', stage: 'detect', stageNumber: 2, dependencies: ['data_engineer'], tier: 'advanced', color: '#ef4444', icon: '🔗' },
  // Stage 3: Forecast
  { id: 'trend_detector', name: 'Trend Detector', stage: 'forecast', stageNumber: 3, dependencies: ['forecasting_oracle'], tier: 'core', color: '#f59e0b', icon: '📈' },
  { id: 'seasonality_detector', name: 'Seasonality Detector', stage: 'forecast', stageNumber: 3, dependencies: ['forecasting_oracle'], tier: 'core', color: '#f59e0b', icon: '📅' },
  { id: 'time_series_decomposition', name: 'Time Series Decomposition', stage: 'forecast', stageNumber: 3, dependencies: ['trend_detector', 'seasonality_detector'], tier: 'core', color: '#f59e0b', icon: '🧩' },
  // Stage 4: Infer
  { id: 'ab_test_significance', name: 'A/B Test Significance', stage: 'infer', stageNumber: 4, dependencies: ['data_engineer'], tier: 'core', color: '#10b981', icon: '🧪' },
  { id: 'survival_analysis', name: 'Survival Analysis', stage: 'infer', stageNumber: 4, dependencies: ['data_engineer'], tier: 'advanced', color: '#10b981', icon: '⏱️' },
  { id: 'cohort_analysis', name: 'Cohort Analysis', stage: 'infer', stageNumber: 4, dependencies: ['data_engineer'], tier: 'core', color: '#10b981', icon: '👥' },
  // Stage 5: Cluster
  { id: 'cluster_profiler', name: 'Cluster Profiler', stage: 'cluster', stageNumber: 5, dependencies: ['analysis_strategist'], tier: 'core', color: '#06b6d4', icon: '🎯' },
  { id: 'funnel_analysis', name: 'Funnel Analysis', stage: 'cluster', stageNumber: 5, dependencies: ['cohort_analysis'], tier: 'core', color: '#06b6d4', icon: '🔻' },
  // Stage 6: Report
  { id: 'insight_summarizer', name: 'Insight Summarizer', stage: 'report', stageNumber: 6, dependencies: ['anomaly_sentinel', 'trend_detector'], tier: 'core', color: '#ec4899', icon: '📝' },
  { id: 'recommendation', name: 'Recommendation', stage: 'report', stageNumber: 6, dependencies: ['insight_summarizer'], tier: 'core', color: '#ec4899', icon: '💡' },
];

function PipelineVisualizerWrapper() {
  return (
    <PipelineVisualizer
      agents={DASHBOARD_AGENTS}
      agentStatuses={{}}
      height={384}
    />
  );
}
