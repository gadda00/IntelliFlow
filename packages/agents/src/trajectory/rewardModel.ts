/**
 * RewardModel — automatically scores agent output quality.
 *
 * Inspired by: DeepEval, LangSmith evaluators, RAGAS.
 *
 * The EvolutionControlPlane's SCHEDULE_FINE_TUNE action requires dense reward
 * signal to actually tune a policy. With only explicit (user thumbs up/down)
 * rewards the signal is too sparse for fine-tuning. RewardModel closes that
 * gap by computing automated quality scores for every trajectory.
 *
 * Three implementations:
 *   1. HeuristicRewardModel — fast, rule-based (free, no LLM)
 *   2. LLMJudgeRewardModel  — uses GLM-4.6 to judge output quality
 *   3. CompositeRewardModel — combines multiple models (weighted)
 *
 * Scores are normalized to [-1.0, 1.0] to match the RewardSignal contract.
 */

import type { Trajectory, RewardSignal } from './types';
import { createAutomatedReward } from './evolution';

// ============================================================================
// Public interfaces
// ============================================================================

export interface RewardModel {
  name: string;
  score(trajectory: Trajectory): Promise<RewardScore>;
}

export interface RewardScore {
  /** Overall score, -1.0 to 1.0. */
  value: number;
  /** Confidence in the score, 0.0 to 1.0. */
  confidence: number;
  /** Breakdown of the score. */
  components: RewardScoreComponent[];
  /** What the model evaluated. */
  rationale?: string;
}

export interface RewardScoreComponent {
  name: string;
  value: number;
  weight: number;
  details?: Record<string, unknown>;
}

// ============================================================================
// 1. Heuristic Reward Model
// ============================================================================

/**
 * Fast, free, rule-based reward model.
 *
 * Combines four equally-important-but-differently-weighted signals:
 *   - success (40%)      — did the trajectory complete successfully?
 *   - efficiency (20%)   — was the execution time reasonable for the row count?
 *   - richness (20%)     — did the agent produce a multi-step trajectory?
 *   - error_free (20%)   — did the agent avoid step-level errors?
 *
 * Confidence is moderate (0.7) — heuristics are noisy.
 */
export class HeuristicRewardModel implements RewardModel {
  name = 'heuristic';

  async score(trajectory: Trajectory): Promise<RewardScore> {
    const components: RewardScoreComponent[] = [];

    // Success component (40%)
    const successValue = trajectory.status === 'success' ? 1.0 : -1.0;
    components.push({ name: 'success', value: successValue, weight: 0.4 });

    // Efficiency component (20%) — reward fast execution relative to data size
    const expectedMs = Math.max(1000, trajectory.metadata.rowCount * 10);
    const efficiency = Math.min(1.0, expectedMs / Math.max(trajectory.metrics.totalDurationMs, 1));
    components.push({
      name: 'efficiency',
      value: efficiency * 2 - 1, // normalize [0,1] → [-1,1]
      weight: 0.2,
      details: { durationMs: trajectory.metrics.totalDurationMs, expectedMs },
    });

    // Richness component (20%) — reward detailed, multi-step output
    const stepCount = trajectory.metrics.stepCount;
    const richness = Math.min(1.0, stepCount / 5); // 5 steps = full score
    components.push({
      name: 'richness',
      value: richness * 2 - 1,
      weight: 0.2,
      details: { stepCount },
    });

    // Error-free component (20%) — penalize errors
    const errorPenalty = trajectory.metrics.errorCount > 0 ? -1.0 : 1.0;
    components.push({
      name: 'error_free',
      value: errorPenalty,
      weight: 0.2,
      details: { errorCount: trajectory.metrics.errorCount },
    });

    const value = components.reduce((acc, c) => acc + c.value * c.weight, 0);

    return {
      value,
      confidence: 0.7, // heuristic — moderate confidence
      components,
      rationale: `Heuristic score: success=${trajectory.status}, ${trajectory.metrics.stepCount} steps, ${trajectory.metrics.errorCount} errors`,
    };
  }
}

// ============================================================================
// 2. LLM Judge Reward Model
// ============================================================================

