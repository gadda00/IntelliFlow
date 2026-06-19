"""
NLQ Interpreter Agent v1.0
============================
Converts natural language questions into structured analysis plans
using Gemini API (falls back to rule-based parsing if API unavailable).

Examples:
  "Show me sales trends by region" →  {type: "trend_analysis", group_by: "region", metric: "sales"}
  "What's causing revenue to drop?"  → {type: "causal_analysis", target: "revenue"}
  "Predict next quarter's growth"    → {type: "forecast", periods: 3, unit: "quarters"}
"""

import re
import json
import os
import logging
from typing import Any, Dict, List, Optional
from datetime import datetime

logger = logging.getLogger("intelliflow.nlq_interpreter")


class NLQInterpreterAgent:
    name = "NLQ Interpreter"

    # Intent patterns (rule-based fallback)
    INTENT_PATTERNS = [
        (r'\b(predict|forecast|project|future|next|upcoming)\b', 'forecast'),
        (r'\b(anomal|outlier|unusual|spike|drop|weird|strange)\b', 'anomaly_detection'),
        (r'\b(caus|why|reason|driver|factor|impact|effect)\b', 'causal_analysis'),
        (r'\b(correlat|relate|relationship|association)\b', 'correlation_analysis'),
        (r'\b(trend|over time|growth|decline|change)\b', 'trend_analysis'),
        (r'\b(compar|vs|versus|against|between|differ)\b', 'comparative_analysis'),
        (r'\b(distribut|histogram|spread|range|variance)\b', 'distribution_analysis'),
        (r'\b(segment|cluster|group|categor|classif)\b', 'segmentation'),
        (r'\b(summar|overview|summary|describe|profile)\b', 'summary'),
        (r'\b(quality|missing|null|duplicate|clean)\b', 'data_quality'),
    ]

    TIME_PATTERNS = [
        (r'\b(\d+)\s*(year|yr)', lambda m: int(m.group(1)) * 12, 'months'),
        (r'\b(\d+)\s*(quarter|q)', lambda m: int(m.group(1)) * 3, 'months'),
        (r'\b(\d+)\s*(month|mo)', lambda m: int(m.group(1)), 'months'),
        (r'\b(\d+)\s*(week|wk)', lambda m: int(m.group(1)), 'weeks'),
        (r'\b(\d+)\s*(day)', lambda m: int(m.group(1)), 'days'),
    ]

    METRIC_KEYWORDS = [
        'revenue', 'sales', 'profit', 'cost', 'spend', 'income',
        'users', 'customers', 'orders', 'visits', 'clicks', 'conversions',
        'price', 'quantity', 'volume', 'rate', 'score', 'count', 'total'
    ]

    def __init__(self, config: Dict[str, Any] = None):
        self.config = config or {}
        self.gemini_key = os.getenv('GEMINI_API_KEY') or os.getenv('GOOGLE_API_KEY', '')

    # ─── Public API ────────────────────────────────────────────────────────────

    async def interpret(
        self,
        query: str,
        context: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """Convert a natural language query into a structured analysis plan."""
        try:
            query = query.strip()
            if not query:
                return self._error("Empty query provided")

            # Try Gemini first, fall back to rule-based
            if self.gemini_key:
                result = await self._interpret_with_gemini(query, context or {})
                if result.get("status") == "success":
                    return result

            # Rule-based fallback
            return self._interpret_rule_based(query, context or {})

        except Exception as e:
            logger.exception("NLQ interpretation failed")
            return self._error(str(e))

    # ─── Gemini-Powered Interpretation ────────────────────────────────────────

    async def _interpret_with_gemini(self, query: str, context: Dict) -> Dict[str, Any]:
        """Use Gemini API for rich, context-aware interpretation."""
        try:
            import requests as req

            columns_hint = ""
            if context.get("columns"):
                columns_hint = f"\nAvailable data columns: {', '.join(context['columns'])}"

            prompt = f"""You are a data analysis assistant. Convert this natural language query into a structured analysis plan as JSON.

Query: "{query}"{columns_hint}

Return ONLY valid JSON (no markdown) with this structure:
{{
  "intent": "one of: forecast|anomaly_detection|causal_analysis|correlation_analysis|trend_analysis|comparative_analysis|distribution_analysis|segmentation|summary|data_quality",
  "analysis_type": "human-friendly name",
  "target_metric": "the main column/metric to analyse or null",
  "group_by": "column to group by or null",
  "time_column": "date/time column if relevant or null",
  "forecast_periods": "number of periods if forecasting or null",
  "filters": {{}},
  "parameters": {{}},
  "sub_analyses": ["list of secondary analyses to run"],
  "explanation": "one sentence explaining what will be done",
  "suggested_visualizations": ["list of chart types that would best show the result"]
}}"""

            url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent"
            payload = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"temperature": 0.1, "maxOutputTokens": 500}
            }
            resp = req.post(
                url,
                json=payload,
                params={"key": self.gemini_key},
                timeout=10
            )
            resp.raise_for_status()
            raw = resp.json()

            text = raw["candidates"][0]["content"]["parts"][0]["text"].strip()
            # Strip markdown code fences if present
            text = re.sub(r'^```json?\s*', '', text)
            text = re.sub(r'\s*```$', '', text)

            plan = json.loads(text)
            plan["query"] = query
            plan["interpreted_by"] = "gemini"
            plan["confidence"] = "high"

            return {
                "status": "success",
                "agent": self.name,
                "query": query,
                "analysis_plan": plan,
                "timestamp": datetime.utcnow().isoformat()
            }

        except Exception as e:
            logger.warning(f"Gemini NLQ failed: {e}, falling back to rule-based")
            return {"status": "error", "message": str(e)}

    # ─── Rule-Based Interpretation ─────────────────────────────────────────────

    def _interpret_rule_based(self, query: str, context: Dict) -> Dict[str, Any]:
        """Pattern-matching fallback for when Gemini is unavailable."""
        q_lower = query.lower()

        # Detect intent
        intent = "summary"
        for pattern, detected_intent in self.INTENT_PATTERNS:
            if re.search(pattern, q_lower, re.IGNORECASE):
                intent = detected_intent
                break

        # Detect metrics
        metrics = [kw for kw in self.METRIC_KEYWORDS if kw in q_lower]

        # Detect time horizon
        forecast_periods = None
        period_unit = "periods"
        for pattern, converter, unit in self.TIME_PATTERNS:
            m = re.search(pattern, q_lower, re.IGNORECASE)
            if m:
                forecast_periods = converter(m)
                period_unit = unit
                break

        # Detect grouping
        group_keywords = {
            r'\bby\s+(\w+)': None,
            r'\bper\s+(\w+)': None,
            r'\bacross\s+(\w+)': None
        }
        group_by = None
        for pattern in group_keywords:
            m = re.search(pattern, q_lower)
            if m:
                candidate = m.group(1)
                if candidate not in ('the', 'a', 'an', 'month', 'year', 'quarter'):
                    group_by = candidate
                break

        # Match to available columns if context provided
        available_cols = context.get("columns", [])
        target_metric = None
        if metrics and available_cols:
            for metric in metrics:
                for col in available_cols:
                    if metric.lower() in col.lower():
                        target_metric = col
                        break
                if target_metric:
                    break
        elif metrics:
            target_metric = metrics[0] if metrics else None

        # Build suggested visualizations
        viz_map = {
            "forecast": ["line_chart", "area_chart_with_confidence_bands"],
            "anomaly_detection": ["scatter_plot", "box_plot", "time_series_with_highlights"],
            "causal_analysis": ["correlation_heatmap", "scatter_matrix", "causal_graph"],
            "trend_analysis": ["line_chart", "area_chart"],
            "comparative_analysis": ["bar_chart", "grouped_bar", "radar_chart"],
            "distribution_analysis": ["histogram", "box_plot", "violin_plot"],
            "segmentation": ["pie_chart", "stacked_bar", "bubble_chart"],
            "correlation_analysis": ["heatmap", "scatter_matrix"],
            "summary": ["dashboard_cards", "bar_chart"],
            "data_quality": ["completeness_bar", "quality_score_gauge"]
        }

        explanation_map = {
            "forecast": f"Forecast future values{' of ' + target_metric if target_metric else ''}{' for ' + str(forecast_periods) + ' ' + period_unit if forecast_periods else ''}.",
            "anomaly_detection": f"Detect unusual values and outliers{' in ' + target_metric if target_metric else ''} across your dataset.",
            "causal_analysis": f"Discover what drives{' ' + target_metric if target_metric else ''} and quantify causal relationships.",
            "trend_analysis": f"Analyse trends{' in ' + target_metric if target_metric else ''} over time.",
            "comparative_analysis": f"Compare values{' by ' + group_by if group_by else ''} to find differences.",
            "distribution_analysis": f"Examine the distribution and spread of{' ' + target_metric if target_metric else ' your data'}.",
            "segmentation": f"Segment and group data{' by ' + group_by if group_by else ''} to find patterns.",
            "correlation_analysis": "Find correlations and relationships between variables.",
            "summary": "Generate a comprehensive statistical summary of your dataset.",
            "data_quality": "Assess data quality: completeness, consistency, and validity."
        }

        plan = {
            "intent": intent,
            "analysis_type": intent.replace("_", " ").title(),
            "target_metric": target_metric,
            "group_by": group_by,
            "time_column": context.get("time_column"),
            "forecast_periods": forecast_periods,
            "period_unit": period_unit,
            "filters": {},
            "parameters": {},
            "sub_analyses": self._suggest_sub_analyses(intent),
            "explanation": explanation_map.get(intent, "Analyse your data comprehensively."),
            "suggested_visualizations": viz_map.get(intent, ["bar_chart", "line_chart"]),
            "query": query,
            "interpreted_by": "rule_based",
            "confidence": "medium"
        }

        return {
            "status": "success",
            "agent": self.name,
            "query": query,
            "analysis_plan": plan,
            "timestamp": datetime.utcnow().isoformat()
        }

    def _suggest_sub_analyses(self, intent: str) -> List[str]:
        sub_map = {
            "forecast": ["trend_analysis", "seasonality_detection", "anomaly_check_before_forecast"],
            "anomaly_detection": ["distribution_analysis", "temporal_spike_detection"],
            "causal_analysis": ["correlation_analysis", "partial_correlation", "granger_test"],
            "trend_analysis": ["seasonality_detection", "forecast"],
            "summary": ["distribution_analysis", "correlation_analysis", "data_quality"],
        }
        return sub_map.get(intent, ["summary"])

    def _error(self, msg: str) -> Dict:
        return {"status": "error", "agent": self.name, "message": msg}
