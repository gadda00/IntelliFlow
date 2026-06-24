'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, MessageCircle, Sparkles, User, Bot } from 'lucide-react';
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
  content: "Hi! I'm Akili's Conversational Analyst. I can answer questions about data analysis concepts, recommend approaches, or interpret results from your analysis. Try asking 'What is causal inference?' or 'How does Akili handle missing data?'",
  source: 'greeting',
  followups: [
    'What can Akili do?',
    'How does the agent pipeline work?',
    'What is causal inference?',
    'How do you handle missing data?',
  ],
  timestamp: new Date().toISOString(),
};

const KNOWLEDGE_BASE: Record<string, { content: string; followups: string[] }> = {
  'what can akili do': {
    content: 'Akili is a multi-agent data analysis platform with 20 specialized AI agents organized in a 6-stage DAG. It can: profile datasets, detect anomalies (Z-score, IQR, EWMA), forecast time series (Holt-Winters), discover causal relationships, detect PII for privacy compliance, generate synthetic data, build knowledge graphs, compare against industry benchmarks, train ML models automatically, explain feature importance, generate Python/SQL/JS code, and produce executive narrative reports — all from a single CSV/JSON upload.',
    followups: ['How does the agent pipeline work?', 'What is synthetic data?', 'How accurate is the forecast?'],
  },
  'pipeline': {
    content: 'The pipeline runs in 6 topological stages: (0) Intake — Data Scout profiles, Quality Guardian scores, Privacy Guardian detects PII, NLQ Interpreter parses queries. (1) Engineering — Data Engineer cleans, dedupes, imputes, engineers features. (2) Deep Analytics — 7 agents run in parallel: Strategist, Anomaly Sentinel, Forecasting Oracle, Causal Architect, Knowledge Graph Builder, Benchmark Agent, Auto-ML. (3) Synthesis — Insight Generator, Explainability Agent, Visualization Specialist, Synthetic Data Generator, Code Generator. (4) Reporting — Narrative Composer + Conversational Analyst. (5) Final — Orchestrator compiles everything.',
    followups: ['What does the orchestrator do?', 'How are agents scheduled?'],
  },
  'agent': {
    content: 'Each agent is a TypeScript class extending the base Agent. It has: an id, name, role, tier (core/advanced/specialized), capabilities list, an execute() method that takes an AgentExecutionContext (fileContents, dependencyResults, analysisConfig) and returns a result object. Agents register Tools (smaller reusable functions) and can use circuit breakers to fail fast. The DAG executor handles scheduling, timeouts, and parallelism.',
    followups: ['How are agents scheduled?', 'What is a circuit breaker?'],
  },
  'causal': {
    content: 'Causal inference in Akili uses three signals: (1) Pearson correlation between variables, (2) Ordinary Least Squares regression to estimate effect sizes, (3) lagged correlation (Granger-style) to detect temporal precedence — if X at time t-1 correlates with Y at time t more strongly than simultaneous X-Y correlation, that suggests X might cause Y. We label relationships as strong/moderate/weak based on |r| thresholds (0.7/0.4/0.2) and report confidence as a blend of correlation strength and lag evidence. True causal inference requires controlled experiments; this is correlational evidence with temporal precedence.',
    followups: ['How accurate is the forecast?', 'What is feature importance?'],
  },
  'forecast': {
    content: 'Forecasting uses Holt-Winters Triple Exponential Smoothing for series with ≥24 points (capturing level + trend + seasonality with period 12), falling back to Simple Exponential Smoothing for shorter series. We compute 95% confidence intervals as 1.96σ√h where h is the forecast horizon. Accuracy is reported as 100 - MAPE (mean absolute percentage error) computed on in-sample fitted values. Typical accuracy for trended monthly data is 75-92%.',
    followups: ['What is the difference between Holt-Winters and ARIMA?', 'How do you handle seasonality?'],
  },
  'anomaly': {
    content: 'We run three algorithms in ensemble: (1) Z-Score — flags points >3σ from mean. (2) IQR — flags points outside [Q1 - 1.5×IQR, Q3 + 1.5×IQR]. (3) EWMA — Exponentially Weighted Moving Average detects sudden deviations from recent trend. Each detected anomaly gets an ensemble score (sum of method hits weighted by z-score), and we classify severity as critical (score ≥2), warning (≥1), or info. The ensemble reduces false positives from any single method.',
    followups: ['How do you handle seasonality?', 'What is the difference between Z-score and IQR?'],
  },
  'missing': {
    content: 'Missing value handling depends on column type: numeric columns are imputed with the median (robust to outliers), categorical with the mode (most frequent value). The Data Engineer agent reports all transformations applied. We avoid mean imputation for skewed distributions. Columns with >50% missing are flagged for the user as candidates for removal. The Data Quality Guardian computes a completeness score as (1 - missingCells/totalCells) and includes this in the overall quality score.',
    followups: ['What is the Data Quality Guardian?', 'How do you handle outliers?'],
  },
  'synthetic': {
    content: 'The Synthetic Data Generator preserves statistical properties while removing PII. For numeric columns it samples from a normal distribution fitted to the original mean/stdev (Box-Muller transform). For categoricals it samples from the original frequency distribution. For datetimes it samples uniformly between min and max. PII columns (detected by Privacy Guardian) are replaced with type-appropriate fakes (fake emails, names, phone numbers). Validation compares original vs synthetic distributions and reports a similarity score (typically 85-95%).',
    followups: ['What is PII?', 'How does the Privacy Guardian work?'],
  },
  'pii': {
    content: 'The Privacy Guardian detects Personally Identifiable Information using two methods: (1) Column name matching — checks if column names contain keywords like "email", "ssn", "phone", "name", "dob". (2) Value pattern matching — applies regexes for emails, phone numbers, SSNs, credit cards, IBANs, IP addresses, dates. Confidence is per-pattern. We compute a risk score (0-100) by summing weights per PII type (SSN=30, credit_card=30, email=15, etc.) and assess compliance against GDPR, CCPA, HIPAA, and PCI-DSS frameworks.',
    followups: ['What is GDPR?', 'How do you mask data?'],
  },
  'explainability': {
    content: 'The Explainability Agent trains a multiple linear regression model (OLS via normal equation) on the dataset, then computes permutation importance: shuffle each feature column, retrain, measure the drop in R². Features causing the largest R² drop are the most important. We also report the regression coefficients themselves (signed effect size). For each top feature we generate a natural-language explanation like "X affects Y positively. A unit increase in X changes Y by +0.342 (importance: 0.187)."',
    followups: ['What is R²?', 'How does Auto-ML work?'],
  },
  'automl': {
    content: 'Auto-ML tries multiple model families and picks the best. For regression problems (when a target is identified): Linear Regression (OLS), Mean Baseline (for comparison). For unsupervised: K-Means clustering with k=2,3,4,5 — picks the best k via elbow detection (largest marginal inertia drop). 80/20 train/test split. Reports test R² and MAE. For clustering, reports inertia and best k. We avoid deep learning because it doesn\'t fit the "instant analysis" promise — these models train in <1 second on 10k rows.',
    followups: ['What is R²?', 'How does the K-Means elbow work?'],
  },
  'orchestrator': {
    content: 'The Orchestrator runs last (Stage 5). It receives all dependency results and compiles a unified output: data overview (rows/cols/quality), agent results summary, executive summary, key findings, recommendations, visualizations, full report, and benchmark comparison. It computes an overall confidence score as the mean of all agent confidence values. The orchestrator also generates pipeline metadata (stages completed, agents executed) for the UI to display.',
    followups: ['What is the Narrative Composer?', 'How does the pipeline work?'],
  },
  'benchmark': {
    content: 'The Benchmark Agent compares your dataset metrics against curated industry benchmarks. We have benchmarks for finance/sales (conversion rate, AOV, retention, cart abandonment), web/analytics (bounce rate, session duration, pages/session), healthcare (no-show rate, satisfaction, readmission), IoT (uptime, anomaly rate), and general (data quality, missing %, duplicate %). For each metric we compute your percentile rank via linear interpolation between known percentile points (P10, P25, median, P75). Status: top_quartile (>75th), above_median, below_median, or bottom_quartile.',
    followups: ['Where do the benchmarks come from?', 'How is the quality score computed?'],
  },
  'code': {
    content: 'The Code Generator produces ready-to-run code in three languages: (1) Python — uses pandas, numpy, scikit-learn, matplotlib. Reproduces the full pipeline: load CSV, profile, impute, correlate, detect anomalies (IsolationForest), run regression or K-Means, save scatter. (2) SQL — generates schema inspection, missing value counts, descriptive statistics (PERCENTILE_CONT for median), top-N queries, and PostgreSQL CORR() for correlation. (3) JavaScript — Node.js script that parses CSV, computes stats, and runs correlation. All code is parameterized by your actual column names and target variable.',
    followups: ['How do I run the generated Python?', 'Can I export to other languages?'],
  },
  'knowledge graph': {
    content: 'The Knowledge Graph Builder extracts entities and relationships from tabular data. Column headers become "column" nodes. Categorical columns with <50 unique values spawn "entity" nodes (one per unique value, capped at 20). Edges: (1) correlation edges between numeric columns (|r| > 0.3 — strong if >0.7), (2) "has_value" edges from categorical columns to their entity nodes. We compute degree centrality to identify hub nodes — typically the most-connected numeric column or the highest-cardinality categorical. Useful for understanding variable relationships at a glance.',
    followups: ['What is centrality?', 'How do you build graphs?'],
  },
  'circuit breaker': {
    content: 'A circuit breaker prevents cascading failures. Each agent has its own. After 3 consecutive failures, the circuit "opens" — subsequent calls skip the agent entirely for 60 seconds (returning a "circuit_breaker_open" skipped status). After the reset timeout, the circuit goes "half_open" — one trial call is allowed. If it succeeds, the circuit closes; if it fails, it reopens. This protects the pipeline from repeatedly invoking a broken agent (e.g., one timing out on bad data).',
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
      content: 'Akili has 4 plans: Free (5 analyses/month, all 20 agents, CSV/JSON/Excel), Professional (₦15,000/mo or $29 — 50 analyses, API access, priority support), Team (₦50,000/mo or $99 — 200 analyses, collaboration, synthetic data, custom branding), Enterprise (custom — unlimited, SSO, dedicated support). All paid plans use Flutterwave for secure payment processing. Scroll to the Pricing section to upgrade.',
      followups: ['What can Akili do?', 'How does Flutterwave work?'],
      source: 'knowledge_base',
    };
  }
  return {
    content: "I can help with: Akili features, the agent pipeline, causal inference, forecasting, anomaly detection, missing data, synthetic data, PII/privacy, explainability, Auto-ML, the orchestrator, benchmarks, code generation, or knowledge graphs. Try asking about any of these, or run an analysis and ask about the results!",
    followups: ['What can Akili do?', 'How does the pipeline work?', 'What is causal inference?'],
    source: 'default',
  };
}

