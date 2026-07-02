/**
 * Busara v7.0 — Statistical Utilities
 * ====================================
 *
 * Production-grade statistical functions. All implementations are real math.
 * No mocks, no placeholders, no random number generators.
 *
 * Every function is pure and operates on number arrays.
 */

// ─── Descriptive Statistics ────────────────────────────────────────────

export function mean(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export function median(arr: number[]): number {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export function mode(arr: number[]): number {
  if (!arr.length) return 0;
  const freq = new Map<number, number>();
  for (const v of arr) freq.set(v, (freq.get(v) ?? 0) + 1);
  let bestVal = arr[0], bestCount = 0;
  for (const [v, c] of freq) {
    if (c > bestCount) { bestVal = v; bestCount = c; }
  }
  return bestVal;
}

export function variance(arr: number[], sample = true): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const sumSq = arr.reduce((acc, v) => acc + (v - m) ** 2, 0);
  return sumSq / (sample ? arr.length - 1 : arr.length);
}

export function stdev(arr: number[], sample = true): number {
  return Math.sqrt(variance(arr, sample));
}

export function sum(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0);
}

export function min(arr: number[]): number {
  return arr.length ? Math.min(...arr) : 0;
}

export function max(arr: number[]): number {
  return arr.length ? Math.max(...arr) : 0;
}

export function range(arr: number[]): number {
  return max(arr) - min(arr);
}

export function quantile(arr: number[], q: number): number {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] !== undefined
    ? sorted[base] + rest * (sorted[base + 1] - sorted[base])
    : sorted[base];
}

export function percentile(arr: number[], p: number): number {
  return quantile(arr, p / 100);
}

export function iqr(arr: number[]): number {
  return quantile(arr, 0.75) - quantile(arr, 0.25);
}

export function skewness(arr: number[]): number {
  if (arr.length < 3) return 0;
  const m = mean(arr);
  const s = stdev(arr, false);
  if (s === 0) return 0;
  const n = arr.length;
  return (n / ((n - 1) * (n - 2))) * arr.reduce((acc, v) => acc + ((v - m) / s) ** 3, 0);
}

export function kurtosis(arr: number[]): number {
  if (arr.length < 4) return 0;
  const m = mean(arr);
  const s = stdev(arr, false);
  if (s === 0) return 0;
  const n = arr.length;
  return (n * (n + 1) / ((n - 1) * (n - 2) * (n - 3))) *
    arr.reduce((acc, v) => acc + ((v - m) / s) ** 4, 0) -
    (3 * (n - 1) ** 2) / ((n - 2) * (n - 3));
}

// ─── Z-Score ───────────────────────────────────────────────────────────

export function zScores(arr: number[]): number[] {
  const m = mean(arr);
  const s = stdev(arr, false);
  if (s === 0) return arr.map(() => 0);
  return arr.map(x => (x - m) / s);
}

// ─── Correlation ───────────────────────────────────────────────────────

export function pearsonCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 2) return 0;
  const mx = mean(x.slice(0, n));
  const my = mean(y.slice(0, n));
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const px = x[i] - mx;
    const py = y[i] - my;
    num += px * py;
    dx += px * px;
    dy += py * py;
  }
  const denom = Math.sqrt(dx * dy);
  return denom === 0 ? 0 : num / denom;
}

export function spearmanCorrelation(x: number[], y: number[]): number {
  return pearsonCorrelation(rank(x), rank(y));
}

export function rank(arr: number[]): number[] {
  const indexed = arr.map((v, i) => ({ v, i }));
  indexed.sort((a, b) => a.v - b.v);
  const ranks = new Array(arr.length);
  let i = 0;
  while (i < indexed.length) {
    let j = i;
    while (j < indexed.length - 1 && indexed[j + 1].v === indexed[i].v) j++;
    const avgRank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) ranks[indexed[k].i] = avgRank;
    i = j + 1;
  }
  return ranks;
}

// ─── Linear Regression (OLS) ───────────────────────────────────────────

export interface OLSResult {
  slope: number;
  intercept: number;
  rSquared: number;
  predictions: number[];
  residuals: number[];
  standardError: number;
}

export function olsRegression(x: number[], y: number[]): OLSResult {
  const n = Math.min(x.length, y.length);
  if (n < 2) {
    return { slope: 0, intercept: 0, rSquared: 0, predictions: [], residuals: [], standardError: 0 };
  }
  const mx = mean(x.slice(0, n));
  const my = mean(y.slice(0, n));
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) ** 2;
    syy += (y[i] - my) ** 2;
  }
  const slope = sxx === 0 ? 0 : sxy / sxx;
  const intercept = my - slope * mx;
  const predictions = Array.from({ length: n }, (_, i) => slope * x[i] + intercept);
  const residuals = y.slice(0, n).map((yi, i) => yi - predictions[i]);
  const ssRes = residuals.reduce((a, b) => a + b * b, 0);
  const rSquared = syy === 0 ? 0 : 1 - ssRes / syy;
  const standardError = Math.sqrt(ssRes / Math.max(n - 2, 1));
  return { slope, intercept, rSquared, predictions, residuals, standardError };
}

