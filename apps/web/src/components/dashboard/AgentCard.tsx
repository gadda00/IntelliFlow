'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkline } from './Sparkline';
import { Activity, AlertTriangle, CheckCircle2, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export type Stability = 'experimental' | 'beta' | 'stable' | 'deprecated';

export interface AgentCardProps {
  agentId: string;
  name?: string;
  stage?: string;
  stability?: Stability;
  successRate: number; // 0..1
  avgReward: number; // -1..1
  totalTrajectories: number;
  /** Recent reward trend (last 7 days) for the sparkline. */
  trend?: number[];
  driftScore?: number;
  loading?: boolean;
}

const STABILITY_STYLES: Record<Stability, { label: string; className: string }> = {
  experimental: { label: 'EXPERIMENTAL', className: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  beta: { label: 'BETA', className: 'bg-sky-500/10 text-sky-400 border-sky-500/30' },
  stable: { label: 'STABLE', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  deprecated: { label: 'DEPRECATED', className: 'bg-rose-500/10 text-rose-400 border-rose-500/30' },
};

export function AgentCard({
  agentId,
  name,
  stage,
  stability = 'beta',
  successRate,
  avgReward,
  totalTrajectories,
  trend,
  driftScore,
  loading,
}: AgentCardProps) {
  if (loading) {
    return (
      <Card className="bg-slate-900/60 border-slate-800 p-5">
        <div className="h-4 w-24 bg-slate-800 rounded animate-pulse mb-3" />
        <div className="h-3 w-16 bg-slate-800 rounded animate-pulse mb-4" />
        <div className="h-8 w-20 bg-slate-800 rounded animate-pulse mb-2" />
        <div className="h-3 w-16 bg-slate-800 rounded animate-pulse" />
      </Card>
    );
  }

  const isDrifting = (driftScore ?? 0) > 0.15;
  const successPct = Math.round(successRate * 100);
  const successGood = successPct >= 80;
  const successMid = successPct >= 60 && successPct < 80;
  const rewardGood = avgReward >= 0.1;
  const rewardBad = avgReward < -0.1;
  const stageStyle = STABILITY_STYLES[stability];

  return (
    <Link href={`/dashboard/agents/${encodeURIComponent(agentId)}`} className="block">
      <Card
        className={cn(
          'bg-slate-900/60 border-slate-800 p-5 hover:border-emerald-500/40 hover:bg-slate-900 transition-all group cursor-pointer',
          isDrifting && 'border-amber-500/30',
        )}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-slate-100 truncate">
                {name ?? agentId}
              </h3>
              {isDrifting && (
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5 truncate">
              {stage ? `${stage} · ` : ''}<code className="text-slate-400">{agentId}</code>
            </p>
          </div>
          <Badge variant="outline" className={cn('shrink-0 text-[10px] font-semibold', stageStyle.className)}>
            {stageStyle.label}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Success Rate</p>
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  'text-lg font-bold tabular-nums',
                  successGood ? 'text-emerald-400' : successMid ? 'text-amber-400' : 'text-rose-400',
                )}
              >
                {successPct}%
              </span>
              {successGood ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500/70" />
              ) : null}
            </div>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Avg Reward</p>
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  'text-lg font-bold tabular-nums',
                  rewardGood ? 'text-emerald-400' : rewardBad ? 'text-rose-400' : 'text-slate-300',
                )}
              >
                {avgReward.toFixed(2)}
              </span>
              {avgReward > 0 ? (
                <TrendingUp className="h-3.5 w-3.5 text-emerald-500/70" />
              ) : avgReward < 0 ? (
                <TrendingDown className="h-3.5 w-3.5 text-rose-500/70" />
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between pt-3 border-t border-slate-800">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Activity className="h-3 w-3" />
            <span className="tabular-nums">{totalTrajectories.toLocaleString()} trajectories</span>
          </div>
          {trend && trend.length > 1 && <Sparkline data={trend} width={60} height={20} />}
        </div>
      </Card>
    </Link>
  );
}
