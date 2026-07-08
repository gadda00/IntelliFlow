# Writing a new Busara agent

This guide walks you through implementing, testing, and registering a new agent in the Busara platform. By the end you'll have a working agent that the orchestrator, API, and CLI can all use.

> **Prerequisite:** Read [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md) first so you understand where agents fit in the system.

---

## 1. When to write a new agent

Write a new agent when:

- You have a **statistical / ML / data transformation** that doesn't fit any existing agent
- The computation is **self-contained** — it takes a dataframe + config, returns a result
- The output is useful to **downstream agents** or to the user

**Don't** write a new agent for:

- UI logic (use a React component)
- HTTP request handling (use an API route)
- Database queries (use Prisma directly in the web app)
- Cross-cutting concerns like logging or auth (use middleware / hooks)

---

## 2. Pick a stage

Busara agents run in 7 stages. Your agent belongs in exactly one:

| Stage # | Name | Purpose | Example agents |
|---|---|---|---|
| 0 | `ingest` | Parse, validate, profile raw data | `data_ingestion`, `schema_inference`, `data_profiler` |
| 1 | `engineer` | Clean, transform, engineer features | `data_cleaner`, `data_transformer`, `feature_engineer` |
| 2 | `detect` | Deep analysis — anomalies, forecasts, causality | `anomaly_sentinel`, `forecasting_oracle`, `causal_architect` |
| 3 | `forecast` | Time-series specific (decomposition, seasonality) | `trend_detector`, `seasonality_detector` *(planned)* |
| 4 | `infer` | Statistical inference (A/B tests, survival) | `ab_test_significance`, `survival_analysis` *(planned)* |
| 5 | `cluster` | Clustering + funnel analysis | `cluster_profiler`, `funnel_analysis` *(planned)* |
| 6 | `report` | Summarize, recommend, NLQ | `insight_summarizer`, `recommendation` *(planned)* |

Pick the **earliest** stage your agent can run in. (E.g. an agent that needs cleaned data goes in `detect`, not `ingest`.)

---

## 3. Create the file

Create `packages/agents/src/agents/<stage>/<Name>Agent.ts`.

The convention is:
- File name: `PascalCaseAgent.ts` (e.g. `ForecastingOracleAgent.ts`)
- Class name: same as file name (e.g. `ForecastingOracleAgent`)
- Agent ID (in metadata): `snake_case` (e.g. `forecasting_oracle`)

---

## 4. Template agent

Here's a complete, minimal agent you can copy and adapt:

