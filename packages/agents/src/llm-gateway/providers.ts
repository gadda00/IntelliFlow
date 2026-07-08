/**
 * LLM Provider Adapters
 * ======================
 *
 * One adapter per LLM provider, all exposing the same `Provider.chat()` API.
 * The LLMGateway is provider-agnostic — it routes a chat call to whichever
 * adapter the LLMRouter picks, and the adapter translates the call into the
 * provider's native HTTP/SDK request and parses the response.
 *
 * Providers supported:
 *   1. GLM (via z-ai-web-dev-sdk) — always available, free for Busara
 *   2. OpenAI (via fetch to api.openai.com) — if OPENAI_API_KEY is set
 *   3. Anthropic (via fetch to api.anthropic.com) — if ANTHROPIC_API_KEY is set
 *   4. Google Gemini (via fetch to generativelanguage.googleapis.com) — if GOOGLE_GEMINI_API_KEY is set
 *
 * Each adapter returns a normalized ProviderResponse with:
 *   - text          — the completion text
 *   - tokensIn      — input token count (from provider usage when available, else estimated)
 *   - tokensOut     — output token count (from provider usage when available, else estimated)
 *   - model         — the actual model that responded
 *   - provider      — the provider id
 *   - latencyMs     — wall-clock time of the call
 *   - raw?          — raw provider response (for debugging / advanced consumers)
 *
 * The AReaL paper (arXiv:2607.01120) identifies the LLM gateway as the
 * correct boundary for trajectory capture — every LLM call funnels through
 * here regardless of which agent made it, so instrumentation is automatic
 * and universal.
 */

import ZAI from 'z-ai-web-dev-sdk';
import { estimateTokens } from './costCalc.js';
import type { ProviderId } from './costCalc.js';

// ============================================================================
// Shared Types
// ============================================================================

/** A single chat message in the OpenAI-style role/content format. */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Complexity tier — maps to a per-provider model name. */
export type Complexity = 'low' | 'medium' | 'high';

/** Options passed to a provider's chat() method. */
export interface ChatOptions {
  /** Explicit model name (overrides complexity-based selection). */
  model?: string;
  /** Explicit provider id — skip routing, use this provider only. */
  provider?: ProviderId;
  /** Complexity tier — used by the router to pick a model. */
  complexity?: Complexity;
  /** Sampling temperature (0 = deterministic, 1 = creative). */
  temperature?: number;
  /** Maximum tokens to generate. */
  maxTokens?: number;
  /** Whether to enable extended thinking / reasoning (provider-dependent). */
  thinking?: 'enabled' | 'disabled';
}

/** Normalized provider response. */
export interface ProviderResponse {
  /** The completion text. */
  text: string;
  /** Number of input tokens consumed (from provider usage, else estimated). */
  tokensIn: number;
  /** Number of output tokens consumed (from provider usage, else estimated). */
  tokensOut: number;
  /** The actual model name that produced the response. */
  model: string;
  /** The provider id. */
  provider: ProviderId;
  /** Wall-clock latency of the call in milliseconds. */
  latencyMs: number;
  /** Raw provider response (for debugging / advanced consumers). */
  raw?: unknown;
}

/** Common interface every provider adapter implements. */
export interface Provider {
  /** Provider id — matches TrajectoryLLMCall.provider. */
  readonly name: ProviderId;
  /** Whether this provider is available in the current environment. */
  readonly available: boolean;
  /** Models this provider knows how to serve, keyed by complexity. */
  readonly models: Record<Complexity, string>;
  /** Execute a chat completion. */
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<ProviderResponse>;
}

// ============================================================================
// GLM Provider (via z-ai-web-dev-sdk)
// ============================================================================

/**
 * GLM provider — always available in the Busara workspace because the
 * z-ai-web-dev-sdk is bundled. Lazy-initializes the SDK client so a
 * transient SDK failure (e.g. missing env in tests) doesn't crash the
 * process at import time.
 */
export class GLMProvider implements Provider {
  readonly name: ProviderId = 'glm';
  readonly available: boolean = true;
  readonly models: Record<Complexity, string> = {
    low: 'glm-4-flash',
    medium: 'glm-4.6',
    high: 'glm-4.6',
  };

  private zaiClient: any = null;

  /** Lazy-load the ZAI client. Returns null if SDK init fails. */
  private async getClient(): Promise<any> {
    if (this.zaiClient) return this.zaiClient;
    try {
      this.zaiClient = await ZAI.create();
      return this.zaiClient;
    } catch (err) {
      console.warn('[llm-gateway] GLM (z-ai-web-dev-sdk) init failed:', err);
      return null;
    }
  }

  async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<ProviderResponse> {
    const start = Date.now();
    const client = await this.getClient();
    if (!client) {
      throw new Error('GLM provider unavailable: z-ai-web-dev-sdk init failed');
    }

    const model = options.model ?? this.models[options.complexity ?? 'medium'];

    const completion = await client.chat.completions.create({
      model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      thinking: { type: options.thinking === 'enabled' ? 'enabled' : 'disabled' },
      temperature: options.temperature ?? 0.4,
      max_tokens: options.maxTokens ?? 1000,
    });

    const text: string = completion?.choices?.[0]?.message?.content ?? '';
    // z-ai-web-dev-sdk returns OpenAI-style usage when available.
    const usage = completion?.usage ?? {};
    const tokensIn = Number(usage.prompt_tokens ?? estimateTokens(messages.map(m => m.content).join('\n')));
    const tokensOut = Number(usage.completion_tokens ?? estimateTokens(text));

    return {
      text,
      tokensIn,
      tokensOut,
      model,
      provider: 'glm',
      latencyMs: Date.now() - start,
      raw: completion,
    };
  }
}

