"""
Visualization Specialist Agent implementation.

This agent is responsible for creating visual representations of analytical findings.
"""

import asyncio
from typing import Dict, Any, List, Optional

from common.adk import Agent, Tool, Message
from common.logging.logger import get_logger

logger = get_logger("agent.visualization_specialist")

class ChartGenerationTool(Tool):
    """Tool for generating charts and visualizations."""
    
    def __init__(self):
        super().__init__(name="ChartGenerationTool", description="Generate charts and visualizations from data")
    
    async def execute(self, data: Dict[str, Any], chart_type: str, parameters: Dict[str, Any] = None, **kwargs) -> Dict[str, Any]:
        """
        Execute chart generation.
        
        Args:
            data: Input data to visualize
            chart_type: Type of chart to generate
            parameters: Chart parameters
            
        Returns:
            Chart generation results
        """
        logger.info(f"Generating {chart_type} chart")
        
        # This would use visualization libraries in a real implementation
        # For now, we'll return simulated results
        
        parameters = parameters or {}
        
        # Common chart configuration
        chart_config = {
            "title": parameters.get("title", f"{chart_type.capitalize()} Chart"),
            "width": parameters.get("width", 800),
            "height": parameters.get("height", 500),
            "theme": parameters.get("theme", "light"),
            "color_scheme": parameters.get("color_scheme", "default")
        }
        
        if chart_type == "bar":
            result = {
                "status": "success",
                "chart": {
                    "type": "bar",
                    "config": chart_config,
                    "data": {
                        "labels": ["Category A", "Category B", "Category C"],
                        "values": [120, 150, 200]
                    },
                    "axes": {
                        "x": {"title": parameters.get("x_axis_title", "Categories")},
                        "y": {"title": parameters.get("y_axis_title", "Values")}
                    }
                }
            }
        elif chart_type == "line":
            result = {
                "status": "success",
                "chart": {
                    "type": "line",
                    "config": chart_config,
                    "data": {
                        "labels": ["Jan", "Feb", "Mar", "Apr", "May"],
                        "series": [
                            {"name": "Series 1", "values": [10, 25, 15, 30, 45]},
                            {"name": "Series 2", "values": [20, 15, 25, 35, 25]}
                        ]
                    },
                    "axes": {
                        "x": {"title": parameters.get("x_axis_title", "Month")},
                        "y": {"title": parameters.get("y_axis_title", "Values")}
                    }
                }
            }
        elif chart_type == "pie":
            result = {
                "status": "success",
                "chart": {
                    "type": "pie",
                    "config": chart_config,
                    "data": {
                        "labels": ["Category A", "Category B", "Category C", "Category D"],
                        "values": [30, 25, 20, 25]
                    }
                }
            }
        elif chart_type == "scatter":
            result = {
                "status": "success",
                "chart": {
                    "type": "scatter",
                    "config": chart_config,
                    "data": {
                        "points": [
                            {"x": 10, "y": 20, "size": 5, "category": "A"},
                            {"x": 15, "y": 25, "size": 8, "category": "A"},
                            {"x": 20, "y": 10, "size": 4, "category": "B"},
                            {"x": 25, "y": 30, "size": 6, "category": "B"},
                            {"x": 30, "y": 15, "size": 9, "category": "C"}
                        ]
                    },
                    "axes": {
                        "x": {"title": parameters.get("x_axis_title", "X Value")},
                        "y": {"title": parameters.get("y_axis_title", "Y Value")}
                    }
                }
            }
        elif chart_type == "heatmap":
            result = {
                "status": "success",
                "chart": {
                    "type": "heatmap",
                    "config": chart_config,
                    "data": {
                        "x_labels": ["A", "B", "C", "D", "E"],
                        "y_labels": ["1", "2", "3", "4"],
                        "values": [
                            [10, 20, 30, 40, 50],
                            [15, 25, 35, 45, 55],
                            [5, 15, 25, 35, 45],
                            [20, 30, 40, 50, 60]
                        ]
                    },
                    "axes": {
                        "x": {"title": parameters.get("x_axis_title", "X Axis")},
                        "y": {"title": parameters.get("y_axis_title", "Y Axis")}
                    }
                }
            }
        else:
            result = {
                "status": "error",
                "message": f"Unsupported chart type: {chart_type}"
            }
        
        return result


