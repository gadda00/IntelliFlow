/**
 * POST /api/v2/trajectory/export
 * ------------------------------
 * Export a filtered, scrubbed, deduplicated dataset of trajectories via the
 * AReaL DataProxy (Pillar 2). Used by the admin console to ship learning
 * datasets to fine-tuning pipelines, external benchmark tools, or research
 * collaborators.
 *
 * Request body (all optional):
 *   {
 *     agentIds?: string[],            // restrict to a set of agents
 *     minSuccessRate?: number,        // 0..1 — drop agents below this rate
 *     minQualityScore?: number,       // 0..1 — drop trajectories below this score
 *     scrubPII?: boolean,             // default true
 *     deduplicate?: boolean,          // default true
 *     maxPerAgent?: number,
 *     requireRewards?: boolean,
 *     startDate?: string,             // ISO
 *     endDate?: string,               // ISO
 *     purpose: string,                // audit-trail: why this export was made
 *     exportedBy: string              // audit-trail: who exported it
 *   }
 *
 * Response:
 *   {
 *     ok: true,
 *     data: ExportedDataset
 *   }
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { DataProxy, type DataProxyConfig, type ExportAudit } from '@busara/agents';
import { trajectoryStore as store } from '@/lib/trajectory/store';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  agentIds: z.array(z.string()).optional(),
  minSuccessRate: z.number().min(0).max(1).optional(),
  minQualityScore: z.number().min(0).max(1).optional(),
  scrubPII: z.boolean().optional(),
  deduplicate: z.boolean().optional(),
  maxPerAgent: z.number().int().positive().max(10000).optional(),
  requireRewards: z.boolean().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  purpose: z.string().min(1).default('admin-export'),
  exportedBy: z.string().min(1).default('admin-console'),
});

const proxy = new DataProxy(store);

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

  const parse = BodySchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json(
      { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid export request', details: parse.error.issues } },
      { status: 400 },
    );
  }

  const { agentIds, purpose, exportedBy, ...cfg } = parse.data;

  const proxyConfig: DataProxyConfig = {
    scrubPII: cfg.scrubPII ?? true,
    deduplicate: cfg.deduplicate ?? true,
    ...cfg,
  };

  const audit: Omit<ExportAudit, 'exportedAt' | 'trajectoryCount' | 'agentIds'> = {
    exportedBy,
    purpose,
  };

  try {
    // If specific agentIds were requested, export per-agent and concatenate.
    // (DataProxy.exportDataset takes a TrajectoryQuery, so we filter via that.)
    if (agentIds && agentIds.length > 0) {
      const datasets = await Promise.all(
        agentIds.map(id =>
          proxy.exportDataset({ agentId: id, limit: 5000 }, proxyConfig, audit),
        ),
      );
      return NextResponse.json({ ok: true, data: datasets });
    }
    const dataset = await proxy.exportDataset({ limit: 5000 }, proxyConfig, audit);
    return NextResponse.json({ ok: true, data: dataset });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'EXPORT_ERROR',
          message: err instanceof Error ? err.message : 'Export failed',
        },
      },
      { status: 500 },
    );
  }
}
