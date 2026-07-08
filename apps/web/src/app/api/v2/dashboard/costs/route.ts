/**
 * GET /api/v2/dashboard/costs
 * Returns LLM cost breakdown for the costs dashboard page:
 *   - totalCostMonth
 *   - costByProvider (GLM, OpenAI, Anthropic, Google)
 *   - costByAgent (top 10)
 *   - dailyCostTrend (last 30 days)
 *   - tokenUsage { input, output }
 *
 * Walks the trajectory store, inspects every step with an llmCall, and
 * aggregates cost + token usage.
 */

import { NextResponse } from 'next/server';
import { trajectoryStore as store } from '@/lib/trajectory/store';

export const dynamic = 'force-dynamic';

interface CostRow {
  date: string;
  cost: number;
  tokensIn: number;
  tokensOut: number;
}

export async function GET() {
  const { trajectories } = await store.query({ limit: 500, orderBy: 'startedAt', orderDirection: 'desc' });

  const now = new Date();
  const monthStr = now.toISOString().slice(0, 7); // YYYY-MM

  let totalCostMonth = 0;
  let totalTokensIn = 0;
  let totalTokensOut = 0;
  const costByProvider: Record<string, number> = {};
  const costByAgent: Record<string, number> = {};
  const tokensByProvider: Record<string, { in: number; out: number }> = {};
  const dailyMap = new Map<string, CostRow>();

  for (const summary of trajectories) {
    // Only consider this month
    if (!summary.startedAt.startsWith(monthStr)) continue;

    const full = await store.get(summary.id);
    if (!full) continue;

    const dateStr = summary.startedAt.slice(0, 10);
    const row = dailyMap.get(dateStr) ?? { date: dateStr, cost: 0, tokensIn: 0, tokensOut: 0 };

    for (const step of full.steps) {
      const llm = step.llmCall;
      if (!llm) continue;
      const cost = llm.cost ?? 0;
      const provider = (llm.provider || 'unknown').toLowerCase();

      totalCostMonth += cost;
      totalTokensIn += llm.tokensIn ?? 0;
      totalTokensOut += llm.tokensOut ?? 0;

      costByProvider[provider] = (costByProvider[provider] ?? 0) + cost;
      costByAgent[full.agentId] = (costByAgent[full.agentId] ?? 0) + cost;

      if (!tokensByProvider[provider]) tokensByProvider[provider] = { in: 0, out: 0 };
      tokensByProvider[provider].in += llm.tokensIn ?? 0;
      tokensByProvider[provider].out += llm.tokensOut ?? 0;

      row.cost += cost;
      row.tokensIn += llm.tokensIn ?? 0;
      row.tokensOut += llm.tokensOut ?? 0;
    }

    dailyMap.set(dateStr, row);
  }

  // Build 30-day trend (filling gaps with zero)
  const dailyCostTrend: CostRow[] = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().slice(0, 10);
    dailyCostTrend.push(dailyMap.get(dateStr) ?? { date: dateStr, cost: 0, tokensIn: 0, tokensOut: 0 });
  }

  const topAgentsByCost = Object.entries(costByAgent)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([agentId, cost]) => ({ agentId, cost }));

  return NextResponse.json({
    ok: true,
    data: {
      totalCostMonth,
      tokensTotal: totalTokensIn + totalTokensOut,
      tokensIn: totalTokensIn,
      tokensOut: totalTokensOut,
      costByProvider,
      tokensByProvider,
      topAgentsByCost,
      dailyCostTrend,
    },
  });
}
