"""
Google Cloud Pub/Sub integration for IntelliFlow.

This module provides integration with Google Cloud Pub/Sub,
including topic and subscription management, publishing, and consuming.
"""

from .client import PubSubClient

__all__ = [
    'PubSubClient'
]

