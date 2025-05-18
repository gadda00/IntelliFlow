"""
ADK Base Agent Class

This module provides the base Agent class for the IntelliFlow platform.
All specialized agents inherit from this base class.
"""

from typing import Dict, List, Any, Optional, Callable, Awaitable
import asyncio
import uuid
import logging

class Tool:
    """Base class for all agent tools."""
    
    def __init__(self, name: str, description: str = ""):
        self.name = name
        self.description = description
        
    async def execute(self, **kwargs) -> Dict[str, Any]:
        """Execute the tool functionality."""
        raise NotImplementedError("Tool subclasses must implement execute method")


class Message:
    """Message class for inter-agent communication."""
    
    def __init__(self, 
                 sender: str, 
                 intent: str, 
                 content: Dict[str, Any],
                 message_id: str = None,
                 correlation_id: str = None,
                 reply_to: str = None):
        self.sender = sender
        self.intent = intent
        self.content = content
        self.message_id = message_id or str(uuid.uuid4())
        self.correlation_id = correlation_id
        self.reply_to = reply_to
        self.timestamp = asyncio.get_event_loop().time()
        
    def to_dict(self) -> Dict[str, Any]:
        """Convert message to dictionary representation."""
        return {
            "message_id": self.message_id,
            "sender": self.sender,
            "intent": self.intent,
            "content": self.content,
            "correlation_id": self.correlation_id,
            "reply_to": self.reply_to,
            "timestamp": self.timestamp
        }
        
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Message':
        """Create message from dictionary representation."""
        return cls(
            sender=data["sender"],
            intent=data["intent"],
            content=data["content"],
            message_id=data.get("message_id"),
            correlation_id=data.get("correlation_id"),
            reply_to=data.get("reply_to")
        )


class Agent:
    """Base agent class for all specialized agents in IntelliFlow."""
    
    def __init__(self, name: str):
        self.name = name
        self.tools: Dict[str, Tool] = {}
        self.message_handlers: Dict[str, Callable[[Message], Awaitable[Optional[Message]]]] = {}
        self.logger = logging.getLogger(f"agent.{name}")
        
    def register_tool(self, tool: Tool) -> None:
        """Register a single tool with the agent."""
        self.tools[tool.name] = tool
        self.logger.info(f"Registered tool: {tool.name}")
        
    def register_tools(self, tools: List[Tool]) -> None:
        """Register multiple tools with the agent."""
        for tool in tools:
            self.register_tool(tool)
            
    def register_message_handler(self, 
                                intent: str, 
                                handler: Callable[[Message], Awaitable[Optional[Message]]]) -> None:
        """Register a message handler for a specific intent."""
        self.message_handlers[intent] = handler
        self.logger.info(f"Registered handler for intent: {intent}")
        
    async def process_message(self, message: Message) -> Optional[Message]:
        """Process an incoming message based on its intent."""
        if message.intent in self.message_handlers:
            self.logger.info(f"Processing message with intent: {message.intent}")
            return await self.message_handlers[message.intent](message)
        else:
            self.logger.warning(f"No handler registered for intent: {message.intent}")
            return None
            
    async def execute_tool(self, tool_name: str, **kwargs) -> Dict[str, Any]:
        """Execute a registered tool by name."""
        if tool_name in self.tools:
            self.logger.info(f"Executing tool: {tool_name}")
            try:
                return await self.tools[tool_name].execute(**kwargs)
            except Exception as e:
                self.logger.error(f"Error executing tool {tool_name}: {str(e)}")
                return {"status": "error", "message": str(e)}
        else:
            self.logger.error(f"Tool not found: {tool_name}")
            return {"status": "error", "message": f"Tool not found: {tool_name}"}
            
    async def send_message(self, 
                          to: str, 
                          intent: str, 
                          content: Dict[str, Any],
                          correlation_id: str = None,
                          reply_to: str = None) -> str:
        """Send a message to another agent."""
        message = Message(
            sender=self.name,
            intent=intent,
            content=content,
            correlation_id=correlation_id,
            reply_to=reply_to
        )
        # This method should be implemented by subclasses to use the appropriate
        # message bus implementation (e.g., Pub/Sub)
        message_id = await self._send_message_impl(to, message)
        return message_id
        
    async def _send_message_impl(self, to: str, message: Message) -> str:
        """Implementation of message sending mechanism."""
        raise NotImplementedError("Agent subclasses must implement _send_message_impl method")
