'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FilterBar, type FilterField, type FilterValues } from '@/components/dashboard/FilterBar';
import { useApi } from '@/components/dashboard/useApi';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowRight, ChevronLeft, ChevronRight, Eye, GitBranch } from 'lucide-react';
import type { TrajectorySummary, TrajectoryStatus } from '@busara/agents';
import { cn } from '@/lib/utils';

interface TrajectoryListResponse {
  trajectories: TrajectorySummary[];
  total: number;
  limit: number;
  offset: number;
}

interface AgentListResponse {
  agents: { id: string; name: string; stage: string; tier: string; stability: string }[];
}

const STATUS_STYLES: Record<TrajectoryStatus, { label: string; className: string }> = {
  running: { label: 'RUNNING', className: 'bg-sky-500/10 text-sky-400 border-sky-500/30' },
  success: { label: 'SUCCESS', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  failed: { label: 'FAILED', className: 'bg-rose-500/10 text-rose-400 border-rose-500/30' },
  cancelled: { label: 'CANCELLED', className: 'bg-slate-500/10 text-slate-400 border-slate-500/30' },
  timeout: { label: 'TIMEOUT', className: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
};

const STATUS_OPTIONS: { label: string; value: TrajectoryStatus }[] = [
  { label: 'Running', value: 'running' },
  { label: 'Success', value: 'success' },
  { label: 'Failed', value: 'failed' },
  { label: 'Cancelled', value: 'cancelled' },
  { label: 'Timeout', value: 'timeout' },
];

const PAGE_SIZE = 25;

function formatDuration(ms: number): string {
  if (!ms || ms <= 0) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diffMs = now - d.getTime();
  if (diffMs < 60_000) return 'just now';
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`;
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}h ago`;
  return d.toLocaleDateString();
}

export default function TrajectoriesPage() {
  const [filters, setFilters] = useState<FilterValues>({});
  const [page, setPage] = useState(0);

  // Fetch agent list for the agent selector
  const { data: agentData } = useApi<AgentListResponse>('/api/v7/agents');

  const agentOptions = useMemo(
    () =>
      (agentData?.agents ?? []).map(a => ({
        label: `${a.name} (${a.id})`,
        value: a.id,
      })),
    [agentData],
  );

  const filterFields: FilterField[] = useMemo(
    () => [
      {
        name: 'agentId',
        label: 'Agent',
        type: 'select',
        options: agentOptions,
        placeholder: 'All agents',
      },
      {
        name: 'status',
        label: 'Status',
        type: 'select',
        options: STATUS_OPTIONS.map(o => ({ label: o.label, value: o.value })),
      },
      { name: 'startDate', label: 'From', type: 'date' },
      { name: 'endDate', label: 'To', type: 'date' },
      { name: 'minReward', label: 'Min Reward', type: 'number', placeholder: '-1.0' },
    ],
    [agentOptions],
  );

  const handleFilterChange = useCallback((name: string, value: string) => {
    setFilters(prev => ({ ...prev, [name]: value }));
    setPage(0);
  }, []);

  const handleReset = useCallback(() => {
    setFilters({});
    setPage(0);
  }, []);

  // Build the query URL from filters
  const queryParams = useMemo(() => {
    const p = new URLSearchParams();
    p.set('limit', String(PAGE_SIZE));
    p.set('offset', String(page * PAGE_SIZE));
    p.set('orderBy', 'startedAt');
    p.set('orderDirection', 'desc');
    if (filters.agentId) p.set('agentId', filters.agentId);
    if (filters.status) p.set('status', filters.status);
    if (filters.startDate) p.set('startDate', new Date(filters.startDate).toISOString());
    if (filters.endDate) p.set('endDate', new Date(filters.endDate + 'T23:59:59').toISOString());
    if (filters.minReward) p.set('minReward', filters.minReward);
    return p.toString();
  }, [filters, page]);

  const { data, loading, error } = useApi<TrajectoryListResponse>(`/api/v2/trajectory?${queryParams}`);

  const trajectories = data?.trajectories ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <DashboardPageHeader
        title="Trajectories"
        description="Browse and inspect every agent execution. Click a row for the full timeline."
        badge={loading ? '…' : `${total.toLocaleString()} total`}
      />

      {error && (
        <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-sm text-rose-300">
          Failed to load trajectories: {error}
        </div>
      )}

      <FilterBar
        fields={filterFields}
        values={filters}
        onChange={handleFilterChange}
        onReset={handleReset}
        className="mb-4"
      />

      <Card className="bg-slate-900/60 border-slate-800">
        {loading ? (
          <div className="p-4 space-y-2">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <Skeleton key={i} className="h-10 w-full bg-slate-800" />
            ))}
          </div>
        ) : trajectories.length === 0 ? (
          <div className="py-16 text-center">
            <GitBranch className="h-10 w-10 text-slate-700 mx-auto mb-3" />
            <p className="text-sm text-slate-400">No trajectories match your filters.</p>
            <p className="text-xs text-slate-600 mt-1">Run an analysis to populate the trajectory store.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-slate-400 font-medium">Trajectory ID</TableHead>
                <TableHead className="text-slate-400 font-medium">Agent</TableHead>
                <TableHead className="text-slate-400 font-medium">Status</TableHead>
                <TableHead className="text-slate-400 font-medium">Started</TableHead>
                <TableHead className="text-slate-400 font-medium text-right">Duration</TableHead>
                <TableHead className="text-slate-400 font-medium text-right">Reward</TableHead>
                <TableHead className="text-slate-400 font-medium text-right">Steps</TableHead>
                <TableHead className="text-slate-400 font-medium">Tags</TableHead>
                <TableHead className="text-slate-400 font-medium text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trajectories.map(t => {
                const statusStyle = STATUS_STYLES[t.status];
                const reward = t.averageReward;
                return (
                  <TableRow
                    key={t.id}
                    className="border-slate-800 hover:bg-slate-900/60 cursor-pointer group"
                    onClick={() => (window.location.href = `/dashboard/trajectories/${encodeURIComponent(t.id)}`)}
                  >
                    <TableCell className="font-mono text-xs text-slate-300">
                      <span className="truncate inline-block max-w-[160px] align-middle">{t.id}</span>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/dashboard/agents/${encodeURIComponent(t.agentId)}`}
                        onClick={e => e.stopPropagation()}
                        className="text-sm text-sky-300 hover:text-sky-200"
                      >
                        {t.agentId}
                      </Link>
                      <p className="text-[10px] text-slate-600">v{t.agentVersion}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn('text-[10px] font-semibold', statusStyle.className)}>
                        {statusStyle.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-400">
                      {formatRelative(t.startedAt)}
                    </TableCell>
                    <TableCell className="text-right text-xs text-slate-300 tabular-nums">
                      {formatDuration(t.totalDurationMs)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={cn(
                          'text-sm font-semibold tabular-nums',
                          reward > 0.1 ? 'text-emerald-400' : reward < -0.1 ? 'text-rose-400' : 'text-slate-400',
                        )}
                      >
                        {reward.toFixed(3)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-xs text-slate-400 tabular-nums">
                      {t.stepCount}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(t.tags ?? []).slice(0, 2).map(tag => (
                          <Badge
                            key={tag}
                            variant="outline"
                            className="text-[9px] border-slate-700 text-slate-400"
                          >
                            {tag}
                          </Badge>
                        ))}
                        {(t.tags ?? []).length > 2 && (
                          <span className="text-[10px] text-slate-600">+{(t.tags ?? []).length - 2}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Eye className="h-3.5 w-3.5 text-slate-600 group-hover:text-emerald-400 inline" />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {/* Pagination */}
        {!loading && total > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800 text-xs text-slate-400">
            <span>
              Showing {page * PAGE_SIZE + 1}–{Math.min(total, (page + 1) * PAGE_SIZE)} of {total.toLocaleString()}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage(p => Math.max(0, p - 1))}
                className="border-slate-700 text-slate-300"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Prev
              </Button>
              <span className="tabular-nums">
                Page {page + 1} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                className="border-slate-700 text-slate-300"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      <div className="mt-4 flex items-center justify-end">
        <Link href="/dashboard">
          <Button variant="ghost" size="sm" className="text-slate-400">
            <ArrowRight className="h-3.5 w-3.5 rotate-180 mr-1" />
            Back to overview
          </Button>
        </Link>
      </div>
    </>
  );
}
