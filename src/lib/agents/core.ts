// IntelliFlow v3 — Agent Framework Core
// TypeScript-native multi-agent system with DAG execution, circuit breakers,
// smart caching, and real-time progress broadcasting.

export type AgentStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'timeout';
export type AgentTier = 'core' | 'advanced' | 'specialized';

export interface Message {
  id: string;
  sender: string;
  intent: string;
  content: Record<string, any>;
  correlationId?: string;
  replyTo?: string;
  timestamp: string;
}

export interface AgentInfo {
  id: string;
  name: string;
  role: string;
  tier: AgentTier;
  description: string;
  capabilities: string[];
  icon: string;
  color: string;
}

export interface AgentExecutionContext {
  analysisId: string;
  analysisConfig: Record<string, any>;
  fileContents: any[];          // parsed rows from CSV/Excel/JSON
  rawFiles?: { name: string; type: string; size: number }[];
  nlqQuery?: string;
  objectives?: string[];
  dependencyResults: Record<string, any>;
  startedAt: string;
  userId?: string;
}

export interface AgentExecutionResult {
  agentId: string;
  agentName: string;
  success: boolean;
  result: any;
  durationMs: number;
  error?: string;
  status: AgentStatus;
}

export interface ProgressBroadcast {
  analysisId: string;
  agentId: string;
  agentName: string;
  status: AgentStatus;
  progress: number;
  stage: number;
  result?: any;
  error?: string;
  timestamp: string;
  durationMs?: number;
}

export type BroadcastFn = (update: ProgressBroadcast) => void;

// ─── Tool Definition ───────────────────────────────────────────────────────
export abstract class Tool {
  name: string;
  description: string;

  constructor(name: string, description: string) {
    this.name = name;
    this.description = description;
  }

  abstract execute(args: Record<string, any>): Promise<Record<string, any>>;
}

// ─── Base Agent ────────────────────────────────────────────────────────────
export abstract class Agent {
  id: string;
  name: string;
  role: string;
  tier: AgentTier;
  description: string;
  capabilities: string[] = [];
  icon: string;
  color: string;
  protected tools: Map<string, Tool> = new Map();

  constructor(opts: {
    id: string;
    name: string;
    role: string;
    tier: AgentTier;
    description: string;
    capabilities?: string[];
    icon?: string;
    color?: string;
  }) {
    this.id = opts.id;
    this.name = opts.name;
    this.role = opts.role;
    this.tier = opts.tier;
    this.description = opts.description;
    this.capabilities = opts.capabilities ?? [];
    this.icon = opts.icon ?? 'Bot';
    this.color = opts.color ?? '#10b981';
  }

  registerTool(tool: Tool) {
    this.tools.set(tool.name, tool);
  }

  async useTool(name: string, args: Record<string, any>): Promise<Record<string, any>> {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Tool ${name} not found on agent ${this.id}`);
    return tool.execute(args);
  }

  info(): AgentInfo {
    return {
      id: this.id,
      name: this.name,
      role: this.role,
      tier: this.tier,
      description: this.description,
      capabilities: this.capabilities,
      icon: this.icon,
      color: this.color,
    };
  }

  /**
   * Main entry point — must be implemented by each agent.
   * Returns the agent's contribution to the analysis.
   */
  abstract execute(ctx: AgentExecutionContext): Promise<any>;
}

// ─── Circuit Breaker ───────────────────────────────────────────────────────
export class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half_open' = 'closed';

  constructor(
    private failureThreshold: number = 3,
    private resetTimeoutMs: number = 60000,
  ) {}

  isOpen(): boolean {
    if (this.state === 'open') {
      const now = Date.now();
      if (now - this.lastFailureTime > this.resetTimeoutMs) {
        this.state = 'half_open';
        return false;
      }
      return true;
    }
    return false;
  }

  recordSuccess() {
    this.failureCount = 0;
    this.state = 'closed';
  }

  recordFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'open';
    }
  }
}

// ─── Smart Cache (LRU + TTL) ───────────────────────────────────────────────
export class SmartCache {
  private store = new Map<string, { value: any; expiresAt: number }>();
  private accessOrder: string[] = [];
  private hits = 0;
  private misses = 0;

  constructor(
    private maxSize: number = 500,
    private ttlMs: number = 60 * 60 * 1000, // 1 hour
  ) {}

  get(key: string): any | null {
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
    this.accessOrder = this.accessOrder.filter(k => k !== key);
    this.accessOrder.push(key);
    this.hits++;
    return entry.value;
  }

  set(key: string, value: any, ttlMs?: number) {
    if (this.store.size >= this.maxSize) {
      const oldest = this.accessOrder.shift();
      if (oldest) this.store.delete(oldest);
    }
    this.store.set(key, {
      value,
      expiresAt: Date.now() + (ttlMs ?? this.ttlMs),
    });
    this.accessOrder.push(key);
  }

  stats() {
    return {
      size: this.store.size,
      maxSize: this.maxSize,
      hitRate: this.hits / (this.hits + this.misses || 1),
    };
  }
}
