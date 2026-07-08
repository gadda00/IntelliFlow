# Busara deployment checklist

Run through this list before every deployment to production. Tick every box. If a box can't be ticked, either fix the issue or document why it's acceptable to deploy without it.

> **Last updated:** 2026-01

---

## 1. Environment variables

### 1.1 Required

These MUST be set. The app will not start (or will start in a degraded state) without them.

| Variable | Purpose | Example |
|---|---|---|
| `DATABASE_URL` | Prisma connection string (with pooler) | `postgresql://user:pass@host:5432/db?schema=public` |
| `DIRECT_URL` | Prisma direct connection (for migrations) | `postgresql://user:pass@host:5432/db?schema=public` |
| `JWT_SECRET` | Signs JWTs — must be 32+ chars, high entropy | `<generate with: openssl rand -hex 32>` |
| `DATA_SOURCE_ENCRYPTION_KEY` | AES-GCM key for encrypting connector credentials — 64 hex chars | `<generate with: openssl rand -hex 32>` |
| `NODE_ENV` | `production` | `production` |
| `NEXT_PUBLIC_APP_URL` | Public URL of the deployment | `https://app.busara.ai` |

### 1.2 Auth (Supabase)

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon (public) key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only — never expose to client) |

### 1.3 Payments (Flutterwave)

Only required if payments are enabled.

| Variable | Purpose |
|---|---|
| `FLW_SECRET_KEY` | Starts with `sk_` |
| `FLW_PUBLIC_KEY` | Starts with `fk_` |
| `FLW_ENCRYPTION_KEY` | Encryption key from the Flutterwave dashboard |

### 1.4 LLM provider

Required for any agent that calls an LLM (narrative generation, NLQ, LLM-judge reward model).

| Variable | Purpose |
|---|---|
| `ZAI_API_KEY` | API key from https://z.ai |

### 1.5 Observability (optional but recommended)

| Variable | Purpose |
|---|---|
| `LANGFUSE_PUBLIC_KEY` | Langfuse tracing (public key) |
| `LANGFUSE_SECRET_KEY` | Langfuse tracing (secret key) |
| `LANGFUSE_HOST` | `https://cloud.langfuse.com` or self-hosted URL |
| `SENTRY_DSN` | Sentry error tracking |

### 1.6 Rate limiting (optional but recommended)

| Variable | Purpose |
|---|---|
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token |

Without these, rate limiting is disabled and the API is open to abuse.

### 1.7 Verification checklist

- [ ] All required env vars from §1.1 are set in the deployment environment (not in `.env.local` — in the actual host: Vercel, Netlify, AWS, etc.)
- [ ] `JWT_SECRET` is 32+ characters and was generated with a CSPRNG (e.g. `openssl rand -hex 32`)
- [ ] `DATA_SOURCE_ENCRYPTION_KEY` is exactly 64 hex characters (32 bytes)
- [ ] `NEXT_PUBLIC_APP_URL` matches the actual deployment URL (no trailing slash)
- [ ] `NODE_ENV=production`
- [ ] No secrets in `.env.example` (it should only have placeholder values)
- [ ] No secrets in the Git repo (run `git log -p -- .env*` to be sure)
- [ ] No secrets in the CI logs
- [ ] Secrets are rotated every 90 days (or documented why not)

---

## 2. Database

### 2.1 Migrations

- [ ] `pnpm db:generate` runs clean (no drift between `schema.prisma` and `@prisma/client`)
- [ ] `pnpm db:migrate` runs clean in a staging environment that mirrors production
- [ ] All migrations are reversible (have a `down.sql` or can be rolled back via `prisma migrate resolve`)
- [ ] Destructive migrations (column drops, table drops) are scheduled for a low-traffic window
- [ ] The migration log in `prisma/migrations/` is in order with no gaps

### 2.2 Backups

- [ ] Automated daily backups are enabled on the production database
- [ ] Point-in-time recovery is enabled (most managed Postgres providers support this)
- [ ] A backup restore has been tested in the last 30 days
- [ ] The backup retention period is at least 7 days

### 2.3 Connection pool

- [ ] `DATABASE_URL` uses a pooled connection string (e.g. Supabase pooler on port 6543, PgBouncer, etc.)
- [ ] `DIRECT_URL` uses the direct connection (for migrations)
- [ ] Pool size is at least 10 (or scaled to expected concurrency)
- [ ] Connection timeout is set (5-10 seconds)

### 2.4 Indexes

