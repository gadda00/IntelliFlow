"""
Data Quality Guardian Agent v1.0
==================================
Performs a hospital-grade data quality audit across 6 dimensions:
  1. Completeness   – missing values audit
  2. Consistency    – format & type consistency per column
  3. Accuracy       – range/outlier sanity checks
  4. Uniqueness     – duplicate row / value detection
  5. Validity       – pattern conformance (email, date, phone, etc.)
  6. Timeliness     – date column freshness (if present)

Returns an overall quality score (0-100) + remediation recommendations.
"""

import re
import json
import math
import logging
import statistics
from typing import Any, Dict, List, Optional, Tuple
from datetime import datetime

logger = logging.getLogger("intelliflow.data_quality_guardian")


class DataQualityGuardianAgent:
    name = "Data Quality Guardian"

    # Regex patterns for validity checks
    EMAIL_RE = re.compile(r'^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$')
    PHONE_RE = re.compile(r'^\+?[\d\s\-().]{7,20}$')
    DATE_PATTERNS = [
        re.compile(r'^\d{4}-\d{2}-\d{2}'),           # YYYY-MM-DD
        re.compile(r'^\d{2}/\d{2}/\d{4}'),            # MM/DD/YYYY
        re.compile(r'^\d{2}-\d{2}-\d{4}'),            # DD-MM-YYYY
        re.compile(r'^\d{4}/\d{2}/\d{2}'),            # YYYY/MM/DD
    ]
    URL_RE = re.compile(r'^https?://[^\s]+$')

    def __init__(self, config: Dict[str, Any] = None):
        self.config = config or {}

    # ─── Public API ────────────────────────────────────────────────────────────

    async def assess(self, file_contents: List) -> Dict[str, Any]:
        try:
            data = self._parse(file_contents)
            if not data:
                return self._error("No data to assess")

            columns = list(data[0].keys()) if data else []
            n = len(data)

            # Run all 6 quality dimensions
            completeness = self._assess_completeness(data, columns)
            consistency = self._assess_consistency(data, columns)
            accuracy = self._assess_accuracy(data, columns)
            uniqueness = self._assess_uniqueness(data, columns)
            validity = self._assess_validity(data, columns)
            timeliness = self._assess_timeliness(data, columns)

            # Weighted overall score
            scores = {
                "completeness": completeness["score"],
                "consistency": consistency["score"],
                "accuracy": accuracy["score"],
                "uniqueness": uniqueness["score"],
                "validity": validity["score"],
                "timeliness": timeliness["score"]
            }
            weights = {
                "completeness": 0.25,
                "consistency": 0.20,
                "accuracy": 0.20,
                "uniqueness": 0.15,
                "validity": 0.15,
                "timeliness": 0.05
            }
            overall_score = sum(scores[k] * weights[k] for k in scores)

            grade = self._grade(overall_score)
            issues = self._collect_critical_issues(completeness, consistency, accuracy, uniqueness, validity)
            recommendations = self._generate_recommendations(issues, scores)

            return {
                "status": "success",
                "agent": self.name,
                "dataset_profile": {
                    "rows": n,
                    "columns": len(columns),
                    "column_names": columns,
                    "estimated_size_kb": round(n * len(columns) * 10 / 1024, 2)
                },
                "overall_quality": {
                    "score": round(overall_score, 1),
                    "grade": grade["letter"],
                    "label": grade["label"],
                    "color": grade["color"]
                },
                "dimensions": {
                    "completeness": completeness,
                    "consistency": consistency,
                    "accuracy": accuracy,
                    "uniqueness": uniqueness,
                    "validity": validity,
                    "timeliness": timeliness
                },
                "critical_issues": issues[:20],
                "recommendations": recommendations,
                "column_quality_cards": self._column_cards(data, columns),
                "timestamp": datetime.utcnow().isoformat()
            }

        except Exception as e:
            logger.exception("Data quality assessment failed")
            return self._error(str(e))

    # ─── Dimension 1: Completeness ─────────────────────────────────────────────

    def _assess_completeness(self, data: List[Dict], columns: List[str]) -> Dict:
        n = len(data)
        col_stats = {}
        total_cells = n * len(columns)
        total_missing = 0

        for col in columns:
            missing = sum(1 for row in data if row.get(col) is None or str(row.get(col, '')).strip() == '')
            missing_pct = missing / max(n, 1) * 100
            total_missing += missing
            col_stats[col] = {
                "missing_count": missing,
                "missing_pct": round(missing_pct, 2),
                "filled_pct": round(100 - missing_pct, 2),
                "status": "critical" if missing_pct > 50 else "warning" if missing_pct > 10 else "good"
            }

        overall_completeness = (1 - total_missing / max(total_cells, 1)) * 100

        return {
            "score": round(overall_completeness, 1),
            "total_missing_cells": total_missing,
            "total_cells": total_cells,
            "missing_rate_pct": round(total_missing / max(total_cells, 1) * 100, 2),
            "columns": col_stats,
            "worst_columns": sorted(
                [(k, v["missing_pct"]) for k, v in col_stats.items()],
                key=lambda x: x[1], reverse=True
            )[:5]
        }

    # ─── Dimension 2: Consistency ──────────────────────────────────────────────

    def _assess_consistency(self, data: List[Dict], columns: List[str]) -> Dict:
        col_stats = {}
        total_inconsistencies = 0

        for col in columns:
            values = [str(row.get(col, '')) for row in data if row.get(col) is not None]
            if not values:
                col_stats[col] = {"inferred_type": "unknown", "consistency_pct": 100, "inconsistencies": 0}
                continue

            # Infer dominant type
            type_counts = self._infer_types(values)
            dominant_type = max(type_counts, key=type_counts.get)
            dominant_count = type_counts[dominant_type]
            inconsistencies = len(values) - dominant_count
            consistency_pct = dominant_count / max(len(values), 1) * 100
            total_inconsistencies += inconsistencies

            col_stats[col] = {
                "inferred_type": dominant_type,
                "type_distribution": type_counts,
                "consistency_pct": round(consistency_pct, 2),
                "inconsistencies": inconsistencies,
                "status": "critical" if consistency_pct < 70 else "warning" if consistency_pct < 90 else "good"
            }

        cols_with_data = len([c for c in col_stats if col_stats[c]["inferred_type"] != "unknown"])
        avg_consistency = statistics.mean(
            [col_stats[c]["consistency_pct"] for c in col_stats]
        ) if col_stats else 100

        return {
            "score": round(avg_consistency, 1),
            "total_inconsistencies": total_inconsistencies,
            "columns": col_stats
        }

    def _infer_types(self, values: List[str]) -> Dict[str, int]:
        counts = {"integer": 0, "float": 0, "boolean": 0, "date": 0, "email": 0, "url": 0, "text": 0}
        for v in values:
            v_str = str(v).strip()
            if v_str.lstrip('-').isdigit():
                counts["integer"] += 1
            elif self._is_float(v_str):
                counts["float"] += 1
            elif v_str.lower() in ('true', 'false', 'yes', 'no', '1', '0'):
                counts["boolean"] += 1
            elif self._is_date(v_str):
                counts["date"] += 1
            elif self.EMAIL_RE.match(v_str):
                counts["email"] += 1
            elif self.URL_RE.match(v_str):
                counts["url"] += 1
            else:
                counts["text"] += 1
        return {k: v for k, v in counts.items() if v > 0}

    def _is_float(self, v: str) -> bool:
        try:
            float(v)
            return True
        except ValueError:
            return False

    def _is_date(self, v: str) -> bool:
        return any(p.match(v) for p in self.DATE_PATTERNS)

    # ─── Dimension 3: Accuracy ────────────────────────────────────────────────

    def _assess_accuracy(self, data: List[Dict], columns: List[str]) -> Dict:
        col_stats = {}
        total_outliers = 0
        numeric_cols = 0

        for col in columns:
            nums = []
            for row in data:
                v = row.get(col)
                if v is not None and self._is_float(str(v)):
                    nums.append(float(v))

            if len(nums) < 5:
                continue

            numeric_cols += 1
            q1 = self._percentile(sorted(nums), 25)
            q3 = self._percentile(sorted(nums), 75)
            iqr = q3 - q1
            lower = q1 - 3 * iqr
            upper = q3 + 3 * iqr

            outliers = [v for v in nums if v < lower or v > upper]
            outlier_pct = len(outliers) / max(len(nums), 1) * 100
            total_outliers += len(outliers)

            col_stats[col] = {
                "min": round(min(nums), 4),
                "max": round(max(nums), 4),
                "mean": round(statistics.mean(nums), 4),
                "stdev": round(statistics.pstdev(nums), 4),
                "q1": round(q1, 4),
                "q3": round(q3, 4),
                "outlier_count": len(outliers),
                "outlier_pct": round(outlier_pct, 2),
                "extreme_values": sorted(outliers, key=abs, reverse=True)[:5],
                "status": "critical" if outlier_pct > 20 else "warning" if outlier_pct > 5 else "good"
            }

        score = max(0, 100 - (total_outliers / max(len(data) * max(numeric_cols, 1), 1)) * 500)

        return {
            "score": round(min(score, 100), 1),
            "numeric_columns_assessed": numeric_cols,
            "total_outliers": total_outliers,
            "columns": col_stats
        }

    # ─── Dimension 4: Uniqueness ──────────────────────────────────────────────

    def _assess_uniqueness(self, data: List[Dict], columns: List[str]) -> Dict:
        n = len(data)

        # Full row duplicates
        row_strings = [json.dumps(row, sort_keys=True) for row in data]
        unique_rows = len(set(row_strings))
        duplicate_rows = n - unique_rows
        row_dup_pct = duplicate_rows / max(n, 1) * 100

        # Per-column cardinality
        col_stats = {}
        for col in columns:
            values = [str(row.get(col, '')) for row in data if row.get(col) is not None]
            unique_vals = len(set(values))
            cardinality_pct = unique_vals / max(len(values), 1) * 100
            is_potential_key = cardinality_pct == 100

            col_stats[col] = {
                "unique_values": unique_vals,
                "total_values": len(values),
                "cardinality_pct": round(cardinality_pct, 2),
                "is_potential_key": is_potential_key,
                "is_low_cardinality": cardinality_pct < 5  # likely categorical
            }

        score = max(0, 100 - row_dup_pct * 2)
        return {
            "score": round(score, 1),
            "total_rows": n,
            "unique_rows": unique_rows,
            "duplicate_rows": duplicate_rows,
            "duplicate_row_pct": round(row_dup_pct, 2),
            "columns": col_stats,
            "potential_key_columns": [c for c, s in col_stats.items() if s["is_potential_key"]],
            "categorical_columns": [c for c, s in col_stats.items() if s["is_low_cardinality"]]
        }

    # ─── Dimension 5: Validity ────────────────────────────────────────────────

    def _assess_validity(self, data: List[Dict], columns: List[str]) -> Dict:
        col_stats = {}
        invalid_counts = []

        for col in columns:
            values = [str(row.get(col, '')).strip() for row in data if row.get(col) is not None]
            if not values:
                continue

            type_counts = self._infer_types(values)
            dominant_type = max(type_counts, key=type_counts.get) if type_counts else "text"

            # Check validity for typed columns
            invalid = 0
            if dominant_type == "email":
                invalid = sum(1 for v in values if not self.EMAIL_RE.match(v))
            elif dominant_type == "date":
                invalid = sum(1 for v in values if not self._is_date(v) and v)
            elif dominant_type in ("integer", "float"):
                invalid = sum(1 for v in values if not self._is_float(v) and v)
            elif dominant_type == "url":
                invalid = sum(1 for v in values if not self.URL_RE.match(v))

            validity_pct = (1 - invalid / max(len(values), 1)) * 100
            invalid_counts.append(invalid)

            col_stats[col] = {
                "detected_format": dominant_type,
                "invalid_entries": invalid,
                "validity_pct": round(validity_pct, 2),
                "status": "critical" if validity_pct < 70 else "warning" if validity_pct < 95 else "good"
            }

        avg_validity = statistics.mean(
            [col_stats[c]["validity_pct"] for c in col_stats]
        ) if col_stats else 100

        return {
            "score": round(avg_validity, 1),
            "total_invalid_entries": sum(invalid_counts),
            "columns": col_stats
        }

    # ─── Dimension 6: Timeliness ──────────────────────────────────────────────

    def _assess_timeliness(self, data: List[Dict], columns: List[str]) -> Dict:
        date_cols = []
        for col in columns:
            sample = [str(row.get(col, '')) for row in data[:20] if row.get(col)]
            if sum(1 for v in sample if self._is_date(v)) >= len(sample) * 0.6:
                date_cols.append(col)

        if not date_cols:
            return {"score": 75.0, "note": "No date columns detected", "date_columns": []}

        now = datetime.utcnow()
        results = []
        for col in date_cols:
            dates = []
            for row in data:
                v = str(row.get(col, ''))
                if v:
                    try:
                        d = self._parse_date(v)
                        if d:
                            dates.append(d)
                    except Exception:
                        pass

            if not dates:
                continue

            latest = max(dates)
            days_old = (now - latest).days
            score = max(0, 100 - days_old * 0.5)

            results.append({
                "column": col,
                "latest_date": latest.isoformat(),
                "days_since_latest": days_old,
                "timeliness_score": round(score, 1),
                "status": "good" if days_old < 30 else "warning" if days_old < 90 else "critical"
            })

        avg_score = statistics.mean([r["timeliness_score"] for r in results]) if results else 75.0
        return {
            "score": round(avg_score, 1),
            "date_columns": results
        }

    # ─── Helpers ──────────────────────────────────────────────────────────────

    def _parse_date(self, v: str) -> Optional[datetime]:
        for fmt in ('%Y-%m-%d', '%m/%d/%Y', '%d-%m-%Y', '%Y/%m/%d',
                    '%Y-%m-%dT%H:%M:%S', '%Y-%m-%d %H:%M:%S'):
            try:
                return datetime.strptime(v[:19], fmt)
            except ValueError:
                continue
        return None

    def _percentile(self, sorted_data: List[float], p: float) -> float:
        n = len(sorted_data)
        if n == 0:
            return 0.0
        k = (n - 1) * p / 100
        f, c = int(k), math.ceil(k)
        if f == c:
            return sorted_data[int(k)]
        return sorted_data[f] * (c - k) + sorted_data[c] * (k - f)

    def _grade(self, score: float) -> Dict:
        if score >= 95:
            return {"letter": "A+", "label": "Excellent", "color": "#22c55e"}
        if score >= 85:
            return {"letter": "A", "label": "Very Good", "color": "#4ade80"}
        if score >= 75:
            return {"letter": "B", "label": "Good", "color": "#a3e635"}
        if score >= 60:
            return {"letter": "C", "label": "Fair", "color": "#facc15"}
        if score >= 45:
            return {"letter": "D", "label": "Poor", "color": "#fb923c"}
        return {"letter": "F", "label": "Critical", "color": "#f87171"}

    def _collect_critical_issues(self, *dimension_results) -> List[Dict]:
        issues = []
        for dim in dimension_results:
            for col, stats in dim.get("columns", {}).items():
                if isinstance(stats, dict) and stats.get("status") == "critical":
                    issues.append({
                        "column": col,
                        "dimension": dim.get("score", 0),
                        "details": stats
                    })
        return issues

    def _generate_recommendations(self, issues: List, scores: Dict) -> List[str]:
        recs = []
        if scores["completeness"] < 80:
            recs.append("🩹 Fill missing values using median imputation for numeric cols, mode for categorical.")
        if scores["consistency"] < 85:
            recs.append("🔧 Standardise data types — mixed type columns need parsing/coercion.")
        if scores["uniqueness"] < 90:
            recs.append("🔁 Remove duplicate rows after investigating their source.")
        if scores["accuracy"] < 80:
            recs.append("🎯 Investigate and cap/remove extreme outliers before modelling.")
        if scores["validity"] < 90:
            recs.append("✅ Add data validation at ingestion: reject invalid emails, dates, numbers.")
        if scores["timeliness"] < 70:
            recs.append("⏰ Data appears stale — verify your ETL pipeline and update frequency.")
        if not recs:
            recs.append("✨ Your data quality is excellent! No critical issues detected.")
        return recs

    def _column_cards(self, data: List[Dict], columns: List[str]) -> List[Dict]:
        cards = []
        n = len(data)
        for col in columns[:20]:  # cap at 20
            values = [row.get(col) for row in data if row.get(col) is not None]
            missing = n - len(values)
            type_counts = self._infer_types([str(v) for v in values[:50]])
            dominant_type = max(type_counts, key=type_counts.get) if type_counts else "unknown"
            unique = len(set(str(v) for v in values))

            card: Dict[str, Any] = {
                "column": col,
                "type": dominant_type,
                "missing": missing,
                "missing_pct": round(missing / max(n, 1) * 100, 1),
                "unique_values": unique,
                "cardinality_pct": round(unique / max(len(values), 1) * 100, 1)
            }
            # Add numeric stats if applicable
            nums = [float(v) for v in values if self._is_float(str(v))]
            if len(nums) >= 5:
                card["min"] = round(min(nums), 4)
                card["max"] = round(max(nums), 4)
                card["mean"] = round(statistics.mean(nums), 4)
                card["stdev"] = round(statistics.pstdev(nums), 4)
            cards.append(card)
        return cards

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

    def _error(self, msg: str) -> Dict:
        return {"status": "error", "agent": self.name, "message": msg}