class DashboardCreationTool(Tool):
    """Tool for creating interactive dashboards."""
    
    def __init__(self):
        super().__init__(name="DashboardCreationTool", description="Create interactive dashboards from multiple visualizations")
    
    async def execute(self, charts: List[Dict[str, Any]], layout: Dict[str, Any] = None, parameters: Dict[str, Any] = None, **kwargs) -> Dict[str, Any]:
        """
        Execute dashboard creation.
        
        Args:
            charts: List of charts to include in the dashboard
            layout: Dashboard layout configuration
            parameters: Dashboard parameters
            
        Returns:
            Dashboard creation results
        """
        logger.info(f"Creating dashboard with {len(charts)} charts")
        
        # This would use dashboard libraries in a real implementation
        # For now, we'll return simulated results
        
        parameters = parameters or {}
        layout = layout or {"type": "grid", "columns": 2}
        
        result = {
            "status": "success",
            "dashboard": {
                "title": parameters.get("title", "Analysis Dashboard"),
                "description": parameters.get("description", "Visualization of analysis results"),
                "layout": layout,
                "charts": charts,
                "theme": parameters.get("theme", "light"),
                "interactive": parameters.get("interactive", True),
                "filters": parameters.get("filters", [
                    {"name": "date_range", "type": "date_range", "default": "last_30_days"},
                    {"name": "category", "type": "multi_select", "options": ["A", "B", "C"]}
                ])
            }
        }
        
        return result


class DataStudioConnectorTool(Tool):
    """Tool for connecting to Google Data Studio."""
    
    def __init__(self):
        super().__init__(name="DataStudioConnectorTool", description="Connect to Google Data Studio for enhanced visualizations")
    
    async def execute(self, data_source: Dict[str, Any], report_config: Dict[str, Any] = None, **kwargs) -> Dict[str, Any]:
        """
        Execute Data Studio connection and report creation.
        
        Args:
            data_source: Data source configuration
            report_config: Report configuration
            
        Returns:
            Data Studio connection results
        """
        logger.info(f"Connecting to Data Studio with data source: {data_source.get('type')}")
        
        # This would use Google Data Studio API in a real implementation
        # For now, we'll return simulated results
        
        report_config = report_config or {}
        
        result = {
            "status": "success",
            "data_studio": {
                "connection_id": "ds_conn_123456",
                "data_source": {
                    "type": data_source.get("type"),
                    "name": data_source.get("name", "IntelliFlow Data Source"),
                    "fields": data_source.get("fields", [
                        {"name": "dimension1", "type": "STRING"},
                        {"name": "dimension2", "type": "STRING"},
                        {"name": "metric1", "type": "NUMBER"},
                        {"name": "metric2", "type": "NUMBER"}
                    ])
                },
                "report": {
                    "id": "ds_report_789012",
                    "name": report_config.get("name", "IntelliFlow Analysis Report"),
                    "url": "https://datastudio.google.com/reporting/ds_report_789012",
                    "pages": report_config.get("pages", 1),
                    "charts": report_config.get("charts", 5)
                }
            }
        }
        
        return result


