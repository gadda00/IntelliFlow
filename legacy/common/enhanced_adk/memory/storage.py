"""
Memory storage classes for the memory module.

This module provides storage backends for the memory system,
including in-memory and file-based storage.
"""

from typing import Dict, Any, Optional, List, Set, Tuple
import os
import json
import time
import logging
import asyncio
from abc import ABC, abstractmethod

logger = logging.getLogger("enhanced_adk.memory.storage")

class MemoryStorage(ABC):
    """Abstract base class for memory storage backends."""
    
    @abstractmethod
    async def store(self, category: str, key: str, value: Any) -> None:
        """
        Store a value in memory.
        
        Args:
            category: Memory category
            key: Memory key
            value: Value to store
        """
        pass
        
    @abstractmethod
    async def retrieve(self, category: str, key: str) -> Optional[Any]:
        """
        Retrieve a value from memory.
        
        Args:
            category: Memory category
            key: Memory key
            
        Returns:
            Stored value or None if not found
        """
        pass
        
    @abstractmethod
    async def delete(self, category: str, key: str) -> bool:
        """
        Delete a value from memory.
        
        Args:
            category: Memory category
            key: Memory key
            
        Returns:
            True if deleted, False if not found
        """
        pass
        
    @abstractmethod
    async def list_keys(self, category: str) -> List[str]:
        """
        List all keys in a category.
        
        Args:
            category: Memory category
            
        Returns:
            List of keys
        """
        pass
        
    @abstractmethod
    async def list_categories(self) -> List[str]:
        """
        List all categories.
        
        Returns:
            List of categories
        """
        pass
        
    @abstractmethod
    async def clear(self, category: Optional[str] = None) -> None:
        """
        Clear memory.
        
        Args:
            category: Optional category to clear (if None, clear all)
        """
        pass


class InMemoryStorage(MemoryStorage):
    """In-memory storage backend."""
    
    def __init__(self):
        """Initialize in-memory storage."""
        self.data: Dict[str, Dict[str, Any]] = {}
        
    async def store(self, category: str, key: str, value: Any) -> None:
        """
        Store a value in memory.
        
        Args:
            category: Memory category
            key: Memory key
            value: Value to store
        """
        if category not in self.data:
            self.data[category] = {}
        self.data[category][key] = value
        
    async def retrieve(self, category: str, key: str) -> Optional[Any]:
        """
        Retrieve a value from memory.
        
        Args:
            category: Memory category
            key: Memory key
            
        Returns:
            Stored value or None if not found
        """
        if category not in self.data or key not in self.data[category]:
            return None
        return self.data[category][key]
        
    async def delete(self, category: str, key: str) -> bool:
        """
        Delete a value from memory.
        
        Args:
            category: Memory category
            key: Memory key
            
        Returns:
            True if deleted, False if not found
        """
        if category not in self.data or key not in self.data[category]:
            return False
        del self.data[category][key]
        return True
        
    async def list_keys(self, category: str) -> List[str]:
        """
        List all keys in a category.
        
        Args:
            category: Memory category
            
        Returns:
            List of keys
        """
        if category not in self.data:
            return []
        return list(self.data[category].keys())
        
    async def list_categories(self) -> List[str]:
        """
        List all categories.
        
        Returns:
            List of categories
        """
        return list(self.data.keys())
        
    async def clear(self, category: Optional[str] = None) -> None:
        """
        Clear memory.
        
        Args:
            category: Optional category to clear (if None, clear all)
        """
        if category is None:
            self.data = {}
        elif category in self.data:
            self.data[category] = {}