- [ ] Every column that appears in a `WHERE` clause has an index (check `prisma/schema.prisma` for `@@index` declarations)
- [ ] Foreign keys have indexes (Prisma creates these automatically — verify)
- [ ] The slow query log has been reviewed in the last 7 days
- [ ] No `Seq Scan` on hot queries in `EXPLAIN ANALYZE` output

---

## 3. Security review

### 3.1 AuthN / AuthZ

- [ ] Every API route that mutates data checks for an authenticated user
- [ ] Every API route that reads user-owned data filters by `userId` (or `workspaceId` for shared data)
- [ ] Admin routes (under `/api/rbac`, `/api/audit`) require an admin role
- [ ] API keys are hashed at rest (we store `keyHash`, never the raw key — verify in `prisma/schema.prisma`)
- [ ] API key prefixes are stored (so users can identify their keys without revealing them)
- [ ] JWT expiry is set (recommend 1h access token + 7d refresh token)
- [ ] Refresh token rotation is enabled (if applicable)

### 3.2 Input validation

- [ ] Every API route validates its request body with Zod (search for `safeParse` in `apps/web/src/app/api/`)
- [ ] Every API route validates its query params with Zod
- [ ] File uploads (CSV, JSON) have a max size limit (recommend 10MB)
- [ ] User-supplied SQL is never concatenated into a query (use Prisma's parameterized queries)
- [ ] No `dangerouslySetInnerHTML` in React components without sanitization
- [ ] CORS is configured (only allow your known origins)

### 3.3 LLM-specific (prompt injection + PII)

- [ ] `PromptInjectionGuardrail` is wired into the agent pipeline (see `packages/agents/src/trajectory/guardrails.ts`)
- [ ] `PIILeakageGuardrail` is wired into the agent pipeline
- [ ] The Data Proxy (`trajectory/dataProxy.ts`) is configured to scrub PII before exporting trajectories
- [ ] LLM API keys are not logged (audit the LLM gateway logs)
- [ ] User-supplied content is not used directly in system prompts

### 3.4 Network

- [ ] HTTPS is enforced (redirect HTTP → HTTPS)
- [ ] HSTS header is set
- [ ] SSRF protection is in place for any user-supplied URL (see `apps/web/src/lib/security/`)
- [ ] The database is not reachable from the public internet (only from the app's VPC)
- [ ] Redis (if used for rate limiting) is not reachable from the public internet

### 3.5 Secrets

- [ ] No secrets in the codebase (run `git log -p | rg -i '(sk_|ifl_|password|secret|token)'`)
- [ ] No secrets in CI logs
- [ ] Secrets are stored in a secrets manager (Vercel/Netlify env vars, AWS Secrets Manager, Doppler, etc.)
- [ ] Secrets are rotated every 90 days
- [ ] Former employee access has been revoked

### 3.6 Dependencies

- [ ] `pnpm audit` passes (no known vulnerabilities in production deps)
- [ ] No `--force` resolutions in `package.json`
- [ ] All deps are at their latest patch version within the locked minor

---

## 4. Performance checks

### 4.1 Build

- [ ] `pnpm build` completes without warnings (especially no ESLint warnings during build)
- [ ] Bundle size is within budget (Next.js reports it; check the build output)
- [ ] No dynamic imports that could be static (check for unnecessary `dynamic()` calls)

### 4.2 Runtime

- [ ] The `/api/health` endpoint responds in < 50ms
- [ ] The `/api/v7/agents` endpoint responds in < 200ms (it's cached for 10 min)
- [ ] A typical `/api/v2/analyze` call completes in < 5s for a 1000-row dataset
- [ ] A streaming `/api/v2/analyze-stream` call emits the first event within 1s
- [ ] No synchronous work on the event loop (use `setImmediate` / `await` for CPU-bound work)

### 4.3 Database

- [ ] The N+1 query check passes (no `for { const x = await db.x.findUnique(...) }` patterns)
- [ ] Hot queries use `select` to limit columns returned
- [ ] Pagination uses `cursor` instead of `offset` for large tables (where applicable)
- [ ] The `Trajectory` table has been partitioned by `startedAt` (for high-volume deployments)

### 4.4 Caching

- [ ] `/api/v7/agents` is cached (10 min TTL — see `apps/web/src/app/api/v7/agents/route.ts`)
- [ ] `/api/agents` is cached (10 min TTL)
- [ ] `/api/health` is cached (30s TTL)
- [ ] The `SmartCache` in `packages/agents/src/orchestrator.ts` is used for expensive agent computations

### 4.5 Load testing

- [ ] A load test has been run against staging (recommend `k6` or `autocannon`)
- [ ] The system handles 100 concurrent `/api/v2/analyze` requests without errors
- [ ] The system handles 50 concurrent `/api/v2/analyze-stream` requests without errors
- [ ] P95 latency is < 2s for `/api/v2/analyze` under load
- [ ] Memory usage stays under 80% of the container limit under load

---

## 5. Observability

### 5.1 Logging

- [ ] `LOG_LEVEL` is set to `info` (not `debug` — too noisy in prod)
- [ ] Logs are JSON-structured (for ingestion into Datadog / Logtail / CloudWatch)
- [ ] No PII in logs (audit the LLM gateway logs and trajectory logs)
- [ ] Request IDs are propagated (so a request can be traced across services)

### 5.2 Tracing

- [ ] Langfuse tracing is enabled (`LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY` are set)
- [ ] Every agent execution creates a Langfuse trace
- [ ] Trajectories are exportable in OTel format (see `packages/agents/src/trajectory/otel.ts`)

### 5.3 Metrics

- [ ] The `/api/health` endpoint reports cache stats
- [ ] Prometheus metrics endpoint is exposed (planned — see `apps/web/src/app/api/health/route.ts`)
- [ ] Alerts are configured for: error rate > 1%, p95 latency > 2s, db connection count > 80% of pool

### 5.4 Error tracking

- [ ] `SENTRY_DSN` is set
- [ ] Source maps are uploaded to Sentry on every release
- [ ] Sentry alerts are routed to on-call (PagerDuty, Opsgenie, etc.)

---

## 6. Data integrity

- [ ] The Data Proxy (`trajectory/dataProxy.ts`) is configured to scrub PII before any trajectory export
- [ ] The Data Proxy's export audit log is being written to the database
- [ ] Trajectory deduplication is enabled (so identical re-runs don't pollute the learning dataset)
- [ ] Quality scoring is enabled (every trajectory gets a 0-1 score on creation)
- [ ] The retention period for trajectories is set (recommend 90 days; longer requires user consent)

---

## 7. Evolution control plane

- [ ] The Evolution Control Plane has been run at least once in staging (`busara evolution list`)
- [ ] A human reviewer is designated to approve evolution actions
- [ ] Evolution actions are logged to the audit table
- [ ] Rollback has been tested (apply an action, then roll it back, verify the agent reverts)

---

## 8. Pre-deploy smoke test

Run this after deploying to production (or after a promotion):

```bash
# 1. Health check
curl https://app.busara.ai/api/health
# Expect: { "status": "healthy", ... }

# 2. Agent list
busara config set apiUrl https://app.busara.ai
busara agents list | head -5
# Expect: table of agents

# 3. Single-agent run
busara analyze data_ingestion --data packages/cli/templates/project/sample.csv
# Expect: { ok: true, result: { status: "success", ... } }

# 4. Streaming run
busara analyze data_ingestion --data packages/cli/templates/project/sample.csv --stream
# Expect: connected → agent_start → agent_complete → complete

# 5. Trajectory
busara trajectory list --limit 5
# Expect: at least 2 trajectories from steps 3 and 4

# 6. Evolution
busara evolution list --agent data_ingestion
# Expect: either an empty list (if no drift) or a list of suggestions
```

If any step fails, roll back the deployment.

---

## 9. Post-deploy

- [ ] Watch the error rate for 30 minutes (Sentry / Datadog)
- [ ] Watch the p95 latency for 30 minutes
- [ ] Watch the database connection count
- [ ] Tag the release in Git: `git tag -a v8.0.0 -m "Release v8.0.0" && git push --tags`
- [ ] Update the changelog
- [ ] Notify the team in Slack / Discord

---

## 10. Rollback plan

If something goes wrong:

1. **Roll back the deployment** — Vercel / Netlify / AWS all support instant rollbacks to the previous deployment
2. **Roll back the database** — if a migration caused the issue, run `prisma migrate resolve --rolled-back <migration_name>` and restore from backup if needed
3. **Roll back evolution actions** — `busara evolution reject <agent-id> --index <n>` or use the web UI's rollback button
4. **Communicate** — post in the incident channel, update the status page

---

## Quick reference: pre-deploy one-liner

```bash
pnpm typecheck && pnpm test && pnpm lint && pnpm build && pnpm audit && echo "✓ Ready to deploy"
```

If that exits 0, you're clear to deploy. (You still need to tick the boxes above — this just catches the common cases.)
