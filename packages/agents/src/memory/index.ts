/**
 * Episodic Memory — Public API
 *
 * Implements the in-context retrieval half of the AReaL self-evolution loop:
 * agents query past trajectories ("experiences") to reuse configs that worked
 * on similar data, then evolve those configs via the Evolution Control Plane.
 */

export type {
  DataProfile,
  Memory,
  MemoryEntry,
  MemoryQuery,
  MemorySearchResult,
} from './types';

export { EpisodicMemoryStore } from './episodic';
