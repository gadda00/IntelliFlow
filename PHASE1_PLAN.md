# Busara AI — Phase 1: From Demo to Product

> **The brutal truth:** Busara AI is a polished demo, not a product. The math library is genuinely strong, but the analysis flow has critical broken paths, 20+ agents are mislabeled or don't actually transform data, the DAG visualizer is fake, presets don't filter agents, and the insight layer is templated Mad-Libs. Users finish the flow feeling like they ran a pipeline but didn't learn anything specific about *their* data.

---

## What's Actually Broken (Top 10 Critical Defects)

Based on the brutally honest audit, these are the issues that make the product unusable:

| # | Defect | Impact |
|---|--------|--------|
| 1 | **URL upload is broken** — proxy returns JSON wrapper, client treats as raw text | Entire upload path fails |
| 2 | **Presets don't filter agents** — all 4 presets run identical 50-agent pipeline | "Quick Insights" isn't quick; users wait 60s for everything |
| 3 | **Correlation matrix computes on misaligned rows** — different columns have different lengths after NaN filter | Every downstream inference (causal, feature importance) is wrong |
| 4 | **Imputation mutates original dataframe** — shallow copy bug | Cross-agent contamination; subtle wrong results |
| 5 | **Strict dependency cascade wipes all reporting** — one early failure skips all downstream agents | One anomaly failure = no insights, no narrative, no recommendations |
| 6 | **Cache key uses row count + config string length** — collides across datasets | Would return wrong results if cache ever hit (currently dead code, but a bomb) |
| 7 | **Stale "v3.3 / 20 agents" copy in narrative fallback** | Three different agent counts in codebase |
| 8 | **AI narrative sends empty columnTypes and fake domain** | LLM gets garbage context, produces garbage narrative |
| 9 | **DAG visualizer gets empty dependencies** — 50 floating nodes, no edges | Users can't see the pipeline structure |
| 10 | **`Math.min(...arr)` / `Math.max(...arr)`** — stack overflow on large arrays | Crashes on datasets >100k values |

---

## What "Good" Looks Like (The 10 Non-Negotiable Patterns)

Based on research into Julius AI, ChatGPT ADA, H2O, DataRobot, and Victor Dibia's multi-agent UX principles:

### 1. **3-Click Onboarding to First Insight**
Upload → auto-profile → suggested question → chart. Under 60 seconds. No agent selection, no config wizard.

### 2. **Conclusion-First Result Hierarchy**
Pyramid Principle: bold one-sentence answer first, evidence collapsed below, methodology two clicks deep. Never make a user scroll through stats to reach the answer.

### 3. **Mandatory "So What + Action" on Every Result**
Every result card has: Observation → So What → Recommended Action. If an agent can't generate all three, the result is incomplete.

### 4. **Raw Metrics Always Translated**
- RMSE → "predictions are typically off by ±X units"
- R² → "this model explains X% of what drives [outcome]"
- p-value → "X% confident the effect is real"
- Never show raw stats as the headline

### 5. **Reproducibility by Construction**
Same data + same params = identical result. Expose & freeze the method. This is the wedge against Julius AI (which produces different results on re-run).

### 6. **Live Agent-Trace UI (Dibia's 4 Principles)**
- **Capability discovery:** "Here's what Busara can reliably do with your data"
- **Observability:** Live agent trace — plan, steps, durations, costs
- **Interruptibility:** Pause/cancel/edit at any point
- **Cost-aware delegation:** Show estimated cost before launching

### 7. **Confidence + Data-Sufficiency Gating**
Refuse to fabricate on sparse data. Show high/medium/low confidence with reason. "Low confidence: only 28 rows; recommend ≥50 for this test."

### 8. **Persona-Switched Presentation**
- Executive: 3-5 KPIs, traffic-light indicators, top risks
- Manager: biggest movers, drill-downs
- Analyst: raw data, code, methodology

### 9. **Suggested Follow-Up Questions on Every Result**
Turns one-shot answers into conversations. Auto-generated, context-aware.

### 10. **Insights Push to Workflow, Not Pull**
Slack digests, email alerts, scheduled reports, shareable links, Excel/PDF export.

---

## Phase 1 Implementation Plan

**Goal:** Transform Busara from "polished demo" to "tool that actually does what the UI claims."

