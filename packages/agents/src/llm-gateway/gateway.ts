/**
 * LLM Gateway — zero-code trajectory capture at the HTTP boundary
 * ===============================================================
 *
 * The LLMGateway is the single chokepoint through which every LLM call in
 * the Busara platform flows. Sitting at the HTTP boundary (the AReaL paper's
 * term for the boundary between agent code and provider code), it can
 * automatically instrument every call — no agent opt-in required.
 *
 * Every `chat()` and `stream()` call through the gateway:
 *   1. Picks a provider via the LLMRouter (with fallback)
 *   2. Records a trajectory step (if a TrajectoryRecorder is attached)
 *   3. Calls the provider, falling back on error
 *   4. Captures token usage, latency, and estimated cost
 *   5. Scrubs PII from the response text
 *   6. Returns a normalized ChatResponse
 *
 * This is the AReaL paper's central insight applied: trajectory capture
 * belongs at the HTTP boundary, not in agent code. Wrap an agent's LLM
 * access in the gateway and it gets trajectory capture for free.
 *
 * Usage:
 *   const gateway = new LLMGateway({ recorder });
 *   const response = await gateway.chat(
 *     [{ role: 'system', content: 'Be helpful.' },
 *      { role: 'user', content: 'What is 2+2?' }],
 *     { complexity: 'low' },
 *   );
 *   // response.text === '4'
 *   // trajectory has a new llm_call step with tokens + cost + latency
 */

import type { TrajectoryRecorder } from '../trajectory/recorder.js';
import type { TrajectoryLLMCall } from '../trajectory/types.js';
import { LLMRouter } from './router.js';
import {
  type Provider,
  type ChatMessage,
  type ChatOptions,
  type ProviderResponse,
} from './providers.js';
import { calculateCost, type ProviderId } from './costCalc.js';

// ============================================================================
// Public Types
// ============================================================================

/** Normalized chat response returned to callers. */
export interface ChatResponse {
  /** The completion text (PII-scrubbed if scrubPII is enabled). */
  text: string;
  /** Provider that produced the response. */
  provider: ProviderId;
  /** Model that produced the response. */
  model: string;
  /** Input tokens consumed. */
  tokensIn: number;
  /** Output tokens consumed. */
  tokensOut: number;
  /** Estimated USD cost. */
  cost: number;
  /** Wall-clock latency in milliseconds. */
  latencyMs: number;
  /** Whether PII scrubbing was applied. */
  piiScrubbed: boolean;
  /** Providers that were tried and failed before this one succeeded. */
  fallbacksTried: ProviderId[];
  /** Raw provider response (for debugging / advanced consumers). */
  raw?: unknown;
}

/** A single chunk in a streaming chat response. */
export interface ChatChunk {
  /** Incremental text. */
  delta: string;
  /** Whether this is the final chunk. */
  done: boolean;
  /** On the final chunk, the full ChatResponse. */
  response?: ChatResponse;
}

/** Gateway constructor options. */
export interface LLMGatewayOptions {
  /** Router to use (defaults to the shared singleton). */
  router?: LLMRouter;
  /** Trajectory recorder (optional — if set, every call is recorded as a step). */
  recorder?: TrajectoryRecorder;
  /** Whether to scrub PII from response text (default: true). */
  scrubPII?: boolean;
  /**
   * Custom provider list (overrides default providers in the router).
   * Mostly useful for tests that want to inject mock providers.
   */
  providers?: Provider[];
}

// ============================================================================
// PII Scrubbing
// ============================================================================

/**
 * PII patterns to scrub from LLM responses.
 *
 * Reuses the same patterns as the trajectory DataProxy and the
 * PIILeakageGuardrail, so the gateway's notion of PII is consistent
 * with the rest of the Busara governance stack.
 *
 * Order matters: more-specific patterns must run BEFORE more-general
 * ones so they don't get masked by a partial earlier match (e.g. a
 * 16-digit credit card would be partially consumed by the phone regex
 * if phone ran first). The order below is: SSN (very specific format)
 * → credit_card (13-16 digits, no separators) → phone (10 digits in a
 * specific separator format) → email → IP → API key.
 */
const PII_PATTERNS: Array<{ type: string; regex: RegExp; replacement: string }> = [
  { type: 'ssn', regex: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '[SSN]' },
  { type: 'credit_card', regex: /\b(?:\d[ -]*?){13,16}\b/g, replacement: '[CREDIT_CARD]' },
  { type: 'phone', regex: /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3,4}[-.\s]?\d{4}/g, replacement: '[PHONE]' },
  { type: 'email', regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, replacement: '[EMAIL]' },
  { type: 'ip_address', regex: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, replacement: '[IP]' },
  { type: 'api_key', regex: /\b(?:sk|pk|ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}\b/g, replacement: '[API_KEY]' },
];

/** Scrub PII from a text string, returning the scrubbed text + count of removals. */
export function scrubPIIFromText(text: string): { scrubbed: string; piiRemoved: number } {
  let result = text;
  let piiRemoved = 0;
  for (const { regex, replacement } of PII_PATTERNS) {
    // Global regexes are stateful — clone by constructing a new one to
    // avoid carry-over state across calls.
    const fresh = new RegExp(regex.source, regex.flags);
    const matches = result.match(fresh);
    if (matches) {
      piiRemoved += matches.length;
      result = result.replace(fresh, replacement);
    }
  }
  return { scrubbed: result, piiRemoved };
}

// ============================================================================
// LLMGateway
// ============================================================================

/**
 * LLMGateway — the proxy. Wraps every LLM call with automatic trajectory
 * recording, cost capture, latency tracking, and PII scrubbing.
 */
