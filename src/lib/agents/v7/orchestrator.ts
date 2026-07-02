/**
 * Busara v7.0 — DAG Orchestrator
 * ================================
 *
 * Type-safe DAG-based execution engine for 50+ agents.
 *
 * Features:
 * - Topological sort with Kahn's algorithm
 * - Parallel execution within stages (agents with no inter-deps run concurrently)
 * - Circuit breakers per agent
 * - Timeout management
 * - Real-time progress broadcasting
 * - Dependency failure cascade (skip downstream if upstream fails)
 * - Execution metrics collection
 */

import {
  BaseAgent,
  AgentContext,
  AgentResult,
  AgentMetadata,
  ProgressCallback,
  CircuitBreaker,
  SmartCache,
  AgentStatus,
  AnalysisConfig,
} from './core';

export interface ExecutionPlan {
  stages: AgentMetadata[][];
  totalAgents: number;
}

export interface ExecutionSummary {
  status: 'success' | 'partial' | 'failed';
  results: Map<string, AgentResult>;
  totalDurationMs: number;
  agentsSucceeded: number;
  agentsFailed: number;
  agentsSkipped: number;
  stageTimings: Record<number, number>;
  cacheStats: { size: number; maxSize: number; hitRate: number };
}

export class DAGOrchestrator {
  private agents: Map<string, BaseAgent> = new Map();
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private cache: SmartCache<AgentResult> = new SmartCache(500, 60 * 60 * 1000);

  /**
   * Register an agent with the orchestrator.
   */
  register(agent: BaseAgent): void {
    this.agents.set(agent.metadata.id, agent);
    this.circuitBreakers.set(agent.metadata.id, new CircuitBreaker(3, 60000));
  }

  /**
   * Register multiple agents.
   */
  registerAll(agents: BaseAgent[]): void {
    for (const agent of agents) this.register(agent);
  }

  /**
   * Get all registered agent metadata.
   */
  getAgentMetadata(): AgentMetadata[] {
    return Array.from(this.agents.values()).map(a => a.metadata);
  }

  /**
   * Build an execution plan: topologically sort agents into stages.
   * Agents in the same stage can run in parallel.
   */
  buildExecutionPlan(enabledAgentIds?: string[]): ExecutionPlan {
    const allMeta = this.getAgentMetadata();

    // Filter to enabled agents + their dependencies
    let activeIds: Set<string>;
    if (enabledAgentIds && enabledAgentIds.length > 0) {
      activeIds = new Set();
      const expand = (id: string) => {
        if (activeIds.has(id)) return;
        const agent = this.agents.get(id);
        if (!agent) return;
        activeIds.add(id);
        for (const dep of agent.metadata.dependencies) expand(dep);
      };
      enabledAgentIds.forEach(expand);
    } else {
      activeIds = new Set(allMeta.map(m => m.id));
    }

    // Kahn's algorithm for topological sort
    const inDegree = new Map<string, number>();
    const adjList = new Map<string, string[]>();

    for (const id of activeIds) {
      inDegree.set(id, 0);
      adjList.set(id, []);
    }

    for (const id of activeIds) {
      const agent = this.agents.get(id);
      if (!agent) continue;
      for (const dep of agent.metadata.dependencies) {
        if (activeIds.has(dep)) {
          inDegree.set(id, (inDegree.get(id) ?? 0) + 1);
          adjList.get(dep)?.push(id);
        }
      }
    }

    // Group into stages by topological level
    const stages: string[][] = [];
    const processed = new Set<string>();
    let currentLevel = Array.from(activeIds).filter(id => (inDegree.get(id) ?? 0) === 0);

    while (currentLevel.length > 0) {
      stages.push(currentLevel);
      for (const id of currentLevel) processed.add(id);

      const nextLevel: string[] = [];
      for (const id of currentLevel) {
        for (const neighbor of adjList.get(id) ?? []) {
          const newDegree = (inDegree.get(neighbor) ?? 0) - 1;
          inDegree.set(neighbor, newDegree);
          if (newDegree === 0 && !processed.has(neighbor)) {
            nextLevel.push(neighbor);
          }
        }
      }
      currentLevel = nextLevel;
    }

    // Convert to metadata
    const stageMeta: AgentMetadata[][] = stages.map(stage =>
      stage
        .map(id => this.agents.get(id)?.metadata)
        .filter((m): m is AgentMetadata => m !== undefined)
        .sort((a, b) => a.stageNumber - b.stageNumber)
    );

    return {
      stages: stageMeta,
      totalAgents: processed.size,
    };
  }

