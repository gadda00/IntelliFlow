/**
 * GET /api/v2/trajectory/:id
 * --------------------------
 * Get a single trajectory by ID (with all steps).
 *
 * DELETE /api/v2/trajectory/:id
 * -----------------------------
 * Delete a single trajectory. Used by the admin console to satisfy GDPR
 * right-to-be-forgotten requests and to prune the in-memory store.
 *
 * Returns 404 if the trajectory does not exist.
 */

import { NextRequest, NextResponse } from 'next/server';
import { trajectoryStore as store } from '@/lib/trajectory/store';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const trajectory = await store.get(id);
  if (!trajectory) {
    return NextResponse.json(
      { ok: false, error: { code: 'NOT_FOUND', message: 'Trajectory not found' } },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true, data: trajectory });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const existing = await store.get(id);
  if (!existing) {
    return NextResponse.json(
      { ok: false, error: { code: 'NOT_FOUND', message: `Trajectory '${id}' not found` } },
      { status: 404 },
    );
  }
  await store.delete(id);
  return NextResponse.json({ ok: true, data: { id, deleted: true } });
}
