/**
 * GET /api/v2/trajectory/:id
 * Get a single trajectory by ID (with all steps).
 */

import { NextResponse } from 'next/server';
import { InMemoryTrajectoryStore } from '@busara/agents';

const store = new InMemoryTrajectoryStore();

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const trajectory = await store.get(params.id);
  if (!trajectory) {
    return NextResponse.json(
      { ok: false, error: { code: 'NOT_FOUND', message: 'Trajectory not found' } },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true, data: trajectory });
}
