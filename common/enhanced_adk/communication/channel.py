"""
Channel classes for the communication module.

This module provides channel classes for agent communication,
including in-memory and Google Pub/Sub implementations.
"""

from typing import Dict, List, Any, Optional, Callable, Awaitable, Set
import asyncio
import json
import logging
from abc import ABC, abstractmethod

from ..core.message import Message

logger = logging.getLogger("enhanced_adk.communication.channel")

class Channel(ABC):
    """Abstract base class for communication channels."""
    
    @abstractmethod
    async def publish(self, recipient: str, message: Message) -> str:
        """
        Publish a message to a recipient.
        
        Args:
            recipient: Recipient identifier
            message: Message to publish
            
        Returns:
            Message identifier
        """
        pass
        
    @abstractmethod
    async def subscribe(self, agent_id: str, callback: Callable[[Message], Awaitable[None]]) -> None:
        """
        Subscribe to messages for an agent.
        
        Args:
            agent_id: Agent identifier
            callback: Callback function for received messages
        """
        pass
        
    @abstractmethod
    async def unsubscribe(self, agent_id: str) -> None:
        """
        Unsubscribe from messages for an agent.
        
        Args:
            agent_id: Agent identifier
        """
        pass
        
    @abstractmethod
    async def close(self) -> None:
        """Close the channel."""
        pass


class InMemoryChannel(Channel):
    """In-memory channel implementation."""
    
    def __init__(self):
        """Initialize in-memory channel."""
        self.subscriptions: Dict[str, List[Callable[[Message], Awaitable[None]]]] = {}
        
    async def publish(self, recipient: str, message: Message) -> str:
        """
        Publish a message to a recipient.
        
        Args:
            recipient: Recipient identifier
            message: Message to publish
            
        Returns:
            Message identifier
        """
        logger.info(f"Publishing message from {message.sender} to {recipient}")
        
        # Check if recipient has subscriptions
        if recipient in self.subscriptions:
            # Notify all subscribers
            for callback in self.subscriptions[recipient]:
                try:
                    asyncio.create_task(callback(message))
                except Exception as e:
                    logger.error(f"Error notifying subscriber: {str(e)}")
                    
        return message.message_id
        
    async def subscribe(self, agent_id: str, callback: Callable[[Message], Awaitable[None]]) -> None:
        """
        Subscribe to messages for an agent.
        
        Args:
            agent_id: Agent identifier
            callback: Callback function for received messages
        """
        logger.info(f"Subscribing to messages for {agent_id}")
        
        if agent_id not in self.subscriptions:
            self.subscriptions[agent_id] = []
            
        self.subscriptions[agent_id].append(callback)
        
    async def unsubscribe(self, agent_id: str) -> None:
        """
        Unsubscribe from messages for an agent.
        
        Args:
            agent_id: Agent identifier
        """
        logger.info(f"Unsubscribing from messages for {agent_id}")
        
        if agent_id in self.subscriptions:
            del self.subscriptions[agent_id]
            
    async def close(self) -> None:
        """Close the channel."""
        logger.info("Closing in-memory channel")
        self.subscriptions = {}


