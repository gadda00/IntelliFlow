/**
 * Busara Agents Core
 * ==================
 * 
 * This file contains the core types and base classes for the Busara multi-agent framework.
 * It provides the foundation for all agent implementations and orchestration.
 */

import { z, ZodSchema } from 'zod';
import {
  AgentMetadata,
  AgentContext,
  AgentResult,
  AgentStatus,
  AgentStage,
  AgentTier,
  AgentStability,
  AnalysisConfig,
  RetryPolicy,
  DEFAULT_RETRY_POLICY,
  ID,
  ISODateString,
} from '@busara/core';

// ============================================================================
// Enhanced Agent Types
// ============================================================================

/** Agent input schema definition */
export interface AgentInputSchema {
  schema: ZodSchema;
  description: string;
}

/** Agent output schema definition */
export interface AgentOutputSchema {
  schema: ZodSchema;
  description: string;
}

/** Agent configuration schema definition */
export interface AgentConfigSchema {
  schema: ZodSchema;
  defaults: Record<string, unknown>;
  description: string;
}

/** Enhanced agent metadata with schemas */
export interface EnhancedAgentMetadata extends AgentMetadata {
  // Input/Output schemas
  inputSchema: AgentInputSchema;
  outputSchema: AgentOutputSchema;
  configSchema: AgentConfigSchema;
  
  // Versioning
  version: string;
  changelog?: string[];
  
  // Dependencies
  softDependencies?: string[]; // Optional dependencies
  
  // Execution
  maxRetries: number;
  retryPolicy: RetryPolicy;
  
  // Resource requirements
  memoryLimitMB: number;
  cpuLimit: number | string;
  gpuRequired: boolean;
  
  // Marketplace
  authorId?: ID;
  repository?: string;
  documentationUrl?: string;
  
  // Quality
  testCoverage?: number;
  lastTestedAt?: ISODateString;
}

/** Agent execution options */
export interface AgentExecutionOptions {
  timeoutMs?: number;
  maxRetries?: number;
  retryPolicy?: RetryPolicy;
  useCache?: boolean;
  cacheTTLMs?: number;
  priority?: number;
  enabledAgents?: string[];
  disabledAgents?: string[];
}

/** Agent execution context with enhanced features */
export interface EnhancedAgentContext extends AgentContext {
  // Execution
  executionId: ID;
  attempt: number;
  options: AgentExecutionOptions;
  agentId?: string;
  agentName?: string;
  
  // System
  signal?: AbortSignal;
  
  // Logging
  logger: AgentLogger;
  
  // Metrics
  metrics: AgentMetricsCollector;
  
  // Cache
  cache: AgentCache;
  
  // Progress
  onProgress?: (progress: number, message?: string) => void;
}

/** Agent logger interface */
export interface AgentLogger {
  debug: (message: string, data?: Record<string, unknown>) => void;
  info: (message: string, data?: Record<string, unknown>) => void;
  warn: (message: string, data?: Record<string, unknown>) => void;
  error: (message: string, error?: Error, data?: Record<string, unknown>) => void;
  
  // Child logger with context
  child: (context: Record<string, unknown>) => AgentLogger;
}

/** Agent metrics collector */
export interface AgentMetricsCollector {
  // Timing
  startTimer: (name: string) => void;
  endTimer: (name: string) => number;
  
  // Counters
  increment: (name: string, value?: number) => void;
  decrement: (name: string, value?: number) => void;
  
  // Gauges
  set: (name: string, value: number) => void;
  
  // Histograms
  observe: (name: string, value: number) => void;
  
  // Get all metrics
  getMetrics: () => Record<string, number>;
}

/** Agent cache interface */
export interface AgentCache {
  get: <T>(key: string) => Promise<T | null>;
  set: <T>(key: string, value: T, ttlMs?: number) => Promise<void>;
  delete: (key: string) => Promise<void>;
  has: (key: string) => Promise<boolean>;
  clear: () => Promise<void>;
  getStats?: () => { hits: number; misses: number; hitRate: number; size: number; maxSize: number };
}

/** Agent health status */
export interface AgentHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    [checkName: string]: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      message?: string;
      latencyMs?: number;
    };
  };
  lastCheckedAt: ISODateString;
}

/** Agent health check result */
export interface AgentHealthCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  latencyMs?: number;
}

// ============================================================================
// Base Agent Class
// ============================================================================

/**
 * BaseAgent is the abstract base class for all Busara agents.
 * It provides common functionality and enforces the agent interface.
 */
export abstract class BaseAgent {
  /** Agent metadata */
  abstract readonly metadata: EnhancedAgentMetadata;
  
  /** Logger instance */
  protected logger: AgentLogger;
  
