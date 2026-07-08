# Deploying Busara to Vercel

This guide walks you through deploying Busara to Vercel and pointing
`busaraai.com` at it. Following these steps in order, the deploy button
should "just work."

## Prerequisites

1. **Vercel account** (free Hobby tier works for testing; Pro is needed
   for the 300s function timeout on `/api/v2/analyze-stream`).
2. **Supabase account** (free tier works) — for PostgreSQL.
3. **Upstash account** (optional but recommended) — for Redis-backed
   rate limiting. Without it, rate limiting silently degrades to a no-op.
4. **Flutterwave account** (optional) — for paid plans. Without it,
   paid features are hidden in the UI.

## Step 1 — Database (Supabase)

1. Create a Supabase project at https://supabase.com.
2. Go to **Settings → Database → Connection string**.
3. Copy the **connection pooler URL** (port `6543`) → this is your
   `DATABASE_URL`. Append `?pgbouncer=true&connection_limit=1&pool_timeout=10`
   if Supabase hasn't already.
4. Copy the **direct connection URL** (port `5432`) → this is your
   `DIRECT_URL`. Used only by Prisma migrations.
5. Run migrations from your laptop (once, against the production DB):
   ```bash
   pnpm db:push
   ```

The `relationMode = "prisma"` directive in `prisma/schema.prisma` is
required for the PgBouncer transaction-mode pooler — it disables
Prisma's SQL-level foreign-key enforcement (which is incompatible with
transaction-mode pooling) and emulates referential integrity in the
client instead.

## Step 2 — Deploy to Vercel

1. Go to https://vercel.com/new.
2. Import the GitHub repo `gadda00/IntelliFlow`.
3. Vercel will auto-detect the project. Verify:
   - **Framework Preset:** Next.js
   - **Root Directory:** `apps/web` *(not the repo root)*
   - **Build Command:** `cd ../.. && pnpm install && pnpm run build`
     *(or leave defaults — `vercel.json` overrides them anyway)*
   - **Install Command:** `pnpm install`
   - **Node.js Version:** 20.x
4. Add ALL environment variables (see Step 3 below).
5. Click **Deploy**.

`vercel.json` at the repo root sets the build command, function
timeouts, regions, and security headers — you don't need to configure
those in the Vercel UI.

## Step 3 — Environment Variables

Set these in **Vercel → Settings → Environment Variables**. Mark each
as Production, Preview, or both. (Development env vars stay in your
`.env.local`.)

### Required (app won't boot in production without these)

| Variable | Value | Notes |
|----------|-------|-------|
| `DATABASE_URL` | `postgresql://postgres.<ref>:<pwd>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&pool_timeout=10` | Supabase pooler URL, port 6543. The `pgbouncer=true&connection_limit=1` query params are REQUIRED. |
| `DIRECT_URL` | `postgresql://postgres.<ref>:<pwd>@aws-0-<region>.pooler.supabase.com:5432/postgres` | Supabase direct URL, port 5432. Used by Prisma migrations only. |
| `JWT_SECRET` | `openssl rand -hex 32` | HMAC key for self-issued JWTs. |
| `DATA_SOURCE_ENCRYPTION_KEY` | `openssl rand -hex 32` | 32-byte hex key for encrypting connector credentials at rest. |
| `NEXT_PUBLIC_APP_URL` | `https://busaraai.com` | Used for OG metadata, OAuth redirects, email links. |

### Recommended (rate limiting + observability + payments)

| Variable | Source | Notes |
|----------|--------|-------|
| `UPSTASH_REDIS_REST_URL` | Upstash console | Without it, rate limiting is a no-op. |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash console | |
| `LANGFUSE_PUBLIC_KEY` | Langfuse project settings | LLM observability. Optional. |
| `LANGFUSE_SECRET_KEY` | Langfuse project settings | |
| `FLW_SECRET_KEY` | Flutterwave dashboard | For paid plans. |
| `FLW_PUBLIC_KEY` | Flutterwave dashboard | |
| `FLW_WEBHOOK_HASH` | Flutterwave webhook settings | Secret used to verify webhooks. |

### Optional (LLM providers — only if you want non-Z.AI fallback)

| Variable | Notes |
|----------|-------|
| `OPENAI_API_KEY` | For OpenAI fallback. |
| `ANTHROPIC_API_KEY` | For Anthropic fallback. |
| `GOOGLE_GEMINI_API_KEY` | For Gemini fallback. |

## Step 4 — Domain Setup (busaraai.com)

1. In Vercel → **Settings → Domains**.
2. Add `busaraai.com` (apex) and `www.busaraai.com`.
3. Vercel will show you DNS records to add at your registrar:
   - **A record:** `@` → `76.76.21.21`
   - **CNAME:** `www` → `cname.vercel-dns.com` *(or `busaraai.com`)*
