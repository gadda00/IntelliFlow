"""
Google Cloud Functions client for IntelliFlow.

This module provides a client for interacting with Google Cloud Functions,
including function deployment, management, and invocation.
"""

from typing import Dict, List, Any, Optional, Union, Tuple
import asyncio
import logging
import time
import json
import os
import base64
import zipfile
import tempfile
import shutil
from datetime import datetime
import requests

logger = logging.getLogger("intelliflow.integrations.google_cloud.functions")

class CloudFunctionsClient:
    """Client for interacting with Google Cloud Functions."""
    
    def __init__(self, 
                project_id: str,
                region: str = "us-central1",
                credentials_path: Optional[str] = None):
        """
        Initialize Cloud Functions client.
        
        Args:
            project_id: Google Cloud project ID
            region: Cloud Functions region
            credentials_path: Path to service account credentials JSON file
        """
        self.project_id = project_id
        self.region = region
        self.credentials_path = credentials_path
        self.client = None
        
        # Set credentials environment variable if provided
        if credentials_path:
            os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = credentials_path
            
        # Import Google Cloud libraries
        try:
            from google.cloud import functions_v1
            self.client = functions_v1.CloudFunctionsServiceClient()
            logger.info(f"Initialized Cloud Functions client for project: {project_id}")
        except ImportError:
            logger.error("Failed to import Google Cloud Functions libraries")
            raise ImportError("Google Cloud Functions libraries not available")
            
    async def list_functions(self) -> Dict[str, Any]:
        """
        List functions in the project.
        
        Returns:
            List of functions
        """
        if not self.client:
            raise RuntimeError("Cloud Functions client not initialized")
            
        logger.info(f"Listing functions in project: {self.project_id}")
        
        try:
            # Use asyncio to avoid blocking
            loop = asyncio.get_event_loop()
            
            # Get functions
            parent = f"projects/{self.project_id}/locations/{self.region}"
            functions = await loop.run_in_executor(
                None,
                lambda: list(self.client.list_functions(request={"parent": parent}))
            )
            
            # Format results
            results = []
            for function in functions:
                function_name = function.name.split('/')[-1]
                results.append({
                    "name": function_name,
                    "full_name": function.name,
                    "description": function.description,
                    "status": function.status.name if hasattr(function.status, 'name') else None,
                    "entry_point": function.entry_point,
                    "runtime": function.runtime,
                    "timeout": function.timeout.seconds if hasattr(function, 'timeout') else None,
                    "available_memory_mb": function.available_memory_mb,
                    "service_account_email": function.service_account_email,
                    "update_time": function.update_time.isoformat() if hasattr(function, 'update_time') else None,
                    "version_id": function.version_id,
                    "labels": dict(function.labels) if hasattr(function, 'labels') else {},
                    "environment_variables": dict(function.environment_variables) if hasattr(function, 'environment_variables') else {}
                })
                
            return {
                "status": "success",
                "functions": results
            }
            
        except Exception as e:
            logger.error(f"Error listing functions: {str(e)}")
            return {
                "status": "error",
                "message": str(e)
            }
            
    async def get_function(self, function_name: str) -> Dict[str, Any]:
        """
        Get function details.
        
        Args:
            function_name: Function name
            
        Returns:
            Function details
        """
        if not self.client:
            raise RuntimeError("Cloud Functions client not initialized")
            
        logger.info(f"Getting function: {function_name}")
        
        try:
            # Use asyncio to avoid blocking
            loop = asyncio.get_event_loop()
            
            # Get function
            name = f"projects/{self.project_id}/locations/{self.region}/functions/{function_name}"
            function = await loop.run_in_executor(
                None,
                lambda: self.client.get_function(request={"name": name})
            )
            
            # Format result
            result = {
                "name": function_name,
                "full_name": function.name,
                "description": function.description,
                "status": function.status.name if hasattr(function.status, 'name') else None,
                "entry_point": function.entry_point,
                "runtime": function.runtime,
                "timeout": function.timeout.seconds if hasattr(function, 'timeout') else None,
                "available_memory_mb": function.available_memory_mb,
                "service_account_email": function.service_account_email,
                "update_time": function.update_time.isoformat() if hasattr(function, 'update_time') else None,
                "version_id": function.version_id,
                "labels": dict(function.labels) if hasattr(function, 'labels') else {},
                "environment_variables": dict(function.environment_variables) if hasattr(function, 'environment_variables') else {}
            }
            
            # Add trigger info
            if hasattr(function, 'https_trigger'):
                result["trigger_type"] = "https"
                result["url"] = function.https_trigger.url
            elif hasattr(function, 'event_trigger'):
                result["trigger_type"] = "event"
                result["event_type"] = function.event_trigger.event_type
                result["resource"] = function.event_trigger.resource
                result["service"] = function.event_trigger.service
            
            return {
                "status": "success",
                "function": result
            }
            
        except Exception as e:
            logger.error(f"Error getting function: {str(e)}")
            return {
                "status": "error",
                "message": str(e)
            }
            
    async def delete_function(self, function_name: str) -> Dict[str, Any]:
        """
        Delete a function.
        
        Args:
            function_name: Function name
            
        Returns:
            Deletion result
        """
        if not self.client:
            raise RuntimeError("Cloud Functions client not initialized")
            
        logger.info(f"Deleting function: {function_name}")
        
        try:
            # Use asyncio to avoid blocking
            loop = asyncio.get_event_loop()
            
            # Delete function
            name = f"projects/{self.project_id}/locations/{self.region}/functions/{function_name}"
            operation = await loop.run_in_executor(
                None,
                lambda: self.client.delete_function(request={"name": name})
            )
            
            # Wait for operation to complete
            await loop.run_in_executor(
                None,
                lambda: operation.result()
            )
            
            return {
                "status": "success",
                "message": f"Function {function_name} deleted"
            }
            
        except Exception as e:
            logger.error(f"Error deleting function: {str(e)}")
            return {
                "status": "error",
                "message": str(e)
            }
            
    async def call_function(self, 
                          function_name: str,
                          data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Call a function.
        
        Args:
            function_name: Function name
            data: Function data
            
        Returns:
            Function result
        """
        if not self.client:
            raise RuntimeError("Cloud Functions client not initialized")
            
        logger.info(f"Calling function: {function_name}")
        
        try:
            # Use asyncio to avoid blocking
            loop = asyncio.get_event_loop()
            
            # Get function
            name = f"projects/{self.project_id}/locations/{self.region}/functions/{function_name}"
            function = await loop.run_in_executor(
                None,
                lambda: self.client.get_function(request={"name": name})
            )
            
            # Check if function is HTTP trigger
            if not hasattr(function, 'https_trigger'):
                return {
                    "status": "error",
                    "message": f"Function {function_name} is not an HTTP trigger function"
                }
                
            # Get function URL
            url = function.https_trigger.url
            
            # Call function
            if data:
                response = await loop.run_in_executor(
                    None,
                    lambda: requests.post(url, json=data)
                )
            else:
                response = await loop.run_in_executor(
                    None,
                    lambda: requests.get(url)
                )
                
            # Parse response
            try:
                result = response.json()
            except:
                result = response.text
                
            return {
                "status": "success",
                "result": result,
                "status_code": response.status_code
            }
            
        except Exception as e:
            logger.error(f"Error calling function: {str(e)}")
            return {
                "status": "error",
                "message": str(e)
            }
            
    async def deploy_function(self, 
                            function_name: str,
                            source_dir: str,
                            entry_point: str,
                            runtime: str = "python39",
                            trigger_http: bool = True,
                            memory_mb: int = 256,
                            timeout_sec: int = 60,
                            environment_variables: Optional[Dict[str, str]] = None,
                            description: Optional[str] = None) -> Dict[str, Any]:
        """
        Deploy a function.
        
        Args:
            function_name: Function name
            source_dir: Source directory
            entry_point: Entry point function
            runtime: Runtime
            trigger_http: Whether to trigger via HTTP
            memory_mb: Memory in MB
            timeout_sec: Timeout in seconds
            environment_variables: Environment variables
            description: Function description
            
        Returns:
            Deployment result
        """
        if not self.client:
            raise RuntimeError("Cloud Functions client not initialized")
            
        logger.info(f"Deploying function: {function_name}")
        
        try:
            # Use asyncio to avoid blocking
            loop = asyncio.get_event_loop()
            
            # Create temp directory for source
            with tempfile.TemporaryDirectory() as temp_dir:
                # Create zip file
                zip_path = os.path.join(temp_dir, "function.zip")
                
                with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                    for root, dirs, files in os.walk(source_dir):
                        for file in files:
                            file_path = os.path.join(root, file)
                            arcname = os.path.relpath(file_path, source_dir)
                            zipf.write(file_path, arcname)
                            
                # Upload source to Cloud Storage
                from google.cloud import storage
                storage_client = storage.Client(project=self.project_id)
                
                # Create bucket if it doesn't exist
                bucket_name = f"{self.project_id}-cloud-functions"
                try:
                    bucket = storage_client.get_bucket(bucket_name)
                except:
                    bucket = storage_client.create_bucket(bucket_name, location=self.region)
                    
                # Upload zip file
                blob_name = f"{function_name}-{int(time.time())}.zip"
                blob = bucket.blob(blob_name)
                await loop.run_in_executor(
                    None,
                    lambda: blob.upload_from_filename(zip_path)
                )
                
                # Create function
                parent = f"projects/{self.project_id}/locations/{self.region}"
                
                # Create function object
                from google.cloud.functions_v1 import CloudFunction
                from google.protobuf.duration_pb2 import Duration
                
                function = CloudFunction()
                function.name = f"{parent}/functions/{function_name}"
                function.description = description or ""
                function.entry_point = entry_point
                function.runtime = runtime
                
                # Set timeout
                timeout = Duration()
                timeout.seconds = timeout_sec
                function.timeout = timeout
                
                # Set memory
                function.available_memory_mb = memory_mb
                
                # Set environment variables
                if environment_variables:
                    function.environment_variables = environment_variables
                    
                # Set source
                function.source_archive_url = f"gs://{bucket_name}/{blob_name}"
                
                # Set trigger
                if trigger_http:
                    from google.cloud.functions_v1 import HttpsTrigger
                    function.https_trigger = HttpsTrigger()
                    
                # Deploy function
                operation = await loop.run_in_executor(
                    None,
                    lambda: self.client.create_function(request={"location": parent, "function": function})
                )
                
                # Wait for operation to complete
                result = await loop.run_in_executor(
                    None,
                    lambda: operation.result()
                )
                
                # Format result
                function_result = {
                    "name": function_name,
                    "full_name": result.name,
                    "description": result.description,
                    "status": result.status.name if hasattr(result.status, 'name') else None,
                    "entry_point": result.entry_point,
                    "runtime": result.runtime,
                    "timeout": result.timeout.seconds if hasattr(result, 'timeout') else None,
                    "available_memory_mb": result.available_memory_mb,
                    "update_time": result.update_time.isoformat() if hasattr(result, 'update_time') else None,
                    "version_id": result.version_id
                }
                
                # Add trigger info
                if hasattr(result, 'https_trigger'):
                    function_result["trigger_type"] = "https"
                    function_result["url"] = result.https_trigger.url
                    
                return {
                    "status": "success",
                    "function": function_result
                }
                
        except Exception as e:
            logger.error(f"Error deploying function: {str(e)}")
            return {
                "status": "error",
                "message": str(e)
            }
            
    async def update_function(self, 
                            function_name: str,
                            source_dir: Optional[str] = None,
                            entry_point: Optional[str] = None,
                            memory_mb: Optional[int] = None,
                            timeout_sec: Optional[int] = None,
                            environment_variables: Optional[Dict[str, str]] = None,
                            description: Optional[str] = None) -> Dict[str, Any]:
        """
        Update a function.
        
        Args:
            function_name: Function name
            source_dir: Source directory
            entry_point: Entry point function
            memory_mb: Memory in MB
            timeout_sec: Timeout in seconds
            environment_variables: Environment variables
            description: Function description
            
        Returns:
            Update result
        """
        if not self.client:
            raise RuntimeError("Cloud Functions client not initialized")
            
        logger.info(f"Updating function: {function_name}")
        
        try:
            # Use asyncio to avoid blocking
            loop = asyncio.get_event_loop()
            
            # Get function
            name = f"projects/{self.project_id}/locations/{self.region}/functions/{function_name}"
            function = await loop.run_in_executor(
                None,
                lambda: self.client.get_function(request={"name": name})
            )
            
            # Create update mask
            update_mask = []
            
            # Update source if provided
            if source_dir:
                # Create temp directory for source
                with tempfile.TemporaryDirectory() as temp_dir:
                    # Create zip file
                    zip_path = os.path.join(temp_dir, "function.zip")
                    
                    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                        for root, dirs, files in os.walk(source_dir):
                            for file in files:
                                file_path = os.path.join(root, file)
                                arcname = os.path.relpath(file_path, source_dir)
                                zipf.write(file_path, arcname)
                                
                    # Upload source to Cloud Storage
                    from google.cloud import storage
                    storage_client = storage.Client(project=self.project_id)
                    
                    # Create bucket if it doesn't exist
                    bucket_name = f"{self.project_id}-cloud-functions"
                    try:
                        bucket = storage_client.get_bucket(bucket_name)
                    except:
                        bucket = storage_client.create_bucket(bucket_name, location=self.region)
                        
                    # Upload zip file
                    blob_name = f"{function_name}-{int(time.time())}.zip"
                    blob = bucket.blob(blob_name)
                    await loop.run_in_executor(
                        None,
                        lambda: blob.upload_from_filename(zip_path)
                    )
                    
                    # Update source
                    function.source_archive_url = f"gs://{bucket_name}/{blob_name}"
                    update_mask.append("source_archive_url")
                    
            # Update entry point if provided
            if entry_point:
                function.entry_point = entry_point
                update_mask.append("entry_point")
                
            # Update memory if provided
            if memory_mb:
                function.available_memory_mb = memory_mb
                update_mask.append("available_memory_mb")
                
            # Update timeout if provided
            if timeout_sec:
                from google.protobuf.duration_pb2 import Duration
                timeout = Duration()
                timeout.seconds = timeout_sec
                function.timeout = timeout
                update_mask.append("timeout")
                
            # Update environment variables if provided
            if environment_variables:
                function.environment_variables = environment_variables
                update_mask.append("environment_variables")
                
            # Update description if provided
            if description:
                function.description = description
                update_mask.append("description")
                
            # Update function
            operation = await loop.run_in_executor(
                None,
                lambda: self.client.update_function(request={"function": function, "update_mask": {"paths": update_mask}})
            )
            
            # Wait for operation to complete
            result = await loop.run_in_executor(
                None,
                lambda: operation.result()
            )
            
            # Format result
            function_result = {
                "name": function_name,
                "full_name": result.name,
                "description": result.description,
                "status": result.status.name if hasattr(result.status, 'name') else None,
                "entry_point": result.entry_point,
                "runtime": result.runtime,
                "timeout": result.timeout.seconds if hasattr(result, 'timeout') else None,
                "available_memory_mb": result.available_memory_mb,
                "update_time": result.update_time.isoformat() if hasattr(result, 'update_time') else None,
                "version_id": result.version_id
            }
            
            # Add trigger info
            if hasattr(result, 'https_trigger'):
                function_result["trigger_type"] = "https"
                function_result["url"] = result.https_trigger.url
                
            return {
                "status": "success",
                "function": function_result
            }
            
        except Exception as e:
            logger.error(f"Error updating function: {str(e)}")
            return {
                "status": "error",
                "message": str(e)
            }
            
    async def get_function_logs(self, 
                              function_name: str,
                              limit: int = 100,
                              min_severity: str = "DEFAULT") -> Dict[str, Any]:
        """
        Get function logs.
        
        Args:
            function_name: Function name
            limit: Maximum number of logs
            min_severity: Minimum severity level
            
        Returns:
            Function logs
        """
        if not self.client:
            raise RuntimeError("Cloud Functions client not initialized")
            
        logger.info(f"Getting logs for function: {function_name}")
        
        try:
            # Use asyncio to avoid blocking
            loop = asyncio.get_event_loop()
            
            # Import logging client
            from google.cloud import logging_v2
            logging_client = logging_v2.LoggingServiceV2Client()
            
            # Set filter
            filter_str = f'resource.type="cloud_function" AND resource.labels.function_name="{function_name}" AND resource.labels.region="{self.region}"'
            
            # Set severity filter
            severity_levels = ["DEFAULT", "DEBUG", "INFO", "NOTICE", "WARNING", "ERROR", "CRITICAL", "ALERT", "EMERGENCY"]
            min_severity_index = severity_levels.index(min_severity)
            severity_filters = []
            
            for severity in severity_levels[min_severity_index:]:
                severity_filters.append(f'severity="{severity}"')
                
            filter_str += f" AND ({' OR '.join(severity_filters)})"
            
            # Get logs
            project_path = f"projects/{self.project_id}"
            entries = await loop.run_in_executor(
                None,
                lambda: logging_client.list_log_entries(
                    request={
                        "resource_names": [project_path],
                        "filter": filter_str,
                        "page_size": limit,
                        "order_by": "timestamp desc"
                    }
                )
            )
            
            # Format results
            results = []
            for entry in entries:
                # Extract message
                if hasattr(entry, 'text_payload'):
                    message = entry.text_payload
                elif hasattr(entry, 'json_payload'):
                    message = json.dumps(dict(entry.json_payload))
                else:
                    message = str(entry)
                    
                results.append({
                    "timestamp": entry.timestamp.isoformat() if hasattr(entry, 'timestamp') else None,
                    "severity": entry.severity.name if hasattr(entry, 'severity') else None,
                    "message": message,
                    "trace": entry.trace if hasattr(entry, 'trace') else None
                })
                
            return {
                "status": "success",
                "logs": results
            }
            
        except Exception as e:
            logger.error(f"Error getting function logs: {str(e)}")
            return {
                "status": "error",
                "message": str(e)
            }

