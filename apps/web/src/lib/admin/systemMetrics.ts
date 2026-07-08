/**
 * System-metrics ring buffers for the admin console.
 *
 * Lives outside `app/api/v2/system/route.ts` because Next.js route files
 * only allow HTTP-method exports. Other API routes push errors and
 * rate-limit events into these buffers; the `/api/v2/system` route
 * reads them out.
 *
 * All buffers are in-process — they reset on every cold start. That's
 * acceptable for an admin dashboard; for persistent metrics, ship to
 * Langfuse/Datadog/Upstash instead.
 */

export interface ErrorRecord {
  timestamp: string;
  message: string;
  code?: string;
  source?: string;
}

export interface RateBucket {
  window: string; // ISO minute: YYYY-MM-DDTHH:MM
  blocked: number;
  total: number;
}

const MAX_ERRORS = 50;
const MAX_BUCKETS = 30;

const _errorLog: ErrorRecord[] = [];
const _rateBuckets = new Map<string, RateBucket>();

/** Push an error into the admin ring buffer. */
export function recordError(err: {
  message: string;
  code?: string;
  source?: string;
}): void {
  _errorLog.unshift({ timestamp: new Date().toISOString(), ...err });
  if (_errorLog.length > MAX_ERRORS) _errorLog.length = MAX_ERRORS;
}

/** Push a rate-limit-blocked event into the per-minute bucket. */
export function recordRateLimitBlocked(): void {
  const minute = new Date().toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
  const bucket =
    _rateBuckets.get(minute) ?? { window: minute, blocked: 0, total: 0 };
  bucket.blocked += 1;
  bucket.total += 1;
  _rateBuckets.set(minute, bucket);
  if (_rateBuckets.size > MAX_BUCKETS) {
    const oldest = Array.from(_rateBuckets.keys()).sort()[0];
    if (oldest) _rateBuckets.delete(oldest);
  }
}

/** Read-only snapshot of the error log (newest first). */
export function readErrorLog(): ErrorRecord[] {
  return [..._errorLog];
}

/** Read-only snapshot of the rate-limit buckets, sorted oldest → newest. */
export function readRateBuckets(): RateBucket[] {
  return Array.from(_rateBuckets.values()).sort((a, b) =>
    a.window.localeCompare(b.window),
  );
}
