/**
 * GET /api/v2/trajectory/agent/:agentId/stats
 * Get aggregate trajectory statistics for an agent.
 */

import { NextResponse } from 'next/server';
import { InMemoryTrajectoryStore } from '@busara/agents';

const store = new InMemoryTrajectoryStore();

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: { agentId: string } },
) {
  const stats = await store.getAgentStats(params.agentId);
  return NextResponse.json({ ok: true, data: stats });
}
