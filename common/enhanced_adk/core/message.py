"""
Enhanced Message class for inter-agent communication.

This module provides an enhanced Message class for inter-agent communication
with additional features for routing, priority, and metadata.
"""

from typing import Dict, Any, Optional, List
import uuid
import time
import json

class Message:
    """Enhanced Message class for inter-agent communication."""
    
    def __init__(self, 
                 sender: str, 
                 intent: str, 
                 content: Dict[str, Any],
                 message_id: Optional[str] = None,
                 correlation_id: Optional[str] = None,
                 reply_to: Optional[str] = None,
                 recipients: Optional[List[str]] = None,
                 priority: int = 0,
                 ttl: Optional[int] = None,
                 metadata: Optional[Dict[str, Any]] = None):
        """
        Initialize a message.
        
        Args:
            sender: Identifier of the sending agent
            intent: Intent of the message
            content: Message content
            message_id: Unique identifier for the message (auto-generated if None)
            correlation_id: Identifier for correlating related messages
            reply_to: Identifier of the agent to reply to
            recipients: List of recipient agent identifiers
            priority: Message priority (higher values indicate higher priority)
            ttl: Time-to-live in seconds (None means no expiration)
            metadata: Additional metadata for the message
        """
        self.sender = sender
        self.intent = intent
        self.content = content
        self.message_id = message_id or str(uuid.uuid4())
        self.correlation_id = correlation_id
        self.reply_to = reply_to
        self.recipients = recipients or []
        self.priority = priority
        self.ttl = ttl
        self.metadata = metadata or {}
        self.timestamp = time.time()
        
    def to_dict(self) -> Dict[str, Any]:
        """Convert message to dictionary representation."""
        return {
            "message_id": self.message_id,
            "sender": self.sender,
            "intent": self.intent,
            "content": self.content,
            "correlation_id": self.correlation_id,
            "reply_to": self.reply_to,
            "recipients": self.recipients,
            "priority": self.priority,
            "ttl": self.ttl,
            "metadata": self.metadata,
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
            reply_to=data.get("reply_to"),
            recipients=data.get("recipients"),
            priority=data.get("priority", 0),
            ttl=data.get("ttl"),
            metadata=data.get("metadata")
        )
        
    def to_json(self) -> str:
        """Convert message to JSON string."""
        return json.dumps(self.to_dict())
        
    @classmethod
    def from_json(cls, json_str: str) -> 'Message':
        """Create message from JSON string."""
        data = json.loads(json_str)
        return cls.from_dict(data)
        
    def is_expired(self) -> bool:
        """Check if the message has expired based on TTL."""
        if self.ttl is None:
            return False
        return (time.time() - self.timestamp) > self.ttl
        
    def create_reply(self, 
                    intent: str, 
                    content: Dict[str, Any],
                    metadata: Optional[Dict[str, Any]] = None) -> 'Message':
        """
        Create a reply to this message.
        
        Args:
            intent: Intent of the reply
            content: Content of the reply
            metadata: Additional metadata for the reply
            
        Returns:
            Reply message
        """
        return Message(
            sender=self.reply_to or "unknown",
            intent=intent,
            content=content,
            correlation_id=self.message_id,
            reply_to=self.sender,
            recipients=[self.sender],
            metadata=metadata
        )

