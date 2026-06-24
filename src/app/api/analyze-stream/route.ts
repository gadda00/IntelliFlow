import { NextRequest } from 'next/server';
import { ParallelAgentExecutor, getAgentPool, ProgressBroadcast } from '@/lib/agents';
import { parseFile } from '@/lib/data/parsers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  let analysisId: string = '';

  try {
    const body = await req.json();

    // Parse input
    let fileContents: any[] = [];
    if (body.fileContents && Array.isArray(body.fileContents)) {
      fileContents = body.fileContents;
    } else if (body.fileText && body.fileName) {
      const parsed = parseFile(body.fileText, body.fileName, body.fileType);
      fileContents = parsed.rows;
    }

    if (!fileContents.length) {
      return new Response(
        JSON.stringify({ error: 'No data provided' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const MAX_ROWS = 50000;
    if (fileContents.length > MAX_ROWS) {
      fileContents = fileContents.slice(0, MAX_ROWS);
    }

    analysisId = body.analysisId ?? `an_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const send = (event: string, data: any) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };

        send('connected', { analysisId, agentCount: 23, timestamp: new Date().toISOString() });

        try {
          const pool = getAgentPool();
          const executor = new ParallelAgentExecutor(pool, (update: ProgressBroadcast) => {
            send('agent_update', update);
          });

          const result = await executor.runFullPipeline({
            analysisId,
            analysisConfig: body.analysisConfig ?? {},
            fileContents,
            nlqQuery: body.nlqQuery,
            objectives: body.objectives,
            enabledAgents: body.enabledAgents,
          });

          const totalDurationMs = Date.now() - startTime;
          send('complete', {
            status: result.status,
            analysisId,
            totalDurationMs,
            execution: result.execution,
            results: result.results,
            timestamp: new Date().toISOString(),
          });
        } catch (err: any) {
          send('error', {
            analysisId,
            error: err?.message ?? 'Unknown error',
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
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message ?? 'Server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
