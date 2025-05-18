"""
Logger implementation for IntelliFlow platform.

This module provides centralized logging utilities for all components.
"""

import logging
import os
import sys
from typing import Optional, Dict, Any

class IntelliFlowLogger:
    """Centralized logger for the IntelliFlow platform."""
    
    LOG_LEVELS = {
        "debug": logging.DEBUG,
        "info": logging.INFO,
        "warning": logging.WARNING,
        "error": logging.ERROR,
        "critical": logging.CRITICAL
    }
    
    def __init__(self, name: str, level: str = "info", log_to_file: bool = False, log_dir: str = "logs"):
        """
        Initialize a logger instance.
        
        Args:
            name: Logger name, typically the module or agent name
            level: Log level (debug, info, warning, error, critical)
            log_to_file: Whether to log to file in addition to console
            log_dir: Directory for log files if log_to_file is True
        """
        self.name = name
        self.logger = logging.getLogger(name)
        self.level = self.LOG_LEVELS.get(level.lower(), logging.INFO)
        self.logger.setLevel(self.level)
        
        # Create console handler
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(self.level)
        formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
        console_handler.setFormatter(formatter)
        self.logger.addHandler(console_handler)
        
        # Create file handler if requested
        if log_to_file:
            if not os.path.exists(log_dir):
                os.makedirs(log_dir)
            file_handler = logging.FileHandler(f"{log_dir}/{name}.log")
            file_handler.setLevel(self.level)
            file_handler.setFormatter(formatter)
            self.logger.addHandler(file_handler)
    
    def debug(self, message: str, **kwargs) -> None:
        """Log debug message with optional context."""
        self._log(logging.DEBUG, message, **kwargs)
    
    def info(self, message: str, **kwargs) -> None:
        """Log info message with optional context."""
        self._log(logging.INFO, message, **kwargs)
    
    def warning(self, message: str, **kwargs) -> None:
        """Log warning message with optional context."""
        self._log(logging.WARNING, message, **kwargs)
    
    def error(self, message: str, **kwargs) -> None:
        """Log error message with optional context."""
        self._log(logging.ERROR, message, **kwargs)
    
    def critical(self, message: str, **kwargs) -> None:
        """Log critical message with optional context."""
        self._log(logging.CRITICAL, message, **kwargs)
    
    def _log(self, level: int, message: str, **kwargs) -> None:
        """Internal method to handle logging with context."""
        if kwargs:
            context_str = " ".join([f"{k}={v}" for k, v in kwargs.items()])
            message = f"{message} - {context_str}"
        self.logger.log(level, message)


def get_logger(name: str, level: str = "info", log_to_file: bool = False, log_dir: str = "logs") -> IntelliFlowLogger:
    """
    Get a logger instance with the specified configuration.
    
    Args:
        name: Logger name
        level: Log level
        log_to_file: Whether to log to file
        log_dir: Directory for log files
        
    Returns:
        Configured logger instance
    """
    return IntelliFlowLogger(name, level, log_to_file, log_dir)
