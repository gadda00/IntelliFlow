"""
Data Analysis Agent Template for ADK

This module provides a specialized agent template for data analysis tasks.
It includes built-in capabilities for data loading, preprocessing, analysis,
visualization, and insight generation.
"""

import os
import uuid
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from typing import Dict, List, Any, Optional, Union, Tuple
from adk import Agent, Message, tool
from adk.planning import Goal, Plan, Task


class DataAnalysisAgent(Agent):
    """
    A specialized agent for data analysis tasks.
    
    This agent provides built-in capabilities for:
    - Loading data from various sources
    - Preprocessing and cleaning data
    - Performing statistical analysis
    - Creating visualizations
    - Generating insights
    
    It can be used as a standalone agent or as part of a multi-agent system.
    """
    
    def __init__(
        self,
        agent_id: str,
        output_dir: str = "data_analysis_output",
        config: Optional[Dict[str, Any]] = None
    ):
        """
        Initialize the Data Analysis Agent.
        
        Args:
            agent_id: Unique identifier for the agent
            output_dir: Directory to store output files (will be created if it doesn't exist)
            config: Configuration options for the agent
        """
        super().__init__(agent_id)
        
        # Create output directories
        self.output_dir = output_dir
        self.processed_data_dir = os.path.join(output_dir, "processed_data")
        self.visualizations_dir = os.path.join(output_dir, "visualizations")
        self.reports_dir = os.path.join(output_dir, "reports")
        
        os.makedirs(self.processed_data_dir, exist_ok=True)
        os.makedirs(self.visualizations_dir, exist_ok=True)
        os.makedirs(self.reports_dir, exist_ok=True)
        
        # Initialize configuration
        self.config = config or {}
        
        # Register message handlers
        self.register_message_handler("analyze_data", self.handle_analyze_data)
        self.register_message_handler("preprocess_data", self.handle_preprocess_data)
        self.register_message_handler("visualize_data", self.handle_visualize_data)
        self.register_message_handler("generate_insights", self.handle_generate_insights)
        
        # Initialize state
        self.active_analyses = {}
    
    def handle_analyze_data(self, message: Message) -> None:
        """
        Handle a request to analyze data.
        
        The message content should include:
        - data_source: Path or URL to the data
        - analysis_type: Type of analysis to perform (e.g., "exploratory", "predictive")
        - options: Additional options for the analysis
        """
        request_id = message.metadata.get("request_id", str(uuid.uuid4()))
        data_source = message.content.get("data_source")
        analysis_type = message.content.get("analysis_type", "exploratory")
        options = message.content.get("options", {})
        
        print(f"Received analysis request {request_id} for {data_source}")
        
        # Create an analysis plan
        plan = self._create_analysis_plan(request_id, data_source, analysis_type, options)
        
        # Store the plan and request in memory
        self.memory.store("working", f"plan_{request_id}", plan)
        self.memory.store("working", f"request_{request_id}", message)
        self.memory.store("working", f"options_{request_id}", options)
        
        # Start the analysis process
        self._execute_analysis_plan(request_id, data_source, analysis_type, options)
    
    def handle_preprocess_data(self, message: Message) -> None:
        """Handle a request to preprocess data."""
        request_id = message.metadata.get("request_id", str(uuid.uuid4()))
        data_source = message.content.get("data_source")
        options = message.content.get("options", {})
        
        try:
            # Preprocess the data
            processed_data_path = self.preprocess_data(data_source, request_id, options)
            
            # Send response
            response = Message(
                sender_id=self.id,
                receiver_id=message.sender_id,
                content={
                    "status": "success",
                    "processed_data_path": processed_data_path
                },
                message_type="preprocess_data_complete",
                metadata={
                    "request_id": request_id
                }
            )
            self.send_message(response)
            
        except Exception as e:
            # Send error response
            error_message = Message(
                sender_id=self.id,
                receiver_id=message.sender_id,
                content={
                    "status": "error",
                    "error": str(e)
                },
                message_type="preprocess_data_error",
                metadata={
                    "request_id": request_id
                }
            )
            self.send_message(error_message)
    
    def handle_visualize_data(self, message: Message) -> None:
        """Handle a request to create visualizations."""
        request_id = message.metadata.get("request_id", str(uuid.uuid4()))
        data_path = message.content.get("data_path")
        analysis_results = message.content.get("analysis_results")
        options = message.content.get("options", {})
        
        try:
            # Create visualizations
            visualization_paths = self.create_visualizations(
                data_path, analysis_results, request_id, options
            )
            
            # Send response
            response = Message(
                sender_id=self.id,
                receiver_id=message.sender_id,
                content={
                    "status": "success",
                    "visualization_paths": visualization_paths
                },
                message_type="visualize_data_complete",
                metadata={
                    "request_id": request_id
                }
            )
            self.send_message(response)
            
        except Exception as e:
            # Send error response
            error_message = Message(
                sender_id=self.id,
                receiver_id=message.sender_id,
                content={
                    "status": "error",
                    "error": str(e)
                },
                message_type="visualize_data_error",
                metadata={
                    "request_id": request_id
                }
            )
            self.send_message(error_message)
    
    def handle_generate_insights(self, message: Message) -> None:
        """Handle a request to generate insights."""
        request_id = message.metadata.get("request_id", str(uuid.uuid4()))
        analysis_results = message.content.get("analysis_results")
        visualization_paths = message.content.get("visualization_paths", [])
        options = message.content.get("options", {})
        
        try:
            # Generate insights
            insights, report_path = self.generate_insights(
                analysis_results, visualization_paths, request_id, options
            )
            
            # Send response
            response = Message(
                sender_id=self.id,
                receiver_id=message.sender_id,
                content={
                    "status": "success",
                    "insights": insights,
                    "report_path": report_path
                },
                message_type="generate_insights_complete",
                metadata={
                    "request_id": request_id
                }
            )
            self.send_message(response)
            
        except Exception as e:
            # Send error response
            error_message = Message(
                sender_id=self.id,
                receiver_id=message.sender_id,
                content={
                    "status": "error",
                    "error": str(e)
                },
                message_type="generate_insights_error",
                metadata={
                    "request_id": request_id
                }
            )
            self.send_message(error_message)
    
    def _create_analysis_plan(
        self,
        request_id: str,
        data_source: str,
        analysis_type: str,
        options: Dict[str, Any]
    ) -> Plan:
        """Create a plan for the analysis workflow."""
        goal = Goal(
            name=f"Analyze {data_source}",
            description=f"Perform {analysis_type} analysis on {data_source}"
        )
        
        plan = Plan(goal)
        
        # Define tasks
        task1 = Task("preprocess_data", "Preprocess and clean data")
        task2 = Task("analyze_data", "Perform statistical analysis")
        task3 = Task("create_visualizations", "Create visualizations")
        task4 = Task("generate_insights", "Generate insights and report")
        
        # Add tasks to plan with dependencies
        plan.add_task(task1)
        plan.add_task(task2, dependencies=[task1])
        plan.add_task(task3, dependencies=[task2])
        plan.add_task(task4, dependencies=[task3])
        
        return plan
    
    def _execute_analysis_plan(
        self,
        request_id: str,
        data_source: str,
        analysis_type: str,
        options: Dict[str, Any]
    ) -> None:
        """Execute the analysis plan."""
        try:
            # Step 1: Preprocess data
            processed_data_path = self.preprocess_data(data_source, request_id, options)
            
            # Update plan status
            plan = self.memory.retrieve("working", f"plan_{request_id}")
            plan.complete_task("preprocess_data")
            
            # Step 2: Analyze data
            analysis_results = self.analyze_data(processed_data_path, request_id, options)
            
            # Update plan status
            plan.complete_task("analyze_data")
            
            # Step 3: Create visualizations
            visualization_paths = self.create_visualizations(
                processed_data_path, analysis_results, request_id, options
            )
            
            # Update plan status
            plan.complete_task("create_visualizations")
            
            # Step 4: Generate insights and report
            insights, report_path = self.generate_insights(
                analysis_results, visualization_paths, request_id, options
            )
            
            # Update plan status
            plan.complete_task("generate_insights")
            
            # Notify the requester
            original_request = self.memory.retrieve("working", f"request_{request_id}")
            if original_request:
                response = Message(
                    sender_id=self.id,
                    receiver_id=original_request.sender_id,
                    content={
                        "status": "complete",
                        "processed_data_path": processed_data_path,
                        "analysis_results": analysis_results,
                        "visualization_paths": visualization_paths,
                        "insights": insights,
                        "report_path": report_path
                    },
                    message_type="analysis_complete",
                    metadata={
                        "request_id": request_id
                    }
                )
                self.send_message(response)
            
            # Clean up memory
            self._cleanup_memory(request_id)
            
        except Exception as e:
            # Notify the requester of the error
            original_request = self.memory.retrieve("working", f"request_{request_id}")
            if original_request:
                error_message = Message(
                    sender_id=self.id,
                    receiver_id=original_request.sender_id,
                    content={
                        "status": "error",
                        "error": str(e)
                    },
                    message_type="analysis_error",
                    metadata={
                        "request_id": request_id
                    }
                )
                self.send_message(error_message)
            
            # Clean up memory
            self._cleanup_memory(request_id)
    
    def _cleanup_memory(self, request_id: str) -> None:
        """Clean up memory after analysis is complete."""
        self.memory.clear("working", f"plan_{request_id}")
        self.memory.clear("working", f"request_{request_id}")
        self.memory.clear("working", f"options_{request_id}")
    
    @tool
    def preprocess_data(
        self,
        data_source: str,
        request_id: str,
        options: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Preprocess and clean data from the specified source.
        
        Args:
            data_source: Path or URL to the data source
            request_id: Unique identifier for the request
            options: Additional preprocessing options
            
        Returns:
            Path to the processed data file
        """
        options = options or {}
        
        # Load the data
        df = self._load_data(data_source)
        
        # Apply preprocessing steps
        df = self._apply_preprocessing(df, options)
        
        # Save the processed data
        output_path = os.path.join(self.processed_data_dir, f"processed_{request_id}.csv")
        df.to_csv(output_path, index=False)
        
        return output_path
    
    def _load_data(self, data_source: str) -> pd.DataFrame:
        """Load data from the specified source."""
        if data_source.endswith('.csv'):
            return pd.read_csv(data_source)
        elif data_source.endswith('.xlsx') or data_source.endswith('.xls'):
            return pd.read_excel(data_source)
        elif data_source.endswith('.json'):
            return pd.read_json(data_source)
        elif data_source.endswith('.parquet'):
            return pd.read_parquet(data_source)
        elif data_source.endswith('.feather'):
            return pd.read_feather(data_source)
        else:
            raise ValueError(f"Unsupported data format: {data_source}")
    
    def _apply_preprocessing(
        self,
        df: pd.DataFrame,
        options: Dict[str, Any]
    ) -> pd.DataFrame:
        """Apply preprocessing steps to the data."""
        # Remove duplicate rows if specified
        if options.get("remove_duplicates", True):
            df = df.drop_duplicates()
        
        # Handle missing values
        missing_strategy = options.get("missing_strategy", "mean")
        if missing_strategy == "mean":
            df = df.fillna(df.mean(numeric_only=True))
        elif missing_strategy == "median":
            df = df.fillna(df.median(numeric_only=True))
        elif missing_strategy == "mode":
            df = df.fillna(df.mode().iloc[0])
        elif missing_strategy == "drop":
            df = df.dropna()
        
        # Convert data types if needed
        if options.get("convert_dates", True):
            for col in df.columns:
                if df[col].dtype == 'object':
                    try:
                        df[col] = pd.to_datetime(df[col])
                    except:
                        pass
        
        # Apply custom transformations if provided
        custom_transforms = options.get("custom_transforms", {})
        for col, transform in custom_transforms.items():
            if col in df.columns:
                if transform == "log":
                    df[col] = np.log1p(df[col])
                elif transform == "sqrt":
                    df[col] = np.sqrt(df[col])
                elif transform == "standardize":
                    df[col] = (df[col] - df[col].mean()) / df[col].std()
                elif transform == "normalize":
                    df[col] = (df[col] - df[col].min()) / (df[col].max() - df[col].min())
        
        return df
    
    @tool
    def analyze_data(
        self,
        data_path: str,
        request_id: str,
        options: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Perform statistical analysis on the data.
        
        Args:
            data_path: Path to the data file
            request_id: Unique identifier for the request
            options: Additional analysis options
            
        Returns:
            Dictionary containing analysis results
        """
        options = options or {}
        
        # Load the data
        df = pd.read_csv(data_path)
        
        # Initialize results dictionary
        analysis_results = {}
        
        # Get numeric and categorical columns
        numeric_columns = df.select_dtypes(include=[np.number]).columns
        categorical_columns = df.select_dtypes(include=['object', 'category']).columns
        
        # Basic statistics for numeric columns
        if options.get("basic_stats", True) and len(numeric_columns) > 0:
            analysis_results["statistics"] = df[numeric_columns].describe().to_dict()
        
        # Correlations for numeric columns
        if options.get("correlations", True) and len(numeric_columns) > 1:
            analysis_results["correlations"] = df[numeric_columns].corr().to_dict()
        
        # Category counts for categorical columns
        if options.get("category_counts", True) and len(categorical_columns) > 0:
            category_counts = {}
            for col in categorical_columns:
                category_counts[col] = df[col].value_counts().to_dict()
            analysis_results["category_counts"] = category_counts
        
        # Perform PCA if requested and if there are enough numeric columns
        if options.get("pca", True) and len(numeric_columns) >= 3:
            try:
                from sklearn.decomposition import PCA
                pca = PCA(n_components=min(3, len(numeric_columns)))
                pca_data = pca.fit_transform(df[numeric_columns].fillna(0))
                analysis_results["pca"] = {
                    "explained_variance_ratio": pca.explained_variance_ratio_.tolist(),
                    "components": pca.components_.tolist()
                }
            except:
                pass
        
        # Perform clustering if requested and if there are enough rows
        if options.get("clustering", True) and len(df) >= 10 and len(numeric_columns) >= 2:
            try:
                from sklearn.cluster import KMeans
                n_clusters = min(5, len(df) // 2)
                kmeans = KMeans(n_clusters=n_clusters)
                clusters = kmeans.fit_predict(df[numeric_columns].fillna(0))
                cluster_counts = np.bincount(clusters).tolist()
                analysis_results["clustering"] = {
                    "cluster_counts": cluster_counts,
                    "cluster_centers": kmeans.cluster_centers_.tolist()
                }
            except:
                pass
        
        # Perform time series analysis if requested and if there's a datetime column
        if options.get("time_series", False):
            datetime_columns = df.select_dtypes(include=['datetime64']).columns
            if len(datetime_columns) > 0:
                time_col = datetime_columns[0]
                if len(numeric_columns) > 0:
                    value_col = numeric_columns[0]
                    try:
                        # Resample to daily frequency
                        df_ts = df[[time_col, value_col]].copy()
                        df_ts.set_index(time_col, inplace=True)
                        daily = df_ts.resample('D').mean()
                        
                        # Calculate rolling statistics
                        rolling_mean = daily.rolling(window=7).mean().dropna().values.flatten().tolist()
                        rolling_std = daily.rolling(window=7).std().dropna().values.flatten().tolist()
                        
                        analysis_results["time_series"] = {
                            "rolling_mean": rolling_mean,
                            "rolling_std": rolling_std
                        }
                    except:
                        pass
        
        return analysis_results
    
    @tool
    def create_visualizations(
        self,
        data_path: str,
        analysis_results: Dict[str, Any],
        request_id: str,
        options: Optional[Dict[str, Any]] = None
    ) -> List[str]:
        """
        Create visualizations based on the data and analysis results.
        
        Args:
            data_path: Path to the data file
            analysis_results: Dictionary containing analysis results
            request_id: Unique identifier for the request
            options: Additional visualization options
            
        Returns:
            List of paths to the created visualization files
        """
        options = options or {}
        
        # Load the data
        df = pd.read_csv(data_path)
        
        # Get numeric and categorical columns
        numeric_columns = df.select_dtypes(include=[np.number]).columns
        categorical_columns = df.select_dtypes(include=['object', 'category']).columns
        
        # Set the style
        plt.style.use(options.get("style", "seaborn-v0_8-whitegrid"))
        
        visualization_paths = []
        
        # Create a correlation heatmap
        if analysis_results.get("correlations") and len(numeric_columns) > 1:
            plt.figure(figsize=(10, 8))
            sns.heatmap(df[numeric_columns].corr(), annot=True, cmap='coolwarm')
            plt.title('Correlation Heatmap')
            plt.tight_layout()
            
            heatmap_path = os.path.join(self.visualizations_dir, f"correlation_heatmap_{request_id}.png")
            plt.savefig(heatmap_path)
            plt.close()
            visualization_paths.append(heatmap_path)
        
        # Create histograms for numeric columns
        if len(numeric_columns) > 0:
            # Limit to first 5 columns to avoid too many plots
            cols_to_plot = numeric_columns[:5]
            plt.figure(figsize=(12, 8))
            for i, col in enumerate(cols_to_plot, 1):
                plt.subplot(min(len(cols_to_plot), 3), (len(cols_to_plot) + 2) // 3, i)
                sns.histplot(df[col].dropna(), kde=True)
                plt.title(f'Distribution of {col}')
            plt.tight_layout()
            
            histograms_path = os.path.join(self.visualizations_dir, f"histograms_{request_id}.png")
            plt.savefig(histograms_path)
            plt.close()
            visualization_paths.append(histograms_path)
        
        # Create a scatter plot matrix
        if len(numeric_columns) >= 2:
            # Limit to first 4 columns to avoid too many plots
            cols_to_plot = numeric_columns[:4]
            plt.figure(figsize=(12, 10))
            sns.pairplot(df[cols_to_plot])
            plt.suptitle('Scatter Plot Matrix', y=1.02)
            
            scatterplot_path = os.path.join(self.visualizations_dir, f"scatterplot_matrix_{request_id}.png")
            plt.savefig(scatterplot_path)
            plt.close()
            visualization_paths.append(scatterplot_path)
        
        # Create bar plots for categorical columns
        if len(categorical_columns) > 0:
            # Limit to first 3 columns to avoid too many plots
            cols_to_plot = categorical_columns[:3]
            plt.figure(figsize=(12, 8))
            for i, col in enumerate(cols_to_plot, 1):
                plt.subplot(len(cols_to_plot), 1, i)
                value_counts = df[col].value_counts().nlargest(10)  # Limit to top 10 categories
                sns.barplot(x=value_counts.index, y=value_counts.values)
                plt.title(f'Top Categories in {col}')
                plt.xticks(rotation=45)
            plt.tight_layout()
            
            categorical_path = os.path.join(self.visualizations_dir, f"categorical_plots_{request_id}.png")
            plt.savefig(categorical_path)
            plt.close()
            visualization_paths.append(categorical_path)
        
        # Create a PCA visualization if available
        if analysis_results.get("pca") and analysis_results["pca"].get("explained_variance_ratio"):
            plt.figure(figsize=(10, 6))
            plt.bar(
                range(len(analysis_results["pca"]["explained_variance_ratio"])),
                analysis_results["pca"]["explained_variance_ratio"]
            )
            plt.xlabel('Principal Components')
            plt.ylabel('Explained Variance Ratio')
            plt.title('PCA Explained Variance')
            plt.tight_layout()
            
            pca_path = os.path.join(self.visualizations_dir, f"pca_variance_{request_id}.png")
            plt.savefig(pca_path)
            plt.close()
            visualization_paths.append(pca_path)
        
        # Create a cluster visualization if available
        if analysis_results.get("clustering") and analysis_results["clustering"].get("cluster_counts"):
            plt.figure(figsize=(10, 6))
            plt.bar(
                range(len(analysis_results["clustering"]["cluster_counts"])),
                analysis_results["clustering"]["cluster_counts"]
            )
            plt.xlabel('Cluster')
            plt.ylabel('Number of Samples')
            plt.title('Cluster Distribution')
            plt.tight_layout()
            
            cluster_path = os.path.join(self.visualizations_dir, f"cluster_distribution_{request_id}.png")
            plt.savefig(cluster_path)
            plt.close()
            visualization_paths.append(cluster_path)
        
        # Create time series visualization if available
        if analysis_results.get("time_series"):
            plt.figure(figsize=(12, 6))
            plt.plot(analysis_results["time_series"]["rolling_mean"], label='7-day Rolling Mean')
            plt.title('Time Series Analysis')
            plt.xlabel('Days')
            plt.ylabel('Value')
            plt.legend()
            plt.tight_layout()
            
            time_series_path = os.path.join(self.visualizations_dir, f"time_series_{request_id}.png")
            plt.savefig(time_series_path)
            plt.close()
            visualization_paths.append(time_series_path)
        
        return visualization_paths
    
    @tool
    def generate_insights(
        self,
        analysis_results: Dict[str, Any],
        visualization_paths: List[str],
        request_id: str,
        options: Optional[Dict[str, Any]] = None
    ) -> Tuple[List[str], str]:
        """
        Generate insights from analysis results and create a report.
        
        Args:
            analysis_results: Dictionary containing analysis results
            visualization_paths: List of paths to visualization files
            request_id: Unique identifier for the request
            options: Additional options for insight generation
            
        Returns:
            Tuple of (insights list, report path)
        """
        options = options or {}
        insights = []
        
        # Extract insights from statistics
        if analysis_results.get("statistics"):
            for column, stats in analysis_results["statistics"].items():
                if "mean" in stats and "std" in stats:
                    mean = stats["mean"]
                    std = stats["std"]
                    insights.append(f"The average {column} is {mean:.2f} with a standard deviation of {std:.2f}")
                
                if "min" in stats and "max" in stats:
                    min_val = stats["min"]
                    max_val = stats["max"]
                    insights.append(f"The {column} ranges from {min_val:.2f} to {max_val:.2f}")
        
        # Extract insights from correlations
        if analysis_results.get("correlations"):
            strong_correlations = []
            for col1, corr_dict in analysis_results["correlations"].items():
                for col2, corr in corr_dict.items():
                    if col1 != col2 and abs(corr) > 0.7:
                        strong_correlations.append((col1, col2, corr))
            
            for col1, col2, corr in strong_correlations:
                relation = "positive" if corr > 0 else "negative"
                insights.append(f"There is a strong {relation} correlation ({corr:.2f}) between {col1} and {col2}")
        
        # Extract insights from category counts
        if analysis_results.get("category_counts"):
            for col, counts in analysis_results["category_counts"].items():
                if counts:
                    top_category = max(counts.items(), key=lambda x: x[1])
                    insights.append(f"The most common {col} is '{top_category[0]}' with {top_category[1]} occurrences")
        
        # Extract insights from PCA
        if analysis_results.get("pca") and analysis_results["pca"].get("explained_variance_ratio"):
            total_variance = sum(analysis_results["pca"]["explained_variance_ratio"])
            insights.append(f"The first {len(analysis_results['pca']['explained_variance_ratio'])} principal components explain {total_variance:.2%} of the variance")
        
        # Extract insights from clustering
        if analysis_results.get("clustering") and analysis_results["clustering"].get("cluster_counts"):
            cluster_counts = analysis_results["clustering"]["cluster_counts"]
            largest_cluster = max(cluster_counts)
            largest_cluster_idx = cluster_counts.index(largest_cluster)
            insights.append(f"The largest cluster (Cluster {largest_cluster_idx}) contains {largest_cluster} samples")
        
        # Extract insights from time series
        if analysis_results.get("time_series"):
            if "rolling_mean" in analysis_results["time_series"]:
                rolling_mean = analysis_results["time_series"]["rolling_mean"]
                if rolling_mean:
                    trend = "increasing" if rolling_mean[-1] > rolling_mean[0] else "decreasing"
                    insights.append(f"The time series shows a {trend} trend over the analyzed period")
        
        # Create a report
        report_format = options.get("report_format", "html")
        if report_format == "html":
            report_path = self._create_html_report(insights, visualization_paths, request_id)
        elif report_format == "markdown":
            report_path = self._create_markdown_report(insights, visualization_paths, request_id)
        else:
            report_path = self._create_html_report(insights, visualization_paths, request_id)
        
        return insights, report_path
    
    def _create_html_report(
        self,
        insights: List[str],
        visualization_paths: List[str],
        request_id: str
    ) -> str:
        """Create an HTML report."""
        from datetime import datetime
        
        report_path = os.path.join(self.reports_dir, f"analysis_report_{request_id}.html")
        with open(report_path, "w") as f:
            f.write("<html>\n")
            f.write("<head>\n")
            f.write("    <title>Data Analysis Report</title>\n")
            f.write("    <style>\n")
            f.write("        body { font-family: Arial, sans-serif; margin: 20px; }\n")
            f.write("        h1 { color: #2c3e50; }\n")
            f.write("        h2 { color: #3498db; }\n")
            f.write("        .insight { margin-bottom: 10px; padding: 10px; background-color: #f8f9fa; border-left: 4px solid #3498db; }\n")
            f.write("        .visualization { margin: 20px 0; text-align: center; }\n")
            f.write("        .footer { margin-top: 30px; font-size: 0.8em; color: #7f8c8d; }\n")
            f.write("    </style>\n")
            f.write("</head>\n")
            f.write("<body>\n")
            
            f.write(f"    <h1>Data Analysis Report</h1>\n")
            f.write(f"    <p>Generated on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>\n")
            
            f.write("    <h2>Key Insights</h2>\n")
            for insight in insights:
                f.write(f"    <div class='insight'>{insight}</div>\n")
            
            f.write("    <h2>Visualizations</h2>\n")
            for viz_path in visualization_paths:
                viz_filename = os.path.basename(viz_path)
                viz_title = viz_filename.split('_')[0].title()
                f.write(f"    <div class='visualization'>\n")
                f.write(f"        <h3>{viz_title}</h3>\n")
                f.write(f"        <img src='../{viz_path}' alt='{viz_filename}' style='max-width: 100%;'>\n")
                f.write(f"    </div>\n")
            
            f.write("    <div class='footer'>Generated by ADK Data Analysis Agent</div>\n")
            f.write("</body>\n")
            f.write("</html>\n")
        
        return report_path
    
    def _create_markdown_report(
        self,
        insights: List[str],
        visualization_paths: List[str],
        request_id: str
    ) -> str:
        """Create a Markdown report."""
        from datetime import datetime
        
        report_path = os.path.join(self.reports_dir, f"analysis_report_{request_id}.md")
        with open(report_path, "w") as f:
            f.write("# Data Analysis Report\n\n")
            f.write(f"Generated on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
            
            f.write("## Key Insights\n\n")
            for insight in insights:
                f.write(f"- {insight}\n")
            
            f.write("\n## Visualizations\n\n")
            for viz_path in visualization_paths:
                viz_filename = os.path.basename(viz_path)
                viz_title = viz_filename.split('_')[0].title()
                f.write(f"### {viz_title}\n\n")
                f.write(f"![{viz_title}](../{viz_path})\n\n")
            
            f.write("\n---\n\nGenerated by ADK Data Analysis Agent\n")
        
        return report_path


# Example usage:
if __name__ == "__main__":
    # Create a data analysis agent
    agent = DataAnalysisAgent("data_analysis_agent")
    
    # Start the agent
    agent.start()
    
    # Create an analysis request
    request_id = str(uuid.uuid4())
    request = Message(
        sender_id="user",
        receiver_id="data_analysis_agent",
        content={
            "data_source": "data/sample_data.csv",
            "analysis_type": "exploratory",
            "options": {
                "remove_duplicates": True,
                "missing_strategy": "mean",
                "convert_dates": True,
                "pca": True,
                "clustering": True,
                "report_format": "html"
            }
        },
        message_type="analyze_data",
        metadata={
            "request_id": request_id
        }
    )
    
    # Send the request to the agent
    agent.receive_message(request)
    
    print("Analysis request sent. Check the output directory for results.")