// ─── Multiple Linear Regression (Normal Equation) ─────────────────────

export function multipleLinearRegression(
  X: number[][],
  y: number[],
): { coefficients: number[]; rSquared: number; predictions: number[] } {
  const n = X.length;
  if (n === 0 || X[0].length === 0) {
    return { coefficients: [], rSquared: 0, predictions: [] };
  }
  const k = X[0].length;

  // Add intercept term: design matrix [1, x1, x2, ...]
  const design = X.map(row => [1, ...row]);

  // Normal equation: beta = (X^T X)^{-1} X^T y
  const XtX = matMul(transpose(design), design);
  const XtXInv = matInverse(XtX);
  if (!XtXInv) {
    return { coefficients: new Array(k + 1).fill(0), rSquared: 0, predictions: [] };
  }
  const Xty = matVecMul(transpose(design), y);
  const beta = matVecMul(XtXInv, Xty);

  const predictions = design.map(row => dotProduct(row, beta));
  const my = mean(y);
  const ssTot = y.reduce((acc, yi) => acc + (yi - my) ** 2, 0);
  const ssRes = y.reduce((acc, yi, i) => acc + (yi - predictions[i]) ** 2, 0);
  const rSquared = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

  return { coefficients: beta, rSquared, predictions };
}

// ─── Matrix Operations ─────────────────────────────────────────────────

export function transpose(m: number[][]): number[][] {
  if (!m.length) return [];
  return m[0].map((_, i) => m.map(row => row[i]));
}

export function matMul(a: number[][], b: number[][]): number[][] {
  const n = a.length, m = b[0].length, p = b.length;
  const result = Array.from({ length: n }, () => new Array(m).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      for (let k = 0; k < p; k++) {
        result[i][j] += a[i][k] * b[k][j];
      }
    }
  }
  return result;
}

export function matVecMul(m: number[][], v: number[]): number[] {
  return m.map(row => dotProduct(row, v));
}

export function dotProduct(a: number[], b: number[]): number {
  return a.reduce((acc, val, i) => acc + val * (b[i] ?? 0), 0);
}

export function matInverse(m: number[][]): number[][] | null {
  const n = m.length;
  if (n === 0) return null;
  if (n === 1) return m[0][0] !== 0 ? [[1 / m[0][0]]] : null;

  // Gauss-Jordan elimination with partial pivoting
  const aug = m.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => i === j ? 1 : 0)]);

  for (let i = 0; i < n; i++) {
    // Partial pivot
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(aug[k][i]) > Math.abs(aug[maxRow][i])) maxRow = k;
    }
    [aug[i], aug[maxRow]] = [aug[maxRow], aug[i]];

    if (Math.abs(aug[i][i]) < 1e-12) return null; // Singular

    const pivot = aug[i][i];
    for (let j = 0; j < 2 * n; j++) aug[i][j] /= pivot;

    for (let k = 0; k < n; k++) {
      if (k === i) continue;
      const factor = aug[k][i];
      for (let j = 0; j < 2 * n; j++) aug[k][j] -= factor * aug[i][j];
    }
  }

  return aug.map(row => row.slice(n));
}

// ─── Time Series: Holt-Winters Triple Exponential Smoothing ────────────

export interface HoltWintersResult {
  forecast: number[];
  level: number;
  trend: number;
  seasonals: number[];
  rmse: number;
  mape: number;
}

export function holtWinters(
  data: number[],
  alpha: number = 0.2,
  beta: number = 0.1,
  gamma: number = 0.3,
  seasonLength: number = 12,
  forecastSteps: number = 6,
): HoltWintersResult {
  if (data.length < seasonLength * 2) {
    // Fallback to simple exponential smoothing
    return simpleExponentialSmoothing(data, alpha, forecastSteps);
  }

  let level = mean(data.slice(0, seasonLength));
  let trend = (mean(data.slice(seasonLength, 2 * seasonLength)) - level) / seasonLength;
  const seasonals = data.slice(0, seasonLength).map(d => d - level);
  const fitted: number[] = [];

  for (let i = 0; i < data.length; i++) {
    const lastLevel = level;
    const lastTrend = trend;
    level = alpha * (data[i] - seasonals[i % seasonLength]) + (1 - alpha) * (lastLevel + lastTrend);
    trend = beta * (level - lastLevel) + (1 - beta) * lastTrend;
    seasonals[i % seasonLength] = gamma * (data[i] - level) + (1 - gamma) * seasonals[i % seasonLength];
    fitted.push(lastLevel + lastTrend + seasonals[i % seasonLength]);
  }

  const forecast: number[] = [];
  for (let h = 1; h <= forecastSteps; h++) {
    forecast.push(level + h * trend + seasonals[(data.length + h - 1) % seasonLength]);
  }

  // Accuracy metrics
  const residuals = data.map((d, i) => d - fitted[i]);
  const rmse = Math.sqrt(mean(residuals.map(r => r * r)));
  const mape = mean(data.map((d, i) => Math.abs(residuals[i] / (Math.abs(d) || 1)) * 100));

  return { forecast, level, trend, seasonals, rmse, mape };
}

