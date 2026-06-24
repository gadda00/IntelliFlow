'use client';

import { motion } from 'framer-motion';
import { CheckCircle2, Loader2, XCircle, Clock, MinusCircle } from 'lucide-react';

// Same DAG structure as the server
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
      { id: 'conversational_analyst', name: 'Conversational Analyst' },
    ],
  },
  {
    stage: 5,
    agents: [{ id: 'orchestrator', name: 'Orchestrator' }],
  },
];

const STAGE_LABELS = ['Intake', 'Engineering', 'Deep Analytics', 'Synthesis', 'Reporting', 'Compilation'];

interface Props {
  agentStatuses: Record<string, 'pending' | 'running' | 'completed' | 'failed' | 'skipped'>;
}

export function AgentDAGVisualizer({ agentStatuses }: Props) {
  return (
    <div className="space-y-3 py-2">
      {STAGES.map((stage, idx) => (
        <div key={stage.stage} className="flex items-start gap-3">
          <div className="flex flex-col items-center pt-2">
            <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-semibold border border-border">
              {idx}
            </div>
            {idx < STAGES.length - 1 && <div className="w-px h-full bg-border flex-1 min-h-[20px]" />}
          </div>
          <div className="flex-1 pb-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 font-medium">
              Stage {stage.stage} · {STAGE_LABELS[idx]}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-1.5">
              {stage.agents.map(agent => {
                const status = agentStatuses[agent.id] ?? 'pending';
                return <AgentChip key={agent.id} name={agent.name} status={status} />;
              })}
            </div>
          </div>
        </div>
      ))}
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
    pending: 'bg-muted/40 text-muted-foreground border-border',
    running: 'bg-primary/10 text-primary border-primary/40',
    completed: 'bg-primary/15 text-primary border-primary/50',
    failed: 'bg-destructive/10 text-destructive border-destructive/40',
    skipped: 'bg-muted/20 text-muted-foreground/60 border-border/50',
  }[status] ?? 'bg-muted text-muted-foreground';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] font-medium ${color}`}
      title={`${name}: ${status}`}
    >
      {icon}
      <span className="truncate">{name}</span>
    </motion.div>
  );
}
