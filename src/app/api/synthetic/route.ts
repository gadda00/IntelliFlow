import { NextRequest, NextResponse } from 'next/server';
import { getAgentPool } from '@/lib/agents';
import { SyntheticDataGeneratorAgent, PrivacyGuardianAgent, AgentExecutionContext } from '@/lib/agents';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fileContents } = body;
    if (!Array.isArray(fileContents) || !fileContents.length) {
      return NextResponse.json({ error: 'fileContents array is required' }, { status: 400 });
    }
    const pool = getAgentPool();

    // Run privacy guardian first to detect PII
    const privacyAgent = pool.get('privacy_guardian') as PrivacyGuardianAgent;
    const privacyResult = privacyAgent ? await privacyAgent.execute({
      analysisId: `priv_${Date.now()}`,
      analysisConfig: {},
      fileContents,
      dependencyResults: {},
      startedAt: new Date().toISOString(),
    }) : { findings: [] };

    const agent = pool.get('synthetic_data_generator') as SyntheticDataGeneratorAgent;
    if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 500 });

    const ctx: AgentExecutionContext = {
      analysisId: `synth_${Date.now()}`,
      analysisConfig: {},
      fileContents,
      dependencyResults: { privacy_guardian: privacyResult },
      startedAt: new Date().toISOString(),
    };
    const result = await agent.execute(ctx);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
