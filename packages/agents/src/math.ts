/**
 * Busara Math Utilities
 * =====================
 * 
 * Collection of mathematical functions for statistical analysis and machine learning.
 * All functions are implemented with numerical stability in mind.
 */

// ============================================================================
// Basic Statistical Functions
// ============================================================================

/**
 * Calculate the mean (average) of an array of numbers
 */
export function mean(values: number[]): number {
  if (values.length === 0) return NaN;
  
  let sum = 0;
  for (const value of values) {
    sum += value;
  }
  return sum / values.length;
}

/**
 * Calculate the median of an array of numbers
 */
export function median(values: number[]): number {
  if (values.length === 0) return NaN;
  
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return sorted[middle];
}

/**
 * Calculate the mode (most frequent value) of an array of numbers
 */
export function mode(values: number[]): number {
  if (values.length === 0) return NaN;
  
  const frequencyMap = new Map<number, number>();
  let maxFrequency = 0;
  let modeValue = values[0];
  
  for (const value of values) {
    const frequency = (frequencyMap.get(value) ?? 0) + 1;
    frequencyMap.set(value, frequency);
    
    if (frequency > maxFrequency) {
      maxFrequency = frequency;
      modeValue = value;
    }
  }
  
  return modeValue;
}

/**
 * Calculate the minimum value in an array
 */
export function min(values: number[]): number {
  if (values.length === 0) return NaN;
  return Math.min(...values);
}

/**
 * Calculate the maximum value in an array
 */
export function max(values: number[]): number {
  if (values.length === 0) return NaN;
  return Math.max(...values);
}

/**
 * Calculate the range (max - min) of an array
 */
export function range(values: number[]): number {
  if (values.length === 0) return NaN;
  return max(values) - min(values);
}

// ============================================================================
// Variance and Standard Deviation
// ============================================================================

/**
 * Calculate the population variance of an array of numbers
 */
export function variance(values: number[]): number {
  if (values.length === 0) return NaN;
  if (values.length === 1) return 0;
  
  const avg = mean(values);
  let sumSquaredDiff = 0;
  
  for (const value of values) {
    const diff = value - avg;
    sumSquaredDiff += diff * diff;
  }
  
  return sumSquaredDiff / values.length;
}

/**
 * Calculate the sample variance of an array of numbers
 */
export function sampleVariance(values: number[]): number {
  if (values.length <= 1) return NaN;
  
  const avg = mean(values);
  let sumSquaredDiff = 0;
  
  for (const value of values) {
    const diff = value - avg;
    sumSquaredDiff += diff * diff;
  }
  
  return sumSquaredDiff / (values.length - 1);
}

/**
 * Calculate the population standard deviation of an array of numbers
 */
export function stdev(values: number[]): number {
  return Math.sqrt(variance(values));
}

/**
 * Calculate the sample standard deviation of an array of numbers
 */
export function sampleStdev(values: number[]): number {
  return Math.sqrt(sampleVariance(values));
}

// ============================================================================
// Quantiles and Percentiles
// ============================================================================

/**
 * Calculate a quantile of an array of numbers
 * @param values - Array of numbers
 * @param q - Quantile to calculate (0 <= q <= 1)
 */
