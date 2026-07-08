/**
 * Busara Orchestrator
 * ===================
 * 
 * DAG-based execution engine for multi-agent workflows.
 * Features:
 * - Topological sort with Kahn's algorithm
 * - Parallel execution within stages
 * - Circuit breakers per agent
 * - Timeout management
 * - Real-time progress broadcasting
 * - Dependency failure cascade
 * - Execution metrics collection
 * - Persistent state management
 */

import type {
  AgentMetadata,
  AgentResult,
  AgentStatus,
  AgentStage,
  AnalysisConfig,
  ProgressUpdate,
  ID,
  ISODateString,
} from '@busara/core';
import {
  BaseAgent,
  EnhancedAgentContext,
  EnhancedAgentMetadata,
  AgentExecutionOptions,
  AgentLogger,
  AgentMetricsCollector,
  AgentCache,
} from './core';

// ============================================================================
// Types
// ============================================================================

/** Execution plan for a workflow */
export interface ExecutionPlan {
  stages: EnhancedAgentMetadata[][];
  totalAgents: number;
  executionOrder: string[];
}

/** Execution summary */
export interface ExecutionSummary {
  status: 'success' | 'partial' | 'failed' | 'cancelled';
  results: Map<string, AgentResult>;
  totalDurationMs: number;
  agentsSucceeded: number;
  agentsFailed: number;
  agentsSkipped: number;
  agentsTimedOut: number;
  stageTimings: Record<number, number>;
  cacheStats: {
    hits: number;
    misses: number;
    hitRate: number;
    size?: number;
    maxSize?: number;
  };
}

/** Execution state */
export interface ExecutionState {
  analysisId: ID;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  startedAt: ISODateString;
  completedAt?: ISODateString;
  currentStage: number;
  completedStages: number[];
  agentStates: Map<string, AgentStatus>;
  results: Map<string, AgentResult>;
  errors: Map<string, string>;
  progress: number;
}

/** Orchestrator configuration */
export interface OrchestratorConfig {
  maxConcurrentAgents?: number;
  defaultTimeoutMs?: number;
  defaultRetryPolicy?: {
    maxAttempts: number;
    baseDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier: number;
  };
  enableCaching?: boolean;
  cacheTTLMs?: number;
  enableProgressBroadcast?: boolean;
  enableMetrics?: boolean;
  logger?: AgentLogger;
  metrics?: AgentMetricsCollector;
  cache?: AgentCache;
}

/** Progress callback */
export type ProgressCallback = (update: ProgressUpdate) => void;

/** Agent executor function */
export type AgentExecutor = (
  agent: BaseAgent,
  context: EnhancedAgentContext
) => Promise<AgentResult>;

// ============================================================================
// Circuit Breaker
// ============================================================================

/**
 * CircuitBreaker implements the circuit breaker pattern for agent execution.
 * It prevents cascading failures by stopping execution after a threshold of failures.
 */
export class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half_open' = 'closed';
  
  constructor(
    private readonly failureThreshold: number = 3,
    private readonly resetTimeoutMs: number = 60000
  ) {}
  
  /**
   * Check if the circuit breaker is open
   */
  isOpen(): boolean {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.resetTimeoutMs) {
        this.state = 'half_open';
        return false;
      }
      return true;
    }
    return false;
  }
  
  /**
   * Record a successful execution
   */
  recordSuccess(): void {
    this.failureCount = 0;
    this.state = 'closed';
  }
  
  /**
   * Record a failed execution
   */
  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'open';
    }
  }
  
  /**
   * Get the current state
   */
  getState(): 'closed' | 'open' | 'half_open' {
    return this.state;
  }
  
  /**
   * Get failure count
   */
  getFailureCount(): number {
    return this.failureCount;
  }
  
  /**
   * Reset the circuit breaker
   */
  reset(): void {
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.state = 'closed';
  }
}

// ============================================================================
// Smart Cache
// ============================================================================

/**
 * SmartCache provides intelligent caching for agent results.
 * It supports TTL-based expiration and size-based eviction.
 */
export class SmartCache<T = AgentResult> {
  private cache = new Map<string, { value: T; expiresAt: number }>();
  private hits = 0;
  private misses = 0;
  
