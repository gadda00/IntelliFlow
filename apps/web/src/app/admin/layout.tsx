'use client';

import { AdminSidebar } from '@/components/admin/AdminSidebar';

/**
 * Layout for /admin/* — admin sidebar (Agents, Trajectories, Evolution,
 * Users, System) plus a rose-tinted accent. The shell is dark-themed to
 * match the rest of the app, with rose accents to signal elevated access.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="flex">
        <AdminSidebar />
        <main className="flex-1 min-w-0">
          <div className="max-w-[1600px] mx-auto p-4 md:p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
