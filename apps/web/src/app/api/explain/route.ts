import { NextRequest, NextResponse } from 'next/server';
import { getAgentPool } from '@/lib/agents';
import { ExplainabilityAgent, CausalArchitectAgent, AutoMLAgent, AgentExecutionContext } from '@/lib/agents';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fileContents, targetVariable } = body;
    if (!Array.isArray(fileContents) || !fileContents.length) {
      return NextResponse.json({ error: 'fileContents array is required' }, { status: 400 });
    }
    const pool = getAgentPool();

    // Run dependency agents first (causal + auto-ml) to provide context
    const causalAgent = pool.get('causal_architect') as CausalArchitectAgent;
    const autoMlAgent = pool.get('auto_ml_agent') as AutoMLAgent;
    const depResults: Record<string, any> = {};

    if (causalAgent) {
      const ctx: AgentExecutionContext = {
        analysisId: `exp_causal_${Date.now()}`,
        analysisConfig: { causalTarget: targetVariable },
        fileContents, dependencyResults: {}, startedAt: new Date().toISOString(),
      };
      depResults.causal_architect = await causalAgent.execute(ctx);
    }
    if (autoMlAgent) {
      const ctx: AgentExecutionContext = {
        analysisId: `exp_automl_${Date.now()}`,
        analysisConfig: {}, fileContents, dependencyResults: {}, startedAt: new Date().toISOString(),
      };
      depResults.auto_ml_agent = await autoMlAgent.execute(ctx);
    }

    const agent = pool.get('explainability_agent') as ExplainabilityAgent;
    if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 500 });
    const ctx: AgentExecutionContext = {
      analysisId: `exp_${Date.now()}`,
      analysisConfig: { causalTarget: targetVariable },
      fileContents,
      dependencyResults: depResults,
      startedAt: new Date().toISOString(),
    };
    const result = await agent.execute(ctx);
    return NextResponse.json({ ...result, dependencies: depResults });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
