'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { DataTable, type DataTableColumn } from '@/components/admin/DataTable';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { useApi, postJson } from '@/components/dashboard/useApi';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Download,
  GitBranch,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import type { TrajectorySummary, TrajectoryStatus } from '@busara/agents';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface TrajectoryListResponse {
  trajectories: TrajectorySummary[];
  total: number;
  limit: number;
  offset: number;
}

interface AgentListResponse {
  total: number;
  agents: { id: string; name: string; stage: string; tier: string }[];
}

interface TrajectoryRow {
  id: string;
  agentId: string;
  agentVersion: string;
  status: TrajectoryStatus;
  startedAt: string;
  totalDurationMs: number;
  averageReward: number;
  stepCount: number;
  tags: string[];
}

const STATUS_OPTIONS: { label: string; value: string }[] = [
  { label: 'Running', value: 'running' },
  { label: 'Success', value: 'success' },
  { label: 'Failed', value: 'failed' },
  { label: 'Cancelled', value: 'cancelled' },
  { label: 'Timeout', value: 'timeout' },
];

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

export default function AdminTrajectoriesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialAgentId = searchParams?.get('agentId') ?? '';

  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [confirmDeleteOne, setConfirmDeleteOne] = useState<TrajectoryRow | null>(null);
  const [confirmDeleteMany, setConfirmDeleteMany] = useState(false);
  const [confirmExport, setConfirmExport] = useState<'all' | 'selected' | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Build query URL — pull agentId from the URL (?agentId=...) so deep-linking works
  const queryParams = useMemo(() => {
    const p = new URLSearchParams();
    p.set('limit', '100');
    p.set('offset', '0');
    p.set('orderBy', 'startedAt');
    p.set('orderDirection', 'desc');
    if (initialAgentId) p.set('agentId', initialAgentId);
    return p.toString();
  }, [initialAgentId, refreshKey]);

  const { data, loading, error, refetch } = useApi<TrajectoryListResponse>(
    `/api/v2/trajectory?${queryParams}`,
    { refreshMs: 60_000 },
  );

  const { data: agentData } = useApi<AgentListResponse>('/api/v7/agents');
  const agentMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of agentData?.agents ?? []) m.set(a.id, a.name);
    return m;
  }, [agentData]);

  const rows: TrajectoryRow[] = useMemo(() => {
    return (data?.trajectories ?? []).map(t => ({
      id: t.id,
      agentId: t.agentId,
      agentVersion: t.agentVersion,
      status: t.status,
      startedAt: t.startedAt,
      totalDurationMs: t.totalDurationMs,
      averageReward: t.averageReward,
      stepCount: t.stepCount,
      tags: t.tags ?? [],
    }));
  }, [data]);

  const columns: DataTableColumn<TrajectoryRow>[] = useMemo(
    () => [
      {
        key: 'id',
        header: 'Trajectory ID',
        render: row => (
          <span className="font-mono text-xs text-slate-300 truncate inline-block max-w-[200px] align-middle">
            {row.id}
          </span>
        ),
      },
      {
        key: 'agentId',
        header: 'Agent',
        render: row => (
          <div>
            <p className="text-sm text-sky-300">{agentMap.get(row.agentId) ?? row.agentId}</p>
            <p className="text-[10px] text-slate-600 font-mono">{row.agentId} · v{row.agentVersion}</p>
          </div>
        ),
        filterValue: row => row.agentId,
      },
      {
        key: 'status',
        header: 'Status',
        render: row => <StatusBadge status={row.status} />,
        filterOptions: STATUS_OPTIONS,
        sortValue: row => row.status,
      },
      {
        key: 'startedAt',
        header: 'Started',
        render: row => (
          <span className="text-xs text-slate-400">{formatRelative(row.startedAt)}</span>
        ),
        sortValue: row => row.startedAt,
      },
      {
        key: 'totalDurationMs',
        header: 'Duration',
        numeric: true,
        render: row => (
          <span className="text-xs text-slate-300 tabular-nums">
            {formatDuration(row.totalDurationMs)}
          </span>
        ),
        sortValue: row => row.totalDurationMs,
      },
      {
        key: 'averageReward',
        header: 'Reward',
        numeric: true,
        render: row => (
          <span
            className={cn(
              'text-sm font-semibold tabular-nums',
              row.averageReward > 0.1
                ? 'text-emerald-400'
                : row.averageReward < -0.1
                  ? 'text-rose-400'
                  : 'text-slate-400',
            )}
          >
            {row.averageReward.toFixed(3)}
          </span>
        ),
        sortValue: row => row.averageReward,
      },
      {
        key: 'stepCount',
        header: 'Steps',
        numeric: true,
        render: row => (
          <span className="text-xs text-slate-400 tabular-nums">{row.stepCount}</span>
        ),
        sortValue: row => row.stepCount,
      },
      {
        key: 'tags',
        header: 'Tags',
        hideOnMobile: true,
        render: row => (
          <div className="flex flex-wrap gap-1">
            {row.tags.slice(0, 2).map(tag => (
              <Badge key={tag} variant="outline" className="text-[9px] border-slate-700 text-slate-400">
                {tag}
              </Badge>
            ))}
            {row.tags.length > 2 && (
              <span className="text-[10px] text-slate-600">+{row.tags.length - 2}</span>
            )}
          </div>
        ),
        disableSort: true,
      },
      {
        key: '__actions',
        header: '',
        disableSort: true,
        render: row => (
          <button
            onClick={e => {
              e.stopPropagation();
              setConfirmDeleteOne(row);
            }}
            title="Delete trajectory"
            className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-rose-400"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        ),
      },
    ],
    [agentMap],
  );

  const handleDeleteOne = useCallback(async () => {
    if (!confirmDeleteOne) return;
    try {
      const res = await fetch(`/api/v2/trajectory/${encodeURIComponent(confirmDeleteOne.id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error?.message ?? `Request failed (${res.status})`);
      }
      toast.success(`Deleted trajectory ${confirmDeleteOne.id.slice(0, 12)}…`);
      setConfirmDeleteOne(null);
      setSelectedKeys(prev => prev.filter(k => k !== confirmDeleteOne.id));
      setTimeout(() => void refetch(), 250);
    } catch (err) {
      toast.error('Failed to delete trajectory', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }, [confirmDeleteOne, refetch]);

  const handleDeleteMany = useCallback(async () => {
    if (selectedKeys.length === 0) return;
    let succeeded = 0;
    let failed = 0;
    await Promise.all(
      selectedKeys.map(async id => {
        try {
          const res = await fetch(`/api/v2/trajectory/${encodeURIComponent(id)}`, {
            method: 'DELETE',
          });
          if (res.ok) succeeded++;
          else failed++;
        } catch {
          failed++;
        }
      }),
    );
    setConfirmDeleteMany(false);
    setSelectedKeys([]);
    toast.success(`Deleted ${succeeded} trajectory${succeeded === 1 ? '' : 's'}`, {
      description: failed > 0 ? `${failed} failed (see server logs)` : undefined,
    });
    setTimeout(() => void refetch(), 250);
  }, [selectedKeys, refetch]);

  const handleExport = useCallback(
    async (mode: 'all' | 'selected') => {
      const ids = mode === 'selected' ? selectedKeys : rows.map(r => r.id);
      if (ids.length === 0) {
        toast.error('No trajectories to export');
        setConfirmExport(null);
        return;
      }
      // Derive the agent set from the selected IDs (or all visible rows).
      const agentIds = Array.from(new Set(rows.filter(r => ids.includes(r.id)).map(r => r.agentId)));
      try {
        const result = await postJson<{ id: string; stats: { totalTrajectories: number } } | unknown[]>(
          '/api/v2/trajectory/export',
          {
            agentIds,
            scrubPII: true,
            deduplicate: true,
            purpose: 'admin-console-export',
            exportedBy: 'admin-console',
          },
        );
        setConfirmExport(null);
        const count = Array.isArray(result) ? result.length : 1;
        toast.success(`Exported ${count} dataset${count === 1 ? '' : 's'}`, {
          description:
            mode === 'selected'
              ? `${ids.length} trajectories across ${agentIds.length} agent${agentIds.length === 1 ? '' : 's'}`
              : 'All visible trajectories',
        });
      } catch (err) {
        toast.error('Export failed', {
          description: err instanceof Error ? err.message : 'Unknown error',
        });
        setConfirmExport(null);
      }
    },
    [rows, selectedKeys],
  );

  return (
    <>
      <AdminPageHeader
        title="Trajectory Administration"
        description="Browse, search, delete (GDPR right-to-be-forgotten), and export trajectories as governed datasets via the AReaL DataProxy."
        badge={loading ? '…' : `${data?.total ?? 0} total`}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setRefreshKey(k => k + 1);
                void refetch();
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
          </div>
        }
      />

      {error && (
        <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-sm text-rose-300">
          Failed to load trajectories: {error}
        </div>
      )}

      {initialAgentId && (
        <Card className="bg-slate-900/40 border-slate-800 p-3 mb-4 text-xs text-slate-400">
          Filtered by agent:{' '}
          <button
            onClick={() => router.push('/admin/trajectories')}
            className="text-sky-300 hover:text-sky-200 ml-1"
          >
            {initialAgentId} ✕
          </button>
        </Card>
      )}

      {/* Bulk actions */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setConfirmExport('all')}
          disabled={rows.length === 0}
          className="border-slate-700 text-slate-300"
        >
          <Download className="h-3.5 w-3.5 mr-1.5" />
          Export visible ({rows.length})
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setConfirmExport('selected')}
          disabled={selectedKeys.length === 0}
          className="border-slate-700 text-slate-300 disabled:opacity-40"
        >
          <Download className="h-3.5 w-3.5 mr-1.5" />
          Export selected ({selectedKeys.length})
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setConfirmDeleteMany(true)}
          disabled={selectedKeys.length === 0}
          className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10 disabled:opacity-40"
        >
          <Trash2 className="h-3.5 w-3.5 mr-1.5" />
          Delete selected ({selectedKeys.length})
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={row => row.id}
        loading={loading}
        emptyState={
          <div className="flex flex-col items-center gap-2">
            <GitBranch className="h-10 w-10 text-slate-700" />
            <p className="text-sm text-slate-400">No trajectories in the store yet.</p>
            <p className="text-xs text-slate-600">
              Run an analysis through /analyze to populate trajectories.
            </p>
          </div>
        }
        pageSize={25}
        searchPlaceholder="Search by ID, agent, status…"
        selectable
        selectedKeys={selectedKeys}
        onSelectionChange={setSelectedKeys}
        onRowClick={row => {
          window.open(`/dashboard/trajectories/${encodeURIComponent(row.id)}`, '_blank');
        }}
      />

      {/* Delete-one confirm */}
      <ConfirmDialog
        open={!!confirmDeleteOne}
        onOpenChange={open => !open && setConfirmDeleteOne(null)}
        title="Delete trajectory?"
        description={
          confirmDeleteOne && (
            <>
              This will permanently remove trajectory{' '}
              <code className="text-rose-300">{confirmDeleteOne.id}</code> from the store. This action
              is used to satisfy GDPR right-to-be-forgotten requests and cannot be undone.
            </>
          )
        }
        confirmLabel="Delete trajectory"
        onConfirm={handleDeleteOne}
      />

      {/* Delete-many confirm */}
      <ConfirmDialog
        open={confirmDeleteMany}
        onOpenChange={setConfirmDeleteMany}
        title={`Delete ${selectedKeys.length} trajectory${selectedKeys.length === 1 ? '' : 'ies'}?`}
        description={
          <>
            This will permanently remove the selected trajectories from the store. Any agent stats
            derived from them will be re-computed on the next analysis. This action cannot be undone.
          </>
        }
        confirmLabel={`Delete ${selectedKeys.length} trajectory${selectedKeys.length === 1 ? '' : 'ies'}`}
        onConfirm={handleDeleteMany}
      />

      {/* Export confirm */}
      <ConfirmDialog
        open={!!confirmExport}
        onOpenChange={open => !open && setConfirmExport(null)}
        title="Export trajectories as a dataset?"
        destructive={false}
        description={
          <>
            The export will be run through the AReaL <strong>DataProxy</strong>:
            <ul className="mt-2 ml-4 list-disc text-xs space-y-1">
              <li>PII is scrubbed (emails, phones, SSNs, credit cards, IPs, API keys)</li>
              <li>Exact duplicates are removed (same dataframe hash + config hash)</li>
              <li>An audit entry is recorded (who, when, why)</li>
              <li>The dataset is returned as JSON (download or send to fine-tuning pipeline)</li>
            </ul>
          </>
        }
        confirmLabel="Export dataset"
        onConfirm={() => confirmExport && handleExport(confirmExport)}
      />
    </>
  );
}
