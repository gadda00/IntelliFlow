# Copyright 2025 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Data Analysis Agent implementation for IntelliFlow."""

from __future__ import annotations

import logging
import os
import tempfile
from typing import Any, Dict, List, Optional, Union

import pandas as pd
from pydantic import BaseModel, Field

from google.adk.agents.llm_agent import LlmAgent, ToolUnion
from google.adk.memory.base_memory_service import BaseMemoryService
from google.adk.tools.base_tool import BaseTool

from .data_preprocessing_tools import (
    DataPreprocessRequest,
    DataPreprocessResponse,
    DataPreprocessingTools,
)

logger = logging.getLogger(__name__)


class LoadDataRequest(BaseModel):
    """Request to load data from a source."""
    
    source: str = Field(..., description="The source of the data to load.")
    format: str = Field(
        "auto", description="The format of the data (csv, json, excel, etc.)."
    )
    options: Dict[str, Any] = Field(
        default_factory=dict, description="Additional options for loading the data."
    )


class LoadDataResponse(BaseModel):
    """Response from loading data."""
    
    success: bool = Field(..., description="Whether the data was loaded successfully.")
    message: str = Field(..., description="A message describing the result.")
    data_id: Optional[str] = Field(
        None, description="An identifier for the loaded data."
    )
    data_info: Dict[str, Any] = Field(
        default_factory=dict, description="Information about the loaded data."
    )


class AnalyzeDataRequest(BaseModel):
    """Request to analyze data."""
    
    data_id: str = Field(..., description="The identifier of the data to analyze.")
    analysis_type: str = Field(..., description="The type of analysis to perform.")
    parameters: Dict[str, Any] = Field(
        default_factory=dict, description="Parameters for the analysis."
    )


class AnalyzeDataResponse(BaseModel):
    """Response from analyzing data."""
    
    success: bool = Field(..., description="Whether the analysis was successful.")
    message: str = Field(..., description="A message describing the result.")
    results: Dict[str, Any] = Field(
        default_factory=dict, description="The analysis results."
    )


class VisualizeDataRequest(BaseModel):
    """Request to visualize data."""
    
    data_id: str = Field(..., description="The identifier of the data to visualize.")
    visualization_type: str = Field(..., description="The type of visualization to create.")
    parameters: Dict[str, Any] = Field(
        default_factory=dict, description="Parameters for the visualization."
    )


class VisualizeDataResponse(BaseModel):
    """Response from visualizing data."""
    
    success: bool = Field(..., description="Whether the visualization was successful.")
    message: str = Field(..., description="A message describing the result.")
    visualization_path: Optional[str] = Field(
        None, description="The path to the visualization file."
    )