/**
 * Uses an LLM (default: GLM-4.6) to judge agent output quality.
 *
 * The `llmCall` callback is injected so callers can route through Busara's
 * LLM gateway, mock for tests, or swap providers without touching this class.
 *
 * Falls back to HeuristicRewardModel (with reduced confidence) if the LLM
 * call fails or returns unparseable JSON.
 */
export class LLMJudgeRewardModel implements RewardModel {
  name = 'llm-judge';

  constructor(private llmCall: (prompt: string) => Promise<string>) {}

  async score(trajectory: Trajectory): Promise<RewardScore> {
    const output = trajectory.steps[trajectory.steps.length - 1]?.result;
    const input = trajectory.steps[0]?.observation;

    const prompt = `You are an expert evaluator for data analysis agents.
Score the following agent output on a scale of -1.0 (very poor) to 1.0 (excellent).

Agent: ${trajectory.agentId} (${trajectory.agentVersion})
Task: ${trajectory.contextSnapshot.config?.objectives ?? 'data analysis'}
Input summary: ${JSON.stringify(input).slice(0, 500)}
Output: ${JSON.stringify(output).slice(0, 1000)}

Evaluate on:
1. Correctness — is the output accurate?
2. Completeness — does it address the task?
3. Clarity — is the output well-structured?
4. Actionability — can a user act on this?

Respond with ONLY a JSON object:
{"score": <number>, "confidence": <number>, "rationale": "<string>"}`;

    try {
      const response = await this.llmCall(prompt);
      const parsed = JSON.parse(response) as { score: number; confidence?: number; rationale?: string };

      return {
        value: Math.max(-1, Math.min(1, parsed.score)),
        confidence: Math.max(0, Math.min(1, parsed.confidence ?? 0.8)),
        components: [{ name: 'llm_judge', value: parsed.score, weight: 1.0 }],
        rationale: parsed.rationale,
      };
    } catch (error) {
      // Fall back to heuristic if LLM fails or response is unparseable
      const heuristic = new HeuristicRewardModel();
      const fallback = await heuristic.score(trajectory);
      fallback.rationale = `LLM judge failed (${error}), falling back to heuristic: ${fallback.rationale}`;
      fallback.confidence = 0.3; // low confidence in fallback
      return fallback;
    }
  }
}

// ============================================================================
// 3. Composite Reward Model
// ============================================================================

/**
 * Combines multiple reward models via a weighted average.
 *
 * If `weights` is omitted or its length doesn't match `models.length`, the
 * models are weighted equally (1/N each).
 */
export class CompositeRewardModel implements RewardModel {
  name = 'composite';

  constructor(private models: RewardModel[], private weights: number[] = []) {}

  async score(trajectory: Trajectory): Promise<RewardScore> {
    const scores = await Promise.all(this.models.map(m => m.score(trajectory)));

    const weights =
      this.weights.length === this.models.length
        ? this.weights
        : this.models.map(() => 1 / this.models.length);

    const totalWeight = weights.reduce((a, b) => a + b, 0);
    const value = scores.reduce((acc, s, i) => acc + s.value * weights[i], 0) / totalWeight;
    const confidence =
      scores.reduce((acc, s, i) => acc + s.confidence * weights[i], 0) / totalWeight;

    return {
      value,
      confidence,
      components: scores.flatMap(s => s.components),
      rationale: scores.map((s, i) => `${this.models[i].name}: ${s.value.toFixed(2)}`).join(', '),
    };
  }
}

// ============================================================================
// Helper: score a trajectory and add the reward
// ============================================================================

/**
 * Score a trajectory with the given RewardModel and append the resulting
 * RewardSignal to `trajectory.rewards`.
 *
 * The reward is recorded with type='automated' and source='quality_score',
 * so the EvolutionControlPlane's reward distribution tracking will pick it
 * up automatically alongside explicit user feedback.
 */
export async function scoreAndReward(
  trajectory: Trajectory,
  model: RewardModel,
): Promise<{ trajectory: Trajectory; score: RewardScore }> {
  const score = await model.score(trajectory);
  const reward: RewardSignal = createAutomatedReward('quality_score', score.value, {
    confidence: score.confidence,
    rationale: score.rationale,
    model: model.name,
  });
  trajectory.rewards.push(reward);
  return { trajectory, score };
}
