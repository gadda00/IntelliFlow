"""
Visualizer classes for the monitoring module.

This module provides classes for visualizing agent activities,
including network graphs and metrics dashboards.
"""

from typing import Dict, List, Any, Optional, Set, Tuple
import json
import logging
import time
from abc import ABC, abstractmethod

from .monitor import AgentMonitor, EventType, Event
from .metrics import Metrics

logger = logging.getLogger("enhanced_adk.monitoring.visualizer")

class Visualizer(ABC):
    """Abstract base class for visualizers."""
    
    @abstractmethod
    def generate(self) -> Dict[str, Any]:
        """
        Generate visualization data.
        
        Returns:
            Visualization data
        """
        pass


class NetworkVisualizer(Visualizer):
    """Class for visualizing agent networks."""
    
    def __init__(self, monitor: AgentMonitor):
        """
        Initialize network visualizer.
        
        Args:
            monitor: Agent monitor
        """
        self.monitor = monitor
        
    def generate(self) -> Dict[str, Any]:
        """
        Generate network visualization data.
        
        Returns:
            Network visualization data
        """
        # Get all agents
        agents = list(self.monitor.agents)
        
        # Create nodes
        nodes = []
        for agent_id in agents:
            # Get agent metrics
            metrics = self.monitor.get_agent_metrics(agent_id)
            
            # Create node
            node = {
                "id": agent_id,
                "label": agent_id,
                "metrics": metrics
            }
            nodes.append(node)
            
        # Get message events
        message_events = self.monitor.get_events(
            event_type=EventType.MESSAGE_SENT
        )
        
        # Create edges
        edges = []
        edge_counts = {}
        
        for event in message_events:
            sender = event.agent_id
            recipient = event.data.get("recipient")
            
            if not recipient or recipient not in agents:
                continue
                
            # Create edge key
            edge_key = f"{sender}:{recipient}"
            
            # Update edge count
            edge_counts[edge_key] = edge_counts.get(edge_key, 0) + 1
            
        # Create edges from counts
        for edge_key, count in edge_counts.items():
            sender, recipient = edge_key.split(":")
            edge = {
                "source": sender,
                "target": recipient,
                "value": count
            }
            edges.append(edge)
            
        return {
            "nodes": nodes,
            "edges": edges
        }


class MetricsVisualizer(Visualizer):
    """Class for visualizing metrics."""
    
    def __init__(self, metrics: Metrics):
        """
        Initialize metrics visualizer.
        
        Args:
            metrics: Metrics store
        """
        self.metrics = metrics
        
    def generate(self) -> Dict[str, Any]:
        """
        Generate metrics visualization data.
        
        Returns:
            Metrics visualization data
        """
        # Get all metric names
        metric_names = set()
        for metric in self.metrics.metrics:
            metric_names.add(metric.name)
            
        # Generate time series for each metric name
        time_series = {}
        for name in metric_names:
            # Get metrics for this name
            metrics = self.metrics.get(name=name)
            
            # Group by tags
            grouped_metrics = {}
            for metric in metrics:
                # Create tag key
                tag_key = json.dumps(metric.tags, sort_keys=True)
                
                if tag_key not in grouped_metrics:
                    grouped_metrics[tag_key] = []
                    
                grouped_metrics[tag_key].append({
                    "timestamp": metric.timestamp,
                    "value": metric.value
                })
                
            # Sort each group by timestamp
            for tag_key, group in grouped_metrics.items():
                group.sort(key=lambda m: m["timestamp"])
                
            time_series[name] = {
                "groups": [
                    {
                        "tags": json.loads(tag_key),
                        "data": group
                    }
                    for tag_key, group in grouped_metrics.items()
                ]
            }
            
        return {
            "time_series": time_series
        }


class DashboardVisualizer(Visualizer):
    """Class for generating a complete monitoring dashboard."""
    
    def __init__(self, monitor: AgentMonitor, metrics: Metrics):
        """
        Initialize dashboard visualizer.
        
        Args:
            monitor: Agent monitor
            metrics: Metrics store
        """
        self.monitor = monitor
        self.metrics = metrics
        self.network_visualizer = NetworkVisualizer(monitor)
        self.metrics_visualizer = MetricsVisualizer(metrics)
        
    def generate(self) -> Dict[str, Any]:
        """
        Generate dashboard visualization data.
        
        Returns:
            Dashboard visualization data
        """
        # Get system metrics
        system_metrics = self.monitor.get_system_metrics()
        
        # Get network visualization
        network = self.network_visualizer.generate()
        
        # Get metrics visualization
        metrics_viz = self.metrics_visualizer.generate()
        
        # Get recent events
        recent_events = [
            {
                "id": event.id,
                "agent_id": event.agent_id,
                "event_type": event.event_type.value,
                "timestamp": event.timestamp,
                "data": event.data
            }
            for event in self.monitor.get_events(limit=100)
        ]
        
        return {
            "timestamp": time.time(),
            "system_metrics": system_metrics,
            "network": network,
            "metrics": metrics_viz,
            "recent_events": recent_events
        }

