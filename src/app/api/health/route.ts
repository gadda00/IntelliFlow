import { NextResponse } from 'next/server';
import { getAgentPool, SmartCache } from '@/lib/agents';
import { getDAG } from '@/lib/agents';

const cache = new SmartCache();

export async function GET() {
  const cached = cache.get('health');
  if (cached) return NextResponse.json(cached);

  const pool = getAgentPool();
  const dag = getDAG();
  const response = {
    status: 'healthy',
    version: '3.0.0',
    timestamp: new Date().toISOString(),
    agents: {
      total: pool.size,
      ids: Array.from(pool.keys()),
    },
    dag: {
      stages: Math.max(...Object.values(dag).map(n => n.stage)) + 1,
      edges: Object.values(dag).reduce((acc, n) => acc + n.dependsOn.length, 0),
    },
    cache: cache.stats(),
    environment: process.env.NODE_ENV ?? 'development',
    paystackConfigured: !!(process.env.PAYSTACK_SECRET_KEY && process.env.PAYSTACK_SECRET_KEY.startsWith('sk_')),
  };
  cache.set('health', response, 30000); // 30s
  return NextResponse.json(response);
}
