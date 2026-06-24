// Agent Registry — Singleton that holds all 23 agents and provides lookup
import { Agent, AgentInfo } from './core';
import { AGENT_DAG } from './executor';

import { OrchestratorAgent, DataScoutAgent, DataEngineerAgent, AnalysisStrategistAgent, InsightGeneratorAgent, VisualizationSpecialistAgent, NarrativeComposerAgent } from './coreAgents';
import { AnomalySentinelAgent, ForecastingOracleAgent, CausalArchitectAgent, NLQInterpreterAgent, DataQualityGuardianAgent } from './advancedAgents';
import { PrivacyGuardianAgent, KnowledgeGraphBuilderAgent, SyntheticDataGeneratorAgent, CodeGeneratorAgent, BenchmarkAgent, ExplainabilityAgent, AutoMLAgent, ConversationalAnalystAgent } from './specializedAgents';
import { NLPSentimentAgent, AnomalyForecastingAgent, GraphNeuralNetworkAgent } from './v32Agents';

// Re-export for convenience
export * from './core';
export * from './coreAgents';
export * from './advancedAgents';
export * from './specializedAgents';
export * from './v32Agents';
export * from './executor';
export * from './statistics';

let _agentPool: Map<string, Agent> | null = null;

export function getAgentPool(): Map<string, Agent> {
  if (_agentPool) return _agentPool;
  _agentPool = new Map<string, Agent>();

  const instances: Agent[] = [
    // Core (7)
    new OrchestratorAgent(),
    new DataScoutAgent(),
    new DataEngineerAgent(),
    new AnalysisStrategistAgent(),
    new InsightGeneratorAgent(),
    new VisualizationSpecialistAgent(),
    new NarrativeComposerAgent(),
    // Advanced (5)
    new AnomalySentinelAgent(),
    new ForecastingOracleAgent(),
    new CausalArchitectAgent(),
    new NLQInterpreterAgent(),
    new DataQualityGuardianAgent(),
    // Specialized (8) — v3.0
    new PrivacyGuardianAgent(),
    new KnowledgeGraphBuilderAgent(),
    new SyntheticDataGeneratorAgent(),
    new CodeGeneratorAgent(),
    new BenchmarkAgent(),
    new ExplainabilityAgent(),
    new AutoMLAgent(),
    new ConversationalAnalystAgent(),
    // Specialized (3) — v3.2 NEW
    new NLPSentimentAgent(),
    new AnomalyForecastingAgent(),
    new GraphNeuralNetworkAgent(),
  ];

  for (const agent of instances) {
    _agentPool.set(agent.id, agent);
  }
  return _agentPool;
}

export function getAgent(id: string): Agent | undefined {
  return getAgentPool().get(id);
}

export function listAgents(): AgentInfo[] {
  return Array.from(getAgentPool().values()).map(a => a.info());
}

export function getDAG() {
  return AGENT_DAG;
}

// Total agent count for display — "20+" marketing
export const TOTAL_AGENTS = 23;
