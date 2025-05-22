# IntelliFlow Architecture Diagram

## Multi-Agent System Architecture

```
+---------------------+     +---------------------+
|                     |     |                     |
|    User Interface   |     |   GitHub Pages      |
|    (React + Vite)   |<--->|   Deployment        |
|                     |     |                     |
+----------^----------+     +---------------------+
           |
           v
+---------------------+
|                     |
|   API Gateway       |
|                     |
+----------^----------+
           |
           v
+---------------------+
|                     |
|   Orchestrator      |
|   Agent             |
|                     |
+----------^----------+
           |
           +------------+------------+------------+------------+------------+
           |            |            |            |            |            |
           v            v            v            v            v            v
+----------+--+ +-------+-----+ +----+-------+ +--+----------+ +-----------++ +----------+
|             | |             | |            | |             | |            | |          |
| Data Scout  | | Data        | | Analysis   | | Insight     | |Visualization| |Narrative |
| Agent       | | Engineer    | | Strategist | | Generator   | |Specialist  | |Composer  |
|             | | Agent       | | Agent      | | Agent       | |Agent       | |Agent     |
+----------^--+ +-------------+ +------------+ +-------------+ +------------+ +----------+
           |
           v
+---------------------+
|                     |
|   Google Cloud      |
|   Services          |
|   (BigQuery, etc.)  |
|                     |
+---------------------+
```

## Technology Stack

- **Frontend**: React, TypeScript, Vite, TailwindCSS
- **Agent Framework**: Custom ADK (Agent Development Kit) implementation
- **Cloud Integration**: Google Cloud Platform (BigQuery)
- **Deployment**: GitHub Pages, GitHub Actions

## Agent Responsibilities

1. **Orchestrator Agent**: Coordinates workflows between specialized agents
2. **Data Scout Agent**: Discovers and extracts data from various sources
3. **Data Engineer Agent**: Cleans and transforms raw data
4. **Analysis Strategist Agent**: Determines optimal analytical approaches
5. **Insight Generator Agent**: Applies analytical techniques to discover patterns
6. **Visualization Specialist Agent**: Creates visual representations of findings
7. **Narrative Composer Agent**: Creates natural language explanations

## Communication Flow

1. User initiates analysis through the UI
2. Request is processed by the Orchestrator Agent
3. Orchestrator coordinates specialized agents based on workflow definition
4. Agents communicate via message passing with specific intents
5. Results are aggregated and returned to the UI for presentation

## Key Features

- **Multi-Agent Orchestration**: Coordinated workflows between specialized agents
- **Message-Driven Architecture**: Asynchronous communication via structured messages
- **Workflow Management**: Predefined and custom analysis workflows
- **Google Cloud Integration**: Data access and processing via BigQuery
