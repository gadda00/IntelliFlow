// Busara LLM Router — thin wrapper over @busara/agents LLMGateway
//
// All 5 advisory documents recommend NOT locking to a single LLM provider.
// The LLMGateway (in @busara/agents) implements multi-provider routing
// with fallback, cost capture, latency tracking, PII scrubbing, and
// (when a TrajectoryRecorder is attached) automatic trajectory recording.
//
// This file preserves the existing `llmRouter(req) -> LLMResponse` API
// that the rest of apps/web depends on, but delegates the actual LLM call
// to the gateway. The gateway handles:
//   - Provider routing (GLM → OpenAI → Anthropic → Google, with fallback)
//   - Token usage capture
//   - Cost estimation
//   - Latency tracking
//   - PII scrubbing on response
//   - Trajectory step recording (when a recorder is attached)
//
// Providers supported (via the gateway):
//   1. z-ai-web-dev-sdk (GLM-4.6) — always available, free for Busara
//   2. OpenAI (GPT-4o, o3-mini) — if OPENAI_API_KEY is set
//   3. Anthropic (Claude) — if ANTHROPIC_API_KEY is set
//   4. Google Gemini — if GOOGLE_GEMINI_API_KEY is set

import 'server-only';
import {
  LLMGateway,
  type ChatMessage,
  type ChatOptions,
  type ProviderId,
} from '@busara/agents';

export type Complexity = 'low' | 'medium' | 'high';

export interface LLMRequest {
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
  complexity?: Complexity;
}

export interface LLMResponse {
  text: string;
  model: string;
  provider: string;
  durationMs: number;
}

/**
 * Singleton gateway instance for apps/web.
 *
 * No trajectory recorder is attached here — the gateway is used outside
 * of any agent execution context (e.g. by the AI Narrative Generator).
 * When called from inside an agent, the agent constructs its own gateway
 * with the active recorder so the LLM call lands in the trajectory.
 */
const _gateway = new LLMGateway();

/**
 * Execute an LLM chat call via the LLMGateway.
 *
 * Tries providers in fallback order (GLM → OpenAI → Anthropic → Google)
 * and returns the first successful response. Maintains the same
 * `LLMResponse` shape that callers depend on.
 */
export async function llmRouter(req: LLMRequest): Promise<LLMResponse> {
  const messages: ChatMessage[] = [
    { role: 'system', content: req.system },
    { role: 'user', content: req.user },
  ];

  const options: ChatOptions = {
    complexity: req.complexity ?? 'medium',
    temperature: req.temperature ?? 0.4,
    maxTokens: req.maxTokens ?? 1000,
  };

  const response = await _gateway.chat(messages, options);

  return {
    text: response.text,
    model: response.model,
    provider: response.provider,
    durationMs: response.latencyMs,
  };
}

/**
 * List the providers the gateway can route to, with their per-complexity
 * model names. Used by the admin UI to show which providers are live.
 */
export function getAvailableProviders(): { name: string; available: boolean; models: string[] }[] {
  return _gateway.getRouter().list().map(p => ({
    name: p.name,
    available: p.available,
    models: Object.values(p.models),
  }));
}

/**
 * Expose the underlying gateway for callers that need the full
 * `ChatResponse` (with tokens, cost, fallbacks) rather than the legacy
 * `LLMResponse` shape.
 */
export function getLLMGateway(): LLMGateway {
  return _gateway;
}

// Re-export the provider id type so callers can reference it.
export type { ProviderId };
