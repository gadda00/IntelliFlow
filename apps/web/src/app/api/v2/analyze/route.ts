/**
 * POST /api/v2/analyze
 * ====================
 *
 * Runs a single Busara agent from the @busara/agents pool against the supplied
 * dataframe, with full trajectory recording wired in automatically.
 *
 * This is the v2 entry point — it uses the AReaL trajectory protocol so every
 * execution is captured for the Data Proxy + Evolution Control Plane.
 *
 * Request body:
 *   {
 *     agentId: string,                 // e.g. "data_ingestion"
 *     dataframe: Record<string,unknown>[],
 *     config?: Record<string,unknown>,
 *     analysisId?: string,             // auto-generated if omitted
 *     workspaceId?: string,
 *     organizationId?: string
 *   }
 *
 * Response:
 *   {
 *     ok: true,
 *     analysisId: string,
 *     trajectoryId: string,            // use this to POST rewards later
 *     result: AgentResult
 *   }
 *
 * The trajectory ID can be used with:
 *   POST /api/v2/trajectory/:id/reward
 * to attach explicit/implicit reward signals after the user interacts with the
 * result. This closes the RL feedback loop described in the AReaL paper.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  AgentPool,
  withTrajectory,
  InMemoryTrajectoryStore,
} from '@busara/agents';
import { getUserFromRequest } from '@/lib/auth/server';

// Module-level shared store. In production this would be a PrismaTrajectoryStore
// backed by the Trajectory model. The same instance is reused across requests so
// that the /api/v2/trajectory and /api/v2/evolution routes can query what this
// route recorded — they import the store from a shared module (see
// src/lib/trajectory/store.ts).
import { trajectoryStore } from '@/lib/trajectory/store';

// Backwards-compat: if a caller imports the store from this module directly,
// re-export the shared instance under the legacy name.
export const store = trajectoryStore;

// Agent pool — lazily constructed. Built once per server lifetime.
let _pool: AgentPool | null = null;
function pool(): AgentPool {
  if (!_pool) _pool = new AgentPool();
  return _pool;
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  agentId: z.string().min(1),
  dataframe: z.array(z.record(z.string(), z.unknown())).min(1),
  config: z.record(z.string(), z.unknown()).default({}),
  analysisId: z.string().optional(),
  workspaceId: z.string().optional(),
  organizationId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: 'BAD_JSON', message: 'Request body must be valid JSON' } },
      { status: 400 },
    );
  }

  const parse = BodySchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json(
      { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: parse.error.issues } },
      { status: 400 },
    );
  }
  const { agentId, dataframe, config, workspaceId, organizationId } = parse.data;

  // Auth is optional — anonymous callers get a synthetic user id so trajectories
  // still have an owner for governance / dedup.
  const user = await getUserFromRequest(req);
  const userId = user?.id ?? `anon_${req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'}`;

  const agent = pool().getAgent(agentId);
  if (!agent) {
    return NextResponse.json(
      { ok: false, error: { code: 'AGENT_NOT_FOUND', message: `Agent '${agentId}' is not registered` } },
      { status: 404 },
    );
  }

  const analysisId = parse.data.analysisId ?? `an_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // Wrap the agent with trajectory recording + persistence.
  const wrappedAgent = withTrajectory(agent, {
    store: trajectoryStore,
    analysisId,
    userId,
    workspaceId,
    organizationId,
  });

  const ctx = {
    analysisId,
    dataframe,
    config,
    previousResults: new Map(),
    metadata: {},
    startedAt: new Date().toISOString(),
  };

  try {
    const result = await wrappedAgent.execute(ctx as any);

    const trajectoryId = (wrappedAgent as any)._lastTrajectoryId as string | undefined;

    return NextResponse.json({
      ok: true,
      analysisId,
      trajectoryId,
      result,
    });
  } catch (err: any) {
    const trajectoryId = (wrappedAgent as any)._lastTrajectoryId as string | undefined;
    return NextResponse.json(
      {
        ok: false,
        analysisId,
        trajectoryId,
        error: { code: 'AGENT_EXECUTION_ERROR', message: err?.message ?? 'Unknown error' },
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    agents: pool().getAgentMetadata().map(m => ({ id: m.id, name: m.name, stage: m.stage, stability: m.stability })),
  });
}
