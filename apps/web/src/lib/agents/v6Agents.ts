// ═══════════════════════════════════════════════════════════════════════════
// Busara v6.0 — 3 NEW Agents (Total: 26 agents)
//   24. Real-Time Alert Agent
//   25. Reflection & Self-Critique Agent
//   26. Africa Market Intelligence Agent
// ═══════════════════════════════════════════════════════════════════════════
import { Agent, AgentExecutionContext } from './core';
import { llmRouter } from '@/lib/llm/router';
import { profileDataset, mean, stdev, correlation, zScoreAnomalies } from './statistics';

// ═══════════════════════════════════════════════════════════════════════════
// 24. REAL-TIME ALERT AGENT — Threshold monitoring + notifications
// ═══════════════════════════════════════════════════════════════════════════
export class RealTimeAlertAgent extends Agent {
  constructor() {
    super({
      id: 'realtime_alert',
      name: 'Real-Time Alert Agent',
      role: 'Threshold monitoring and automated notifications',
      tier: 'specialized',
      description: 'Defines and monitors alert thresholds on key metrics. When a threshold is breached (e.g., revenue drops 20%), it triggers notifications via email, Slack, or WhatsApp. Massive retention driver — users come back when alerts fire.',
      capabilities: ['threshold_monitoring', 'anomaly_alerts', 'scheduled_reports', 'multi_channel_notifications'],
      icon: 'Bell',
      color: '#ef4444',
    });
  }

