'use client';

import { Badge } from '@/components/ui/badge';

/**
 * Shared admin page header — same shape as DashboardPageHeader but with rose
 * accent to distinguish admin pages from regular dashboard pages.
 */
export function AdminPageHeader({
  title,
  description,
  badge,
  actions,
}: {
  title: string;
  description?: string;
  badge?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-100">{title}</h1>
          {badge && (
            <Badge variant="outline" className="border-rose-500/30 text-rose-400 text-[10px] font-semibold">
              {badge}
            </Badge>
          )}
        </div>
        {description && <p className="mt-1 text-sm text-slate-400">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
