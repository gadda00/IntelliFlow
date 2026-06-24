import { NextRequest, NextResponse } from 'next/server';
import { getAgentPool } from '@/lib/agents';
import { ForecastingOracleAgent, AgentExecutionContext } from '@/lib/agents';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fileContents, periods = 12, targetColumn } = body;
    if (!Array.isArray(fileContents) || !fileContents.length) {
      return NextResponse.json({ error: 'fileContents array is required' }, { status: 400 });
    }
    const pool = getAgentPool();
    const agent = pool.get('forecasting_oracle') as ForecastingOracleAgent;
    if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 500 });

    const ctx: AgentExecutionContext = {
      analysisId: `forecast_${Date.now()}`,
      analysisConfig: { forecastTarget: targetColumn, periods },
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