**Scope:** Fix the 10 critical defects + implement patterns 1-5 (the foundation). Patterns 6-10 are Phase 2.

**Timeline:** 3 phases of implementation

---

### Phase 1A: Fix What's Broken (Critical Defects)

#### 1A.1 — Fix URL Upload
**File:** `apps/web/src/components/v7/UploadStep.tsx:84-99`
**Problem:** Client does `const text = await resp.text()` then parses text as CSV/JSON. But proxy returns `{data: "<raw>", contentType, ...}`.
**Fix:** Client should `await resp.json()` then parse `json.data` as the raw text.
```typescript
// Before
const resp = await fetch(`/api/proxy-url?url=...`);
const text = await resp.text();
// After
const resp = await fetch(`/api/proxy-url?url=...`);
const json = await resp.json();
const text = json.data;
```

#### 1A.2 — Wire Presets to Agent Filtering
**File:** `apps/web/src/app/api/v7/analyze-stream/route.ts:41-46`
**Problem:** `orchestrator.execute` is called without `enabledAgents`. All presets run all 50 agents.
**Fix:** Map each preset to an agent ID list, pass to orchestrator.
```typescript
const PRESET_AGENTS = {
  full: undefined, // all agents
  forecast: ['data_ingestion', 'schema_inference', 'data_profiling', 'holt_winters_forecast', 'arima_forecast', 'seasonality_detector', 'trend_detector', 'insight_generator', 'narrative_composer', 'code_generator', 'visualization_agent', 'orchestrator'],
  anomaly: ['data_ingestion', 'schema_inference', 'data_profiling', 'anomaly_ensemble', 'isolation_forest', 'fraud_detection', 'realtime_alert', 'insight_generator', 'narrative_composer', 'orchestrator'],
  quick: ['data_ingestion', 'schema_inference', 'data_profiling', 'data_quality_scorer', 'anomaly_ensemble', 'correlation_matrix', 'insight_generator', 'narrative_composer', 'orchestrator'],
};
// Pass to orchestrator
orchestrator.execute({ analysisId, dataframe, config, onProgress, enabledAgents: PRESET_AGENTS[preset] });
```

#### 1A.3 — Fix Correlation Matrix (Misaligned Rows)
**File:** `apps/web/src/lib/agents/v7/implementations/detectAgents.ts:706-717`
**Problem:** Different columns filtered independently for NaN → arrays have different lengths → correlations computed between misaligned rows.
**Fix:** Compute pairwise on aligned rows.
```typescript
// Before: filter each column independently
const col1 = data.map(r => Number(r[c1])).filter(n => !isNaN(n));
const col2 = data.map(r => Number(r[c2])).filter(n => !isNaN(n));
// After: filter rows where BOTH columns are non-null
const pairs = data
  .map(r => [Number(r[c1]), Number(r[c2])])
  .filter(([a, b]) => !isNaN(a) && !isNaN(b));
const col1 = pairs.map(p => p[0]);
const col2 = pairs.map(p => p[1]);
```

#### 1A.4 — Fix Imputation Mutation Bug
**File:** `apps/web/src/lib/agents/v7/implementations/engineerAgents.ts:41, 101`
**Problem:** `cleanedData = [...dataframe]` is shallow copy → mutates original rows.
**Fix:** Deep clone.
```typescript
// Before
const cleanedData = [...dataframe];
// After
const cleanedData = dataframe.map(r => ({ ...r }));
```

#### 1A.5 — Fix Dependency Cascade
**File:** `apps/web/src/lib/agents/v7/orchestrator.ts:222-253`
**Problem:** If ANY dependency has non-success status, agent is skipped. One early failure wipes all reporting.
**Fix:** Only skip if dependency `failed` (not `skipped`), and let agents handle missing deps defensively.
```typescript
// Before
const depResults = agent.metadata.dependencies.map(depId => results.get(depId));
const allDepsSucceeded = depResults.every(r => r?.status === 'success');
if (!allDepsSucceeded) { skip; }
// After
const failedDeps = agent.metadata.dependencies.filter(depId => 
  results.get(depId)?.status === 'failed'
);
if (failedDeps.length > 0) {
  // Log which deps failed, but still try — agent may handle missing input
  console.warn(`Agent ${agent.id} has failed deps: ${failedDeps.join(', ')}`);
}
// Always run the agent — it should handle missing input gracefully
```

