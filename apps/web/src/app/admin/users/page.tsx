'use client';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users } from 'lucide-react';

/**
 * /admin/users — placeholder for the user + RBAC management page.
 *
 * The Busara user model lives behind Supabase Auth + a Prisma User table
 * (see prisma/schema.prisma). For the admin console MVP we surface the
 * capabilities that will ship here; the actual data grid is gated on
 * shipping a Prisma-backed User admin endpoint. The dashboard already
 * supports `GET /api/auth/me` and `GET /api/rbac` for the current user.
 */
export default function AdminUsersPage() {
  return (
    <>
      <AdminPageHeader
        title="User Management"
        description="Manage Busara user accounts, roles, and RBAC permissions."
        badge="Roadmap"
      />

      <Card className="bg-slate-900/60 border-slate-800 p-12 text-center">
        <div className="mx-auto h-12 w-12 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mb-4">
          <Users className="h-6 w-6 text-rose-400" />
        </div>
        <h2 className="text-lg font-semibold text-slate-100">User admin coming soon</h2>
        <p className="mt-2 text-sm text-slate-400 max-w-xl mx-auto">
          This page will list every registered user, their role (viewer · analyst · admin),
          their last-login timestamp, API-key count, and trajectory count. It will
          support suspending users, resetting passwords, and rotating API keys.
        </p>
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto text-left">
          <Card className="bg-slate-950/40 border-slate-800 p-3">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Endpoints planned</p>
            <code className="text-xs text-emerald-300">GET /api/v2/admin/users</code>
          </Card>
          <Card className="bg-slate-950/40 border-slate-800 p-3">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">RBAC today</p>
            <code className="text-xs text-sky-300">/api/rbac</code>
          </Card>
          <Card className="bg-slate-950/40 border-slate-800 p-3">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Auth today</p>
            <code className="text-xs text-sky-300">/api/auth/me</code>
          </Card>
        </div>
        <div className="mt-4 flex justify-center">
          <Badge variant="outline" className="border-amber-500/30 text-amber-400 text-[10px]">
            Blocked on Prisma UserAdmin endpoint
          </Badge>
        </div>
      </Card>
    </>
  );
}
