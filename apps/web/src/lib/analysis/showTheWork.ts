/**
 * Show the Work — provides visible, inspectable "how we got this" trail
 * behind every answer. Directly addresses the trust gap buyers cite most
 * about AI analysts.
 *
 * Per the Brutally Honest Review:
 * "Every insight Busara surfaces should have a visible, inspectable
 * 'how we got this' trail."
 */

export interface WorkStep {
  agentId: string;
  agentName: string;
  stage: string;
  action: string;
  input?: string;
  output?: string;
  code?: string;
  durationMs?: number;
  timestamp: string;
}

export interface InsightTrail {
  insightId: string;
  insightTitle: string;
  insightSummary: string;
  steps: WorkStep[];
  confidence: number;
  verifiedBy: string[]; // agent IDs that verified this
  warnings: string[];
}

export class ShowTheWork {
  private static TRAILS_KEY = 'busara_insight_trails';

  static buildTrail(
    insightTitle: string,
    insightSummary: string,
    agentStates: Record<string, any>,
    confidence: number = 0.8,
  ): InsightTrail {
    const steps: WorkStep[] = [];
    const verifiedBy: string[] = [];
    const warnings: string[] = [];

    // Build chronological trail from agent states
    const sortedAgents = Object.values(agentStates)
      .filter((s: any) => s.status === 'success')
      .sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    for (const state of sortedAgents) {
      const s = state as any;
      const step: WorkStep = {
        agentId: s.agentId,
        agentName: s.agentName,
        stage: s.stage,
        action: this.describeAction(s.agentId, s.result),
        output: this.summarizeOutput(s.agentId, s.result),
        code: this.extractCode(s.agentId, s.result),
        durationMs: s.durationMs,
        timestamp: s.timestamp,
      };
      steps.push(step);

      // Check if this agent verified the result
      if (s.agentId === 'reflection_agent' || s.agentId === 'verification_gate') {
        verifiedBy.push(s.agentId);
      }

      // Check for warnings
      if (s.result?.output?.qualityScore && s.result.output.qualityScore < 50) {
        warnings.push(`${s.agentName} reported low data quality (${s.result.output.qualityScore}/100)`);
      }
      if (s.result?.output?.totalAnomalies > 10) {
        warnings.push(`${s.result.output.totalAnomalies} anomalies detected — results may be affected by data quality issues`);
      }
    }

    return {
      insightId: `insight-${Date.now()}`,
      insightTitle,
      insightSummary,
      steps,
      confidence,
      verifiedBy,
      warnings,
    };
  }

  static describeAction(agentId: string, result: any): string {
    const descriptions: Record<string, string> = {
      data_ingestion: 'Read and parsed the uploaded dataset',
      schema_inference: 'Identified column types (numeric, categorical, datetime)',
      data_profiling: 'Computed statistics (mean, median, stdev, quartiles) for each column',
      missing_value_analyzer: 'Detected missing values and calculated completion rates',
      anomaly_ensemble: 'Ran Z-score, IQR, and EWMA anomaly detection',
      holt_winters_forecast: 'Generated forecast using triple exponential smoothing',
      correlation_matrix: 'Computed pairwise Pearson correlations between numeric columns',
      ols_regression: 'Fit ordinary least squares regression model',
      kmeans_cluster: 'Assigned data points to clusters using K-Means++',
      insight_generator: 'Synthesized findings into key insights',
      narrative_composer: 'Generated executive narrative from analysis results',
      orchestrator: 'Assembled final analysis with confidence scoring',
    };
    return descriptions[agentId] || `Executed ${agentId}`;
  }

  static summarizeOutput(agentId: string, result: any): string {
    if (!result?.output) return 'No output';
    const out = result.output;

    if (agentId === 'data_ingestion') return `${out.rowCount} rows × ${out.columnCount} columns`;
    if (agentId === 'anomaly_ensemble') return `${out.totalAnomalies} anomalies found (${(out.anomalyRate * 100).toFixed(1)}% of data)`;
    if (agentId === 'holt_winters_forecast') return `Forecast accuracy: ${out.accuracy?.toFixed(1)}% | RMSE: ${out.rmse?.toFixed(2)}`;
    if (agentId === 'correlation_matrix') return `${out.strongCorrelations?.length || 0} strong correlations found`;
    if (agentId === 'ols_regression') return `R² = ${out.rSquared?.toFixed(3)} — model explains ${(out.rSquared * 100).toFixed(0)}% of variance`;
    if (agentId === 'kmeans_cluster') return `Optimal clusters: ${out.bestK || 'N/A'} | Silhouette: ${out.silhouette?.toFixed(3)}`;
    if (agentId === 'insight_generator') return `${out.insights?.length || 0} insights, ${out.keyFindings?.length || 0} key findings`;
    if (agentId === 'narrative_composer') return 'Executive summary generated';
    if (agentId === 'orchestrator') return `Confidence: ${((out.metadata?.overallConfidence || 0.5) * 100).toFixed(0)}%`;

    return JSON.stringify(out).substring(0, 200);
  }

  static extractCode(agentId: string, result: any): string | undefined {
    if (!result?.output) return undefined;
    if (agentId === 'code_generator') return result.output.python || result.output.sql || result.output.javascript;
    return undefined;
  }

  static saveTrail(trail: InsightTrail): void {
    if (typeof window === 'undefined') return;
    try {
      const trails = JSON.parse(localStorage.getItem(this.TRAILS_KEY) || '[]');
      trails.unshift(trail);
      if (trails.length > 20) trails.length = 20;
      localStorage.setItem(this.TRAILS_KEY, JSON.stringify(trails));
    } catch {}
  }

  static getTrails(): InsightTrail[] {
    if (typeof window === 'undefined') return [];
    try {
      return JSON.parse(localStorage.getItem(this.TRAILS_KEY) || '[]');
    } catch { return []; }
  }
}
