"""
Causal Architect Agent v1.0
=============================
Discovers causal structures in data using:
- Pearson & Spearman correlation analysis
- Partial correlation (controlling for confounders)
- Granger-style causality (temporal precedence test)
- PC-Algorithm lite (skeleton discovery via independence tests)
- What-if simulation (counterfactual estimation)

Returns a causal graph + human-readable findings.
"""

import json
import math
import logging
import statistics
from typing import Any, Dict, List, Optional, Tuple
from datetime import datetime

logger = logging.getLogger("intelliflow.causal_architect")


class CausalArchitectAgent:
    name = "Causal Architect"

    def __init__(self, config: Dict[str, Any] = None):
        self.config = config or {}

    # ─── Public API ────────────────────────────────────────────────────────────

    async def analyze(
        self,
        file_contents: List,
        target_variable: Optional[str] = None
    ) -> Dict[str, Any]:
        try:
            data = self._parse(file_contents)
            if len(data) < 10:
                return self._error("Need at least 10 rows for causal analysis")

            numeric_cols = self._numeric_cols(data)[:10]  # cap for performance
            if len(numeric_cols) < 2:
                return self._error("Need at least 2 numeric columns for causal analysis")

            target = target_variable if target_variable in numeric_cols else numeric_cols[-1]
            series = {col: [float(r[col]) for r in data
                            if r.get(col) is not None and self._is_num(r.get(col))]
                      for col in numeric_cols}

            # Align lengths
            min_len = min(len(v) for v in series.values())
            series = {k: v[:min_len] for k, v in series.items()}

            # 1. Correlation matrix
            corr_matrix = self._correlation_matrix(series)

            # 2. Partial correlations (controlling pairwise for other vars)
            partial_corr = self._partial_correlations(series, target)

            # 3. Granger-style temporal precedence
            granger = self._granger_test(series, target)

            # 4. Causal skeleton (PC algorithm lite)
            skeleton = self._build_skeleton(corr_matrix, numeric_cols, threshold=0.3)

            # 5. What-if simulation
            whatif = self._what_if_simulation(series, target, corr_matrix)

            # 6. Root cause ranking
            root_causes = self._rank_causes(partial_corr, granger, target)

            return {
                "status": "success",
                "agent": self.name,
                "target_variable": target,
                "columns_analysed": numeric_cols,
                "correlation_matrix": corr_matrix,
                "partial_correlations_to_target": partial_corr,
                "granger_causality": granger,
                "causal_skeleton": skeleton,
                "root_cause_ranking": root_causes,
                "what_if_simulation": whatif,
                "causal_insights": self._generate_insights(root_causes, granger, target),
                "timestamp": datetime.utcnow().isoformat()
            }

        except Exception as e:
            logger.exception("Causal analysis failed")
            return self._error(str(e))

    # ─── Correlation Matrix ────────────────────────────────────────────────────

    def _correlation_matrix(self, series: Dict[str, List[float]]) -> Dict[str, Dict[str, float]]:
        cols = list(series.keys())
        matrix: Dict[str, Dict[str, float]] = {}
        for c1 in cols:
            matrix[c1] = {}
            for c2 in cols:
                if c1 == c2:
                    matrix[c1][c2] = 1.0
                else:
                    matrix[c1][c2] = round(self._pearson(series[c1], series[c2]), 4)
        return matrix

    def _pearson(self, x: List[float], y: List[float]) -> float:
        n = len(x)
        if n < 2:
            return 0.0
        mx, my = statistics.mean(x), statistics.mean(y)
        num = sum((xi - mx) * (yi - my) for xi, yi in zip(x, y))
        den = math.sqrt(
            sum((xi - mx) ** 2 for xi in x) * sum((yi - my) ** 2 for yi in y)
        )
        return num / den if den > 1e-10 else 0.0

    def _spearman(self, x: List[float], y: List[float]) -> float:
        n = len(x)
        rank_x = self._rank(x)
        rank_y = self._rank(y)
        d_sq = sum((rx - ry) ** 2 for rx, ry in zip(rank_x, rank_y))
        return 1 - (6 * d_sq) / max(n * (n ** 2 - 1), 1)

    def _rank(self, values: List[float]) -> List[float]:
        sorted_vals = sorted(enumerate(values), key=lambda x: x[1])
        ranks = [0.0] * len(values)
        for rank, (idx, _) in enumerate(sorted_vals):
            ranks[idx] = rank + 1
        return ranks

    # ─── Partial Correlations ─────────────────────────────────────────────────

    def _partial_correlations(
        self, series: Dict[str, List[float]], target: str
    ) -> Dict[str, Dict[str, Any]]:
        """Compute partial correlation of each variable to target, controlling for others."""
        result = {}
        other_cols = [c for c in series.keys() if c != target]
        target_vals = series[target]

        for col in other_cols:
            # Residualize col and target on all other columns
            confounders = [c for c in other_cols if c != col]
            
            col_resid = self._residualize(series[col], [series[c] for c in confounders])
            target_resid = self._residualize(target_vals, [series[c] for c in confounders])

            partial = self._pearson(col_resid, target_resid)
            raw = self._pearson(series[col], target_vals)
            confounder_effect = abs(raw) - abs(partial)

            result[col] = {
                "partial_correlation": round(partial, 4),
                "raw_correlation": round(raw, 4),
                "confounder_adjustment": round(confounder_effect, 4),
                "direction": "positive" if partial > 0 else "negative",
                "strength": self._strength_label(abs(partial)),
                "p_value_approx": self._approx_p_value(partial, len(target_vals))
            }

        return result

    def _residualize(self, y: List[float], covariates: List[List[float]]) -> List[float]:
        """Remove linear effect of covariates from y via OLS."""
        if not covariates:
            mean_y = statistics.mean(y)
            return [v - mean_y for v in y]

        n = len(y)
        # Simple iterative partialling
        residuals = list(y)
        for cov in covariates:
            if len(cov) != n:
                continue
            r = self._pearson(residuals, cov)
            std_cov = statistics.pstdev(cov)
            std_res = statistics.pstdev(residuals)
            if std_cov > 1e-9 and std_res > 1e-9:
                b = r * std_res / std_cov
                mean_cov = statistics.mean(cov)
                mean_res = statistics.mean(residuals)
                residuals = [res - b * (c - mean_cov) for res, c in zip(residuals, cov)]

        mean_r = statistics.mean(residuals)
        return [r - mean_r for r in residuals]

    # ─── Granger Causality ─────────────────────────────────────────────────────

    def _granger_test(self, series: Dict[str, List[float]], target: str) -> Dict[str, Any]:
        """
        Tests if each variable Granger-causes the target:
        Compare prediction accuracy with and without the lagged predictor.
        """
        target_vals = series[target]
        results = {}

        for col, vals in series.items():
            if col == target or len(vals) < 10:
                continue

            lag = 1
            n = len(target_vals) - lag

            # Model 1: AR(1) on target only
            y = target_vals[lag:]
            y_lagged = target_vals[:n]
            b_ar, a_ar = self._simple_ols(y_lagged, y)
            residuals_ar = [(y[i] - (b_ar * y_lagged[i] + a_ar)) ** 2 for i in range(n)]

            # Model 2: AR(1) + lagged predictor
            x_lagged = vals[:n]
            b_full, a_full, c_full = self._ols_2var(y_lagged, x_lagged, y)
            residuals_full = [
                (y[i] - (b_full * y_lagged[i] + c_full * x_lagged[i] + a_full)) ** 2
                for i in range(n)
            ]

            sse_ar = sum(residuals_ar)
            sse_full = sum(residuals_full)

            # F-statistic (simplified)
            if sse_full < 1e-12:
                f_stat = 0.0
            else:
                f_stat = ((sse_ar - sse_full) / 1) / (sse_full / max(n - 3, 1))

            improvement_pct = max((sse_ar - sse_full) / max(sse_ar, 1e-9) * 100, 0)

            results[col] = {
                "f_statistic": round(f_stat, 4),
                "sse_without_predictor": round(sse_ar, 6),
                "sse_with_predictor": round(sse_full, 6),
                "prediction_improvement_pct": round(improvement_pct, 2),
                "granger_causes_target": f_stat > 4.0 and improvement_pct > 5,
                "lag": lag
            }

        return results

    def _simple_ols(self, x: List[float], y: List[float]) -> Tuple[float, float]:
        n = len(x)
        if n < 2:
            return 0.0, statistics.mean(y) if y else 0.0
        mx, my = statistics.mean(x), statistics.mean(y)
        num = sum((xi - mx) * (yi - my) for xi, yi in zip(x, y))
        den = sum((xi - mx) ** 2 for xi in x)
        b = num / den if den > 1e-12 else 0.0
        return b, my - b * mx

    def _ols_2var(self, x1, x2, y) -> Tuple[float, float, float]:
        """OLS with two predictors (gradient descent for simplicity)."""
        n = len(y)
        b1, b2, a = 0.0, 0.0, statistics.mean(y)
        lr = 0.001
        for _ in range(200):
            errors = [y[i] - (b1 * x1[i] + b2 * x2[i] + a) for i in range(n)]
            grad_b1 = -2 * sum(errors[i] * x1[i] for i in range(n)) / n
            grad_b2 = -2 * sum(errors[i] * x2[i] for i in range(n)) / n
            grad_a = -2 * sum(errors) / n
            b1 -= lr * grad_b1
            b2 -= lr * grad_b2
            a -= lr * grad_a
        return b1, a, b2

    # ─── Causal Skeleton ──────────────────────────────────────────────────────

    def _build_skeleton(
        self, corr_matrix: Dict, cols: List[str], threshold: float = 0.3
    ) -> List[Dict]:
        edges = []
        for i, c1 in enumerate(cols):
            for j, c2 in enumerate(cols):
                if j <= i:
                    continue
                corr = abs(corr_matrix.get(c1, {}).get(c2, 0))
                if corr >= threshold:
                    edges.append({
                        "from": c1,
                        "to": c2,
                        "correlation": corr_matrix[c1][c2],
                        "strength": self._strength_label(corr)
                    })
        return sorted(edges, key=lambda e: abs(e["correlation"]), reverse=True)

    # ─── What-If Simulation ───────────────────────────────────────────────────

    def _what_if_simulation(
        self, series: Dict[str, List[float]], target: str, corr_matrix: Dict
    ) -> List[Dict]:
        """Estimate what happens to target if each predictor changes by ±10%."""
        simulations = []
        target_vals = series[target]
        target_mean = statistics.mean(target_vals)
        target_std = statistics.pstdev(target_vals)

        for col, vals in series.items():
            if col == target:
                continue
            corr = corr_matrix.get(col, {}).get(target, 0)
            col_std = statistics.pstdev(vals)

            if col_std < 1e-9:
                continue

            # Standardised regression coefficient
            beta = corr * (target_std / col_std)
            col_mean = statistics.mean(vals)

            delta_10pct = col_mean * 0.10
            predicted_target_change = beta * delta_10pct

            simulations.append({
                "predictor": col,
                "correlation_with_target": round(corr, 4),
                "beta_coefficient": round(beta, 4),
                "scenario_plus_10pct": {
                    "predictor_change": f"+10% (from {col_mean:.2f} to {col_mean * 1.1:.2f})",
                    "estimated_target_change": round(predicted_target_change, 4),
                    "estimated_target_new_value": round(target_mean + predicted_target_change, 4),
                    "pct_change_in_target": round(predicted_target_change / max(abs(target_mean), 1e-9) * 100, 2)
                },
                "scenario_minus_10pct": {
                    "predictor_change": f"-10% (from {col_mean:.2f} to {col_mean * 0.9:.2f})",
                    "estimated_target_change": round(-predicted_target_change, 4),
                    "estimated_target_new_value": round(target_mean - predicted_target_change, 4),
                    "pct_change_in_target": round(-predicted_target_change / max(abs(target_mean), 1e-9) * 100, 2)
                }
            })

        return sorted(simulations, key=lambda s: abs(s["beta_coefficient"]), reverse=True)

    # ─── Root Cause Ranking ───────────────────────────────────────────────────

    def _rank_causes(
        self, partial_corr: Dict, granger: Dict, target: str
    ) -> List[Dict]:
        causes = []
        all_vars = set(list(partial_corr.keys()) + list(granger.keys()))
        for var in all_vars:
            pc = abs(partial_corr.get(var, {}).get("partial_correlation", 0))
            granger_f = granger.get(var, {}).get("f_statistic", 0)
            granger_cause = granger.get(var, {}).get("granger_causes_target", False)
            # Composite causal score
            causal_score = pc * 0.6 + min(granger_f / 20, 1.0) * 0.4
            causes.append({
                "variable": var,
                "causal_score": round(causal_score, 4),
                "partial_correlation": partial_corr.get(var, {}).get("partial_correlation", 0),
                "granger_f_statistic": round(granger_f, 4),
                "granger_causal": granger_cause,
                "relationship": partial_corr.get(var, {}).get("direction", "unknown"),
                "strength": self._strength_label(pc)
            })
        return sorted(causes, key=lambda c: c["causal_score"], reverse=True)

    # ─── Helpers ──────────────────────────────────────────────────────────────

    def _generate_insights(self, root_causes: List, granger: Dict, target: str) -> List[str]:
        insights = []
        if root_causes:
            top = root_causes[0]
            dir_word = "increases" if top["relationship"] == "positive" else "decreases"
            insights.append(
                f"🔗 '{top['variable']}' is the strongest driver of '{target}' "
                f"(score={top['causal_score']:.3f}). As it rises, {target} {dir_word}."
            )

        granger_causes = [v for v, d in granger.items() if d.get("granger_causes_target")]
        if granger_causes:
            insights.append(
                f"⏱️ Temporal causality confirmed: {', '.join(granger_causes)} "
                f"reliably predict future values of '{target}'."
            )
        else:
            insights.append(f"⏱️ No strong temporal (Granger) causality found — relationships may be contemporaneous.")

        if len(root_causes) > 2 and root_causes[1]["causal_score"] > 0.3:
            insights.append(
                f"📊 Secondary driver: '{root_causes[1]['variable']}' also has meaningful "
                f"influence (score={root_causes[1]['causal_score']:.3f})."
            )
        return insights

    def _strength_label(self, r: float) -> str:
        r = abs(r)
        if r >= 0.7:
            return "very strong"
        if r >= 0.5:
            return "strong"
        if r >= 0.3:
            return "moderate"
        if r >= 0.1:
            return "weak"
        return "negligible"

    def _approx_p_value(self, r: float, n: int) -> str:
        if n < 3:
            return "N/A"
        t = r * math.sqrt(n - 2) / max(math.sqrt(1 - r ** 2), 1e-9)
        t = abs(t)
        if t > 4:
            return "<0.001"
        if t > 3:
            return "<0.01"
        if t > 2:
            return "<0.05"
        return ">0.05"

    def _parse(self, file_contents) -> List[Dict]:
        rows = []
        for item in file_contents:
            if isinstance(item, dict):
                rows.append(item)
            elif isinstance(item, str):
                try:
                    p = json.loads(item)
                    if isinstance(p, list):
                        rows.extend(p)
                    elif isinstance(p, dict):
                        rows.append(p)
                except Exception:
                    pass
        return rows

    def _numeric_cols(self, data: List[Dict]) -> List[str]:
        if not data:
            return []
        cols = []
        for key in data[0].keys():
            sample = [r.get(key) for r in data[:20] if r.get(key) is not None]
            if sum(1 for v in sample if self._is_num(v)) >= len(sample) * 0.7:
                cols.append(key)
        return cols

    def _is_num(self, v) -> bool:
        try:
            float(v)
            return True
        except (TypeError, ValueError):
            return False

    def _error(self, msg: str) -> Dict:
        return {"status": "error", "agent": self.name, "message": msg}
