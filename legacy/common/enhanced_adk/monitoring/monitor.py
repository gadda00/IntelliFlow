"""
Monitor classes for the monitoring module.

This module provides classes for monitoring agent activities,
including event logging and metrics collection.
"""

from typing import Dict, List, Any, Optional, Callable, Set, Union
import time
import uuid
import logging
import asyncio
from enum import Enum
from dataclasses import dataclass

logger = logging.getLogger("enhanced_adk.monitoring")

class EventType(Enum):
    """Enum for event types."""
    AGENT_CREATED = "agent_created"
    AGENT_STARTED = "agent_started"
    AGENT_STOPPED = "agent_stopped"
    TOOL_REGISTERED = "tool_registered"
    TOOL_EXECUTION_STARTED = "tool_execution_started"
    TOOL_EXECUTION_COMPLETED = "tool_execution_completed"
    HANDLER_REGISTERED = "handler_registered"
    MESSAGE_RECEIVED = "message_received"
    MESSAGE_SENT = "message_sent"
    PLAN_CREATED = "plan_created"
    PLAN_STARTED = "plan_started"
    PLAN_COMPLETED = "plan_completed"
    PLAN_FAILED = "plan_failed"
    GOAL_CREATED = "goal_created"
    GOAL_COMPLETED = "goal_completed"
    GOAL_FAILED = "goal_failed"
    ERROR = "error"
    CUSTOM = "custom"


@dataclass
class Event:
    """Class representing a monitoring event."""
    id: str
    agent_id: str
    event_type: EventType
    timestamp: float
    data: Dict[str, Any]


class EventListener:
    """Interface for event listeners."""
    
    async def on_event(self, event: Event) -> None:
        """
        Handle an event.
        
        Args:
            event: Event to handle
        """
        pass