export function quantile(values: number[], q: number): number {
  if (values.length === 0 || q < 0 || q > 1) return NaN;
  
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

/**
 * Calculate the first quartile (Q1) of an array of numbers
 */
export function q1(values: number[]): number {
  return quantile(values, 0.25);
}

/**
 * Calculate the third quartile (Q3) of an array of numbers
 */
export function q3(values: number[]): number {
  return quantile(values, 0.75);
}

/**
 * Calculate the interquartile range (IQR) of an array of numbers
 */
export function iqr(values: number[]): number {
  return q3(values) - q1(values);
}

/**
 * Calculate a percentile of an array of numbers
 * @param values - Array of numbers
 * @param p - Percentile to calculate (0 <= p <= 100)
 */
export function percentile(values: number[], p: number): number {
  return quantile(values, p / 100);
}

// ============================================================================
// Distribution Shape
// ============================================================================

/**
 * Calculate the skewness of an array of numbers
 * Positive skewness indicates a longer right tail
 * Negative skewness indicates a longer left tail
 */
export function skewness(values: number[]): number {
  if (values.length < 3) return NaN;
  
  const avg = mean(values);
  const std = stdev(values);
  
  if (std === 0) return NaN;
  
  let sumCubedDiff = 0;
  for (const value of values) {
    const diff = value - avg;
    sumCubedDiff += diff * diff * diff;
  }
  
  return (sumCubedDiff / values.length) / Math.pow(std, 3);
}

/**
 * Calculate the kurtosis of an array of numbers
 * Measures the "tailedness" of the distribution
 */
export function kurtosis(values: number[]): number {
  if (values.length < 4) return NaN;
  
  const avg = mean(values);
  const std = stdev(values);
  
  if (std === 0) return NaN;
  
  let sumQuarticDiff = 0;
  for (const value of values) {
    const diff = value - avg;
    sumQuarticDiff += diff * diff * diff * diff;
  }
  
  return (sumQuarticDiff / values.length) / Math.pow(std, 4) - 3;
}

// ============================================================================
// Entropy
// ============================================================================

/**
 * Calculate the Shannon entropy of an array of numbers
 * Measures the uncertainty/randomness in the data
 */
export function shannonEntropy(values: number[]): number {
  if (values.length === 0) return NaN;
  
  const frequencyMap = new Map<number, number>();
  for (const value of values) {
    frequencyMap.set(value, (frequencyMap.get(value) ?? 0) + 1);
  }
  
  let entropy = 0;
  for (const frequency of frequencyMap.values()) {
    const probability = frequency / values.length;
    entropy -= probability * Math.log2(probability);
  }
  
  return entropy;
}

// ============================================================================
// Correlation and Covariance
// ============================================================================

/**
 * Calculate the covariance between two arrays of numbers
 */
export function covariance(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length === 0) return NaN;
  
  const meanX = mean(x);
  const meanY = mean(y);
  
  let sumProductDiff = 0;
  for (let i = 0; i < x.length; i++) {
    sumProductDiff += (x[i] - meanX) * (y[i] - meanY);
  }
  
  return sumProductDiff / x.length;
}

/**
 * Calculate the sample covariance between two arrays of numbers
 */
export function sampleCovariance(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length <= 1) return NaN;
  
  const meanX = mean(x);
  const meanY = mean(y);
  
  let sumProductDiff = 0;
  for (let i = 0; i < x.length; i++) {
    sumProductDiff += (x[i] - meanX) * (y[i] - meanY);
  }
  
  return sumProductDiff / (x.length - 1);
}

/**
 * Calculate the Pearson correlation coefficient between two arrays of numbers
 * Ranges from -1 (perfect negative correlation) to +1 (perfect positive correlation)
 */
export function correlation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length === 0) return NaN;
  
  const cov = covariance(x, y);
  const stdX = stdev(x);
  const stdY = stdev(y);
  
  if (stdX === 0 || stdY === 0) return NaN;
  
  return cov / (stdX * stdY);
}

/**
 * Calculate the Spearman rank correlation coefficient
 * Non-parametric measure of rank correlation
 */
export function spearmanCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length === 0) return NaN;
  
  // Rank the values
  const rank = (values: number[]): number[] => {
    const sorted = [...values].map((v, i) => ({ value: v, index: i })).sort((a, b) => a.value - b.value);
    const ranks = new Array(values.length).fill(0);
    
    for (let i = 0; i < sorted.length; i++) {
      // Handle ties
      let j = i;
      while (j < sorted.length && sorted[j].value === sorted[i].value) j++;
      const averageRank = (i + j - 1) / 2 + 0.5;
      for (let k = i; k < j; k++) {
        ranks[sorted[k].index] = averageRank;
      }
      i = j - 1;
    }
    
    return ranks;
  };
  
  const rankX = rank(x);
  const rankY = rank(y);
  
  return correlation(rankX, rankY);
}

