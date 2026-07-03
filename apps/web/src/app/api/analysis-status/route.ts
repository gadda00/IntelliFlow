import { NextRequest, NextResponse } from 'next/server';
import { getRecentUpdates } from '@/app/api/analyze/route';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const analysisId = url.searchParams.get('id');
  if (!analysisId) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const updates = getRecentUpdates(analysisId);
  return NextResponse.json({ analysisId, updates, count: updates.length });
}
