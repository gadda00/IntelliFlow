'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, MessageCircle, Sparkles, User, Bot, X, Minimize2, Maximize2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api-client';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  source?: string;
  followups?: string[];
  timestamp: string;
}

const INITIAL_GREETING: ChatMessage = {
  role: 'assistant',
  content: "Hi! I'm Busara's Conversational Analyst. I can answer questions about data analysis concepts, recommend approaches, or interpret results from your analysis. Try asking 'What is causal inference?' or 'How does Busara handle missing data?'",
  source: 'greeting',
  followups: [
    'What can Busara do?',
    'How does the agent pipeline work?',
    'What is causal inference?',
    'How do you handle missing data?',
  ],
  timestamp: new Date().toISOString(),
};

const KNOWLEDGE_BASE: Record<string, { content: string; followups: string[] }> = {
  'what can busara do': {
    content: 'Busara is a multi-agent data analysis platform with 26 specialized AI agents organized in a 7-stage DAG. It can: profile datasets, detect anomalies (Z-score, IQR, EWMA), forecast time series (Holt-Winters), discover causal relationships, detect PII for privacy compliance, generate synthetic data, build knowledge graphs, compare against industry benchmarks, train ML models automatically, explain feature importance, generate Python/SQL/JS code, and produce executive narrative reports — all from a single CSV/JSON upload.',
    followups: ['How does the agent pipeline work?', 'What is synthetic data?', 'How accurate is the forecast?'],
  },
  'pipeline': {
    content: 'The pipeline runs in 7 topological stages: (0) Intake — Data Scout profiles, Quality Guardian scores, Privacy Guardian detects PII, NLQ Interpreter parses queries. (1) Engineering — Data Engineer cleans, dedupes, imputes, engineers features. (2) Deep Analytics — 9 agents run in parallel. (3) Synthesis — Insight Generator, Explainability, Viz Specialist, Synthetic Data, Code Generator, Anomaly Forecasting. (4) Reporting — Narrative Composer + Conversational Analyst. (5) Reflection & Intel. (6) Compilation — Orchestrator.',
    followups: ['What does the orchestrator do?', 'How are agents scheduled?'],
  },
  'agent': {
    content: 'Each agent is a TypeScript class extending the base Agent. It has: an id, name, role, tier (core/advanced/specialized), capabilities list, an execute() method that takes an AgentExecutionContext (fileContents, dependencyResults, analysisConfig) and returns a result object. Agents register Tools (smaller reusable functions) and can use circuit breakers to fail fast. The DAG executor handles scheduling, timeouts, and parallelism.',
    followups: ['How are agents scheduled?', 'What is a circuit breaker?'],
  },
  'causal': {
    content: 'Causal inference in Busara uses three signals: (1) Pearson correlation between variables, (2) Ordinary Least Squares regression to estimate effect sizes, (3) lagged correlation (Granger-style) to detect temporal precedence. We label relationships as strong/moderate/weak based on |r| thresholds (0.7/0.4/0.2). True causal inference requires controlled experiments; this is correlational evidence with temporal precedence.',
    followups: ['How accurate is the forecast?', 'What is feature importance?'],
  },
  'forecast': {
    content: 'Forecasting uses Holt-Winters Triple Exponential Smoothing for series with 24+ points (capturing level + trend + seasonality with period 12), falling back to Simple Exponential Smoothing for shorter series. We compute 95% confidence intervals. Accuracy is reported as 100 - MAPE. Typical accuracy for trended monthly data is 75-92%.',
    followups: ['What is the difference between Holt-Winters and ARIMA?', 'How do you handle seasonality?'],
  },
  'anomaly': {
    content: 'We run three algorithms in ensemble: (1) Z-Score — flags points >3 sigma from mean. (2) IQR — flags points outside [Q1 - 1.5xIQR, Q3 + 1.5xIQR]. (3) EWMA — Exponentially Weighted Moving Average detects sudden deviations from recent trend. The ensemble reduces false positives from any single method.',
    followups: ['How do you handle seasonality?', 'What is the difference between Z-score and IQR?'],
  },
  'missing': {
    content: 'Missing value handling depends on column type: numeric columns are imputed with the median (robust to outliers), categorical with the mode. Columns with >50% missing are flagged for the user as candidates for removal. The Data Quality Guardian computes a completeness score as (1 - missingCells/totalCells).',
    followups: ['What is the Data Quality Guardian?', 'How do you handle outliers?'],
  },
  'synthetic': {
    content: 'The Synthetic Data Generator preserves statistical properties while removing PII. For numeric columns it samples from a normal distribution fitted to the original mean/stdev. For categoricals it samples from the original frequency distribution. PII columns are replaced with type-appropriate fakes.',
    followups: ['What is PII?', 'How does the Privacy Guardian work?'],
  },
  'pii': {
    content: 'The Privacy Guardian detects PII using column name matching and value pattern matching (regexes for emails, phone numbers, SSNs, credit cards, etc.). We compute a risk score (0-100) and assess compliance against GDPR, CCPA, HIPAA, and PCI-DSS frameworks.',
    followups: ['What is GDPR?', 'How do you mask data?'],
  },
  'explainability': {
    content: 'The Explainability Agent trains a multiple linear regression model (OLS via normal equation) on the dataset, then computes permutation importance: shuffle each feature column, retrain, measure the drop in R-squared. Features causing the largest R-squared drop are the most important.',
    followups: ['What is R-squared?', 'How does Auto-ML work?'],
  },
  'automl': {
    content: 'Auto-ML tries multiple model families and picks the best. For regression: Linear Regression (OLS), Mean Baseline. For unsupervised: K-Means clustering with k=2,3,4,5 — picks the best k via elbow detection. 80/20 train/test split. Reports test R-squared and MAE.',
    followups: ['What is R-squared?', 'How does the K-Means elbow work?'],
  },
  'orchestrator': {
    content: 'The Orchestrator runs last (Stage 6). It receives all dependency results and compiles a unified output: data overview, agent results summary, executive summary, key findings, recommendations, visualizations, full report, and benchmark comparison. It computes an overall confidence score as the mean of all agent confidence values.',
    followups: ['What is the Narrative Composer?', 'How does the pipeline work?'],
  },
  'benchmark': {
    content: 'The Benchmark Agent compares your dataset metrics against curated industry benchmarks for finance/sales, web/analytics, healthcare, IoT, and general metrics. For each metric we compute your percentile rank via linear interpolation.',
    followups: ['Where do the benchmarks come from?', 'How is the quality score computed?'],
  },
  'code': {
    content: 'The Code Generator produces ready-to-run code in three languages: Python (pandas, numpy, scikit-learn, matplotlib), SQL (schema inspection, stats, PostgreSQL CORR()), and JavaScript (Node.js CSV parsing and correlation). All code is parameterized by your actual column names.',
    followups: ['How do I run the generated Python?', 'Can I export to other languages?'],
  },
  'knowledge graph': {
    content: 'The Knowledge Graph Builder extracts entities and relationships from tabular data. Column headers become "column" nodes. Categorical columns spawn "entity" nodes. Edges: correlation edges between numeric columns, "has_value" edges from categorical columns to entities. We compute degree centrality to identify hub nodes.',
    followups: ['What is centrality?', 'How do you build graphs?'],
  },
  'circuit breaker': {
    content: 'A circuit breaker prevents cascading failures. After 3 consecutive failures, the circuit "opens" — subsequent calls skip the agent for 60 seconds. After the reset timeout, the circuit goes "half_open" — one trial call is allowed. This protects the pipeline from repeatedly invoking a broken agent.',
    followups: ['How are agents scheduled?', 'What happens when an agent fails?'],
  },
};

