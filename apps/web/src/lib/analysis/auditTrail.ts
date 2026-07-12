/**
 * Audit Trail — query logs, role-based access, and audit records.
 * Per the Brutally Honest Review:
 * "Query logs, role-based access, and an audit trail are not 'enterprise
 * later' features to bolt on eventually — this is exactly where pilots
 * stall at the procurement stage."
 */

export interface AuditEntry {
  id: string;
  timestamp: string;
  userId: string;
  action: string;
  resource: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export interface Role {
  id: string;
  name: string;
  permissions: string[];
}

export class AuditTrail {
  private static KEY = 'busara_audit_trail';
  private static MAX_ENTRIES = 500;

  static log(entry: Omit<AuditEntry, 'id' | 'timestamp'>): void {
    if (typeof window === 'undefined') return;
    try {
      const entries = this.getAll();
      const newEntry: AuditEntry = {
        ...entry,
        id: `audit-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        timestamp: new Date().toISOString(),
        ipAddress: 'client-side',
        userAgent: navigator.userAgent.substring(0, 200),
      };
      entries.unshift(newEntry);
      if (entries.length > this.MAX_ENTRIES) entries.length = this.MAX_ENTRIES;
      localStorage.setItem(this.KEY, JSON.stringify(entries));
    } catch {}
  }

  static getAll(): AuditEntry[] {
    if (typeof window === 'undefined') return [];
    try {
      return JSON.parse(localStorage.getItem(this.KEY) || '[]');
    } catch { return []; }
  }

  static getByUser(userId: string): AuditEntry[] {
    return this.getAll().filter(e => e.userId === userId);
  }

  static getByAction(action: string): AuditEntry[] {
    return this.getAll().filter(e => e.action === action);
  }

  static getRecent(limit: number = 50): AuditEntry[] {
    return this.getAll().slice(0, limit);
  }

  static clear(): void {
    if (typeof window !== 'undefined') localStorage.removeItem(this.KEY);
  }

  static exportCSV(): string {
    const entries = this.getAll();
    const headers = ['timestamp', 'userId', 'action', 'resource', 'ipAddress'];
    const rows = entries.map(e => [
      e.timestamp,
      e.userId,
      e.action,
      e.resource,
      e.ipAddress || '',
    ].map(v => `"${v}"`).join(','));
    return [headers.join(','), ...rows].join('\n');
  }
}

// ─── Role-Based Access Control ─────────────────────────────────────
export const ROLES: Record<string, Role> = {
  viewer: {
    id: 'viewer',
    name: 'Viewer',
    permissions: ['analysis:view', 'results:view', 'reports:view'],
  },
  analyst: {
    id: 'analyst',
    name: 'Analyst',
    permissions: [
      'analysis:view', 'analysis:create', 'analysis:run',
      'results:view', 'results:export',
      'reports:view', 'reports:create',
      'corrections:save',
    ],
  },
  admin: {
    id: 'admin',
    name: 'Administrator',
    permissions: [
      'analysis:view', 'analysis:create', 'analysis:run', 'analysis:delete',
      'results:view', 'results:export', 'results:share',
      'reports:view', 'reports:create', 'reports:delete',
      'corrections:save', 'corrections:delete',
      'users:manage', 'audit:view', 'settings:manage',
    ],
  },
};

export class RBAC {
  static hasPermission(userRole: string, permission: string): boolean {
    const role = ROLES[userRole];
    if (!role) return false;
    return role.permissions.includes(permission);
  }

  static canAccess(userRole: string, action: string): boolean {
    return this.hasPermission(userRole, action);
  }

  static getRole(userRole: string): Role | null {
    return ROLES[userRole] || null;
  }

  static getAvailableRoles(): Role[] {
    return Object.values(ROLES);
  }
}
