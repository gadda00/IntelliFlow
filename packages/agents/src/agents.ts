/**
 * Busara Agents
 * ============
 * 
 * This file exports all the built-in agents for the Busara platform.
 * Agents are organized by stage and can be imported individually or as a group.
 */

// Re-export all agent types and utilities
export * from './core';
export * from './orchestrator';
export * from './registry';
export * from './math';
export * from './errors';
export * from './validation';

// ============================================================================
// Agent Imports
// ============================================================================

// These will be imported from their respective files
// For now, we'll define placeholder exports

/**
 * Ingest Agents (Stage 0)
 * - DataIngestionAgent
 * - SchemaInferenceAgent
 * - DataProfilerAgent
 * - DataQualityAgent
 * - PrivacyGuardianAgent
 * - NLQInterpreterAgent
 */
export * from './agents/ingest';

/**
 * Engineer Agents (Stage 1)
 * - DataCleanerAgent
 * - DataEngineerAgent
 * - FeatureEngineerAgent
 * - DataTransformerAgent
 */
export * from './agents/engineer';

/**
 * Detect Agents (Stage 2)
 * - AnalysisStrategistAgent
 * - AnomalySentinelAgent
 * - ForecastingOracleAgent
 * - CausalArchitectAgent
 * - KnowledgeGraphBuilderAgent
 * - BenchmarkAgent
 * - AutoMLAgent
 */
export * from './agents/detect';

/**
 * Forecast Agents (Stage 3)
 * - TimeSeriesForecasterAgent
 * - SeasonalDecomposerAgent
 * - TrendAnalyzerAgent
 */
export * from './agents/forecast';

/**
 * Infer Agents (Stage 4)
 * - InsightGeneratorAgent
 * - ExplainabilityAgent
 * - HypothesisTesterAgent
 */
export * from './agents/infer';

/**
 * Cluster Agents (Stage 5)
 * - ClusterAnalyzerAgent
 * - SegmenterAgent
 * - PatternDetectorAgent
 */
export * from './agents/cluster';

/**
 * Report Agents (Stage 6)
 * - NarrativeComposerAgent
 * - VisualizationSpecialistAgent
 * - CodeGeneratorAgent
 * - SyntheticDataGeneratorAgent
 * - ConversationalAnalystAgent
 * - OrchestratorAgent
 */
export * from './agents/report';

// ============================================================================
// Agent Groups
// ============================================================================

/**
 * Get all ingest stage agents
 */
export function getIngestAgents(): typeof import('./agents/ingest') {
  // @ts-ignore - Dynamic import will be handled at runtime
  return require('./agents/ingest');
}

/**
 * Get all engineer stage agents
 */
export function getEngineerAgents(): typeof import('./agents/engineer') {
  // @ts-ignore - Dynamic import will be handled at runtime
  return require('./agents/engineer');
}

/**
 * Get all detect stage agents
 */
export function getDetectAgents(): typeof import('./agents/detect') {
  // @ts-ignore - Dynamic import will be handled at runtime
  return require('./agents/detect');
}

/**
 * Get all forecast stage agents
 */
export function getForecastAgents(): typeof import('./agents/forecast') {
  // @ts-ignore - Dynamic import will be handled at runtime
  return require('./agents/forecast');
}

/**
 * Get all infer stage agents
 */
export function getInferAgents(): typeof import('./agents/infer') {
  // @ts-ignore - Dynamic import will be handled at runtime
  return require('./agents/infer');
}

/**
 * Get all cluster stage agents
 */
export function getClusterAgents(): typeof import('./agents/cluster') {
  // @ts-ignore - Dynamic import will be handled at runtime
  return require('./agents/cluster');
}

/**
 * Get all report stage agents
 */
export function getReportAgents(): typeof import('./agents/report') {
  // @ts-ignore - Dynamic import will be handled at runtime
  return require('./agents/report');
}

/**
 * Get all agents
 */
export function getAllAgents() {
  return [
    ...Object.values(getIngestAgents()),
    ...Object.values(getEngineerAgents()),
    ...Object.values(getDetectAgents()),
    ...Object.values(getForecastAgents()),
    ...Object.values(getInferAgents()),
    ...Object.values(getClusterAgents()),
    ...Object.values(getReportAgents()),
  ].filter(agent => agent && typeof agent === 'object' && 'metadata' in agent);
}