function findAnswer(question: string): { content: string; followups: string[]; source: string } {
  const lower = question.toLowerCase();
  for (const [key, val] of Object.entries(KNOWLEDGE_BASE)) {
    if (lower.includes(key) || key.split(' ').some(w => lower.includes(w) && w.length > 3)) {
      return { ...val, source: 'knowledge_base' };
    }
  }
  if (/how are|schedule|dag|stage|parallel/.test(lower)) {
    return { ...KNOWLEDGE_BASE.pipeline, source: 'knowledge_base' };
  }
  if (/price|cost|plan|pay|subscription/.test(lower)) {
    return {
      content: 'Busara has 4 plans: Free (5 analyses/month, all 26 AI agents), Professional ($29/mo — 50 analyses, API access), Team ($99/mo — 200 analyses, collaboration), Enterprise (custom — unlimited, SSO). All paid plans use Flutterwave for secure payment processing. Scroll to the Pricing section to upgrade.',
      followups: ['What can Busara do?', 'How does Flutterwave work?'],
      source: 'knowledge_base',
    };
  }
  return {
    content: "I can help with: Busara features, the agent pipeline, causal inference, forecasting, anomaly detection, missing data, synthetic data, PII/privacy, explainability, Auto-ML, the orchestrator, benchmarks, code generation, or knowledge graphs. Try asking about any of these, or run an analysis and ask about the results!",
    followups: ['What can Busara do?', 'How does the pipeline work?', 'What is causal inference?'],
    source: 'default',
  };
}

interface ChatSectionProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function ChatSection({ isOpen, onToggle }: ChatSectionProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_GREETING]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const send = async (text?: string) => {
    const question = (text ?? input).trim();
    if (!question || isLoading) return;
    setInput('');
    setIsLoading(true);
    const userMsg: ChatMessage = { role: 'user', content: question, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);

