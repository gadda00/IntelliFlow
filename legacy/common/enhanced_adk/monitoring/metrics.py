"""
Metrics classes for the monitoring module.

This module provides classes for collecting and analyzing metrics
from agent activities.
"""

from typing import Dict, List, Any, Optional, Callable, Set, Union
import time
import asyncio
import logging
from dataclasses import dataclass

from .monitor import AgentMonitor, EventType, Event, EventListener

logger = logging.getLogger("enhanced_adk.monitoring.metrics")

@dataclass
class Metric:
    """Class representing a metric."""
    name: str
    value: Union[int, float, str, bool]
    timestamp: float
    tags: Dict[str, str]


class Metrics:
    """Class for storing and analyzing metrics."""
    
    def __init__(self, max_metrics: int = 10000):
        """
        Initialize metrics store.
        
        Args:
            max_metrics: Maximum number of metrics to store
        """
        self.metrics: List[Metric] = []
        self.max_metrics = max_metrics
        
    def add(self, 
           name: str, 
           value: Union[int, float, str, bool],
           tags: Optional[Dict[str, str]] = None) -> Metric:
        """
        Add a metric.
        
        Args:
            name: Metric name
            value: Metric value
            tags: Optional tags
            
        Returns:
            Created metric
        """
        metric = Metric(
            name=name,
            value=value,
            timestamp=time.time(),
            tags=tags or {}
        )
        
        self.metrics.append(metric)
        
        # Trim metrics list if needed
        if len(self.metrics) > self.max_metrics:
            self.metrics = self.metrics[-self.max_metrics:]
            
        return metric
        
    def get(self, 
           name: Optional[str] = None,
           tags: Optional[Dict[str, str]] = None,
           start_time: Optional[float] = None,
           end_time: Optional[float] = None) -> List[Metric]:
        """
        Get metrics matching criteria.
        
        Args:
            name: Optional metric name filter
            tags: Optional tags filter
            start_time: Optional start time filter
            end_time: Optional end time filter
            
        Returns:
            List of matching metrics
        """
        # Filter metrics
        filtered_metrics = self.metrics
        
        if name is not None:
            filtered_metrics = [m for m in filtered_metrics if m.name == name]
            
        if tags is not None:
            filtered_metrics = [
                m for m in filtered_metrics
                if all(m.tags.get(k) == v for k, v in tags.items())
            ]
            
        if start_time is not None:
            filtered_metrics = [m for m in filtered_metrics if m.timestamp >= start_time]
            
        if end_time is not None:
            filtered_metrics = [m for m in filtered_metrics if m.timestamp <= end_time]
            
        return filtered_metrics
        
    def aggregate(self, 
                 name: str,
                 tags: Optional[Dict[str, str]] = None,
                 start_time: Optional[float] = None,
                 end_time: Optional[float] = None,
                 aggregation: str = "avg") -> Optional[float]:
        """
        Aggregate metrics.
        
        Args:
            name: Metric name
            tags: Optional tags filter
            start_time: Optional start time filter
            end_time: Optional end time filter
            aggregation: Aggregation function (avg, sum, min, max, count)
            
        Returns:
            Aggregated value or None if no metrics match
        """
        # Get matching metrics
        metrics = self.get(name, tags, start_time, end_time)
        
        if not metrics:
            return None
            
        # Filter numeric values
        values = [m.value for m in metrics if isinstance(m.value, (int, float))]
        
        if not values:
            return None
            
        # Apply aggregation
        if aggregation == "avg":
            return sum(values) / len(values)
        elif aggregation == "sum":
            return sum(values)
        elif aggregation == "min":
            return min(values)
        elif aggregation == "max":
            return max(values)
        elif aggregation == "count":
            return len(values)
        else:
            raise ValueError(f"Unknown aggregation: {aggregation}")
            
    def clear(self) -> None:
        """Clear all metrics."""
        self.metrics = []
        logger.info("Cleared all metrics")


class MetricsCollector(EventListener):
    """Class for collecting metrics from events."""
    
    def __init__(self, metrics: Metrics):
        """
        Initialize metrics collector.
        
        Args:
            metrics: Metrics store
        """
        self.metrics = metrics
        
    async def on_event(self, event: Event) -> None:
        """
        Handle an event.
        
        Args:
            event: Event to handle
        """
        # Extract tags
        tags = {
            "agent_id": event.agent_id,
            "event_type": event.event_type.value
        }
        
        # Add event count metric
        self.metrics.add(
            name="event_count",
            value=1,
            tags=tags
        )
        
        # Add specific metrics based on event type
        if event.event_type == EventType.TOOL_EXECUTION_COMPLETED:
            # Add tool execution time metric
            execution_time = event.data.get("execution_time")
            if execution_time is not None:
                self.metrics.add(
                    name="tool_execution_time",
                    value=execution_time,
                    tags={
                        **tags,
                        "tool_name": event.data.get("tool_name", "unknown")
                    }
                )
                
        elif event.event_type == EventType.ERROR:
            # Add error count metric
            self.metrics.add(
                name="error_count",
                value=1,
                tags=tags
            )
            
        elif event.event_type == EventType.MESSAGE_SENT:
            # Add message sent metric
            self.metrics.add(
                name="message_sent",
                value=1,
                tags={
                    **tags,
                    "intent": event.data.get("intent", "unknown"),
                    "recipient": event.data.get("recipient", "unknown")
                }
            )
            
        elif event.event_type == EventType.MESSAGE_RECEIVED:
            # Add message received metric
            self.metrics.add(
                name="message_received",
                value=1,
                tags={
                    **tags,
                    "intent": event.data.get("intent", "unknown")
                }
            )
            
        elif event.event_type == EventType.PLAN_COMPLETED:
            # Add plan completion metric
            self.metrics.add(
                name="plan_completed",
                value=1,
                tags={
                    **tags,
                    "plan_id": event.data.get("plan_id", "unknown"),
                    "goal_id": event.data.get("goal_id", "unknown")
                }
            )
            
        elif event.event_type == EventType.PLAN_FAILED:
            # Add plan failure metric
            self.metrics.add(
                name="plan_failed",
                value=1,
                tags={
                    **tags,
                    "plan_id": event.data.get("plan_id", "unknown"),
                    "goal_id": event.data.get("goal_id", "unknown")
                }
            )

