/**
 * Busara Agents
 * ============
 *
 * Re-exports all built-in agents for the Busara platform.
 * Agents are organized by stage (ingest, engineer, detect, forecast, infer,
 * cluster, report). Not all stages exist yet — `loadStage` gracefully handles
 * missing directories so the package compiles even while new stages are being
 * added.
 */

// Re-export all agent types and utilities
export * from './core';
export * from './orchestrator';
export * from './registry';
export * from './math';
export * from './errors';
export * from './validation';

// ============================================================================
// Stage Imports (graceful — missing dirs are skipped)
// ============================================================================

import type { BaseAgent } from './core';

type AgentModule = Record<string, unknown>;

/** Dynamically and safely load a stage module, returning {} on failure. */
function loadStage(stageName: string): AgentModule {
  try {
    // Use require so missing directories throw at runtime, not at type-check.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require(`./agents/${stageName}`);
    return mod as AgentModule;
  } catch {
    return {};
  }
}

// Eager static imports for stages that exist today (kept for type inference).
export * from './agents/ingest';
export * from './agents/engineer';
export * from './agents/detect';
export * from './agents/forecast';
export * from './agents/infer';
export * from './agents/cluster';

// ============================================================================
// Agent Pool
// ============================================================================

/**
 * AgentPool provides a pre-configured set of all built-in agents.
 * Each stage is loaded defensively so a single broken agent cannot break
 * the entire pool.
 */
export class AgentPool {
  private agents: Map<string, BaseAgent> = new Map();
  private readonly stageNames = [
    'ingest',
    'engineer',
    'detect',
    'forecast',
    'infer',
    'cluster',
    'report',
  ];

  constructor() {
    this.registerAll();
  }

  private registerAll(): void {
    for (const stage of this.stageNames) {
      const mod = loadStage(stage);
      for (const [exportName, value] of Object.entries(mod)) {
        if (!exportName.endsWith('Agent')) continue;
        if (typeof value !== 'function') continue;
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const AgentClass = value as any;
          const instance: BaseAgent = new AgentClass();
          if (instance?.metadata?.id) {
            this.agents.set(instance.metadata.id, instance);
          }
        } catch (err) {
          console.warn(`Failed to instantiate agent "${exportName}" from stage "${stage}":`, err);
        }
      }
    }
  }

  /** Get a registered agent by id. */
  getAgent(agentId: string): BaseAgent | null {
    return this.agents.get(agentId) ?? null;
  }

  /** Get all registered agent instances. */
  getAllAgents(): BaseAgent[] {
    return Array.from(this.agents.values());
  }

  /** Get metadata for every registered agent. */
  getAgentMetadata() {
    return this.getAllAgents().map((agent) => agent.metadata);
  }

  /** Check if an agent is registered. */
  has(agentId: string): boolean {
    return this.agents.has(agentId);
  }

  /** Get the count of registered agents. */
  size(): number {
    return this.agents.size;
  }
}

/** Default shared agent pool instance. */
export const defaultAgentPool = new AgentPool();

/** Get the default agent pool. */
export function getAgentPool(): AgentPool {
  return defaultAgentPool;
}

// ============================================================================
// Stage Accessors (graceful)
// ============================================================================

/** Get all agents from a specific stage. */
export function getStageAgents(stageName: string): BaseAgent[] {
  const mod = loadStage(stageName);
  const agents: BaseAgent[] = [];
  for (const [exportName, value] of Object.entries(mod)) {
    if (!exportName.endsWith('Agent') || typeof value !== 'function') continue;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const instance: BaseAgent = new (value as any)();
      if (instance?.metadata?.id) agents.push(instance);
    } catch {
      // skip broken agent
    }
  }
  return agents;
}

// Convenience wrappers for each known stage.
export const getIngestAgents = () => getStageAgents('ingest');
export const getEngineerAgents = () => getStageAgents('engineer');
export const getDetectAgents = () => getStageAgents('detect');
export const getForecastAgents = () => getStageAgents('forecast');
export const getInferAgents = () => getStageAgents('infer');
export const getClusterAgents = () => getStageAgents('cluster');
export const getReportAgents = () => getStageAgents('report');

/** Get all agents across every stage. */
export function getAllAgents(): BaseAgent[] {
  return [
    ...getIngestAgents(),
    ...getEngineerAgents(),
    ...getDetectAgents(),
    ...getForecastAgents(),
    ...getInferAgents(),
    ...getClusterAgents(),
    ...getReportAgents(),
  ];
}

// ============================================================================
// Legacy Compatibility
// ============================================================================

/** Get agent pool (legacy alias). */
export function getAgentPoolLegacy(): AgentPool {
  return defaultAgentPool;
}

/** Parallel agent executor (legacy alias — pipeline is handled by DAGOrchestrator). */
export class ParallelAgentExecutor {
  private pool: AgentPool;

  constructor(pool?: AgentPool) {
    this.pool = pool ?? defaultAgentPool;
  }

  async runFullPipeline(_context: unknown): Promise<never> {
    throw new Error('ParallelAgentExecutor.runFullPipeline is deprecated; use DAGOrchestrator instead.');
  }
}
