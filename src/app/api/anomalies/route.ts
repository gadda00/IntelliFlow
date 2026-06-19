import { NextRequest, NextResponse } from 'next/server';
import { getAgentPool } from '@/lib/agents';
import { AnomalySentinelAgent, AgentExecutionContext } from '@/lib/agents';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fileContents, sensitivity = 'medium' } = body;
    if (!Array.isArray(fileContents) || !fileContents.length) {
      return NextResponse.json({ error: 'fileContents array is required' }, { status: 400 });
    }
    const pool = getAgentPool();
    const agent = pool.get('anomaly_sentinel') as AnomalySentinelAgent;
    if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 500 });

    const ctx: AgentExecutionContext = {
      analysisId: `anomaly_${Date.now()}`,
      analysisConfig: { sensitivity },
      fileContents,
      dependencyResults: {},
      startedAt: new Date().toISOString(),
    };
    const result = await agent.execute(ctx);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
