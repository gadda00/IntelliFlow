// Advanced Agents (5) — Ported from Python with enhancements
import { Agent, AgentExecutionContext } from './core';
import {
  zScoreAnomalies, iqrAnomalies, ewmaAnomalies,
  holtWintersForecast, simpleExpSmoothing,
  linearRegression, multipleRegression, correlation, permutationImportance,
  profileDataset, detectColumnType, mean, median, stdev, quantile,
  kMeans,
  ForecastPoint,
} from './statistics';

// ═══════════════════════════════════════════════════════════════════════════
// 8. ANOMALY SENTINEL — Multi-algorithm anomaly detection
// ═══════════════════════════════════════════════════════════════════════════
export class AnomalySentinelAgent extends Agent {
  constructor() {
    super({
      id: 'anomaly_sentinel',
      name: 'Anomaly Sentinel',
      role: 'Multi-algorithm anomaly & outlier detection',
      tier: 'advanced',
      description: 'Runs Z-score, IQR, and EWMA algorithms to detect statistical anomalies and outliers across all numeric columns.',
      capabilities: ['z_score_detection', 'iqr_detection', 'ewma_detection', 'ensemble_anomaly_scoring'],
      icon: 'AlertTriangle',
      color: '#ef4444',
    });
  }

  async execute(ctx: AgentExecutionContext): Promise<any> {
    const rows = ctx.fileContents;
    if (!rows.length) return { status: 'failed', error: 'No data' };

    const engineer = ctx.dependencyResults.data_engineer || {};
    const cleanedData = engineer.cleanedDataSample?.length ? rows : rows; // Already cleaned upstream

    const columns = Object.keys(rows[0]);
    const numericCols = columns.filter(c => {
      const vals = rows.slice(0, 50).map(r => Number(r[c]));
      return vals.filter(v => !isNaN(v)).length > vals.length * 0.7;
    });

    const allAnomalies: any[] = [];
    const methodsUsed: string[] = [];
    const perColumnStats: Record<string, any> = {};

    for (const col of numericCols) {
      const values = rows.map(r => Number(r[col])).filter(v => !isNaN(v));
      if (values.length < 4) continue;

      const zAnoms = zScoreAnomalies(values, 3);
      const iqrAnoms = iqrAnomalies(values);
      const ewmaAnoms = ewmaAnomalies(values, 0.3, 3);

      if (zAnoms.length > 0) methodsUsed.push('Z-Score');
      if (iqrAnoms.length > 0) methodsUsed.push('IQR');
      if (ewmaAnoms.length > 0) methodsUsed.push('EWMA');

      perColumnStats[col] = {
        mean: mean(values),
        stdev: stdev(values),
        q1: quantile(values, 0.25),
        q3: quantile(values, 0.75),
        zScoreAnomalies: zAnoms.length,
        iqrAnomalies: iqrAnoms.length,
        ewmaAnomalies: ewmaAnoms.length,
      };

      // Merge anomalies with ensemble scoring
      const anomalyMap = new Map<number, { index: number; value: number; methods: string[]; score: number }>();
      for (const a of zAnoms) {
        const e = anomalyMap.get(a.index) ?? { index: a.index, value: a.value, methods: [], score: 0 };
        e.methods.push('Z-Score');
        e.score += a.zScore / 3; // normalized weight
        anomalyMap.set(a.index, e);
      }
      for (const a of iqrAnoms) {
        const e = anomalyMap.get(a.index) ?? { index: a.index, value: a.value, methods: [], score: 0 };
        e.methods.push('IQR');
        e.score += 1;
        anomalyMap.set(a.index, e);
      }
      for (const a of ewmaAnoms) {
        const e = anomalyMap.get(a.index) ?? { index: a.index, value: a.value, methods: [], score: 0 };
        e.methods.push('EWMA');
        e.score += 1;
        anomalyMap.set(a.index, e);
      }

      for (const [, a] of anomalyMap) {
        allAnomalies.push({
          column: col,
          rowIndex: a.index,
          value: a.value,
          methods: a.methods,
          ensembleScore: Number(a.score.toFixed(2)),
          severity: a.score >= 2 ? 'critical' : a.score >= 1 ? 'warning' : 'info',
        });
      }
    }

    allAnomalies.sort((a, b) => b.ensembleScore - a.ensembleScore);

    return {
      status: 'completed',
      confidence: 0.88,
      anomalies: allAnomalies.slice(0, 100),
      totalAnomalies: allAnomalies.length,
      methodsUsed: [...new Set(methodsUsed)],
      perColumnStats,
      summary: `Detected ${allAnomalies.length} anomalies across ${numericCols.length} numeric columns using ${[...new Set(methodsUsed)].length} algorithms.`,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 9. FORECASTING ORACLE — Time series forecasting (Holt-Winters + SES fallback)
// ═══════════════════════════════════════════════════════════════════════════
export class ForecastingOracleAgent extends Agent {
  constructor() {
    super({
      id: 'forecasting_oracle',
      name: 'Forecasting Oracle',
      role: 'Time series forecasting with confidence intervals',
      tier: 'advanced',
      description: 'Uses Holt-Winters triple exponential smoothing (or simple exponential smoothing for short series) to forecast future values with 95% confidence intervals.',
      capabilities: ['holt_winters', 'exponential_smoothing', 'confidence_intervals', 'seasonality_detection'],
      icon: 'TrendingUp',
      color: '#3b82f6',
    });
  }

  async execute(ctx: AgentExecutionContext): Promise<any> {
    const rows = ctx.fileContents;
    if (!rows.length) return { status: 'failed', error: 'No data' };

    const columns = Object.keys(rows[0]);
    const datetimeCols = columns.filter(c => detectColumnType(rows.map(r => r[c])) === 'datetime');
    const numericCols = columns.filter(c => {
      const vals = rows.slice(0, 50).map(r => Number(r[c]));
      return vals.filter(v => !isNaN(v)).length > vals.length * 0.7;
    });

    if (numericCols.length === 0) {
      return {
        status: 'skipped',
        reason: 'No numeric columns for forecasting',
        forecast: [],
      };
    }

    // Determine target column — first numeric, or from analyst suggestion
    const target = ctx.analysisConfig?.forecastTarget || numericCols[0];
    const dateCol = datetimeCols[0];

    // Build time series
    let series: { date: Date; value: number }[];
    if (dateCol) {
      series = rows
        .map(r => ({ date: new Date(r[dateCol]), value: Number(r[target]) }))
        .filter(p => !isNaN(p.date.getTime()) && !isNaN(p.value))
        .sort((a, b) => a.date.getTime() - b.date.getTime());
    } else {
      // Use row index as time
      series = rows
        .map((r, i) => ({ date: new Date(i), value: Number(r[target]) }))
        .filter(p => !isNaN(p.value));
    }

    if (series.length < 3) {
      return {
        status: 'skipped',
        reason: 'Insufficient data for forecasting (need ≥3 points)',
        forecast: [],
      };
    }

    const values = series.map(p => p.value);
    const periods = Math.min(24, Math.max(6, Math.floor(values.length / 2)));

    // Choose algorithm based on data length
    const result = values.length >= 24
      ? holtWintersForecast(values, periods, 0.3, 0.1, 0.3, 12)
      : simpleExpSmoothing(values, periods, 0.3);

    // Map forecast points to dates
    const lastDate = series[series.length - 1].date;
    const interval = series.length > 1
      ? series[1].date.getTime() - series[0].date.getTime()
      : 86400000; // 1 day default

    const forecast: any[] = result.forecast.map((f: ForecastPoint, i: number) => ({
      timestamp: new Date(lastDate.getTime() + (i + 1) * interval).toISOString(),
      value: f.value,
      lower: f.lower,
      upper: f.upper,
    }));

    return {
      status: 'completed',
      confidence: result.accuracy / 100,
      forecast,
      method: result.method,
      accuracy: result.accuracy,
      targetColumn: target,
      dateColumn: dateCol || 'index',
      historicalDataPoints: values.length,
      forecastPeriods: periods,
      trend: forecast.length > 1 && forecast[forecast.length - 1].value > forecast[0].value ? 'upward' : 'downward',
      summary: `Forecasted ${periods} periods using ${result.method}. Accuracy: ${result.accuracy}%.`,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 10. CAUSAL ARCHITECT — Causal relationship discovery
// ═══════════════════════════════════════════════════════════════════════════
export class CausalArchitectAgent extends Agent {
  constructor() {
    super({
      id: 'causal_architect',
      name: 'Causal Architect',
      role: 'Causal relationship discovery & what-if analysis',
      tier: 'advanced',
      description: 'Identifies potential causal relationships between variables using correlation, regression, and Granger-style temporal precedence tests.',
      capabilities: ['causal_inference', 'correlation_analysis', 'granger_causality', 'effect_size_estimation'],
      icon: 'GitBranch',
      color: '#a855f7',
    });
  }

  async execute(ctx: AgentExecutionContext): Promise<any> {
    const rows = ctx.fileContents;
    if (!rows.length) return { status: 'failed', error: 'No data' };

    const columns = Object.keys(rows[0]);
    const numericCols = columns.filter(c => {
      const vals = rows.slice(0, 50).map(r => Number(r[c]));
      return vals.filter(v => !isNaN(v)).length > vals.length * 0.7;
    });

    if (numericCols.length < 2) {
      return { status: 'skipped', reason: 'Need ≥2 numeric columns', relationships: [] };
    }

    const target = ctx.analysisConfig?.causalTarget || numericCols[0];
    const predictors = numericCols.filter(c => c !== target);

    const relationships: any[] = [];

    // Pairwise correlation + regression
    const targetValues = rows.map(r => Number(r[target])).filter(v => !isNaN(v));
    for (const predictor of predictors) {
      const predValues = rows.map(r => Number(r[predictor])).filter(v => !isNaN(v));
      const n = Math.min(targetValues.length, predValues.length);
      const x = predValues.slice(0, n);
      const y = targetValues.slice(0, n);
      const r = correlation(x, y);
      const reg = linearRegression(x, y);

      // Granger-style: does lagged predictor correlate with target?
      const lag = 1;
      const laggedX = x.slice(0, x.length - lag);
      const shiftedY = y.slice(lag);
      const lagCorr = correlation(laggedX, shiftedY);

      const absR = Math.abs(r);
      const strength = absR > 0.7 ? 'strong' : absR > 0.4 ? 'moderate' : absR > 0.2 ? 'weak' : 'negligible';
      const direction = r > 0 ? 'positive' : 'negative';

      // Confidence: combination of correlation strength and lag correlation
      const confidence = Math.min(0.95, 0.4 + absR * 0.5 + Math.abs(lagCorr - r) * 0.1);

      relationships.push({
        cause: predictor,
        effect: target,
        correlation: Number(r.toFixed(3)),
        lagCorrelation: Number(lagCorr.toFixed(3)),
        strength,
        direction,
        effectSize: Number(reg.slope.toFixed(4)),
        rSquared: Number(reg.r2.toFixed(3)),
        confidence: Number(confidence.toFixed(2)),
        interpretation: `${strength === 'strong' ? 'Strong' : strength === 'moderate' ? 'Moderate' : 'Weak'} ${direction} relationship (r=${r.toFixed(2)}, R²=${reg.r2.toFixed(2)}). ${lagCorr > r ? 'Lagged correlation suggests temporal precedence — possible causal link.' : 'No clear temporal precedence — relationship may be correlational only.'}`,
      });
    }

    relationships.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));

    return {
      status: 'completed',
      confidence: relationships[0]?.confidence ?? 0.5,
      relationships,
      targetVariable: target,
      summary: `Analyzed ${predictors.length} potential causes of ${target}. Found ${relationships.filter(r => r.strength !== 'negligible').length} non-negligible relationships.`,
      strongestDriver: relationships[0]?.cause,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 11. NLQ INTERPRETER — Natural language to structured analysis query
// ═══════════════════════════════════════════════════════════════════════════
export class NLQInterpreterAgent extends Agent {
  constructor() {
    super({
      id: 'nlq_interpreter',
      name: 'NLQ Interpreter',
      role: 'Natural language to structured analysis query',
      tier: 'advanced',
      description: 'Parses natural language questions about the data and translates them into structured analysis intents, target columns, and visualization specs.',
      capabilities: ['intent_detection', 'entity_extraction', 'query_translation', 'visualization_suggestion'],
      icon: 'MessageSquare',
      color: '#06b6d4',
    });
  }

  async execute(ctx: AgentExecutionContext): Promise<any> {
    const query = ctx.nlqQuery;
    if (!query) {
      return { status: 'skipped', reason: 'no_nlq_query' };
    }
    return this.interpret(query, ctx.fileContents);
  }

  async interpret(query: string, rows?: any[]): Promise<any> {
    const lower = query.toLowerCase();
    const intent = this.detectIntent(lower);
    const entities = this.extractEntities(query, rows);
    const visualization = this.suggestVisualization(intent, entities);
    const sqlEquivalent = this.generateSQLEquivalent(intent, entities, rows);

    return {
      status: 'completed',
      confidence: 0.86,
      originalQuery: query,
      intent,
      entities,
      suggestedVisualization: visualization,
      sqlEquivalent,
      summary: `Interpreted question as "${intent}" analysis involving ${entities.map((e: any) => e.value).join(', ')}.`,
    };
  }

  private detectIntent(query: string): string {
    if (/trend|over time|forecast|predict|future/.test(query)) return 'time_series_forecast';
    if (/correlat|relat|connect|affect|impact|influence/.test(query)) return 'correlation_analysis';
    if (/caus|because of|due to|leads to|drives/.test(query)) return 'causal_analysis';
    if (/anomal|outlier|unusual|abnormal|weird/.test(query)) return 'anomaly_detection';
    if (/cluster|segment|group|categor/.test(query)) return 'clustering';
    if (/compare|versus|vs|difference/.test(query)) return 'comparison';
    if (/distribut|spread|histogram/.test(query)) return 'distribution_analysis';
    if (/summar|overview|describ|explain/.test(query)) return 'descriptive_summary';
    if (/average|mean|median|total|sum/.test(query)) return 'aggregation';
    if (/count|how many|frequency/.test(query)) return 'count';
    if (/top|bottom|best|worst|highest|lowest|rank/.test(query)) return 'ranking';
    return 'descriptive_summary';
  }

  private extractEntities(query: string, rows?: any[]): { type: string; value: string; confidence: number }[] {
    const entities: { type: string; value: string; confidence: number }[] = [];
    // Numeric values
    const nums = query.match(/\b\d+(\.\d+)?\b/g);
    if (nums) nums.forEach(n => entities.push({ type: 'number', value: n, confidence: 0.95 }));
    // Date-like
    const dates = query.match(/\b(20\d{2}|\d{1,2}[/-]\d{1,2})\b/g);
    if (dates) dates.forEach(d => entities.push({ type: 'date', value: d, confidence: 0.85 }));
    // Column names from dataset
    if (rows && rows.length > 0) {
      const columns = Object.keys(rows[0]);
      for (const col of columns) {
        const lower = col.toLowerCase();
        if (query.toLowerCase().includes(lower)) {
          entities.push({ type: 'column', value: col, confidence: 0.95 });
        }
      }
    }
    // Aggregation keywords
    if (/average|mean/i.test(query)) entities.push({ type: 'aggregation', value: 'mean', confidence: 0.9 });
    if (/sum|total/i.test(query)) entities.push({ type: 'aggregation', value: 'sum', confidence: 0.9 });
    if (/count/i.test(query)) entities.push({ type: 'aggregation', value: 'count', confidence: 0.9 });
    if (/median/i.test(query)) entities.push({ type: 'aggregation', value: 'median', confidence: 0.9 });
    return entities;
  }

  private suggestVisualization(intent: string, entities: any[]): string {
    const vizMap: Record<string, string> = {
      time_series_forecast: 'line',
      correlation_analysis: 'scatter',
      causal_analysis: 'scatter',
      anomaly_detection: 'scatter',
      clustering: 'scatter',
      comparison: 'bar',
      distribution_analysis: 'histogram',
      descriptive_summary: 'table',
      aggregation: 'bar',
      count: 'bar',
      ranking: 'bar',
    };
    return vizMap[intent] || 'table';
  }

  private generateSQLEquivalent(intent: string, entities: any[], rows?: any[]): string {
    const colEntities = entities.filter(e => e.type === 'column').map(e => e.value);
    const agg = entities.find(e => e.type === 'aggregation')?.value || '*';

    switch (intent) {
      case 'aggregation':
        return `SELECT ${agg.toUpperCase()}(${colEntities[0] || '*'}) FROM data;`;
      case 'count':
        return `SELECT COUNT(*) FROM data${colEntities.length ? ` GROUP BY ${colEntities[0]}` : ''};`;
      case 'ranking':
        return `SELECT ${colEntities.join(', ')} FROM data ORDER BY ${colEntities[colEntities.length - 1] || '1'} DESC LIMIT 10;`;
      case 'time_series_forecast':
        return `SELECT date_trunc('day', ${colEntities.find(c => /date|time/i.test(c)) || 'created_at'}) AS period, ${agg.toUpperCase()}(${colEntities.find(c => !/date|time/i.test(c)) || 'value'}) FROM data GROUP BY period ORDER BY period;`;
      case 'correlation_analysis':
        return `-- Correlation requires statistical computation outside standard SQL\n-- SELECT CORR(${colEntities[0]}, ${colEntities[1]}) FROM data; -- PostgreSQL\n-- Consider: SELECT ${colEntities.join(', ')} FROM data; -- then compute correlation client-side`;
      default:
        return `SELECT * FROM data LIMIT 100;`;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 12. DATA QUALITY GUARDIAN — Comprehensive data quality scoring
// ═══════════════════════════════════════════════════════════════════════════
import { assessDataQuality } from './statistics';

export class DataQualityGuardianAgent extends Agent {
  constructor() {
    super({
      id: 'data_quality_guardian',
      name: 'Data Quality Guardian',
      role: 'Comprehensive data quality scoring & validation',
      tier: 'advanced',
      description: 'Evaluates data quality across 4 dimensions (completeness, uniqueness, validity, consistency) and produces actionable issue reports.',
      capabilities: ['completeness_check', 'uniqueness_check', 'validity_check', 'consistency_check', 'quality_scoring'],
      icon: 'ShieldCheck',
      color: '#22c55e',
    });
  }

  async execute(ctx: AgentExecutionContext): Promise<any> {
    const rows = ctx.fileContents;
    if (!rows.length) {
      return { status: 'failed', error: 'No data' };
    }
    const report = assessDataQuality(rows);
    return {
      status: 'completed',
      confidence: 0.94,
      ...report,
      summary: `Overall data quality: ${report.overallScore}/100. Found ${report.issues.length} issues (${report.issues.filter(i => i.severity === 'critical').length} critical).`,
    };
  }
}
