# IntelliFlow v3 — Production Deployment

## Vercel (Recommended)

### Prerequisites
1. Vercel account
2. Paystack account (for live payments) — optional in dev mode
3. GitHub repo connected to Vercel

### Steps
1. **Fork & clone** the repo
2. **Import to Vercel** — Vercel auto-detects Next.js 16
3. **Configure environment variables** in Vercel dashboard:
   - `DATABASE_URL` — Vercel Postgres or external Postgres URL (change `provider` in `prisma/schema.prisma` to `"postgresql"`)
   - `JWT_SECRET` — long random string (e.g., `openssl rand -hex 32`)
   - `NEXT_PUBLIC_APP_URL` — your Vercel URL (e.g., `https://your-app.vercel.app`)
   - `PAYSTACK_SECRET_KEY` — from Paystack dashboard
   - `PAYSTACK_PUBLIC_KEY` — from Paystack dashboard
4. **Deploy** — Vercel runs `prisma generate` automatically
5. **Initialize the database** — run `bun run db:push` locally against your production DB (or use Vercel's Prisma integration)

### Post-Deploy
1. **Configure Paystack webhook** — set webhook URL to `https://your-app.vercel.app/api/payments/webhook`
2. **Create Paystack plans** (optional) — for recurring subscriptions, create plans in Paystack dashboard and add their codes to env vars
3. **Test the flow** — register → upload CSV → run analysis → upgrade plan

## Self-Hosted (Docker)

```bash
# Build
docker build -t intelliflow-v3 .

# Run
docker run -p 3000:3000 \
  -e DATABASE_URL=file:./data.db \
  -e JWT_SECRET=$(openssl rand -hex 32) \
  -e PAYSTACK_SECRET_KEY=sk_test_xxx \
  -e PAYSTACK_PUBLIC_KEY=pk_test_xxx \
  -e NEXT_PUBLIC_APP_URL=https://your-domain.com \
  intelliflow-v3
```

## WebSocket Mini-Service

For real-time agent progress (optional — the app falls back to polling):

```bash
cd mini-services/websocket-server
bun install
bun run dev  # listens on port 3003
```

In production, deploy as a separate service (Render, Railway, or Vercel functions).

## Database Migrations

```bash
# After changing prisma/schema.prisma:
bun run db:push       # Apply schema (dev)
bun run db:migrate    # Create migration (prod)
bun run db:reset      # Reset all data (dev only!)
```

## Environment Variables Reference

See `.env.example` for all supported variables.

## Monitoring

- `/api/health` — health check with agent pool status
- `/api/stats` — platform usage stats (auth required)
- Prisma Studio: `bun run prisma studio` (local DB inspection)

## Security Notes

- **JWT secret** must be long and random in production
- **Paystack webhook** signature verification is enforced when `PAYSTACK_SECRET_KEY` is set
- **CORS** — currently permissive; restrict in `next.config.ts` for production
- **Rate limiting** — implemented per-IP in-memory; use Upstash Redis for distributed deployments
- **PII detection** runs on every uploaded dataset; sensitive columns are flagged in the analysis report
