"""
Enhanced Agent class for the ADK.

This module provides an enhanced Agent class with advanced features for
planning, memory, monitoring, and communication.
"""

from typing import Dict, List, Any, Optional, Callable, Awaitable, Union, Set, Type
import asyncio
import uuid
import logging
import time
import traceback
from enum import Enum

from .tool import Tool
from .message import Message
from ..planning.planner import Planner
from ..memory.memory import Memory, WorkingMemory
from ..monitoring.monitor import AgentMonitor, EventType
from ..communication.channel import Channel

logger = logging.getLogger("enhanced_adk.agent")

class AgentState(Enum):
    """Enum for agent states."""
    INITIALIZING = "initializing"
    IDLE = "idle"
    PLANNING = "planning"
    EXECUTING = "executing"
    COMMUNICATING = "communicating"
    PAUSED = "paused"
    STOPPING = "stopping"
    STOPPED = "stopped"
    ERROR = "error"


class EnhancedAgent:
    """Enhanced Agent class with advanced features."""
    
    def __init__(self, 
                 name: str,
                 description: str = "",
                 planner: Optional[Planner] = None,
                 memory: Optional[Memory] = None,
                 monitor: Optional[AgentMonitor] = None,
                 channel: Optional[Channel] = None):
        """
        Initialize an enhanced agent.
        
        Args:
            name: Agent name
            description: Agent description
            planner: Optional planner for goal-oriented behavior
            memory: Optional memory system
            monitor: Optional monitoring system
            channel: Optional communication channel
        """
        self.name = name
        self.description = description
        self.planner = planner
        self.memory = memory or WorkingMemory()
        self.monitor = monitor
        self.channel = channel
        
        self.tools: Dict[str, Tool] = {}
        self.message_handlers: Dict[str, Callable[[Message], Awaitable[Optional[Message]]]] = {}
        self.state = AgentState.INITIALIZING
        self.capabilities: Set[str] = set()
        
        # Initialize monitoring
        if self.monitor:
            self.monitor.register_agent(self.name)
            self.monitor.log_event(
                agent_id=self.name,
                event_type=EventType.AGENT_CREATED,
                data={"description": self.description}
            )
        
        logger.info(f"Initialized agent: {self.name}")
        self.state = AgentState.IDLE
        
    def register_tool(self, tool: Tool) -> None:
        """
        Register a single tool with the agent.
        
        Args:
            tool: Tool to register
        """
        self.tools[tool.name] = tool
        self.capabilities.add(f"tool:{tool.name}")
        
        if self.monitor:
            self.monitor.log_event(
                agent_id=self.name,
                event_type=EventType.TOOL_REGISTERED,
                data={"tool_name": tool.name}
            )
            
        logger.info(f"Agent {self.name} registered tool: {tool.name}")
        
    def register_tools(self, tools: List[Tool]) -> None:
        """
        Register multiple tools with the agent.
        
        Args:
            tools: List of tools to register
        """
        for tool in tools:
            self.register_tool(tool)
            
    def register_message_handler(self, 
                                intent: str, 
                                handler: Callable[[Message], Awaitable[Optional[Message]]]) -> None:
        """
        Register a message handler for a specific intent.
        
        Args:
            intent: Message intent to handle
            handler: Handler function
        """
        self.message_handlers[intent] = handler
        self.capabilities.add(f"intent:{intent}")
        
        if self.monitor:
            self.monitor.log_event(
                agent_id=self.name,
                event_type=EventType.HANDLER_REGISTERED,
                data={"intent": intent}
            )
            
        logger.info(f"Agent {self.name} registered handler for intent: {intent}")
        
    async def process_message(self, message: Message) -> Optional[Message]:
        """
        Process an incoming message based on its intent.
        
        Args:
            message: Message to process
            
        Returns:
            Optional response message
        """
        if self.state == AgentState.STOPPED:
            logger.warning(f"Agent {self.name} is stopped, ignoring message")
            return None
            
        prev_state = self.state
        self.state = AgentState.COMMUNICATING
        
        if self.monitor:
            self.monitor.log_event(
                agent_id=self.name,
                event_type=EventType.MESSAGE_RECEIVED,
                data={"message_id": message.message_id, "intent": message.intent}
            )
        
        # Store message in memory
        self.memory.add(
            category="messages",
            key=message.message_id,
            value=message.to_dict()
        )
        
        try:
            if message.intent in self.message_handlers:
                logger.info(f"Agent {self.name} processing message with intent: {message.intent}")
                
                # Execute handler
                response = await self.message_handlers[message.intent](message)
                
                if response and self.monitor:
                    self.monitor.log_event(
                        agent_id=self.name,
                        event_type=EventType.MESSAGE_SENT,
                        data={"message_id": response.message_id, "intent": response.intent}
                    )
                
                return response
            else:
                logger.warning(f"Agent {self.name} has no handler for intent: {message.intent}")
                return None
        except Exception as e:
            logger.error(f"Error processing message in agent {self.name}: {str(e)}")
            logger.debug(traceback.format_exc())
            
            if self.monitor:
                self.monitor.log_event(
                    agent_id=self.name,
                    event_type=EventType.ERROR,
                    data={"error": str(e), "message_id": message.message_id}
                )
                
            self.state = AgentState.ERROR
            return None
        finally:
            self.state = prev_state
            
    async def execute_tool(self, tool_name: str, **kwargs) -> Dict[str, Any]:
        """
        Execute a registered tool by name.
        
        Args:
            tool_name: Name of the tool to execute
            **kwargs: Tool parameters
            
        Returns:
            Tool execution result
        """
        if self.state == AgentState.STOPPED:
            logger.warning(f"Agent {self.name} is stopped, ignoring tool execution")
            return {"status": "error", "message": "Agent is stopped"}
            
        prev_state = self.state
        self.state = AgentState.EXECUTING
        
        if self.monitor:
            self.monitor.log_event(
                agent_id=self.name,
                event_type=EventType.TOOL_EXECUTION_STARTED,
                data={"tool_name": tool_name, "parameters": kwargs}
            )
        
        try:
            if tool_name in self.tools:
                logger.info(f"Agent {self.name} executing tool: {tool_name}")
                
                # Execute tool
                start_time = time.time()
                result = await self.tools[tool_name].execute(**kwargs)
                execution_time = time.time() - start_time
                
                # Store execution in memory
                execution_id = str(uuid.uuid4())
                self.memory.add(
                    category="tool_executions",
                    key=execution_id,
                    value={
                        "tool_name": tool_name,
                        "parameters": kwargs,
                        "result": result,
                        "execution_time": execution_time,
                        "timestamp": time.time()
                    }
                )
                
                if self.monitor:
                    self.monitor.log_event(
                        agent_id=self.name,
                        event_type=EventType.TOOL_EXECUTION_COMPLETED,
                        data={
                            "tool_name": tool_name,
                            "execution_time": execution_time,
                            "status": result.get("status", "unknown")
                        }
                    )
                
                return result
            else:
                logger.error(f"Agent {self.name} has no tool: {tool_name}")
                
                if self.monitor:
                    self.monitor.log_event(
                        agent_id=self.name,
                        event_type=EventType.ERROR,
                        data={"error": f"Tool not found: {tool_name}"}
                    )
                    
                return {"status": "error", "message": f"Tool not found: {tool_name}"}
        except Exception as e:
            logger.error(f"Error executing tool {tool_name} in agent {self.name}: {str(e)}")
            logger.debug(traceback.format_exc())
            
            if self.monitor:
                self.monitor.log_event(
                    agent_id=self.name,
                    event_type=EventType.ERROR,
                    data={"error": str(e), "tool_name": tool_name}
                )
                
            self.state = AgentState.ERROR
            return {"status": "error", "message": str(e)}
        finally:
            self.state = prev_state
            
    async def send_message(self, 
                          to: str, 
                          intent: str, 
                          content: Dict[str, Any],
                          correlation_id: Optional[str] = None,
                          reply_to: Optional[str] = None,
                          priority: int = 0,
                          ttl: Optional[int] = None,
                          metadata: Optional[Dict[str, Any]] = None) -> str:
        """
        Send a message to another agent.
        
        Args:
            to: Recipient agent identifier
            intent: Message intent
            content: Message content
            correlation_id: Optional correlation identifier
            reply_to: Optional reply-to agent identifier
            priority: Message priority
            ttl: Time-to-live in seconds
            metadata: Additional metadata
            
        Returns:
            Message identifier
        """
        if not self.channel:
            raise RuntimeError(f"Agent {self.name} has no communication channel")
            
        prev_state = self.state
        self.state = AgentState.COMMUNICATING
        
        try:
            message = Message(
                sender=self.name,
                intent=intent,
                content=content,
                correlation_id=correlation_id,
                reply_to=reply_to or self.name,
                recipients=[to],
                priority=priority,
                ttl=ttl,
                metadata=metadata
            )
            
            if self.monitor:
                self.monitor.log_event(
                    agent_id=self.name,
                    event_type=EventType.MESSAGE_SENT,
                    data={"message_id": message.message_id, "intent": intent, "recipient": to}
                )
            
            # Store message in memory
            self.memory.add(
                category="messages",
                key=message.message_id,
                value=message.to_dict()
            )
            
            # Send message through channel
            await self.channel.publish(to, message)
            
            return message.message_id
        finally:
            self.state = prev_state
            
    async def start(self) -> None:
        """Start the agent."""
        if self.state != AgentState.IDLE and self.state != AgentState.STOPPED:
            logger.warning(f"Agent {self.name} is already running")
            return
            
        self.state = AgentState.INITIALIZING
        
        if self.monitor:
            self.monitor.log_event(
                agent_id=self.name,
                event_type=EventType.AGENT_STARTED,
                data={}
            )
        
        # Initialize channel if available
        if self.channel:
            await self.channel.subscribe(self.name, self._on_message_received)
            
        self.state = AgentState.IDLE
        logger.info(f"Agent {self.name} started")
        
    async def stop(self) -> None:
        """Stop the agent."""
        if self.state == AgentState.STOPPED:
            logger.warning(f"Agent {self.name} is already stopped")
            return
            
        self.state = AgentState.STOPPING
        
        if self.monitor:
            self.monitor.log_event(
                agent_id=self.name,
                event_type=EventType.AGENT_STOPPED,
                data={}
            )
        
        # Close channel if available
        if self.channel:
            await self.channel.unsubscribe(self.name)
            
        self.state = AgentState.STOPPED
        logger.info(f"Agent {self.name} stopped")
        
    async def _on_message_received(self, message: Message) -> None:
        """
        Handle a message received through the channel.
        
        Args:
            message: Received message
        """
        response = await self.process_message(message)
        
        # Send response if available and has reply_to
        if response and message.reply_to:
            await self.send_message(
                to=message.reply_to,
                intent=response.intent,
                content=response.content,
                correlation_id=response.correlation_id,
                metadata=response.metadata
            )
            
    def get_capabilities(self) -> List[str]:
        """
        Get the agent's capabilities.
        
        Returns:
            List of capability strings
        """
        return list(self.capabilities)
        
    def to_dict(self) -> Dict[str, Any]:
        """Convert agent to dictionary representation."""
        return {
            "name": self.name,
            "description": self.description,
            "state": self.state.value,
            "capabilities": list(self.capabilities),
            "tools": [tool.to_dict() for tool in self.tools.values()],
            "message_handlers": list(self.message_handlers.keys())
        }