// ============================================================================
// Agent Pool
// ============================================================================

/**
 * AgentPool provides a pre-configured set of all built-in agents
 */
export class AgentPool {
  private agents: Map<string, any> = new Map();
  
  constructor() {
    // Register all agents
    this.registerAll();
  }
  
  private registerAll(): void {
    // Ingest agents
    try {
      const ingestAgents = getIngestAgents();
      for (const [name, AgentClass] of Object.entries(ingestAgents)) {
        if (name.endsWith('Agent') && !name.startsWith('I')) {
          const agent = new AgentClass();
          this.agents.set(agent.metadata.id, agent);
        }
      }
    } catch (error) {
      console.warn('Failed to load ingest agents:', error);
    }
    
    // Engineer agents
    try {
      const engineerAgents = getEngineerAgents();
      for (const [name, AgentClass] of Object.entries(engineerAgents)) {
        if (name.endsWith('Agent') && !name.startsWith('I')) {
          const agent = new AgentClass();
          this.agents.set(agent.metadata.id, agent);
        }
      }
    } catch (error) {
      console.warn('Failed to load engineer agents:', error);
    }
    
    // Detect agents
    try {
      const detectAgents = getDetectAgents();
      for (const [name, AgentClass] of Object.entries(detectAgents)) {
        if (name.endsWith('Agent') && !name.startsWith('I')) {
          const agent = new AgentClass();
          this.agents.set(agent.metadata.id, agent);
        }
      }
    } catch (error) {
      console.warn('Failed to load detect agents:', error);
    }
    
    // Forecast agents
    try {
      const forecastAgents = getForecastAgents();
      for (const [name, AgentClass] of Object.entries(forecastAgents)) {
        if (name.endsWith('Agent') && !name.startsWith('I')) {
          const agent = new AgentClass();
          this.agents.set(agent.metadata.id, agent);
        }
      }
    } catch (error) {
      console.warn('Failed to load forecast agents:', error);
    }
    
    // Infer agents
    try {
      const inferAgents = getInferAgents();
      for (const [name, AgentClass] of Object.entries(inferAgents)) {
        if (name.endsWith('Agent') && !name.startsWith('I')) {
          const agent = new AgentClass();
          this.agents.set(agent.metadata.id, agent);
        }
      }
    } catch (error) {
      console.warn('Failed to load infer agents:', error);
    }
    
    // Cluster agents
    try {
      const clusterAgents = getClusterAgents();
      for (const [name, AgentClass] of Object.entries(clusterAgents)) {
        if (name.endsWith('Agent') && !name.startsWith('I')) {
          const agent = new AgentClass();
          this.agents.set(agent.metadata.id, agent);
        }
      }
    } catch (error) {
      console.warn('Failed to load cluster agents:', error);
    }
    
    // Report agents
    try {
      const reportAgents = getReportAgents();
      for (const [name, AgentClass] of Object.entries(reportAgents)) {
        if (name.endsWith('Agent') && !name.startsWith('I')) {
          const agent = new AgentClass();
          this.agents.set(agent.metadata.id, agent);
        }
      }
    } catch (error) {
      console.warn('Failed to load report agents:', error);
    }
  }
  
  getAgent(agentId: string) {
    return this.agents.get(agentId) ?? null;
  }
  
  getAllAgents() {
    return Array.from(this.agents.values());
  }
  
  getAgentMetadata() {
    return Array.from(this.agents.values()).map(agent => agent.metadata);
  }
}

/**
 * Default agent pool instance
 */
export const defaultAgentPool = new AgentPool();

/**
 * Get the default agent pool
 */
export function getAgentPool(): AgentPool {
  return defaultAgentPool;
}

// ============================================================================
// Legacy Compatibility
// ============================================================================

/**
 * Get agent pool (legacy compatibility)
 */
export function getAgentPoolLegacy() {
  return defaultAgentPool;
}

/**
 * Parallel agent executor (legacy compatibility)
 */
export class ParallelAgentExecutor {
  private pool: AgentPool;
  
  constructor(pool?: AgentPool) {
    this.pool = pool ?? defaultAgentPool;
  }
  
  async runFullPipeline(context: any) {
    // This will be implemented with the new orchestrator
    throw new Error('ParallelAgentExecutor.runFullPipeline not yet implemented');
  }
}
