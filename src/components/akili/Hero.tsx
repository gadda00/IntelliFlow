'use client';

import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, Activity, Zap, Brain, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface HeroProps {
  onAnalyze: () => void;
  onSeeAgents: () => void;
}

export function Hero({ onAnalyze, onSeeAgents }: HeroProps) {
  return (
    <section id="hero" className="relative pt-32 pb-24 overflow-hidden">
      {/* Background grid + gradient */}
      <div className="absolute inset-0 grid-bg opacity-40" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
      <div className="absolute top-1/4 -left-32 h-96 w-96 rounded-full bg-primary/20 blur-3xl animate-pulse-slow" />
      <div className="absolute top-1/3 -right-32 h-96 w-96 rounded-full bg-accent/30 blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }} />

      <div className="container mx-auto px-4 relative">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-5xl mx-auto text-center"
        >
          <Badge variant="secondary" className="mb-6 py-1.5 px-3 text-xs font-medium rounded-full">
            <Sparkles className="h-3 w-3 mr-1.5" />
            Akili v3.1 · Swahili for "intelligence" · Built in Nairobi
          </Badge>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-[1.05]">
            Twenty agents.
            <br />
            <span className="gradient-text">One mind.</span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-3xl mx-auto leading-relaxed">
            Akili orchestrates a parallel DAG of 20 specialized AI agents — profilers, forecasters, causal
            architects, privacy guardians, code generators — to extract every actionable insight from your dataset.
            Powered by LLM-driven narrative. Production-ready. Installable as a PWA.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-12">
            <Button size="lg" className="h-12 px-8 text-base gap-2 group" onClick={onAnalyze}>
              <Zap className="h-4 w-4" />
              Analyze My Data
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
            <Button size="lg" variant="outline" className="h-12 px-8 text-base gap-2" onClick={onSeeAgents}>
              <Brain className="h-4 w-4" />
              Meet the Agents
            </Button>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            {[
              { icon: Activity, label: 'Specialized Agents', value: '20', color: 'text-primary' },
              { icon: Zap, label: 'Parallel DAG Stages', value: '6', color: 'text-chart-2' },
              { icon: Brain, label: 'Algorithms/Agent', value: '3-5', color: 'text-chart-3' },
              { icon: Globe, label: 'Languages Generated', value: '3', color: 'text-chart-4' },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.1, duration: 0.5 }}
                className="glass rounded-xl p-4 border border-border/40"
              >
                <stat.icon className={`h-5 w-5 mx-auto mb-2 ${stat.color}`} />
                <div className="text-2xl font-bold">{stat.value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
