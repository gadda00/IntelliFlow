'use client';

import { motion } from 'framer-motion';
import { CheckCircle2, Loader2, XCircle, Clock, MinusCircle } from 'lucide-react';

const STAGES: { stage: number; agents: { id: string; name: string }[] }[] = [
  {
    stage: 0,
    agents: [
      { id: 'data_scout', name: 'Data Scout' },
      { id: 'data_quality_guardian', name: 'Quality Guardian' },
      { id: 'privacy_guardian', name: 'Privacy Guardian' },
      { id: 'nlq_interpreter', name: 'NLQ Interpreter' },
    ],
  },
  {
    stage: 1,
    agents: [{ id: 'data_engineer', name: 'Data Engineer' }],
  },
  {
    stage: 2,
    agents: [
      { id: 'analysis_strategist', name: 'Strategist' },
      { id: 'anomaly_sentinel', name: 'Anomaly Sentinel' },
      { id: 'forecasting_oracle', name: 'Forecast Oracle' },
      { id: 'causal_architect', name: 'Causal Architect' },
      { id: 'knowledge_graph_builder', name: 'KG Builder' },
      { id: 'benchmark_agent', name: 'Benchmark' },
      { id: 'auto_ml_agent', name: 'Auto-ML' },
      { id: 'nlp_sentiment_analyst', name: 'NLP Sentiment' },
      { id: 'graph_neural_network', name: 'Graph NN' },
    ],
  },
  {
    stage: 3,
    agents: [
      { id: 'insight_generator', name: 'Insight Gen' },
      { id: 'explainability_agent', name: 'Explainability' },
      { id: 'visualization_specialist', name: 'Viz Specialist' },
      { id: 'synthetic_data_generator', name: 'Synthetic Gen' },
      { id: 'code_generator', name: 'Code Gen' },
      { id: 'anomaly_forecasting', name: 'Anomaly Forecast' },
    ],
  },
  {
    stage: 4,
    agents: [
      { id: 'narrative_composer', name: 'Narrative Composer' },
      { id: 'conversational_analyst', name: 'Conversational' },
    ],
  },
  {
    stage: 5,
    agents: [
      { id: 'reflection_agent', name: 'Reflection' },
      { id: 'africa_market_intel', name: 'Africa Intel' },
      { id: 'realtime_alert', name: 'Alert Agent' },
    ],
  },
  {
    stage: 6,
    agents: [{ id: 'orchestrator', name: 'Orchestrator' }],
  },
];

const STAGE_LABELS = ['Intake', 'Engineering', 'Deep Analytics', 'Synthesis', 'Reporting', 'Reflection & Intel', 'Compilation'];
const STAGE_COLORS = ['text-chart-3', 'text-primary', 'text-chart-2', 'text-chart-4', 'text-chart-5', 'text-accent-foreground', 'text-primary'];

interface Props {
  agentStatuses: Record<string, 'pending' | 'running' | 'completed' | 'failed' | 'skipped'>;
}

export function AgentDAGVisualizer({ agentStatuses }: Props) {
  const getStageStatus = (stageIdx: number) => {
    const agents = STAGES[stageIdx].agents;
    const completed = agents.filter(a => agentStatuses[a.id] === 'completed').length;
    const running = agents.some(a => agentStatuses[a.id] === 'running');
    const failed = agents.some(a => agentStatuses[a.id] === 'failed');
    if (completed === agents.length) return 'completed';
    if (running) return 'running';
    if (failed) return 'failed';
    if (completed > 0) return 'partial';
    return 'pending';
  };

  return (
    <div className="space-y-2 py-2">
      {STAGES.map((stage, idx) => {
        const stageStatus = getStageStatus(idx);
        const isLast = idx === STAGES.length - 1;
        return (
          <div key={stage.stage} className="relative">
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center pt-1.5">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all duration-300 ${
                  stageStatus === 'completed' ? 'bg-primary/20 border-primary text-primary' :
                  stageStatus === 'running' ? 'bg-primary/10 border-primary text-primary ring-pulse' :
                  stageStatus === 'failed' ? 'bg-destructive/10 border-destructive text-destructive' :
                  stageStatus === 'partial' ? 'bg-primary/10 border-primary/50 text-primary' :
                  'bg-muted border-border text-muted-foreground'
                }`}>
                  {stageStatus === 'running' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : idx}
                </div>
                {!isLast && (
                  <div className={`w-0.5 h-full min-h-[16px] my-1 rounded-full transition-colors ${
                    stageStatus === 'completed' ? 'bg-primary/40' :
                    stageStatus === 'running' ? 'bg-primary/20 pipeline-line-animated' :
                    'bg-border'
                  }`} />
                )}
              </div>

              <div className="flex-1 pb-2">
                <div className={`text-[10px] uppercase tracking-wider mb-1.5 font-semibold flex items-center gap-2 ${STAGE_COLORS[idx]}`}>
                  <span>Stage {stage.stage}</span>
                  <span className="text-muted-foreground font-normal">·</span>
                  <span className="font-normal">{STAGE_LABELS[idx]}</span>
                  {stageStatus === 'completed' && <CheckCircle2 className="h-3 w-3 text-primary" />}
                  {stageStatus === 'running' && <span className="flex h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {stage.agents.map(agent => (
                    <AgentChip key={agent.id} name={agent.name} status={agentStatuses[agent.id] ?? 'pending'} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AgentChip({ name, status }: { name: string; status: string }) {
  const icon = {
    pending: <Clock className="h-3 w-3" />,
    running: <Loader2 className="h-3 w-3 animate-spin" />,
    completed: <CheckCircle2 className="h-3 w-3" />,
    failed: <XCircle className="h-3 w-3" />,
    skipped: <MinusCircle className="h-3 w-3" />,
  }[status] ?? <Clock className="h-3 w-3" />;

  const color = {
    pending: 'bg-muted/30 text-muted-foreground/70 border-border/50',
    running: 'bg-primary/10 text-primary border-primary/40 ring-1 ring-primary/20',
    completed: 'bg-primary/15 text-primary border-primary/50',
    failed: 'bg-destructive/10 text-destructive border-destructive/40',
    skipped: 'bg-muted/20 text-muted-foreground/50 border-border/30',
  }[status] ?? 'bg-muted text-muted-foreground';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] font-medium transition-all duration-300 ${color}`}
      title={`${name}: ${status}`}
    >
      {icon}
      <span className="truncate max-w-[100px]">{name}</span>
    </motion.div>
  );
}
