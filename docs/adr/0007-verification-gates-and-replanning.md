# ADR-0007: Verification gates and replanning

## Status

Accepted

## Context

The DAG orchestrator (ADR-0004) executes agents in topological order,
passing each agent's output to its dependents. Without verification,
two failure modes recur in production:

1. **Bad output, good status.** An agent returns `status: 'success'`
   but its output is malformed — `null` where an array was expected,
   a number where a string was expected, an empty result, a result
   with `NaN` statistics. Downstream agents trust the output and
   either crash or produce garbage.
2. **Soft failures.** An agent returns a degenerate result (e.g. zero
   anomalies detected because the sensitivity was too low) without
   flagging it. The pipeline completes "successfully" but the analysis
   is useless. The user sees a dashboard that says "no anomalies
   found" and loses trust.

Both of these are caught by humans, late, after the user has already
seen the broken result. We need to catch them **inside the pipeline**
so we can either retry, adjust, or skip — before the bad output
propagates.

The related research — ["Verified Multi-Agent Orchestration:
Plan-Execute-Verify-Replan"](https://arxiv.org/abs/2603.07811) —
proposes exactly this: between every agent execution, run a
**verification gate** that checks the output. If it fails, **replan**:
retry with adjusted config, route around the failed agent, or abort.

## Decision

Implement a verification-gate framework in
`packages/agents/src/trajectory/verification.ts`:

### Verification gates

A `VerificationGate` is a stateless object with a single method:

```typescript
interface VerificationGate {
  name: string;
  check(ctx: VerificationContext): VerificationResult;
}

interface VerificationResult {
  status: 'pass' | 'retry' | 'retry_adjusted' | 'skip' | 'fail';
  reason?: string;
  suggestedConfigPatch?: Record<string, unknown>;
}
```

Built-in gates:

| Gate | What it checks | Failure behavior |
|---|---|---|
| `SchemaVerificationGate` | Output matches the agent's `outputSchema` | `retry` (a schema mismatch is a transient bug — re-running usually works) |
| `NonEmptyOutputGate` | Output is not `null`, `undefined`, `{}`, or `[]` | `retry_adjusted` (suggests lowering `sensitivity`) |
| `StatusVerificationGate` | `result.status === 'success'` | `retry` (transient failures usually pass on retry) |
| `DurationVerificationGate` | Duration is within `metadata.timeoutMs * 0.9` | `pass` with a warning (just because it was fast doesn't mean it was wrong) |
| `StatisticalSanityGate` | No `NaN`, `Infinity`, or out-of-range values in numeric outputs | `fail` (statistical garbage is rarely transient) |
| `CompositeVerificationGate` | Run multiple gates, return the worst result | configurable |

### Replanning policy

A `ReplanningPolicy` decides what to do when a gate fails. The default
policy (`DefaultReplanningPolicy`) is:

- **Attempt 1** — gate fails with `retry`. Re-run the agent with the
  same config.
- **Attempt 2** — gate fails again with `retry_adjusted`. Re-run with
  the gate's `suggestedConfigPatch` applied. Typical patches: lower
  `sensitivity`, raise `sampleSize`, disable a sub-feature.
- **Attempt 3** — gate fails a third time. Return `skip` — mark the
  agent as `skipped` in the trajectory and continue the pipeline
  without its output. Downstream agents that declared a *hard*
  dependency on the skipped agent will themselves be skipped;
  downstream agents that declared a *soft* dependency will run with
  `previousResults.get(skippedAgentId) === undefined`.
- **Any attempt** — gate returns `fail` (e.g. statistical garbage).
  Don't retry. Mark as `failed`. Continue.

### Execution wrapper

The `executeWithVerification(agent, ctx, opts)` function wraps the
agent, runs the configured gates, and applies the replanning policy.
It records every attempt as a separate `TrajectoryStep` so the
trajectory shows the full retry history.

### Integration with the orchestrator

The DAG orchestrator (ADR-0004) calls `executeWithVerification` instead
of calling `agent.execute()` directly when verification is enabled
(default: on). The gates used are configurable per analysis; the
default set is `[SchemaVerificationGate, NonEmptyOutputGate]`.

The dashboard's trajectory timeline shows each verification attempt as
an expandable row, with the gate name, the failure reason, and the
suggested config patch.

## Consequences

**Positive:**

- Bad outputs don't propagate. A schema mismatch in stage 2 doesn't
  crash agents in stage 4 — it's caught and either retried or routed
  around.
- Soft failures surface. The `NonEmptyOutputGate` catches "zero
  anomalies detected" and retries with lower sensitivity before the
  user sees the empty result.
- The trajectory records every attempt, so post-hoc debugging shows
  exactly what was tried. This is invaluable for the evolution control
  plane (ADR-0003) — it can distinguish "the agent failed" from "the
  agent failed twice then succeeded."
- Replanning is pluggable. The default policy is conservative (3
  attempts, then skip). A more aggressive policy could route to a
  different agent; a more cautious one could abort the whole pipeline.
- The gates are stateless and fast. Schema validation is ~1 ms;
  statistical sanity is ~0.1 ms. The overhead is negligible.

**Negative:**

- Retries cost time and LLM tokens. A 3-attempt retry on a slow agent
  can triple the wall-clock time for that agent. We mitigate by
  making the retry count configurable per analysis.
- The `suggestedConfigPatch` is gate-specific. The `NonEmptyOutputGate`
  suggests lowering `sensitivity`, but that only makes sense for
  agents that have a `sensitivity` config. Agents that don't ignore
  the patch silently.
- The `skip` outcome can surprise downstream agents. An agent that
  expected `previousResults.get('anomaly_sentinel')` to be defined
  now has to handle `undefined`. We require every agent to declare
  which dependencies are hard vs. soft, but the contract is
  unenforced.
- The trajectory grows. A 3-attempt retry produces 3 step records
  instead of 1. The data proxy deduplicates by config hash, so
  duplicates don't pollute exports, but the raw store grows faster.
- Verification doesn't catch *semantic* errors. An agent that returns
  plausible-but-wrong statistics (e.g. a forecast that's off by 10×)
  will pass every gate. Catching semantic errors requires a reward
  model or a peer-agreement check — both of which are async.

## Alternatives Considered

- **No verification — trust the agents.** What we had before. Produces
  the bad-output / soft-failure problems described in the context.
- **Verification only at the end of the pipeline.** Catches some
  issues but too late — by then, every agent has run on bad input
  and the trajectory is polluted.
- **Hard fail on any verification failure.** Too aggressive. Most
  failures are transient (a schema mismatch is usually a serialization
  bug that re-running fixes). Hard-failing would make the pipeline
  brittle.
- **No replanning — just retry with the same config.** Better than
  nothing but doesn't fix the root cause for soft-failure cases
  (degenerate result because sensitivity was too high).
- **LLM-as-judge verification.** Tempting — an LLM could judge
  whether the output "looks right." But it adds latency and cost
  per agent, and the LLM's judgment is itself unreliable. We use
  LLM-as-judge in the reward model (ADR-0003), not in the
  verification gates.
- **Peer-agreement verification.** Run two independent agents on the
  same input and check they agree. Excellent for catching semantic
  errors but doubles the cost. On the roadmap as an optional
  `PeerAgreementGate` for high-stakes analyses.
- **Formal methods (model checking, theorem proving).** Overkill for
  our domain. The outputs are statistics and narratives, not safety-
  critical control systems.
- **Type-level guarantees (dependent types, refinement types).**
  Interesting academically but the TypeScript ecosystem doesn't
  support them well. Zod refinements (ADR-0002) give us runtime
  guarantees, which is what matters in production.
