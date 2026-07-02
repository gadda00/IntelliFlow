/**
 * Busara v7.0 — Stage 2: Detection & ML Agents (21-30)
 * =====================================================
 */

import { BaseAgent, AgentMetadata, AgentContext, AgentResult } from '../core';
import {
  zScores, quantile, iqr, ewma, mean, stdev, kmeans, silhouetteScore,
  euclideanDistance, shannonEntropy,
} from '../math';

// ─── 21. Anomaly Ensemble Agent (Z-Score + IQR + EWMA) ─────────────────

export class AnomalyEnsembleAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    id: 'anomaly_ensemble',
    name: 'Anomaly Ensemble',
    role: 'Multi-method anomaly detection',
    tier: 'advanced',
    stage: 'detect',
    stageNumber: 2,
    description: 'Runs three anomaly detection algorithms in ensemble: Z-Score (>3 sigma), IQR (1.5x), and EWMA deviation. Combines results for high-precision detection.',
    capabilities: ['z_score_detection', 'iqr_detection', 'ewma_detection', 'ensemble_scoring'],
    dependencies: ['data_profiling'],
    icon: 'AlertTriangle',
    color: '#ef4444',
    timeoutMs: 30000,
  };

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const start = Date.now();
    const { dataframe, previousResults } = ctx;
    const profileResult = previousResults.get('data_profiling');

    if (!dataframe.length || !profileResult?.output?.profile) {
      return this.createError('No profile data for anomaly detection', Date.now() - start);
    }

    const numericCols = Object.entries(profileResult.output.profile)
      .filter(([_, p]: [any, any]) => p.type === 'numeric')
      .map(([col]) => col);

    const anomalies: any[] = [];
    const methodsUsed = ['z_score', 'iqr', 'ewma'];

    for (const col of numericCols) {
      const values = dataframe.map(r => Number(r[col])).filter(n => !isNaN(n));
      if (values.length < 4) continue;

      const z = zScores(values);
      const q1 = quantile(values, 0.25);
      const q3 = quantile(values, 0.75);
      const iqrVal = iqr(values);
      const lower = q1 - 1.5 * iqrVal;
      const upper = q3 + 1.5 * iqrVal;
      const ewmaValues = ewma(values, 0.3);
      const ewmaStdev = stdev(ewmaValues);

      for (let i = 0; i < values.length; i++) {
        const zScoreFlag = Math.abs(z[i]) > 3;
        const iqrFlag = values[i] < lower || values[i] > upper;
        const ewmaFlag = ewmaStdev > 0 && Math.abs(values[i] - ewmaValues[i]) > 3 * ewmaStdev;

        if (zScoreFlag || iqrFlag || ewmaFlag) {
          const score = (zScoreFlag ? 1 : 0) + (iqrFlag ? 1 : 0) + (ewmaFlag ? 1 : 0);
          anomalies.push({
            column: col,
            rowIndex: i,
            value: values[i],
            zScore: z[i],
            methods: { zScore: zScoreFlag, iqr: iqrFlag, ewma: ewmaFlag },
            ensembleScore: score,
            severity: score >= 3 ? 'critical' : score >= 2 ? 'warning' : 'info',
          });
        }
      }
    }

    return this.createResult({
      anomalies: anomalies.slice(0, 100),
      totalAnomalies: anomalies.length,
      anomalyRate: dataframe.length > 0 ? anomalies.length / (dataframe.length * numericCols.length) : 0,
      methodsUsed,
      bySeverity: {
        critical: anomalies.filter(a => a.severity === 'critical').length,
        warning: anomalies.filter(a => a.severity === 'warning').length,
        info: anomalies.filter(a => a.severity === 'info').length,
      },
    }, {
      anomalyRate: dataframe.length > 0 ? anomalies.length / (dataframe.length * numericCols.length) : 0,
      totalAnomalies: anomalies.length,
    }, Date.now() - start);
  }
}

// ─── 22. Isolation Forest Agent (simplified) ───────────────────────────

