/**
 * LLM Gateway Fallback Helper
 * =============================
 *
 * The three report-stage agents (InsightSummarizer, Recommendation,
 * NaturalLanguageQuery) route their LLM calls through the LLMGateway so
 * every call is automatically captured as a trajectory step (tokens, cost,
 * latency, prompt, response) with PII scrubbing and multi-provider
 * fallback (GLM → OpenAI → Anthropic → Google).
 *
 * If EVERY configured provider fails (network outage, all API keys invalid,
 * quota exhausted across all providers), the gateway returns an empty
 * ChatResponse with `model === 'none'` rather than throwing — the caller
 * is expected to degrade gracefully.
 *
 * This helper adds one last-resort fallback on top of the gateway: if the
 * gateway returns an empty response, call the GLM SDK directly via
 * z-ai-web-dev-sdk, bypassing the gateway entirely. The trade-off is
 * intentional: no trajectory capture, no cost calculation, no multi-provider
 * fallback — just a single direct call that maximizes the chance the agent
 * still produces a useful result when the gateway's whole provider list is
 * down. PII scrubbing is still applied (via the same `scrubPIIFromText`
 * helper the gateway uses) so we don't regress on governance.
 *
 * Usage:
 *   const gateway = new LLMGateway({ recorder: ctx.trajectoryRecorder });
 *   const response = await chatWithGatewayFallback(gateway, messages, options, {
 *     maxTokens: 1500,
 *     temperature: 0.3,
 *   });
 *   // response.text, response.model, response.provider, ... are all populated
 *   //   whether the call came back from the gateway or the direct fallback.
 */

import ZAI from 'z-ai-web-dev-sdk';
import {
  LLMGateway,
  scrubPIIFromText,
  type ChatMessage,
  type ChatOptions,
  type ChatResponse,
} from '../../llm-gateway';

/** Options for the direct-SDK fallback path. All optional. */
export interface FallbackOptions {
  /** GLM model to call directly. Defaults to `glm-4-flash` (fast + free). */
  model?: string;
  /** Sampling temperature. Defaults to `options.temperature ?? 0.4`. */
  temperature?: number;
  /** Max tokens to generate. Defaults to `options.maxTokens ?? 1000`. */
  maxTokens?: number;
}

/**
 * Call the LLM via the gateway, with a direct-GLM-SDK fallback when the
 * gateway exhausts every provider.
 *
 * Returns a `ChatResponse` with the same shape the gateway returns, so
 * callers don't need to special-case the fallback path.
 */
export async function chatWithGatewayFallback(
  gateway: LLMGateway,
  messages: ChatMessage[],
  options: ChatOptions,
  fallback?: FallbackOptions,
): Promise<ChatResponse> {
  const response = await gateway.chat(messages, options);

  // Detect "all gateway providers failed" — the gateway returns an empty
  // response with `model === 'none'` rather than throwing, so the caller
  // can decide how to degrade. Here we use that signal to trigger the
  // direct-SDK fallback.
  if (response.text === '' && response.model === 'none') {
    try {
      const zai = await ZAI.create();
      const start = Date.now();
      const model = fallback?.model ?? 'glm-4-flash';
      const temperature = fallback?.temperature ?? options.temperature ?? 0.4;
      const maxTokens = fallback?.maxTokens ?? options.maxTokens ?? 1000;

      const completion = await zai.chat.completions.create({
        model,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        thinking: { type: options.thinking === 'enabled' ? 'enabled' : 'disabled' },
        temperature,
        max_tokens: maxTokens,
      });

      const rawText: string = completion?.choices?.[0]?.message?.content ?? '';
      if (rawText) {
        // Apply the same PII scrubbing the gateway uses, so we don't regress
        // on governance just because we took the fallback path.
        const { scrubbed, piiRemoved } = scrubPIIFromText(rawText);
        console.warn(
          '[llm-fallback] Gateway exhausted all providers; fell back to direct GLM SDK call.',
        );
        return {
          text: scrubbed,
          provider: 'glm',
          model,
          tokensIn: Number(completion?.usage?.prompt_tokens ?? 0),
          tokensOut: Number(completion?.usage?.completion_tokens ?? 0),
          cost: 0, // GLM is free for Busara.
          latencyMs: Date.now() - start,
          piiScrubbed: piiRemoved > 0,
          // Preserve the gateway's fallbacksTried so the trajectory shows
          // which providers the gateway already attempted.
          fallbacksTried: response.fallbacksTried,
          raw: completion,
        };
      }
    } catch (err) {
      console.error(
        '[llm-fallback] Direct GLM SDK fallback also failed:',
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  return response;
}
