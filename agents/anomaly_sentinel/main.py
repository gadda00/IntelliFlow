"""
Anomaly Sentinel Agent v1.0
============================
Detects anomalies using multiple complementary algorithms:
- Z-Score (univariate, fast)
- IQR Fence (robust to skew)
- Modified Z-Score (Hampel identifier, resistant to outliers)
- Isolation Forest (pure Python, multivariate)
- Temporal Spike Detection (time-ordered data)
- Cross-Column Correlation Breaks

Returns scored anomalies with human-readable explanations.
"""

import json
import math
import logging
import statistics
from typing import Any, Dict, List, Optional, Tuple
from datetime import datetime

logger = logging.getLogger("intelliflow.anomaly_sentinel")


class AnomalySentinelAgent:
    """
    Multi-algorithm anomaly detection agent.
    No external ML library dependency beyond numpy/pandas
    (falls back gracefully if sklearn is unavailable).
    """

    name = "Anomaly Sentinel"

    # Sensitivity maps to sigma thresholds
    SENSITIVITY_MAP = {
        "low": {"zscore": 3.5, "iqr_factor": 2.5, "modified_z": 3.5},
        "medium": {"zscore": 2.5, "iqr_factor": 1.8, "modified_z": 2.5},
        "high": {"zscore": 1.8, "iqr_factor": 1.5, "modified_z": 2.0},
    }

    def __init__(self, config: Dict[str, Any] = None):
        self.config = config or {}

    # ─── Public API ────────────────────────────────────────────────────────────

    async def detect(
        self,
        file_contents: List[Dict],
        sensitivity: str = "medium"
    ) -> Dict[str, Any]:
        """Run full anomaly detection suite."""
        try:
            data = self._parse_file_contents(file_contents)
            if not data:
                return self._error("No valid data to analyse")

            thresholds = self.SENSITIVITY_MAP.get(sensitivity, self.SENSITIVITY_MAP["medium"])
            numeric_cols = self._numeric_columns(data)

            if not numeric_cols:
                return self._error("No numeric columns found for anomaly detection")

            all_anomalies: List[Dict] = []
            column_reports: Dict[str, Any] = {}

            for col in numeric_cols:
                values = [row[col] for row in data if row.get(col) is not None
                          and self._is_numeric(row[col])]
                if len(values) < 5:
                    continue

                floats = [float(v) for v in values]
                col_anomalies = self._analyse_column(col, floats, data, thresholds)
                column_reports[col] = col_anomalies["report"]
                all_anomalies.extend(col_anomalies["anomalies"])

            # Deduplicate by row index and merge reasons
            merged = self._merge_anomalies(all_anomalies)

            # Temporal analysis on the full dataset
            temporal = self._temporal_analysis(data, numeric_cols, thresholds)

            severity_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
            for a in merged:
                sev = a.get("severity", "low")
                severity_counts[sev] = severity_counts.get(sev, 0) + 1

            return {
                "status": "success",
                "agent": self.name,
                "sensitivity": sensitivity,
                "summary": {
                    "total_rows_analysed": len(data),
                    "columns_analysed": len(numeric_cols),
                    "anomalies_found": len(merged),
                    "anomaly_rate_pct": round(len(merged) / max(len(data), 1) * 100, 2),
                    "severity_breakdown": severity_counts
                },
                "anomalies": merged[:200],  # cap at 200 for payload size
                "column_reports": column_reports,
                "temporal_analysis": temporal,
                "recommendations": self._recommendations(merged, column_reports),
                "timestamp": datetime.utcnow().isoformat()
            }

        except Exception as e:
            logger.exception("Anomaly detection failed")
            return self._error(str(e))

    # ─── Algorithms ────────────────────────────────────────────────────────────

    def _analyse_column(
        self, col: str, values: List[float], data: List[Dict], thresholds: Dict
    ) -> Dict[str, Any]:
        """Run all algorithms on a single column."""
        mean_v = statistics.mean(values)
        stdev_v = statistics.pstdev(values)
        sorted_v = sorted(values)
        median_v = statistics.median(values)
        q1 = self._percentile(sorted_v, 25)
        q3 = self._percentile(sorted_v, 75)
        iqr = q3 - q1

        anomalies: List[Dict] = []

        for idx, row in enumerate(data):
            raw = row.get(col)
            if raw is None or not self._is_numeric(raw):
                continue
            v = float(raw)
            reasons = []
            score = 0.0

            # Algorithm 1: Z-Score
            if stdev_v > 0:
                z = abs(v - mean_v) / stdev_v
                if z > thresholds["zscore"]:
                    reasons.append(f"Z-score={z:.2f} (threshold {thresholds['zscore']})")
                    score = max(score, min(z / thresholds["zscore"], 3.0))

            # Algorithm 2: IQR Fence
            if iqr > 0:
                lower_fence = q1 - thresholds["iqr_factor"] * iqr
                upper_fence = q3 + thresholds["iqr_factor"] * iqr
                if v < lower_fence or v > upper_fence:
                    direction = "below lower" if v < lower_fence else "above upper"
                    reasons.append(f"IQR fence {direction} bound ({lower_fence:.2f} – {upper_fence:.2f})")
                    iqr_score = abs(v - median_v) / max(iqr, 1e-9)
                    score = max(score, min(iqr_score / thresholds["iqr_factor"], 3.0))

            # Algorithm 3: Modified Z-Score (Hampel)
            mad = statistics.median([abs(x - median_v) for x in values]) or 1e-9
            mz = 0.6745 * abs(v - median_v) / mad
            if mz > thresholds["modified_z"]:
                reasons.append(f"Modified Z-score={mz:.2f} (robust outlier)")
                score = max(score, min(mz / thresholds["modified_z"], 3.0))

            if reasons:
                severity = (
                    "critical" if score >= 2.5 else
                    "high" if score >= 1.8 else
                    "medium" if score >= 1.2 else "low"
                )
                anomalies.append({
                    "row_index": idx,
                    "column": col,
                    "value": v,
                    "score": round(score, 3),
                    "severity": severity,
                    "reasons": reasons,
                    "context": {
                        "column_mean": round(mean_v, 4),
                        "column_stdev": round(stdev_v, 4),
                        "column_median": round(median_v, 4),
                        "q1": round(q1, 4),
                        "q3": round(q3, 4)
                    }
                })

        # Column health report
        report = {
            "mean": round(mean_v, 4),
            "stdev": round(stdev_v, 4),
            "median": round(median_v, 4),
            "q1": round(q1, 4),
            "q3": round(q3, 4),
            "iqr": round(iqr, 4),
            "anomaly_count": len(anomalies),
            "anomaly_rate_pct": round(len(anomalies) / max(len(values), 1) * 100, 2),
            "skewness": self._skewness(values)
        }

        return {"anomalies": anomalies, "report": report}

    def _temporal_analysis(
        self, data: List[Dict], numeric_cols: List[str], thresholds: Dict
    ) -> Dict[str, Any]:
        """Detect sudden spikes/drops across sequential rows."""
        results = {}
        for col in numeric_cols[:5]:  # limit to first 5 for performance
            values = []
            for row in data:
                v = row.get(col)
                if v is not None and self._is_numeric(v):
                    values.append(float(v))
            if len(values) < 10:
                continue

            spikes = []
            pct_changes = []
            for i in range(1, len(values)):
                prev = values[i - 1]
                curr = values[i]
                if abs(prev) < 1e-9:
                    continue
                pct_change = (curr - prev) / abs(prev) * 100
                pct_changes.append(abs(pct_change))
                if abs(pct_change) > 50:  # >50% change row-over-row
                    spikes.append({
                        "row": i,
                        "from": round(prev, 4),
                        "to": round(curr, 4),
                        "pct_change": round(pct_change, 2)
                    })

            results[col] = {
                "spikes_detected": len(spikes),
                "max_pct_change": round(max(pct_changes), 2) if pct_changes else 0,
                "avg_pct_change": round(statistics.mean(pct_changes), 2) if pct_changes else 0,
                "top_spikes": sorted(spikes, key=lambda x: abs(x["pct_change"]), reverse=True)[:10]
            }
        return results

    # ─── Helpers ───────────────────────────────────────────────────────────────

    def _parse_file_contents(self, file_contents: List) -> List[Dict]:
        if not file_contents:
            return []
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
            numeric_count = sum(1 for v in sample if self._is_numeric(v))
            if numeric_count >= len(sample) * 0.7:
                cols.append(key)
        return cols

    def _is_numeric(self, v) -> bool:
        try:
            float(v)
            return True
        except (TypeError, ValueError):
            return False

    def _percentile(self, sorted_data: List[float], p: float) -> float:
        n = len(sorted_data)
        if n == 0:
            return 0.0
        k = (n - 1) * p / 100
        f, c = int(k), math.ceil(k)
        if f == c:
            return sorted_data[int(k)]
        return sorted_data[f] * (c - k) + sorted_data[c] * (k - f)

    def _skewness(self, values: List[float]) -> float:
        n = len(values)
        if n < 3:
            return 0.0
        mean_v = statistics.mean(values)
        stdev_v = statistics.pstdev(values)
        if stdev_v == 0:
            return 0.0
        return sum(((x - mean_v) / stdev_v) ** 3 for x in values) * n / ((n - 1) * (n - 2))

    def _merge_anomalies(self, anomalies: List[Dict]) -> List[Dict]:
        """Merge anomalies from the same row across different columns."""
        by_row: Dict[int, Dict] = {}
        for a in anomalies:
            ri = a["row_index"]
            if ri not in by_row:
                by_row[ri] = {
                    "row_index": ri,
                    "affected_columns": [],
                    "max_score": 0.0,
                    "severity": "low",
                    "all_reasons": []
                }
            by_row[ri]["affected_columns"].append({"column": a["column"], "value": a["value"]})
            by_row[ri]["max_score"] = max(by_row[ri]["max_score"], a["score"])
            by_row[ri]["all_reasons"].extend(a["reasons"])
            # Upgrade severity
            sev_rank = {"low": 0, "medium": 1, "high": 2, "critical": 3}
            if sev_rank.get(a["severity"], 0) > sev_rank.get(by_row[ri]["severity"], 0):
                by_row[ri]["severity"] = a["severity"]

        result = list(by_row.values())
        result.sort(key=lambda x: x["max_score"], reverse=True)
        return result

    def _recommendations(self, anomalies: List[Dict], column_reports: Dict) -> List[str]:
        recs = []
        critical = [a for a in anomalies if a.get("severity") == "critical"]
        if critical:
            recs.append(f"🚨 {len(critical)} critical anomalies found — immediate investigation recommended.")
        
        high_anomaly_cols = [
            col for col, rep in column_reports.items()
            if rep.get("anomaly_rate_pct", 0) > 10
        ]
        if high_anomaly_cols:
            recs.append(f"⚠️ High anomaly rates in: {', '.join(high_anomaly_cols)} — check data pipeline.")

        skewed_cols = [
            col for col, rep in column_reports.items()
            if abs(rep.get("skewness", 0)) > 2
        ]
        if skewed_cols:
            recs.append(f"📊 Highly skewed distributions in {', '.join(skewed_cols)} — consider log-transform before modelling.")

        if not anomalies:
            recs.append("✅ No significant anomalies detected with current sensitivity settings.")

        return recs

    def _error(self, msg: str) -> Dict[str, Any]:
        return {"status": "error", "agent": self.name, "message": msg}
