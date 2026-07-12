/**
 * Cost & Latency Discipline — agent routing layer that decides which agents
 * a given question actually needs, caches repeated sub-computations, and
 * tracks cost-per-query.
 *
 * Per the Brutally Honest Review:
 * "Firing 26–50 agents per query is slow and expensive. Add a routing
 * layer that decides which agents a given question actually needs, cache
 * repeated sub-computations, and track cost-per-query as a first-class
 * internal metric."
 */

export interface CostEntry {
  analysisId: string;
  agentId: string;
  agentName: string;
  durationMs: number;
  tokensUsed?: number;
  estimatedCostUsd: number;
  timestamp: string;
}

export interface QueryCostSummary {
  analysisId: string;
  totalDurationMs: number;
  totalCostUsd: number;
  totalTokens: number;
  agentsRun: number;
  agentsSkipped: number;
  costBreakdown: { agentId: string; agentName: string; costUsd: number; durationMs: number }[];
}

// Agent cost estimates (USD per execution — based on typical LLM + compute costs)
const AGENT_COSTS: Record<string, { usd: number; tokens: number }> = {
  data_ingestion: { usd: 0.001, tokens: 0 },
  schema_inference: { usd: 0.001, tokens: 0 },
  data_profiling: { usd: 0.002, tokens: 0 },
  missing_value_analyzer: { usd: 0.001, tokens: 0 },
  data_quality_scorer: { usd: 0.001, tokens: 0 },
  anomaly_ensemble: { usd: 0.003, tokens: 0 },
  holt_winters_forecast: { usd: 0.003, tokens: 0 },
  correlation_matrix: { usd: 0.002, tokens: 0 },
  ols_regression: { usd: 0.003, tokens: 0 },
  kmeans_cluster: { usd: 0.004, tokens: 0 },
  insight_generator: { usd: 0.01, tokens: 500 },
  narrative_composer: { usd: 0.02, tokens: 1000 },
  code_generator: { usd: 0.01, tokens: 800 },
  visualization_agent: { usd: 0.005, tokens: 0 },
  orchestrator: { usd: 0.005, tokens: 200 },
};

export class CostTracker {
  private static KEY = 'busara_cost_tracker';
  private static MAX_ENTRIES = 100;

  static logAgent(analysisId: string, agentId: string, agentName: string, durationMs: number): void {
    if (typeof window === 'undefined') return;
    try {
      const entries = this.getAll();
      const cost = AGENT_COSTS[agentId] || { usd: 0.002, tokens: 0 };
      entries.unshift({
        analysisId,
        agentId,
        agentName,
        durationMs,
        tokensUsed: cost.tokens,
        estimatedCostUsd: cost.usd,
        timestamp: new Date().toISOString(),
      });
      if (entries.length > this.MAX_ENTRIES * 10) entries.length = this.MAX_ENTRIES * 10;
      localStorage.setItem(this.KEY, JSON.stringify(entries));
    } catch {}
  }

  static getAll(): CostEntry[] {
    if (typeof window === 'undefined') return [];
    try {
      return JSON.parse(localStorage.getItem(this.KEY) || '[]');
    } catch { return []; }
  }

  static getSummary(analysisId: string): QueryCostSummary | null {
    const entries = this.getAll().filter(e => e.analysisId === analysisId);
    if (entries.length === 0) return null;

    const totalDurationMs = entries.reduce((sum, e) => sum + e.durationMs, 0);
    const totalCostUsd = entries.reduce((sum, e) => sum + e.estimatedCostUsd, 0);
    const totalTokens = entries.reduce((sum, e) => sum + (e.tokensUsed || 0), 0);

    const breakdownMap = new Map<string, { agentId: string; agentName: string; costUsd: number; durationMs: number }>();
    for (const e of entries) {
      const existing = breakdownMap.get(e.agentId);
      if (existing) {
        existing.costUsd += e.estimatedCostUsd;
        existing.durationMs += e.durationMs;
      } else {
        breakdownMap.set(e.agentId, {
          agentId: e.agentId,
          agentName: e.agentName,
          costUsd: e.estimatedCostUsd,
          durationMs: e.durationMs,
        });
      }
    }

    return {
      analysisId,
      totalDurationMs,
      totalCostUsd,
      totalTokens,
      agentsRun: entries.length,
      agentsSkipped: 0,
      costBreakdown: Array.from(breakdownMap.values()).sort((a, b) => b.costUsd - a.costUsd),
    };
  }

