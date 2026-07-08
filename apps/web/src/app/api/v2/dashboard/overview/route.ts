/**
 * GET /api/v2/dashboard/overview
 * Returns system-wide dashboard metrics:
 *   - 4 stat cards: totalTrajectories, successRate, avgReward, llmCostToday
 *   - trajectoriesPerDay (last 7 days, for line chart)
 *   - topAgentsByTrajectoryCount (top 5, for bar chart)
 *   - recentAlerts (FLAG_DRIFT, FLAG_LOW_REWARD actions)
 *
 * Aggregates from the trajectory store + evolution control plane.
 */

import { NextResponse } from 'next/server';
import { trajectoryStore as store } from '@/lib/trajectory/store';
import { EvolutionControlPlane } from '@busara/agents';
import { getAgentIds } from '@/lib/agents/v7/registry';

export const dynamic = 'force-dynamic';

const controlPlane = new EvolutionControlPlane(store);

export async function GET() {
  // Pull all trajectories (capped at 500 for performance in dev)
  const { trajectories } = await store.query({ limit: 500, orderBy: 'startedAt', orderDirection: 'desc' });

  const total = trajectories.length;
  const successes = trajectories.filter(t => t.status === 'success').length;
  const successRate = total > 0 ? successes / total : 0;

  // Average reward across all trajectories
  const rewards = trajectories.map(t => t.averageReward).filter(r => Number.isFinite(r));
  const avgReward = rewards.length > 0 ? rewards.reduce((a, b) => a + b, 0) / rewards.length : 0;

  // Today's LLM cost — computed by joining with full trajectories (estimatedCost)
  const todayStr = new Date().toISOString().slice(0, 10);
  let llmCostToday = 0;
  for (const t of trajectories) {
    if (t.startedAt.slice(0, 10) !== todayStr) continue;
    const full = await store.get(t.id);
    if (full) llmCostToday += full.metrics.estimatedCost ?? 0;
  }

  // Trajectories per day (last 7 days)
  const trajectoriesPerDay: { date: string; count: number; successCount: number; failedCount: number }[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().slice(0, 10);
    const dayTrj = trajectories.filter(t => t.startedAt.slice(0, 10) === dateStr);
    trajectoriesPerDay.push({
      date: dateStr,
      count: dayTrj.length,
      successCount: dayTrj.filter(t => t.status === 'success').length,
      failedCount: dayTrj.filter(t => t.status === 'failed').length,
    });
  }

  // Top 5 agents by trajectory count
  const agentCounts = new Map<string, number>();
  for (const t of trajectories) {
    agentCounts.set(t.agentId, (agentCounts.get(t.agentId) ?? 0) + 1);
  }
  const topAgents = Array.from(agentCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([agentId, count]) => ({ agentId, count }));

  // Recent alerts — flag drift / low reward across all agents
  const recentAlerts = [];
  const agentIdsToCheck = Array.from(agentCounts.keys()).length > 0
    ? Array.from(agentCounts.keys())
    : getAgentIds().slice(0, 10);
  for (const agentId of agentIdsToCheck) {
    try {
      const actions = await controlPlane.analyze(agentId);
      for (const a of actions) {
        if (a.type === 'FLAG_DRIFT' || a.type === 'FLAG_LOW_REWARD' || a.type === 'FLAG_HIGH_FAILURE') {
          recentAlerts.push(a);
        }
      }
    } catch {
      // skip
    }
    if (recentAlerts.length >= 20) break;
  }
  recentAlerts.sort((a, b) => b.confidence - a.confidence);

  return NextResponse.json({
    ok: true,
    data: {
      stats: {
        totalTrajectories: total,
        successRate,
        avgReward,
        llmCostToday,
      },
      trajectoriesPerDay,
      topAgents,
      recentAlerts: recentAlerts.slice(0, 10),
      agentCount: agentCounts.size,
    },
  });
}
