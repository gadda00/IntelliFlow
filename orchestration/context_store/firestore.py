"""
Context store implementation using Google Cloud Firestore.

This module provides utilities for maintaining shared state between agents.
"""

import asyncio
from typing import Dict, Any, List, Optional
from google.cloud import firestore

from common.logging.logger import get_logger

logger = get_logger("context_store.firestore")

class FirestoreContextStore:
    """Context store implementation using Google Cloud Firestore."""
    
    def __init__(self, project_id: str, collection_prefix: str = "intelliflow-context-"):
        """
        Initialize the Firestore context store.
        
        Args:
            project_id: Google Cloud project ID
            collection_prefix: Prefix for Firestore collections
        """
        self.project_id = project_id
        self.collection_prefix = collection_prefix
        self.client = firestore.Client(project=project_id)
        
    def get_collection_name(self, context_type: str) -> str:
        """
        Get the collection name for a context type.
        
        Args:
            context_type: Type of context (e.g., 'workflow', 'analysis')
            
        Returns:
            Collection name
        """
        return f"{self.collection_prefix}{context_type}"
    
    async def set_context(self, context_type: str, context_id: str, data: Dict[str, Any]) -> None:
        """
        Set context data.
        
        Args:
            context_type: Type of context
            context_id: Context identifier
            data: Context data to store
        """
        collection_name = self.get_collection_name(context_type)
        collection = self.client.collection(collection_name)
        
        # Convert to event loop compatible operation
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None, lambda: collection.document(context_id).set(data)
        )
        
        logger.info(f"Set context {context_id} in {collection_name}")
    
    async def update_context(self, context_type: str, context_id: str, data: Dict[str, Any]) -> None:
        """
        Update context data.
        
        Args:
            context_type: Type of context
            context_id: Context identifier
            data: Context data to update
        """
        collection_name = self.get_collection_name(context_type)
        collection = self.client.collection(collection_name)
        
        # Convert to event loop compatible operation
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None, lambda: collection.document(context_id).update(data)
        )
        
        logger.info(f"Updated context {context_id} in {collection_name}")
    
    async def get_context(self, context_type: str, context_id: str) -> Optional[Dict[str, Any]]:
        """
        Get context data.
        
        Args:
            context_type: Type of context
            context_id: Context identifier
            
        Returns:
            Context data or None if not found
        """
        collection_name = self.get_collection_name(context_type)
        collection = self.client.collection(collection_name)
        
        # Convert to event loop compatible operation
        loop = asyncio.get_event_loop()
        doc_ref = collection.document(context_id)
        doc = await loop.run_in_executor(None, lambda: doc_ref.get())
        
        if doc.exists:
            logger.info(f"Retrieved context {context_id} from {collection_name}")
            return doc.to_dict()
        else:
            logger.warning(f"Context {context_id} not found in {collection_name}")
            return None
    
    async def delete_context(self, context_type: str, context_id: str) -> None:
        """
        Delete context data.
        
        Args:
            context_type: Type of context
            context_id: Context identifier
        """
        collection_name = self.get_collection_name(context_type)
        collection = self.client.collection(collection_name)
        
        # Convert to event loop compatible operation
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None, lambda: collection.document(context_id).delete()
        )
        
        logger.info(f"Deleted context {context_id} from {collection_name}")
    
    async def list_contexts(self, context_type: str) -> List[str]:
        """
        List all context IDs of a specific type.
        
        Args:
            context_type: Type of context
            
        Returns:
            List of context IDs
        """
        collection_name = self.get_collection_name(context_type)
        collection = self.client.collection(collection_name)
        
        # Convert to event loop compatible operation
        loop = asyncio.get_event_loop()
        docs = await loop.run_in_executor(None, lambda: collection.stream())
        
        context_ids = [doc.id for doc in docs]
        logger.info(f"Listed {len(context_ids)} contexts in {collection_name}")
        
        return context_ids
