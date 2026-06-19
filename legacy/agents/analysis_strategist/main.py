"""
Analysis Strategist Agent implementation.

This agent is responsible for determining optimal analytical approaches based on data characteristics.
"""

import asyncio
from typing import Dict, Any, List, Optional

from common.adk import Agent, Tool, Message
from common.logging.logger import get_logger

logger = get_logger("agent.analysis_strategist")

class DataEvaluationTool(Tool):
    """Tool for evaluating data characteristics."""
    
    def __init__(self):
        super().__init__(name="DataEvaluationTool", description="Evaluate data characteristics to inform analysis strategy")
    
    async def execute(self, data_metadata: Dict[str, Any], **kwargs) -> Dict[str, Any]:
        """
        Execute data evaluation.
        
        Args:
            data_metadata: Metadata about the data to evaluate
            
        Returns:
            Data evaluation results
        """
        logger.info(f"Evaluating data characteristics")
        
        # This would use statistical libraries in a real implementation
        # For now, we'll return simulated results
        
        # Extract schema information
        schema = data_metadata.get("schema", [])
        column_types = {col["name"]: col["type"] for col in schema} if schema else {}
        
        # Determine data characteristics
        has_numeric = any(t in ("INTEGER", "FLOAT", "NUMERIC") for t in column_types.values())
        has_categorical = any(t in ("STRING", "BOOL") for t in column_types.values())
        has_temporal = any(t in ("DATE", "TIMESTAMP", "DATETIME") for t in column_types.values())
        row_count = data_metadata.get("total_rows", 0)
        
        result = {
            "status": "success",
            "characteristics": {
                "has_numeric_features": has_numeric,
                "has_categorical_features": has_categorical,
                "has_temporal_features": has_temporal,
                "row_count": row_count,
                "column_count": len(column_types),
                "data_completeness": 0.95,  # Simulated value
                "data_balance": 0.8,  # Simulated value
                "estimated_complexity": "medium"  # Simulated value
            }
        }
        
        return result


class StrategySelectionTool(Tool):
    """Tool for selecting appropriate analytical strategies."""
    
    def __init__(self):
        super().__init__(name="StrategySelectionTool", description="Select appropriate analytical strategies based on data characteristics and objectives")
    
    async def execute(self, data_characteristics: Dict[str, Any], objectives: List[str], **kwargs) -> Dict[str, Any]:
        """
        Execute strategy selection.
        
        Args:
            data_characteristics: Characteristics of the data
            objectives: Analysis objectives
            
        Returns:
            Selected strategies
        """
        logger.info(f"Selecting strategies for objectives: {objectives}")
        
        # This would use a more sophisticated decision algorithm in a real implementation
        # For now, we'll use a simple rule-based approach
        
        strategies = []
        
        # Check for descriptive analysis objectives
        if "summarize" in objectives or "describe" in objectives or "explore" in objectives:
            strategies.append({
                "type": "descriptive",
                "techniques": ["summary_statistics", "distribution_analysis", "correlation_analysis"],
                "priority": "high"
            })
        
        # Check for pattern discovery objectives
        if "discover_patterns" in objectives or "find_relationships" in objectives:
            if data_characteristics.get("has_numeric_features"):
                strategies.append({
                    "type": "pattern_discovery",
                    "techniques": ["correlation_analysis", "principal_component_analysis", "clustering"],
                    "priority": "medium"
                })
        
        # Check for predictive analysis objectives
        if "predict" in objectives or "forecast" in objectives:
            if data_characteristics.get("has_numeric_features"):
                if data_characteristics.get("has_temporal_features"):
                    strategies.append({
                        "type": "time_series",
                        "techniques": ["arima", "exponential_smoothing", "prophet"],
                        "priority": "high"
                    })
                else:
                    strategies.append({
                        "type": "regression",
                        "techniques": ["linear_regression", "random_forest", "gradient_boosting"],
                        "priority": "high"
                    })
        
        # Check for classification objectives
        if "classify" in objectives or "categorize" in objectives:
            strategies.append({
                "type": "classification",
                "techniques": ["logistic_regression", "random_forest", "gradient_boosting"],
                "priority": "high"
            })
        
        # Check for anomaly detection objectives
        if "detect_anomalies" in objectives or "find_outliers" in objectives:
            strategies.append({
                "type": "anomaly_detection",
                "techniques": ["isolation_forest", "one_class_svm", "statistical_tests"],
                "priority": "medium"
            })
        
        # Check for text analysis objectives
        if "analyze_text" in objectives and data_characteristics.get("has_categorical_features"):
            strategies.append({
                "type": "text_analysis",
                "techniques": ["sentiment_analysis", "topic_modeling", "named_entity_recognition"],
                "priority": "medium"
            })
        
        # If no specific strategies were selected, add a default exploratory strategy
        if not strategies:
            strategies.append({
                "type": "exploratory",
                "techniques": ["summary_statistics", "visualization", "correlation_analysis"],
                "priority": "high",
                "note": "Default strategy due to unclear objectives or insufficient data characteristics"
            })
        
        result = {
            "status": "success",
            "strategies": strategies,
            "rationale": "Selected based on data characteristics and analysis objectives"
        }
        
        return result


