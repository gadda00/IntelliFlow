"""
Forecasting Oracle Agent v1.0
===============================
Multi-method time series forecasting without heavy ML dependencies:
- Holt-Winters Triple Exponential Smoothing (trend + seasonality)
- Linear Trend with Seasonal Decomposition
- Moving Average + Drift
- Ensemble (weighted average of all methods)

Returns forecasts with confidence intervals and model comparison.
"""

import math
import json
import logging
import statistics
from typing import Any, Dict, List, Optional, Tuple
from datetime import datetime, timedelta

logger = logging.getLogger("intelliflow.forecasting_oracle")


class ForecastingOracleAgent:
    name = "Forecasting Oracle"

    def __init__(self, config: Dict[str, Any] = None):
        self.config = config or {}

    # ─── Public API ────────────────────────────────────────────────────────────

    async def forecast(
        self,
        file_contents: List,
        periods: int = 12,
        target_column: Optional[str] = None
    ) -> Dict[str, Any]:
        try:
            data = self._parse_file_contents(file_contents)
            if not data:
                return self._error("No data provided")

            numeric_cols = self._numeric_columns(data)
            if not numeric_cols:
                return self._error("No numeric columns found for forecasting")

            target = target_column if target_column in numeric_cols else numeric_cols[0]
            series = [float(row[target]) for row in data
                      if row.get(target) is not None and self._is_numeric(row.get(target))]

            if len(series) < 8:
                return self._error(f"Need at least 8 data points; got {len(series)}")

            periods = min(max(periods, 1), min(120, len(series) * 2))

            # Detect seasonality
            seasonality = self._detect_seasonality(series)

            # Run all forecasting methods
            hw_result = self._holt_winters(series, periods, seasonality)
            linear_result = self._linear_seasonal(series, periods, seasonality)
            ma_result = self._moving_average_drift(series, periods)

            # Ensemble
            ensemble = self._ensemble_forecast(
                [hw_result["forecast"], linear_result["forecast"], ma_result["forecast"]],
                weights=[0.5, 0.3, 0.2],
                periods=periods
            )

            # Confidence intervals (based on historical residuals)
            ci_80, ci_95 = self._confidence_intervals(series, ensemble, periods)

            # Model accuracy on held-out last 20%
            holdout_n = max(int(len(series) * 0.2), 2)
            train = series[:-holdout_n]
            test = series[-holdout_n:]
            accuracy = self._evaluate_models(train, test, seasonality)

            return {
                "status": "success",
                "agent": self.name,
                "target_column": target,
                "historical_summary": {
                    "data_points": len(series),
                    "mean": round(statistics.mean(series), 4),
                    "stdev": round(statistics.pstdev(series), 4),
                    "trend_direction": self._trend_direction(series),
                    "seasonality_period": seasonality,
                    "last_value": series[-1]
                },
                "forecast": {
                    "periods": periods,
                    "values": [round(v, 4) for v in ensemble],
                    "confidence_80": ci_80,
                    "confidence_95": ci_95
                },
                "methods": {
                    "holt_winters": {
                        "forecast": [round(v, 4) for v in hw_result["forecast"]],
                        "parameters": hw_result["params"]
                    },
                    "linear_seasonal": {
                        "forecast": [round(v, 4) for v in linear_result["forecast"]],
                        "slope": round(linear_result["slope"], 6)
                    },
                    "moving_average_drift": {
                        "forecast": [round(v, 4) for v in ma_result["forecast"]]
                    }
                },
                "model_accuracy": accuracy,
                "insights": self._generate_insights(series, ensemble, seasonality),
                "timestamp": datetime.utcnow().isoformat()
            }

        except Exception as e:
            logger.exception("Forecasting failed")
            return self._error(str(e))

    # ─── Holt-Winters Triple Exponential Smoothing ────────────────────────────

    def _holt_winters(
        self, series: List[float], periods: int, seasonality: int
    ) -> Dict[str, Any]:
        """Additive Holt-Winters with optimised alpha/beta/gamma."""
        n = len(series)
        s = max(seasonality, 2)

        best_sse = float("inf")
        best_params = (0.3, 0.1, 0.1)

        # Grid search for best parameters
        for alpha in [0.1, 0.2, 0.3, 0.5, 0.7]:
            for beta in [0.01, 0.05, 0.1, 0.2]:
                for gamma in [0.01, 0.05, 0.1, 0.2]:
                    try:
                        _, sse = self._hw_fit(series, alpha, beta, gamma, s)
                        if sse < best_sse:
                            best_sse = sse
                            best_params = (alpha, beta, gamma)
                    except Exception:
                        continue

        alpha, beta, gamma = best_params
        fitted, _ = self._hw_fit(series, alpha, beta, gamma, s)

        # Forecast
        forecast = self._hw_predict(series, fitted, alpha, beta, gamma, s, periods)
        return {"forecast": forecast, "params": {"alpha": alpha, "beta": beta, "gamma": gamma}}

    def _hw_fit(
        self, series: List[float], alpha: float, beta: float, gamma: float, s: int
    ) -> Tuple[Dict, float]:
        n = len(series)
        if n < 2 * s:
            s = max(2, n // 3)

        # Initialise
        L = [0.0] * n
        T = [0.0] * n
        S = [0.0] * n

        # Initial level and trend
        L[0] = statistics.mean(series[:s])
        T[0] = (statistics.mean(series[s:2 * s]) - statistics.mean(series[:s])) / s

        # Initial seasonal indices
        season_avg = statistics.mean(series[:s])
        for i in range(s):
            S[i] = series[i] - season_avg if abs(season_avg) > 1e-9 else 0.0

        sse = 0.0
        for t in range(s, n):
            prev_s = S[t - s]
            L[t] = alpha * (series[t] - prev_s) + (1 - alpha) * (L[t - 1] + T[t - 1])
            T[t] = beta * (L[t] - L[t - 1]) + (1 - beta) * T[t - 1]
            S[t] = gamma * (series[t] - L[t]) + (1 - gamma) * prev_s
            fitted_t = L[t - 1] + T[t - 1] + prev_s
            sse += (series[t] - fitted_t) ** 2

        return {"L": L, "T": T, "S": S, "s": s}, sse

    def _hw_predict(
        self, series: List[float], fitted: Dict, alpha: float, beta: float, gamma: float, s: int, h: int
    ) -> List[float]:
        L, T, S = fitted["L"], fitted["T"], fitted["S"]
        n = len(series)
        forecasts = []
        for i in range(1, h + 1):
            season_idx = (n - s + ((i - 1) % s)) % len(S)
            f = L[-1] + i * T[-1] + S[season_idx]
            forecasts.append(max(0, f))  # prevent negative forecasts for non-negative series
        return forecasts

    # ─── Linear Trend + Seasonal Decomposition ───────────────────────────────

    def _linear_seasonal(self, series: List[float], periods: int, seasonality: int) -> Dict[str, Any]:
        n = len(series)
        # Linear regression
        x = list(range(n))
        slope, intercept = self._linear_regression(x, series)

        # Seasonal adjustment
        s = max(seasonality, 2)
        seasonal_factors = [0.0] * s
        if n >= s:
            for i in range(s):
                vals = [series[j] - (slope * j + intercept) for j in range(i, n, s)]
                seasonal_factors[i] = statistics.mean(vals) if vals else 0.0

        forecast = []
        for h in range(1, periods + 1):
            trend = slope * (n + h - 1) + intercept
            sf = seasonal_factors[(n + h - 1) % s]
            forecast.append(trend + sf)

        return {"forecast": forecast, "slope": slope, "intercept": intercept}

    def _linear_regression(self, x: List[float], y: List[float]) -> Tuple[float, float]:
        n = len(x)
        if n == 0:
            return 0.0, 0.0
        sum_x = sum(x)
        sum_y = sum(y)
        sum_xy = sum(xi * yi for xi, yi in zip(x, y))
        sum_x2 = sum(xi ** 2 for xi in x)
        denom = n * sum_x2 - sum_x ** 2
        if abs(denom) < 1e-12:
            return 0.0, sum_y / n
        slope = (n * sum_xy - sum_x * sum_y) / denom
        intercept = (sum_y - slope * sum_x) / n
        return slope, intercept

    # ─── Moving Average + Drift ───────────────────────────────────────────────

    def _moving_average_drift(self, series: List[float], periods: int) -> Dict[str, Any]:
        window = min(max(len(series) // 4, 3), 12)
        ma = statistics.mean(series[-window:])
        drift = (series[-1] - series[0]) / max(len(series) - 1, 1)
        forecast = [ma + drift * (i + 1) for i in range(periods)]
        return {"forecast": forecast}

    # ─── Ensemble ─────────────────────────────────────────────────────────────

    def _ensemble_forecast(
        self, forecasts: List[List[float]], weights: List[float], periods: int
    ) -> List[float]:
        ensemble = []
        total_w = sum(weights)
        for i in range(periods):
            weighted_sum = sum(
                f[i] * w for f, w in zip(forecasts, weights)
                if i < len(f)
            )
            ensemble.append(weighted_sum / total_w)
        return ensemble

    # ─── Confidence Intervals ─────────────────────────────────────────────────

    def _confidence_intervals(
        self, series: List[float], forecast: List[float], periods: int
    ) -> Tuple[List, List]:
        """Simple prediction intervals widening over the horizon."""
        residuals = []
        window = min(12, len(series) - 1)
        for i in range(1, window + 1):
            predicted = series[-i - 1] + (series[-1] - series[0]) / max(len(series) - 1, 1)
            residuals.append(abs(series[-i] - predicted))

        base_error = statistics.mean(residuals) if residuals else abs(statistics.stdev(series) * 0.1)

        ci_80, ci_95 = [], []
        for h in range(periods):
            grow = math.sqrt(h + 1)
            width_80 = 1.282 * base_error * grow
            width_95 = 1.960 * base_error * grow
            v = forecast[h]
            ci_80.append({"lower": round(v - width_80, 4), "upper": round(v + width_80, 4)})
            ci_95.append({"lower": round(v - width_95, 4), "upper": round(v + width_95, 4)})

        return ci_80, ci_95

    # ─── Model Evaluation ─────────────────────────────────────────────────────

    def _evaluate_models(
        self, train: List[float], test: List[float], seasonality: int
    ) -> Dict[str, float]:
        """MAPE and RMSE on holdout set."""
        periods = len(test)
        if periods == 0 or len(train) < 4:
            return {}

        hw = self._holt_winters(train, periods, seasonality)["forecast"]
        lin = self._linear_seasonal(train, periods, seasonality)["forecast"]
        ma = self._moving_average_drift(train, periods)["forecast"]

        def mape(actual, predicted):
            pairs = [(a, p) for a, p in zip(actual, predicted) if abs(a) > 1e-9]
            if not pairs:
                return None
            return round(statistics.mean(abs((a - p) / a) * 100 for a, p in pairs), 2)

        def rmse(actual, predicted):
            return round(math.sqrt(statistics.mean((a - p) ** 2 for a, p in zip(actual, predicted))), 4)

        return {
            "holt_winters": {"mape": mape(test, hw), "rmse": rmse(test, hw)},
            "linear_seasonal": {"mape": mape(test, lin), "rmse": rmse(test, lin)},
            "moving_average": {"mape": mape(test, ma), "rmse": rmse(test, ma)}
        }

    # ─── Helpers ──────────────────────────────────────────────────────────────

    def _detect_seasonality(self, series: List[float]) -> int:
        """Detect dominant seasonal period via autocorrelation."""
        n = len(series)
        if n < 16:
            return 4
        mean_v = statistics.mean(series)
        variance = statistics.variance(series)
        if variance == 0:
            return 4

        best_lag, best_acf = 2, -1.0
        for lag in range(2, min(n // 3, 52) + 1):
            acf = sum(
                (series[i] - mean_v) * (series[i - lag] - mean_v)
                for i in range(lag, n)
            ) / ((n - lag) * variance)
            if acf > best_acf:
                best_acf = acf
                best_lag = lag

        # Snap to common periods
        for common in [4, 7, 12, 24, 52]:
            if abs(best_lag - common) <= 1:
                return common
        return best_lag

    def _trend_direction(self, series: List[float]) -> str:
        if len(series) < 2:
            return "stable"
        first_half = statistics.mean(series[:len(series) // 2])
        second_half = statistics.mean(series[len(series) // 2:])
        pct = (second_half - first_half) / max(abs(first_half), 1e-9) * 100
        if pct > 10:
            return "upward"
        if pct < -10:
            return "downward"
        return "stable"

    def _generate_insights(
        self, series: List[float], forecast: List[float], seasonality: int
    ) -> List[str]:
        insights = []
        direction = self._trend_direction(series)
        if direction == "upward":
            insights.append(f"📈 Strong upward trend detected. Historical growth will likely continue.")
        elif direction == "downward":
            insights.append(f"📉 Downward trend detected. Watch for continued decline.")
        else:
            insights.append(f"➡️ Data shows a stable trend with minor fluctuations.")

        if seasonality in [4, 7, 12]:
            period_name = {4: "quarterly", 7: "weekly", 12: "monthly"}.get(seasonality, f"period-{seasonality}")
            insights.append(f"🔄 Clear {period_name} seasonality detected (period={seasonality}).")

        if forecast:
            pct_change = (forecast[-1] - series[-1]) / max(abs(series[-1]), 1e-9) * 100
            insights.append(
                f"🔮 Forecast end-point is {'higher' if pct_change > 0 else 'lower'} than current "
                f"by {abs(pct_change):.1f}%."
            )
        return insights

    def _parse_file_contents(self, file_contents) -> List[Dict]:
        rows = []
        for item in file_contents:
            if isinstance(item, dict):
                rows.append(item)
            elif isinstance(item, str):
                try:
                    parsed = json.loads(item)
                    if isinstance(parsed, list):
                        rows.extend(parsed)
                    elif isinstance(parsed, dict):
                        rows.append(parsed)
                except Exception:
                    pass
        return rows

    def _numeric_columns(self, data: List[Dict]) -> List[str]:
        if not data:
            return []
        cols = []
        for key in data[0].keys():
            sample = [r.get(key) for r in data[:20] if r.get(key) is not None]
            if sum(1 for v in sample if self._is_numeric(v)) >= len(sample) * 0.7:
                cols.append(key)
        return cols

    def _is_numeric(self, v) -> bool:
        try:
            float(v)
            return True
        except (TypeError, ValueError):
            return False

    def _error(self, msg: str) -> Dict:
        return {"status": "error", "agent": self.name, "message": msg}