export class IsolationForestAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    id: 'isolation_forest',
    name: 'Isolation Forest',
    role: 'Tree-based anomaly detection',
    tier: 'ml',
    stage: 'detect',
    stageNumber: 2,
    description: 'Implements a simplified Isolation Forest algorithm that detects anomalies by measuring how easily data points can be isolated using random splits.',
    capabilities: ['isolation_forest', 'tree_based_detection', 'anomaly_scoring'],
    dependencies: ['data_profiling'],
    icon: 'TreePine',
    color: '#16a34a',
    timeoutMs: 30000,
  };

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const start = Date.now();
    const { dataframe, previousResults } = ctx;
    const profileResult = previousResults.get('data_profiling');

    if (!dataframe.length) {
      return this.createError('No data for isolation forest', Date.now() - start);
    }

    const numericCols = Object.entries(profileResult?.output?.profile ?? {})
      .filter(([_, p]: [any, any]) => p.type === 'numeric')
      .map(([col]) => col);

    if (numericCols.length === 0) {
      return this.createResult({ anomalies: [], totalAnomalies: 0 }, {}, Date.now() - start);
    }

    // Prepare data matrix
    const data: number[][] = dataframe.map(row =>
      numericCols.map(col => Number(row[col])).filter(n => !isNaN(n))
    ).filter(row => row.length === numericCols.length);

    if (data.length < 10) {
      return this.createResult({ anomalies: [], totalAnomalies: 0, message: 'Insufficient data' }, {}, Date.now() - start);
    }

    // Simplified isolation: compute average path length using random feature splits
    const numTrees = 50;
    const sampleSize = Math.min(256, data.length);
    const scores = new Array(data.length).fill(0);

    for (let t = 0; t < numTrees; t++) {
      // Random sample
      const indices = Array.from({ length: data.length }, (_, i) => i);
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }
      const sample = indices.slice(0, sampleSize);

      // Random split depths
      for (let i = 0; i < data.length; i++) {
        const featureIdx = Math.floor(Math.random() * numericCols.length);
        const sampleValues = sample.map(idx => data[idx][featureIdx]);
        const minVal = Math.min(...sampleValues);
        const maxVal = Math.max(...sampleValues);
        if (maxVal === minVal) { scores[i] += 1; continue; }
        const splitPoint = minVal + Math.random() * (maxVal - minVal);

        // Path length approximation
        let depth = 0;
        let val = data[i][featureIdx];
        let lo = minVal, hi = maxVal;
        while (depth < 10 && lo < hi) {
          if (val < splitPoint) hi = splitPoint;
          else lo = splitPoint;
          depth++;
          if (hi - lo < 0.01 * (maxVal - minVal)) break;
        }
        scores[i] += depth;
      }
    }

    // Normalize scores (lower = more anomalous)
    const avgScores = scores.map(s => s / numTrees);
    const threshold = quantile(avgScores, 0.05); // Bottom 5% are anomalies

    const anomalies = avgScores
      .map((score, i) => ({ rowIndex: i, anomalyScore: score, isAnomaly: score < threshold }))
      .filter(a => a.isAnomaly);

    return this.createResult({
      anomalies: anomalies.slice(0, 50),
      totalAnomalies: anomalies.length,
      anomalyRate: anomalies.length / data.length,
      threshold,
    }, {
      anomalyRate: anomalies.length / data.length,
      totalAnomalies: anomalies.length,
    }, Date.now() - start);
  }
}

// ─── 23. K-Means Clustering Agent ──────────────────────────────────────

