'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApi, postJson } from '@/components/dashboard/useApi';
import { EvolutionActionCard } from '@/components/dashboard/EvolutionActionCard';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle2, Clock, GitBranch, Inbox, XCircle } from 'lucide-react';
import type { EvolutionAction, EvolutionActionType } from '@busara/agents';
import { toast } from 'sonner';

interface ApproveResponse {
  actionType: string;
  agentId: string;
  actionIndex: number;
  appliedAt: string;
  status: EvolutionAction['status'];
}

const STATUS_TABS: { value: EvolutionAction['status'] | 'all'; label: string; icon: React.ElementType }[] = [
  { value: 'pending', label: 'Pending', icon: Clock },
  { value: 'approved', label: 'Approved', icon: CheckCircle2 },
  { value: 'rejected', label: 'Rejected', icon: XCircle },
  { value: 'applied', label: 'Applied', icon: CheckCircle2 },
  { value: 'all', label: 'All', icon: Inbox },
];

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

export default function EvolutionPage() {
  const [statusTab, setStatusTab] = useState<EvolutionAction['status'] | 'all'>('pending');
  const [actionTypeFilter, setActionTypeFilter] = useState<string>('');
  const [localActions, setLocalActions] = useState<Record<string, EvolutionAction>>({});
  const [refreshKey, setRefreshKey] = useState(0);

  const queryUrl = useMemo(() => {
    const p = new URLSearchParams();
    if (statusTab !== 'all') p.set('status', statusTab);
    return `/api/v2/evolution${p.toString() ? `?${p.toString()}` : ''}`;
  }, [statusTab, refreshKey]);

  const { data: rawActions, loading, error, refetch } = useApi<EvolutionAction[]>(queryUrl, {
    refreshMs: 60_000,
  });

  // Merge server-fetched actions with locally-mutated ones (post-approve/reject)
  const actions = useMemo(() => {
    const list = rawActions ?? [];
    // Index by stable key
    return list.map((a, i) => {
      const key = `${a.agentId}:${a.type}:${i}`;
      return localActions[key] ?? a;
    });
  }, [rawActions, localActions]);

  // Apply client-side action type filter (server doesn't filter by type)
  const filteredActions = useMemo(() => {
    if (!actionTypeFilter) return actions;
    return actions.filter(a => a.type === actionTypeFilter);
  }, [actions, actionTypeFilter]);

  // Sort by confidence (highest first)
  const sortedActions = useMemo(() => {
    return [...filteredActions].sort((a, b) => b.confidence - a.confidence);
  }, [filteredActions]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { pending: 0, approved: 0, rejected: 0, applied: 0, rolled_back: 0, all: 0 };
    for (const a of actions) {
      c[a.status] = (c[a.status] ?? 0) + 1;
      c.all += 1;
    }
    return c;
  }, [actions]);

  const handleApprove = useCallback(
    async (action: EvolutionAction, actionIndex: number) => {
      try {
        const result = await postJson<ApproveResponse>('/api/v2/evolution', {
          actionType: 'apply',
          agentId: action.agentId,
          actionIndex,
        });
        const key = `${action.agentId}:${action.type}:${actionIndex}`;
        setLocalActions(prev => ({
          ...prev,
          [key]: { ...action, status: result.status, appliedAt: result.appliedAt },
        }));
        toast.success(`Action applied for ${action.agentId}`, {
          description: ACTION_TYPE_LABELS[action.type] ?? action.type,
        });
        setTimeout(() => void refetch(), 500);
      } catch (err) {
        toast.error('Failed to apply action', {
          description: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    },
    [refetch],
  );

  const handleReject = useCallback(
    async (action: EvolutionAction, actionIndex: number) => {
      try {
        const result = await postJson<ApproveResponse>('/api/v2/evolution', {
          actionType: 'reject',
          agentId: action.agentId,
          actionIndex,
        });
        const key = `${action.agentId}:${action.type}:${actionIndex}`;
        setLocalActions(prev => ({
          ...prev,
          [key]: { ...action, status: result.status },
        }));
        toast.success(`Action rejected for ${action.agentId}`, {
          description: ACTION_TYPE_LABELS[action.type] ?? action.type,
        });
        setTimeout(() => void refetch(), 500);
      } catch (err) {
        toast.error('Failed to reject action', {
          description: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    },
    [refetch],
  );

  // Reset local overrides when status tab changes
  useEffect(() => {
    setLocalActions({});
  }, [statusTab]);

  const pendingCount = counts.pending ?? 0;

  return (
    <>
      <DashboardPageHeader
        title="Evolution Queue"
        description="Human-in-the-loop approval for agent evolution actions. Sorted by confidence."
        badge={pendingCount > 0 ? `${pendingCount} pending` : 'all clear'}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setLocalActions({});
              setRefreshKey(k => k + 1);
            }}
            className="border-slate-700 text-slate-300"
          >
            <GitBranch className="h-3.5 w-3.5 mr-1.5" />
            Refresh
          </Button>
        }
      />

      {error && (
        <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-sm text-rose-300">
          Failed to load evolution actions: {error}
        </div>
      )}

      {/* Status tabs + counts */}
      <div className="mb-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <Tabs value={statusTab} onValueChange={v => setStatusTab(v as typeof statusTab)}>
          <TabsList className="bg-slate-900/60 border border-slate-800 h-9">
            {STATUS_TABS.map(tab => {
              const Icon = tab.icon;
              const count = counts[tab.value] ?? 0;
              return (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="data-[state=active]:bg-slate-800 data-[state=active]:text-emerald-300 text-slate-400"
                >
                  <Icon className="h-3 w-3 mr-1" />
                  {tab.label}
                  {count > 0 && (
                    <Badge
                      variant="secondary"
                      className="ml-1.5 text-[9px] h-4 px-1 bg-slate-800 text-slate-300"
                    >
                      {count}
                    </Badge>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>

        {/* Action type filter */}
        <select
          value={actionTypeFilter}
          onChange={e => setActionTypeFilter(e.target.value)}
          className="bg-slate-900/60 border border-slate-800 rounded-md h-9 px-3 text-sm text-slate-300"
        >
          <option value="">All action types</option>
          {Object.entries(ACTION_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {/* Action list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-24 w-full bg-slate-800" />
          ))}
        </div>
      ) : sortedActions.length === 0 ? (
        <Card className="bg-slate-900/60 border-slate-800 p-12 text-center">
          <CheckCircle2 className="h-10 w-10 text-emerald-400/60 mx-auto mb-3" />
          <p className="text-sm text-slate-300 font-medium">
            {statusTab === 'pending'
              ? 'No pending evolution actions.'
              : `No ${statusTab} actions.`}
          </p>
          <p className="text-xs text-slate-600 mt-1">
            {statusTab === 'pending'
              ? 'All agents are within healthy bounds. New actions will appear here as trajectories accumulate.'
              : 'Try a different status filter.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {sortedActions.map((action, i) => (
            <EvolutionActionCard
              key={`${action.agentId}-${action.type}-${i}`}
              action={action}
              actionIndex={i}
              onApprove={handleApprove}
              onReject={handleReject}
              readOnly={action.status !== 'pending'}
            />
          ))}
        </div>
      )}
    </>
  );
}
