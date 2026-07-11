/**
 * Augmented Dickey-Fuller (ADF) test for stationarity.
 *
 * Tests the null hypothesis that a unit root is present in a time series.
 * Uses proper MacKinnon critical values for the t-statistic.
 *
 * The ADF test regression: Δy_t = α + βt + γy_{t-1} + δ₁Δy_{t-1} + ... + δ_p Δy_{t-p} + ε_t
 *
 * H0: γ = 0 (unit root, non-stationary)
 * H1: γ < 0 (stationary)
 *
 * Reference: MacKinnon (1994) "Approximate Asymptotic Distribution Functions
 * for Unit-Root and Cointegration Tests"
 */

/**
 * MacKinnon critical values for ADF test (model with constant, no trend)
 * For different sample sizes and significance levels.
 * Source: MacKinnon (1994) Table 1
 */
const ADF_CRITICAL_VALUES = {
  // [1%, 5%, 10%] significance levels
  // Model 2: constant, no trend
  constNoTrend: {
    n25: [-3.75, -3.00, -2.63],
    n50: [-3.58, -2.93, -2.60],
    n100: [-3.51, -2.89, -2.58],
    n250: [-3.46, -2.88, -2.57],
    n500: [-3.44, -2.87, -2.57],
    inf: [-3.43, -2.86, -2.57],
  },
  // Model 3: constant + trend
  constTrend: {
    n25: [-4.38, -3.60, -3.24],
    n50: [-4.15, -3.50, -3.18],
    n100: [-4.04, -3.45, -3.15],
    n250: [-3.99, -3.43, -3.13],
    n500: [-3.98, -3.42, -3.13],
    inf: [-3.96, -3.41, -3.12],
  },
};

function getCriticalValues(n: number, hasTrend: boolean): [number, number, number] {
  const table = hasTrend ? ADF_CRITICAL_VALUES.constTrend : ADF_CRITICAL_VALUES.constNoTrend;
  if (n <= 25) return table.n25 as [number, number, number];
  if (n <= 50) return table.n50 as [number, number, number];
  if (n <= 100) return table.n100 as [number, number, number];
  if (n <= 250) return table.n250 as [number, number, number];
  if (n <= 500) return table.n500 as [number, number, number];
  return table.inf as [number, number, number];
}

/**
 * Run the Augmented Dickey-Fuller test.
 *
 * @param values Time series values
 * @param maxLags Maximum number of lags to include (default: floor(12 * (n/100)^0.25))
 * @param hasTrend Include a time trend in the regression
 * @returns Test statistic, p-value, and stationarity conclusion
 */
