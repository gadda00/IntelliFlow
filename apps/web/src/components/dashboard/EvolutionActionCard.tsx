'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  ChevronDown,
  ChevronRight,
  Check,
  Clock,
  Cog,
  FlaskConical,
  GitBranch,
  Sparkles,
  X,
} from 'lucide-react';
import type { EvolutionAction, EvolutionActionType } from '@busara/agents';
import { cn } from '@/lib/utils';

interface EvolutionActionCardProps {
  action: EvolutionAction;
  /** Index of the action within its agent's analysis result (for the POST body). */
  actionIndex: number;
  onApprove?: (action: EvolutionAction, actionIndex: number) => Promise<void> | void;
  onReject?: (action: EvolutionAction, actionIndex: number) => Promise<void> | void;
  /** Disable actions (e.g., when status !== pending). */
  readOnly?: boolean;
}

const ACTION_TYPE_META: Record<
  EvolutionActionType,
  { label: string; icon: React.ElementType; color: string; bg: string }
> = {
  PROMOTE_STABILITY: { label: 'Promote Stability', icon: ArrowUpCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
  DEMOTE_STABILITY: { label: 'Demote Stability', icon: ArrowDownCircle, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' },
  OPTIMIZE_CONFIG: { label: 'Optimize Config', icon: Cog, color: 'text-sky-400', bg: 'bg-sky-500/10 border-sky-500/30' },
  FLAG_DRIFT: { label: 'Drift Detected', icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' },
  FLAG_LOW_REWARD: { label: 'Low Reward', icon: ArrowDownCircle, color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/30' },
  FLAG_HIGH_FAILURE: { label: 'High Failure Rate', icon: AlertTriangle, color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/30' },
  SCHEDULE_FINE_TUNE: { label: 'Schedule Fine-Tune', icon: FlaskConical, color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/30' },
  SCHEDULE_PROMPT_UPDATE: { label: 'Update Prompt', icon: Sparkles, color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/30' },
  DEPRECATE_AGENT: { label: 'Deprecate Agent', icon: X, color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/30' },
  A_B_TEST_CONFIG: { label: 'A/B Test Config', icon: GitBranch, color: 'text-sky-400', bg: 'bg-sky-500/10 border-sky-500/30' },
  NONE: { label: 'No Action', icon: Check, color: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/30' },
};

const STATUS_STYLES: Record<EvolutionAction['status'], { label: string; className: string }> = {
  pending: { label: 'PENDING', className: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  approved: { label: 'APPROVED', className: 'bg-sky-500/10 text-sky-400 border-sky-500/30' },
  rejected: { label: 'REJECTED', className: 'bg-rose-500/10 text-rose-400 border-rose-500/30' },
  applied: { label: 'APPLIED', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  rolled_back: { label: 'ROLLED BACK', className: 'bg-slate-500/10 text-slate-400 border-slate-500/30' },
};

function formatConfidence(c: number): { label: string; color: string } {
  if (c >= 0.8) return { label: 'HIGH', color: 'text-emerald-400' };
  if (c >= 0.5) return { label: 'MEDIUM', color: 'text-amber-400' };
  return { label: 'LOW', color: 'text-slate-400' };
}

export function EvolutionActionCard({
  action,
  actionIndex,
  onApprove,
  onReject,
  readOnly,
}: EvolutionActionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const meta = ACTION_TYPE_META[action.type];
  const Icon = meta.icon;
  const statusStyle = STATUS_STYLES[action.status];
  const conf = formatConfidence(action.confidence);
  const evidence = action.evidence;

  const handleApprove = async () => {
    if (!onApprove) return;
    setSubmitting(true);
    try {
      await onApprove(action, actionIndex);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!onReject) return;
    setSubmitting(true);
    try {
      await onReject(action, actionIndex);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className={cn('bg-slate-900/60 border-slate-800 overflow-hidden', meta.bg, 'border-l-2')}>
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full text-left p-4 flex items-start gap-3 hover:bg-slate-900/40 transition-colors"
      >
        <div className={cn('shrink-0 h-9 w-9 rounded-lg flex items-center justify-center', meta.bg, 'border')}>
          <Icon className={cn('h-4 w-4', meta.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-slate-100">{meta.label}</h3>
            <Badge variant="outline" className={cn('text-[10px] font-semibold', statusStyle.className)}>
              {statusStyle.label}
            </Badge>
            <Badge variant="outline" className={cn('text-[10px] font-semibold', conf.color, 'border-current/30')}>
              {conf.label} · {(action.confidence * 100).toFixed(0)}%
            </Badge>
          </div>
          <p className="text-sm text-slate-400 mt-1 line-clamp-2">{action.reason}</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-slate-500">
            <span className="font-mono">{action.agentId}</span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(action.createdAt).toLocaleString()}
            </span>
            <span>{evidence.totalTrajectories} trajectories</span>
            <span>success {(evidence.successRate * 100).toFixed(1)}%</span>
          </div>
        </div>
        <div className="shrink-0 text-slate-500">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-800 p-4 space-y-4 bg-slate-950/40">
          {/* Evidence grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <EvidenceStat label="Trajectories" value={evidence.totalTrajectories.toLocaleString()} />
            <EvidenceStat
              label="Success Rate"
              value={`${(evidence.successRate * 100).toFixed(1)}%`}
              tone={evidence.successRate >= 0.8 ? 'good' : evidence.successRate < 0.6 ? 'bad' : 'neutral'}
            />
            <EvidenceStat
              label="Avg Reward"
              value={evidence.averageReward.toFixed(3)}
              tone={evidence.averageReward >= 0.1 ? 'good' : evidence.averageReward < -0.1 ? 'bad' : 'neutral'}
            />
            <EvidenceStat
              label="Drift Score"
              value={(evidence.driftScore ?? 0).toFixed(3)}
              tone={(evidence.driftScore ?? 0) > 0.15 ? 'bad' : 'good'}
            />
          </div>

          {/* Recent trend */}
          {evidence.recentTrend.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                7-Day Trend
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {evidence.recentTrend.map(t => (
                  <div
                    key={t.date}
                    className="text-[10px] px-2 py-1 rounded bg-slate-900 border border-slate-800 font-mono"
                    title={`${t.date}: ${t.count} runs, ${(t.successRate * 100).toFixed(0)}% success`}
                  >
                    <span className="text-slate-500">{t.date.slice(5)}</span>
                    <span className="text-slate-300 ml-1.5">{t.count}</span>
                    <span
                      className={cn(
                        'ml-1.5',
                        t.successRate >= 0.8 ? 'text-emerald-400' : t.successRate < 0.6 ? 'text-rose-400' : 'text-amber-400',
                      )}
                    >
                      {(t.successRate * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Config insights */}
          {evidence.configInsights && evidence.configInsights.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Config Insights
              </h4>
              <div className="space-y-2">
                {evidence.configInsights.map((insight, i) => (
                  <div
                    key={i}
                    className="rounded-md bg-slate-900/60 border border-slate-800 p-3 text-xs"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <code className="text-sky-300 font-semibold">{insight.configKey}</code>
                      <span className="text-slate-500">→</span>
                      <code className="text-emerald-300">
                        {JSON.stringify(insight.suggestedValue)}
                      </code>
                    </div>
                    <p className="text-slate-400">{insight.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Suggested change */}
          {action.suggestedChange && Object.keys(action.suggestedChange).length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Suggested Change
              </h4>
              <pre className="rounded-md bg-slate-950 border border-slate-800 p-3 text-xs text-slate-300 overflow-x-auto">
                {JSON.stringify(action.suggestedChange, null, 2)}
              </pre>
            </div>
          )}

          {/* Action buttons */}
          {!readOnly && action.status === 'pending' && (
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleReject}
                disabled={submitting}
                className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Reject
              </Button>
              <Button
                size="sm"
                onClick={handleApprove}
                disabled={submitting}
                className="bg-emerald-500/90 hover:bg-emerald-500 text-slate-950"
              >
                <Check className="h-3.5 w-3.5 mr-1" />
                {submitting ? 'Applying...' : 'Approve & Apply'}
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function EvidenceStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'good' | 'bad' | 'neutral';
}) {
  const color =
    tone === 'good'
      ? 'text-emerald-400'
      : tone === 'bad'
        ? 'text-rose-400'
        : 'text-slate-100';
  return (
    <div className="rounded-md bg-slate-900/60 border border-slate-800 p-3">
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className={cn('text-lg font-bold tabular-nums mt-1', color)}>{value}</p>
    </div>
  );
}
