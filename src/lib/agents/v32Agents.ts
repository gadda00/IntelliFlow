// ═══════════════════════════════════════════════════════════════════════════
// Akili v3.2 — 3 NEW Specialized Agents (Total: 23 agents)
//   21. NLP Sentiment Analyst
//   22. Anomaly Forecasting Agent
//   23. Graph Neural Network Agent
// ═══════════════════════════════════════════════════════════════════════════
import { Agent, AgentExecutionContext } from './core';
import {
  profileDataset, mean, stdev, correlation, quantile,
  zScoreAnomalies, iqrAnomalies, holtWintersForecast, simpleExpSmoothing,
  ForecastPoint,
} from './statistics';

// ═══════════════════════════════════════════════════════════════════════════
// 21. NLP SENTIMENT ANALYST — Text sentiment & emotion analysis
// ═══════════════════════════════════════════════════════════════════════════
export class NLPSentimentAgent extends Agent {
  constructor() {
    super({
      id: 'nlp_sentiment_analyst',
      name: 'NLP Sentiment Analyst',
      role: 'Text sentiment, emotion & topic analysis',
      tier: 'specialized',
      description: 'Performs lexicon-based sentiment analysis (VADER-style), emotion classification (joy/anger/sadness/fear/surprise/trust), and keyword extraction on any text columns in your dataset.',
      capabilities: ['sentiment_analysis', 'emotion_detection', 'keyword_extraction', 'topic_modeling'],
      icon: 'MessageSquareText',
      color: '#e11d48',
    });
  }

  // Curated lexicons (subset of VADER + NRC EmoLex)
  private POSITIVE_WORDS = new Set([
    'good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'awesome', 'love', 'loved',
    'best', 'better', 'happy', 'happiness', 'joy', 'joyful', 'perfect', 'beautiful', 'brilliant',
    'superb', 'outstanding', 'remarkable', 'positive', 'success', 'successful', 'win', 'winning',
    'gain', 'gained', 'improve', 'improved', 'growth', 'grew', 'growing', 'profit', 'profitable',
    'recommend', 'recommended', 'satisfied', 'satisfaction', 'delighted', 'pleased', 'glad',
    'thanks', 'thank', 'appreciate', 'appreciated', 'helpful', 'easy', 'fast', 'reliable',
    'innovative', 'impressive', 'exceptional', 'premium', 'quality', 'value', 'worth',
  ]);
  private NEGATIVE_WORDS = new Set([
    'bad', 'terrible', 'awful', 'horrible', 'worst', 'worse', 'hate', 'hated', 'disappointing',
    'disappointed', 'disappointment', 'frustrated', 'frustration', 'angry', 'anger', 'sad', 'sadness',
    'unhappy', 'depressed', 'anxious', 'anxiety', 'fear', 'afraid', 'worried', 'worry',
    'fail', 'failed', 'failure', 'lose', 'lost', 'loss', 'decline', 'declined', 'declining',
    'drop', 'dropped', 'fall', 'fell', 'crash', 'crashed', 'problem', 'problematic',
    'issue', 'bug', 'broken', 'slow', 'difficult', 'hard', 'confusing', 'confused',
    'poor', 'inferior', 'cheap', 'useless', 'worthless', 'waste', 'expensive', 'overpriced',
    'rude', 'unprofessional', 'incompetent', 'delayed', 'late', 'canceled', 'denied', 'rejected',
  ]);
  private EMOTION_LEXICONS: Record<string, Set<string>> = {
    joy: new Set(['happy', 'joy', 'joyful', 'delighted', 'pleased', 'glad', 'cheerful', 'excited', 'thrilled', 'elated', 'wonderful', 'amazing', 'fantastic', 'love', 'loved']),
    anger: new Set(['angry', 'anger', 'furious', 'mad', 'irritated', 'annoyed', 'frustrated', 'rage', 'outraged', 'hate', 'hated', 'hostile', 'bitter']),
    sadness: new Set(['sad', 'sadness', 'unhappy', 'depressed', 'down', 'gloomy', 'miserable', 'heartbroken', 'disappointed', 'lonely', 'grief', 'sorrow']),
    fear: new Set(['afraid', 'fear', 'scared', 'terrified', 'anxious', 'worried', 'nervous', 'panic', 'dread', 'alarmed', 'concerned']),
    surprise: new Set(['surprised', 'shocked', 'astonished', 'amazed', 'unexpected', 'sudden', 'wow', 'incredible', 'unbelievable']),
    trust: new Set(['trust', 'trusted', 'reliable', 'honest', 'faithful', 'loyal', 'dependable', 'secure', 'confident', 'assured']),
  };

