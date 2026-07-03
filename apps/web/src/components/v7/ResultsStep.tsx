'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  FileText, ShieldCheck, AlertTriangle, TrendingUp, GitBranch,
  CircleDot, Lightbulb, Code, Globe2, Sparkles, RotateCcw,
  Download, Eye, Target, Brain, Activity, CheckCircle2, XCircle, Database,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { V7AgentState, V7ExecutionSummary } from '@/hooks/useV7Analysis';

interface ResultsStepProps {
  agentStates: Record<string, V7AgentState>;
  executionSummary: V7ExecutionSummary | null;
  onRestart: () => void;
}

interface TabConfig {
  id: string;
  label: string;
  icon: any;
  agentIds: string[];
}

const TABS: TabConfig[] = [
  { id: 'overview', label: 'Overview', icon: FileText, agentIds: ['orchestrator', 'narrative_composer', 'data_quality_scorer', 'data_ingestion'] },
  { id: 'profile', label: 'Data Profile', icon: Database, agentIds: ['data_profiling', 'schema_inference', 'missing_value_analyzer', 'cardinality_checker', 'duplicate_detector', 'data_quality_scorer'] },
  { id: 'anomalies', label: 'Anomalies', icon: AlertTriangle, agentIds: ['anomaly_ensemble', 'isolation_forest', 'fraud_detection', 'realtime_alert'] },
  { id: 'forecast', label: 'Forecast', icon: TrendingUp, agentIds: ['holt_winters_forecast', 'arima_forecast', 'moving_average_forecast', 'anomaly_forecasting', 'seasonality_detector', 'stationarity_tester'] },
  { id: 'inference', label: 'Inference', icon: GitBranch, agentIds: ['correlation_matrix', 'ols_regression', 'causal_inference', 'feature_importance', 'shap_explainer', 'auto_ml'] },
  { id: 'clusters', label: 'Clusters', icon: CircleDot, agentIds: ['kmeans_cluster', 'dbscan_cluster', 'gaussian_mixture'] },
  { id: 'insights', label: 'Insights', icon: Lightbulb, agentIds: ['insight_generator', 'reflection_agent'] },
  { id: 'code', label: 'Code', icon: Code, agentIds: ['code_generator'] },
  { id: 'africa', label: 'Africa Intel', icon: Globe2, agentIds: ['africa_market_intel'] },
  { id: 'privacy', label: 'Privacy', icon: ShieldCheck, agentIds: ['pii_detection', 'synthetic_data_generator'] },
  { id: 'viz', label: 'Visualizations', icon: Eye, agentIds: ['visualization_agent'] },
  { id: 'knowledge', label: 'Knowledge Graph', icon: Brain, agentIds: ['knowledge_graph'] },
];

