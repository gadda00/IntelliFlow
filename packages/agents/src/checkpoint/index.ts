/**
 * Pipeline Checkpointing — Public API
 *
 * Lets an interrupted analysis pipeline resume from the last completed stage
 * instead of restarting from scratch. Useful for long-running multi-agent
 * runs (e.g. the 33-agent v7 pipeline on a large dataset) where a crash or
 * deployment mid-run would otherwise waste minutes of LLM compute.
 */

export type {
  AgentResult,
  Checkpoint,
  CheckpointStatus,
  CheckpointStore,
} from './types';

export { CheckpointManager, InMemoryCheckpointStore } from './manager';