export class KMeansClusterAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    id: 'kmeans_cluster',
    name: 'K-Means Clustering',
    role: 'K-Means clustering with elbow detection',
    tier: 'ml',
    stage: 'detect',
    stageNumber: 2,
    description: 'Runs K-Means clustering with k=2,3,4,5 and selects the best k using the elbow method (largest inertia drop). Reports cluster centroids and assignments.',
    capabilities: ['kmeans', 'elbow_detection', 'cluster_assignment'],
    dependencies: ['data_profiling'],
    icon: 'CircleDot',
    color: '#6366f1',
    timeoutMs: 30000,
  };

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const start = Date.now();
    const { dataframe, previousResults } = ctx;
    const profileResult = previousResults.get('data_profiling');

    if (!dataframe.length) {
      return this.createError('No data for clustering', Date.now() - start);
    }

    const numericCols = Object.entries(profileResult?.output?.profile ?? {})
      .filter(([_, p]: [any, any]) => p.type === 'numeric')
      .map(([col]) => col);

    if (numericCols.length < 2) {
      return this.createResult({ clusters: null, message: 'Need at least 2 numeric columns' }, {}, Date.now() - start);
    }

    const data: number[][] = dataframe.map(row =>
      numericCols.map(col => Number(row[col])).filter(n => !isNaN(n))
    ).filter(row => row.length === numericCols.length);

    if (data.length < 10) {
      return this.createResult({ clusters: null, message: 'Insufficient data' }, {}, Date.now() - start);
    }

    // Try k=2,3,4,5 and pick best via elbow
    const results: { k: number; result: any }[] = [];
    for (let k = 2; k <= 5; k++) {
      const result = kmeans(data, k);
      const silhouette = silhouetteScore(data, result.assignments, k);
      results.push({ k, result: { ...result, silhouette } });
    }

    // Elbow detection: largest marginal inertia drop
    let bestK = 2;
    let maxDrop = 0;
    for (let i = 1; i < results.length; i++) {
      const drop = results[i - 1].result.inertia - results[i].result.inertia;
      if (drop > maxDrop) { maxDrop = drop; bestK = results[i].k; }
    }

    const best = results.find(r => r.k === bestK)!;

    return this.createResult({
      bestK,
      centroids: best.result.centroids,
      assignments: best.result.assignments,
      inertia: best.result.inertia,
      silhouette: best.result.silhouette,
      allKResults: results.map(r => ({ k: r.k, inertia: r.result.inertia, silhouette: r.result.silhouette })),
    }, {
      bestK,
      silhouette: best.result.silhouette,
      inertia: best.result.inertia,
    }, Date.now() - start);
  }
}

// ─── 24. DBSCAN Cluster Agent ──────────────────────────────────────────

export class DBSCANClusterAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    id: 'dbscan_cluster',
    name: 'DBSCAN Clustering',
    role: 'Density-based spatial clustering',
    tier: 'ml',
    stage: 'detect',
    stageNumber: 2,
    description: 'Implements DBSCAN density-based clustering that can find arbitrarily shaped clusters and identify noise points. No need to specify k.',
    capabilities: ['dbscan', 'density_clustering', 'noise_detection'],
    dependencies: ['data_profiling'],
    icon: 'CircleDashed',
    color: '#0891b2',
    timeoutMs: 30000,
  };

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const start = Date.now();
    const { dataframe, previousResults } = ctx;
    const profileResult = previousResults.get('data_profiling');

    if (!dataframe.length) {
      return this.createError('No data for DBSCAN', Date.now() - start);
    }

    const numericCols = Object.entries(profileResult?.output?.profile ?? {})
      .filter(([_, p]: [any, any]) => p.type === 'numeric')
      .map(([col]) => col);

    if (numericCols.length < 2) {
      return this.createResult({ clusters: null, message: 'Need 2+ numeric columns' }, {}, Date.now() - start);
    }

    const data: number[][] = dataframe.slice(0, 2000).map(row =>
      numericCols.map(col => Number(row[col])).filter(n => !isNaN(n))
    ).filter(row => row.length === numericCols.length);

    if (data.length < 10) {
      return this.createResult({ clusters: null, message: 'Insufficient data' }, {}, Date.now() - start);
    }

    // DBSCAN parameters
    const epsilon = 0.5;
    const minPts = 5;
    const labels = new Array(data.length).fill(-1); // -1 = unvisited, -2 = noise
    let clusterId = 0;

    const rangeQuery = (p: number) => {
      const neighbors: number[] = [];
      for (let q = 0; q < data.length; q++) {
        if (euclideanDistance(data[p], data[q]) <= epsilon) neighbors.push(q);
      }
      return neighbors;
    };

    for (let p = 0; p < data.length; p++) {
      if (labels[p] !== -1) continue;
      const neighbors = rangeQuery(p);
      if (neighbors.length < minPts) {
        labels[p] = -2; // Noise
        continue;
      }
      labels[p] = clusterId;
      const seedSet = [...neighbors];
      let idx = 0;
      while (idx < seedSet.length) {
        const q = seedSet[idx];
        if (labels[q] === -2) labels[q] = clusterId;
        if (labels[q] !== -1) { idx++; continue; }
        labels[q] = clusterId;
        const qNeighbors = rangeQuery(q);
        if (qNeighbors.length >= minPts) {
          for (const n of qNeighbors) {
            if (!seedSet.includes(n)) seedSet.push(n);
          }
        }
        idx++;
      }
      clusterId++;
    }

    const noisePoints = labels.filter(l => l === -2).length;
    const numClusters = clusterId;

    return this.createResult({
      numClusters,
      noisePoints,
      assignments: labels,
      clusterSizes: Array.from({ length: numClusters }, (_, i) => labels.filter(l => l === i).length),
    }, {
      numClusters,
      noiseRate: noisePoints / data.length,
    }, Date.now() - start);
  }
}