// ============================================================================
// OpenAI Provider (via fetch)
// ============================================================================

export class OpenAIProvider implements Provider {
  readonly name: ProviderId = 'openai';
  readonly available: boolean = !!process.env.OPENAI_API_KEY;
  readonly models: Record<Complexity, string> = {
    low: 'gpt-4o-mini',
    medium: 'gpt-4o',
    high: 'o3-mini',
  };

  async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<ProviderResponse> {
    const start = Date.now();
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OpenAI provider unavailable: OPENAI_API_KEY not set');

    const model = options.model ?? this.models[options.complexity ?? 'medium'];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        temperature: options.temperature ?? 0.4,
        max_tokens: options.maxTokens ?? 1000,
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`OpenAI API error ${response.status}: ${errText.slice(0, 200)}`);
    }

    const data: any = await response.json();
    const text: string = data?.choices?.[0]?.message?.content ?? '';
    const tokensIn = Number(data?.usage?.prompt_tokens ?? estimateTokens(messages.map(m => m.content).join('\n')));
    const tokensOut = Number(data?.usage?.completion_tokens ?? estimateTokens(text));

    return {
      text,
      tokensIn,
      tokensOut,
      model,
      provider: 'openai',
      latencyMs: Date.now() - start,
      raw: data,
    };
  }
}

// ============================================================================
// Anthropic Provider (via fetch)
// ============================================================================

export class AnthropicProvider implements Provider {
  readonly name: ProviderId = 'anthropic';
  readonly available: boolean = !!process.env.ANTHROPIC_API_KEY;
  readonly models: Record<Complexity, string> = {
    low: 'claude-3-haiku-20240307',
    medium: 'claude-3-5-sonnet-20241022',
    high: 'claude-3-5-sonnet-20241022',
  };

  async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<ProviderResponse> {
    const start = Date.now();
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('Anthropic provider unavailable: ANTHROPIC_API_KEY not set');

    const model = options.model ?? this.models[options.complexity ?? 'medium'];

    // Anthropic splits the system prompt from the user/assistant messages.
    const systemMsgs = messages.filter(m => m.role === 'system');
    const convoMsgs = messages.filter(m => m.role !== 'system');
    const system = systemMsgs.map(m => m.content).join('\n\n');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: options.maxTokens ?? 1000,
        temperature: options.temperature ?? 0.4,
        system,
        messages: convoMsgs.map(m => ({ role: m.role, content: m.content })),
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Anthropic API error ${response.status}: ${errText.slice(0, 200)}`);
    }

    const data: any = await response.json();
    const text: string = data?.content?.[0]?.text ?? '';
    const tokensIn = Number(data?.usage?.input_tokens ?? estimateTokens(messages.map(m => m.content).join('\n')));
    const tokensOut = Number(data?.usage?.output_tokens ?? estimateTokens(text));

    return {
      text,
      tokensIn,
      tokensOut,
      model,
      provider: 'anthropic',
      latencyMs: Date.now() - start,
      raw: data,
    };
  }
}

// ============================================================================
// Google Gemini Provider (via fetch)
// ============================================================================

export class GoogleProvider implements Provider {
  readonly name: ProviderId = 'google';
  readonly available: boolean = !!process.env.GOOGLE_GEMINI_API_KEY;
  readonly models: Record<Complexity, string> = {
    low: 'gemini-1.5-flash',
    medium: 'gemini-2.0-flash',
    high: 'gemini-2.5-pro',
  };

  async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<ProviderResponse> {
    const start = Date.now();
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) throw new Error('Google provider unavailable: GOOGLE_GEMINI_API_KEY not set');

    const model = options.model ?? this.models[options.complexity ?? 'medium'];

    // Gemini splits systemInstruction from contents.
    const systemMsgs = messages.filter(m => m.role === 'system');
    const convoMsgs = messages.filter(m => m.role !== 'system');
    const systemInstruction = systemMsgs.length
      ? { parts: [{ text: systemMsgs.map(m => m.content).join('\n\n') }] }
      : undefined;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction,
          contents: convoMsgs.map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
          })),
          generationConfig: {
            temperature: options.temperature ?? 0.4,
            maxOutputTokens: options.maxTokens ?? 1000,
          },
        }),
      },
    );

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Google API error ${response.status}: ${errText.slice(0, 200)}`);
    }

    const data: any = await response.json();
    const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const usageMeta = data?.usageMetadata ?? {};
    const tokensIn = Number(usageMeta.promptTokenCount ?? estimateTokens(messages.map(m => m.content).join('\n')));
    const tokensOut = Number(usageMeta.candidatesTokenCount ?? estimateTokens(text));

    return {
      text,
      tokensIn,
      tokensOut,
      model,
      provider: 'google',
      latencyMs: Date.now() - start,
      raw: data,
    };
  }
}

// ============================================================================
// Default Provider Registry
// ============================================================================

/**
 * Instantiate the default set of providers, in fallback order.
 *
 * Order matters: GLM (free, always available) is tried first, then the
 * commercial providers in roughly cost-ascending order. The router can
 * override this order per-call.
 */
export function createDefaultProviders(): Provider[] {
  return [
    new GLMProvider(),
    new OpenAIProvider(),
    new AnthropicProvider(),
    new GoogleProvider(),
  ];
}

/**
 * Get the provider's display name for logging / trajectory metadata.
 */
export function providerDisplayName(p: ProviderId): string {
  switch (p) {
    case 'glm': return 'GLM (z-ai-web-dev-sdk)';
    case 'openai': return 'OpenAI';
    case 'anthropic': return 'Anthropic';
    case 'google': return 'Google Gemini';
    default: return p;
  }
}
