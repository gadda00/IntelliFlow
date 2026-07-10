/**
 * Vercel-specific environment helpers.
 *
 * Vercel sets a different set of env vars than local dev:
 *   • VERCEL          — "1" on every Vercel deploy (build + runtime)
 *   • VERCEL_ENV      — "production" | "preview" | "development"
 *   • VERCEL_URL      — the auto-generated deployment URL
 *                       (e.g. "busara-xyz.vercel.app")
 *   • VERCEL_REGION   — "iad1", "sfo1", etc.
 *   • VERCEL_GIT_COMMIT_SHA — full commit hash of the deployed commit
 *
 * Use these helpers instead of reading process.env.VERCEL* directly so
 * the rest of the codebase stays framework-agnostic.
 */

export function isVercel(): boolean {
  return !!process.env.VERCEL;
}

export function isProduction(): boolean {
  return process.env.VERCEL_ENV === 'production';
}

export function isPreview(): boolean {
  return process.env.VERCEL_ENV === 'preview';
}

/**
 * The canonical URL of the current deployment. Useful for generating
 * absolute URLs (OG images, email links, OAuth callbacks) when the
 * request object isn't available.
 *
 * Priority:
 *   1. VERCEL_URL (auto-set by Vercel on every deploy)
 *   2. NEXT_PUBLIC_APP_URL (set by user — usually the custom domain)
 *   3. localhost (dev fallback)
 */
export function getVercelUrl(): string {
  if (process.env.VERCEL_URL) {
    // VERCEL_URL is bare (e.g. "busara-abc123.vercel.app"); prepend https://
    return `https://${process.env.VERCEL_URL}`;
  }
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}

/**
 * Short (7-char) SHA of the deployed commit. `undefined` in local dev.
 */
export function getDeployCommit(): string | undefined {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  return sha ? sha.slice(0, 7) : undefined;
}

/**
 * The Vercel region the function is running in (e.g. "iad1").
 * `undefined` off Vercel.
 */
export function getRegion(): string | undefined {
  return process.env.VERCEL_REGION;
}

/**
 * True if we're being built by Vercel (as opposed to running in a
 * Vercel serverless function). Vercel sets VERCEL=1 in BOTH contexts,
 * but VERCEL_ENV=production only at runtime — and `next build` runs in
 * a CI-like context with VERCEL_ENV set to "production" too.
 *
 * Use this to gate build-only logic (e.g. skip DB connections).
 */
export function isVercelBuild(): boolean {
  return isVercel() && process.env.NEXT_RUNTIME !== 'nodejs';
}
