# IntelliFlow Architecture Diagram

```
┌───────────────────────────────────────────────────────────────────────────┐
│                            IntelliFlow Platform                           │
└───────────────────────────────────────────────────────────────────────────┘
                                     │
                 ┌──────────────────┬┴┬──────────────────┐
                 │                  │ │                  │
                 ▼                  ▼ │                  ▼
┌───────────────────────┐ ┌──────────┴──────────┐ ┌───────────────────────┐
│    Frontend Layer     │ │    Backend Layer     │ │   Integration Layer   │
└─────────┬─────────────┘ └──────────┬──────────┘ └───────────┬───────────┘
          │                          │                        │
          ▼                          ▼                        ▼
┌─────────────────────┐   ┌────────────────────┐   ┌────────────────────────┐
│  React Application  │   │  Agent Framework   │   │  Google Cloud Services │
│                     │   │                    │   │                        │
│ ┌─────────────────┐ │   │ ┌────────────────┐ │   │ ┌──────────────────┐  │
│ │    Dashboard    │ │   │ │  Orchestrator  │ │   │ │     BigQuery     │  │
│ └─────────────────┘ │   │ └────────────────┘ │   │ └──────────────────┘  │
│                     │   │                    │   │                        │
│ ┌─────────────────┐ │   │ ┌────────────────┐ │   │ ┌──────────────────┐  │
│ │AnalysisConfig   │ │   │ │ Data Ingestion │ │   │ │     Vertex AI    │  │
│ └─────────────────┘ │   │ └────────────────┘ │   │ └──────────────────┘  │
│                     │   │                    │   │                        │
│ ┌─────────────────┐ │   │ ┌────────────────┐ │   │ ┌──────────────────┐  │
│ │AnalysisResults  │ │   │ │    Analysis    │ │   │ │      Gemini      │  │
│ └─────────────────┘ │   │ └────────────────┘ │   │ └──────────────────┘  │
│                     │   │                    │   │                        │
│ ┌─────────────────┐ │   │ ┌────────────────┐ │   │ ┌──────────────────┐  │
│ │AnalysisHistory  │ │   │ │ Visualization  │ │   │ │  Cloud Storage   │  │
│ └─────────────────┘ │   │ └────────────────┘ │   │ └──────────────────┘  │
│                     │   │                    │   │                        │
│ ┌─────────────────┐ │   │ ┌────────────────┐ │   │ ┌──────────────────┐  │
│ │     Layout      │ │   │ │    Insights    │ │   │ │     Pub/Sub      │  │
│ └─────────────────┘ │   │ └────────────────┘ │   │ └──────────────────┘  │
│                     │   │                    │   │                        │
│ ┌─────────────────┐ │   │ ┌────────────────┐ │   │ ┌──────────────────┐  │
│ │  UI Components  │ │   │ │  Message Bus   │ │   │ │ Cloud Functions  │  │
│ └─────────────────┘ │   │ └────────────────┘ │   │ └──────────────────┘  │
└─────────────────────┘   └────────────────────┘   └────────────────────────┘
          │                          │                        │
          └──────────────────────────┼────────────────────────┘
                                     │
                                     ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                          Enhanced ADK Framework                           │
│                                                                           │
│  ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────────────┐  │
│  │      Core       │   │    Planning     │   │         Memory          │  │
│  │                 │   │                 │   │                         │  │
│  │ - Agent         │   │ - Goal          │   │ - Short-term Memory     │  │
│  │ - Message       │   │ - Plan          │   │ - Long-term Memory      │  │
│  │ - Tool          │   │ - Task          │   │ - Working Memory        │  │
│  └─────────────────┘   └─────────────────┘   └─────────────────────────┘  │
│                                                                           │
│  ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────────────┐  │
│  │  Communication  │   │   Monitoring    │   │    Data Analysis        │  │
│  │                 │   │                 │   │                         │  │
│  │ - Channel       │   │ - Monitor       │   │ - Data Analysis Agent   │  │
│  │ - Router        │   │ - Metrics       │   │ - Preprocessing         │  │
│  │ - Protocol      │   │ - Visualizer    │   │ - Visualization         │  │
│  └─────────────────┘   └─────────────────┘   └─────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────────┘
```

## Component Descriptions

### Frontend Layer

The Frontend Layer provides the user interface for interacting with the IntelliFlow platform.

- **Dashboard**: Main overview page showing analysis status and insights
- **AnalysisConfig**: Multi-step wizard for configuring data analysis
- **AnalysisResults**: Interactive visualization of analysis results
- **AnalysisHistory**: Timeline view of past analyses
- **Layout**: Common layout components (navigation, header, footer)
- **UI Components**: Reusable UI components (buttons, forms, cards, etc.)

### Backend Layer

The Backend Layer handles the core business logic and orchestration of the IntelliFlow platform.

- **Orchestrator**: Coordinates the overall workflow and communication between agents
- **Data Ingestion**: Handles data loading, cleaning, and preprocessing
- **Analysis**: Performs statistical analysis and modeling
- **Visualization**: Creates charts and graphs
- **Insights**: Extracts insights and generates reports
- **Message Bus**: Facilitates communication between agents

### Integration Layer

The Integration Layer connects IntelliFlow to external services and data sources.

- **BigQuery**: Integration with Google BigQuery for data querying and analysis
- **Vertex AI**: Integration with Google Vertex AI for machine learning
- **Gemini**: Integration with Google Gemini API for advanced AI capabilities
- **Cloud Storage**: Integration with Google Cloud Storage for data storage
- **Pub/Sub**: Integration with Google Pub/Sub for messaging
- **Cloud Functions**: Integration with Google Cloud Functions for serverless computing

### Enhanced ADK Framework

The Enhanced ADK Framework provides the foundation for building intelligent agents.

- **Core**: Basic agent components (Agent, Message, Tool)
- **Planning**: Goal-oriented planning system (Goal, Plan, Task)
- **Memory**: Memory management system (Short-term, Long-term, Working)
- **Communication**: Inter-agent communication system (Channel, Router, Protocol)
- **Monitoring**: Agent monitoring and visualization (Monitor, Metrics, Visualizer)
- **Data Analysis**: Specialized components for data analysis

## Data Flow

1. User configures analysis through the Frontend UI
2. Request is sent to the Orchestrator Agent
3. Orchestrator creates a plan and delegates tasks to specialized agents
4. Data Ingestion Agent loads and preprocesses data
5. Analysis Agent performs statistical analysis
6. Visualization Agent creates charts and graphs
7. Insight Generation Agent extracts insights and creates reports
8. Results are sent back to the Frontend UI for display

## Communication Patterns

- **Request-Response**: Used for synchronous operations
- **Publish-Subscribe**: Used for asynchronous notifications
- **Event-Driven**: Used for triggering workflows based on events

## Scalability Considerations

- Agents can be scaled horizontally to handle increased load
- Google Cloud services provide automatic scaling
- Message Bus handles communication between distributed agents
- Memory systems can be backed by distributed storage

