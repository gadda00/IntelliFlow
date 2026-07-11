/**
 * Real Gaussian Mixture Model with EM algorithm.
 *
 * Implements full covariance GMM using Expectation-Maximization.
 * Unlike the previous "Euclidean proxy" implementation, this properly
 * models Gaussian distributions with covariance matrices.
 *
 * Reference: Bishop, "Pattern Recognition and Machine Learning" Chapter 9
 */

import { createRng } from './seededRandom';

export interface GMMResult {
  /** Cluster assignments (0 to k-1) for each point */
  labels: number[];
  /** Soft cluster probabilities (n × k matrix) */
  responsibilities: number[][];
  /** Means of each Gaussian (k × d) */
  means: number[][];
  /** Covariance matrices of each Gaussian (k × d × d) */
  covariances: number[][][];
  /** Mixture weights (sum to 1) */
  weights: number[];
  /** Log-likelihood at convergence */
  logLikelihood: number;
  /** Number of iterations */
  iterations: number;
  /** Converged? */
  converged: boolean;
}

/**
 * Multivariate Gaussian log probability density function.
 * log N(x | mu, Sigma) = -0.5 * [d*log(2pi) + log|Sigma| + (x-mu)^T Sigma^-1 (x-mu)]
 */
function gaussianLogPdf(
  x: number[],
  mean: number[],
  cov: number[][],
): number {
  const d = x.length;

  // Add regularization to covariance for numerical stability
  const regCov = cov.map((row, i) =>
    row.map((val, j) => (i === j ? val + 1e-6 : val))
  );

  // Compute log determinant of covariance
  const logDet = logDeterminant(regCov);

  // Solve (x - mu) = b, then compute b^T Sigma^-1 b
  const diff = x.map((xi, i) => xi - mean[i]);
  const sigmaInv = matrixInverse(regCov);
  if (!sigmaInv) return -Infinity;

  // quadratic form: diff^T * SigmaInv * diff
  let quadForm = 0;
  for (let i = 0; i < d; i++) {
    for (let j = 0; j < d; j++) {
      quadForm += diff[i] * sigmaInv[i][j] * diff[j];
    }
  }

  return -0.5 * (d * Math.log(2 * Math.PI) + logDet + quadForm);
}

function logDeterminant(matrix: number[][]): number {
  const n = matrix.length;
  // LU decomposition
  const m = matrix.map(row => [...row]);
  let logDet = 0;
  for (let i = 0; i < n; i++) {
    // Find pivot
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(m[k][i]) > Math.abs(m[maxRow][i])) maxRow = k;
    }
    if (Math.abs(m[maxRow][i]) < 1e-12) return -Infinity; // singular
    if (maxRow !== i) {
      [m[i], m[maxRow]] = [m[maxRow], m[i]];
      logDet = -logDet; // sign flip
    }
    logDet += Math.log(Math.abs(m[i][i]));
    for (let k = i + 1; k < n; k++) {
      const factor = m[k][i] / m[i][i];
      for (let j = i; j < n; j++) {
        m[k][j] -= factor * m[i][j];
      }
    }
  }
  return logDet;
}

function matrixInverse(matrix: number[][]): number[][] | null {
  const n = matrix.length;
  const m = matrix.map((row, i) => [
    ...row,
    ...Array(n).fill(0).map((_, j) => (i === j ? 1 : 0)),
  ]);

  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(m[k][i]) > Math.abs(m[maxRow][i])) maxRow = k;
    }
    if (Math.abs(m[maxRow][i]) < 1e-12) return null;
    [m[i], m[maxRow]] = [m[maxRow], m[i]];
    const pivot = m[i][i];
    for (let j = 0; j < 2 * n; j++) m[i][j] /= pivot;
    for (let k = 0; k < n; k++) {
      if (k === i) continue;
      const factor = m[k][i];
      for (let j = 0; j < 2 * n; j++) m[k][j] -= factor * m[i][j];
    }
  }

  return m.map(row => row.slice(n));
}

/**
 * Run Gaussian Mixture Model with EM algorithm.
 *
 * @param data Input data as array of number arrays (n × d)
 * @param k Number of Gaussian components
 * @param maxIter Maximum EM iterations
 * @param tol Convergence tolerance (log-likelihood change)
 * @param seed Random seed
 */
