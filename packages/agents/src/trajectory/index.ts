/**
 * Busara Trajectory Data Protocol — Public API
 *
 * Implements all three pillars from the AReaL paper (arXiv:2607.01120):
 *   Pillar 1: Standardized trajectory data protocol
 *   Pillar 2: Enterprise-grade data proxy
 *   Pillar 3: Unified agent evolution control plane
 *
 * Plus verification gates from the Verified Multi-Agent Orchestration paper.
 */

// Pillar 1: Types + Recorder + Store
export * from './types';
export {
  TrajectoryRecorder,
  computeDataframeHash,
  computeConfigHash,
  createContextSnapshot,
  createMetadata,
} from './recorder';
export type { TrajectoryRecorderConfig } from './recorder';
export {
  InMemoryTrajectoryStore,
  PrismaTrajectoryStore,
} from './store';
export type { TrajectoryStore, AgentTrajectoryStats } from './store';

// Agent execution wrapper — wires trajectory recording into BaseAgent.execute()
export { withTrajectory } from './agentWrapper';
export type { TrajectoryWrapperOptions } from './agentWrapper';

// OpenTelemetry GenAI export (interoperability)
export { trajectoryToOTel, trajectoriesToOTel, toOTLPJSON } from './otel';

// Verification Gates (from Verified Multi-Agent Orchestration paper)
export {
  SchemaVerificationGate,
  StatusVerificationGate,
  NonEmptyOutputGate,
  DurationVerificationGate,
  StatisticalSanityGate,
  CompositeVerificationGate,
  DefaultReplanningPolicy,
  executeWithVerification,
} from './verification';
export type {
  VerificationGate,
  VerificationResult,
  VerificationCheck,
  VerificationContext,
  VerificationStatus,
  ReplanningStrategy,
  ReplanningDecision,
  ReplanningPolicy,
  VerifiedExecutorOptions,
  VerifiedExecutionResult,
} from './verification';

// Pillar 2: Data Proxy
export { DataProxy } from './dataProxy';
export type {
  DataProxyConfig,
  QualityScore,
  QualityScoreComponent,
  ScrubbedTrajectory,
  PIIScrubReport,
  ExportedDataset,
  DatasetStats,
  ExportAudit,
} from './dataProxy';

// Pillar 3: Evolution Control Plane
export {
  EvolutionControlPlane,
  detectDrift,
  optimizeConfig,
  createExplicitReward,
  createImplicitReward,
  createAutomatedReward,
} from './evolution';
export type {
  EvolutionAction,
  EvolutionActionType,
  EvolutionEvidence,
  ConfigInsight,
  EvolutionControlPlaneConfig,
  DriftDetectionResult,
} from './evolution';
