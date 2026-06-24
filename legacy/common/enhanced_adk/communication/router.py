"""
Router classes for the communication module.

This module provides router classes for routing messages between agents,
including topic-based routing.
"""

from typing import Dict, List, Any, Optional, Callable, Awaitable, Set, Pattern
import asyncio
import re
import logging
from abc import ABC, abstractmethod

from ..core.message import Message
from .channel import Channel

logger = logging.getLogger("enhanced_adk.communication.router")

class MessageRouter(ABC):
    """Abstract base class for message routers."""
    
    def __init__(self, channel: Channel):
        """
        Initialize message router.
        
        Args:
            channel: Communication channel
        """
        self.channel = channel
        
    @abstractmethod
    async def route(self, message: Message) -> List[str]:
        """
        Route a message to recipients.
        
        Args:
            message: Message to route
            
        Returns:
            List of message IDs
        """
        pass
        
    @abstractmethod
    async def register(self, agent_id: str, callback: Callable[[Message], Awaitable[None]]) -> None:
        """
        Register an agent with the router.
        
        Args:
            agent_id: Agent identifier
            callback: Callback function for received messages
        """
        pass
        
    @abstractmethod
    async def unregister(self, agent_id: str) -> None:
        """
        Unregister an agent from the router.
        
        Args:
            agent_id: Agent identifier
        """
        pass
        
    @abstractmethod
    async def close(self) -> None:
        """Close the router."""
        pass


class TopicRouter(MessageRouter):
    """Topic-based message router."""
    
    def __init__(self, channel: Channel):
        """
        Initialize topic-based router.
        
        Args:
            channel: Communication channel
        """
        super().__init__(channel)
        self.subscriptions: Dict[str, Set[str]] = {}  # topic -> set of agent_ids
        self.patterns: Dict[str, List[Tuple[Pattern, str]]] = {}  # agent_id -> list of (pattern, topic)
        
    async def route(self, message: Message) -> List[str]:
        """
        Route a message to recipients.
        
        Args:
            message: Message to route
            
        Returns:
            List of message IDs
        """
        # Check if message has explicit recipients
        if message.recipients:
            # Send to explicit recipients
            message_ids = []
            for recipient in message.recipients:
                message_id = await self.channel.publish(recipient, message)
                message_ids.append(message_id)
            return message_ids
            
        # Check if message has a topic
        topic = message.metadata.get("topic")
        if not topic:
            # No topic, no routing
            logger.warning(f"Message has no topic and no explicit recipients: {message.message_id}")
            return []
            
        # Get subscribers for this topic
        subscribers = self.subscriptions.get(topic, set())
        
        # Send to all subscribers
        message_ids = []
        for subscriber in subscribers:
            message_id = await self.channel.publish(subscriber, message)
            message_ids.append(message_id)
            
        return message_ids
        
    async def register(self, agent_id: str, callback: Callable[[Message], Awaitable[None]]) -> None:
        """
        Register an agent with the router.
        
        Args:
            agent_id: Agent identifier
            callback: Callback function for received messages
        """
        # Subscribe to messages for this agent
        await self.channel.subscribe(agent_id, callback)
        
    async def unregister(self, agent_id: str) -> None:
        """
        Unregister an agent from the router.
        
        Args:
            agent_id: Agent identifier
        """
        # Unsubscribe from messages for this agent
        await self.channel.unsubscribe(agent_id)
        
        # Remove from topic subscriptions
        for topic, subscribers in self.subscriptions.items():
            if agent_id in subscribers:
                subscribers.remove(agent_id)
                
        # Remove pattern subscriptions
        if agent_id in self.patterns:
            del self.patterns[agent_id]
        
    async def close(self) -> None:
        """Close the router."""
        # Close the channel
        await self.channel.close()
        
        # Clear subscriptions
        self.subscriptions = {}
        self.patterns = {}
        
    async def subscribe(self, agent_id: str, topic: str) -> None:
        """
        Subscribe an agent to a topic.
        
        Args:
            agent_id: Agent identifier
            topic: Topic to subscribe to
        """
        if topic not in self.subscriptions:
            self.subscriptions[topic] = set()
            
        self.subscriptions[topic].add(agent_id)
        logger.info(f"Agent {agent_id} subscribed to topic: {topic}")
        
    async def unsubscribe(self, agent_id: str, topic: str) -> None:
        """
        Unsubscribe an agent from a topic.
        
        Args:
            agent_id: Agent identifier
            topic: Topic to unsubscribe from
        """
        if topic in self.subscriptions and agent_id in self.subscriptions[topic]:
            self.subscriptions[topic].remove(agent_id)
            logger.info(f"Agent {agent_id} unsubscribed from topic: {topic}")
            
    async def subscribe_pattern(self, agent_id: str, pattern: str) -> None:
        """
        Subscribe an agent to topics matching a pattern.
        
        Args:
            agent_id: Agent identifier
            pattern: Regular expression pattern
        """
        if agent_id not in self.patterns:
            self.patterns[agent_id] = []
            
        # Compile pattern
        compiled_pattern = re.compile(pattern)
        
        # Add to patterns
        self.patterns[agent_id].append((compiled_pattern, pattern))
        logger.info(f"Agent {agent_id} subscribed to pattern: {pattern}")
        
        # Subscribe to existing topics that match
        for topic in self.subscriptions.keys():
            if compiled_pattern.match(topic):
                await self.subscribe(agent_id, topic)
                
    async def unsubscribe_pattern(self, agent_id: str, pattern: str) -> None:
        """
        Unsubscribe an agent from topics matching a pattern.
        
        Args:
            agent_id: Agent identifier
            pattern: Regular expression pattern
        """
        if agent_id not in self.patterns:
            return
            
        # Remove pattern
        self.patterns[agent_id] = [
            (p, s) for p, s in self.patterns[agent_id]
            if s != pattern
        ]
        
        logger.info(f"Agent {agent_id} unsubscribed from pattern: {pattern}")
        
        # If no more patterns, remove from patterns dict
        if not self.patterns[agent_id]:
            del self.patterns[agent_id]
            
    async def publish(self, topic: str, message: Message) -> str:
        """
        Publish a message to a topic.
        
        Args:
            topic: Topic to publish to
            message: Message to publish
            
        Returns:
            Message identifier
        """
        # Add topic to message metadata
        if "topic" not in message.metadata:
            message.metadata["topic"] = topic
            
        # Check for new topic
        if topic not in self.subscriptions:
            self.subscriptions[topic] = set()
            
            # Check for pattern matches
            for agent_id, patterns in self.patterns.items():
                for pattern, _ in patterns:
                    if pattern.match(topic):
                        self.subscriptions[topic].add(agent_id)
                        
        # Route the message
        message_ids = await self.route(message)
        
        # Return first message ID or empty string
        return message_ids[0] if message_ids else ""

