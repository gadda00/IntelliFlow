// Busara Agents Package
// ======================
// Multi-agent orchestration framework for data intelligence
//
// Implements the three pillars from the AReaL paper (arXiv:2607.01120):
//   1. Standardized trajectory data protocol (trajectory/)
//   2. Enterprise-grade data proxy (trajectory/dataProxy.ts)
//   3. Unified agent evolution control plane (trajectory/evolution.ts)
// Plus verification gates from the Verified Multi-Agent Orchestration paper.
//
// LLM Gateway (llm-gateway/) — zero-code trajectory capture at the HTTP
// boundary, per the AReaL paper's central architectural insight: every
// LLM call funnels through one gateway so instrumentation is automatic
// and universal across all agents.

export * from './core';
export * from './orchestrator';
export * from './registry';
export * from './agents';
export * from './math';
export * from './errors';
export * from './trajectory';
export * from './llm-gateway';

// Episodic memory — in-context retrieval of similar past trajectories,
// feeding the "evolve the in-context harness" half of the AReaL loop.
export * from './memory';

// Pipeline checkpointing — save/restore agent pipeline state across stage
// boundaries so interrupted runs can resume instead of restarting.
export * from './checkpoint';
