'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * Colored badge for displaying a status string. The variant is auto-selected
 * based on the status value (case-insensitive substring match).
 *
 * Used across the admin console for agent stability, trajectory status,
 * evolution action status, system health, and provider availability.
 */

export type StatusTone =
  | 'success'
  | 'danger'
  | 'warning'
  | 'info'
  | 'neutral'
  | 'muted';

const TONE_CLASS: Record<StatusTone, string> = {
  success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  danger: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
  warning: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  info: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
  neutral: 'bg-slate-500/10 text-slate-300 border-slate-500/30',
  muted: 'bg-slate-700/20 text-slate-500 border-slate-700/40',
};

/** Map a raw status string to a tone. */
export function statusToTone(status: string): StatusTone {
  const s = status.toLowerCase();
  if (['success', 'ok', 'healthy', 'up', 'applied', 'approved', 'stable', 'available', 'pass', 'passed'].some(k => s === k)) {
    return 'success';
  }
  if (['failed', 'fail', 'error', 'down', 'rejected', 'deprecated', 'degraded', 'critical', 'unavailable', 'timeout', 'cancelled', 'canceled'].some(k => s === k)) {
    return 'danger';
  }
  if (['pending', 'experimental', 'beta', 'warning', 'warn', 'slow', 'rolled_back', 'rollback', 'partial'].some(k => s === k)) {
    return 'warning';
  }
  if (['running', 'approved', 'planned', 'info'].some(k => s === k)) {
    return 'info';
  }
  if (['idle', 'neutral', 'none'].some(k => s === k)) {
    return 'neutral';
  }
  return 'muted';
}

export interface StatusBadgeProps {
  status: string;
  /** Override the auto-detected tone. */
  tone?: StatusTone;
  /** Uppercase the label (default true). */
  uppercase?: boolean;
  className?: string;
}

export function StatusBadge({ status, tone, uppercase = true, className }: StatusBadgeProps) {
  const t = tone ?? statusToTone(status);
  const label = uppercase ? status.toUpperCase() : status;
  return (
    <Badge variant="outline" className={cn('text-[10px] font-semibold', TONE_CLASS[t], className)}>
      {label}
    </Badge>
  );
}
