'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, BarChart3, FileText, AlertTriangle, TrendingUp, GitBranch,
  ShieldCheck, Code, Sparkles, Brain, Lightbulb, MessageCircle, Eye, Target, Share2, Cpu,
  Download, Loader2, Wand2,
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api, AnalysisResult } from '@/lib/api-client';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

const COLORS = ['#10b981', '#8b5cf6', '#f59e0b', '#0ea5e9', '#ec4899', '#14b8a6', '#ef4444', '#a855f7'];

interface Props {
  result: AnalysisResult;
  fileContents: any[];
  onReset: () => void;
}

export function AnalysisResultsView({ result, fileContents, onReset }: Props) {
  const results = result.results || {};
  const [activeTab, setActiveTab] = useState('overview');
  const [aiNarrative, setAiNarrative] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const orchestrator = results.orchestrator?.result || {};
  const insights = results.insight_generator?.result || {};
  const narrative = results.narrative_composer?.result || {};
  const visuals = results.visualization_specialist?.result?.visualizations || [];
  const anomalies = results.anomaly_sentinel?.result || {};
  const forecast = results.forecasting_oracle?.result || {};
  const causal = results.causal_architect?.result || {};
  const quality = results.data_quality_guardian?.result || {};
  const privacy = results.privacy_guardian?.result || {};
  const codeGen = results.code_generator?.result || {};
  const synthetic = results.synthetic_data_generator?.result || {};
  const knowledgeGraph = results.knowledge_graph_builder?.result || {};
  const explainability = results.explainability_agent?.result || {};
  const benchmark = results.benchmark_agent?.result || {};
  const autoMl = results.auto_ml_agent?.result || {};
  const conversational = results.conversational_analyst?.result || {};
  const scout = results.data_scout?.result || {};

  const handleGenerateAINarrative = async () => {
    setAiLoading(true);
    try {
      const payload = {
        datasetSummary: {
          rowCount: scout.profile?.rowCount ?? 0,
          columnCount: scout.profile?.columnCount ?? 0,
          columnTypes: Object.fromEntries((scout.profile?.columns ?? []).map((c: any) => [c.name, c.stats.type])),
          qualityScore: quality.overallScore ?? scout.profile?.qualityScore ?? 0,
          detectedDomain: scout.detectedDomain ?? 'general',
        },
        keyFindings: (insights.insights ?? []).slice(0, 7).map((i: any) => ({
          title: i.title, description: i.description, confidence: i.confidence,
        })),
        anomalies: {
          total: anomalies.totalAnomalies ?? 0,
          topAnomalies: (anomalies.anomalies ?? []).slice(0, 5),
        },
        forecast: forecast.forecast?.length ? {
          method: forecast.method, accuracy: forecast.accuracy,
          trend: forecast.trend, periods: forecast.forecastPeriods,
        } : null,
        causalRelationships: (causal.relationships ?? []).slice(0, 5).map((r: any) => ({
          cause: r.cause, effect: r.effect, strength: r.strength, correlation: r.correlation,
        })),
        recommendations: (insights.recommendations ?? []).slice(0, 5).map((r: any) => ({
          title: r.title, description: r.description, priority: r.priority,
        })),
      };
      const aiResult = await api.generateAINarrative(payload);
      setAiNarrative(aiResult);
    } catch (err: any) {
      console.error('AI narrative failed:', err);
      alert('AI narrative generation failed: ' + err.message);
    } finally {
      setAiLoading(false);
    }
  };

  const handleExportPdf = async () => {
    setPdfLoading(true);
    try {
      // Build chart specifications from the analysis results so the server
      // can generate real chart images and embed them in the PDF.
      const charts: any[] = [];

      // 1. Histograms for top numeric columns
      const numericCols = (scout.profile?.columns ?? []).filter((c: any) => c.stats.type === 'numeric').slice(0, 2);
      for (const col of numericCols) {
        const values = fileContents.map((r: any) => Number(r[col.name])).filter((v: number) => !isNaN(v));
        if (values.length > 3) {
          charts.push({
            type: 'histogram',
            title: `Distribution of ${col.name}`,
            values,
            color: '#10b981',
            description: `Histogram showing the frequency distribution of ${col.name} across ${values.length} data points.`,
          });
        }
      }

      // 2. Time series / forecast chart
      if (forecast.forecast && forecast.forecast.length > 0) {
        const dateCol = (scout.profile?.columns ?? []).find((c: any) => c.stats.type === 'datetime')?.name;
        const targetCol = forecast.targetColumn;
        if (dateCol && targetCol) {
          const historical = fileContents
            .map((r: any) => ({ label: String(r[dateCol] ?? '').split('T')[0], value: Number(r[targetCol]) }))
            .filter((p: any) => p.value && !isNaN(p.value))
            .slice(-12);
          charts.push({
            type: 'forecast',
            title: `${targetCol} — Historical & Forecast`,
            historical,
            forecast: forecast.forecast.map((f: any) => ({
              label: f.timestamp?.split('T')[0] ?? `+${f.timestamp}`,
              value: f.value,
              lower: f.lower,
              upper: f.upper,
            })),
            description: `Forecast using ${forecast.method}. Accuracy: ${forecast.accuracy}%. Trend: ${forecast.trend}.`,
          });
        }
      }

      // 3. Correlation chart
      if (causal.relationships && causal.relationships.length > 0) {
        charts.push({
          type: 'correlation',
          title: 'Top Causal Relationships',
          matrix: causal.relationships.slice(0, 8).map((r: any) => ({
            row: r.cause,
            col: r.effect,
            value: r.correlation,
          })),
          variables: causal.relationships.map((r: any) => r.cause),
          description: 'Pearson correlation between key variables. Green = positive, red = negative.',
        });
      }

      // 4. Anomaly chart (scatter)
      if (anomalies.anomalies && anomalies.anomalies.length > 0) {
        const anomalyCol = anomalies.anomalies[0].column;
        const values = fileContents.map((r: any) => Number(r[anomalyCol])).filter((v: number) => !isNaN(v));
        const anomalyIndices = new Set(anomalies.anomalies.map((a: any) => a.rowIndex));
        charts.push({
          type: 'scatter',
          title: `Anomalies in ${anomalyCol}`,
          points: values.map((v: number, i: number) => ({ x: i, y: v })),
          xLabel: 'Row Index',
          yLabel: anomalyCol,
          color: '#ef4444',
          description: `${anomalies.totalAnomalies} anomalies detected using ${anomalies.methodsUsed?.join(', ')}. Red points indicate flagged anomalies.`,
        });
      }

      // 5. Bar chart for top categorical values
      const catCols = (scout.profile?.columns ?? []).filter((c: any) => c.stats.type === 'categorical' && (c.stats.unique ?? 0) < 20).slice(0, 1);
      for (const col of catCols) {
        const counts = new Map<string, number>();
        fileContents.forEach((r: any) => {
          const v = String(r[col.name] ?? 'N/A');
          counts.set(v, (counts.get(v) ?? 0) + 1);
        });
        const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
        charts.push({
          type: 'bar',
          title: `Top values in ${col.name}`,
          data: top.map(([label, value]) => ({ label, value })),
          color: '#f59e0b',
          horizontal: true,
          description: `Most frequent values in the ${col.name} column.`,
        });
      }

      const payload = {
        analysisId: result.analysisId,
        executiveSummary: aiNarrative?.executiveSummary ?? narrative.executiveSummary,
        keyFindings: (insights.insights ?? []).slice(0, 7),
        recommendations: insights.recommendations ?? [],
        methodology: narrative.methodology,
        fullReport: aiNarrative?.fullReport ?? narrative.fullReport,
        metadata: {
          rowCount: scout.profile?.rowCount,
          columnCount: scout.profile?.columnCount,
          qualityScore: quality.overallScore,
          domain: scout.detectedDomain,
          aiPowered: aiNarrative?.aiPowered ?? false,
        },
        charts,
      };
      const html = await api.exportPdf(payload);
      // Open in new window for browser Print → Save as PDF
      const w = window.open('', '_blank');
      if (w) {
        w.document.write(html);
        w.document.close();
        setTimeout(() => w.print(), 800);
      }
    } catch (err: any) {
      alert('PDF export failed: ' + err.message);
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant={result.status === 'success' ? 'default' : 'secondary'}>
                {result.status === 'success' ? <Sparkles className="h-3 w-3 mr-1" /> : null}
                {result.status.toUpperCase()}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {result.execution.agentsSucceeded}/{result.execution.agentsSucceeded + result.execution.agentsFailed} agents · {(result.totalDurationMs / 1000).toFixed(1)}s
              </span>
            </div>
            <h3 className="text-2xl font-bold">Analysis Complete</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleGenerateAINarrative} disabled={aiLoading} className="gap-2">
              {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
              {aiLoading ? 'Generating...' : 'AI Narrative'}
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={pdfLoading} className="gap-2">
              {pdfLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              {pdfLoading ? 'Preparing...' : 'Export PDF'}
            </Button>
            <Button variant="outline" size="sm" onClick={onReset} className="gap-2">
              <ArrowLeft className="h-3.5 w-3.5" />
              New
            </Button>
          </div>
        </div>

        {aiNarrative && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mb-6 p-5 rounded-lg bg-gradient-to-br from-primary/5 to-accent/5 border border-primary/20"
          >
            <div className="flex items-center gap-2 mb-3">
              <Wand2 className="h-4 w-4 text-primary" />
              <h4 className="font-semibold text-sm">
                AI-Powered Narrative
                {aiNarrative.aiPowered && (
                  <Badge variant="secondary" className="ml-2 text-[10px] bg-gradient-to-r from-primary to-accent text-white">
                    {aiNarrative.model}
                  </Badge>
                )}
              </h4>
            </div>
            <div className="text-sm text-muted-foreground leading-relaxed mb-3">
              {aiNarrative.executiveSummary}
            </div>
            {aiNarrative.keyInsights?.length > 0 && (
              <div className="mb-2">
                <div className="text-xs font-medium text-foreground mb-1">AI Key Insights:</div>
                <ul className="text-xs text-muted-foreground space-y-1 ml-4 list-disc">
                  {aiNarrative.keyInsights.slice(0, 5).map((insight: string, i: number) => (
                    <li key={i}>{insight}</li>
                  ))}
                </ul>
              </div>
            )}
            {aiNarrative.strategicRecommendations?.length > 0 && (
              <div>
                <div className="text-xs font-medium text-foreground mb-1">AI Strategic Recommendations:</div>
                <ul className="text-xs text-muted-foreground space-y-1 ml-4 list-disc">
                  {aiNarrative.strategicRecommendations.slice(0, 4).map((rec: string, i: number) => (
                    <li key={i}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </motion.div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 md:grid-cols-6 mb-6 h-auto">
            <TabsTrigger value="overview" className="text-xs gap-1 py-2"><FileText className="h-3 w-3" /> Overview</TabsTrigger>
            <TabsTrigger value="insights" className="text-xs gap-1 py-2"><Lightbulb className="h-3 w-3" /> Insights</TabsTrigger>
            <TabsTrigger value="charts" className="text-xs gap-1 py-2"><BarChart3 className="h-3 w-3" /> Charts</TabsTrigger>
            <TabsTrigger value="advanced" className="text-xs gap-1 py-2"><Brain className="h-3 w-3" /> Advanced</TabsTrigger>
            <TabsTrigger value="code" className="text-xs gap-1 py-2"><Code className="h-3 w-3" /> Code</TabsTrigger>
            <TabsTrigger value="agents" className="text-xs gap-1 py-2"><Cpu className="h-3 w-3" /> Agents</TabsTrigger>
          </TabsList>

          {/* OVERVIEW TAB */}
          <TabsContent value="overview" className="space-y-4">
            <Card className="p-5">
              <h4 className="font-semibold mb-2 flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Executive Summary</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">{narrative.executiveSummary || orchestrator.executiveSummary || 'Analysis completed.'}</p>
            </Card>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Rows', value: scout.profile?.rowCount?.toLocaleString() ?? '—', icon: FileText },
                { label: 'Quality Score', value: `${quality.overallScore ?? scout.profile?.qualityScore ?? '—'}/100`, icon: ShieldCheck },
                { label: 'Anomalies', value: anomalies.totalAnomalies ?? '—', icon: AlertTriangle },
                { label: 'Insights', value: insights.insights?.length ?? '—', icon: Lightbulb },
              ].map(stat => (
                <Card key={stat.label} className="p-4">
                  <stat.icon className="h-4 w-4 mb-2 text-primary" />
                  <div className="text-xl font-bold">{stat.value}</div>
                  <div className="text-xs text-muted-foreground">{stat.label}</div>
                </Card>
              ))}
            </div>

            {insights.keyFindings && insights.keyFindings.length > 0 && (
              <Card className="p-5">
                <h4 className="font-semibold mb-3">Key Findings</h4>
                <div className="space-y-2">
                  {insights.keyFindings.slice(0, 5).map((f: any, i: number) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
                      <div className="h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                        {i + 1}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{f.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{f.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {insights.recommendations && insights.recommendations.length > 0 && (
              <Card className="p-5">
                <h4 className="font-semibold mb-3">Recommendations</h4>
                <div className="space-y-2">
                  {insights.recommendations.slice(0, 4).map((r: any, i: number) => (
                    <div key={i} className="p-3 rounded-lg border border-border/50">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium">{r.title}</p>
                        <Badge variant={r.priority === 'high' ? 'destructive' : 'secondary'} className="text-[10px]">
                          {r.priority}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{r.description}</p>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </TabsContent>

          {/* INSIGHTS TAB */}
          <TabsContent value="insights" className="space-y-4">
            {insights.insights && (
              <Card className="p-5">
                <h4 className="font-semibold mb-3 flex items-center gap-2"><Lightbulb className="h-4 w-4 text-chart-3" /> All Insights ({insights.insights.length})</h4>
                <div className="space-y-2 max-h-[600px] overflow-y-auto scrollbar-thin">
                  {insights.insights.map((insight: any, i: number) => (
                    <div key={i} className="p-3 rounded-lg bg-muted/30 border border-border/50">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium">{insight.title}</p>
                        <div className="flex gap-1">
                          <Badge variant="outline" className="text-[10px]">{insight.category}</Badge>
                          <Badge variant={insight.impact === 'high' ? 'destructive' : insight.impact === 'medium' ? 'default' : 'secondary'} className="text-[10px]">
                            {insight.impact}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">{insight.description}</p>
                      <div className="mt-2 text-[10px] text-muted-foreground">Confidence: {(insight.confidence * 100).toFixed(0)}%</div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </TabsContent>

          {/* CHARTS TAB */}
          <TabsContent value="charts" className="space-y-4">
            {visuals.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground">No visualizations generated.</Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {visuals.map((v: any) => (
                  <Card key={v.id} className="p-4">
                    <h4 className="text-sm font-semibold mb-1">{v.title}</h4>
                    <p className="text-xs text-muted-foreground mb-3">{v.description}</p>
                    <div className="h-64">
                      <ChartRenderer spec={v.spec} />
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ADVANCED TAB */}
          <TabsContent value="advanced" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {forecast.forecast && forecast.forecast.length > 0 && (
                <Card className="p-5">
                  <h4 className="font-semibold mb-2 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-chart-2" /> Forecast</h4>
                  <p className="text-xs text-muted-foreground mb-3">{forecast.method} · Accuracy: {forecast.accuracy}%</p>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={forecast.forecast.slice(0, 12)}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="timestamp" tick={{ fontSize: 10 }} tickFormatter={(v) => String(v).split('T')[0]} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip contentStyle={{ fontSize: 12 }} />
                        <Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="upper" stroke="#10b98180" strokeWidth={1} dot={false} strokeDasharray="3 3" />
                        <Line type="monotone" dataKey="lower" stroke="#10b98180" strokeWidth={1} dot={false} strokeDasharray="3 3" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-xs mt-2">Trend: <Badge variant="outline">{forecast.trend}</Badge></p>
                </Card>
              )}

              {anomalies.anomalies && anomalies.anomalies.length > 0 && (
                <Card className="p-5">
                  <h4 className="font-semibold mb-2 flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-chart-5" /> Anomalies</h4>
                  <p className="text-xs text-muted-foreground mb-3">{anomalies.totalAnomalies} found · Methods: {anomalies.methodsUsed?.join(', ')}</p>
                  <div className="max-h-48 overflow-y-auto scrollbar-thin space-y-1">
                    {anomalies.anomalies.slice(0, 8).map((a: any, i: number) => (
                      <div key={i} className="text-xs p-2 rounded bg-muted/30 border border-border/50">
                        <div className="flex justify-between">
                          <span className="font-medium">{a.column}</span>
                          <Badge variant={a.severity === 'critical' ? 'destructive' : 'secondary'} className="text-[10px]">{a.severity}</Badge>
                        </div>
                        <div className="text-muted-foreground">Row {a.rowIndex}: value={String(a.value)} · score={a.ensembleScore}</div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {causal.relationships && causal.relationships.length > 0 && (
                <Card className="p-5">
                  <h4 className="font-semibold mb-2 flex items-center gap-2"><GitBranch className="h-4 w-4 text-chart-4" /> Causal Drivers of {causal.targetVariable}</h4>
                  <div className="space-y-1.5">
                    {causal.relationships.slice(0, 5).map((r: any, i: number) => (
                      <div key={i} className="text-xs p-2 rounded bg-muted/30 border border-border/50">
                        <div className="flex justify-between">
                          <span className="font-medium">{r.cause}</span>
                          <Badge variant={r.strength === 'strong' ? 'default' : 'secondary'} className="text-[10px]">
                            {r.strength} ({r.correlation})
                          </Badge>
                        </div>
                        <div className="text-muted-foreground text-[10px] mt-1">{r.interpretation}</div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {explainability.explanations && explainability.explanations.length > 0 && (
                <Card className="p-5">
                  <h4 className="font-semibold mb-2 flex items-center gap-2"><Eye className="h-4 w-4 text-chart-3" /> Explainability</h4>
                  <p className="text-xs text-muted-foreground mb-3">Model R² = {explainability.modelR2}</p>
                  <div className="space-y-2">
                    {explainability.explanations.slice(0, 5).map((e: any, i: number) => (
                      <div key={i} className="text-xs p-2 rounded bg-muted/30 border border-border/50">
                        <div className="flex justify-between mb-1">
                          <span className="font-medium">{e.feature}</span>
                          <span className="text-muted-foreground">importance: {e.importance}</span>
                        </div>
                        <p className="text-muted-foreground text-[11px]">{e.explanation}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {benchmark.benchmarks && benchmark.benchmarks.length > 0 && (
                <Card className="p-5">
                  <h4 className="font-semibold mb-2 flex items-center gap-2"><Target className="h-4 w-4 text-chart-5" /> Industry Benchmarks ({benchmark.domain})</h4>
                  <div className="space-y-2">
                    {benchmark.benchmarks.slice(0, 5).map((b: any, i: number) => (
                      <div key={i} className="text-xs p-2 rounded bg-muted/30 border border-border/50">
                        <div className="flex justify-between">
                          <span className="font-medium">{b.metric}</span>
                          <Badge variant={b.percentileRank > 50 ? 'default' : 'secondary'} className="text-[10px]">
                            P{b.percentileRank.toFixed(0)}
                          </Badge>
                        </div>
                        <div className="text-muted-foreground text-[11px] mt-1">
                          You: {b.yourValue} · Industry median: {b.industryMedian}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {privacy.findings && privacy.findings.length > 0 && (
                <Card className="p-5">
                  <h4 className="font-semibold mb-2 flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-destructive" /> Privacy Findings</h4>
                  <p className="text-xs mb-3">Risk level: <Badge variant={privacy.riskLevel === 'critical' ? 'destructive' : 'default'}>{privacy.riskLevel}</Badge> · Score: {privacy.riskScore}/100</p>
                  <div className="space-y-1.5">
                    {privacy.findings.slice(0, 5).map((f: any, i: number) => (
                      <div key={i} className="text-xs p-2 rounded bg-muted/30 border border-border/50">
                        <div className="flex justify-between">
                          <span className="font-medium">{f.column} → {f.piiType}</span>
                          <Badge variant="outline" className="text-[10px]">{f.detectionMethod}</Badge>
                        </div>
                        <p className="text-muted-foreground text-[11px] mt-1">{f.recommendation}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {autoMl.models && autoMl.models.length > 0 && (
                <Card className="p-5">
                  <h4 className="font-semibold mb-2 flex items-center gap-2"><Cpu className="h-4 w-4 text-chart-4" /> Auto-ML Results</h4>
                  <p className="text-xs text-muted-foreground mb-3">Problem: {autoMl.problemType} · Best: {autoMl.bestModel}</p>
                  <div className="space-y-2">
                    {autoMl.models.map((m: any, i: number) => (
                      <div key={i} className="text-xs p-2 rounded bg-muted/30 border border-border/50">
                        <div className="flex justify-between">
                          <span className="font-medium">{m.model}</span>
                          {m.metrics?.testR2 !== undefined && (
                            <Badge variant={m.metrics.testR2 > 0.5 ? 'default' : 'secondary'} className="text-[10px]">
                              R²={m.metrics.testR2}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {knowledgeGraph.nodes && knowledgeGraph.nodes.length > 0 && (
                <Card className="p-5">
                  <h4 className="font-semibold mb-2 flex items-center gap-2"><Share2 className="h-4 w-4 text-chart-1" /> Knowledge Graph</h4>
                  <p className="text-xs text-muted-foreground mb-3">{knowledgeGraph.nodeCount} nodes · {knowledgeGraph.edgeCount} edges</p>
                  <div className="text-xs">
                    <div className="font-medium mb-1">Most connected hubs:</div>
                    {knowledgeGraph.centralNodes?.slice(0, 5).map((n: any, i: number) => (
                      <div key={i} className="flex justify-between text-[11px] py-0.5">
                        <span>{n.label}</span>
                        <span className="text-muted-foreground">degree: {n.degree}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {synthetic.syntheticDataSample && (
                <Card className="p-5">
                  <h4 className="font-semibold mb-2 flex items-center gap-2"><Sparkles className="h-4 w-4 text-chart-2" /> Synthetic Data</h4>
                  <p className="text-xs text-muted-foreground mb-3">Generated {synthetic.totalGenerated} rows · Similarity: {synthetic.similarityScore}%</p>
                  <details className="text-xs">
                    <summary className="cursor-pointer font-medium">Preview first 3 rows</summary>
                    <pre className="mt-2 p-2 rounded bg-muted/30 overflow-x-auto text-[10px]">
                      {JSON.stringify(synthetic.syntheticDataSample.slice(0, 3), null, 2)}
                    </pre>
                  </details>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* CODE TAB */}
          <TabsContent value="code" className="space-y-4">
            {codeGen.python && (
              <Card className="p-5">
                <h4 className="font-semibold mb-2 flex items-center gap-2"><Code className="h-4 w-4 text-chart-1" /> Python (pandas + scikit-learn)</h4>
                <pre className="text-xs overflow-x-auto max-h-96 scrollbar-thin rounded">
                  <SyntaxHighlighter language="python" style={vscDarkPlus} customStyle={{ background: 'transparent', fontSize: 11 }}>
                    {codeGen.python}
                  </SyntaxHighlighter>
                </pre>
              </Card>
            )}
            {codeGen.sql && (
              <Card className="p-5">
                <h4 className="font-semibold mb-2 flex items-center gap-2"><Code className="h-4 w-4 text-chart-2" /> SQL</h4>
                <pre className="text-xs overflow-x-auto max-h-96 scrollbar-thin rounded">
                  <SyntaxHighlighter language="sql" style={vscDarkPlus} customStyle={{ background: 'transparent', fontSize: 11 }}>
                    {codeGen.sql}
                  </SyntaxHighlighter>
                </pre>
              </Card>
            )}
            {codeGen.javascript && (
              <Card className="p-5">
                <h4 className="font-semibold mb-2 flex items-center gap-2"><Code className="h-4 w-4 text-chart-3" /> JavaScript (Node.js)</h4>
                <pre className="text-xs overflow-x-auto max-h-96 scrollbar-thin rounded">
                  <SyntaxHighlighter language="javascript" style={vscDarkPlus} customStyle={{ background: 'transparent', fontSize: 11 }}>
                    {codeGen.javascript}
                  </SyntaxHighlighter>
                </pre>
              </Card>
            )}
          </TabsContent>

          {/* AGENTS TAB */}
          <TabsContent value="agents" className="space-y-3">
            <Card className="p-5">
              <h4 className="font-semibold mb-3 flex items-center gap-2"><Cpu className="h-4 w-4" /> All 20 Agent Results</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[600px] overflow-y-auto scrollbar-thin">
                {Object.entries(results).map(([id, r]: [string, any]) => (
                  <div key={id} className="p-3 rounded border border-border/50 bg-muted/20">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium">{r.agentName || id}</span>
                      <Badge variant={r.success ? 'default' : r.status === 'skipped' ? 'secondary' : 'destructive'} className="text-[10px]">
                        {r.status}
                      </Badge>
                    </div>
                    <div className="text-[10px] text-muted-foreground">{r.durationMs}ms</div>
                    {r.error && <div className="text-[10px] text-destructive mt-1">{r.error.slice(0, 100)}</div>}
                    {r.result?.summary && <div className="text-[10px] mt-1">{r.result.summary}</div>}
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </Card>
    </motion.div>
  );
}

// ─── Chart Renderer ──────────────────────────────────────────────────────
function ChartRenderer({ spec }: { spec: any }) {
  if (!spec) return <div className="text-xs text-muted-foreground">No chart spec</div>;

  if (spec.chartType === 'BarChart') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={spec.data} layout={spec.orientation === 'horizontal' ? 'vertical' : 'horizontal'}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
          {spec.orientation === 'horizontal' ? (
            <>
              <XAxis type="number" dataKey={spec.xKey} tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey={spec.yKey} tick={{ fontSize: 10 }} width={80} />
            </>
          ) : (
            <>
              <XAxis dataKey={spec.xKey} tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
            </>
          )}
          <Tooltip contentStyle={{ fontSize: 11 }} />
          <Bar dataKey={spec.yKey === 'count' || spec.yKey === 'value' ? spec.yKey : spec.xKey} fill={spec.color || '#10b981'} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (spec.chartType === 'LineChart') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={spec.data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
          <XAxis dataKey={spec.xKey} tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip contentStyle={{ fontSize: 11 }} />
          <Line type="monotone" dataKey={spec.yKey} stroke={spec.color || '#10b981'} strokeWidth={2} dot={{ r: 2 }} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (spec.chartType === 'ScatterChart') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
          <XAxis type="number" dataKey={spec.xKey} name={spec.xLabel} tick={{ fontSize: 10 }} />
          <YAxis type="number" dataKey={spec.yKey} name={spec.yLabel} tick={{ fontSize: 10 }} />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ fontSize: 11 }} />
          <Scatter data={spec.data} fill={spec.color || '#8b5cf6'} />
        </ScatterChart>
      </ResponsiveContainer>
    );
  }

  if (spec.chartType === 'PieChart') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={spec.data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={{ fontSize: 10 }}>
            {spec.data.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip contentStyle={{ fontSize: 11 }} />
          <Legend wrapperStyle={{ fontSize: 10 }} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (spec.chartType === 'Heatmap') {
    // Render correlation matrix as a colored grid
    const vars = spec.variables || [];
    return (
      <div className="w-full h-full overflow-auto scrollbar-thin">
        <table className="w-full text-[10px]">
          <thead>
            <tr>
              <th></th>
              {vars.map((v: string) => <th key={v} className="px-1 py-1 text-muted-foreground">{v.slice(0, 8)}</th>)}
            </tr>
          </thead>
          <tbody>
            {vars.map((row: string) => (
              <tr key={row}>
                <td className="px-1 py-1 text-muted-foreground font-medium">{row.slice(0, 8)}</td>
                {vars.map((col: string) => {
                  const cell = spec.matrix.find((m: any) => m.row === row && m.col === col);
                  const v = cell?.value ?? 0;
                  const bg = v > 0 ? `rgba(16, 185, 129, ${Math.abs(v)})` : `rgba(239, 68, 68, ${Math.abs(v)})`;
                  return (
                    <td key={col} className="px-1 py-1 text-center" style={{ backgroundColor: bg, color: Math.abs(v) > 0.5 ? 'white' : 'inherit' }}>
                      {v.toFixed(2)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (spec.chartType === 'BoxPlot') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={spec.data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
          <XAxis dataKey={spec.xKey} tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip contentStyle={{ fontSize: 11 }} />
          <Bar dataKey="median" fill={spec.color || '#f59e0b'} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return <div className="text-xs text-muted-foreground">Unsupported chart: {spec.chartType}</div>;
}
