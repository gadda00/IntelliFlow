/**
 * GET /api/v2/evolution
 * Get evolution actions for all agents (or a specific agent).
 *
 * POST /api/v2/evolution
 * Apply or reject an evolution action (human-in-the-loop).
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { InMemoryTrajectoryStore, EvolutionControlPlane } from '@busara/agents';

const store = new InMemoryTrajectoryStore();
const controlPlane = new EvolutionControlPlane(store);

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const agentId = url.searchParams.get('agentId');

  if (agentId) {
    const actions = await controlPlane.analyze(agentId);
    return NextResponse.json({ ok: true, data: actions });
  }

  // Analyze all agents that have trajectories
  // In production, this would be a DB query for distinct agentIds
  return NextResponse.json({
    ok: true,
    data: [],
    message: 'Pass ?agentId=X to get evolution actions for a specific agent',
  });
}

const ActionSchema = z.object({
  actionType: z.enum(['approve', 'reject', 'apply', 'rollback']),
  agentId: z.string(),
  actionIndex: z.number(),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parse = ActionSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json(
      { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid action', details: parse.error.issues } },
      { status: 400 },
    );
  }

  // In production, this would persist the action status to the DB
  // and trigger the actual evolution (config update, stability change, etc.)
  return NextResponse.json({
    ok: true,
    data: {
      ...parse.data,
      appliedAt: new Date().toISOString(),
      status: parse.data.actionType === 'apply' ? 'applied' : parse.data.actionType === 'reject' ? 'rejected' : 'approved',
    },
  });
}