  /** Metrics collector */
  protected metrics: AgentMetricsCollector;
  
  /** Cache instance */
  protected cache: AgentCache;
  
  /**
   * Initialize the agent with dependencies
   */
  initialize(
    logger: AgentLogger,
    metrics: AgentMetricsCollector,
    cache: AgentCache
  ): void {
    this.logger = logger.child({ agentId: this.metadata.id });
    this.metrics = metrics;
    this.cache = cache;
  }
  
  /**
   * Validate agent configuration
   */
  validateConfig(config: AnalysisConfig): { valid: boolean; errors: string[] } {
    try {
      this.metadata.configSchema.schema.parse(config);
      return { valid: true, errors: [] };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: error.issues.map(e => `${e.path.join('.')}: ${e.message}`),
        };
      }
      return { valid: false, errors: ['Unknown validation error'] };
    }
  }
  
  /**
   * Validate agent input
   */
  validateInput(input: unknown): { valid: boolean; errors: string[] } {
    try {
      this.metadata.inputSchema.schema.parse(input);
      return { valid: true, errors: [] };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: error.issues.map(e => `${e.path.join('.')}: ${e.message}`),
        };
      }
      return { valid: false, errors: ['Unknown validation error'] };
    }
  }
  
  /**
   * Validate agent output
   */
  validateOutput(output: unknown): { valid: boolean; errors: string[] } {
    try {
      this.metadata.outputSchema.schema.parse(output);
      return { valid: true, errors: [] };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: error.issues.map(e => `${e.path.join('.')}: ${e.message}`),
        };
      }
      return { valid: false, errors: ['Unknown validation error'] };
    }
  }
  
  /**
   * Execute the agent's main logic
   * This must be implemented by all concrete agents
   */
  abstract execute(context: EnhancedAgentContext): Promise<AgentResult>;
  
  /**
   * Setup before execution (optional)
   * Called once when the agent is first loaded
   */
  async setup(): Promise<void> {
    // Default: do nothing
  }
  
  /**
   * Teardown after execution (optional)
   * Called when the agent is unloaded or the application shuts down
   */
  async teardown(): Promise<void> {
    // Default: do nothing
  }
  
  /**
   * Health check for the agent
   */
  async healthCheck(): Promise<AgentHealthStatus> {
    return {
      status: 'healthy',
      checks: {},
      lastCheckedAt: new Date().toISOString(),
    };
  }
  
  /**
   * Create a successful result
   */
  protected createResult(
    output: unknown,
    metrics: Record<string, number> = {},
    executionTimeMs: number = 0
  ): AgentResult {
    return {
      agentId: this.metadata.id,
      agentName: this.metadata.name,
      status: 'success',
      output,
      metrics,
      executionTimeMs,
      timestamp: new Date().toISOString(),
    };
  }
  
  /**
   * Create an error result
   */
  protected createError(
    error: string,
    executionTimeMs: number = 0,
    errorStack?: string
  ): AgentResult {
    return {
      agentId: this.metadata.id,
      agentName: this.metadata.name,
      status: 'failed',
      output: null,
      metrics: {},
      executionTimeMs,
      error,
      errorStack,
      timestamp: new Date().toISOString(),
    };
  }
  
  /**
   * Create a timeout result
   */
  protected createTimeout(executionTimeMs: number = 0): AgentResult {
    return {
      agentId: this.metadata.id,
      agentName: this.metadata.name,
      status: 'timeout',
      output: null,
      metrics: {},
      executionTimeMs,
      error: 'Execution timeout',
      timestamp: new Date().toISOString(),
    };
  }
  
  /**
   * Create a skipped result
   */
  protected createSkipped(reason: string): AgentResult {
    return {
      agentId: this.metadata.id,
      agentName: this.metadata.name,
      status: 'skipped',
      output: null,
      metrics: {},
      executionTimeMs: 0,
      error: reason,
      timestamp: new Date().toISOString(),
    };
  }
  
  /**
   * Extract numeric column from dataframe
   */
  protected extractNumericColumn(
    dataframe: Record<string, unknown>[],
    column: string
  ): number[] {
    return dataframe
      .map(row => Number(row[column]))
      .filter(n => !Number.isNaN(n) && Number.isFinite(n));
  }
  
  /**
   * Extract all numeric columns from dataframe
   */
  protected extractAllNumericColumns(
    dataframe: Record<string, unknown>[]
  ): Record<string, number[]> {
    if (!dataframe.length) return {};
    const columns = Object.keys(dataframe[0]);
    const result: Record<string, number[]> = {};
    
    for (const col of columns) {
      const numeric = this.extractNumericColumn(dataframe, col);
      if (numeric.length > dataframe.length * 0.5) {
        result[col] = numeric;
      }
    }
    return result;
  }
  
  /**
   * Check if execution should be cancelled
   */
  protected isCancelled(signal?: AbortSignal): boolean {
    return signal?.aborted ?? false;
  }
  
  /**
   * Sleep for a specified duration
   */
  protected async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Agent Factory
