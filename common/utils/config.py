"""
Configuration utilities for IntelliFlow platform.

This module provides utilities for loading and managing configuration.
"""

import os
import yaml
from typing import Dict, Any, Optional

class Config:
    """Configuration manager for IntelliFlow platform."""
    
    def __init__(self, config_dir: str = "config"):
        """
        Initialize configuration manager.
        
        Args:
            config_dir: Directory containing configuration files
        """
        self.config_dir = config_dir
        self.config: Dict[str, Any] = {}
        self.env = os.environ.get("INTELLIFLOW_ENV", "development")
        
    def load(self) -> Dict[str, Any]:
        """
        Load configuration from files.
        
        Returns:
            Loaded configuration dictionary
        """
        # Load default configuration
        default_config = self._load_file("default.yaml")
        
        # Load environment-specific configuration
        env_config = self._load_file(f"{self.env}.yaml")
        
        # Merge configurations with environment overriding default
        self.config = self._merge_configs(default_config, env_config)
        
        # Override with environment variables
        self._override_from_env()
        
        return self.config
    
    def get(self, key: str, default: Any = None) -> Any:
        """
        Get configuration value by key.
        
        Args:
            key: Configuration key (supports dot notation for nested keys)
            default: Default value if key not found
            
        Returns:
            Configuration value or default
        """
        if not self.config:
            self.load()
            
        # Handle nested keys with dot notation
        if "." in key:
            parts = key.split(".")
            value = self.config
            for part in parts:
                if isinstance(value, dict) and part in value:
                    value = value[part]
                else:
                    return default
            return value
        
        return self.config.get(key, default)
    
    def _load_file(self, filename: str) -> Dict[str, Any]:
        """
        Load configuration from a YAML file.
        
        Args:
            filename: Configuration file name
            
        Returns:
            Configuration dictionary
        """
        filepath = os.path.join(self.config_dir, filename)
        if os.path.exists(filepath):
            with open(filepath, "r") as f:
                return yaml.safe_load(f) or {}
        return {}
    
    def _merge_configs(self, base: Dict[str, Any], override: Dict[str, Any]) -> Dict[str, Any]:
        """
        Recursively merge two configuration dictionaries.
        
        Args:
            base: Base configuration
            override: Override configuration
            
        Returns:
            Merged configuration
        """
        result = base.copy()
        
        for key, value in override.items():
            if key in result and isinstance(result[key], dict) and isinstance(value, dict):
                result[key] = self._merge_configs(result[key], value)
            else:
                result[key] = value
                
        return result
    
    def _override_from_env(self) -> None:
        """Override configuration with environment variables."""
        prefix = "INTELLIFLOW_"
        for key, value in os.environ.items():
            if key.startswith(prefix):
                config_key = key[len(prefix):].lower().replace("__", ".")
                self._set_nested_key(config_key, value)
    
    def _set_nested_key(self, key: str, value: str) -> None:
        """
        Set a potentially nested configuration key.
        
        Args:
            key: Configuration key (supports dot notation for nested keys)
            value: Value to set
        """
        if "." in key:
            parts = key.split(".")
            current = self.config
            for part in parts[:-1]:
                if part not in current:
                    current[part] = {}
                current = current[part]
            current[parts[-1]] = self._parse_value(value)
        else:
            self.config[key] = self._parse_value(value)
    
    def _parse_value(self, value: str) -> Any:
        """
        Parse string value to appropriate type.
        
        Args:
            value: String value to parse
            
        Returns:
            Parsed value
        """
        # Try to parse as boolean
        if value.lower() in ("true", "yes", "1"):
            return True
        if value.lower() in ("false", "no", "0"):
            return False
        
        # Try to parse as number
        try:
            if "." in value:
                return float(value)
            return int(value)
        except ValueError:
            pass
        
        # Return as string
        return value


# Singleton instance
config = Config()

def get_config() -> Config:
    """
    Get the singleton configuration instance.
    
    Returns:
        Configuration instance
    """
    return config