```typescript
/**
 * My Custom Agent
 * ================
 *
 * Stage 2 - Detect
 *
 * One-sentence description of what this agent does.
 */

import { z } from 'zod';
import {
  AgentStage,
  AgentTier,
  AgentStability,
} from '@busara/core';
import {
  BaseAgent,
  EnhancedAgentMetadata,
  EnhancedAgentContext,
  AgentResult,
  createAgentMetadata,
} from '../../core';
// Optional: import math helpers
// import { mean, median, stdev } from '../../math';

// ============================================================================
// Agent Metadata
// ============================================================================

const metadata = createAgentMetadata({
  // ---- Identity ----
  id: 'my_custom_agent',
  name: 'My Custom Agent',
  description: 'One-sentence description of what this agent does.',
  version: '1.0.0',

  // ---- Classification ----
  stage: 'detect' as AgentStage,
  stageNumber: 2,
  tier: 'specialized' as AgentTier,
  stability: 'experimental' as AgentStability,  // start as experimental, promote later

  // ---- Author ----
  author: 'Your Name',
  license: 'MIT',

  // ---- Dependencies ----
  dependencies: ['data_ingestion'],  // IDs of agents that must run first
  softDependencies: ['schema_inference'],  // optional deps

  // ---- Execution ----
  timeoutMs: 30_000,
  maxRetries: 3,

  // ---- Capabilities ----
  capabilities: ['custom_analysis', 'specific_capability'],
  category: 'analysis',
  tags: ['custom', 'analysis'],

  // ---- Input / Output ----
  inputDescription: 'A dataframe with at least one numeric column.',
  outputDescription: 'A summary of the custom analysis.',

  inputSchema: {
    schema: z.array(z.record(z.string(), z.unknown())),
    description: 'Input dataframe (array of records)',
  },

  outputSchema: {
    schema: z.object({
      summary: z.string(),
      metric: z.number(),
      details: z.array(z.record(z.string(), z.unknown())),
    }),
    description: 'Custom analysis result',
  },

  configSchema: {
    schema: z.object({
      threshold: z.number().min(0).max(1).default(0.5),
      columnName: z.string().optional(),
    }),
    defaults: {
      threshold: 0.5,
    },
    description: 'Configuration for the custom agent',
  },

  // ---- Technical requirements ----
  memoryLimitMB: 256,
  cpuLimit: 1,
  gpuRequired: false,
});

// ============================================================================
// Agent Implementation
// ============================================================================

export class MyCustomAgent extends BaseAgent {
  readonly metadata: EnhancedAgentMetadata = metadata;

  async execute(context: EnhancedAgentContext): Promise<AgentResult> {
    const start = Date.now();
    const { dataframe, config, previousResults } = context;

    try {
      // 1. Read config (with defaults already applied)
      const threshold = (config.threshold as number) ?? 0.5;
      const columnName = config.columnName as string | undefined;

      // 2. Optionally use previousResults from dependencies
      const ingestionResult = previousResults.get('data_ingestion') as
        | { output?: { rowCount?: number } }
        | undefined;
      const rowCount = ingestionResult?.output?.rowCount ?? dataframe.length;

      // 3. Run your computation
      // ... your logic here ...
      const metric = dataframe.length * threshold;
      const summary = `Analyzed ${rowCount} rows with threshold ${threshold}.`;

      // 4. Build the output
      const output = {
        summary,
        metric,
        details: dataframe.slice(0, 5),
      };

      // 5. Validate output against the schema (recommended)
      const parsed = metadata.outputSchema.schema.safeParse(output);
      if (!parsed.success) {
        return this.createError(
          `Output validation failed: ${parsed.error.message}`,
          Date.now() - start,
        );
      }

      // 6. Return success
      return this.createResult(
        parsed.data,
        {
          rowCount,
          threshold,
          computationTimeMs: Date.now() - start,
        },
        Date.now() - start,
      );
    } catch (error) {
      const executionTimeMs = Date.now() - start;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return this.createError(errorMessage, executionTimeMs);
    }
  }
}

export { metadata as myCustomAgentMetadata };
export default MyCustomAgent;
```

---

## 5. Zod schema patterns

### 5.1 Basic patterns

```typescript
// Numbers with constraints
z.number().min(0).max(100)
z.number().int().nonnegative()
z.number().positive().max(1000)

// Strings
z.string().min(1).max(255)
z.enum(['low', 'medium', 'high'])  // union of string literals

// Optional + nullable
z.string().optional()       // string | undefined
z.string().nullable()       // string | null
z.string().nullish()        // string | null | undefined

// Arrays
z.array(z.number()).min(1).max(1000)
z.array(z.record(z.string(), z.unknown()))

// Records (string-keyed maps)
z.record(z.string(), z.number())
```

### 5.2 The dataframe type

A "dataframe" in Busara is `Record<string, unknown>[]` — an array of objects where each object is a row and each key is a column name.

```typescript
inputSchema: {
  schema: z.array(z.record(z.string(), z.unknown())).min(1),
  description: 'Input dataframe',
}
```

### 5.3 Discriminated unions (for outputs with multiple shapes)

```typescript
outputSchema: {
  schema: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('numeric'), mean: z.number(), stdev: z.number() }),
    z.object({ kind: z.literal('categorical'), categories: z.array(z.string()) }),
  ]),
  description: 'Profile result — either numeric or categorical',
}
```

