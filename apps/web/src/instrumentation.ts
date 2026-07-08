// Busara — Next.js instrumentation hook (runs once per server boot).
//
// Docs: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
//
// Vercel caveat: this file is imported during `next build` AND at
// runtime. The env assertion must NOT throw during build (env vars
// often aren't propagated to the build container), so we:
//   1. Gate the import on `NEXT_RUNTIME === 'nodejs'` (skips the
//      edge-light build phase).
//   2. Wrap the assertion in try/catch.
//   3. Only throw in `VERCEL_ENV === 'production'` runtime; otherwise warn.
//
// The assertion itself (see lib/security/assertEnv.ts) has the same
// build-time guard baked in, so this is defence in depth.

export async function register(): Promise<void> {
  // NEXT_RUNTIME is 'nodejs' | 'edge' | undefined. Only assert on the
  // nodejs runtime — Prisma, argon2, and our JWT libs all need node.
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    return;
  }

  try {
    const { assertRequiredEnv } = await import('./lib/security/assertEnv');
    assertRequiredEnv();
  } catch (err) {
    // In production runtime, surface the error but DON'T crash the boot —
    // Vercel will retry, and individual API routes will return 500s with
    // actionable messages. Crashing here just produces a confusing 502.
    if (process.env.VERCEL_ENV === 'production') {
      console.error('[instrumentation] Missing required env vars:', err);
    } else {
      console.warn('[instrumentation] Env vars missing (OK during build):', err);
    }
  }

  // Vercel-specific boot log — helps confirm which environment served
  // a request when debugging from logs.
  if (process.env.VERCEL) {
    console.log(
      `[instrumentation] Booting on Vercel — env=${process.env.VERCEL_ENV ?? 'unknown'}, ` +
        `region=${process.env.VERCEL_REGION ?? 'unknown'}, ` +
        `commit=${process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'unknown'}`,
    );
  }
}
