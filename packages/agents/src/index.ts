// Busara Agents Package
// ======================
// Multi-agent orchestration framework for data intelligence
//
// Implements the three pillars from the AReaL paper (arXiv:2607.01120):
//   1. Standardized trajectory data protocol (trajectory/)
//   2. Enterprise-grade data proxy (trajectory/dataProxy.ts)
//   3. Unified agent evolution control plane (trajectory/evolution.ts)
// Plus verification gates from the Verified Multi-Agent Orchestration paper.

export * from './core';
export * from './orchestrator';
export * from './registry';
export * from './agents';
export * from './math';
export * from './errors';
export * from './trajectory';
