"""
Memory classes for the memory module.

This module provides memory classes for storing and retrieving
agent knowledge and experiences.
"""

from typing import Dict, Any, Optional, List, Set, Tuple, Union
import time
import logging
import asyncio
from abc import ABC, abstractmethod

from .storage import MemoryStorage, InMemoryStorage

logger = logging.getLogger("enhanced_adk.memory")

class Memory(ABC):
    """Abstract base class for memory systems."""
    
    def __init__(self, storage: Optional[MemoryStorage] = None):
        """
        Initialize memory system.
        
        Args:
            storage: Storage backend (defaults to InMemoryStorage)
        """
        self.storage = storage or InMemoryStorage()
        
    async def add(self, category: str, key: str, value: Any) -> None:
        """
        Add an item to memory.
        
        Args:
            category: Memory category
            key: Memory key
            value: Value to store
        """
        await self.storage.store(category, key, value)
        
    async def get(self, category: str, key: str) -> Optional[Any]:
        """
        Get an item from memory.
        
        Args:
            category: Memory category
            key: Memory key
            
        Returns:
            Stored value or None if not found
        """
        return await self.storage.retrieve(category, key)
        
    async def remove(self, category: str, key: str) -> bool:
        """
        Remove an item from memory.
        
        Args:
            category: Memory category
            key: Memory key
            
        Returns:
            True if removed, False if not found
        """
        return await self.storage.delete(category, key)
        
    async def get_keys(self, category: str) -> List[str]:
        """
        Get all keys in a category.
        
        Args:
            category: Memory category
            
        Returns:
            List of keys
        """
        return await self.storage.list_keys(category)
        
    async def get_categories(self) -> List[str]:
        """
        Get all categories.
        
        Returns:
            List of categories
        """
        return await self.storage.list_categories()
        
    async def clear(self, category: Optional[str] = None) -> None:
        """
        Clear memory.
        
        Args:
            category: Optional category to clear (if None, clear all)
        """
        await self.storage.clear(category)
        
    @abstractmethod
    async def search(self, query: str, category: Optional[str] = None) -> List[Tuple[str, str, Any, float]]:
        """
        Search memory for items matching a query.
        
        Args:
            query: Search query
            category: Optional category to search in
            
        Returns:
            List of tuples (category, key, value, relevance_score)
        """
        pass


class WorkingMemory(Memory):
    """Short-term memory for current task execution."""
    
    def __init__(self, storage: Optional[MemoryStorage] = None, ttl: Optional[int] = None):
        """
        Initialize working memory.
        
        Args:
            storage: Storage backend (defaults to InMemoryStorage)
            ttl: Time-to-live in seconds for memory items (None means no expiration)
        """
        super().__init__(storage)
        self.ttl = ttl
        
    async def add(self, category: str, key: str, value: Any) -> None:
        """
        Add an item to working memory.
        
        Args:
            category: Memory category
            key: Memory key
            value: Value to store
        """
        # Add timestamp for TTL tracking
        if isinstance(value, dict):
            value["_timestamp"] = time.time()
        else:
            value = {
                "_value": value,
                "_timestamp": time.time()
            }
            
        await super().add(category, key, value)
        
    async def get(self, category: str, key: str) -> Optional[Any]:
        """
        Get an item from working memory.
        
        Args:
            category: Memory category
            key: Memory key
            
        Returns:
            Stored value or None if not found or expired
        """
        value = await super().get(category, key)
        
        if value is None:
            return None
            
        # Check TTL
        if self.ttl is not None:
            timestamp = value.get("_timestamp", 0)
            if time.time() - timestamp > self.ttl:
                await self.remove(category, key)
                return None
                
        # Extract original value if wrapped
        if isinstance(value, dict) and "_value" in value:
            return value["_value"]
        return value
        
    async def search(self, query: str, category: Optional[str] = None) -> List[Tuple[str, str, Any, float]]:
        """
        Search working memory for items matching a query.
        
        Args:
            query: Search query
            category: Optional category to search in
            
        Returns:
            List of tuples (category, key, value, relevance_score)
        """
        results = []
        
        # Get categories to search
        categories = [category] if category else await self.get_categories()
        
        for cat in categories:
            keys = await self.get_keys(cat)
            for key in keys:
                value = await self.get(cat, key)
                if value is None:
                    continue
                    
                # Simple string matching for now
                # In a real implementation, this would use more sophisticated matching
                relevance = 0.0
                
                # Convert value to string for matching
                value_str = str(value)
                
                if query.lower() in key.lower():
                    relevance = 0.8
                elif query.lower() in value_str.lower():
                    relevance = 0.5
                    
                if relevance > 0:
                    results.append((cat, key, value, relevance))
                    
        # Sort by relevance
        results.sort(key=lambda x: x[3], reverse=True)
        return results


