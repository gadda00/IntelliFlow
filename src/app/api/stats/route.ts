import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, getUsageForMonth } from '@/lib/auth/server';
import { db } from '@/lib/db';
import { TOTAL_AGENTS, listAgents } from '@/lib/agents';
import { PLANS } from '@/lib/paystack/server';

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const usage = await getUsageForMonth(user.id);
  const planDetails = PLANS[user.plan] ?? PLANS.free;
  const agents = listAgents();

  // Compute platform stats
  const totalUsers = await db.user.count();
  const totalAnalyses = await db.analysis.count();
  const totalPayments = await db.payment.count({ where: { status: 'success' } });

  return NextResponse.json({
    user: {
      id: user.id,
      plan: user.plan,
      analysesUsedThisMonth: usage.analysesUsed,
      analysesLimit: usage.limit,
      features: planDetails.features,
    },
    platform: {
      totalAgents: TOTAL_AGENTS,
      agentTiers: {
        core: agents.filter(a => a.tier === 'core').length,
        advanced: agents.filter(a => a.tier === 'advanced').length,
        specialized: agents.filter(a => a.tier === 'specialized').length,
      },
      agentNames: agents.map(a => a.name),
      totalUsers,
      totalAnalyses,
      totalPayments,
    },
  });
}