  constructor(
    private readonly maxSize: number = 1000,
    private readonly defaultTTLMs: number = 60 * 60 * 1000
  ) {}
  
  /**
   * Get a value from the cache
   */
  async get(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.misses++;
      return null;
    }
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }
    
    this.hits++;
    return entry.value;
  }
  
  /**
   * Set a value in the cache
   */
  async set(key: string, value: T, ttlMs?: number): Promise<void> {
    // Evict oldest entries if cache is full
    while (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
    
    const expiresAt = Date.now() + (ttlMs ?? this.defaultTTLMs);
    this.cache.set(key, { value, expiresAt });
  }
  
  /**
   * Delete a value from the cache
   */
  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }
  
  /**
   * Check if a key exists in the cache
   */
  async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }
  
  /**
   * Clear the cache
   */
  async clear(): Promise<void> {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }
  
  /**
   * Get cache statistics
   */
  getStats(): { size: number; hits: number; misses: number; hitRate: number } {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }
}

// ============================================================================
// DAG Orchestrator
// ============================================================================

/**
 * DAGOrchestrator manages the execution of agents in a DAG-based workflow.
 * It handles dependency resolution, parallel execution, and error handling.
 */
export class DAGOrchestrator {
  private agents = new Map<string, BaseAgent>();
  private circuitBreakers = new Map<string, CircuitBreaker>();
  private cache: AgentCache;
  private logger: AgentLogger;
  private metrics: AgentMetricsCollector;
  private config: Required<OrchestratorConfig>;
  
  constructor(config: OrchestratorConfig = {}) {
    this.config = {
      maxConcurrentAgents: config.maxConcurrentAgents ?? 10,
      defaultTimeoutMs: config.defaultTimeoutMs ?? 30000,
      defaultRetryPolicy: config.defaultRetryPolicy ?? {
        maxAttempts: 3,
        baseDelayMs: 1000,
        maxDelayMs: 30000,
        backoffMultiplier: 2,
      },
      enableCaching: config.enableCaching ?? true,
      cacheTTLMs: config.cacheTTLMs ?? 60 * 60 * 1000,
      enableProgressBroadcast: config.enableProgressBroadcast ?? true,
      enableMetrics: config.enableMetrics ?? true,
      logger: config.logger ?? this.createDefaultLogger(),
      metrics: config.metrics ?? this.createDefaultMetrics(),
      cache: config.cache ?? this.createDefaultCache(),
    };
    
    this.logger = this.config.logger.child({ component: 'DAGOrchestrator' });
    this.metrics = this.config.metrics;
    this.cache = this.config.cache;
  }
  
  private createDefaultLogger(): AgentLogger {
    return {
      debug: (message, data) => console.debug(`[DEBUG] ${message}`, data),
      info: (message, data) => console.info(`[INFO] ${message}`, data),
      warn: (message, data) => console.warn(`[WARN] ${message}`, data),
      error: (message, error, data) => console.error(`[ERROR] ${message}`, error, data),
      child: (context) => this.createDefaultLogger(),
    };
  }
  
  private createDefaultMetrics(): AgentMetricsCollector {
    return {
      startTimer: () => {},
      endTimer: () => 0,
      increment: () => {},
      decrement: () => {},
      set: () => {},
      observe: () => {},
      getMetrics: () => ({}),
    };
  }
  
  private createDefaultCache(): AgentCache {
    return {
      get: async () => null,
      set: async () => {},
      delete: async () => {},
      has: async () => false,
      clear: async () => {},
      getStats: () => ({ hits: 0, misses: 0, hitRate: 0, size: 0, maxSize: 0 }),
    };
  }
  
  /**
   * Register an agent with the orchestrator
   */
  register(agent: BaseAgent): void {
    this.agents.set(agent.metadata.id, agent);
    this.circuitBreakers.set(
      agent.metadata.id,
      new CircuitBreaker(
        this.config.defaultRetryPolicy.maxAttempts,
        this.config.defaultRetryPolicy.maxDelayMs
      )
    );
    
    this.logger.info(`Registered agent: ${agent.metadata.id} (${agent.metadata.name})`);
  }
  
