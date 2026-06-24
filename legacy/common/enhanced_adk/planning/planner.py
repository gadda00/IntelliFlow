"""
Planner classes for the planning module.

This module provides planner classes for creating and executing plans
to achieve goals.
"""

from typing import Dict, List, Any, Optional, Callable, Set, Type
import asyncio
import logging
import time
import traceback

from .goal import Goal, SubGoal
from .plan import Plan, PlanStep

logger = logging.getLogger("enhanced_adk.planning")

class Planner:
    """Base class for planners."""
    
    def __init__(self, name: str = "DefaultPlanner"):
        """
        Initialize a planner.
        
        Args:
            name: Planner name
        """
        self.name = name
        self.goals: Dict[str, Goal] = {}
        self.plans: Dict[str, Plan] = {}
        
    async def create_plan(self, goal: Goal) -> Optional[Plan]:
        """
        Create a plan to achieve a goal.
        
        Args:
            goal: Goal to achieve
            
        Returns:
            Plan or None if planning failed
        """
        raise NotImplementedError("Planner subclasses must implement create_plan method")
        
    async def execute_plan(self, plan: Plan, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute a plan.
        
        Args:
            plan: Plan to execute
            context: Execution context
            
        Returns:
            Execution result
        """
        plan.start()
        logger.info(f"Starting execution of plan: {plan.name}")
        
        try:
            while True:
                current_step = plan.get_current_step()
                if not current_step:
                    break
                    
                if current_step.status == "pending":
                    current_step.start()
                    logger.info(f"Executing step: {current_step.name}")
                    
                    try:
                        # Execute the step
                        if isinstance(current_step.action, str):
                            # Tool execution
                            if "execute_tool" in context:
                                execute_tool = context["execute_tool"]
                                result = await execute_tool(
                                    current_step.action,
                                    **current_step.parameters
                                )
                            else:
                                raise ValueError("No execute_tool function in context")
                        else:
                            # Function execution
                            result = await current_step.action(**current_step.parameters)
                            
                        current_step.complete(result)
                        logger.info(f"Step completed: {current_step.name}")
                    except Exception as e:
                        logger.error(f"Error executing step {current_step.name}: {str(e)}")
                        logger.debug(traceback.format_exc())
                        current_step.fail(str(e))
                        
                        if current_step.can_retry():
                            logger.info(f"Retrying step: {current_step.name} (attempt {current_step.retry_attempts + 1})")
                            current_step.retry()
                            continue
                
                if current_step.status == "failed":
                    logger.error(f"Plan execution failed at step: {current_step.name}")
                    plan.fail()
                    return {
                        "status": "error",
                        "message": f"Plan execution failed at step: {current_step.name}",
                        "step_id": current_step.id,
                        "error": current_step.error
                    }
                
                if not plan.advance():
                    break
            
            # Check if all steps completed successfully
            if plan.is_completed():
                plan.complete()
                logger.info(f"Plan execution completed successfully: {plan.name}")
                return {
                    "status": "success",
                    "message": "Plan execution completed successfully",
                    "plan_id": plan.id,
                    "goal_id": plan.goal.id
                }
            else:
                plan.fail()
                logger.error(f"Plan execution failed: {plan.name}")
                return {
                    "status": "error",
                    "message": "Plan execution failed",
                    "plan_id": plan.id,
                    "goal_id": plan.goal.id
                }
                
        except Exception as e:
            logger.error(f"Error executing plan {plan.name}: {str(e)}")
            logger.debug(traceback.format_exc())
            plan.fail()
            return {
                "status": "error",
                "message": str(e),
                "plan_id": plan.id,
                "goal_id": plan.goal.id
            }
            
    def register_goal(self, goal: Goal) -> None:
        """
        Register a goal with the planner.
        
        Args:
            goal: Goal to register
        """
        self.goals[goal.id] = goal
        logger.info(f"Registered goal: {goal.name} ({goal.id})")
        
    def register_plan(self, plan: Plan) -> None:
        """
        Register a plan with the planner.
        
        Args:
            plan: Plan to register
        """
        self.plans[plan.id] = plan
        logger.info(f"Registered plan: {plan.name} ({plan.id})")
        
    def get_goal(self, goal_id: str) -> Optional[Goal]:
        """
        Get a goal by ID.
        
        Args:
            goal_id: Goal ID
            
        Returns:
            Goal or None if not found
        """
        return self.goals.get(goal_id)
        
    def get_plan(self, plan_id: str) -> Optional[Plan]:
        """
        Get a plan by ID.
        
        Args:
            plan_id: Plan ID
            
        Returns:
            Plan or None if not found
        """
        return self.plans.get(plan_id)
        
    def get_plan_for_goal(self, goal_id: str) -> Optional[Plan]:
        """
        Get a plan for a specific goal.
        
        Args:
            goal_id: Goal ID
            
        Returns:
            Plan or None if not found
        """
        for plan in self.plans.values():
            if plan.goal.id == goal_id:
                return plan
        return None


class HierarchicalPlanner(Planner):
    """Planner that creates hierarchical plans with subgoals."""
    
    async def create_plan(self, goal: Goal) -> Optional[Plan]:
        """
        Create a hierarchical plan to achieve a goal.
        
        Args:
            goal: Goal to achieve
            
        Returns:
            Plan or None if planning failed
        """
        logger.info(f"Creating hierarchical plan for goal: {goal.name}")
        
        # Create a plan for the main goal
        plan = Plan(
            name=f"Plan for {goal.name}",
            description=f"Hierarchical plan to achieve: {goal.description}",
            goal=goal
        )
        
        # Process subgoals and create steps
        for subgoal in goal.subgoals:
            # Create a step for the subgoal
            step = PlanStep(
                name=subgoal.name,
                description=subgoal.description,
                action="process_subgoal",
                parameters={"subgoal_id": subgoal.id},
                expected_outcome=f"Achieve subgoal: {subgoal.name}"
            )
            plan.add_step(step)
            
        self.register_plan(plan)
        return plan


class GoalOrientedPlanner(Planner):
    """Planner that creates goal-oriented plans with dynamic replanning."""
    
    def __init__(self, name: str = "GoalOrientedPlanner", replan_threshold: float = 0.5):
        """
        Initialize a goal-oriented planner.
        
        Args:
            name: Planner name
            replan_threshold: Threshold for replanning (0.0 to 1.0)
        """
        super().__init__(name)
        self.replan_threshold = replan_threshold
        self.action_library: Dict[str, Dict[str, Any]] = {}
        
    def register_action(self, 
                       name: str, 
                       action: Callable,
                       preconditions: Optional[Callable[[Dict[str, Any]], bool]] = None,
                       effects: Optional[Callable[[Dict[str, Any]], Dict[str, Any]]] = None,
                       cost: float = 1.0) -> None:
        """
        Register an action with the planner.
        
        Args:
            name: Action name
            action: Action function
            preconditions: Function to check if action can be executed
            effects: Function to compute effects of action
            cost: Action cost
        """
        self.action_library[name] = {
            "action": action,
            "preconditions": preconditions,
            "effects": effects,
            "cost": cost
        }
        logger.info(f"Registered action: {name}")
        
    async def create_plan(self, goal: Goal) -> Optional[Plan]:
        """
        Create a goal-oriented plan to achieve a goal.
        
        Args:
            goal: Goal to achieve
            
        Returns:
            Plan or None if planning failed
        """
        logger.info(f"Creating goal-oriented plan for goal: {goal.name}")
        
        # Create a plan for the goal
        plan = Plan(
            name=f"Plan for {goal.name}",
            description=f"Goal-oriented plan to achieve: {goal.description}",
            goal=goal
        )
        
        # Simple planning algorithm (in a real implementation, this would be more sophisticated)
        # For example, using A* search or other planning algorithms
        
        # For now, we'll just create a simple sequence of steps
        # In a real implementation, this would analyze the goal and available actions
        
        # Example steps (these would be dynamically generated based on the goal)
        step1 = PlanStep(
            name="Analyze requirements",
            description="Analyze the requirements for the goal",
            action="analyze_requirements",
            parameters={"goal_id": goal.id},
            expected_outcome="Requirements analyzed"
        )
        plan.add_step(step1)
        
        step2 = PlanStep(
            name="Gather resources",
            description="Gather necessary resources for the goal",
            action="gather_resources",
            parameters={"requirements": "{{step1.result.requirements}}"},
            expected_outcome="Resources gathered"
        )
        plan.add_step(step2)
        
        step3 = PlanStep(
            name="Execute actions",
            description="Execute actions to achieve the goal",
            action="execute_actions",
            parameters={"resources": "{{step2.result.resources}}"},
            expected_outcome="Actions executed"
        )
        plan.add_step(step3)
        
        step4 = PlanStep(
            name="Verify goal",
            description="Verify that the goal has been achieved",
            action="verify_goal",
            parameters={"goal_id": goal.id},
            expected_outcome="Goal verified"
        )
        plan.add_step(step4)
        
        self.register_plan(plan)
        return plan
        
    async def replan(self, plan: Plan, context: Dict[str, Any]) -> Optional[Plan]:
        """
        Create a new plan based on the current state.
        
        Args:
            plan: Current plan
            context: Current context
            
        Returns:
            New plan or None if replanning failed
        """
        logger.info(f"Replanning for goal: {plan.goal.name}")
        
        # Create a new plan for the same goal
        new_plan = await self.create_plan(plan.goal)
        
        if new_plan:
            # Copy relevant context from the old plan
            new_plan.metadata["previous_plan_id"] = plan.id
            new_plan.metadata["replan_reason"] = context.get("replan_reason", "unknown")
            
            # Register the new plan
            self.register_plan(new_plan)
            
            return new_plan
        
        return None
        
    async def execute_plan_with_replanning(self, plan: Plan, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute a plan with dynamic replanning if needed.
        
        Args:
            plan: Plan to execute
            context: Execution context
            
        Returns:
            Execution result
        """
        plan.start()
        logger.info(f"Starting execution of plan with replanning: {plan.name}")
        
        try:
            while True:
                current_step = plan.get_current_step()
                if not current_step:
                    break
                    
                if current_step.status == "pending":
                    current_step.start()
                    logger.info(f"Executing step: {current_step.name}")
                    
                    try:
                        # Execute the step
                        if isinstance(current_step.action, str):
                            # Tool execution
                            if "execute_tool" in context:
                                execute_tool = context["execute_tool"]
                                result = await execute_tool(
                                    current_step.action,
                                    **current_step.parameters
                                )
                            else:
                                raise ValueError("No execute_tool function in context")
                        else:
                            # Function execution
                            result = await current_step.action(**current_step.parameters)
                            
                        current_step.complete(result)
                        logger.info(f"Step completed: {current_step.name}")
                    except Exception as e:
                        logger.error(f"Error executing step {current_step.name}: {str(e)}")
                        logger.debug(traceback.format_exc())
                        current_step.fail(str(e))
                        
                        if current_step.can_retry():
                            logger.info(f"Retrying step: {current_step.name} (attempt {current_step.retry_attempts + 1})")
                            current_step.retry()
                            continue
                        
                        # Check if we should replan
                        if plan.get_progress() < self.replan_threshold:
                            logger.info(f"Progress below threshold ({plan.get_progress()} < {self.replan_threshold}), attempting to replan")
                            
                            context["replan_reason"] = f"Step failed: {current_step.name}"
                            new_plan = await self.replan(plan, context)
                            
                            if new_plan:
                                logger.info(f"Replanning successful, switching to new plan: {new_plan.id}")
                                return await self.execute_plan_with_replanning(new_plan, context)
                
                if current_step.status == "failed":
                    logger.error(f"Plan execution failed at step: {current_step.name}")
                    plan.fail()
                    return {
                        "status": "error",
                        "message": f"Plan execution failed at step: {current_step.name}",
                        "step_id": current_step.id,
                        "error": current_step.error
                    }
                
                if not plan.advance():
                    break
            
            # Check if all steps completed successfully
            if plan.is_completed():
                plan.complete()
                logger.info(f"Plan execution completed successfully: {plan.name}")
                return {
                    "status": "success",
                    "message": "Plan execution completed successfully",
                    "plan_id": plan.id,
                    "goal_id": plan.goal.id
                }
            else:
                plan.fail()
                logger.error(f"Plan execution failed: {plan.name}")
                return {
                    "status": "error",
                    "message": "Plan execution failed",
                    "plan_id": plan.id,
                    "goal_id": plan.goal.id
                }
                
        except Exception as e:
            logger.error(f"Error executing plan {plan.name}: {str(e)}")
            logger.debug(traceback.format_exc())
            plan.fail()
            return {
                "status": "error",
                "message": str(e),
                "plan_id": plan.id,
                "goal_id": plan.goal.id
            }

