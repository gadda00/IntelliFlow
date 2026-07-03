// Statistics utilities — real implementations, no mocks.
// All functions are pure and work on plain number arrays or row objects.

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
  const k = (n * (n + 1) / ((n - 1) * (n - 2) * (n - 3))) *
    arr.reduce((acc, v) => acc + ((v - m) / s) ** 4, 0) -
    (3 * (n - 1) ** 2) / ((n - 2) * (n - 3));
  return k;
}

export function correlation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 2) return 0;
  const mx = mean(x.slice(0, n));
  const my = mean(y.slice(0, n));
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const a = x[i] - mx, b = y[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  const denom = Math.sqrt(dx * dy);
  return denom === 0 ? 0 : num / denom;
}

export interface ColumnStats {
  count: number;
  missing: number;
  unique: number;
  mean: number | null;
  median: number | null;
  stdev: number | null;
  min: number | null;
  max: number | null;
  q25: number | null;
  q75: number | null;
  skewness: number | null;
  kurtosis: number | null;
  type: 'numeric' | 'categorical' | 'datetime' | 'boolean' | 'empty';
  topValues?: { value: any; count: number }[];
}

export function detectColumnType(values: any[]): ColumnStats['type'] {
  const nonNull = values.filter(v => v !== null && v !== undefined && v !== '');
  if (!nonNull.length) return 'empty';

  const numericCount = nonNull.filter(v => {
    if (typeof v === 'number') return true;
    if (typeof v === 'string') return v.trim() !== '' && !isNaN(Number(v));
    return false;
  }).length;

  const boolCount = nonNull.filter(v => {
    if (typeof v === 'boolean') return true;
    if (typeof v === 'string') return ['true', 'false', 'yes', 'no', '0', '1'].includes(v.toLowerCase());
    return false;
  }).length;

  const dateCount = nonNull.filter(v => {
    if (v instanceof Date) return true;
    if (typeof v === 'string') {
      const parsed = Date.parse(v);
      return !isNaN(parsed) && /\d{4}-\d{2}-\d{2}/.test(v);
    }
    return false;
  }).length;

  if (numericCount / nonNull.length > 0.85) return 'numeric';
  if (boolCount / nonNull.length > 0.85) return 'boolean';
  if (dateCount / nonNull.length > 0.7) return 'datetime';

  const unique = new Set(nonNull.map(String)).size;
  return unique / nonNull.length < 0.5 ? 'categorical' : 'categorical';
}

export function computeColumnStats(values: any[]): ColumnStats {
  const type = detectColumnType(values);
  const nonNull = values.filter(v => v !== null && v !== undefined && v !== '');
  const missing = values.length - nonNull.length;
  const unique = new Set(nonNull.map(v => String(v))).size;

  const stats: ColumnStats = {
    count: values.length,
    missing,
    unique,
    mean: null,
    median: null,
    stdev: null,
    min: null,
    max: null,
    q25: null,
    q75: null,
    skewness: null,
    kurtosis: null,
    type,
  };

  if (type === 'numeric') {
    const nums = nonNull.map(Number).filter(n => !isNaN(n));
    stats.mean = mean(nums);
    stats.median = median(nums);
    stats.stdev = stdev(nums);
    stats.min = min(nums);
    stats.max = max(nums);
    stats.q25 = quantile(nums, 0.25);
    stats.q75 = quantile(nums, 0.75);
    stats.skewness = skewness(nums);
    stats.kurtosis = kurtosis(nums);
  } else if (type === 'categorical' || type === 'boolean') {
    const counts = new Map<string, number>();
    nonNull.forEach(v => {
      const k = String(v);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    });
    stats.topValues = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([value, count]) => ({ value, count }));
  }

  return stats;
}

export interface DatasetProfile {
  rowCount: number;
  columnCount: number;
  columns: { name: string; stats: ColumnStats }[];
  missingCells: number;
  totalCells: number;
  duplicateRows: number;
  memorySizeBytes: number;
  qualityScore: number; // 0-100
}

