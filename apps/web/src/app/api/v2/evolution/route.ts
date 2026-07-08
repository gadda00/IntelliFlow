/**
 * GET /api/v2/evolution
 * Get evolution actions for all agents (or a specific agent).
 *
 * Without ?agentId: returns evolution actions across all known agents,
 * sorted by confidence (highest first). Pass ?status=pending|approved|
 * rejected|applied|rolled_back to filter by review status.
 *
 * With ?agentId=X: returns evolution actions for a single agent.
 *
 * POST /api/v2/evolution
 * Apply or reject an evolution action (human-in-the-loop).
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { EvolutionControlPlane, type EvolutionAction } from '@busara/agents';
import { trajectoryStore as store } from '@/lib/trajectory/store';
import { getAgentIds } from '@/lib/agents/v7/registry';

const controlPlane = new EvolutionControlPlane(store);

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const agentId = url.searchParams.get('agentId');
  const statusFilter = url.searchParams.get('status') as EvolutionAction['status'] | null;

  if (agentId) {
    const actions = await controlPlane.analyze(agentId);
    const filtered = statusFilter ? actions.filter(a => a.status === statusFilter) : actions;
    return NextResponse.json({ ok: true, data: filtered });
  }

  // Analyze all known agents and merge the resulting actions.
  // In production this would be a persisted query against an EvolutionAction
  // table; for now we recompute on each request from the trajectory store.
  const agentIds = getAgentIds();
  const allActions: EvolutionAction[] = [];
  for (const id of agentIds) {
    try {
      const actions = await controlPlane.analyze(id);
      allActions.push(...actions);
    } catch {
      // skip agents with insufficient data
    }
  }
  // Sort by confidence (highest first), then by createdAt desc
  allActions.sort((a, b) => b.confidence - a.confidence || b.createdAt.localeCompare(a.createdAt));

  const filtered = statusFilter ? allActions.filter(a => a.status === statusFilter) : allActions;
  return NextResponse.json({ ok: true, data: filtered, total: filtered.length });
}

const ActionSchema = z.object({
  actionType: z.enum(['approve', 'reject', 'apply', 'rollback']),
  agentId: z.string(),
  actionIndex: z.number(),
  reason: z.string().optional(),
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
