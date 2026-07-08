/**
 * Episodic Memory — Types
 * ========================
 *
 * Episodic memory lets an agent recall past trajectories ("experiences") that
 * are similar to the situation it currently faces, so it can reuse configs,
 * prompts, and in-context examples that worked before.
 *
 * This is the "memory" half of the AReaL paper's evolution loop: trajectories
 * feed the data proxy, the data proxy feeds training, training updates the
 * policy, AND the same trajectories feed episodic retrieval for in-context
 * adaptation at inference time. The paper calls this "evolve the in-context
 * harness" — we call it episodic memory.
 *
 * Design:
 *   - Backed by the existing TrajectoryStore (no new persistence layer).
 *   - Similarity is a cheap heuristic (data shape + config overlap), not an
 *     embedding. Good enough for the top-N rerank; embeddings can be added
 *     later behind the same MemoryQuery interface.
 *   - All retrieval is read-only and side-effect free.
 */

import type { Trajectory } from '../trajectory/types';

/**
 * A compact, serializable description of the input dataframe.
 * Used as the "what kind of data am I looking at?" key for memory retrieval.
 */
export interface DataProfile {
  rowCount?: number;
  columnCount?: number;
  columnNames?: string[];
  /** Optional semantic type hint, e.g. "timeseries" | "transactions" | "survey". */
  semanticType?: string;
}

/**
 * A query against episodic memory.
 *
 * Every field is optional except `agentId` — you always scope memory to a
 * single agent, because a "similar situation" for the DataCleaner is very
 * different from a "similar situation" for the ForecastingOracle.
 */
export interface MemoryQuery {
  agentId: string;
  dataProfile?: DataProfile;
  /** Only return trajectories whose config matches these keys. */
  config?: Record<string, unknown>;
  /** Only return trajectories with average reward >= this value. */
  minReward?: number;
  /** How many results to return. Defaults to 10. */
  limit?: number;
}

/**
 * A single recalled experience.
 *
 * `similarity` is in [0, 1] — higher is more similar to the query.
 * `reward` is the trajectory's average reward, also in [-1, 1].
 * `config` is the config that produced this trajectory (so the caller can
 * reuse it).
 * `summary` is a one-line human-readable description.
 */
export interface MemorySearchResult {
  trajectoryId: string;
  similarity: number;
  reward: number;
  config: Record<string, unknown>;
  summary: string;
}

/**
 * A persisted memory entry — a denormalized, query-optimized view of a
 * Trajectory that an episodic memory index can store.
 *
 * In the in-memory implementation below we compute these on the fly from the
 * TrajectoryStore; a production deployment would persist them in a vector
 * store or a denormalized SQL table.
 */
export interface MemoryEntry {
  trajectoryId: string;
  agentId: string;
  analysisId: string;
  dataProfile: DataProfile;
  config: Record<string, unknown>;
  reward: number;
  status: Trajectory['status'];
  timestamp: string;
  summary: string;
}

/**
 * The abstract memory store interface. The episodic store below is the
 * reference implementation; a vector-backed store would implement the same
 * surface.
 */
export interface Memory {
  search(query: MemoryQuery): Promise<MemorySearchResult[]>;
  getBestPractice(
    agentId: string,
    dataProfile: DataProfile,
  ): Promise<Record<string, unknown> | null>;
}