export function adfTest(
  values: number[],
  maxLags?: number,
  hasTrend: boolean = false,
): {
  statistic: number;
  pValue: number;
  isStationary: boolean;
  lagsUsed: number;
  criticalValues: { '1%': number; '5%': number; '10%': number };
  conclusion: string;
} {
  const n = values.length;

  if (n < 10) {
    return {
      statistic: 0,
      pValue: 1,
      isStationary: false,
      lagsUsed: 0,
      criticalValues: { '1%': -3.43, '5%': -2.86, '10%': -2.57 },
      conclusion: 'Insufficient data for ADF test (need 10+ observations)',
    };
  }

  // Determine optimal lag length (Schwert criterion)
  const lags = maxLags ?? Math.min(Math.floor(12 * Math.pow(n / 100, 0.25)), n - 3);
  const p = Math.max(0, lags);

  // Compute first differences: Δy_t = y_t - y_{t-1}
  const dy: number[] = [];
  for (let i = 1; i < n; i++) dy.push(values[i] - values[i - 1]);

  // Build regression: Δy_t = α + βt + γy_{t-1} + δ₁Δy_{t-1} + ... + δ_p Δy_{t-p} + ε
  // We need (n - p - 1) observations
  const regressorCount = 2 + p + (hasTrend ? 1 : 0); // constant + y_{t-1} + p lags + trend
  const obsCount = n - p - 1;

  if (obsCount < regressorCount + 1) {
    return {
      statistic: 0,
      pValue: 1,
      isStationary: false,
      lagsUsed: p,
      criticalValues: { '1%': -3.43, '5%': -2.86, '10%': -2.57 },
      conclusion: 'Insufficient degrees of freedom for ADF test',
    };
  }

  // Build X matrix and y vector
  const X: number[][] = [];
  const y: number[] = [];

  for (let t = p + 1; t < n; t++) {
    // y = Δy_t
    y.push(values[t] - values[t - 1]);

    // Regressors: [1, y_{t-1}, Δy_{t-1}, Δy_{t-2}, ..., Δy_{t-p}, (t)]
    const row: number[] = [1]; // constant
    row.push(values[t - 1]); // y_{t-1} (the key variable — γ is its coefficient)
    for (let lag = 1; lag <= p; lag++) {
      row.push(values[t - lag] - values[t - lag - 1]); // Δy_{t-lag}
    }
    if (hasTrend) row.push(t); // time trend
    X.push(row);
  }

  // OLS regression: β = (X'X)^{-1} X'y
  const XtX = X[0].map((_, i) =>
    X[0].map((_, j) => X.reduce((sum, row) => sum + row[i] * row[j], 0))
  );
  const XtXInv = matrixInverse(XtX);
  if (!XtXInv) {
    return {
      statistic: 0,
      pValue: 1,
      isStationary: false,
      lagsUsed: p,
      criticalValues: { '1%': -3.43, '5%': -2.86, '10%': -2.57 },
      conclusion: 'Singular matrix in ADF regression',
    };
  }

  const Xty = X[0].map((_, i) => X.reduce((sum, row, idx) => sum + row[i] * y[idx], 0));
  const beta = XtXInv.map((row, i) => row.reduce((sum, val, j) => sum + val * Xty[j], 0));

  // Compute residuals
  const residuals = X.map((row, idx) => y[idx] - row.reduce((sum, val, j) => sum + val * beta[j], 0));

  // Compute residual variance
  const sigma2 = residuals.reduce((sum, r) => sum + r * r, 0) / (obsCount - regressorCount);
  if (sigma2 <= 0) {
    return {
      statistic: 0,
      pValue: 1,
      isStationary: false,
      lagsUsed: p,
      criticalValues: { '1%': -3.43, '5%': -2.86, '10%': -2.57 },
      conclusion: 'Zero residual variance',
    };
  }

  // Standard error of γ (coefficient on y_{t-1}, which is beta[1])
  const seGamma = Math.sqrt(sigma2 * XtXInv[1][1]);

  // ADF t-statistic: γ / SE(γ)
  const tStat = beta[1] / seGamma;

  // Get critical values
  const cv = getCriticalValues(n, hasTrend);

  // Determine p-value (approximate using MacKinnon response surface)
  // This is a simplified version — full MacKinnon uses response surface coefficients
  const pValue = approximatePValue(tStat, n);

  // Decision: reject H0 (stationary) if tStat < critical value
  const isStationary = tStat < cv[1]; // 5% significance level

  let conclusion: string;
  if (tStat < cv[0]) {
    conclusion = `Strongly stationary (t=${tStat.toFixed(3)} < 1% critical value ${cv[0].toFixed(3)})`;
  } else if (tStat < cv[1]) {
    conclusion = `Stationary (t=${tStat.toFixed(3)} < 5% critical value ${cv[1].toFixed(3)})`;
  } else if (tStat < cv[2]) {
    conclusion = `Marginally stationary (t=${tStat.toFixed(3)} < 10% critical value ${cv[2].toFixed(3)})`;
  } else {
    conclusion = `Non-stationary / unit root (t=${tStat.toFixed(3)} >= 10% critical value ${cv[2].toFixed(3)})`;
  }

  return {
    statistic: tStat,
    pValue,
    isStationary,
    lagsUsed: p,
    criticalValues: { '1%': cv[0], '5%': cv[1], '10%': cv[2] },
    conclusion,
  };
}

/**
 * Approximate p-value from ADF t-statistic.
 * Uses a simple interpolation between critical values.
 */
function approximatePValue(tStat: number, n: number): number {
  const cv = getCriticalValues(n, false);
  // If tStat is more negative than 1% CV → p < 0.01
  if (tStat < cv[0]) return 0.001;
  // Between 1% and 5%
  if (tStat < cv[1]) {
    const ratio = (tStat - cv[0]) / (cv[1] - cv[0]);
    return 0.01 + ratio * 0.04;
  }
  // Between 5% and 10%
  if (tStat < cv[2]) {
    const ratio = (tStat - cv[1]) / (cv[2] - cv[1]);
    return 0.05 + ratio * 0.05;
  }
  // Above 10% → p > 0.10
  return 0.10 + Math.min(0.90, (tStat - cv[2]) / 2);
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
    if (Math.abs(m[maxRow][i]) < 1e-14) return null;
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