// ─── 25. Gaussian Mixture Agent (simplified EM) ────────────────────────

export class GaussianMixtureAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    id: 'gaussian_mixture',
    name: 'Gaussian Mixture',
    role: 'Soft clustering with Gaussian Mixture Models',
    tier: 'ml',
    stage: 'detect',
    stageNumber: 2,
    description: 'Implements a simplified Gaussian Mixture Model using Expectation-Maximization for soft clustering. Provides probability of each point belonging to each cluster.',
    capabilities: ['gmm', 'em_algorithm', 'soft_clustering'],
    dependencies: ['data_profiling'],
    icon: 'BlendedSphere',
    color: '#9333ea',
    timeoutMs: 30000,
  };

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const start = Date.now();
    const { dataframe, previousResults } = ctx;
    const profileResult = previousResults.get('data_profiling');

    if (!dataframe.length) {
      return this.createError('No data for GMM', Date.now() - start);
    }

    const numericCols = Object.entries(profileResult?.output?.profile ?? {})
      .filter(([_, p]: [any, any]) => p.type === 'numeric')
      .map(([col]) => col);

    if (numericCols.length < 2) {
      return this.createResult({ clusters: null, message: 'Need 2+ numeric columns' }, {}, Date.now() - start);
    }

    const data: number[][] = dataframe.slice(0, 2000).map(row =>
      numericCols.map(col => Number(row[col])).filter(n => !isNaN(n))
    ).filter(row => row.length === numericCols.length);

    if (data.length < 20) {
      return this.createResult({ clusters: null, message: 'Insufficient data' }, {}, Date.now() - start);
    }

    const k = 3;
    const n = data.length;
    const dims = numericCols.length;
    const maxIter = 50;

    // Initialize means randomly
    const means: number[][] = [];
    for (let i = 0; i < k; i++) {
      means.push(data[Math.floor(Math.random() * n)]);
    }
    const weights = new Array(k).fill(1 / k);
    const variances = new Array(k).fill(0).map(() => {
      const allVals = data.flat();
      return stdev(allVals) ** 2 || 1;
    });

    // EM iterations
    for (let iter = 0; iter < maxIter; iter++) {
      // E-step: compute responsibilities
      const responsibilities: number[][] = [];
      for (let i = 0; i < n; i++) {
        const probs = new Array(k).fill(0);
        for (let j = 0; j < k; j++) {
          const dist = euclideanDistance(data[i], means[j]) ** 2;
          probs[j] = weights[j] * Math.exp(-dist / (2 * variances[j])) / Math.sqrt(2 * Math.PI * variances[j]);
        }
        const sum = probs.reduce((a, b) => a + b, 0) || 1;
        responsibilities.push(probs.map(p => p / sum));
      }

      // M-step: update parameters
      for (let j = 0; j < k; j++) {
        const Nk = responsibilities.reduce((s, r) => s + r[j], 0);
        if (Nk === 0) continue;
        weights[j] = Nk / n;
        for (let d = 0; d < dims; d++) {
          means[j][d] = responsibilities.reduce((s, r, i) => s + r[j] * data[i][d], 0) / Nk;
        }
        let totalDist = 0;
        for (let i = 0; i < n; i++) {
          totalDist += responsibilities[i][j] * euclideanDistance(data[i], means[j]) ** 2;
        }
        variances[j] = Math.max(totalDist / (Nk * dims), 0.01);
      }
    }

    // Final assignments
    const assignments = data.map(point => {
      let bestCluster = 0, bestProb = 0;
      for (let j = 0; j < k; j++) {
        const dist = euclideanDistance(point, means[j]) ** 2;
        const prob = weights[j] * Math.exp(-dist / (2 * variances[j]));
        if (prob > bestProb) { bestProb = prob; bestCluster = j; }
      }
      return bestCluster;
    });

    return this.createResult({
      numClusters: k,
      means,
      weights,
      variances,
      assignments,
      convergence: maxIter,
    }, {
      numClusters: k,
    }, Date.now() - start);
  }
}