export function profileDataset(rows: any[]): DatasetProfile {
  if (!rows.length) {
    return {
      rowCount: 0, columnCount: 0, columns: [],
      missingCells: 0, totalCells: 0, duplicateRows: 0,
      memorySizeBytes: 0, qualityScore: 0,
    };
  }
  const columns = Object.keys(rows[0]);
  const columnStats = columns.map(name => ({
    name,
    stats: computeColumnStats(rows.map(r => r[name])),
  }));

  const totalCells = rows.length * columns.length;
  const missingCells = columnStats.reduce((acc, c) => acc + c.stats.missing, 0);

  // Duplicate detection via row signature
  const seen = new Set<string>();
  let duplicateRows = 0;
  for (const r of rows) {
    const sig = JSON.stringify(columns.map(c => r[c]));
    if (seen.has(sig)) duplicateRows++;
    else seen.add(sig);
  }

  const memorySizeBytes = JSON.stringify(rows).length;
  const completeness = 1 - missingCells / totalCells;
  const uniqueness = 1 - duplicateRows / rows.length;
  const qualityScore = Math.round((completeness * 0.6 + uniqueness * 0.4) * 100);

  return {
    rowCount: rows.length,
    columnCount: columns.length,
    columns: columnStats,
    missingCells,
    totalCells,
    duplicateRows,
    memorySizeBytes,
    qualityScore,
  };
}

// ─── Anomaly Detection Algorithms ─────────────────────────────────────────
export function zScoreAnomalies(values: number[], threshold = 3): { index: number; value: number; zScore: number }[] {
  const m = mean(values);
  const s = stdev(values);
  if (s === 0) return [];
  const anomalies: { index: number; value: number; zScore: number }[] = [];
  values.forEach((v, i) => {
    const z = Math.abs((v - m) / s);
    if (z > threshold) anomalies.push({ index: i, value: v, zScore: z });
  });
  return anomalies;
}

export function iqrAnomalies(values: number[]): { index: number; value: number; reason: string }[] {
  const q1 = quantile(values, 0.25);
  const q3 = quantile(values, 0.75);
  const range = q3 - q1;
  const lower = q1 - 1.5 * range;
  const upper = q3 + 1.5 * range;
  const anomalies: { index: number; value: number; reason: string }[] = [];
  values.forEach((v, i) => {
    if (v < lower) anomalies.push({ index: i, value: v, reason: `Below lower bound (${lower.toFixed(2)})` });
    else if (v > upper) anomalies.push({ index: i, value: v, reason: `Above upper bound (${upper.toFixed(2)})` });
  });
  return anomalies;
}

export function ewmaAnomalies(values: number[], lambda = 0.3, threshold = 3): { index: number; value: number; ewma: number }[] {
  if (values.length < 2) return [];
  let ewma = values[0];
  const ewmaVar = (vals: number[], m: number) => mean(vals.map(v => (v - m) ** 2));
  const anomalies: { index: number; value: number; ewma: number }[] = [];
  const m = mean(values);
  const sigma = Math.sqrt(ewmaVar(values, m));

  for (let i = 1; i < values.length; i++) {
    ewma = lambda * values[i] + (1 - lambda) * ewma;
    if (sigma > 0 && Math.abs(values[i] - ewma) / sigma > threshold) {
      anomalies.push({ index: i, value: values[i], ewma });
    }
  }
  return anomalies;
}

// ─── Time Series Forecasting ───────────────────────────────────────────────
export interface ForecastPoint {
  timestamp: number;
  value: number;
  lower: number;
  upper: number;
}

