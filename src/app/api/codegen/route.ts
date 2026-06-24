import { NextRequest, NextResponse } from 'next/server';
import { getAgentPool } from '@/lib/agents';
import { CodeGeneratorAgent, AgentExecutionContext } from '@/lib/agents';
import { profileDataset } from '@/lib/agents';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fileContents, targetVariable } = body;
    if (!Array.isArray(fileContents) || !fileContents.length) {
      return NextResponse.json({ error: 'fileContents array is required' }, { status: 400 });
    }
    const pool = getAgentPool();
    const agent = pool.get('code_generator') as CodeGeneratorAgent;
    if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 500 });
    const ctx: AgentExecutionContext = {
      analysisId: `codegen_${Date.now()}`,
      analysisConfig: { causalTarget: targetVariable },
      fileContents,
      dependencyResults: {
        analysis_strategist: { targetVariable },
        data_scout: { profile: profileDataset(fileContents) },
      },
      startedAt: new Date().toISOString(),
    };
    const result = await agent.execute(ctx);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
