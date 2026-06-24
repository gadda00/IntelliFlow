"""
Insight Generator Agent implementation.

This agent is responsible for applying analytical techniques to discover patterns and trends.
"""

import asyncio
from typing import Dict, Any, List, Optional

from common.adk import Agent, Tool, Message
from common.logging.logger import get_logger

logger = get_logger("agent.insight_generator")

class StatisticalAnalysisTool(Tool):
    """Tool for performing statistical analysis."""
    
    def __init__(self):
        super().__init__(name="StatisticalAnalysisTool", description="Perform statistical analysis on data")
    
    async def execute(self, data: Dict[str, Any], analysis_type: str, parameters: Dict[str, Any] = None, **kwargs) -> Dict[str, Any]:
        """
        Execute statistical analysis.
        
        Args:
            data: Input data to analyze
            analysis_type: Type of analysis to perform
            parameters: Analysis parameters
            
        Returns:
            Analysis results
        """
        logger.info(f"Performing {analysis_type} statistical analysis")
        
        # This would use statistical libraries in a real implementation
        # For now, we'll return simulated results
        
        parameters = parameters or {}
        
        if analysis_type == "summary_statistics":
            result = {
                "status": "success",
                "summary": {
                    "count": 100,
                    "mean": 150.5,
                    "median": 145.0,
                    "std": 50.2,
                    "min": 50.0,
                    "max": 300.0,
                    "percentiles": {
                        "25": 100.0,
                        "50": 145.0,
                        "75": 200.0,
                        "90": 250.0
                    }
                }
            }
        elif analysis_type == "correlation_analysis":
            result = {
                "status": "success",
                "correlations": [
                    {"variable1": "value", "variable2": "category_encoded", "correlation": 0.75, "p_value": 0.001},
                    {"variable1": "value", "variable2": "value_squared", "correlation": 0.95, "p_value": 0.0001},
                    {"variable1": "category_encoded", "variable2": "value_normalized", "correlation": -0.2, "p_value": 0.1}
                ]
            }
        elif analysis_type == "distribution_analysis":
            result = {
                "status": "success",
                "distributions": {
                    "value": {
                        "distribution_type": "normal",
                        "parameters": {"mean": 150.5, "std": 50.2},
                        "goodness_of_fit": 0.92
                    },
                    "category": {
                        "distribution_type": "categorical",
                        "frequencies": {"A": 60, "B": 40}
                    }
                }
            }
        else:
            result = {
                "status": "error",
                "message": f"Unsupported analysis type: {analysis_type}"
            }
        
        return result


class MachineLearningTool(Tool):
    """Tool for applying machine learning techniques."""
    
    def __init__(self):
        super().__init__(name="MachineLearningTool", description="Apply machine learning techniques to data")
    
    async def execute(self, data: Dict[str, Any], technique: str, parameters: Dict[str, Any] = None, **kwargs) -> Dict[str, Any]:
        """
        Execute machine learning technique.
        
        Args:
            data: Input data to analyze
            technique: Machine learning technique to apply
            parameters: Technique parameters
            
        Returns:
            Analysis results
        """
        logger.info(f"Applying {technique} machine learning technique")
        
        # This would use machine learning libraries in a real implementation
        # For now, we'll return simulated results
        
        parameters = parameters or {}
        
        if technique == "clustering":
            result = {
                "status": "success",
                "clusters": [
                    {"cluster_id": 0, "size": 40, "centroid": {"value": 75.0, "category_encoded": 0.2}},
                    {"cluster_id": 1, "size": 35, "centroid": {"value": 150.0, "category_encoded": 0.6}},
                    {"cluster_id": 2, "size": 25, "centroid": {"value": 250.0, "category_encoded": 0.9}}
                ],
                "evaluation": {
                    "silhouette_score": 0.72,
                    "davies_bouldin_index": 0.45
                }
            }
        elif technique == "regression":
            result = {
                "status": "success",
                "model": {
                    "type": parameters.get("model_type", "linear_regression"),
                    "coefficients": {"intercept": 10.5, "value": 0.8, "category_encoded": 15.2},
                    "feature_importance": {"value": 0.7, "category_encoded": 0.3}
                },
                "evaluation": {
                    "r_squared": 0.85,
                    "mean_squared_error": 12.5,
                    "mean_absolute_error": 8.2
                }
            }
        elif technique == "classification":
            result = {
                "status": "success",
                "model": {
                    "type": parameters.get("model_type", "random_forest"),
                    "feature_importance": {"value": 0.6, "value_normalized": 0.3, "category_encoded": 0.1}
                },
                "evaluation": {
                    "accuracy": 0.88,
                    "precision": 0.85,
                    "recall": 0.82,
                    "f1_score": 0.83
                }
            }
        elif technique == "anomaly_detection":
            result = {
                "status": "success",
                "anomalies": {
                    "count": 5,
                    "indices": [12, 27, 45, 68, 93],
                    "scores": [0.95, 0.92, 0.89, 0.94, 0.91]
                },
                "evaluation": {
                    "precision": 0.9,
                    "recall": 0.85
                }
            }
        else:
            result = {
                "status": "error",
                "message": f"Unsupported technique: {technique}"
            }
        
        return result