class PubSubChannel(Channel):
    """Google Pub/Sub channel implementation."""
    
    def __init__(self, project_id: str, topic_prefix: str = "intelliflow-"):
        """
        Initialize Pub/Sub channel.
        
        Args:
            project_id: Google Cloud project ID
            topic_prefix: Prefix for Pub/Sub topics
        """
        self.project_id = project_id
        self.topic_prefix = topic_prefix
        self.publisher = None
        self.subscriber = None
        self.subscriptions = {}
        
        # Import Google Cloud libraries
        try:
            from google.cloud import pubsub_v1
            self.publisher = pubsub_v1.PublisherClient()
            self.subscriber = pubsub_v1.SubscriberClient()
            logger.info("Initialized Google Pub/Sub channel")
        except ImportError:
            logger.error("Failed to import Google Cloud Pub/Sub libraries")
            raise ImportError("Google Cloud Pub/Sub libraries not available")
        
    def get_topic_path(self, agent_id: str) -> str:
        """
        Get the full topic path for an agent.
        
        Args:
            agent_id: Agent identifier
            
        Returns:
            Full topic path
        """
        topic_id = f"{self.topic_prefix}{agent_id}"
        return self.publisher.topic_path(self.project_id, topic_id)
    
    def get_subscription_path(self, agent_id: str, subscriber_id: str) -> str:
        """
        Get the full subscription path.
        
        Args:
            agent_id: Target agent identifier
            subscriber_id: Subscriber agent identifier
            
        Returns:
            Full subscription path
        """
        topic_id = f"{self.topic_prefix}{agent_id}"
        subscription_id = f"{topic_id}-{subscriber_id}"
        return self.subscriber.subscription_path(self.project_id, subscription_id)
    
    async def create_topic_if_not_exists(self, agent_id: str) -> str:
        """
        Create a topic for an agent if it doesn't exist.
        
        Args:
            agent_id: Agent identifier
            
        Returns:
            Topic path
        """
        topic_path = self.get_topic_path(agent_id)
        
        try:
            # Use asyncio to avoid blocking
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(
                None,
                lambda: self._create_topic(topic_path)
            )
            logger.info(f"Created topic: {topic_path}")
        except Exception as e:
            if "AlreadyExists" not in str(e):
                logger.error(f"Error creating topic: {str(e)}")
                raise
            logger.info(f"Topic already exists: {topic_path}")
        
        return topic_path
    
    def _create_topic(self, topic_path: str) -> None:
        """
        Create a topic.
        
        Args:
            topic_path: Topic path
        """
        self.publisher.create_topic(request={"name": topic_path})
    
    async def create_subscription_if_not_exists(self, agent_id: str, subscriber_id: str) -> str:
        """
        Create a subscription if it doesn't exist.
        
        Args:
            agent_id: Target agent identifier
            subscriber_id: Subscriber agent identifier
            
        Returns:
            Subscription path
        """
        topic_path = await self.create_topic_if_not_exists(agent_id)
        subscription_path = self.get_subscription_path(agent_id, subscriber_id)
        
        try:
            # Use asyncio to avoid blocking
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(
                None,
                lambda: self._create_subscription(subscription_path, topic_path)
            )
            logger.info(f"Created subscription: {subscription_path}")
        except Exception as e:
            if "AlreadyExists" not in str(e):
                logger.error(f"Error creating subscription: {str(e)}")
                raise
            logger.info(f"Subscription already exists: {subscription_path}")
        
        return subscription_path
    
    def _create_subscription(self, subscription_path: str, topic_path: str) -> None:
        """
        Create a subscription.
        
        Args:
            subscription_path: Subscription path
            topic_path: Topic path
        """
        self.subscriber.create_subscription(
            request={"name": subscription_path, "topic": topic_path}
        )
    
    async def publish(self, recipient: str, message: Message) -> str:
        """
        Publish a message to a recipient.
        
        Args:
            recipient: Recipient identifier
            message: Message to publish
            
        Returns:
            Message identifier
        """
        logger.info(f"Publishing message from {message.sender} to {recipient}")
        
        topic_path = await self.create_topic_if_not_exists(recipient)
        data = message.to_json().encode("utf-8")
        
        # Use asyncio to avoid blocking
        loop = asyncio.get_event_loop()
        future = await loop.run_in_executor(
            None,
            lambda: self.publisher.publish(topic_path, data)
        )
        
        # Wait for the future to complete
        message_id = await asyncio.wrap_future(future)
        
        logger.info(f"Published message {message_id} to {topic_path}")
        return message_id
    
    async def subscribe(self, agent_id: str, callback: Callable[[Message], Awaitable[None]]) -> None:
        """
        Subscribe to messages for an agent.
        
        Args:
            agent_id: Agent identifier
            callback: Callback function for received messages
        """
        logger.info(f"Subscribing to messages for {agent_id}")
        
        # Create subscription
        subscription_path = await self.create_subscription_if_not_exists(agent_id, agent_id)
        
        # Define message callback
        def message_callback(pubsub_message):
            data = pubsub_message.data.decode("utf-8")
            message = Message.from_json(data)
            
            # Create task to process message
            asyncio.create_task(callback(message))
            
            # Acknowledge the message
            pubsub_message.ack()
        
        # Start subscriber
        subscriber = self.subscriber.subscribe(
            subscription_path, message_callback
        )
        
        # Store subscription
        self.subscriptions[agent_id] = subscriber
        
        logger.info(f"Subscribed to {subscription_path}")
    
    async def unsubscribe(self, agent_id: str) -> None:
        """
        Unsubscribe from messages for an agent.
        
        Args:
            agent_id: Agent identifier
        """
        logger.info(f"Unsubscribing from messages for {agent_id}")
        
        if agent_id in self.subscriptions:
            # Cancel subscription
            self.subscriptions[agent_id].cancel()
            del self.subscriptions[agent_id]
            
            logger.info(f"Unsubscribed from messages for {agent_id}")
    
    async def close(self) -> None:
        """Close the channel."""
        logger.info("Closing Pub/Sub channel")
        
        # Cancel all subscriptions
        for agent_id, subscription in self.subscriptions.items():
            subscription.cancel()
            logger.info(f"Cancelled subscription for {agent_id}")
            
        self.subscriptions = {}
        
        # Close clients
        if self.subscriber:
            self.subscriber.close()
            logger.info("Closed subscriber client")

