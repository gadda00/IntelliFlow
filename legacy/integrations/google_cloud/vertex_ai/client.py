"""
Vertex AI client for IntelliFlow.

This module provides a client for interacting with Google Vertex AI,
including model training, prediction, and management.
"""

from typing import Dict, List, Any, Optional, Union, Tuple
import asyncio
import logging
import time
import json
import os
import pandas as pd
from datetime import datetime

logger = logging.getLogger("intelliflow.integrations.google_cloud.vertex_ai")

class VertexAIClient:
    """Client for interacting with Google Vertex AI."""
    
    def __init__(self, 
                project_id: str,
                location: str = "us-central1",
                credentials_path: Optional[str] = None):
        """
        Initialize Vertex AI client.
        
        Args:
            project_id: Google Cloud project ID
            location: Vertex AI location
            credentials_path: Path to service account credentials JSON file
        """
        self.project_id = project_id
        self.location = location
        self.credentials_path = credentials_path
        self.aiplatform = None
        
        # Set credentials environment variable if provided
        if credentials_path:
            os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = credentials_path
            
        # Import Google Cloud libraries
        try:
            from google.cloud import aiplatform
            self.aiplatform = aiplatform
            self.aiplatform.init(project=project_id, location=location)
            logger.info(f"Initialized Vertex AI client for project: {project_id}")
        except ImportError:
            logger.error("Failed to import Google Cloud Vertex AI libraries")
            raise ImportError("Google Cloud Vertex AI libraries not available")
            
    async def list_models(self) -> Dict[str, Any]:
        """
        List models in the project.
        
        Returns:
            List of models
        """
        if not self.aiplatform:
            raise RuntimeError("Vertex AI client not initialized")
            
        logger.info(f"Listing models in project: {self.project_id}")
        
        try:
            # Use asyncio to avoid blocking
            loop = asyncio.get_event_loop()
            
            # Get models
            models = await loop.run_in_executor(
                None,
                lambda: self.aiplatform.Model.list()
            )
            
            # Format results
            results = []
            for model in models:
                results.append({
                    "name": model.display_name,
                    "resource_name": model.resource_name,
                    "version_id": model.version_id,
                    "create_time": model.create_time.isoformat() if hasattr(model, 'create_time') else None,
                    "update_time": model.update_time.isoformat() if hasattr(model, 'update_time') else None
                })
                
            return {
                "status": "success",
                "models": results
            }
            
        except Exception as e:
            logger.error(f"Error listing models: {str(e)}")
            return {
                "status": "error",
                "message": str(e)
            }
            
    async def get_model(self, model_id: str) -> Dict[str, Any]:
        """
        Get model details.
        
        Args:
            model_id: Model ID
            
        Returns:
            Model details
        """
        if not self.aiplatform:
            raise RuntimeError("Vertex AI client not initialized")
            
        logger.info(f"Getting model: {model_id}")
        
        try:
            # Use asyncio to avoid blocking
            loop = asyncio.get_event_loop()
            
            # Get model
            model = await loop.run_in_executor(
                None,
                lambda: self.aiplatform.Model(model_id)
            )
            
            # Format result
            result = {
                "name": model.display_name,
                "resource_name": model.resource_name,
                "version_id": model.version_id,
                "create_time": model.create_time.isoformat() if hasattr(model, 'create_time') else None,
                "update_time": model.update_time.isoformat() if hasattr(model, 'update_time') else None,
                "description": model.description if hasattr(model, 'description') else None,
                "metadata": model.metadata.to_dict() if hasattr(model, 'metadata') else {}
            }
            
            return {
                "status": "success",
                "model": result
            }
            
        except Exception as e:
            logger.error(f"Error getting model: {str(e)}")
            return {
                "status": "error",
                "message": str(e)
            }
            
    async def predict(self, 
                     model_id: str, 
                     instances: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Make predictions with a model.
        
        Args:
            model_id: Model ID
            instances: Instances to predict
            
        Returns:
            Prediction results
        """
        if not self.aiplatform:
            raise RuntimeError("Vertex AI client not initialized")
            
        logger.info(f"Making predictions with model: {model_id}")
        
        try:
            # Use asyncio to avoid blocking
            loop = asyncio.get_event_loop()
            
            # Get model
            model = await loop.run_in_executor(
                None,
                lambda: self.aiplatform.Model(model_id)
            )
            
            # Make predictions
            predictions = await loop.run_in_executor(
                None,
                lambda: model.predict(instances=instances)
            )
            
            # Format results
            result = {
                "predictions": predictions.predictions,
                "deployed_model_id": predictions.deployed_model_id,
                "model_version_id": predictions.model_version_id
            }
            
            return {
                "status": "success",
                "result": result
            }
            
        except Exception as e:
            logger.error(f"Error making predictions: {str(e)}")
            return {
                "status": "error",
                "message": str(e)
            }
            
    async def batch_predict(self, 
                          model_id: str, 
                          source_uri: str,
                          destination_uri: str,
                          machine_type: str = "n1-standard-4") -> Dict[str, Any]:
        """
        Make batch predictions with a model.
        
        Args:
            model_id: Model ID
            source_uri: URI of the input data
            destination_uri: URI for the output data
            machine_type: Machine type for batch prediction
            
        Returns:
            Batch prediction job details
        """
        if not self.aiplatform:
            raise RuntimeError("Vertex AI client not initialized")
            
        logger.info(f"Starting batch prediction with model: {model_id}")
        
        try:
            # Use asyncio to avoid blocking
            loop = asyncio.get_event_loop()
            
            # Get model
            model = await loop.run_in_executor(
                None,
                lambda: self.aiplatform.Model(model_id)
            )
            
            # Start batch prediction job
            batch_prediction_job = await loop.run_in_executor(
                None,
                lambda: model.batch_predict(
                    job_display_name=f"batch_predict_{int(time.time())}",
                    gcs_source=source_uri,
                    gcs_destination_prefix=destination_uri,
                    machine_type=machine_type
                )
            )
            
            # Format result
            result = {
                "job_id": batch_prediction_job.resource_name,
                "display_name": batch_prediction_job.display_name,
                "state": batch_prediction_job.state.name if hasattr(batch_prediction_job.state, 'name') else None,
                "create_time": batch_prediction_job.create_time.isoformat() if hasattr(batch_prediction_job, 'create_time') else None,
                "start_time": batch_prediction_job.start_time.isoformat() if hasattr(batch_prediction_job, 'start_time') else None,
                "end_time": batch_prediction_job.end_time.isoformat() if hasattr(batch_prediction_job, 'end_time') else None,
                "output_info": {
                    "gcs_output_directory": batch_prediction_job.output_info.gcs_output_directory if hasattr(batch_prediction_job, 'output_info') else None
                }
            }
            
            return {
                "status": "success",
                "job": result
            }
            
        except Exception as e:
            logger.error(f"Error starting batch prediction: {str(e)}")
            return {
                "status": "error",
                "message": str(e)
            }
            
    async def get_batch_prediction_job(self, job_id: str) -> Dict[str, Any]:
        """
        Get batch prediction job details.
        
        Args:
            job_id: Job ID
            
        Returns:
            Batch prediction job details
        """
        if not self.aiplatform:
            raise RuntimeError("Vertex AI client not initialized")
            
        logger.info(f"Getting batch prediction job: {job_id}")
        
        try:
            # Use asyncio to avoid blocking
            loop = asyncio.get_event_loop()
            
            # Get job
            job = await loop.run_in_executor(
                None,
                lambda: self.aiplatform.BatchPredictionJob(job_id)
            )
            
            # Format result
            result = {
                "job_id": job.resource_name,
                "display_name": job.display_name,
                "state": job.state.name if hasattr(job.state, 'name') else None,
                "create_time": job.create_time.isoformat() if hasattr(job, 'create_time') else None,
                "start_time": job.start_time.isoformat() if hasattr(job, 'start_time') else None,
                "end_time": job.end_time.isoformat() if hasattr(job, 'end_time') else None,
                "output_info": {
                    "gcs_output_directory": job.output_info.gcs_output_directory if hasattr(job, 'output_info') else None
                },
                "error": job.error.message if hasattr(job, 'error') and job.error else None
            }
            
            return {
                "status": "success",
                "job": result
            }
            
        except Exception as e:
            logger.error(f"Error getting batch prediction job: {str(e)}")
            return {
                "status": "error",
                "message": str(e)
            }
            
    async def list_endpoints(self) -> Dict[str, Any]:
        """
        List endpoints in the project.
        
        Returns:
            List of endpoints
        """
        if not self.aiplatform:
            raise RuntimeError("Vertex AI client not initialized")
            
        logger.info(f"Listing endpoints in project: {self.project_id}")
        
        try:
            # Use asyncio to avoid blocking
            loop = asyncio.get_event_loop()
            
            # Get endpoints
            endpoints = await loop.run_in_executor(
                None,
                lambda: self.aiplatform.Endpoint.list()
            )
            
            # Format results
            results = []
            for endpoint in endpoints:
                results.append({
                    "name": endpoint.display_name,
                    "resource_name": endpoint.resource_name,
                    "create_time": endpoint.create_time.isoformat() if hasattr(endpoint, 'create_time') else None,
                    "update_time": endpoint.update_time.isoformat() if hasattr(endpoint, 'update_time') else None
                })
                
            return {
                "status": "success",
                "endpoints": results
            }
            
        except Exception as e:
            logger.error(f"Error listing endpoints: {str(e)}")
            return {
                "status": "error",
                "message": str(e)
            }
            
    async def deploy_model(self, 
                         model_id: str, 
                         endpoint_name: Optional[str] = None,
                         machine_type: str = "n1-standard-4",
                         min_replica_count: int = 1,
                         max_replica_count: int = 1) -> Dict[str, Any]:
        """
        Deploy a model to an endpoint.
        
        Args:
            model_id: Model ID
            endpoint_name: Endpoint name (creates new if None)
            machine_type: Machine type for deployment
            min_replica_count: Minimum number of replicas
            max_replica_count: Maximum number of replicas
            
        Returns:
            Deployment details
        """
        if not self.aiplatform:
            raise RuntimeError("Vertex AI client not initialized")
            
        logger.info(f"Deploying model: {model_id}")
        
        try:
            # Use asyncio to avoid blocking
            loop = asyncio.get_event_loop()
            
            # Get model
            model = await loop.run_in_executor(
                None,
                lambda: self.aiplatform.Model(model_id)
            )
            
            # Create or get endpoint
            if endpoint_name:
                # Try to get existing endpoint
                try:
                    endpoint = await loop.run_in_executor(
                        None,
                        lambda: self.aiplatform.Endpoint.list(
                            filter=f'display_name="{endpoint_name}"'
                        )
                    )
                    
                    if endpoint:
                        endpoint = endpoint[0]
                    else:
                        # Create new endpoint
                        endpoint = await loop.run_in_executor(
                            None,
                            lambda: self.aiplatform.Endpoint.create(
                                display_name=endpoint_name
                            )
                        )
                except:
                    # Create new endpoint
                    endpoint = await loop.run_in_executor(
                        None,
                        lambda: self.aiplatform.Endpoint.create(
                            display_name=endpoint_name
                        )
                    )
            else:
                # Create new endpoint
                endpoint_name = f"endpoint_{int(time.time())}"
                endpoint = await loop.run_in_executor(
                    None,
                    lambda: self.aiplatform.Endpoint.create(
                        display_name=endpoint_name
                    )
                )
                
            # Deploy model to endpoint
            deployed_model = await loop.run_in_executor(
                None,
                lambda: model.deploy(
                    endpoint=endpoint,
                    deployed_model_display_name=f"deployed_{int(time.time())}",
                    machine_type=machine_type,
                    min_replica_count=min_replica_count,
                    max_replica_count=max_replica_count
                )
            )
            
            # Format result
            result = {
                "endpoint_id": endpoint.resource_name,
                "endpoint_name": endpoint.display_name,
                "deployed_model_id": deployed_model.id if hasattr(deployed_model, 'id') else None,
                "model_id": model.resource_name
            }
            
            return {
                "status": "success",
                "deployment": result
            }
            
        except Exception as e:
            logger.error(f"Error deploying model: {str(e)}")
            return {
                "status": "error",
                "message": str(e)
            }
            
    async def undeploy_model(self, 
                           endpoint_id: str, 
                           deployed_model_id: str) -> Dict[str, Any]:
        """
        Undeploy a model from an endpoint.
        
        Args:
            endpoint_id: Endpoint ID
            deployed_model_id: Deployed model ID
            
        Returns:
            Undeployment details
        """
        if not self.aiplatform:
            raise RuntimeError("Vertex AI client not initialized")
            
        logger.info(f"Undeploying model: {deployed_model_id}")
        
        try:
            # Use asyncio to avoid blocking
            loop = asyncio.get_event_loop()
            
            # Get endpoint
            endpoint = await loop.run_in_executor(
                None,
                lambda: self.aiplatform.Endpoint(endpoint_id)
            )
            
            # Undeploy model
            await loop.run_in_executor(
                None,
                lambda: endpoint.undeploy(deployed_model_id=deployed_model_id)
            )
            
            return {
                "status": "success",
                "message": f"Model {deployed_model_id} undeployed from endpoint {endpoint_id}"
            }
            
        except Exception as e:
            logger.error(f"Error undeploying model: {str(e)}")
            return {
                "status": "error",
                "message": str(e)
            }
            
    async def delete_endpoint(self, endpoint_id: str) -> Dict[str, Any]:
        """
        Delete an endpoint.
        
        Args:
            endpoint_id: Endpoint ID
            
        Returns:
            Deletion details
        """
        if not self.aiplatform:
            raise RuntimeError("Vertex AI client not initialized")
            
        logger.info(f"Deleting endpoint: {endpoint_id}")
        
        try:
            # Use asyncio to avoid blocking
            loop = asyncio.get_event_loop()
            
            # Get endpoint
            endpoint = await loop.run_in_executor(
                None,
                lambda: self.aiplatform.Endpoint(endpoint_id)
            )
            
            # Delete endpoint
            await loop.run_in_executor(
                None,
                lambda: endpoint.delete()
            )
            
            return {
                "status": "success",
                "message": f"Endpoint {endpoint_id} deleted"
            }
            
        except Exception as e:
            logger.error(f"Error deleting endpoint: {str(e)}")
            return {
                "status": "error",
                "message": str(e)
            }
            
    async def create_dataset(self, 
                           display_name: str,
                           metadata_schema_uri: str,
                           source_uri: Optional[str] = None) -> Dict[str, Any]:
        """
        Create a dataset.
        
        Args:
            display_name: Dataset display name
            metadata_schema_uri: Metadata schema URI
            source_uri: Optional source URI
            
        Returns:
            Dataset details
        """
        if not self.aiplatform:
            raise RuntimeError("Vertex AI client not initialized")
            
        logger.info(f"Creating dataset: {display_name}")
        
        try:
            # Use asyncio to avoid blocking
            loop = asyncio.get_event_loop()
            
            # Create dataset
            if source_uri:
                dataset = await loop.run_in_executor(
                    None,
                    lambda: self.aiplatform.Dataset.create(
                        display_name=display_name,
                        metadata_schema_uri=metadata_schema_uri,
                        gcs_source=source_uri
                    )
                )
            else:
                dataset = await loop.run_in_executor(
                    None,
                    lambda: self.aiplatform.Dataset.create(
                        display_name=display_name,
                        metadata_schema_uri=metadata_schema_uri
                    )
                )
                
            # Format result
            result = {
                "dataset_id": dataset.resource_name,
                "display_name": dataset.display_name,
                "metadata_schema_uri": dataset.metadata_schema_uri,
                "create_time": dataset.create_time.isoformat() if hasattr(dataset, 'create_time') else None,
                "update_time": dataset.update_time.isoformat() if hasattr(dataset, 'update_time') else None
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
            
    async def list_datasets(self) -> Dict[str, Any]:
        """
        List datasets in the project.
        
        Returns:
            List of datasets
        """
        if not self.aiplatform:
            raise RuntimeError("Vertex AI client not initialized")
            
        logger.info(f"Listing datasets in project: {self.project_id}")
        
        try:
            # Use asyncio to avoid blocking
            loop = asyncio.get_event_loop()
            
            # Get datasets
            datasets = await loop.run_in_executor(
                None,
                lambda: self.aiplatform.Dataset.list()
            )
            
            # Format results
            results = []
            for dataset in datasets:
                results.append({
                    "dataset_id": dataset.resource_name,
                    "display_name": dataset.display_name,
                    "metadata_schema_uri": dataset.metadata_schema_uri,
                    "create_time": dataset.create_time.isoformat() if hasattr(dataset, 'create_time') else None,
                    "update_time": dataset.update_time.isoformat() if hasattr(dataset, 'update_time') else None
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
            
    async def create_training_job(self, 
                                display_name: str,
                                training_task_definition: str,
                                training_task_inputs: Dict[str, Any],
                                base_output_dir: str,
                                model_display_name: str) -> Dict[str, Any]:
        """
        Create a custom training job.
        
        Args:
            display_name: Job display name
            training_task_definition: Training task definition
            training_task_inputs: Training task inputs
            base_output_dir: Base output directory
            model_display_name: Model display name
            
        Returns:
            Training job details
        """
        if not self.aiplatform:
            raise RuntimeError("Vertex AI client not initialized")
            
        logger.info(f"Creating training job: {display_name}")
        
        try:
            # Use asyncio to avoid blocking
            loop = asyncio.get_event_loop()
            
            # Create training job
            job = await loop.run_in_executor(
                None,
                lambda: self.aiplatform.CustomTrainingJob(
                    display_name=display_name,
                    script_path=None,
                    container_uri=None,
                    model_serving_container_image_uri=None,
                    training_task_definition=training_task_definition,
                    training_task_inputs=training_task_inputs
                )
            )
            
            # Run training job
            model = await loop.run_in_executor(
                None,
                lambda: job.run(
                    base_output_dir=base_output_dir,
                    model_display_name=model_display_name
                )
            )
            
            # Format result
            result = {
                "job_id": job.resource_name if hasattr(job, 'resource_name') else None,
                "display_name": job.display_name,
                "model_id": model.resource_name if model else None,
                "model_display_name": model.display_name if model else None
            }
            
            return {
                "status": "success",
                "job": result
            }
            
        except Exception as e:
            logger.error(f"Error creating training job: {str(e)}")
            return {
                "status": "error",
                "message": str(e)
            }

