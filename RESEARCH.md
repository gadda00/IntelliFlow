# Deep Research: Self-Evolving Agents & Next-Generation Agentic RL

> A research brief prepared for the Busara AI modernization, based on the paper
> **"Next-Generation Agentic Reinforcement Learning Systems Enable Self-Evolving Agents"**
> (arXiv:2607.01120, Yan et al., July 2026) and 8 related works.

---

## 1. The Core Paper: AReaL 2.0 (arXiv:2607.01120)

### The Thesis

The paper's central claim is provocative: **the barrier to enterprise-grade self-evolving LLM agents is NOT the RL algorithm — it's the RL *system***. Current agentic RL infrastructure lacks three things, and until they exist, agents will remain "frozen at deployment time" regardless of how good our PPO/GRPO/etc. algorithms get.

### The Three Pillars (the paper's core contribution)

#### Pillar 1: Standardized Agent Trajectory Data Protocol

**The problem:** Every agent framework (LangChain, AutoGen, CrewAI, custom) logs trajectories differently. There's no standard format that carries RL learning signals at **step granularity** across heterogeneous agent paradigms (ReAct, tool-calling, code-execution, multi-turn chat).

**What's needed:** A protocol that records, for every step of every agent run:
- The observation (what the agent saw)
- The action (what the agent did — tool call, text generation, code execution)
- The reward signal (scalar or textual feedback)
- The causal metadata (which prior steps influenced this one)
- The context (system prompt, in-context examples, tool definitions at this moment)

**Why it matters for Busara:** Busara's 33 agents currently produce `AgentResult` objects with `output: unknown` and `metrics: Record<string, number>`. There's no step-level trajectory capture. If we want agents to *learn* from which anomaly-detection parameters worked best across 1,000 analyses, we need trajectory data.

#### Pillar 2: Enterprise-Grade Data Proxy

**The problem:** Production agent workloads (customer support chats, code reviews, data analyses) are messy. They contain PII, proprietary data, wrong answers, adversarial inputs. You can't just pipe them into an RL training loop. You need a **data proxy** that:
- Filters out unusable trajectories (failed, adversarial, PII-contaminated)
- Converts raw workloads into governed learning substrates (reward-labeled, deduplicated, quality-scored)
- Enforces data governance (retention, access control, audit logging)
- Handles the "messy daily work becomes safe learning data" transformation

**Why it matters for Busara:** Every time a user runs an analysis, Busara generates valuable training signal: which agent configs produced useful insights, which were ignored, which led to follow-up questions. But currently that signal is *lost*. A data proxy would capture it, filter it, and make it available for agent improvement.

#### Pillar 3: Unified Agent Evolution Control Plane

**The problem:** Even with good trajectory data and a clean data proxy, someone (or something) has to *decide*: when do we update the policy weights? When do we evolve the in-context harness (system prompts, few-shot examples)? When do we add a new tool? When do we deprecate an agent? Currently these are all manual decisions made by engineers reading dashboards.

**What's needed:** An automated control plane that:
- Monitors trajectory statistics (success rate, reward distribution, drift detection)
- Decides *what* to evolve (weights vs. prompts vs. tools vs. architecture)
- Decides *when* to evolve (trigger thresholds, cooldown periods, A/B test gates)
- Executes the evolution (kick off training job, update prompt, deploy new tool)
- Validates the evolution (rollback if metrics regress)

**Why it matters for Busara:** Busara's agents have `stability: 'beta'`. There's no mechanism to promote them to `stable` based on observed performance, no mechanism to auto-tune their config schemas based on what users actually set, no mechanism to detect when an agent's output quality drifts.

### AReaL 2.0: The Reference Implementation

The paper instantiates one branch of this vision via **AReaL 2.0**, which reorganizes existing RL infrastructure (the AReaL open-source system from Tsinghua/Berkeley) into an agent-oriented online RL loop. Key technical properties:

- **Fully asynchronous** training paradigm (not synchronous like traditional RLHF)
- Optimized for **black-box agent applications** — you point it at any agent by replacing the `base_url`
- Supports both **policy weight updates** (fine-tuning the LLM) and **in-context harness evolution** (updating prompts/tools without retraining)
- Built on Ray for distributed execution
- Production-deployed at scale for customer service, coding, and search agents

### The Paper's Broader Argument

