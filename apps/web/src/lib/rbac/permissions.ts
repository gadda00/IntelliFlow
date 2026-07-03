// RBAC — Role-Based Access Control
// Viewer / Analyst / Admin / Owner roles with permission checks
// All 5 advisory docs flagged this as critical for enterprise deals

export type Role = 'viewer' | 'analyst' | 'admin' | 'owner';

export type Permission =
  | 'analysis:create' | 'analysis:read' | 'analysis:delete'
  | 'data:upload' | 'data:connect' | 'data:export'
  | 'agent:run' | 'agent:configure'
  | 'team:invite' | 'team:remove'
  | 'billing:manage' | 'apikeys:manage'
  | 'audit:read' | 'settings:manage';

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  viewer: [
    'analysis:read',
    'data:export',
  ],
  analyst: [
    'analysis:create', 'analysis:read',
    'data:upload', 'data:connect', 'data:export',
    'agent:run',
    'audit:read',
  ],
  admin: [
    'analysis:create', 'analysis:read', 'analysis:delete',
    'data:upload', 'data:connect', 'data:export',
    'agent:run', 'agent:configure',
    'team:invite', 'team:remove',
    'billing:manage', 'apikeys:manage',
    'audit:read', 'settings:manage',
  ],
  owner: [
    'analysis:create', 'analysis:read', 'analysis:delete',
    'data:upload', 'data:connect', 'data:export',
    'agent:run', 'agent:configure',
    'team:invite', 'team:remove',
    'billing:manage', 'apikeys:manage',
    'audit:read', 'settings:manage',
  ],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function getRolePermissions(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}

export function getAllRoles(): { role: Role; permissions: Permission[]; description: string }[] {
  return [
    { role: 'viewer', permissions: ROLE_PERMISSIONS.viewer, description: 'Read-only access to shared analyses' },
    { role: 'analyst', permissions: ROLE_PERMISSIONS.analyst, description: 'Create analyses, upload data, run agents' },
    { role: 'admin', permissions: ROLE_PERMISSIONS.admin, description: 'Full access including team management and billing' },
    { role: 'owner', permissions: ROLE_PERMISSIONS.owner, description: 'Full control including deletion and transfer' },
  ];
}

/**
 * Check if a user can perform an action.
 * Usage in API routes:
 *   requirePermission(req, 'analysis:create');
 */
export function checkPermission(userRole: Role | undefined, permission: Permission): { allowed: boolean; reason?: string } {
  if (!userRole) {
    return { allowed: false, reason: 'No role assigned' };
  }
  if (!hasPermission(userRole, permission)) {
    return { allowed: false, reason: `Role '${userRole}' does not have permission '${permission}'` };
  }
  return { allowed: true };
}
