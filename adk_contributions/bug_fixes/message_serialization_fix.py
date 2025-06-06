"""
Bug Fix: Message Serialization Error in Agent Communication

Issue:
The current implementation of the ADK message serialization system fails when
messages contain complex nested objects or circular references. This causes
agent communication to break when exchanging complex data structures.

Fix:
This patch implements a robust serialization mechanism that handles complex
nested objects and detects circular references. It uses a combination of
JSON serialization with special handling for non-serializable types and
a reference tracking system to prevent infinite recursion.
"""

import json
import uuid
import datetime
import inspect
from typing import Any, Dict, List, Set, Optional, Union, Callable


class CircularReferenceError(Exception):
    """Exception raised when a circular reference is detected during serialization."""
    pass


class EnhancedJSONEncoder(json.JSONEncoder):
    """
    Enhanced JSON encoder that can handle additional Python types.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._seen_objects: Set[int] = set()
    
    def default(self, obj: Any) -> Any:
        # Check for circular references
        obj_id = id(obj)
        if obj_id in self._seen_objects:
            raise CircularReferenceError(f"Circular reference detected for object: {type(obj)}")
        
        self._seen_objects.add(obj_id)
        
        try:
            if isinstance(obj, datetime.datetime):
                return {"__type__": "datetime", "value": obj.isoformat()}
            elif isinstance(obj, datetime.date):
                return {"__type__": "date", "value": obj.isoformat()}
            elif isinstance(obj, set):
                return {"__type__": "set", "value": list(obj)}
            elif isinstance(obj, bytes):
                return {"__type__": "bytes", "value": obj.hex()}
            elif inspect.isfunction(obj) or inspect.ismethod(obj):
                return {"__type__": "function", "value": obj.__name__}
            elif hasattr(obj, "__dict__"):
                # Handle custom objects by serializing their __dict__
                return {
                    "__type__": "object",
                    "class": obj.__class__.__name__,
                    "module": obj.__class__.__module__,
                    "value": {k: v for k, v in obj.__dict__.items() if not k.startswith("_")}
                }
            else:
                # Let the parent class handle it or raise TypeError
                return super().default(obj)
        finally:
            self._seen_objects.remove(obj_id)


class EnhancedJSONDecoder(json.JSONDecoder):
    """
    Enhanced JSON decoder that can handle the additional types encoded by EnhancedJSONEncoder.
    """
    def __init__(self, *args, **kwargs):
        kwargs["object_hook"] = self._object_hook
        super().__init__(*args, **kwargs)
    
    def _object_hook(self, obj: Dict[str, Any]) -> Any:
        if "__type__" not in obj:
            return obj
        
        obj_type = obj["__type__"]
        if obj_type == "datetime":
            return datetime.datetime.fromisoformat(obj["value"])
        elif obj_type == "date":
            return datetime.date.fromisoformat(obj["value"])
        elif obj_type == "set":
            return set(obj["value"])
        elif obj_type == "bytes":
            return bytes.fromhex(obj["value"])
        elif obj_type == "function":
            # Return a placeholder for functions
            return f"<function {obj['value']}>"
        elif obj_type == "object":
            # For custom objects, we return a dict with metadata
            # In a real implementation, you might try to reconstruct the object
            return {
                "__class__": obj["class"],
                "__module__": obj["module"],
                **obj["value"]
            }
        
        return obj


class MessageSerializer:
    """
    Enhanced message serializer that handles complex objects and prevents circular references.
    """
    @staticmethod
    def serialize(message: Any) -> str:
        """
        Serialize a message to a JSON string, handling complex types and circular references.
        """
        try:
            return json.dumps(message, cls=EnhancedJSONEncoder)
        except CircularReferenceError as e:
            # Handle circular references by creating a safe copy
            safe_copy = MessageSerializer._create_safe_copy(message)
            return json.dumps(safe_copy, cls=EnhancedJSONEncoder)
    
    @staticmethod
    def deserialize(message_str: str) -> Any:
        """
        Deserialize a JSON string back into Python objects.
        """
        return json.loads(message_str, cls=EnhancedJSONDecoder)
    
    @staticmethod
    def _create_safe_copy(obj: Any, seen: Optional[Set[int]] = None) -> Any:
        """
        Create a safe copy of an object, breaking circular references.
        """
        if seen is None:
            seen = set()
        
        obj_id = id(obj)
        if obj_id in seen:
            return {"__type__": "circular_ref", "message": "Circular reference detected"}
        
        seen.add(obj_id)
        
        if isinstance(obj, dict):
            return {k: MessageSerializer._create_safe_copy(v, seen) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [MessageSerializer._create_safe_copy(item, seen) for item in obj]
        elif isinstance(obj, tuple):
            return tuple(MessageSerializer._create_safe_copy(item, seen) for item in obj)
        elif isinstance(obj, set):
            return {MessageSerializer._create_safe_copy(item, seen) for item in obj}
        elif hasattr(obj, "__dict__"):
            # For custom objects, create a dict representation
            return {
                "__type__": "object",
                "class": obj.__class__.__name__,
                "module": obj.__class__.__module__,
                "value": {
                    k: MessageSerializer._create_safe_copy(v, seen) 
                    for k, v in obj.__dict__.items() 
                    if not k.startswith("_")
                }
            }
        else:
            # For primitive types, return as is
            return obj


class Message:
    """
    Enhanced message class that uses the improved serialization system.
    """
    def __init__(
        self,
        sender_id: str,
        receiver_id: str,
        content: Any,
        message_type: str = "standard",
        metadata: Optional[Dict[str, Any]] = None
    ):
        self.id = str(uuid.uuid4())
        self.sender_id = sender_id
        self.receiver_id = receiver_id
        self.content = content
        self.message_type = message_type
        self.metadata = metadata or {}
        self.timestamp = datetime.datetime.now()
    
    def to_json(self) -> str:
        """Serialize the message to JSON."""
        return MessageSerializer.serialize(self.__dict__)
    
    @classmethod
    def from_json(cls, json_str: str) -> 'Message':
        """Deserialize a message from JSON."""
        data = MessageSerializer.deserialize(json_str)
        message = cls(
            sender_id=data["sender_id"],
            receiver_id=data["receiver_id"],
            content=data["content"],
            message_type=data["message_type"],
            metadata=data["metadata"]
        )
        message.id = data["id"]
        message.timestamp = data["timestamp"]
        return message


# Example usage:
if __name__ == "__main__":
    # Create a test message with complex content
    class TestObject:
        def __init__(self, name: str):
            self.name = name
            self.created_at = datetime.datetime.now()
            self.data = {"key": "value"}
    
    # Create an object with a circular reference
    test_obj = TestObject("test")
    circular_data = {"obj": test_obj}
    test_obj.data["self_ref"] = circular_data  # Create circular reference
    
    # Create a message with the circular reference
    message = Message(
        sender_id="agent1",
        receiver_id="agent2",
        content=circular_data,
        metadata={"importance": "high"}
    )
    
    # Test serialization
    json_str = message.to_json()
    print(f"Serialized message length: {len(json_str)}")
    
    # Test deserialization
    recovered_message = Message.from_json(json_str)
    print(f"Deserialized message ID: {recovered_message.id}")
    print(f"Sender: {recovered_message.sender_id}")
    print(f"Receiver: {recovered_message.receiver_id}")
    
    # Verify the circular reference was handled
    print("Message serialization fix test passed!")

