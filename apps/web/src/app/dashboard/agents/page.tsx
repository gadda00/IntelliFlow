'use client';

import { useEffect, useMemo, useState } from 'react';
import { FilterBar, type FilterField, type FilterValues } from '@/components/dashboard/FilterBar';
import { AgentCard } from '@/components/dashboard/AgentCard';
import { useApi } from '@/components/dashboard/useApi';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Brain, Cpu } from 'lucide-react';
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

const STABILITY_OPTIONS = [
  { label: 'Experimental', value: 'experimental' },
  { label: 'Beta', value: 'beta' },
  { label: 'Stable', value: 'stable' },
  { label: 'Deprecated', value: 'deprecated' },
];

const STAGE_OPTIONS = [
  { label: 'Ingest', value: 'ingest' },
  { label: 'Engineer', value: 'engineer' },
  { label: 'Detect', value: 'detect' },
  { label: 'Forecast', value: 'forecast' },
  { label: 'Infer', value: 'infer' },
  { label: 'Cluster', value: 'cluster' },
  { label: 'Report', value: 'report' },
];

// Default stability when the agent metadata doesn't expose one.
function inferStability(tier: string, stabilityFromMeta?: string): 'experimental' | 'beta' | 'stable' | 'deprecated' {
  if (stabilityFromMeta && ['experimental', 'beta', 'stable', 'deprecated'].includes(stabilityFromMeta)) {
    return stabilityFromMeta as 'experimental' | 'beta' | 'stable' | 'deprecated';
  }
  if (tier === 'experimental') return 'experimental';
  if (tier === 'core' || tier === 'advanced') return 'stable';
  return 'beta';
}

export default function AgentsPage() {
  const [filters, setFilters] = useState<FilterValues>({});
  const [stats, setStats] = useState<Record<string, AgentTrajectoryStats | null>>({});
  const [statsLoading, setStatsLoading] = useState<Record<string, boolean>>({});

  const { data: agentData, loading, error } = useApi<AgentListResponse>('/api/v7/agents');

  const filterFields: FilterField[] = useMemo(
    () => [
      { name: 'q', label: 'Search', type: 'text', placeholder: 'Name or ID…' },
      { name: 'stage', label: 'Stage', type: 'select', options: STAGE_OPTIONS },
      { name: 'stability', label: 'Stability', type: 'select', options: STABILITY_OPTIONS },
    ],
    [],
  );

  const filteredAgents = useMemo(() => {
    const list = agentData?.agents ?? [];
    return list.filter(a => {
      if (filters.stage && a.stage !== filters.stage) return false;
      const stab = inferStability(a.tier, a.stability);
      if (filters.stability && stab !== filters.stability) return false;
      if (filters.q) {
        const q = filters.q.toLowerCase();
        const matches =
          a.name.toLowerCase().includes(q) ||
          a.id.toLowerCase().includes(q) ||
          a.role.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [agentData, filters]);

  // Fetch stats for each agent in parallel (best-effort)
  useEffect(() => {
    if (!filteredAgents.length) return;
    let cancelled = false;
    const ids = filteredAgents.map(a => a.id);
    setStatsLoading(prev => {
      const next = { ...prev };
      for (const id of ids) next[id] = true;
      return next;
    });

    Promise.all(
      ids.map(async id => {
        try {
          const res = await fetch(`/api/v2/trajectory/agent/${encodeURIComponent(id)}/stats`);
          if (!res.ok) return [id, null] as const;
          const body = await res.json();
          return [id, body.data ?? null] as const;
        } catch {
          return [id, null] as const;
        }
      }),
    ).then(results => {
      if (cancelled) return;
      setStats(prev => {
        const next = { ...prev };
        for (const [id, s] of results) next[id] = s as AgentTrajectoryStats | null;
        return next;
      });
      setStatsLoading(prev => {
        const next = { ...prev };
        for (const id of ids) next[id] = false;
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [filteredAgents]);

  return (
    <>
      <DashboardPageHeader
        title="Agents"
        description="Per-agent performance, drift, and stability across all 50 agents in the v7.0 pipeline."
        badge={loading ? '…' : `${agentData?.total ?? 0} registered`}
      />

      {error && (
        <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-sm text-rose-300">
          Failed to load agents: {error}
        </div>
      )}

      <FilterBar
        fields={filterFields}
        values={filters}
        onChange={(name, value) => setFilters(prev => ({ ...prev, [name]: value }))}
        onReset={() => setFilters({})}
        className="mb-4"
      />

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <Skeleton key={i} className="h-40 w-full bg-slate-800" />
          ))}
        </div>
      ) : filteredAgents.length === 0 ? (
        <Card className="bg-slate-900/60 border-slate-800 p-12 text-center">
          <Brain className="h-10 w-10 text-slate-700 mx-auto mb-3" />
          <p className="text-sm text-slate-400">No agents match your filters.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredAgents.map(agent => {
            const s = stats[agent.id];
            const isLoading = statsLoading[agent.id] && s === undefined;
            return (
              <AgentCard
                key={agent.id}
                agentId={agent.id}
                name={agent.name}
                stage={agent.stage}
                stability={inferStability(agent.tier, agent.stability)}
                successRate={s?.successRate ?? 0}
                avgReward={s?.averageReward ?? 0}
                totalTrajectories={s?.totalTrajectories ?? 0}
                trend={s?.recentTrend?.map(t => t.averageReward)}
                driftScore={s?.recentTrend ? undefined : undefined}
                loading={isLoading}
              />
            );
          })}
        </div>
      )}

      <Card className="mt-6 bg-slate-900/40 border-slate-800 p-4">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Cpu className="h-3.5 w-3.5" />
          <span>
            Stats are fetched live from the trajectory store. Agents with no trajectories yet show zero values.
          </span>
        </div>
      </Card>
    </>
  );
}
