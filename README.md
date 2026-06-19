# IntelliFlow v3 — 20-Agent Data Analysis Platform

> **Twenty specialists. One orchestrated pipeline. Real math, real fast, in production.**

IntelliFlow v3 is a complete rewrite of the IntelliFlow platform — a TypeScript-native, multi-agent data analysis system that runs **20 specialized AI agents** in a parallel DAG to extract every actionable insight from your dataset. No mocks. No toy demos. Real statistics, real forecasts, real causal inference — all in production.

Built by **Victor Ndunda** & contributors.

---

## What's New in v3

| | v2 (Legacy) | v3 (This Release) |
|---|---|---|
| **Agents** | 12 Python agents (Flask) | **20 TypeScript agents** (Next.js) |
| **Live Demo** | Falls back to mock data in production | **Real analysis runs in production** |
| **Backend** | Flask + SocketIO (not deployed) | Next.js API routes + Prisma |
| **Persistence** | None (in-memory) | SQLite/Postgres via Prisma |
| **Payments** | Paystack code exists but unused | **End-to-end Paystack flow with webhooks** |
| **Auth** | Basic JWT mock | **JWT + API keys + usage tracking** |
| **Real-time** | Promised, not delivered | WebSocket mini-service + in-memory pub/sub |
| **UI** | Vite SPA, 3 tabs | **Modern Next.js 16 SPA with 6 sections** |

### 8 NEW Novel Agents (not in v2)

1. **Privacy Guardian** — PII detection with GDPR/CCPA/HIPAA/PCI-DSS compliance scoring
2. **Knowledge Graph Builder** — Entity-relationship extraction with centrality analysis
3. **Synthetic Data Generator** — Privacy-preserving fake data with statistical preservation
4. **Code Generator** — Generates Python/SQL/JS code that reproduces the analysis
5. **Benchmark Agent** — Compares metrics against industry benchmarks (finance, web, healthcare, IoT)
6. **Explainability Agent** — Permutation feature importance with natural-language explanations
7. **Auto-ML Agent** — Tries multiple model families and recommends the best
8. **Conversational Analyst** — Chat-with-your-data with contextual Q&A

---

## The 20-Agent Pipeline

The agents run in a **6-stage Directed Acyclic Graph (DAG)** with parallelism within each stage:

```
Stage 0 (Intake, parallel):
  ├── Data Scout          — profiling, type detection, statistical summary
  ├── Data Quality Guardian — completeness, uniqueness, validity scoring
  ├── Privacy Guardian    — PII detection with regex + column-name heuristics
  └── NLQ Interpreter     — natural language → structured analysis intent

Stage 1 (Engineering):
  └── Data Engineer       — dedup, imputation, type coercion, feature engineering

Stage 2 (Deep Analytics, parallel):
  ├── Analysis Strategist — methodology selection, hypothesis generation
  ├── Anomaly Sentinel    — Z-score + IQR + EWMA ensemble
  ├── Forecasting Oracle  — Holt-Winters triple exponential smoothing
  ├── Causal Architect    — correlation + regression + Granger-style lag
  ├── Knowledge Graph Builder — entity extraction + graph construction
  ├── Benchmark Agent     — industry benchmark comparison
  └── Auto-ML Agent       — model selection (linear regression + K-means)

Stage 3 (Synthesis, parallel):
  ├── Insight Generator   — ranked insights + recommendations
  ├── Explainability Agent — permutation feature importance
  ├── Visualization Specialist — Recharts chart specs (histograms, scatters, heatmaps, etc.)
  ├── Synthetic Data Generator — privacy-preserving fake data
  └── Code Generator      — Python (pandas) + SQL + JavaScript

Stage 4 (Reporting):
  ├── Narrative Composer  — executive summary, methodology, key findings
  └── Conversational Analyst — chat layer

Stage 5 (Final):
  └── Orchestrator        — compiles all outputs into unified response
```

Each agent has its own **circuit breaker** (3 failures → 60s cooldown) and **timeout** (10-60s depending on complexity). Failed dependencies cascade-skip dependent agents (not fail the whole pipeline).

---

## Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Language**: TypeScript 5 throughout
- **Database**: Prisma ORM (SQLite for dev, Postgres for prod)
- **Styling**: Tailwind CSS 4 + shadcn/ui (New York style)
- **Animations**: Framer Motion
- **Charts**: Recharts
- **Code Highlighting**: react-syntax-highlighter
- **Auth**: Custom JWT (HS256) + API keys (SHA-256 hashed)
- **Payments**: Paystack (NGN, USD, GHS, ZAR, KES)
- **Real-time**: Socket.IO mini-service
- **Icons**: Lucide React

---

## Quick Start

### Prerequisites
- Node.js 18+ (or Bun)
- A Paystack account (optional — works in mock mode without)

### Install & Run

