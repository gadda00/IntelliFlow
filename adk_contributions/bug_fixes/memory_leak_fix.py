"""
Bug Fix: Memory Leak in Agent Memory System

Issue:
The current implementation of the ADK memory system has a memory leak when storing
large amounts of data in the agent's memory. This occurs because the memory cache
doesn't properly clean up old entries when the cache size exceeds the maximum limit.

Fix:
This patch implements a proper LRU (Least Recently Used) cache mechanism that
automatically removes the oldest entries when the cache size exceeds the limit.
It also adds proper garbage collection triggers to ensure memory is released.
"""

import gc
import time
import weakref
from typing import Dict, Any, Optional, List, Tuple

class MemoryCache:
    """
    Enhanced LRU cache implementation for agent memory that fixes memory leaks.
    """
    def __init__(self, max_size: int = 1000):
        self._cache: Dict[str, Any] = {}
        self._access_times: Dict[str, float] = {}
        self._max_size = max_size
        self._weak_refs: Dict[str, weakref.ref] = {}
    
    def get(self, key: str) -> Optional[Any]:
        """Get an item from the cache and update its access time."""
        if key in self._cache:
            self._access_times[key] = time.time()
            return self._cache[key]
        return None
    
    def put(self, key: str, value: Any) -> None:
        """Add an item to the cache with proper cleanup if needed."""
        self._cache[key] = value
        self._access_times[key] = time.time()
        
        # Create weak reference to help with garbage collection
        if hasattr(value, '__dict__'):
            self._weak_refs[key] = weakref.ref(value)
        
        # Clean up if we've exceeded the max size
        if len(self._cache) > self._max_size:
            self._cleanup()
    
    def _cleanup(self) -> None:
        """Remove least recently used items and trigger garbage collection."""
        # First check for any weak references that have been collected
        keys_to_remove = [
            key for key, ref in self._weak_refs.items()
            if ref() is None
        ]
        
        # If we still need to remove more items, use LRU strategy
        if len(self._cache) - len(keys_to_remove) > self._max_size:
            # Sort by access time and identify items to remove
            sorted_keys = sorted(
                self._access_times.items(),
                key=lambda x: x[1]  # Sort by timestamp
            )
            
            # Calculate how many more items we need to remove
            num_to_remove = len(self._cache) - len(keys_to_remove) - self._max_size
            
            # Add the oldest accessed keys to our removal list
            keys_to_remove.extend([k for k, _ in sorted_keys[:num_to_remove]])
        
        # Remove the identified keys
        for key in keys_to_remove:
            if key in self._cache:
                del self._cache[key]
            if key in self._access_times:
                del self._access_times[key]
            if key in self._weak_refs:
                del self._weak_refs[key]
        
        # Explicitly trigger garbage collection if we removed a significant number of items
        if len(keys_to_remove) > self._max_size // 10:
            gc.collect()
    
    def clear(self) -> None:
        """Clear the entire cache."""
        self._cache.clear()
        self._access_times.clear()
        self._weak_refs.clear()
        gc.collect()
    
    def __len__(self) -> int:
        """Return the current size of the cache."""
        return len(self._cache)


class MemoryManager:
    """
    Enhanced memory manager that uses the fixed MemoryCache implementation.
    This class manages different memory types for an agent.
    """
    def __init__(self, max_cache_size: int = 1000):
        self.short_term = MemoryCache(max_cache_size)
        self.long_term = MemoryCache(max_cache_size * 2)
        self.working = MemoryCache(max_cache_size // 2)
    
    def store_memory(self, memory_type: str, key: str, value: Any) -> None:
        """Store a memory in the specified memory type."""
        if memory_type == "short_term":
            self.short_term.put(key, value)
        elif memory_type == "long_term":
            self.long_term.put(key, value)
        elif memory_type == "working":
            self.working.put(key, value)
        else:
            raise ValueError(f"Unknown memory type: {memory_type}")
    
    def retrieve_memory(self, memory_type: str, key: str) -> Optional[Any]:
        """Retrieve a memory from the specified memory type."""
        if memory_type == "short_term":
            return self.short_term.get(key)
        elif memory_type == "long_term":
            return self.long_term.get(key)
        elif memory_type == "working":
            return self.working.get(key)
        else:
            raise ValueError(f"Unknown memory type: {memory_type}")
    
    def clear_memory(self, memory_type: Optional[str] = None) -> None:
        """Clear memories of the specified type, or all if not specified."""
        if memory_type is None or memory_type == "short_term":
            self.short_term.clear()
        if memory_type is None or memory_type == "long_term":
            self.long_term.clear()
        if memory_type is None or memory_type == "working":
            self.working.clear()


# Example usage:
if __name__ == "__main__":
    # Test the fixed memory system
    memory_manager = MemoryManager(max_cache_size=100)
    
    # Store some test data
    for i in range(200):
        memory_manager.store_memory("short_term", f"key_{i}", f"value_{i}")
    
    # Verify the cache size is limited
    assert len(memory_manager.short_term) <= 100
    
    # Verify we can still access recently added items
    assert memory_manager.retrieve_memory("short_term", "key_199") == "value_199"
    
    # Older items should have been removed
    assert memory_manager.retrieve_memory("short_term", "key_0") is None
    
    print("Memory leak fix test passed!")