#### 1A.6 — Fix/Remove Cache Key
**File:** `apps/web/src/lib/agents/v7/orchestrator.ts:405-409`
**Problem:** Cache key = `${agent.id}:${dataframe.length}:${JSON.stringify(config).length}`. Collides across datasets.
**Fix:** Remove the cache entirely (it's per-request, never hits) OR hash actual data content.
```typescript
// Remove cache (simplest, safest)
// Delete cacheKey, cacheHit logic, and cache set after agent runs
```

#### 1A.7 — Fix Stale Narrative Copy
**File:** `apps/web/src/lib/ai/narrative.ts:85, 181`
**Problem:** Fallback says "v3.3 / 20 agents" — app is v7 / 50 agents.
**Fix:** Update copy.

#### 1A.8 — Fix AI Narrative Context
**File:** `apps/web/src/components/v7/ResultsStep.tsx:311-313`
**Problem:** Sends `columnTypes: {}` and `detectedDomain: 'auto-detected'`.
**Fix:** Pass actual `schema_inference` output and detect domain from column names.
```typescript
// In OverviewResults
const schema = getAgentResult('schema_inference');
const columnTypes = schema ? Object.fromEntries(
  Object.entries(schema).map(([col, info]: [string, any]) => [col, info.type])
) : {};
const detectedDomain = detectDomain(schema, data);
```

#### 1A.9 — Fix DAG Visualizer Dependencies
**File:** `apps/web/src/components/v7/PipelineStep.tsx:56-66`
**Problem:** Passes `dependencies: []` for all agents.
**Fix:** Pass real dependencies from agent metadata.
```typescript
// In PipelineStep
const pipelineAgents: PipelineAgent[] = Object.entries(agentStates).map(([id, state]) => {
  const agentMeta = AGENT_REGISTRY[id]; // Import from registry
  return {
    id,
    name: state.agentName,
    stage: state.stage,
    stageNumber: state.stageNumber,
    dependencies: agentMeta?.dependencies || [],
    tier: agentMeta?.tier || 'core',
    color: STAGE_COLORS[state.stage] || '#888',
    icon: STAGE_ICONS[state.stage] || '⚙️',
  };
});
```

#### 1A.10 — Fix Math.min/max Stack Overflow
**Files:** Multiple (MinMaxScaler, VisualizationAgent, AnomalyForecasting)
**Problem:** `Math.min(...arr)` crashes on arrays >~100k elements.
**Fix:** Use reduce.
```typescript
// Before
const min = Math.min(...values);
const max = Math.max(...values);
// After
const min = values.reduce((a, b) => Math.min(a, b), Infinity);
const max = values.reduce((a, b) => Math.max(a, b), -Infinity);
```

---

### Phase 1B: Make Results Actually Useful (Patterns 2-5)

#### 1B.1 — Conclusion-First Result Layout (Pattern 2)
**File:** New component `ConclusionCard.tsx`
**What:** Replace the current "Key Metrics → Executive Summary → Findings → Recommendations" layout with:
1. **Bold one-sentence conclusion** (the "answer")
2. **Primary chart** (visual evidence)
3. **Recommended action** (one sentence)
4. **Collapsible:** Supporting evidence, secondary charts, methodology, code

#### 1B.2 — "So What + Action" on Every Result (Pattern 3)
**File:** Update `insight_generator` agent + `OverviewResults` component
**What:** Every result card has three sections:
- **Observation:** "Sales dropped 14% in Q3"
- **So What:** "Driven by a 40% decline in Enterprise deals in the Northeast"
- **Action:** "Investigate Enterprise pipeline; consider targeted retention campaign"

#### 1B.3 — Translate Raw Metrics (Pattern 4)
**File:** New utility `translateMetrics.ts`
**What:** Every raw stat gets a plain-English translation:
```typescript
translateRMSE(53.85, 'sales') → "predictions are typically off by ±53.85 units"
translateRSquared(0.78) → "this model explains 78% of what drives the outcome"
translatePValue(0.03) → "97% confident the effect is real (not random)"
```

#### 1B.4 — Reproducibility (Pattern 5)
**Files:** `orchestrator.ts`, `kmeans_cluster`, `isolation_forest`, `gaussian_mixture`
**What:**
- Seed all `Math.random()` calls with a deterministic seed (from config or fixed)
- Expose the method used (test type, parameters, threshold) as visible metadata
- Show "Method: Holt-Winters triple exponential smoothing, α=0.3, β=0.1, γ=0.05" on results
- Same data + same params = identical result, every time

---

### Phase 1C: Fix the Agent Layer (Stop Lying)

#### 1C.1 — Fix or Rename Lying Agents
| Agent | Current Name | What It Actually Does | Action |
|-------|-------------|----------------------|--------|
| `outlier_removal` | "Outlier Removal" | Counts outliers, doesn't remove | Rename to `outlier_detector` |
| `duplicate_remover` | "Duplicate Remover" | Counts duplicates, doesn't remove | Rename to `duplicate_reporter` |
| `feature_engineering` | "Feature Engineering" | Generates feature names only | Actually create the columns |
| `standard_scaler` | "Standard Scaler" | Computes scaled values, doesn't apply | Apply to dataframe |
| `minmax_scaler` | "Min-Max Scaler" | Computes scaled values, doesn't apply | Apply to dataframe |
| `auto_ml` | "Auto ML" | Reads OLS R², doesn't train models | Rename to `model_comparison` |
| `shap_explainer` | "SHAP Explainer" | Linear feature contribution | Rename to `feature_contribution` |
| `arima_forecast` | "ARIMA Forecast" | AR(1) only, no MA | Rename to `autoregressive_forecast` |
| `isolation_forest` | "Isolation Forest" | Proximity-to-split, not isolation | Implement real IF or rename |
| `stationarity_tester` | "Stationarity Tester (ADF)" | Wrong test, wrong critical values | Fix or rename to `ar1_tester` |

#### 1C.2 — Fix Data Quality Scorer
**File:** `ingestAgents.ts:410, 413`
**Problem:** `validity = 100` and `consistency = 100` are hardcoded.
**Fix:**
- `validity`: Check if values match inferred types (e.g., a "numeric" column with string values = low validity)
- `consistency`: Check cross-column consistency (e.g., `end_date > start_date`)

#### 1C.3 — Fix timeColumn Being Ignored
**File:** All forecast agents
**Problem:** Forecast agents use row order, not time column.
**Fix:** Sort dataframe by `config.timeColumn` before extracting values.

---

## What Phase 1 Does NOT Include (Deferred to Phase 2)

- **Conversational follow-up questions** (Pattern 9) — requires chat interface
- **Persona-switched presentation** (Pattern 8) — requires user auth + role system
- **Live agent-trace UI** (Pattern 6) — requires real-time event stream redesign
- **Push to workflow** (Pattern 10) — requires Slack/email integration
- **Data sufficiency gating** (Pattern 7) — requires per-test minimum sample sizes
- **Unifying the two analyzers** (legacy vs v7) — large refactor
- **E2E test fixes** — after UI stabilizes
- **Performance optimization** — progressive streaming, caching

---

## Success Criteria for Phase 1

After Phase 1, a user should be able to:

1. ✅ Upload data via URL (not just file/paste)
2. ✅ Choose "Quick Insights" and actually get a fast, focused analysis
3. ✅ See a bold conclusion first, not a wall of metrics
4. ✅ Understand what each result means in plain English (no raw RMSE)
5. ✅ Trust that re-running the same analysis gives the same result
6. ✅ See real dependency edges in the DAG visualizer
7. ✅ Not have the entire reporting layer wiped by one agent failure
8. ✅ Export results that are actually useful (JSON, CSV, print-styled PDF)
9. ✅ Get an AI narrative that's based on real data context
10. ✅ Not encounter any crashes on datasets >1000 rows

---

## Implementation Order

1. **1A.1-1A.10** — Fix all critical defects (can be done in parallel)
2. **1C.1-1C.3** — Fix lying agents (rename or implement)
3. **1B.4** — Reproducibility (seeded PRNG)
4. **1B.1** — Conclusion-first layout
5. **1B.2** — So What + Action
6. **1B.3** — Metric translation

Each step should be committed independently with tests.
