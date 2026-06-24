// Parallel DAG-based Agent Executor
// Topologically sorts agents by dependencies and runs independent agents concurrently.

import { Agent, AgentExecutionContext, AgentExecutionResult, BroadcastFn, CircuitBreaker, ProgressBroadcast, AgentStatus } from './core';

export interface AgentNode {
  agentId: string;
  dependsOn: string[];
  stage: number;
  timeoutMs: number;
}

// ─── The 20-Agent Execution DAG ────────────────────────────────────────────
// Stages:
//   0 – Independent intake agents (parallel)
//   1 – Data engineering depends on scout
//   2 – Analytical agents depend on engineer (parallel)
//   3 – Synthesis agents depend on stage 2 (parallel)
//   4 – Final reporting depends on stage 3
//   5 – Orchestrator compiles everything
export const AGENT_DAG: Record<string, AgentNode> = {
  // Stage 0 — Intake (parallel)
  data_quality_guardian: { agentId: 'data_quality_guardian', dependsOn: [], stage: 0, timeoutMs: 15000 },
  data_scout: { agentId: 'data_scout', dependsOn: [], stage: 0, timeoutMs: 15000 },
  nlq_interpreter: { agentId: 'nlq_interpreter', dependsOn: [], stage: 0, timeoutMs: 10000 },
  privacy_guardian: { agentId: 'privacy_guardian', dependsOn: [], stage: 0, timeoutMs: 10000 },

  // Stage 1 — Engineering
  data_engineer: { agentId: 'data_engineer', dependsOn: ['data_scout', 'data_quality_guardian'], stage: 1, timeoutMs: 30000 },

  // Stage 2 — Deep analytics (parallel)
  analysis_strategist: { agentId: 'analysis_strategist', dependsOn: ['data_engineer'], stage: 2, timeoutMs: 20000 },
  anomaly_sentinel: { agentId: 'anomaly_sentinel', dependsOn: ['data_engineer'], stage: 2, timeoutMs: 30000 },
  forecasting_oracle: { agentId: 'forecasting_oracle', dependsOn: ['data_engineer'], stage: 2, timeoutMs: 30000 },
  causal_architect: { agentId: 'causal_architect', dependsOn: ['data_engineer'], stage: 2, timeoutMs: 30000 },
  knowledge_graph_builder: { agentId: 'knowledge_graph_builder', dependsOn: ['data_engineer'], stage: 2, timeoutMs: 20000 },
  benchmark_agent: { agentId: 'benchmark_agent', dependsOn: ['data_scout', 'data_quality_guardian'], stage: 2, timeoutMs: 15000 },
  auto_ml_agent: { agentId: 'auto_ml_agent', dependsOn: ['data_engineer'], stage: 2, timeoutMs: 30000 },

  // Stage 3 — Synthesis (parallel)
  insight_generator: {
    agentId: 'insight_generator',
    dependsOn: ['analysis_strategist', 'anomaly_sentinel', 'forecasting_oracle', 'causal_architect', 'data_scout'],
    stage: 3, timeoutMs: 30000,
  },
  explainability_agent: {
    agentId: 'explainability_agent',
    dependsOn: ['auto_ml_agent', 'causal_architect'],
    stage: 3, timeoutMs: 20000,
  },
  visualization_specialist: {
    agentId: 'visualization_specialist',
    dependsOn: ['analysis_strategist', 'causal_architect', 'data_scout'],
    stage: 3, timeoutMs: 25000,
  },
  synthetic_data_generator: {
    agentId: 'synthetic_data_generator',
    dependsOn: ['data_engineer', 'privacy_guardian'],
    stage: 3, timeoutMs: 25000,
  },
  code_generator: {
    agentId: 'code_generator',
    dependsOn: ['analysis_strategist'],
    stage: 3, timeoutMs: 15000,
  },

  // Stage 4 — Reporting
  narrative_composer: {
    agentId: 'narrative_composer',
    dependsOn: ['insight_generator', 'visualization_specialist', 'explainability_agent', 'data_scout', 'data_quality_guardian'],
    stage: 4, timeoutMs: 25000,
  },
  conversational_analyst: {
    agentId: 'conversational_analyst',
    dependsOn: ['insight_generator', 'narrative_composer', 'data_scout'],
    stage: 4, timeoutMs: 15000,
  },

  // Stage 5 — Final
  orchestrator: {
    agentId: 'orchestrator',
    dependsOn: ['narrative_composer', 'conversational_analyst', 'data_quality_guardian', 'benchmark_agent'],
    stage: 5, timeoutMs: 15000,
  },
};