class AnalysisStrategyAgent(Agent):
    """Agent responsible for determining optimal analytical approaches."""
    
    def __init__(self, config: Dict[str, Any]):
        """
        Initialize the Analysis Strategist agent.
        
        Args:
            config: Agent configuration
        """
        super().__init__(name="AnalysisStrategyAgent")
        self.config = config
        
        # Register tools
        self.register_tools([
            DataEvaluationTool(),
            StrategySelectionTool()
        ])
        
        # Register message handlers
        self.register_message_handler("EVALUATE_DATA", self.handle_evaluate_data)
        self.register_message_handler("PLAN_ANALYSIS", self.handle_plan_analysis)
        
        logger.info("AnalysisStrategyAgent initialized")
    
    async def handle_evaluate_data(self, message: Message) -> Message:
        """
        Handle data evaluation requests.
        
        Args:
            message: Request message
            
        Returns:
            Response message with data evaluation results
        """
        logger.info(f"Handling EVALUATE_DATA request: {message.content}")
        
        data_metadata = message.content.get("data_metadata", {})
        
        result = await self.execute_tool("DataEvaluationTool", data_metadata=data_metadata)
        
        return Message(
            sender=self.name,
            intent="DATA_EVALUATED",
            content=result,
            correlation_id=message.message_id,
            reply_to=message.sender
        )
    
    async def handle_plan_analysis(self, message: Message) -> Message:
        """
        Handle analysis planning requests.
        
        Args:
            message: Request message
            
        Returns:
            Response message with analysis plan
        """
        logger.info(f"Handling PLAN_ANALYSIS request: {message.content}")
        
        data_metadata = message.content.get("data_metadata", {})
        objectives = message.content.get("objectives", [])
        
        # First evaluate the data
        evaluation_result = await self.execute_tool("DataEvaluationTool", data_metadata=data_metadata)
        data_characteristics = evaluation_result.get("characteristics", {})
        
        # Then select strategies based on evaluation
        strategy_result = await self.execute_tool(
            "StrategySelectionTool", 
            data_characteristics=data_characteristics, 
            objectives=objectives
        )
        
        # Combine results into a comprehensive analysis plan
        analysis_plan = {
            "status": "success",
            "data_evaluation": evaluation_result,
            "selected_strategies": strategy_result.get("strategies", []),
            "execution_plan": self._create_execution_plan(strategy_result.get("strategies", []))
        }
        
        return Message(
            sender=self.name,
            intent="ANALYSIS_PLANNED",
            content=analysis_plan,
            correlation_id=message.message_id,
            reply_to=message.sender
        )
    
    def _create_execution_plan(self, strategies: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Create an execution plan from selected strategies.
        
        Args:
            strategies: Selected analysis strategies
            
        Returns:
            Execution plan steps
        """
        execution_plan = []
        
        # Sort strategies by priority
        priority_order = {"high": 0, "medium": 1, "low": 2}
        sorted_strategies = sorted(strategies, key=lambda s: priority_order.get(s.get("priority"), 3))
        
        for i, strategy in enumerate(sorted_strategies):
            strategy_type = strategy.get("type")
            techniques = strategy.get("techniques", [])
            
            for technique in techniques:
                execution_plan.append({
                    "step_id": f"step_{i+1}_{techniques.index(technique)+1}",
                    "strategy_type": strategy_type,
                    "technique": technique,
                    "parameters": self._get_default_parameters(technique),
                    "dependencies": [] if i == 0 else [f"step_{i}_1"]  # Simple dependency on first step of previous strategy
                })
        
        return execution_plan
    
    def _get_default_parameters(self, technique: str) -> Dict[str, Any]:
        """
        Get default parameters for a technique.
        
        Args:
            technique: Analysis technique
            
        Returns:
            Default parameters
        """
        # This would be more comprehensive in a real implementation
        default_params = {
            "summary_statistics": {"include_percentiles": True},
            "correlation_analysis": {"method": "pearson", "threshold": 0.7},
            "principal_component_analysis": {"n_components": 3},
            "clustering": {"algorithm": "kmeans", "n_clusters": 3},
            "linear_regression": {"regularization": "l2"},
            "random_forest": {"n_estimators": 100, "max_depth": 10},
            "gradient_boosting": {"n_estimators": 100, "learning_rate": 0.1},
            "logistic_regression": {"regularization": "l2"},
            "arima": {"order": [1, 1, 1]},
            "exponential_smoothing": {"trend": "add", "seasonal": "add"},
            "prophet": {"changepoint_prior_scale": 0.05},
            "isolation_forest": {"contamination": 0.05},
            "one_class_svm": {"kernel": "rbf"},
            "statistical_tests": {"alpha": 0.05},
            "sentiment_analysis": {"model": "vader"},
            "topic_modeling": {"n_topics": 5, "algorithm": "lda"},
            "named_entity_recognition": {"model": "spacy"}
        }
        
        return default_params.get(technique, {})
