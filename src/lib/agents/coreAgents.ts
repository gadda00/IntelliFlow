// Core Agents (7) — Ported & enhanced from Python originals
import { Agent, AgentExecutionContext, Tool } from './core';
import { profileDataset, computeColumnStats, detectColumnType, mean, median, stdev, correlation, ColumnStats, DatasetProfile } from './statistics';

// ═══════════════════════════════════════════════════════════════════════════
// 1. ORCHESTRATOR (Stage 5 — Final compilation)
// ═══════════════════════════════════════════════════════════════════════════
export class OrchestratorAgent extends Agent {
  constructor() {
    super({
      id: 'orchestrator',
      name: 'Orchestrator',
      role: 'Workflow coordination & final synthesis',
      tier: 'core',
      description: 'Coordinates the entire 20-agent pipeline, compiles results, and produces the final unified analysis output.',
      capabilities: ['workflow_coordination', 'result_compilation', 'final_synthesis'],
      icon: 'Network',
      color: '#6366f1',
    });
  }

  async execute(ctx: AgentExecutionContext): Promise<any> {
    const depResults = ctx.dependencyResults;
    const successfulAgents = Object.keys(depResults).filter(k => depResults[k]);

    // Extract key sections from dependency results
    const narrative = depResults.narrative_composer || {};
    const insights = depResults.insight_generator || {};
    const quality = depResults.data_quality_guardian || {};
    const benchmarks = depResults.benchmark_agent || {};
    const visuals = depResults.visualization_specialist || {};

    const dataScout = depResults.data_scout || {};
    const profile: DatasetProfile | undefined = dataScout.profile;

    const overallConfidence = this.computeOverallConfidence(depResults);

    return {
      analysisId: ctx.analysisId,
      status: 'completed',
      confidence: overallConfidence,
      timestamp: new Date().toISOString(),
      dataOverview: {
        totalRows: profile?.rowCount ?? 0,
        totalColumns: profile?.columnCount ?? 0,
        columnDetails: profile?.columns?.map(c => ({
          name: c.name,
          type: c.stats.type,
          missing: c.stats.missing,
          unique: c.stats.unique,
        })) ?? [],
        qualityScore: quality.overallScore ?? profile?.qualityScore ?? 0,
        dataSource: ctx.analysisConfig?.dataSource ?? 'file_upload',
      },
      agentResults: successfulAgents.map(id => ({
        agentId: id,
        status: 'completed',
        summary: this.summarizeAgentResult(id, depResults[id]),
      })),
      summary: {
        agentsExecuted: successfulAgents.length,
        qualityScore: quality.overallScore ?? 0,
        insightCount: insights.insights?.length ?? 0,
        recommendationCount: insights.recommendations?.length ?? 0,
        visualizationCount: visuals.visualizations?.length ?? 0,
        benchmarkAvailable: !!benchmarks.benchmarks,
      },
      executiveSummary: narrative.executiveSummary ?? insights.summary ?? 'Analysis completed successfully.',
      keyFindings: narrative.keyFindings ?? insights.insights ?? [],
      recommendations: narrative.recommendations ?? insights.recommendations ?? [],
      visualizations: visuals.visualizations ?? [],
      fullReport: narrative.fullReport ?? '',
      benchmarkComparison: benchmarks.benchmarks ?? null,
      pipeline: {
        stages: 6,
        totalAgents: 20,
        agentsExecuted: successfulAgents.length,
      },
    };
  }

  private computeOverallConfidence(results: Record<string, any>): number {
    const confidences: number[] = [];
    for (const [id, r] of Object.entries(results)) {
      if (r?.confidence && typeof r.confidence === 'number') confidences.push(r.confidence);
      else if (r?.accuracy && typeof r.accuracy === 'number') confidences.push(r.accuracy / 100);
    }
    if (!confidences.length) return 0.85;
    return Math.round(mean(confidences) * 100) / 100;
  }