```bash
# Clone
git clone https://github.com/gadda00/IntelliFlow.git
cd IntelliFlow

# Install dependencies
bun install  # or npm install

# Set up environment
cp .env.example .env
# Edit .env with your secrets (or leave defaults for dev mode)

# Initialize database
bun run db:push

# Start the dev server
bun run dev  # http://localhost:3000

# (Optional) Start the WebSocket mini-service for real-time updates
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

---

## Architecture

```
IntelliFlow v3/
├── src/
│   ├── app/
│   │   ├── api/                  # 18 API routes
│   │   │   ├── analyze/          # Main analysis endpoint
│   │   │   ├── agents/           # List all 20 agents
│   │   │   ├── anomalies/        # Standalone anomaly detection
│   │   │   ├── auth/             # register, login, me, api-keys
│   │   │   ├── benchmark/        # Industry benchmarks
│   │   │   ├── causal/           # Causal analysis
│   │   │   ├── chat/             # Conversational analyst
│   │   │   ├── codegen/          # Code generation
│   │   │   ├── explain/          # Feature importance
│   │   │   ├── forecast/         # Time series forecasting
│   │   │   ├── health/           # Health check
│   │   │   ├── knowledge-graph/  # Knowledge graph
│   │   │   ├── nlq/              # Natural language query
│   │   │   ├── payments/         # Paystack init, verify, webhook
│   │   │   ├── plans/            # Subscription plans
│   │   │   ├── quality/          # Data quality assessment
│   │   │   ├── stats/            # Usage stats
│   │   │   └── synthetic/        # Synthetic data generation
│   │   ├── layout.tsx
│   │   ├── page.tsx              # Single-page app (the only route)
│   │   └── globals.css
│   ├── components/
│   │   ├── intelliflow/          # App-specific components
│   │   │   ├── Header.tsx
│   │   │   ├── Hero.tsx
│   │   │   ├── AgentGallery.tsx
│   │   │   ├── Analyzer.tsx
│   │   │   ├── AgentDAGVisualizer.tsx
│   │   │   ├── AnalysisResultsView.tsx
│   │   │   ├── ChatSection.tsx
│   │   │   ├── Pricing.tsx
│   │   │   ├── AuthModal.tsx
│   │   │   └── Footer.tsx
│   │   └── ui/                   # shadcn/ui components
│   └── lib/
│       ├── agents/               # The 20-agent framework
│       │   ├── core.ts           # Base Agent, Tool, CircuitBreaker, SmartCache
│       │   ├── statistics.ts     # Real math: mean, median, stdev, regression, k-means, PII detection
│       │   ├── executor.ts       # DAG executor with topological scheduling
│       │   ├── coreAgents.ts     # 7 core agents
│       │   ├── advancedAgents.ts # 5 advanced agents
│       │   ├── specializedAgents.ts # 8 NEW specialized agents
│       │   └── index.ts          # Registry & singleton pool
│       ├── auth/server.ts        # JWT, API keys, password hashing (PBKDF2)
│       ├── paystack/server.ts    # Paystack service + plans
│       ├── data/parsers.ts       # CSV/JSON/TSV parsing
│       ├── api-client.ts         # Frontend API client + types
│       ├── parsers-client.ts     # Client-side CSV parser
│       └── db.ts                 # Prisma client
├── prisma/
│   └── schema.prisma             # User, Analysis, AgentRun, Payment, Subscription, UsageRecord, ApiKey
├── mini-services/
│   └── websocket-server/         # Socket.IO server on port 3003
├── legacy/                       # v2 Python code (preserved for reference)
├── .env.example
├── DEPLOYMENT.md
└── package.json
```

---

## API Reference

### Core Endpoints

| Method | Path | Description | Auth |
|---|---|---|---|
| `GET` | `/api/health` | Health check + agent pool status | None |
| `GET` | `/api/agents` | List all 20 agents with capabilities | None |
| `POST` | `/api/analyze` | Run full 20-agent pipeline | Optional |
| `GET` | `/api/analyses` | List user's past analyses | Required |
| `GET` | `/api/stats` | Platform stats + user usage | Required |

### Standalone Agent Endpoints

| Method | Path | Agent |
|---|---|---|
| `POST` | `/api/nlq` | NLQ Interpreter |
| `POST` | `/api/anomalies` | Anomaly Sentinel |
| `POST` | `/api/forecast` | Forecasting Oracle |
| `POST` | `/api/causal` | Causal Architect |
| `POST` | `/api/quality` | Data Quality Guardian |
| `POST` | `/api/chat` | Conversational Analyst |
| `POST` | `/api/codegen` | Code Generator |
| `POST` | `/api/synthetic` | Synthetic Data Generator |
| `POST` | `/api/knowledge-graph` | Knowledge Graph Builder |
| `POST` | `/api/explain` | Explainability Agent |
| `POST` | `/api/benchmark` | Benchmark Agent |

### Auth & Payments

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Create account |
| `POST` | `/api/auth/login` | Sign in |
| `GET` | `/api/auth/me` | Current user info |
| `GET/POST/DELETE` | `/api/auth/api-keys` | Manage API keys |
| `GET` | `/api/plans` | List subscription plans |
| `POST` | `/api/payments/initialize` | Initialize Paystack transaction |
| `POST` | `/api/payments/verify` | Verify payment & upgrade plan |
| `POST` | `/api/payments/webhook` | Paystack webhook (signature verified) |

---

## Algorithms Implemented (No Mocks)

### Statistics (`src/lib/agents/statistics.ts`)
- Mean, median, mode, variance, stdev, skewness, kurtosis
- Pearson correlation, linear regression, multiple regression (OLS via normal equation)
- Permutation importance (SHAP-lite)
- K-Means clustering with elbow detection
- Quantile/percentile, IQR, Box-Muller normal sampling

### Anomaly Detection (3-algorithm ensemble)
- **Z-Score** — flags points >3σ from mean
- **IQR** — flags points outside [Q1 - 1.5×IQR, Q3 + 1.5×IQR]
- **EWMA** — Exponentially Weighted Moving Average for trend deviations
- Ensemble scoring: each detected anomaly gets a weighted score across methods

### Time Series Forecasting
- **Holt-Winters Triple Exponential Smoothing** (level + trend + seasonality, period 12)
- **Simple Exponential Smoothing** fallback for short series (<24 points)
- 95% confidence intervals as `1.96σ√h`
- Accuracy reported as `100 - MAPE` (mean absolute percentage error)

### Causal Inference
- Pearson correlation between variables
- OLS regression for effect size estimation
- Lagged correlation (Granger-style temporal precedence)
- Strength classification: strong (|r|>0.7), moderate (>0.4), weak (>0.2)

### PII Detection
- 7 regex patterns: email, phone, SSN, credit card, IP, DOB, IBAN
- 9 column-name heuristics: name, email, phone, address, SSN, DOB, gender, race, religion
- Risk scoring (0-100) with weighted PII types
- Compliance assessment: GDPR, CCPA, HIPAA, PCI-DSS

### Synthetic Data Generation
- Numeric columns: normal distribution fitted to original mean/stdev (Box-Muller)
- Categorical: original frequency distribution
- Datetime: uniform between min/max
- PII columns: replaced with type-appropriate fakes (fake emails, names, etc.)
- Validation: distribution divergence + similarity score

---

## Pricing

| Plan | Price (NGN) | Price (USD) | Analyses/mo | Key Features |
|---|---|---|---|---|
| **Free** | ₦0 | $0 | 5 | All 20 agents, CSV/JSON/Excel, PDF export |
| **Professional** | ₦15,000 | $29 | 50 | + API access, forecasting, causal analysis, priority support |
| **Team** | ₦50,000 | $99 | 200 | + 5 seats, synthetic data, collaboration, custom branding |
| **Enterprise** | Custom | Custom | Unlimited | + SSO, dedicated support, custom agents, on-prem |

All payments via **Paystack**. Subscriptions renew automatically. Cancel anytime.

---

## Development

### Scripts

```bash
bun run dev          # Start dev server (port 3000)
bun run build        # Production build
bun run lint         # ESLint
bun run db:push      # Apply schema changes to DB
bun run db:migrate   # Create migration
bun run db:reset     # Reset DB (dev only!)
bun run db:generate  # Regenerate Prisma client
```

### Adding a New Agent

1. Create `src/lib/agents/myAgent.ts`:
```typescript
import { Agent, AgentExecutionContext } from './core';

