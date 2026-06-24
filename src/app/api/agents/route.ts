import { NextResponse } from 'next/server';
import { listAgents, TOTAL_AGENTS } from '@/lib/agents';
import { getAgentPool } from '@/lib/agents';
import { SmartCache } from '@/lib/agents/core';

const cache = new SmartCache();

export async function GET() {
  const cached = cache.get('agents_list');
  if (cached) return NextResponse.json(cached);

  const agents = listAgents();
  const pool = getAgentPool();
  const response = {
    total: TOTAL_AGENTS,
    agents,
    tiers: {
      core: agents.filter(a => a.tier === 'core').length,
      advanced: agents.filter(a => a.tier === 'advanced').length,
      specialized: agents.filter(a => a.tier === 'specialized').length,
    },
    poolSize: pool.size,
  };
  cache.set('agents_list', response, 10 * 60 * 1000);
  return NextResponse.json(response);
}