class DataAnalysisToolset(BaseTool):
    """A toolset for data analysis tasks."""
    
    name: str = "data_analysis_toolset"
    description: str = "A set of tools for data analysis tasks."
    
    def __init__(
        self,
        data_sources: Optional[List[str]] = None,
        analysis_types: Optional[List[str]] = None,
        visualization_types: Optional[List[str]] = None,
        memory_service: Optional[BaseMemoryService] = None,
    ):
        """Initialize the DataAnalysisToolset.
        
        Args:
            data_sources: List of data sources to analyze.
            analysis_types: List of analysis types to perform.
            visualization_types: List of visualization types to generate.
            memory_service: Optional memory service for persisting analysis results.
        """
        super().__init__()
        self.data_sources = data_sources or []
        self.analysis_types = analysis_types or []
        self.visualization_types = visualization_types or []
        self.memory_service = memory_service
        self._data_store: Dict[str, pd.DataFrame] = {}
        self._temp_dir = tempfile.mkdtemp()
        self._preprocessing_tools = DataPreprocessingTools(self._data_store)
    
    async def load_data(self, request: LoadDataRequest) -> LoadDataResponse:
        """Load data from a source.
        
        Args:
            request: The request containing the source and format information.
            
        Returns:
            A response indicating whether the data was loaded successfully.
        """
        try:
            # Check if the source is in the list of allowed data sources
            if self.data_sources and request.source not in self.data_sources:
                return LoadDataResponse(
                    success=False,
                    message=f"Data source '{request.source}' is not in the list of allowed sources.",
                )
            
            # Determine the format if set to auto
            format_lower = request.format.lower()
            if format_lower == "auto":
                if request.source.endswith(".csv"):
                    format_lower = "csv"
                elif request.source.endswith(".json"):
                    format_lower = "json"
                elif request.source.endswith((".xls", ".xlsx")):
                    format_lower = "excel"
                else:
                    return LoadDataResponse(
                        success=False,
                        message=f"Could not determine format for source '{request.source}'.",
                    )
            
            # Load the data based on the format
            if format_lower == "csv":
                df = pd.read_csv(request.source, **request.options)
            elif format_lower == "json":
                df = pd.read_json(request.source, **request.options)
            elif format_lower == "excel":
                df = pd.read_excel(request.source, **request.options)
            else:
                return LoadDataResponse(
                    success=False,
                    message=f"Unsupported format '{format_lower}'.",
                )
            
            # Generate a unique ID for the data
            data_id = f"data_{len(self._data_store) + 1}"
            self._data_store[data_id] = df
            
            return LoadDataResponse(
                success=True,
                message=f"Successfully loaded data from '{request.source}'.",
                data_id=data_id,
                data_info={
                    "shape": df.shape,
                    "columns": df.columns.tolist(),
                    "dtypes": {col: str(dtype) for col, dtype in df.dtypes.items()},
                    "missing_values": df.isnull().sum().to_dict(),
                },
            )
        except Exception as e:
            logger.exception("Error loading data")
            return LoadDataResponse(
                success=False,
                message=f"Error loading data: {str(e)}",
            )
    
    async def preprocess_data(
        self, request: DataPreprocessRequest
    ) -> DataPreprocessResponse:
        """Preprocess data.
        
        Args:
            request: The request containing the data ID and preprocessing operation.
            
        Returns:
            A response indicating whether the data was preprocessed successfully.
        """
        return await self._preprocessing_tools.preprocess_data(request)
    
    async def analyze_data(self, request: AnalyzeDataRequest) -> AnalyzeDataResponse:
        """Analyze data.
        
        Args:
            request: The request containing the data ID and analysis type.
            
        Returns:
            A response containing the analysis results.
        """
        try:
            # Check if the data ID exists
            if request.data_id not in self._data_store:
                return AnalyzeDataResponse(
                    success=False,
                    message=f"Data ID '{request.data_id}' not found.",
                )
            
            # Check if the analysis type is in the list of allowed analysis types
            if self.analysis_types and request.analysis_type not in self.analysis_types:
                return AnalyzeDataResponse(
                    success=False,
                    message=f"Analysis type '{request.analysis_type}' is not in the list of allowed types.",
                )
            
            # Get the data
            df = self._data_store[request.data_id]
            
            # Perform the analysis
            analysis_type_lower = request.analysis_type.lower()
            results = {}
            
            if analysis_type_lower == "summary":
                # Generate a summary of the data
                results["shape"] = df.shape
                results["columns"] = df.columns.tolist()
                results["dtypes"] = {col: str(dtype) for col, dtype in df.dtypes.items()}
                results["missing_values"] = df.isnull().sum().to_dict()
                results["numeric_summary"] = df.describe().to_dict()
            
            elif analysis_type_lower == "correlation":
                # Calculate correlation matrix
                numeric_df = df.select_dtypes(include=["number"])
                if numeric_df.empty:
                    return AnalyzeDataResponse(
                        success=False,
                        message="No numeric columns found for correlation analysis.",
                    )
                
                results["correlation_matrix"] = numeric_df.corr().to_dict()
            
            elif analysis_type_lower == "distribution":
                # Analyze the distribution of a column
                if "column" not in request.parameters:
                    return AnalyzeDataResponse(
                        success=False,
                        message="Missing 'column' parameter for distribution analysis.",
                    )
                
                column = request.parameters["column"]
                if column not in df.columns:
                    return AnalyzeDataResponse(
                        success=False,
                        message=f"Column '{column}' not found in the data.",
                    )
                
                if pd.api.types.is_numeric_dtype(df[column]):
                    results["min"] = float(df[column].min())
                    results["max"] = float(df[column].max())
                    results["mean"] = float(df[column].mean())
                    results["median"] = float(df[column].median())
                    results["std"] = float(df[column].std())
                    results["quantiles"] = {
                        "25%": float(df[column].quantile(0.25)),
                        "50%": float(df[column].quantile(0.5)),
                        "75%": float(df[column].quantile(0.75)),
                    }
                else:
                    results["value_counts"] = df[column].value_counts().to_dict()
                    results["unique_values"] = df[column].nunique()
            
            elif analysis_type_lower == "outliers":
                # Detect outliers in a column
                if "column" not in request.parameters:
                    return AnalyzeDataResponse(
                        success=False,
                        message="Missing 'column' parameter for outlier detection.",
                    )
                
                column = request.parameters["column"]
                if column not in df.columns:
                    return AnalyzeDataResponse(
                        success=False,
                        message=f"Column '{column}' not found in the data.",
                    )
                
                if not pd.api.types.is_numeric_dtype(df[column]):
                    return AnalyzeDataResponse(
                        success=False,
                        message=f"Column '{column}' is not numeric.",
                    )
                
                method = request.parameters.get("method", "zscore")
                threshold = request.parameters.get("threshold", 3)
                
                if method == "zscore":
                    z_scores = abs((df[column] - df[column].mean()) / df[column].std())
                    outliers = df[z_scores > threshold]
                    results["outlier_count"] = len(outliers)
                    results["outlier_percentage"] = len(outliers) / len(df) * 100
                    results["outlier_indices"] = outliers.index.tolist()
                    results["outlier_values"] = outliers[column].tolist()
                
                elif method == "iqr":
                    q1 = df[column].quantile(0.25)
                    q3 = df[column].quantile(0.75)
                    iqr = q3 - q1
                    lower_bound = q1 - 1.5 * iqr
                    upper_bound = q3 + 1.5 * iqr
                    outliers = df[(df[column] < lower_bound) | (df[column] > upper_bound)]
                    results["outlier_count"] = len(outliers)
                    results["outlier_percentage"] = len(outliers) / len(df) * 100
                    results["outlier_indices"] = outliers.index.tolist()
                    results["outlier_values"] = outliers[column].tolist()
                    results["lower_bound"] = float(lower_bound)
                    results["upper_bound"] = float(upper_bound)
                
                else:
                    return AnalyzeDataResponse(
                        success=False,
                        message=f"Unsupported outlier detection method '{method}'.",
                    )
            
            elif analysis_type_lower == "time_series":
                # Analyze time series data
                if "date_column" not in request.parameters:
                    return AnalyzeDataResponse(
                        success=False,
                        message="Missing 'date_column' parameter for time series analysis.",
                    )
                
                if "value_column" not in request.parameters:
                    return AnalyzeDataResponse(
                        success=False,
                        message="Missing 'value_column' parameter for time series analysis.",
                    )
                
                date_column = request.parameters["date_column"]
                value_column = request.parameters["value_column"]
                
                if date_column not in df.columns:
                    return AnalyzeDataResponse(
                        success=False,
                        message=f"Date column '{date_column}' not found in the data.",
                    )
                
                if value_column not in df.columns:
                    return AnalyzeDataResponse(
                        success=False,
                        message=f"Value column '{value_column}' not found in the data.",
                    )
                
                # Convert to datetime if not already
                if not pd.api.types.is_datetime64_dtype(df[date_column]):
                    df[date_column] = pd.to_datetime(df[date_column], errors="coerce")
                
                # Sort by date
                df_sorted = df.sort_values(by=date_column)
                
                # Calculate basic time series metrics
                results["start_date"] = df_sorted[date_column].min().isoformat()
                results["end_date"] = df_sorted[date_column].max().isoformat()
                results["duration_days"] = (df_sorted[date_column].max() - df_sorted[date_column].min()).days
                results["data_points"] = len(df_sorted)
                
                # Calculate trends
                if pd.api.types.is_numeric_dtype(df[value_column]):
                    results["min_value"] = float(df_sorted[value_column].min())
                    results["max_value"] = float(df_sorted[value_column].max())
                    results["mean_value"] = float(df_sorted[value_column].mean())
                    results["median_value"] = float(df_sorted[value_column].median())
                    
                    # Calculate trend direction
                    first_value = df_sorted[value_column].iloc[0]
                    last_value = df_sorted[value_column].iloc[-1]
                    results["trend_direction"] = "up" if last_value > first_value else "down" if last_value < first_value else "flat"
                    results["trend_change_percentage"] = ((last_value - first_value) / first_value) * 100 if first_value != 0 else 0
            
            else:
                return AnalyzeDataResponse(
                    success=False,
                    message=f"Unsupported analysis type '{request.analysis_type}'.",
                )
            
            return AnalyzeDataResponse(
                success=True,
                message=f"Successfully analyzed data using '{request.analysis_type}'.",
                results=results,
            )
        except Exception as e:
            logger.exception("Error analyzing data")
            return AnalyzeDataResponse(
                success=False,
                message=f"Error analyzing data: {str(e)}",
            )
    
    async def visualize_data(
        self, request: VisualizeDataRequest
    ) -> VisualizeDataResponse:
        """Visualize data.
        
        Args:
            request: The request containing the data ID and visualization type.
            
        Returns:
            A response containing the path to the visualization file.
        """
        try:
            # Check if the data ID exists
            if request.data_id not in self._data_store:
                return VisualizeDataResponse(
                    success=False,
                    message=f"Data ID '{request.data_id}' not found.",
                )
            
            # Check if the visualization type is in the list of allowed visualization types
            if (
                self.visualization_types
                and request.visualization_type not in self.visualization_types
            ):
                return VisualizeDataResponse(
                    success=False,
                    message=f"Visualization type '{request.visualization_type}' is not in the list of allowed types.",
                )
            
            # Get the data
            df = self._data_store[request.data_id]
            
            # Create a unique filename for the visualization
            filename = f"visualization_{len(self._data_store)}_{request.visualization_type}.png"
            filepath = os.path.join(self._temp_dir, filename)
            
            # Perform the visualization
            visualization_type_lower = request.visualization_type.lower()
            
            if visualization_type_lower == "line":
                # Create a line plot
                if "x" not in request.parameters or "y" not in request.parameters:
                    return VisualizeDataResponse(
                        success=False,
                        message="Missing 'x' or 'y' parameter for line plot.",
                    )
                
                x = request.parameters["x"]
                y = request.parameters["y"]
                title = request.parameters.get("title", f"Line Plot of {y} vs {x}")
                
                ax = df.plot(x=x, y=y, kind="line", figsize=(10, 6), title=title)
                ax.figure.savefig(filepath)
                ax.figure.clf()
            
            elif visualization_type_lower == "bar":
                # Create a bar plot
                if "x" not in request.parameters or "y" not in request.parameters:
                    return VisualizeDataResponse(
                        success=False,
                        message="Missing 'x' or 'y' parameter for bar plot.",
                    )
                
                x = request.parameters["x"]
                y = request.parameters["y"]
                title = request.parameters.get("title", f"Bar Plot of {y} by {x}")
                
                ax = df.plot(x=x, y=y, kind="bar", figsize=(10, 6), title=title)
                ax.figure.savefig(filepath)
                ax.figure.clf()
            
            elif visualization_type_lower == "scatter":
                # Create a scatter plot
                if "x" not in request.parameters or "y" not in request.parameters:
                    return VisualizeDataResponse(
                        success=False,
                        message="Missing 'x' or 'y' parameter for scatter plot.",
                    )
                
                x = request.parameters["x"]
                y = request.parameters["y"]
                title = request.parameters.get("title", f"Scatter Plot of {y} vs {x}")
                
                ax = df.plot(x=x, y=y, kind="scatter", figsize=(10, 6), title=title)
                ax.figure.savefig(filepath)
                ax.figure.clf()
            
            elif visualization_type_lower == "histogram":
                # Create a histogram
                if "column" not in request.parameters:
                    return VisualizeDataResponse(
                        success=False,
                        message="Missing 'column' parameter for histogram.",
                    )
                
                column = request.parameters["column"]
                bins = request.parameters.get("bins", 10)
                title = request.parameters.get("title", f"Histogram of {column}")
                
                ax = df[column].plot(kind="hist", bins=bins, figsize=(10, 6), title=title)
                ax.figure.savefig(filepath)
                ax.figure.clf()
            
            elif visualization_type_lower == "boxplot":
                # Create a box plot
                if "column" not in request.parameters:
                    return VisualizeDataResponse(
                        success=False,
                        message="Missing 'column' parameter for box plot.",
                    )
                
                column = request.parameters["column"]
                by = request.parameters.get("by", None)
                title = request.parameters.get("title", f"Box Plot of {column}")
                
                if by:
                    ax = df.boxplot(column=column, by=by, figsize=(10, 6))
                    ax.figure.suptitle(title)
                else:
                    ax = df[column].plot(kind="box", figsize=(10, 6), title=title)
                
                ax.figure.savefig(filepath)
                ax.figure.clf()
            
            elif visualization_type_lower == "heatmap":
                # Create a heatmap
                if "columns" not in request.parameters:
                    # Use all numeric columns if not specified
                    columns = df.select_dtypes(include=["number"]).columns.tolist()
                else:
                    columns = request.parameters["columns"]
                
                title = request.parameters.get("title", "Correlation Heatmap")
                
                try:
                    import matplotlib.pyplot as plt
                    import seaborn as sns
                    
                    plt.figure(figsize=(12, 10))
                    corr = df[columns].corr()
                    sns.heatmap(corr, annot=True, cmap="coolwarm", fmt=".2f", linewidths=0.5)
                    plt.title(title)
                    plt.tight_layout()
                    plt.savefig(filepath)
                    plt.close()
                except ImportError:
                    return VisualizeDataResponse(
                        success=False,
                        message="Seaborn is required for heatmap visualization but is not installed.",
                    )
            
            elif visualization_type_lower == "pie":
                # Create a pie chart
                if "column" not in request.parameters:
                    return VisualizeDataResponse(
                        success=False,
                        message="Missing 'column' parameter for pie chart.",
                    )
                
                column = request.parameters["column"]
                title = request.parameters.get("title", f"Pie Chart of {column}")
                
                ax = df[column].value_counts().plot(kind="pie", figsize=(10, 6), title=title, autopct="%1.1f%%")
                ax.figure.savefig(filepath)
                ax.figure.clf()
            
            else:
                return VisualizeDataResponse(
                    success=False,
                    message=f"Unsupported visualization type '{request.visualization_type}'.",
                )
            
            return VisualizeDataResponse(
                success=True,
                message=f"Successfully created {request.visualization_type} visualization.",
                visualization_path=filepath,
            )
        except Exception as e:
            logger.exception("Error creating visualization")
            return VisualizeDataResponse(
                success=False,
                message=f"Error creating visualization: {str(e)}",
            )