  private summarizeAgentResult(id: string, result: any): string {
    if (!result) return 'No output';
    if (result.summary) return result.summary;
    if (result.executiveSummary) return result.executiveSummary.slice(0, 200);
    if (result.forecast) return `Generated ${result.forecast.length} forecast points (${result.method || 'forecast'})`;
    if (result.anomalies) return `Detected ${result.anomalies.length} anomalies`;
    if (result.insights) return `Generated ${result.insights.length} insights`;
    if (result.visualizations) return `Created ${result.visualizations.length} visualizations`;
    if (result.report) return result.report.slice(0, 200);
    return 'Completed';
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. DATA SCOUT (Stage 0 — Data profiling)
// ═══════════════════════════════════════════════════════════════════════════
export class DataScoutAgent extends Agent {
  constructor() {
    super({
      id: 'data_scout',
      name: 'Data Scout',
      role: 'Data discovery, profiling & quality assessment',
      tier: 'core',
      description: 'Profiles the uploaded dataset, detects column types, computes statistics, and identifies data characteristics.',
      capabilities: ['data_profiling', 'type_detection', 'statistical_summary', 'schema_inference'],
      icon: 'Search',
      color: '#10b981',
    });
  }

  async execute(ctx: AgentExecutionContext): Promise<any> {
    const rows = ctx.fileContents;
    if (!rows.length) {
      return {
        status: 'failed',
        error: 'No data provided',
        profile: null,
        summary: 'No data to analyze.',
      };
    }

    const profile = profileDataset(rows);
    const assumptions = this.generateAssumptions(profile);
    const cleaningRecommendations = this.generateCleaningRecommendations(profile);

    return {
      status: 'completed',
      confidence: 0.95,
      profile,
      assumptions,
      cleaningRecommendations,
      detectedDomain: this.detectDomain(profile),
      summary: `Profiled ${profile.rowCount} rows × ${profile.columnCount} columns. Quality: ${profile.qualityScore}%`,
      columnSuggestions: profile.columns.map(c => ({
        name: c.name,
        type: c.stats.type,
        suggestedRole: this.suggestColumnRole(c.name, c.stats),
      })),
    };
  }

  private generateAssumptions(profile: DatasetProfile): string[] {
    const assumptions: string[] = [];
    if (profile.rowCount < 100) {
      assumptions.push('Dataset is small (<100 rows); results may have limited statistical significance.');
    }
    if (profile.rowCount > 100000) {
      assumptions.push('Large dataset; consider sampling for visualization.');
    }
    const numericCols = profile.columns.filter(c => c.stats.type === 'numeric');
    if (numericCols.length > 0) {
      assumptions.push(`${numericCols.length} numeric columns detected — suitable for regression and correlation analysis.`);
    }
    const catCols = profile.columns.filter(c => c.stats.type === 'categorical');
    if (catCols.length > 0) {
      assumptions.push(`${catCols.length} categorical columns detected — suitable for grouping and segmentation.`);
    }
    const dateCols = profile.columns.filter(c => c.stats.type === 'datetime');
    if (dateCols.length > 0) {
      assumptions.push(`${dateCols.length} datetime columns detected — time series analysis is available.`);
    }
    if (profile.duplicateRows > 0) {
      assumptions.push(`${profile.duplicateRows} duplicate rows detected — may need deduplication.`);
    }
    return assumptions;
  }

  private generateCleaningRecommendations(profile: DatasetProfile): string[] {
    const recs: string[] = [];
    if (profile.missingCells > 0) {
      const pct = (profile.missingCells / profile.totalCells * 100).toFixed(1);
      recs.push(`Handle ${profile.missingCells} missing cells (${pct}% of data) via imputation or removal.`);
    }
    for (const col of profile.columns) {
      if (col.stats.missing > col.stats.count * 0.5) {
        recs.push(`Consider dropping "${col.name}" — over 50% missing.`);
      }
      if (col.stats.type === 'numeric' && col.stats.skewness !== null && Math.abs(col.stats.skewness) > 2) {
        recs.push(`Apply log transformation to "${col.name}" — skewness is ${col.stats.skewness.toFixed(2)}.`);
      }
    }
    if (profile.duplicateRows > 0) {
      recs.push(`Remove ${profile.duplicateRows} duplicate rows.`);
    }
    return recs;
  }

  private detectDomain(profile: DatasetProfile): string {
    const cols = profile.columns.map(c => c.name.toLowerCase());
    if (cols.some(c => c.includes('revenue') || c.includes('sales') || c.includes('profit') || c.includes('price'))) {
      return 'finance/sales';
    }
    if (cols.some(c => c.includes('patient') || c.includes('diagnosis') || c.includes('treatment'))) {
      return 'healthcare';
    }
    if (cols.some(c => c.includes('user') || c.includes('session') || c.includes('page'))) {
      return 'web/analytics';
    }
    if (cols.some(c => c.includes('sensor') || c.includes('temperature') || c.includes('pressure'))) {
      return 'iot/sensors';
    }
    return 'general';
  }

  private suggestColumnRole(name: string, stats: ColumnStats): string {
    const lower = name.toLowerCase();
    if (lower.includes('id') || lower.includes('key') || lower.includes('uuid')) return 'identifier';
    if (stats.type === 'datetime') return 'timestamp';
    if (lower.includes('target') || lower.includes('label') || lower.includes('outcome') || lower.includes('y')) return 'target';
    if (stats.type === 'numeric') return 'feature';
    if (stats.type === 'categorical' && stats.unique < 20) return 'grouping';
    return 'feature';
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. DATA ENGINEER (Stage 1 — Cleaning & transformation)
// ═══════════════════════════════════════════════════════════════════════════
export class DataEngineerAgent extends Agent {
  constructor() {
    super({
      id: 'data_engineer',
      name: 'Data Engineer',
      role: 'Data cleaning, transformation & feature engineering',
      tier: 'core',
      description: 'Cleans missing values, removes duplicates, engineers new features, and prepares the data for downstream analysis.',
      capabilities: ['missing_value_imputation', 'duplicate_removal', 'feature_engineering', 'type_coercion', 'outlier_handling'],
      icon: 'Wrench',
      color: '#0ea5e9',
    });
  }

  async execute(ctx: AgentExecutionContext): Promise<any> {
    const originalRows = ctx.fileContents;
    if (!originalRows.length) return { status: 'failed', error: 'No data' };

    const scoutResult = ctx.dependencyResults.data_scout || {};
    const qualityResult = ctx.dependencyResults.data_quality_guardian || {};
    const profile = scoutResult.profile;

    let cleanedRows = originalRows.map(r => ({ ...r }));
    const transformations: string[] = [];

    // 1. Remove duplicates
    const beforeDups = cleanedRows.length;
    const seen = new Set<string>();
    const columns = cleanedRows.length ? Object.keys(cleanedRows[0]) : [];
    cleanedRows = cleanedRows.filter(r => {
      const sig = JSON.stringify(columns.map(c => r[c]));
      if (seen.has(sig)) return false;
      seen.add(sig);
      return true;
    });
    if (beforeDups - cleanedRows.length > 0) {
      transformations.push(`Removed ${beforeDups - cleanedRows.length} duplicate rows`);
    }

    // 2. Type coercion — convert numeric strings to numbers
    if (profile) {
      for (const col of profile.columns) {
        if (col.stats.type === 'numeric') {
          let converted = 0;
          cleanedRows.forEach(r => {
            const v = r[col.name];
            if (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v))) {
              r[col.name] = Number(v);
              converted++;
            }
          });
          if (converted > 0) transformations.push(`Coerced ${converted} values in "${col.name}" to numeric`);
        }
        if (col.stats.type === 'datetime') {
          let converted = 0;
          cleanedRows.forEach(r => {
            const v = r[col.name];
            if (typeof v === 'string' && !isNaN(Date.parse(v))) {
              r[col.name] = new Date(v).toISOString();
              converted++;
            }
          });
          if (converted > 0) transformations.push(`Parsed ${converted} datetime values in "${col.name}"`);
        }
      }
    }

    // 3. Missing value imputation
    if (profile) {
      for (const col of profile.columns) {
        const missingCount = cleanedRows.filter(r => r[col.name] === null || r[col.name] === undefined || r[col.name] === '').length;
        if (missingCount === 0) continue;

        if (col.stats.type === 'numeric') {
          const values = cleanedRows.map(r => Number(r[col.name])).filter(v => !isNaN(v));
          const fillValue = median(values);
          let imputed = 0;
          cleanedRows.forEach(r => {
            if (r[col.name] === null || r[col.name] === undefined || r[col.name] === '') {
              r[col.name] = fillValue;
              imputed++;
            }
          });
          if (imputed > 0) transformations.push(`Imputed ${imputed} missing values in "${col.name}" with median (${fillValue.toFixed(2)})`);
        } else if (col.stats.type === 'categorical' && col.stats.topValues && col.stats.topValues.length > 0) {
          const fillValue = col.stats.topValues[0].value;
          let imputed = 0;
          cleanedRows.forEach(r => {
            if (r[col.name] === null || r[col.name] === undefined || r[col.name] === '') {
              r[col.name] = fillValue;
              imputed++;
            }
          });
          if (imputed > 0) transformations.push(`Imputed ${imputed} missing values in "${col.name}" with mode ("${fillValue}")`);
        }
      }
    }

    // 4. Feature engineering — derive new columns
    const engineeredFeatures = this.engineerFeatures(cleanedRows, profile);
    if (engineeredFeatures.added.length > 0) {
      cleanedRows = engineeredFeatures.rows;
      transformations.push(...engineeredFeatures.added.map(f => `Engineered feature: ${f}`));
    }

    // 5. Outlier flagging (not removal — leave to anomaly_sentinel)
    const outlierReport = this.flagOutliers(cleanedRows, profile);

    return {
      status: 'completed',
      confidence: 0.93,
      originalRowCount: originalRows.length,
      cleanedRowCount: cleanedRows.length,
      transformationsApplied: transformations,
      engineeredFeatures: engineeredFeatures.added,
      outlierFlags: outlierReport,
      cleanedDataSample: cleanedRows.slice(0, 50),
      dataReadyForAnalysis: true,
      summary: `Cleaned data: ${originalRows.length} → ${cleanedRows.length} rows. ${transformations.length} transformations applied.`,
      columnStatsAfter: cleanedRows.length ? Object.keys(cleanedRows[0]).map(name => ({
        name,
        stats: computeColumnStats(cleanedRows.map(r => r[name])),
      })) : [],
    };
  }

  private engineerFeatures(rows: any[], profile: DatasetProfile | undefined): { rows: any[]; added: string[] } {
    const added: string[] = [];
    if (!profile || !rows.length) return { rows, added };

    // Date-derived features
    for (const col of profile.columns) {
      if (col.stats.type === 'datetime') {
        rows.forEach(r => {
          const d = new Date(r[col.name]);
          if (!isNaN(d.getTime())) {
            r[`${col.name}_year`] = d.getFullYear();
            r[`${col.name}_month`] = d.getMonth() + 1;
            r[`${col.name}_dayOfWeek`] = d.getDay();
            r[`${col.name}_hour`] = d.getHours();
          }
        });
        added.push(`${col.name}_year`, `${col.name}_month`, `${col.name}_dayOfWeek`, `${col.name}_hour`);
      }
    }

    // Numeric ratios & products (top pairs only)
    const numericCols = profile.columns.filter(c => c.stats.type === 'numeric').map(c => c.name);
    if (numericCols.length >= 2 && numericCols.length <= 6) {
      for (let i = 0; i < numericCols.length && i < 3; i++) {
        for (let j = i + 1; j < numericCols.length && j < 4; j++) {
          const a = numericCols[i], b = numericCols[j];
          rows.forEach(r => {
            const va = Number(r[a]), vb = Number(r[b]);
            if (!isNaN(va) && !isNaN(vb) && vb !== 0) {
              r[`${a}_per_${b}`] = va / vb;
            }
          });
          added.push(`${a}_per_${b}`);
        }
      }
    }

    return { rows, added };
  }

  private flagOutliers(rows: any[], profile: DatasetProfile | undefined): Record<string, number> {
    const flags: Record<string, number> = {};
    if (!profile) return flags;
    for (const col of profile.columns) {
      if (col.stats.type !== 'numeric') continue;
      const values = rows.map(r => Number(r[col.name])).filter(v => !isNaN(v));
      if (!values.length) continue;
      const m = mean(values);
      const s = stdev(values);
      if (s === 0) continue;
      const outliers = values.filter(v => Math.abs((v - m) / s) > 3).length;
      if (outliers > 0) flags[col.name] = outliers;
    }
    return flags;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. ANALYSIS STRATEGIST (Stage 2 — Plan the analysis)
// ═══════════════════════════════════════════════════════════════════════════
export class AnalysisStrategistAgent extends Agent {
  constructor() {
    super({
      id: 'analysis_strategist',
      name: 'Analysis Strategist',
      role: 'Strategic analysis planning & methodology selection',
      tier: 'core',
      description: 'Determines the optimal analysis methodology based on data characteristics, identifies target variables, and proposes the analytical workflow.',
      capabilities: ['methodology_selection', 'variable_identification', 'analysis_planning', 'hypothesis_generation'],
      icon: 'Brain',
      color: '#8b5cf6',
    });
  }

  async execute(ctx: AgentExecutionContext): Promise<any> {
    const engineerResult = ctx.dependencyResults.data_engineer || {};
    const scoutResult = ctx.dependencyResults.data_scout || {};
    const profile = scoutResult.profile;

    if (!profile) {
      return { status: 'failed', error: 'No data profile available' };
    }

    const numericCols = profile.columns.filter(c => c.stats.type === 'numeric').map(c => c.name);
    const categoricalCols = profile.columns.filter(c => c.stats.type === 'categorical').map(c => c.name);
    const datetimeCols = profile.columns.filter(c => c.stats.type === 'datetime').map(c => c.name);

    // Identify target variable
    const targetVariable = this.identifyTarget(profile);
    const analysisPlan = this.buildAnalysisPlan(profile, numericCols, categoricalCols, datetimeCols, targetVariable);
    const hypotheses = this.generateHypotheses(profile, targetVariable);

    return {
      status: 'completed',
      confidence: 0.92,
      targetVariable,
      methodology: analysisPlan.methodology,
      analyses: analysisPlan.analyses,
      hypotheses,
      workflow: analysisPlan.workflow,
      summary: `Selected ${analysisPlan.methodology} methodology with ${analysisPlan.analyses.length} analyses planned.`,
      recommendedVisualizations: analysisPlan.visualizations,
      dataReadinessScore: this.assessReadiness(profile),
    };
  }

  private identifyTarget(profile: DatasetProfile): string | null {
    const candidates = profile.columns.filter(c => {
      const lower = c.name.toLowerCase();
      return lower.includes('target') || lower.includes('label') ||
             lower.includes('outcome') || lower.includes('revenue') ||
             lower.includes('sales') || lower.includes('price') ||
             lower.includes('churn') || lower.includes('conversion');
    });
    if (candidates.length > 0) return candidates[0].name;
    // Fallback: column with highest variance among numerics
    const numericCols = profile.columns.filter(c => c.stats.type === 'numeric' && c.stats.stdev !== null);
    if (numericCols.length > 0) {
      return numericCols.sort((a, b) => (b.stats.stdev ?? 0) - (a.stats.stdev ?? 0))[0].name;
    }
    return null;
  }

  private buildAnalysisPlan(
    profile: DatasetProfile,
    numericCols: string[],
    categoricalCols: string[],
    datetimeCols: string[],
    target: string | null,
  ): { methodology: string; analyses: string[]; workflow: string[]; visualizations: string[] } {
    const analyses: string[] = [];
    const visualizations: string[] = [];
    const workflow: string[] = [];

    // Descriptive statistics — always
    analyses.push('Descriptive Statistics');
    visualizations.push('Histogram', 'Box Plot', 'Correlation Heatmap');

    // Correlation analysis
    if (numericCols.length >= 2) {
      analyses.push('Correlation Analysis');
      visualizations.push('Correlation Matrix');
      workflow.push('Compute pairwise correlations between numeric features');
    }

    // Regression
    if (target && numericCols.length >= 2) {
      analyses.push('Multiple Linear Regression');
      visualizations.push('Regression Plot', 'Residual Plot');
      workflow.push(`Regress ${target} on numeric predictors`);
    }

    // Time series
    if (datetimeCols.length > 0 && target) {
      analyses.push('Time Series Analysis');
      visualizations.push('Time Series Plot', 'Decomposition');
      workflow.push('Decompose trend/seasonality/residual');
    }

    // Segmentation
    if (numericCols.length >= 2 && profile.rowCount > 50) {
      analyses.push('K-Means Clustering');
      visualizations.push('Cluster Scatter', 'Cluster Profile');
      workflow.push('Identify natural segments via k-means');
    }

    // Group comparison
    if (categoricalCols.length > 0 && target) {
      analyses.push('Group Comparison (ANOVA/t-test)');
      visualizations.push('Group Bar Chart');
      workflow.push(`Compare ${target} across ${categoricalCols[0]} groups`);
    }

    const methodology = analyses.length > 3 ? 'Comprehensive Multi-Method Analysis' : 'Targeted Analysis';

    return { methodology, analyses, workflow, visualizations };
  }

  private generateHypotheses(profile: DatasetProfile, target: string | null): { hypothesis: string; rationale: string; testType: string }[] {
    const hypotheses: { hypothesis: string; rationale: string; testType: string }[] = [];
    if (!target) return hypotheses;

    const numericCols = profile.columns.filter(c => c.stats.type === 'numeric' && c.name !== target).map(c => c.name);
    const categoricalCols = profile.columns.filter(c => c.stats.type === 'categorical').map(c => c.name);

    for (const col of numericCols.slice(0, 3)) {
      hypotheses.push({
        hypothesis: `${col} is positively correlated with ${target}`,
        rationale: `Both variables are numeric — testing linear relationship strength.`,
        testType: 'Pearson Correlation',
      });
    }
    for (const col of categoricalCols.slice(0, 2)) {
      hypotheses.push({
        hypothesis: `${target} differs significantly across ${col} groups`,
        rationale: `Categorical grouping variable with numeric target — ANOVA appropriate.`,
        testType: 'One-way ANOVA',
      });
    }
    return hypotheses;
  }

  private assessReadiness(profile: DatasetProfile): number {
    let score = 100;
    if (profile.missingCells / profile.totalCells > 0.05) score -= 20;
    if (profile.duplicateRows / profile.rowCount > 0.05) score -= 10;
    if (profile.rowCount < 30) score -= 30;
    if (profile.columnCount < 2) score -= 40;
    return Math.max(0, score);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. INSIGHT GENERATOR (Stage 3 — AI-powered insights)
// ═══════════════════════════════════════════════════════════════════════════
export class InsightGeneratorAgent extends Agent {
  constructor() {
    super({
      id: 'insight_generator',
      name: 'Insight Generator',
      role: 'AI-powered insight generation from analysis results',
      tier: 'core',
      description: 'Synthesizes findings from all analytical agents into actionable insights, ranked by impact and confidence.',
      capabilities: ['insight_synthesis', 'pattern_recognition', 'recommendation_generation', 'impact_ranking'],
      icon: 'Lightbulb',
      color: '#f59e0b',
    });
  }

  async execute(ctx: AgentExecutionContext): Promise<any> {
    const deps = ctx.dependencyResults;
    const strategist = deps.analysis_strategist || {};
    const anomalies = deps.anomaly_sentinel || {};
    const forecast = deps.forecasting_oracle || {};
    const causal = deps.causal_architect || {};
    const scout = deps.data_scout || {};

    const insights: { title: string; description: string; confidence: number; impact: 'high' | 'medium' | 'low'; category: string }[] = [];
    const recommendations: { title: string; description: string; priority: 'high' | 'medium' | 'low'; effort: 'low' | 'medium' | 'high'; expectedImpact: string }[] = [];

    // From data profile
    if (scout.profile) {
      const profile = scout.profile;
      insights.push({
        title: 'Dataset Overview',
        description: `Analyzed ${profile.rowCount.toLocaleString()} records across ${profile.columnCount} columns with overall quality score of ${profile.qualityScore}%.`,
        confidence: 0.98,
        impact: 'low',
        category: 'overview',
      });
      if (profile.qualityScore < 80) {
        insights.push({
          title: 'Data Quality Concerns Detected',
          description: `${profile.missingCells} missing cells and ${profile.duplicateRows} duplicate rows found. Quality score of ${profile.qualityScore}% suggests cleanup is needed before high-stakes decisions.`,
          confidence: 0.95,
          impact: 'high',
          category: 'quality',
        });
        recommendations.push({
          title: 'Establish Data Quality Pipeline',
          description: 'Implement automated data validation at ingestion with schema enforcement and anomaly alerts.',
          priority: 'high',
          effort: 'medium',
          expectedImpact: 'Reduce downstream analysis errors by 40-60%',
        });
      }
    }

    // From anomalies
    if (anomalies.anomalies && anomalies.anomalies.length > 0) {
      insights.push({
        title: `${anomalies.anomalies.length} Anomalies Detected`,
        description: `Found ${anomalies.anomalies.length} anomalous data points using ${anomalies.methodsUsed?.join(', ') || 'multiple algorithms'}. These may indicate data entry errors, fraud, or genuine business events.`,
        confidence: 0.88,
        impact: 'high',
        category: 'anomalies',
      });
      recommendations.push({
        title: 'Investigate Anomalous Records',
        description: `Review the ${anomalies.anomalies.length} flagged records for accuracy. Set up monitoring for early detection of similar patterns.`,
        priority: 'high',
        effort: 'low',
        expectedImpact: 'Prevent potential revenue loss and data integrity issues',
      });
    }

    // From forecast
    if (forecast.forecast && forecast.forecast.length > 0) {
      const last = forecast.forecast[forecast.forecast.length - 1];
      const first = forecast.forecast[0];
      const trendPct = ((last.value - first.value) / Math.abs(first.value) * 100).toFixed(1);
      const direction = last.value > first.value ? 'upward' : 'downward';
      insights.push({
        title: `Forecasted ${direction} trend of ${Math.abs(parseFloat(trendPct))}%`,
        description: `Based on ${forecast.method}, the projected trend over the next ${forecast.forecast.length} periods shows a ${direction} movement from ${first.value.toFixed(2)} to ${last.value.toFixed(2)}. Model accuracy: ${forecast.accuracy}%.`,
        confidence: forecast.accuracy / 100,
        impact: 'high',
        category: 'forecast',
      });
      recommendations.push({
        title: `Plan for ${direction === 'upward' ? 'growth' : 'decline'}`,
        description: `Adjust ${direction === 'upward' ? 'capacity, inventory, and staffing' : 'costs, marketing, and retention'} based on projected ${trendPct}% change.`,
        priority: 'high',
        effort: 'medium',
        expectedImpact: 'Improved operational alignment with demand',
      });
    }

    // From causal analysis
    if (causal.relationships && causal.relationships.length > 0) {
      const top = causal.relationships.slice(0, 3);
      for (const r of top) {
        insights.push({
          title: `${r.cause} → ${r.effect} (${r.strength} causal relationship)`,
          description: r.interpretation || `Found ${r.strength} evidence that ${r.cause} causally influences ${r.effect}. Effect size: ${r.effectSize?.toFixed(3) || 'N/A'}.`,
          confidence: r.confidence || 0.75,
          impact: 'high',
          category: 'causal',
        });
      }
      recommendations.push({
        title: 'Leverage Causal Drivers',
        description: `Focus interventions on the strongest identified causal factors: ${top.map((r: any) => r.cause).join(', ')}.`,
        priority: 'high',
        effort: 'high',
        expectedImpact: 'Direct leverage over outcome variables',
      });
    }

    // Strategist-derived insights
    if (strategist.hypotheses) {
      for (const h of strategist.hypotheses.slice(0, 3)) {
        insights.push({
          title: `Hypothesis: ${h.hypothesis}`,
          description: h.rationale,
          confidence: 0.7,
          impact: 'medium',
          category: 'hypothesis',
        });
      }
    }

    return {
      status: 'completed',
      confidence: 0.9,
      insights: insights.sort((a, b) => {
        const impactOrder = { high: 3, medium: 2, low: 1 };
        return impactOrder[b.impact] - impactOrder[a.impact] || b.confidence - a.confidence;
      }),
      recommendations: recommendations.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      }),
      summary: `Generated ${insights.length} insights and ${recommendations.length} recommendations.`,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. VISUALIZATION SPECIALIST (Stage 3 — Chart specs)
// ═══════════════════════════════════════════════════════════════════════════
export class VisualizationSpecialistAgent extends Agent {
  constructor() {
    super({
      id: 'visualization_specialist',
      name: 'Visualization Specialist',
      role: 'Dynamic chart creation & visual representation',
      tier: 'core',
      description: 'Generates Recharts/ECharts-compatible chart specifications for the data, automatically selecting the most appropriate chart types.',
      capabilities: ['chart_selection', 'specification_generation', 'interactive_visualizations', 'multi_chart_composition'],
      icon: 'BarChart3',
      color: '#ec4899',
    });
  }

  async execute(ctx: AgentExecutionContext): Promise<any> {
    const deps = ctx.dependencyResults;
    const strategist = deps.analysis_strategist || {};
    const causal = deps.causal_architect || {};
    const scout = deps.data_scout || {};
    const profile = scout.profile;

    if (!profile) {
      return { status: 'failed', error: 'No data profile available', visualizations: [] };
    }

    const visualizations: any[] = [];
    const numericCols = profile.columns.filter(c => c.stats.type === 'numeric').map(c => c.name);
    const categoricalCols = profile.columns.filter(c => c.stats.type === 'categorical' && (c.stats.unique ?? 0) < 20).map(c => c.name);
    const datetimeCols = profile.columns.filter(c => c.stats.type === 'datetime').map(c => c.name);

    // 1. Distribution histograms for top numeric columns
    for (const col of numericCols.slice(0, 4)) {
      const values = ctx.fileContents.map(r => Number(r[col])).filter(v => !isNaN(v));
      const bins = this.computeHistogramBins(values);
      visualizations.push({
        id: `hist_${col}`,
        type: 'histogram',
        title: `Distribution of ${col}`,
        description: `Histogram showing the frequency distribution of ${col}.`,
        spec: {
          chartType: 'BarChart',
          data: bins.map(b => ({ bin: b.label, count: b.count })),
          xKey: 'bin',
          yKey: 'count',
          xLabel: col,
          yLabel: 'Frequency',
          color: '#6366f1',
        },
      });
    }

    // 2. Correlation heatmap
    if (numericCols.length >= 2) {
      const matrix = this.computeCorrelationMatrix(ctx.fileContents, numericCols.slice(0, 8));
      visualizations.push({
        id: 'corr_matrix',
        type: 'heatmap',
        title: 'Correlation Matrix',
        description: 'Pairwise Pearson correlations between numeric variables.',
        spec: {
          chartType: 'Heatmap',
          matrix,
          variables: numericCols.slice(0, 8),
          colorScale: ['#10b981', '#f5f5f5', '#ef4444'],
        },
      });
    }

    // 3. Top categorical value bars
    for (const col of categoricalCols.slice(0, 2)) {
      const counts = new Map<string, number>();
      ctx.fileContents.forEach(r => {
        const v = String(r[col] ?? 'N/A');
        counts.set(v, (counts.get(v) ?? 0) + 1);
      });
      const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 15);
      visualizations.push({
        id: `bar_${col}`,
        type: 'bar',
        title: `Top values in ${col}`,
        description: `Most frequent values in the ${col} column.`,
        spec: {
          chartType: 'BarChart',
          data: top.map(([value, count]) => ({ label: value, count })),
          xKey: 'count',
          yKey: 'label',
          orientation: 'horizontal',
          xLabel: 'Count',
          yLabel: col,
          color: '#10b981',
        },
      });
    }

    // 4. Time series (if datetime + numeric)
    if (datetimeCols.length > 0 && numericCols.length > 0) {
      const dateCol = datetimeCols[0];
      const numCol = numericCols[0];
      const series = ctx.fileContents
        .map(r => ({ date: new Date(r[dateCol]), value: Number(r[numCol]) }))
        .filter(p => !isNaN(p.date.getTime()) && !isNaN(p.value))
        .sort((a, b) => a.date.getTime() - b.date.getTime())
        .slice(-100);
      if (series.length > 1) {
        visualizations.push({
          id: `timeseries_${dateCol}_${numCol}`,
          type: 'line',
          title: `${numCol} over time`,
          description: `Time series of ${numCol} by ${dateCol}.`,
          spec: {
            chartType: 'LineChart',
            data: series.map(p => ({ date: p.date.toISOString().split('T')[0], value: p.value })),
            xKey: 'date',
            yKey: 'value',
            xLabel: dateCol,
            yLabel: numCol,
            color: '#0ea5e9',
          },
        });
      }
    }

    // 5. Causal scatter plots
    if (causal.relationships && causal.relationships.length > 0) {
      for (const r of causal.relationships.slice(0, 2)) {
        if (numericCols.includes(r.cause) && numericCols.includes(r.effect)) {
          const points = ctx.fileContents
            .map(row => ({ x: Number(row[r.cause]), y: Number(row[r.effect]) }))
            .filter(p => !isNaN(p.x) && !isNaN(p.y))
            .slice(0, 200);
          visualizations.push({
            id: `scatter_${r.cause}_${r.effect}`,
            type: 'scatter',
            title: `${r.cause} vs ${r.effect}`,
            description: `Scatter plot showing the relationship between ${r.cause} and ${r.effect}.`,
            spec: {
              chartType: 'ScatterChart',
              data: points,
              xKey: 'x',
              yKey: 'y',
              xLabel: r.cause,
              yLabel: r.effect,
              color: '#8b5cf6',
            },
          });
        }
      }
    }

    // 6. Box plot for top numeric column grouped by top categorical
    if (numericCols.length > 0 && categoricalCols.length > 0) {
      const numCol = numericCols[0];
      const catCol = categoricalCols[0];
      const groups = new Map<string, number[]>();
      ctx.fileContents.forEach(r => {
        const k = String(r[catCol] ?? 'N/A');
        const v = Number(r[numCol]);
        if (!isNaN(v)) {
          if (!groups.has(k)) groups.set(k, []);
          groups.get(k)!.push(v);
        }
      });
      const boxData = Array.from(groups.entries()).slice(0, 10).map(([group, values]) => {
        const sorted = values.sort((a, b) => a - b);
        return {
          group,
          min: sorted[0],
          q1: sorted[Math.floor(sorted.length * 0.25)],
          median: sorted[Math.floor(sorted.length * 0.5)],
          q3: sorted[Math.floor(sorted.length * 0.75)],
          max: sorted[sorted.length - 1],
        };
      });
      visualizations.push({
        id: `box_${numCol}_by_${catCol}`,
        type: 'boxplot',
        title: `${numCol} by ${catCol}`,
        description: `Distribution of ${numCol} across ${catCol} groups.`,
        spec: {
          chartType: 'BoxPlot',
          data: boxData,
          xKey: 'group',
          color: '#f59e0b',
        },
      });
    }

    return {
      status: 'completed',
      confidence: 0.94,
      visualizations,
      summary: `Generated ${visualizations.length} visualizations across ${new Set(visualizations.map(v => v.type)).size} chart types.`,
    };
  }

  private computeHistogramBins(values: number[]): { label: string; count: number }[] {
    if (!values.length) return [];
    const mn = Math.min(...values);
    const mx = Math.max(...values);
    const range = mx - mn;
    if (range === 0) return [{ label: mn.toFixed(2), count: values.length }];
    const binCount = Math.min(20, Math.max(5, Math.ceil(Math.sqrt(values.length))));
    const binWidth = range / binCount;
    const bins = Array.from({ length: binCount }, (_, i) => ({
      label: `${(mn + i * binWidth).toFixed(1)}–${(mn + (i + 1) * binWidth).toFixed(1)}`,
      count: 0,
    }));
    for (const v of values) {
      let idx = Math.floor((v - mn) / binWidth);
      if (idx >= binCount) idx = binCount - 1;
      bins[idx].count++;
    }
    return bins;
  }

  private computeCorrelationMatrix(rows: any[], cols: string[]): { row: string; col: string; value: number }[] {
    const matrix: { row: string; col: string; value: number }[] = [];
    for (const row of cols) {
      for (const col of cols) {
        const xVals = rows.map(r => Number(r[row])).filter(v => !isNaN(v));
        const yVals = rows.map(r => Number(r[col])).filter(v => !isNaN(v));
        const n = Math.min(xVals.length, yVals.length);
        if (row === col) {
          matrix.push({ row, col, value: 1 });
        } else {
          matrix.push({ row, col, value: correlation(xVals.slice(0, n), yVals.slice(0, n)) });
        }
      }
    }
    return matrix;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 7. NARRATIVE COMPOSER (Stage 4 — Final report)
// ═══════════════════════════════════════════════════════════════════════════
export class NarrativeComposerAgent extends Agent {
  constructor() {
    super({
      id: 'narrative_composer',
      name: 'Narrative Composer',
      role: 'Report compilation & data storytelling',
      tier: 'core',
      description: 'Weaves analysis results into a coherent narrative with executive summary, methodology, findings, and recommendations.',
      capabilities: ['executive_summary', 'technical_writing', 'storytelling', 'report_structure'],
      icon: 'FileText',
      color: '#14b8a6',
    });
  }

  async execute(ctx: AgentExecutionContext): Promise<any> {
    const deps = ctx.dependencyResults;
    const insights = deps.insight_generator || { insights: [], recommendations: [] };
    const visuals = deps.visualization_specialist || { visualizations: [] };
    const explainability = deps.explainability_agent || {};
    const scout = deps.data_scout || {};
    const profile = scout.profile;

    const executiveSummary = this.composeExecutiveSummary(profile, insights, deps);
    const keyFindings = this.extractKeyFindings(insights, deps);
    const methodology = this.composeMethodology(profile, deps);
    const recommendations = insights.recommendations || [];
    const fullReport = this.composeFullReport(profile, executiveSummary, methodology, keyFindings, recommendations, deps);

    return {
      status: 'completed',
      confidence: 0.91,
      executiveSummary,
      keyFindings,
      methodology,
      recommendations,
      fullReport,
      reportStats: {
        wordCount: fullReport.split(/\s+/).length,
        sections: 5,
        findingsCount: keyFindings.length,
        recommendationCount: recommendations.length,
      },
      summary: `Composed ${fullReport.split(/\s+/).length}-word report with ${keyFindings.length} key findings.`,
    };
  }

  private composeExecutiveSummary(profile: any, insights: any, deps: Record<string, any>): string {
    const rows = profile?.rowCount?.toLocaleString() ?? 'N/A';
    const cols = profile?.columnCount ?? 'N/A';
    const quality = profile?.qualityScore ?? 'N/A';
    const topInsight = insights.insights?.[0];
    const topText = topInsight ? `${topInsight.title}: ${topInsight.description}` : 'No major anomalies detected.';

    return `This analysis examined a dataset of ${rows} records across ${cols} columns, achieving a data quality score of ${quality}%. ` +
      `The Akili multi-agent pipeline executed 20 specialized agents in parallel, performing profiling, cleaning, statistical analysis, ` +
      `anomaly detection, forecasting, causal inference, and explainability analysis. ` +
      `The most significant finding: ${topText} ` +
      `This report synthesizes the outputs of all agents into actionable recommendations for stakeholders.`;
  }

  private extractKeyFindings(insights: any, deps: Record<string, any>): { title: string; description: string; confidence: number }[] {
    const findings: { title: string; description: string; confidence: number }[] = [];
    for (const insight of (insights.insights || []).slice(0, 7)) {
      findings.push({
        title: insight.title,
        description: insight.description,
        confidence: insight.confidence,
      });
    }
    return findings;
  }

  private composeMethodology(profile: any, deps: Record<string, any>): string {
    const parts: string[] = [];
    parts.push('The Akili v3.1 pipeline employs a Directed Acyclic Graph (DAG) execution model where 20 specialized agents run in topological order, maximizing parallelism while respecting dependencies.');
    parts.push('Stage 0 (Intake): Data Scout profiles the dataset, Data Quality Guardian assesses completeness and validity, Privacy Guardian detects PII, and the NLQ Interpreter parses any natural-language queries.');
    parts.push('Stage 1 (Engineering): The Data Engineer cleans, deduplicates, imputes missing values, performs type coercion, and engineers new features.');
    parts.push('Stage 2 (Analytics): Six analytical agents run in parallel — Analysis Strategist plans, Anomaly Sentinel runs multi-algorithm detection (Z-score, IQR, EWMA), Forecasting Oracle uses Holt-Winters triple exponential smoothing, Causal Architect infers causal relationships, Knowledge Graph Builder extracts entity relationships, Benchmark Agent compares to industry benchmarks, and Auto-ML Agent selects the best predictive model.');
    parts.push('Stage 3 (Synthesis): Insight Generator ranks findings by impact, Explainability Agent computes feature importance via permutation, Visualization Specialist generates Recharts-compatible chart specs, Synthetic Data Generator creates privacy-preserving samples, and Code Generator produces reusable Python/SQL/JS code.');
    parts.push('Stage 4 (Reporting): Narrative Composer weaves results into a coherent story, and Conversational Analyst prepares for interactive Q&A.');
    parts.push('Stage 5 (Final): Orchestrator compiles all outputs into a unified response.');
    return parts.join(' ');
  }

  private composeFullReport(
    profile: any, executiveSummary: string, methodology: string,
    keyFindings: { title: string; description: string; confidence: number }[],
    recommendations: any[], deps: Record<string, any>,
  ): string {
    const sections: string[] = [];

    sections.push(`# Akili Analysis Report\n\nGenerated: ${new Date().toISOString()}\n\n## Executive Summary\n\n${executiveSummary}`);

    sections.push(`## Methodology\n\n${methodology}`);

    if (keyFindings.length > 0) {
      sections.push('## Key Findings\n\n' + keyFindings.map((f, i) => `### ${i + 1}. ${f.title}\n\n${f.description}\n\n*Confidence: ${(f.confidence * 100).toFixed(0)}%*`).join('\n\n'));
    }

    if (recommendations.length > 0) {
      sections.push('## Recommendations\n\n' + recommendations.map((r, i) => `### ${i + 1}. ${r.title} (Priority: ${r.priority})\n\n${r.description}\n\n*Effort: ${r.effort} | Expected impact: ${r.expectedImpact || 'TBD'}*`).join('\n\n'));
    }

    if (profile) {
      sections.push(`## Data Overview\n\n- Rows: ${profile.rowCount?.toLocaleString()}\n- Columns: ${profile.columnCount}\n- Quality Score: ${profile.qualityScore}%\n- Missing Cells: ${profile.missingCells}\n- Duplicate Rows: ${profile.duplicateRows}\n- Detected Domain: ${profile.detectedDomain || 'general'}`);
    }

    sections.push('## Conclusion\n\nThis analysis was performed by 20 specialized AI agents operating in a parallel DAG pipeline. The findings above represent the synthesized output of all agents and should inform data-driven decisions.');

    return sections.join('\n\n---\n\n');
  }
}
