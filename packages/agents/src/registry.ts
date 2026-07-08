/**
 * Busara Agent Registry
 * =====================
 * 
 * The AgentRegistry is responsible for discovering, registering, and managing agents.
 * It supports:
 * - Static agent registration
 * - Dynamic agent loading from files
 * - Agent versioning
 * - Agent discovery
 * - Agent filtering
 */

import { AgentMetadata, AgentStage, AgentTier, AgentStability, ID } from '@busara/core';
import { BaseAgent, EnhancedAgentMetadata } from './core';

// ============================================================================
// Types
// ============================================================================

/** Simple agent factory function (used by registry registrations) */
export type SimpleAgentFactory = () => BaseAgent;

/** Agent module */
export interface AgentModule {
  default?: BaseAgent;
  [key: string]: BaseAgent | SimpleAgentFactory | undefined;
}

/** Agent registration options */
export interface AgentRegistrationOptions {
  id?: string;
  version?: string;
  enabled?: boolean;
  priority?: number;
}

/** Agent filter */
export interface AgentFilter {
  stage?: AgentStage | AgentStage[];
  tier?: AgentTier | AgentTier[];
  stability?: AgentStability | AgentStability[];
  capabilities?: string | string[];
  tags?: string | string[];
  search?: string;
  enabled?: boolean;
}

/** Registered agent info */
export interface RegisteredAgent {
  id: string;
  agent: BaseAgent;
  metadata: EnhancedAgentMetadata;
  enabled: boolean;
  priority: number;
  registeredAt: Date;
}

// ============================================================================
// Agent Registry
// ============================================================================

/**
 * AgentRegistry manages the lifecycle of agents in the system.
 * It provides methods for registering, discovering, and filtering agents.
 */
export class AgentRegistry {
  private agents = new Map<string, RegisteredAgent>();
  private factories = new Map<string, SimpleAgentFactory>();
  private index: Record<string, Set<string>> = {
    stage: new Set(),
    tier: new Set(),
    stability: new Set(),
    capability: new Set(),
    tag: new Set(),
  };
  
  /**
   * Register a single agent
   */
  register(
    agent: BaseAgent,
    options: AgentRegistrationOptions = {}
  ): string {
    const id = options.id ?? agent.metadata.id;
    
    if (this.agents.has(id)) {
      throw new Error(`Agent with ID '${id}' is already registered`);
    }
    
    const registeredAgent: RegisteredAgent = {
      id,
      agent,
      metadata: agent.metadata as EnhancedAgentMetadata,
      enabled: options.enabled ?? true,
      priority: options.priority ?? 0,
      registeredAt: new Date(),
    };
    
    this.agents.set(id, registeredAgent);
    this.indexAgent(registeredAgent);
    
    return id;
  }
  
  /**
   * Register multiple agents
   */
  registerAll(
    agents: BaseAgent[],
    options?: AgentRegistrationOptions
  ): string[] {
    return agents.map(agent => this.register(agent, options));
  }
  
  /**
   * Register an agent factory
   */
  registerFactory(id: string, factory: SimpleAgentFactory): void {
    if (this.factories.has(id)) {
      throw new Error(`Agent factory with ID '${id}' is already registered`);
    }
    this.factories.set(id, factory);
  }
  
  /**
   * Create an agent from a factory
   */
  createFromFactory(id: string, options?: AgentRegistrationOptions): BaseAgent {
    const factory = this.factories.get(id);
    if (!factory) {
      throw new Error(`Agent factory with ID '${id}' not found`);
    }
    
    const agent = factory();
    this.register(agent, options);
    return agent;
  }
  
  /**
   * Unregister an agent
   */
  unregister(id: string): boolean {
    const registered = this.agents.get(id);
    if (!registered) return false;
    
    this.agents.delete(id);
    this.deindexAgent(registered);
    return true;
  }
  
  /**
   * Unregister all agents
   */
  unregisterAll(): void {
    for (const registered of this.agents.values()) {
      this.deindexAgent(registered);
    }
    this.agents.clear();
    this.factories.clear();
  }
  
  /**
   * Get an agent by ID
   */
  get(id: string): BaseAgent | null {
    return this.agents.get(id)?.agent ?? null;
  }
  
  /**
   * Get registered agent info by ID
   */
  getRegisteredAgent(id: string): RegisteredAgent | null {
    return this.agents.get(id) ?? null;
  }
  
