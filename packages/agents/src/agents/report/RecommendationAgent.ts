/**
 * Recommendation Agent
 * =====================
 *
 * Stage 6 — Report
 *
 * Generates prioritized, business-actionable recommendations based on the
 * insights produced by InsightSummarizerAgent and the raw findings from
 * prior stages. Each recommendation includes a rationale, expected impact,
 * and effort estimate.
 *
 * Routes its LLM call through the LLM Gateway (not z-ai-web-dev-sdk
 * directly) so the call is automatically captured in the trajectory with
 * token usage, cost, latency, and PII scrubbing. This is the AReaL
 * paper's "HTTP boundary" instrumentation pattern: zero-code capture.
 */

import { z } from 'zod';
import { AgentStage, AgentTier, AgentStability } from '@busara/core';
import {
  BaseAgent,
  EnhancedAgentMetadata,
  EnhancedAgentContext,
  AgentResult,
  createAgentMetadata,
} from '../../core';
import { LLMGateway, type ChatMessage } from '../../llm-gateway';

// ============================================================================
// Agent Metadata
// ============================================================================

const metadata = createAgentMetadata({
  id: 'recommendation',
  name: 'Recommendation',
  description:
    'Produces prioritized, business-actionable recommendations from analysis insights. Each recommendation includes rationale, expected impact, and effort estimate. Routes its LLM call through the LLM Gateway for automatic trajectory capture.',
  version: '1.0.0',

  stage: 'report' as AgentStage,
  stageNumber: 6,
  tier: 'core' as AgentTier,
  stability: 'beta' as AgentStability,

  author: 'Busara Team',
  license: 'MIT',

  dependencies: ['insight_summarizer', 'analysis_strategist', 'anomaly_sentinel', 'forecasting_oracle', 'causal_architect'],

  timeoutMs: 45000,
  maxRetries: 2,

  capabilities: ['recommendation_generation', 'prioritization', 'impact_estimation', 'llm_powered'],
  category: 'reporting',
  tags: ['recommendations', 'actions', 'llm', 'report'],

  inputDescription: 'Insights and raw findings from prior stages',
  outputDescription: 'Prioritized recommendations with rationale, impact, and effort',
  inputSchema: {
    schema: z.object({
      insights: z.array(z.object({
        title: z.string(),
        description: z.string(),
        confidence: z.number(),
        impact: z.string(),
        category: z.string(),
      })).default([]),
    }),
    description: 'Insights from InsightSummarizerAgent and raw findings',
  },
  outputSchema: {
    schema: z.object({
      recommendations: z.array(z.object({
        title: z.string(),
        description: z.string(),
        priority: z.enum(['high', 'medium', 'low']),
        effort: z.enum(['low', 'medium', 'high']),
        expectedImpact: z.string(),
        rationale: z.string(),
      })),
      summary: z.string(),
      model: z.string(),
      provider: z.string(),
    }),
    description: 'Prioritized recommendations from the LLM',
  },
  configSchema: {
    schema: z.object({
      maxRecommendations: z.number().int().positive().max(10).default(5),
      complexity: z.enum(['low', 'medium', 'high']).default('high'),
    }),
    defaults: { maxRecommendations: 5, complexity: 'high' },
    description: 'Recommendation agent configuration',
  },

  memoryLimitMB: 256,
  cpuLimit: 1,
  gpuRequired: false,

  icon: 'CheckSquare',
  color: '#10b981',
});

// ============================================================================
// Agent Implementation
// ============================================================================

export class RecommendationAgent extends BaseAgent {
  readonly metadata: EnhancedAgentMetadata = metadata;

  async execute(context: EnhancedAgentContext): Promise<AgentResult> {
    const start = Date.now();

    try {
      // Gather insights + findings from prior stages.
      const previousResults = context.previousResults ?? new Map();
      const insights = this.collectInsights(previousResults);

      if (insights.length === 0) {
        return this.createResult(
          { recommendations: [], summary: 'No insights to base recommendations on.', model: 'none', provider: 'none' },
          { insightsCount: 0 },
          Date.now() - start,
        );
      }

      const maxRecs = (context.config?.maxRecommendations as number) ?? 5;
      const complexity = (context.config?.complexity as 'low' | 'medium' | 'high') ?? 'high';

      const systemPrompt = `You are Busara, an elite data analyst AI. Convert analytical insights into prioritized, business-actionable recommendations. Each recommendation must:
1. Be specific and actionable — a stakeholder should know exactly what to do.
2. Tie back to a specific insight and quantify expected impact.
3. Estimate effort (low / medium / high).
4. Be prioritized: high-priority items have large expected impact with low effort.

Return ${maxRecs} recommendations max, ordered by priority (high > medium > low). Format each as:
- **[TITLE]** | priority: high|medium|low | effort: low|medium|high
  Rationale: 1-2 sentences tying this to a specific finding.
  Expected impact: 1 sentence quantifying the benefit.`;

      const userPrompt = this.buildUserPrompt(insights);

      // Route through the LLM Gateway — trajectory capture is automatic.
      const gateway = new LLMGateway({ recorder: context.trajectoryRecorder });
      const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ];
      const response = await gateway.chat(messages, { complexity, maxTokens: 1500, temperature: 0.4 });

      const recommendations = this.parseRecommendations(response.text, maxRecs);

      return this.createResult(
        {
          recommendations,
          summary: response.text,
          model: response.model,
          provider: response.provider,
        },
        {
          insightsCount: insights.length,
          recommendationsCount: recommendations.length,
          tokensIn: response.tokensIn,
          tokensOut: response.tokensOut,
          cost: response.cost,
          latencyMs: response.latencyMs,
          fallbacksTried: response.fallbacksTried.length,
        },
        Date.now() - start,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return this.createError(errorMessage, Date.now() - start);
    }
  }

