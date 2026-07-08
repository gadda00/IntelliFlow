'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { DataTable, type DataTableColumn } from '@/components/admin/DataTable';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { useApi } from '@/components/dashboard/useApi';
import { Badge } from '@/components/ui/badge';
import { Brain, RefreshCw } from 'lucide-react';
import type { AgentTrajectoryStats } from '@busara/agents';

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

function inferStability(
  tier: string,
  stabilityFromMeta?: string,
): 'experimental' | 'beta' | 'stable' | 'deprecated' {
  if (
    stabilityFromMeta &&
    ['experimental', 'beta', 'stable', 'deprecated'].includes(stabilityFromMeta)
  ) {
    return stabilityFromMeta as 'experimental' | 'beta' | 'stable' | 'deprecated';
  }
  if (tier === 'experimental') return 'experimental';
  if (tier === 'core' || tier === 'advanced') return 'stable';
  return 'beta';
}

interface AgentRow {
  id: string;
  name: string;
  stage: string;
  stageNumber: number;
  tier: string;
  stability: string;
  successRate: number;
  totalTrajectories: number;
  enabled: boolean;
}

const STAGE_OPTIONS = [
  { label: 'Ingest', value: 'ingest' },
  { label: 'Engineer', value: 'engineer' },
  { label: 'Detect', value: 'detect' },
  { label: 'Forecast', value: 'forecast' },
  { label: 'Infer', value: 'infer' },
  { label: 'Cluster', value: 'cluster' },
  { label: 'Report', value: 'report' },
];

const TIER_OPTIONS = [
  { label: 'Core', value: 'core' },
  { label: 'Advanced', value: 'advanced' },
  { label: 'Specialized', value: 'specialized' },
  { label: 'ML', value: 'ml' },
  { label: 'Stats', value: 'stats' },
];

const STABILITY_OPTIONS = [
  { label: 'Experimental', value: 'experimental' },
  { label: 'Beta', value: 'beta' },
  { label: 'Stable', value: 'stable' },
  { label: 'Deprecated', value: 'deprecated' },
];

export default function AdminAgentsPage() {
  const router = useRouter();
  const { data, loading, error, refetch } = useApi<AgentListResponse>('/api/v7/agents', {
    refreshMs: 60_000,
  });
  const [stats, setStats] = useState<Record<string, AgentTrajectoryStats | null>>({});

  const agents = data?.agents ?? [];

  // Fetch stats for every agent in parallel (best-effort)
  useEffect(() => {
    if (!agents.length) return;
    let cancelled = false;
    Promise.all(
      agents.map(async a => {
        try {
          const res = await fetch(`/api/v2/trajectory/agent/${encodeURIComponent(a.id)}/stats`);
          if (!res.ok) return [a.id, null] as const;
          const body = await res.json();
          return [a.id, body.data ?? null] as const;
        } catch {
          return [a.id, null] as const;
        }
      }),
    ).then(results => {
      if (cancelled) return;
      setStats(prev => {
        const next = { ...prev };
        for (const [id, s] of results) next[id] = s as AgentTrajectoryStats | null;
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [agents]);

  const rows: AgentRow[] = useMemo(() => {
    return agents.map(a => {
      const s = stats[a.id];
      const stability = inferStability(a.tier, a.stability);
      return {
        id: a.id,
        name: a.name,
        stage: a.stage,
        stageNumber: a.stageNumber,
        tier: a.tier,
        stability,
        successRate: s?.successRate ?? 0,
        totalTrajectories: s?.totalTrajectories ?? 0,
        // In the current implementation every agent is enabled by default;
        // disabled state would be persisted in an admin override once the
        // agent-update endpoint lands (see /api/v2/agents/[agentId]).
        enabled: true,
      };
    });
  }, [agents, stats]);

  const columns: DataTableColumn<AgentRow>[] = useMemo(
    () => [
      {
        key: 'id',
        header: 'Agent ID',
        render: row => (
          <Link
            href={`/admin/agents/${encodeURIComponent(row.id)}`}
            onClick={e => e.stopPropagation()}
            className="font-mono text-xs text-sky-300 hover:text-sky-200"
          >
            {row.id}
          </Link>
        ),
      },
      {
        key: 'name',
        header: 'Name',
        render: row => (
          <div>
            <p className="text-sm font-medium text-slate-100">{row.name}</p>
            <p className="text-[10px] text-slate-500">{row.id}</p>
          </div>
        ),
      },
      {
        key: 'stage',
        header: 'Stage',
        render: row => (
          <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-300">
            {row.stage}
            <span className="text-slate-600 ml-1">#{row.stageNumber}</span>
          </Badge>
        ),
        filterOptions: STAGE_OPTIONS,
      },
      {
        key: 'tier',
        header: 'Tier',
        render: row => (
          <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-400">
            {row.tier}
          </Badge>
        ),
        filterOptions: TIER_OPTIONS,
      },
      {
        key: 'stability',
        header: 'Stability',
        render: row => <StatusBadge status={row.stability} />,
        filterOptions: STABILITY_OPTIONS,
      },
      {
        key: 'successRate',
        header: 'Success Rate',
        numeric: true,
        render: row => {
          const pct = row.successRate * 100;
          const tone =
            pct >= 80 ? 'text-emerald-400' : pct < 60 ? 'text-rose-400' : 'text-amber-400';
          return (
            <span className={`text-sm font-semibold tabular-nums ${tone}`}>
              {row.totalTrajectories > 0 ? `${pct.toFixed(1)}%` : '—'}
            </span>
          );
        },
        sortValue: row => row.successRate,
      },
      {
        key: 'totalTrajectories',
        header: 'Trajectories',
        numeric: true,
        render: row => (
          <span className="text-sm text-slate-300 tabular-nums">
            {row.totalTrajectories.toLocaleString()}
          </span>
        ),
        sortValue: row => row.totalTrajectories,
      },
      {
        key: 'enabled',
        header: 'Status',
        render: row => <StatusBadge status={row.enabled ? 'enabled' : 'disabled'} />,
      },
    ],
    [],
  );

  return (
    <>
      <AdminPageHeader
        title="Agent Management"
        description="Browse, configure, and promote/demote the 33 registered Busara agents. Click an agent for the detail page."
        badge={loading ? '…' : `${data?.total ?? 0} agents`}
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
          Failed to load agents: {error}
        </div>
      )}

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={row => row.id}
        loading={loading}
        emptyState={
          <div className="flex flex-col items-center gap-2">
            <Brain className="h-10 w-10 text-slate-700" />
            <p className="text-sm text-slate-400">No agents registered.</p>
          </div>
        }
        pageSize={25}
        searchPlaceholder="Search agents by name, ID, or stage…"
        onRowClick={row => router.push(`/admin/agents/${encodeURIComponent(row.id)}`)}
      />
    </>
  );
}