### 5.4 Config schema with defaults

Always provide `defaults` so the agent can run with no config:

```typescript
configSchema: {
  schema: z.object({
    sensitivity: z.enum(['low', 'medium', 'high']).default('medium'),
    maxIterations: z.number().int().positive().max(1000).default(100),
    columnName: z.string().optional(),
  }),
  defaults: {
    sensitivity: 'medium',
    maxIterations: 100,
  },
  description: 'Configuration for the agent',
}
```

The orchestrator merges `defaults` with the user-supplied config before calling `execute()`.

---

## 6. Export the agent

Add the export to the stage's `index.ts`:

```typescript
// packages/agents/src/agents/detect/index.ts
export * from './MyCustomAgent';
```

The `AgentPool` (in `packages/agents/src/agents.ts`) auto-discovers any class whose name ends in `Agent` from the stage modules. **No manual registration needed.**

---

## 7. Test the agent

Create a test file next to the source: `packages/agents/src/agents/<stage>/MyCustomAgent.test.ts`.

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { MyCustomAgent } from './MyCustomAgent';
import type { EnhancedAgentContext } from '../../core';

function makeContext(overrides: Partial<EnhancedAgentContext> = {}): EnhancedAgentContext {
  return {
    analysisId: 'test-analysis',
    executionId: 'test-execution',
    attempt: 1,
    dataframe: [
      { id: 1, value: 10 },
      { id: 2, value: 20 },
      { id: 3, value: 30 },
    ],
    config: {},
    previousResults: new Map(),
    metadata: {},
    startedAt: new Date().toISOString(),
    options: {},
    logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} },
    metrics: { record: () => {}, getStats: () => ({}) } as any,
    cache: { get: () => null, set: () => {}, delete: () => false, clear: () => {} } as any,
    ...overrides,
  } as unknown as EnhancedAgentContext;
}

describe('MyCustomAgent', () => {
  let agent: MyCustomAgent;

  beforeEach(() => {
    agent = new MyCustomAgent();
  });

  describe('metadata', () => {
    it('should have a stable id', () => {
      expect(agent.metadata.id).toBe('my_custom_agent');
    });

    it('should declare the correct stage', () => {
      expect(agent.metadata.stage).toBe('detect');
    });

    it('should start as experimental', () => {
      expect(agent.metadata.stability).toBe('experimental');
    });
  });

  describe('execute', () => {
    it('should return a success result for valid input', async () => {
      const result = await agent.execute(makeContext());
      expect(result.status).toBe('success');
      expect(result.output).toMatchObject({
        summary: expect.any(String),
        metric: expect.any(Number),
        details: expect.any(Array),
      });
    });

    it('should respect the threshold config', async () => {
      const result = await agent.execute(makeContext({ config: { threshold: 0.1 } }));
      // ... assert on the result
    });

    it('should return a failed result when the dataframe is empty', async () => {
      const result = await agent.execute(makeContext({ dataframe: [] }));
      // Either success with a warning, or failed — up to you, just be consistent
      expect(['success', 'failed']).toContain(result.status);
    });
  });

  describe('schema validation', () => {
    it('should validate its output against the declared schema', () => {
      const output = { summary: 'test', metric: 1, details: [] };
      const result = agent.metadata.outputSchema.schema.safeParse(output);
      expect(result.success).toBe(true);
    });
  });
});
```

Run the tests:

```bash
pnpm --filter @busara/agents test
# or to run just your file:
pnpm --filter @busara/agents test -- MyCustomAgent
```

---

## 8. Test the agent through the API

Start the dev server and hit the v2 analyze endpoint:

```bash
pnpm dev:web

# In another terminal:
curl -X POST http://localhost:3000/api/v2/analyze \
  -H 'Content-Type: application/json' \
  -d '{
    "agentId": "my_custom_agent",
    "dataframe": [
      {"id": 1, "value": 10},
      {"id": 2, "value": 20}
    ],
    "config": {"threshold": 0.3}
  }'
