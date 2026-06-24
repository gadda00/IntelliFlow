"""
Data Engineer Agent implementation.

This agent is responsible for transforming raw data into analysis-ready formats.
Enhanced with intelligent data cleaning and missing data handling capabilities.
"""

import asyncio
import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional

from common.adk import Agent, Tool, Message
from common.logging.logger import get_logger

logger = get_logger("agent.data_engineer")

class IntelligentDataCleaningTool(Tool):
    """Tool for intelligent data cleaning with advanced missing data handling."""
    
    def __init__(self):
        super().__init__(name="IntelligentDataCleaningTool", description="Perform intelligent data cleaning with advanced missing data handling")
    
    async def execute(self, data: Dict[str, Any], data_profile: Dict[str, Any], user_preferences: Dict[str, Any] = None, **kwargs) -> Dict[str, Any]:
        """
        Execute intelligent data cleaning.
        
        Args:
            data: Input data to clean
            data_profile: Data profile from Data Scout agent
            user_preferences: User preferences for cleaning decisions
            
        Returns:
            Cleaned data with detailed cleaning report
        """
        logger.info("Performing intelligent data cleaning")
        
        user_preferences = user_preferences or {}
        columns = data_profile.get("columns", [])
        
        # Analyze cleaning requirements
        cleaning_plan = self._create_cleaning_plan(columns, user_preferences)
        
        # Execute cleaning operations
        cleaning_results = []
        for operation in cleaning_plan:
            result = await self._execute_cleaning_operation(operation, data)
            cleaning_results.append(result)
        
        # Generate cleaning summary
        cleaning_summary = {
            "status": "success",
            "original_rows": data.get("total_rows", 1000),
            "cleaned_rows": data.get("total_rows", 1000) - sum(r.get("rows_removed", 0) for r in cleaning_results),
            "operations_performed": len(cleaning_plan),
            "cleaning_operations": cleaning_results,
            "data_quality_improvement": self._calculate_quality_improvement(columns, cleaning_results),
            "assumptions_made": self._document_cleaning_assumptions(cleaning_plan),
            "user_decisions_required": self._identify_user_decisions(columns)
        }
        
        return cleaning_summary
    
    def _create_cleaning_plan(self, columns: List[Dict[str, Any]], user_preferences: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Create an intelligent cleaning plan based on data profile."""
        plan = []
        
        for col in columns:
            col_name = col["name"]
            col_type = col["type"]
            missing_values = col["missing_values"]
            quality_metrics = col["quality_metrics"]
            
            # Handle missing values
            if missing_values > 0:
                missing_percentage = missing_values / 1000  # Assuming 1000 total rows
                
                if missing_percentage > 0.5:
                    plan.append({
                        "operation": "remove_column",
                        "column": col_name,
                        "reason": f"High missing data percentage ({missing_percentage:.1%})",
                        "requires_user_decision": True
                    })
                elif missing_percentage > 0.1:
                    if col_type in ["INTEGER", "FLOAT", "NUMERIC"]:
                        plan.append({
                            "operation": "impute_numerical",
                            "column": col_name,
                            "method": user_preferences.get(f"{col_name}_imputation", "median"),
                            "reason": f"Moderate missing data ({missing_percentage:.1%}) in numerical column"
                        })
                    else:
                        plan.append({
                            "operation": "impute_categorical",
                            "column": col_name,
                            "method": user_preferences.get(f"{col_name}_imputation", "mode"),
                            "reason": f"Moderate missing data ({missing_percentage:.1%}) in categorical column"
                        })
                else:
                    plan.append({
                        "operation": "remove_missing_rows",
                        "column": col_name,
                        "reason": f"Low missing data percentage ({missing_percentage:.1%})"
                    })
            
            # Handle data quality issues
            if quality_metrics["validity"] < 0.95:
                plan.append({
                    "operation": "validate_and_clean",
                    "column": col_name,
                    "reason": f"Data validity issues (score: {quality_metrics['validity']:.2f})"
                })
            
            if col_type == "STRING" and quality_metrics["consistency"] < 0.9:
                plan.append({
                    "operation": "standardize_text",
                    "column": col_name,
                    "reason": f"Text consistency issues (score: {quality_metrics['consistency']:.2f})"
                })
        
        return plan
    
    async def _execute_cleaning_operation(self, operation: Dict[str, Any], data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a single cleaning operation."""
        op_type = operation["operation"]
        column = operation["column"]
        
        # Simulate cleaning operation results
        if op_type == "remove_column":
            return {
                "operation": op_type,
                "column": column,
                "columns_removed": 1,
                "reason": operation["reason"],
                "impact": "Column removed from analysis"
            }
        elif op_type == "impute_numerical":
            method = operation.get("method", "median")
            return {
                "operation": op_type,
                "column": column,
                "method": method,
                "values_imputed": np.random.randint(5, 50),
                "imputation_value": np.random.uniform(50, 200),
                "reason": operation["reason"]
            }
        elif op_type == "impute_categorical":
            method = operation.get("method", "mode")
            return {
                "operation": op_type,
                "column": column,
                "method": method,
                "values_imputed": np.random.randint(5, 50),
                "imputation_value": "Most_Common_Category",
                "reason": operation["reason"]
            }
        elif op_type == "remove_missing_rows":
            return {
                "operation": op_type,
                "column": column,
                "rows_removed": np.random.randint(1, 20),
                "reason": operation["reason"]
            }
        elif op_type == "validate_and_clean":
            return {
                "operation": op_type,
                "column": column,
                "invalid_values_corrected": np.random.randint(1, 30),
                "correction_method": "pattern_matching",
                "reason": operation["reason"]
            }
        elif op_type == "standardize_text":
            return {
                "operation": op_type,
                "column": column,
                "values_standardized": np.random.randint(10, 100),
                "standardization_rules": ["lowercase", "trim_whitespace", "remove_special_chars"],
                "reason": operation["reason"]
            }
        
        return {"operation": op_type, "status": "unknown_operation"}
    
    def _calculate_quality_improvement(self, columns: List[Dict[str, Any]], cleaning_results: List[Dict[str, Any]]) -> Dict[str, float]:
        """Calculate data quality improvement after cleaning."""
        original_quality = np.mean([np.mean(list(col["quality_metrics"].values())) for col in columns])
        
        # Simulate quality improvement
        improvement = np.random.uniform(0.05, 0.15)
        
        return {
            "original_quality_score": original_quality,
            "improved_quality_score": min(1.0, original_quality + improvement),
            "improvement_percentage": improvement * 100
        }
    
    def _document_cleaning_assumptions(self, cleaning_plan: List[Dict[str, Any]]) -> List[str]:
        """Document assumptions made during cleaning."""
        assumptions = [
            "Missing values are assumed to be missing at random unless patterns suggest otherwise",
            "Imputation methods are chosen based on data type and distribution characteristics",
            "Text standardization preserves semantic meaning while improving consistency"
        ]
        
        # Add specific assumptions based on operations
        for operation in cleaning_plan:
            if operation["operation"] == "impute_numerical":
                assumptions.append(f"Numerical imputation for {operation['column']} assumes values follow similar distribution to observed data")
            elif operation["operation"] == "impute_categorical":
                assumptions.append(f"Categorical imputation for {operation['column']} assumes missing values belong to the most common category")
        
        return assumptions
    
    def _identify_user_decisions(self, columns: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Identify decisions that may require user input."""
        decisions = []
        
        for col in columns:
            missing_percentage = col["missing_values"] / 1000
            
            if missing_percentage > 0.3:
                decisions.append({
                    "column": col["name"],
                    "decision_type": "high_missing_data",
                    "description": f"Column '{col['name']}' has {missing_percentage:.1%} missing data. Consider removal vs. imputation.",
                    "options": ["remove_column", "advanced_imputation", "keep_as_is"],
                    "recommendation": "remove_column" if missing_percentage > 0.5 else "advanced_imputation"
                })
            
            if col["type"] == "STRING" and col["quality_metrics"]["consistency"] < 0.8:
                decisions.append({
                    "column": col["name"],
                    "decision_type": "text_standardization",
                    "description": f"Column '{col['name']}' has inconsistent text formatting. Choose standardization approach.",
                    "options": ["aggressive_standardization", "conservative_standardization", "manual_review"],
                    "recommendation": "conservative_standardization"
                })
        
        return decisions

class DataCleaningTool(Tool):
    """Tool for cleaning and preprocessing data."""
    
    def __init__(self):
        super().__init__(name="DataCleaningTool", description="Clean and preprocess data")
    
    async def execute(self, data: Dict[str, Any], operations: List[Dict[str, Any]] = None, **kwargs) -> Dict[str, Any]:
        """
        Execute data cleaning operations.
        
        Args:
            data: Input data to clean
            operations: List of cleaning operations to perform
            
        Returns:
            Cleaned data
        """
        logger.info(f"Cleaning data with {len(operations) if operations else 0} operations")
        
        # This would use pandas or similar libraries in a real implementation
        # For now, we'll return simulated results
        
        result = {
            "status": "success",
            "original_rows": data.get("rows", 100),
            "cleaned_rows": data.get("rows", 100) - 5,  # Simulate removing 5 rows
            "operations_applied": operations or [],
            "data": {
                "cleaned": True,
                "sample": [
                    {"id": 1, "value": 100, "category": "A"},
                    {"id": 2, "value": 200, "category": "B"},
                    {"id": 3, "value": 300, "category": "A"}
                ]
            }
        }
        
        return result


class DataTransformationTool(Tool):
    """Tool for transforming and feature engineering data."""
    
    def __init__(self):
        super().__init__(name="DataTransformationTool", description="Transform and engineer features from data")
    
    async def execute(self, data: Dict[str, Any], transformations: List[Dict[str, Any]] = None, **kwargs) -> Dict[str, Any]:
        """
        Execute data transformation operations.
        
        Args:
            data: Input data to transform
            transformations: List of transformation operations to perform
            
        Returns:
            Transformed data
        """
        logger.info(f"Transforming data with {len(transformations) if transformations else 0} transformations")
        
        # This would use pandas, scikit-learn, or similar libraries in a real implementation
        # For now, we'll return simulated results
        
        result = {
            "status": "success",
            "original_columns": 5,
            "transformed_columns": 8,  # Simulate adding 3 new features
            "transformations_applied": transformations or [],
            "data": {
                "transformed": True,
                "sample": [
                    {"id": 1, "value": 100, "category": "A", "value_normalized": 0.33, "category_encoded": 0, "value_squared": 10000},
                    {"id": 2, "value": 200, "category": "B", "value_normalized": 0.67, "category_encoded": 1, "value_squared": 40000},
                    {"id": 3, "value": 300, "category": "A", "value_normalized": 1.0, "category_encoded": 0, "value_squared": 90000}
                ]
            }
        }
        
        return result


class BigQueryTransformationTool(Tool):
    """Tool for transforming data using BigQuery SQL."""
    
    def __init__(self):
        super().__init__(name="BigQueryTransformationTool", description="Transform data using BigQuery SQL")
    
    async def execute(self, project_id: str, sql_query: str, destination_table: Optional[str] = None, **kwargs) -> Dict[str, Any]:
        """
        Execute BigQuery SQL transformation.
        
        Args:
            project_id: Google Cloud project ID
            sql_query: SQL query to execute
            destination_table: Optional destination table for results
            
        Returns:
            Transformation results
        """
        logger.info(f"Executing BigQuery transformation: project={project_id}, destination={destination_table}")
        
        # This would use the google-cloud-bigquery library in a real implementation
        # For now, we'll return simulated results
        
        result = {
            "status": "success",
            "rows_processed": 1000,
            "execution_time_ms": 1200,
            "destination_table": destination_table,
            "schema": [
                {"name": "id", "type": "INTEGER"},
                {"name": "value", "type": "FLOAT"},
                {"name": "category", "type": "STRING"},
                {"name": "value_normalized", "type": "FLOAT"},
                {"name": "category_encoded", "type": "INTEGER"},
                {"name": "value_squared", "type": "FLOAT"}
            ]
        }
        
        return result


class DataEngineerAgent(Agent):
    """Agent responsible for transforming raw data into analysis-ready formats."""
    
    def __init__(self, config: Dict[str, Any]):
        """
        Initialize the Data Engineer agent.
        
        Args:
            config: Agent configuration
        """
        super().__init__(name="DataEngineerAgent")
        self.config = config
        
        # Register tools
        self.register_tools([
            IntelligentDataCleaningTool(),
            DataCleaningTool(),
            DataTransformationTool(),
            BigQueryTransformationTool()
        ])
        
        # Register message handlers
        self.register_message_handler("CLEAN_DATA", self.handle_clean_data)
        self.register_message_handler("INTELLIGENT_CLEAN_DATA", self.handle_intelligent_clean_data)
        self.register_message_handler("TRANSFORM_DATA", self.handle_transform_data)
        self.register_message_handler("EXECUTE_SQL", self.handle_execute_sql)
        
        logger.info("DataEngineerAgent initialized")
    
    async def handle_intelligent_clean_data(self, message: Message) -> Message:
        """
        Handle intelligent data cleaning requests.
        
        Args:
            message: Request message
            
        Returns:
            Response message with intelligent cleaning results
        """
        logger.info(f"Handling INTELLIGENT_CLEAN_DATA request: {message.content}")
        
        data = message.content.get("data", {})
        data_profile = message.content.get("data_profile", {})
        user_preferences = message.content.get("user_preferences", {})
        
        result = await self.execute_tool(
            "IntelligentDataCleaningTool", 
            data=data, 
            data_profile=data_profile,
            user_preferences=user_preferences
        )
        
        return Message(
            sender=self.name,
            intent="INTELLIGENT_DATA_CLEANED",
            content=result,
            correlation_id=message.message_id,
            reply_to=message.sender
        )
    
    async def handle_clean_data(self, message: Message) -> Message:
        """
        Handle data cleaning requests.
        
        Args:
            message: Request message
            
        Returns:
            Response message with cleaned data
        """
        logger.info(f"Handling CLEAN_DATA request: {message.content}")
        
        data = message.content.get("data", {})
        operations = message.content.get("operations", [])
        
        result = await self.execute_tool("DataCleaningTool", data=data, operations=operations)
        
        return Message(
            sender=self.name,
            intent="DATA_CLEANED",
            content=result,
            correlation_id=message.message_id,
            reply_to=message.sender
        )
    
    async def handle_transform_data(self, message: Message) -> Message:
        """
        Handle data transformation requests.
        
        Args:
            message: Request message
            
        Returns:
            Response message with transformed data
        """
        logger.info(f"Handling TRANSFORM_DATA request: {message.content}")
        
        data = message.content.get("data", {})
        transformations = message.content.get("transformations", [])
        
        result = await self.execute_tool("DataTransformationTool", data=data, transformations=transformations)
        
        return Message(
            sender=self.name,
            intent="DATA_TRANSFORMED",
            content=result,
            correlation_id=message.message_id,
            reply_to=message.sender
        )
    
    async def handle_execute_sql(self, message: Message) -> Message:
        """
        Handle SQL execution requests.
        
        Args:
            message: Request message
            
        Returns:
            Response message with SQL execution results
        """
        logger.info(f"Handling EXECUTE_SQL request: {message.content}")
        
        project_id = message.content.get("project_id", self.config.get("default_project_id"))
        sql_query = message.content.get("sql_query")
        destination_table = message.content.get("destination_table")
        
        result = await self.execute_tool(
            "BigQueryTransformationTool", 
            project_id=project_id, 
            sql_query=sql_query, 
            destination_table=destination_table
        )
        
        return Message(
            sender=self.name,
            intent="SQL_EXECUTED",
            content=result,
            correlation_id=message.message_id,
            reply_to=message.sender
        )
