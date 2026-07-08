/**
 * GET /api/v2/finetune
 * --------------------
 * List all fine-tune jobs known to this runner.
 *
 * POST /api/v2/finetune
 * ---------------------
 * Start a new fine-tune job for a single agent.
 *
 * Request body:
 *   {
 *     agentId: string,                 // required
 *     method?: 'sft' | 'dpo' | 'rlhf' | 'ppo',   // overrides scheduler's pick
 *     baseModel?: string,              // overrides 'glm-4.6'
 *     autoDeploy?: boolean,            // overrides scheduler's pick
 *     hyperparameters?: Partial<FineTuneConfig['hyperparameters']>,
 *   }
 *
 * The endpoint calls FineTuneScheduler.checkReadiness(agentId). If the
 * agent is ready, the returned config (with any caller overrides applied)
 * is handed to FineTuneRunner.startJob and the resulting job is returned.
 * If the agent is NOT ready, responds 409 with the readiness gap.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { FineTuneConfig, FineTuneMethod } from '@busara/agents';
import { fineTuneScheduler as scheduler, fineTuneRunner as runner } from '@/lib/finetune';

export const dynamic = 'force-dynamic';

const StartSchema = z.object({
  agentId: z.string().min(1),
  method: z.enum(['sft', 'dpo', 'rlhf', 'ppo']).optional(),
  baseModel: z.string().optional(),
  autoDeploy: z.boolean().optional(),
  hyperparameters: z
    .object({
      learningRate: z.number().positive().optional(),
      epochs: z.number().int().positive().optional(),
      batchSize: z.number().int().positive().optional(),
      warmupRatio: z.number().min(0).max(1).optional(),
      weightDecay: z.number().min(0).optional(),
      maxSeqLength: z.number().int().positive().optional(),
    })
    .optional(),
});

export async function GET() {
  const jobs = runner.listJobs();
  // Newest first — most useful for the dashboard's "recent jobs" view.
  jobs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return NextResponse.json({ ok: true, data: jobs, total: jobs.length });
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: 'BAD_JSON', message: 'Request body must be valid JSON' } },
      { status: 400 },
    );
  }

  const parse = StartSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid fine-tune request',
          details: parse.error.issues,
        },
      },
      { status: 400 },
    );
  }

  const { agentId, method, baseModel, autoDeploy, hyperparameters } = parse.data;

  // 1. Readiness check — produces a config or null.
  const config = await scheduler.checkReadiness(agentId);
  if (!config) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'NOT_READY',
          message: `Agent '${agentId}' is not ready for fine-tuning`,
        },
      },
      { status: 409 },
    );
  }

  // 2. Apply caller overrides.
  const finalConfig: FineTuneConfig = {
    ...config,
    method: (method as FineTuneMethod | undefined) ?? config.method,
    baseModel: baseModel ?? config.baseModel,
    hyperparameters: { ...config.hyperparameters, ...(hyperparameters ?? {}) },
    deploymentConfig: {
      ...config.deploymentConfig,
      autoDeploy: autoDeploy ?? config.deploymentConfig.autoDeploy,
    },
  };

  // 3. Start the job.
  const job = await runner.startJob(finalConfig);
  return NextResponse.json({ ok: true, data: job }, { status: 202 });
}