class TextAnalysisTool(Tool):
    """Tool for analyzing text data."""
    
    def __init__(self):
        super().__init__(name="TextAnalysisTool", description="Analyze text data")
    
    async def execute(self, text_data: Dict[str, Any], technique: str, parameters: Dict[str, Any] = None, **kwargs) -> Dict[str, Any]:
        """
        Execute text analysis.
        
        Args:
            text_data: Input text data to analyze
            technique: Text analysis technique to apply
            parameters: Technique parameters
            
        Returns:
            Analysis results
        """
        logger.info(f"Applying {technique} text analysis technique")
        
        # This would use NLP libraries in a real implementation
        # For now, we'll return simulated results
        
        parameters = parameters or {}
        
        if technique == "sentiment_analysis":
            result = {
                "status": "success",
                "sentiment": {
                    "overall": {
                        "positive": 0.6,
                        "neutral": 0.3,
                        "negative": 0.1
                    },
                    "by_category": {
                        "product": {"positive": 0.7, "neutral": 0.2, "negative": 0.1},
                        "service": {"positive": 0.5, "neutral": 0.3, "negative": 0.2},
                        "price": {"positive": 0.4, "neutral": 0.4, "negative": 0.2}
                    }
                }
            }
        elif technique == "topic_modeling":
            result = {
                "status": "success",
                "topics": [
                    {"id": 0, "keywords": ["product", "quality", "design"], "weight": 0.4},
                    {"id": 1, "keywords": ["service", "support", "response"], "weight": 0.3},
                    {"id": 2, "keywords": ["price", "value", "cost"], "weight": 0.2},
                    {"id": 3, "keywords": ["delivery", "shipping", "time"], "weight": 0.1}
                ]
            }
        elif technique == "named_entity_recognition":
            result = {
                "status": "success",
                "entities": {
                    "PERSON": ["John Smith", "Mary Johnson"],
                    "ORG": ["Acme Corp", "TechGiant Inc"],
                    "PRODUCT": ["ModelX", "SuperWidget"],
                    "DATE": ["January 2025", "last week"]
                }
            }
        else:
            result = {
                "status": "error",
                "message": f"Unsupported technique: {technique}"
            }
        
        return result


