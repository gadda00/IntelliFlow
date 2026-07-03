'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import * as LucideIcons from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api, AgentInfo } from '@/lib/api-client';
import { Search, X, ChevronRight, Layers, Activity, Zap } from 'lucide-react';
import { AgentDAGVisualizer } from './AgentDAGVisualizer';

const TIER_LABELS = {
  core: { label: 'Core', color: 'bg-primary/10 text-primary border-primary/30' },
  advanced: { label: 'Advanced', color: 'bg-chart-2/10 text-chart-2 border-chart-2/30' },
  specialized: { label: 'NEW', color: 'bg-chart-5/10 text-chart-5 border-chart-5/30' },
};

const STAGE_MAP: Record<string, { stage: number; name: string }> = {
  data_scout: { stage: 0, name: 'Intake' },
  data_quality_guardian: { stage: 0, name: 'Intake' },
  nlq_interpreter: { stage: 0, name: 'Intake' },
  privacy_guardian: { stage: 0, name: 'Intake' },
  data_engineer: { stage: 1, name: 'Engineering' },
  analysis_strategist: { stage: 2, name: 'Deep Analytics' },
  anomaly_sentinel: { stage: 2, name: 'Deep Analytics' },
  forecasting_oracle: { stage: 2, name: 'Deep Analytics' },
  causal_architect: { stage: 2, name: 'Deep Analytics' },
  knowledge_graph_builder: { stage: 2, name: 'Deep Analytics' },
  benchmark_agent: { stage: 2, name: 'Deep Analytics' },
  auto_ml_agent: { stage: 2, name: 'Deep Analytics' },
  nlp_sentiment_analyst: { stage: 2, name: 'Deep Analytics' },
  graph_neural_network: { stage: 2, name: 'Deep Analytics' },
  insight_generator: { stage: 3, name: 'Synthesis' },
  explainability_agent: { stage: 3, name: 'Synthesis' },
  visualization_specialist: { stage: 3, name: 'Synthesis' },
  synthetic_data_generator: { stage: 3, name: 'Synthesis' },
  code_generator: { stage: 3, name: 'Synthesis' },
  anomaly_forecasting: { stage: 3, name: 'Synthesis' },
  narrative_composer: { stage: 4, name: 'Reporting' },
  conversational_analyst: { stage: 4, name: 'Reporting' },
  reflection_agent: { stage: 5, name: 'Reflection & Intel' },
  africa_market_intel: { stage: 5, name: 'Reflection & Intel' },
  realtime_alert: { stage: 5, name: 'Reflection & Intel' },
  orchestrator: { stage: 6, name: 'Compilation' },
};

const STAGE_COLORS: Record<string, string> = {
  'Intake': 'text-chart-3',
  'Engineering': 'text-primary',
  'Deep Analytics': 'text-chart-2',
  'Synthesis': 'text-chart-4',
  'Reporting': 'text-chart-5',
  'Reflection & Intel': 'text-accent-foreground',
  'Compilation': 'text-primary',
};

