# Busara AI — Self-Evolving Multi-Agent Data Intelligence Platform

> *Busara* (Swahili for *intelligence*) is a multi-agent data analysis platform where **33 AI agents** run a 7-stage pipeline (Ingest → Engineer → Detect → Forecast → Infer → Cluster → Report) and **learn from every execution** via a trajectory-based self-evolution system inspired by the [AReaL paper](https://arxiv.org/abs/2607.01120).

[![License: MIT](https://img.shields.io/badge/License-MIT-blue)](LICENSE)
[![Node: 20+](https://img.shields.io/badge/Node.js-20%2B-339933)](https://nodejs.org)
[![pnpm: 8+](https://img.shields.io/badge/pnpm-8%2B-f69220)](https://pnpm.io)
[![Turborepo](https://img.shields.io/badge/Turborepo-2.0-000000)](https://turbo.build/repo)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6)](https://typescriptlang.org)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org)
[![Tests](https://img.shields.io/badge/Tests-18%20passing-brightgreen)](#tests)

---

## What makes Busara different

Most agent platforms are **static** — agents are frozen at deployment, and any improvement requires manual code changes. Busara implements the three pillars from the AReaL paper (arXiv:2607.01120) to make agents **self-evolving**:

| Pillar | What it does | Where it lives |
|---|---|---|
| **1. Trajectory Data Protocol** | Captures every agent execution as a step-level trajectory with causal links, LLM calls, tool calls, and rewards | `packages/agents/src/trajectory/recorder.ts` |
| **2. Data Proxy** | Filters production trajectories into governed learning substrates — PII scrubbing, quality scoring, deduplication | `packages/agents/src/trajectory/dataProxy.ts` |
| **3. Evolution Control Plane** | Automatically detects drift, optimizes configs, promotes/demotes agent stability, schedules fine-tuning | `packages/agents/src/trajectory/evolution.ts` |

Plus, from related research:
- **Verification Gates** (from [Verified Multi-Agent Orchestration](https://arxiv.org/abs/2603.07811)) — validate agent output before passing to downstream agents, with automatic replanning on failure
- **Reward Models** (from [DeepEval](https://confident-ai.com)/[LangSmith](https://smith.langchain.com)) — automatically score agent output quality using heuristics or LLM-as-judge
- **Guardrails** (from [NeMo Guardrails](https://github.com/NVIDIA/NeMo-Guardrails)) — defend against prompt injection and PII leakage
- **OpenTelemetry GenAI export** — trajectories are exportable in the OTel v1.37+ standard for interoperability with Langfuse, Arize, Phoenix, MLflow

## Quick start

```bash
git clone https://github.com/gadda00/IntelliFlow.git busara
cd busara
git checkout revolution
pnpm install
cp .env.example .env.local
# Edit .env.local — set DATABASE_URL, DIRECT_URL, JWT_SECRET (32+ chars), DATA_SOURCE_ENCRYPTION_KEY (64 hex chars)
pnpm db:generate
pnpm db:push
pnpm typecheck   # 7/7 packages pass
pnpm --filter @busara/agents test  # 18 tests pass
pnpm dev:web     # http://localhost:3000
```

## The 33 agents

| Stage | # | Agents |
|---|---|---|
| **0. Ingest** | 5 | DataIngestion, SchemaInference, DataProfiler, DataQuality, PrivacyScan |
| **1. Engineer** | 5 | DataCleaner, DataTransformer, DataEngineer, FeatureEngineer, MissingValueImputer |
| **2. Detect** | 12 | AnalysisStrategist, AnomalySentinel, ForecastingOracle, CausalArchitect, KnowledgeGraphBuilder, AutoML, Benchmark, CorrelationHunter, OutlierExplanation, BiasDetector, GeoPattern, Segmentation |
| **3. Forecast** | 3 | TrendDetector, SeasonalityDetector, TimeSeriesDecomposition |
| **4. Infer** | 3 | ABTestSignificance, SurvivalAnalysis, CohortAnalysis |
| **5. Cluster** | 2 | ClusterProfiler, FunnelAnalysis |
| **6. Report** | 3 | InsightSummarizer, Recommendation, NaturalLanguageQuery |

Real statistics, not LLM slop — Holt-Winters, Kaplan-Meier, Cox PH, Mann-Kendall, Cooley-Tukey FFT, regularized incomplete beta function, and more. See `packages/agents/src/agents/` for source.

## Architecture

```
packages/
  core/              # Shared types, errors, validation (Zod v4), utils
  agents/            # 33-agent framework + trajectory/evolution system
    src/
      agents/        # 33 agents across 7 stage directories
      trajectory/    # AReaL paper implementation
        types.ts           # Pillar 1: Trajectory, TrajectoryStep, RewardSignal
        recorder.ts        # Runtime trajectory capture
        store.ts           # InMemory + Prisma persistence
        dataProxy.ts       # Pillar 2: PII scrub, quality score, dedup
        evolution.ts       # Pillar 3: drift detection, config optimization
        verification.ts    # Verification gates + replanning
        rewardModel.ts     # Heuristic + LLM-judge reward models
        guardrails.ts      # Prompt injection + PII leakage defense
        otel.ts            # OpenTelemetry GenAI v1.37+ export
        agentWrapper.ts    # withTrajectory() — wraps any agent
      math.ts         # Statistical functions (mean, median, FFT, matrixInverse, etc.)
      core.ts          # BaseAgent, AgentBuilder, AgentExecutionContext
      orchestrator.ts  # DAGOrchestrator, SmartCache, CircuitBreaker
  ui/                # Shared UI primitives

apps/
  web/               # Next.js 15 app
    src/
      app/
        api/v2/       # Modern API (agents, analyze, trajectory, evolution, templates, orgs)
        analyze-v2/   # Analysis wizard (Upload → Configure → Pipeline → Results)
        agents/       # Agent gallery
      components/v2/  # Wizard components
      hooks/          # useV2Stream (SSE), etc.
      lib/
        security/     # AES-GCM crypto, SSRF-safe fetch, env assertion
        middleware/   # Upstash rate limiting
        observability/ # Langfuse tracing
        api/          # Standardized response helpers + deprecation proxies

prisma/
  schema.prisma      # User, Organization, Workspace, DataSource, Analysis, Trajectory, EvolutionAction
```

## The self-evolution system

### How trajectories work

Every agent execution is wrapped by `TrajectoryRecorder`:

```typescript
import { withTrajectory, InMemoryTrajectoryStore } from '@busara/agents';

const store = new InMemoryTrajectoryStore();
const wrappedAgent = withTrajectory(agent, {
  store,
  analysisId: 'analysis-123',
  userId: 'user-456',
});

const result = await wrappedAgent.execute(ctx);
// Trajectory is automatically recorded with:
//   - Step-level observation/action/LLM call/tool call/result
//   - Causal links between steps
//   - Context snapshot (config hash, system prompt, DAG context)
//   - Metadata (dataframe hash, row count, PII detection)
//   - Metrics (duration, tokens, cost, errors, retries)
```

### How rewards work

Rewards can be explicit (user feedback) or automated (reward model):

```typescript
import { 
  createExplicitReward, 
  HeuristicRewardModel, 
  LLMJudgeRewardModel, 
  scoreAndReward 
} from '@busara/agents';

// Explicit reward (user thumbs up)
await store.addReward(trajectoryId, createExplicitReward('user_thumbs_up', 1.0));

// Automated reward (heuristic model)
const model = new HeuristicRewardModel();
const { score } = await scoreAndReward(trajectory, model);
// Reward is automatically added to the trajectory
```

### How evolution works

The `EvolutionControlPlane` analyzes trajectory statistics and proposes actions:

```typescript
import { EvolutionControlPlane } from '@busara/agents';

const controlPlane = new EvolutionControlPlane(store);
const actions = await controlPlane.analyze('anomaly_sentinel');

// Returns actions like:
//   { type: 'PROMOTE_STABILITY', confidence: 0.85, reason: '...' }
//   { type: 'OPTIMIZE_CONFIG', suggestedChange: { sensitivity: 'medium' } }
//   { type: 'FLAG_DRIFT', confidence: 0.72 }
//   { type: 'SCHEDULE_FINE_TUNE', confidence: 0.6 }
```

Actions are human-in-the-loop — they're suggestions until a human approves them via `POST /api/v2/evolution`.

### How verification works

Verification gates validate agent output before passing to downstream agents:

```typescript
import { 
  SchemaVerificationGate, 
  StatisticalSanityGate, 
  executeWithVerification 
} from '@busara/agents';

const result = await executeWithVerification(agent, ctx, {
  gates: [new SchemaVerificationGate(outputSchema), new StatisticalSanityGate()],
  maxRetries: 3,
});

// If verification fails:
//   Attempt 1 → RETRY (transient errors)
//   Attempt 2 → RETRY_ADJUSTED (lower sensitivity, etc.)
//   Attempt 3 → SKIP (continue pipeline without this agent)
```

## API

### v2 API (modern)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v2/agents` | List all 33 agents (filter by stage/tier/stability) |
| GET | `/api/v2/stages` | Get the 7-stage DAG |
| GET | `/api/v2/templates` | List 8 analysis templates |
| POST | `/api/v2/analyze` | Execute a single agent |
| POST | `/api/v2/analyze-stream` | SSE streaming pipeline execution |
| GET | `/api/v2/trajectory` | Query trajectories |
| GET | `/api/v2/trajectory/:id` | Get a single trajectory |
| POST | `/api/v2/trajectory/:id/reward` | Add a reward signal |
| GET | `/api/v2/trajectory/agent/:agentId/stats` | Agent trajectory statistics |
| GET | `/api/v2/evolution` | Get evolution actions |
| POST | `/api/v2/evolution` | Approve/reject/apply actions |
| POST | `/api/v2/orgs` | Create organization |
| GET | `/api/v2/orgs` | List my orgs |
| POST | `/api/v2/workspaces` | Create workspace |
| POST | `/api/v2/data-sources` | Register data source (AES-GCM encrypted) |

### Legacy API

Legacy `/api/*` routes are deprecated with RFC 8594 headers (Sunset: Sep 1, 2026). Single-agent routes proxy to `/api/v2/analyze`. See `MIGRATION.md` for details.

## Tests

```bash
pnpm --filter @busara/agents test
# 18 tests pass:
#   - TrajectoryRecorder (step recording, causal links, LLM calls, rewards)
#   - InMemoryTrajectoryStore (save, query, stats)
#   - DataProxy (PII scrubbing, quality scoring)
#   - EvolutionControlPlane (promotion detection)
#   - Verification Gates (schema validation)
#   - RewardModel (heuristic + composite scoring)
#   - Guardrails (prompt injection, PII leakage detection)
```

## Required environment variables

```bash
# Required (app fails to boot without)
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
JWT_SECRET=$(openssl rand -hex 32)
DATA_SOURCE_ENCRYPTION_KEY=$(openssl rand -hex 32)  # for DataSource.config encryption

# Recommended (graceful no-op if missing)
UPSTASH_REDIS_REST_URL=...         # rate limiting
UPSTASH_REDIS_REST_TOKEN=...
LANGFUSE_PUBLIC_KEY=...            # LLM observability
LANGFUSE_SECRET_KEY=...
WS_SERVER_SECRET=...               # WebSocket auth
WS_ALLOWED_ORIGINS=https://...
```

See `.env.example` for the full list.

## Documentation

- **[RESEARCH.md](./RESEARCH.md)** — Deep research on the AReaL paper + 7 related works
- **[EVOLUTION.md](./EVOLUTION.md)** — How the self-evolution system works
- **[DEVELOPMENT.md](./DEVELOPMENT.md)** — Local setup, scripts, conventions
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** — Deploy targets, env vars, mobile
- **[MIGRATION.md](./MIGRATION.md)** — Upgrading from pre-revolution codebase

## Research foundation

This implementation is based on deep research of:

1. **[AReaL paper](https://arxiv.org/abs/2607.01120)** — Next-Generation Agentic RL Systems Enable Self-Evolving Agents (Yan et al., 2026)
2. **[Self-Evolving Agents Survey](https://arxiv.org/abs/2507.21046)** — What, When, How, Where to Evolve (Gao et al., 2026)
3. **CLaaS** — Continual Learning as a Service
4. **Verified Multi-Agent Orchestration** — Plan-Execute-Verify-Replan
5. **OpenTelemetry GenAI semantic conventions** v1.37+
6. **NeMo Guardrails** — Agent safety
7. **DeepEval / LangSmith** — Agent evaluation
8. **LangGraph / Mastra / Inngest** — Orchestration patterns

See `RESEARCH.md` for the full research brief.

## Status

| Component | Status |
|---|---|
| 33 agents (7 stages) | ✅ Done |
| Trajectory data protocol (Pillar 1) | ✅ Done |
| Data proxy (Pillar 2) | ✅ Done |
| Evolution control plane (Pillar 3) | ✅ Done |
| Verification gates + replanning | ✅ Done |
| Reward models (heuristic + LLM judge) | ✅ Done |
| Guardrails (prompt injection + PII) | ✅ Done |
| OTel GenAI v1.37+ export | ✅ Done |
| v2 API (agents, analyze, trajectory, evolution, orgs) | ✅ Done |
| v2 wizard UI | ✅ Done |
| Multi-tenant workspaces | ✅ Done |
| AES-GCM DataSource encryption | ✅ Done |
| 18 tests passing | ✅ Done |
| LLM gateway proxy (zero-code trajectory capture) | ⏳ Planned |
| Checkpointing + resume | ⏳ Planned |
| Episodic memory | ⏳ Planned |
| Playwright e2e tests | ⏳ Planned |

## License

MIT © Victor Ndunda
