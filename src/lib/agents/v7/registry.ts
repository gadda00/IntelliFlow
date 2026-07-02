/**
 * Busara v7.0 — Agent Registry
 * =============================
 *
 * Central registry for all 50+ agents across 7 pipeline stages.
 * Each agent is registered with factory functions for lazy instantiation.
 *
 * Stage Layout:
 *   0 - Ingest:    10 agents (data ingestion, profiling, PII, quality)
 *   1 - Engineer:  10 agents (imputation, scaling, feature engineering)
 *   2 - Detect:    10 agents (anomaly, ML, clustering, fraud, sentiment)
 *   3 - Forecast:   4 agents (Holt-Winters, ARIMA, MA, anomaly forecast)
 *   4 - Infer:      8 agents (OLS, causal, SHAP, Auto-ML, benchmark, KG, Africa)
 *   5 - Report:     6 agents (insights, narrative, code, viz, synthetic, reflection)
 *   6 - Final:      2 agents (alerts, orchestrator)
 *
 * Total: 50 agents
 */

import { BaseAgent } from './core';

// Stage 0: Ingestion & Profiling
import { DataIngestionAgent } from './implementations/ingestAgents';
import { SchemaInferenceAgent } from './implementations/ingestAgents';
import { DataProfilingAgent } from './implementations/ingestAgents';
import { MissingValueAnalyzerAgent } from './implementations/ingestAgents';
import { CardinalityCheckerAgent } from './implementations/ingestAgents';
import { DuplicateDetectorAgent } from './implementations/ingestAgents';
import { DataQualityScorerAgent } from './implementations/ingestAgents';
import { TextLengthProfilerAgent } from './implementations/ingestAgents';
import { PIIDetectionAgent } from './implementations/ingestAgents';
import { NLQInterpreterAgent } from './implementations/ingestAgents';

// Stage 1: Engineering & Cleaning
import { MedianImputationAgent } from './implementations/engineerAgents';
import { ModeImputationAgent } from './implementations/engineerAgents';
import { StandardScalerAgent } from './implementations/engineerAgents';
import { MinMaxScalerAgent } from './implementations/engineerAgents';
import { OutlierRemovalAgent } from './implementations/engineerAgents';
import { FeatureEngineeringAgent } from './implementations/engineerAgents';
import { TextNormalizerAgent } from './implementations/engineerAgents';
import { DuplicateRemoverAgent } from './implementations/engineerAgents';
import { TypeCoercionAgent } from './implementations/engineerAgents';
import { DataSamplingAgent } from './implementations/engineerAgents';

// Stage 2: Detection & ML
import { AnomalyEnsembleAgent } from './implementations/detectAgents';
import { IsolationForestAgent } from './implementations/detectAgents';
import { KMeansClusterAgent } from './implementations/detectAgents';
import { DBSCANClusterAgent } from './implementations/detectAgents';
import { GaussianMixtureAgent } from './implementations/detectAgents';
import { FraudDetectionAgent } from './implementations/detectAgents';
import { SentimentAnalysisAgent } from './implementations/detectAgents';
import { CorrelationMatrixAgent } from './implementations/detectAgents';
import { StationarityTesterAgent } from './implementations/detectAgents';
import { SeasonalityDetectorAgent } from './implementations/detectAgents';

// Stage 3-6: Forecasting, Inference, Reporting
import { HoltWintersForecastAgent } from './implementations/advancedAgents';
import { ARIMAAgent } from './implementations/advancedAgents';
import { MovingAverageForecastAgent } from './implementations/advancedAgents';
import { AnomalyForecastingAgent } from './implementations/advancedAgents';
import { OLSRegressionAgent } from './implementations/advancedAgents';
import { CausalInferenceAgent } from './implementations/advancedAgents';
import { FeatureImportanceAgent } from './implementations/advancedAgents';
import { SHAPExplainerAgent } from './implementations/advancedAgents';
import { AutoMLAgent } from './implementations/advancedAgents';
import { BenchmarkAgent } from './implementations/advancedAgents';
import { KnowledgeGraphBuilderAgent } from './implementations/advancedAgents';
import { AfricaMarketIntelAgent } from './implementations/advancedAgents';
import { InsightGeneratorAgent } from './implementations/advancedAgents';
import { NarrativeComposerAgent } from './implementations/advancedAgents';
import { CodeGeneratorAgent } from './implementations/advancedAgents';
import { VisualizationAgent } from './implementations/advancedAgents';
import { SyntheticDataGeneratorAgent } from './implementations/advancedAgents';
import { ReflectionAgent } from './implementations/advancedAgents';
import { RealTimeAlertAgent } from './implementations/advancedAgents';
import { OrchestratorAgent } from './implementations/advancedAgents';

// ─── Registry ──────────────────────────────────────────────────────────

type AgentFactory = () => BaseAgent;

