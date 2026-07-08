/**
 * GET /api/v2/finetune/:id
 * ------------------------
 * Get the current status of a fine-tune job.
 *
 * DELETE /api/v2/finetune/:id
 * ---------------------------
 * Cancel a fine-tune job. Only jobs that are not yet in a terminal state
 * (completed / failed) can be cancelled.
 *
 * Returns 404 if the job does not exist.
 */

import { NextResponse } from 'next/server';
import { fineTuneRunner as runner } from '@/lib/finetune';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const job = runner.getJob(id);
  if (!job) {
    return NextResponse.json(
      { ok: false, error: { code: 'NOT_FOUND', message: `Fine-tune job '${id}' not found` } },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true, data: job });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const existing = runner.getJob(id);
  if (!existing) {
    return NextResponse.json(
      { ok: false, error: { code: 'NOT_FOUND', message: `Fine-tune job '${id}' not found` } },
      { status: 404 },
    );
  }
  const cancelled = runner.cancelJob(id);
  if (!cancelled) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'NOT_CANCELLABLE',
          message: `Job '${id}' is already in terminal state '${existing.status}'`,
        },
      },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true, data: { id, cancelled: true } });
}