The paper doesn't just present AReaL — it argues that the entire field is stuck because we're optimizing algorithms while ignoring systems. The three pillars are a research agenda:

> "The next generation of agentic RL systems must be co-designed around these three pillars, and we sketch concrete architectures, case studies, and counter-arguments."

---

## 2. Related Work: Self-Evolving Agents Survey (arXiv:2507.21046)

### The "What, When, How" Framework

This 77-page survey (TMLR, Jan 2026) provides the theoretical foundation for the AReaL paper's systems-level argument. It organizes self-evolving agents along three dimensions:

#### What to Evolve
- **Model weights** (classic fine-tuning: SFT, RLHF, DPO, PPO)
- **Memory** (episodic memory, semantic memory, working memory updates)
- **Tools** (learn new tools, deprecate unused ones, optimize tool descriptions)
- **Architecture** (add/remove agents, change the DAG topology, merge agents)
- **In-context harness** (system prompts, few-shot examples, retrieval indices)

#### When to Evolve
- **Intra-test-time** (within a single agent run — e.g., chain-of-thought self-correction)
- **Inter-test-time** (across runs — e.g., update prompts based on yesterday's failures)
- **Periodic** (nightly fine-tuning jobs)
- **Event-driven** (trigger evolution when error rate crosses threshold)

#### How to Evolve
- **Scalar rewards** (RLHF, RLAIF, reward-model-based)
- **Textual feedback** (LLM-as-judge, natural language critique)
- **Self-play** (agent generates its own training data via exploration)
- **Single-agent** (one agent improving itself)
- **Multi-agent** (agents teaching each other, debate, society of minds)

### Key Insight for Busara

The survey reveals that Busara currently operates at **level 0** of self-evolution: agents are static, all evolution is manual (developer writes code, deploys). The AReaL paper shows how to reach **level 1** (automated weight/prompt updates from production data). The survey maps the full landscape up to **level 5** (autonomous multi-agent co-evolution).

---

## 3. Related Work: CLaaS — Continual Learning as a Service

### The Idea

CLaaS abstracts continual learning behind a chat API. Agents improve during deployment without the deployment team needing to understand RL. The system:
- Captures trajectories from production agent runs
- Identifies "learning moments" (failures, corrections, verifications)
- Triggers targeted fine-tuning on those moments
- Deploys the improved model behind the same API

### Key Insight for Busara

Busara could expose a "learn from this analysis" API: after a user runs an analysis, they can mark insights as "useful" or "not useful". That signal feeds back into agent config tuning without the user needing to understand anything about RL.

---

## 4. Related Work: Agent Observability (OpenTelemetry for GenAI)

### The Problem

The AReaL paper's Pillar 1 (trajectory data protocol) is closely related to the agent observability space. In 2026, the standard emerging is **OpenTelemetry GenAI semantic conventions** — a standardized way to trace LLM calls, tool calls, and agent reasoning steps.

### Key Components
- **Spans** for each LLM call (input, output, model, tokens, latency)
- **Spans** for each tool call (input, output, duration, error)
- **Trace** linking all spans in an agent run
- **Attributes** for custom metadata (agent_id, stage, config_version)

### Key Insight for Busara

Busara already has a Langfuse wrapper (`apps/web/src/lib/observability/langfuse.ts`). But it only traces at the LLM-call level, not the agent-step level. Upgrading to full OpenTelemetry GenAI compliance would make Busara's trajectory data portable across observability tools (Langfuse, Arize, Phoenix, MLflow).

---

## 5. Related Work: Multi-Agent DAG Orchestration

### Verified Multi-Agent Orchestration (Plan-Execute-Verify-Replan)

A 2026 paper on making multi-agent DAG execution more reliable:
- Decompose queries into a DAG of sub-questions
- Assign to domain-specific agents
- Execute in parallel with dependency-aware scheduling
- **Verify** each agent's output before passing to dependents
- **Replan** if verification fails (re-run with different config, or ask a different agent)

### Conductor: Deterministic Orchestration

Most frameworks make the orchestrator itself an LLM. Conductor argues for a **deterministic orchestrator** (code, not LLM) that routes work to agents. The LLM agents do the reasoning; the orchestrator does the plumbing.

### Key Insight for Busara

Busara's `DAGOrchestrator` is already deterministic (topological sort + parallel execution within stages). But it lacks **verification** (no output validation between stages) and **replanning** (if an agent fails, it just logs the error). Adding verification gates and replanning would make the pipeline much more robust.

---

## 6. Synthesis: What This Means for Busara

### Current State (Level 0 — Static)

- 33 agents, all static at deployment
- No trajectory capture beyond `AgentResult.output: unknown`
- No learning from production data
- No automated evolution (all changes are manual code deploys)
- Observability is LLM-call-level only (Langfuse)
- No verification gates between pipeline stages
- No replanning on failure

### Target State (Level 2 — Automated In-Context Evolution)

Based on the research, Busara should aim for:

#### A. Trajectory Data Protocol (Pillar 1)
- Every agent run captures a `Trajectory` object with step-level detail
- Each step records: observation, action, reward, causal metadata, context snapshot
- Stored in a queryable format (Postgres JSONB + indexes)
- Exportable in OpenTelemetry GenAI format

#### B. Data Proxy (Pillar 2)
- Filters production trajectories into training-ready datasets
- Governance: PII scrubbing (already have PrivacyScan agent!), quality scoring, dedup
- Reward labeling: explicit (user thumbs up/down) + implicit (was the insight cited? was the analysis shared? did the user return?)
- Retention policies + audit logging

#### C. Evolution Control Plane (Pillar 3)
- Monitors agent performance metrics across runs
- Auto-tunes config defaults based on what users actually set
- Auto-promotes agents from `beta` → `stable` based on success rate
- Detects drift (agent's output distribution changes unexpectedly)
- A/B tests new prompts/configs before full rollout

#### D. Verification + Replanning
- Each agent's output is validated against its `outputSchema` before passing to dependents
- If validation fails, retry with different config (up to N retries)
- If retries exhaust, fall back to a simpler agent or skip with a warning
- The orchestrator logs the replanning decision in the trajectory

#### E. Self-Improving Agents (the stretch goal)
- Agents that can propose their own config improvements based on trajectory analysis
- "I've run 500 times on sales data. When `sensitivity: 'high'`, my false positive rate is 40%. I recommend defaulting to `sensitivity: 'medium'` for sales data."
- Human-in-the-loop approval before auto-applying

---

## 7. Implementation Plan for Busara

### Phase A: Trajectory Data Protocol (NEW — the foundation)

Create `packages/agents/src/trajectory/`:

```
trajectory/
  types.ts          — Trajectory, TrajectoryStep, RewardSignal, CausalLink
  recorder.ts       — TrajectoryRecorder (wraps agent execution, captures steps)
  store.ts          — TrajectoryStore (persist to DB)
  query.ts          — TrajectoryQuery (filter, aggregate, export)
  otel.ts           — OpenTelemetry GenAI export adapter
  index.ts          — public API
```

**`Trajectory` shape:**
```typescript
interface Trajectory {
  id: string;
  analysisId: string;
  userId: string;
  workspaceId?: string;
  agentId: string;
  agentVersion: string;
  startedAt: string;
  completedAt?: string;
  status: 'running' | 'success' | 'failed' | 'cancelled';
  steps: TrajectoryStep[];
  reward?: RewardSignal;
  contextSnapshot: {
    systemPrompt: string;
    config: Record<string, unknown>;
    toolVersions: Record<string, string>;
  };
  metadata: {
    dataframeHash: string;  // for dedup
    rowCount: number;
    columnCount: number;
  };
}

interface TrajectoryStep {
  stepIndex: number;
  timestamp: string;
  type: 'observation' | 'action' | 'llm_call' | 'tool_call' | 'result';
  observation?: unknown;   // what the agent saw
  action?: unknown;        // what the agent did
  llmCall?: { provider: string; model: string; input: string; output: string; tokensIn: number; tokensOut: number; latencyMs: number };
  toolCall?: { tool: string; input: unknown; output: unknown; latencyMs: number; error?: string };
  result?: unknown;        // the step's output
  reward?: number;         // scalar reward for this step
  causalParentSteps?: number[];  // which prior steps influenced this one
}

interface RewardSignal {
  type: 'explicit' | 'implicit' | 'automated';
  source: 'user_thumbs_up' | 'user_cited_insight' | 'user_returned' | 'user_shared' | 'automated_quality_score';
  value: number;  // -1.0 to 1.0
  timestamp: string;
  metadata?: Record<string, unknown>;
}
```

### Phase B: Verification + Replanning (upgrade existing orchestrator)

Upgrade `packages/agents/src/orchestrator.ts`:
- After each agent executes, validate output against `metadata.outputSchema`
- If validation fails: retry with adjusted config (up to 3 retries)
- If retries exhaust: mark as failed, continue pipeline, log replanning decision
- Add `VerificationGate` interface that agents can implement

### Phase C: Data Proxy (new package)

Create `packages/data-proxy/`:
- Ingests trajectories from the recorder
- PII scrubs (leverages existing PrivacyScan agent logic)
- Quality scores (automated reward model — heuristics first, LLM-as-judge later)
- Dedup by dataframe hash + agent ID + config hash
- Exposes filtered datasets for training/analysis

### Phase D: Evolution Control Plane (new package)

Create `packages/evolution/`:
- Monitors agent performance metrics (success rate, duration, reward distribution)
- Drift detection (KS test on output distributions)
- Auto-promotion rules (beta → stable after 100 successful runs with >90% success rate)
- Config optimization (track which config values correlate with high rewards)
- A/B test framework (route X% of traffic to experimental config)

### Phase E: Self-Improving Agent Mixin (stretch)

Add `SelfImproving` mixin to `BaseAgent`:
- After execution, agent can call `this.proposeConfigImprovement(suggestion)` 
- Suggestions are logged for human review
- After approval, the agent's default config is updated

---

## 8. Other Amazing Papers (Bonus Research)

While researching, I found these additional papers worth studying:

1. **"A Systematic Survey of Self-Evolving Agents: From Model-Centric to Environment-Driven Co-Evolution"** (ResearchGate, 2026) — extends the survey with environment-agent co-evolution
2. **"Contextual Drag: How Errors in the Context Affect LLM Reasoning"** (ICLR 2026 Workshop) — why trajectory errors compound and how to prevent it
3. **KPop: Bidirectional Binary KL Divergence Token Masking** (AReaL blog, June 2026) — a new RL training technique for token-level reward attribution
4. **OpenClaw** — individual-user self-evolving agent (referenced in the AReaL paper as the consumer counterpart to enterprise AReaL)
5. **Conductor: Deterministic Orchestration for Multi-Agent AI Workflows** — argues the orchestrator should be code, not an LLM
6. **CLaaS: Continual Learning as a Service** — abstracts continual learning behind a chat API
7. **ASearcher** (inclusionAI) — search agent trained with AReaL, state-of-the-art on search benchmarks
8. **Scaffolding** (NVIDIA TensorRT-LLM) — agent scaffolding framework integrated with AReaL

---

## 9. Citation

```bibtex
@article{yan2026areal,
  title={Next-Generation Agentic Reinforcement Learning Systems Enable Self-Evolving Agents},
  author={Yan, Ran and Fu, Wei and Li, Jiale and Xu, Shusheng and Mei, Zhiyu and Gao, Jiaxuan and Zhang, Jiarui and Zhang, Wentai and Dai, Hao and Shen, Xujie and He, Chuyi and Pu, Zhen and Mei, Jun and Lin, Zhiyao and Wang, Haitao and Ding, Zhiqiang and Zhang, Jiawei and Wang, Huaijie and Xu, Ruida and Dong, Honghua and Jiang, Youhe and Wu, Yi and Yang, Tongkai and Yuan, Binhang},
  journal={arXiv preprint arXiv:2607.01120},
  year={2026}
}

@article{gao2025survey,
  title={A Survey of Self-Evolving Agents: What, When, How, and Where to Evolve on the Path to Artificial Super Intelligence},
  author={Gao, Huan-ang and others},
  journal={Transactions on Machine Learning Research},
  year={2026}
}
```

---

## 10. Conclusion

The AReaL paper's core insight — that **systems, not algorithms, are the bottleneck** for self-evolving agents — maps directly onto Busara's architecture. Busara already has the 33-agent framework, the DAG orchestrator, and the observability wrapper. What it lacks is:

1. **Trajectory capture** at step granularity (Pillar 1)
2. **A data proxy** to convert production runs into learning data (Pillar 2)
3. **An evolution control plane** to automate improvement decisions (Pillar 3)
4. **Verification gates** between pipeline stages
5. **Replanning** on failure

Implementing these would move Busara from "static agent platform" to "self-evolving agent platform" — a generational leap in capability. The implementation plan in §7 details how to do it incrementally, with each phase delivering standalone value.