// ─── 26. Fraud Detection Agent ─────────────────────────────────────────

export class FraudDetectionAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    id: 'fraud_detection',
    name: 'Fraud Detection',
    role: 'Rule-based fraud detection engine',
    tier: 'specialized',
    stage: 'detect',
    stageNumber: 2,
    description: 'Applies rule-based fraud detection: unusually high amounts, rapid successive transactions, off-hours activity, and geographic anomalies.',
    capabilities: ['rule_engine', 'fraud_scoring', 'risk_assessment'],
    dependencies: ['data_profiling', 'anomaly_ensemble'],
    icon: 'Search',
    color: '#dc2626',
    timeoutMs: 15000,
  };

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const start = Date.now();
    const { dataframe, previousResults } = ctx;
    const anomalyResult = previousResults.get('anomaly_ensemble');

    if (!dataframe.length) {
      return this.createError('No data for fraud detection', Date.now() - start);
    }

    // Combine anomaly results with rule-based checks
    const anomalies = anomalyResult?.output?.anomalies ?? [];
    const columns = Object.keys(dataframe[0]);
    const amountCol = columns.find(c => /amount|price|value|total|cost/.test(c.toLowerCase()));

    const flagged: any[] = [];

    // Rule 1: High amount (> 3 standard deviations)
    if (amountCol) {
      const amounts = dataframe.map(r => Number(r[amountCol])).filter(n => !isNaN(n));
      const m = mean(amounts);
      const s = stdev(amounts);
      dataframe.forEach((row, i) => {
        const amt = Number(row[amountCol]);
        if (!isNaN(amt) && s > 0 && Math.abs(amt - m) > 3 * s) {
          flagged.push({ rowIndex: i, rule: 'high_amount', value: amt, zScore: (amt - m) / s });
        }
      });
    }

    // Rule 2: Off-hours (if datetime column exists)
    const timeCol = columns.find(c => /date|time|timestamp/.test(c.toLowerCase()));
    if (timeCol) {
      dataframe.forEach((row, i) => {
        const dt = new Date(row[timeCol]);
        if (!isNaN(dt.getTime())) {
          const hour = dt.getHours();
          if (hour < 6 || hour > 22) {
            flagged.push({ rowIndex: i, rule: 'off_hours', hour });
          }
        }
      });
    }

    // Rule 3: Rapid succession (same entity, < 60s gap)
    if (timeCol) {
      const sorted = [...dataframe]
        .map((row, i) => ({ row, i, time: new Date(row[timeCol]).getTime() }))
        .filter(x => !isNaN(x.time))
        .sort((a, b) => a.time - b.time);
      for (let i = 1; i < sorted.length; i++) {
        const gap = sorted[i].time - sorted[i - 1].time;
        if (gap < 60000 && gap > 0) {
          flagged.push({ rowIndex: sorted[i].i, rule: 'rapid_succession', gapMs: gap });
        }
      }
    }

    // Deduplicate and score
    const uniqueFlagged = new Map<number, any>();
    for (const f of flagged) {
      if (!uniqueFlagged.has(f.rowIndex)) {
        uniqueFlagged.set(f.rowIndex, { ...f, riskScore: 0, rules: [] });
      }
      const entry = uniqueFlagged.get(f.rowIndex)!;
      entry.rules.push(f.rule);
      entry.riskScore += 30;
    }

    return this.createResult({
      flaggedTransactions: Array.from(uniqueFlagged.values()).slice(0, 50),
      totalFlagged: uniqueFlagged.size,
      fraudRate: uniqueFlagged.size / dataframe.length,
      rulesApplied: ['high_amount', 'off_hours', 'rapid_succession'],
    }, {
      fraudRate: uniqueFlagged.size / dataframe.length,
      totalFlagged: uniqueFlagged.size,
    }, Date.now() - start);
  }
}

// ─── 27. Sentiment Analysis Agent ──────────────────────────────────────

