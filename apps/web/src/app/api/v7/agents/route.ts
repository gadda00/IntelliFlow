import { NextResponse } from 'next/server';
import { getAllAgentMetadata, getTotalAgentCount, getAgentCountByStage } from '@/lib/agents/v7/registry';

export async function GET() {
  const agents = getAllAgentMetadata();
  const total = getTotalAgentCount();
  const byStage = getAgentCountByStage();

  const tiers = {
    core: agents.filter(a => a.tier === 'core').length,
    advanced: agents.filter(a => a.tier === 'advanced').length,
    specialized: agents.filter(a => a.tier === 'specialized').length,
    ml: agents.filter(a => a.tier === 'ml').length,
    stats: agents.filter(a => a.tier === 'stats').length,
  };

  return NextResponse.json({
    total,
    agents,
    tiers,
    byStage,
    stages: Object.keys(byStage).length,
    version: '7.0',
  });
}