  /**
   * Register multiple agents
   */
  registerAll(agents: BaseAgent[]): void {
    for (const agent of agents) {
      this.register(agent);
    }
  }
  
  /**
   * Unregister an agent
   */
  unregister(agentId: string): boolean {
    const hadAgent = this.agents.has(agentId);
    this.agents.delete(agentId);
    this.circuitBreakers.delete(agentId);
    
    if (hadAgent) {
      this.logger.info(`Unregistered agent: ${agentId}`);
    }
    
    return hadAgent;
  }
  
  /**
   * Get all registered agent metadata
   */
  getAgentMetadata(): EnhancedAgentMetadata[] {
    return Array.from(this.agents.values()).map(a => a.metadata);
  }
  
  /**
   * Get an agent by ID
   */
  getAgent(agentId: string): BaseAgent | null {
    return this.agents.get(agentId) ?? null;
  }
  
  /**
   * Check if an agent is registered
   */
  hasAgent(agentId: string): boolean {
    return this.agents.has(agentId);
  }
  
  /**
   * Build an execution plan from enabled agent IDs
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
    
    // Create execution order (flatten stages)
    const executionOrder = stages.flat();
    
    // Convert to metadata
    const stageMeta: EnhancedAgentMetadata[][] = stages.map(stage =>
      stage
        .map(id => this.agents.get(id)?.metadata)
        .filter((m): m is EnhancedAgentMetadata => m !== undefined)
        .sort((a, b) => (a?.stageNumber ?? 0) - (b?.stageNumber ?? 0))
    );
    
    return {
      stages: stageMeta,
      totalAgents: processed.size,
      executionOrder,
    };
  }
  
  /**
   * Execute a single agent
   */
  private async executeAgent(
    agentId: string,
    context: EnhancedAgentContext,
    progressCallback?: ProgressCallback
  ): Promise<AgentResult> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return {
        agentId,
        agentName: agentId,
        status: 'failed',
        output: null,
        metrics: {},
        executionTimeMs: 0,
        error: `Agent not found: ${agentId}`,
        timestamp: new Date().toISOString(),
      };
    }
    
    const circuitBreaker = this.circuitBreakers.get(agentId);
    if (circuitBreaker?.isOpen()) {
      return {
        agentId,
        agentName: agent.metadata.name,
        status: 'skipped',
        output: null,
        metrics: {},
        executionTimeMs: 0,
        error: 'Circuit breaker is open',
        timestamp: new Date().toISOString(),
      };
    }
    
    // Check cache
    const cacheKey = `${context.analysisId}:${agentId}`;
    if (this.config.enableCaching && context.options.useCache !== false) {
      const cached = await this.cache.get<AgentResult>(cacheKey);
      if (cached) {
        this.logger.debug(`Cache hit for agent: ${agentId}`);
        progressCallback?.({
          analysisId: context.analysisId,
          agentId,
          agentName: agent.metadata.name,
          stage: agent.metadata.stage,
          stageNumber: agent.metadata.stageNumber,
          status: 'success',
          progress: 100,
          timestamp: new Date().toISOString(),
          durationMs: 0,
        });
        return { ...cached, cached: true, cacheKey };
      }
    }
    
    // Create execution context
    const executionContext: EnhancedAgentContext = {
      ...context,
      agentId,
      logger: this.logger.child({ agentId }),
      metrics: this.metrics,
      cache: this.cache,
    };
    
    // Execute with timeout and retry
    const startTime = Date.now();
    const timeoutMs = context.options.timeoutMs ?? agent.metadata.timeoutMs ?? this.config.defaultTimeoutMs;
    
    let lastError: Error | undefined;
    let result: AgentResult | undefined;
    
    for (let attempt = 1; attempt <= (context.options.maxRetries ?? agent.metadata.maxRetries ?? this.config.defaultRetryPolicy.maxAttempts); attempt++) {
      try {
        // Check if cancelled
        if (context.signal?.aborted) {
          return {
            agentId,
            agentName: agent.metadata.name,
            status: 'cancelled',
            output: null,
            metrics: {},
            executionTimeMs: Date.now() - startTime,
            error: 'Execution cancelled',
            timestamp: new Date().toISOString(),
            attempt,
          };
        }
        
        // Execute with timeout
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Agent execution timeout after ${timeoutMs}ms`));
          }, timeoutMs);
        });
        
        const executionPromise = agent.execute(executionContext);
        
        result = await Promise.race([executionPromise, timeoutPromise]);
        
        // Validate result
        if (result.status === 'success') {
          const validation = agent.validateOutput(result.output);
          if (!validation.valid) {
            result = {
              ...result,
              status: 'failed',
              error: `Output validation failed: ${validation.errors.join(', ')}`,
            };
          }
        }
        
        // Record success
        circuitBreaker?.recordSuccess();
        break;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        circuitBreaker?.recordFailure();
        
        // Calculate delay for retry
        const delayMs = this.calculateRetryDelay(
          attempt,
          context.options.retryPolicy ?? agent.metadata.retryPolicy ?? this.config.defaultRetryPolicy
        );
        
        if (attempt < (context.options.maxRetries ?? agent.metadata.maxRetries ?? this.config.defaultRetryPolicy.maxAttempts)) {
          this.logger.warn(`Agent ${agentId} failed on attempt ${attempt}, retrying in ${delayMs}ms: ${lastError.message}`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }
    
    if (!result) {
      result = {
        agentId,
        agentName: agent.metadata.name,
        status: 'failed',
        output: null,
        metrics: {},
        executionTimeMs: Date.now() - startTime,
        error: lastError?.message ?? 'Unknown error',
        errorStack: lastError?.stack,
        timestamp: new Date().toISOString(),
        attempt: context.options.maxRetries ?? agent.metadata.maxRetries ?? this.config.defaultRetryPolicy.maxAttempts,
      };
    }
    
    // Cache successful results
    if (result.status === 'success' && this.config.enableCaching && context.options.useCache !== false) {
      await this.cache.set(cacheKey, result, context.options.cacheTTLMs ?? this.config.cacheTTLMs);
      this.logger.debug(`Cached result for agent: ${agentId}`);
    }
    
    // Send progress update
    progressCallback?.({
      analysisId: context.analysisId,
      agentId,
      agentName: agent.metadata.name,
      stage: agent.metadata.stage,
      stageNumber: agent.metadata.stageNumber,
      status: result.status,
      progress: 100,
      timestamp: new Date().toISOString(),
      durationMs: result.executionTimeMs,
      result,
      error: result.error,
    });
    
    return result;
  }
  
  /**
   * Calculate retry delay using exponential backoff
   */
  private calculateRetryDelay(
    attempt: number,
    retryPolicy: {
      maxAttempts: number;
      baseDelayMs: number;
      maxDelayMs: number;
      backoffMultiplier: number;
    }
  ): number {
    const delay = retryPolicy.baseDelayMs * Math.pow(retryPolicy.backoffMultiplier, attempt - 1);
    return Math.min(delay, retryPolicy.maxDelayMs);
  }
  
  /**
   * Execute a stage (all agents in parallel)
   */
  private async executeStage(
    stage: EnhancedAgentMetadata[],
    context: EnhancedAgentContext,
    progressCallback?: ProgressCallback
  ): Promise<Map<string, AgentResult>> {
    const stageResults = new Map<string, AgentResult>();
    const stageStart = Date.now();
    
    // Filter out agents that should be skipped
    const agentsToExecute = stage.filter(agentMeta => {
      const agent = this.agents.get(agentMeta.id);
      if (!agent) return false;
      
      // Check if dependencies failed
      for (const dep of agentMeta.dependencies) {
        const depResult = context.previousResults.get(dep);
        if (depResult && depResult.status !== 'success') {
          // Skip this agent if dependency failed
          stageResults.set(agentMeta.id, {
            agentId: agentMeta.id,
            agentName: agentMeta.name,
            status: 'skipped',
            output: null,
            metrics: {},
            executionTimeMs: 0,
            error: `Dependency ${dep} failed or was skipped`,
            timestamp: new Date().toISOString(),
          });
          return false;
        }
      }
      return true;
    });
    
    // Execute agents in parallel with concurrency limit
    const concurrency = Math.min(this.config.maxConcurrentAgents, agentsToExecute.length);
    const executing: Promise<void>[] = [];
    const queue: { agentMeta: AgentMetadata; index: number }[] = agentsToExecute.map((a, i) => ({ agentMeta: a, index: i }));
    
    for (let i = 0; i < Math.min(concurrency, queue.length); i++) {
      const { agentMeta } = queue.shift()!;
      executing.push(
        this.executeAgent(agentMeta.id, context, progressCallback)
          .then(result => {
            stageResults.set(agentMeta.id, result);
          })
      );
    }
    
    while (queue.length > 0) {
      await Promise.race(executing);
      const index = executing.findIndex(p => p === Promise.resolve());
      if (index !== -1) {
        executing.splice(index, 1);
      }
      
      const { agentMeta } = queue.shift()!;
      executing.push(
        this.executeAgent(agentMeta.id, context, progressCallback)
          .then(result => {
            stageResults.set(agentMeta.id, result);
          })
      );
    }
    
    await Promise.all(executing);
    
    // Log stage completion
    const stageDuration = Date.now() - stageStart;
    this.logger.info(`Stage ${stage[0]?.stageNumber ?? 0} completed in ${stageDuration}ms`);
    
    return stageResults;
  }
  
  /**
   * Execute the full pipeline
   */
  async executePipeline(
    analysisId: ID,
    config: AnalysisConfig,
    dataframe: Record<string, unknown>[],
    metadata: Record<string, unknown> = {},
    options: AgentExecutionOptions = {},
    progressCallback?: ProgressCallback,
    signal?: AbortSignal
  ): Promise<ExecutionSummary> {
    const startTime = Date.now();
    const analysisStart = new Date().toISOString();
    
    // Build execution plan
    const plan = this.buildExecutionPlan(options.enabledAgents);
    
    // Initialize context
    const context: EnhancedAgentContext = {
      analysisId,
      analysisName: (config as any).analysisName,
      dataframe,
      metadata,
      previousResults: new Map(),
      config,
      startedAt: analysisStart,
      executionId: `exec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      attempt: 1,
      options,
      signal,
      logger: this.logger,
      metrics: this.metrics,
      cache: this.cache as unknown as AgentCache,
      onProgress: progressCallback
        ? (progress: number, message?: string) =>
            progressCallback({
              analysisId,
              agentId: '',
              agentName: '',
              stage: 'ingest' as any,
              stageNumber: 0,
              status: 'running' as any,
              progress,
              timestamp: new Date().toISOString(),
            } as any)
        : undefined,
    };
    
    // Initialize summary
    const summary: ExecutionSummary = {
      status: 'success',
      results: new Map(),
      totalDurationMs: 0,
      agentsSucceeded: 0,
      agentsFailed: 0,
      agentsSkipped: 0,
      agentsTimedOut: 0,
      stageTimings: {},
      cacheStats: this.cache.getStats(),
    };
    
    // Broadcast start
    if (this.config.enableProgressBroadcast && progressCallback) {
      progressCallback({
        analysisId,
        agentId: '',
        agentName: '',
        stage: 'ingest' as AgentStage,
        stageNumber: 0,
        status: 'running',
        progress: 0,
        timestamp: new Date().toISOString(),
      });
    }
    
    try {
      // Execute each stage sequentially
      for (let stageIndex = 0; stageIndex < plan.stages.length; stageIndex++) {
        const stage = plan.stages[stageIndex];
        const stageStart = Date.now();
        
        // Update context with previous results
        context.previousResults = new Map(summary.results);
        
        // Execute stage
        const stageResults = await this.executeStage(
          stage,
          context,
          progressCallback
        );
        
        // Update summary
        for (const [agentId, result] of stageResults) {
          summary.results.set(agentId, result);
          
          switch (result.status) {
            case 'success':
              summary.agentsSucceeded++;
              break;
            case 'failed':
              summary.agentsFailed++;
              break;
            case 'skipped':
              summary.agentsSkipped++;
              break;
            case 'timeout':
              summary.agentsTimedOut++;
              break;
          }
        }
        
        // Record stage timing
        summary.stageTimings[stageIndex] = Date.now() - stageStart;
        
        // Calculate progress
        const totalAgents = plan.totalAgents;
        const completedAgents = summary.agentsSucceeded + summary.agentsFailed + summary.agentsSkipped + summary.agentsTimedOut;
        const progress = Math.round((completedAgents / totalAgents) * 100);
        
        // Broadcast progress
        if (this.config.enableProgressBroadcast && progressCallback) {
          progressCallback({
            analysisId,
            agentId: '',
            agentName: '',
            stage: stage[0]?.stage ?? 'ingest' as AgentStage,
            stageNumber: stage[0]?.stageNumber ?? 0,
            status: 'running',
            progress,
            timestamp: new Date().toISOString(),
          });
        }
        
        // Check if we should stop early (all agents failed or cancelled)
        if (summary.agentsFailed === totalAgents || signal?.aborted) {
          summary.status = signal?.aborted ? 'cancelled' : 'failed';
          break;
        }
      }
      
      // Determine final status
      if (summary.agentsFailed > 0 && summary.agentsSucceeded === 0) {
        summary.status = 'failed';
      } else if (summary.agentsFailed > 0) {
        summary.status = 'partial';
      } else if (signal?.aborted) {
        summary.status = 'cancelled';
      }
      
      summary.totalDurationMs = Date.now() - startTime;
      summary.cacheStats = this.cache.getStats();
      
      return summary;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Pipeline execution failed: ${errorMessage}`, error instanceof Error ? error : undefined);
      
      return {
        status: 'failed',
        results: new Map(),
        totalDurationMs: Date.now() - startTime,
        agentsSucceeded: 0,
        agentsFailed: 0,
        agentsSkipped: 0,
        agentsTimedOut: 0,
        stageTimings: {},
        cacheStats: this.cache.getStats(),
      };
    }
  }
  
  /**
   * Execute a single agent by ID
   */
  async executeSingleAgent(
    agentId: string,
    context: EnhancedAgentContext,
    progressCallback?: ProgressCallback
  ): Promise<AgentResult> {
    return this.executeAgent(agentId, context, progressCallback);
  }
  
  /**
   * Get execution statistics
   */
  getStats(): {
    totalAgents: number;
    circuitBreakers: {
      open: number;
      closed: number;
      halfOpen: number;
    };
    cache: {
      size: number;
      hits: number;
      misses: number;
      hitRate: number;
    };
  } {
    let open = 0;
    let closed = 0;
    let halfOpen = 0;
    
    for (const cb of this.circuitBreakers.values()) {
      switch (cb.getState()) {
        case 'open':
          open++;
          break;
        case 'closed':
          closed++;
          break;
        case 'half_open':
          halfOpen++;
          break;
      }
    }
    
    return {
      totalAgents: this.agents.size,
      circuitBreakers: { open, closed, halfOpen },
      cache: this.cache.getStats(),
    };
  }
  
  /**
   * Reset all circuit breakers
   */
  resetCircuitBreakers(): void {
    for (const cb of this.circuitBreakers.values()) {
      cb.reset();
    }
    this.logger.info('Reset all circuit breakers');
  }
  
  /**
   * Clear the cache
   */
  async clearCache(): Promise<void> {
    await this.cache.clear();
    this.logger.info('Cleared agent result cache');
  }
  
  /**
   * Shutdown the orchestrator
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down orchestrator...');
    
    // Teardown all agents
    for (const agent of this.agents.values()) {
      try {
        await agent.teardown();
      } catch (error) {
        this.logger.error(`Error during agent teardown: ${agent.metadata.id}`, error instanceof Error ? error : undefined);
      }
    }
    
    // Clear cache
    await this.clearCache();
    
    this.logger.info('Orchestrator shutdown complete');
  }
}

// ============================================================================
// Exports
// ============================================================================

export type {
  AgentMetadata,
  AgentResult,
  AgentStatus,
  AgentStage,
  AnalysisConfig,
  ProgressUpdate,
  ID,
  ISODateString,
  AgentContext,
} from '@busara/core';