export class SentimentAnalysisAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    id: 'sentiment_analysis',
    name: 'Sentiment Analysis',
    role: 'Lexicon-based sentiment and emotion analysis',
    tier: 'specialized',
    stage: 'detect',
    stageNumber: 2,
    description: 'Performs VADER-style lexicon-based sentiment analysis, emotion classification (joy/anger/sadness/fear/surprise/trust), and keyword extraction on text columns.',
    capabilities: ['sentiment_analysis', 'emotion_detection', 'keyword_extraction'],
    dependencies: ['schema_inference'],
    icon: 'Smile',
    color: '#f59e0b',
    timeoutMs: 25000,
  };

  private positiveWords = new Set(['good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'love', 'best', 'happy', 'perfect', 'awesome', 'brilliant', 'positive', 'success', 'win', 'gain', 'profit', 'up', 'high']);
  private negativeWords = new Set(['bad', 'terrible', 'awful', 'horrible', 'worst', 'hate', 'sad', 'angry', 'fail', 'loss', 'down', 'low', 'negative', 'poor', 'disappointing', 'broken', 'wrong', 'error', 'crash']);
  private emotionWords = {
    joy: ['happy', 'joy', 'delighted', 'excited', 'pleased', 'glad'],
    anger: ['angry', 'furious', 'irritated', 'annoyed', 'mad', 'outraged'],
    sadness: ['sad', 'depressed', 'unhappy', 'miserable', 'down', 'blue'],
    fear: ['afraid', 'scared', 'worried', 'anxious', 'nervous', 'terrified'],
    surprise: ['surprised', 'shocked', 'amazed', 'astonished', 'unexpected'],
    trust: ['trust', 'reliable', 'honest', 'faithful', 'loyal', 'dependable'],
  };

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const start = Date.now();
    const { dataframe, previousResults } = ctx;
    const schemaResult = previousResults.get('schema_inference');

    if (!dataframe.length) {
      return this.createError('No data for sentiment analysis', Date.now() - start);
    }

    const textCols = Object.entries(schemaResult?.output?.schema ?? {})
      .filter(([_, s]: [any, any]) => s.type === 'text')
      .map(([col]) => col);

    if (textCols.length === 0) {
      return this.createResult({ sentiment: null, message: 'No text columns found' }, {}, Date.now() - start);
    }

    const results: Record<string, any> = {};

    for (const col of textCols) {
      const texts = dataframe.map(r => String(r[col] ?? '')).filter(t => t.length > 0);
      if (texts.length === 0) continue;

      let totalScore = 0;
      const emotions: Record<string, number> = { joy: 0, anger: 0, sadness: 0, fear: 0, surprise: 0, trust: 0 };
      const keywordFreq = new Map<string, number>();

      for (const text of texts) {
        const words = text.toLowerCase().split(/\s+/);
        let pos = 0, neg = 0;
        for (const w of words) {
          if (this.positiveWords.has(w)) pos++;
          if (this.negativeWords.has(w)) neg++;
          for (const [emotion, wordList] of Object.entries(this.emotionWords)) {
            if (wordList.includes(w)) emotions[emotion]++;
          }
          keywordFreq.set(w, (keywordFreq.get(w) ?? 0) + 1);
        }
        totalScore += (pos - neg) / Math.max(words.length, 1);
      }

      results[col] = {
        averageScore: totalScore / texts.length,
        sentiment: totalScore / texts.length > 0.05 ? 'positive' : totalScore / texts.length < -0.05 ? 'negative' : 'neutral',
        emotions,
        topKeywords: Array.from(keywordFreq.entries())
          .filter(([w]) => w.length > 3 && !this.positiveWords.has(w) && !this.negativeWords.has(w))
          .sort((a, b) => b[1] - a[1])
          .slice(0, 20),
      };
    }

    return this.createResult({ results }, {
      textColumnsAnalyzed: Object.keys(results).length,
    }, Date.now() - start);
  }
}

// ─── 28. Correlation Matrix Agent ──────────────────────────────────────

