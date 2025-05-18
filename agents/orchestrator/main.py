"""
Orchestrator Agent implementation.

This agent is responsible for coordinating the multi-agent analysis workflow.
"""

import asyncio
from typing import Dict, Any, List, Optional

from common.adk import Agent, Tool, Message
from common.logging.logger import get_logger
from orchestration.workflow_manager.workflow import Workflow, SequentialWorkflow, ParallelWorkflow, WorkflowStep

logger = get_logger("agent.orchestrator")

class AgentRegistryTool(Tool):
    """Tool for managing agent registry."""
    
    def __init__(self):
        super().__init__(name="AgentRegistryTool", description="Manage agent registry")
        self.agents = {}
    
    async def execute(self, action: str, agent_id: Optional[str] = None, agent_info: Optional[Dict[str, Any]] = None, **kwargs) -> Dict[str, Any]:
        """
        Execute agent registry operations.
        
        Args:
            action: Registry action (register, get, list, remove)
            agent_id: Agent identifier
            agent_info: Agent information for registration
            
        Returns:
            Operation result
        """
        logger.info(f"Executing agent registry action: {action}")
        
        if action == "register" and agent_id and agent_info:
            self.agents[agent_id] = agent_info
            return {
                "status": "success",
                "message": f"Agent {agent_id} registered successfully"
            }
        
        elif action == "get" and agent_id:
            if agent_id in self.agents:
                return {
                    "status": "success",
                    "agent": self.agents[agent_id]
                }
            else:
                return {
                    "status": "error",
                    "message": f"Agent {agent_id} not found"
                }
        
        elif action == "list":
            return {
                "status": "success",
                "agents": list(self.agents.keys())
            }
        
        elif action == "remove" and agent_id:
            if agent_id in self.agents:
                del self.agents[agent_id]
                return {
                    "status": "success",
                    "message": f"Agent {agent_id} removed successfully"
                }
            else:
                return {
                    "status": "error",
                    "message": f"Agent {agent_id} not found"
                }
        
        else:
            return {
                "status": "error",
                "message": f"Invalid action or missing parameters"
            }


class WorkflowManagerTool(Tool):
    """Tool for managing workflows."""
    
    def __init__(self):
        super().__init__(name="WorkflowManagerTool", description="Manage and execute workflows")
        self.workflows = {}
    
    async def execute(self, action: str, workflow_id: Optional[str] = None, workflow: Optional[Dict[str, Any]] = None, context: Optional[Dict[str, Any]] = None, **kwargs) -> Dict[str, Any]:
        """
        Execute workflow management operations.
        
        Args:
            action: Workflow action (register, execute, get, list, remove)
            workflow_id: Workflow identifier
            workflow: Workflow definition for registration
            context: Execution context for workflow execution
            
        Returns:
            Operation result
        """
        logger.info(f"Executing workflow manager action: {action}")
        
        if action == "register" and workflow_id and workflow:
            self.workflows[workflow_id] = workflow
            return {
                "status": "success",
                "message": f"Workflow {workflow_id} registered successfully"
            }
        
        elif action == "execute" and workflow_id:
            if workflow_id in self.workflows:
                workflow_obj = self._create_workflow_object(self.workflows[workflow_id])
                if workflow_obj:
                    result = await workflow_obj.execute(context or {})
                    return {
                        "status": "success",
                        "result": result
                    }
                else:
                    return {
                        "status": "error",
                        "message": f"Failed to create workflow object for {workflow_id}"
                    }
            else:
                return {
                    "status": "error",
                    "message": f"Workflow {workflow_id} not found"
                }
        
        elif action == "get" and workflow_id:
            if workflow_id in self.workflows:
                return {
                    "status": "success",
                    "workflow": self.workflows[workflow_id]
                }
            else:
                return {
                    "status": "error",
                    "message": f"Workflow {workflow_id} not found"
                }
        
        elif action == "list":
            return {
                "status": "success",
                "workflows": list(self.workflows.keys())
            }
        
        elif action == "remove" and workflow_id:
            if workflow_id in self.workflows:
                del self.workflows[workflow_id]
                return {
                    "status": "success",
                    "message": f"Workflow {workflow_id} removed successfully"
                }
            else:
                return {
                    "status": "error",
                    "message": f"Workflow {workflow_id} not found"
                }
        
        else:
            return {
                "status": "error",
                "message": f"Invalid action or missing parameters"
            }
    
    def _create_workflow_object(self, workflow_def: Dict[str, Any]) -> Optional[Workflow]:
        """
        Create a workflow object from definition.
        
        Args:
            workflow_def: Workflow definition
            
        Returns:
            Workflow object or None if creation fails
        """
        try:
            workflow_type = workflow_def.get("type", "sequential")
            workflow_id = workflow_def.get("id")
            workflow_name = workflow_def.get("name")
            steps = workflow_def.get("steps", [])
            
            workflow_steps = []
            for step in steps:
                if isinstance(step, dict) and "workflow_id" in step:
                    # Nested workflow
                    nested_workflow_id = step["workflow_id"]
                    if nested_workflow_id in self.workflows:
                        nested_workflow = self._create_workflow_object(self.workflows[nested_workflow_id])
                        if nested_workflow:
                            workflow_steps.append(nested_workflow)
                elif isinstance(step, dict) and "step_id" in step and "agent_id" in step and "intent" in step:
                    # Regular step
                    workflow_steps.append(WorkflowStep(
                        step_id=step["step_id"],
                        agent_id=step["agent_id"],
                        intent=step["intent"],
                        parameters=step.get("parameters", {})
                    ))
                elif isinstance(step, tuple) and len(step) >= 3:
                    # Tuple format
                    workflow_steps.append(step)
            
            if workflow_type.lower() == "parallel":
                return ParallelWorkflow(workflow_steps, workflow_id, workflow_name)
            else:
                return SequentialWorkflow(workflow_steps, workflow_id, workflow_name)
        
        except Exception as e:
            logger.error(f"Error creating workflow object: {str(e)}")
            return None


