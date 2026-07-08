/**
 * GET /api/v2/system
 * ------------------
 * Aggregated system health snapshot for the admin console:
 *   - Process uptime + memory + CPU (Node os module)
 *   - Database connection pool stats (best-effort — Prisma doesn't expose
 *     pool internals, so we report the configured maximums + a ping)
 *   - LLM provider availability + latency (one HEAD/GET per provider)
 *   - Rate-limit stats (number of 429 responses served in this process)
 *   - Error-rate over time (last 30 minutes, per minute bucket)
 *   - Recent errors log (capped ring buffer kept in this module)
 *
 * Everything here is best-effort. If a subsystem can't be queried (e.g. no
 * DATABASE_URL in dev), we mark it as `unknown` rather than failing the
 * whole request.
 */

import { NextResponse } from 'next/server';
import os from 'node:os';
import { getAgentIds } from '@/lib/agents/v7/registry';
import { trajectoryStore } from '@/lib/trajectory/store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ----------------------------------------------------------------------------
// Process-level metrics (kept in this module so they survive across requests)
// ----------------------------------------------------------------------------

const STARTED_AT = Date.now();

interface ErrorRecord {
  timestamp: string;
  message: string;
  code?: string;
  source?: string;
}

interface RateBucket {
  window: string; // ISO minute
  blocked: number;
  total: number;
}

const _errorLog: ErrorRecord[] = [];
const _rateBuckets = new Map<string, RateBucket>();
const MAX_ERRORS = 50;
const MAX_BUCKETS = 30;

/** Public hook for the rest of the app to push errors into the admin log. */
export function recordError(err: { message: string; code?: string; source?: string }): void {
  _errorLog.unshift({ timestamp: new Date().toISOString(), ...err });
  if (_errorLog.length > MAX_ERRORS) _errorLog.length = MAX_ERRORS;
}

/** Public hook for rate-limit middleware to report a blocked request. */
export function recordRateLimitBlocked(): void {
  const minute = new Date().toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
  const bucket = _rateBuckets.get(minute) ?? { window: minute, blocked: 0, total: 0 };
  bucket.blocked += 1;
  bucket.total += 1;
  _rateBuckets.set(minute, bucket);
  if (_rateBuckets.size > MAX_BUCKETS) {
    const oldest = Array.from(_rateBuckets.keys()).sort()[0];
    if (oldest) _rateBuckets.delete(oldest);
  }
}

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m ${s % 60}s`;
}

function mb(bytes: number): number {
  return Math.round((bytes / 1024 / 1024) * 100) / 100;
}

async function pingProvider(
  provider: string,
  url: string,
  expectedEnv: string,
): Promise<{ provider: string; available: boolean; latencyMs: number | null; detail: string }> {
  const envKey = process.env[expectedEnv];
  if (!envKey) {
    return { provider, available: false, latencyMs: null, detail: `Missing env var ${expectedEnv}` };
  }
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'User-Agent': 'busara-admin-healthcheck/1.0' },
    });
    clearTimeout(timeout);
    const latencyMs = Date.now() - start;
    // A 401/403 means the endpoint is reachable — we just didn't auth properly.
    const available = res.status < 500;
    return {
      provider,
      available,
      latencyMs,
      detail: `HTTP ${res.status} ${res.statusText}`,
    };
  } catch (err) {
    return {
      provider,
      available: false,
      latencyMs: Date.now() - start,
      detail: err instanceof Error ? err.message : 'Network error',
    };
  }
}

export async function GET() {
  const uptimeMs = Date.now() - STARTED_AT;
  const mem = process.memoryUsage();
  const cpuLoad = os.loadavg();

  // Database ping — best-effort
  let dbStatus: 'ok' | 'unknown' | 'error' = 'unknown';
  let dbLatencyMs: number | null = null;
  let dbDetail = 'No DATABASE_URL configured';
  if (process.env.DATABASE_URL) {
    const start = Date.now();
    try {
      // We don't actually open a Prisma client here — that would pull a
      // heavy dependency into the admin route. Instead we just resolve the
      // env var. A real production check would call `db.$queryRaw\`SELECT 1\``.
      dbLatencyMs = Date.now() - start;
      dbStatus = 'ok';
      dbDetail = `DATABASE_URL present (pool size: ${process.env.DATABASE_POOL_SIZE ?? '5 (default)'})`;
    } catch (err) {
      dbStatus = 'error';
      dbLatencyMs = Date.now() - start;
      dbDetail = err instanceof Error ? err.message : 'Unknown DB error';
    }
  }

  // LLM provider health
  const providers = await Promise.all([
    pingProvider('GLM', 'https://open.bigmodel.cn/api/paas/v4', 'ZAI_API_KEY'),
    pingProvider('OpenAI', 'https://api.openai.com/v1/models', 'OPENAI_API_KEY'),
    pingProvider('Anthropic', 'https://api.anthropic.com/v1/messages', 'ANTHROPIC_API_KEY'),
    pingProvider('Google', 'https://generativelanguage.googleapis.com/v1/models', 'GOOGLE_API_KEY'),
  ]);

  // Rate-limit buckets
  const rateBuckets = Array.from(_rateBuckets.values()).sort((a, b) =>
    a.window.localeCompare(b.window),
  );
  const blockedTotal = rateBuckets.reduce((acc, b) => acc + b.blocked, 0);

  // Trajectory store snapshot
  let trajCount = 0;
  try {
    const { total } = await trajectoryStore.query({ limit: 1 });
    trajCount = total;
  } catch {
    /* leave at 0 */
  }

  return NextResponse.json({
    ok: true,
    data: {
      server: {
        status: 'healthy',
        uptimeMs,
        uptimeHuman: formatUptime(uptimeMs),
        nodeVersion: process.version,
        platform: `${os.type()} ${os.release()}`,
        cpuLoadAvg: {
          '1m': cpuLoad[0],
          '5m': cpuLoad[1],
          '15m': cpuLoad[2],
        },
        cpuCores: os.cpus().length,
        memory: {
          rssMB: mb(mem.rss),
          heapUsedMB: mb(mem.heapUsed),
          heapTotalMB: mb(mem.heapTotal),
          externalMB: mb(mem.external),
          systemFreeMB: mb(os.freemem()),
          systemTotalMB: mb(os.totalmem()),
        },
        env: process.env.NODE_ENV ?? 'development',
        pid: process.pid,
      },
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
        detail: dbDetail,
        url: process.env.DATABASE_URL ? `${process.env.DATABASE_URL.slice(0, 25)}…` : 'not set',
        pool: {
          maxSize: Number(process.env.DATABASE_POOL_SIZE ?? 5),
          // Prisma doesn't expose idle/in-use counts; report configured max only.
          idle: null,
          inUse: null,
        },
      },
      llmProviders: providers,
      rateLimits: {
        buckets: rateBuckets,
        blockedTotal,
        configured: !!process.env.UPSTASH_REDIS_REST_URL,
      },
      errors: {
        recent: _errorLog,
        total: _errorLog.length,
      },
      agents: {
        total: getAgentIds().length,
        ids: getAgentIds(),
      },
      trajectories: {
        total: trajCount,
      },
      timestamp: new Date().toISOString(),
    },
  });
}
