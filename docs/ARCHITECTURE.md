# Busara Architecture

This document describes the high-level architecture of the Busara multi-agent data intelligence platform: the monorepo layout, what each package does, how data flows through the system, and the key design decisions that shape the codebase.

> **Read this first if** you're new to the codebase and want to understand how the pieces fit together before diving into a specific package.

---

## 1. Monorepo layout

Busara is a [pnpm](https://pnpm.io/) + [Turborepo](https://turbo.build/repo) monorepo. Everything lives in one Git repository so cross-package refactors, atomic releases, and shared tooling stay easy.

```
busara/
├── apps/
│   └── web/                          # Next.js 15 app — the Busara UI + HTTP API
│       ├── src/
│       │   ├── app/                  # App Router: pages + API routes
│       │   │   ├── api/v2/           # Modern API (analyze, trajectory, evolution)
│       │   │   ├── api/v7/           # Newest API (agents metadata)
│       │   │   ├── api/              # Legacy v1 routes (still supported)
│       │   │   └── analyze/          # Analysis wizard pages
│       │   ├── components/           # React components (shadcn/ui + Busara-specific)
│       │   ├── hooks/                # React hooks (useAgentStream, useV7Analysis, ...)
│       │   └── lib/                  # Server-side libs (db, auth, trajectory, mcp, ...)
│       └── public/                   # Static assets (logo, manifest, icons)
│
├── packages/
│   ├── core/                         # @busara/core — shared types, constants, validation, errors
│   │   └── src/{types,constants,utils,errors,validation}.ts
│   │
│   ├── agents/                       # @busara/agents — the 33-agent framework + AReaL pillars
│   │   └── src/
│   │       ├── core.ts               # BaseAgent, EnhancedAgentMetadata, AgentExecutionContext
│   │       ├── orchestrator.ts       # DAGOrchestrator, SmartCache, CircuitBreaker
│   │       ├── registry.ts           # AgentRegistry (register/filter/discover)
│   │       ├── agents.ts             # AgentPool — auto-discovers all agent classes
│   │       ├── math.ts               # Statistical functions (mean, FFT, matrixInverse, etc.)
│   │       ├── errors.ts             # AgentError, AgentTimeoutError, etc.
│   │       ├── validation.ts         # Zod-based validation helpers
│   │       ├── agents/               # 33 agent implementations, organised by stage
│   │       │   ├── ingest/           # Stage 0 — data_ingestion, schema_inference, ...
│   │       │   ├── engineer/         # Stage 1 — data_cleaner, feature_engineer, ...
│   │       │   ├── detect/           # Stage 2 — anomaly_sentinel, forecasting_oracle, ...
│   │       │   ├── forecast/         # Stage 3 — (planned)
│   │       │   ├── infer/            # Stage 4 — (planned)
│   │       │   ├── cluster/          # Stage 5 — (planned)
│   │       │   └── report/           # Stage 6 — (planned)
│   │       └── trajectory/           # AReaL paper implementation (see §4)
│   │           ├── types.ts          # Pillar 1: Trajectory, TrajectoryStep, RewardSignal
│   │           ├── recorder.ts       # Runtime trajectory capture
│   │           ├── store.ts          # InMemory + Prisma persistence
│   │           ├── agentWrapper.ts   # withTrajectory() — wraps any BaseAgent
│   │           ├── dataProxy.ts      # Pillar 2: PII scrub, quality score, dedup
│   │           ├── evolution.ts      # Pillar 3: drift detection, config optimization
│   │           ├── verification.ts   # Verification gates + replanning
│   │           ├── rewardModel.ts    # Heuristic + LLM-judge reward models
│   │           ├── guardrails.ts     # Prompt injection + PII leakage defense
│   │           └── otel.ts           # OpenTelemetry GenAI v1.37+ export
│   │
│   ├── cli/                          # @busara/cli — the `busara` terminal command
│   │   └── src/
│   │       ├── index.ts              # CLI entry (commander.js)
│   │       ├── commands/             # agents, analyze, templates, trajectory, evolution, serve, init, config
│   │       ├── lib/                  # client (HTTP+SSE), config (~/.busara/), output (tables, JSON, colors)
│   │       └── templates/project/    # Scaffolding for `busara init`
│   │
│   ├── ui/                           # @busara/ui — shared UI primitives (cn helper, types)
│   └── eslint-config/                # Shared ESLint config
│
├── prisma/
│   ├── schema.prisma                 # Production schema (Postgres)
│   └── schema.dev.prisma             # Dev schema (SQLite for fast local iteration)
│
├── docs/                             # Developer docs (you are here)
├── scripts/                          # Build scripts (icons, Android build)
├── turbo.json                        # Turborepo task graph
├── pnpm-workspace.yaml               # Workspace definition
├── eslint.config.mjs                 # Root ESLint config (flat config)
└── tsconfig.json                     # Root TypeScript config
```

---

## 2. Package responsibilities

### `@busara/core`

The foundation. Everything else depends on this. Contains:

- **`types.ts`** — `AgentMetadata`, `AgentContext`, `AgentResult`, `User`, `Analysis`, `Workspace`, `Organization`, and 50+ other shared types
- **`constants.ts`** — app version, API endpoints, agent stages/tiers/stabilities, default retry policy, rate limits
- **`validation.ts`** — Zod schemas for common entities
- **`errors.ts`** — base error classes (`BusaraError`, `ValidationError`, `AuthError`, ...)
- **`utils.ts`** — pure helpers (date formatting, ID generation, deep merge)

No business logic. No I/O. Pure types and functions.

### `@busara/agents`

The agent framework. Two halves:

1. **The agent framework** — `BaseAgent`, `AgentRegistry`, `AgentPool`, `DAGOrchestrator`. This is what runs the 7-stage pipeline.
2. **The trajectory system** (`src/trajectory/`) — implements the three AReaL paper pillars (see §4). Self-evolution infrastructure.

### `@busara/web`

The Next.js app. Hosts both the UI and the HTTP API. The API routes under `src/app/api/v2/` are the modern entry points — they use `@busara/agents` directly and wire in trajectory recording.

### `@busara/cli`

The terminal tool. Talks to the API over HTTP. Standalone — only depends on `commander`. Used for local development, scripting, and CI.

### `@busara/ui`

Shared React components. Currently minimal (`cn` helper, types). Will grow as the design system matures.

### `eslint-config-busara`

Shared ESLint rules. Imported by every package's `eslint.config.mjs`.

---

## 3. Data flow

### 3.1 A single agent run

```
            ┌─────────────────┐
            │   busara CLI    │
            │  (or browser)   │
            └────────┬────────┘
                     │
                     │ POST /api/v2/analyze
                     │   { agentId, dataframe, config }
                     ▼
            ┌─────────────────┐
            │  Next.js API    │  apps/web/src/app/api/v2/analyze/route.ts
            │  route handler  │
            └────────┬────────┘
                     │
                     │ 1. getAgent(agentId) from AgentPool
                     │ 2. withTrajectory(agent, store, ctx)  ← wraps the agent
                     │ 3. wrappedAgent.execute(ctx)
                     ▼
            ┌─────────────────┐
            │  BaseAgent      │  packages/agents/src/agents/<stage>/<Name>Agent.ts
            │  .execute()     │
            └────────┬────────┘
                     │
                     │ - validate input (Zod)
                     │ - run computation
                     │ - validate output (Zod)
                     │ - record TrajectoryStep(s)
                     │
                     ▼
            ┌─────────────────┐
            │ TrajectoryStore │  packages/agents/src/trajectory/store.ts
            │   (Prisma or    │  ← persists trajectory (steps + rewards)
            │    InMemory)    │
            └────────┬────────┘
                     │
                     │ returns { ok, analysisId, trajectoryId, result }
                     ▼
            ┌─────────────────┐
            │   HTTP response │
            └─────────────────┘
```

### 3.2 The full pipeline (multiple agents, SSE stream)

```
browser ─POST /api/v2/analyze-stream─▶ Next.js
                                        │
                                        │ for each agentId in request:
                                        │   1. wrap with withTrajectory()
                                        │   2. agent.execute(ctx)
                                        │   3. SSE event: agent_start / agent_complete
                                        │   4. store trajectory
                                        │
                                        ▼
                                    SSE stream
                                    (event: agent_start, agent_complete, complete, error)
```

The streaming endpoint executes agents sequentially, passing each agent's output to the next via the `previousResults` map. Every execution is recorded as its own trajectory (one trajectory = one agent execution).

### 3.3 The self-evolution feedback loop

```
   ┌───────────────────┐
   │  Agent execution  │  ← produces trajectory (steps + reward)
   └─────────┬─────────┘
             │
             ▼
   ┌───────────────────┐
   │ TrajectoryStore   │  ← stores every execution
   └─────────┬─────────┘
             │
             ▼
   ┌───────────────────┐         ┌──────────────────────┐
   │  Evolution        │ ◀────── │  RewardModel         │
   │  Control Plane    │         │  (heuristic + LLM)   │
   └─────────┬─────────┘         └──────────────────────┘
             │
             │ suggests actions:
             │   PROMOTE_STABILITY, OPTIMIZE_CONFIG, FLAG_DRIFT, ...
             ▼
   ┌───────────────────┐
   │  Human approval   │  ← busara evolution approve
   └─────────┬─────────┘
             │
             ▼
   ┌───────────────────┐
   │  Updated agent    │  ← config defaults, stability tier, prompt, ...
   └───────────────────┘
```

---

## 4. The AReaL paper — three pillars

Busara implements the three pillars from ["Next-Generation Agentic Reinforcement Learning Systems Enable Self-Evolving Agents"](https://arxiv.org/abs/2607.01120) (Yan et al., 2026):

### Pillar 1 — Standardized trajectory data protocol

**File:** `packages/agents/src/trajectory/types.ts`, `recorder.ts`, `store.ts`

A `Trajectory` is the complete, step-level record of one agent execution. It captures:

- **Context snapshot** — dataframe hash, config hash, agent version, stability tier
- **Steps** — ordered list of `{ observation, action, result, causalLinks }`
- **Rewards** — explicit (user thumbs up/down) or implicit (return, share, cite)
- **Metadata** — for dedup, governance, replay

Every agent execution — whether from the web UI, the CLI, or another agent — produces a trajectory. Trajectories are the substrate on which everything else operates.

### Pillar 2 — Enterprise-grade data proxy

**File:** `packages/agents/src/trajectory/dataProxy.ts`

The data proxy filters production trajectories into governed learning substrates:

- **PII scrubbing** — detects and redacts email addresses, phone numbers, SSNs, credit card numbers, etc.
- **Quality scoring** — assigns each trajectory a 0-1 quality score based on completion, validation, and reward signals
- **Deduplication** — removes near-duplicate trajectories (same dataframe hash + config hash + agent version)
- **Export audit** — every export is logged with who, what, when, and why

This is what lets Busara safely use production data for fine-tuning and benchmarking.

### Pillar 3 — Unified agent evolution control plane

**File:** `packages/agents/src/trajectory/evolution.ts`

The control plane automatically inspects trajectory statistics and **suggests** evolution actions:

- **Drift detection** — is an agent's output distribution changing over time?
- **Auto-promotion** — promote agents from `experimental → beta → stable` based on success rate + reward
- **Config optimization** — suggest new default config values based on which configs earn the highest rewards
- **A/B testing** — route traffic to experimental configs
- **Fine-tune scheduling** — flag agents whose error rate is climbing and might benefit from a fine-tune

All actions are **suggestions until a human approves them** — the CLI's `busara evolution approve` command is the human-in-the-loop interface.

### Bonus pillars (from related research)

- **Verification Gates** (from [Verified Multi-Agent Orchestration](https://arxiv.org/abs/2603.07811)) — `trajectory/verification.ts`. Validate agent output before passing to downstream agents. Replan automatically on failure.
- **Reward Models** (from [DeepEval](https://confident-ai.com) / [LangSmith](https://smith.langchain.com)) — `trajectory/rewardModel.ts`. Heuristic + LLM-as-judge scoring.
- **Guardrails** (from [NeMo Guardrails](https://github.com/NVIDIA/NeMo-Guardrails)) — `trajectory/guardrails.ts`. Defend against prompt injection and PII leakage.
- **OpenTelemetry GenAI export** — `trajectory/otel.ts`. Trajectories are exportable in the OTel v1.37+ standard for interoperability with Langfuse, Arize, Phoenix, MLflow.

---

## 5. Key design decisions

### 5.1 Why a monorepo?

Busara has tight coupling between the agent framework, the web app that hosts it, and the CLI that drives it. A monorepo lets us:

- Make atomic changes across packages (e.g. adding a new agent + the API route that exposes it + the CLI command that calls it — all in one PR)
- Share types end-to-end (`@busara/core` types flow from the agent → the API response → the CLI)
- Run cross-package tests in CI without publishing private packages

### 5.2 Why pnpm + Turborepo?

- **pnpm** — strict node_modules (no phantom deps), fast installs, workspaces built-in. The repo enforces pnpm via a `preinstall` hook.
- **Turborepo** — task graph + caching. `pnpm typecheck` runs all 7+ packages' typecheck in parallel, with remote caching for CI.

### 5.3 Why Zod everywhere?

Every agent declares `inputSchema`, `outputSchema`, and `configSchema` as Zod schemas. This means:

- Inputs are validated before `execute()` runs — agents can assume their inputs are well-formed
- Outputs are validated before they're passed to downstream agents — verification gates
- The CLI can fetch an agent's config schema and show it to the user (`busara agents info <id>`)
- The web UI can render a config form from the schema

### 5.4 Why trajectories (not just logs)?

Logs are write-only — you can read them, but you can't query, score, or replay them. Trajectories are structured:

- Queryable by agent, user, time range, status, reward
- Scoreable by reward models (heuristic + LLM)
- Replayable — given a trajectory, you can re-execute the agent with the same context and compare
- Exportable — to OTel, to a fine-tuning dataset, to a dashboard

### 5.5 Why human-in-the-loop evolution?

Auto-evolving agents in production is dangerous — a bad config update can regress every analysis. So the Evolution Control Plane only **suggests** actions; a human has to approve them via the CLI or the web UI. Every action is logged with its rationale and can be rolled back.

### 5.6 Why is the CLI a separate package (not a script in `apps/web`)?

Three reasons:

1. **Dependency surface** — the CLI only depends on `commander`. It doesn't need React, Next.js, Prisma, or any of the web app's 80+ deps. Keeping it separate means `pnpm install` for the CLI alone is fast.
2. **Distribution** — eventually `npm install -g @busara/cli` should work without cloning the monorepo. A separate package makes that possible.
3. **Coupling** — the CLI talks to the API over HTTP. It has no business importing `@busara/agents` directly. Keeping it separate enforces that boundary.

### 5.7 Why CommonJS for the CLI, ESM for everything else?

The CLI needs to run via a `#!/usr/bin/env node` shebang on any Node 18+ install. CommonJS has the best out-of-the-box compatibility for that. The agents and core packages use ESM (`NodeNext`) because they're consumed by the Next.js app which is ESM-native.

### 5.8 Why is `@busara/agents` not in strict mode?

Historical — the package predates the strict-mode decision. New files should be strict-compliant; the existing `strict: false` setting is a concession to avoid a giant mechanical refactor. Tightening it is on the roadmap.

---

## 6. Where things live (quick lookup)

| I want to... | Look in |
|---|---|
| Add a new agent | `packages/agents/src/agents/<stage>/` (see `docs/AGENTS.md`) |
| Add a new API route | `apps/web/src/app/api/v2/<route>/route.ts` |
| Add a new CLI command | `packages/cli/src/commands/<name>.ts` |
| Change the database schema | `prisma/schema.prisma` (then `pnpm db:migrate`) |
| Add a shared type | `packages/core/src/types.ts` |
| Add a shared constant | `packages/core/src/constants.ts` |
| Add a Zod validation | `packages/core/src/validation.ts` or the agent's own schemas |
| Add a new trajectory store backend | `packages/agents/src/trajectory/store.ts` |
| Add an evolution action type | `packages/agents/src/trajectory/evolution.ts` |
| Add a guardrail | `packages/agents/src/trajectory/guardrails.ts` |
| Add a reward model | `packages/agents/src/trajectory/rewardModel.ts` |

---

## 7. Further reading

- [`docs/AGENTS.md`](./AGENTS.md) — How to write a new agent
- [`docs/API_REFERENCE.md`](./API_REFERENCE.md) — Full HTTP API reference
- [`docs/DEPLOYMENT_CHECKLIST.md`](./DEPLOYMENT_CHECKLIST.md) — Pre-deployment checklist
- [`RESEARCH.md`](../RESEARCH.md) — The research papers that shaped the architecture
- [`EVOLUTION.md`](../EVOLUTION.md) — Deep dive on the Evolution Control Plane
- [`packages/cli/README.md`](../packages/cli/README.md) — CLI usage guide
