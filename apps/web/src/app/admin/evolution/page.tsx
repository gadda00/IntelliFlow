'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { DataTable, type DataTableColumn } from '@/components/admin/DataTable';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { useApi, postJson } from '@/components/dashboard/useApi';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, Clock, RefreshCw, X } from 'lucide-react';
import type { EvolutionAction, EvolutionActionType } from '@busara/agents';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface AgentListResponse {
  total: number;
  agents: { id: string; name: string }[];
}

interface EvolutionRow {
  key: string;
  agentId: string;
  agentName: string;
  type: EvolutionActionType;
  reason: string;
  confidence: number;
  status: EvolutionAction['status'];
  createdAt: string;
  evidence: EvolutionAction['evidence'];
  suggestedChange?: Record<string, unknown>;
  actionIndex: number;
}

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

const ACTION_TYPE_OPTIONS = Object.entries(ACTION_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

const STATUS_OPTIONS = [
  { label: 'Pending', value: 'pending' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Applied', value: 'applied' },
  { label: 'Rolled back', value: 'rolled_back' },
];

const TYPE_TONE: Record<string, 'success' | 'danger' | 'warning' | 'info' | 'muted'> = {
  PROMOTE_STABILITY: 'success',
  DEMOTE_STABILITY: 'warning',
  OPTIMIZE_CONFIG: 'info',
  FLAG_DRIFT: 'warning',
  FLAG_LOW_REWARD: 'warning',
  FLAG_HIGH_FAILURE: 'danger',
  SCHEDULE_FINE_TUNE: 'info',
  SCHEDULE_PROMPT_UPDATE: 'info',
  DEPRECATE_AGENT: 'danger',
  A_B_TEST_CONFIG: 'info',
  NONE: 'muted',
};

// Static class lookup so Tailwind's JIT keeps the classes.
const TYPE_TONE_CLASS: Record<string, string> = {
  success: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
  danger: 'text-rose-400 border-rose-500/30 bg-rose-500/10',
  warning: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
  info: 'text-sky-400 border-sky-500/30 bg-sky-500/10',
  muted: 'text-slate-400 border-slate-700 bg-slate-700/20',
};

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diffMs = now - d.getTime();
  if (diffMs < 60_000) return 'just now';
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`;
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}h ago`;
  return d.toLocaleDateString();
}

export default function AdminEvolutionPage() {
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [confirmAction, setConfirmAction] = useState<{ kind: 'apply' | 'reject'; row: EvolutionRow } | null>(null);

  const { data: agentData } = useApi<AgentListResponse>('/api/v7/agents');
  const agentMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of agentData?.agents ?? []) m.set(a.id, a.name);
    return m;
  }, [agentData]);

  const { data: rawActions, loading, error, refetch } = useApi<EvolutionAction[]>(
    '/api/v2/evolution',
    { refreshMs: 60_000 },
  );

  // Apply refresh key as a hack to force refetch via URL change
  useEffect(() => {
    if (refreshKey > 0) void refetch();
  }, [refreshKey, refetch]);

  const rows: EvolutionRow[] = useMemo(() => {
    const list = rawActions ?? [];
    return list.map((action, index) => ({
      key: `${action.agentId}:${action.type}:${index}`,
      agentId: action.agentId,
      agentName: agentMap.get(action.agentId) ?? action.agentId,
      type: action.type,
      reason: action.reason,
      confidence: action.confidence,
      status: action.status,
      createdAt: action.createdAt,
      evidence: action.evidence,
      suggestedChange: action.suggestedChange,
      actionIndex: index,
    }));
  }, [rawActions, agentMap]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { pending: 0, approved: 0, rejected: 0, applied: 0, rolled_back: 0 };
    for (const r of rows) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [rows]);

  const columns: DataTableColumn<EvolutionRow>[] = useMemo(
    () => [
      {
        key: 'agentId',
        header: 'Agent',
        render: row => (
          <div>
            <p className="text-sm text-slate-200">{row.agentName}</p>
            <p className="text-[10px] text-slate-500 font-mono">{row.agentId}</p>
          </div>
        ),
      },
      {
        key: 'type',
        header: 'Action',
        render: row => (
          <Badge
            variant="outline"
            className={cn(
              'text-[10px] font-semibold',
              TYPE_TONE_CLASS[TYPE_TONE[row.type] ?? 'muted'],
            )}
          >
            {ACTION_TYPE_LABELS[row.type] ?? row.type}
          </Badge>
        ),
        filterOptions: ACTION_TYPE_OPTIONS,
      },
      {
        key: 'status',
        header: 'Status',
        render: row => <StatusBadge status={row.status} />,
        filterOptions: STATUS_OPTIONS,
      },
      {
        key: 'reason',
        header: 'Reason',
        hideOnMobile: true,
        render: row => (
          <p className="text-xs text-slate-400 truncate max-w-[320px]">{row.reason}</p>
        ),
        disableSort: true,
      },
      {
        key: 'confidence',
        header: 'Confidence',
        numeric: true,
        render: row => {
          const pct = Math.round(row.confidence * 100);
          const tone =
            pct >= 80 ? 'text-emerald-400' : pct < 50 ? 'text-amber-400' : 'text-sky-400';
          return (
            <div className="flex items-center justify-end gap-2">
              <div className="w-12 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full',
                    pct >= 80 ? 'bg-emerald-500' : pct < 50 ? 'bg-amber-500' : 'bg-sky-500',
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className={`text-sm font-semibold tabular-nums ${tone}`}>{pct}%</span>
            </div>
          );
        },
        sortValue: row => row.confidence,
      },
      {
        key: 'createdAt',
        header: 'Created',
        render: row => (
          <span className="text-xs text-slate-400">{formatRelative(row.createdAt)}</span>
        ),
        sortValue: row => row.createdAt,
      },
      {
        key: '__actions',
        header: '',
        disableSort: true,
        render: row => (
          <div className="flex items-center justify-end gap-1.5">
            {row.status === 'pending' ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={e => {
                    e.stopPropagation();
                    setConfirmAction({ kind: 'reject', row });
                  }}
                  className="h-7 px-2 text-[11px] border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
                >
                  <X className="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  onClick={e => {
                    e.stopPropagation();
                    setConfirmAction({ kind: 'apply', row });
                  }}
                  className="h-7 px-2 text-[11px] bg-emerald-500/90 hover:bg-emerald-500 text-slate-950"
                >
                  <Check className="h-3 w-3" />
                </Button>
              </>
            ) : (
              <span className="text-[10px] text-slate-600 italic">resolved</span>
            )}
          </div>
        ),
      },
    ],
    [],
  );

  const handleConfirmAction = useCallback(async () => {
    if (!confirmAction) return;
    const { kind, row } = confirmAction;
    try {
      await postJson('/api/v2/evolution', {
        actionType: kind === 'apply' ? 'apply' : 'reject',
        agentId: row.agentId,
        actionIndex: row.actionIndex,
      });
      toast.success(`${kind === 'apply' ? 'Applied' : 'Rejected'} ${ACTION_TYPE_LABELS[row.type]}`, {
        description: `Agent: ${row.agentName}`,
      });
      setConfirmAction(null);
      setRefreshKey(k => k + 1);
    } catch (err) {
      toast.error('Failed', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }, [confirmAction]);

  return (
    <>
      <AdminPageHeader
        title="Evolution Queue"
        description="All evolution actions (pending + resolved) across every agent. Approve or reject with one click. Sort by confidence or date."
        badge={counts.pending > 0 ? `${counts.pending} pending` : 'all clear'}
        actions={
          <button
            onClick={() => setRefreshKey(k => k + 1)}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        }
      />

      {error && (
        <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-sm text-rose-300">
          Failed to load evolution actions: {error}
        </div>
      )}

      {/* Status summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <Card className="bg-slate-900/40 border-slate-800 p-3">
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-[10px] uppercase tracking-wider text-slate-500">Pending</span>
          </div>
          <p className="text-xl font-bold text-amber-400 mt-1 tabular-nums">{counts.pending ?? 0}</p>
        </Card>
        <Card className="bg-slate-900/40 border-slate-800 p-3">
          <div className="flex items-center gap-2">
            <Check className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-[10px] uppercase tracking-wider text-slate-500">Applied</span>
          </div>
          <p className="text-xl font-bold text-emerald-400 mt-1 tabular-nums">{counts.applied ?? 0}</p>
        </Card>
        <Card className="bg-slate-900/40 border-slate-800 p-3">
          <div className="flex items-center gap-2">
            <Check className="h-3.5 w-3.5 text-sky-400" />
            <span className="text-[10px] uppercase tracking-wider text-slate-500">Approved</span>
          </div>
          <p className="text-xl font-bold text-sky-400 mt-1 tabular-nums">{counts.approved ?? 0}</p>
        </Card>
        <Card className="bg-slate-900/40 border-slate-800 p-3">
          <div className="flex items-center gap-2">
            <X className="h-3.5 w-3.5 text-rose-400" />
            <span className="text-[10px] uppercase tracking-wider text-slate-500">Rejected</span>
          </div>
          <p className="text-xl font-bold text-rose-400 mt-1 tabular-nums">{counts.rejected ?? 0}</p>
        </Card>
        <Card className="bg-slate-900/40 border-slate-800 p-3">
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-[10px] uppercase tracking-wider text-slate-500">Rolled back</span>
          </div>
          <p className="text-xl font-bold text-slate-300 mt-1 tabular-nums">{counts.rolled_back ?? 0}</p>
        </Card>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={row => row.key}
        loading={loading}
        emptyState={
          <div className="flex flex-col items-center gap-2 py-8">
            <Check className="h-10 w-10 text-emerald-400/60" />
            <p className="text-sm text-slate-300">No evolution actions.</p>
            <p className="text-xs text-slate-600">
              New actions appear here as trajectory data accumulates and the control plane
              detects drift, low reward, or promotion opportunities.
            </p>
          </div>
        }
        pageSize={25}
        searchPlaceholder="Search by agent, action type, or reason…"
        selectable
        selectedKeys={selectedKeys}
        onSelectionChange={setSelectedKeys}
      />

      <ConfirmDialog
        open={!!confirmAction}
        onOpenChange={open => !open && setConfirmAction(null)}
        title={
          confirmAction
            ? `${confirmAction.kind === 'apply' ? 'Apply' : 'Reject'} ${ACTION_TYPE_LABELS[confirmAction.row.type]}?`
            : ''
        }
        destructive={confirmAction?.kind === 'reject'}
        confirmLabel={confirmAction?.kind === 'apply' ? 'Apply action' : 'Reject action'}
        description={
          confirmAction && (
            <div className="space-y-2 text-sm text-slate-400">
              <p>
                <strong className="text-slate-200">Agent:</strong>{' '}
                {confirmAction.row.agentName}{' '}
                <code className="text-[10px] text-slate-500">({confirmAction.row.agentId})</code>
              </p>
              <p>
                <strong className="text-slate-200">Reason:</strong> {confirmAction.row.reason}
              </p>
              {confirmAction.row.suggestedChange && (
                <p>
                  <strong className="text-slate-200">Suggested change:</strong>{' '}
                  <code className="text-[10px] text-emerald-300">
                    {JSON.stringify(confirmAction.row.suggestedChange)}
                  </code>
                </p>
              )}
              {confirmAction.kind === 'apply' ? (
                <p className="text-emerald-300">
                  Applying will persist the change immediately and mark the action as applied.
                </p>
              ) : (
                <p className="text-rose-300">
                  Rejecting will dismiss this suggestion. It will not reappear unless trajectory
                  data triggers the control plane again.
                </p>
              )}
            </div>
          )
        }
        onConfirm={handleConfirmAction}
      />
    </>
  );
}
