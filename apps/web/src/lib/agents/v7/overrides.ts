/**
 * Admin override store for v7 agents.
 *
 * Lives outside the route file because Next.js route files only allow
 * HTTP-method exports (GET/POST/...) plus a few framework exports
 * (dynamic, runtime, maxDuration). Non-HTTP exports break the route
 * type-check during `next build`.
 *
 * In production this would be a Prisma-backed AgentOverride model; the
 * in-memory store is reset on server restart and is enough to drive
 * the admin UI in development.
 */

export interface AgentOverride {
  agentId: string;
  stability?: 'experimental' | 'beta' | 'stable' | 'deprecated';
  enabled?: boolean;
  configDefaults?: Record<string, unknown>;
  updatedAt: string;
  updatedBy?: string;
}

const _overrides = new Map<string, AgentOverride>();

/** Read an override (or undefined). */
export function getOverride(agentId: string): AgentOverride | undefined {
  return _overrides.get(agentId);
}

/** Write an override (upsert). */
export function setOverride(agentId: string, override: AgentOverride): void {
  _overrides.set(agentId, override);
}

/** Read the raw override record (mutable, for PATCH-style merges). */
export function readOverrideForPatch(agentId: string): AgentOverride | undefined {
  return _overrides.get(agentId);
}

/** Public test hook — not exposed over HTTP. */
export function _resetOverrides(): void {
  _overrides.clear();
}