export const AgentRegistry: Map<string, AgentFactory> = new Map([
  // ─── Stage 0: Ingestion & Profiling (1-10) ───────────────────────────
  ['data_ingestion', () => new DataIngestionAgent()],
  ['schema_inference', () => new SchemaInferenceAgent()],
  ['data_profiling', () => new DataProfilingAgent()],
  ['missing_value_analyzer', () => new MissingValueAnalyzerAgent()],
  ['cardinality_checker', () => new CardinalityCheckerAgent()],
  ['duplicate_detector', () => new DuplicateDetectorAgent()],
  ['data_quality_scorer', () => new DataQualityScorerAgent()],
  ['text_length_profiler', () => new TextLengthProfilerAgent()],
  ['pii_detection', () => new PIIDetectionAgent()],
  ['nlq_interpreter', () => new NLQInterpreterAgent()],

  // ─── Stage 1: Engineering & Cleaning (11-20) ─────────────────────────
  ['median_imputation', () => new MedianImputationAgent()],
  ['mode_imputation', () => new ModeImputationAgent()],
  ['standard_scaler', () => new StandardScalerAgent()],
  ['minmax_scaler', () => new MinMaxScalerAgent()],
  ['outlier_removal', () => new OutlierRemovalAgent()],
  ['feature_engineering', () => new FeatureEngineeringAgent()],
  ['text_normalizer', () => new TextNormalizerAgent()],
  ['duplicate_remover', () => new DuplicateRemoverAgent()],
  ['type_coercion', () => new TypeCoercionAgent()],
  ['data_sampling', () => new DataSamplingAgent()],

  // ─── Stage 2: Detection & ML (21-30) ─────────────────────────────────
  ['anomaly_ensemble', () => new AnomalyEnsembleAgent()],
  ['isolation_forest', () => new IsolationForestAgent()],
  ['kmeans_cluster', () => new KMeansClusterAgent()],
  ['dbscan_cluster', () => new DBSCANClusterAgent()],
  ['gaussian_mixture', () => new GaussianMixtureAgent()],
  ['fraud_detection', () => new FraudDetectionAgent()],
  ['sentiment_analysis', () => new SentimentAnalysisAgent()],
  ['correlation_matrix', () => new CorrelationMatrixAgent()],
  ['stationarity_tester', () => new StationarityTesterAgent()],
  ['seasonality_detector', () => new SeasonalityDetectorAgent()],

  // ─── Stage 3: Forecasting (31-34) ────────────────────────────────────
  ['holt_winters_forecast', () => new HoltWintersForecastAgent()],
  ['arima_forecast', () => new ARIMAAgent()],
  ['moving_average_forecast', () => new MovingAverageForecastAgent()],
  ['anomaly_forecasting', () => new AnomalyForecastingAgent()],

  // ─── Stage 4: Inference & Causality (35-42) ──────────────────────────
  ['ols_regression', () => new OLSRegressionAgent()],
  ['causal_inference', () => new CausalInferenceAgent()],
  ['feature_importance', () => new FeatureImportanceAgent()],
  ['shap_explainer', () => new SHAPExplainerAgent()],
  ['auto_ml', () => new AutoMLAgent()],
  ['benchmark_agent', () => new BenchmarkAgent()],
  ['knowledge_graph', () => new KnowledgeGraphBuilderAgent()],
  ['africa_market_intel', () => new AfricaMarketIntelAgent()],

  // ─── Stage 5: Reporting (43-48) ──────────────────────────────────────
  ['insight_generator', () => new InsightGeneratorAgent()],
  ['narrative_composer', () => new NarrativeComposerAgent()],
  ['code_generator', () => new CodeGeneratorAgent()],
  ['visualization_agent', () => new VisualizationAgent()],
  ['synthetic_data_generator', () => new SyntheticDataGeneratorAgent()],
  ['reflection_agent', () => new ReflectionAgent()],

  // ─── Stage 6: Final (49-50) ──────────────────────────────────────────
  ['realtime_alert', () => new RealTimeAlertAgent()],
  ['orchestrator', () => new OrchestratorAgent()],
]);

// ─── Helper Functions ──────────────────────────────────────────────────

/**
 * Get all registered agent IDs.
 */
export function getAgentIds(): string[] {
  return Array.from(AgentRegistry.keys());
}

/**
 * Get all agent metadata.
 */
export function getAllAgentMetadata() {
  return Array.from(AgentRegistry.values()).map(factory => factory().metadata);
}

/**
 * Instantiate all agents and return as a Map.
 */
export function createAllAgents(): Map<string, BaseAgent> {
  const agents = new Map<string, BaseAgent>();
  for (const [id, factory] of AgentRegistry) {
    agents.set(id, factory());
  }
  return agents;
}

/**
 * Instantiate a specific agent by ID.
 */
export function createAgent(id: string): BaseAgent | null {
  const factory = AgentRegistry.get(id);
  return factory ? factory() : null;
}

/**
 * Get agent count by stage.
 */
export function getAgentCountByStage(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const factory of AgentRegistry.values()) {
    const meta = factory().metadata;
    counts[meta.stage] = (counts[meta.stage] ?? 0) + 1;
  }
  return counts;
}

/**
 * Get total agent count.
 */
export function getTotalAgentCount(): number {
  return AgentRegistry.size;
}