4. Add these records at your domain registrar (Namecheap, GoDaddy, etc.).
5. Wait for DNS propagation (5–30 minutes).
6. Vercel will auto-provision SSL certificates. Status flips to
   "Valid Configuration" when ready.

To transfer an existing domain already pointing elsewhere, lower the
DNS TTL at the current registrar 24h before switching, then update the
NS/A records. This minimizes downtime.

## Step 5 — Post-Deploy Verification

1. Run `prisma db push` against the production database (if you haven't already in Step 1).
2. Test the health endpoint:
   ```bash
   curl https://busaraai.com/api/health
   # → { "status": "healthy", ... }
   ```
3. Test the agents endpoint:
   ```bash
   curl https://busaraai.com/api/v2/agents
   # → { "agents": [...] }
   ```
4. Set up the Flutterwave webhook URL:
   `https://busaraai.com/api/payments/webhook`
   Configure it in the Flutterwave dashboard → Settings → Webhooks.
5. Run a test analysis through the UI to confirm end-to-end.

## Limitations on Vercel

- **No WebSocket server.** The `mini-services/websocket-server/`
  (socket.io, port 3003) cannot run on Vercel — Vercel functions don't
  support long-lived WebSocket connections. Busara gracefully degrades
  to **Server-Sent Events** (SSE) via `/api/v2/analyze-stream` for
  agent-progress streaming. Multi-client chat fan-out requires deploying
  the WebSocket service separately on **Railway**, **Render**, or
  **Fly.io**, then setting `NEXT_PUBLIC_WS_SERVER_URL` to its URL.
  See `apps/web/src/lib/realtime/vercelAdapter.ts` for the transport
  selection logic.

- **Function timeout.** Max **300s** on the Pro plan, **60s** on Hobby.
  The `analyze-stream` endpoint is configured for 300s in `vercel.json`
  — it needs Pro for large datasets. On Hobby, set it to 60s and warn
  users about dataset size limits.

- **Cold starts.** First request after idle takes ~2–3s. Vercel
  auto-manages this; no action needed. For consistently low latency,
  upgrade to Pro + enable Vercel's "Fluid Compute" (concurrent
  invocations per instance).

- **No persistent filesystem.** Any file writes (logs, temp uploads)
  must go to /tmp (ephemeral per invocation) or an external service.
  Busara already uses the database for all persistent state.

- **Bundle size.** Heavy native deps (`canvas`, `sharp`, `@node-rs/argon2`)
  are listed in `serverExternalPackages` in `next.config.ts` so they're
  not bundled into the serverless function. The `canvas` and `sharp`
  modules are also given webpack `false` fallbacks so build doesn't
  crash if they're absent.

## Troubleshooting

### Build fails with "Cannot find module @prisma/client"
The `postinstall` script in `apps/web/package.json` runs
`prisma generate`. If you've customized the install command in Vercel
and skipped postinstall, Prisma client won't be generated. Either
restore `pnpm install` as the install command, or add
`prisma generate &&` to the start of the build command.

### Build fails with "env var X is missing"
The instrumentation hook asserts required env vars at boot. During
build (`VERCEL_ENV !== 'production'` runtime) it only warns — but
during the production runtime, missing vars produce a hard error. Make
sure ALL required vars from Step 3 are set on the Production
environment in Vercel.

### Prisma connection errors ("too many clients")
- Ensure `DATABASE_URL` uses the **pooler URL** (port `6543`), not the
  direct URL.
- Add `?pgbouncer=true&connection_limit=1&pool_timeout=10` to
  `DATABASE_URL`.
- Ensure `relationMode = "prisma"` is set in `prisma/schema.prisma`
  (it is, as of this commit).
- Check Supabase → Database → Connections to see active connection
  count.

### Rate limiting not working
- Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
- Without Redis, rate limiting gracefully degrades (no-op). Requests
  are allowed through; check server logs for `[rate-limit]` warnings.

### Realtime / agent progress not streaming
- Verify `Accept: text/event-stream` is being sent by the client.
- Check the Network tab — the POST to `/api/v2/analyze-stream` should
  return `Content-Type: text/event-stream` and stream chunks.
- On Vercel, streaming works on Node.js runtime (not Edge) — the route
  explicitly sets `runtime = 'nodejs'`.

### Cold-start latency on first request
- This is expected serverless behavior. Subsequent requests within
  ~5–15 minutes are warm and fast.
- For lower cold starts: upgrade to Vercel Pro, enable Fluid Compute,
  and consider moving read-heavy endpoints to Edge runtime.

## Rollback

To roll back to a previous deploy:

1. Vercel → Project → **Deployments**.
2. Find the last known-good deploy.
3. Click the "..." menu → **Promote to Production**.

DNS-level rollback (if the domain itself is broken) is done at the
registrar by reverting the A/CNAME records added in Step 4.