class LongTermMemory(Memory):
    """Long-term memory for persistent knowledge."""
    
    def __init__(self, storage: Optional[MemoryStorage] = None):
        """
        Initialize long-term memory.
        
        Args:
            storage: Storage backend (defaults to InMemoryStorage)
        """
        super().__init__(storage)
        self.embeddings: Dict[str, Dict[str, List[float]]] = {}
        
    async def add(self, category: str, key: str, value: Any) -> None:
        """
        Add an item to long-term memory.
        
        Args:
            category: Memory category
            key: Memory key
            value: Value to store
        """
        # Add metadata
        if isinstance(value, dict):
            value["_added_at"] = time.time()
            value["_access_count"] = 0
        else:
            value = {
                "_value": value,
                "_added_at": time.time(),
                "_access_count": 0
            }
            
        await super().add(category, key, value)
        
        # In a real implementation, we would compute embeddings here
        # For now, we'll just use a placeholder
        if category not in self.embeddings:
            self.embeddings[category] = {}
        self.embeddings[category][key] = [0.0] * 10  # Placeholder embedding
        
    async def get(self, category: str, key: str) -> Optional[Any]:
        """
        Get an item from long-term memory.
        
        Args:
            category: Memory category
            key: Memory key
            
        Returns:
            Stored value or None if not found
        """
        value = await super().get(category, key)
        
        if value is None:
            return None
            
        # Update access count
        if isinstance(value, dict):
            value["_access_count"] = value.get("_access_count", 0) + 1
            await super().add(category, key, value)
            
            # Extract original value if wrapped
            if "_value" in value:
                return value["_value"]
                
        return value
        
    async def search(self, query: str, category: Optional[str] = None, top_k: int = 10) -> List[Tuple[str, str, Any, float]]:
        """
        Search long-term memory for items matching a query.
        
        Args:
            query: Search query
            category: Optional category to search in
            top_k: Maximum number of results to return
            
        Returns:
            List of tuples (category, key, value, relevance_score)
        """
        results = []
        
        # Get categories to search
        categories = [category] if category else await self.get_categories()
        
        for cat in categories:
            keys = await self.get_keys(cat)
            for key in keys:
                value = await self.get(cat, key)
                if value is None:
                    continue
                    
                # In a real implementation, this would use embedding similarity
                # For now, we'll use simple string matching
                relevance = 0.0
                
                # Convert value to string for matching
                value_str = str(value)
                
                if query.lower() in key.lower():
                    relevance = 0.8
                elif query.lower() in value_str.lower():
                    relevance = 0.5
                    
                if relevance > 0:
                    results.append((cat, key, value, relevance))
                    
        # Sort by relevance and limit to top_k
        results.sort(key=lambda x: x[3], reverse=True)
        return results[:top_k]
        
    async def forget(self, threshold: float = 0.1) -> int:
        """
        Forget items with low importance.
        
        Args:
            threshold: Importance threshold (0.0 to 1.0)
            
        Returns:
            Number of items forgotten
        """
        forgotten_count = 0
        categories = await self.get_categories()
        
        for cat in categories:
            keys = await self.get_keys(cat)
            for key in keys:
                value = await super().get(cat, key)
                if value is None:
                    continue
                    
                # Calculate importance based on access count and age
                access_count = value.get("_access_count", 0)
                added_at = value.get("_added_at", time.time())
                age = time.time() - added_at
                
                # Simple importance formula
                importance = min(1.0, (access_count / 10) + (1.0 / (1.0 + age / (60 * 60 * 24))))
                
                if importance < threshold:
                    await self.remove(cat, key)
                    if cat in self.embeddings and key in self.embeddings[cat]:
                        del self.embeddings[cat][key]
                    forgotten_count += 1
                    
        return forgotten_count