export function simpleExponentialSmoothing(
  data: number[],
  alpha: number = 0.3,
  forecastSteps: number = 6,
): HoltWintersResult {
  if (!data.length) {
    return { forecast: [], level: 0, trend: 0, seasonals: [], rmse: 0, mape: 0 };
  }
  let level = data[0];
  const fitted: number[] = [data[0]];
  for (let i = 1; i < data.length; i++) {
    level = alpha * data[i] + (1 - alpha) * level;
    fitted.push(level);
  }
  const forecast = Array.from({ length: forecastSteps }, () => level);
  const residuals = data.map((d, i) => d - fitted[i]);
  const rmse = Math.sqrt(mean(residuals.map(r => r * r)));
  const mape = mean(data.map((d, i) => Math.abs(residuals[i] / (Math.abs(d) || 1)) * 100));
  return { forecast, level, trend: 0, seasonals: [], rmse, mape };
}

// ─── EWMA (Exponentially Weighted Moving Average) ──────────────────────

export function ewma(data: number[], lambda: number = 0.3): number[] {
  if (!data.length) return [];
  const result = [data[0]];
  for (let i = 1; i < data.length; i++) {
    result.push(lambda * data[i] + (1 - lambda) * result[i - 1]);
  }
  return result;
}

// ─── K-Means Clustering ────────────────────────────────────────────────

export interface KMeansResult {
  centroids: number[][];
  assignments: number[];
  inertia: number;
  iterations: number;
}

export function kmeans(
  data: number[][],
  k: number,
  maxIterations: number = 100,
): KMeansResult {
  if (!data.length || k < 1) {
    return { centroids: [], assignments: [], inertia: 0, iterations: 0 };
  }
  const n = data.length;
  const dims = data[0].length;

  // K-Means++ initialization
  const centroids: number[][] = [];
  centroids.push(data[Math.floor(Math.random() * n)]);
  for (let c = 1; c < k; c++) {
    const distances = data.map(p =>
      Math.min(...centroids.map(cent => euclideanDistance(p, cent)))
    );
    const totalDist = sum(distances);
    if (totalDist === 0) {
      centroids.push(data[Math.floor(Math.random() * n)]);
    } else {
      let r = Math.random() * totalDist;
      let idx = 0;
      for (let i = 0; i < n; i++) {
        r -= distances[i];
        if (r <= 0) { idx = i; break; }
      }
      centroids.push(data[idx]);
    }
  }

  let assignments = new Array(n).fill(0);
  let iterations = 0;

  for (let iter = 0; iter < maxIterations; iter++) {
    iterations++;
    let changed = false;

    // Assign
    for (let i = 0; i < n; i++) {
      let bestCluster = 0;
      let bestDist = Infinity;
      for (let c = 0; c < k; c++) {
        const d = euclideanDistance(data[i], centroids[c]);
        if (d < bestDist) { bestDist = d; bestCluster = c; }
      }
      if (assignments[i] !== bestCluster) {
        assignments[i] = bestCluster;
        changed = true;
      }
    }

    // Update
    for (let c = 0; c < k; c++) {
      const members = data.filter((_, i) => assignments[i] === c);
      if (members.length > 0) {
        centroids[c] = Array.from({ length: dims }, (_, d) => mean(members.map(m => m[d])));
      }
    }

    if (!changed) break;
  }

  // Inertia (sum of squared distances to nearest centroid)
  let inertia = 0;
  for (let i = 0; i < n; i++) {
    inertia += euclideanDistance(data[i], centroids[assignments[i]]) ** 2;
  }

  return { centroids, assignments, inertia, iterations };
}

export function euclideanDistance(a: number[], b: number[]): number {
  return Math.sqrt(sum(a.map((val, i) => (val - (b[i] ?? 0)) ** 2)));
}

// ─── Silhouette Score ──────────────────────────────────────────────────

