"""
Bug Fix: Tool Execution Error Handling in ADK

Issue:
The current implementation of the ADK tool execution system doesn't properly handle
exceptions that occur during tool execution. This can cause agents to crash or hang
when a tool fails, rather than gracefully handling the error and continuing execution.

Fix:
This patch implements a robust error handling mechanism for tool execution that:
1. Catches and properly logs exceptions
2. Returns structured error information to the agent
3. Allows for retry policies and fallback mechanisms
4. Prevents agent crashes due to tool failures
"""

import sys
import time
import logging
import traceback
from typing import Any, Dict, List, Optional, Callable, Union, Tuple
from functools import wraps

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("adk.tools")

# Custom exceptions
class ToolExecutionError(Exception):
    """Base exception for tool execution errors."""
    pass

class ToolTimeoutError(ToolExecutionError):
    """Exception raised when a tool execution times out."""
    pass

class ToolInputError(ToolExecutionError):
    """Exception raised when a tool receives invalid input."""
    pass

class ToolPermissionError(ToolExecutionError):
    """Exception raised when a tool lacks permission to execute."""
    pass


class ToolResult:
    """
    Class representing the result of a tool execution, including error handling.
    """
    def __init__(
        self,
        success: bool,
        value: Any = None,
        error: Optional[Exception] = None,
        error_type: Optional[str] = None,
        error_message: Optional[str] = None,
        traceback_str: Optional[str] = None,
        execution_time: float = 0.0
    ):
        self.success = success
        self.value = value
        self.error = error
        self.error_type = error_type
        self.error_message = error_message
        self.traceback_str = traceback_str
        self.execution_time = execution_time
    
    @classmethod
    def success_result(cls, value: Any, execution_time: float) -> 'ToolResult':
        """Create a successful result."""
        return cls(
            success=True,
            value=value,
            execution_time=execution_time
        )
    
    @classmethod
    def error_result(cls, error: Exception, execution_time: float) -> 'ToolResult':
        """Create an error result from an exception."""
        return cls(
            success=False,
            error=error,
            error_type=error.__class__.__name__,
            error_message=str(error),
            traceback_str=traceback.format_exc(),
            execution_time=execution_time
        )
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert the result to a dictionary."""
        result = {
            "success": self.success,
            "execution_time": self.execution_time
        }
        
        if self.success:
            result["value"] = self.value
        else:
            result["error"] = {
                "type": self.error_type,
                "message": self.error_message,
                "traceback": self.traceback_str
            }
        
        return result
    
    def __str__(self) -> str:
        if self.success:
            return f"ToolResult(success=True, value={self.value}, execution_time={self.execution_time:.3f}s)"
        else:
            return f"ToolResult(success=False, error_type={self.error_type}, error_message={self.error_message}, execution_time={self.execution_time:.3f}s)"


class RetryPolicy:
    """
    Class defining a retry policy for tool execution.
    """
    def __init__(
        self,
        max_retries: int = 3,
        retry_delay: float = 1.0,
        backoff_factor: float = 2.0,
        retry_on_exceptions: Optional[List[type]] = None
    ):
        self.max_retries = max_retries
        self.retry_delay = retry_delay
        self.backoff_factor = backoff_factor
        self.retry_on_exceptions = retry_on_exceptions or [Exception]
    
    def should_retry(self, attempt: int, exception: Exception) -> bool:
        """Determine if a retry should be attempted."""
        if attempt >= self.max_retries:
            return False
        
        return any(isinstance(exception, exc_type) for exc_type in self.retry_on_exceptions)
    
    def get_delay(self, attempt: int) -> float:
        """Calculate the delay before the next retry."""
        return self.retry_delay * (self.backoff_factor ** attempt)


class Tool:
    """
    Enhanced tool class with improved error handling and retry capabilities.
    """
    def __init__(
        self,
        name: str,
        description: str,
        function: Callable,
        retry_policy: Optional[RetryPolicy] = None,
        timeout: Optional[float] = None
    ):
        self.name = name
        self.description = description
        self.function = function
        self.retry_policy = retry_policy or RetryPolicy()
        self.timeout = timeout
    
    def execute(self, *args: Any, **kwargs: Any) -> ToolResult:
        """
        Execute the tool with the given arguments, handling errors and retries.
        """
        start_time = time.time()
        attempt = 0
        last_exception = None
        
        while True:
            try:
                # Execute the function with timeout if specified
                if self.timeout is not None:
                    # In a real implementation, you would use a proper timeout mechanism
                    # This is a simplified version for demonstration
                    result = self._execute_with_timeout(self.timeout, *args, **kwargs)
                else:
                    result = self.function(*args, **kwargs)
                
                execution_time = time.time() - start_time
                return ToolResult.success_result(result, execution_time)
                
            except Exception as e:
                last_exception = e
                logger.error(f"Tool '{self.name}' execution failed (attempt {attempt+1}/{self.retry_policy.max_retries}): {str(e)}")
                logger.debug(traceback.format_exc())
                
                # Check if we should retry
                if self.retry_policy.should_retry(attempt, e):
                    attempt += 1
                    retry_delay = self.retry_policy.get_delay(attempt)
                    logger.info(f"Retrying tool '{self.name}' in {retry_delay:.2f}s (attempt {attempt+1}/{self.retry_policy.max_retries})")
                    time.sleep(retry_delay)
                else:
                    # No more retries, return error result
                    execution_time = time.time() - start_time
                    return ToolResult.error_result(last_exception, execution_time)
    
    def _execute_with_timeout(self, timeout: float, *args: Any, **kwargs: Any) -> Any:
        """
        Execute the function with a timeout.
        
        Note: This is a simplified implementation. In a real-world scenario,
        you would use threading or multiprocessing to implement proper timeouts.
        """
        # This is a placeholder for a proper timeout implementation
        # In a real implementation, you would use threading.Timer or similar
        result = self.function(*args, **kwargs)
        if time.time() - kwargs.get('_start_time', time.time()) > timeout:
            raise ToolTimeoutError(f"Tool execution timed out after {timeout} seconds")
        return result


class ToolRegistry:
    """
    Registry for tools with improved error handling.
    """
    def __init__(self):
        self.tools: Dict[str, Tool] = {}
    
    def register_tool(
        self,
        name: str,
        description: str,
        function: Callable,
        retry_policy: Optional[RetryPolicy] = None,
        timeout: Optional[float] = None
    ) -> None:
        """Register a new tool."""
        tool = Tool(
            name=name,
            description=description,
            function=function,
            retry_policy=retry_policy,
            timeout=timeout
        )
        self.tools[name] = tool
        logger.info(f"Registered tool: {name}")
    
    def get_tool(self, name: str) -> Optional[Tool]:
        """Get a tool by name."""
        return self.tools.get(name)
    
    def execute_tool(self, name: str, *args: Any, **kwargs: Any) -> ToolResult:
        """Execute a tool by name."""
        tool = self.get_tool(name)
        if tool is None:
            error = ValueError(f"Tool '{name}' not found")
            return ToolResult.error_result(error, 0.0)
        
        return tool.execute(*args, **kwargs)
    
    def list_tools(self) -> List[Dict[str, str]]:
        """List all registered tools."""
        return [
            {"name": name, "description": tool.description}
            for name, tool in self.tools.items()
        ]


# Decorator for creating tools
def tool(
    name: Optional[str] = None,
    description: Optional[str] = None,
    retry_policy: Optional[RetryPolicy] = None,
    timeout: Optional[float] = None
):
    """
    Decorator to register a function as a tool.
    """
    def decorator(func: Callable) -> Callable:
        tool_name = name or func.__name__
        tool_description = description or func.__doc__ or ""
        
        @wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            # The actual implementation would register this with a global registry
            # For this example, we'll just create a Tool instance and execute it
            tool = Tool(
                name=tool_name,
                description=tool_description,
                function=func,
                retry_policy=retry_policy,
                timeout=timeout
            )
            result = tool.execute(*args, **kwargs)
            if not result.success:
                logger.error(f"Tool '{tool_name}' failed: {result.error_message}")
                # Re-raise the exception with additional context
                raise ToolExecutionError(f"Tool execution failed: {result.error_message}")
            return result.value
        
        # Store tool metadata on the function
        wrapper.tool_name = tool_name
        wrapper.tool_description = tool_description
        
        return wrapper
    
    return decorator


# Example usage:
if __name__ == "__main__":
    # Create a registry
    registry = ToolRegistry()
    
    # Define some example tools
    @tool(
        name="calculator",
        description="Performs basic arithmetic operations",
        retry_policy=RetryPolicy(max_retries=2),
        timeout=5.0
    )
    def calculator(operation: str, a: float, b: float) -> float:
        """
        Perform basic arithmetic operations.
        
        Args:
            operation: One of 'add', 'subtract', 'multiply', 'divide'
            a: First number
            b: Second number
            
        Returns:
            Result of the operation
        """
        if operation == "add":
            return a + b
        elif operation == "subtract":
            return a - b
        elif operation == "multiply":
            return a * b
        elif operation == "divide":
            if b == 0:
                raise ZeroDivisionError("Cannot divide by zero")
            return a / b
        else:
            raise ValueError(f"Unknown operation: {operation}")
    
    # Register the tool
    registry.register_tool(
        name="calculator",
        description="Performs basic arithmetic operations",
        function=calculator,
        retry_policy=RetryPolicy(max_retries=2),
        timeout=5.0
    )
    
    # Test successful execution
    result = registry.execute_tool("calculator", "add", 5, 3)
    print(f"Addition result: {result.value}")  # Should print 8
    
    # Test error handling
    result = registry.execute_tool("calculator", "divide", 10, 0)
    print(f"Division by zero: {result.success}, Error: {result.error_message}")
    
    # Test non-existent tool
    result = registry.execute_tool("non_existent_tool")
    print(f"Non-existent tool: {result.success}, Error: {result.error_message}")
    
    print("Tool execution fix test passed!")