export function ResultsStep({ agentStates, executionSummary, onRestart }: ResultsStepProps) {
  const [activeTab, setActiveTab] = useState('overview');

  const successfulAgents = useMemo(() => {
    return Object.values(agentStates).filter(s => s.status === 'success');
  }, [agentStates]);

  const getAgentResult = (id: string): any => {
    return agentStates[id]?.result?.output ?? agentStates[id]?.result;
  };

  const tabBadgeCount = (tab: TabConfig): number => {
    return tab.agentIds.filter(id => agentStates[id]?.status === 'success').length;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Analysis Results</h2>
          <p className="text-sm text-muted-foreground">
            {successfulAgents.length} agents produced results · {(executionSummary?.totalDurationMs / 1000).toFixed(1)}s total
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5">
            <Download className="h-3.5 w-3.5" />
            Export PDF
          </Button>
          <Button variant="outline" size="sm" onClick={onRestart} className="gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" />
            New Analysis
          </Button>
        </div>
      </div>

      {/* Results Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/30 p-1 rounded-lg">
          {TABS.map(tab => {
            const count = tabBadgeCount(tab);
            if (count === 0) return null;
            return (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="text-xs gap-1.5 py-2 px-3 flex-1 min-w-[100px]"
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
                <Badge variant="secondary" className="text-[9px] h-4 px-1 ml-1">{count}</Badge>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-4">
          <OverviewResults getAgentResult={getAgentResult} executionSummary={executionSummary} agentStates={agentStates} />
        </TabsContent>

        {/* Data Profile Tab */}
        <TabsContent value="profile" className="mt-4">
          <ProfileResults getAgentResult={getAgentResult} />
        </TabsContent>

        {/* Anomalies Tab */}
        <TabsContent value="anomalies" className="mt-4">
          <AnomalyResults getAgentResult={getAgentResult} />
        </TabsContent>

        {/* Forecast Tab */}
        <TabsContent value="forecast" className="mt-4">
          <ForecastResults getAgentResult={getAgentResult} />
        </TabsContent>

        {/* Inference Tab */}
        <TabsContent value="inference" className="mt-4">
          <InferenceResults getAgentResult={getAgentResult} />
        </TabsContent>

        {/* Clusters Tab */}
        <TabsContent value="clusters" className="mt-4">
          <ClusterResults getAgentResult={getAgentResult} />
        </TabsContent>

        {/* Insights Tab */}
        <TabsContent value="insights" className="mt-4">
          <InsightResults getAgentResult={getAgentResult} />
        </TabsContent>

        {/* Code Tab */}
        <TabsContent value="code" className="mt-4">
          <CodeResults getAgentResult={getAgentResult} />
        </TabsContent>

        {/* Africa Intel Tab */}
        <TabsContent value="africa" className="mt-4">
          <AfricaResults getAgentResult={getAgentResult} />
        </TabsContent>

        {/* Privacy Tab */}
        <TabsContent value="privacy" className="mt-4">
          <PrivacyResults getAgentResult={getAgentResult} />
        </TabsContent>

        {/* Visualizations Tab */}
        <TabsContent value="viz" className="mt-4">
          <VizResults getAgentResult={getAgentResult} />
        </TabsContent>

        {/* Knowledge Graph Tab */}
        <TabsContent value="knowledge" className="mt-4">
          <KnowledgeGraphResults getAgentResult={getAgentResult} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Result Helper Components ──────────────────────────────────────────

function ResultCard({ title, icon: Icon, children, color = 'text-primary' }: {
  title: string;
  icon: any;
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <Card className="p-5 border-border/30">
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`h-4 w-4 ${color}`} />
        <h4 className="font-semibold text-sm">{title}</h4>
      </div>
      {children}
    </Card>
  );
}

function StatGrid({ stats }: { stats: { label: string; value: string | number; color?: string }[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map(s => (
        <div key={s.label} className="p-3 rounded-lg bg-muted/30 border border-border/30">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{s.label}</p>
          <p className={`text-lg font-bold ${s.color ?? ''}`}>{s.value}</p>
        </div>
      ))}
    </div>
  );
}

function EmptyResult({ message }: { message: string }) {
  return (
    <Card className="p-8 text-center border-border/30">
      <XCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </Card>
  );
}

// ─── Individual Tab Content Components ─────────────────────────────────

function OverviewResults({ getAgentResult, executionSummary, agentStates }: any) {
  const orchestrator = getAgentResult('orchestrator');
  const narrative = getAgentResult('narrative_composer');
  const quality = getAgentResult('data_quality_scorer');
  const ingestion = getAgentResult('data_ingestion');

  if (!orchestrator && !narrative) {
    return <EmptyResult message="Overview results not available" />;
  }

  return (
    <div className="space-y-4">
      {/* Key Stats */}
      <ResultCard title="Key Metrics" icon={Activity}>
        <StatGrid stats={[
          { label: 'Rows Analyzed', value: ingestion?.rowCount ?? '—' },
          { label: 'Columns', value: ingestion?.columnCount ?? '—' },
          { label: 'Quality Score', value: quality ? `${quality.overallScore}/100` : '—', color: 'text-primary' },
          { label: 'Confidence', value: orchestrator?.metadata?.overallConfidence ? `${(orchestrator.metadata.overallConfidence * 100).toFixed(0)}%` : '—' },
        ]} />
      </ResultCard>

      {/* Executive Summary */}
      {narrative?.executiveSummary && (
        <ResultCard title="Executive Summary" icon={FileText}>
          <p className="text-sm leading-relaxed text-foreground/90">{narrative.executiveSummary}</p>
        </ResultCard>
      )}

      {/* Key Findings */}
      {narrative?.keyFindings && narrative.keyFindings.length > 0 && (
        <ResultCard title="Key Findings" icon={Lightbulb} color="text-chart-3">
          <div className="space-y-2">
            {narrative.keyFindings.map((f: any, i: number) => (
              <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-muted/30">
                <div className="h-5 w-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </div>
                <div>
                  <p className="text-sm font-medium">{f.title}</p>
                  <p className="text-xs text-muted-foreground">{f.description}</p>
                </div>
              </div>
            ))}
          </div>
        </ResultCard>
      )}

      {/* Recommendations */}
      {narrative?.recommendations && narrative.recommendations.length > 0 && (
        <ResultCard title="Recommendations" icon={Target} color="text-chart-2">
          <div className="space-y-2">
            {narrative.recommendations.map((r: any, i: number) => (
              <div key={i} className="p-2 rounded-lg border border-border/30">
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
        </ResultCard>
      )}
    </div>
  );
}

function ProfileResults({ getAgentResult }: any) {
  const profile = getAgentResult('data_profiling');
  const missing = getAgentResult('missing_value_analyzer');
  const quality = getAgentResult('data_quality_scorer');
  const duplicates = getAgentResult('duplicate_detector');

  if (!profile) return <EmptyResult message="Data profile not available" />;

  return (
    <div className="space-y-4">
      {quality && (
        <ResultCard title="Quality Score" icon={ShieldCheck}>
          <StatGrid stats={[
            { label: 'Overall Score', value: `${quality.overallScore}/100`, color: 'text-primary' },
            { label: 'Grade', value: quality.grade, color: 'text-primary' },
            { label: 'Completeness', value: `${quality.dimensions.completeness.toFixed(0)}%` },
            { label: 'Uniqueness', value: `${quality.dimensions.uniqueness.toFixed(0)}%` },
          ]} />
        </ResultCard>
      )}

      <ResultCard title="Column Profiles" icon={Database}>
        <div className="space-y-2">
          {Object.entries(profile.profile || {}).map(([col, p]: [string, any]) => (
            <div key={col} className="p-3 rounded-lg border border-border/30">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-sm">{col}</span>
                <Badge variant="outline" className="text-[10px]">{p.type}</Badge>
              </div>
              {p.type === 'numeric' && p.stats ? (
                <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-[10px] text-muted-foreground">
                  <span>Mean: {p.stats.mean.toFixed(2)}</span>
                  <span>Median: {p.stats.median.toFixed(2)}</span>
                  <span>Std: {p.stats.stdev.toFixed(2)}</span>
                  <span>Min: {p.stats.min.toFixed(2)}</span>
                  <span>Max: {p.stats.max.toFixed(2)}</span>
                  <span>IQR: {p.stats.iqr.toFixed(2)}</span>
                </div>
              ) : p.topValues ? (
                <div className="flex flex-wrap gap-1 mt-1">
                  {p.topValues.slice(0, 5).map(([val, count]: [any, any]) => (
                    <span key={val} className="text-[10px] px-1.5 py-0.5 rounded bg-muted">
                      {String(val)} ({count})
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </ResultCard>

      {missing && (
        <ResultCard title="Missing Values" icon={AlertTriangle} color="text-chart-5">
          <StatGrid stats={[
            { label: 'Missing Rate', value: `${missing.overallMissingRate.toFixed(1)}%` },
            { label: 'Total Missing', value: missing.totalMissing },
            { label: 'Affected Columns', value: Object.values(missing.missingByColumn).filter((v: any) => v.count > 0).length },
            { label: 'High Missing', value: missing.columnsWithHighMissing.length },
          ]} />
        </ResultCard>
      )}
    </div>
  );
}

function AnomalyResults({ getAgentResult }: any) {
  const ensemble = getAgentResult('anomaly_ensemble');
  const isolation = getAgentResult('isolation_forest');
  const fraud = getAgentResult('fraud_detection');

  if (!ensemble && !isolation && !fraud) {
    return <EmptyResult message="Anomaly detection results not available" />;
  }

  return (
    <div className="space-y-4">
      {ensemble && (
        <ResultCard title="Anomaly Ensemble (Z-Score + IQR + EWMA)" icon={AlertTriangle} color="text-destructive">
          <StatGrid stats={[
            { label: 'Total Anomalies', value: ensemble.totalAnomalies, color: 'text-destructive' },
            { label: 'Anomaly Rate', value: `${(ensemble.anomalyRate * 100).toFixed(2)}%` },
            { label: 'Critical', value: ensemble.bySeverity?.critical ?? 0, color: 'text-destructive' },
            { label: 'Warning', value: ensemble.bySeverity?.warning ?? 0, color: 'text-chart-3' },
          ]} />
          {ensemble.anomalies && ensemble.anomalies.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium mb-2">Top Anomalies:</p>
              <div className="space-y-1 max-h-48 overflow-y-auto scrollbar-thin">
                {ensemble.anomalies.slice(0, 10).map((a: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 text-xs">
                    <Badge variant={a.severity === 'critical' ? 'destructive' : 'secondary'} className="text-[9px]">
                      {a.severity}
                    </Badge>
                    <span className="font-mono">{a.column}</span>
                    <span>row {a.rowIndex}</span>
                    <span className="font-bold">{a.value.toFixed(2)}</span>
                    <span className="text-muted-foreground">z={a.zScore.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ResultCard>
      )}

      {fraud && fraud.totalFlagged > 0 && (
        <ResultCard title="Fraud Detection" icon={AlertTriangle} color="text-destructive">
          <StatGrid stats={[
            { label: 'Flagged', value: fraud.totalFlagged, color: 'text-destructive' },
            { label: 'Fraud Rate', value: `${(fraud.fraudRate * 100).toFixed(2)}%` },
          ]} />
        </ResultCard>
      )}
    </div>
  );
}

function ForecastResults({ getAgentResult }: any) {
  const holtWinters = getAgentResult('holt_winters_forecast');
  const arima = getAgentResult('arima_forecast');
  const seasonality = getAgentResult('seasonality_detector');

  if (!holtWinters && !arima) {
    return <EmptyResult message="Forecast results not available" />;
  }

  return (
    <div className="space-y-4">
      {holtWinters && (
        <ResultCard title="Holt-Winters Forecast" icon={TrendingUp} color="text-chart-4">
          <StatGrid stats={[
            { label: 'Method', value: holtWinters.method?.split(' ')[0] ?? 'HW' },
            { label: 'Accuracy', value: `${holtWinters.accuracy?.toFixed(1)}%`, color: 'text-primary' },
            { label: 'RMSE', value: holtWinters.rmse?.toFixed(2) ?? '—' },
            { label: 'MAPE', value: `${holtWinters.mape?.toFixed(1)}%` },
          ]} />
          {holtWinters.forecast && (
            <div className="mt-3">
              <p className="text-xs font-medium mb-2">Forecast ({holtWinters.forecast.length} periods):</p>
              <div className="space-y-1">
                {holtWinters.forecast.map((f: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 text-xs">
                    <span className="font-medium w-16">Step {f.step}</span>
                    <span className="font-bold text-primary">{f.value.toFixed(2)}</span>
                    <span className="text-muted-foreground">
                      [{f.lower.toFixed(2)}, {f.upper.toFixed(2)}]
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ResultCard>
      )}

      {seasonality && (
        <ResultCard title="Seasonality Analysis" icon={Activity}>
          <StatGrid stats={[
            { label: 'Seasonal', value: seasonality.isSeasonal ? 'Yes' : 'No' },
            { label: 'Period', value: seasonality.dominantPeriod ?? '—' },
          ]} />
        </ResultCard>
      )}
    </div>
  );
}

function InferenceResults({ getAgentResult }: any) {
  const correlation = getAgentResult('correlation_matrix');
  const causal = getAgentResult('causal_inference');
  const ols = getAgentResult('ols_regression');
  const featureImp = getAgentResult('feature_importance');

  if (!correlation && !causal && !ols) {
    return <EmptyResult message="Inference results not available" />;
  }

  return (
    <div className="space-y-4">
      {ols && (
        <ResultCard title="Linear Regression (OLS)" icon={TrendingUp}>
          <StatGrid stats={[
            { label: 'R²', value: ols.rSquared?.toFixed(3) ?? '—', color: 'text-primary' },
            { label: 'Target', value: ols.targetColumn ?? '—' },
            { label: 'Features', value: ols.featureColumns?.length ?? 0 },
            { label: 'Fit', value: ols.interpretation ?? '—' },
          ]} />
        </ResultCard>
      )}

      {correlation && correlation.strongCorrelations?.length > 0 && (
        <ResultCard title="Correlation Matrix" icon={GitBranch} color="text-chart-2">
          <p className="text-xs text-muted-foreground mb-2">{correlation.strongCorrelations.length} significant correlations found</p>
          <div className="space-y-1">
            {correlation.strongCorrelations.slice(0, 10).map((c: any, i: number) => (
              <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 text-xs">
                <span className="font-medium">{c.col1}</span>
                <span className="text-muted-foreground">↔</span>
                <span className="font-medium">{c.col2}</span>
                <Badge variant="outline" className={`text-[10px] ${c.correlation > 0 ? 'text-primary' : 'text-destructive'}`}>
                  r={c.correlation.toFixed(3)}
                </Badge>
                <Badge variant="secondary" className="text-[9px]">{c.strength}</Badge>
              </div>
            ))}
          </div>
        </ResultCard>
      )}

      {causal && causal.relationships?.length > 0 && (
        <ResultCard title="Causal Relationships" icon={GitBranch} color="text-chart-5">
          <div className="space-y-1">
            {causal.relationships.slice(0, 8).map((r: any, i: number) => (
              <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 text-xs">
                <span className="font-medium">{r.cause}</span>
                <span className="text-muted-foreground">→</span>
                <span className="font-medium">{r.effect}</span>
                {r.isCausal && <Badge className="text-[9px] bg-primary">CAUSAL</Badge>}
                <span className="text-muted-foreground ml-auto">conf: {(r.confidence * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </ResultCard>
      )}

      {featureImp && featureImp.importance?.length > 0 && (
        <ResultCard title="Feature Importance" icon={Target}>
          <div className="space-y-1">
            {featureImp.importance.slice(0, 8).map((f: any, i: number) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="font-medium w-32 truncate">{f.feature}</span>
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${Math.max(Math.abs(f.importance) * 100, 5)}%` }}
                  />
                </div>
                <span className="font-mono w-12 text-right">{f.importance.toFixed(3)}</span>
              </div>
            ))}
          </div>
        </ResultCard>
      )}
    </div>
  );
}

function ClusterResults({ getAgentResult }: any) {
  const kmeans = getAgentResult('kmeans_cluster');
  const dbscan = getAgentResult('dbscan_cluster');

  if (!kmeans && !dbscan) {
    return <EmptyResult message="Clustering results not available" />;
  }

  return (
    <div className="space-y-4">
      {kmeans && (
        <ResultCard title="K-Means Clustering" icon={CircleDot} color="text-chart-2">
          <StatGrid stats={[
            { label: 'Best K', value: kmeans.bestK ?? '—', color: 'text-primary' },
            { label: 'Silhouette', value: kmeans.silhouette?.toFixed(3) ?? '—' },
            { label: 'Inertia', value: kmeans.inertia?.toFixed(0) ?? '—' },
            { label: 'Iterations', value: '—' },
          ]} />
          {kmeans.clusterSizes && (
            <div className="mt-3 flex gap-2">
              {kmeans.clusterSizes.map((size: number, i: number) => (
                <div key={i} className="flex-1 p-2 rounded-lg bg-muted/30 text-center">
                  <p className="text-[10px] text-muted-foreground">Cluster {i}</p>
                  <p className="font-bold">{size}</p>
                </div>
              ))}
            </div>
          )}
        </ResultCard>
      )}
    </div>
  );
}

function InsightResults({ getAgentResult }: any) {
  const insights = getAgentResult('insight_generator');
  const reflection = getAgentResult('reflection_agent');

  if (!insights) return <EmptyResult message="Insights not available" />;

  return (
    <div className="space-y-4">
      <ResultCard title="Generated Insights" icon={Lightbulb} color="text-chart-3">
        <div className="space-y-2">
          {insights.insights?.map((insight: any, i: number) => (
            <div key={i} className="p-3 rounded-lg bg-muted/30 border border-border/30">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium">{insight.title}</p>
                <div className="flex gap-1">
                  <Badge variant={insight.impact === 'high' ? 'destructive' : 'secondary'} className="text-[9px]">
                    {insight.impact}
                  </Badge>
                  <Badge variant="outline" className="text-[9px]">
                    {(insight.confidence * 100).toFixed(0)}%
                  </Badge>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{insight.description}</p>
              <Badge variant="secondary" className="text-[9px] mt-1">{insight.category}</Badge>
            </div>
          ))}
        </div>
      </ResultCard>

      {reflection && (
        <ResultCard title="Quality Review" icon={Sparkles}>
          <StatGrid stats={[
            { label: 'Quality Score', value: reflection.qualityScore?.toFixed(0) ?? '—', color: 'text-primary' },
            { label: 'Issues Found', value: reflection.totalIssues ?? 0 },
            { label: 'Success Rate', value: `${(reflection.agentSuccessRate * 100).toFixed(0)}%` },
          ]} />
        </ResultCard>
      )}
    </div>
  );
}

function CodeResults({ getAgentResult }: any) {
  const code = getAgentResult('code_generator');
  const [lang, setLang] = useState('python');

  if (!code) return <EmptyResult message="Code generation not available" />;

  return (
    <div className="space-y-4">
      <ResultCard title="Generated Code" icon={Code}>
        <div className="flex gap-1 mb-3">
          {['python', 'sql', 'javascript'].map(l => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                lang === l ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70'
              }`}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
        <pre className="p-4 rounded-lg bg-muted/50 border border-border/30 text-xs overflow-x-auto scrollbar-thin max-h-96 overflow-y-auto">
          <code>{code[lang]}</code>
        </pre>
      </ResultCard>
    </div>
  );
}

function AfricaResults({ getAgentResult }: any) {
  const africa = getAgentResult('africa_market_intel');
  if (!africa) return <EmptyResult message="Africa market intelligence not available" />;

  return (
    <div className="space-y-4">
      <ResultCard title="Africa Market Intelligence" icon={Globe2} color="text-primary">
        <div className="space-y-3">
          {africa.insights && Object.entries(africa.insights).map(([key, val]: [string, any]) => (
            <div key={key} className="p-3 rounded-lg bg-muted/30 border border-border/30">
              <div className="flex items-center gap-2 mb-1">
                <Globe2 className="h-3.5 w-3.5 text-primary" />
                <span className="font-medium text-sm capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                {val.detected && <Badge className="text-[9px] bg-primary">Detected</Badge>}
              </div>
              {val.analysis && <p className="text-xs text-muted-foreground">{val.analysis}</p>}
              {val.interpretation && <p className="text-xs text-muted-foreground">{val.interpretation}</p>}
              {val.columns && <p className="text-[10px] text-muted-foreground mt-1">Columns: {val.columns.join(', ')}</p>}
            </div>
          ))}
        </div>
      </ResultCard>
    </div>
  );
}

function PrivacyResults({ getAgentResult }: any) {
  const pii = getAgentResult('pii_detection');
  const synthetic = getAgentResult('synthetic_data_generator');

  if (!pii && !synthetic) return <EmptyResult message="Privacy analysis not available" />;

  return (
    <div className="space-y-4">
      {pii && (
        <ResultCard title="PII Detection" icon={ShieldCheck} color={pii.riskLevel === 'high' ? 'text-destructive' : 'text-primary'}>
          <StatGrid stats={[
            { label: 'Risk Score', value: `${pii.riskScore}/100`, color: pii.riskLevel === 'high' ? 'text-destructive' : 'text-primary' },
            { label: 'Risk Level', value: pii.riskLevel, color: pii.riskLevel === 'high' ? 'text-destructive' : 'text-primary' },
            { label: 'PII Columns', value: Object.keys(pii.detected || {}).length },
            { label: 'GDPR', value: pii.compliance?.gdpr ?? '—' },
          ]} />
          {pii.detected && Object.keys(pii.detected).length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium mb-2">Detected PII:</p>
              <div className="space-y-1">
                {Object.entries(pii.detected).map(([col, types]: [string, any]) => (
                  <div key={col} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 text-xs">
                    <span className="font-medium">{col}</span>
                    {types.map((t: string) => (
                      <Badge key={t} variant="destructive" className="text-[9px]">{t}</Badge>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </ResultCard>
      )}

      {synthetic && (
        <ResultCard title="Synthetic Data" icon={Sparkles}>
          <StatGrid stats={[
            { label: 'Similarity', value: `${(synthetic.similarityScore * 100).toFixed(0)}%`, color: 'text-primary' },
            { label: 'Rows Generated', value: synthetic.totalRows },
          ]} />
        </ResultCard>
      )}
    </div>
  );
}

function VizResults({ getAgentResult }: any) {
  const viz = getAgentResult('visualization_agent');
  if (!viz?.visualizations) return <EmptyResult message="Visualizations not available" />;

  return (
    <div className="space-y-4">
      {viz.visualizations.map((v: any, i: number) => (
        <ResultCard key={i} title={v.title} icon={Eye}>
          <p className="text-xs text-muted-foreground mb-2">Type: {v.type} · {v.data?.length ?? 0} data points</p>
          <div className="p-3 rounded-lg bg-muted/30 border border-border/30 max-h-64 overflow-y-auto scrollbar-thin">
            <pre className="text-[10px] font-mono">{JSON.stringify(v.data?.slice(0, 5), null, 2)}</pre>
          </div>
        </ResultCard>
      ))}
    </div>
  );
}

function KnowledgeGraphResults({ getAgentResult }: any) {
  const kg = getAgentResult('knowledge_graph');
  if (!kg) return <EmptyResult message="Knowledge graph not available" />;

  return (
    <div className="space-y-4">
      <ResultCard title="Knowledge Graph" icon={Brain} color="text-chart-2">
        <StatGrid stats={[
          { label: 'Nodes', value: kg.totalNodes ?? 0, color: 'text-primary' },
          { label: 'Edges', value: kg.totalEdges ?? 0 },
          { label: 'Hub Nodes', value: kg.hubNodes?.length ?? 0 },
        ]} />
        {kg.hubNodes && kg.hubNodes.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-medium mb-2">Hub Nodes (by degree centrality):</p>
            <div className="space-y-1">
              {kg.hubNodes.map((n: any, i: number) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 text-xs">
                  <span className="font-medium">{n.node}</span>
                  <Badge variant="secondary" className="text-[10px]">degree: {n.degree}</Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </ResultCard>
    </div>
  );
}