export class ParallelAgentExecutor {
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();

  constructor(
    private agents: Map<string, Agent>,
    private broadcast: BroadcastFn = () => {},
  ) {
    for (const id of agents.keys()) {
      this.circuitBreakers.set(id, new CircuitBreaker(3, 60000));
    }
  }

  async runFullPipeline(opts: {
    analysisId: string;
    analysisConfig: Record<string, any>;
    fileContents: any[];
    rawFiles?: { name: string; type: string; size: number }[];
    nlqQuery?: string;
    objectives?: string[];
    userId?: string;
    enabledAgents?: string[]; // if provided, run only these agents + their deps
  }): Promise<{
    status: 'success' | 'partial' | 'failed';
    results: Record<string, AgentExecutionResult>;
    execution: {
      totalDurationMs: number;
      agentsSucceeded: number;
      agentsFailed: number;
      agentsSkipped: number;
      stageTimings: Record<number, number>;
    };
  }> {
    const startTime = Date.now();
    const results: Record<string, AgentExecutionResult> = {};
    const completed: Set<string> = new Set();
    const stageTimings: Record<number, number> = {};

    const enabled = opts.enabledAgents && opts.enabledAgents.length > 0
      ? this.expandWithDependencies(opts.enabledAgents)
      : Object.keys(AGENT_DAG);

    // Build shared context
    const baseContext: Omit<AgentExecutionContext, 'dependencyResults'> = {
      analysisId: opts.analysisId,
      analysisConfig: opts.analysisConfig,
      fileContents: opts.fileContents,
      rawFiles: opts.rawFiles,
      nlqQuery: opts.nlqQuery,
      objectives: opts.objectives,
      startedAt: new Date().toISOString(),
      userId: opts.userId,
    };

    // Group by stage
    const stages: Record<number, string[]> = {};
    for (const agentId of enabled) {
      const node = AGENT_DAG[agentId];
      if (!node) continue;
      if (!stages[node.stage]) stages[node.stage] = [];
      stages[node.stage].push(agentId);
    }

    for (const stageNum of Object.keys(stages).map(Number).sort((a, b) => a - b)) {
      const stageAgents = stages[stageNum];
      const stageStart = Date.now();

      const tasks: Promise<AgentExecutionResult>[] = [];
      for (const agentId of stageAgents) {
        const node = AGENT_DAG[agentId];
        const cb = this.circuitBreakers.get(agentId);
        if (cb?.isOpen()) {
          this.broadcast({
            analysisId: opts.analysisId, agentId, agentName: this.agents.get(agentId)?.name ?? agentId,
            status: 'skipped', progress: 0, stage: stageNum, error: 'circuit_breaker_open',
            timestamp: new Date().toISOString(),
          });
          results[agentId] = {
            agentId, agentName: this.agents.get(agentId)?.name ?? agentId,
            success: false, result: null, durationMs: 0,
            error: 'circuit_breaker_open', status: 'skipped',
          };
          continue;
        }

        // Check dependency failures
        const failedDeps = node.dependsOn.filter(d => results[d] && !results[d].success);
        if (failedDeps.length > 0) {
          this.broadcast({
            analysisId: opts.analysisId, agentId, agentName: this.agents.get(agentId)?.name ?? agentId,
            status: 'skipped', progress: 0, stage: stageNum, error: `Dependencies failed: ${failedDeps.join(', ')}`,
            timestamp: new Date().toISOString(),
          });
          results[agentId] = {
            agentId, agentName: this.agents.get(agentId)?.name ?? agentId,
            success: false, result: null, durationMs: 0,
            error: `Dependencies failed: ${failedDeps.join(', ')}`, status: 'skipped',
          };
          continue;
        }

        const depResults: Record<string, any> = {};
        for (const dep of node.dependsOn) {
          if (results[dep] && results[dep].success) depResults[dep] = results[dep].result;
        }

        const ctx: AgentExecutionContext = {
          ...baseContext,
          dependencyResults: depResults,
        };

        tasks.push(this.runAgentWithCircuitBreaker(agentId, ctx, stageNum, node.timeoutMs, opts.analysisId));
      }

      if (tasks.length > 0) {
        const stageResults = await Promise.allSettled(tasks);
        for (const r of stageResults) {
          if (r.status === 'fulfilled') {
            results[r.value.agentId] = r.value;
            completed.add(r.value.agentId);
          }
        }
      }

      stageTimings[stageNum] = Date.now() - stageStart;
    }

    const succeeded = Object.values(results).filter(r => r.success).length;
    const failed = Object.values(results).filter(r => !r.success && r.status !== 'skipped').length;
    const skipped = Object.values(results).filter(r => r.status === 'skipped').length;

    return {
      status: failed === 0 ? 'success' : succeeded > failed ? 'partial' : 'failed',
      results,
      execution: {
        totalDurationMs: Date.now() - startTime,
        agentsSucceeded: succeeded,
        agentsFailed: failed,
        agentsSkipped: skipped,
        stageTimings,
      },
    };
  }

