/**
 * Busara v7.0 — Multi-Agent Orchestration Framework
 * ================================================
 *
 * Type-safe, DAG-based multi-agent system with:
 * - 50+ specialized agents across 7 pipeline stages
 * - Parallel execution with dependency resolution
 * - Circuit breakers, smart caching, and timeout management
 * - Real-time progress broadcasting via SSE
 * - Metrics collection for every agent execution
 *
 * Design Philosophy: "Real math, not vibes."
 * Every agent implements actual statistical/ML algorithms.
 * No mocks, no placeholders, no random number generators.
 */

// ─── Core Types ────────────────────────────────────────────────────────

export type AgentStatus = 'idle' | 'pending' | 'running' | 'success' | 'failed' | 'skipped' | 'timeout';

export type AgentStage =
  | 'ingest'    // Stage 0: Data ingestion and profiling
  | 'engineer'  // Stage 1: Cleaning and feature engineering
  | 'detect'    // Stage 2: Anomaly detection and ML
  | 'forecast'  // Stage 3: Time series forecasting
  | 'infer'     // Stage 4: Causal inference and explainability
  | 'cluster'   // Stage 5: Clustering and segmentation
  | 'report';   // Stage 6: Narrative and reporting

export type AgentTier = 'core' | 'advanced' | 'specialized' | 'ml' | 'stats';

export interface AgentMetadata {
  id: string;
  name: string;
  role: string;
  tier: AgentTier;
  stage: AgentStage;
  stageNumber: number;
  description: string;
  capabilities: string[];
  dependencies: string[];
  icon: string;
  color: string;
  timeoutMs: number;
}

export interface AgentContext {
  analysisId: string;
  dataframe: Record<string, any>[];
  metadata: Record<string, any>;
  previousResults: Map<string, AgentResult>;
  config: AnalysisConfig;
  userId?: string;
  startedAt: string;
}

export interface AnalysisConfig {
  targetColumn?: string;
  timeColumn?: string;
  seasonLength?: number;
  forecastHorizon?: number;
  anomalyThreshold?: number;
  clusterCount?: number;
  nlqQuery?: string;
  objectives?: string[];
  fileName?: string;
  sensitivity?: 'low' | 'medium' | 'high';
}

export interface AgentMetrics {
  [key: string]: number;
}

export interface AgentResult {
  agentId: string;
  agentName: string;
  status: AgentStatus;
  output: any;
  metrics: AgentMetrics;
  executionTimeMs: number;
  error?: string;
  timestamp: string;
}

export interface ProgressUpdate {
  analysisId: string;
  agentId: string;
  agentName: string;
  stage: AgentStage;
  stageNumber: number;
  status: AgentStatus;
  progress: number;
  result?: AgentResult;
  error?: string;
  timestamp: string;
  durationMs?: number;
}

export type ProgressCallback = (update: ProgressUpdate) => void;

// ─── Base Agent ────────────────────────────────────────────────────────

export abstract class BaseAgent {
  abstract readonly metadata: AgentMetadata;

  abstract execute(context: AgentContext): Promise<AgentResult>;

  protected createResult(
    output: any,
    metrics: AgentMetrics = {},
    executionTimeMs: number = 0,
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

  protected createError(error: string, executionTimeMs: number = 0): AgentResult {
    return {
      agentId: this.metadata.id,
      agentName: this.metadata.name,
      status: 'failed',
      output: null,
      metrics: {},
      executionTimeMs,
      error,
      timestamp: new Date().toISOString(),
    };
  }

  protected extractNumericColumn(
    dataframe: Record<string, any>[],
    column: string,
  ): number[] {
    return dataframe
      .map(row => Number(row[column]))
      .filter(n => !isNaN(n) && isFinite(n));
  }

  protected extractAllNumericColumns(
    dataframe: Record<string, any>[],
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
}

// ─── Circuit Breaker ───────────────────────────────────────────────────

export class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half_open' = 'closed';

  constructor(
    private readonly failureThreshold: number = 3,
    private readonly resetTimeoutMs: number = 60000,
  ) {}

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

  recordSuccess(): void {
    this.failureCount = 0;
    this.state = 'closed';
  }

  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'open';
    }
  }

  getState(): 'closed' | 'open' | 'half_open' {
    return this.state;
  }
}

// ─── Smart Cache (O(1) LRU + TTL) ─────────────────────────────────────

export class SmartCache<T = any> {
  private store = new Map<string, { value: T; expiresAt: number }>();
  private hits = 0;
  private misses = 0;

  constructor(
    private readonly maxSize: number = 500,
    private readonly ttlMs: number = 60 * 60 * 1000,
  ) {}

  get(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) {
      this.misses++;
      return null;
    }
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.misses++;
      return null;
    }
    // O(1) LRU: delete and re-insert to move to end (most recently used)
    this.store.delete(key);
    this.store.set(key, entry);
    this.hits++;
    return entry.value;
  }

  set(key: string, value: T, ttlMs?: number): void {
    if (this.store.size >= this.maxSize) {
      // Delete oldest entry (first in Map = least recently used)
      const oldestKey = this.store.keys().next().value;
      if (oldestKey) this.store.delete(oldestKey);
    }
    this.store.set(key, {
      value,
      expiresAt: Date.now() + (ttlMs ?? this.ttlMs),
    });
  }

  clear(): void {
    this.store.clear();
    this.hits = 0;
    this.misses = 0;
  }

  stats() {
    return {
      size: this.store.size,
      maxSize: this.maxSize,
      hitRate: this.hits + this.misses > 0 ? this.hits / (this.hits + this.misses) : 0,
    };
  }
}