  /**
   * Get all registered agents
   */
  getAll(): BaseAgent[] {
    return Array.from(this.agents.values()).map(r => r.agent);
  }
  
  /**
   * Get all registered agent metadata
   */
  getAllMetadata(): EnhancedAgentMetadata[] {
    return Array.from(this.agents.values()).map(r => r.metadata);
  }
  
  /**
   * Check if an agent is registered
   */
  has(id: string): boolean {
    return this.agents.has(id);
  }
  
  /**
   * Enable an agent
   */
  enable(id: string): boolean {
    const registered = this.agents.get(id);
    if (!registered) return false;
    
    registered.enabled = true;
    return true;
  }
  
  /**
   * Disable an agent
   */
  disable(id: string): boolean {
    const registered = this.agents.get(id);
    if (!registered) return false;
    
    registered.enabled = false;
    return true;
  }
  
  /**
   * Check if an agent is enabled
   */
  isEnabled(id: string): boolean {
    return this.agents.get(id)?.enabled ?? false;
  }
  
  /**
   * Get agents by stage
   */
  getByStage(stage: AgentStage): BaseAgent[] {
    return Array.from(this.agents.values())
      .filter(r => r.metadata.stage === stage && r.enabled)
      .map(r => r.agent);
  }
  
  /**
   * Get agents by tier
   */
  getByTier(tier: AgentTier): BaseAgent[] {
    return Array.from(this.agents.values())
      .filter(r => r.metadata.tier === tier && r.enabled)
      .map(r => r.agent);
  }
  
  /**
   * Get agents by stability
   */
  getByStability(stability: AgentStability): BaseAgent[] {
    return Array.from(this.agents.values())
      .filter(r => r.metadata.stability === stability && r.enabled)
      .map(r => r.agent);
  }
  
  /**
   * Get agents with specific capability
   */
  getByCapability(capability: string): BaseAgent[] {
    return Array.from(this.agents.values())
      .filter(r => r.metadata.capabilities.includes(capability) && r.enabled)
      .map(r => r.agent);
  }
  
  /**
   * Get agents with specific tag
   */
  getByTag(tag: string): BaseAgent[] {
    return Array.from(this.agents.values())
      .filter(r => r.metadata.tags.includes(tag) && r.enabled)
      .map(r => r.agent);
  }
  
  /**
   * Filter agents based on criteria
   */
  filter(filter: AgentFilter): BaseAgent[] {
    return Array.from(this.agents.values())
      .filter(registered => {
        // Enabled filter
        if (filter.enabled !== undefined && registered.enabled !== filter.enabled) {
          return false;
        }
        
        // Stage filter
        if (filter.stage) {
          const stages = Array.isArray(filter.stage) ? filter.stage : [filter.stage];
          if (!stages.includes(registered.metadata.stage)) {
            return false;
          }
        }
        
        // Tier filter
        if (filter.tier) {
          const tiers = Array.isArray(filter.tier) ? filter.tier : [filter.tier];
          if (!tiers.includes(registered.metadata.tier)) {
            return false;
          }
        }
        
        // Stability filter
        if (filter.stability) {
          const stabilities = Array.isArray(filter.stability) ? filter.stability : [filter.stability];
          if (!stabilities.includes(registered.metadata.stability)) {
            return false;
          }
        }
        
        // Capabilities filter
        if (filter.capabilities) {
          const capabilities = Array.isArray(filter.capabilities) ? filter.capabilities : [filter.capabilities];
          if (!capabilities.some(c => registered.metadata.capabilities.includes(c))) {
            return false;
          }
        }
        
        // Tags filter
        if (filter.tags) {
          const tags = Array.isArray(filter.tags) ? filter.tags : [filter.tags];
          if (!tags.some(t => registered.metadata.tags.includes(t))) {
            return false;
          }
        }
        
        // Search filter
        if (filter.search) {
          const searchLower = filter.search.toLowerCase();
          const nameMatch = registered.metadata.name.toLowerCase().includes(searchLower);
          const descriptionMatch = registered.metadata.description.toLowerCase().includes(searchLower);
          const idMatch = registered.id.toLowerCase().includes(searchLower);
          
          if (!nameMatch && !descriptionMatch && !idMatch) {
            return false;
          }
        }
        
        return true;
      })
      .sort((a, b) => b.priority - a.priority)
      .map(r => r.agent);
  }
  
