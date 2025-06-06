"""
Gemini client for IntelliFlow.

This module provides a client for interacting with Google's Gemini models
through Vertex AI, including text generation, multimodal inputs, and chat.
"""

from typing import Dict, List, Any, Optional, Union, Tuple
import asyncio
import logging
import time
import json
import os
import base64
from io import BytesIO
from PIL import Image

logger = logging.getLogger("intelliflow.integrations.google_cloud.vertex_ai.gemini")

class GeminiClient:
    """Client for interacting with Google's Gemini models."""
    
    def __init__(self, 
                project_id: str,
                location: str = "us-central1",
                credentials_path: Optional[str] = None):
        """
        Initialize Gemini client.
        
        Args:
            project_id: Google Cloud project ID
            location: Vertex AI location
            credentials_path: Path to service account credentials JSON file
        """
        self.project_id = project_id
        self.location = location
        self.credentials_path = credentials_path
        self.generative_models = None
        
        # Set credentials environment variable if provided
        if credentials_path:
            os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = credentials_path
            
        # Import Google Cloud libraries
        try:
            from vertexai.preview.generative_models import GenerativeModel
            self.GenerativeModel = GenerativeModel
            
            import vertexai
            vertexai.init(project=project_id, location=location)
            logger.info(f"Initialized Gemini client for project: {project_id}")
        except ImportError:
            logger.error("Failed to import Google Cloud Vertex AI Gemini libraries")
            raise ImportError("Google Cloud Vertex AI Gemini libraries not available")
            
    async def generate_text(self, 
                          prompt: str,
                          model: str = "gemini-1.0-pro",
                          temperature: float = 0.7,
                          max_output_tokens: int = 1024,
                          top_p: float = 0.95,
                          top_k: int = 40) -> Dict[str, Any]:
        """
        Generate text with Gemini.
        
        Args:
            prompt: Text prompt
            model: Model name
            temperature: Sampling temperature
            max_output_tokens: Maximum output tokens
            top_p: Top-p sampling parameter
            top_k: Top-k sampling parameter
            
        Returns:
            Generated text
        """
        if not self.GenerativeModel:
            raise RuntimeError("Gemini client not initialized")
            
        logger.info(f"Generating text with model: {model}")
        
        try:
            # Use asyncio to avoid blocking
            loop = asyncio.get_event_loop()
            
            # Create model
            model_instance = await loop.run_in_executor(
                None,
                lambda: self.GenerativeModel(model)
            )
            
            # Generate content
            generation_config = {
                "temperature": temperature,
                "max_output_tokens": max_output_tokens,
                "top_p": top_p,
                "top_k": top_k
            }
            
            response = await loop.run_in_executor(
                None,
                lambda: model_instance.generate_content(
                    prompt,
                    generation_config=generation_config
                )
            )
            
            # Format result
            result = {
                "text": response.text,
                "usage": {
                    "prompt_tokens": response.usage_metadata.prompt_token_count if hasattr(response, 'usage_metadata') else None,
                    "candidates_token_count": response.usage_metadata.candidates_token_count if hasattr(response, 'usage_metadata') else None,
                    "total_token_count": response.usage_metadata.total_token_count if hasattr(response, 'usage_metadata') else None
                }
            }
            
            return {
                "status": "success",
                "result": result
            }
            
        except Exception as e:
            logger.error(f"Error generating text: {str(e)}")
            return {
                "status": "error",
                "message": str(e)
            }
            
    async def generate_multimodal(self, 
                                prompt: str,
                                images: List[Union[str, bytes]],
                                model: str = "gemini-1.0-pro-vision",
                                temperature: float = 0.7,
                                max_output_tokens: int = 1024,
                                top_p: float = 0.95,
                                top_k: int = 40) -> Dict[str, Any]:
        """
        Generate text from multimodal input with Gemini.
        
        Args:
            prompt: Text prompt
            images: List of image paths or bytes
            model: Model name
            temperature: Sampling temperature
            max_output_tokens: Maximum output tokens
            top_p: Top-p sampling parameter
            top_k: Top-k sampling parameter
            
        Returns:
            Generated text
        """
        if not self.GenerativeModel:
            raise RuntimeError("Gemini client not initialized")
            
        logger.info(f"Generating multimodal content with model: {model}")
        
        try:
            # Use asyncio to avoid blocking
            loop = asyncio.get_event_loop()
            
            # Create model
            model_instance = await loop.run_in_executor(
                None,
                lambda: self.GenerativeModel(model)
            )
            
            # Process images
            from vertexai.preview.generative_models import Part
            
            content_parts = [prompt]
            
            for image in images:
                if isinstance(image, str):
                    # Load image from path
                    with open(image, "rb") as f:
                        image_bytes = f.read()
                else:
                    # Use provided bytes
                    image_bytes = image
                    
                # Add image part
                image_part = await loop.run_in_executor(
                    None,
                    lambda: Part.from_image(image_bytes)
                )
                content_parts.append(image_part)
                
            # Generate content
            generation_config = {
                "temperature": temperature,
                "max_output_tokens": max_output_tokens,
                "top_p": top_p,
                "top_k": top_k
            }
            
            response = await loop.run_in_executor(
                None,
                lambda: model_instance.generate_content(
                    content_parts,
                    generation_config=generation_config
                )
            )
            
            # Format result
            result = {
                "text": response.text,
                "usage": {
                    "prompt_tokens": response.usage_metadata.prompt_token_count if hasattr(response, 'usage_metadata') else None,
                    "candidates_token_count": response.usage_metadata.candidates_token_count if hasattr(response, 'usage_metadata') else None,
                    "total_token_count": response.usage_metadata.total_token_count if hasattr(response, 'usage_metadata') else None
                }
            }
            
            return {
                "status": "success",
                "result": result
            }
            
        except Exception as e:
            logger.error(f"Error generating multimodal content: {str(e)}")
            return {
                "status": "error",
                "message": str(e)
            }
            
    async def chat(self, 
                  messages: List[Dict[str, str]],
                  model: str = "gemini-1.0-pro",
                  temperature: float = 0.7,
                  max_output_tokens: int = 1024,
                  top_p: float = 0.95,
                  top_k: int = 40) -> Dict[str, Any]:
        """
        Chat with Gemini.
        
        Args:
            messages: List of messages (each with "role" and "content")
            model: Model name
            temperature: Sampling temperature
            max_output_tokens: Maximum output tokens
            top_p: Top-p sampling parameter
            top_k: Top-k sampling parameter
            
        Returns:
            Chat response
        """
        if not self.GenerativeModel:
            raise RuntimeError("Gemini client not initialized")
            
        logger.info(f"Chatting with model: {model}")
        
        try:
            # Use asyncio to avoid blocking
            loop = asyncio.get_event_loop()
            
            # Create model
            model_instance = await loop.run_in_executor(
                None,
                lambda: self.GenerativeModel(model)
            )
            
            # Start chat
            chat = await loop.run_in_executor(
                None,
                lambda: model_instance.start_chat()
            )
            
            # Process messages
            response = None
            for message in messages:
                role = message.get("role", "user")
                content = message.get("content", "")
                
                if role == "user":
                    # Send user message
                    generation_config = {
                        "temperature": temperature,
                        "max_output_tokens": max_output_tokens,
                        "top_p": top_p,
                        "top_k": top_k
                    }
                    
                    response = await loop.run_in_executor(
                        None,
                        lambda: chat.send_message(
                            content,
                            generation_config=generation_config
                        )
                    )
                    
            if not response:
                return {
                    "status": "error",
                    "message": "No user messages provided"
                }
                
            # Format result
            result = {
                "text": response.text,
                "usage": {
                    "prompt_tokens": response.usage_metadata.prompt_token_count if hasattr(response, 'usage_metadata') else None,
                    "candidates_token_count": response.usage_metadata.candidates_token_count if hasattr(response, 'usage_metadata') else None,
                    "total_token_count": response.usage_metadata.total_token_count if hasattr(response, 'usage_metadata') else None
                }
            }
            
            return {
                "status": "success",
                "result": result
            }
            
        except Exception as e:
            logger.error(f"Error chatting: {str(e)}")
            return {
                "status": "error",
                "message": str(e)
            }
            
    async def embed_text(self, 
                       text: str,
                       model: str = "textembedding-gecko") -> Dict[str, Any]:
        """
        Generate embeddings for text.
        
        Args:
            text: Text to embed
            model: Model name
            
        Returns:
            Text embeddings
        """
        if not self.GenerativeModel:
            raise RuntimeError("Gemini client not initialized")
            
        logger.info(f"Generating embeddings with model: {model}")
        
        try:
            # Use asyncio to avoid blocking
            loop = asyncio.get_event_loop()
            
            # Import embedding model
            from vertexai.language_models import TextEmbeddingModel
            
            # Create model
            embedding_model = await loop.run_in_executor(
                None,
                lambda: TextEmbeddingModel.from_pretrained(model)
            )
            
            # Generate embeddings
            embeddings = await loop.run_in_executor(
                None,
                lambda: embedding_model.get_embeddings([text])
            )
            
            # Format result
            result = {
                "embeddings": embeddings[0].values,
                "dimension": len(embeddings[0].values)
            }
            
            return {
                "status": "success",
                "result": result
            }
            
        except Exception as e:
            logger.error(f"Error generating embeddings: {str(e)}")
            return {
                "status": "error",
                "message": str(e)
            }
            
    async def count_tokens(self, 
                         text: str,
                         model: str = "gemini-1.0-pro") -> Dict[str, Any]:
        """
        Count tokens in text.
        
        Args:
            text: Text to count tokens in
            model: Model name
            
        Returns:
            Token count
        """
        if not self.GenerativeModel:
            raise RuntimeError("Gemini client not initialized")
            
        logger.info(f"Counting tokens for model: {model}")
        
        try:
            # Use asyncio to avoid blocking
            loop = asyncio.get_event_loop()
            
            # Create model
            model_instance = await loop.run_in_executor(
                None,
                lambda: self.GenerativeModel(model)
            )
            
            # Count tokens
            from vertexai.preview.generative_models import GenerationConfig
            
            response = await loop.run_in_executor(
                None,
                lambda: model_instance.count_tokens(text)
            )
            
            # Format result
            result = {
                "total_tokens": response.total_tokens,
                "total_billable_characters": response.total_billable_characters
            }
            
            return {
                "status": "success",
                "result": result
            }
            
        except Exception as e:
            logger.error(f"Error counting tokens: {str(e)}")
            return {
                "status": "error",
                "message": str(e)
            }
            
    async def analyze_image(self, 
                          image: Union[str, bytes],
                          prompt: str = "Describe this image in detail.",
                          model: str = "gemini-1.0-pro-vision") -> Dict[str, Any]:
        """
        Analyze an image with Gemini.
        
        Args:
            image: Image path or bytes
            prompt: Text prompt for image analysis
            model: Model name
            
        Returns:
            Image analysis
        """
        if not self.GenerativeModel:
            raise RuntimeError("Gemini client not initialized")
            
        logger.info(f"Analyzing image with model: {model}")
        
        try:
            # Process image
            if isinstance(image, str):
                # Load image from path
                with open(image, "rb") as f:
                    image_bytes = f.read()
            else:
                # Use provided bytes
                image_bytes = image
                
            # Use multimodal generation
            result = await self.generate_multimodal(
                prompt=prompt,
                images=[image_bytes],
                model=model
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Error analyzing image: {str(e)}")
            return {
                "status": "error",
                "message": str(e)
            }
            
    async def list_models(self) -> Dict[str, Any]:
        """
        List available Gemini models.
        
        Returns:
            List of models
        """
        # Gemini models available in Vertex AI
        models = [
            {
                "name": "gemini-1.0-pro",
                "description": "Gemini Pro model for text generation",
                "input_modalities": ["text"],
                "output_modalities": ["text"],
                "max_input_tokens": 30720,
                "max_output_tokens": 2048
            },
            {
                "name": "gemini-1.0-pro-vision",
                "description": "Gemini Pro Vision model for multimodal inputs",
                "input_modalities": ["text", "image"],
                "output_modalities": ["text"],
                "max_input_tokens": 30720,
                "max_output_tokens": 2048
            },
            {
                "name": "gemini-1.0-ultra",
                "description": "Gemini Ultra model for advanced text generation",
                "input_modalities": ["text"],
                "output_modalities": ["text"],
                "max_input_tokens": 30720,
                "max_output_tokens": 2048
            },
            {
                "name": "gemini-1.0-ultra-vision",
                "description": "Gemini Ultra Vision model for advanced multimodal inputs",
                "input_modalities": ["text", "image"],
                "output_modalities": ["text"],
                "max_input_tokens": 30720,
                "max_output_tokens": 2048
            }
        ]
        
        return {
            "status": "success",
            "models": models
        }

