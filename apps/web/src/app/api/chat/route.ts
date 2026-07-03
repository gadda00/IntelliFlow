import { NextRequest, NextResponse } from 'next/server';
import { getAgentPool } from '@/lib/agents';
import { ConversationalAnalystAgent } from '@/lib/agents';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { question, analysisContext = {} } = body;
    if (!question) {
      return NextResponse.json({ error: 'question is required' }, { status: 400 });
    }
    const pool = getAgentPool();
    const agent = pool.get('conversational_analyst') as ConversationalAnalystAgent;
    if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 500 });
    const result = await agent.answerQuestion(question, analysisContext);
    return NextResponse.json({ question, ...result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
