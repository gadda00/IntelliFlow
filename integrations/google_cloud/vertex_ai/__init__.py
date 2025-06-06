"""
Vertex AI integration for IntelliFlow.

This module provides integration with Google Vertex AI,
including model training, prediction, and management.
"""

from .client import VertexAIClient
from .gemini import GeminiClient

__all__ = [
    'VertexAIClient',
    'GeminiClient'
]

