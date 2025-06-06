"""
Plan classes for the planning module.

This module provides classes for representing plans and plan steps
in the planning system.
"""

from typing import Dict, List, Any, Optional, Callable, Union, Set
import uuid
import time

from .goal import Goal

class PlanStep:
    """Class representing a step in a plan."""
    
    def __init__(self, 
                 name: str,
                 description: str,
                 action: Union[str, Callable],
                 parameters: Optional[Dict[str, Any]] = None,
                 expected_outcome: Optional[str] = None,
                 timeout: Optional[float] = None,
                 retry_count: int = 0,
                 metadata: Optional[Dict[str, Any]] = None):
        """
        Initialize a plan step.
        
        Args:
            name: Step name
            description: Step description
            action: Action to execute (tool name or function)
            parameters: Parameters for the action
            expected_outcome: Description of expected outcome
            timeout: Optional timeout in seconds
            retry_count: Number of retries on failure
            metadata: Additional metadata
        """
        self.id = str(uuid.uuid4())
        self.name = name
        self.description = description
        self.action = action
        self.parameters = parameters or {}
        self.expected_outcome = expected_outcome
        self.timeout = timeout
        self.retry_count = retry_count
        self.metadata = metadata or {}
        self.created_at = time.time()
        self.started_at: Optional[float] = None
        self.completed_at: Optional[float] = None
        self.status = "pending"  # pending, in_progress, completed, failed
        self.result: Optional[Dict[str, Any]] = None
        self.error: Optional[str] = None
        self.retry_attempts = 0
        self.dependencies: Set[str] = set()  # IDs of steps this step depends on
        
    def start(self) -> None:
        """Mark the step as started."""
        self.status = "in_progress"
        self.started_at = time.time()
        
    def complete(self, result: Optional[Dict[str, Any]] = None) -> None:
        """
        Mark the step as completed.
        
        Args:
            result: Optional result data
        """
        self.status = "completed"
        self.completed_at = time.time()
        self.result = result
        
    def fail(self, error: str) -> None:
        """
        Mark the step as failed.
        
        Args:
            error: Error message
        """
        self.status = "failed"
        self.completed_at = time.time()
        self.error = error
        
    def can_retry(self) -> bool:
        """
        Check if the step can be retried.
        
        Returns:
            True if can retry, False otherwise
        """
        return self.status == "failed" and self.retry_attempts < self.retry_count
        
    def retry(self) -> None:
        """Reset the step for retry."""
        self.status = "pending"
        self.started_at = None
        self.completed_at = None
        self.result = None
        self.error = None
        self.retry_attempts += 1
        
    def add_dependency(self, step_id: str) -> None:
        """
        Add a dependency to this step.
        
        Args:
            step_id: ID of the step this step depends on
        """
        self.dependencies.add(step_id)
        
    def to_dict(self) -> Dict[str, Any]:
        """Convert plan step to dictionary representation."""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "action": self.action if isinstance(self.action, str) else self.action.__name__,
            "parameters": self.parameters,
            "expected_outcome": self.expected_outcome,
            "timeout": self.timeout,
            "retry_count": self.retry_count,
            "retry_attempts": self.retry_attempts,
            "metadata": self.metadata,
            "created_at": self.created_at,
            "started_at": self.started_at,
            "completed_at": self.completed_at,
            "status": self.status,
            "result": self.result,
            "error": self.error,
            "dependencies": list(self.dependencies)
        }


class Plan:
    """Class representing a plan for achieving a goal."""
    
    def __init__(self, 
                 name: str,
                 description: str,
                 goal: Goal,
                 steps: Optional[List[PlanStep]] = None,
                 metadata: Optional[Dict[str, Any]] = None):
        """
        Initialize a plan.
        
        Args:
            name: Plan name
            description: Plan description
            goal: Goal the plan aims to achieve
            steps: List of plan steps
            metadata: Additional metadata
        """
        self.id = str(uuid.uuid4())
        self.name = name
        self.description = description
        self.goal = goal
        self.steps = steps or []
        self.metadata = metadata or {}
        self.created_at = time.time()
        self.started_at: Optional[float] = None
        self.completed_at: Optional[float] = None
        self.status = "pending"  # pending, in_progress, completed, failed
        self.current_step_index = 0
        
    def add_step(self, step: PlanStep) -> None:
        """
        Add a step to the plan.
        
        Args:
            step: Step to add
        """
        self.steps.append(step)
        
    def start(self) -> None:
        """Mark the plan as started."""
        self.status = "in_progress"
        self.started_at = time.time()
        
    def complete(self) -> None:
        """Mark the plan as completed."""
        self.status = "completed"
        self.completed_at = time.time()
        self.goal.complete()
        
    def fail(self) -> None:
        """Mark the plan as failed."""
        self.status = "failed"
        self.completed_at = time.time()
        self.goal.fail()
        
    def get_current_step(self) -> Optional[PlanStep]:
        """
        Get the current step in the plan.
        
        Returns:
            Current step or None if no steps or all steps completed
        """
        if not self.steps or self.current_step_index >= len(self.steps):
            return None
        return self.steps[self.current_step_index]
        
    def advance(self) -> bool:
        """
        Advance to the next step in the plan.
        
        Returns:
            True if advanced to a new step, False if no more steps
        """
        if self.current_step_index < len(self.steps) - 1:
            self.current_step_index += 1
            return True
        return False
        
    def is_completed(self) -> bool:
        """
        Check if the plan is completed.
        
        Returns:
            True if all steps are completed, False otherwise
        """
        return all(step.status == "completed" for step in self.steps)
        
    def get_progress(self) -> float:
        """
        Get the progress of the plan as a percentage.
        
        Returns:
            Progress percentage (0.0 to 1.0)
        """
        if not self.steps:
            return 0.0
            
        completed_steps = sum(1 for step in self.steps if step.status == "completed")
        return completed_steps / len(self.steps)
        
    def to_dict(self) -> Dict[str, Any]:
        """Convert plan to dictionary representation."""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "goal": self.goal.to_dict(),
            "steps": [step.to_dict() for step in self.steps],
            "metadata": self.metadata,
            "created_at": self.created_at,
            "started_at": self.started_at,
            "completed_at": self.completed_at,
            "status": self.status,
            "current_step_index": self.current_step_index,
            "progress": self.get_progress()
        }