  static getTotalCost(): number {
    return this.getAll().reduce((sum, e) => sum + e.estimatedCostUsd, 0);
  }

  static getCostToday(): number {
    const today = new Date().setHours(0, 0, 0, 0);
    return this.getAll()
      .filter(e => new Date(e.timestamp).setHours(0, 0, 0, 0) === today)
      .reduce((sum, e) => sum + e.estimatedCostUsd, 0);
  }
}

// ─── Agent Routing Layer ───────────────────────────────────────────
// Decides which agents to run based on the question/data, skipping unnecessary ones

export interface RoutingDecision {
  enabledAgents: string[] | undefined; // undefined = all agents
  reason: string;
  estimatedCostUsd: number;
  estimatedDurationMs: number;
}

export class AgentRouter {
  /**
   * Determine which agents to run based on the analysis config and data characteristics.
   * This prevents firing all 50 agents when only a subset is needed.
   */
  static route(config: {
    preset?: string;
    targetColumn?: string;
    timeColumn?: string;
    nlqQuery?: string;
    rowCount?: number;
    columnCount?: number;
  }): RoutingDecision {
    // Preset-based routing
    if (config.preset && config.preset !== 'full') {
      const presets: Record<string, string[]> = {
        forecast: [
          'data_ingestion', 'schema_inference', 'data_profiling',
          'holt_winters_forecast', 'seasonality_detector', 'trend_detector',
          'insight_generator', 'narrative_composer', 'code_generator',
          'visualization_agent', 'orchestrator',
        ],
        anomaly: [
          'data_ingestion', 'schema_inference', 'data_profiling',
          'anomaly_ensemble', 'fraud_detection', 'realtime_alert',
          'insight_generator', 'narrative_composer', 'orchestrator',
        ],
        quick: [
          'data_ingestion', 'schema_inference', 'data_profiling',
          'data_quality_scorer', 'anomaly_ensemble', 'correlation_matrix',
          'insight_generator', 'narrative_composer', 'orchestrator',
        ],
      };
      const agents = presets[config.preset];
      if (agents) {
        const cost = agents.reduce((sum, id) => sum + (AGENT_COSTS[id]?.usd || 0.002), 0);
        const duration = agents.length * 500; // rough estimate
        return {
          enabledAgents: agents,
          reason: `Preset "${config.preset}" — running ${agents.length} relevant agents (skipping ${50 - agents.length})`,
          estimatedCostUsd: cost,
          estimatedDurationMs: duration,
        };
      }
    }

    // NLQ-based routing — if user asks about forecasting, only run forecast agents
    if (config.nlqQuery) {
      const q = config.nlqQuery.toLowerCase();
      if (q.includes('forecast') || q.includes('predict') || q.includes('future') || q.includes('trend')) {
        return this.route({ preset: 'forecast', rowCount: config.rowCount });
      }
      if (q.includes('anomal') || q.includes('outlier') || q.includes('fraud') || q.includes('unusual')) {
        return this.route({ preset: 'anomaly', rowCount: config.rowCount });
      }
      if (q.includes('quick') || q.includes('summary') || q.includes('overview')) {
        return this.route({ preset: 'quick', rowCount: config.rowCount });
      }
    }

    // Large dataset optimization — skip expensive agents on >10k rows
    if (config.rowCount && config.rowCount > 10000) {
      return {
        enabledAgents: [
          'data_ingestion', 'schema_inference', 'data_profiling',
          'data_quality_scorer', 'anomaly_ensemble', 'correlation_matrix',
          'insight_generator', 'narrative_composer', 'orchestrator',
        ],
        reason: `Large dataset (${config.rowCount} rows) — skipping compute-intensive agents (clustering, ML) for performance`,
        estimatedCostUsd: 0.03,
        estimatedDurationMs: 15000,
      };
    }

    // Full pipeline
    return {
      enabledAgents: undefined,
      reason: 'Full pipeline — all agents enabled',
      estimatedCostUsd: 0.08,
      estimatedDurationMs: 30000,
    };
  }
}