    await new Promise(r => setTimeout(r, 400));

    try {
      const resp = await api.chat(question, {});
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: resp.answer,
        source: resp.source,
        followups: resp.followups,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch {
      const answer = findAnswer(question);
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: answer.content,
        source: answer.source,
        followups: answer.followups,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([INITIAL_GREETING]);
  };

  return (
    <>
      <section id="chat" className="py-24 relative bg-muted/20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-2xl mx-auto text-center mb-10"
          >
            <Badge variant="secondary" className="mb-3 border border-primary/20 bg-primary/5">
              <MessageCircle className="h-3 w-3 mr-1 text-primary" />
              Conversational Analyst
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
              Chat with the system.<br />
              <span className="gradient-text-hero">Not the docs.</span>
            </h2>
            <p className="text-muted-foreground text-lg">
              Ask about Busara&apos;s capabilities, the underlying math, or how to interpret your analysis results.
            </p>
          </motion.div>

          <div className="max-w-3xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
              {[
                { q: 'What can Busara do?', icon: Sparkles },
                { q: 'How does the pipeline work?', icon: Bot },
                { q: 'What is causal inference?', icon: User },
                { q: 'How do you handle missing data?', icon: MessageCircle },
              ].map(item => (
                <button
                  key={item.q}
                  onClick={() => {
                    if (!isOpen) onToggle();
                    setTimeout(() => send(item.q), 300);
                  }}
                  className="text-left p-3 rounded-xl bg-card border border-border/30 hover:border-primary/30 hover:bg-primary/5 transition-all group"
                >
                  <item.icon className="h-4 w-4 mb-1.5 text-primary" />
                  <p className="text-xs text-foreground/80 group-hover:text-foreground">{item.q}</p>
                </button>
              ))}
            </div>

            <div className="text-center">
              <Button onClick={onToggle} className="gap-2 shadow-lg shadow-primary/20">
                <MessageCircle className="h-4 w-4" />
                Open Chat
              </Button>
            </div>
          </div>
        </div>
      </section>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={`fixed z-[80] right-4 bottom-4 sm:right-6 sm:bottom-6 ${
              isExpanded ? 'inset-4 sm:inset-auto sm:right-6 sm:bottom-6 sm:w-[500px] sm:h-[600px]' : 'w-[360px] h-[520px]'
            }`}
          >
            <Card className="h-full flex flex-col overflow-hidden shadow-2xl border-primary/20">
              <div className="flex items-center justify-between p-3 border-b border-border/50 bg-gradient-to-r from-primary/5 to-accent/5">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary to-accent-foreground flex items-center justify-center">
                    <Bot className="h-3.5 w-3.5 text-primary-foreground" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">Busara Chat</h3>
                    <p className="text-[10px] text-muted-foreground">Conversational Analyst</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={clearChat} title="Clear chat">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 hidden sm:flex" onClick={() => setIsExpanded(!isExpanded)} title={isExpanded ? 'Minimize' : 'Expand'}>
                    {isExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggle} title="Close">
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4">
                <AnimatePresence initial={false}>
                  {messages.map((msg, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                    >
                      <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-xs ${
                        msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-accent text-accent-foreground'
                      }`}>
                        {msg.role === 'user' ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                      </div>
                      <div className={`max-w-[80%] ${msg.role === 'user' ? 'items-end text-right' : ''}`}>
                        <div className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                          msg.role === 'user'
                            ? 'bg-primary text-primary-foreground rounded-tr-sm'
                            : 'bg-muted border border-border/50 rounded-tl-sm'
                        }`}>
                          {msg.content}
                        </div>
                        {msg.followups && msg.followups.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {msg.followups.slice(0, 3).map(f => (
                              <button
                                key={f}
                                onClick={() => send(f)}
                                className="text-[11px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground transition-colors border border-border/30"
                              >
                                {f}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                  {isLoading && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
                      <div className="h-7 w-7 rounded-full bg-accent text-accent-foreground flex items-center justify-center">
                        <Bot className="h-3.5 w-3.5" />
                      </div>
                      <div className="rounded-2xl px-4 py-3 bg-muted border border-border/50 rounded-tl-sm">
                        <div className="flex gap-1">
                          <span className="typing-dot" />
                          <span className="typing-dot" />
                          <span className="typing-dot" />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="border-t border-border/50 p-3 flex gap-2">
                <Input
                  placeholder="Ask anything about Busara..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                  disabled={isLoading}
                  className="flex-1 h-9 text-sm"
                />
                <Button onClick={() => send()} disabled={!input.trim() || isLoading} size="icon" className="h-9 w-9 shrink-0">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
