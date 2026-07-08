/**
 * LLM Gateway — Public API
 * =========================
 *
 * The LLM Gateway is the Busara implementation of the AReaL paper's
 * key architectural insight: trajectory capture belongs at the HTTP
 * boundary (the LLM gateway proxy), not via agent opt-in. Wrap every
 * LLM call in `LLMGateway.chat()` and you get zero-code instrumentation
 * of ALL agents — tokens, cost, latency, PII scrubbing, and trajectory
 * recording happen automatically.
 *
 * Public surface:
 *   - `LLMGateway` — the proxy class
 *   - `LLMRouter`  — multi-provider routing with fallback
 *   - `Provider` interface + 4 adapters (GLM, OpenAI, Anthropic, Google)
 *   - `calculateCost`, `MODEL_COSTS`, `estimateTokens` — cost utilities
 *   - `scrubPIIFromText` — PII scrubbing utility
 *   - Types: `ChatMessage`, `ChatOptions`, `ChatResponse`, `ChatChunk`
 */

// Core proxy
export { LLMGateway, defaultGateway } from './gateway.js';
export type { LLMGatewayOptions, ChatResponse, ChatChunk } from './gateway.js';
export { scrubPIIFromText } from './gateway.js';

// Router
export { LLMRouter, defaultRouter } from './router.js';
export type { RouteDecision } from './router.js';

// Providers + shared chat types
export {
  GLMProvider,
  OpenAIProvider,
  AnthropicProvider,
  GoogleProvider,
  createDefaultProviders,
  providerDisplayName,
} from './providers.js';
export type {
  Provider,
  ChatMessage,
  ChatOptions,
  ProviderResponse,
  Complexity,
} from './providers.js';

// Cost calculation
export {
  MODEL_COSTS,
  calculateCost,
  getCostForModel,
  estimateTokens,
} from './costCalc.js';
export type { ModelCost, ProviderId } from './costCalc.js';
