'use client';

import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, Activity, Zap, Brain, Globe, GitBranch, Shield, Cpu, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface HeroProps {
  onAnalyze: () => void;
  onSeeAgents: () => void;
}

const STATS = [
  { icon: Brain, label: 'Specialized Agents', value: '26', color: 'text-primary' },
  { icon: Layers, label: 'Parallel DAG Stages', value: '7', color: 'text-chart-2' },
  { icon: Cpu, label: 'Algorithms/Agent', value: '3-5', color: 'text-chart-3' },
  { icon: Globe, label: 'Languages Generated', value: '3', color: 'text-chart-4' },
];

const ORBIT_AGENTS = [
  { angle: 0, icon: Activity, color: 'var(--primary)', label: 'Scout' },
  { angle: 51, icon: Shield, color: 'var(--chart-5)', label: 'Privacy' },
  { angle: 102, icon: Zap, color: 'var(--chart-3)', label: 'Oracle' },
  { angle: 153, icon: GitBranch, color: 'var(--chart-2)', label: 'Causal' },
  { angle: 204, icon: Brain, color: 'var(--chart-4)', label: 'Auto-ML' },
  { angle: 255, icon: Sparkles, color: 'var(--primary)', label: 'Narrator' },
  { angle: 306, icon: Cpu, color: 'var(--chart-2)', label: 'CodeGen' },
];

export function Hero({ onAnalyze, onSeeAgents }: HeroProps) {
  return (
    <section id="hero" className="relative pt-28 pb-20 overflow-hidden min-h-[90vh] flex items-center">
      <div className="absolute inset-0 grid-bg opacity-30" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />

      <div className="absolute top-1/4 -left-32 h-[500px] w-[500px] rounded-full bg-primary/15 blur-[100px] animate-pulse-slow" />
      <div className="absolute top-1/3 -right-32 h-[500px] w-[500px] rounded-full bg-accent/20 blur-[100px] animate-pulse-slow" style={{ animationDelay: '2s' }} />

      <div className="container mx-auto px-4 relative">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            <Badge variant="secondary" className="mb-6 py-1.5 px-3.5 text-xs font-medium rounded-full border border-primary/20 bg-primary/5">
              <Sparkles className="h-3 w-3 mr-1.5 text-primary" />
              Busara v6.1 · Swahili for &ldquo;intelligence&rdquo; · Built in Nairobi
            </Badge>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 leading-[1.05]">
              26 agents.
              <br />
              <span className="gradient-text-hero animate-gradient">One mind.</span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-xl leading-relaxed">
              Busara orchestrates a parallel DAG of 26 specialized AI agents — profilers, forecasters, causal
              architects, privacy guardians, code generators — to extract every actionable insight from your dataset.
              Production-ready. Installable as a PWA.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mb-10">
              <Button size="lg" className="h-12 px-8 text-base gap-2 group shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-shadow" onClick={onAnalyze}>
                <Zap className="h-4 w-4" />
                Analyze My Data
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
              <Button size="lg" variant="outline" className="h-12 px-8 text-base gap-2 border-border/60 hover:bg-muted/50" onClick={onSeeAgents}>
                <Brain className="h-4 w-4" />
                Meet the Agents
              </Button>
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 rounded bg-muted border border-border/50 font-mono text-[10px]">Cmd+K</kbd> Command palette</span>
              <span className="flex items-center gap-1"><Sparkles className="h-3 w-3 text-primary" /> Real-time streaming</span>
              <span className="flex items-center gap-1"><Shield className="h-3 w-3 text-chart-5" /> Privacy-first</span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="hidden lg:flex items-center justify-center relative"
          >
            <div className="relative w-[400px] h-[400px]">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative">
                  <div className="absolute inset-0 bg-primary/20 blur-[40px] rounded-full" />
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
                    className="h-24 w-24 rounded-full bg-gradient-to-br from-primary via-primary to-accent-foreground flex items-center justify-center shadow-2xl shadow-primary/30"
                  >
                    <Activity className="h-10 w-10 text-primary-foreground" />
                  </motion.div>
                </div>
              </div>

              <div className="absolute inset-[60px] rounded-full border border-border/30 border-dashed" />
              <div className="absolute inset-[30px] rounded-full border border-primary/10 border-dashed" />

              {ORBIT_AGENTS.map((agent, i) => {
                const rad = (agent.angle * Math.PI) / 180;
                const x = Math.cos(rad) * 155;
                const y = Math.sin(rad) * 155;
                return (
                  <motion.div
                    key={agent.label}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.5 + i * 0.1, duration: 0.4 }}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                    style={{ transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))` }}
                  >
                    <motion.div
                      animate={{ y: [0, -6, 0] }}
                      transition={{ duration: 3 + i * 0.3, repeat: Infinity, ease: 'easeInOut', delay: i * 0.4 }}
                      className="flex flex-col items-center gap-1"
                    >
                      <div
                        className="h-11 w-11 rounded-xl flex items-center justify-center shadow-lg border border-white/10"
                        style={{ backgroundColor: `color-mix(in oklch, ${agent.color} 20%, var(--card))`, color: agent.color }}
                      >
                        <agent.icon className="h-5 w-5" />
                      </div>
                      <span className="text-[9px] font-medium text-muted-foreground whitespace-nowrap">{agent.label}</span>
                    </motion.div>
                  </motion.div>
                );
              })}

              {[...Array(12)].map((_, i) => (
                <motion.div
                  key={`particle-${i}`}
                  className="absolute h-1 w-1 rounded-full bg-primary/40"
                  style={{
                    top: `${20 + Math.random() * 60}%`,
                    left: `${20 + Math.random() * 60}%`,
                  }}
                  animate={{ opacity: [0.2, 0.8, 0.2], scale: [0.8, 1.2, 0.8] }}
                  transition={{ duration: 2 + Math.random() * 2, repeat: Infinity, delay: Math.random() * 2 }}
                />
              ))}
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl mx-auto mt-16 lg:mt-8"
        >
          {STATS.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 + i * 0.1, duration: 0.5 }}
              className="glass rounded-xl p-4 border border-border/30 hover:border-border/50 transition-colors group"
            >
              <stat.icon className={`h-5 w-5 mb-2 ${stat.color} group-hover:scale-110 transition-transform`} />
              <div className="text-2xl font-bold tracking-tight">{stat.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
