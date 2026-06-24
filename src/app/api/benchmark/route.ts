import { NextRequest, NextResponse } from 'next/server';
import { getAgentPool } from '@/lib/agents';
import { BenchmarkAgent, DataScoutAgent, DataQualityGuardianAgent, AgentExecutionContext } from '@/lib/agents';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fileContents } = body;
    if (!Array.isArray(fileContents) || !fileContents.length) {
      return NextResponse.json({ error: 'fileContents array is required' }, { status: 400 });
    }
    const pool = getAgentPool();

    // Run scout + quality first
    const scout = pool.get('data_scout') as DataScoutAgent;
    const quality = pool.get('data_quality_guardian') as DataQualityGuardianAgent;
    const depResults: Record<string, any> = {};

    if (scout) {
      depResults.data_scout = await scout.execute({
        analysisId: `bench_scout_${Date.now()}`,
        analysisConfig: {}, fileContents, dependencyResults: {}, startedAt: new Date().toISOString(),
      });
    }
    if (quality) {
      depResults.data_quality_guardian = await quality.execute({
        analysisId: `bench_q_${Date.now()}`,
        analysisConfig: {}, fileContents, dependencyResults: {}, startedAt: new Date().toISOString(),
      });
    }

    const agent = pool.get('benchmark_agent') as BenchmarkAgent;
    if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 500 });
    const ctx: AgentExecutionContext = {
      analysisId: `bench_${Date.now()}`,
      analysisConfig: {}, fileContents,
      dependencyResults: depResults, startedAt: new Date().toISOString(),
    };
    const result = await agent.execute(ctx);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