class VisualizationSpecialistAgent(Agent):
    """Agent responsible for creating visual representations of analytical findings."""
    
    def __init__(self, config: Dict[str, Any]):
        """
        Initialize the Visualization Specialist agent.
        
        Args:
            config: Agent configuration
        """
        super().__init__(name="VisualizationSpecialistAgent")
        self.config = config
        
        # Register tools
        self.register_tools([
            ChartGenerationTool(),
            DashboardCreationTool(),
            DataStudioConnectorTool()
        ])
        
        # Register message handlers
        self.register_message_handler("CREATE_CHART", self.handle_create_chart)
        self.register_message_handler("CREATE_DASHBOARD", self.handle_create_dashboard)
        self.register_message_handler("CONNECT_DATA_STUDIO", self.handle_connect_data_studio)
        self.register_message_handler("CREATE_VISUALIZATIONS", self.handle_create_visualizations)
        
        logger.info("VisualizationSpecialistAgent initialized")
    
    async def handle_create_chart(self, message: Message) -> Message:
        """
        Handle chart creation requests.
        
        Args:
            message: Request message
            
        Returns:
            Response message with chart creation results
        """
        logger.info(f"Handling CREATE_CHART request: {message.content}")
        
        data = message.content.get("data", {})
        chart_type = message.content.get("chart_type")
        parameters = message.content.get("parameters", {})
        
        result = await self.execute_tool(
            "ChartGenerationTool", 
            data=data, 
            chart_type=chart_type, 
            parameters=parameters
        )
        
        return Message(
            sender=self.name,
            intent="CHART_CREATED",
            content=result,
            correlation_id=message.message_id,
            reply_to=message.sender
        )
    
    async def handle_create_dashboard(self, message: Message) -> Message:
        """
        Handle dashboard creation requests.
        
        Args:
            message: Request message
            
        Returns:
            Response message with dashboard creation results
        """
        logger.info(f"Handling CREATE_DASHBOARD request: {message.content}")
        
        charts = message.content.get("charts", [])
        layout = message.content.get("layout")
        parameters = message.content.get("parameters", {})
        
        result = await self.execute_tool(
            "DashboardCreationTool", 
            charts=charts, 
            layout=layout, 
            parameters=parameters
        )
        
        return Message(
            sender=self.name,
            intent="DASHBOARD_CREATED",
            content=result,
            correlation_id=message.message_id,
            reply_to=message.sender
        )
    
    async def handle_connect_data_studio(self, message: Message) -> Message:
        """
        Handle Data Studio connection requests.
        
        Args:
            message: Request message
            
        Returns:
            Response message with Data Studio connection results
        """
        logger.info(f"Handling CONNECT_DATA_STUDIO request: {message.content}")
        
        data_source = message.content.get("data_source", {})
        report_config = message.content.get("report_config", {})
        
        result = await self.execute_tool(
            "DataStudioConnectorTool", 
            data_source=data_source, 
            report_config=report_config
        )
        
        return Message(
            sender=self.name,
            intent="DATA_STUDIO_CONNECTED",
            content=result,
            correlation_id=message.message_id,
            reply_to=message.sender
        )
    
    async def handle_create_visualizations(self, message: Message) -> Message:
        """
        Handle comprehensive visualization creation requests.
        
        Args:
            message: Request message
            
        Returns:
            Response message with visualization results
        """
        logger.info(f"Handling CREATE_VISUALIZATIONS request: {message.content}")
        
        data = message.content.get("data", {})
        insights = message.content.get("insights", [])
        visualization_config = message.content.get("visualization_config", {})
        
        # Generate appropriate charts based on insights
        charts = []
        
        for insight in insights:
            insight_type = insight.get("type")
            chart = await self._create_chart_for_insight(data, insight, visualization_config)
            if chart.get("status") == "success":
                charts.append(chart.get("chart", {}))
        
        # Create additional charts based on data characteristics
        if "summary" in data:
            summary_chart = await self.execute_tool(
                "ChartGenerationTool",
                data=data,
                chart_type="bar",
                parameters={"title": "Data Summary", "x_axis_title": "Metric", "y_axis_title": "Value"}
            )
            if summary_chart.get("status") == "success":
                charts.append(summary_chart.get("chart", {}))
        
        if "correlations" in data:
            correlation_chart = await self.execute_tool(
                "ChartGenerationTool",
                data=data,
                chart_type="heatmap",
                parameters={"title": "Correlation Matrix", "x_axis_title": "Variables", "y_axis_title": "Variables"}
            )
            if correlation_chart.get("status") == "success":
                charts.append(correlation_chart.get("chart", {}))
        
        # Create dashboard with all charts
        dashboard_result = await self.execute_tool(
            "DashboardCreationTool",
            charts=charts,
            layout=visualization_config.get("layout", {"type": "grid", "columns": 2}),
            parameters={"title": "Analysis Dashboard", "description": "Visualization of analysis insights"}
        )
        
        # Optionally connect to Data Studio if configured
        data_studio_result = None
        if visualization_config.get("use_data_studio", False):
            data_studio_result = await self.execute_tool(
                "DataStudioConnectorTool",
                data_source={"type": "bigquery", "name": "Analysis Results"},
                report_config={"name": "IntelliFlow Analysis Report"}
            )
        
        # Combine all results
        result = {
            "status": "success",
            "charts": charts,
            "dashboard": dashboard_result.get("dashboard") if dashboard_result and dashboard_result.get("status") == "success" else None,
            "data_studio": data_studio_result.get("data_studio") if data_studio_result and data_studio_result.get("status") == "success" else None
        }
        
        return Message(
            sender=self.name,
            intent="VISUALIZATIONS_CREATED",
            content=result,
            correlation_id=message.message_id,
            reply_to=message.sender
        )
    
    async def _create_chart_for_insight(self, data: Dict[str, Any], insight: Dict[str, Any], config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create an appropriate chart for a specific insight.
        
        Args:
            data: Data to visualize
            insight: Insight to visualize
            config: Visualization configuration
            
        Returns:
            Chart generation result
        """
        insight_type = insight.get("type")
        description = insight.get("description", "")
        
        if insight_type == "descriptive_summary":
            # Create box plot for descriptive statistics showing distribution
            return await self.execute_tool(
                "ChartGenerationTool",
                data=data,
                chart_type="box",
                parameters={
                    "title": "Data Distribution Analysis",
                    "x_axis_title": "Groups",
                    "y_axis_title": "Values",
                    "show_outliers": True,
                    "description": description
                }
            )
        elif insight_type == "correlation_insight":
            # Create correlation heatmap
            return await self.execute_tool(
                "ChartGenerationTool",
                data=data,
                chart_type="heatmap",
                parameters={
                    "title": "Variable Correlation Matrix",
                    "x_axis_title": "Variables",
                    "y_axis_title": "Variables",
                    "color_scheme": "correlation",
                    "description": description
                }
            )
        elif insight_type == "clustering_insight":
            # Create scatter plot for clusters
            return await self.execute_tool(
                "ChartGenerationTool",
                data=data,
                chart_type="scatter",
                parameters={
                    "title": "Data Segmentation Clusters",
                    "x_axis_title": "Component 1",
                    "y_axis_title": "Component 2",
                    "color_by": "cluster",
                    "description": description
                }
            )
        elif insight_type == "predictive_insight":
            # Create regression plot
            return await self.execute_tool(
                "ChartGenerationTool",
                data=data,
                chart_type="line",
                parameters={
                    "title": "Predictive Model Performance",
                    "x_axis_title": "Actual Values",
                    "y_axis_title": "Predicted Values",
                    "show_trend_line": True,
                    "description": description
                }
            )
        elif insight_type == "statistical":
            if "distribution" in description.lower():
                return await self.execute_tool(
                    "ChartGenerationTool",
                    data=data,
                    chart_type="line",
                    parameters={"title": description, "x_axis_title": "Value", "y_axis_title": "Frequency"}
                )
            else:
                return await self.execute_tool(
                    "ChartGenerationTool",
                    data=data,
                    chart_type="bar",
                    parameters={"title": description, "x_axis_title": "Metric", "y_axis_title": "Value"}
                )
        
        elif insight_type == "correlation":
            return await self.execute_tool(
                "ChartGenerationTool",
                data=data,
                chart_type="scatter",
                parameters={"title": description, "x_axis_title": "Variable 1", "y_axis_title": "Variable 2"}
            )
        
        elif insight_type == "clustering":
            return await self.execute_tool(
                "ChartGenerationTool",
                data=data,
                chart_type="scatter",
                parameters={"title": description, "x_axis_title": "Feature 1", "y_axis_title": "Feature 2"}
            )
        
        elif insight_type == "sentiment":
            return await self.execute_tool(
                "ChartGenerationTool",
                data=data,
                chart_type="pie",
                parameters={"title": description}
            )
        
        elif insight_type == "topics":
            return await self.execute_tool(
                "ChartGenerationTool",
                data=data,
                chart_type="bar",
                parameters={"title": description, "x_axis_title": "Topic", "y_axis_title": "Weight"}
            )
        
        else:
            # Default chart for other insight types
            return await self.execute_tool(
                "ChartGenerationTool",
                data=data,
                chart_type="bar",
                parameters={"title": description, "x_axis_title": "Category", "y_axis_title": "Value"}
            )
