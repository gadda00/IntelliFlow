'use client';

import { useMemo } from 'react';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { useApi } from '@/components/dashboard/useApi';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Cpu,
  Database,
  HardDrive,
  RefreshCw,
  Server,
  Shield,
  Zap,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { cn } from '@/lib/utils';

interface ProviderHealth {
  provider: string;
  available: boolean;
  latencyMs: number | null;
  detail: string;
}

interface ErrorRecord {
  timestamp: string;
  message: string;
  code?: string;
  source?: string;
}

interface RateBucket {
  window: string;
  blocked: number;
  total: number;
}

interface SystemData {
  server: {
    status: string;
    uptimeMs: number;
    uptimeHuman: string;
    nodeVersion: string;
    platform: string;
    cpuLoadAvg: { '1m': number; '5m': number; '15m': number };
    cpuCores: number;
    memory: {
      rssMB: number;
      heapUsedMB: number;
      heapTotalMB: number;
      externalMB: number;
      systemFreeMB: number;
      systemTotalMB: number;
    };
    env: string;
    pid: number;
  };
  database: {
    status: 'ok' | 'unknown' | 'error';
    latencyMs: number | null;
    detail: string;
    url: string;
    pool: { maxSize: number; idle: number | null; inUse: number | null };
  };
  llmProviders: ProviderHealth[];
  rateLimits: {
    buckets: RateBucket[];
    blockedTotal: number;
    configured: boolean;
  };
  errors: {
    recent: ErrorRecord[];
    total: number;
  };
  agents: { total: number; ids: string[] };
  trajectories: { total: number };
  timestamp: string;
}

const CHART_AXIS = { stroke: '#475569', fontSize: 11 };
const CHART_TOOLTIP_STYLE = {
  background: 'rgb(15 23 42)',
  border: '1px solid rgb(51 65 85)',
  borderRadius: 8,
  fontSize: 12,
  color: '#e2e8f0',
};

function MetricCard({
  label,
  value,
  hint,
  icon,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: React.ReactNode;
  tone?: 'default' | 'success' | 'warning' | 'danger';
}) {
  const toneClass =
    tone === 'success'
      ? 'text-emerald-400'
      : tone === 'warning'
        ? 'text-amber-400'
        : tone === 'danger'
          ? 'text-rose-400'
          : 'text-slate-100';
  return (
    <Card className="bg-slate-900/60 border-slate-800 p-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
        <div className="h-7 w-7 rounded-md bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-300">
          {icon}
        </div>
      </div>
      <p className={cn('mt-2 text-xl font-bold tabular-nums', toneClass)}>{value}</p>
      {hint && <p className="mt-1 text-[10px] text-slate-500">{hint}</p>}
    </Card>
  );
}

