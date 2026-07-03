import { NextRequest, NextResponse } from 'next/server';
import { generateAINarrative, NarrativeRequest } from '@/lib/ai/narrative';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as NarrativeRequest;
    if (!body.datasetSummary) {
      return NextResponse.json({ error: 'datasetSummary is required' }, { status: 400 });
    }
    const result = await generateAINarrative(body);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[ai-narrative] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