export class MyAgent extends Agent {
  constructor() {
    super({
      id: 'my_agent',
      name: 'My Agent',
      role: 'Does something cool',
      tier: 'specialized',
      description: 'Detailed description',
      capabilities: ['capability_1', 'capability_2'],
      icon: 'Sparkles',
      color: '#10b981',
    });
  }

  async execute(ctx: AgentExecutionContext): Promise<any> {
    const data = ctx.fileContents;
    // ... your logic
    return {
      status: 'completed',
      confidence: 0.9,
      summary: 'What I did',
      // ... your output
    };
  }
}
```

2. Register in `src/lib/agents/index.ts`:
```typescript
import { MyAgent } from './myAgent';
// Add to the instances array
new MyAgent(),
```

3. Add to the DAG in `src/lib/agents/executor.ts`:
```typescript
my_agent: {
  agentId: 'my_agent',
  dependsOn: ['data_engineer'],  // whatever it needs
  stage: 2,
  timeoutMs: 30000,
},
```

4. (Optional) Add a standalone API route at `src/app/api/my-agent/route.ts`

That's it — the agent automatically appears in the gallery, runs in the pipeline, and gets its own progress chip in the DAG visualizer.

---

## License

MIT — see [LICENSE](LICENSE)

## Acknowledgments

- Built on the original IntelliFlow v2 (Python/Flask) by Victor Ndunda
- Inspired by Google ADK multi-agent patterns
- Paystack for African payment infrastructure
- The open-source community for React, Next.js, Prisma, Tailwind, shadcn/ui, Recharts, and Framer Motion

---

**Built with intent. Shipped with care.**