class AgentMonitor:
    """Class for monitoring agent activities."""
    
    def __init__(self):
        """Initialize agent monitor."""
        self.agents: Set[str] = set()
        self.events: List[Event] = []
        self.listeners: List[EventListener] = []
        self.max_events = 1000  # Maximum number of events to keep in memory
        
    def register_agent(self, agent_id: str) -> None:
        """
        Register an agent for monitoring.
        
        Args:
            agent_id: Agent identifier
        """
        self.agents.add(agent_id)
        logger.info(f"Registered agent for monitoring: {agent_id}")
        
    def register_listener(self, listener: EventListener) -> None:
        """
        Register an event listener.
        
        Args:
            listener: Event listener
        """
        self.listeners.append(listener)
        logger.info(f"Registered event listener: {listener.__class__.__name__}")
        
    def log_event(self, 
                 agent_id: str, 
                 event_type: Union[EventType, str], 
                 data: Optional[Dict[str, Any]] = None) -> Event:
        """
        Log an event.
        
        Args:
            agent_id: Agent identifier
            event_type: Event type
            data: Event data
            
        Returns:
            Created event
        """
        # Convert string event type to enum
        if isinstance(event_type, str):
            try:
                event_type = EventType(event_type)
            except ValueError:
                event_type = EventType.CUSTOM
                
        # Create event
        event = Event(
            id=str(uuid.uuid4()),
            agent_id=agent_id,
            event_type=event_type,
            timestamp=time.time(),
            data=data or {}
        )
        
        # Add to events list
        self.events.append(event)
        
        # Trim events list if needed
        if len(self.events) > self.max_events:
            self.events = self.events[-self.max_events:]
            
        # Notify listeners
        for listener in self.listeners:
            asyncio.create_task(listener.on_event(event))
            
        return event
        
    def get_events(self, 
                  agent_id: Optional[str] = None, 
                  event_type: Optional[Union[EventType, str]] = None,
                  start_time: Optional[float] = None,
                  end_time: Optional[float] = None,
                  limit: Optional[int] = None) -> List[Event]:
        """
        Get events matching criteria.
        
        Args:
            agent_id: Optional agent identifier filter
            event_type: Optional event type filter
            start_time: Optional start time filter
            end_time: Optional end time filter
            limit: Optional limit on number of events
            
        Returns:
            List of matching events
        """
        # Convert string event type to enum
        if isinstance(event_type, str):
            try:
                event_type = EventType(event_type)
            except ValueError:
                event_type = None
                
        # Filter events
        filtered_events = self.events
        
        if agent_id is not None:
            filtered_events = [e for e in filtered_events if e.agent_id == agent_id]
            
        if event_type is not None:
            filtered_events = [e for e in filtered_events if e.event_type == event_type]
            
        if start_time is not None:
            filtered_events = [e for e in filtered_events if e.timestamp >= start_time]
            
        if end_time is not None:
            filtered_events = [e for e in filtered_events if e.timestamp <= end_time]
            
        # Sort by timestamp
        filtered_events.sort(key=lambda e: e.timestamp)
        
        # Apply limit
        if limit is not None:
            filtered_events = filtered_events[-limit:]
            
        return filtered_events
        
    def clear_events(self) -> None:
        """Clear all events."""
        self.events = []
        logger.info("Cleared all events")
        
    def get_agent_metrics(self, agent_id: str) -> Dict[str, Any]:
        """
        Get metrics for an agent.
        
        Args:
            agent_id: Agent identifier
            
        Returns:
            Dictionary of metrics
        """
        # Get events for the agent
        agent_events = self.get_events(agent_id=agent_id)
        
        if not agent_events:
            return {}
            
        # Calculate metrics
        metrics = {
            "event_count": len(agent_events),
            "first_event_time": agent_events[0].timestamp,
            "last_event_time": agent_events[-1].timestamp,
        }
        
        # Count events by type
        event_counts = {}
        for event in agent_events:
            event_type = event.event_type.value
            event_counts[event_type] = event_counts.get(event_type, 0) + 1
        metrics["event_counts"] = event_counts
        
        # Calculate tool execution metrics
        tool_executions = [e for e in agent_events if e.event_type == EventType.TOOL_EXECUTION_COMPLETED]
        if tool_executions:
            total_execution_time = sum(
                e.data.get("execution_time", 0) for e in tool_executions
            )
            metrics["tool_execution_count"] = len(tool_executions)
            metrics["total_tool_execution_time"] = total_execution_time
            metrics["avg_tool_execution_time"] = total_execution_time / len(tool_executions)
            
        # Calculate message metrics
        messages_received = [e for e in agent_events if e.event_type == EventType.MESSAGE_RECEIVED]
        messages_sent = [e for e in agent_events if e.event_type == EventType.MESSAGE_SENT]
        metrics["messages_received"] = len(messages_received)
        metrics["messages_sent"] = len(messages_sent)
        
        # Calculate error metrics
        errors = [e for e in agent_events if e.event_type == EventType.ERROR]
        metrics["error_count"] = len(errors)
        
        return metrics
        
    def get_system_metrics(self) -> Dict[str, Any]:
        """
        Get metrics for the entire system.
        
        Returns:
            Dictionary of metrics
        """
        # Calculate metrics
        metrics = {
            "agent_count": len(self.agents),
            "event_count": len(self.events),
        }
        
        if self.events:
            metrics["first_event_time"] = self.events[0].timestamp
            metrics["last_event_time"] = self.events[-1].timestamp
            metrics["system_uptime"] = self.events[-1].timestamp - self.events[0].timestamp
            
        # Count events by type
        event_counts = {}
        for event in self.events:
            event_type = event.event_type.value
            event_counts[event_type] = event_counts.get(event_type, 0) + 1
        metrics["event_counts"] = event_counts
        
        # Calculate message metrics
        messages = [e for e in self.events if e.event_type in (EventType.MESSAGE_RECEIVED, EventType.MESSAGE_SENT)]
        metrics["message_count"] = len(messages)
        
        # Calculate error metrics
        errors = [e for e in self.events if e.event_type == EventType.ERROR]
        metrics["error_count"] = len(errors)
        
        # Calculate agent metrics
        agent_metrics = {}
        for agent_id in self.agents:
            agent_metrics[agent_id] = self.get_agent_metrics(agent_id)
        metrics["agent_metrics"] = agent_metrics
        
        return metrics