  /**
   * Execute the full pipeline.
   */
  async execute(opts: {
    analysisId: string;
    dataframe: Record<string, any>[];
    config: AnalysisConfig;
    metadata?: Record<string, any>;
    userId?: string;
    enabledAgents?: string[];
    onProgress?: ProgressCallback;
  }): Promise<ExecutionSummary> {
    const startTime = Date.now();
    const results = new Map<string, AgentResult>();
    const stageTimings: Record<number, number> = {};
    const plan = this.buildExecutionPlan(opts.enabledAgents);

    const baseContext: Omit<AgentContext, 'previousResults'> = {
      analysisId: opts.analysisId,
      dataframe: opts.dataframe,
      metadata: opts.metadata ?? {},
      config: opts.config,
      userId: opts.userId,
      startedAt: new Date().toISOString(),
    };

    let agentsSucceeded = 0;
    let agentsFailed = 0;
    let agentsSkipped = 0;

    for (let stageIdx = 0; stageIdx < plan.stages.length; stageIdx++) {
      const stageAgents = plan.stages[stageIdx];
      const stageStart = Date.now();
      const stageNumber = stageAgents[0]?.stageNumber ?? stageIdx;

      const tasks: Promise<AgentResult>[] = [];

      for (const meta of stageAgents) {
        const agent = this.agents.get(meta.id);
        if (!agent) continue;

        const cb = this.circuitBreakers.get(meta.id);

        // Check circuit breaker
        if (cb?.isOpen()) {
          const result: AgentResult = {
            agentId: meta.id,
            agentName: meta.name,
            status: 'skipped',
            output: null,
            metrics: {},
            executionTimeMs: 0,
            error: 'circuit_breaker_open',
            timestamp: new Date().toISOString(),
          };
          results.set(meta.id, result);
          agentsSkipped++;
          opts.onProgress?.({
            analysisId: opts.analysisId,
            agentId: meta.id,
            agentName: meta.name,
            stage: meta.stage,
            stageNumber,
            status: 'skipped',
            progress: 0,
            error: 'circuit_breaker_open',
            timestamp: new Date().toISOString(),
          });
          continue;
        }

        // Check dependency failures
        const failedDeps = meta.dependencies.filter(dep => {
          const depResult = results.get(dep);
          return depResult && depResult.status !== 'success';
        });

        if (failedDeps.length > 0) {
          const result: AgentResult = {
            agentId: meta.id,
            agentName: meta.name,
            status: 'skipped',
            output: null,
            metrics: {},
            executionTimeMs: 0,
            error: `Dependencies failed: ${failedDeps.join(', ')}`,
            timestamp: new Date().toISOString(),
          };
          results.set(meta.id, result);
          agentsSkipped++;
          opts.onProgress?.({
            analysisId: opts.analysisId,
            agentId: meta.id,
            agentName: meta.name,
            stage: meta.stage,
            stageNumber,
            status: 'skipped',
            progress: 0,
            error: result.error,
            timestamp: new Date().toISOString(),
          });
          continue;
        }

        // Build context with dependency results
        const previousResults = new Map<string, AgentResult>();
        for (const dep of meta.dependencies) {
          const depResult = results.get(dep);
          if (depResult) previousResults.set(dep, depResult);
        }

        const ctx: AgentContext = {
          ...baseContext,
          previousResults,
        };

        tasks.push(
          this.runAgentWithTimeout(agent, ctx, stageNumber, opts.onProgress, opts.analysisId),
        );
      }

      // Execute stage in parallel
      if (tasks.length > 0) {
        const stageResults = await Promise.allSettled(tasks);
        for (const r of stageResults) {
          if (r.status === 'fulfilled') {
            const result = r.value;
            results.set(result.agentId, result);
            if (result.status === 'success') agentsSucceeded++;
            else if (result.status === 'skipped') agentsSkipped++;
            else agentsFailed++;
          }
        }
      }

      stageTimings[stageNumber] = Date.now() - stageStart;
    }

    const status: 'success' | 'partial' | 'failed' =
      agentsFailed === 0 ? 'success' : agentsSucceeded > agentsFailed ? 'partial' : 'failed';

    return {
      status,
      results,
      totalDurationMs: Date.now() - startTime,
      agentsSucceeded,
      agentsFailed,
      agentsSkipped,
      stageTimings,
      cacheStats: this.cache.stats(),
    };
  }

  private async runAgentWithTimeout(
    agent: BaseAgent,
    ctx: AgentContext,
    stageNumber: number,
    onProgress?: ProgressCallback,
    analysisId?: string,
  ): Promise<AgentResult> {
    const meta = agent.metadata;
    const cb = this.circuitBreakers.get(meta.id)!;
    const start = Date.now();

    // Check cache
    const cacheKey = this.buildCacheKey(agent, ctx);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return { ...cached, executionTimeMs: 0 };
    }

    onProgress?.({
      analysisId: analysisId ?? '',
      agentId: meta.id,
      agentName: meta.name,
      stage: meta.stage,
      stageNumber,
      status: 'running',
      progress: 0,
      timestamp: new Date().toISOString(),
    });

    try {
      const result = await this.withTimeout(agent.execute(ctx), meta.timeoutMs);
      const durationMs = Date.now() - start;

      const finalResult: AgentResult = {
        ...result,
        executionTimeMs: durationMs,
      };

      cb.recordSuccess();
      this.cache.set(cacheKey, finalResult);

      onProgress?.({
        analysisId: analysisId ?? '',
        agentId: meta.id,
        agentName: meta.name,
        stage: meta.stage,
        stageNumber,
        status: 'success',
        progress: 100,
        result: finalResult,
        durationMs,
        timestamp: new Date().toISOString(),
      });

      return finalResult;
    } catch (err: any) {
      const durationMs = Date.now() - start;
      cb.recordFailure();
      const error = err?.message ?? String(err);
      const status: AgentStatus = err?.name === 'TimeoutError' ? 'timeout' : 'failed';

      const result: AgentResult = {
        agentId: meta.id,
        agentName: meta.name,
        status,
        output: null,
        metrics: {},
        executionTimeMs: durationMs,
        error,
        timestamp: new Date().toISOString(),
      };

      onProgress?.({
        analysisId: analysisId ?? '',
        agentId: meta.id,
        agentName: meta.name,
        stage: meta.stage,
        stageNumber,
        status,
        progress: 0,
        error,
        durationMs,
        timestamp: new Date().toISOString(),
      });

      return result;
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

  private buildCacheKey(agent: BaseAgent, ctx: AgentContext): string {
    // Cache key based on agent ID + data hash + config
    const dataHash = ctx.dataframe.length.toString();
    const configHash = JSON.stringify(ctx.config).length.toString();
    return `${agent.metadata.id}:${dataHash}:${configHash}`;
  }
}