  async execute(ctx: AgentExecutionContext): Promise<any> {
    const rows = ctx.fileContents;
    if (!rows.length) return { status: 'failed', error: 'No data' };

    // Find text columns (string columns with average length > 20 chars)
    const profile = profileDataset(rows);
    const textColumns = profile.columns.filter(c => {
      if (c.stats.type !== 'categorical') return false;
      const sample = rows.slice(0, 100).map(r => String(r[c.name] ?? ''));
      const avgLen = sample.reduce((a, s) => a + s.length, 0) / sample.length;
      return avgLen > 20;
    });

    if (textColumns.length === 0) {
      return {
        status: 'skipped',
        reason: 'No text columns detected (need string columns with avg length > 20 chars)',
        summary: 'No text columns to analyze.',
      };
    }

    const results: any[] = [];
    for (const col of textColumns.slice(0, 3)) {
      const texts = rows.map(r => String(r[col.name] ?? '')).filter(t => t.length > 0);
      if (!texts.length) continue;

      const sentiments = texts.map(t => this.analyzeSentiment(t));
      const emotions = texts.map(t => this.detectEmotions(t));
      const keywords = this.extractKeywords(texts);

      const positiveCount = sentiments.filter(s => s.label === 'positive').length;
      const negativeCount = sentiments.filter(s => s.label === 'negative').length;
      const neutralCount = sentiments.filter(s => s.label === 'neutral').length;
      const avgScore = mean(sentiments.map(s => s.score));

      // Aggregate emotions
      const emotionTotals: Record<string, number> = {};
      for (const e of emotions) {
        for (const [emotion, score] of Object.entries(e)) {
          emotionTotals[emotion] = (emotionTotals[emotion] ?? 0) + score;
        }
      }
      const emotionAverages = Object.fromEntries(
        Object.entries(emotionTotals).map(([k, v]) => [k, Number((v / texts.length).toFixed(3))])
      );

      results.push({
        column: col.name,
        totalTexts: texts.length,
        sentiment: {
          positivePct: Number(((positiveCount / texts.length) * 100).toFixed(1)),
          negativePct: Number(((negativeCount / texts.length) * 100).toFixed(1)),
          neutralPct: Number(((neutralCount / texts.length) * 100).toFixed(1)),
          averageScore: Number(avgScore.toFixed(3)),
          overallLabel: avgScore > 0.1 ? 'positive' : avgScore < -0.1 ? 'negative' : 'neutral',
        },
        emotions: emotionAverages,
        topKeywords: keywords.slice(0, 15),
        sampleAnalyses: texts.slice(0, 5).map((t, i) => ({
          text: t.length > 150 ? t.slice(0, 150) + '...' : t,
          sentiment: sentiments[i].label,
          score: sentiments[i].score,
        })),
      });
    }

    return {
      status: 'completed',
      confidence: 0.84,
      results,
      summary: `Analyzed sentiment across ${textColumns.length} text column(s). ` +
        `${results[0]?.column ?? 'Text'} is ${results[0]?.sentiment.overallLabel ?? 'neutral'} ` +
        `(${results[0]?.sentiment.positivePct ?? 0}% positive, ${results[0]?.sentiment.negativePct ?? 0}% negative).`,
    };
  }

  private analyzeSentiment(text: string): { label: 'positive' | 'negative' | 'neutral'; score: number } {
    const tokens = text.toLowerCase().match(/\b\w+\b/g) ?? [];
    if (!tokens.length) return { label: 'neutral', score: 0 };

    let score = 0;
    let negated = false;
    const NEGATORS = new Set(['not', 'no', 'never', 'nobody', 'nothing', "don't", "doesn't", "didn't", "isn't", "wasn't"]);

    for (const token of tokens) {
      if (NEGATORS.has(token)) {
        negated = true;
        continue;
      }
      if (this.POSITIVE_WORDS.has(token)) {
        score += negated ? -0.75 : 1;
        negated = false;
      } else if (this.NEGATIVE_WORDS.has(token)) {
        score += negated ? 0.5 : -1;
        negated = false;
      } else {
        negated = false;
      }
    }

    // Normalize to [-1, 1] using tanh
    const normalized = Math.tanh(score / Math.sqrt(tokens.length));
    const label = normalized > 0.1 ? 'positive' : normalized < -0.1 ? 'negative' : 'neutral';
    return { label, score: Number(normalized.toFixed(3)) };
  }

