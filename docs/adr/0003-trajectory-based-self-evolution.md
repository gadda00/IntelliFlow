# ADR-0003: Trajectory-based self-evolution

## Status

Accepted

## Context

Most agent platforms are **static**: agents ship at version 1.0, and any
improvement requires a code change, a deploy, and a hope that the new
version doesn't regress. The AReaL paper
([arXiv:2607.01120](https://arxiv.org/abs/2607.01120), Yan et al., 2026)
argues that this is the central blocker for production-grade agentic
systems and identifies three missing pillars:

1. **No standardized trajectory data protocol.** Every team rolls their
   own log format. Logs are write-only — they can't be queried, scored,
   or replayed.
2. **No enterprise-grade data proxy.** Production traffic can't be
   safely converted into learning data — there's no PII scrubbing, no
   dedup, no audit trail.
3. **No unified evolution control plane.** Even when you have data, no
   system decides *when* to update policy weights or *when* to evolve
   the in-context harness. Decisions are ad-hoc and human.

Busara needed a way for its 33 agents to **learn from every execution**
without a separate fine-tuning pipeline, without manual config tweaks,
and without regressing in production. The system also had to be
**safe** — automatic evolution in production is dangerous.

## Decision

Implement the AReaL three-pillar architecture in
`packages/agents/src/trajectory/`:

### Pillar 1 — Trajectory Data Protocol

A `Trajectory` is the atomic unit of learning data. Every agent
execution — whether from the web UI, the CLI, or another agent —
produces one. It captures:

- **Context snapshot** — dataframe hash, config hash, agent version,
  stability tier, system prompt, DAG context (which prior agents'
  results were available).
- **Steps** — ordered list of `{observation, action, result,
  causalParentSteps, llmCall, toolCall, durationMs, reward}`. The
  causal links are critical: without them, credit assignment is
  impossible.
- **Rewards** — explicit (user thumbs up/down), implicit (returned,
  shared, cited), or automated (reward model). Rewards can accumulate
  over time — a user might come back 3 days later and rate the result.
- **Metadata** — dataframe hash (for dedup), row/column count, PII
  detected, PII scrubbed, tags.
- **Metrics** — total duration, step count, LLM call count, tokens,
  cost, tool call count, error count, retry count.

Stored via `TrajectoryStore` — `InMemoryTrajectoryStore` for dev,
`PrismaTrajectoryStore` for production. The store interface supports
`save`, `get`, `addReward`, `query`, `delete`, `getAgentStats`, and
`getRecentRewards`.

### Pillar 2 — Data Proxy

The `DataProxy` converts production trajectories into governed learning
substrates:

1. **Ingest** trajectories from the store via `TrajectoryQuery`.
2. **Filter** by agent success rate, reward presence, quality score.
3. **Scrub PII** — emails, phones, SSNs, credit cards, IPs, API keys
   are replaced with `[EMAIL]`, `[PHONE]`, etc. before export.
4. **Score quality** — weighted average of success (40%), efficiency
   (20%), richness (20%), reward (20%).
5. **Deduplicate** by `(dataframeHash, agentId, configHash)`. Keep the
   highest-reward trajectory per key.
6. **Export** as an `ExportedDataset` with stats and an audit entry
   (who, when, why, what was exported).

### Pillar 3 — Evolution Control Plane

The `EvolutionControlPlane` analyzes trajectory statistics and
**suggests** evolution actions:

- **Drift detection** — compare last-3-day success rate + reward to
  last-7-day baseline. If the delta exceeds 15%, flag with direction
  (improving / degrading).
- **Auto-promotion** — suggest `PROMOTE_STABILITY` when an agent has
  ≥100 trajectories, ≥90% success rate, and ≥0 average reward.
- **Auto-demotion** — suggest `DEMOTE_STABILITY` when success rate
  drops below 70%.
- **Config optimization** — for each config key, compare reward
  distribution across values. If a non-default value has higher reward
  with ≥3 occurrences, suggest `OPTIMIZE_CONFIG` with the new default.
- **Fine-tune scheduling** — when an agent has ≥500 trajectories with
  ≥50 positive and ≥50 negative rewards, suggest
  `SCHEDULE_FINE_TUNE`.
- **Deprecation** — suggest `DEPRECATE_AGENT` when success rate < 30%
  and average reward < −0.3 over ≥50 trajectories.

**All actions are suggestions.** They have a `status` of `pending`,
`approved`, `rejected`, `applied`, or `rolled_back`. A human reviews
them via the dashboard (`/dashboard/evolution`), the admin console
(`/admin/evolution`), or the CLI (`busara evolution approve`). Only
after approval is the action applied.

## Consequences

**Positive:**

- Every execution produces learning data — no separate fine-tuning
  pipeline needed.
- Trajectories are queryable, scoreable, replayable, and exportable
  (to OTel GenAI v1.37+, Langfuse, Arize, Phoenix, MLflow).
- The control plane surfaces problems (drift, low reward, high
  failure) automatically, instead of waiting for user complaints.
- Human-in-the-loop means we never auto-deploy a regression.
- The same trajectory data powers the reward model (heuristic + LLM
  judge), the verification gates, and the data proxy — no copy of the
  data per consumer.

**Negative:**

- Trajectory storage cost. A 100 000-row dataframe analysis produces
  ~50 trajectories, each with ~5 steps, each with ~1 LLM call. That's
  ~250 LLM-call records per analysis. Storage scales with usage. We
  mitigate with retention policies (the data proxy can purge old
  trajectories) and JSONB compression in Postgres.
- Privacy surface. Trajectories contain user prompts and LLM responses,
  which may contain PII. The data proxy scrubs PII before any export,
  but the raw store holds it. Access control on the store is critical.
- Recompute cost. In dev, the control plane re-analyzes every agent on
  each `GET /api/v2/evolution` request. For 33 agents × 500 trajectories
  each, that's noticeable. The fix is to persist evolution actions to
  a table and recompute on a schedule (every 5 minutes).
- The causal-link field is currently best-effort. The recorder fills it
  in based on which prior results the agent reads, but it can't see
  inside the agent's logic. True causal attribution requires the agent
  to declare its dependencies explicitly — which we encourage via the
  `dependencies` field in metadata.

## Alternatives Considered

- **Logs only.** What we had before. Logs are write-only; you can't
  query, score, or replay them. Trajectories are strictly more useful.
- **OpenTelemetry traces only.** OTel traces are great for observability
  but don't carry reward signals or context snapshots. We export
  trajectories *to* OTel (see `trajectory/otel.ts`) but trajectories
  are the source of truth.
- **Langfuse / Arize / Phoenix as the primary store.** These are
  excellent for visualization but lock us into their data model. We
  keep trajectories in our own store and *export* to them.
- **Differential privacy on trajectories.** Tempting, but the noise
  budget required to make 50 trajectories per agent private would
  destroy the signal. We rely on PII scrubbing + access control instead.
- **Auto-apply evolution actions.** Rejected. Auto-deploying config
  changes in production is dangerous. The AReaL paper itself
  emphasizes human-in-the-loop. We surface the decisions; humans make
  them.
- **Reinforcement learning from the start.** Tempting, but the data
  volume isn't there yet. The current heuristic + LLM-judge reward
  model is enough to drive the control plane. RL is on the roadmap
  once we have ≥1 M trajectories per agent.
