// Busara — Database client (Vercel serverless-optimized)
//
// Vercel serverless functions create a fresh PrismaClient on every cold
// start, and a single deploy can spin up dozens of concurrent instances.
// Without the `globalThis` cache below, each instance opens its own
// connection pool — quickly exhausting Supabase's free-tier limit (≈20
// direct connections) and producing `too many clients` errors.
//
// The cache survives hot reloads in `next dev` and is reused by warm
// serverless instances within the same Lambda container. Combined with
// the PgBouncer transaction-mode pooler (see prisma/schema.prisma), this
// gives Busara a safe connection ceiling of ~1–2 real DB sessions per
// warm function instance.
//
// The Proxy defers PrismaClient construction until first access. This is
// critical: during `next build` and during Vercel's build-time env
// assertions, DATABASE_URL may be unset or a placeholder, and we must
// not eagerly try to connect.
//
// Recommended DATABASE_URL for Vercel (Supabase pooler, port 6543):
//   postgresql://postgres.<ref>:<pwd>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&pool_timeout=10
// DIRECT_URL (port 5432, for migrations only):
//   postgresql://postgres.<ref>:<pwd>@aws-0-<region>.pooler.supabase.com:5432/postgres

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'warn', 'error']
        : ['error'],
  });
}

/**
 * Lazy PrismaClient singleton — only constructed on first property access.
 * Cached on `globalThis` so warm serverless instances reuse the same pool.
 */
export const db = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    if (!globalForPrisma.prisma) {
      try {
        globalForPrisma.prisma = createPrismaClient();
      } catch (err) {
        console.error('[Busara] Failed to initialize PrismaClient:', err);
        throw err;
      }
    }
    const value = (globalForPrisma.prisma as any)[prop];
    return typeof value === 'function'
      ? value.bind(globalForPrisma.prisma)
      : value;
  },
});

/**
 * Check if the database is configured (non-placeholder DATABASE_URL).
 * Use this in API routes to gracefully handle missing DB during build
 * or in preview deployments that haven't had env vars wired yet.
 */
export function isDbConfigured(): boolean {
  const url = process.env.DATABASE_URL;
  if (!url) return false;
  if (url.includes('placeholder')) return false;
  // Supabase pooler URLs always include "supabase.com"; local dev may
  // use a localhost URL. Anything else is treated as misconfigured.
  return url.startsWith('postgres') || url.startsWith('postgresql');
}
