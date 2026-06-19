"""
BigQuery visualizer for IntelliFlow.

This module provides visualization tools for BigQuery data,
including charts, graphs, and dashboards.
"""

from typing import Dict, List, Any, Optional, Union, Tuple
import logging
import json
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from io import BytesIO
import base64

logger = logging.getLogger("intelliflow.integrations.google_cloud.bigquery.visualizer")

class BigQueryVisualizer:
    """Visualizer for BigQuery data."""
    
    def __init__(self, theme: str = "default"):
        """
        Initialize BigQuery visualizer.
        
        Args:
            theme: Visualization theme
        """
        self.theme = theme
        
        # Set up matplotlib and seaborn
        if theme == "dark":
            plt.style.use("dark_background")
            sns.set_style("darkgrid")
        else:
            plt.style.use("default")
            sns.set_style("whitegrid")
            
    def create_bar_chart(self, 
                        data: Union[pd.DataFrame, Dict[str, Any]],
                        x_column: str,
                        y_column: str,
                        title: Optional[str] = None,
                        x_label: Optional[str] = None,
                        y_label: Optional[str] = None,
                        color: Optional[str] = None,
                        figsize: Tuple[int, int] = (10, 6),
                        orientation: str = "vertical") -> Dict[str, Any]:
        """
        Create a bar chart from BigQuery data.
        
        Args:
            data: DataFrame or query results
            x_column: Column for x-axis
            y_column: Column for y-axis
            title: Chart title
            x_label: X-axis label
            y_label: Y-axis label
            color: Bar color
            figsize: Figure size (width, height)
            orientation: Bar orientation ("vertical" or "horizontal")
            
        Returns:
            Chart data including base64-encoded image
        """
        # Convert to DataFrame if needed
        df = self._ensure_dataframe(data)
        
        # Create figure
        plt.figure(figsize=figsize)
        
        # Create bar chart
        if orientation == "horizontal":
            ax = sns.barplot(x=y_column, y=x_column, data=df, color=color)
        else:
            ax = sns.barplot(x=x_column, y=y_column, data=df, color=color)
            
        # Set labels
        if title:
            plt.title(title)
        if x_label:
            plt.xlabel(x_label)
        if y_label:
            plt.ylabel(y_label)
            
        # Rotate x-axis labels if needed
        if orientation == "vertical" and len(df) > 5:
            plt.xticks(rotation=45, ha="right")
            
        plt.tight_layout()
        
        # Convert to base64
        img_data = self._fig_to_base64(plt.gcf())
        plt.close()
        
        return {
            "type": "bar_chart",
            "orientation": orientation,
            "data": df.to_dict(orient="records"),
            "x_column": x_column,
            "y_column": y_column,
            "title": title,
            "image": img_data
        }
        
    def create_line_chart(self, 
                         data: Union[pd.DataFrame, Dict[str, Any]],
                         x_column: str,
                         y_columns: Union[str, List[str]],
                         title: Optional[str] = None,
                         x_label: Optional[str] = None,
                         y_label: Optional[str] = None,
                         figsize: Tuple[int, int] = (10, 6)) -> Dict[str, Any]:
        """
        Create a line chart from BigQuery data.
        
        Args:
            data: DataFrame or query results
            x_column: Column for x-axis
            y_columns: Column(s) for y-axis
            title: Chart title
            x_label: X-axis label
            y_label: Y-axis label
            figsize: Figure size (width, height)
            
        Returns:
            Chart data including base64-encoded image
        """
        # Convert to DataFrame if needed
        df = self._ensure_dataframe(data)
        
        # Convert y_columns to list if needed
        if isinstance(y_columns, str):
            y_columns = [y_columns]
            
        # Create figure
        plt.figure(figsize=figsize)
        
        # Create line chart
        for column in y_columns:
            plt.plot(df[x_column], df[column], marker='o', label=column)
            
        # Set labels
        if title:
            plt.title(title)
        if x_label:
            plt.xlabel(x_label)
        if y_label:
            plt.ylabel(y_label)
            
        # Add legend if multiple columns
        if len(y_columns) > 1:
            plt.legend()
            
        # Rotate x-axis labels if needed
        if len(df) > 5:
            plt.xticks(rotation=45, ha="right")
            
        plt.tight_layout()
        
        # Convert to base64
        img_data = self._fig_to_base64(plt.gcf())
        plt.close()
        
        return {
            "type": "line_chart",
            "data": df.to_dict(orient="records"),
            "x_column": x_column,
            "y_columns": y_columns,
            "title": title,
            "image": img_data
        }
        
    def create_pie_chart(self, 
                        data: Union[pd.DataFrame, Dict[str, Any]],
                        label_column: str,
                        value_column: str,
                        title: Optional[str] = None,
                        figsize: Tuple[int, int] = (8, 8)) -> Dict[str, Any]:
        """
        Create a pie chart from BigQuery data.
        
        Args:
            data: DataFrame or query results
            label_column: Column for slice labels
            value_column: Column for slice values
            title: Chart title
            figsize: Figure size (width, height)
            
        Returns:
            Chart data including base64-encoded image
        """
        # Convert to DataFrame if needed
        df = self._ensure_dataframe(data)
        
        # Create figure
        plt.figure(figsize=figsize)
        
        # Create pie chart
        plt.pie(df[value_column], labels=df[label_column], autopct='%1.1f%%', startangle=90)
        plt.axis('equal')  # Equal aspect ratio ensures that pie is drawn as a circle
        
        # Set title
        if title:
            plt.title(title)
            
        plt.tight_layout()
        
        # Convert to base64
        img_data = self._fig_to_base64(plt.gcf())
        plt.close()
        
        return {
            "type": "pie_chart",
            "data": df.to_dict(orient="records"),
            "label_column": label_column,
            "value_column": value_column,
            "title": title,
            "image": img_data
        }
        
    def create_scatter_plot(self, 
                           data: Union[pd.DataFrame, Dict[str, Any]],
                           x_column: str,
                           y_column: str,
                           color_column: Optional[str] = None,
                           size_column: Optional[str] = None,
                           title: Optional[str] = None,
                           x_label: Optional[str] = None,
                           y_label: Optional[str] = None,
                           figsize: Tuple[int, int] = (10, 6)) -> Dict[str, Any]:
        """
        Create a scatter plot from BigQuery data.
        
        Args:
            data: DataFrame or query results
            x_column: Column for x-axis
            y_column: Column for y-axis
            color_column: Optional column for point colors
            size_column: Optional column for point sizes
            title: Chart title
            x_label: X-axis label
            y_label: Y-axis label
            figsize: Figure size (width, height)
            
        Returns:
            Chart data including base64-encoded image
        """
        # Convert to DataFrame if needed
        df = self._ensure_dataframe(data)
        
        # Create figure
        plt.figure(figsize=figsize)
        
        # Create scatter plot
        if color_column and size_column:
            scatter = plt.scatter(
                df[x_column], 
                df[y_column], 
                c=df[color_column], 
                s=df[size_column],
                alpha=0.7,
                cmap='viridis'
            )
            plt.colorbar(scatter, label=color_column)
        elif color_column:
            scatter = plt.scatter(
                df[x_column], 
                df[y_column], 
                c=df[color_column],
                alpha=0.7,
                cmap='viridis'
            )
            plt.colorbar(scatter, label=color_column)
        elif size_column:
            plt.scatter(
                df[x_column], 
                df[y_column], 
                s=df[size_column],
                alpha=0.7
            )
        else:
            plt.scatter(
                df[x_column], 
                df[y_column],
                alpha=0.7
            )
            
        # Set labels
        if title:
            plt.title(title)
        if x_label:
            plt.xlabel(x_label)
        if y_label:
            plt.ylabel(y_label)
            
        plt.tight_layout()
        
        # Convert to base64
        img_data = self._fig_to_base64(plt.gcf())
        plt.close()
        
        return {
            "type": "scatter_plot",
            "data": df.to_dict(orient="records"),
            "x_column": x_column,
            "y_column": y_column,
            "color_column": color_column,
            "size_column": size_column,
            "title": title,
            "image": img_data
        }
        
    def create_heatmap(self, 
                      data: Union[pd.DataFrame, Dict[str, Any]],
                      x_column: str,
                      y_column: str,
                      value_column: str,
                      title: Optional[str] = None,
                      x_label: Optional[str] = None,
                      y_label: Optional[str] = None,
                      figsize: Tuple[int, int] = (10, 8)) -> Dict[str, Any]:
        """
        Create a heatmap from BigQuery data.
        
        Args:
            data: DataFrame or query results
            x_column: Column for x-axis
            y_column: Column for y-axis
            value_column: Column for cell values
            title: Chart title
            x_label: X-axis label
            y_label: Y-axis label
            figsize: Figure size (width, height)
            
        Returns:
            Chart data including base64-encoded image
        """
        # Convert to DataFrame if needed
        df = self._ensure_dataframe(data)
        
        # Pivot data for heatmap
        pivot_df = df.pivot(index=y_column, columns=x_column, values=value_column)
        
        # Create figure
        plt.figure(figsize=figsize)
        
        # Create heatmap
        sns.heatmap(pivot_df, annot=True, cmap="YlGnBu", fmt=".2f")
        
        # Set labels
        if title:
            plt.title(title)
        if x_label:
            plt.xlabel(x_label)
        if y_label:
            plt.ylabel(y_label)
            
        plt.tight_layout()
        
        # Convert to base64
        img_data = self._fig_to_base64(plt.gcf())
        plt.close()
        
        return {
            "type": "heatmap",
            "data": df.to_dict(orient="records"),
            "pivot_data": pivot_df.to_dict(orient="split"),
            "x_column": x_column,
            "y_column": y_column,
            "value_column": value_column,
            "title": title,
            "image": img_data
        }
        
    def create_histogram(self, 
                        data: Union[pd.DataFrame, Dict[str, Any]],
                        column: str,
                        bins: int = 10,
                        title: Optional[str] = None,
                        x_label: Optional[str] = None,
                        y_label: Optional[str] = None,
                        color: Optional[str] = None,
                        figsize: Tuple[int, int] = (10, 6)) -> Dict[str, Any]:
        """
        Create a histogram from BigQuery data.
        
        Args:
            data: DataFrame or query results
            column: Column to plot
            bins: Number of bins
            title: Chart title
            x_label: X-axis label
            y_label: Y-axis label
            color: Bar color
            figsize: Figure size (width, height)
            
        Returns:
            Chart data including base64-encoded image
        """
        # Convert to DataFrame if needed
        df = self._ensure_dataframe(data)
        
        # Create figure
        plt.figure(figsize=figsize)
        
        # Create histogram
        sns.histplot(df[column], bins=bins, kde=True, color=color)
        
        # Set labels
        if title:
            plt.title(title)
        if x_label:
            plt.xlabel(x_label)
        else:
            plt.xlabel(column)
        if y_label:
            plt.ylabel(y_label)
        else:
            plt.ylabel("Count")
            
        plt.tight_layout()
        
        # Convert to base64
        img_data = self._fig_to_base64(plt.gcf())
        plt.close()
        
        # Calculate histogram data
        hist, bin_edges = np.histogram(df[column].dropna(), bins=bins)
        hist_data = [{"bin_start": bin_edges[i], "bin_end": bin_edges[i+1], "count": hist[i]} for i in range(len(hist))]
        
        return {
            "type": "histogram",
            "data": df[column].to_dict(),
            "histogram_data": hist_data,
            "column": column,
            "bins": bins,
            "title": title,
            "image": img_data
        }
        
    def create_box_plot(self, 
                       data: Union[pd.DataFrame, Dict[str, Any]],
                       y_column: str,
                       x_column: Optional[str] = None,
                       title: Optional[str] = None,
                       x_label: Optional[str] = None,
                       y_label: Optional[str] = None,
                       figsize: Tuple[int, int] = (10, 6)) -> Dict[str, Any]:
        """
        Create a box plot from BigQuery data.
        
        Args:
            data: DataFrame or query results
            y_column: Column for values
            x_column: Optional column for categories
            title: Chart title
            x_label: X-axis label
            y_label: Y-axis label
            figsize: Figure size (width, height)
            
        Returns:
            Chart data including base64-encoded image
        """
        # Convert to DataFrame if needed
        df = self._ensure_dataframe(data)
        
        # Create figure
        plt.figure(figsize=figsize)
        
        # Create box plot
        if x_column:
            sns.boxplot(x=x_column, y=y_column, data=df)
        else:
            sns.boxplot(y=y_column, data=df)
            
        # Set labels
        if title:
            plt.title(title)
        if x_label and x_column:
            plt.xlabel(x_label)
        if y_label:
            plt.ylabel(y_label)
        else:
            plt.ylabel(y_column)
            
        # Rotate x-axis labels if needed
        if x_column and len(df[x_column].unique()) > 5:
            plt.xticks(rotation=45, ha="right")
            
        plt.tight_layout()
        
        # Convert to base64
        img_data = self._fig_to_base64(plt.gcf())
        plt.close()
        
        return {
            "type": "box_plot",
            "data": df.to_dict(orient="records"),
            "y_column": y_column,
            "x_column": x_column,
            "title": title,
            "image": img_data
        }
        
    def create_correlation_matrix(self, 
                                 data: Union[pd.DataFrame, Dict[str, Any]],
                                 columns: Optional[List[str]] = None,
                                 title: Optional[str] = None,
                                 figsize: Tuple[int, int] = (10, 8)) -> Dict[str, Any]:
        """
        Create a correlation matrix from BigQuery data.
        
        Args:
            data: DataFrame or query results
            columns: Columns to include (all numeric columns if None)
            title: Chart title
            figsize: Figure size (width, height)
            
        Returns:
            Chart data including base64-encoded image
        """
        # Convert to DataFrame if needed
        df = self._ensure_dataframe(data)
        
        # Select numeric columns
        if columns:
            numeric_df = df[columns].select_dtypes(include=['number'])
        else:
            numeric_df = df.select_dtypes(include=['number'])
            
        # Calculate correlation matrix
        corr_matrix = numeric_df.corr()
        
        # Create figure
        plt.figure(figsize=figsize)
        
        # Create heatmap
        sns.heatmap(corr_matrix, annot=True, cmap="coolwarm", vmin=-1, vmax=1, center=0, fmt=".2f")
        
        # Set title
        if title:
            plt.title(title)
            
        plt.tight_layout()
        
        # Convert to base64
        img_data = self._fig_to_base64(plt.gcf())
        plt.close()
        
        return {
            "type": "correlation_matrix",
            "data": corr_matrix.to_dict(),
            "columns": list(corr_matrix.columns),
            "title": title,
            "image": img_data
        }
        
    def create_dashboard(self, 
                        charts: List[Dict[str, Any]],
                        title: str,
                        description: Optional[str] = None) -> Dict[str, Any]:
        """
        Create a dashboard from multiple charts.
        
        Args:
            charts: List of chart data
            title: Dashboard title
            description: Dashboard description
            
        Returns:
            Dashboard data
        """
        return {
            "type": "dashboard",
            "title": title,
            "description": description,
            "charts": charts,
            "created_at": datetime.now().isoformat()
        }
        
    def _ensure_dataframe(self, data: Union[pd.DataFrame, Dict[str, Any]]) -> pd.DataFrame:
        """
        Ensure data is a pandas DataFrame.
        
        Args:
            data: DataFrame or query results
            
        Returns:
            Pandas DataFrame
        """
        if isinstance(data, pd.DataFrame):
            return data
            
        # Check if data is query results
        if isinstance(data, dict) and "results" in data:
            return pd.DataFrame(data["results"])
            
        # Try to convert to DataFrame
        return pd.DataFrame(data)
        
    def _fig_to_base64(self, fig) -> str:
        """
        Convert matplotlib figure to base64-encoded string.
        
        Args:
            fig: Matplotlib figure
            
        Returns:
            Base64-encoded string
        """
        buf = BytesIO()
        fig.savefig(buf, format="png", dpi=100)
        buf.seek(0)
        img_data = base64.b64encode(buf.read()).decode("utf-8")
        return img_data

