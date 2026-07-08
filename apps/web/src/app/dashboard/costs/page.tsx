'use client';

import { useMemo } from 'react';
import { useApi } from '@/components/dashboard/useApi';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Cpu } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface CostRow {
  date: string;
  cost: number;
  tokensIn: number;
  tokensOut: number;
}

interface CostsData {
  totalCostMonth: number;
  tokensTotal: number;
  tokensIn: number;
  tokensOut: number;
  costByProvider: Record<string, number>;
  tokensByProvider: Record<string, { in: number; out: number }>;
  topAgentsByCost: { agentId: string; cost: number }[];
  dailyCostTrend: CostRow[];
}

const CHART_AXIS = { stroke: '#475569', fontSize: 11 };
const CHART_TOOLTIP_STYLE = {
  background: 'rgb(15 23 42)',
  border: '1px solid rgb(51 65 85)',
  borderRadius: 8,
  fontSize: 12,
  color: '#e2e8f0',
};

const PROVIDER_COLORS: Record<string, string> = {
  glm: '#34d399',
  openai: '#38bdf8',
  anthropic: '#a78bfa',
  google: '#fbbf24',
  unknown: '#64748b',
};

const PIE_COLORS = ['#34d399', '#38bdf8', '#a78bfa', '#fbbf24', '#fb7185', '#64748b'];

function formatCurrency(v: number): string {
  if (v === 0) return '$0.00';
  if (v < 0.01) return `$${v.toFixed(4)}`;
  return `$${v.toFixed(2)}`;
}

function formatTokens(v: number): string {
  if (v < 1000) return v.toString();
  if (v < 1_000_000) return `${(v / 1000).toFixed(1)}K`;
  return `${(v / 1_000_000).toFixed(2)}M`;
}

function providerLabel(p: string): string {
  const map: Record<string, string> = {
    glm: 'GLM (Zhipu)',
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    google: 'Google',
    unknown: 'Unknown',
  };
  return map[p.toLowerCase()] ?? p;
}

function formatDateShort(d: string): string {
  return d.slice(5);
}

