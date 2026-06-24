"""
Message bus implementation using Google Pub/Sub.

This module provides utilities for inter-agent communication using Google Pub/Sub.
"""

import json
import asyncio
from typing import Dict, Any, Callable, Awaitable, Optional
from google.cloud import pubsub_v1
from google.api_core.exceptions import AlreadyExists

from common.logging.logger import get_logger

logger = get_logger("message_bus.pubsub")

class PubSubMessageBus:
    """Message bus implementation using Google Pub/Sub."""
    
    def __init__(self, project_id: str, topic_prefix: str = "intelliflow-"):
        """
        Initialize the Pub/Sub message bus.
        
        Args:
            project_id: Google Cloud project ID
            topic_prefix: Prefix for Pub/Sub topics
        """
        self.project_id = project_id
        self.topic_prefix = topic_prefix
        self.publisher = pubsub_v1.PublisherClient()
        self.subscriber = pubsub_v1.SubscriberClient()
        self.subscriptions = {}
        
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
            self.publisher.create_topic(request={"name": topic_path})
            logger.info(f"Created topic: {topic_path}")
        except AlreadyExists:
            logger.info(f"Topic already exists: {topic_path}")
        
        return topic_path
    
    async def create_subscription_if_not_exists(self, agent_id: str, subscriber_id: str) -> str:
        """
        Create a subscription if it doesn't exist.
        
        Args:
            agent_id: Target agent identifier
            subscriber_id: Subscriber agent identifier
            
        Returns:
            Subscription path
        """
        topic_path = self.get_topic_path(agent_id)
        subscription_path = self.get_subscription_path(agent_id, subscriber_id)
        
        try:
            self.subscriber.create_subscription(
                request={"name": subscription_path, "topic": topic_path}
            )
            logger.info(f"Created subscription: {subscription_path}")
        except AlreadyExists:
            logger.info(f"Subscription already exists: {subscription_path}")
        
        return subscription_path
    
    async def publish(self, agent_id: str, message: Dict[str, Any]) -> str:
        """
        Publish a message to an agent's topic.
        
        Args:
            agent_id: Target agent identifier
            message: Message to publish
            
        Returns:
            Message ID
        """
        topic_path = await self.create_topic_if_not_exists(agent_id)
        data = json.dumps(message).encode("utf-8")
        
        future = self.publisher.publish(topic_path, data)
        message_id = await asyncio.wrap_future(future)
        
        logger.info(f"Published message {message_id} to {topic_path}")
        return message_id
    
    async def subscribe(self, 
                       agent_id: str, 
                       subscriber_id: str, 
                       callback: Callable[[Dict[str, Any]], Awaitable[None]]) -> None:
        """
        Subscribe to messages from an agent.
        
        Args:
            agent_id: Source agent identifier
            subscriber_id: Subscriber agent identifier
            callback: Async callback function to process messages
        """
        subscription_path = await self.create_subscription_if_not_exists(agent_id, subscriber_id)
        
        def message_callback(message):
            data = json.loads(message.data.decode("utf-8"))
            asyncio.create_task(callback(data))
            message.ack()
        
        # Store the subscription for later management
        self.subscriptions[subscription_path] = self.subscriber.subscribe(
            subscription_path, message_callback
        )
        
        logger.info(f"Subscribed to {subscription_path}")
    
    async def close(self) -> None:
        """Close all subscriptions and clients."""
        for subscription_path, subscription in self.subscriptions.items():
            subscription.cancel()
            logger.info(f"Cancelled subscription: {subscription_path}")
        
        self.subscriber.close()
        logger.info("Closed subscriber client")
