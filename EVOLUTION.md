# Busara Self-Evolution System

> How Busara agents learn from every execution, based on the [AReaL paper](https://arxiv.org/abs/2607.01120).

## Overview

Busara implements the three pillars identified by the AReaL paper as missing from current agentic RL systems:

1. **Standardized trajectory data protocol** — every agent execution is captured as a step-level trajectory
2. **Enterprise-grade data proxy** — production trajectories are filtered, scrubbed, and scored into learning data
3. **Unified evolution control plane** — automated decisions about when to promote, optimize, or fine-tune agents

Plus verification gates, reward models, and guardrails from related research.

## Pillar 1: Trajectory Data Protocol

### What is a trajectory?

A trajectory is the complete, step-level record of a single agent execution. It captures:

- **Context snapshot** — the agent's config, system prompt, DAG context at execution time
- **Steps** — every observation, action, LLM call, tool call, and result, with causal links between them
- **Rewards** — explicit (user feedback) or automated (reward model) signals
- **Metadata** — dataframe hash, row count, PII detection, tags
- **Metrics** — duration, token count, cost, error count, retry count

### The Trajectory type

```typescript
interface Trajectory {
  id: string;
  analysisId: string;
  userId: string;
  workspaceId?: string;
  agentId: string;
  agentVersion: string;
  agentStability: 'experimental' | 'beta' | 'stable' | 'deprecated';
  startedAt: string;
  completedAt?: string;
  status: 'running' | 'success' | 'failed' | 'cancelled' | 'timeout';
  steps: TrajectoryStep[];
  rewards: RewardSignal[];
  contextSnapshot: TrajectoryContextSnapshot;
  metadata: TrajectoryMetadata;
  metrics: TrajectoryMetrics;
  error?: TrajectoryError;
}
```

### How trajectories are captured

The `TrajectoryRecorder` class wraps agent execution:

```typescript
const recorder = new TrajectoryRecorder({
  analysisId, userId, agentId, agentVersion, agentStability,
  contextSnapshot, metadata,
});

recorder.start();
recorder.observe(inputData);
recorder.llmCall({ provider: 'glm', model: 'glm-4.6', ... });
recorder.toolCall({ tool: 'parseCSV', input, output });
recorder.result(output);
const trajectory = recorder.complete('success');
```

For automatic capture, use the `withTrajectory()` wrapper:

```typescript
import { withTrajectory, InMemoryTrajectoryStore } from '@busara/agents';

const store = new InMemoryTrajectoryStore();
const wrappedAgent = withTrajectory(agent, { store, analysisId, userId });
const result = await wrappedAgent.execute(ctx);
// Trajectory is automatically recorded and persisted
```

### Causal links

Each step records which prior steps causally influenced it (`causalParentSteps`). This preserves the causal structure that RL training requires for credit assignment — without it, the learning algorithm can't determine which actions led to the reward.

```typescript
const step1 = recorder.observe(input);
recorder.pushStep(step1);  // step1 is now "active"
const step2 = recorder.compute('mean', input, 2.5);  // step2.causalParentSteps = [step1]
recorder.popStep();
```

### OpenTelemetry GenAI export

Trajectories can be exported in the OpenTelemetry GenAI v1.37+ format for interoperability:

```typescript
import { trajectoryToOTel, toOTLPJSON } from '@busara/agents';

const otelTrace = trajectoryToOTel(trajectory);
const otlpJson = toOTLPJSON([otelTrace]);
// POST otlpJson to any OTel collector
```

This allows trajectory data to be consumed by Langfuse, Arize Phoenix, MLflow, Datadog, or any OTel-compatible observability tool.

## Pillar 2: Data Proxy

### What it does

The `DataProxy` converts production trajectories into governed learning substrates:

1. **Filter** — remove failed, low-quality, or PII-contaminated trajectories
2. **Scrub** — remove PII (email, phone, SSN, credit card, IP, API keys) from trajectory data
3. **Score** — rate trajectory quality (success + efficiency + richness + reward)
4. **Deduplicate** — by (dataframeHash, agentId, configHash)
5. **Export** — produce a dataset with audit logging

### Usage

```typescript
import { DataProxy, InMemoryTrajectoryStore } from '@busara/agents';

const store = new InMemoryTrajectoryStore();
const proxy = new DataProxy(store);

const dataset = await proxy.exportDataset(
  { agentId: 'anomaly_sentinel', limit: 100 },
  {
    minSuccessRate: 0.8,
    minQualityScore: 0.5,
    scrubPII: true,
    deduplicate: true,
    maxPerAgent: 50,
    requireRewards: true,
  },
  { exportedBy: 'user-123', purpose: 'fine-tuning' }
);
```

### PII scrubbing

The data proxy scans all string fields in trajectory steps and replaces PII with placeholders:

- Emails → `[EMAIL]`
- Phone numbers → `[PHONE]`
- SSNs → `[SSN]`
- Credit cards → `[CREDIT_CARD]`
- IP addresses → `[IP]`
- API keys → `[API_KEY]`

### Quality scoring

Each trajectory gets a quality score (0.0 to 1.0) based on:

| Component | Weight | What it measures |
|---|---|---|
| Success | 40% | Did the agent succeed? |
| Efficiency | 20% | Was it fast relative to data size? |
| Richness | 20% | Did it produce detailed steps? |
| Reward | 20% | Did users find it useful? |

## Pillar 3: Evolution Control Plane

### What it does

The `EvolutionControlPlane` analyzes trajectory statistics and proposes evolution actions:

- **PROMOTE_STABILITY** — beta → stable (after 100+ trajectories at >90% success)
- **DEMOTE_STABILITY** — stable → beta (success rate dropped below 70%)
- **OPTIMIZE_CONFIG** — suggest new default config values based on what correlates with high rewards
- **FLAG_DRIFT** — alert that performance is changing (improving or degrading)
- **FLAG_LOW_REWARD** — alert that users aren't finding the agent useful
- **FLAG_HIGH_FAILURE** — alert that failure rate is too high
- **SCHEDULE_FINE_TUNE** — enough data + mixed rewards to justify fine-tuning
- **DEPRECATE_AGENT** — consistently poor performance, consider removal

### Drift detection

Compares recent (last 3 days) vs historical (last 7 days) performance:

```typescript
import { detectDrift } from '@busara/agents';

const drift = await detectDrift(store, 'anomaly_sentinel');
// { isDrifting: true, driftScore: 0.23, direction: 'degrading', details: {...} }
```

### Config optimization

Analyzes which config values correlate with high rewards:

```typescript
import { optimizeConfig } from '@busara/agents';

const insights = await optimizeConfig(store, 'anomaly_sentinel');
// [{ configKey: 'sensitivity', currentValue: 'high', suggestedValue: 'medium', reason: '...' }]
```

### Human-in-the-loop

All evolution actions are **suggestions** until a human approves them:

```typescript
// GET /api/v2/evolution?agentId=anomaly_sentinel
// Returns pending actions

// POST /api/v2/evolution
// { actionType: 'approve', agentId: 'anomaly_sentinel', actionIndex: 0 }
```

## Verification Gates

### What they do

Verification gates validate an agent's output before passing it to downstream agents. If validation fails, the replanning strategy kicks in.

### Built-in gates

| Gate | What it checks |
|---|---|
| `SchemaVerificationGate` | Output matches a Zod schema |
| `StatusVerificationGate` | Agent reported `success` |
| `NonEmptyOutputGate` | Output is not null/empty |
| `DurationVerificationGate` | Execution didn't take too long |
| `StatisticalSanityGate` | Numeric outputs are in valid ranges (e.g., correlation in [-1, 1], no NaN) |
| `CompositeVerificationGate` | Runs multiple gates |

### Replanning strategies

When verification fails:

| Strategy | When | What happens |
|---|---|---|
| `RETRY` | First failure | Re-run with same config |
| `RETRY_ADJUSTED` | Second failure | Re-run with adjusted config (lower sensitivity, etc.) |
| `FALLBACK` | Third failure | Use a different agent |
| `SKIP` | After 3 failures | Skip the agent, continue pipeline |
| `ABORT` | Critical failure | Stop the entire pipeline |

### Usage

```typescript
import { executeWithVerification, SchemaVerificationGate, StatisticalSanityGate } from '@busara/agents';

const result = await executeWithVerification(agent, ctx, {
  gates: [new SchemaVerificationGate(outputSchema), new StatisticalSanityGate()],
  maxRetries: 3,
});
```

## Reward Models

### Why automated rewards?

Explicit rewards (user thumbs up/down) are rare — most users don't bother. Automated reward models score every trajectory, providing dense signal for the evolution control plane.

### Implementations

| Model | How it works | Cost |
|---|---|---|
| `HeuristicRewardModel` | Rule-based: success + efficiency + richness + error-free | Free |
| `LLMJudgeRewardModel` | Uses GLM-4.6 to judge output quality | ~$0.001/call |
| `CompositeRewardModel` | Combines multiple models with weights | Varies |

### Usage

```typescript
import { HeuristicRewardModel, scoreAndReward } from '@busara/agents';

const model = new HeuristicRewardModel();
const { score } = await scoreAndReward(trajectory, model);
// Reward is automatically added to the trajectory
```

## Guardrails

### What they defend against

| Guardrail | Threat | Source |
|---|---|---|
| `PromptInjectionGuardrail` | Adversarial text in data that hijacks agent instructions | OWASP LLM #1 |
| `PIILeakageGuardrail` | Agent output containing sensitive data from input | GDPR/PCI |

### Prompt injection patterns

The guardrail detects 18 patterns across 6 categories:

- Direct instruction overrides ("ignore previous instructions")
- Role manipulation ("pretend you are")
- Data exfiltration ("reveal your system prompt")
- Jailbreak attempts ("DAN mode")
- Encoded payloads (base64, eval, exec)
- System access attempts

### Usage

```typescript
import { createDefaultGuardrail } from '@busara/agents';

const guardrail = createDefaultGuardrail();
const result = guardrail.check(input, output);

if (!result.passed) {
  for (const violation of result.violations) {
    console.warn(`${violation.severity}: ${violation.message}`);
  }
}
```

## API endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v2/trajectory` | Query trajectories (filter by agent, user, status, date, reward) |
| POST | `/api/v2/trajectory` | Save a trajectory |
| GET | `/api/v2/trajectory/:id` | Get a single trajectory with all steps |
| POST | `/api/v2/trajectory/:id/reward` | Add a reward signal |
| GET | `/api/v2/trajectory/agent/:agentId/stats` | Aggregate stats for an agent |
| GET | `/api/v2/evolution` | Get evolution actions for an agent |
| POST | `/api/v2/evolution` | Approve/reject/apply actions |

## What's next

Based on the research in `RESEARCH.md`:

1. **LLM gateway proxy** — capture trajectories at the HTTP boundary for zero-code agent instrumentation
2. **Checkpointing + resume** — save agent state mid-execution for long-running pipelines
3. **Episodic memory** — let agents search past trajectories for similar situations
4. **Fine-tuning pipeline** — connect the data proxy's export to an actual training job
5. **A/B testing framework** — route traffic to experimental configs and measure performance
