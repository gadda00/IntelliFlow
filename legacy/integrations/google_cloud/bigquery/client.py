"""
BigQuery client for IntelliFlow.

This module provides a client for interacting with Google BigQuery,
including query execution, schema exploration, and data management.
"""

from typing import Dict, List, Any, Optional, Union, Tuple
import asyncio
import logging
import time
import json
import os
import pandas as pd
from datetime import datetime

logger = logging.getLogger("intelliflow.integrations.google_cloud.bigquery")

class BigQueryClient:
    """Client for interacting with Google BigQuery."""
    
    def __init__(self, 
                project_id: str,
                credentials_path: Optional[str] = None,
                location: str = "US"):
        """
        Initialize BigQuery client.
        
        Args:
            project_id: Google Cloud project ID
            credentials_path: Path to service account credentials JSON file
            location: Default location for BigQuery operations
        """
        self.project_id = project_id
        self.credentials_path = credentials_path
        self.location = location
        self.client = None
        
        # Set credentials environment variable if provided
        if credentials_path:
            os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = credentials_path
            
        # Import Google Cloud libraries
        try:
            from google.cloud import bigquery
            self.client = bigquery.Client(project=project_id, location=location)
            logger.info(f"Initialized BigQuery client for project: {project_id}")
        except ImportError:
            logger.error("Failed to import Google Cloud BigQuery libraries")
            raise ImportError("Google Cloud BigQuery libraries not available")
            
    async def execute_query(self, 
                          query: str, 
                          params: Optional[Dict[str, Any]] = None,
                          timeout: Optional[float] = None,
                          dry_run: bool = False,
                          use_cache: bool = True,
                          max_results: Optional[int] = None) -> Dict[str, Any]:
        """
        Execute a BigQuery query.
        
        Args:
            query: SQL query string
            params: Query parameters
            timeout: Query timeout in seconds
            dry_run: Whether to perform a dry run (estimate costs without executing)
            use_cache: Whether to use query cache
            max_results: Maximum number of results to return
            
        Returns:
            Query results
        """
        if not self.client:
            raise RuntimeError("BigQuery client not initialized")
            
        logger.info(f"Executing BigQuery query: {query[:100]}...")
        
        # Configure job options
        job_config = self.client.QueryJobConfig(
            dry_run=dry_run,
            use_query_cache=use_cache
        )
        
        # Set query parameters if provided
        if params:
            from google.cloud.bigquery import ScalarQueryParameter, ArrayQueryParameter, StructQueryParameter
            
            query_params = []
            for name, value in params.items():
                if isinstance(value, list):
                    query_params.append(ArrayQueryParameter(name, "ANY", value))
                elif isinstance(value, dict):
                    query_params.append(StructQueryParameter(name, value))
                else:
                    query_params.append(ScalarQueryParameter(name, "ANY", value))
                    
            job_config.query_parameters = query_params
            
        # Set maximum results if provided
        if max_results:
            job_config.maximum_results = max_results
            
        try:
            # Use asyncio to avoid blocking
            loop = asyncio.get_event_loop()
            start_time = time.time()
            
            # Start query job
            query_job = await loop.run_in_executor(
                None,
                lambda: self.client.query(
                    query,
                    job_config=job_config,
                    timeout=timeout
                )
            )
            
            # If dry run, return cost estimate
            if dry_run:
                bytes_processed = query_job.total_bytes_processed
                return {
                    "status": "success",
                    "dry_run": True,
                    "bytes_processed": bytes_processed,
                    "estimated_cost_usd": bytes_processed * 5 / 1e12  # $5 per TB
                }
                
            # Wait for query to complete
            await loop.run_in_executor(
                None,
                lambda: query_job.result(timeout=timeout)
            )
            
            execution_time = time.time() - start_time
            
            # Get query results
            results = []
            schema = []
            
            # Get schema
            for field in query_job.schema:
                schema.append({
                    "name": field.name,
                    "type": field.field_type,
                    "mode": field.mode,
                    "description": field.description
                })
                
            # Get results
            rows = await loop.run_in_executor(
                None,
                lambda: list(query_job.result())
            )
            
            for row in rows:
                results.append({key: value for key, value in row.items()})
                
            # Return results
            return {
                "status": "success",
                "job_id": query_job.job_id,
                "schema": schema,
                "results": results,
                "total_rows": query_job.total_rows,
                "bytes_processed": query_job.total_bytes_processed,
                "execution_time": execution_time,
                "cache_hit": query_job.cache_hit
            }
            
        except Exception as e:
            logger.error(f"Error executing BigQuery query: {str(e)}")
            return {
                "status": "error",
                "message": str(e)
            }
            
    async def execute_query_to_dataframe(self, 
                                       query: str, 
                                       params: Optional[Dict[str, Any]] = None,
                                       timeout: Optional[float] = None,
                                       use_cache: bool = True,
                                       max_results: Optional[int] = None) -> Union[pd.DataFrame, Dict[str, Any]]:
        """
        Execute a BigQuery query and return results as a pandas DataFrame.
        
        Args:
            query: SQL query string
            params: Query parameters
            timeout: Query timeout in seconds
            use_cache: Whether to use query cache
            max_results: Maximum number of results to return
            
        Returns:
            DataFrame with query results or error dict
        """
        result = await self.execute_query(
            query=query,
            params=params,
            timeout=timeout,
            dry_run=False,
            use_cache=use_cache,
            max_results=max_results
        )
        
        if result["status"] == "error":
            return result
            
        # Convert results to DataFrame
        return pd.DataFrame(result["results"])
        
    async def list_datasets(self) -> Dict[str, Any]:
        """
        List datasets in the project.
        
        Returns:
            List of datasets
        """
        if not self.client:
            raise RuntimeError("BigQuery client not initialized")
            
        logger.info(f"Listing datasets in project: {self.project_id}")
        
        try:
            # Use asyncio to avoid blocking
            loop = asyncio.get_event_loop()
            
            # Get datasets
            datasets = await loop.run_in_executor(
                None,
                lambda: list(self.client.list_datasets())
            )
            
            # Format results
            results = []
            for dataset in datasets:
                results.append({
                    "id": dataset.dataset_id,
                    "full_id": dataset.full_dataset_id,
                    "friendly_name": dataset.friendly_name,
                    "location": dataset.location,
                    "created": dataset.created.isoformat() if dataset.created else None,
                    "modified": dataset.modified.isoformat() if dataset.modified else None
                })
                
            return {
                "status": "success",
                "datasets": results
            }
            
        except Exception as e:
            logger.error(f"Error listing datasets: {str(e)}")
            return {
                "status": "error",
                "message": str(e)
            }
            
    async def list_tables(self, dataset_id: str) -> Dict[str, Any]:
        """
        List tables in a dataset.
        
        Args:
            dataset_id: Dataset ID
            
        Returns:
            List of tables
        """
        if not self.client:
            raise RuntimeError("BigQuery client not initialized")
            
        logger.info(f"Listing tables in dataset: {dataset_id}")
        
        try:
            # Use asyncio to avoid blocking
            loop = asyncio.get_event_loop()
            
            # Get tables
            tables = await loop.run_in_executor(
                None,
                lambda: list(self.client.list_tables(dataset_id))
            )
            
            # Format results
            results = []
            for table in tables:
                results.append({
                    "id": table.table_id,
                    "full_id": f"{self.project_id}.{dataset_id}.{table.table_id}",
                    "type": table.table_type,
                    "created": table.created.isoformat() if hasattr(table, 'created') and table.created else None,
                    "modified": table.modified.isoformat() if hasattr(table, 'modified') and table.modified else None
                })
                
            return {
                "status": "success",
                "tables": results
            }
            
        except Exception as e:
            logger.error(f"Error listing tables: {str(e)}")
            return {
                "status": "error",
                "message": str(e)
            }
            
    async def get_table_schema(self, dataset_id: str, table_id: str) -> Dict[str, Any]:
        """
        Get schema for a table.
        
        Args:
            dataset_id: Dataset ID
            table_id: Table ID
            
        Returns:
            Table schema
        """
        if not self.client:
            raise RuntimeError("BigQuery client not initialized")
            
        logger.info(f"Getting schema for table: {dataset_id}.{table_id}")
        
        try:
            # Use asyncio to avoid blocking
            loop = asyncio.get_event_loop()
            
            # Get table
            table = await loop.run_in_executor(
                None,
                lambda: self.client.get_table(f"{dataset_id}.{table_id}")
            )
            
            # Format schema
            schema = []
            for field in table.schema:
                schema.append({
                    "name": field.name,
                    "type": field.field_type,
                    "mode": field.mode,
                    "description": field.description
                })
                
            # Format table info
            table_info = {
                "id": table.table_id,
                "full_id": f"{self.project_id}.{dataset_id}.{table.table_id}",
                "type": table.table_type,
                "description": table.description,
                "num_rows": table.num_rows,
                "num_bytes": table.num_bytes,
                "created": table.created.isoformat() if table.created else None,
                "modified": table.modified.isoformat() if table.modified else None,
                "schema": schema
            }
            
            return {
                "status": "success",
                "table": table_info
            }
            
        except Exception as e:
            logger.error(f"Error getting table schema: {str(e)}")
            return {
                "status": "error",
                "message": str(e)
            }
            
    async def create_dataset(self, 
                           dataset_id: str,
                           friendly_name: Optional[str] = None,
                           description: Optional[str] = None,
                           location: Optional[str] = None) -> Dict[str, Any]:
        """
        Create a new dataset.
        
        Args:
            dataset_id: Dataset ID
            friendly_name: Human-readable name
            description: Dataset description
            location: Dataset location
            
        Returns:
            Created dataset info
        """
        if not self.client:
            raise RuntimeError("BigQuery client not initialized")
            
        logger.info(f"Creating dataset: {dataset_id}")
        
        try:
            # Use asyncio to avoid blocking
            loop = asyncio.get_event_loop()
            
            # Create dataset reference
            dataset_ref = self.client.dataset(dataset_id)
            
            # Create dataset
            dataset = await loop.run_in_executor(
                None,
                lambda: self.client.create_dataset(
                    dataset_ref,
                    exists_ok=False,
                    location=location or self.location
                )
            )
            
            # Update dataset properties
            if friendly_name or description:
                dataset.friendly_name = friendly_name
                dataset.description = description
                
                await loop.run_in_executor(
                    None,
                    lambda: self.client.update_dataset(
                        dataset,
                        ["friendly_name", "description"]
                    )
                )
                
            # Format result
            result = {
                "id": dataset.dataset_id,
                "full_id": dataset.full_dataset_id,
                "friendly_name": dataset.friendly_name,
                "description": dataset.description,
                "location": dataset.location,
                "created": dataset.created.isoformat() if dataset.created else None,
                "modified": dataset.modified.isoformat() if dataset.modified else None
            }
            
            return {
                "status": "success",
                "dataset": result
            }
            
        except Exception as e:
            logger.error(f"Error creating dataset: {str(e)}")
            return {
                "status": "error",
                "message": str(e)
            }
            
    async def create_table_from_query(self,
                                    dataset_id: str,
                                    table_id: str,
                                    query: str,
                                    params: Optional[Dict[str, Any]] = None,
                                    write_disposition: str = "WRITE_TRUNCATE",
                                    description: Optional[str] = None) -> Dict[str, Any]:
        """
        Create a table from a query.
        
        Args:
            dataset_id: Dataset ID
            table_id: Table ID
            query: SQL query string
            params: Query parameters
            write_disposition: Write disposition (WRITE_TRUNCATE, WRITE_APPEND, WRITE_EMPTY)
            description: Table description
            
        Returns:
            Created table info
        """
        if not self.client:
            raise RuntimeError("BigQuery client not initialized")
            
        logger.info(f"Creating table {dataset_id}.{table_id} from query")
        
        try:
            # Configure job options
            job_config = self.client.QueryJobConfig(
                destination=f"{dataset_id}.{table_id}",
                write_disposition=write_disposition
            )
            
            # Set query parameters if provided
            if params:
                from google.cloud.bigquery import ScalarQueryParameter, ArrayQueryParameter, StructQueryParameter
                
                query_params = []
                for name, value in params.items():
                    if isinstance(value, list):
                        query_params.append(ArrayQueryParameter(name, "ANY", value))
                    elif isinstance(value, dict):
                        query_params.append(StructQueryParameter(name, value))
                    else:
                        query_params.append(ScalarQueryParameter(name, "ANY", value))
                        
                job_config.query_parameters = query_params
                
            # Use asyncio to avoid blocking
            loop = asyncio.get_event_loop()
            
            # Start query job
            query_job = await loop.run_in_executor(
                None,
                lambda: self.client.query(
                    query,
                    job_config=job_config
                )
            )
            
            # Wait for query to complete
            await loop.run_in_executor(
                None,
                lambda: query_job.result()
            )
            
            # Get created table
            table = await loop.run_in_executor(
                None,
                lambda: self.client.get_table(f"{dataset_id}.{table_id}")
            )
            
            # Update description if provided
            if description:
                table.description = description
                
                await loop.run_in_executor(
                    None,
                    lambda: self.client.update_table(
                        table,
                        ["description"]
                    )
                )
                
            # Format schema
            schema = []
            for field in table.schema:
                schema.append({
                    "name": field.name,
                    "type": field.field_type,
                    "mode": field.mode,
                    "description": field.description
                })
                
            # Format table info
            table_info = {
                "id": table.table_id,
                "full_id": f"{self.project_id}.{dataset_id}.{table.table_id}",
                "type": table.table_type,
                "description": table.description,
                "num_rows": table.num_rows,
                "num_bytes": table.num_bytes,
                "created": table.created.isoformat() if table.created else None,
                "modified": table.modified.isoformat() if table.modified else None,
                "schema": schema
            }
            
            return {
                "status": "success",
                "table": table_info,
                "job_id": query_job.job_id,
                "bytes_processed": query_job.total_bytes_processed
            }
            
        except Exception as e:
            logger.error(f"Error creating table from query: {str(e)}")
            return {
                "status": "error",
                "message": str(e)
            }
            
    async def create_table_from_dataframe(self,
                                        dataset_id: str,
                                        table_id: str,
                                        dataframe: pd.DataFrame,
                                        write_disposition: str = "WRITE_TRUNCATE",
                                        description: Optional[str] = None) -> Dict[str, Any]:
        """
        Create a table from a pandas DataFrame.
        
        Args:
            dataset_id: Dataset ID
            table_id: Table ID
            dataframe: Pandas DataFrame
            write_disposition: Write disposition (WRITE_TRUNCATE, WRITE_APPEND, WRITE_EMPTY)
            description: Table description
            
        Returns:
            Created table info
        """
        if not self.client:
            raise RuntimeError("BigQuery client not initialized")
            
        logger.info(f"Creating table {dataset_id}.{table_id} from DataFrame")
        
        try:
            # Configure job options
            job_config = self.client.LoadJobConfig(
                write_disposition=write_disposition
            )
            
            # Use asyncio to avoid blocking
            loop = asyncio.get_event_loop()
            
            # Start load job
            load_job = await loop.run_in_executor(
                None,
                lambda: self.client.load_table_from_dataframe(
                    dataframe,
                    f"{dataset_id}.{table_id}",
                    job_config=job_config
                )
            )
            
            # Wait for job to complete
            await loop.run_in_executor(
                None,
                lambda: load_job.result()
            )
            
            # Get created table
            table = await loop.run_in_executor(
                None,
                lambda: self.client.get_table(f"{dataset_id}.{table_id}")
            )
            
            # Update description if provided
            if description:
                table.description = description
                
                await loop.run_in_executor(
                    None,
                    lambda: self.client.update_table(
                        table,
                        ["description"]
                    )
                )
                
            # Format schema
            schema = []
            for field in table.schema:
                schema.append({
                    "name": field.name,
                    "type": field.field_type,
                    "mode": field.mode,
                    "description": field.description
                })
                
            # Format table info
            table_info = {
                "id": table.table_id,
                "full_id": f"{self.project_id}.{dataset_id}.{table.table_id}",
                "type": table.table_type,
                "description": table.description,
                "num_rows": table.num_rows,
                "num_bytes": table.num_bytes,
                "created": table.created.isoformat() if table.created else None,
                "modified": table.modified.isoformat() if table.modified else None,
                "schema": schema
            }
            
            return {
                "status": "success",
                "table": table_info,
                "job_id": load_job.job_id,
                "bytes_processed": load_job.input_file_bytes
            }
            
        except Exception as e:
            logger.error(f"Error creating table from DataFrame: {str(e)}")
            return {
                "status": "error",
                "message": str(e)
            }
            
    async def delete_table(self, dataset_id: str, table_id: str) -> Dict[str, Any]:
        """
        Delete a table.
        
        Args:
            dataset_id: Dataset ID
            table_id: Table ID
            
        Returns:
            Deletion result
        """
        if not self.client:
            raise RuntimeError("BigQuery client not initialized")
            
        logger.info(f"Deleting table: {dataset_id}.{table_id}")
        
        try:
            # Use asyncio to avoid blocking
            loop = asyncio.get_event_loop()
            
            # Delete table
            await loop.run_in_executor(
                None,
                lambda: self.client.delete_table(f"{dataset_id}.{table_id}")
            )
            
            return {
                "status": "success",
                "message": f"Table {dataset_id}.{table_id} deleted"
            }
            
        except Exception as e:
            logger.error(f"Error deleting table: {str(e)}")
            return {
                "status": "error",
                "message": str(e)
            }
            
    async def delete_dataset(self, dataset_id: str, delete_contents: bool = False) -> Dict[str, Any]:
        """
        Delete a dataset.
        
        Args:
            dataset_id: Dataset ID
            delete_contents: Whether to delete the dataset's contents
            
        Returns:
            Deletion result
        """
        if not self.client:
            raise RuntimeError("BigQuery client not initialized")
            
        logger.info(f"Deleting dataset: {dataset_id}")
        
        try:
            # Use asyncio to avoid blocking
            loop = asyncio.get_event_loop()
            
            # Delete dataset
            await loop.run_in_executor(
                None,
                lambda: self.client.delete_dataset(
                    dataset_id,
                    delete_contents=delete_contents
                )
            )
            
            return {
                "status": "success",
                "message": f"Dataset {dataset_id} deleted"
            }
            
        except Exception as e:
            logger.error(f"Error deleting dataset: {str(e)}")
            return {
                "status": "error",
                "message": str(e)
            }
            
    async def get_job_status(self, job_id: str) -> Dict[str, Any]:
        """
        Get status of a BigQuery job.
        
        Args:
            job_id: Job ID
            
        Returns:
            Job status
        """
        if not self.client:
            raise RuntimeError("BigQuery client not initialized")
            
        logger.info(f"Getting status for job: {job_id}")
        
        try:
            # Use asyncio to avoid blocking
            loop = asyncio.get_event_loop()
            
            # Get job
            job = await loop.run_in_executor(
                None,
                lambda: self.client.get_job(job_id)
            )
            
            # Format job info
            job_info = {
                "id": job.job_id,
                "user_email": job.user_email,
                "created": job.created.isoformat() if job.created else None,
                "started": job.started.isoformat() if job.started else None,
                "ended": job.ended.isoformat() if job.ended else None,
                "state": job.state,
                "error_result": job.error_result,
                "errors": job.errors,
                "location": job.location
            }
            
            # Add job-specific info
            if hasattr(job, "total_bytes_processed"):
                job_info["total_bytes_processed"] = job.total_bytes_processed
                
            if hasattr(job, "total_rows"):
                job_info["total_rows"] = job.total_rows
                
            return {
                "status": "success",
                "job": job_info
            }
            
        except Exception as e:
            logger.error(f"Error getting job status: {str(e)}")
            return {
                "status": "error",
                "message": str(e)
            }
            
    async def cancel_job(self, job_id: str) -> Dict[str, Any]:
        """
        Cancel a BigQuery job.
        
        Args:
            job_id: Job ID
            
        Returns:
            Cancellation result
        """
        if not self.client:
            raise RuntimeError("BigQuery client not initialized")
            
        logger.info(f"Cancelling job: {job_id}")
        
        try:
            # Use asyncio to avoid blocking
            loop = asyncio.get_event_loop()
            
            # Get job
            job = await loop.run_in_executor(
                None,
                lambda: self.client.get_job(job_id)
            )
            
            # Cancel job
            await loop.run_in_executor(
                None,
                lambda: job.cancel()
            )
            
            return {
                "status": "success",
                "message": f"Job {job_id} cancelled"
            }
            
        except Exception as e:
            logger.error(f"Error cancelling job: {str(e)}")
            return {
                "status": "error",
                "message": str(e)
            }