class OrchestratorAgent(Agent):
    """Agent responsible for coordinating the multi-agent analysis workflow."""
    
    def __init__(self, config: Dict[str, Any]):
        """
        Initialize the Orchestrator agent.
        
        Args:
            config: Agent configuration
        """
        super().__init__(name="OrchestratorAgent")
        self.config = config
        
        # Register tools
        self.agent_registry_tool = AgentRegistryTool()
        self.workflow_manager_tool = WorkflowManagerTool()
        
        self.register_tools([
            self.agent_registry_tool,
            self.workflow_manager_tool
        ])
        
        # Register message handlers
        self.register_message_handler("REGISTER_AGENT", self.handle_register_agent)
        self.register_message_handler("REGISTER_WORKFLOW", self.handle_register_workflow)
        self.register_message_handler("EXECUTE_WORKFLOW", self.handle_execute_workflow)
        self.register_message_handler("START_ANALYSIS", self.handle_start_analysis)
        
        # Register predefined workflows
        self._register_predefined_workflows()
        
        logger.info("OrchestratorAgent initialized")
    
    async def handle_register_agent(self, message: Message) -> Message:
        """
        Handle agent registration requests.
        
        Args:
            message: Request message
            
        Returns:
            Response message with registration result
        """
        logger.info(f"Handling REGISTER_AGENT request: {message.content}")
        
        agent_id = message.content.get("agent_id")
        agent_info = message.content.get("agent_info", {})
        
        result = await self.execute_tool(
            "AgentRegistryTool", 
            action="register", 
            agent_id=agent_id, 
            agent_info=agent_info
        )
        
        return Message(
            sender=self.name,
            intent="AGENT_REGISTERED",
            content=result,
            correlation_id=message.message_id,
            reply_to=message.sender
        )
    
    async def handle_register_workflow(self, message: Message) -> Message:
        """
        Handle workflow registration requests.
        
        Args:
            message: Request message
            
        Returns:
            Response message with registration result
        """
        logger.info(f"Handling REGISTER_WORKFLOW request: {message.content}")
        
        workflow_id = message.content.get("workflow_id")
        workflow = message.content.get("workflow", {})
        
        result = await self.execute_tool(
            "WorkflowManagerTool", 
            action="register", 
            workflow_id=workflow_id, 
            workflow=workflow
        )
        
        return Message(
            sender=self.name,
            intent="WORKFLOW_REGISTERED",
            content=result,
            correlation_id=message.message_id,
            reply_to=message.sender
        )
    
    async def handle_execute_workflow(self, message: Message) -> Message:
        """
        Handle workflow execution requests.
        
        Args:
            message: Request message
            
        Returns:
            Response message with execution result
        """
        logger.info(f"Handling EXECUTE_WORKFLOW request: {message.content}")
        
        workflow_id = message.content.get("workflow_id")
        context = message.content.get("context", {})
        
        result = await self.execute_tool(
            "WorkflowManagerTool", 
            action="execute", 
            workflow_id=workflow_id, 
            context=context
        )
        
        return Message(
            sender=self.name,
            intent="WORKFLOW_EXECUTED",
            content=result,
            correlation_id=message.message_id,
            reply_to=message.sender
        )
    
    async def handle_start_analysis(self, message: Message) -> Message:
        """
        Handle analysis start requests.
        
        Args:
            message: Request message
            
        Returns:
            Response message with analysis result
        """
        logger.info(f"Handling START_ANALYSIS request: {message.content}")
        
        analysis_type = message.content.get("analysis_type", "complete")
        data_source = message.content.get("data_source", {})
        objectives = message.content.get("objectives", [])
        parameters = message.content.get("parameters", {})
        
        # Create context for the analysis
        context = {
            "data_source": data_source,
            "objectives": objectives,
            "parameters": parameters
        }
        
        # Determine which workflow to execute
        workflow_id = f"{analysis_type}_analysis"
        if analysis_type == "customer_feedback":
            workflow_id = "customer_feedback_analysis"
        
        # Execute the workflow
        result = await self.execute_tool(
            "WorkflowManagerTool", 
            action="execute", 
            workflow_id=workflow_id, 
            context=context
        )
        
        # Process the result
        if result.get("status") == "success":
            analysis_result = {
                "status": "success",
                "analysis_type": analysis_type,
                "results": result.get("result", {}),
                "summary": self._generate_analysis_summary(result.get("result", {}))
            }
        else:
            analysis_result = {
                "status": "error",
                "message": result.get("message", "Analysis execution failed"),
                "analysis_type": analysis_type
            }
        
        return Message(
            sender=self.name,
            intent="ANALYSIS_COMPLETED",
            content=analysis_result,
            correlation_id=message.message_id,
            reply_to=message.sender
        )
    
    def _register_predefined_workflows(self) -> None:
        """Register predefined workflows."""
        # Data preparation workflow
        data_preparation = {
            "id": "data_preparation",
            "name": "Data Preparation Workflow",
            "type": "sequential",
            "steps": [
                {
                    "step_id": "discover_sources",
                    "agent_id": "data_scout",
                    "intent": "DISCOVER_DATA_SOURCES"
                },
                {
                    "step_id": "extract_data",
                    "agent_id": "data_scout",
                    "intent": "EXTRACT_DATA"
                },
                {
                    "step_id": "clean_data",
                    "agent_id": "data_engineer",
                    "intent": "CLEAN_DATA"
                },
                {
                    "step_id": "transform_data",
                    "agent_id": "data_engineer",
                    "intent": "TRANSFORM_DATA"
                }
            ]
        }
        
        # Analysis workflow
        analysis = {
            "id": "analysis",
            "name": "Analysis Workflow",
            "type": "sequential",
            "steps": [
                {
                    "step_id": "plan_analysis",
                    "agent_id": "analysis_strategist",
                    "intent": "PLAN_ANALYSIS"
                },
                {
                    "step_id": "generate_insights",
                    "agent_id": "insight_generator",
                    "intent": "GENERATE_INSIGHTS"
                }
            ]
        }
        
        # Presentation workflow
        presentation = {
            "id": "presentation",
            "name": "Presentation Workflow",
            "type": "parallel",
            "steps": [
                {
                    "step_id": "create_visualizations",
                    "agent_id": "visualization_specialist",
                    "intent": "CREATE_VISUALIZATIONS"
                },
                {
                    "step_id": "compose_narrative",
                    "agent_id": "narrative_composer",
                    "intent": "COMPOSE_NARRATIVE"
                }
            ]
        }
        
        # Complete analysis workflow
        complete_analysis = {
            "id": "complete_analysis",
            "name": "Complete Analysis Workflow",
            "type": "sequential",
            "steps": [
                {"workflow_id": "data_preparation"},
                {"workflow_id": "analysis"},
                {"workflow_id": "presentation"}
            ]
        }
        
        # Customer feedback analysis workflow
        customer_feedback_analysis = {
            "id": "customer_feedback_analysis",
            "name": "Customer Feedback Analysis Workflow",
            "type": "sequential",
            "steps": [
                {
                    "step_id": "extract_feedback",
                    "agent_id": "data_scout",
                    "intent": "EXTRACT_DATA",
                    "parameters": {
                        "source_type": "bigquery",
                        "dataset_id": "customer_data",
                        "table_id": "feedback"
                    }
                },
                {
                    "step_id": "clean_feedback",
                    "agent_id": "data_engineer",
                    "intent": "CLEAN_DATA",
                    "parameters": {
                        "operations": [
                            {"type": "remove_nulls", "columns": ["comment"]},
                            {"type": "normalize_text", "columns": ["comment"]}
                        ]
                    }
                },
                {
                    "step_id": "plan_feedback_analysis",
                    "agent_id": "analysis_strategist",
                    "intent": "PLAN_ANALYSIS",
                    "parameters": {
                        "objectives": ["analyze_text", "discover_patterns", "detect_anomalies"]
                    }
                },
                {
                    "step_id": "analyze_sentiment",
                    "agent_id": "insight_generator",
                    "intent": "ANALYZE_TEXT",
                    "parameters": {
                        "technique": "sentiment_analysis"
                    }
                },
                {
                    "step_id": "identify_topics",
                    "agent_id": "insight_generator",
                    "intent": "ANALYZE_TEXT",
                    "parameters": {
                        "technique": "topic_modeling"
                    }
                },
                {
                    "step_id": "generate_feedback_insights",
                    "agent_id": "insight_generator",
                    "intent": "GENERATE_INSIGHTS"
                },
                {
                    "step_id": "create_feedback_visualizations",
                    "agent_id": "visualization_specialist",
                    "intent": "CREATE_VISUALIZATIONS"
                },
                {
                    "step_id": "compose_feedback_narrative",
                    "agent_id": "narrative_composer",
                    "intent": "COMPOSE_NARRATIVE",
                    "parameters": {
                        "template_id": "insight_brief"
                    }
                }
            ]
        }
        
        # Register all workflows
        asyncio.create_task(self.execute_tool(
            "WorkflowManagerTool", 
            action="register", 
            workflow_id="data_preparation", 
            workflow=data_preparation
        ))
        
        asyncio.create_task(self.execute_tool(
            "WorkflowManagerTool", 
            action="register", 
            workflow_id="analysis", 
            workflow=analysis
        ))
        
        asyncio.create_task(self.execute_tool(
            "WorkflowManagerTool", 
            action="register", 
            workflow_id="presentation", 
            workflow=presentation
        ))
        
        asyncio.create_task(self.execute_tool(
            "WorkflowManagerTool", 
            action="register", 
            workflow_id="complete_analysis", 
            workflow=complete_analysis
        ))
        
        asyncio.create_task(self.execute_tool(
            "WorkflowManagerTool", 
            action="register", 
            workflow_id="customer_feedback_analysis", 
            workflow=customer_feedback_analysis
        ))
    
    def _generate_analysis_summary(self, result: Dict[str, Any]) -> str:
        """
        Generate a summary of the analysis result.
        
        Args:
            result: Analysis result
            
        Returns:
            Summary text
        """
        # This would generate a more sophisticated summary in a real implementation
        # For now, we'll return a simple summary
        
        insights_count = len(result.get("insights", []))
        visualizations_count = len(result.get("visualizations", {}).get("charts", []))
        
        return f"Analysis completed successfully with {insights_count} insights and {visualizations_count} visualizations."
