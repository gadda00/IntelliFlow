"""
Enhanced Tool class for agent capabilities.

This module provides an enhanced Tool class for implementing agent capabilities
with additional features for validation, monitoring, and error handling.
"""

from typing import Dict, Any, Optional, List, Callable, Awaitable, Union
import asyncio
import inspect
import time
import traceback
import logging

logger = logging.getLogger("enhanced_adk.tool")

class ToolParameter:
    """Parameter definition for a tool."""
    
    def __init__(self, 
                 name: str, 
                 description: str,
                 type_hint: Any = Any,
                 required: bool = True,
                 default: Any = None,
                 validator: Optional[Callable[[Any], bool]] = None):
        """
        Initialize a tool parameter.
        
        Args:
            name: Parameter name
            description: Parameter description
            type_hint: Type hint for the parameter
            required: Whether the parameter is required
            default: Default value for the parameter
            validator: Optional validator function
        """
        self.name = name
        self.description = description
        self.type_hint = type_hint
        self.required = required
        self.default = default
        self.validator = validator
        
    def validate(self, value: Any) -> bool:
        """
        Validate a parameter value.
        
        Args:
            value: Value to validate
            
        Returns:
            True if valid, False otherwise
        """
        if value is None:
            return not self.required
            
        # Check type if type_hint is provided
        if self.type_hint != Any:
            if not isinstance(value, self.type_hint):
                return False
                
        # Use custom validator if provided
        if self.validator is not None:
            return self.validator(value)
            
        return True


class Tool:
    """Enhanced Tool class for agent capabilities."""
    
    def __init__(self, 
                 name: str, 
                 description: str = "",
                 parameters: Optional[List[ToolParameter]] = None,
                 version: str = "1.0.0",
                 tags: Optional[List[str]] = None,
                 timeout: Optional[float] = None):
        """
        Initialize a tool.
        
        Args:
            name: Tool name
            description: Tool description
            parameters: List of tool parameters
            version: Tool version
            tags: List of tags for categorization
            timeout: Execution timeout in seconds
        """
        self.name = name
        self.description = description
        self.parameters = parameters or []
        self.version = version
        self.tags = tags or []
        self.timeout = timeout
        self._param_dict = {param.name: param for param in self.parameters}
        
    async def execute(self, **kwargs) -> Dict[str, Any]:
        """
        Execute the tool functionality.
        
        Args:
            **kwargs: Tool parameters
            
        Returns:
            Execution result
        """
        start_time = time.time()
        
        try:
            # Validate parameters
            for name, param in self._param_dict.items():
                if name not in kwargs:
                    if param.required:
                        return {
                            "status": "error",
                            "message": f"Missing required parameter: {name}"
                        }
                    kwargs[name] = param.default
                elif not param.validate(kwargs[name]):
                    return {
                        "status": "error",
                        "message": f"Invalid value for parameter: {name}"
                    }
            
            # Execute with timeout if specified
            if self.timeout is not None:
                try:
                    result = await asyncio.wait_for(
                        self._execute_impl(**kwargs),
                        timeout=self.timeout
                    )
                except asyncio.TimeoutError:
                    return {
                        "status": "error",
                        "message": f"Tool execution timed out after {self.timeout} seconds"
                    }
            else:
                result = await self._execute_impl(**kwargs)
            
            # Add execution metadata
            execution_time = time.time() - start_time
            if isinstance(result, dict):
                result.setdefault("metadata", {})["execution_time"] = execution_time
                return result
            else:
                return {
                    "status": "success",
                    "result": result,
                    "metadata": {"execution_time": execution_time}
                }
                
        except Exception as e:
            logger.error(f"Error executing tool {self.name}: {str(e)}")
            logger.debug(traceback.format_exc())
            return {
                "status": "error",
                "message": str(e),
                "metadata": {
                    "execution_time": time.time() - start_time,
                    "error_type": type(e).__name__
                }
            }
    
    async def _execute_impl(self, **kwargs) -> Union[Dict[str, Any], Any]:
        """
        Implementation of tool execution.
        
        Args:
            **kwargs: Tool parameters
            
        Returns:
            Execution result
        """
        raise NotImplementedError("Tool subclasses must implement _execute_impl method")
        
    def to_dict(self) -> Dict[str, Any]:
        """Convert tool to dictionary representation."""
        return {
            "name": self.name,
            "description": self.description,
            "parameters": [
                {
                    "name": param.name,
                    "description": param.description,
                    "type": str(param.type_hint.__name__) if hasattr(param.type_hint, "__name__") else "Any",
                    "required": param.required,
                    "default": param.default
                }
                for param in self.parameters
            ],
            "version": self.version,
            "tags": self.tags
        }

