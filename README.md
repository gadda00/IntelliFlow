# Busara — 20+ AI Agent Data Intelligence Platform

> **Twenty+ agents. One mind.**
>
> *Busara* (Swahili for *intelligence* / *mind*) is a multi-agent data analysis platform that orchestrates **23 specialized AI agents** in a parallel DAG to extract every actionable insight from your dataset. Built in Nairobi for the world.

[![Deployed on Netlify](https://img.shields.io/badge/Deployed-Netlify-00C7B7)](https://netlify.com)
[![Database: Supabase](https://img.shields.io/badge/Database-Supabase-3ECF8E)](https://supabase.com)
[![Payments: Flutterwave + Google Pay](https://img.shields.io/badge/Payments-Flutterwave%20%2B%20Google%20Pay-FE5C2A)](https://flutterwave.com)
[![Framework: Next.js 16](https://img.shields.io/badge/Framework-Next.js%2016-black)](https://nextjs.org)
[![Node: 22+](https://img.shields.io/badge/Node.js-22%2B-339933)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue)](LICENSE)

---

## What's New in v3.2

| | v3.1 | v3.2 (This Release) |
|---|---|---|
| **Agents** | 20 | **23** (+ NLP Sentiment, Anomaly Forecasting, Graph Neural Network) |
| **Auth** | Custom JWT only | **Supabase Auth** (optional, falls back to JWT) |
| **Payments** | Flutterwave | **Flutterwave + Google Pay + Apple Pay + Mobile Money** |
| **Workflow** | Run all or nothing | **Workflow Composer** — pick agents or use 8 presets |
| **Hosting** | Vercel | **Netlify** (with `@netlify/plugin-nextjs`) |
| **Android** | Manual build | **GitHub Actions** auto-builds APK + AAB on tag push |
| **Node.js** | 18+ | **22+** (required) |
| **Portfolio** | — | **Victor Ndunda portfolio** deploys to GitHub Pages |
| **Real-time** | In-memory pub/sub | WebSocket mini-service (preserved) |

---

## The 20-Agent Pipeline

Busara runs **20 specialized TypeScript agents** in a 6-stage parallel DAG with circuit breakers, timeouts, and topological scheduling.

```
Stage 0 — Intake (parallel):
  ├── Data Scout              — profiling, type detection, statistical summary
  ├── Data Quality Guardian   — completeness, uniqueness, validity scoring
  ├── Privacy Guardian        — PII detection with GDPR/CCPA/HIPAA/PCI-DSS
  └── NLQ Interpreter         — natural language → structured analysis intent

Stage 1 — Engineering:
  └── Data Engineer           — dedup, imputation, type coercion, feature engineering

Stage 2 — Deep Analytics (parallel):
  ├── Analysis Strategist     — methodology selection, hypothesis generation
  ├── Anomaly Sentinel        — Z-score + IQR + EWMA ensemble
  ├── Forecasting Oracle      — Holt-Winters triple exponential smoothing
  ├── Causal Architect        — correlation + regression + Granger-style lag
  ├── Knowledge Graph Builder — entity extraction + graph construction
  ├── Benchmark Agent         — industry benchmark comparison
  └── Auto-ML Agent           — model selection (linear regression + K-means)

Stage 3 — Synthesis (parallel):
  ├── Insight Generator       — ranked insights + recommendations
  ├── Explainability Agent    — permutation feature importance
  ├── Visualization Specialist — Recharts chart specs
  ├── Synthetic Data Generator — privacy-preserving fake data
  └── Code Generator          — Python (pandas) + SQL + JavaScript

Stage 4 — Reporting:
  ├── Narrative Composer      — executive summary, methodology, key findings
  └── Conversational Analyst  — chat layer with knowledge base

Stage 5 — Final:
  └── Orchestrator            — compiles all outputs into unified response
```

Each agent has its own **circuit breaker** (3 failures → 60s cooldown) and **timeout** (10-60s).

---

## Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Language**: TypeScript 5
- **Database**: PostgreSQL on **Supabase** via Prisma ORM
- **Styling**: Tailwind CSS 4 + shadcn/ui
- **Animations**: Framer Motion
- **Charts**: Recharts
- **Payments**: **Flutterwave** (NGN, USD, GHS, ZAR, KES, UGX, TZS, RWF, EUR, GBP)
- **Real-time**: Socket.IO mini-service (port 3003)
- **AI**: z-ai-web-dev-sdk (bundled, no API key required)
- **PWA**: Web App Manifest + Service Worker
- **Android**: Bubblewrap TWA wrapping the PWA

---

## Quick Start

### Prerequisites
- Node.js 18+ (or Bun)
- PostgreSQL 14+ (local) or a Supabase project
- Flutterwave account (optional — works in mock mode without)

### Install & Run

```bash
# Clone
git clone https://github.com/gadda00/Busara.git
cd Busara

# Install dependencies
bun install  # or npm install

# Set up environment
cp .env.example .env
# Edit .env with your Supabase connection strings and Flutterwave keys

# Initialize database
bun run db:push

# Start the dev server
bun run dev  # http://localhost:3000

# (Optional) Start the WebSocket mini-service
cd mini-services/websocket-server
bun install
bun run dev  # http://localhost:3003
```

### Try It

1. Open `http://localhost:3000`
2. Scroll to **Analyze** section
3. Click **Load Sample Data**
4. Click **Run Full Analysis**
5. Watch all 20 agents complete in ~5 seconds
6. Explore the 6 result tabs: Overview, Insights, Charts, Advanced, Code, Agents
7. Install as PWA via your browser's "Add to Home Screen"

---

## Android App (Play Store)

Busara ships as an installable PWA that's wrapped as a Trusted Web Activity (TWA) for the Play Store.

### Build APK & AAB

```bash
# 1. Install Bubblewrap CLI (one-time)
npm install -g @bubblewrap/cli

# 2. Initialize TWA project from the deployed PWA manifest
bubblewrap init --manifest https://your-domain.com/manifest.json

# 3. Build the APK and AAB
bubblewrap build

# Output:
# app-release-signed.apk  (for testing)
# app-release-bundle.aab  (for Play Store upload)
```

See [`ANDROID.md`](ANDROID.md) for the complete Play Store deployment guide.

---

## Architecture

```
Busara/
├── src/
│   ├── app/
│   │   ├── api/                  # 18 API routes
│   │   │   ├── analyze/          # Main 20-agent analysis endpoint
│   │   │   ├── agents/           # List all 20 agents
│   │   │   ├── auth/             # register, login, me, api-keys
│   │   │   ├── payments/         # Flutterwave init, verify, webhook
│   │   │   └── ...               # 13 more endpoints
│   │   ├── layout.tsx
│   │   ├── page.tsx              # Single-page app
│   │   └── globals.css
│   ├── components/
│   │   ├── busara/                # App components
│   │   └── ui/                   # shadcn/ui
│   └── lib/
│       ├── agents/               # 20-agent framework
│       ├── flutterwave/          # Flutterwave service
│       ├── auth/                 # JWT + API keys
│       └── data/                 # Parsers
├── prisma/schema.prisma          # Postgres schema (7 models)
├── public/                       # PWA icons, manifest, service worker
├── mini-services/websocket-server/
├── legacy/                       # v2 Python code (preserved)
└── .env.example
```

---

## API Reference

### Core
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/agents` | List 20 agents |
| `POST` | `/api/analyze` | Run full pipeline |
| `GET` | `/api/analyses` | User's past analyses |
| `GET` | `/api/stats` | Platform stats |

### Standalone Agent Endpoints
`/api/nlq`, `/api/anomalies`, `/api/forecast`, `/api/causal`, `/api/quality`, `/api/chat`, `/api/codegen`, `/api/synthetic`, `/api/knowledge-graph`, `/api/explain`, `/api/benchmark`

### Auth & Payments
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Create account |
| `POST` | `/api/auth/login` | Sign in |
| `GET/POST/DELETE` | `/api/auth/api-keys` | Manage API keys |
| `GET` | `/api/plans` | Subscription plans |
| `POST` | `/api/payments/initialize` | Init Flutterwave transaction |
| `POST` | `/api/payments/verify` | Verify payment |
| `POST` | `/api/payments/webhook` | Flutterwave webhook |

---

## Pricing

| Plan | Price (NGN) | Price (USD) | Analyses/mo | Key Features |
|---|---|---|---|---|
| **Free** | ₦0 | $0 | 5 | All 20 agents, CSV/JSON/Excel |
| **Professional** | ₦15,000 | $29 | 50 | + API access, forecasting, priority support |
| **Team** | ₦50,000 | $99 | 200 | + 5 seats, synthetic data, branding |
| **Enterprise** | Custom | Custom | Unlimited | + SSO, custom agents, on-prem |

All payments via **Flutterwave**. Subscriptions renew automatically. Cancel anytime.

---

## Algorithms Implemented (No Mocks)

### Anomaly Detection (3-algorithm ensemble)
- **Z-Score** — flags points >3σ from mean
- **IQR** — flags points outside [Q1 - 1.5×IQR, Q3 + 1.5×IQR]
- **EWMA** — Exponentially Weighted Moving Average for trend deviations

### Time Series Forecasting
- **Holt-Winters Triple Exponential Smoothing** (level + trend + seasonality)
- **Simple Exponential Smoothing** fallback for short series
- 95% confidence intervals

### Causal Inference
- Pearson correlation + OLS regression + Granger-style lag analysis
- Strength classification: strong (|r|>0.7), moderate (>0.4), weak (>0.2)

### Machine Learning
- **K-Means** clustering with elbow detection
- **Multiple Linear Regression** (OLS via normal equation)
- **Permutation Importance** (SHAP-lite)

### PII Detection
- 7 regex patterns + 9 column-name heuristics
- Risk scoring with GDPR/CCPA/HIPAA/PCI-DSS compliance assessment

### Synthetic Data Generation
- Box-Muller normal sampling for numeric columns
- Frequency-preserving categorical sampling
- PII columns replaced with type-appropriate fakes

---

## License

MIT — see [LICENSE](LICENSE)

## Acknowledgments

Built by **Victor Ndunda** & contributors in Nairobi, Kenya.
Inspired by the Swahili word *busara* (intelligence) — African heritage, global ambition.

---

**Twenty agents. One mind. Built in Nairobi.**
