/**
 * GET /api/v2/trajectory
 * Query trajectories with filters.
 *
 * POST /api/v2/trajectory
 * Save a trajectory (called by the streaming pipeline after agent execution).
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { InMemoryTrajectoryStore } from '@busara/agents';
import type { TrajectoryQuery, Trajectory } from '@busara/agents';

// In production, this would be a Prisma-backed store.
// For now, use in-memory (resets on server restart — fine for dev).
const store = new InMemoryTrajectoryStore();

export const dynamic = 'force-dynamic';

const QuerySchema = z.object({
  agentId: z.string().optional(),
  userId: z.string().optional(),
  workspaceId: z.string().optional(),
  status: z.enum(['running', 'success', 'failed', 'cancelled', 'timeout']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  minReward: z.coerce.number().optional(),
  maxReward: z.coerce.number().optional(),
  tags: z.array(z.string()).optional(),
  limit: z.coerce.number().min(1).max(200).default(50),
  offset: z.coerce.number().min(0).default(0),
  orderBy: z.enum(['startedAt', 'completedAt', 'reward', 'duration']).default('startedAt'),
  orderDirection: z.enum(['asc', 'desc']).default('desc'),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const params: Record<string, unknown> = Object.fromEntries(url.searchParams.entries());
  if (typeof params.tags === 'string') {
    try { params.tags = JSON.parse(params.tags as string) as string[]; } catch { /* leave as-is */ }
  }

  const parse = QuerySchema.safeParse(params);
  if (!parse.success) {
    return NextResponse.json(
      { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid query', details: parse.error.issues } },
      { status: 400 },
    );
  }

  const result = await store.query(parse.data as TrajectoryQuery);
  return NextResponse.json({ ok: true, ...result });
}

const TrajectorySchema = z.object({
  id: z.string(),
  analysisId: z.string(),
  userId: z.string(),
  agentId: z.string(),
  agentVersion: z.string(),
  agentStability: z.enum(['experimental', 'beta', 'stable', 'deprecated']),
  startedAt: z.string(),
  completedAt: z.string().optional(),
  status: z.enum(['running', 'success', 'failed', 'cancelled', 'timeout']),
  steps: z.array(z.any()),
  rewards: z.array(z.any()),
  contextSnapshot: z.any(),
  metadata: z.any(),
  metrics: z.any(),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parse = TrajectorySchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json(
      { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid trajectory', details: parse.error.issues } },
      { status: 400 },
    );
  }

  await store.save(parse.data as Trajectory);
  return NextResponse.json({ ok: true, data: { id: parse.data.id } });
}