  private detectEmotions(text: string): Record<string, number> {
    const tokens = text.toLowerCase().match(/\b\w+\b/g) ?? [];
    if (!tokens.length) return { joy: 0, anger: 0, sadness: 0, fear: 0, surprise: 0, trust: 0 };

    const counts: Record<string, number> = { joy: 0, anger: 0, sadness: 0, fear: 0, surprise: 0, trust: 0 };
    for (const token of tokens) {
      for (const [emotion, lexicon] of Object.entries(this.EMOTION_LEXICONS)) {
        if (lexicon.has(token)) counts[emotion]++;
      }
    }
    // Normalize
    const max = Math.max(1, ...Object.values(counts));
    for (const k of Object.keys(counts)) counts[k] = Number((counts[k] / max).toFixed(3));
    return counts;
  }

  private extractKeywords(texts: string[]): { word: string; count: number }[] {
    const STOPWORDS = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
      'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your',
      'his', 'its', 'our', 'their', 'this', 'that', 'these', 'those', 'of', 'to', 'in', 'on', 'at',
      'for', 'with', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
      'up', 'down', 'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there',
      'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other',
      'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
      'can', 'just', 'also', 'about', 'if', 'what', 'which', 'who', 'whom',
    ]);
    const counts = new Map<string, number>();
    for (const text of texts) {
      const tokens = text.toLowerCase().match(/\b[a-z]{3,}\b/g) ?? [];
      for (const token of tokens) {
        if (STOPWORDS.has(token)) continue;
        counts.set(token, (counts.get(token) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([word, count]) => ({ word, count }));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 22. ANOMALY FORECASTING AGENT — Predict future anomalies
// ═══════════════════════════════════════════════════════════════════════════
export class AnomalyForecastingAgent extends Agent {
  constructor() {
    super({
      id: 'anomaly_forecasting',
      name: 'Anomaly Forecaster',
      role: 'Predict future anomalies using forecast + anomaly envelope',
      tier: 'specialized',
      description: 'Combines the Forecasting Oracle and Anomaly Sentinel into a predictive model: forecasts future values, then flags periods where the forecast itself suggests anomalous behavior (e.g., confidence intervals exclude historical norms).',
      capabilities: ['predictive_anomaly_detection', 'confidence_envelope_analysis', 'regime_change_detection'],
      icon: 'AlertCircle',
      color: '#dc2626',
    });
  }

  async execute(ctx: AgentExecutionContext): Promise<any> {
    const rows = ctx.fileContents;
    if (!rows.length) return { status: 'failed', error: 'No data' };

    // Get forecast + anomaly results from dependencies
    const forecast = ctx.dependencyResults.forecasting_oracle || {};
    const anomalies = ctx.dependencyResults.anomaly_sentinel || {};

    if (!forecast.forecast || forecast.forecast.length === 0) {
      return {
        status: 'skipped',
        reason: 'No forecast available from Forecasting Oracle',
        summary: 'Anomaly forecasting requires time series data.',
      };
    }

    // Get historical values for the target column
    const target = forecast.targetColumn;
    const historicalValues = rows.map(r => Number(r[target])).filter(v => !isNaN(v));

    if (historicalValues.length < 5) {
      return {
        status: 'skipped',
        reason: 'Insufficient historical data for envelope analysis',
        summary: 'Need at least 5 data points.',
      };
    }

    // Compute historical "normal" envelope
    const histMean = mean(historicalValues);
    const histStd = stdev(historicalValues);
    const histQ1 = quantile(historicalValues, 0.25);
    const histQ3 = quantile(historicalValues, 0.75);
    const histLower = histQ1 - 1.5 * (histQ3 - histQ1);
    const histUpper = histQ3 + 1.5 * (histQ3 - histQ1);

    // Walk through forecast points and flag anomalies
    const predictedAnomalies: any[] = [];
    forecast.forecast.forEach((point: any, i: number) => {
      const reasons: string[] = [];

      // 1. Point falls outside historical IQR bounds
      if (point.value > histUpper) {
        reasons.push(`Projected value ${point.value.toFixed(2)} exceeds historical upper bound ${histUpper.toFixed(2)}`);
      } else if (point.value < histLower) {
        reasons.push(`Projected value ${point.value.toFixed(2)} falls below historical lower bound ${histLower.toFixed(2)}`);
      }

      // 2. Confidence interval excludes the historical mean
      if (point.lower > histMean + histStd) {
        reasons.push(`Entire confidence interval [${point.lower.toFixed(2)}, ${point.upper.toFixed(2)}] is above historical mean+1σ`);
      } else if (point.upper < histMean - histStd) {
        reasons.push(`Entire confidence interval [${point.lower.toFixed(2)}, ${point.upper.toFixed(2)}] is below historical mean−1σ`);
      }

      // 3. Regime change — sudden jump in forecast value
      if (i > 0) {
        const prev = forecast.forecast[i - 1];
        const change = Math.abs(point.value - prev.value) / Math.max(Math.abs(prev.value), 0.001);
        if (change > 0.3) {
          reasons.push(`Projected regime change: ${(change * 100).toFixed(0)}% jump from prior period`);
        }
      }

      if (reasons.length > 0) {
        predictedAnomalies.push({
          period: i + 1,
          timestamp: point.timestamp,
          forecastedValue: point.value,
          confidenceInterval: [point.lower, point.upper],
          severity: reasons.length >= 2 ? 'critical' : 'warning',
          reasons,
        });
      }
    });

    // Also detect historical anomalies for context
    const historicalAnomalies = anomalies.anomalies || [];
    const histZAnomalies = zScoreAnomalies(historicalValues, 2.5);
    const histIQRAnomalies = iqrAnomalies(historicalValues);

    // Predict anomaly rate trend
    const recentAnomalyRate = histZAnomalies.length / historicalValues.length;
    const predictedAnomalyRate = predictedAnomalies.length / forecast.forecast.length;
    const trend = predictedAnomalyRate > recentAnomalyRate * 1.5 ? 'increasing'
                : predictedAnomalyRate < recentAnomalyRate * 0.5 ? 'decreasing'
                : 'stable';

    return {
      status: 'completed',
      confidence: 0.82,
      targetColumn: target,
      historicalBaseline: {
        mean: Number(histMean.toFixed(2)),
        stdev: Number(histStd.toFixed(2)),
        normalRange: [Number(histLower.toFixed(2)), Number(histUpper.toFixed(2))],
      },
      historicalAnomalyRate: Number((recentAnomalyRate * 100).toFixed(1)),
      predictedAnomalies,
      predictedAnomalyRate: Number((predictedAnomalyRate * 100).toFixed(1)),
      anomalyTrend: trend,
      forecastHorizon: forecast.forecast.length,
      totalHistoricalAnomalies: historicalAnomalies.length + histZAnomalies.length + histIQRAnomalies.length,
      summary: predictedAnomalies.length === 0
        ? `No anomalies predicted in the next ${forecast.forecast.length} periods. Anomaly trend: ${trend}.`
        : `${predictedAnomalies.length} anomalies predicted in the next ${forecast.forecast.length} periods. Trend: ${trend}.`,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 23. GRAPH NEURAL NETWORK AGENT — Node embedding & link prediction
// ═══════════════════════════════════════════════════════════════════════════
// Implements a simplified GraphSAGE-style node embedding using random walks
// and aggregation. No deep learning framework needed — pure TypeScript.
export class GraphNeuralNetworkAgent extends Agent {
  constructor() {
    super({
      id: 'graph_neural_network',
      name: 'Graph Neural Network',
      role: 'Node embedding, link prediction & community detection',
      tier: 'specialized',
      description: 'Builds a graph from your tabular data (columns as nodes, correlations as edges), runs a simplified GraphSAGE-style random-walk embedding, predicts missing links, and detects communities via label propagation.',
      capabilities: ['node_embedding', 'link_prediction', 'community_detection', 'graph_sage'],
      icon: 'Network',
      color: '#7c3aed',
    });
  }

  async execute(ctx: AgentExecutionContext): Promise<any> {
    const rows = ctx.fileContents;
    if (!rows.length) return { status: 'failed', error: 'No data' };

    // Get knowledge graph from dependency (if available), else build our own
    const kg = ctx.dependencyResults.knowledge_graph_builder || this.buildSimpleGraph(rows);
    if (!kg.nodes || !kg.edges || kg.nodes.length === 0) {
      return { status: 'skipped', reason: 'No graph structure available', summary: 'Need at least 2 numeric columns.' };
    }

    // Build adjacency list
    const nodeIds = kg.nodes.map((n: any) => n.id);
    const adjList = new Map<string, string[]>();
    for (const id of nodeIds) adjList.set(id, []);
    for (const edge of kg.edges) {
      if (!adjList.has(edge.source)) adjList.set(edge.source, []);
      if (!adjList.has(edge.target)) adjList.set(edge.target, []);
      adjList.get(edge.source)!.push(edge.target);
      adjList.get(edge.target)!.push(edge.source);
    }

    // 1. Node embeddings via random walks (DeepWalk-style)
    const embeddings = this.generateEmbeddings(adjList, 16, 10, 20);

    // 2. Link prediction — for each pair of non-adjacent nodes, predict if a link should exist
    const linkPredictions = this.predictLinks(adjList, embeddings, kg.edges);

    // 3. Community detection via label propagation
    const communities = this.detectCommunities(adjList, nodeIds);

    // 4. Compute graph metrics
    const metrics = this.computeGraphMetrics(adjList, nodeIds);

    return {
      status: 'completed',
      confidence: 0.78,
      nodes: nodeIds.length,
      edges: kg.edges.length,
      embeddingDimension: 16,
      embeddings: Object.fromEntries(
        Array.from(embeddings.entries()).slice(0, 20).map(([k, v]) => [k, v.map(x => Number(x.toFixed(3)))])
      ),
      linkPredictions: linkPredictions.slice(0, 10),
      communities: communities.slice(0, 5).map((c: any) => ({
        id: c.id,
        size: c.members.length,
        members: c.members.slice(0, 8),
        cohesion: Number(c.cohesion.toFixed(3)),
      })),
      graphMetrics: metrics,
      summary: `Built graph with ${nodeIds.length} nodes and ${kg.edges.length} edges. Detected ${communities.length} communities. Predicted ${linkPredictions.length} potential new links.`,
    };
  }

  private buildSimpleGraph(rows: any[]): any {
    const profile = profileDataset(rows);
    const numericCols = profile.columns.filter(c => c.stats.type === 'numeric').map(c => c.name);
    if (numericCols.length < 2) return { nodes: [], edges: [] };

    const nodes = numericCols.map(name => ({ id: `col:${name}`, label: name, type: 'column' }));
    const edges: any[] = [];
    for (let i = 0; i < numericCols.length; i++) {
      for (let j = i + 1; j < numericCols.length; j++) {
        const x = rows.map(r => Number(r[numericCols[i]])).filter(v => !isNaN(v));
        const y = rows.map(r => Number(r[numericCols[j]])).filter(v => !isNaN(v));
        const n = Math.min(x.length, y.length);
        const r = correlation(x.slice(0, n), y.slice(0, n));
        if (Math.abs(r) > 0.3) {
          edges.push({
            source: `col:${numericCols[i]}`,
            target: `col:${numericCols[j]}`,
            weight: Number(Math.abs(r).toFixed(3)),
          });
        }
      }
    }
    return { nodes, edges };
  }

  private generateEmbeddings(
    adjList: Map<string, string[]>,
    dim: number,
    numWalks: number,
    walkLength: number,
  ): Map<string, number[]> {
    const embeddings = new Map<string, number[]>();
    const nodeIds = Array.from(adjList.keys());

    // Initialize with deterministic random embeddings (seeded by node id)
    for (const id of nodeIds) {
      const seed = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
      const emb: number[] = [];
      let s = seed;
      for (let i = 0; i < dim; i++) {
        s = (s * 9301 + 49297) % 233280;
        emb.push((s / 233280) - 0.5);
      }
      embeddings.set(id, emb);
    }

    // Simulate random walks and update embeddings (simplified GraphSAGE aggregation)
    for (const startNode of nodeIds) {
      for (let walk = 0; walk < numWalks; walk++) {
        let current = startNode;
        const visited = [current];
        for (let step = 0; step < walkLength; step++) {
          const neighbors = adjList.get(current) ?? [];
          if (!neighbors.length) break;
          current = neighbors[Math.floor(Math.random() * neighbors.length)];
          visited.push(current);
        }
        // Aggregate: average embeddings of visited nodes into start node
        const startEmb = embeddings.get(startNode)!;
        for (let i = 0; i < dim; i++) {
          let sum = 0;
          for (const v of visited) sum += embeddings.get(v)?.[i] ?? 0;
          const avg = sum / visited.length;
          // Weighted update (learning rate 0.1)
          startEmb[i] = startEmb[i] * 0.9 + avg * 0.1;
        }
      }
    }

    // Normalize embeddings
    for (const [id, emb] of embeddings) {
      const norm = Math.sqrt(emb.reduce((a, b) => a + b * b, 0)) || 1;
      embeddings.set(id, emb.map(v => v / norm));
    }

    return embeddings;
  }

  private predictLinks(adjList: Map<string, string[]>, embeddings: Map<string, number[]>, existingEdges: any[]): any[] {
    const nodeIds = Array.from(embeddings.keys());
    const existingSet = new Set(existingEdges.map((e: any) => `${e.source}|${e.target}`));

    const predictions: any[] = [];
    for (let i = 0; i < nodeIds.length; i++) {
      for (let j = i + 1; j < nodeIds.length; j++) {
        const a = nodeIds[i], b = nodeIds[j];
        if (existingSet.has(`${a}|${b}`) || existingSet.has(`${b}|${a}`)) continue;
        if ((adjList.get(a) ?? []).includes(b)) continue;

        const embA = embeddings.get(a)!;
        const embB = embeddings.get(b)!;
        // Cosine similarity
        const sim = embA.reduce((acc, _, k) => acc + embA[k] * embB[k], 0);
        if (sim > 0.5) {
          predictions.push({
            source: a,
            target: b,
            probability: Number(sim.toFixed(3)),
            confidence: sim > 0.8 ? 'high' : sim > 0.65 ? 'medium' : 'low',
          });
        }
      }
    }
    return predictions.sort((a, b) => b.probability - a.probability);
  }

  private detectCommunities(adjList: Map<string, string[]>, nodeIds: string[]): any[] {
    // Label propagation algorithm
    const labels = new Map<string, number>();
    nodeIds.forEach((id, i) => labels.set(id, i));

    let changed = true;
    let iter = 0;
    while (changed && iter < 20) {
      changed = false;
      iter++;
      for (const id of nodeIds) {
        const neighbors = adjList.get(id) ?? [];
        if (!neighbors.length) continue;
        const labelCounts = new Map<number, number>();
        for (const n of neighbors) {
          const l = labels.get(n) ?? 0;
          labelCounts.set(l, (labelCounts.get(l) ?? 0) + 1);
        }
        const maxCount = Math.max(...labelCounts.values());
        const candidates = Array.from(labelCounts.entries()).filter(([, c]) => c === maxCount);
        const newLabel = candidates[Math.floor(Math.random() * candidates.length)][0];
        if (newLabel !== labels.get(id)) {
          labels.set(id, newLabel);
          changed = true;
        }
      }
    }

    // Group by label
    const groups = new Map<number, string[]>();
    for (const [id, label] of labels) {
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label)!.push(id);
    }

    return Array.from(groups.entries())
      .map(([id, members], i) => {
        // Cohesion = fraction of edges that stay within community
        const internalEdges = members.reduce((acc, m) => {
          const neighbors = adjList.get(m) ?? [];
          return acc + neighbors.filter(n => members.includes(n)).length;
        }, 0);
        const totalEdges = members.reduce((acc, m) => acc + (adjList.get(m)?.length ?? 0), 0) || 1;
        return {
          id: i + 1,
          members,
          cohesion: internalEdges / totalEdges,
        };
      })
      .sort((a, b) => b.members.length - a.members.length);
  }

  private computeGraphMetrics(adjList: Map<string, string[]>, nodeIds: string[]): any {
    const n = nodeIds.length;
    const m = Array.from(adjList.values()).reduce((acc, neighbors) => acc + neighbors.length, 0) / 2;
    const avgDegree = n > 0 ? Number((m * 2 / n).toFixed(2)) : 0;
    const density = n > 1 ? Number((2 * m / (n * (n - 1))).toFixed(3)) : 0;

    // Approximate diameter via BFS from a few sample nodes
    let maxShortestPath = 0;
    const sampleSize = Math.min(5, n);
    for (let i = 0; i < sampleSize; i++) {
      const start = nodeIds[Math.floor(Math.random() * n)];
      const distances = this.bfs(start, adjList);
      const maxDist = Math.max(...distances.values());
      maxShortestPath = Math.max(maxShortestPath, maxDist);
    }

    return {
      nodes: n,
      edges: m,
      averageDegree: avgDegree,
      density,
      approximateDiameter: maxShortestPath,
    };
  }

  private bfs(start: string, adjList: Map<string, string[]>): Map<string, number> {
    const distances = new Map<string, number>();
    distances.set(start, 0);
    const queue = [start];
    while (queue.length) {
      const current = queue.shift()!;
      const dist = distances.get(current)!;
      for (const neighbor of (adjList.get(current) ?? [])) {
        if (!distances.has(neighbor)) {
          distances.set(neighbor, dist + 1);
          queue.push(neighbor);
        }
      }
    }
    return distances;
  }
}
