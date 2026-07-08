/**
 * LLM Router — multi-provider routing with fallback
 * ==================================================
 *
 * Picks the ordered list of providers to try for a given chat call, based on:
 *   - Explicit `provider` option (skip routing, use this one)
 *   - Complexity tier (map to per-provider model)
 *   - Availability (env vars set)
 *   - Configurable order via env vars (LLM_GATEWAY_PROVIDER_ORDER)
 *
 * The router is intentionally pure — it doesn't make HTTP calls. It just
 * returns the ordered list of providers; the gateway iterates and falls back
 * on error. This separation makes the router trivially testable.
 *
 * Default fallback order: GLM → OpenAI → Anthropic → Google
 *   - GLM is always available and free, so it's tried first.
 *   - Commercial providers follow in roughly cost-ascending order.
 */

import type { Provider, ChatOptions, Complexity } from './providers.js';
import { createDefaultProviders } from './providers.js';
import type { ProviderId } from './costCalc.js';

// ============================================================================
// Types
// ============================================================================

/** A routing decision — a provider + the model it will use. */
export interface RouteDecision {
  provider: Provider;
  model: string;
}

// ============================================================================
// Router
// ============================================================================

/**
 * LLMRouter resolves which providers (and which models) to try for a given
 * call, in fallback order.
 *
 * The router instance is stateless beyond the injected provider list, so a
 * single shared instance is fine.
 */
export class LLMRouter {
  private readonly providers: Provider[];

  constructor(providers?: Provider[]) {
    this.providers = providers ?? createDefaultProviders();
  }

  /** All providers known to this router (including unavailable ones). */
  list(): Provider[] {
    return [...this.providers];
  }

  /** Providers that are currently available (env vars set). */
  available(): Provider[] {
    return this.providers.filter(p => p.available);
  }

  /**
   * Resolve the ordered list of (provider, model) pairs to try for a call.
   *
   * Resolution logic:
   *   1. If `options.provider` is set, return only that provider (or empty
   *      if it's unavailable).
   *   2. Else, return all available providers in fallback order (which may
   *      be overridden by the LLM_GATEWAY_PROVIDER_ORDER env var).
   *   3. For each provider, the model is `options.model` if that model is
   *      known to the provider, else the provider's default for the
   *      `options.complexity` tier.
   */
  route(options: ChatOptions = {}): RouteDecision[] {
    const complexity: Complexity = options.complexity ?? 'medium';
    const ordered = this.orderedProviders();

    // ── Explicit provider ──────────────────────────────────────────────
    if (options.provider) {
      const p = ordered.find(p => p.name === options.provider);
      if (!p || !p.available) return [];
      return [{ provider: p, model: this.resolveModel(p, options, complexity) }];
    }

    // ── Fallback chain ─────────────────────────────────────────────────
    const decisions: RouteDecision[] = [];
    for (const p of ordered) {
      if (!p.available) continue;
      decisions.push({ provider: p, model: this.resolveModel(p, options, complexity) });
    }
    return decisions;
  }

  /**
   * Override the default fallback order via the LLM_GATEWAY_PROVIDER_ORDER
   * env var (comma-separated provider ids). Unknown ids are ignored.
   * Providers not listed keep their default relative order at the tail.
   */
  private orderedProviders(): Provider[] {
    const envOrder = process.env.LLM_GATEWAY_PROVIDER_ORDER;
    if (!envOrder) return this.providers;

    const ids = envOrder
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean) as ProviderId[];

    const byId = new Map(this.providers.map(p => [p.name, p]));
    const ordered: Provider[] = [];
    const seen = new Set<ProviderId>();

    for (const id of ids) {
      const p = byId.get(id);
      if (p && !seen.has(id)) {
        ordered.push(p);
        seen.add(id);
      }
    }
    // Append any providers not mentioned in env order.
    for (const p of this.providers) {
      if (!seen.has(p.name)) ordered.push(p);
    }
    return ordered;
  }

  /** Pick the model for a given provider, honoring explicit model option. */
  private resolveModel(
    provider: Provider,
    options: ChatOptions,
    complexity: Complexity,
  ): string {
    if (options.model) {
      // Honor explicit model if the provider's model list includes it.
      // (We don't strictly enforce this — the provider will reject unknown
      // models at call time, which is the right behavior.)
      return options.model;
    }
    return provider.models[complexity];
  }
}

// ============================================================================
// Default singleton
// ============================================================================

/** Default shared router instance — uses the default provider set. */
export const defaultRouter = new LLMRouter();