export function gaussianMixture(
  data: number[][],
  k: number = 3,
  maxIter: number = 100,
  tol: number = 1e-6,
  seed: number = 42,
): GMMResult {
  const n = data.length;
  const d = data[0].length;
  const rng = createRng(seed);

  if (n < k) {
    return {
      labels: data.map(() => 0),
      responsibilities: data.map(() => [1]),
      means: [data[0] || [0]],
      covariances: [[[1]]],
      weights: [1],
      logLikelihood: 0,
      iterations: 0,
      converged: true,
    };
  }

  // ─── Initialize with K-Means++ ───────────────────────────────────
  const means: number[][] = [];
  // First center: random point
  means.push([...data[Math.floor(rng() * n)]]);
  // Subsequent centers: probability proportional to squared distance
  for (let c = 1; c < k; c++) {
    const dists = data.map(point => {
      let minDist = Infinity;
      for (const m of means) {
        let dist = 0;
        for (let j = 0; j < d; j++) dist += (point[j] - m[j]) ** 2;
        if (dist < minDist) minDist = dist;
      }
      return minDist;
    });
    const total = dists.reduce((a, b) => a + b, 0);
    if (total === 0) {
      means.push([...data[Math.floor(rng() * n)]]);
    } else {
      let r = rng() * total;
      let idx = 0;
      for (let i = 0; i < n; i++) {
        r -= dists[i];
        if (r <= 0) { idx = i; break; }
      }
      means.push([...data[idx]]);
    }
  }

  // Initialize covariances as identity, weights as uniform
  const covariances: number[][][] = Array(k).fill(null).map(() => {
    const cov = Array(d).fill(null).map(() => Array(d).fill(0));
    for (let i = 0; i < d; i++) cov[i][i] = 1;
    return cov;
  });
  const weights = Array(k).fill(1 / k);

  // ─── EM Algorithm ────────────────────────────────────────────────
  let prevLogLik = -Infinity;
  let converged = false;
  let iter = 0;

  const responsibilities: number[][] = Array(n).fill(null).map(() => Array(k).fill(0));

  for (iter = 0; iter < maxIter; iter++) {
    // ─── E-step: compute responsibilities ─────────────────────────
    let logLik = 0;
    for (let i = 0; i < n; i++) {
      const logProbs = Array(k).fill(0);
      for (let c = 0; c < k; c++) {
        logProbs[c] = Math.log(weights[c]) + gaussianLogPdf(data[i], means[c], covariances[c]);
      }
      // Log-sum-exp for numerical stability
      const maxLogProb = Math.max(...logProbs);
      const sumExp = logProbs.reduce((sum, lp) => sum + Math.exp(lp - maxLogProb), 0);
      const logSum = maxLogProb + Math.log(sumExp);
      logLik += logSum;

      for (let c = 0; c < k; c++) {
        responsibilities[i][c] = Math.exp(logProbs[c] - logSum);
      }
    }

    // Check convergence
    if (Math.abs(logLik - prevLogLik) < tol) {
      converged = true;
      prevLogLik = logLik;
      break;
    }
    prevLogLik = logLik;

    // ─── M-step: update parameters ────────────────────────────────
    const Nk = Array(k).fill(0);
    for (let i = 0; i < n; i++) {
      for (let c = 0; c < k; c++) Nk[c] += responsibilities[i][c];
    }

    for (let c = 0; c < k; c++) {
      // Update weights
      weights[c] = Nk[c] / n;

      if (Nk[c] < 1e-10) continue; // skip empty cluster

      // Update means
      for (let j = 0; j < d; j++) {
        means[c][j] = 0;
        for (let i = 0; i < n; i++) {
          means[c][j] += responsibilities[i][c] * data[i][j];
        }
        means[c][j] /= Nk[c];
      }

      // Update covariances
      for (let j1 = 0; j1 < d; j1++) {
        for (let j2 = 0; j2 < d; j2++) {
          covariances[c][j1][j2] = 0;
          for (let i = 0; i < n; i++) {
            covariances[c][j1][j2] +=
              responsibilities[i][c] * (data[i][j1] - means[c][j1]) * (data[i][j2] - means[c][j2]);
          }
          covariances[c][j1][j2] /= Nk[c];
          // Regularize diagonal
          if (j1 === j2) covariances[c][j1][j2] += 1e-6;
        }
      }
    }
  }

  // ─── Compute final labels (hard assignment) ──────────────────────
  const labels = responsibilities.map(r => {
    let maxIdx = 0;
    for (let c = 1; c < k; c++) {
      if (r[c] > r[maxIdx]) maxIdx = c;
    }
    return maxIdx;
  });

  return {
    labels,
    responsibilities,
    means,
    covariances,
    weights,
    logLikelihood: prevLogLik,
    iterations: iter + 1,
    converged,
  };
}
