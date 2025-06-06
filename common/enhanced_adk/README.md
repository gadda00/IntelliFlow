# Enhanced Agent Development Kit (ADK)

The Enhanced ADK is a comprehensive framework for building multi-agent systems with advanced capabilities for planning, memory, monitoring, and communication.

## Features

### Core Components

- **Enhanced Agent**: Advanced agent implementation with support for planning, memory, monitoring, and communication.
- **Tool**: Enhanced tool implementation with parameter validation, monitoring, and error handling.
- **Message**: Enhanced message class with routing, priority, and metadata support.

### Planning

- **Goal-Oriented Planning**: Create and execute plans to achieve specific goals.
- **Hierarchical Planning**: Break down complex goals into subgoals and create hierarchical plans.
- **Dynamic Replanning**: Adapt plans when execution fails or conditions change.

### Memory

- **Working Memory**: Short-term memory for current task execution.
- **Long-Term Memory**: Persistent memory for knowledge and experiences.
- **Memory Storage**: Multiple storage backends (in-memory, file-based).

### Monitoring

- **Event Logging**: Comprehensive event logging for agent activities.
- **Metrics Collection**: Collect and analyze metrics from agent operations.
- **Visualization**: Visualize agent networks and metrics.

### Communication

- **Channels**: Multiple communication channels (in-memory, Google Pub/Sub).
- **Message Routing**: Topic-based routing for efficient communication.
- **Subscription Patterns**: Subscribe to topics using regular expression patterns.

## Usage

### Creating an Agent

```python
from common.enhanced_adk import EnhancedAgent, Tool, Message
from common.enhanced_adk.planning import GoalOrientedPlanner
from common.enhanced_adk.memory import WorkingMemory
from common.enhanced_adk.monitoring import AgentMonitor
from common.enhanced_adk.communication import InMemoryChannel

# Create components
planner = GoalOrientedPlanner()
memory = WorkingMemory()
monitor = AgentMonitor()
channel = InMemoryChannel()

# Create agent
agent = EnhancedAgent(
    name="MyAgent",
    description="An example agent",
    planner=planner,
    memory=memory,
    monitor=monitor,
    channel=channel
)

# Start agent
await agent.start()
```

### Creating and Registering Tools

```python
from common.enhanced_adk import Tool

class CalculatorTool(Tool):
    def __init__(self):
        super().__init__(
            name="CalculatorTool",
            description="Perform calculations",
            parameters=[
                ToolParameter(
                    name="operation",
                    description="Operation to perform",
                    type_hint=str,
                    required=True
                ),
                ToolParameter(
                    name="a",
                    description="First operand",
                    type_hint=float,
                    required=True
                ),
                ToolParameter(
                    name="b",
                    description="Second operand",
                    type_hint=float,
                    required=True
                )
            ]
        )
    
    async def _execute_impl(self, operation: str, a: float, b: float) -> Dict[str, Any]:
        if operation == "add":
            return {"result": a + b}
        elif operation == "subtract":
            return {"result": a - b}
        elif operation == "multiply":
            return {"result": a * b}
        elif operation == "divide":
            if b == 0:
                return {"status": "error", "message": "Division by zero"}
            return {"result": a / b}
        else:
            return {"status": "error", "message": f"Unknown operation: {operation}"}

# Register tool with agent
agent.register_tool(CalculatorTool())
```

### Creating and Executing Plans

```python
from common.enhanced_adk.planning import Goal, Plan, PlanStep

# Create a goal
goal = Goal(
    name="Calculate area",
    description="Calculate the area of a rectangle"
)

# Create a plan
plan = await agent.planner.create_plan(goal)

# Execute the plan
context = {
    "execute_tool": agent.execute_tool,
    "length": 5,
    "width": 3
}
result = await agent.planner.execute_plan(plan, context)
```

### Using Memory

```python
# Add item to memory
await agent.memory.add(
    category="calculations",
    key="rectangle_area",
    value={"length": 5, "width": 3, "area": 15}
)

# Get item from memory
area_data = await agent.memory.get("calculations", "rectangle_area")

# Search memory
results = await agent.memory.search("rectangle")
```

### Sending and Receiving Messages

```python
# Register message handler
async def handle_calculation_request(message: Message) -> Optional[Message]:
    # Extract parameters from message
    operation = message.content.get("operation")
    a = message.content.get("a")
    b = message.content.get("b")
    
    # Execute calculation
    result = await agent.execute_tool(
        "CalculatorTool",
        operation=operation,
        a=a,
        b=b
    )
    
    # Create response
    return Message(
        sender=agent.name,
        intent="CALCULATION_RESULT",
        content={"result": result},
        correlation_id=message.message_id,
        reply_to=message.sender
    )

agent.register_message_handler("CALCULATION_REQUEST", handle_calculation_request)

# Send a message
await agent.send_message(
    to="CalculatorAgent",
    intent="CALCULATION_REQUEST",
    content={
        "operation": "add",
        "a": 5,
        "b": 3
    }
)
```

### Monitoring

```python
# Log custom event
agent.monitor.log_event(
    agent_id=agent.name,
    event_type="CUSTOM",
    data={"action": "calculation", "operation": "add"}
)

# Get agent metrics
metrics = agent.monitor.get_agent_metrics(agent.name)

# Get system metrics
system_metrics = agent.monitor.get_system_metrics()
```

## Integration with IntelliFlow

The Enhanced ADK is designed to integrate seamlessly with the IntelliFlow platform, providing advanced capabilities for multi-agent data analysis workflows.

### Orchestrator Agent

```python
from common.enhanced_adk import EnhancedAgent
from common.enhanced_adk.planning import GoalOrientedPlanner
from common.enhanced_adk.memory import LongTermMemory
from common.enhanced_adk.monitoring import AgentMonitor
from common.enhanced_adk.communication import PubSubChannel

class EnhancedOrchestratorAgent(EnhancedAgent):
    def __init__(self, config):
        # Create components
        planner = GoalOrientedPlanner()
        memory = LongTermMemory()
        monitor = AgentMonitor()
        channel = PubSubChannel(config.get("project_id"))
        
        super().__init__(
            name="OrchestratorAgent",
            description="Coordinates the multi-agent analysis workflow",
            planner=planner,
            memory=memory,
            monitor=monitor,
            channel=channel
        )
        
        # Register tools and message handlers
        self.register_tools([
            AgentRegistryTool(),
            WorkflowManagerTool()
        ])
        
        self.register_message_handler("REGISTER_AGENT", self.handle_register_agent)
        self.register_message_handler("REGISTER_WORKFLOW", self.handle_register_workflow)
        self.register_message_handler("EXECUTE_WORKFLOW", self.handle_execute_workflow)
        self.register_message_handler("START_ANALYSIS", self.handle_start_analysis)
```

## Best Practices

1. **Agent Design**:
   - Keep agents focused on specific responsibilities
   - Use tools for agent capabilities
   - Use message handlers for inter-agent communication

2. **Planning**:
   - Break down complex goals into subgoals
   - Use hierarchical planning for complex workflows
   - Implement proper error handling and replanning

3. **Memory Management**:
   - Use working memory for short-term data
   - Use long-term memory for persistent knowledge
   - Implement proper memory cleanup

4. **Monitoring**:
   - Log important events
   - Collect and analyze metrics
   - Visualize agent activities for debugging

5. **Communication**:
   - Use topic-based routing for efficient communication
   - Implement proper error handling for message processing
   - Use correlation IDs for tracking related messages