export function holtWintersForecast(
  values: number[],
  periods: number = 12,
  alpha = 0.3,
  beta = 0.1,
  gamma = 0.3,
  seasonLength = 12,
): { forecast: ForecastPoint[]; method: string; accuracy: number } {
  if (values.length < seasonLength * 2) {
    // Fallback to simple exponential smoothing
    return simpleExpSmoothing(values, periods, alpha);
  }

  const n = values.length;
  const level = values[0];
  const trend = (values.slice(0, seasonLength).reduce((a, b) => a + b, 0) / seasonLength) - level;
  const seasonals: number[] = [];
  const seasonAvg = values.slice(0, seasonLength).reduce((a, b) => a + b, 0) / seasonLength;
  for (let i = 0; i < seasonLength; i++) {
    seasonals.push(values[i] - seasonAvg);
  }

  let L = level, T = trend;
  const fitted: number[] = [];
  for (let i = 0; i < n; i++) {
    const s = seasonals[i % seasonLength];
    const forecast = L + T + s;
    fitted.push(forecast);
    const newL = alpha * (values[i] - s) + (1 - alpha) * (L + T);
    const newT = beta * (newL - L) + (1 - beta) * T;
    const newS = gamma * (values[i] - newL) + (1 - gamma) * s;
    L = newL; T = newT;
    seasonals[i % seasonLength] = newS;
  }

  // Compute accuracy (1 - MAPE)
  const mape = mean(fitted.map((f, i) => Math.abs((values[i] - f) / (values[i] || 1)))) * 100;
  const accuracy = Math.max(0, Math.min(100, 100 - mape));

  const forecast: ForecastPoint[] = [];
  const lastValue = values[n - 1];
  const sigma = stdev(values.map((v, i) => v - fitted[i]));
  for (let h = 1; h <= periods; h++) {
    const s = seasonals[(n + h - 1) % seasonLength];
    const point = L + h * T + s;
    const interval = 1.96 * sigma * Math.sqrt(h);
    forecast.push({
      timestamp: n + h,
      value: Number(point.toFixed(4)),
      lower: Number((point - interval).toFixed(4)),
      upper: Number((point + interval).toFixed(4)),
    });
    void lastValue;
  }

  return { forecast, method: 'Holt-Winters Triple Exponential Smoothing', accuracy: Number(accuracy.toFixed(2)) };
}

export function simpleExpSmoothing(
  values: number[],
  periods: number,
  alpha = 0.3,
): { forecast: ForecastPoint[]; method: string; accuracy: number } {
  if (!values.length) return { forecast: [], method: 'Simple Exponential Smoothing', accuracy: 0 };
  let level = values[0];
  const fitted: number[] = [level];
  for (let i = 1; i < values.length; i++) {
    level = alpha * values[i] + (1 - alpha) * level;
    fitted.push(level);
  }
  const mape = mean(fitted.map((f, i) => Math.abs((values[i] - f) / (values[i] || 1)))) * 100;
  const accuracy = Math.max(0, Math.min(100, 100 - mape));
  const sigma = stdev(values.map((v, i) => v - fitted[i]));
  const forecast: ForecastPoint[] = [];
  for (let h = 1; h <= periods; h++) {
    const interval = 1.96 * sigma * Math.sqrt(h);
    forecast.push({
      timestamp: values.length + h,
      value: Number(level.toFixed(4)),
      lower: Number((level - interval).toFixed(4)),
      upper: Number((level + interval).toFixed(4)),
    });
  }
  return { forecast, method: 'Simple Exponential Smoothing', accuracy: Number(accuracy.toFixed(2)) };
}

// ─── Linear Regression & Causal Analysis ───────────────────────────────────
export interface RegressionResult {
  slope: number;
  intercept: number;
  r2: number;
  predictions: number[];
  residuals: number[];
}

export function linearRegression(x: number[], y: number[]): RegressionResult {
  const n = Math.min(x.length, y.length);
  const mx = mean(x.slice(0, n));
  const my = mean(y.slice(0, n));
  let num = 0, denom = 0;
  for (let i = 0; i < n; i++) {
    num += (x[i] - mx) * (y[i] - my);
    denom += (x[i] - mx) ** 2;
  }
  const slope = denom === 0 ? 0 : num / denom;
  const intercept = my - slope * mx;
  const predictions = x.slice(0, n).map(xi => slope * xi + intercept);
  const residuals = y.slice(0, n).map((yi, i) => yi - predictions[i]);
  const ssRes = sum(residuals.map(r => r * r));
  const ssTot = sum(y.slice(0, n).map(yi => (yi - my) ** 2));
  const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot;
  return { slope, intercept, r2, predictions, residuals };
}

