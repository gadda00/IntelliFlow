// Busara — Runtime environment assertion
//
// Used by `instrumentation.ts` (Next.js OpenTelemetry-style bootstrap)
// to fail fast on missing required env vars when the server boots.
//
// IMPORTANT: this module is imported at server boot. It MUST be safe to
// import during `next build` — which means it must not actually throw
// during build. The throw is gated on `VERCEL_ENV === 'production'` AND
// `NEXT_RUNTIME === 'nodejs'` (i.e. real runtime, not build).
//
// Required-in-production vars:
//   • JWT_SECRET                    — HMAC key for self-issued JWTs
//   • DATA_SOURCE_ENCRYPTION_KEY    — 32-byte hex key for connector creds
//   • DATABASE_URL                  — Supabase pooler URL
//   • DIRECT_URL                    — Supabase direct URL (for migrations)
//
// In development, missing vars produce a `console.warn` (not throw) so
// the app still boots with its placeholder fallbacks.

const REQUIRED = [
  'JWT_SECRET',
  'DATA_SOURCE_ENCRYPTION_KEY',
  'DATABASE_URL',
  'DIRECT_URL',
] as const;

export interface EnvAssertionResult {
  ok: boolean;
  missing: string[];
  placeholder: string[];
}

/**
 * Inspect the environment. Does not throw — returns a structured result.
 * Use `assertRequiredEnv()` if you want the throwing variant (gated on
 * production runtime).
 */
export function checkEnv(): EnvAssertionResult {
  const missing: string[] = [];
  const placeholder: string[] = [];

  for (const key of REQUIRED) {
    const v = process.env[key];
    if (v === undefined || v === '') {
      missing.push(key);
    } else if (v.includes('placeholder') || v.includes('change-me')) {
      placeholder.push(key);
    }
  }

  return { ok: missing.length === 0, missing, placeholder };
}

/**
 * Throw if required env vars are missing AND we're in a production
 * runtime. During build (`VERCEL_ENV !== 'production'` OR
 * `NEXT_RUNTIME !== 'nodejs'`) this is a no-op + warning, so `next build`
 * doesn't crash on Vercel when env vars haven't been propagated to the
 * build container yet.
 */
export function assertRequiredEnv(): void {
  const result = checkEnv();

  // Build-time guard: never throw during `next build`.
  const isBuild =
    process.env.NEXT_RUNTIME !== 'nodejs' ||
    process.env.VERCEL_ENV !== 'production';

  if (result.ok && result.placeholder.length === 0) {
    return; // all good
  }

  if (isBuild) {
    if (result.missing.length > 0) {
      console.warn(
        `[assertEnv] Missing required env vars (OK during build): ${result.missing.join(', ')}`,
      );
    }
    if (result.placeholder.length > 0) {
      console.warn(
        `[assertEnv] Placeholder env vars detected (OK during build): ${result.placeholder.join(', ')}`,
      );
    }
    return;
  }

  // Production runtime — fail fast.
  if (result.missing.length > 0) {
    throw new Error(
      `[assertEnv] Missing required env vars in production: ${result.missing.join(', ')}. ` +
        'Set them in Vercel → Settings → Environment Variables.',
    );
  }
  if (result.placeholder.length > 0) {
    throw new Error(
      `[assertEnv] Placeholder env vars in production: ${result.placeholder.join(', ')}. ` +
        'Replace with real values before deploying.',
    );
  }
}
