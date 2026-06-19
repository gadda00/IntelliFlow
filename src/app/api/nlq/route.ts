import { NextRequest, NextResponse } from 'next/server';
import { getAgentPool } from '@/lib/agents';
import { NLQInterpreterAgent } from '@/lib/agents';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, fileContents } = body;
    if (!query) {
      return NextResponse.json({ error: 'query is required' }, { status: 400 });
    }
    const pool = getAgentPool();
    const agent = pool.get('nlq_interpreter') as NLQInterpreterAgent;
    if (!agent) {
      return NextResponse.json({ error: 'NLQ agent not found' }, { status: 500 });
    }
    const result = await agent.interpret(query, fileContents ?? []);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