  /**
   * Find agents by ID pattern
   */
  findByIdPattern(pattern: string | RegExp): BaseAgent[] {
    const patternStr = typeof pattern === 'string' ? pattern : pattern.source;
    const regex = typeof pattern === 'string' ? new RegExp(patternStr, 'i') : pattern;
    
    return Array.from(this.agents.values())
      .filter(r => regex.test(r.id))
      .map(r => r.agent);
  }
  
  /**
   * Find agents by name pattern
   */
  findByNamePattern(pattern: string | RegExp): BaseAgent[] {
    const patternStr = typeof pattern === 'string' ? pattern : pattern.source;
    const regex = typeof pattern === 'string' ? new RegExp(patternStr, 'i') : pattern;
    
    return Array.from(this.agents.values())
      .filter(r => regex.test(r.metadata.name))
      .map(r => r.agent);
  }
  
  /**
   * Get agent count
   */
  get count(): number {
    return this.agents.size;
  }
  
  /**
   * Get enabled agent count
   */
  get enabledCount(): number {
    return Array.from(this.agents.values()).filter(r => r.enabled).length;
  }
  
  /**
   * Get statistics
   */
  getStats(): {
    total: number;
    enabled: number;
    disabled: number;
    byStage: Record<AgentStage, number>;
    byTier: Record<AgentTier, number>;
    byStability: Record<AgentStability, number>;
  } {
    const byStage: Record<AgentStage, number> = {
      ingest: 0,
      engineer: 0,
      detect: 0,
      forecast: 0,
      infer: 0,
      cluster: 0,
      report: 0,
    };
    
    const byTier: Record<AgentTier, number> = {
      core: 0,
      advanced: 0,
      specialized: 0,
      ml: 0,
      stats: 0,
      experimental: 0,
    };
    
    const byStability: Record<AgentStability, number> = {
      experimental: 0,
      beta: 0,
      stable: 0,
      deprecated: 0,
    };
    
    let enabled = 0;
    
    for (const registered of this.agents.values()) {
      if (registered.enabled) enabled++;
      
      // Count by stage
      if (registered.metadata.stage in byStage) {
        byStage[registered.metadata.stage as AgentStage]++;
      }
      
      // Count by tier
      if (registered.metadata.tier in byTier) {
        byTier[registered.metadata.tier as AgentTier]++;
      }
      
      // Count by stability
      if (registered.metadata.stability in byStability) {
        byStability[registered.metadata.stability as AgentStability]++;
      }
    }
    
    return {
      total: this.agents.size,
      enabled,
      disabled: this.agents.size - enabled,
      byStage,
      byTier,
      byStability,
    };
  }
  
  /**
   * Index an agent for faster lookups
   */
  private indexAgent(registered: RegisteredAgent): void {
    // Index by stage
    this.index.stage.add(registered.metadata.stage);
    
    // Index by tier
    this.index.tier.add(registered.metadata.tier);
    
    // Index by stability
    this.index.stability.add(registered.metadata.stability);
    
    // Index by capabilities
    for (const capability of registered.metadata.capabilities) {
      this.index.capability.add(capability);
    }
    
    // Index by tags
    for (const tag of registered.metadata.tags) {
      this.index.tag.add(tag);
    }
  }
  
  /**
   * Deindex an agent
   */
  private deindexAgent(registered: RegisteredAgent): void {
    // Note: We don't actually remove from the index sets because
    // multiple agents can have the same values. The index is used
    // for filtering, not for counting.
  }
  
  /**
   * Get available filter values
   */
  getFilterValues(): {
    stages: AgentStage[];
    tiers: AgentTier[];
    stabilities: AgentStability[];
    capabilities: string[];
    tags: string[];
  } {
    return {
      stages: Array.from(this.index.stage) as AgentStage[],
      tiers: Array.from(this.index.tier) as AgentTier[],
      stabilities: Array.from(this.index.stability) as AgentStability[],
      capabilities: Array.from(this.index.capability),
      tags: Array.from(this.index.tag),
    };
  }
}

// ============================================================================
// Default Agent Registry
// ============================================================================

/** Default agent registry instance */
export const defaultRegistry = new AgentRegistry();

// ============================================================================
// Exports
// ============================================================================

export type {
  AgentMetadata,
  AgentStage,
  AgentTier,
  AgentStability,
  ID,
} from '@busara/core';
