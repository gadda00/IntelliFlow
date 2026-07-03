'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, X, ChevronRight, Layers, Activity, Zap, Brain, Globe,
  Database, AlertTriangle, TrendingUp, GitBranch, CircleDot,
  Lightbulb, Code, Globe2, ShieldCheck, Eye, FileText, Sparkles,
  Shield, MessageSquare, Calendar, Cpu, Target, Share2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useV7Agents, V7Agent } from '@/hooks/useV7Analysis';

const STAGE_INFO: Record<string, { label: string; color: string; icon: any }> = {
  ingest: { label: 'Stage 0: Ingest', color: 'text-chart-3', icon: Database },
  engineer: { label: 'Stage 1: Engineer', color: 'text-primary', icon: Zap },
  detect: { label: 'Stage 2: Detect', color: 'text-chart-2', icon: AlertTriangle },
  forecast: { label: 'Stage 3: Forecast', color: 'text-chart-4', icon: TrendingUp },
  infer: { label: 'Stage 4: Infer', color: 'text-chart-5', icon: GitBranch },
  report: { label: 'Stage 5: Report', color: 'text-accent-foreground', icon: FileText },
};

const TIER_COLORS: Record<string, string> = {
  core: 'bg-primary/10 text-primary border-primary/30',
  advanced: 'bg-chart-2/10 text-chart-2 border-chart-2/30',
  specialized: 'bg-chart-5/10 text-chart-5 border-chart-5/30',
  ml: 'bg-chart-4/10 text-chart-4 border-chart-4/30',
  stats: 'bg-chart-3/10 text-chart-3 border-chart-3/30',
};

const ICON_MAP: Record<string, any> = {
  FileInput: FileText, Database, BarChart3: Activity, AlertCircle: AlertTriangle,
  Hash: Layers, Copy: Layers, ShieldCheck, Type: FileText, Shield, MessageSquare,
  Fill: Layers, Tags: Layers, Scale: Layers, Expand: Layers, Scissors: Layers,
  Wrench: Zap, Eraser: Layers, CopyX: Layers, Replace: Layers, Shuffle: Layers,
  AlertTriangle, TreePine: Globe, CircleDot, CircleDashed: CircleDot, BlendedSphere: Globe,
  Search, Smile: Sparkles, Grid3x3: Layers, Activity, Calendar,
  TrendingUp, LineChart: TrendingUp, Waves: Activity, AlertCircle: AlertTriangle,
  TrendingDown: TrendingUp, GitBranch, ListOrdered: Layers, Sparkles, Cpu,
  Target, Share2, Globe2, Lightbulb, FileText, Code, BarChart3: Activity,
  Network: Brain, Bell: AlertTriangle, ScanSearch: Eye,
};

export function AgentsExplorer() {
  const { agents, loading, fetchAgents } = useV7Agents();
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [selectedAgent, setSelectedAgent] = useState<V7Agent | null>(null);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const filtered = useMemo(() => {
    return agents
      .filter(a => stageFilter === 'all' || a.stage === stageFilter)
      .filter(a =>
        !search ||
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        a.role.toLowerCase().includes(search.toLowerCase()) ||
        a.description.toLowerCase().includes(search.toLowerCase()) ||
        a.capabilities.some((c: string) => c.toLowerCase().includes(search.toLowerCase()))
      );
  }, [agents, search, stageFilter]);

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of agents) {
      counts[a.stage] = (counts[a.stage] ?? 0) + 1;
    }
    return counts;
  }, [agents]);

  return (
    <div className="min-h-screen bg-background pt-20 pb-12">
      <div className="container mx-auto px-4 max-w-7xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <Badge variant="secondary" className="mb-3 border border-primary/20 bg-primary/5">
            <Brain className="h-3 w-3 mr-1 text-primary" />
            Busara v7.0 Agent Registry
          </Badge>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">
            50-Agent Registry
          </h1>
          <p className="text-muted-foreground text-sm md:text-base max-w-2xl mx-auto">
            Every agent implements real statistical math. No mocks, no placeholders.
            Browse the full catalog and understand what each agent does.
          </p>
        </div>

        {/* Controls */}
        <div className="mb-6 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setStageFilter('all')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                stageFilter === 'all'
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'
              }`}
            >
              All ({agents.length})
            </button>
            {Object.entries(STAGE_INFO).map(([stage, info]) => (
              <button
                key={stage}
                onClick={() => setStageFilter(stage)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 ${
                  stageFilter === stage
                    ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                }`}
              >
                <info.icon className="h-3 w-3" />
                {info.label.split(':')[1]?.trim() ?? stage}
                <span className="text-[10px] opacity-70">({stageCounts[stage] ?? 0})</span>
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search agents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
        </div>

        {/* Agent Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="h-48 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((agent, i) => {
              const Icon = ICON_MAP[agent.icon] ?? Brain;
              const stageInfo = STAGE_INFO[agent.stage];
              return (
                <motion.div
                  key={agent.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
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
                          <Badge variant="outline" className={`text-[9px] ${stageInfo.color}`}>
                            S{agent.stageNumber}
                          </Badge>
                        )}
                        <Badge variant="outline" className={`text-[10px] uppercase ${TIER_COLORS[agent.tier] ?? ''}`}>
                          {agent.tier}
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
        )}

        {filtered.length === 0 && !loading && (
          <div className="text-center py-16">
            <Search className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-muted-foreground">No agents match your search.</p>
          </div>
        )}

        {/* Agent Detail Drawer */}
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
    </div>
  );
}

function AgentDetailPanel({ agent, onClose }: { agent: V7Agent; onClose: () => void }) {
  const Icon = ICON_MAP[agent.icon] ?? Brain;
  const stageInfo = STAGE_INFO[agent.stage];

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
              <Badge variant="outline" className={`text-[10px] uppercase ${TIER_COLORS[agent.tier] ?? ''}`}>
                {agent.tier}
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
                <Badge variant="secondary" className={stageInfo.color}>
                  {stageInfo.label}
                </Badge>
                <span className="text-xs text-muted-foreground">Runs in parallel with other stage {agent.stageNumber} agents</span>
              </div>
            </div>
          )}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Dependencies</h4>
            <div className="flex flex-wrap gap-1.5">
              {agent.dependencies.length > 0 ? (
                agent.dependencies.map(dep => (
                  <span key={dep} className="text-xs px-2.5 py-1 rounded-full bg-muted border border-border/50">
                    {dep.replace(/_/g, ' ')}
                  </span>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">None — runs independently</span>
              )}
            </div>
          </div>
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
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Timeout</h4>
            <p className="text-xs">{(agent.timeoutMs / 1000).toFixed(0)}s max execution time</p>
          </div>
          <div className="pt-3 border-t border-border/50">
            <Button size="sm" className="w-full gap-2" onClick={() => {
              window.location.href = '/analyze';
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
