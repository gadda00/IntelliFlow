'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, Wand2, Save, Play, RotateCcw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AgentInfo, api } from '@/lib/api-client';

interface Props {
  open: boolean;
  onClose: () => void;
  onApply: (selectedAgentIds: string[]) => void;
}

const PRESETS: { name: string; description: string; agents: string[]; icon: string }[] = [
  {
    name: 'Full Pipeline',
    description: 'All 23 agents — complete analysis',
    agents: [], // empty = all agents
    icon: 'Sparkles',
  },
  {
    name: 'Forecast Focus',
    description: 'Time series forecasting + anomaly prediction',
    agents: ['data_scout', 'data_quality_guardian', 'data_engineer', 'forecasting_oracle', 'anomaly_sentinel', 'anomaly_forecasting', 'visualization_specialist', 'narrative_composer'],
    icon: 'TrendingUp',
  },
  {
    name: 'Privacy Audit',
    description: 'PII detection + synthetic data generation',
    agents: ['data_scout', 'privacy_guardian', 'data_quality_guardian', 'synthetic_data_generator', 'code_generator', 'narrative_composer'],
    icon: 'Shield',
  },
  {
    name: 'NLP & Sentiment',
    description: 'Text analysis + sentiment + topic modeling',
    agents: ['data_scout', 'data_engineer', 'nlp_sentiment_analyst', 'insight_generator', 'visualization_specialist', 'narrative_composer'],
    icon: 'MessageSquareText',
  },
  {
    name: 'Causal Deep Dive',
    description: 'Causal inference + explainability + benchmarks',
    agents: ['data_scout', 'data_engineer', 'analysis_strategist', 'causal_architect', 'explainability_agent', 'benchmark_agent', 'insight_generator', 'narrative_composer'],
    icon: 'GitBranch',
  },
  {
    name: 'Graph Analysis',
    description: 'Knowledge graph + GNN embeddings + link prediction',
    agents: ['data_scout', 'data_engineer', 'knowledge_graph_builder', 'graph_neural_network', 'visualization_specialist', 'narrative_composer'],
    icon: 'Network',
  },
  {
    name: 'Quick Insights',
    description: 'Fast path — just the essentials',
    agents: ['data_scout', 'data_quality_guardian', 'insight_generator', 'narrative_composer'],
    icon: 'Zap',
  },
  {
    name: 'ML Engineering',
    description: 'Auto-ML + code generation + synthetic data',
    agents: ['data_scout', 'data_engineer', 'auto_ml_agent', 'explainability_agent', 'code_generator', 'synthetic_data_generator', 'narrative_composer'],
    icon: 'Cpu',
  },
];

const TIER_LABELS = {
  core: { label: 'Core', color: 'bg-primary/10 text-primary border-primary/30' },
  advanced: { label: 'Advanced', color: 'bg-chart-2/10 text-chart-2 border-chart-2/30' },
  specialized: { label: 'Specialized', color: 'bg-chart-5/10 text-chart-5 border-chart-5/30' },
};

export function WorkflowComposer({ open, onClose, onApply }: Props) {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open && agents.length === 0) {
      api.getAgents().then(data => {
        setAgents(data.agents);
        setLoading(false);
      });
    }
  }, [open, agents.length]);

  const toggleAgent = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const applyPreset = (presetAgents: string[]) => {
    if (presetAgents.length === 0) {
      // Empty = all agents
      setSelected(new Set(agents.map(a => a.id)));
    } else {
      setSelected(new Set(presetAgents));
    }
  };

  const handleApply = () => {
    onApply(Array.from(selected));
    onClose();
  };

  const filtered = agents.filter(a =>
    !search ||
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.role.toLowerCase().includes(search.toLowerCase()) ||
    a.capabilities.some(c => c.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-5xl max-h-[90vh] flex flex-col"
          >
            <Card className="p-6 flex-1 flex flex-col overflow-hidden">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <Wand2 className="h-5 w-5 text-primary" />
                    Workflow Composer
                  </h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    Pick which of the 23 agents to run, or use a preset. Dependencies are auto-included.
                  </p>
                </div>
                <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Presets */}
              <div className="mb-4">
                <Label className="text-xs text-muted-foreground mb-2 block">Presets</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {PRESETS.map(preset => (
                    <button
                      key={preset.name}
                      onClick={() => applyPreset(preset.agents)}
                      className={`text-left p-2.5 rounded-lg border transition-all ${
                        selected.size === preset.agents.length || (preset.agents.length === 0 && selected.size === agents.length)
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50 hover:bg-muted/30'
                      }`}
                    >
                      <div className="text-xs font-medium mb-0.5">{preset.name}</div>
                      <div className="text-[10px] text-muted-foreground line-clamp-2">{preset.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Search */}
              <div className="relative mb-3">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search agents by name, role, or capability..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Agent grid */}
              <div className="flex-1 overflow-y-auto scrollbar-thin pr-2">
                {loading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {filtered.map(agent => {
                      const isSelected = selected.has(agent.id);
                      return (
                        <button
                          key={agent.id}
                          onClick={() => toggleAgent(agent.id)}
                          className={`text-left p-3 rounded-lg border transition-all ${
                            isSelected
                              ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                              : 'border-border hover:border-primary/40 hover:bg-muted/30'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium">{agent.name}</span>
                            <Badge variant="outline" className={`text-[9px] uppercase ${TIER_LABELS[agent.tier].color}`}>
                              {TIER_LABELS[agent.tier].label}
                            </Badge>
                          </div>
                          <p className="text-[10px] text-muted-foreground line-clamp-2">{agent.role}</p>
                          {isSelected && (
                            <div className="mt-1.5 flex items-center gap-1 text-[10px] text-primary">
                              <Sparkles className="h-2.5 w-2.5" />
                              Selected
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{selected.size}</span> of {agents.length} agents selected
                  {selected.size > 0 && <span className="ml-2">· Dependencies auto-included</span>}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setSelected(new Set())} disabled={selected.size === 0}>
                    <RotateCcw className="h-3.5 w-3.5 mr-1" />
                    Clear
                  </Button>
                  <Button size="sm" onClick={handleApply} disabled={selected.size === 0} className="gap-1.5">
                    <Play className="h-3.5 w-3.5" />
                    Apply & Run
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
