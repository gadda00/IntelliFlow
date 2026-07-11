import { NextRequest } from 'next/server';
import { DAGOrchestrator } from '@/lib/agents/v7/orchestrator';
import { createAllAgents } from '@/lib/agents/v7/registry';
import { AnalysisConfig, ProgressUpdate } from '@/lib/agents/v7/core';

export const runtime = 'nodejs';
export const maxDuration = 60;

// ─── Preset → Agent ID mapping ─────────────────────────────────────
// Each preset runs a focused subset of agents for faster, more relevant results.
const PRESET_AGENTS: Record<string, string[] | undefined> = {
  // Full pipeline — all 50 agents
  full: undefined,
  // Forecast focus — ingestion, profiling, forecasting, reporting
  forecast: [
    'data_ingestion', 'schema_inference', 'data_profiling', 'missing_value_analyzer',
    'data_quality_scorer', 'holt_winters_forecast', 'autoregressive_forecast',
    'moving_average_forecast', 'seasonality_detector', 'stationarity_tester',
    'insight_generator', 'narrative_composer', 'code_generator',
    'visualization_agent', 'orchestrator',
  ],
  // Fraud & anomaly focus — ingestion, profiling, anomaly detection, reporting
  anomaly: [
    'data_ingestion', 'schema_inference', 'data_profiling', 'missing_value_analyzer',
    'data_quality_scorer', 'anomaly_ensemble', 'isolation_forest',
    'fraud_detection', 'realtime_alert', 'pii_detection',
    'insight_generator', 'narrative_composer', 'orchestrator',
  ],
  // Quick insights — minimal agents for fast results (<15s)
  quick: [
    'data_ingestion', 'schema_inference', 'data_profiling', 'data_quality_scorer',
    'anomaly_ensemble', 'correlation_matrix', 'ols_regression',
    'insight_generator', 'narrative_composer', 'orchestrator',
  ],
};

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

  // Enforce row limit
  const MAX_ROWS = 50000;
  const cappedData = dataframe.length > MAX_ROWS ? dataframe.slice(0, MAX_ROWS) : dataframe;

  const orchestrator = new DAGOrchestrator();
  orchestrator.registerAll(Array.from(createAllAgents().values()));

  // Determine which agents to run based on preset
  const preset = (config as any)?.preset || 'full';
  const enabledAgents = PRESET_AGENTS[preset];

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, data: any) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      send('connected', { analysisId, timestamp: new Date().toISOString(), preset, agentCount: enabledAgents ? enabledAgents.length : 50 });

      const onProgress = (update: ProgressUpdate) => {
        send('progress', update);
      };

      try {
        const result = await orchestrator.execute({
          analysisId,
          dataframe: cappedData,
          config: config ?? {},
          onProgress,
          enabledAgents,
        });

        send('complete', {
          analysisId,
          status: result.status,
          totalDurationMs: result.totalDurationMs,
          agentsSucceeded: result.agentsSucceeded,
          agentsFailed: result.agentsFailed,
          agentsSkipped: result.agentsSkipped,
          stageTimings: result.stageTimings,
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
