"""
Google Cloud Pub/Sub client for IntelliFlow.

This module provides a client for interacting with Google Cloud Pub/Sub,
including topic and subscription management, publishing, and consuming.
"""

from typing import Dict, List, Any, Optional, Union, Tuple, Callable, Awaitable
import asyncio
import logging
import time
import json
import os
from datetime import datetime
import threading
import queue

logger = logging.getLogger("intelliflow.integrations.google_cloud.pubsub")

class PubSubClient:
    """Client for interacting with Google Cloud Pub/Sub."""
    
    def __init__(self, 
                project_id: str,
                credentials_path: Optional[str] = None):
        """
        Initialize Pub/Sub client.
        
        Args:
            project_id: Google Cloud project ID
            credentials_path: Path to service account credentials JSON file
        """
        self.project_id = project_id
        self.credentials_path = credentials_path
        self.publisher = None
        self.subscriber = None
        self._subscribers = {}  # Store active subscribers
        
        # Set credentials environment variable if provided
        if credentials_path:
            os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = credentials_path
            
        # Import Google Cloud libraries
        try:
            from google.cloud import pubsub_v1
            self.publisher = pubsub_v1.PublisherClient()
            self.subscriber = pubsub_v1.SubscriberClient()
            logger.info(f"Initialized Pub/Sub client for project: {project_id}")
        except ImportError:
            logger.error("Failed to import Google Cloud Pub/Sub libraries")
            raise ImportError("Google Cloud Pub/Sub libraries not available")
            
    async def list_topics(self) -> Dict[str, Any]:
        """
        List topics in the project.
        
        Returns:
            List of topics
        """
        if not self.publisher:
            raise RuntimeError("Pub/Sub client not initialized")
            
        logger.info(f"Listing topics in project: {self.project_id}")
        
        try:
            # Use asyncio to avoid blocking
            loop = asyncio.get_event_loop()
            
            # Get topics
            project_path = f"projects/{self.project_id}"
            topics = await loop.run_in_executor(
                None,
                lambda: list(self.publisher.list_topics(request={"project": project_path}))
            )
            
            # Format results
            results = []
            for topic in topics:
                topic_name = topic.name.split('/')[-1]
                results.append({
                    "name": topic_name,
                    "full_name": topic.name
                })
                
            return {
                "status": "success",
                "topics": results
            }
            
        except Exception as e:
            logger.error(f"Error listing topics: {str(e)}")
            return {
                "status": "error",
                "message": str(e)
            }
            
    async def create_topic(self, topic_name: str) -> Dict[str, Any]:
        """
        Create a new topic.
        
        Args:
            topic_name: Topic name
            
        Returns:
            Created topic info
        """
        if not self.publisher:
            raise RuntimeError("Pub/Sub client not initialized")
            
        logger.info(f"Creating topic: {topic_name}")
        
        try:
            # Use asyncio to avoid blocking
            loop = asyncio.get_event_loop()
            
            # Create topic
            topic_path = self.publisher.topic_path(self.project_id, topic_name)
            topic = await loop.run_in_executor(
                None,
                lambda: self.publisher.create_topic(request={"name": topic_path})
            )
            
            # Format result
            result = {
                "name": topic_name,
                "full_name": topic.name
            }
            
            return {
                "status": "success",
                "topic": result
            }
            
        except Exception as e:
            logger.error(f"Error creating topic: {str(e)}")
            return {
                "status": "error",
                "message": str(e)
            }
            
    async def delete_topic(self, topic_name: str) -> Dict[str, Any]:
        """
        Delete a topic.
        
        Args:
            topic_name: Topic name
            
        Returns:
            Deletion result
        """
        if not self.publisher:
            raise RuntimeError("Pub/Sub client not initialized")
            
        logger.info(f"Deleting topic: {topic_name}")
        
        try:
            # Use asyncio to avoid blocking
            loop = asyncio.get_event_loop()
            
            # Delete topic
            topic_path = self.publisher.topic_path(self.project_id, topic_name)
            await loop.run_in_executor(
                None,
                lambda: self.publisher.delete_topic(request={"topic": topic_path})
            )
            
            return {
                "status": "success",
                "message": f"Topic {topic_name} deleted"
            }
            
        except Exception as e:
            logger.error(f"Error deleting topic: {str(e)}")
            return {
                "status": "error",
                "message": str(e)
            }
            
    async def list_subscriptions(self, topic_name: Optional[str] = None) -> Dict[str, Any]:
        """
        List subscriptions in the project.
        
        Args:
            topic_name: Optional topic name to filter subscriptions
            
        Returns:
            List of subscriptions
        """
        if not self.subscriber:
            raise RuntimeError("Pub/Sub client not initialized")
            
        logger.info(f"Listing subscriptions in project: {self.project_id}")
        
        try:
            # Use asyncio to avoid blocking
            loop = asyncio.get_event_loop()
            
            # Get subscriptions
            project_path = f"projects/{self.project_id}"
            
            if topic_name:
                topic_path = self.publisher.topic_path(self.project_id, topic_name)
                subscriptions = await loop.run_in_executor(
                    None,
                    lambda: list(self.publisher.list_topic_subscriptions(request={"topic": topic_path}))
                )
                
                # Format results
                results = []
                for subscription in subscriptions:
                    subscription_name = subscription.split('/')[-1]
                    results.append({
                        "name": subscription_name,
                        "full_name": subscription,
                        "topic": topic_name
                    })
            else:
                subscriptions = await loop.run_in_executor(
                    None,
                    lambda: list(self.subscriber.list_subscriptions(request={"project": project_path}))
                )
                
                # Format results
                results = []
                for subscription in subscriptions:
                    subscription_name = subscription.name.split('/')[-1]
                    topic_path = subscription.topic
                    topic_name = topic_path.split('/')[-1]
                    
                    results.append({
                        "name": subscription_name,
                        "full_name": subscription.name,
                        "topic": topic_name,
                        "ack_deadline_seconds": subscription.ack_deadline_seconds,
                        "retain_acked_messages": subscription.retain_acked_messages,
                        "message_retention_duration": subscription.message_retention_duration.seconds if hasattr(subscription, 'message_retention_duration') else None
                    })
                
            return {
                "status": "success",
                "subscriptions": results
            }
            
        except Exception as e:
            logger.error(f"Error listing subscriptions: {str(e)}")
            return {
                "status": "error",
                "message": str(e)
            }
            
    async def create_subscription(self, 
                                topic_name: str,
                                subscription_name: str,
                                ack_deadline_seconds: int = 10,
                                retain_acked_messages: bool = False,
                                message_retention_duration: int = 604800) -> Dict[str, Any]:
        """
        Create a new subscription.
        
        Args:
            topic_name: Topic name
            subscription_name: Subscription name
            ack_deadline_seconds: Acknowledgement deadline in seconds
            retain_acked_messages: Whether to retain acknowledged messages
            message_retention_duration: Message retention duration in seconds
            
        Returns:
            Created subscription info
        """
        if not self.subscriber:
            raise RuntimeError("Pub/Sub client not initialized")
            
        logger.info(f"Creating subscription: {subscription_name} for topic: {topic_name}")
        
        try:
            # Use asyncio to avoid blocking
            loop = asyncio.get_event_loop()
            
            # Create subscription
            topic_path = self.publisher.topic_path(self.project_id, topic_name)
            subscription_path = self.subscriber.subscription_path(self.project_id, subscription_name)
            
            # Set retention duration
            from google.protobuf.duration_pb2 import Duration
            retention = Duration()
            retention.seconds = message_retention_duration
            
            subscription = await loop.run_in_executor(
                None,
                lambda: self.subscriber.create_subscription(
                    request={
                        "name": subscription_path,
                        "topic": topic_path,
                        "ack_deadline_seconds": ack_deadline_seconds,
                        "retain_acked_messages": retain_acked_messages,
                        "message_retention_duration": retention
                    }
                )
            )
            
            # Format result
            result = {
                "name": subscription_name,
                "full_name": subscription.name,
                "topic": topic_name,
                "ack_deadline_seconds": subscription.ack_deadline_seconds,
                "retain_acked_messages": subscription.retain_acked_messages,
                "message_retention_duration": subscription.message_retention_duration.seconds if hasattr(subscription, 'message_retention_duration') else None
            }
            
            return {
                "status": "success",
                "subscription": result
            }
            
        except Exception as e:
            logger.error(f"Error creating subscription: {str(e)}")
            return {
                "status": "error",
                "message": str(e)
            }
            
    async def delete_subscription(self, subscription_name: str) -> Dict[str, Any]:
        """
        Delete a subscription.
        
        Args:
            subscription_name: Subscription name
            
        Returns:
            Deletion result
        """
        if not self.subscriber:
            raise RuntimeError("Pub/Sub client not initialized")
            
        logger.info(f"Deleting subscription: {subscription_name}")
        
        try:
            # Use asyncio to avoid blocking
            loop = asyncio.get_event_loop()
            
            # Delete subscription
            subscription_path = self.subscriber.subscription_path(self.project_id, subscription_name)
            await loop.run_in_executor(
                None,
                lambda: self.subscriber.delete_subscription(request={"subscription": subscription_path})
            )
            
            return {
                "status": "success",
                "message": f"Subscription {subscription_name} deleted"
            }
            
        except Exception as e:
            logger.error(f"Error deleting subscription: {str(e)}")
            return {
                "status": "error",
                "message": str(e)
            }
            
    async def publish_message(self, 
                            topic_name: str,
                            data: Union[str, bytes, Dict[str, Any]],
                            attributes: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
        """
        Publish a message to a topic.
        
        Args:
            topic_name: Topic name
            data: Message data (string, bytes, or JSON-serializable object)
            attributes: Optional message attributes
            
        Returns:
            Publish result
        """
        if not self.publisher:
            raise RuntimeError("Pub/Sub client not initialized")
            
        logger.info(f"Publishing message to topic: {topic_name}")
        
        try:
            # Use asyncio to avoid blocking
            loop = asyncio.get_event_loop()
            
            # Convert data to bytes if needed
            if isinstance(data, dict):
                data = json.dumps(data).encode("utf-8")
            elif isinstance(data, str):
                data = data.encode("utf-8")
                
            # Set default attributes if not provided
            if attributes is None:
                attributes = {}
                
            # Add timestamp attribute
            attributes["published_at"] = datetime.utcnow().isoformat()
            
            # Publish message
            topic_path = self.publisher.topic_path(self.project_id, topic_name)
            future = await loop.run_in_executor(
                None,
                lambda: self.publisher.publish(topic_path, data, **attributes)
            )
            
            # Wait for message to be published
            message_id = await loop.run_in_executor(
                None,
                lambda: future.result()
            )
            
            return {
                "status": "success",
                "message_id": message_id
            }
            
        except Exception as e:
            logger.error(f"Error publishing message: {str(e)}")
            return {
                "status": "error",
                "message": str(e)
            }
            
    async def publish_batch(self, 
                          topic_name: str,
                          messages: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Publish multiple messages to a topic.
        
        Args:
            topic_name: Topic name
            messages: List of messages, each with "data" and optional "attributes"
            
        Returns:
            Publish result
        """
        if not self.publisher:
            raise RuntimeError("Pub/Sub client not initialized")
            
        logger.info(f"Publishing batch of {len(messages)} messages to topic: {topic_name}")
        
        try:
            # Use asyncio to avoid blocking
            loop = asyncio.get_event_loop()
            
            # Publish messages
            topic_path = self.publisher.topic_path(self.project_id, topic_name)
            futures = []
            
            for message in messages:
                data = message.get("data")
                attributes = message.get("attributes", {})
                
                # Convert data to bytes if needed
                if isinstance(data, dict):
                    data = json.dumps(data).encode("utf-8")
                elif isinstance(data, str):
                    data = data.encode("utf-8")
                    
                # Add timestamp attribute
                attributes["published_at"] = datetime.utcnow().isoformat()
                
                # Publish message
                future = await loop.run_in_executor(
                    None,
                    lambda: self.publisher.publish(topic_path, data, **attributes)
                )
                
                futures.append(future)
                
            # Wait for all messages to be published
            message_ids = []
            for future in futures:
                message_id = await loop.run_in_executor(
                    None,
                    lambda: future.result()
                )
                message_ids.append(message_id)
                
            return {
                "status": "success",
                "message_ids": message_ids,
                "count": len(message_ids)
            }
            
        except Exception as e:
            logger.error(f"Error publishing batch: {str(e)}")
            return {
                "status": "error",
                "message": str(e)
            }
            
    async def pull_messages(self, 
                          subscription_name: str,
                          max_messages: int = 10,
                          return_immediately: bool = True) -> Dict[str, Any]:
        """
        Pull messages from a subscription.
        
        Args:
            subscription_name: Subscription name
            max_messages: Maximum number of messages to pull
            return_immediately: Whether to return immediately if no messages
            
        Returns:
            Pulled messages
        """
        if not self.subscriber:
            raise RuntimeError("Pub/Sub client not initialized")
            
        logger.info(f"Pulling messages from subscription: {subscription_name}")
        
        try:
            # Use asyncio to avoid blocking
            loop = asyncio.get_event_loop()
            
            # Pull messages
            subscription_path = self.subscriber.subscription_path(self.project_id, subscription_name)
            response = await loop.run_in_executor(
                None,
                lambda: self.subscriber.pull(
                    request={
                        "subscription": subscription_path,
                        "max_messages": max_messages,
                        "return_immediately": return_immediately
                    }
                )
            )
            
            # Format results
            messages = []
            ack_ids = []
            
            for received_message in response.received_messages:
                message = received_message.message
                
                # Convert data to string if possible
                try:
                    data = message.data.decode("utf-8")
                    
                    # Try to parse as JSON
                    try:
                        data = json.loads(data)
                    except:
                        pass
                except:
                    data = base64.b64encode(message.data).decode("utf-8")
                    
                messages.append({
                    "message_id": message.message_id,
                    "data": data,
                    "attributes": dict(message.attributes),
                    "publish_time": message.publish_time.isoformat() if hasattr(message, 'publish_time') else None,
                    "ack_id": received_message.ack_id
                })
                
                ack_ids.append(received_message.ack_id)
                
            return {
                "status": "success",
                "messages": messages,
                "ack_ids": ack_ids,
                "count": len(messages)
            }
            
        except Exception as e:
            logger.error(f"Error pulling messages: {str(e)}")
            return {
                "status": "error",
                "message": str(e)
            }
            
    async def acknowledge_messages(self, 
                                 subscription_name: str,
                                 ack_ids: List[str]) -> Dict[str, Any]:
        """
        Acknowledge messages from a subscription.
        
        Args:
            subscription_name: Subscription name
            ack_ids: List of acknowledgement IDs
            
        Returns:
            Acknowledgement result
        """
        if not self.subscriber:
            raise RuntimeError("Pub/Sub client not initialized")
            
        logger.info(f"Acknowledging {len(ack_ids)} messages from subscription: {subscription_name}")
        
        try:
            # Use asyncio to avoid blocking
            loop = asyncio.get_event_loop()
            
            # Acknowledge messages
            subscription_path = self.subscriber.subscription_path(self.project_id, subscription_name)
            await loop.run_in_executor(
                None,
                lambda: self.subscriber.acknowledge(
                    request={
                        "subscription": subscription_path,
                        "ack_ids": ack_ids
                    }
                )
            )
            
            return {
                "status": "success",
                "count": len(ack_ids)
            }
            
        except Exception as e:
            logger.error(f"Error acknowledging messages: {str(e)}")
            return {
                "status": "error",
                "message": str(e)
            }
            
    def subscribe(self, 
                 subscription_name: str,
                 callback: Callable[[Dict[str, Any]], None],
                 max_messages: int = 10,
                 timeout: Optional[float] = None) -> Dict[str, Any]:
        """
        Subscribe to messages from a subscription.
        
        Args:
            subscription_name: Subscription name
            callback: Callback function to process messages
            max_messages: Maximum number of messages to process at once
            timeout: Subscription timeout in seconds (None for indefinite)
            
        Returns:
            Subscription result
        """
        if not self.subscriber:
            raise RuntimeError("Pub/Sub client not initialized")
            
        logger.info(f"Subscribing to messages from subscription: {subscription_name}")
        
        try:
            # Check if subscription already exists
            if subscription_name in self._subscribers:
                return {
                    "status": "error",
                    "message": f"Subscription {subscription_name} already has an active subscriber"
                }
                
            # Create subscription path
            subscription_path = self.subscriber.subscription_path(self.project_id, subscription_name)
            
            # Define callback wrapper
            def callback_wrapper(message):
                try:
                    # Convert data to string if possible
                    try:
                        data = message.data.decode("utf-8")
                        
                        # Try to parse as JSON
                        try:
                            data = json.loads(data)
                        except:
                            pass
                    except:
                        import base64
                        data = base64.b64encode(message.data).decode("utf-8")
                        
                    # Create message dict
                    message_dict = {
                        "message_id": message.message_id,
                        "data": data,
                        "attributes": dict(message.attributes),
                        "publish_time": message.publish_time.isoformat() if hasattr(message, 'publish_time') else None
                    }
                    
                    # Call user callback
                    callback(message_dict)
                    
                    # Acknowledge message
                    message.ack()
                except Exception as e:
                    logger.error(f"Error processing message: {str(e)}")
                    
            # Create streaming pull subscriber
            streaming_pull_future = self.subscriber.subscribe(
                subscription_path,
                callback=callback_wrapper,
                flow_control=self.subscriber.types.FlowControl(max_messages=max_messages)
            )
            
            # Store subscriber
            self._subscribers[subscription_name] = {
                "future": streaming_pull_future,
                "start_time": datetime.utcnow()
            }
            
            # Start timeout thread if needed
            if timeout:
                def timeout_handler():
                    time.sleep(timeout)
                    if subscription_name in self._subscribers:
                        try:
                            self._subscribers[subscription_name]["future"].cancel()
                            del self._subscribers[subscription_name]
                            logger.info(f"Subscription {subscription_name} timed out after {timeout} seconds")
                        except:
                            pass
                            
                threading.Thread(target=timeout_handler).start()
                
            return {
                "status": "success",
                "subscription": subscription_name,
                "timeout": timeout
            }
            
        except Exception as e:
            logger.error(f"Error subscribing to messages: {str(e)}")
            return {
                "status": "error",
                "message": str(e)
            }
            
    def unsubscribe(self, subscription_name: str) -> Dict[str, Any]:
        """
        Unsubscribe from a subscription.
        
        Args:
            subscription_name: Subscription name
            
        Returns:
            Unsubscription result
        """
        logger.info(f"Unsubscribing from subscription: {subscription_name}")
        
        try:
            # Check if subscription exists
            if subscription_name not in self._subscribers:
                return {
                    "status": "error",
                    "message": f"No active subscriber for subscription {subscription_name}"
                }
                
            # Cancel subscription
            self._subscribers[subscription_name]["future"].cancel()
            
            # Remove from subscribers
            del self._subscribers[subscription_name]
            
            return {
                "status": "success",
                "message": f"Unsubscribed from subscription {subscription_name}"
            }
            
        except Exception as e:
            logger.error(f"Error unsubscribing: {str(e)}")
            return {
                "status": "error",
                "message": str(e)
            }
            
    def list_active_subscribers(self) -> Dict[str, Any]:
        """
        List active subscribers.
        
        Returns:
            List of active subscribers
        """
        logger.info("Listing active subscribers")
        
        try:
            # Format results
            results = []
            for subscription_name, subscriber in self._subscribers.items():
                start_time = subscriber["start_time"]
                duration = (datetime.utcnow() - start_time).total_seconds()
                
                results.append({
                    "subscription": subscription_name,
                    "start_time": start_time.isoformat(),
                    "duration_seconds": duration
                })
                
            return {
                "status": "success",
                "subscribers": results,
                "count": len(results)
            }
            
        except Exception as e:
            logger.error(f"Error listing active subscribers: {str(e)}")
            return {
                "status": "error",
                "message": str(e)
            }