  private async runAgentWithCircuitBreaker(
    agentId: string,
    ctx: AgentExecutionContext,
    stage: number,
    timeoutMs: number,
    analysisId: string,
  ): Promise<AgentExecutionResult> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return {
        agentId, agentName: agentId, success: false, result: null,
        durationMs: 0, error: `Agent ${agentId} not found`, status: 'failed',
      };
    }
    const cb = this.circuitBreakers.get(agentId)!;
    const start = Date.now();

    this.broadcast({
      analysisId, agentId, agentName: agent.name,
      status: 'running', progress: 0, stage, timestamp: new Date().toISOString(),
    });

    try {
      const result = await this.withTimeout(agent.execute(ctx), timeoutMs);
      const durationMs = Date.now() - start;
      cb.recordSuccess();
      this.broadcast({
        analysisId, agentId, agentName: agent.name,
        status: 'completed', progress: 100, stage, result,
        timestamp: new Date().toISOString(), durationMs,
      });
      return { agentId, agentName: agent.name, success: true, result, durationMs, status: 'completed' };
    } catch (err: any) {
      const durationMs = Date.now() - start;
      cb.recordFailure();
      const error = err?.message ?? String(err);
      const status: AgentStatus = err?.name === 'TimeoutError' ? 'timeout' : 'failed';
      this.broadcast({
        analysisId, agentId, agentName: agent.name,
        status, progress: 0, stage, error,
        timestamp: new Date().toISOString(), durationMs,
      });
      return { agentId, agentName: agent.name, success: false, result: null, durationMs, error, status };
    }
  }

  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(Object.assign(new Error(`Timeout after ${ms}ms`), { name: 'TimeoutError' }));
      }, ms);
      promise.then(
        v => { clearTimeout(timer); resolve(v); },
        e => { clearTimeout(timer); reject(e); },
      );
    });
  }

  private expandWithDependencies(agentIds: string[]): string[] {
    const result = new Set<string>();
    const visit = (id: string) => {
      if (result.has(id)) return;
      const node = AGENT_DAG[id];
      if (!node) return;
      result.add(id);
      node.dependsOn.forEach(visit);
    };
    agentIds.forEach(visit);
    return Array.from(result);
  }
}