export function ChatSection() {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_GREETING]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
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

    // Simulate brief delay for natural feel
    await new Promise(r => setTimeout(r, 400));

    // Try the actual API first (works if there's an analysis context)
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
      // Fallback to local knowledge base
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

  return (
    <section id="chat" className="py-24 relative bg-muted/20">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-2xl mx-auto text-center mb-10"
        >
          <Badge variant="secondary" className="mb-3"><MessageCircle className="h-3 w-3 mr-1" /> Conversational Analyst</Badge>
          <h2 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
            Chat with the system.<br />
            <span className="gradient-text">Not the docs.</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            Ask about Akili's capabilities, the underlying math, or how to interpret your analysis results.
          </p>
        </motion.div>

        <div className="max-w-3xl mx-auto">
          <Card className="p-0 overflow-hidden">
            <div ref={scrollRef} className="h-[480px] overflow-y-auto scrollbar-thin p-4 space-y-4">
              <AnimatePresence initial={false}>
                {messages.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                  >
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                      msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-accent text-accent-foreground'
                    }`}>
                      {msg.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                    </div>
                    <div className={`max-w-[80%] ${msg.role === 'user' ? 'items-end text-right' : ''}`}>
                      <div className={`rounded-2xl px-4 py-2.5 text-sm ${
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground rounded-tr-sm'
                          : 'bg-muted border border-border/50 rounded-tl-sm'
                      }`}>
                        {msg.content}
                      </div>
                      {msg.followups && msg.followups.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {msg.followups.slice(0, 4).map(f => (
                            <button
                              key={f}
                              onClick={() => send(f)}
                              className="text-xs px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground transition-colors border border-border/40"
                            >
                              {f}
                            </button>
                          ))}
                        </div>
                      )}
                      {msg.source && msg.source !== 'greeting' && msg.source !== 'default' && (
                        <div className="text-[10px] text-muted-foreground mt-1">source: {msg.source}</div>
                      )}
                    </div>
                  </motion.div>
                ))}
                {isLoading && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
                    <div className="h-8 w-8 rounded-full bg-accent text-accent-foreground flex items-center justify-center">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div className="rounded-2xl px-4 py-2.5 bg-muted border border-border/50">
                      <Sparkles className="h-4 w-4 animate-pulse" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="border-t border-border p-3 flex gap-2">
              <Input
                placeholder="Ask anything about Akili, the agents, or your analysis..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                disabled={isLoading}
              />
              <Button onClick={() => send()} disabled={!input.trim() || isLoading} size="icon" className="h-10 w-10">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}