export default function AdminSystemPage() {
  const { data, loading, error, refetch } = useApi<SystemData>('/api/v2/system', {
    refreshMs: 30_000,
  });

  const chartData = useMemo(() => {
    if (!data) return [];
    return data.rateLimits.buckets.map(b => ({
      time: b.window.slice(11, 16), // HH:MM
      blocked: b.blocked,
    }));
  }, [data]);

  return (
    <>
      <AdminPageHeader
        title="System Health"
        description="Server status, database pool, LLM provider latency, rate limits, and recent errors. Auto-refreshes every 30s."
        badge={data ? data.server.status.toUpperCase() : '…'}
        actions={
          <button
            onClick={() => void refetch()}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        }
      />

      {error && (
        <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-sm text-rose-300">
          Failed to load system status: {error}
        </div>
      )}

      {loading && !data ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-24 w-full bg-slate-800" />
            ))}
          </div>
          <Skeleton className="h-64 w-full bg-slate-800" />
        </div>
      ) : data ? (
        <>
          {/* Top metrics row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <MetricCard
              label="Uptime"
              value={data.server.uptimeHuman}
              hint={`Node ${data.server.nodeVersion} · PID ${data.server.pid}`}
              icon={<Activity className="h-3.5 w-3.5" />}
              tone="success"
            />
            <MetricCard
              label="Heap Used"
              value={`${data.server.memory.heapUsedMB} MB`}
              hint={`of ${data.server.memory.heapTotalMB} MB · RSS ${data.server.memory.rssMB} MB`}
              icon={<HardDrive className="h-3.5 w-3.5" />}
            />
            <MetricCard
              label="CPU Load (1m)"
              value={data.server.cpuLoadAvg['1m'].toFixed(2)}
              hint={`${data.server.cpuCores} cores · ${data.server.platform}`}
              icon={<Cpu className="h-3.5 w-3.5" />}
              tone={
                data.server.cpuLoadAvg['1m'] > data.server.cpuCores
                  ? 'warning'
                  : 'default'
              }
            />
            <MetricCard
              label="System Memory Free"
              value={`${data.server.memory.systemFreeMB} MB`}
              hint={`of ${data.server.memory.systemTotalMB} MB total`}
              icon={<Server className="h-3.5 w-3.5" />}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Database */}
            <Card className="bg-slate-900/60 border-slate-800 p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-emerald-400" />
                  <h2 className="font-semibold text-slate-100">Database</h2>
                </div>
                <StatusBadge
                  status={
                    data.database.status === 'ok'
                      ? 'connected'
                      : data.database.status === 'error'
                        ? 'failed'
                        : 'unknown'
                  }
                />
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Status</span>
                  <span className="text-slate-200">{data.database.detail}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Latency</span>
                  <span
                    className={cn(
                      'tabular-nums',
                      (data.database.latencyMs ?? 0) < 100
                        ? 'text-emerald-400'
                        : (data.database.latencyMs ?? 0) < 500
                          ? 'text-amber-400'
                          : 'text-rose-400',
                    )}
                  >
                    {data.database.latencyMs !== null ? `${data.database.latencyMs} ms` : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">URL</span>
                  <code className="text-[11px] text-slate-500">{data.database.url}</code>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Pool max size</span>
                  <span className="text-slate-200 tabular-nums">{data.database.pool.maxSize}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Idle / in-use</span>
                  <span className="text-slate-500 tabular-nums">
                    {data.database.pool.idle ?? '—'} / {data.database.pool.inUse ?? '—'}
                  </span>
                </div>
                <p className="pt-2 border-t border-slate-800 text-[10px] text-slate-600">
                  Prisma doesn&apos;t expose live pool counters; only the configured max is reported.
                  In production, wire this to a <code>pg_stat_database</code> query.
                </p>
              </div>
            </Card>

            {/* LLM providers */}
            <Card className="bg-slate-900/60 border-slate-800 p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-400" />
                  <h2 className="font-semibold text-slate-100">LLM Providers</h2>
                </div>
                <span className="text-xs text-slate-500">
                  {data.llmProviders.filter(p => p.available).length} / {data.llmProviders.length} available
                </span>
              </div>
              <div className="space-y-2">
                {data.llmProviders.map(p => (
                  <div
                    key={p.provider}
                    className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-950/40 p-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'h-2 w-2 rounded-full',
                          p.available ? 'bg-emerald-400' : 'bg-rose-400',
                        )}
                      />
                      <span className="text-sm text-slate-200">{p.provider}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-slate-500 truncate max-w-[200px]">
                        {p.detail}
                      </span>
                      <span
                        className={cn(
                          'text-xs tabular-nums',
                          p.latencyMs === null
                            ? 'text-slate-600'
                            : p.latencyMs < 500
                              ? 'text-emerald-400'
                              : p.latencyMs < 2000
                                ? 'text-amber-400'
                                : 'text-rose-400',
                        )}
                      >
                        {p.latencyMs !== null ? `${p.latencyMs} ms` : '—'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Rate limit chart */}
          <Card className="bg-slate-900/60 border-slate-800 p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-sky-400" />
                <h2 className="font-semibold text-slate-100">Rate Limit Blocks</h2>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <Badge
                  variant="outline"
                  className={
                    data.rateLimits.configured
                      ? 'border-emerald-500/30 text-emerald-400 text-[10px]'
                      : 'border-amber-500/30 text-amber-400 text-[10px]'
                  }
                >
                  {data.rateLimits.configured ? 'Redis configured' : 'Redis NOT configured'}
                </Badge>
                <span className="text-slate-400">
                  {data.rateLimits.blockedTotal} blocked (last {data.rateLimits.buckets.length} min)
                </span>
              </div>
            </div>
            {chartData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-sm text-slate-500">
                No rate-limit blocks recorded in this process.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="g-blocked" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#fb7185" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#fb7185" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="time" tick={CHART_AXIS} stroke="#334155" />
                  <YAxis tick={CHART_AXIS} stroke="#334155" allowDecimals={false} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                  <Area
                    type="monotone"
                    dataKey="blocked"
                    name="Blocked requests"
                    stroke="#fb7185"
                    strokeWidth={2}
                    fill="url(#g-blocked)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* Recent errors */}
          <Card className="bg-slate-900/60 border-slate-800 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-rose-400" />
                <h2 className="font-semibold text-slate-100">Recent Errors</h2>
              </div>
              <span className="text-xs text-slate-500">
                {data.errors.total} recorded (process-level ring buffer)
              </span>
            </div>
            {data.errors.recent.length === 0 ? (
              <div className="py-8 text-center">
                <AlertTriangle className="h-8 w-8 text-emerald-400/60 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No errors recorded in this process.</p>
                <p className="text-xs text-slate-600 mt-1">
                  Errors are pushed here by API routes via the <code>recordError()</code> helper.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto scrollbar-thin">
                {data.errors.recent.map((err, i) => (
                  <div
                    key={`${err.timestamp}-${i}`}
                    className="flex items-start gap-3 rounded-md border border-slate-800 bg-slate-950/40 p-2.5"
                  >
                    <AlertCircle className="h-3.5 w-3.5 text-rose-400 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {err.code && (
                          <code className="text-[10px] text-rose-300 bg-rose-500/10 px-1.5 py-0.5 rounded">
                            {err.code}
                          </code>
                        )}
                        {err.source && (
                          <span className="text-[10px] text-slate-500">from {err.source}</span>
                        )}
                        <span className="text-[10px] text-slate-600 ml-auto">
                          {new Date(err.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1 break-words">{err.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Footer info */}
          <Card className="mt-6 bg-slate-900/40 border-slate-800 p-3">
            <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-500">
              <span>
                <strong className="text-slate-400">Agents registered:</strong>{' '}
                {data.agents.total}
              </span>
              <span>
                <strong className="text-slate-400">Trajectories:</strong>{' '}
                {data.trajectories.total.toLocaleString()}
              </span>
              <span>
                <strong className="text-slate-400">Last refreshed:</strong>{' '}
                {new Date(data.timestamp).toLocaleString()}
              </span>
              <span className="ml-auto">
                <strong className="text-slate-400">Env:</strong> {data.server.env}
              </span>
            </div>
          </Card>
        </>
      ) : null}
    </>
  );
}