export function multipleRegression(X: number[][], y: number[]): {
  coefficients: number[];
  intercept: number;
  r2: number;
  predictions: number[];
} {
  // Ordinary Least Squares via normal equation: beta = (X^T X)^-1 X^T y
  const n = X.length;
  if (n === 0) return { coefficients: [], intercept: 0, r2: 0, predictions: [] };
  const k = X[0].length;

  // Add bias column
  const Xb = X.map(row => [1, ...row]);
  const Xt = transpose(Xb);
  const XtX = matMul(Xt, Xb);
  const XtXInv = invertMatrix(XtX);
  if (!XtXInv) {
    // fallback — use ridge regression with small lambda
    const ridge = XtX.map((row, i) => row.map((v, j) => v + (i === j ? 0.01 : 0)));
    const ridgeInv = invertMatrix(ridge);
    if (!ridgeInv) return { coefficients: new Array(k).fill(0), intercept: 0, r2: 0, predictions: [] };
    const Xty = matVec(Xt, y);
    const beta = matVec(ridgeInv, Xty);
    const predictions = Xb.map(row => dot(row, beta));
    const my = mean(y);
    const ssRes = sum(predictions.map((p, i) => (y[i] - p) ** 2));
    const ssTot = sum(y.map(yi => (yi - my) ** 2));
    const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot;
    return { coefficients: beta.slice(1), intercept: beta[0], r2, predictions };
  }
  const Xty = matVec(Xt, y);
  const beta = matVec(XtXInv, Xty);
  const predictions = Xb.map(row => dot(row, beta));
  const my = mean(y);
  const ssRes = sum(predictions.map((p, i) => (y[i] - p) ** 2));
  const ssTot = sum(y.map(yi => (yi - my) ** 2));
  const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot;
  return { coefficients: beta.slice(1), intercept: beta[0], r2, predictions };
}

function transpose(m: number[][]): number[][] {
  return m[0].map((_, j) => m.map(row => row[j]));
}
function matMul(a: number[][], b: number[][]): number[][] {
  const n = a.length, m = b[0].length, k = b.length;
  const result: number[][] = Array.from({ length: n }, () => new Array(m).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      for (let l = 0; l < k; l++) result[i][j] += a[i][l] * b[l][j];
    }
  }
  return result;
}
function matVec(m: number[][], v: number[]): number[] {
  return m.map(row => dot(row, v));
}
function dot(a: number[], b: number[]): number {
  return a.reduce((acc, _, i) => acc + a[i] * b[i], 0);
}
function invertMatrix(m: number[][]): number[][] | null {
  const n = m.length;
  if (n === 0) return null;
  const aug = m.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => i === j ? 1 : 0)]);
  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(aug[k][i]) > Math.abs(aug[maxRow][i])) maxRow = k;
    }
    [aug[i], aug[maxRow]] = [aug[maxRow], aug[i]];
    if (Math.abs(aug[i][i]) < 1e-10) return null;
    for (let k = 0; k < n; k++) {
      if (k === i) continue;
      const factor = aug[k][i] / aug[i][i];
      for (let j = i; j < 2 * n; j++) aug[k][j] -= factor * aug[i][j];
    }
  }
  return aug.map(row => row.slice(n).map(v => v / row[n - 1] || 0));
}

// ─── Feature Importance (permutation-based, SHAP-lite) ──────────────────────
export function permutationImportance(
  features: number[][],
  featureNames: string[],
  target: number[],
  baselineR2: number,
): { feature: string; importance: number }[] {
  // Simple permutation: shuffle each feature, recompute R2, drop = importance
  const importances = featureNames.map((name, colIdx) => {
    const shuffled = features.map(row => [...row]);
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i][colIdx], shuffled[j][colIdx]] = [shuffled[j][colIdx], shuffled[i][colIdx]];
    }
    const { r2 } = multipleRegression(shuffled, target);
    return { feature: name, importance: baselineR2 - r2 };
  });
  return importances.sort((a, b) => b.importance - a.importance);
}

// ─── Clustering (K-means) ──────────────────────────────────────────────────
export function kMeans(points: number[][], k: number, maxIter = 100): {
  centroids: number[][];
  assignments: number[];
  iterations: number;
  inertia: number;
} {
  if (!points.length || k < 1) return { centroids: [], assignments: [], iterations: 0, inertia: 0 };
  k = Math.min(k, points.length);
  // Init: pick k random distinct points
  const indices = new Set<number>();
  while (indices.size < k) indices.add(Math.floor(Math.random() * points.length));
  let centroids = Array.from(indices).map(i => [...points[i]]);
  let assignments = new Array(points.length).fill(0);
  let iter = 0;

  for (; iter < maxIter; iter++) {
    let changed = false;
    // Assign
    for (let i = 0; i < points.length; i++) {
      let best = 0, bestDist = Infinity;
      for (let c = 0; c < k; c++) {
        const d = euclideanSquared(points[i], centroids[c]);
        if (d < bestDist) { bestDist = d; best = c; }
      }
      if (assignments[i] !== best) {
        assignments[i] = best;
        changed = true;
      }
    }
    if (!changed && iter > 0) break;
    // Update
    const sums = Array.from({ length: k }, () => new Array(points[0].length).fill(0));
    const counts = new Array(k).fill(0);
    for (let i = 0; i < points.length; i++) {
      counts[assignments[i]]++;
      for (let j = 0; j < points[i].length; j++) sums[assignments[i]][j] += points[i][j];
    }
    centroids = sums.map((s, i) => counts[i] ? s.map(v => v / counts[i]) : centroids[i]);
  }

  let inertia = 0;
  for (let i = 0; i < points.length; i++) {
    inertia += euclideanSquared(points[i], centroids[assignments[i]]);
  }

  return { centroids, assignments, iterations: iter, inertia };
}

