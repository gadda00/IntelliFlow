/**
 * GET /api/v2/agents/:agentId
 * ----------------------------
 * Returns the full metadata for a single agent plus its live trajectory stats.
 *
 * PATCH /api/v2/agents/:agentId
 * -----------------------------
 * Updates admin-controlled fields on an agent:
 *   - stability (experimental | beta | stable | deprecated)
 *   - enabled   (boolean)
 *   - configDefaults (Record<string, unknown>)
 *
 * The updates are persisted to an in-process admin override map (an
 * AdminOverrideStore). In production this would be a Prisma-backed
 * AgentOverride model; the in-memory store is reset on server restart and
 * is enough to drive the admin UI in development.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAgent, getAgentIds } from '@/lib/agents/v7/registry';
import { trajectoryStore } from '@/lib/trajectory/store';
import {
  getOverride,
  readOverrideForPatch,
  setOverride,
  type AgentOverride,
} from '@/lib/agents/v7/overrides';

export const dynamic = 'force-dynamic';

// (Admin override store moved to @/lib/agents/v7/overrides — Next.js route
// files only allow HTTP-method exports, so non-HTTP helpers must live in a
// separate module.)

function inferStability(
  tier: string,
  meta?: string,
): 'experimental' | 'beta' | 'stable' | 'deprecated' {
  if (
    meta &&
    ['experimental', 'beta', 'stable', 'deprecated'].includes(meta)
  ) {
    return meta as 'experimental' | 'beta' | 'stable' | 'deprecated';
  }
  if (tier === 'experimental') return 'experimental';
  if (tier === 'core' || tier === 'advanced') return 'stable';
  return 'beta';
}

// ----------------------------------------------------------------------------
// GET
// ----------------------------------------------------------------------------

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await params;
  if (!getAgentIds().includes(agentId)) {
    return NextResponse.json(
      { ok: false, error: { code: 'AGENT_NOT_FOUND', message: `Agent '${agentId}' is not registered` } },
      { status: 404 },
    );
  }

  const agent = createAgent(agentId);
  if (!agent) {
    return NextResponse.json(
      { ok: false, error: { code: 'AGENT_NOT_FOUND', message: `Agent '${agentId}' could not be instantiated` } },
      { status: 404 },
    );
  }

  const meta = agent.metadata;
  const override = getOverride(agentId);
  const stats = await trajectoryStore.getAgentStats(agentId);

  return NextResponse.json({
    ok: true,
    data: {
      ...meta,
      stability: override?.stability ?? inferStability(meta.tier, (meta as { stability?: string }).stability),
      enabled: override?.enabled ?? true,
      configDefaults: override?.configDefaults ?? {},
      overrideUpdatedAt: override?.updatedAt,
      stats,
    },
  });
}

// ----------------------------------------------------------------------------
// PATCH
// ----------------------------------------------------------------------------

const PatchSchema = z.object({
  stability: z.enum(['experimental', 'beta', 'stable', 'deprecated']).optional(),
  enabled: z.boolean().optional(),
  configDefaults: z.record(z.string(), z.unknown()).optional(),
  updatedBy: z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await params;
  if (!getAgentIds().includes(agentId)) {
    return NextResponse.json(
      { ok: false, error: { code: 'AGENT_NOT_FOUND', message: `Agent '${agentId}' is not registered` } },
      { status: 404 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: 'BAD_JSON', message: 'Request body must be valid JSON' } },
      { status: 400 },
    );
  }

  const parse = PatchSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json(
      { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid agent update', details: parse.error.issues } },
      { status: 400 },
    );
  }

  if (
    parse.data.stability === undefined &&
    parse.data.enabled === undefined &&
    parse.data.configDefaults === undefined
  ) {
    return NextResponse.json(
      { ok: false, error: { code: 'VALIDATION_ERROR', message: 'No fields to update — supply stability, enabled, or configDefaults' } },
      { status: 400 },
    );
  }

  const prev = readOverrideForPatch(agentId) ?? {
    agentId,
    configDefaults: {},
  };
  const next: AgentOverride = {
    ...prev,
    ...parse.data,
    configDefaults: { ...prev.configDefaults, ...(parse.data.configDefaults ?? {}) },
    updatedAt: new Date().toISOString(),
    updatedBy: parse.data.updatedBy,
  };
  setOverride(agentId, next);

  return NextResponse.json({
    ok: true,
    data: next,
  });
}
