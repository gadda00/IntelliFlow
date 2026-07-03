'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Zap, Brain, MessageCircle, BarChart3, Shield, Code, Sparkles,
  ArrowRight, FileText, Keyboard, Command, Globe, Layers, Activity,
  TrendingUp, GitBranch, Database, Eye, Lightbulb,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface CommandItem {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  section: string;
  action: () => void;
  keywords?: string[];
  badge?: string;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (id: string) => void;
  onOpenAuth: (mode: 'login' | 'register') => void;
  onOpenComposer: () => void;
  onToggleChat: () => void;
}

export function CommandPalette({ open, onClose, onNavigate, onOpenAuth, onOpenComposer, onToggleChat }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const commands: CommandItem[] = [
    { id: 'nav-hero', label: 'Go to Home', description: 'Return to the hero section', icon: Activity, section: 'Navigation', action: () => onNavigate('hero') },
    { id: 'nav-agents', label: 'Explore Agents', description: 'View all 26 specialized AI agents', icon: Brain, section: 'Navigation', action: () => onNavigate('agents'), badge: '26' },
    { id: 'nav-analyze', label: 'Analyze Data', description: 'Upload data and run the agent pipeline', icon: Zap, section: 'Navigation', action: () => onNavigate('analyze') },
    { id: 'nav-chat', label: 'Chat with Busara', description: 'Ask questions about your data or the platform', icon: MessageCircle, section: 'Navigation', action: () => onToggleChat() },
    { id: 'nav-pricing', label: 'View Pricing', description: 'See plans and upgrade options', icon: BarChart3, section: 'Navigation', action: () => onNavigate('pricing') },
    { id: 'compose', label: 'Workflow Composer', description: 'Pick agents or use presets for custom analysis', icon: Layers, section: 'Features', action: () => { onOpenComposer(); onClose(); }, badge: 'PRO' },
    { id: 'nav-dag', label: 'View Pipeline DAG', description: 'Interactive visualization of the agent pipeline', icon: GitBranch, section: 'Features', action: () => onNavigate('agents'), badge: 'NEW' },
    { id: 'sample', label: 'Try Sample Data', description: 'Load sample e-commerce data for a quick demo', icon: Database, section: 'Quick Start', action: () => onNavigate('analyze') },
    { id: 'signup', label: 'Create Account', description: 'Sign up to save analyses and access API keys', icon: Sparkles, section: 'Account', action: () => { onOpenAuth('register'); onClose(); } },
    { id: 'login', label: 'Sign In', description: 'Sign in to your existing account', icon: FileText, section: 'Account', action: () => { onOpenAuth('login'); onClose(); } },
    { id: 'privacy', label: 'Privacy Guardian', description: 'Detect PII and assess compliance risks', icon: Shield, section: 'Agents', action: () => onNavigate('agents') },
    { id: 'forecast', label: 'Forecast Oracle', description: 'Time-series forecasting with Holt-Winters', icon: TrendingUp, section: 'Agents', action: () => onNavigate('agents') },
    { id: 'causal', label: 'Causal Architect', description: 'Discover causal relationships in your data', icon: GitBranch, section: 'Agents', action: () => onNavigate('agents') },
    { id: 'codegen', label: 'Code Generator', description: 'Generate Python, SQL, and JS from analysis', icon: Code, section: 'Agents', action: () => onNavigate('agents') },
    { id: 'insights', label: 'Insight Generator', description: 'Extract key findings and patterns', icon: Lightbulb, section: 'Agents', action: () => onNavigate('agents') },
    { id: 'viz', label: 'Visualization Specialist', description: 'Auto-generate charts and graphs', icon: Eye, section: 'Agents', action: () => onNavigate('agents') },
  ];

  const filtered = query
    ? commands.filter(c =>
        c.label.toLowerCase().includes(query.toLowerCase()) ||
        c.description.toLowerCase().includes(query.toLowerCase()) ||
        (c.keywords && c.keywords.some(k => k.toLowerCase().includes(query.toLowerCase())))
      )
    : commands;

  const sections = [...new Set(filtered.map(c => c.section))];

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
    }
  }, [open]);

  const executeSelected = useCallback(() => {
    if (filtered[selectedIndex]) {
      filtered[selectedIndex].action();
      onClose();
    }
  }, [filtered, selectedIndex, onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      executeSelected();
    } else if (e.key === 'Escape') {
      onClose();
    }
  }, [filtered.length, executeSelected, onClose]);

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[200] command-palette-backdrop flex items-start justify-center pt-[15vh] p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="flex items-center gap-3 px-4 border-b border-border">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Type a command or search..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 h-12 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-muted text-[10px] text-muted-foreground font-mono">
                ESC
              </kbd>
            </div>

            <div ref={listRef} className="max-h-[50vh] overflow-y-auto scrollbar-thin p-2">
              {sections.map(section => {
                const items = filtered.filter(c => c.section === section);
                if (items.length === 0) return null;
                return (
                  <div key={section} className="mb-2">
                    <div className="px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                      {section}
                    </div>
                    {items.map(item => {
                      const globalIndex = filtered.indexOf(item);
                      return (
                        <button
                          key={item.id}
                          data-index={globalIndex}
                          onClick={() => { item.action(); onClose(); }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                            globalIndex === selectedIndex
                              ? 'bg-primary/10 text-foreground'
                              : 'text-foreground/80 hover:bg-muted'
                          }`}
                        >
                          <item.icon className={`h-4 w-4 shrink-0 ${globalIndex === selectedIndex ? 'text-primary' : 'text-muted-foreground'}`} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{item.label}</div>
                            <div className="text-[11px] text-muted-foreground truncate">{item.description}</div>
                          </div>
                          {item.badge && (
                            <Badge variant="secondary" className="text-[9px] h-5 px-1.5 shrink-0">
                              {item.badge}
                            </Badge>
                          )}
                          {globalIndex === selectedIndex && (
                            <ArrowRight className="h-3.5 w-3.5 text-primary shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No results for &ldquo;{query}&rdquo;
                </div>
              )}
            </div>

            <div className="flex items-center gap-4 px-4 py-2 border-t border-border text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 rounded bg-muted font-mono">↑↓</kbd> navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 rounded bg-muted font-mono">↵</kbd> select
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 rounded bg-muted font-mono">esc</kbd> close
              </span>
              <span className="ml-auto flex items-center gap-1">
                <Command className="h-3 w-3" />+K
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