function euclideanSquared(a: number[], b: number[]): number {
  return a.reduce((acc, _, i) => acc + (a[i] - b[i]) ** 2, 0);
}

// ─── PII Detection ─────────────────────────────────────────────────────────
const PII_PATTERNS: { type: string; regex: RegExp; confidence: number }[] = [
  { type: 'email', regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i, confidence: 0.95 },
  { type: 'phone', regex: /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/, confidence: 0.7 },
  { type: 'ssn', regex: /\b\d{3}-\d{2}-\d{4}\b/, confidence: 0.9 },
  { type: 'credit_card', regex: /\b(?:\d[ -]*?){13,16}\b/, confidence: 0.6 },
  { type: 'ip_address', regex: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/, confidence: 0.85 },
  { type: 'date_of_birth', regex: /\b\d{4}-\d{2}-\d{2}\b/, confidence: 0.4 },
  { type: 'iban', regex: /\b[A-Z]{2}\d{2}[A-Z0-9]{4,30}\b/, confidence: 0.85 },
];

const PII_COLUMN_NAMES: { type: string; patterns: string[] }[] = [
  { type: 'name', patterns: ['name', 'first_name', 'last_name', 'full_name', 'username'] },
  { type: 'email', patterns: ['email', 'e-mail', 'mail'] },
  { type: 'phone', patterns: ['phone', 'mobile', 'tel', 'telephone'] },
  { type: 'address', patterns: ['address', 'street', 'city', 'zip', 'postal'] },
  { type: 'ssn', patterns: ['ssn', 'social_security', 'national_id'] },
  { type: 'date_of_birth', patterns: ['dob', 'birth_date', 'birthday', 'date_of_birth'] },
  { type: 'gender', patterns: ['gender', 'sex'] },
  { type: 'race', patterns: ['race', 'ethnicity'] },
  { type: 'religion', patterns: ['religion', 'faith'] },
];

export interface PIIFinding {
  column: string;
  piiType: string;
  confidence: number;
  detectionMethod: 'pattern' | 'column_name';
  sampleMatches: string[];
  recommendation: string;
}

export function detectPII(rows: any[]): PIIFinding[] {
  if (!rows.length) return [];
  const columns = Object.keys(rows[0]);
  const findings: PIIFinding[] = [];

  for (const col of columns) {
    const values = rows.slice(0, 100).map(r => String(r[col] ?? ''));
    const sample = values.filter(v => v).slice(0, 5);

    // Check column name
    for (const { type, patterns } of PII_COLUMN_NAMES) {
      if (patterns.some(p => col.toLowerCase().includes(p))) {
        findings.push({
          column: col,
          piiType: type,
          confidence: 0.85,
          detectionMethod: 'column_name',
          sampleMatches: sample,
          recommendation: getPIIRecommendation(type),
        });
        break;
      }
    }

    // Check value patterns
    for (const { type, regex, confidence } of PII_PATTERNS) {
      const matches = values.filter(v => regex.test(v));
      if (matches.length > values.length * 0.3) {
        findings.push({
          column: col,
          piiType: type,
          confidence,
          detectionMethod: 'pattern',
          sampleMatches: matches.slice(0, 5),
          recommendation: getPIIRecommendation(type),
        });
        break;
      }
    }
  }

  return findings;
}

