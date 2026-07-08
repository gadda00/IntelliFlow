/**
 * Shared trajectory store — single module-level instance used by:
 *   - /api/v2/analyze        (writes trajectories during agent execution)
 *   - /api/v2/analyze-stream (writes trajectories during streaming agent execution)
 *   - /api/v2/trajectory     (queries trajectories)
 *   - /api/v2/evolution      (reads trajectories for evolution analysis)
 *
 * In development this is an in-memory store (resets on server restart).
 * In production it should be swapped for a PrismaTrajectoryStore backed by the
 * Trajectory model added in prisma/schema.prisma.
 */

import { InMemoryTrajectoryStore } from '@busara/agents';

export const trajectoryStore = new InMemoryTrajectoryStore();
