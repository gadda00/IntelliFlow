"""
Goal classes for the planning module.

This module provides classes for representing goals and subgoals
in the planning system.
"""

from typing import Dict, List, Any, Optional, Callable, Set
import uuid
import time

class Goal:
    """Class representing a goal for an agent."""
    
    def __init__(self, 
                 name: str,
                 description: str,
                 priority: int = 0,
                 deadline: Optional[float] = None,
                 success_criteria: Optional[Callable[[Dict[str, Any]], bool]] = None,
                 metadata: Optional[Dict[str, Any]] = None):
        """
        Initialize a goal.
        
        Args:
            name: Goal name
            description: Goal description
            priority: Goal priority (higher values indicate higher priority)
            deadline: Optional deadline timestamp
            success_criteria: Optional function to evaluate goal success
            metadata: Additional metadata
        """
        self.id = str(uuid.uuid4())
        self.name = name
        self.description = description
        self.priority = priority
        self.deadline = deadline
        self.success_criteria = success_criteria
        self.metadata = metadata or {}
        self.created_at = time.time()
        self.completed_at: Optional[float] = None
        self.status = "pending"  # pending, in_progress, completed, failed
        self.subgoals: List[SubGoal] = []
        self.dependencies: Set[str] = set()  # IDs of goals this goal depends on
        
    def add_subgoal(self, subgoal: 'SubGoal') -> None:
        """
        Add a subgoal to this goal.
        
        Args:
            subgoal: Subgoal to add
        """
        self.subgoals.append(subgoal)
        
    def add_dependency(self, goal_id: str) -> None:
        """
        Add a dependency to this goal.
        
        Args:
            goal_id: ID of the goal this goal depends on
        """
        self.dependencies.add(goal_id)
        
    def is_expired(self) -> bool:
        """
        Check if the goal has expired based on deadline.
        
        Returns:
            True if expired, False otherwise
        """
        if self.deadline is None:
            return False
        return time.time() > self.deadline
        
    def is_completed(self) -> bool:
        """
        Check if the goal is completed.
        
        Returns:
            True if completed, False otherwise
        """
        return self.status == "completed"
        
    def is_failed(self) -> bool:
        """
        Check if the goal has failed.
        
        Returns:
            True if failed, False otherwise
        """
        return self.status == "failed"
        
    def evaluate_success(self, context: Dict[str, Any]) -> bool:
        """
        Evaluate whether the goal has been achieved.
        
        Args:
            context: Context for evaluation
            
        Returns:
            True if successful, False otherwise
        """
        if self.success_criteria is not None:
            return self.success_criteria(context)
        
        # If no success criteria, check if all subgoals are completed
        if self.subgoals:
            return all(subgoal.is_completed() for subgoal in self.subgoals)
            
        return False
        
    def complete(self) -> None:
        """Mark the goal as completed."""
        self.status = "completed"
        self.completed_at = time.time()
        
    def fail(self) -> None:
        """Mark the goal as failed."""
        self.status = "failed"
        self.completed_at = time.time()
        
    def to_dict(self) -> Dict[str, Any]:
        """Convert goal to dictionary representation."""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "priority": self.priority,
            "deadline": self.deadline,
            "metadata": self.metadata,
            "created_at": self.created_at,
            "completed_at": self.completed_at,
            "status": self.status,
            "subgoals": [subgoal.to_dict() for subgoal in self.subgoals],
            "dependencies": list(self.dependencies)
        }


class SubGoal(Goal):
    """Class representing a subgoal within a parent goal."""
    
    def __init__(self, 
                 name: str,
                 description: str,
                 parent_id: str,
                 priority: int = 0,
                 deadline: Optional[float] = None,
                 success_criteria: Optional[Callable[[Dict[str, Any]], bool]] = None,
                 metadata: Optional[Dict[str, Any]] = None):
        """
        Initialize a subgoal.
        
        Args:
            name: Subgoal name
            description: Subgoal description
            parent_id: ID of the parent goal
            priority: Subgoal priority
            deadline: Optional deadline timestamp
            success_criteria: Optional function to evaluate subgoal success
            metadata: Additional metadata
        """
        super().__init__(
            name=name,
            description=description,
            priority=priority,
            deadline=deadline,
            success_criteria=success_criteria,
            metadata=metadata
        )
        self.parent_id = parent_id
        
    def to_dict(self) -> Dict[str, Any]:
        """Convert subgoal to dictionary representation."""
        result = super().to_dict()
        result["parent_id"] = self.parent_id
        return result