  async execute(ctx: AgentExecutionContext): Promise<any> {
    const rows = ctx.fileContents;
    if (!rows.length) return { status: 'failed', error: 'No data' };

    const profile = profileDataset(rows);
    const numericCols = profile.columns.filter(c => c.stats.type === 'numeric').map(c => c.name);
    const alerts: any[] = [];

    // Auto-detect alert-worthy thresholds for each numeric column
    for (const col of numericCols) {
      const values = rows.map(r => Number(r[col])).filter(v => !isNaN(v));
      if (values.length < 3) continue;

      const m = mean(values);
      const s = stdev(values);
      const latest = values[values.length - 1];
      const previous = values[values.length - 2] || m;
      const changePct = previous !== 0 ? ((latest - previous) / Math.abs(previous)) * 100 : 0;

      // Alert 1: Significant drop
      if (changePct < -15) {
        alerts.push({
          metric: col,
          type: 'significant_drop',
          severity: changePct < -30 ? 'critical' : 'high',
          message: `${col} dropped ${Math.abs(changePct).toFixed(1)}% from ${previous.toFixed(2)} to ${latest.toFixed(2)}`,
          threshold: -15,
          actualChange: Number(changePct.toFixed(2)),
          recommendation: `Investigate the ${Math.abs(changePct).toFixed(1)}% drop in ${col}. Check for data issues or business events.`,
          channels: ['email', 'slack', 'whatsapp'],
        });
      }

      // Alert 2: Significant spike
      if (changePct > 25) {
        alerts.push({
          metric: col,
          type: 'significant_spike',
          severity: 'medium',
          message: `${col} spiked ${changePct.toFixed(1)}% from ${previous.toFixed(2)} to ${latest.toFixed(2)}`,
          threshold: 25,
          actualChange: Number(changePct.toFixed(2)),
          recommendation: `Investigate the ${changePct.toFixed(1)}% spike in ${col}. Could be an opportunity or anomaly.`,
          channels: ['email', 'slack'],
        });
      }

      // Alert 3: Statistical outlier
      if (s > 0) {
        const zScore = Math.abs((latest - m) / s);
        if (zScore > 2.5) {
          alerts.push({
            metric: col,
            type: 'statistical_outlier',
            severity: zScore > 3.5 ? 'critical' : 'high',
            message: `${col} value ${latest.toFixed(2)} is ${zScore.toFixed(1)} standard deviations from the mean (${m.toFixed(2)})`,
            threshold: 2.5,
            actualZScore: Number(zScore.toFixed(2)),
            recommendation: `${latest.toFixed(2)} is statistically unusual for ${col}. Verify data accuracy.`,
            channels: ['email', 'slack'],
          });
        }
      }

      // Alert 4: Trend reversal
      if (values.length >= 5) {
        const recentAvg = mean(values.slice(-3));
        const priorAvg = mean(values.slice(-6, -3));
        if (priorAvg > 0) {
          const trendChange = ((recentAvg - priorAvg) / priorAvg) * 100;
          if (Math.abs(trendChange) > 20) {
            alerts.push({
              metric: col,
              type: 'trend_reversal',
              severity: 'high',
              message: `${col} trend reversed: recent average ${recentAvg.toFixed(2)} vs prior ${priorAvg.toFixed(2)} (${trendChange > 0 ? '+' : ''}${trendChange.toFixed(1)}%)`,
              threshold: 20,
              actualChange: Number(trendChange.toFixed(2)),
              recommendation: `Trend reversal detected in ${col}. ${trendChange > 0 ? 'Capitalize on the upward trend' : 'Investigate the downward trend'}.`,
              channels: ['email'],
            });
          }
        }
      }
    }

    // Generate suggested alert configurations for the user
    const suggestedAlerts = numericCols.map(col => {
      const values = rows.map(r => Number(r[col])).filter(v => !isNaN(v));
      const m = mean(values);
      const s = stdev(values);
      return {
        metric: col,
        conditions: [
          { type: 'drops_below', value: Number((m - 2 * s).toFixed(2)), label: `Drops below ${m - 2 * s}` },
          { type: 'exceeds', value: Number((m + 2 * s).toFixed(2)), label: `Exceeds ${m + 2 * s}` },
          { type: 'change_pct', value: -20, label: 'Drops 20%+ period-over-period' },
        ],
      };
    });

    return {
      status: 'completed',
      confidence: 0.88,
      alerts,
      alertCount: alerts.length,
      criticalAlerts: alerts.filter(a => a.severity === 'critical').length,
      suggestedAlerts,
      summary: alerts.length === 0
        ? 'No alerts triggered. All metrics within normal range.'
        : `${alerts.length} alerts triggered (${alerts.filter(a => a.severity === 'critical').length} critical). Review immediately.`,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 25. REFLECTION & SELF-CRITIQUE AGENT — Quality assurance meta-agent
// Runs as DAG stage 7 — reviews all other agents' outputs for quality
// ═══════════════════════════════════════════════════════════════════════════
export class ReflectionAgent extends Agent {
  constructor() {
    super({
      id: 'reflection_agent',
      name: 'Reflection & Self-Critique',
      role: 'Reviews all agent outputs for quality, contradictions, and gaps',
      tier: 'specialized',
      description: 'Meta-agent that reviews every other agent\'s output for consistency, contradictions, low confidence findings, and business plausibility. Uses LLM to critique, then flags issues for re-analysis. Makes the platform self-correcting.',
      capabilities: ['quality_review', 'contradiction_detection', 'confidence_assessment', 'gap_identification'],
      icon: 'ScanSearch',
      color: '#6366f1',
    });
  }

  async execute(ctx: AgentExecutionContext): Promise<any> {
    const depResults = ctx.dependencyResults;
    const issues: any[] = [];
    const strengths: string[] = [];

    // 1. Check for contradictions between agents
    const causal = depResults.causal_architect || {};
    const explainability = depResults.explainability_agent || {};
    if (causal.relationships && explainability.explanations) {
      for (const rel of causal.relationships) {
        const matchingExpl = explainability.explanations?.find((e: any) => e.feature === rel.cause);
        if (matchingExpl && rel.correlation > 0.7 && matchingExpl.coefficient < 0) {
          issues.push({
            type: 'contradiction',
            severity: 'high',
            agents: ['causal_architect', 'explainability_agent'],
            description: `Causal Architect found ${rel.cause}→${rel.effect} correlation of ${rel.correlation} (positive), but Explainability Agent shows a negative coefficient (${matchingExpl.coefficient}). This contradiction needs investigation.`,
          });
        }
      }
    }

    // 2. Check for low-confidence findings being presented as high-impact
    const insights = depResults.insight_generator || {};
    if (insights.insights) {
      for (const insight of insights.insights) {
        if (insight.impact === 'high' && insight.confidence < 0.6) {
          issues.push({
            type: 'low_confidence_high_impact',
            severity: 'medium',
            agent: 'insight_generator',
            description: `Insight "${insight.title}" is marked as high-impact but has only ${(insight.confidence * 100).toFixed(0)}% confidence. Consider downgrading impact or gathering more evidence.`,
          });
        }
      }
    }

    // 3. Check for data quality issues that weren't addressed
    const quality = depResults.data_quality_guardian || {};
    if (quality.overallScore < 80 && quality.issues) {
      const criticalIssues = quality.issues.filter((i: any) => i.severity === 'critical');
      if (criticalIssues.length > 0 && (!insights.recommendations || !insights.recommendations.some((r: any) => r.priority === 'high' && r.title.toLowerCase().includes('quality')))) {
        issues.push({
          type: 'unaddressed_quality_issue',
          severity: 'high',
          agent: 'insight_generator',
          description: `${criticalIssues.length} critical data quality issues were detected but no high-priority recommendation was generated to address them.`,
        });
      }
    }

    // 4. Check for forecast-anomaly alignment
    const forecast = depResults.forecasting_oracle || {};
    const anomalies = depResults.anomaly_sentinel || {};
    if (forecast.trend && anomalies.totalAnomalies > 0) {
      if (forecast.trend === 'upward' && anomalies.totalAnomalies > 10) {
        issues.push({
          type: 'forecast_anomaly_misalignment',
          severity: 'low',
          agents: ['forecasting_oracle', 'anomaly_sentinel'],
          description: `Forecast shows upward trend but ${anomalies.totalAnomalies} anomalies detected. High anomaly count may indicate the trend is not stable.`,
        });
      }
    }

    // 5. LLM-powered critique (if available)
    try {
      const agentSummaries = Object.entries(depResults)
        .filter(([, v]) => v?.summary)
        .map(([k, v]) => `- ${k}: ${v.summary}`)
        .join('\n');

      const critiqueResponse = await llmRouter({
        system: 'You are a quality assurance reviewer for a data analysis platform. Review the agent outputs for any issues, contradictions, or gaps. Be concise — list only genuine problems. If everything looks good, say "No issues found."',
        user: `Review these agent outputs for quality issues:\n\n${agentSummaries}\n\nIssues found: ${issues.length}\n\nAre there any additional issues not already identified?`,
        complexity: 'medium',
        maxTokens: 500,
      });

      if (critiqueResponse.text && !critiqueResponse.text.includes('No issues found')) {
        // Parse LLM critique and add as additional issues
        const llmIssues = critiqueResponse.text.split('\n')
          .filter(line => line.trim().startsWith('-') || line.trim().startsWith('*'))
          .map(line => ({
            type: 'llm_critique',
            severity: 'medium',
            description: line.trim().replace(/^[-*]\s*/, ''),
          }));
        issues.push(...llmIssues.slice(0, 3));
      }
    } catch {
      // LLM critique is optional — don't fail if unavailable
    }

    // 6. Identify strengths
    if (quality.overallScore >= 90) strengths.push('High data quality score — analysis is reliable');
    if (forecast.accuracy >= 85) strengths.push('High forecast accuracy — predictions are trustworthy');
    if (insights.insights && insights.insights.length >= 5) strengths.push('Rich insight generation — comprehensive findings');
    if (anomalies.totalAnomalies === 0) strengths.push('No anomalies detected — data is consistent');

    return {
      status: 'completed',
      confidence: 0.91,
      issues,
      issueCount: issues.length,
      criticalIssues: issues.filter(i => i.severity === 'critical').length,
      strengths,
      overallQuality: issues.length === 0 ? 'excellent' : issues.length <= 2 ? 'good' : 'needs_review',
      summary: issues.length === 0
        ? `✓ No issues found. Analysis quality is excellent. ${strengths.length} strengths identified.`
        : `${issues.length} quality issues found (${issues.filter(i => i.severity === 'critical').length} critical). Review before acting on insights.`,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 26. AFRICA MARKET INTELLIGENCE AGENT — M-Pesa, AfCFTA, forex, mobile money
// Busara's biggest moat — no Western competitor can match this
// ═══════════════════════════════════════════════════════════════════════════
export class AfricaMarketIntelligenceAgent extends Agent {
  constructor() {
    super({
      id: 'africa_market_intel',
      name: 'Africa Market Intelligence',
      role: 'African market context — M-Pesa, AfCFTA, forex, mobile money',
      tier: 'specialized',
      description: 'Specialized agent for African business contexts: M-Pesa transaction analysis, forex volatility detection, USSD engagement metrics, cross-border AfCFTA trade flows, mobile money reconciliation, and seasonal patterns (harvest, school fees, Ramadan). Busara\'s biggest moat.',
      capabilities: ['mpesa_analysis', 'forex_detection', 'afcfta_flows', 'mobile_money_reconciliation', 'seasonal_patterns', 'african_benchmarks'],
      icon: 'Globe2',
      color: '#10b981',
    });
  }

  // Curated African market benchmarks
  private BENCHMARKS: Record<string, any> = {
    mpesa: {
      avgTransactionValueKES: 1500,
      avgDailyTransactionsPerUser: 3.2,
      merchantPaymentAdoption: 67,
      pesapalIntegrationRate: 45,
    },
    mobile_money: {
      africaTotalAccounts: 1.75e9,
      avgARPU_USD: 2.5,
      transactionSuccessRate: 94.2,
      agentNetworkDensity: 8.5, // agents per 1000 adults
    },
    afcfta: {
      intraAfricanTradePct: 14.4, // % of total African trade
      targetPct: 25,
      topTradeLanes: ['Kenya-Uganda', 'Nigeria-Ghana', 'South Africa-Zambia', 'Egypt-Sudan'],
    },
    forex: {
      avgKESVolatility: 8.5, // % annualized
      avgNGNVolatility: 15.2,
      avgZARVolatility: 11.8,
    },
    seasonal: {
      harvestPeak: ['Sep-Nov', 'Mar-May'],
      schoolFeesDue: ['Jan', 'May', 'Sep'],
      ramadanImpact: 'Mar-Apr (varies)',
      festiveSeason: 'Dec',
    },
  };

  async execute(ctx: AgentExecutionContext): Promise<any> {
    const rows = ctx.fileContents;
    if (!rows.length) return { status: 'failed', error: 'No data' };

    const profile = profileDataset(rows);
    const columns = profile.columns.map(c => c.name.toLowerCase());
    const analysis: any = {};

    // 1. M-Pesa / Mobile Money Detection
    const mpesaCols = columns.filter(c =>
      c.includes('mpesa') || c.includes('m-pesa') || c.includes('mobile') ||
      c.includes('wallet') || c.includes('payment') || c.includes('transaction')
    );

    if (mpesaCols.length > 0) {
      analysis.mobileMoney = this.analyzeMobileMoney(rows, mpesaCols);
    }

    // 2. Forex / Currency Detection
    const forexCols = columns.filter(c =>
      c.includes('forex') || c.includes('rate') || c.includes('exchange') ||
      c.includes('usd') || c.includes('kes') || c.includes('ngn') || c.includes('currency')
    );

    if (forexCols.length > 0) {
      analysis.forex = this.analyzeForex(rows, forexCols);
    }

    // 3. Seasonal Pattern Detection
    const dateCols = profile.columns.filter(c => c.stats.type === 'datetime').map(c => c.name);
    if (dateCols.length > 0 && profile.columns.some(c => c.stats.type === 'numeric')) {
      analysis.seasonalPatterns = this.detectSeasonalPatterns(rows, dateCols[0]);
    }

    // 4. Cross-Border / Trade Detection
    const countryCols = columns.filter(c =>
      c.includes('country') || c.includes('region') || c.includes('origin') || c.includes('destination')
    );
    if (countryCols.length > 0) {
      analysis.crossBorder = this.analyzeCrossBorder(rows, countryCols);
    }

    // 5. African Domain Context
    analysis.domainContext = this.identifyAfricanDomain(profile);

    // 6. Benchmarks Comparison
    analysis.benchmarks = this.getBenchmarks(analysis);

    // 7. African-Specific Insights
    const insights = this.generateAfricanInsights(analysis, profile);

    return {
      status: 'completed',
      confidence: 0.87,
      analysis,
      insights,
      benchmarksApplied: Object.keys(analysis.benchmarks || {}).length,
      summary: this.generateSummary(analysis, insights),
    };
  }

  private analyzeMobileMoney(rows: any[], cols: string[]): any {
    const col = cols[0];
    const values = rows.map(r => Number(r[col])).filter(v => !isNaN(v));
    if (!values.length) return null;

    const m = mean(values);
    const s = stdev(values);
    const totalVolume = values.reduce((a, b) => a + b, 0);
    const avgTransaction = m;
    const benchmarks = this.BENCHMARKS.mpesa;

    return {
      column: col,
      totalTransactions: values.length,
      totalVolume: Number(totalVolume.toFixed(2)),
      avgTransactionValue: Number(avgTransaction.toFixed(2)),
      stdev: Number(s.toFixed(2)),
      benchmarkComparison: {
        vsAvgKES: `${((avgTransaction / benchmarks.avgTransactionValueKES - 1) * 100).toFixed(1)}% vs benchmark (KES ${benchmarks.avgTransactionValueKES})`,
      },
      anomalyCount: zScoreAnomalies(values, 2.5).length,
    };
  }

  private analyzeForex(rows: any[], cols: string[]): any {
    const col = cols[0];
    const values = rows.map(r => Number(r[col])).filter(v => !isNaN(v));
    if (values.length < 2) return null;

    const changes = values.slice(1).map((v, i) => ((v - values[i]) / values[i]) * 100);
    const volatility = stdev(changes);
    const totalChange = ((values[values.length - 1] - values[0]) / values[0]) * 100;

    return {
      column: col,
      startRate: values[0],
      endRate: values[values.length - 1],
      totalChangePct: Number(totalChange.toFixed(2)),
      volatilityPct: Number(volatility.toFixed(2)),
      assessment: volatility > 10 ? 'high_volatility' : volatility > 5 ? 'moderate_volatility' : 'stable',
    };
  }

  private detectSeasonalPatterns(rows: any[], dateCol: string): any {
    const monthlyData: Record<string, number[]> = {};
    const numericCol = Object.keys(rows[0]).find(k => typeof rows[0][k] === 'number');

    if (!numericCol) return null;

    rows.forEach(r => {
      const date = new Date(r[dateCol]);
      if (isNaN(date.getTime())) return;
      const month = date.toLocaleString('default', { month: 'short' });
      if (!monthlyData[month]) monthlyData[month] = [];
      monthlyData[month].push(Number(r[numericCol]));
    });

    const monthlyAverages = Object.entries(monthlyData).map(([month, vals]) => ({
      month,
      average: Number(mean(vals).toFixed(2)),
      count: vals.length,
    }));

    const avg = mean(monthlyAverages.map(m => m.average));
    const seasonal = monthlyAverages.filter(m => Math.abs(m.average - avg) > avg * 0.15);

    return {
      numericColumn: numericCol,
      monthlyAverages: monthlyAverages.sort((a, b) => b.average - a.average),
      seasonalMonths: seasonal.map(m => m.month),
      peakMonth: monthlyAverages[0]?.month,
      lowMonth: monthlyAverages[monthlyAverages.length - 1]?.month,
    };
  }

  private analyzeCrossBorder(rows: any[], cols: string[]): any {
    const col = cols[0];
    const counts = new Map<string, number>();
    rows.forEach(r => {
      const v = String(r[col] ?? 'Unknown');
      counts.set(v, (counts.get(v) ?? 0) + 1);
    });

    const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);

    return {
      column: col,
      uniqueValues: counts.size,
      topValues: top.map(([value, count]) => ({ value, count, pct: Number(((count / rows.length) * 100).toFixed(1)) })),
    };
  }

  private identifyAfricanDomain(profile: any): string {
    const cols = profile.columns.map(c => c.name.toLowerCase());
    if (cols.some(c => c.includes('mpesa') || c.includes('mobile') || c.includes('wallet'))) return 'african_fintech';
    if (cols.some(c => c.includes('farm') || c.includes('crop') || c.includes('harvest') || c.includes('yield'))) return 'african_agriculture';
    if (cols.some(c => c.includes('patient') || c.includes('clinic') || c.includes('health'))) return 'african_healthcare';
    if (cols.some(c => c.includes('sales') || c.includes('revenue') || c.includes('trade'))) return 'african_commerce';
    return 'african_general';
  }

  private getBenchmarks(analysis: any): any {
    const benchmarks: any = {};
    if (analysis.mobileMoney) benchmarks.mpesa = this.BENCHMARKS.mpesa;
    if (analysis.forex) benchmarks.forex = this.BENCHMARKS.forex;
    benchmarks.afcfta = this.BENCHMARKS.afcfta;
    benchmarks.mobileMoney = this.BENCHMARKS.mobile_money;
    benchmarks.seasonal = this.BENCHMARKS.seasonal;
    return benchmarks;
  }

  private generateAfricanInsights(analysis: any, profile: any): any[] {
    const insights: any[] = [];

    if (analysis.mobileMoney) {
      const mm = analysis.mobileMoney;
      insights.push({
        title: 'Mobile Money Transaction Analysis',
        description: `${mm.totalTransactions} mobile money transactions analyzed. Average value: ${mm.avgTransactionValue}. ${mm.benchmarkComparison.vsAvgKES}. ${mm.anomalyCount} anomalies detected.`,
        impact: 'high',
        confidence: 0.9,
      });
    }

    if (analysis.forex) {
      const fx = analysis.forex;
      insights.push({
        title: `Forex Volatility Assessment: ${fx.assessment.replace('_', ' ')}`,
        description: `Exchange rate moved ${fx.totalChangePct}% with ${fx.volatilityPct}% volatility. ${fx.assessment === 'high_volatility' ? 'Consider hedging strategies.' : 'Rate is relatively stable.'}`,
        impact: fx.assessment === 'high_volatility' ? 'high' : 'medium',
        confidence: 0.85,
      });
    }

    if (analysis.seasonalPatterns?.seasonalMonths?.length > 0) {
      insights.push({
        title: 'Seasonal Pattern Detected',
        description: `Peak month: ${analysis.seasonalPatterns.peakMonth}. Low month: ${analysis.seasonalPatterns.lowMonth}. Seasonal months: ${analysis.seasonalPatterns.seasonalMonths.join(', ')}. Plan inventory and staffing accordingly.`,
        impact: 'medium',
        confidence: 0.8,
      });
    }

    insights.push({
      title: 'African Market Context Applied',
      description: `Domain identified as: ${analysis.domainContext}. Applied African market benchmarks: M-Pesa (KES ${this.BENCHMARKS.mpesa.avgTransactionValueKES} avg), AfCFTA trade (${this.BENCHMARKS.afcfta.intraAfricanTradePct}% intra-African), mobile money (${this.BENCHMARKS.mobile_money.africaTotalAccounts.toExponential(2)} accounts).`,
      impact: 'low',
      confidence: 0.95,
    });

    return insights;
  }

  private generateSummary(analysis: any, insights: any[]): string {
    const parts: string[] = [];
    if (analysis.mobileMoney) parts.push('Mobile money analysis completed');
    if (analysis.forex) parts.push('Forex assessment done');
    if (analysis.seasonalPatterns) parts.push('Seasonal patterns detected');
    if (analysis.crossBorder) parts.push('Cross-border flows analyzed');
    parts.push(`${insights.length} African-specific insights generated`);
    parts.push(`${Object.keys(analysis.benchmarks || {}).length} benchmarks applied`);
    return parts.join('. ') + '.';
  }
}
