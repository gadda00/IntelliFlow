/**
 * Agent Execution Wrapper — wires trajectory recording into BaseAgent.execute().
 *
 * Usage:
 *   const wrappedAgent = withTrajectory(agent, { store, analysisId, userId, ... });
 *   const result = await wrappedAgent.execute(ctx);
 *   // Trajectory is automatically recorded + persisted.
 *   const trajectoryId = (wrappedAgent as any)._lastTrajectoryId;
 *
 * The wrapper:
 *   1. Snapshots the agent context (config, DAG position, dataframe hash)
 *   2. Records the input observation
 *   3. Delegates to the original execute()
 *   4. Records the output + completes the trajectory
 *   5. Persists via the TrajectoryStore (if provided)
 *   6. Stashes the trajectory ID on the agent as `_lastTrajectoryId`
 *      so callers (e.g. API routes) can return it to clients for later
 *      reward attribution.
 */

import type { BaseAgent } from '../core';
import type { AgentResult } from '@busara/core';
import { TrajectoryRecorder, createContextSnapshot, createMetadata, type TrajectoryStore } from './';

export interface TrajectoryWrapperOptions {
  store?: TrajectoryStore;  // if not provided, trajectory is not persisted
  analysisId: string;
  userId: string;
  workspaceId?: string;
  organizationId?: string;
}

export function withTrajectory(agent: BaseAgent, options: TrajectoryWrapperOptions): BaseAgent {
  const originalExecute = agent.execute.bind(agent);

  agent.execute = async (ctx: any): Promise<AgentResult> => {
    const recorder = new TrajectoryRecorder({
      analysisId: options.analysisId,
      userId: options.userId,
      workspaceId: options.workspaceId,
      organizationId: options.organizationId,
      agentId: agent.metadata.id,
      agentVersion: agent.metadata.version ?? '1.0.0',
      agentStability: agent.metadata.stability ?? 'beta',
      contextSnapshot: createContextSnapshot(ctx.config ?? {}, {
        systemPrompt: agent.metadata.description,
        dagContext: ctx.analysisId ? {
          stage: agent.metadata.stage,
          stageNumber: agent.metadata.stageNumber,
          availablePriorResults: Array.from(ctx.previousResults?.keys?.() ?? []),
        } : undefined,
      }),
      metadata: createMetadata(ctx.dataframe ?? [], {
        fileName: ctx.config?.fileName,
        fileType: ctx.config?.fileType,
      }),
    });

    recorder.start();

    try {
      // Record the input observation
      recorder.observe({
        rowCount: ctx.dataframe?.length ?? 0,
        config: ctx.config,
      }, { phase: 'input' });

      // Execute the agent (the agent's own execute may record sub-steps via the recorder if passed in ctx)
      const result = await originalExecute(ctx);

      // Record the output
      recorder.result(result.output, { phase: 'output' });

      // Complete the trajectory
      const trajectory = recorder.complete(result.status === 'success' ? 'success' : 'failed',
        result.error ? { message: result.error, code: result.status } : undefined);

      // Persist if store is available
      if (options.store) {
        await options.store.save(trajectory).catch(err =>
          console.error('[trajectory] Failed to save:', err)
        );
      }

      // Stash the trajectory ID so callers can return it for reward attribution
      (agent as any)._lastTrajectoryId = trajectory.id;

      return result;
    } catch (error) {
      const trajectory = recorder.complete('failed', {
        message: error instanceof Error ? error.message : String(error),
      });

      if (options.store) {
        await options.store.save(trajectory).catch(err =>
          console.error('[trajectory] Failed to save:', err)
        );
      }

      (agent as any)._lastTrajectoryId = trajectory.id;

      throw error;
    }
  };

  return agent;
}
