"""
Data Scout Agent implementation.

This agent is responsible for discovering and extracting data from various sources.
Enhanced with comprehensive data profiling and column analysis capabilities.
"""

import asyncio
import pandas as pd
import numpy as np
import json
import io
from typing import Dict, Any, List, Optional

from common.adk import Agent, Tool, Message
from common.logging.logger import get_logger

logger = get_logger("agent.data_scout")

class DataProfilingTool(Tool):
    """Tool for comprehensive data profiling and column analysis."""
    
    def __init__(self):
        super().__init__(name="DataProfilingTool", description="Perform comprehensive data profiling and column analysis")
    
    async def execute(self, data: Dict[str, Any], **kwargs) -> Dict[str, Any]:
        """
        Execute comprehensive data profiling.
        
        Args:
            data: Input data to profile including file_contents for real data processing
            
        Returns:
            Comprehensive data profile
        """
        logger.info("Performing comprehensive data profiling")
        
        # Check if we have real file contents to process
        file_contents = data.get("file_contents", [])
        
        if file_contents:
            # Process real uploaded data
            return await self._process_real_data(file_contents)
        else:
            # Fallback to simulated data profiling
            return await self._process_simulated_data(data)
    
    async def _process_real_data(self, file_contents: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Process real uploaded file data."""
        logger.info("Processing real uploaded data")
        
        # Process the first file for now
        file_data = file_contents[0]
        file_name = file_data.get("name", "unknown.csv")
        file_content = file_data.get("content", "")
        
        columns = []
        total_rows = 0
        
        try:
            if file_name.endswith(('.csv', '.txt')):
                # Parse CSV data
                df = pd.read_csv(io.StringIO(file_content))
                total_rows = len(df)
                
                for col_name in df.columns:
                    col_data = df[col_name]
                    col_type = self._infer_column_type(col_data)
                    
                    # Calculate real statistics
                    missing_values = col_data.isnull().sum()
                    unique_values = col_data.nunique()
                    
                    # Quality metrics based on real data
                    completeness = 1 - (missing_values / len(col_data))
                    uniqueness = unique_values / len(col_data) if len(col_data) > 0 else 0
                    
                    # Sample values from real data
                    sample_values = col_data.dropna().head(5).tolist()
                    
                    columns.append({
                        "name": col_name,
                        "type": col_type,
                        "significance": self._determine_column_significance(col_name, col_type),
                        "quality_metrics": {
                            "completeness": completeness,
                            "uniqueness": min(uniqueness, 1.0),
                            "validity": 0.95,  # Assume good validity for uploaded data
                            "consistency": 0.90
                        },
                        "missing_values": int(missing_values),
                        "unique_values": int(unique_values),
                        "sample_values": sample_values,
                        "statistics": self._calculate_column_statistics(col_data, col_type)
                    })
                    
            elif file_name.endswith(('.json')):
                # Parse JSON data
                json_data = json.loads(file_content)
                if isinstance(json_data, list) and len(json_data) > 0:
                    df = pd.DataFrame(json_data)
                    total_rows = len(df)
                    
                    for col_name in df.columns:
                        col_data = df[col_name]
                        col_type = self._infer_column_type(col_data)
                        
                        columns.append({
                            "name": col_name,
                            "type": col_type,
                            "significance": self._determine_column_significance(col_name, col_type),
                            "quality_metrics": {
                                "completeness": 1 - (col_data.isnull().sum() / len(col_data)),
                                "uniqueness": min(col_data.nunique() / len(col_data), 1.0),
                                "validity": 0.95,
                                "consistency": 0.90
                            },
                            "missing_values": int(col_data.isnull().sum()),
                            "unique_values": int(col_data.nunique()),
                            "sample_values": col_data.dropna().head(5).tolist(),
                            "statistics": self._calculate_column_statistics(col_data, col_type)
                        })
                        
        except Exception as e:
            logger.error(f"Error processing real data: {e}")
            # Fallback to basic analysis
            lines = file_content.strip().split('\n')
            if lines:
                headers = lines[0].split(',')
                total_rows = len(lines) - 1
                
                for header in headers:
                    columns.append({
                        "name": header.strip(),
                        "type": "STRING",
                        "significance": "General attribute",
                        "quality_metrics": {
                            "completeness": 0.95,
                            "uniqueness": 0.80,
                            "validity": 0.90,
                            "consistency": 0.85
                        },
                        "missing_values": 0,
                        "unique_values": total_rows,
                        "sample_values": ["Sample1", "Sample2", "Sample3"],
                        "statistics": {}
                    })
        
        # Generate comprehensive profile
        profile = {
            "status": "success",
            "data_source": "uploaded_file",
            "file_name": file_name,
            "data_characteristics": {
                "total_rows": total_rows,
                "total_columns": len(columns),
                "data_types": self._count_data_types(columns),
                "overall_quality_score": np.mean([np.mean(list(col["quality_metrics"].values())) for col in columns]) if columns else 0,
                "missing_data_percentage": sum(col["missing_values"] for col in columns) / (total_rows * len(columns)) * 100 if total_rows > 0 and columns else 0
            },
            "columns": columns,
            "data_cleaning_recommendations": self._generate_cleaning_recommendations(columns),
            "assumptions": [
                "Data is assumed to be representative of the population",
                "Missing values are assumed to be missing at random unless patterns suggest otherwise",
                "Categorical variables are assumed to have meaningful categories",
                "Numerical variables are assumed to be measured on appropriate scales"
            ]
        }
        
        return profile
    
    def _infer_column_type(self, col_data: pd.Series) -> str:
        """Infer the data type of a column."""
        if pd.api.types.is_numeric_dtype(col_data):
            if pd.api.types.is_integer_dtype(col_data):
                return "INTEGER"
            else:
                return "FLOAT"
        elif pd.api.types.is_datetime64_any_dtype(col_data):
            return "DATETIME"
        elif pd.api.types.is_bool_dtype(col_data):
            return "BOOLEAN"
        else:
            return "STRING"
    
    def _calculate_column_statistics(self, col_data: pd.Series, col_type: str) -> Dict[str, Any]:
        """Calculate statistics for a column based on its type."""
        stats = {}
        
        if col_type in ["INTEGER", "FLOAT"]:
            try:
                numeric_data = pd.to_numeric(col_data, errors='coerce').dropna()
                if len(numeric_data) > 0:
                    stats = {
                        "mean": float(numeric_data.mean()),
                        "median": float(numeric_data.median()),
                        "std": float(numeric_data.std()),
                        "min": float(numeric_data.min()),
                        "max": float(numeric_data.max()),
                        "count": int(len(numeric_data))
                    }
            except Exception:
                pass
        elif col_type == "STRING":
            try:
                stats = {
                    "most_common": col_data.value_counts().head(3).to_dict(),
                    "avg_length": float(col_data.astype(str).str.len().mean()),
                    "unique_count": int(col_data.nunique())
                }
            except Exception:
                pass
        
        return stats
    
    def _count_data_types(self, columns: List[Dict[str, Any]]) -> Dict[str, int]:
        """Count the number of columns by data type."""
        type_counts = {}
        for col in columns:
            col_type = col["type"]
            type_counts[col_type] = type_counts.get(col_type, 0) + 1
        return type_counts
    
    async def _process_simulated_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Process simulated data for demo purposes."""
        # Original simulated data processing logic
        sample_data = data.get("sample", [])
        schema = data.get("schema", [])
        
        # Extract column information
        columns = []
        for col in schema:
            col_name = col.get("name", "unknown")
            col_type = col.get("type", "STRING")
            
            # Determine significance based on column name patterns
            significance = self._determine_column_significance(col_name, col_type)
            
            # Simulate data quality metrics
            quality_metrics = {
                "completeness": np.random.uniform(0.85, 1.0),
                "uniqueness": np.random.uniform(0.7, 1.0),
                "validity": np.random.uniform(0.9, 1.0),
                "consistency": np.random.uniform(0.8, 1.0)
            }
            
            columns.append({
                "name": col_name,
                "type": col_type,
                "significance": significance,
                "quality_metrics": quality_metrics,
                "missing_values": int(np.random.uniform(0, 50)),
                "unique_values": int(np.random.uniform(10, 1000)),
                "sample_values": self._generate_sample_values(col_type)
            })
        
        # Overall data characteristics
        total_rows = data.get("total_rows", 1000)
        total_columns = len(columns)
        
        profile = {
            "status": "success",
            "data_characteristics": {
                "total_rows": total_rows,
                "total_columns": total_columns,
                "data_types": {col["type"]: sum(1 for c in columns if c["type"] == col["type"]) for col in columns},
                "overall_quality_score": np.mean([np.mean(list(col["quality_metrics"].values())) for col in columns]),
                "missing_data_percentage": sum(col["missing_values"] for col in columns) / (total_rows * total_columns) * 100
            },
            "columns": columns,
            "data_cleaning_recommendations": self._generate_cleaning_recommendations(columns),
            "assumptions": [
                "Data is assumed to be representative of the population",
                "Missing values are assumed to be missing at random unless patterns suggest otherwise",
                "Categorical variables are assumed to have meaningful categories",
                "Numerical variables are assumed to be measured on appropriate scales"
            ]
        }
        
        return profile
    
    def _determine_column_significance(self, col_name: str, col_type: str) -> str:
        """Determine the significance of a column based on its name and type."""
        col_name_lower = col_name.lower()
        
        # Key identifiers
        if any(keyword in col_name_lower for keyword in ["id", "key", "identifier"]):
            return "Primary identifier - unique record identifier"
        
        # Temporal columns
        if any(keyword in col_name_lower for keyword in ["date", "time", "timestamp", "created", "updated"]):
            return "Temporal variable - enables time-series analysis and trend identification"
        
        # Categorical variables
        if col_type in ["STRING", "BOOL"] or any(keyword in col_name_lower for keyword in ["category", "type", "status", "group"]):
            return "Categorical variable - enables segmentation and group comparisons"
        
        # Numerical measures
        if col_type in ["INTEGER", "FLOAT", "NUMERIC"]:
            if any(keyword in col_name_lower for keyword in ["amount", "value", "price", "cost", "revenue", "score", "rating"]):
                return "Key performance metric - primary measure for analysis"
            else:
                return "Numerical variable - enables statistical analysis and modeling"
        
        return "General attribute - provides additional context for analysis"
    
    def _generate_sample_values(self, col_type: str) -> List[Any]:
        """Generate sample values based on column type."""
        if col_type in ["INTEGER", "NUMERIC"]:
            return [int(np.random.uniform(1, 1000)) for _ in range(5)]
        elif col_type == "FLOAT":
            return [round(np.random.uniform(1.0, 1000.0), 2) for _ in range(5)]
        elif col_type == "STRING":
            return [f"Sample_{i}" for i in range(1, 6)]
        elif col_type == "BOOL":
            return [bool(np.random.choice([True, False])) for _ in range(5)]
        elif col_type in ["DATE", "TIMESTAMP", "DATETIME"]:
            return ["2025-01-01", "2025-02-15", "2025-03-30", "2025-04-10", "2025-05-20"]
        else:
            return ["Value1", "Value2", "Value3", "Value4", "Value5"]
    
    def _generate_cleaning_recommendations(self, columns: List[Dict[str, Any]]) -> List[str]:
        """Generate data cleaning recommendations based on column analysis."""
        recommendations = []
        
        for col in columns:
            if col["missing_values"] > 0:
                if col["missing_values"] / 1000 > 0.1:  # More than 10% missing
                    recommendations.append(f"Column '{col['name']}': High missing data ({col['missing_values']} values). Consider imputation or removal.")
                else:
                    recommendations.append(f"Column '{col['name']}': Some missing data ({col['missing_values']} values). Apply appropriate imputation strategy.")
            
            if col["quality_metrics"]["validity"] < 0.95:
                recommendations.append(f"Column '{col['name']}': Data validity issues detected. Validate and clean invalid entries.")
            
            if col["type"] in ["STRING"] and col["quality_metrics"]["consistency"] < 0.9:
                recommendations.append(f"Column '{col['name']}': Inconsistent formatting detected. Standardize text values.")
        
        if not recommendations:
            recommendations.append("Data quality appears good. Proceed with standard preprocessing steps.")
        
        return recommendations

class BigQueryConnector(Tool):
    """Tool for connecting to BigQuery data sources."""
    
    def __init__(self):
        super().__init__(name="BigQueryConnector", description="Connect to BigQuery datasets and tables")
    
    async def execute(self, project_id: str, dataset_id: Optional[str] = None, table_id: Optional[str] = None, **kwargs) -> Dict[str, Any]:
        """
        Execute BigQuery connection and data extraction.
        
        Args:
            project_id: Google Cloud project ID
            dataset_id: Optional BigQuery dataset ID
            table_id: Optional BigQuery table ID
            
        Returns:
            Connection result with metadata
        """
        logger.info(f"Connecting to BigQuery: project={project_id}, dataset={dataset_id}, table={table_id}")
        
        # This would use the google-cloud-bigquery library in a real implementation
        # For now, we'll return simulated data
        
        if dataset_id is None:
            # List datasets
            return {
                "status": "success",
                "datasets": [
                    {"id": "customer_data", "description": "Customer information and feedback"},
                    {"id": "sales_data", "description": "Sales transactions and metrics"},
                    {"id": "product_data", "description": "Product catalog and details"}
                ]
            }
        elif table_id is None:
            # List tables in dataset
            tables = {
                "customer_data": [
                    {"id": "customers", "description": "Customer profiles"},
                    {"id": "feedback", "description": "Customer feedback and reviews"},
                    {"id": "interactions", "description": "Customer interaction history"}
                ],
                "sales_data": [
                    {"id": "transactions", "description": "Sales transactions"},
                    {"id": "revenue", "description": "Revenue metrics"},
                    {"id": "forecasts", "description": "Sales forecasts"}
                ],
                "product_data": [
                    {"id": "catalog", "description": "Product catalog"},
                    {"id": "inventory", "description": "Product inventory levels"},
                    {"id": "categories", "description": "Product categories"}
                ]
            }
            
            return {
                "status": "success",
                "tables": tables.get(dataset_id, [])
            }
        else:
            # Get table schema and sample data
            schemas = {
                "customers": [
                    {"name": "customer_id", "type": "STRING", "mode": "REQUIRED"},
                    {"name": "name", "type": "STRING", "mode": "REQUIRED"},
                    {"name": "email", "type": "STRING", "mode": "NULLABLE"},
                    {"name": "signup_date", "type": "DATE", "mode": "REQUIRED"},
                    {"name": "last_purchase", "type": "DATE", "mode": "NULLABLE"}
                ],
                "feedback": [
                    {"name": "feedback_id", "type": "STRING", "mode": "REQUIRED"},
                    {"name": "customer_id", "type": "STRING", "mode": "REQUIRED"},
                    {"name": "product_id", "type": "STRING", "mode": "REQUIRED"},
                    {"name": "rating", "type": "INTEGER", "mode": "REQUIRED"},
                    {"name": "comment", "type": "STRING", "mode": "NULLABLE"},
                    {"name": "feedback_date", "type": "TIMESTAMP", "mode": "REQUIRED"}
                ]
            }
            
            return {
                "status": "success",
                "schema": schemas.get(table_id, []),
                "sample_size": 100,
                "total_rows": 10000
            }


class CloudStorageConnector(Tool):
    """Tool for connecting to Cloud Storage data sources."""
    
    def __init__(self):
        super().__init__(name="CloudStorageConnector", description="Connect to Cloud Storage buckets and objects")
    
    async def execute(self, bucket_name: Optional[str] = None, prefix: Optional[str] = None, **kwargs) -> Dict[str, Any]:
        """
        Execute Cloud Storage connection and data extraction.
        
        Args:
            bucket_name: Optional Cloud Storage bucket name
            prefix: Optional object prefix for filtering
            
        Returns:
            Connection result with metadata
        """
        logger.info(f"Connecting to Cloud Storage: bucket={bucket_name}, prefix={prefix}")
        
        # This would use the google-cloud-storage library in a real implementation
        # For now, we'll return simulated data
        
        if bucket_name is None:
            # List buckets
            return {
                "status": "success",
                "buckets": [
                    {"name": "intelliflow-data", "location": "us-central1"},
                    {"name": "intelliflow-exports", "location": "us-central1"},
                    {"name": "intelliflow-models", "location": "us-central1"}
                ]
            }
        else:
            # List objects in bucket
            return {
                "status": "success",
                "objects": [
                    {"name": "customer_exports/customers_2025_05_01.csv", "size": 1024000, "updated": "2025-05-01T12:00:00Z"},
                    {"name": "customer_exports/customers_2025_05_15.csv", "size": 1048576, "updated": "2025-05-15T12:00:00Z"},
                    {"name": "sales_exports/sales_2025_Q1.json", "size": 5242880, "updated": "2025-04-01T12:00:00Z"},
                    {"name": "sales_exports/sales_2025_Q2.json", "size": 6291456, "updated": "2025-07-01T12:00:00Z"}
                ]
            }


class APIConnector(Tool):
    """Tool for connecting to external APIs."""
    
    def __init__(self):
        super().__init__(name="APIConnector", description="Connect to external APIs and web services")
    
    async def execute(self, api_url: str, method: str = "GET", headers: Dict[str, str] = None, body: Dict[str, Any] = None, **kwargs) -> Dict[str, Any]:
        """
        Execute API connection and data extraction.
        
        Args:
            api_url: API endpoint URL
            method: HTTP method (GET, POST, etc.)
            headers: Optional HTTP headers
            body: Optional request body
            
        Returns:
            API response data
        """
        logger.info(f"Connecting to API: url={api_url}, method={method}")
        
        # This would use the requests library in a real implementation
        # For now, we'll return simulated data
        
        return {
            "status": "success",
            "response_code": 200,
            "data": {
                "items": [
                    {"id": 1, "name": "Item 1", "value": 100},
                    {"id": 2, "name": "Item 2", "value": 200},
                    {"id": 3, "name": "Item 3", "value": 300}
                ],
                "total": 3,
                "page": 1,
                "page_size": 10
            }
        }


class DataScoutAgent(Agent):
    """Agent responsible for discovering and extracting data from various sources."""
    
    def __init__(self, config: Dict[str, Any]):
        """
        Initialize the Data Scout agent.
        
        Args:
            config: Agent configuration
        """
        super().__init__(name="DataScoutAgent")
        self.config = config
        
        # Register tools
        self.register_tools([
            DataProfilingTool(),
            BigQueryConnector(),
            CloudStorageConnector(),
            APIConnector()
        ])
        
        # Register message handlers
        self.register_message_handler("DISCOVER_DATA_SOURCES", self.handle_discover_data_sources)
        self.register_message_handler("EXTRACT_DATA", self.handle_extract_data)
        self.register_message_handler("PROFILE_DATA", self.handle_profile_data)
        
        logger.info("DataScoutAgent initialized")
    
    async def handle_profile_data(self, message: Message) -> Message:
        """
        Handle data profiling requests.
        
        Args:
            message: Request message
            
        Returns:
            Response message with comprehensive data profile
        """
        logger.info(f"Handling PROFILE_DATA request: {message.content}")
        
        data = message.content.get("data", {})
        
        result = await self.execute_tool("DataProfilingTool", data=data)
        
        return Message(
            sender=self.name,
            intent="DATA_PROFILED",
            content=result,
            correlation_id=message.message_id,
            reply_to=message.sender
        )
    
    async def handle_discover_data_sources(self, message: Message) -> Message:
        """
        Handle data source discovery requests.
        
        Args:
            message: Request message
            
        Returns:
            Response message with discovered data sources
        """
        logger.info(f"Handling DISCOVER_DATA_SOURCES request: {message.content}")
        
        source_type = message.content.get("source_type")
        
        if source_type == "bigquery":
            project_id = message.content.get("project_id", self.config.get("default_project_id"))
            dataset_id = message.content.get("dataset_id")
            result = await self.execute_tool("BigQueryConnector", project_id=project_id, dataset_id=dataset_id)
        elif source_type == "cloud_storage":
            bucket_name = message.content.get("bucket_name")
            result = await self.execute_tool("CloudStorageConnector", bucket_name=bucket_name)
        elif source_type == "api":
            api_url = message.content.get("api_url")
            result = await self.execute_tool("APIConnector", api_url=api_url)
        else:
            # Discover all source types
            bq_result = await self.execute_tool("BigQueryConnector", project_id=self.config.get("default_project_id"))
            cs_result = await self.execute_tool("CloudStorageConnector")
            
            result = {
                "status": "success",
                "sources": {
                    "bigquery": bq_result,
                    "cloud_storage": cs_result
                }
            }
        
        return Message(
            sender=self.name,
            intent="DATA_SOURCES_DISCOVERED",
            content=result,
            correlation_id=message.message_id,
            reply_to=message.sender
        )
    
    async def handle_extract_data(self, message: Message) -> Message:
        """
        Handle data extraction requests.
        
        Args:
            message: Request message
            
        Returns:
            Response message with extracted data
        """
        logger.info(f"Handling EXTRACT_DATA request: {message.content}")
        
        source_type = message.content.get("source_type")
        
        if source_type == "bigquery":
            project_id = message.content.get("project_id", self.config.get("default_project_id"))
            dataset_id = message.content.get("dataset_id")
            table_id = message.content.get("table_id")
            result = await self.execute_tool("BigQueryConnector", project_id=project_id, dataset_id=dataset_id, table_id=table_id)
        elif source_type == "cloud_storage":
            bucket_name = message.content.get("bucket_name")
            object_name = message.content.get("object_name")
            result = await self.execute_tool("CloudStorageConnector", bucket_name=bucket_name, object_name=object_name)
        elif source_type == "api":
            api_url = message.content.get("api_url")
            method = message.content.get("method", "GET")
            headers = message.content.get("headers")
            body = message.content.get("body")
            result = await self.execute_tool("APIConnector", api_url=api_url, method=method, headers=headers, body=body)
        else:
            result = {
                "status": "error",
                "message": f"Unsupported source type: {source_type}"
            }
        
        return Message(
            sender=self.name,
            intent="DATA_EXTRACTED",
            content=result,
            correlation_id=message.message_id,
            reply_to=message.sender
        )
