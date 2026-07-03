// Busara — Database client (lazy initialization for serverless compatibility)
// The PrismaClient is only instantiated on first use, not at module load.
// This prevents build-time errors on Netlify/Vercel when DATABASE_URL is a placeholder.

import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Lazy PrismaClient getter — only creates the client when first accessed.
 * This is critical for Netlify serverless builds where DATABASE_URL may be
 * a placeholder during build time.
 */
function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
  });
}

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
    return typeof value === 'function' ? value.bind(globalForPrisma.prisma) : value;
  },
});

/**
 * Check if the database is configured (non-placeholder DATABASE_URL).
 * Use this in API routes to gracefully handle missing DB.
 */
export function isDbConfigured(): boolean {
  const url = process.env.DATABASE_URL;
  if (!url) return false;
  if (url.includes('placeholder')) return false;
  return true;
}