  /** Pull insights from InsightSummarizerAgent (and raw findings as fallback). */
  private collectInsights(
    previousResults: Map<string, AgentResult>,
  ): Array<{ title: string; description: string; confidence: number; impact: string; category: string }> {
    const insightResult = previousResults.get('insight_summarizer')?.output as any;
    if (insightResult?.insights?.length > 0) {
      return insightResult.insights;
    }

    // Fallback: synthesize shallow insights from raw findings.
    const findings: Array<{ title: string; description: string; confidence: number; impact: string; category: string }> = [];

    const anomalyResult = previousResults.get('anomaly_sentinel')?.output as any;
    if (anomalyResult?.anomalies?.length > 0) {
      findings.push({
        title: 'Anomalies detected', description: `${anomalyResult.anomalies.length} anomalies`,
        confidence: 0.85, impact: 'high', category: 'anomalies',
      });
    }

    const forecastResult = previousResults.get('forecasting_oracle')?.output as any;
    if (forecastResult?.forecast?.length > 0) {
      findings.push({
        title: 'Forecast trend', description: `Trend: ${forecastResult.trend}`,
        confidence: 0.7, impact: 'high', category: 'forecast',
      });
    }

    const causalResult = previousResults.get('causal_architect')?.output as any;
    if (causalResult?.relationships?.length > 0) {
      findings.push({
        title: 'Causal driver', description: `Top driver: ${causalResult.relationships[0].cause}`,
        confidence: 0.75, impact: 'high', category: 'causal',
      });
    }

    return findings;
  }

  private buildUserPrompt(
    insights: Array<{ title: string; description: string; confidence: number; impact: string; category: string }>,
  ): string {
    const lines = insights.map(i => `- ${i.title} (impact: ${i.impact}, category: ${i.category}, confidence: ${(i.confidence * 100).toFixed(0)}%): ${i.description}`);
    return `Based on these ${insights.length} insights, generate prioritized recommendations:

${lines.join('\n')}

Return the recommendations now:`;
  }

  private parseRecommendations(text: string, maxRecs: number): Array<{
    title: string; description: string; priority: 'high' | 'medium' | 'low';
    effort: 'high' | 'medium' | 'low'; expectedImpact: string; rationale: string;
  }> {
    if (!text) return [];
    const recs: Array<{
      title: string; description: string; priority: 'high' | 'medium' | 'low';
      effort: 'high' | 'medium' | 'low'; expectedImpact: string; rationale: string;
    }> = [];

    const lines = text.split('\n').map(l => l.trim());
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.startsWith('-')) continue;
      const m = line.match(/^-\s*\*{0,2}\[?(.+?)\]?\*{0,2}\s*\|\s*priority:\s*(high|medium|low)\s*\|\s*effort:\s*(high|medium|low)/i);
      if (!m) continue;

      // Look ahead for rationale + expected impact lines.
      let rationale = '';
      let expectedImpact = '';
      for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
        const next = lines[j];
        if (next.startsWith('-')) break;
        if (/rationale:/i.test(next)) rationale = next.replace(/^.*?rationale:\s*/i, '');
        else if (/expected\s*impact:/i.test(next)) expectedImpact = next.replace(/^.*?expected\s*impact:\s*/i, '');
      }

      recs.push({
        title: m[1].trim(),
        description: rationale || line,
        priority: m[2].toLowerCase() as 'high' | 'medium' | 'low',
        effort: m[3].toLowerCase() as 'high' | 'medium' | 'low',
        expectedImpact,
        rationale,
      });
      if (recs.length >= maxRecs) break;
    }

    return recs;
  }
}