// ============================================================================

/** Agent factory function type */
export type AgentFactory<T extends BaseAgent = BaseAgent> = (
  logger: AgentLogger,
  metrics: AgentMetricsCollector,
  cache: AgentCache
) => T;

/** Agent class type */
export type AgentClass<T extends BaseAgent = BaseAgent> = new (
  logger: AgentLogger,
  metrics: AgentMetricsCollector,
  cache: AgentCache
) => T;

// ============================================================================
// Agent Builder
// ============================================================================

/**
 * AgentBuilder provides a fluent interface for creating agent instances
 */
export class AgentBuilder<T extends BaseAgent> {
  private agentClass: AgentClass<T>;
  private logger: AgentLogger;
  private metrics: AgentMetricsCollector;
  private cache: AgentCache;
  
  constructor(agentClass: AgentClass<T>) {
    this.agentClass = agentClass;
  }
  
  withLogger(logger: AgentLogger): this {
    this.logger = logger;
    return this;
  }
  
  withMetrics(metrics: AgentMetricsCollector): this {
    this.metrics = metrics;
    return this;
  }
  
  withCache(cache: AgentCache): this {
    this.cache = cache;
    return this;
  }
  
  build(): T {
    const agent = new this.agentClass(this.logger, this.metrics, this.cache);
    agent.initialize(this.logger, this.metrics, this.cache);
    return agent;
  }
}

// ============================================================================
// Agent Helpers
// ============================================================================

/**
 * Create a simple agent with minimal boilerplate
 */
export function createSimpleAgent(
  metadata: EnhancedAgentMetadata,
  executeFn: (context: EnhancedAgentContext) => Promise<unknown>
): BaseAgent {
  return new (class SimpleAgent extends BaseAgent {
    readonly metadata = metadata;
    
    async execute(context: EnhancedAgentContext): Promise<AgentResult> {
      const start = Date.now();
      try {
        const output = await executeFn(context);
        const executionTimeMs = Date.now() - start;
        
        // Validate output
        const validation = this.validateOutput(output);
        if (!validation.valid) {
          return this.createError(
            `Output validation failed: ${validation.errors.join(', ')}`,
            executionTimeMs
          );
        }
        
        return this.createResult(output, {}, executionTimeMs);
      } catch (error) {
        const executionTimeMs = Date.now() - start;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorStack = error instanceof Error ? error.stack : undefined;
        return this.createError(errorMessage, executionTimeMs, errorStack);
      }
    }
  })();
}

/**
 * Create agent metadata with defaults
 */
export function createAgentMetadata(
  overrides: Partial<EnhancedAgentMetadata>
): EnhancedAgentMetadata {
  return {
    // Identity
    id: '',
    name: '',
    description: '',
    version: '1.0.0',
    
    // Classification
    stage: 'ingest' as AgentStage,
    stageNumber: 0,
    tier: 'core' as AgentTier,
    stability: 'stable' as AgentStability,
    
    // Author
    author: 'Busara Team',
    license: 'MIT',
    
    // Dependencies
    dependencies: [],
    softDependencies: [],
    
    // Execution
    timeoutMs: 30000,
    maxRetries: 3,
    retryPolicy: DEFAULT_RETRY_POLICY,
    
    // Capabilities
    capabilities: [],
    category: 'data',
    tags: [],
    
    // Input/Output
    inputDescription: '',
    outputDescription: '',
    inputSchema: { schema: z.any(), description: '' },
    outputSchema: { schema: z.any(), description: '' },
    configSchema: { schema: z.object({}), defaults: {}, description: '' },
    
    // Documentation
    documentationUrl: '',
    
    // Marketplace
    price: 0,
    rating: 0,
    downloadCount: 0,
    
    // Technical requirements
    memoryLimitMB: 256,
    cpuLimit: 1,
    gpuRequired: false,
    
    // Quality
    testCoverage: 0,
    
    // UI
    icon: 'Cpu',
    color: '#6366f1',
    
    ...overrides,
  };
}

// ============================================================================
// Exports
// ============================================================================

export type {
  AgentMetadata,
  AgentContext,
  AgentResult,
  AgentStatus,
  AgentStage,
  AgentTier,
  AgentStability,
  AnalysisConfig,
  RetryPolicy,
  DEFAULT_RETRY_POLICY,
} from '@busara/core';

export type {
  ID,
  ISODateString,
} from '@busara/core';