```

The response should look like:

```json
{
  "ok": true,
  "analysisId": "an_...",
  "trajectoryId": "traj_...",
  "result": {
    "status": "success",
    "output": {
      "summary": "...",
      "metric": ...,
      "details": [...]
    },
    "metrics": { ... },
    "executionTimeMs": 12
  }
}
```

---

## 9. Test the agent through the CLI

Once the API works, the CLI should work too:

```bash
busara agents list | grep my_custom_agent
busara agents info my_custom_agent
busara analyze my_custom_agent --data sample.csv
busara analyze my_custom_agent --data sample.csv --stream
```

---

## 10. Promote the agent (when it's ready)

New agents start at `stability: 'experimental'`. Once the agent has:

- ✅ Unit tests passing
- ✅ At least 100 successful trajectories in production
- ✅ A success rate above 95%
- ✅ An average reward above 0
- ✅ A code review from a Busara maintainer

You can promote it to `beta`, and eventually to `stable`. The Evolution Control Plane will suggest promotions automatically — see `busara evolution list`.

Update the `stability` field in the metadata:

```typescript
stability: 'stable' as AgentStability,
```

---

## 11. Checklist

Before opening a PR with a new agent:

- [ ] File created at `packages/agents/src/agents/<stage>/<Name>Agent.ts`
- [ ] Export added to `packages/agents/src/agents/<stage>/index.ts`
- [ ] `metadata.id` is `snake_case` and unique
- [ ] `metadata.stage`, `tier`, `stability` set correctly
- [ ] `inputSchema`, `outputSchema`, `configSchema` declared with Zod
- [ ] `configSchema.defaults` covers every config key
- [ ] `dependencies` lists every agent that must run first
- [ ] `execute()` returns `this.createResult(...)` on success and `this.createError(...)` on failure
- [ ] `execute()` validates its own output against `outputSchema`
- [ ] Unit test file created with at least 3 tests (happy path, edge case, error case)
- [ ] `pnpm --filter @busara/agents test` passes
- [ ] `pnpm typecheck` passes (7/7 or 8/8 — all green)
- [ ] Manually tested through the API (`curl` or Postman)
- [ ] Manually tested through the CLI (`busara analyze`)
- [ ] PR description links to the issue (if any) and explains the agent's purpose

---

## 12. Examples to learn from

The best way to learn is to read existing agents. In order of complexity:

1. **`DataIngestionAgent`** (`agents/ingest/DataIngestionAgent.ts`) — simplest. Validates structure, returns metadata.
2. **`DataProfilerAgent`** (`agents/ingest/DataProfilerAgent.ts`) — uses math helpers, returns rich statistics.
3. **`AnomalySentinelAgent`** (`agents/detect/AnomalySentinelAgent.ts`) — more complex. Uses Z-score + IQR, returns outliers.
4. **`ForecastingOracleAgent`** (`agents/detect/ForecastingOracleAgent.ts`) — most complex. Implements Holt-Winters + FFT decomposition.
5. **`CausalArchitectAgent`** (`agents/detect/CausalArchitectAgent.ts`) — uses correlation + Granger causality.

---

## 13. Gotchas

- **Don't mutate the input dataframe.** Downstream agents may need the original. If you need to transform, return a copy.
- **Don't make HTTP calls** in `execute()` unless absolutely necessary. If you do, set a `timeoutMs` and use `AbortSignal`.
- **Don't log to `console`.** Use `context.logger` so logs are captured in the trajectory.
- **Don't read env vars directly.** Pass them through `config` so the agent is testable.
- **Don't skip the output validation.** It catches bugs early — both yours and downstream agents'.
- **Don't forget `defaults`** in `configSchema`. The orchestrator may call your agent with an empty config object.

---

Happy agent-building! 🤖
