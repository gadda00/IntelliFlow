"""
Google Cloud Storage client for IntelliFlow.

This module provides a client for interacting with Google Cloud Storage,
including file upload, download, and management.
"""

from typing import Dict, List, Any, Optional, Union, Tuple, BinaryIO
import asyncio
import logging
import time
import json
import os
from datetime import datetime, timedelta
import mimetypes

logger = logging.getLogger("intelliflow.integrations.google_cloud.storage")

class StorageClient:
    """Client for interacting with Google Cloud Storage."""
    
    def __init__(self, 
                project_id: str,
                credentials_path: Optional[str] = None):
        """
        Initialize Storage client.
        
        Args:
            project_id: Google Cloud project ID
            credentials_path: Path to service account credentials JSON file
        """
        self.project_id = project_id
        self.credentials_path = credentials_path
        self.client = None
        
        # Set credentials environment variable if provided
        if credentials_path:
            os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = credentials_path
            
        # Import Google Cloud libraries
        try:
            from google.cloud import storage
            self.client = storage.Client(project=project_id)
            logger.info(f"Initialized Storage client for project: {project_id}")
        except ImportError:
            logger.error("Failed to import Google Cloud Storage libraries")
            raise ImportError("Google Cloud Storage libraries not available")
            
    async def list_buckets(self) -> Dict[str, Any]:
        """
        List buckets in the project.
        
        Returns:
            List of buckets
        """
        if not self.client:
            raise RuntimeError("Storage client not initialized")
            
        logger.info(f"Listing buckets in project: {self.project_id}")
        
        try:
            # Use asyncio to avoid blocking
            loop = asyncio.get_event_loop()
            
            # Get buckets
            buckets = await loop.run_in_executor(
                None,
                lambda: list(self.client.list_buckets())
            )
            
            # Format results
            results = []
            for bucket in buckets:
                results.append({
                    "name": bucket.name,
                    "location": bucket.location,
                    "storage_class": bucket.storage_class,
                    "created": bucket.time_created.isoformat() if bucket.time_created else None,
                    "updated": bucket.updated.isoformat() if bucket.updated else None
                })
                
            return {
                "status": "success",
                "buckets": results
            }
            
        except Exception as e:
            logger.error(f"Error listing buckets: {str(e)}")
            return {
                "status": "error",
                "message": str(e)
            }
            
    async def create_bucket(self, 
                          bucket_name: str,
                          location: str = "us-central1",
                          storage_class: str = "STANDARD") -> Dict[str, Any]:
        """
        Create a new bucket.
        
        Args:
            bucket_name: Bucket name
            location: Bucket location
            storage_class: Storage class
            
        Returns:
            Created bucket info
        """
        if not self.client:
            raise RuntimeError("Storage client not initialized")
            
        logger.info(f"Creating bucket: {bucket_name}")
        
        try:
            # Use asyncio to avoid blocking
            loop = asyncio.get_event_loop()
            
            # Create bucket
            bucket = await loop.run_in_executor(
                None,
                lambda: self.client.create_bucket(
                    bucket_name,
                    location=location,
                    storage_class=storage_class
                )
            )
            
            # Format result
            result = {
                "name": bucket.name,
                "location": bucket.location,
                "storage_class": bucket.storage_class,
                "created": bucket.time_created.isoformat() if bucket.time_created else None,
                "updated": bucket.updated.isoformat() if bucket.updated else None
            }
            
            return {
                "status": "success",
                "bucket": result
            }
            
        except Exception as e:
            logger.error(f"Error creating bucket: {str(e)}")
            return {
                "status": "error",
                "message": str(e)
            }
            
    async def delete_bucket(self, bucket_name: str, force: bool = False) -> Dict[str, Any]:
        """
        Delete a bucket.
        
        Args:
            bucket_name: Bucket name
            force: Whether to force deletion of non-empty buckets
            
        Returns:
            Deletion result
        """
        if not self.client:
            raise RuntimeError("Storage client not initialized")
            
        logger.info(f"Deleting bucket: {bucket_name}")
        
        try:
            # Use asyncio to avoid blocking
            loop = asyncio.get_event_loop()
            
            # Get bucket
            bucket = await loop.run_in_executor(
                None,
                lambda: self.client.get_bucket(bucket_name)
            )
            
            # Delete all objects if force is True
            if force:
                blobs = await loop.run_in_executor(
                    None,
                    lambda: list(bucket.list_blobs())
                )
                
                for blob in blobs:
                    await loop.run_in_executor(
                        None,
                        lambda: blob.delete()
                    )
                    
            # Delete bucket
            await loop.run_in_executor(
                None,
                lambda: bucket.delete()
            )
            
            return {
                "status": "success",
                "message": f"Bucket {bucket_name} deleted"
            }
            
        except Exception as e:
            logger.error(f"Error deleting bucket: {str(e)}")
            return {
                "status": "error",
                "message": str(e)
            }
            
    async def list_objects(self, 
                         bucket_name: str,
                         prefix: Optional[str] = None,
                         delimiter: Optional[str] = None) -> Dict[str, Any]:
        """
        List objects in a bucket.
        
        Args:
            bucket_name: Bucket name
            prefix: Object name prefix
            delimiter: Delimiter for hierarchy
            
        Returns:
            List of objects
        """
        if not self.client:
            raise RuntimeError("Storage client not initialized")
            
        logger.info(f"Listing objects in bucket: {bucket_name}")
        
        try:
            # Use asyncio to avoid blocking
            loop = asyncio.get_event_loop()
            
            # Get bucket
            bucket = await loop.run_in_executor(
                None,
                lambda: self.client.get_bucket(bucket_name)
            )
            
            # List blobs
            blobs = await loop.run_in_executor(
                None,
                lambda: list(bucket.list_blobs(prefix=prefix, delimiter=delimiter))
            )
            
            # Format results
            results = []
            for blob in blobs:
                results.append({
                    "name": blob.name,
                    "size": blob.size,
                    "content_type": blob.content_type,
                    "created": blob.time_created.isoformat() if blob.time_created else None,
                    "updated": blob.updated.isoformat() if blob.updated else None,
                    "md5_hash": blob.md5_hash
                })
                
            # Get prefixes (directories)
            prefixes = []
            if delimiter:
                prefix_list = bucket.list_blobs(prefix=prefix, delimiter=delimiter)
                
                # Use asyncio to avoid blocking
                await loop.run_in_executor(
                    None,
                    lambda: prefix_list._get_next_page()
                )
                
                prefixes = list(prefix_list.prefixes)
                
            return {
                "status": "success",
                "objects": results,
                "prefixes": prefixes
            }
            
        except Exception as e:
            logger.error(f"Error listing objects: {str(e)}")
            return {
                "status": "error",
                "message": str(e)
            }
            
    async def upload_file(self, 
                        bucket_name: str,
                        source_file_path: str,
                        destination_blob_name: Optional[str] = None,
                        content_type: Optional[str] = None) -> Dict[str, Any]:
        """
        Upload a file to a bucket.
        
        Args:
            bucket_name: Bucket name
            source_file_path: Path to source file
            destination_blob_name: Name of destination blob (defaults to file name)
            content_type: Content type of the file
            
        Returns:
            Upload result
        """
        if not self.client:
            raise RuntimeError("Storage client not initialized")
            
        # Set destination blob name if not provided
        if not destination_blob_name:
            destination_blob_name = os.path.basename(source_file_path)
            
        logger.info(f"Uploading file to bucket: {bucket_name}/{destination_blob_name}")
        
        try:
            # Use asyncio to avoid blocking
            loop = asyncio.get_event_loop()
            
            # Get bucket
            bucket = await loop.run_in_executor(
                None,
                lambda: self.client.get_bucket(bucket_name)
            )
            
            # Create blob
            blob = bucket.blob(destination_blob_name)
            
            # Set content type if provided
            if content_type:
                blob.content_type = content_type
            else:
                # Try to guess content type
                content_type, _ = mimetypes.guess_type(source_file_path)
                if content_type:
                    blob.content_type = content_type
                    
            # Upload file
            await loop.run_in_executor(
                None,
                lambda: blob.upload_from_filename(source_file_path)
            )
            
            # Get blob info
            blob = await loop.run_in_executor(
                None,
                lambda: bucket.get_blob(destination_blob_name)
            )
            
            # Format result
            result = {
                "name": blob.name,
                "bucket": blob.bucket.name,
                "size": blob.size,
                "content_type": blob.content_type,
                "created": blob.time_created.isoformat() if blob.time_created else None,
                "updated": blob.updated.isoformat() if blob.updated else None,
                "md5_hash": blob.md5_hash,
                "public_url": blob.public_url
            }
            
            return {
                "status": "success",
                "object": result
            }
            
        except Exception as e:
            logger.error(f"Error uploading file: {str(e)}")
            return {
                "status": "error",
                "message": str(e)
            }
            
    async def upload_from_string(self, 
                               bucket_name: str,
                               data: str,
                               destination_blob_name: str,
                               content_type: str = "text/plain") -> Dict[str, Any]:
        """
        Upload data from a string to a bucket.
        
        Args:
            bucket_name: Bucket name
            data: String data to upload
            destination_blob_name: Name of destination blob
            content_type: Content type of the data
            
        Returns:
            Upload result
        """
        if not self.client:
            raise RuntimeError("Storage client not initialized")
            
        logger.info(f"Uploading string data to bucket: {bucket_name}/{destination_blob_name}")
        
        try:
            # Use asyncio to avoid blocking
            loop = asyncio.get_event_loop()
            
            # Get bucket
            bucket = await loop.run_in_executor(
                None,
                lambda: self.client.get_bucket(bucket_name)
            )
            
            # Create blob
            blob = bucket.blob(destination_blob_name)
            
            # Set content type
            blob.content_type = content_type
            
            # Upload data
            await loop.run_in_executor(
                None,
                lambda: blob.upload_from_string(data, content_type=content_type)
            )
            
            # Get blob info
            blob = await loop.run_in_executor(
                None,
                lambda: bucket.get_blob(destination_blob_name)
            )
            
            # Format result
            result = {
                "name": blob.name,
                "bucket": blob.bucket.name,
                "size": blob.size,
                "content_type": blob.content_type,
                "created": blob.time_created.isoformat() if blob.time_created else None,
                "updated": blob.updated.isoformat() if blob.updated else None,
                "md5_hash": blob.md5_hash,
                "public_url": blob.public_url
            }
            
            return {
                "status": "success",
                "object": result
            }
            
        except Exception as e:
            logger.error(f"Error uploading string data: {str(e)}")
            return {
                "status": "error",
                "message": str(e)
            }
            
    async def download_file(self, 
                          bucket_name: str,
                          source_blob_name: str,
                          destination_file_path: str) -> Dict[str, Any]:
        """
        Download a file from a bucket.
        
        Args:
            bucket_name: Bucket name
            source_blob_name: Name of source blob
            destination_file_path: Path to destination file
            
        Returns:
            Download result
        """
        if not self.client:
            raise RuntimeError("Storage client not initialized")
            
        logger.info(f"Downloading file from bucket: {bucket_name}/{source_blob_name}")
        
        try:
            # Use asyncio to avoid blocking
            loop = asyncio.get_event_loop()
            
            # Get bucket
            bucket = await loop.run_in_executor(
                None,
                lambda: self.client.get_bucket(bucket_name)
            )
            
            # Get blob
            blob = bucket.blob(source_blob_name)
            
            # Download file
            await loop.run_in_executor(
                None,
                lambda: blob.download_to_filename(destination_file_path)
            )
            
            # Format result
            result = {
                "name": blob.name,
                "bucket": blob.bucket.name,
                "size": blob.size,
                "content_type": blob.content_type,
                "destination_file": destination_file_path
            }
            
            return {
                "status": "success",
                "object": result
            }
            
        except Exception as e:
            logger.error(f"Error downloading file: {str(e)}")
            return {
                "status": "error",
                "message": str(e)
            }
            
    async def download_as_string(self, 
                               bucket_name: str,
                               source_blob_name: str) -> Dict[str, Any]:
        """
        Download a file from a bucket as a string.
        
        Args:
            bucket_name: Bucket name
            source_blob_name: Name of source blob
            
        Returns:
            Download result with data
        """
        if not self.client:
            raise RuntimeError("Storage client not initialized")
            
        logger.info(f"Downloading file as string from bucket: {bucket_name}/{source_blob_name}")
        
        try:
            # Use asyncio to avoid blocking
            loop = asyncio.get_event_loop()
            
            # Get bucket
            bucket = await loop.run_in_executor(
                None,
                lambda: self.client.get_bucket(bucket_name)
            )
            
            # Get blob
            blob = bucket.blob(source_blob_name)
            
            # Download as string
            data = await loop.run_in_executor(
                None,
                lambda: blob.download_as_text()
            )
            
            # Format result
            result = {
                "name": blob.name,
                "bucket": blob.bucket.name,
                "size": blob.size,
                "content_type": blob.content_type,
                "data": data
            }
            
            return {
                "status": "success",
                "object": result
            }
            
        except Exception as e:
            logger.error(f"Error downloading file as string: {str(e)}")
            return {
                "status": "error",
                "message": str(e)
            }
            
    async def delete_object(self, 
                          bucket_name: str,
                          blob_name: str) -> Dict[str, Any]:
        """
        Delete an object from a bucket.
        
        Args:
            bucket_name: Bucket name
            blob_name: Name of blob to delete
            
        Returns:
            Deletion result
        """
        if not self.client:
            raise RuntimeError("Storage client not initialized")
            
        logger.info(f"Deleting object from bucket: {bucket_name}/{blob_name}")
        
        try:
            # Use asyncio to avoid blocking
            loop = asyncio.get_event_loop()
            
            # Get bucket
            bucket = await loop.run_in_executor(
                None,
                lambda: self.client.get_bucket(bucket_name)
            )
            
            # Get blob
            blob = bucket.blob(blob_name)
            
            # Delete blob
            await loop.run_in_executor(
                None,
                lambda: blob.delete()
            )
            
            return {
                "status": "success",
                "message": f"Object {blob_name} deleted from bucket {bucket_name}"
            }
            
        except Exception as e:
            logger.error(f"Error deleting object: {str(e)}")
            return {
                "status": "error",
                "message": str(e)
            }
            
    async def get_object_metadata(self, 
                                bucket_name: str,
                                blob_name: str) -> Dict[str, Any]:
        """
        Get metadata for an object.
        
        Args:
            bucket_name: Bucket name
            blob_name: Name of blob
            
        Returns:
            Object metadata
        """
        if not self.client:
            raise RuntimeError("Storage client not initialized")
            
        logger.info(f"Getting object metadata: {bucket_name}/{blob_name}")
        
        try:
            # Use asyncio to avoid blocking
            loop = asyncio.get_event_loop()
            
            # Get bucket
            bucket = await loop.run_in_executor(
                None,
                lambda: self.client.get_bucket(bucket_name)
            )
            
            # Get blob
            blob = await loop.run_in_executor(
                None,
                lambda: bucket.get_blob(blob_name)
            )
            
            if not blob:
                return {
                    "status": "error",
                    "message": f"Object {blob_name} not found in bucket {bucket_name}"
                }
                
            # Format result
            result = {
                "name": blob.name,
                "bucket": blob.bucket.name,
                "size": blob.size,
                "content_type": blob.content_type,
                "created": blob.time_created.isoformat() if blob.time_created else None,
                "updated": blob.updated.isoformat() if blob.updated else None,
                "md5_hash": blob.md5_hash,
                "public_url": blob.public_url,
                "metadata": blob.metadata
            }
            
            return {
                "status": "success",
                "object": result
            }
            
        except Exception as e:
            logger.error(f"Error getting object metadata: {str(e)}")
            return {
                "status": "error",
                "message": str(e)
            }
            
    async def generate_signed_url(self, 
                                bucket_name: str,
                                blob_name: str,
                                expiration: int = 3600,
                                method: str = "GET") -> Dict[str, Any]:
        """
        Generate a signed URL for an object.
        
        Args:
            bucket_name: Bucket name
            blob_name: Name of blob
            expiration: URL expiration time in seconds
            method: HTTP method for URL
            
        Returns:
            Signed URL
        """
        if not self.client:
            raise RuntimeError("Storage client not initialized")
            
        logger.info(f"Generating signed URL for: {bucket_name}/{blob_name}")
        
        try:
            # Use asyncio to avoid blocking
            loop = asyncio.get_event_loop()
            
            # Get bucket
            bucket = await loop.run_in_executor(
                None,
                lambda: self.client.get_bucket(bucket_name)
            )
            
            # Get blob
            blob = bucket.blob(blob_name)
            
            # Generate signed URL
            expiration_time = datetime.utcnow() + timedelta(seconds=expiration)
            
            url = await loop.run_in_executor(
                None,
                lambda: blob.generate_signed_url(
                    expiration=expiration_time,
                    method=method
                )
            )
            
            return {
                "status": "success",
                "url": url,
                "expiration": expiration_time.isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error generating signed URL: {str(e)}")
            return {
                "status": "error",
                "message": str(e)
            }
            
    async def make_public(self, 
                        bucket_name: str,
                        blob_name: str) -> Dict[str, Any]:
        """
        Make an object publicly accessible.
        
        Args:
            bucket_name: Bucket name
            blob_name: Name of blob
            
        Returns:
            Public URL
        """
        if not self.client:
            raise RuntimeError("Storage client not initialized")
            
        logger.info(f"Making object public: {bucket_name}/{blob_name}")
        
        try:
            # Use asyncio to avoid blocking
            loop = asyncio.get_event_loop()
            
            # Get bucket
            bucket = await loop.run_in_executor(
                None,
                lambda: self.client.get_bucket(bucket_name)
            )
            
            # Get blob
            blob = bucket.blob(blob_name)
            
            # Make public
            await loop.run_in_executor(
                None,
                lambda: blob.make_public()
            )
            
            return {
                "status": "success",
                "public_url": blob.public_url
            }
            
        except Exception as e:
            logger.error(f"Error making object public: {str(e)}")
            return {
                "status": "error",
                "message": str(e)
            }
            
    async def copy_object(self, 
                        source_bucket_name: str,
                        source_blob_name: str,
                        destination_bucket_name: str,
                        destination_blob_name: Optional[str] = None) -> Dict[str, Any]:
        """
        Copy an object from one location to another.
        
        Args:
            source_bucket_name: Source bucket name
            source_blob_name: Source blob name
            destination_bucket_name: Destination bucket name
            destination_blob_name: Destination blob name (defaults to source name)
            
        Returns:
            Copy result
        """
        if not self.client:
            raise RuntimeError("Storage client not initialized")
            
        # Set destination blob name if not provided
        if not destination_blob_name:
            destination_blob_name = source_blob_name
            
        logger.info(f"Copying object: {source_bucket_name}/{source_blob_name} to {destination_bucket_name}/{destination_blob_name}")
        
        try:
            # Use asyncio to avoid blocking
            loop = asyncio.get_event_loop()
            
            # Get source bucket
            source_bucket = await loop.run_in_executor(
                None,
                lambda: self.client.get_bucket(source_bucket_name)
            )
            
            # Get destination bucket
            destination_bucket = await loop.run_in_executor(
                None,
                lambda: self.client.get_bucket(destination_bucket_name)
            )
            
            # Get source blob
            source_blob = source_bucket.blob(source_blob_name)
            
            # Copy blob
            destination_blob = await loop.run_in_executor(
                None,
                lambda: source_bucket.copy_blob(
                    source_blob,
                    destination_bucket,
                    destination_blob_name
                )
            )
            
            # Format result
            result = {
                "name": destination_blob.name,
                "bucket": destination_blob.bucket.name,
                "size": destination_blob.size,
                "content_type": destination_blob.content_type,
                "created": destination_blob.time_created.isoformat() if destination_blob.time_created else None,
                "updated": destination_blob.updated.isoformat() if destination_blob.updated else None,
                "md5_hash": destination_blob.md5_hash,
                "public_url": destination_blob.public_url
            }
            
            return {
                "status": "success",
                "object": result
            }
            
        except Exception as e:
            logger.error(f"Error copying object: {str(e)}")
            return {
                "status": "error",
                "message": str(e)
            }