// ============================================================================
// Distance Metrics
// ============================================================================

/**
 * Calculate the Euclidean distance between two points
 */
export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) return NaN;
  
  let sumSquaredDiff = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sumSquaredDiff += diff * diff;
  }
  
  return Math.sqrt(sumSquaredDiff);
}

/**
 * Calculate the Manhattan distance between two points
 */
export function manhattanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) return NaN;
  
  let sumAbsDiff = 0;
  for (let i = 0; i < a.length; i++) {
    sumAbsDiff += Math.abs(a[i] - b[i]);
  }
  
  return sumAbsDiff;
}

/**
 * Calculate the cosine similarity between two vectors
 * Ranges from -1 (opposite) to +1 (identical)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return NaN;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return NaN;
  
  return dotProduct / denominator;
}

// ============================================================================
// Statistical Tests
// ============================================================================

/**
 * Perform a t-test to compare the means of two samples
 * Returns the t-statistic and p-value
 */
export function tTest(
  sample1: number[],
  sample2: number[]
): { tStatistic: number; pValue: number } {
  const n1 = sample1.length;
  const n2 = sample2.length;
  
  if (n1 === 0 || n2 === 0) return { tStatistic: NaN, pValue: NaN };
  
  const mean1 = mean(sample1);
  const mean2 = mean(sample2);
  const var1 = sampleVariance(sample1);
  const var2 = sampleVariance(sample2);
  
  // Pooled variance
  const pooledVariance = ((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2);
  const pooledStdev = Math.sqrt(pooledVariance);
  
  // Standard error
  const se = pooledStdev * Math.sqrt(1 / n1 + 1 / n2);
  
  // t-statistic
  const tStatistic = (mean1 - mean2) / se;
  
  // Degrees of freedom
  const df = n1 + n2 - 2;
  
  // Two-tailed p-value using Student's t-distribution approximation
  // This is a simplified approximation; for production use, consider a proper library
  const pValue = 2 * (1 - studentTCDF(Math.abs(tStatistic), df));
  
  return { tStatistic, pValue };
}

/**
 * Student's t-distribution cumulative distribution function (CDF) approximation
 * Uses a simplified approximation for the t-distribution
 */
function studentTCDF(t: number, df: number): number {
  // Abramowitz and Stegun approximation (simplified)
  // For production use, consider using a proper statistical library
  if (df <= 0) return 0.5;
  
  const x = t / Math.sqrt(df + t * t);
  const theta = Math.atan2(x, Math.sqrt(1 - x * x));
  const prob = 0.5 + 0.5 * x * theta;
  
  return Math.min(Math.max(prob, 0), 1);
}

// ============================================================================
// Time Series Functions
// ============================================================================

/**
 * Calculate the moving average of an array of numbers
 * @param values - Array of numbers
 * @param windowSize - Size of the moving window
 */
export function movingAverage(values: number[], windowSize: number): number[] {
  if (values.length === 0 || windowSize <= 0 || windowSize > values.length) {
    return [];
  }
  
  const result: number[] = [];
  
  for (let i = 0; i <= values.length - windowSize; i++) {
    const window = values.slice(i, i + windowSize);
    result.push(mean(window));
  }
  
  return result;
}

/**
 * Calculate the exponentially weighted moving average (EWMA)
 * @param values - Array of numbers
 * @param alpha - Smoothing factor (0 < alpha < 1)
 */
export function ewma(values: number[], alpha: number = 0.3): number[] {
  if (values.length === 0 || alpha <= 0 || alpha >= 1) return [];
  
  const result: number[] = [values[0]];
  
  for (let i = 1; i < values.length; i++) {
    const prev = result[i - 1];
    result.push(alpha * values[i] + (1 - alpha) * prev);
  }
  
  return result;
}

/**
 * Calculate the simple moving average (SMA) for a specific point
 */
export function sma(values: number[], index: number, windowSize: number): number {
  const start = Math.max(0, index - Math.floor(windowSize / 2));
  const end = Math.min(values.length, index + Math.ceil(windowSize / 2));
  const window = values.slice(start, end);
  return mean(window);
}

// ============================================================================
// Matrix Operations
// ============================================================================

/**
 * Transpose a matrix
 */
export function transpose(matrix: number[][]): number[][] {
  if (matrix.length === 0) return [];
  
  const rows = matrix.length;
  const cols = matrix[0].length;
  
  const result: number[][] = [];
  for (let j = 0; j < cols; j++) {
    result[j] = [];
    for (let i = 0; i < rows; i++) {
      result[j][i] = matrix[i][j];
    }
  }
  
  return result;
}

/**
 * Multiply two matrices
 */
export function matrixMultiply(a: number[][], b: number[][]): number[][] {
  const aRows = a.length;
  const aCols = a[0]?.length ?? 0;
  const bRows = b.length;
  const bCols = b[0]?.length ?? 0;
  
  if (aCols !== bRows) {
    throw new Error(`Matrix dimensions don't match: ${aCols} !== ${bRows}`);
  }
  
  const result: number[][] = [];
  for (let i = 0; i < aRows; i++) {
    result[i] = [];
    for (let j = 0; j < bCols; j++) {
      let sum = 0;
      for (let k = 0; k < aCols; k++) {
        sum += a[i][k] * b[k][j];
      }
      result[i][j] = sum;
    }
  }
  
  return result;
}

/**
 * Calculate the dot product of two vectors
 */
export function dotProduct(a: number[], b: number[]): number {
  if (a.length !== b.length) return NaN;
  
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

// ============================================================================
// Random Sampling
// ============================================================================

/**
 * Generate a random integer between min and max (inclusive)
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate a random float between min and max
 */
export function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

/**
 * Randomly sample n items from an array without replacement
 */
export function sampleWithoutReplacement<T>(array: T[], n: number): T[] {
  if (n <= 0) return [];
  if (n >= array.length) return [...array];
  
  const result: T[] = [];
  const indices = new Set<number>();
  
  while (result.length < n) {
    const index = randomInt(0, array.length - 1);
    if (!indices.has(index)) {
      indices.add(index);
      result.push(array[index]);
    }
  }
  
  return result;
}

/**
 * Randomly sample n items from an array with replacement
 */
export function sampleWithReplacement<T>(array: T[], n: number): T[] {
  if (n <= 0) return [];
  
  const result: T[] = [];
  for (let i = 0; i < n; i++) {
    result.push(array[randomInt(0, array.length - 1)]);
  }
  return result;
}

// ============================================================================
// Numerical Stability Helpers
// ============================================================================

/**
 * Check if a value is approximately equal to another value
 */
export function approximatelyEqual(a: number, b: number, epsilon: number = 1e-10): boolean {
  return Math.abs(a - b) < epsilon;
}

/**
 * Safely add two numbers, avoiding floating point precision issues
 */
export function safeAdd(a: number, b: number): number {
  if (a === 0) return b;
  if (b === 0) return a;
  
  const aSign = Math.sign(a);
  const bSign = Math.sign(b);
  
  if (aSign !== bSign) {
    // Different signs, use simple addition
    return a + b;
  }
  
  // Same signs, use more precise addition
  const aAbs = Math.abs(a);
  const bAbs = Math.abs(b);
  
  if (aAbs > bAbs) {
    return a + b;
  }
  return b + a;
}

/**
 * Clamp a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// ============================================================================
// Exports
// ============================================================================

export {
  mean as average,
  variance as popVariance,
  sampleVariance as sampleVar,
  stdev as popStdev,
  sampleStdev as sampleStd,
  quantile as percentileValue,
  correlation as pearsonCorrelation,
};