export default function CostsPage() {
  const { data, loading, error } = useApi<CostsData>('/api/v2/dashboard/costs');

  const costByProviderData = useMemo(
    () =>
      Object.entries(data?.costByProvider ?? {}).map(([provider, cost]) => ({
        name: providerLabel(provider),
        provider,
        cost,
      })),
    [data],
  );

  const tokenBreakdownData = useMemo(() => {
    if (!data) return [];
    return [
      { name: 'Input Tokens', value: data.tokensIn, color: '#34d399' },
      { name: 'Output Tokens', value: data.tokensOut, color: '#38bdf8' },
    ];
  }, [data]);

  const tokensByProviderData = useMemo(
    () =>
      Object.entries(data?.tokensByProvider ?? {}).map(([provider, t]) => ({
        name: providerLabel(provider),
        provider,
        in: t.in,
        out: t.out,
      })),
    [data],
  );

  return (
    <>
      <DashboardPageHeader
        title="LLM Costs"
        description="Spending across all LLM providers, agents, and time. Computed from trajectory metrics."
        badge="MTD"
      />

      {error && (
        <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-sm text-rose-300">
          Failed to load costs: {error}
        </div>
      )}

      {/* Top stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="bg-slate-900/60 border-slate-800 p-5">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total This Month</p>
          {loading ? (
            <Skeleton className="h-8 w-32 mt-2 bg-slate-800" />
          ) : (
            <p className="mt-2 text-3xl font-bold text-amber-400 tabular-nums">
              {formatCurrency(data?.totalCostMonth ?? 0)}
            </p>
          )}
          <p className="mt-1 text-xs text-slate-600">Across all providers</p>
        </Card>

        <Card className="bg-slate-900/60 border-slate-800 p-5">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Tokens</p>
          {loading ? (
            <Skeleton className="h-8 w-32 mt-2 bg-slate-800" />
          ) : (
            <p className="mt-2 text-3xl font-bold text-emerald-400 tabular-nums">
              {formatTokens(data?.tokensTotal ?? 0)}
            </p>
          )}
          <p className="mt-1 text-xs text-slate-600">Input + Output</p>
        </Card>

        <Card className="bg-slate-900/60 border-slate-800 p-5">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Input Tokens</p>
          {loading ? (
            <Skeleton className="h-8 w-32 mt-2 bg-slate-800" />
          ) : (
            <p className="mt-2 text-3xl font-bold text-emerald-400 tabular-nums">
              {formatTokens(data?.tokensIn ?? 0)}
            </p>
          )}
          <p className="mt-1 text-xs text-slate-600">Prompt-side</p>
        </Card>

        <Card className="bg-slate-900/60 border-slate-800 p-5">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Output Tokens</p>
          {loading ? (
            <Skeleton className="h-8 w-32 mt-2 bg-slate-800" />
          ) : (
            <p className="mt-2 text-3xl font-bold text-sky-400 tabular-nums">
              {formatTokens(data?.tokensOut ?? 0)}
            </p>
          )}
          <p className="mt-1 text-xs text-slate-600">Completion-side</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Daily cost trend — 30 days */}
        <Card className="lg:col-span-2 bg-slate-900/60 border-slate-800 p-5">
          <h2 className="font-semibold text-slate-100 mb-1">Daily Cost Trend</h2>
          <p className="text-xs text-slate-500 mb-4">Last 30 days</p>
          {loading ? (
            <Skeleton className="h-64 w-full bg-slate-800" />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={data?.dailyCostTrend ?? []} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="g-cost" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#fbbf24" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" tickFormatter={formatDateShort} tick={CHART_AXIS} stroke="#334155" />
                <YAxis tick={CHART_AXIS} stroke="#334155" tickFormatter={(v: number) => `$${v.toFixed(2)}`} />
                <Tooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  formatter={(value: number) => [formatCurrency(value), 'Cost']}
                  labelFormatter={(l: string) => `Date: ${l}`}
                />
                <Line
                  type="monotone"
                  dataKey="cost"
                  name="Cost (USD)"
                  stroke="#fbbf24"
                  strokeWidth={2}
                  dot={{ r: 2, fill: '#fbbf24' }}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Cost by provider — pie */}
        <Card className="bg-slate-900/60 border-slate-800 p-5">
          <h2 className="font-semibold text-slate-100 mb-1">By Provider</h2>
          <p className="text-xs text-slate-500 mb-4">Cost share this month</p>
          {loading ? (
            <Skeleton className="h-64 w-full bg-slate-800" />
          ) : costByProviderData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-sm text-slate-500">No cost data</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={costByProviderData}
                  dataKey="cost"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  innerRadius={48}
                  paddingAngle={2}
                >
                  {costByProviderData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={PROVIDER_COLORS[entry.provider.toLowerCase()] ?? PIE_COLORS[i % PIE_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  formatter={(value: number, _name, props) => [
                    formatCurrency(value),
                    props?.payload?.name ?? 'Provider',
                  ]}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11, color: '#94a3b8' }}
                  formatter={(v: string) => <span style={{ color: '#94a3b8' }}>{v}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top agents by cost */}
        <Card className="bg-slate-900/60 border-slate-800 p-5">
          <h2 className="font-semibold text-slate-100 mb-1">Cost by Agent</h2>
          <p className="text-xs text-slate-500 mb-4">Top 10 by spend</p>
          {loading ? (
            <Skeleton className="h-64 w-full bg-slate-800" />
          ) : (data?.topAgentsByCost ?? []).length === 0 ? (
            <div className="h-64 flex items-center justify-center text-sm text-slate-500">No agent cost data</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={data?.topAgentsByCost ?? []}
                layout="vertical"
                margin={{ top: 4, right: 16, left: 8, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                <XAxis type="number" tick={CHART_AXIS} stroke="#334155" tickFormatter={(v: number) => `$${v.toFixed(2)}`} />
                <YAxis
                  type="category"
                  dataKey="agentId"
                  tick={{ ...CHART_AXIS, fontSize: 10 }}
                  stroke="#334155"
                  width={120}
                  tickFormatter={(v: string) => (v.length > 16 ? v.slice(0, 15) + '…' : v)}
                />
                <Tooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  cursor={{ fill: '#1e293b80' }}
                  formatter={(value: number) => [formatCurrency(value), 'Cost']}
                />
                <Bar dataKey="cost" name="Cost (USD)" radius={[0, 4, 4, 0]} fill="#fbbf24" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Tokens by provider */}
        <Card className="bg-slate-900/60 border-slate-800 p-5">
          <h2 className="font-semibold text-slate-100 mb-1">Token Usage by Provider</h2>
          <p className="text-xs text-slate-500 mb-4">Input vs. Output, this month</p>
          {loading ? (
            <Skeleton className="h-64 w-full bg-slate-800" />
          ) : tokensByProviderData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-sm text-slate-500">No token data</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={tokensByProviderData} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" tick={CHART_AXIS} stroke="#334155" />
                <YAxis tick={CHART_AXIS} stroke="#334155" tickFormatter={(v: number) => formatTokens(v)} />
                <Tooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  formatter={(value: number, name: string) => [formatTokens(value), name]}
                  cursor={{ fill: '#1e293b80' }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11, color: '#94a3b8' }}
                  formatter={(v: string) => <span style={{ color: '#94a3b8' }}>{v}</span>}
                />
                <Bar dataKey="in" name="Input" stackId="a" fill="#34d399" radius={[0, 0, 0, 0]} />
                <Bar dataKey="out" name="Output" stackId="a" fill="#38bdf8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Input vs output split summary */}
      <Card className="mt-6 bg-slate-900/40 border-slate-800 p-5">
        <div className="flex items-center gap-3 mb-3">
          <Cpu className="h-4 w-4 text-slate-500" />
          <h2 className="font-semibold text-slate-100">Token Usage Breakdown</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-md bg-slate-950/40 border border-slate-800 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Input Tokens
              </span>
              <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400">
                {((data?.tokensIn ?? 0) / Math.max(1, data?.tokensTotal ?? 1) * 100).toFixed(1)}%
              </Badge>
            </div>
            <p className="text-2xl font-bold text-emerald-400 tabular-nums">
              {formatTokens(data?.tokensIn ?? 0)}
            </p>
            <div className="mt-2 h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-emerald-400"
                style={{ width: `${((data?.tokensIn ?? 0) / Math.max(1, data?.tokensTotal ?? 1) * 100).toFixed(1)}%` }}
              />
            </div>
          </div>
          <div className="rounded-md bg-slate-950/40 border border-slate-800 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-sky-400" />
                Output Tokens
              </span>
              <Badge variant="outline" className="text-[10px] border-sky-500/30 text-sky-400">
                {((data?.tokensOut ?? 0) / Math.max(1, data?.tokensTotal ?? 1) * 100).toFixed(1)}%
              </Badge>
            </div>
            <p className="text-2xl font-bold text-sky-400 tabular-nums">
              {formatTokens(data?.tokensOut ?? 0)}
            </p>
            <div className="mt-2 h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-sky-400"
                style={{ width: `${((data?.tokensOut ?? 0) / Math.max(1, data?.tokensTotal ?? 1) * 100).toFixed(1)}%` }}
              />
            </div>
          </div>
        </div>
      </Card>
    </>
  );
}