class InsightGeneratorAgent(Agent):
    """Agent responsible for applying analytical techniques to discover patterns and trends."""
    
    def __init__(self, config: Dict[str, Any]):
        """
        Initialize the Insight Generator agent.
        
        Args:
            config: Agent configuration
        """
        super().__init__(name="InsightGeneratorAgent")
        self.config = config
        
        # Register tools
        self.register_tools([
            StatisticalAnalysisTool(),
            MachineLearningTool(),
            TextAnalysisTool()
        ])
        
        # Register message handlers
        self.register_message_handler("PERFORM_STATISTICAL_ANALYSIS", self.handle_statistical_analysis)
        self.register_message_handler("APPLY_MACHINE_LEARNING", self.handle_machine_learning)
        self.register_message_handler("ANALYZE_TEXT", self.handle_text_analysis)
        self.register_message_handler("GENERATE_INSIGHTS", self.handle_generate_insights)
        
        logger.info("InsightGeneratorAgent initialized")
    
    async def handle_statistical_analysis(self, message: Message) -> Message:
        """
        Handle statistical analysis requests.
        
        Args:
            message: Request message
            
        Returns:
            Response message with analysis results
        """
        logger.info(f"Handling PERFORM_STATISTICAL_ANALYSIS request: {message.content}")
        
        data = message.content.get("data", {})
        analysis_type = message.content.get("analysis_type")
        parameters = message.content.get("parameters", {})
        
        result = await self.execute_tool(
            "StatisticalAnalysisTool", 
            data=data, 
            analysis_type=analysis_type, 
            parameters=parameters
        )
        
        return Message(
            sender=self.name,
            intent="STATISTICAL_ANALYSIS_COMPLETED",
            content=result,
            correlation_id=message.message_id,
            reply_to=message.sender
        )
    
    async def handle_machine_learning(self, message: Message) -> Message:
        """
        Handle machine learning requests.
        
        Args:
            message: Request message
            
        Returns:
            Response message with analysis results
        """
        logger.info(f"Handling APPLY_MACHINE_LEARNING request: {message.content}")
        
        data = message.content.get("data", {})
        technique = message.content.get("technique")
        parameters = message.content.get("parameters", {})
        
        result = await self.execute_tool(
            "MachineLearningTool", 
            data=data, 
            technique=technique, 
            parameters=parameters
        )
        
        return Message(
            sender=self.name,
            intent="MACHINE_LEARNING_COMPLETED",
            content=result,
            correlation_id=message.message_id,
            reply_to=message.sender
        )
    
    async def handle_text_analysis(self, message: Message) -> Message:
        """
        Handle text analysis requests.
        
        Args:
            message: Request message
            
        Returns:
            Response message with analysis results
        """
        logger.info(f"Handling ANALYZE_TEXT request: {message.content}")
        
        text_data = message.content.get("text_data", {})
        technique = message.content.get("technique")
        parameters = message.content.get("parameters", {})
        
        result = await self.execute_tool(
            "TextAnalysisTool", 
            text_data=text_data, 
            technique=technique, 
            parameters=parameters
        )
        
        return Message(
            sender=self.name,
            intent="TEXT_ANALYSIS_COMPLETED",
            content=result,
            correlation_id=message.message_id,
            reply_to=message.sender
        )
    
    async def handle_generate_insights(self, message: Message) -> Message:
        """
        Handle insight generation requests.
        
        Args:
            message: Request message
            
        Returns:
            Response message with generated insights
        """
        logger.info(f"Handling GENERATE_INSIGHTS request: {message.content}")
        
        data = message.content.get("data", {})
        analysis_plan = message.content.get("analysis_plan", {})
        
        # Execute each step in the analysis plan
        results = {}
        insights = []
        
        for step in analysis_plan.get("execution_plan", []):
            step_id = step.get("step_id")
            strategy_type = step.get("strategy_type")
            technique = step.get("technique")
            parameters = step.get("parameters", {})
            
            # Execute the appropriate analysis based on strategy type and technique
            if strategy_type in ["descriptive", "exploratory"] and technique in ["summary_statistics", "distribution_analysis", "correlation_analysis"]:
                step_result = await self.execute_tool(
                    "StatisticalAnalysisTool", 
                    data=data, 
                    analysis_type=technique, 
                    parameters=parameters
                )
            elif strategy_type in ["pattern_discovery", "regression", "classification", "anomaly_detection"] and technique not in ["sentiment_analysis", "topic_modeling", "named_entity_recognition"]:
                step_result = await self.execute_tool(
                    "MachineLearningTool", 
                    data=data, 
                    technique=technique if technique != "principal_component_analysis" else "clustering",
                    parameters=parameters
                )
            elif strategy_type in ["text_analysis"] or technique in ["sentiment_analysis", "topic_modeling", "named_entity_recognition"]:
                step_result = await self.execute_tool(
                    "TextAnalysisTool", 
                    text_data=data, 
                    technique=technique, 
                    parameters=parameters
                )
            else:
                step_result = {
                    "status": "error",
                    "message": f"Unsupported strategy type or technique: {strategy_type}.{technique}"
                }
            
            results[step_id] = step_result
            
            # Generate insights from the results
            if step_result.get("status") == "success":
                step_insights = self._extract_insights(step_id, strategy_type, technique, step_result)
                insights.extend(step_insights)
        
        # Combine all results and insights
        final_result = {
            "status": "success",
            "analysis_results": results,
            "insights": insights
        }
        
        return Message(
            sender=self.name,
            intent="INSIGHTS_GENERATED",
            content=final_result,
            correlation_id=message.message_id,
            reply_to=message.sender
        )
    
    def _extract_insights(self, step_id: str, strategy_type: str, technique: str, result: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Extract insights from analysis results.
        
        Args:
            step_id: Step identifier
            strategy_type: Strategy type
            technique: Analysis technique
            result: Analysis result
            
        Returns:
            Extracted insights
        """
        insights = []
        
        # Extract insights based on technique
        if technique == "summary_statistics" and "summary" in result:
            summary = result["summary"]
            insights.append({
                "id": f"{step_id}_insight_1",
                "type": "statistical",
                "description": f"The average value is {summary.get('mean')}, with a standard deviation of {summary.get('std')}.",
                "importance": "medium",
                "source": step_id
            })
            
            # Check for skewness
            mean = summary.get('mean', 0)
            median = summary.get('median', 0)
            if abs(mean - median) > 0.1 * mean:
                skew_direction = "right" if mean > median else "left"
                insights.append({
                    "id": f"{step_id}_insight_2",
                    "type": "statistical",
                    "description": f"The distribution is skewed to the {skew_direction} (mean: {mean}, median: {median}).",
                    "importance": "medium",
                    "source": step_id
                })
        
        elif technique == "correlation_analysis" and "correlations" in result:
            for i, corr in enumerate(result["correlations"]):
                if abs(corr.get("correlation", 0)) > 0.7:
                    strength = "strong positive" if corr.get("correlation", 0) > 0 else "strong negative"
                    insights.append({
                        "id": f"{step_id}_insight_{i+1}",
                        "type": "correlation",
                        "description": f"There is a {strength} correlation ({corr.get('correlation')}) between {corr.get('variable1')} and {corr.get('variable2')}.",
                        "importance": "high" if abs(corr.get("correlation", 0)) > 0.8 else "medium",
                        "source": step_id
                    })
        
        elif technique == "clustering" and "clusters" in result:
            insights.append({
                "id": f"{step_id}_insight_1",
                "type": "clustering",
                "description": f"Identified {len(result['clusters'])} distinct clusters in the data.",
                "importance": "high",
                "source": step_id
            })
            
            # Find the largest cluster
            largest_cluster = max(result["clusters"], key=lambda c: c.get("size", 0))
            insights.append({
                "id": f"{step_id}_insight_2",
                "type": "clustering",
                "description": f"The largest segment represents {largest_cluster.get('size')}% of the data with centroid values of {largest_cluster.get('centroid')}.",
                "importance": "medium",
                "source": step_id
            })
        
        elif technique == "sentiment_analysis" and "sentiment" in result:
            sentiment = result["sentiment"]["overall"]
            primary_sentiment = max(sentiment.items(), key=lambda x: x[1])
            insights.append({
                "id": f"{step_id}_insight_1",
                "type": "sentiment",
                "description": f"Overall sentiment is primarily {primary_sentiment[0]} ({primary_sentiment[1]*100:.1f}%).",
                "importance": "high",
                "source": step_id
            })
            
            # Check for category differences
            if "by_category" in result["sentiment"]:
                categories = result["sentiment"]["by_category"]
                for category, values in categories.items():
                    primary_cat_sentiment = max(values.items(), key=lambda x: x[1])
                    if primary_cat_sentiment[0] != primary_sentiment[0]:
                        insights.append({
                            "id": f"{step_id}_insight_{category}",
                            "type": "sentiment",
                            "description": f"{category} sentiment differs from overall, being primarily {primary_cat_sentiment[0]} ({primary_cat_sentiment[1]*100:.1f}%).",
                            "importance": "high",
                            "source": step_id
                        })
        
        elif technique == "topic_modeling" and "topics" in result:
            insights.append({
                "id": f"{step_id}_insight_1",
                "type": "topics",
                "description": f"Identified {len(result['topics'])} main topics in the text data.",
                "importance": "medium",
                "source": step_id
            })
            
            # Describe the most prominent topic
            top_topic = max(result["topics"], key=lambda t: t.get("weight", 0))
            insights.append({
                "id": f"{step_id}_insight_2",
                "type": "topics",
                "description": f"The most prominent topic (weight: {top_topic.get('weight', 0)*100:.1f}%) is characterized by keywords: {', '.join(top_topic.get('keywords', []))}.",
                "importance": "high",
                "source": step_id
            })
        
        # Add a generic insight if none were generated
        if not insights:
            insights.append({
                "id": f"{step_id}_insight_generic",
                "type": "generic",
                "description": f"Analysis completed using {technique} technique.",
                "importance": "low",
                "source": step_id
            })
        
        return insights
