import { NextRequest } from 'next/server';
import { DAGOrchestrator } from '@/lib/agents/v7/orchestrator';
import { createAllAgents } from '@/lib/agents/v7/registry';
import { AnalysisConfig, ProgressUpdate } from '@/lib/agents/v7/core';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { analysisId, dataframe, config } = body as {
    analysisId: string;
    dataframe: Record<string, any>[];
    config: AnalysisConfig;
  };

  if (!dataframe || !Array.isArray(dataframe) || dataframe.length === 0) {
    return new Response(
      JSON.stringify({ error: 'No data provided' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const orchestrator = new DAGOrchestrator();
  orchestrator.registerAll(Array.from(createAllAgents().values()));

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, data: any) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      send('connected', { analysisId, timestamp: new Date().toISOString() });

      const onProgress = (update: ProgressUpdate) => {
        send('progress', update);
      };

      try {
        const result = await orchestrator.execute({
          analysisId,
          dataframe,
          config: config ?? {},
          onProgress,
        });

        send('complete', {
          analysisId,
          status: result.status,
          totalDurationMs: result.totalDurationMs,
          agentsSucceeded: result.agentsSucceeded,
          agentsFailed: result.agentsFailed,
          agentsSkipped: result.agentsSkipped,
          stageTimings: result.stageTimings,
          cacheStats: result.cacheStats,
          timestamp: new Date().toISOString(),
        });
      } catch (err: any) {
        send('error', {
          analysisId,
          error: err.message ?? 'Unknown error',
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