class FileStorage(MemoryStorage):
    """File-based storage backend."""
    
    def __init__(self, directory: str):
        """
        Initialize file-based storage.
        
        Args:
            directory: Directory for storing files
        """
        self.directory = directory
        os.makedirs(directory, exist_ok=True)
        
    def _get_category_dir(self, category: str) -> str:
        """
        Get the directory for a category.
        
        Args:
            category: Memory category
            
        Returns:
            Category directory path
        """
        category_dir = os.path.join(self.directory, category)
        os.makedirs(category_dir, exist_ok=True)
        return category_dir
        
    def _get_file_path(self, category: str, key: str) -> str:
        """
        Get the file path for a key.
        
        Args:
            category: Memory category
            key: Memory key
            
        Returns:
            File path
        """
        category_dir = self._get_category_dir(category)
        return os.path.join(category_dir, f"{key}.json")
        
    async def store(self, category: str, key: str, value: Any) -> None:
        """
        Store a value in memory.
        
        Args:
            category: Memory category
            key: Memory key
            value: Value to store
        """
        file_path = self._get_file_path(category, key)
        
        # Use asyncio to avoid blocking
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            lambda: self._write_file(file_path, value)
        )
        
    def _write_file(self, file_path: str, value: Any) -> None:
        """
        Write value to file.
        
        Args:
            file_path: File path
            value: Value to write
        """
        with open(file_path, 'w') as f:
            json.dump(value, f)
        
    async def retrieve(self, category: str, key: str) -> Optional[Any]:
        """
        Retrieve a value from memory.
        
        Args:
            category: Memory category
            key: Memory key
            
        Returns:
            Stored value or None if not found
        """
        file_path = self._get_file_path(category, key)
        if not os.path.exists(file_path):
            return None
            
        # Use asyncio to avoid blocking
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,
            lambda: self._read_file(file_path)
        )
        
    def _read_file(self, file_path: str) -> Any:
        """
        Read value from file.
        
        Args:
            file_path: File path
            
        Returns:
            Stored value
        """
        try:
            with open(file_path, 'r') as f:
                return json.load(f)
        except json.JSONDecodeError:
            logger.error(f"Error decoding JSON from file: {file_path}")
            return None
        
    async def delete(self, category: str, key: str) -> bool:
        """
        Delete a value from memory.
        
        Args:
            category: Memory category
            key: Memory key
            
        Returns:
            True if deleted, False if not found
        """
        file_path = self._get_file_path(category, key)
        if not os.path.exists(file_path):
            return False
            
        # Use asyncio to avoid blocking
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            lambda: os.remove(file_path)
        )
        return True
        
    async def list_keys(self, category: str) -> List[str]:
        """
        List all keys in a category.
        
        Args:
            category: Memory category
            
        Returns:
            List of keys
        """
        category_dir = self._get_category_dir(category)
        
        # Use asyncio to avoid blocking
        loop = asyncio.get_event_loop()
        files = await loop.run_in_executor(
            None,
            lambda: os.listdir(category_dir)
        )
        
        # Extract key names from file names
        keys = []
        for file_name in files:
            if file_name.endswith('.json'):
                keys.append(file_name[:-5])  # Remove .json extension
        return keys
        
    async def list_categories(self) -> List[str]:
        """
        List all categories.
        
        Returns:
            List of categories
        """
        # Use asyncio to avoid blocking
        loop = asyncio.get_event_loop()
        dirs = await loop.run_in_executor(
            None,
            lambda: os.listdir(self.directory)
        )
        
        # Filter out non-directories
        categories = []
        for dir_name in dirs:
            dir_path = os.path.join(self.directory, dir_name)
            if os.path.isdir(dir_path):
                categories.append(dir_name)
        return categories
        
    async def clear(self, category: Optional[str] = None) -> None:
        """
        Clear memory.
        
        Args:
            category: Optional category to clear (if None, clear all)
        """
        loop = asyncio.get_event_loop()
        
        if category is None:
            # Clear all categories
            categories = await self.list_categories()
            for cat in categories:
                cat_dir = self._get_category_dir(cat)
                await loop.run_in_executor(
                    None,
                    lambda d=cat_dir: self._clear_directory(d)
                )
        else:
            # Clear specific category
            cat_dir = self._get_category_dir(category)
            await loop.run_in_executor(
                None,
                lambda: self._clear_directory(cat_dir)
            )
            
    def _clear_directory(self, directory: str) -> None:
        """
        Clear all files in a directory.
        
        Args:
            directory: Directory to clear
        """
        for file_name in os.listdir(directory):
            file_path = os.path.join(directory, file_name)
            if os.path.isfile(file_path):
                os.remove(file_path)

