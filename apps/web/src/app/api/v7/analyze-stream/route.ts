import { NextRequest, NextResponse } from 'next/server';
import { DAGOrchestrator } from '@/lib/agents/v7/orchestrator';
import { createAllAgents } from '@/lib/agents/v7/registry';
import { AnalysisConfig, ProgressUpdate } from '@/lib/agents/v7/core';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes — allows large datasets

// ─── Input validation ──────────────────────────────────────────────
interface AnalyzeRequest {
  analysisId: string;
  dataframe: Record<string, any>[];
  config: AnalysisConfig;
}

function validateInput(body: any): { valid: boolean; error?: string; data?: AnalyzeRequest } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be a JSON object' };
  }
  const { analysisId, dataframe, config } = body;

  if (!analysisId || typeof analysisId !== 'string') {
    return { valid: false, error: 'analysisId is required and must be a string' };
  }
  if (analysisId.length > 200) {
    return { valid: false, error: 'analysisId too long (max 200 chars)' };
  }

  if (!dataframe || !Array.isArray(dataframe)) {
    return { valid: false, error: 'dataframe is required and must be an array' };
  }
  if (dataframe.length === 0) {
    return { valid: false, error: 'dataframe cannot be empty' };
  }
  if (dataframe.length > 50000) {
    return { valid: false, error: `Too many rows: ${dataframe.length} (max 50,000)` };
  }

  // Validate each row is an object
  for (let i = 0; i < Math.min(dataframe.length, 10); i++) {
    if (typeof dataframe[i] !== 'object' || dataframe[i] === null || Array.isArray(dataframe[i])) {
      return { valid: false, error: `Row ${i} is not a valid object` };
    }
  }

  // Validate config if provided
  if (config !== undefined && config !== null) {
    if (typeof config !== 'object') {
      return { valid: false, error: 'config must be an object' };
    }
    // Check for dangerous keys
    const allowedKeys = ['targetColumn', 'timeColumn', 'forecastHorizon', 'seasonLength', 'preset', 'anomalyThreshold', 'clusterCount', 'sensitivity', 'objectives', 'nlqQuery', 'fileName'];
    const configKeys = Object.keys(config);
    const invalidKeys = configKeys.filter(k => !allowedKeys.includes(k));
    if (invalidKeys.length > 0) {
      return { valid: false, error: `Unknown config keys: ${invalidKeys.join(', ')}` };
    }
  }

  return { valid: true, data: { analysisId, dataframe, config: config ?? {} } };
}

// ─── Simple IP-based rate limiting (in-memory) ─────────────────────
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10; // 10 requests per minute per IP
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1 };
  }

  entry.count++;
  if (entry.count > RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, remaining: 0 };
  }

  return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - entry.count };
}

// Clean up old entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of rateLimitMap.entries()) {
      if (now > entry.resetTime) rateLimitMap.delete(ip);
    }
  }, 5 * 60 * 1000);
}

// ─── Preset → Agent ID mapping ─────────────────────────────────────
const PRESET_AGENTS: Record<string, string[] | undefined> = {
  full: undefined,
  forecast: [
    'data_ingestion', 'schema_inference', 'data_profiling', 'missing_value_analyzer',
    'data_quality_scorer', 'holt_winters_forecast', 'autoregressive_forecast',
    'moving_average_forecast', 'seasonality_detector', 'stationarity_tester',
    'insight_generator', 'narrative_composer', 'code_generator',
    'visualization_agent', 'orchestrator',
  ],
  anomaly: [
    'data_ingestion', 'schema_inference', 'data_profiling', 'missing_value_analyzer',
    'data_quality_scorer', 'anomaly_ensemble', 'isolation_forest',
    'fraud_detection', 'realtime_alert', 'pii_detection',
    'insight_generator', 'narrative_composer', 'orchestrator',
  ],
  quick: [
    'data_ingestion', 'schema_inference', 'data_profiling', 'data_quality_scorer',
    'anomaly_ensemble', 'correlation_matrix', 'ols_regression',
    'insight_generator', 'narrative_composer', 'orchestrator',
  ],
};

export async function POST(req: NextRequest) {
  // ─── Rate limiting ────────────────────────────────────────────────
  const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0] || 
                   req.headers.get('x-real-ip') || 'unknown';
  const rateLimit = checkRateLimit(clientIP);
  if (!rateLimit.allowed) {
    return new Response(
      JSON.stringify({ error: 'Rate limit exceeded. Max 10 analyses per minute.' }),
      { status: 429, headers: { 
        'Content-Type': 'application/json',
        'Retry-After': '60',
        'X-RateLimit-Remaining': '0',
      }}
    );
  }

  // ─── Parse and validate input ─────────────────────────────────────
  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const validation = validateInput(body);
  if (!validation.valid) {
    return new Response(
      JSON.stringify({ error: validation.error }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const { analysisId, dataframe, config } = validation.data!;

  // ─── Set up orchestrator ──────────────────────────────────────────
  const orchestrator = new DAGOrchestrator();
  orchestrator.registerAll(Array.from(createAllAgents().values()));

  const preset = (config as any)?.preset || 'full';
  const enabledAgents = PRESET_AGENTS[preset];

  // ─── Create abort controller for cancellation ────────────────────
  const abortController = new AbortController();
  const abortSignal = abortController.signal;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let cancelled = false;

      const send = (event: string, data: any) => {
        if (cancelled) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          // Controller may be closed
        }
      };

      send('connected', { 
        analysisId, 
        timestamp: new Date().toISOString(), 
        preset, 
        agentCount: enabledAgents ? enabledAgents.length : 50,
        rateLimitRemaining: rateLimit.remaining,
      });

      // Check for client disconnect
      req.signal.addEventListener('abort', () => {
        cancelled = true;
        abortController.abort();
        try { controller.close(); } catch {}
      });

      const onProgress = (update: ProgressUpdate) => {
        send('progress', update);
      };

      try {
        const result = await orchestrator.execute({
          analysisId,
          dataframe,
          config: config ?? {},
          onProgress,
          enabledAgents,
          signal: abortSignal,
        });

        if (!cancelled) {
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
        }
      } catch (err: any) {
        if (!cancelled) {
          send('error', {
            analysisId,
            error: err.message ?? 'Unknown error',
            timestamp: new Date().toISOString(),
          });
        }
      } finally {
        try { controller.close(); } catch {}
      }
    },
    cancel() {
      abortController.abort();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-RateLimit-Remaining': String(rateLimit.remaining),
    },
  });
}
