/**
 * Report Agents (Stage 6)
 * ========================
 *
 * The report stage produces human-readable deliverables from the analytical
 * findings of stages 0–5. Three LLM-powered agents compose the stage:
 *
 *   1. InsightSummarizerAgent — synthesizes findings into ranked insights
 *   2. RecommendationAgent    — turns insights into prioritized actions
 *   3. NaturalLanguageQueryAgent — answers natural-language questions about the data
 *
 * All three route their LLM access through the LLM Gateway (not
 * `z-ai-web-dev-sdk` directly), so every call is automatically captured
 * as a trajectory step with token usage, cost, latency, and PII
 * scrubbing. This is the AReaL paper's "HTTP boundary" instrumentation
 * pattern applied: zero-code trajectory capture for any agent that
 * routes through the gateway.
 */

export * from './InsightSummarizerAgent';
export * from './RecommendationAgent';
export * from './NaturalLanguageQueryAgent';