export class LLMGateway {
  private readonly router: LLMRouter;
  private readonly recorder?: TrajectoryRecorder;
  private readonly scrubPIIEnabled: boolean;

  constructor(options: LLMGatewayOptions = {}) {
    this.router = options.router ?? new LLMRouter(options.providers);
    this.recorder = options.recorder;
    this.scrubPIIEnabled = options.scrubPII ?? true;
  }

  /**
   * Execute a chat completion, automatically:
   *   - routing to the best provider (with fallback)
   *   - recording a trajectory step (if recorder attached)
   *   - capturing tokens, latency, and cost
   *   - scrubbing PII from the response
   */
  async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<ChatResponse> {
    const decisions = this.router.route(options);
    const fallbacksTried: ProviderId[] = [];
    const callStart = Date.now();

    let lastError: Error | null = null;

    for (const decision of decisions) {
      try {
        const response: ProviderResponse = await decision.provider.chat(messages, {
          ...options,
          model: decision.model,
        });

        // Cost estimation from model + tokens.
        const cost = calculateCost(response.model, response.tokensIn, response.tokensOut);

        // PII scrubbing on response text.
        let text = response.text;
        let piiScrubbed = false;
        if (this.scrubPIIEnabled) {
          const result = scrubPIIFromText(text);
          text = result.scrubbed;
          piiScrubbed = result.piiRemoved > 0;
        }

        const chatResponse: ChatResponse = {
          text,
          provider: response.provider,
          model: response.model,
          tokensIn: response.tokensIn,
          tokensOut: response.tokensOut,
          cost,
          latencyMs: Date.now() - callStart,
          piiScrubbed,
          fallbacksTried,
          raw: response.raw,
        };

        // Record trajectory step (if recorder attached).
        this.recordTrajectory(messages, options, response, cost);

        return chatResponse;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        fallbacksTried.push(decision.provider.name);
        console.warn(
          `[llm-gateway] Provider ${decision.provider.name} failed:`,
          lastError.message,
          '— falling back to next provider.',
        );
        continue;
      }
    }

    // All providers failed — return an empty response rather than throwing,
    // so the caller's agent can decide how to degrade gracefully.
    console.error('[llm-gateway] All providers failed:', lastError?.message);
    return {
      text: '',
      provider: 'glm' as ProviderId,
      model: 'none',
      tokensIn: 0,
      tokensOut: 0,
      cost: 0,
      latencyMs: Date.now() - callStart,
      piiScrubbed: false,
      fallbacksTried,
    };
  }

  /**
   * Stream a chat completion as an async generator of chunks.
   *
   * This is a "fake" stream — we issue a single non-streaming chat call and
   * then chunk the response text on whitespace boundaries. This keeps the
   * API contract uniform across providers (most of which have inconsistent
   * streaming APIs) while still letting consumers render progress
   * incrementally. A future iteration can replace this with true SSE
   * streaming for the GLM provider without changing the public API.
   */
  async *stream(
    messages: ChatMessage[],
    options: ChatOptions = {},
  ): AsyncGenerator<ChatChunk> {
    const response = await this.chat(messages, options);

    // Chunk on word boundaries (preserving whitespace).
    const tokens = response.text.split(/(\s+)/);
    for (let i = 0; i < tokens.length; i++) {
      const isLast = i === tokens.length - 1;
      yield {
        delta: tokens[i],
        done: isLast,
        response: isLast ? response : undefined,
      };
    }

    // Edge case: empty response — still yield one done chunk.
    if (tokens.length === 0) {
      yield { delta: '', done: true, response };
    }
  }

  // ─── Internal: trajectory recording ────────────────────────────────

  /**
   * Record this LLM call as a trajectory step (if a recorder is attached).
   *
   * Extracts the system prompt and user prompt from the message list so the
   * trajectory is fully replayable — knowing the exact prompt is essential
   * for both credit assignment and for the Evolution Control Plane to
   * optimize prompts over time.
   */
  private recordTrajectory(
    messages: ChatMessage[],
    options: ChatOptions,
    response: ProviderResponse,
    cost: number,
  ): void {
    if (!this.recorder) return;

    const systemPrompt = messages
      .filter(m => m.role === 'system')
      .map(m => m.content)
      .join('\n\n');
    const userPrompt = messages
      .filter(m => m.role !== 'system')
      .map(m => m.content)
      .join('\n\n');

    const call: TrajectoryLLMCall = {
      provider: response.provider,
      model: response.model,
      systemPrompt,
      userPrompt,
      response: response.text,
      tokensIn: response.tokensIn,
      tokensOut: response.tokensOut,
      temperature: options.temperature,
      latencyMs: response.latencyMs,
      cost,
    };

    this.recorder.llmCall(call, {
      complexity: options.complexity,
      thinking: options.thinking,
    });
  }

  // ─── Accessors ─────────────────────────────────────────────────────

  /** The router this gateway uses (for inspection / testing). */
  getRouter(): LLMRouter {
    return this.router;
  }

  /** Whether PII scrubbing is enabled on this gateway. */
  isPIIScrubbingEnabled(): boolean {
    return this.scrubPIIEnabled;
  }
}

// ============================================================================
// Convenience: shared singleton
// ============================================================================

/**
 * Shared default gateway instance.
 *
 * Has no recorder attached — use this for one-off LLM calls outside of an
 * agent execution context (e.g. the apps/web LLM router). Agents should
 * construct their own gateway with the active recorder so their LLM calls
 * are captured in the trajectory.
 */
export const defaultGateway = new LLMGateway();
