/**
 * POST /api/v2/analyze-stream
 * ===========================
 *
 * Streaming variant of /api/v2/analyze. Executes one or more agents from the
 * @busara/agents pool against the supplied dataframe, emitting Server-Sent
 * Events as each agent starts/completes. Every agent is wrapped with trajectory
 * recording, and the trajectory ID is included in the `agent_complete` event so
 * clients can attach rewards after the user interacts with each result.
 *
 * SSE event stream:
 *   event: connected
 *   event: agent_start    { agentId, agentName, stage, stepIndex, totalSteps }
 *   event: agent_complete { agentId, agentName, status, trajectoryId, durationMs, output }
 *   event: complete       { analysisId, agentsSucceeded, agentsFailed, totalDurationMs }
 *   event: error          { message }
 *
 * Request body:
 *   {
 *     dataframe: Record<string,unknown>[],
 *     agentIds?: string[],            // defaults to all ingest+engineer+detect agents
 *     config?: Record<string,unknown>,
 *     analysisId?: string,
 *     workspaceId?: string,
 *     organizationId?: string
 *   }
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  AgentPool,
  withTrajectory,
  type BaseAgent,
} from '@busara/agents';
import { getUserFromRequest } from '@/lib/auth/server';
import { trajectoryStore } from '@/lib/trajectory/store';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

let _pool: AgentPool | null = null;
function pool(): AgentPool {
  if (!_pool) _pool = new AgentPool();
  return _pool;
}

const BodySchema = z.object({
  dataframe: z.array(z.record(z.string(), z.unknown())).min(1),
  agentIds: z.array(z.string().min(1)).optional(),
  config: z.record(z.string(), z.unknown()).default({}),
  analysisId: z.string().optional(),
  workspaceId: z.string().optional(),
  organizationId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ ok: false, error: { code: 'BAD_JSON', message: 'Request body must be valid JSON' } }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const parse = BodySchema.safeParse(body);
  if (!parse.success) {
    return new Response(
      JSON.stringify({ ok: false, error: { code: 'VALIDATION_ERROR', details: parse.error.issues } }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }
  const { dataframe, config, workspaceId, organizationId } = parse.data;

  const user = await getUserFromRequest(req);
  const userId = user?.id ?? `anon_${req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'}`;

  // Resolve agent list — default to a sensible subset (ingest + engineer + detect).
  const allAgents = pool().getAllAgents();
  const agentIds = parse.data.agentIds ?? allAgents.map(a => a.metadata.id);
  const agents: BaseAgent[] = [];
  for (const id of agentIds) {
    const a = pool().getAgent(id);
    if (a) agents.push(a);
  }
  if (agents.length === 0) {
    return new Response(
      JSON.stringify({ ok: false, error: { code: 'NO_AGENTS', message: 'No valid agents requested' } }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const analysisId = parse.data.analysisId ?? `an_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      send('connected', {
        analysisId,
        agentCount: agents.length,
        timestamp: new Date().toISOString(),
      });

      const previousResults = new Map<string, unknown>();
      const startedAt = Date.now();
      let succeeded = 0;
      let failed = 0;

      try {
        for (let i = 0; i < agents.length; i++) {
          const agent = agents[i];
          const meta = agent.metadata;

          send('agent_start', {
            analysisId,
            agentId: meta.id,
            agentName: meta.name,
            stage: meta.stage,
            stepIndex: i,
            totalSteps: agents.length,
            timestamp: new Date().toISOString(),
          });

          // Wrap each agent with trajectory recording. Each agent gets its own
          // trajectory (one trajectory = one agent execution), so we wrap inside
          // the loop. withTrajectory mutates the agent in place, but since we
          // only execute once per agent per request this is safe.
          const wrappedAgent = withTrajectory(agent, {
            store: trajectoryStore,
            analysisId,
            userId,
            workspaceId,
            organizationId,
          });

          const ctx = {
            analysisId,
            dataframe,
            config,
            previousResults,
            metadata: {},
            startedAt: new Date().toISOString(),
          };

          const startMs = Date.now();
          try {
            const result = await wrappedAgent.execute(ctx as any);
            const durationMs = Date.now() - startMs;
            const trajectoryId = (wrappedAgent as any)._lastTrajectoryId as string | undefined;

            if (result.status === 'success') {
              succeeded++;
              previousResults.set(meta.id, result);
            } else {
              failed++;
            }

            send('agent_complete', {
              analysisId,
              agentId: meta.id,
              agentName: meta.name,
              status: result.status,
              trajectoryId,
              durationMs,
              error: result.error,
              timestamp: new Date().toISOString(),
            });
          } catch (err: any) {
            failed++;
            const trajectoryId = (wrappedAgent as any)._lastTrajectoryId as string | undefined;
            send('agent_complete', {
              analysisId,
              agentId: meta.id,
              agentName: meta.name,
              status: 'failed',
              trajectoryId,
              durationMs: Date.now() - startMs,
              error: err?.message ?? 'Unknown error',
              timestamp: new Date().toISOString(),
            });
          }
        }

        send('complete', {
          analysisId,
          status: failed === 0 ? 'success' : failed === agents.length ? 'failed' : 'partial',
          agentsSucceeded: succeeded,
          agentsFailed: failed,
          totalDurationMs: Date.now() - startedAt,
          timestamp: new Date().toISOString(),
        });
      } catch (err: any) {
        send('error', {
          analysisId,
          message: err?.message ?? 'Unknown error',
          timestamp: new Date().toISOString(),
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
