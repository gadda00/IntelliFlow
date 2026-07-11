# Busara AI — Self-Evolving Multi-Agent Data Intelligence Platform

> *Busara* (Swahili for *intelligence*) is a production-grade multi-agent data analysis platform where **50 AI agents** run a 7-stage DAG pipeline (Ingest → Engineer → Detect → Forecast → Infer → Cluster → Report) and **learn from every execution** via a trajectory-based self-evolution system inspired by the [AReaL paper](https://arxiv.org/abs/2607.01120).

[![License: MIT](https://img.shields.io/badge/License-MIT-blue)](LICENSE)
[![Node: 20+](https://img.shields.io/badge/Node.js-20%2B-339933)](https://nodejs.org)
[![pnpm: 8+](https://img.shields.io/badge/pnpm-8%2B-f69220)](https://pnpm.io)
[![Turborepo](https://img.shields.io/badge/Turborepo-2.0-000000)](https://turbo.build/repo)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6)](https://typescriptlang.org)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org)
[![Tests](https://img.shields.io/badge/Tests-18%20passing-brightgreen)](#tests)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-black)](https://vercel.com)

---

## What makes Busara different

Busara is **not a wrapper around ChatGPT**. It implements real statistical algorithms from scratch — Holt-Winters triple exponential smoothing, OLS regression via normal equations, K-Means++ with silhouette scoring, proper Isolation Forest with recursive path lengths, Gaussian Mixture Models with full covariance EM, Augmented Dickey-Fuller tests with MacKinnon critical values, Granger causality, and more.

### Key differentiators vs. Julius AI and other competitors

| Feature | Julius AI | Busara AI |
|---------|-----------|-----------|
| **Reproducibility** | ❌ Different results on re-run | ✅ Seeded PRNG — same data + same params = identical result |
| **Agent count** | 1 agent | 50 agents across 7 stages |
| **Statistical math** | LLM-generated | ✅ Real algorithms (Holt-Winters, OLS, K-Means++, ADF, GMM) |
| **Data sufficiency gating** | ❌ Fabricates on sparse data | ✅ Warns when data is insufficient |
| **Insight layer** | LLM-only | ✅ Rule-based + LLM narrative (hybrid) |
| **Metric translation** | Raw stats | ✅ RMSE→"±X units off", R²→"explains X%" |
| **Export** | Limited | ✅ JSON, CSV, PDF (print-styled) |
| **Preset filtering** | N/A | ✅ Quick/Forecast/Anomaly presets run focused agent subsets |
| **Data transformation** | N/A | ✅ Engineer agents mutate shared dataframe between stages |
| **Notifications** | N/A | ✅ Slack, email, webhook alerts |

## The 50 agents

| Stage | # | Agents |
|---|---|---|
| **0. Ingest** | 10 | DataIngestion, SchemaInference, DataProfiler, MissingValueAnalyzer, CardinalityChecker, DuplicateDetector, DataQualityScorer, PIIDetection, TextLengthProfiler, NLQInterpreter |
| **1. Engineer** | 10 | DataCleaner, MedianImputation, ModeImputation, StandardScaler, MinMaxScaler, OutlierDetector, FeatureEngineering, TextNormalizer, DuplicateReporter, TypeCoercion, DataSampling |
| **2. Detect** | 12 | AnomalyEnsemble, IsolationForest, KMeansCluster, DBSCANCluster, GaussianMixture, FraudDetection, SentimentAnalysis, CorrelationMatrix, StationarityTester, SeasonalityDetector, KnowledgeGraph, AfricaMarketIntel |
| **3. Forecast** | 5 | HoltWintersForecast, AutoregressiveForecast, MovingAverageForecast, AnomalyForecasting, TrendDetector |
| **4. Infer** | 5 | OLSRegression, CausalInference, FeatureImportance, FeatureContribution, ModelComparison |
| **5. Cluster** | 2 | ClusterProfiler, FunnelAnalysis |
| **6. Report** | 6 | InsightGenerator, NarrativeComposer, CodeGenerator, VisualizationAgent, SyntheticDataGenerator, ReflectionAgent, RealtimeAlert, Orchestrator |

## Architecture

```
apps/web/                    # Next.js 15 web application
  src/
    app/                     # App router pages + API routes
      api/v7/analyze-stream/ # SSE streaming analysis endpoint
      api/notifications/     # Email alert endpoint
      api/proxy-url/         # SSRF-safe URL fetch proxy
    components/
      v7/                    # v7 wizard (AnalyzePage, UploadStep, ConfigureStep, PipelineStep, ResultsStep)
      busara/                # Shared components (Header, Footer, PipelineVisualizer)
      dashboard/             # Dashboard components
    hooks/                   # useV7Analysis, useAgentStream
    lib/
      agents/v7/             # 50-agent framework
        implementations/     # All agent implementations
        orchestrator.ts      # DAG orchestrator with transformed data propagation
        registry.ts          # Agent registry
        math.ts              # Statistical functions
        seededRandom.ts      # Reproducible PRNG (mulberry32)
        isolationForest.ts   # Real Isolation Forest
        gmm.ts               # Real GMM with EM algorithm
        adfTest.ts           # Real ADF test with MacKinnon critical values
      ai/narrative.ts        # LLM-powered narrative generation
      analysis/history.ts    # Analysis history persistence
      notifications/alerts.ts # Alert notifications (Slack, email, webhook)
      parsers-client.ts      # CSV/JSON/TSV parser with BOM + duplicate handling

packages/
  core/              # Shared types, errors, validation (Zod v4), utils
  agents/            # Agent framework + trajectory/evolution system
  ui/                # Shared UI components
  cli/               # Command-line interface
  eslint-config/     # Shared ESLint config

prisma/
  schema.prisma      # PostgreSQL schema (Supabase) with AgentMetric (RMSE, MAE, etc.)
```

## Quick start

```bash
git clone https://github.com/gadda00/IntelliFlow.git busara
cd busara
pnpm install
cp .env.example .env.local
# Edit .env.local — set DATABASE_URL, DIRECT_URL, JWT_SECRET, DATA_SOURCE_ENCRYPTION_KEY
pnpm db:generate
pnpm db:push
pnpm dev:web     # http://localhost:3000
```

## Deployment

### Vercel (recommended)

Busara is configured for Vercel out of the box:

1. Push to GitHub
2. Import project in Vercel
3. Set environment variables (see `.env.example`)
4. Deploy

**Configuration files:**
- `vercel.json` — build command, output directory, framework
- `.vercelignore` — excludes tests, docs, e2e from deployment
- `maxDuration = 300` on analyze API (5-minute timeout for large datasets)

### Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string (Supabase pooler) |
| `DIRECT_URL` | ✅ | PostgreSQL direct connection (for migrations) |
| `JWT_SECRET` | ✅ | JWT signing secret (32+ chars) |
| `DATA_SOURCE_ENCRYPTION_KEY` | ✅ | AES-256 encryption key (64 hex chars) |
| `NEXT_PUBLIC_APP_URL` | ❌ | Public URL for the app |
| `ALERT_EMAIL_TO` | ❌ | Email address for alert notifications |
| `EMAIL_API_KEY` | ❌ | Resend/SendGrid API key for email alerts |
| `EMAIL_SERVICE` | ❌ | Email service: `resend` (default) or `sendgrid` |
| `EMAIL_FROM` | ❌ | From email address |
| `SLACK_WEBHOOK_URL` | ❌ | Slack incoming webhook URL for alerts |
| `ALERT_WEBHOOK_URL` | ❌ | Generic webhook URL for alerts |

## Key features

### Data analysis
- **50-agent DAG pipeline** with parallel execution within stages
- **Real statistical math** — not LLM-generated approximations
- **Reproducible results** — seeded PRNG ensures same data + same params = identical output
- **Data transformation pipeline** — engineer agents (scalers, imputation, outlier removal) actually mutate the shared dataframe for downstream stages
- **Preset filtering** — Quick Insights, Forecast Focus, Fraud & Anomaly presets run focused agent subsets
- **Data sufficiency gating** — warns when data is too sparse for reliable results

### Results
- **Conclusion-first layout** — bold one-sentence answer before metrics
- **So What + Action** — every result card has Observation → So What → Recommended Action
- **Metric translation** — RMSE→"±X units off", R²→"explains X%", p-value→"X% confident"
- **Real charts** — forecast line charts with confidence intervals, scatter plots, bar charts, pie charts
- **AI-powered narrative** — LLM generates dataset-specific executive summaries (not Mad-Libs templates)
- **Suggested follow-up questions** — auto-generated, context-aware next steps
- **Persona-switched presentation** — executive (KPIs), manager (drill-downs), analyst (raw data)

### Security & reliability
- **Input validation** — zod-style schema on all API endpoints
- **Rate limiting** — 10 analyses/minute per IP
- **SSRF protection** — URL proxy blocks localhost and private IPs
- **Cancellation** — AbortSignal propagated from client to orchestrator
- **5-minute timeout** — handles 50k-row datasets

### Export & integration
- **JSON export** — full analysis results as downloadable JSON
- **CSV export** — anomaly table as CSV
- **PDF export** — print-styled output with proper page breaks
- **Analysis history** — recent analyses saved to localStorage
- **Slack/email/webhook alerts** — real-time notifications for anomalies and thresholds

## Contact

**Victor Ndunda** — AI Engineer & Founder
- GitHub: [@gadda00](https://github.com/gadda00)
- LinkedIn: [victor-ndunda](https://www.linkedin.com/in/victor-ndunda)
- Email: mututandunda@gmail.com

---

Built in Nairobi, Kenya 🇰🇪
