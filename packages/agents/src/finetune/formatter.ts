/**
 * Fine-Tuning Pipeline — Training Data Formatter
 * ==============================================
 *
 * Converts production trajectories (from the TrajectoryStore / DataProxy)
 * into the canonical training-data formats consumed by fine-tuning
 * frameworks (SFT, DPO, RLHF).
 *
 * Each format selects a different slice of the trajectory and shapes it
 * differently:
 *
 *   SFT  — Take every LLM call from trajectories with positive average
 *          reward. (system+user prompt → response). This teaches the
 *          policy to imitate what worked.
 *
 *   DPO  — Pair positive-reward responses (chosen) against negative-reward
 *          responses (rejected) for similar prompts. This teaches the
 *          policy to PREFER one response over another without needing a
 *          reward model.
 *
 *   RLHF — Keep every LLM call with its trajectory's average reward.
 *          This is the raw material for reward-model training followed
 *          by PPO.
 *
 * The formatter is pure: given the same trajectories it always produces
 * the same samples. No I/O, no randomness. This makes it trivial to test
 * and to replay.
 */

import type { Trajectory } from '../trajectory/types';
import type { TrainingDataFormat, TrainingSample } from './types';

export class TrainingDataFormatter {
  /**
   * Convert trajectories to SFT (Supervised Fine-Tuning) format.
   *
   * For every LLM-call step in every trajectory whose average reward is
   * positive, emit a (prompt, completion) sample. The prompt is the
   * system+user prompt concatenated; the completion is the LLM response.
   *
   * Negative-reward trajectories are skipped — we don't want the policy
   * to imitate responses users disliked.
   */
  toSFT(trajectories: Trajectory[]): TrainingDataFormat {
    const samples: TrainingSample[] = [];
    for (const t of trajectories) {
      for (const step of t.steps) {
        if (step.type === 'llm_call' && step.llmCall) {
          const avgReward = this.avgReward(t);
          if (avgReward > 0) {
            samples.push({
              prompt: `${step.llmCall.systemPrompt}\n\n${step.llmCall.userPrompt}`,
              completion: step.llmCall.response,
              metadata: {
                agentId: t.agentId,
                trajectoryId: t.id,
                reward: avgReward,
              },
            });
          }
        }
      }
    }
    return { format: 'sft', samples };
  }

  /**
   * Convert trajectories to DPO (Direct Preference Optimization) format.
   *
   * For each agent, find pairs of (positive, negative) reward trajectories.
   * For each pair, if their user prompts are similar (within 200 chars in
   * length — a cheap proxy for "same kind of question"), emit a
   * (prompt, chosen, rejected) sample where:
   *   - chosen   = the positive-reward response
   *   - rejected = the negative-reward response
   *
   * Only one rejected sample is paired with each chosen sample (the first
   * suitable match), to avoid exploding the dataset size.
   */
  toDPO(trajectories: Trajectory[]): TrainingDataFormat {
    // Group by agentId so we only pair trajectories from the same agent.
    const byAgent = new Map<string, Trajectory[]>();
    for (const t of trajectories) {
      if (!byAgent.has(t.agentId)) byAgent.set(t.agentId, []);
      byAgent.get(t.agentId)!.push(t);
    }

    const samples: TrainingSample[] = [];
    for (const [, agentTrajectories] of byAgent) {
      const positive = agentTrajectories.filter(t => this.avgReward(t) > 0.3);
      const negative = agentTrajectories.filter(t => this.avgReward(t) < -0.3);

      for (const pos of positive) {
        const posLlm = pos.steps.find(s => s.type === 'llm_call' && s.llmCall);
        const posCall = posLlm?.llmCall;
        if (!posCall) continue;

        // Find a negative with a similar-length user prompt.
        for (const neg of negative) {
          const negLlm = neg.steps.find(s => s.type === 'llm_call' && s.llmCall);
          const negCall = negLlm?.llmCall;
          if (!negCall) continue;

          if (Math.abs(posCall.userPrompt.length - negCall.userPrompt.length) < 200) {
            samples.push({
              prompt: `${posCall.systemPrompt}\n\n${posCall.userPrompt}`,
              chosen: posCall.response,
              rejected: negCall.response,
              metadata: {
                agentId: pos.agentId,
                positiveId: pos.id,
                negativeId: neg.id,
              },
            });
            break; // one negative per positive
          }
        }
      }
    }
    return { format: 'dpo', samples };
  }

  /**
   * Convert trajectories to RLHF format.
   *
   * Keep every LLM call from every trajectory, with the trajectory's
   * average reward. The prompt and response are tokenized (whitespace-split
   * for now — a real tokenizer would replace this in the training backend).
   *
   * RLHF data is used to train a reward model first, then PPO uses that
   * reward model to optimize the policy.
   */
  toRLHF(trajectories: Trajectory[]): TrainingDataFormat {
    const samples: TrainingSample[] = [];
    for (const t of trajectories) {
      const avgReward = this.avgReward(t);
      for (const step of t.steps) {
        if (step.type === 'llm_call' && step.llmCall) {
          samples.push({
            promptTokens: step.llmCall.userPrompt.split(/\s+/),
            responseTokens: step.llmCall.response.split(/\s+/),
            reward: avgReward,
            metadata: { agentId: t.agentId, trajectoryId: t.id },
          });
        }
      }
    }
    return { format: 'rlhf', samples };
  }

  /**
   * Average reward for a trajectory (0 if no rewards).
   * Mirrors the heuristic used by InMemoryTrajectoryStore.
   */
  private avgReward(t: Trajectory): number {
    return t.rewards.reduce((a, r) => a + r.value, 0) / Math.max(t.rewards.length, 1);
  }
}
