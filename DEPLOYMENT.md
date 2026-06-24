# Busara v3.1 — Production Deployment

## Vercel (Recommended for the Web App)

### Prerequisites
1. Vercel account
2. Supabase project (free tier is fine)
3. Flutterwave account (for live payments) — optional in dev mode
4. GitHub repo connected to Vercel

### Steps

1. **Fork & clone** the repo
2. **Import to Vercel** — Vercel auto-detects Next.js 16
3. **Configure environment variables** in Vercel dashboard (see `.env.example`):
   - `DATABASE_URL` — Supabase connection pooler URL (port 6543, with `?pgbouncer=true`)
   - `DIRECT_URL` — Supabase direct connection URL (port 5432)
   - `JWT_SECRET` — long random string (e.g., `openssl rand -hex 32`)
   - `NEXT_PUBLIC_APP_URL` — your Vercel URL
   - `FLW_SECRET_KEY` — from Flutterwave dashboard (starts with `FLWSECK-`)
   - `FLW_PUBLIC_KEY` — from Flutterwave dashboard (starts with `FLWPUB-`)
   - `FLW_ENCRYPTION_KEY` — from Flutterwave dashboard
   - `FLW_WEBHOOK_HASH` — set this yourself in Flutterwave dashboard
4. **Deploy** — Vercel runs `prisma generate` automatically via `postinstall`
5. **Initialize the database** — run `bun run db:push` locally against your Supabase DB (uses `DIRECT_URL`)

### Post-Deploy
1. **Configure Flutterwave webhook** — set webhook URL to `https://your-app.vercel.app/api/payments/webhook` and set the secret hash to match `FLW_WEBHOOK_HASH`
2. **Configure PWA asset links** — for Android TWA, update `public/.well-known/assetlinks.json` with your signing key's SHA-256 fingerprint
3. **Test the flow** — register → upload CSV → run analysis → upgrade plan → export PDF

---

## Supabase Setup

### 1. Create a Project
- Go to https://supabase.com → New Project
- Choose a region close to your users
- Set a strong database password
- Wait ~2 minutes for provisioning

### 2. Get Connection Strings
- Project Settings → Database → Connection string
- **Connection pooling** (use for `DATABASE_URL`):
  ```
  postgresql://postgres.xxxx:PASSWORD@aws-0-region.pooler.supabase.com:6543/postgres?pgbouncer=true
  ```
- **Direct connection** (use for `DIRECT_URL` and migrations):
  ```
  postgresql://postgres.xxxx:PASSWORD@aws-0-region.supabase.com:5432/postgres
  ```

### 3. Push the Schema
```bash
# Locally, with DIRECT_URL set in .env
bun run db:push

# Verify tables created
bun run db:studio  # opens Prisma Studio
```

### 4. (Optional) Enable Supabase Auth
Busara ships with its own JWT auth, but you can swap in Supabase Auth by replacing `src/lib/auth/server.ts` with Supabase client calls.

---

## Flutterwave Setup

### 1. Create Account
- Go to https://dashboard.flutterwave.com
- Complete KYC (for live payments)
- Go to Settings → API

### 2. Get API Keys
- **Secret Key**: starts with `FLWSECK-` → set as `FLW_SECRET_KEY`
- **Public Key**: starts with `FLWPUB-` → set as `FLW_PUBLIC_KEY`
- **Encryption Key**: 32-char string → set as `FLW_ENCRYPTION_KEY`

### 3. Configure Webhook
- Go to Settings → Webhooks
- **URL**: `https://your-domain.com/api/payments/webhook`
- **Secret hash**: generate a random string (e.g., `openssl rand -hex 24`) → set as `FLW_WEBHOOK_HASH` and enter in dashboard

### 4. Test Mode
- Use `FLWSECK_TEST-...` keys for testing
- Test cards: https://developer.flutterwave.com/test-cards

---

## WebSocket Mini-Service (Optional, for Real-Time Updates)

The app falls back to polling if the WebSocket service is unavailable. To enable real-time agent progress:

### Deploy to Render (free tier)
1. New Web Service → connect GitHub repo
2. **Root Directory**: `mini-services/websocket-server`
3. **Build Command**: `bun install`
4. **Start Command**: `bun run dev` (or `bun run index.ts` for production)
5. **Port**: 3003 (Render assigns this; set `PORT=3003` env var)

### Update env var
After deploying, set `WS_SERVER_URL` in your Vercel project to the Render URL (e.g., `https://busara-ws.onrender.com`).

---

## Android App (Play Store)

See [`ANDROID.md`](ANDROID.md) for the complete guide.

Quick build:
```bash
# After deploying the PWA
PWA_URL=https://your-app.vercel.app ./scripts/build-android.sh
```

Outputs:
- `app-release-signed.apk` — for testing
- `app-release-bundle.aab` — for Play Store upload

---

## Database Migrations

```bash
# After changing prisma/schema.prisma:
bun run db:push       # Apply schema (uses DIRECT_URL for Supabase)
bun run db:migrate    # Create migration file
bun run db:reset      # Reset all data (DEV ONLY)
bun run db:studio     # Open Prisma Studio (GUI for inspecting data)
```

---

## Environment Variables Reference

See `.env.example` for all supported variables. Key ones:

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | Supabase pooler URL (port 6543) |
| `DIRECT_URL` | ✅ | Supabase direct URL (port 5432, for migrations) |
| `JWT_SECRET` | ✅ | Long random string for JWT signing |
| `NEXT_PUBLIC_APP_URL` | ✅ | Your deployed URL |
| `FLW_SECRET_KEY` | For payments | Flutterwave secret key |
| `FLW_PUBLIC_KEY` | For payments | Flutterwave public key |
| `FLW_ENCRYPTION_KEY` | For payments | Flutterwave encryption key |
| `FLW_WEBHOOK_HASH` | For webhooks | Secret hash set in Flutterwave dashboard |
| `WS_SERVER_URL` | Optional | WebSocket service URL |

---

## Monitoring

- `/api/health` — health check with agent pool status
- `/api/stats` — platform usage stats (auth required)
- Prisma Studio: `bun run db:studio` (local DB inspection)
- Supabase Dashboard → Logs for database query logs
- Vercel Dashboard → Functions → Logs for API route logs

---

## Security Notes

- **JWT secret** must be long and random in production (`openssl rand -hex 32`)
- **Flutterwave webhook** signature verification is enforced when `FLW_WEBHOOK_HASH` is set
- **CORS** — currently permissive; restrict in `next.config.ts` for production
- **Rate limiting** — implemented per-IP in-memory; use Upstash Redis for distributed deployments
- **PII detection** runs on every uploaded dataset; sensitive columns are flagged
- **Password hashing** uses PBKDF2 with 100,000 iterations and per-user salt
- **API keys** are SHA-256 hashed before storage; only shown once at creation time

---

## Backup

### Database
- Supabase: Daily automatic backups on paid plans; manual via Dashboard → Database → Backups
- Self-hosted: `pg_dump` cron job

### Code
- Git (GitHub)
- Vercel deployments are immutable; rollback via dashboard
