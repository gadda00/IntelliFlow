import { NextResponse } from 'next/server';
import { getAllRoles } from '@/lib/rbac/permissions';

export async function GET() {
  return NextResponse.json({
    roles: getAllRoles(),
    description: 'Busara RBAC — 4 roles (viewer, analyst, admin, owner) with granular permissions',
  });
}