export function AgentGallery() {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'core' | 'advanced' | 'specialized'>('all');
  const [search, setSearch] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<AgentInfo | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'dag'>('grid');

  useEffect(() => {
    api.getAgents().then(data => {
      setAgents(data.agents);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const filtered = agents
    .filter(a => filter === 'all' || a.tier === filter)
    .filter(a =>
      !search ||
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.role.toLowerCase().includes(search.toLowerCase()) ||
      a.description.toLowerCase().includes(search.toLowerCase()) ||
      a.capabilities.some(c => c.toLowerCase().includes(search.toLowerCase()))
    );

  return (
    <section id="agents" className="py-24 relative">
      <div className="absolute inset-0 dot-bg opacity-30" />
      <div className="container mx-auto px-4 relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-2xl mx-auto text-center mb-12"
        >
          <Badge variant="secondary" className="mb-3 border border-primary/20 bg-primary/5">
            <Layers className="h-3 w-3 mr-1 text-primary" />
            The Agent Pool
          </Badge>
          <h2 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
            26 specialists.<br />
            <span className="gradient-text-hero">One orchestrated pipeline.</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            Each agent is a TypeScript class with its own tools, dependencies, and circuit breaker.
            The DAG executor runs them in topological order with 7 parallel stages.
          </p>
        </motion.div>

        <div className="max-w-6xl mx-auto mb-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex gap-2 flex-wrap">
              {(['all', 'core', 'advanced', 'specialized'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setFilter(t)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                    filter === t
                      ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {t === 'all' ? 'All Agents' : t === 'specialized' ? `NEW (${agents.filter(a => a.tier === t).length})` : `${t.charAt(0).toUpperCase() + t.slice(1)} (${agents.filter(a => a.tier === t).length})`}
                </button>
              ))}
            </div>

            <div className="flex gap-2 items-center w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search agents..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9 text-sm"
                />
              </div>
              <div className="flex rounded-lg border border-border/50 overflow-hidden">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  Grid
                </button>
                <button
                  onClick={() => setViewMode('dag')}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    viewMode === 'dag' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  DAG
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto">
          {viewMode === 'dag' ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card className="p-6 border-border/30">
                <div className="flex items-center gap-2 mb-4">
                  <Activity className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">Agent Pipeline DAG</h3>
                  <Badge variant="secondary" className="text-[10px]">7 stages · 26 agents</Badge>
                </div>
                <AgentDAGVisualizer agentStatuses={
                  Object.fromEntries(agents.map(a => [a.id, 'completed']))
                } />
              </Card>
            </motion.div>
          ) : (
            loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="h-48 rounded-xl bg-muted animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filtered.map((agent, i) => {
                  const Icon = (LucideIcons as any)[agent.icon] ?? LucideIcons.Bot;
                  const stageInfo = STAGE_MAP[agent.id];
                  return (
                    <motion.div
                      key={agent.id}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.03, duration: 0.4 }}
                    >
                      <Card
                        className="agent-card-glow p-5 h-full hover:shadow-xl transition-all cursor-pointer group relative overflow-hidden"
                        style={{ '--agent-color': agent.color } as any}
                        onClick={() => setSelectedAgent(agent)}
                      >
                        <div
                          className="absolute -top-12 -right-12 h-32 w-32 rounded-full opacity-10 blur-2xl group-hover:opacity-20 transition-opacity"
                          style={{ backgroundColor: agent.color }}
                        />
                        <div className="flex items-start justify-between mb-3">
                          <div
                            className="h-10 w-10 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform"
                            style={{ backgroundColor: `${agent.color}20`, color: agent.color }}
                          >
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="flex items-center gap-1.5">
                            {stageInfo && (
                              <Badge variant="outline" className={`text-[9px] uppercase tracking-wide ${STAGE_COLORS[stageInfo.name] || ''}`}>
                                S{stageInfo.stage}
                              </Badge>
                            )}
                            <Badge variant="outline" className={`text-[10px] uppercase tracking-wide ${TIER_LABELS[agent.tier].color}`}>
                              {TIER_LABELS[agent.tier].label}
                            </Badge>
                          </div>
                        </div>
                        <h3 className="font-semibold text-base mb-1 group-hover:text-primary transition-colors">{agent.name}</h3>
                        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{agent.role}</p>
                        <p className="text-xs text-foreground/70 line-clamp-3 mb-3">{agent.description}</p>
                        <div className="flex items-center justify-between">
                          <div className="flex flex-wrap gap-1">
                            {agent.capabilities.slice(0, 2).map(cap => (
                              <span key={cap} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                {cap.replace(/_/g, ' ')}
                              </span>
                            ))}
                            {agent.capabilities.length > 2 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                +{agent.capabilities.length - 2}
                              </span>
                            )}
                          </div>
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                        </div>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            )
          )}

          {viewMode === 'grid' && filtered.length === 0 && !loading && (
            <div className="text-center py-16">
              <Search className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-muted-foreground">No agents match your search.</p>
              <button onClick={() => { setSearch(''); setFilter('all'); }} className="text-primary hover:underline text-sm mt-1">
                Clear filters
              </button>
            </div>
          )}
        </div>

        <AnimatePresence>
          {selectedAgent && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
              onClick={() => setSelectedAgent(null)}
            >
              <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-lg"
              >
                <AgentDetailPanel agent={selectedAgent} onClose={() => setSelectedAgent(null)} />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}

function AgentDetailPanel({ agent, onClose }: { agent: AgentInfo; onClose: () => void }) {
  const Icon = (LucideIcons as any)[agent.icon] ?? LucideIcons.Bot;
  const stageInfo = STAGE_MAP[agent.id];

  return (
    <Card className="p-6 relative overflow-hidden">
      <div className="absolute -top-16 -right-16 h-32 w-32 rounded-full blur-3xl opacity-20" style={{ backgroundColor: agent.color }} />

      <div className="relative">
        <button onClick={onClose} className="absolute top-0 right-0 text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-4 mb-4">
          <div
            className="h-14 w-14 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${agent.color}20`, color: agent.color }}
          >
            <Icon className="h-7 w-7" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-bold">{agent.name}</h3>
              <Badge variant="outline" className={`text-[10px] uppercase ${TIER_LABELS[agent.tier].color}`}>
                {TIER_LABELS[agent.tier].label}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{agent.role}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Description</h4>
            <p className="text-sm leading-relaxed">{agent.description}</p>
          </div>

          {stageInfo && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Pipeline Position</h4>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className={`${STAGE_COLORS[stageInfo.name] || ''}`}>
                  Stage {stageInfo.stage} · {stageInfo.name}
                </Badge>
                <span className="text-xs text-muted-foreground">Runs in parallel with other stage {stageInfo.stage} agents</span>
              </div>
            </div>
          )}

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Capabilities</h4>
            <div className="flex flex-wrap gap-1.5">
              {agent.capabilities.map(cap => (
                <span key={cap} className="text-xs px-2.5 py-1 rounded-full bg-muted border border-border/50">
                  {cap.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-border/50">
            <Button size="sm" className="w-full gap-2" onClick={() => {
              document.getElementById('analyze')?.scrollIntoView({ behavior: 'smooth' });
              onClose();
            }}>
              <Zap className="h-3.5 w-3.5" />
              Run Analysis with This Agent
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
