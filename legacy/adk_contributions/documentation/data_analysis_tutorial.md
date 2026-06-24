# Building a Data Analysis System with ADK

This tutorial will guide you through building a multi-agent data analysis system using the Agent Development Kit (ADK). By the end, you'll have a system that can analyze data, generate insights, and create visualizations.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [System Architecture](#system-architecture)
4. [Setting Up the Project](#setting-up-the-project)
5. [Implementing the Agents](#implementing-the-agents)
   - [Orchestrator Agent](#orchestrator-agent)
   - [Data Ingestion Agent](#data-ingestion-agent)
   - [Analysis Agent](#analysis-agent)
   - [Visualization Agent](#visualization-agent)
   - [Insight Generation Agent](#insight-generation-agent)
6. [Running the System](#running-the-system)
7. [Extending the System](#extending-the-system)
8. [Best Practices](#best-practices)
9. [Troubleshooting](#troubleshooting)

## Overview

In this tutorial, we'll build a data analysis system consisting of multiple specialized agents that work together to:

1. Ingest data from various sources
2. Clean and preprocess the data
3. Perform statistical analysis
4. Generate visualizations
5. Extract insights from the data

This system demonstrates how ADK can be used to build complex, collaborative agent systems for real-world applications.

## Prerequisites

Before starting this tutorial, make sure you have:

- Python 3.8 or higher
- ADK installed (`pip install adk`)
- Basic knowledge of Python and data analysis
- The following Python packages:
  - pandas
  - numpy
  - matplotlib
  - scikit-learn

## System Architecture

Our data analysis system consists of five agents:

1. **Orchestrator Agent**: Coordinates the overall workflow and communication between agents
2. **Data Ingestion Agent**: Handles data loading, cleaning, and preprocessing
3. **Analysis Agent**: Performs statistical analysis and modeling
4. **Visualization Agent**: Creates charts and graphs
5. **Insight Generation Agent**: Extracts insights and generates reports

The agents communicate through messages and share data using ADK's memory system.

## Setting Up the Project

First, let's set up our project structure:

```
data_analysis_system/
├── __init__.py
├── main.py
├── agents/
│   ├── __init__.py
│   ├── orchestrator.py
│   ├── data_ingestion.py
│   ├── analysis.py
│   ├── visualization.py
│   └── insight_generation.py
├── tools/
│   ├── __init__.py
│   ├── data_tools.py
│   ├── analysis_tools.py
│   └── visualization_tools.py
└── data/
    └── sample_data.csv
```

Create these directories and files:

```bash
mkdir -p data_analysis_system/agents data_analysis_system/tools data_analysis_system/data
touch data_analysis_system/__init__.py data_analysis_system/main.py
touch data_analysis_system/agents/__init__.py data_analysis_system/agents/orchestrator.py data_analysis_system/agents/data_ingestion.py data_analysis_system/agents/analysis.py data_analysis_system/agents/visualization.py data_analysis_system/agents/insight_generation.py
touch data_analysis_system/tools/__init__.py data_analysis_system/tools/data_tools.py data_analysis_system/tools/analysis_tools.py data_analysis_system/tools/visualization_tools.py
```

## Implementing the Agents

### Orchestrator Agent

The orchestrator agent coordinates the workflow and communication between agents. Create `agents/orchestrator.py`:

```python
from adk import Agent, Message, tool
from adk.planning import Goal, Plan, Task

class OrchestratorAgent(Agent):
    def __init__(self, agent_id):
        super().__init__(agent_id)
        self.register_message_handler("analysis_request", self.handle_analysis_request)
        self.register_message_handler("data_ingestion_complete", self.handle_data_ingestion_complete)
        self.register_message_handler("analysis_complete", self.handle_analysis_complete)
        self.register_message_handler("visualization_complete", self.handle_visualization_complete)
        self.register_message_handler("insights_complete", self.handle_insights_complete)
        
        # Initialize state
        self.active_analyses = {}
    
    def handle_analysis_request(self, message):
        """Handle a new analysis request."""
        request_id = message.metadata.get("request_id")
        data_source = message.content.get("data_source")
        analysis_type = message.content.get("analysis_type")
        
        print(f"Received analysis request {request_id} for {data_source}")
        
        # Create a new analysis plan
        plan = self.create_analysis_plan(request_id, data_source, analysis_type)
        
        # Store the plan in memory
        self.memory.store("working", f"plan_{request_id}", plan)
        
        # Start the data ingestion phase
        self.request_data_ingestion(request_id, data_source)
    
    def create_analysis_plan(self, request_id, data_source, analysis_type):
        """Create a plan for the analysis workflow."""
        goal = Goal(
            name=f"Analyze {data_source}",
            description=f"Perform {analysis_type} analysis on {data_source}"
        )
        
        plan = Plan(goal)
        
        # Define tasks
        task1 = Task("data_ingestion", "Ingest and preprocess data")
        task2 = Task("analysis", "Perform statistical analysis")
        task3 = Task("visualization", "Create visualizations")
        task4 = Task("insight_generation", "Generate insights")
        
        # Add tasks to plan with dependencies
        plan.add_task(task1)
        plan.add_task(task2, dependencies=[task1])
        plan.add_task(task3, dependencies=[task2])
        plan.add_task(task4, dependencies=[task3])
        
        return plan
    
    def request_data_ingestion(self, request_id, data_source):
        """Request data ingestion from the data ingestion agent."""
        message = Message(
            sender_id=self.id,
            receiver_id="data_ingestion_agent",
            content={
                "data_source": data_source
            },
            message_type="ingest_data",
            metadata={
                "request_id": request_id
            }
        )
        self.send_message(message)
    
    def handle_data_ingestion_complete(self, message):
        """Handle completion of data ingestion."""
        request_id = message.metadata.get("request_id")
        data_path = message.content.get("data_path")
        
        print(f"Data ingestion complete for request {request_id}")
        
        # Update plan status
        plan = self.memory.retrieve("working", f"plan_{request_id}")
        plan.complete_task("data_ingestion")
        
        # Request analysis
        message = Message(
            sender_id=self.id,
            receiver_id="analysis_agent",
            content={
                "data_path": data_path
            },
            message_type="analyze_data",
            metadata={
                "request_id": request_id
            }
        )
        self.send_message(message)
    
    def handle_analysis_complete(self, message):
        """Handle completion of data analysis."""
        request_id = message.metadata.get("request_id")
        analysis_results = message.content.get("analysis_results")
        data_path = message.content.get("data_path")
        
        print(f"Analysis complete for request {request_id}")
        
        # Update plan status
        plan = self.memory.retrieve("working", f"plan_{request_id}")
        plan.complete_task("analysis")
        
        # Store analysis results
        self.memory.store("working", f"analysis_results_{request_id}", analysis_results)
        
        # Request visualizations
        message = Message(
            sender_id=self.id,
            receiver_id="visualization_agent",
            content={
                "data_path": data_path,
                "analysis_results": analysis_results
            },
            message_type="create_visualizations",
            metadata={
                "request_id": request_id
            }
        )
        self.send_message(message)
    
    def handle_visualization_complete(self, message):
        """Handle completion of visualization creation."""
        request_id = message.metadata.get("request_id")
        visualization_paths = message.content.get("visualization_paths")
        analysis_results = self.memory.retrieve("working", f"analysis_results_{request_id}")
        
        print(f"Visualizations complete for request {request_id}")
        
        # Update plan status
        plan = self.memory.retrieve("working", f"plan_{request_id}")
        plan.complete_task("visualization")
        
        # Request insight generation
        message = Message(
            sender_id=self.id,
            receiver_id="insight_generation_agent",
            content={
                "analysis_results": analysis_results,
                "visualization_paths": visualization_paths
            },
            message_type="generate_insights",
            metadata={
                "request_id": request_id
            }
        )
        self.send_message(message)
    
    def handle_insights_complete(self, message):
        """Handle completion of insight generation."""
        request_id = message.metadata.get("request_id")
        insights = message.content.get("insights")
        report_path = message.content.get("report_path")
        
        print(f"Insights generation complete for request {request_id}")
        
        # Update plan status
        plan = self.memory.retrieve("working", f"plan_{request_id}")
        plan.complete_task("insight_generation")
        
        # Notify the requester
        original_request = self.memory.retrieve("working", f"request_{request_id}")
        if original_request:
            response = Message(
                sender_id=self.id,
                receiver_id=original_request.sender_id,
                content={
                    "status": "complete",
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
        self.memory.clear("working", f"plan_{request_id}")
        self.memory.clear("working", f"analysis_results_{request_id}")
        self.memory.clear("working", f"request_{request_id}")
```

### Data Ingestion Agent

The data ingestion agent handles loading, cleaning, and preprocessing data. Create `agents/data_ingestion.py`:

```python
import os
import pandas as pd
from adk import Agent, Message, tool

class DataIngestionAgent(Agent):
    def __init__(self, agent_id):
        super().__init__(agent_id)
        self.register_message_handler("ingest_data", self.handle_ingest_data)
        
        # Create data directory if it doesn't exist
        os.makedirs("processed_data", exist_ok=True)
    
    def handle_ingest_data(self, message):
        """Handle a request to ingest data."""
        request_id = message.metadata.get("request_id")
        data_source = message.content.get("data_source")
        
        print(f"Ingesting data from {data_source} for request {request_id}")
        
        try:
            # Load and preprocess the data
            processed_data_path = self.ingest_and_preprocess(data_source, request_id)
            
            # Notify the orchestrator that data ingestion is complete
            response = Message(
                sender_id=self.id,
                receiver_id=message.sender_id,
                content={
                    "status": "success",
                    "data_path": processed_data_path
                },
                message_type="data_ingestion_complete",
                metadata={
                    "request_id": request_id
                }
            )
            self.send_message(response)
            
        except Exception as e:
            # Notify the orchestrator of the error
            error_message = Message(
                sender_id=self.id,
                receiver_id=message.sender_id,
                content={
                    "status": "error",
                    "error": str(e)
                },
                message_type="data_ingestion_error",
                metadata={
                    "request_id": request_id
                }
            )
            self.send_message(error_message)
    
    @tool
    def ingest_and_preprocess(self, data_source, request_id):
        """
        Ingest and preprocess data from the specified source.
        
        Args:
            data_source: Path or URL to the data source
            request_id: Unique identifier for the request
            
        Returns:
            Path to the processed data file
        """
        # Load the data
        if data_source.endswith('.csv'):
            df = pd.read_csv(data_source)
        elif data_source.endswith('.xlsx') or data_source.endswith('.xls'):
            df = pd.read_excel(data_source)
        elif data_source.endswith('.json'):
            df = pd.read_json(data_source)
        else:
            raise ValueError(f"Unsupported data format: {data_source}")
        
        # Basic preprocessing
        # 1. Remove duplicate rows
        df = df.drop_duplicates()
        
        # 2. Handle missing values
        df = df.fillna(df.mean(numeric_only=True))
        
        # 3. Convert data types if needed
        for col in df.columns:
            if df[col].dtype == 'object':
                try:
                    df[col] = pd.to_datetime(df[col])
                except:
                    pass
        
        # Save the processed data
        output_path = f"processed_data/processed_{request_id}.csv"
        df.to_csv(output_path, index=False)
        
        return output_path
```

### Analysis Agent

The analysis agent performs statistical analysis and modeling. Create `agents/analysis.py`:

```python
import pandas as pd
import numpy as np
from sklearn.decomposition import PCA
from sklearn.cluster import KMeans
from adk import Agent, Message, tool

class AnalysisAgent(Agent):
    def __init__(self, agent_id):
        super().__init__(agent_id)
        self.register_message_handler("analyze_data", self.handle_analyze_data)
    
    def handle_analyze_data(self, message):
        """Handle a request to analyze data."""
        request_id = message.metadata.get("request_id")
        data_path = message.content.get("data_path")
        
        print(f"Analyzing data from {data_path} for request {request_id}")
        
        try:
            # Perform the analysis
            analysis_results = self.analyze_data(data_path)
            
            # Notify the orchestrator that analysis is complete
            response = Message(
                sender_id=self.id,
                receiver_id=message.sender_id,
                content={
                    "status": "success",
                    "analysis_results": analysis_results,
                    "data_path": data_path
                },
                message_type="analysis_complete",
                metadata={
                    "request_id": request_id
                }
            )
            self.send_message(response)
            
        except Exception as e:
            # Notify the orchestrator of the error
            error_message = Message(
                sender_id=self.id,
                receiver_id=message.sender_id,
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
    
    @tool
    def analyze_data(self, data_path):
        """
        Perform statistical analysis on the data.
        
        Args:
            data_path: Path to the data file
            
        Returns:
            Dictionary containing analysis results
        """
        # Load the data
        df = pd.read_csv(data_path)
        
        # Basic statistical analysis
        numeric_columns = df.select_dtypes(include=[np.number]).columns
        
        # Calculate descriptive statistics
        stats = df[numeric_columns].describe().to_dict()
        
        # Calculate correlations
        correlations = {}
        if len(numeric_columns) > 1:
            corr_matrix = df[numeric_columns].corr().to_dict()
            correlations = corr_matrix
        
        # Perform PCA if there are enough numeric columns
        pca_results = {}
        if len(numeric_columns) >= 3:
            try:
                pca = PCA(n_components=min(3, len(numeric_columns)))
                pca_data = pca.fit_transform(df[numeric_columns].fillna(0))
                pca_results = {
                    "explained_variance_ratio": pca.explained_variance_ratio_.tolist(),
                    "components": pca.components_.tolist()
                }
            except:
                pass
        
        # Perform clustering if there are enough rows
        clustering_results = {}
        if len(df) >= 10 and len(numeric_columns) >= 2:
            try:
                kmeans = KMeans(n_clusters=min(5, len(df) // 2))
                clusters = kmeans.fit_predict(df[numeric_columns].fillna(0))
                cluster_counts = np.bincount(clusters).tolist()
                clustering_results = {
                    "cluster_counts": cluster_counts,
                    "cluster_centers": kmeans.cluster_centers_.tolist()
                }
            except:
                pass
        
        # Compile all results
        analysis_results = {
            "statistics": stats,
            "correlations": correlations,
            "pca": pca_results,
            "clustering": clustering_results
        }
        
        return analysis_results
```

### Visualization Agent

The visualization agent creates charts and graphs. Create `agents/visualization.py`:

```python
import os
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from adk import Agent, Message, tool

class VisualizationAgent(Agent):
    def __init__(self, agent_id):
        super().__init__(agent_id)
        self.register_message_handler("create_visualizations", self.handle_create_visualizations)
        
        # Create visualizations directory if it doesn't exist
        os.makedirs("visualizations", exist_ok=True)
    
    def handle_create_visualizations(self, message):
        """Handle a request to create visualizations."""
        request_id = message.metadata.get("request_id")
        data_path = message.content.get("data_path")
        analysis_results = message.content.get("analysis_results")
        
        print(f"Creating visualizations for request {request_id}")
        
        try:
            # Create visualizations
            visualization_paths = self.create_visualizations(data_path, analysis_results, request_id)
            
            # Notify the orchestrator that visualization is complete
            response = Message(
                sender_id=self.id,
                receiver_id=message.sender_id,
                content={
                    "status": "success",
                    "visualization_paths": visualization_paths
                },
                message_type="visualization_complete",
                metadata={
                    "request_id": request_id
                }
            )
            self.send_message(response)
            
        except Exception as e:
            # Notify the orchestrator of the error
            error_message = Message(
                sender_id=self.id,
                receiver_id=message.sender_id,
                content={
                    "status": "error",
                    "error": str(e)
                },
                message_type="visualization_error",
                metadata={
                    "request_id": request_id
                }
            )
            self.send_message(error_message)
    
    @tool
    def create_visualizations(self, data_path, analysis_results, request_id):
        """
        Create visualizations based on the data and analysis results.
        
        Args:
            data_path: Path to the data file
            analysis_results: Dictionary containing analysis results
            request_id: Unique identifier for the request
            
        Returns:
            List of paths to the created visualization files
        """
        # Load the data
        df = pd.read_csv(data_path)
        
        visualization_paths = []
        
        # 1. Create a correlation heatmap
        if analysis_results.get("correlations"):
            plt.figure(figsize=(10, 8))
            numeric_columns = df.select_dtypes(include=['number']).columns
            sns.heatmap(df[numeric_columns].corr(), annot=True, cmap='coolwarm')
            plt.title('Correlation Heatmap')
            plt.tight_layout()
            
            heatmap_path = f"visualizations/correlation_heatmap_{request_id}.png"
            plt.savefig(heatmap_path)
            plt.close()
            visualization_paths.append(heatmap_path)
        
        # 2. Create histograms for numeric columns
        numeric_columns = df.select_dtypes(include=['number']).columns[:5]  # Limit to first 5 columns
        if len(numeric_columns) > 0:
            plt.figure(figsize=(12, 8))
            for i, col in enumerate(numeric_columns, 1):
                plt.subplot(min(len(numeric_columns), 3), (len(numeric_columns) + 2) // 3, i)
                sns.histplot(df[col].dropna(), kde=True)
                plt.title(f'Distribution of {col}')
            plt.tight_layout()
            
            histograms_path = f"visualizations/histograms_{request_id}.png"
            plt.savefig(histograms_path)
            plt.close()
            visualization_paths.append(histograms_path)
        
        # 3. Create a scatter plot matrix
        if len(numeric_columns) >= 2:
            plt.figure(figsize=(12, 10))
            sns.pairplot(df[numeric_columns])
            plt.suptitle('Scatter Plot Matrix', y=1.02)
            
            scatterplot_path = f"visualizations/scatterplot_matrix_{request_id}.png"
            plt.savefig(scatterplot_path)
            plt.close()
            visualization_paths.append(scatterplot_path)
        
        # 4. Create a PCA visualization if available
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
            
            pca_path = f"visualizations/pca_variance_{request_id}.png"
            plt.savefig(pca_path)
            plt.close()
            visualization_paths.append(pca_path)
        
        # 5. Create a cluster visualization if available
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
            
            cluster_path = f"visualizations/cluster_distribution_{request_id}.png"
            plt.savefig(cluster_path)
            plt.close()
            visualization_paths.append(cluster_path)
        
        return visualization_paths
```

### Insight Generation Agent

The insight generation agent extracts insights and creates reports. Create `agents/insight_generation.py`:

```python
import os
from datetime import datetime
from adk import Agent, Message, tool

class InsightGenerationAgent(Agent):
    def __init__(self, agent_id):
        super().__init__(agent_id)
        self.register_message_handler("generate_insights", self.handle_generate_insights)
        
        # Create reports directory if it doesn't exist
        os.makedirs("reports", exist_ok=True)
    
    def handle_generate_insights(self, message):
        """Handle a request to generate insights."""
        request_id = message.metadata.get("request_id")
        analysis_results = message.content.get("analysis_results")
        visualization_paths = message.content.get("visualization_paths")
        
        print(f"Generating insights for request {request_id}")
        
        try:
            # Generate insights and create a report
            insights, report_path = self.generate_insights_and_report(
                analysis_results, visualization_paths, request_id
            )
            
            # Notify the orchestrator that insight generation is complete
            response = Message(
                sender_id=self.id,
                receiver_id=message.sender_id,
                content={
                    "status": "success",
                    "insights": insights,
                    "report_path": report_path
                },
                message_type="insights_complete",
                metadata={
                    "request_id": request_id
                }
            )
            self.send_message(response)
            
        except Exception as e:
            # Notify the orchestrator of the error
            error_message = Message(
                sender_id=self.id,
                receiver_id=message.sender_id,
                content={
                    "status": "error",
                    "error": str(e)
                },
                message_type="insights_error",
                metadata={
                    "request_id": request_id
                }
            )
            self.send_message(error_message)
    
    @tool
    def generate_insights_and_report(self, analysis_results, visualization_paths, request_id):
        """
        Generate insights from analysis results and create a report.
        
        Args:
            analysis_results: Dictionary containing analysis results
            visualization_paths: List of paths to visualization files
            request_id: Unique identifier for the request
            
        Returns:
            Tuple of (insights list, report path)
        """
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
        
        # Create a report
        report_path = f"reports/analysis_report_{request_id}.html"
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
                f.write(f"    <div class='visualization'>\n")
                f.write(f"        <h3>{viz_filename.split('_')[0].title()}</h3>\n")
                f.write(f"        <img src='../{viz_path}' alt='{viz_filename}' style='max-width: 100%;'>\n")
                f.write(f"    </div>\n")
            
            f.write("    <div class='footer'>Generated by ADK Data Analysis System</div>\n")
            f.write("</body>\n")
            f.write("</html>\n")
        
        return insights, report_path
```

## Running the System

Now, let's create the main script to run our data analysis system. Create `main.py`:

```python
import uuid
import time
from adk import Message
from agents.orchestrator import OrchestratorAgent
from agents.data_ingestion import DataIngestionAgent
from agents.analysis import AnalysisAgent
from agents.visualization import VisualizationAgent
from agents.insight_generation import InsightGenerationAgent

def main():
    # Create the agents
    orchestrator = OrchestratorAgent("orchestrator")
    data_ingestion = DataIngestionAgent("data_ingestion_agent")
    analysis = AnalysisAgent("analysis_agent")
    visualization = VisualizationAgent("visualization_agent")
    insight_generation = InsightGenerationAgent("insight_generation_agent")
    
    # Start the agents
    orchestrator.start()
    data_ingestion.start()
    analysis.start()
    visualization.start()
    insight_generation.start()
    
    # Create an analysis request
    request_id = str(uuid.uuid4())
    request = Message(
        sender_id="user",
        receiver_id="orchestrator",
        content={
            "data_source": "data/sample_data.csv",
            "analysis_type": "exploratory"
        },
        message_type="analysis_request",
        metadata={
            "request_id": request_id
        }
    )
    
    # Send the request to the orchestrator
    orchestrator.receive_message(request)
    
    # Wait for the analysis to complete
    print("Analysis request sent. Waiting for completion...")
    time.sleep(30)  # In a real system, you would use a proper waiting mechanism
    
    # Stop the agents
    orchestrator.stop()
    data_ingestion.stop()
    analysis.stop()
    visualization.stop()
    insight_generation.stop()
    
    print("Analysis complete. Check the reports directory for results.")

if __name__ == "__main__":
    main()
```

## Extending the System

You can extend this system in several ways:

1. **Add more specialized agents**: For example, a Natural Language Processing agent for text data or a Time Series Analysis agent for temporal data.

2. **Implement more advanced tools**: Add tools for machine learning, deep learning, or specialized statistical analyses.

3. **Add a user interface**: Create a web interface or API to interact with the system.

4. **Implement real-time monitoring**: Add monitoring capabilities to track the progress of analyses.

5. **Add support for more data sources**: Implement connectors for databases, APIs, or cloud storage.

## Best Practices

1. **Error handling**: Implement robust error handling in all agents to prevent system failures.

2. **Logging**: Add comprehensive logging to track system behavior and diagnose issues.

3. **Testing**: Write tests for each agent and the overall system to ensure reliability.

4. **Documentation**: Document your agents, tools, and system architecture.

5. **Scalability**: Design your system to handle large datasets and multiple concurrent analyses.

## Troubleshooting

### Common Issues

1. **Agents not communicating**: Ensure that message types and handler registrations match.

2. **Memory errors**: For large datasets, consider using chunking or streaming approaches.

3. **Visualization errors**: Make sure matplotlib is properly configured for your environment.

4. **Report generation errors**: Check file paths and permissions for the reports directory.

---

This tutorial has shown you how to build a multi-agent data analysis system using ADK. You can use this as a starting point for more complex systems tailored to your specific data analysis needs.