class DataAnalysisAgent(LlmAgent):
    """Specialized agent for data analysis tasks.
    
    This agent extends the base LlmAgent with specialized capabilities for data
    analysis, including tools for data loading, preprocessing, transformation, 
    analysis, and visualization.
    
    Attributes:
        data_sources: List of data sources to analyze.
        analysis_types: List of analysis types to perform.
        visualization_types: List of visualization types to generate.
        preprocessing_operations: List of preprocessing operations to perform.
        memory_service: Optional memory service for persisting analysis results.
    """
    
    data_sources: List[str] = Field(default_factory=list)
    """List of data sources to analyze."""
    
    analysis_types: List[str] = Field(default_factory=list)
    """List of analysis types to perform."""
    
    visualization_types: List[str] = Field(default_factory=list)
    """List of visualization types to generate."""
    
    preprocessing_operations: List[str] = Field(default_factory=list)
    """List of preprocessing operations to perform."""
    
    memory_service: Optional[BaseMemoryService] = None
    """Optional memory service for persisting analysis results."""
    
    def __init__(
        self,
        *,
        name: str,
        model: str,
        description: str = "A specialized agent for data analysis tasks.",
        data_sources: Optional[List[str]] = None,
        analysis_types: Optional[List[str]] = None,
        visualization_types: Optional[List[str]] = None,
        preprocessing_operations: Optional[List[str]] = None,
        memory_service: Optional[BaseMemoryService] = None,
        tools: Optional[List[ToolUnion]] = None,
        **kwargs: Any,
    ) -> None:
        """Initialize a DataAnalysisAgent.
        
        Args:
            name: The name of the agent.
            model: The model to use for the agent.
            description: Description about the agent's capability.
            data_sources: List of data sources to analyze.
            analysis_types: List of analysis types to perform.
            visualization_types: List of visualization types to generate.
            preprocessing_operations: List of preprocessing operations to perform.
            memory_service: Optional memory service for persisting analysis results.
            tools: Additional tools to provide to the agent.
            **kwargs: Additional arguments to pass to the parent class.
        """
        # Create default instruction if not provided
        if "instruction" not in kwargs:
            kwargs["instruction"] = self._create_default_instruction(
                data_sources, analysis_types, visualization_types, preprocessing_operations
            )
        
        # Initialize data sources, analysis types, and visualization types
        self.data_sources = data_sources or []
        self.analysis_types = analysis_types or []
        self.visualization_types = visualization_types or []
        self.preprocessing_operations = preprocessing_operations or [
            "clean_missing_values", "handle_outliers", "engineer_features", 
            "encode_categorical", "normalize_data", "remove_duplicates", "convert_types"
        ]
        self.memory_service = memory_service
        
        # Create data analysis toolset
        data_analysis_toolset = DataAnalysisToolset(
            data_sources=self.data_sources,
            analysis_types=self.analysis_types,
            visualization_types=self.visualization_types,
            memory_service=self.memory_service,
        )
        
        # Combine with additional tools if provided
        all_tools = [data_analysis_toolset]
        if tools:
            all_tools.extend(tools)
        
        # Initialize parent class
        super().__init__(
            name=name,
            model=model,
            description=description,
            tools=all_tools,
            **kwargs,
        )
    
    def _create_default_instruction(
        self,
        data_sources: Optional[List[str]],
        analysis_types: Optional[List[str]],
        visualization_types: Optional[List[str]],
        preprocessing_operations: Optional[List[str]],
    ) -> str:
        """Create a default instruction for the agent based on the provided parameters.
        
        Args:
            data_sources: List of data sources to analyze.
            analysis_types: List of analysis types to perform.
            visualization_types: List of visualization types to generate.
            preprocessing_operations: List of preprocessing operations to perform.
            
        Returns:
            A default instruction string.
        """
        instruction = (
            "You are a specialized data analysis assistant. "
            "Your goal is to help users analyze data, extract insights, "
            "and create visualizations. "
            "Follow these guidelines:\n\n"
            
            "1. Understand the user's data analysis needs clearly before proceeding.\n"
            "2. Use the provided tools to load, preprocess, transform, analyze, and visualize data.\n"
            "3. Always consider data quality issues and apply appropriate preprocessing steps.\n"
            "4. Explain your analysis approach and findings in clear, concise language.\n"
            "5. When presenting results, include both the raw data and your interpretation.\n"
            "6. For visualizations, explain what the visualization shows and why it's useful.\n"
            "7. If you encounter limitations or need more information, ask the user.\n\n"
        )
        
        # Add data sources information if provided
        if data_sources:
            instruction += "Available data sources:\n"
            for source in data_sources:
                instruction += f"- {source}\n"
            instruction += "\n"
        
        # Add preprocessing operations information
        preprocessing_ops = preprocessing_operations or [
            "clean_missing_values", "handle_outliers", "engineer_features", 
            "encode_categorical", "normalize_data", "remove_duplicates", "convert_types"
        ]
        
        preprocessing_descriptions = {
            "clean_missing_values": "Handle missing values in the data (drop, fill with mean/median/mode/constant)",
            "handle_outliers": "Detect and handle outliers (z-score, IQR, percentile methods)",
            "engineer_features": "Create new features (polynomial, interaction, binning, date features)",
            "encode_categorical": "Encode categorical variables (one-hot, label, ordinal, target encoding)",
            "normalize_data": "Normalize or standardize numeric data (min-max, z-score, robust scaling)",
            "remove_duplicates": "Remove duplicate rows from the data",
            "convert_types": "Convert column data types (numeric, datetime, category)"
        }
        
        instruction += "Available preprocessing operations:\n"
        for op in preprocessing_ops:
            description = preprocessing_descriptions.get(op, op)
            instruction += f"- {op}: {description}\n"
        instruction += "\n"
        
        # Add analysis types information if provided
        if analysis_types:
            instruction += "Available analysis types:\n"
            for analysis_type in analysis_types:
                instruction += f"- {analysis_type}\n"
            instruction += "\n"
        
        # Add visualization types information if provided
        if visualization_types:
            instruction += "Available visualization types:\n"
            for viz_type in visualization_types:
                instruction += f"- {viz_type}\n"
            instruction += "\n"
        
        # Add data analysis workflow guidance
        instruction += (
            "Recommended data analysis workflow:\n"
            "1. Load data from the appropriate source\n"
            "2. Explore the data to understand its structure and quality\n"
            "3. Preprocess the data to handle missing values, outliers, and other quality issues\n"
            "4. Transform the data as needed for analysis (filtering, selecting, grouping)\n"
            "5. Perform analysis to extract insights\n"
            "6. Create visualizations to illustrate key findings\n"
            "7. Summarize results and provide recommendations\n\n"
        )
        
        return instruction

