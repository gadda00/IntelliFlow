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
 *   3. If `options.memory` is provided, queries episodic memory for similar
 *      past trajectories and surfaces them on `ctx.similarExperiences`.
 *      Also calls `getBestPractice()` and merges the resulting config with
 *      the user's config (user config takes precedence). Both consultations
 *      are recorded as trajectory steps so the agent's policy decisions are
 *      fully reproducible.
 *   4. Delegates to the original execute()
 *   5. Records the output + completes the trajectory
 *   6. Persists via the TrajectoryStore (if provided)
 *   7. Stashes the trajectory ID on the agent as `_lastTrajectoryId`
 *      so callers (e.g. API routes) can return it to clients for later
 *      reward attribution.
 */

import type { BaseAgent } from '../core';
import type { AgentResult } from '@busara/core';
import { TrajectoryRecorder, createContextSnapshot, createMetadata, type TrajectoryStore } from './';
import type { EpisodicMemoryStore, DataProfile } from '../memory';

export interface TrajectoryWrapperOptions {
  store?: TrajectoryStore;  // if not provided, trajectory is not persisted
  analysisId: string;
  userId: string;
  workspaceId?: string;
  organizationId?: string;
  /**
   * Optional episodic memory store. When provided, the wrapper queries past
   * trajectories for similar situations BEFORE calling agent.execute() and:
   *   - Attaches the top-3 recalled experiences to `ctx.similarExperiences`
   *     (array of `{ trajectoryId, similarity, reward, config, summary }`)
   *     so the agent can reuse configs / prompts that worked before.
   *   - Calls `getBestPractice()` and merges the resulting config with the
   *     user's config (user config takes precedence — the agent never
   *     silently overrides an explicit user setting).
   *   - Records both memory consultations as trajectory steps so the
   *     agent's reasoning is fully reproducible downstream.
   */
  memory?: EpisodicMemoryStore;
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

    // Inject the recorder into the context so agents that use the LLMGateway
    // can pass it to the gateway — every LLM call then lands as a trajectory
    // step automatically. This is the AReaL paper's "HTTP boundary"
    // instrumentation pattern: zero-code capture for any agent that routes
    // its LLM access through the gateway.
    const enrichedCtx = { ...ctx, trajectoryRecorder: recorder };

    try {
      // Record the input observation
      recorder.observe({
        rowCount: ctx.dataframe?.length ?? 0,
        config: ctx.config,
      }, { phase: 'input' });

      // ── Episodic memory recall ──────────────────────────────────────
      // Before the agent runs, consult episodic memory for similar past
      // trajectories. If found, surface them on `ctx.similarExperiences`
      // and merge any "best practice" config (user config wins). This is
      // the in-context retrieval half of the AReaL self-evolution loop:
      // agents reuse configs that worked on similar data, then evolve
      // those configs via the Evolution Control Plane.
      if (options.memory) {
        const dataProfile: DataProfile = {
          rowCount: ctx.dataframe?.length ?? 0,
          columnCount: ctx.dataframe?.[0] ? Object.keys(ctx.dataframe[0]).length : 0,
          columnNames: ctx.dataframe?.[0] ? Object.keys(ctx.dataframe[0]) : [],
        };

        try {
          const experiences = await options.memory.search({
            agentId: agent.metadata.id,
            dataProfile,
            limit: 3,
          });

          if (experiences.length > 0) {
            recorder.observe({ experiences }, { phase: 'memory_recall' });
            // Surface recalled experiences on the context so the agent can
            // reuse prior configs / prompts that worked on similar data.
            (enrichedCtx as any).similarExperiences = experiences;
          }

          // Suggest best-practice config (merged with user config; user wins).
          const bestPractice = await options.memory.getBestPractice(
            agent.metadata.id,
            dataProfile,
          );
          if (bestPractice) {
            recorder.observe({ bestPractice }, { phase: 'best_practice' });
            // Merge: user config takes precedence so an explicit user setting
            // is never silently overridden by a recalled best-practice value.
            enrichedCtx.config = { ...bestPractice, ...(enrichedCtx.config ?? {}) };
          }
        } catch (memErr) {
          // Memory recall failures must never crash the agent — log to the
          // trajectory as an error step and continue with the original ctx.
          recorder.error(
            `Episodic memory recall failed: ${
              memErr instanceof Error ? memErr.message : String(memErr)
            }`,
            { phase: 'memory_recall' },
          );
        }
      }

      // Execute the agent (the agent's own execute may record sub-steps via the recorder if passed in ctx)
      const result = await originalExecute(enrichedCtx);

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