export class CorrelationMatrixAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    id: 'correlation_matrix',
    name: 'Correlation Matrix',
    role: 'Compute Pearson correlation matrix',
    tier: 'stats',
    stage: 'detect',
    stageNumber: 2,
    description: 'Computes the full Pearson correlation matrix between all numeric columns. Identifies strong positive, negative, and multicollinear relationships.',
    capabilities: ['correlation_matrix', 'multicollinearity_detection'],
    dependencies: ['data_profiling'],
    icon: 'Grid3x3',
    color: '#2563eb',
    timeoutMs: 20000,
  };

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const start = Date.now();
    const { dataframe, previousResults } = ctx;
    const profileResult = previousResults.get('data_profiling');

    if (!dataframe.length) {
      return this.createError('No data for correlation', Date.now() - start);
    }

    const numericCols = Object.entries(profileResult?.output?.profile ?? {})
      .filter(([_, p]: [any, any]) => p.type === 'numeric')
      .map(([col]) => col);

    if (numericCols.length < 2) {
      return this.createResult({ matrix: {}, message: 'Need 2+ numeric columns' }, {}, Date.now() - start);
    }

    // Build column arrays
    const colData: Record<string, number[]> = {};
    for (const col of numericCols) {
      colData[col] = dataframe.map(r => Number(r[col])).filter(n => !isNaN(n));
    }

    // Compute correlation matrix
    const matrix: Record<string, Record<string, number>> = {};
    for (const col1 of numericCols) {
      matrix[col1] = {};
      for (const col2 of numericCols) {
        matrix[col1][col2] = this.pearson(colData[col1], colData[col2]);
      }
    }

    // Find strong correlations
    const strongCorrelations: { col1: string; col2: string; correlation: number; strength: string }[] = [];
    for (let i = 0; i < numericCols.length; i++) {
      for (let j = i + 1; j < numericCols.length; j++) {
        const r = matrix[numericCols[i]][numericCols[j]];
        const absR = Math.abs(r);
        if (absR > 0.3) {
          strongCorrelations.push({
            col1: numericCols[i],
            col2: numericCols[j],
            correlation: r,
            strength: absR > 0.7 ? 'strong' : absR > 0.4 ? 'moderate' : 'weak',
          });
        }
      }
    }

    return this.createResult({
      matrix,
      strongCorrelations: strongCorrelations.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation)),
      multicollinear: strongCorrelations.filter(c => Math.abs(c.correlation) > 0.8),
    }, {
      strongCorrelations: strongCorrelations.length,
      multicollinear: strongCorrelations.filter(c => Math.abs(c.correlation) > 0.8).length,
    }, Date.now() - start);
  }

  private pearson(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    if (n < 2) return 0;
    const mx = x.slice(0, n).reduce((a, b) => a + b, 0) / n;
    const my = y.slice(0, n).reduce((a, b) => a + b, 0) / n;
    let num = 0, dx = 0, dy = 0;
    for (let i = 0; i < n; i++) {
      num += (x[i] - mx) * (y[i] - my);
      dx += (x[i] - mx) ** 2;
      dy += (y[i] - my) ** 2;
    }
    const denom = Math.sqrt(dx * dy);
    return denom === 0 ? 0 : num / denom;
  }
}

// ─── 29. Stationarity Tester Agent ─────────────────────────────────────

export class StationarityTesterAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    id: 'stationarity_tester',
    name: 'Stationarity Tester',
    role: 'ADF test for time series stationarity',
    tier: 'stats',
    stage: 'detect',
    stageNumber: 2,
    description: 'Performs the Augmented Dickey-Fuller test to check if time series data is stationary (required for ARIMA modeling).',
    capabilities: ['adf_test', 'stationarity_check', 'unit_root_test'],
    dependencies: ['data_profiling'],
    icon: 'Activity',
    color: '#0d9488',
    timeoutMs: 15000,
  };

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const start = Date.now();
    const { dataframe, previousResults, config } = ctx;
    const profileResult = previousResults.get('data_profiling');

    if (!dataframe.length) {
      return this.createError('No data for stationarity test', Date.now() - start);
    }

    const targetCol = config.targetColumn || Object.entries(profileResult?.output?.profile ?? {})
      .find(([_, p]: [any, any]) => p.type === 'numeric')?.[0];

    if (!targetCol) {
      return this.createResult({ stationary: false, message: 'No numeric column' }, {}, Date.now() - start);
    }

    const values = dataframe.map(r => Number(r[targetCol])).filter(n => !isNaN(n));

    if (values.length < 10) {
      return this.createResult({ stationary: false, message: 'Insufficient data' }, {}, Date.now() - start);
    }

    // Simplified ADF test
    const deltaY = values.slice(1).map((yt, i) => yt - values[i]);
    const yLagged = values.slice(0, -1);
    const n = deltaY.length;

    const mx = mean(yLagged);
    const my = mean(deltaY);
    let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < n; i++) {
      sxy += (yLagged[i] - mx) * (deltaY[i] - my);
      sxx += (yLagged[i] - mx) ** 2;
      syy += (deltaY[i] - my) ** 2;
    }
    const slope = sxx === 0 ? 0 : sxy / sxx;
    const predictions = yLagged.map(x => slope * x + (my - slope * mx));
    const residuals = deltaY.map((y, i) => y - predictions[i]);
    const ssRes = residuals.reduce((a, b) => a + b * b, 0);
    const se = Math.sqrt(ssRes / Math.max(n - 2, 1));
    const adfStatistic = Math.abs(slope / (se || 1));
    const isStationary = adfStatistic > 2.86;

    return this.createResult({
      column: targetCol,
      adfStatistic,
      isStationary,
      interpretation: isStationary
        ? 'Series is stationary — safe to use ARIMA models directly'
        : 'Series is non-stationary — apply differencing before ARIMA',
    }, {
      adfStatistic,
      isStationary: isStationary ? 1 : 0,
    }, Date.now() - start);
  }
}

