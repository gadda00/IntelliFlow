'use client';

import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface StatCardProps {
  label: string;
  value: string | number;
  /** Optional secondary line under the value. */
  hint?: string;
  /** Delta vs. previous period, in same unit as value (e.g. -0.04, +12). */
  trend?: number;
  /** When true, higher is better (default). When false, lower is better (e.g. cost). */
  trendPositiveUp?: boolean;
  icon?: React.ReactNode;
  loading?: boolean;
  /** Accent color for the value. Defaults to emerald-400. */
  accentClassName?: string;
}

export function StatCard({
  label,
  value,
  hint,
  trend,
  trendPositiveUp = true,
  icon,
  loading,
  accentClassName,
}: StatCardProps) {
  if (loading) {
    return (
      <Card className="bg-slate-900/60 border-slate-800 p-5">
        <Skeleton className="h-3 w-24 mb-3 bg-slate-800" />
        <Skeleton className="h-8 w-32 mb-2 bg-slate-800" />
        <Skeleton className="h-3 w-20 bg-slate-800" />
      </Card>
    );
  }

  const trendUp = trend === undefined ? null : trend > 0;
  const trendNeutral = trend === undefined || Math.abs(trend) < 0.0001;
  const goodTrend = trendNeutral ? null : trendPositiveUp ? trendUp : !trendUp;

  return (
    <Card className="bg-slate-900/60 border-slate-800 p-5 hover:border-slate-700 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider truncate">
            {label}
          </p>
          <p
            className={cn(
              'mt-2 text-2xl md:text-3xl font-bold tracking-tight tabular-nums',
              accentClassName ?? 'text-emerald-400',
            )}
          >
            {value}
          </p>
          {hint && <p className="mt-1 text-xs text-slate-500 truncate">{hint}</p>}
          {trend !== undefined && (
            <div className="mt-2 flex items-center gap-1 text-xs">
              {trendNeutral ? (
                <Minus className="h-3 w-3 text-slate-500" />
              ) : trendUp ? (
                <ArrowUpRight className={cn('h-3 w-3', goodTrend ? 'text-emerald-400' : 'text-rose-400')} />
              ) : (
                <ArrowDownRight className={cn('h-3 w-3', goodTrend ? 'text-emerald-400' : 'text-rose-400')} />
              )}
              <span
                className={cn(
                  'tabular-nums font-medium',
                  trendNeutral
                    ? 'text-slate-500'
                    : goodTrend
                      ? 'text-emerald-400'
                      : 'text-rose-400',
                )}
              >
                {trendNeutral ? '0.0%' : `${trendUp ? '+' : ''}${(trend * 100).toFixed(1)}%`}
              </span>
              <span className="text-slate-600">vs prev period</span>
            </div>
          )}
        </div>
        {icon && (
          <div className="shrink-0 h-9 w-9 rounded-lg bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-300">
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}
