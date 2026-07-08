/**
 * LLM Cost Calculation
 * =====================
 *
 * Per-model USD pricing (per token) for every provider the LLM Gateway
 * can route to. Costs are expressed in USD-per-token as floats; multiply
 * by token counts to get the dollar cost of a call.
 *
 * Pricing source: each provider's public pricing page, captured at the
 * time the gateway was written. GLM (via z-ai-web-dev-sdk) is free for
 * the Busara workspace, so its cost is zero.
 *
 * The AReaL paper (arXiv:2607.01120) emphasizes that trajectory data must
 * include cost signals so the Evolution Control Plane can optimize agent
 * routing for cost. This module is the single source of truth for those
 * signals.
 */

// ============================================================================
// Types
// ============================================================================

/** Per-token cost for a single model, in USD. */
export interface ModelCost {
  /** USD per input (prompt) token. */
  input: number;
  /** USD per output (completion) token. */
  output: number;
}

/** Provider identifier (matches TrajectoryLLMCall.provider). */
export type ProviderId = 'glm' | 'openai' | 'anthropic' | 'google';

// ============================================================================
// Cost Registry
// ============================================================================

/**
 * Cost-per-token for every model the gateway knows about.
 *
 * GLM models are free for the Busara workspace. Commercial providers are
 * priced per their public rate cards. Prices are in USD-per-token, e.g.
 * `2.50e-6` = $0.0000025 per token = $2.50 per million tokens.
 */
export const MODEL_COSTS: Record<string, ModelCost> = {
  // ─── GLM (free for Busara) ───────────────────────────────────────────
  'glm-4.6': { input: 0, output: 0 },
  'glm-4-flash': { input: 0, output: 0 },
  'glm-4-air': { input: 0, output: 0 },
  'glm-4-plus': { input: 0, output: 0 },

  // ─── OpenAI ──────────────────────────────────────────────────────────
  'gpt-4o': { input: 2.50e-6, output: 10e-6 },
  'gpt-4o-mini': { input: 0.15e-6, output: 0.60e-6 },
  'o3-mini': { input: 1.10e-6, output: 4.40e-6 },
  'gpt-4-turbo': { input: 10e-6, output: 30e-6 },

  // ─── Anthropic ───────────────────────────────────────────────────────
  'claude-3-5-sonnet': { input: 3e-6, output: 15e-6 },
  'claude-3-5-sonnet-20241022': { input: 3e-6, output: 15e-6 },
  'claude-3-haiku-20240307': { input: 0.25e-6, output: 1.25e-6 },
  'claude-3-opus-20240229': { input: 15e-6, output: 75e-6 },

  // ─── Google Gemini ───────────────────────────────────────────────────
  'gemini-2.0-flash': { input: 0.10e-6, output: 0.40e-6 },
  'gemini-1.5-flash': { input: 0.075e-6, output: 0.30e-6 },
  'gemini-2.5-pro': { input: 1.25e-6, output: 10e-6 },
  'gemini-1.5-pro': { input: 1.25e-6, output: 5e-6 },
};

// ============================================================================
// Cost calculation
// ============================================================================

/**
 * Calculate the USD cost of an LLM call.
 *
 * Unknown models default to zero cost — we'd rather under-bill than
 * silently over-bill a model whose pricing we haven't captured.
 */
export function calculateCost(
  model: string,
  tokensIn: number,
  tokensOut: number,
): number {
  const cost = MODEL_COSTS[model];
  if (!cost) return 0;
  return cost.input * tokensIn + cost.output * tokensOut;
}

/**
 * Look up the per-token cost for a model.
 * Returns undefined for unknown models.
 */
export function getCostForModel(model: string): ModelCost | undefined {
  return MODEL_COSTS[model];
}

/**
 * Cheap token-count estimator when the provider doesn't return usage.
 * Uses the standard ~4 chars / token heuristic.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}