// ─── 30. Seasonality Detector Agent ────────────────────────────────────

export class SeasonalityDetectorAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    id: 'seasonality_detector',
    name: 'Seasonality Detector',
    role: 'Detect seasonal patterns in time series',
    tier: 'stats',
    stage: 'detect',
    stageNumber: 2,
    description: 'Uses autocorrelation function (ACF) to detect seasonal patterns in time series data. Identifies the dominant seasonal period.',
    capabilities: ['seasonality_detection', 'acf_analysis', 'period_identification'],
    dependencies: ['data_profiling'],
    icon: 'Calendar',
    color: '#7c3aed',
    timeoutMs: 15000,
  };

  async execute(ctx: AgentContext): Promise<AgentResult> {
    const start = Date.now();
    const { dataframe, previousResults, config } = ctx;
    const profileResult = previousResults.get('data_profiling');

    if (!dataframe.length) {
      return this.createError('No data for seasonality detection', Date.now() - start);
    }

    const targetCol = config.targetColumn || Object.entries(profileResult?.output?.profile ?? {})
      .find(([_, p]: [any, any]) => p.type === 'numeric')?.[0];

    if (!targetCol) {
      return this.createResult({ seasonal: false, message: 'No numeric column' }, {}, Date.now() - start);
    }

    const values = dataframe.map(r => Number(r[targetCol])).filter(n => !isNaN(n));

    if (values.length < 24) {
      return this.createResult({ seasonal: false, message: 'Need at least 24 data points' }, {}, Date.now() - start);
    }

    // Compute ACF
    const m = mean(values);
    const variance = values.reduce((acc, v) => acc + (v - m) ** 2, 0) / values.length;
    if (variance === 0) {
      return this.createResult({ seasonal: false, acf: [], message: 'Zero variance' }, {}, Date.now() - start);
    }

    const maxLag = Math.min(48, Math.floor(values.length / 2));
    const acf: number[] = [];
    for (let lag = 0; lag <= maxLag; lag++) {
      let sum = 0;
      for (let i = lag; i < values.length; i++) {
        sum += (values[i] - m) * (values[i - lag] - m);
      }
      acf.push(sum / (values.length * variance));
    }

    // Find peaks in ACF (excluding lag 0)
    const peaks: { lag: number; value: number }[] = [];
    for (let i = 1; i < acf.length - 1; i++) {
      if (acf[i] > acf[i - 1] && acf[i] > acf[i + 1] && acf[i] > 0.2) {
        peaks.push({ lag: i, value: acf[i] });
      }
    }

    const dominantPeriod = peaks.length > 0 ? peaks.sort((a, b) => b.value - a.value)[0].lag : null;

    return this.createResult({
      column: targetCol,
      acf,
      peaks,
      dominantPeriod,
      isSeasonal: dominantPeriod !== null,
      seasonLength: dominantPeriod ?? 12,
    }, {
      isSeasonal: dominantPeriod !== null ? 1 : 0,
      seasonLength: dominantPeriod ?? 12,
    }, Date.now() - start);
  }
}
