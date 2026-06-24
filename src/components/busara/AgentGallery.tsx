'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import * as LucideIcons from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api, AgentInfo } from '@/lib/api-client';

const TIER_LABELS = {
  core: { label: 'Core', color: 'bg-primary/10 text-primary border-primary/30' },
  advanced: { label: 'Advanced', color: 'bg-chart-2/10 text-chart-2 border-chart-2/30' },
  specialized: { label: 'NEW', color: 'bg-chart-5/10 text-chart-5 border-chart-5/30' },
};

export function AgentGallery() {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'core' | 'advanced' | 'specialized'>('all');

  useEffect(() => {
    api.getAgents().then(data => {
      setAgents(data.agents);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const filtered = filter === 'all' ? agents : agents.filter(a => a.tier === filter);

  return (
    <section id="agents" className="py-24 relative">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-2xl mx-auto text-center mb-12"
        >
          <Badge variant="secondary" className="mb-3">The Agent Pool</Badge>
          <h2 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
            Twenty specialists.<br />
            <span className="gradient-text">One orchestrated pipeline.</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            Each agent is a TypeScript class with its own tools, dependencies, and circuit breaker.
            The DAG executor runs them in topological order with parallel stages.
          </p>
        </motion.div>

        <div className="flex justify-center gap-2 mb-8 flex-wrap">
          {(['all', 'core', 'advanced', 'specialized'] as const).map(t => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                filter === t
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/70'
              }`}
            >
              {t === 'all' ? 'All Agents' : t === 'specialized' ? 'NEW (8)' : `${t.charAt(0).toUpperCase() + t.slice(1)} (${agents.filter(a => a.tier === t).length})`}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="h-44 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((agent, i) => {
              const Icon = (LucideIcons as any)[agent.icon] ?? LucideIcons.Bot;
              return (
                <motion.div
                  key={agent.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.03, duration: 0.4 }}
                >
                  <Card
                    className="agent-card-glow p-5 h-full hover:shadow-lg transition-all cursor-default relative overflow-hidden"
                    style={{ '--agent-color': agent.color } as any}
                  >
                    <div
                      className="absolute -top-12 -right-12 h-32 w-32 rounded-full opacity-10 blur-2xl"
                      style={{ backgroundColor: agent.color }}
                    />
                    <div className="flex items-start justify-between mb-3">
                      <div
                        className="h-10 w-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${agent.color}20`, color: agent.color }}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <Badge variant="outline" className={`text-[10px] uppercase tracking-wide ${TIER_LABELS[agent.tier].color}`}>
                        {TIER_LABELS[agent.tier].label}
                      </Badge>
                    </div>
                    <h3 className="font-semibold text-base mb-1">{agent.name}</h3>
                    <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{agent.role}</p>
                    <p className="text-xs text-foreground/70 line-clamp-3 mb-3">{agent.description}</p>
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
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
