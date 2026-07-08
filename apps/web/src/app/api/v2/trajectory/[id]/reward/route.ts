/**
 * POST /api/v2/trajectory/:id/reward
 * Add a reward signal to a trajectory (e.g., user thumbs up/down).
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createExplicitReward } from '@busara/agents';
import { trajectoryStore as store } from '@/lib/trajectory/store';

export const dynamic = 'force-dynamic';

const RewardSchema = z.object({
  type: z.enum(['explicit', 'implicit', 'automated']),
  source: z.enum([
    'user_thumbs_up', 'user_thumbs_down', 'user_cited_insight',
    'user_returned', 'user_shared', 'user_ignored',
    'quality_score', 'validation_pass', 'validation_fail',
    'peer_agreement', 'peer_disagreement', 'custom',
  ]),
  value: z.number().min(-1).max(1),
  text: z.string().optional(),
  provider: z.string().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();
  const parse = RewardSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json(
      { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid reward', details: parse.error.issues } },
      { status: 400 },
    );
  }

  const reward = createExplicitReward(parse.data.source, parse.data.value, {
    text: parse.data.text,
    provider: parse.data.provider,
  });

  await store.addReward(id, reward);
  return NextResponse.json({ ok: true, data: { reward } });
}
