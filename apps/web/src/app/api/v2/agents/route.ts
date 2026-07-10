/**
 * GET /api/v2/agents
 * Lists all agents from the @busara/agents framework.
 * Supports filtering by stage, tier, stability.
 */

import { NextResponse } from 'next/server';
import { defaultAgentPool } from '@busara/agents';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const stage = url.searchParams.get('stage');
  const tier = url.searchParams.get('tier');
  const stability = url.searchParams.get('stability');

  let agents = defaultAgentPool.getAllAgents();

  if (stage) agents = agents.filter((a: any) => a?.metadata?.stage === stage);
  if (tier) agents = agents.filter((a: any) => a?.metadata?.tier === tier);
  if (stability)
    agents = agents.filter((a: any) => a?.metadata?.stability === stability);

  const byStage = agents.reduce<Record<string, number>>((acc, a: any) => {
    const s = a?.metadata?.stage ?? 'unknown';
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({
    ok: true,
    data: agents.map((a: any) => ({
      id: a.metadata.id,
      name: a.metadata.name,
      role: a.metadata.role,
      tier: a.metadata.tier,
      stage: a.metadata.stage,
      stageNumber: a.metadata.stageNumber,
      description: a.metadata.description,
      capabilities: a.metadata.capabilities,
      dependencies: a.metadata.dependencies,
      stability: a.metadata.stability,
      icon: a.metadata.icon,
      color: a.metadata.color,
      timeoutMs: a.metadata.timeoutMs,
    })),
    meta: {
      total: agents.length,
      byStage,
    },
  });
}
