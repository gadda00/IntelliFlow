# Netlify Deployment Guide

This document covers deploying Busara to Netlify via two methods:

## Method 1: Netlify Native GitHub Integration (Recommended)

This is the simplest and most reliable approach. Netlify builds and deploys automatically on every push.

### Setup

1. Go to [app.netlify.com](https://app.netlify.com) and click "Add new site" → "Import an existing project"
2. Connect your GitHub account and select the `gadda00/IntelliFlow` repository
3. Configure build settings (these are auto-detected from `netlify.toml`):
   - **Build command:** `npx prisma generate && npm run build`
   - **Publish directory:** `.next`
4. Add environment variables (Site settings → Environment variables):
   - `DATABASE_URL` — your Supabase PostgreSQL connection string
   - `DIRECT_URL` — same as DATABASE_URL (for Prisma migrations)
   - `JWT_SECRET` — a random 32+ character string
   - `NEXT_PUBLIC_APP_URL` — your Netlify URL (e.g., `https://busara.netlify.app`)
5. Click "Deploy site"

### How it works

- `netlify.toml` configures `@netlify/plugin-nextjs` which handles Next.js SSR, API routes, and static optimization
- On every push to `main`, Netlify rebuilds and deploys automatically
- Preview deployments are created for pull requests

## Method 2: GitHub Actions CI/CD

The `.github/workflows/netlify.yml` workflow builds the site in GitHub Actions and deploys via the Netlify CLI.

### Required GitHub Secrets

Go to **GitHub repo → Settings → Secrets and variables → Actions** and add:

| Secret | Description | Where to find it |
|--------|-------------|-----------------|
| `NETLIFY_AUTH_TOKEN` | Personal access token for Netlify API | [Netlify User Applications](https://app.netlify.com/user/applications#personal-access-tokens) → New access token |
| `NETLIFY_SITE_ID` | The site's API ID | Netlify dashboard → Site settings → General → Site details → API ID |
| `DATABASE_URL` | PostgreSQL connection string | Supabase dashboard → Project settings → Database |
| `DIRECT_URL` | Same as DATABASE_URL | Same as above |
| `JWT_SECRET` | Random 32+ char string | Generate with `openssl rand -base64 32` |
| `NEXT_PUBLIC_APP_URL` | Your site URL | e.g., `https://busara.netlify.app` |

### Common Issues

#### "Site not found. Please rerun netlify link"

This means the `NETLIFY_SITE_ID` is incorrect or the `NETLIFY_AUTH_TOKEN` doesn't have access to the site.

**Fix:**
1. Verify `NETLIFY_SITE_ID` — go to Netlify dashboard → your site → Site settings → General → Site details → copy the **API ID** (not the site name or URL)
2. Verify `NETLIFY_AUTH_TOKEN` — go to [Netlify User Applications](https://app.netlify.com/user/applications#personal-access-tokens), create a new token, and update the GitHub secret

#### Build fails with "cp: cannot create directory '.next/standalone'"

The `package.json` build script must be `"build": "next build"` — do NOT add `output: "standalone"` to `next.config.ts` or standalone copy commands to the build script. The `@netlify/plugin-nextjs` handles output transformation.

#### Prisma client not generated

The build command includes `npx prisma generate` before `npm run build`. Ensure `DATABASE_URL` is set (even a placeholder works for generation).

## Architecture

```
GitHub Push → GitHub Actions → Build (npm run build) → Deploy (.next to Netlify)
                                                      ↓
                                           @netlify/plugin-nextjs processes:
                                           - Static pages → CDN
                                           - API routes → Serverless functions
                                           - SSR pages → On-demand rendering
```

## netlify.toml Configuration

The `netlify.toml` file configures:
- Build command and environment
- `@netlify/plugin-nextjs` plugin
- Function timeouts (60s for analyze endpoint)
- PWA manifest and service worker headers
- Security headers
- Static asset caching