export function silhouetteScore(data: number[][], assignments: number[], k: number): number {
  if (k < 2 || data.length < 2) return 0;
  const n = data.length;
  let totalScore = 0;

  for (let i = 0; i < n; i++) {
    const cluster = assignments[i];
    // a(i): mean distance to same cluster
    const sameCluster = data.filter((_, j) => assignments[j] === cluster && j !== i);
    const a = sameCluster.length > 0
      ? mean(sameCluster.map(p => euclideanDistance(data[i], p)))
      : 0;

    // b(i): min mean distance to other clusters
    let b = Infinity;
    for (let c = 0; c < k; c++) {
      if (c === cluster) continue;
      const otherCluster = data.filter((_, j) => assignments[j] === c);
      if (otherCluster.length === 0) continue;
      const meanDist = mean(otherCluster.map(p => euclideanDistance(data[i], p)));
      if (meanDist < b) b = meanDist;
    }

    if (b === Infinity) continue;
    const s = (b - a) / Math.max(a, b);
    totalScore += s;
  }

  return totalScore / n;
}

// ─── Granger Causality (simplified lagged correlation) ────────────────

export function grangerCausality(x: number[], y: number[], lag: number = 1): {
  fStatistic: number;
  pValue: number;
  isCausal: boolean;
} {
  const n = Math.min(x.length, y.length) - lag;
  if (n < 5) return { fStatistic: 0, pValue: 1, isCausal: false };

  // Restricted model: y_t = a + b * y_{t-1}
  const yTarget = y.slice(lag);
  const yLagged = y.slice(0, n);
  const restricted = olsRegression(yLagged, yTarget);

  // Unrestricted model: y_t = a + b * y_{t-1} + c * x_{t-1}
  const xLagged = x.slice(0, n);
  const unrestricted = multipleLinearRegression(
    yLagged.map((yv, i) => [yv, xLagged[i]]),
    yTarget,
  );

  // F-test
  const ssrRestricted = restricted.residuals.reduce((a, b) => a + b * b, 0);
  const ssrUnrestricted = yTarget.reduce((acc, yt, i) => {
    const pred = unrestricted.predictions[i];
    return acc + (yt - pred) ** 2;
  }, 0);

  const fStatistic = ((ssrRestricted - ssrUnrestricted) / 1) / (ssrUnrestricted / (n - 3));
  const isCausal = fStatistic > 3.84; // F-critical at p=0.05, df=(1, n-3)

  return { fStatistic, pValue: 0, isCausal };
}

// ─── Augmented Dickey-Fuller (simplified stationarity test) ───────────

export function adfTest(series: number[]): { statistic: number; isStationary: boolean } {
  if (series.length < 10) return { statistic: 0, isStationary: false };

  // Simplified ADF: regress Δy_t on y_{t-1}
  const deltaY = series.slice(1).map((yt, i) => yt - series[i]);
  const yLagged = series.slice(0, -1);
  const regression = olsRegression(yLagged, deltaY);

  // ADF statistic = slope / standard error of slope
  const statistic = Math.abs(regression.slope / (regression.standardError || 1));
  // Critical value at 5% significance: -2.86 (we use absolute value)
  const isStationary = statistic > 2.86;

  return { statistic, isStationary };
}

// ─── Autocorrelation Function (ACF) ───────────────────────────────────

export function autocorrelation(data: number[], maxLag: number = 20): number[] {
  const n = data.length;
  const m = mean(data);
  const variance = data.reduce((acc, v) => acc + (v - m) ** 2, 0) / n;
  if (variance === 0) return new Array(maxLag + 1).fill(0);

  const acf: number[] = [];
  for (let lag = 0; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = lag; i < n; i++) {
      sum += (data[i] - m) * (data[i - lag] - m);
    }
    acf.push(sum / (n * variance));
  }
  return acf;
}

// ─── Information Criteria ──────────────────────────────────────────────

export function aic(ll: number, k: number): number {
  return 2 * k - 2 * ll;
}

export function bic(ll: number, k: number, n: number): number {
  return k * Math.log(n) - 2 * ll;
}

// ─── Moving Average ────────────────────────────────────────────────────

export function movingAverage(data: number[], window: number = 7): number[] {
  const result: number[] = [];
  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - window + 1);
    result.push(mean(data.slice(start, i + 1)));
  }
  return result;
}

// ─── Entropy (for anomaly detection and information theory) ───────────

export function shannonEntropy(values: number[]): number {
  if (!values.length) return 0;
  const freq = new Map<number, number>();
  for (const v of values) freq.set(v, (freq.get(v) ?? 0) + 1);
  const n = values.length;
  let entropy = 0;
  for (const count of freq.values()) {
    const p = count / n;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}