function getPIIRecommendation(type: string): string {
  const recs: Record<string, string> = {
    email: 'Hash, mask (e.g., j***@example.com), or remove before sharing.',
    phone: 'Mask all but last 4 digits, or remove entirely.',
    ssn: 'Remove immediately. Use tokenization if storage required.',
    credit_card: 'PCI-DSS applies. Tokenize or remove. Never store CVV.',
    ip_address: 'Hash or truncate last octet (e.g., 192.168.1.***) for analytics.',
    date_of_birth: 'Convert to age brackets (e.g., 25-34) for analytics.',
    name: 'Pseudonymize with a stable ID; keep mapping in separate secure store.',
    address: 'Aggregate to city/region level unless street-level required.',
    gender: 'Allow self-identification; consider making optional.',
    race: 'Sensitive data. Strongly consider removal unless legally required.',
    religion: 'Sensitive data. Strongly consider removal unless legally required.',
    iban: 'Tokenize. Do not store in plaintext.',
  };
  return recs[type] ?? 'Review and apply appropriate masking or removal.';
}

// ─── Data Quality Scoring ──────────────────────────────────────────────────
export interface DataQualityReport {
  overallScore: number;
  completeness: number;
  uniqueness: number;
  validity: number;
  consistency: number;
  issues: { severity: 'critical' | 'warning' | 'info'; category: string; description: string; affectedColumns: string[]; recommendation: string }[];
}

export function assessDataQuality(rows: any[]): DataQualityReport {
  if (!rows.length) {
    return {
      overallScore: 0, completeness: 0, uniqueness: 0, validity: 0, consistency: 0,
      issues: [{ severity: 'critical', category: 'empty', description: 'Dataset is empty', affectedColumns: [], recommendation: 'Provide data with at least one row.' }],
    };
  }

  const profile = profileDataset(rows);
  const issues: DataQualityReport['issues'] = [];
  let validityIssues = 0;

  // Completeness
  const completeness = 1 - profile.missingCells / profile.totalCells;
  if (completeness < 0.95) {
    issues.push({
      severity: completeness < 0.8 ? 'critical' : 'warning',
      category: 'completeness',
      description: `${profile.missingCells} missing cells across dataset (${((1 - completeness) * 100).toFixed(1)}%)`,
      affectedColumns: profile.columns.filter(c => c.stats.missing > 0).map(c => c.name),
      recommendation: 'Consider imputation (mean/median for numeric, mode for categorical) or row removal if missingness is low.',
    });
  }

  // Uniqueness
  const uniqueness = 1 - profile.duplicateRows / profile.rowCount;
  if (profile.duplicateRows > 0) {
    issues.push({
      severity: profile.duplicateRows / profile.rowCount > 0.1 ? 'critical' : 'warning',
      category: 'uniqueness',
      description: `${profile.duplicateRows} duplicate rows detected (${((1 - uniqueness) * 100).toFixed(1)}%)`,
      affectedColumns: [],
      recommendation: 'Investigate duplicates. Drop if true duplicates; investigate if legitimate.',
    });
  }

  // Per-column validity
  for (const col of profile.columns) {
    if (col.stats.type === 'numeric' && col.stats.skewness !== null) {
      if (Math.abs(col.stats.skewness) > 2) {
        issues.push({
          severity: 'info',
          category: 'distribution',
          description: `Column "${col.name}" has high skewness (${col.stats.skewness.toFixed(2)}). Consider log transformation.`,
          affectedColumns: [col.name],
          recommendation: 'Apply log/sqrt transformation if using linear models.',
        });
      }
    }
    if (col.stats.missing > col.stats.count * 0.5) {
      validityIssues += col.stats.missing;
      issues.push({
        severity: 'critical',
        category: 'sparse_column',
        description: `Column "${col.name}" is over 50% empty.`,
        affectedColumns: [col.name],
        recommendation: 'Consider dropping the column or investigating collection issues.',
      });
    }
    if (col.stats.type === 'categorical' && col.stats.unique > col.stats.count * 0.95) {
      issues.push({
        severity: 'info',
        category: 'cardinality',
        description: `Column "${col.name}" has very high cardinality (${col.stats.unique} unique values).`,
        affectedColumns: [col.name],
        recommendation: 'Likely an ID column. Exclude from analysis or use as index.',
      });
    }
  }

  const validity = 1 - validityIssues / profile.totalCells;
  const consistency = 1; // placeholder — would check cross-column constraints
  const overallScore = Math.round(
    (completeness * 0.35 + uniqueness * 0.2 + validity * 0.3 + consistency * 0.15) * 100
  );

  return { overallScore, completeness, uniqueness, validity, consistency, issues };
}
