import { NextRequest, NextResponse } from 'next/server';
import { getAgentPool } from '@/lib/agents';
import { KnowledgeGraphBuilderAgent, AgentExecutionContext } from '@/lib/agents';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fileContents } = body;
    if (!Array.isArray(fileContents) || !fileContents.length) {
      return NextResponse.json({ error: 'fileContents array is required' }, { status: 400 });
    }
    const pool = getAgentPool();
    const agent = pool.get('knowledge_graph_builder') as KnowledgeGraphBuilderAgent;
    if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 500 });
    const ctx: AgentExecutionContext = {
      analysisId: `kg_${Date.now()}`,
      analysisConfig: {},
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
