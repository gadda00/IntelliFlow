import { NextRequest, NextResponse } from 'next/server';
import { getAgentPool } from '@/lib/agents';
import { RealTimeAlertAgent, AgentExecutionContext } from '@/lib/agents';
import { getUserFromRequest } from '@/lib/auth/server';

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { fileContents } = body;

    if (!Array.isArray(fileContents) || !fileContents.length) {
      return NextResponse.json({ error: 'fileContents array required' }, { status: 400 });
    }

    const pool = getAgentPool();
    const agent = pool.get('realtime_alert') as RealTimeAlertAgent;
    if (!agent) return NextResponse.json({ error: 'Alert agent not found' }, { status: 500 });

    const ctx: AgentExecutionContext = {
      analysisId: `alert_${Date.now()}`,
      analysisConfig: {},
      fileContents,
      dependencyResults: {},
      startedAt: new Date().toISOString(),
      userId: user.id,
    };

    const result = await agent.execute(ctx);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
