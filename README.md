# IntelliFlow

IntelliFlow is an intelligent data analysis platform that leverages agent-based architecture and Google Cloud services to provide powerful, automated data analysis capabilities.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Installation](#installation)
- [Usage](#usage)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

## Overview

IntelliFlow combines the power of the Agent Development Kit (ADK) with Google Cloud services to create a flexible, scalable platform for data analysis. The system uses multiple specialized agents that work together to ingest, process, analyze, and visualize data, providing valuable insights to users.

## Features

### Agent-Based Architecture
- **Orchestrator Agent**: Coordinates the overall workflow and communication between agents
- **Data Ingestion Agent**: Handles data loading, cleaning, and preprocessing
- **Analysis Agent**: Performs statistical analysis and modeling
- **Visualization Agent**: Creates charts and graphs
- **Insight Generation Agent**: Extracts insights and generates reports

### Enhanced ADK Integration
- **Robust Agent Communication**: Secure, reliable message passing between agents
- **Planning and Goal Setting**: Hierarchical planning system for complex workflows
- **Memory Management**: Short-term, long-term, and working memory for agents
- **Agent Monitoring**: Real-time monitoring and visualization of agent activities

### Google Cloud Integration
- **BigQuery Integration**: Powerful data querying and analysis
- **Vertex AI Integration**: Advanced machine learning capabilities
- **Gemini API Integration**: State-of-the-art language model integration
- **Cloud Storage Integration**: Scalable data storage
- **Pub/Sub Integration**: Real-time messaging and event handling
- **Cloud Functions Integration**: Serverless compute for specific tasks

### Modern UI/UX
- **Intuitive Dashboard**: Clear overview of analyses and insights
- **Multi-Step Wizard**: Guided analysis configuration
- **Interactive Visualizations**: Explore data through dynamic charts
- **Responsive Design**: Works on desktop and mobile devices
- **Accessibility**: WCAG 2.1 compliant interface

## Architecture

IntelliFlow follows a modular, microservices-based architecture:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend UI   │◄────┤   API Gateway   │◄────┤  Authentication │
└────────┬────────┘     └────────┬────────┘     └─────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Orchestration  │◄────┤  Message Bus    │◄────┤  Agent Registry │
└────────┬────────┘     └─────────────────┘     └─────────────────┘
         │
         ▼
┌───────────────────────────────────────────────────────────────────┐
│                           Agent Pool                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌──────────┐  │
│  │ Data Agent  │  │Analysis Agent│  │  Viz Agent  │  │ Insights │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  └──────────┘  │
└───────────────────────────────────────────────────────────────────┘
         │                │                │               │
         ▼                ▼                ▼               ▼
┌───────────────────────────────────────────────────────────────────┐
│                       Google Cloud Services                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌──────────┐  │
│  │  BigQuery   │  │  Vertex AI  │  │   Storage   │  │  Pub/Sub │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  └──────────┘  │
└───────────────────────────────────────────────────────────────────┘
```

## Installation

### Prerequisites
- Python 3.8 or higher
- Node.js 14 or higher
- Google Cloud account with required services enabled
- ADK 0.0.5 or higher

### Backend Setup

1. Clone the repository:
```bash
git clone https://github.com/gadda00/IntelliFlow.git
cd IntelliFlow
```

2. Create and activate a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\\Scripts\\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Set up Google Cloud credentials:
```bash
export GOOGLE_APPLICATION_CREDENTIALS="path/to/your/credentials.json"
```

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend/intelliflow-ui
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file with your configuration:
```
VITE_API_URL=http://localhost:5000/api
VITE_GOOGLE_CLIENT_ID=your-google-client-id
```

## Usage

### Running the Backend

```bash
cd IntelliFlow
python main.py
```

### Running the Frontend

```bash
cd frontend/intelliflow-ui
npm run dev
```

### Accessing the Application

Open your browser and navigate to `http://localhost:3000`

## Development

### Project Structure

```
IntelliFlow/
├── agents/                 # Agent implementations
│   ├── orchestrator/       # Orchestrator agent
│   ├── data_ingestion/     # Data ingestion agent
│   ├── analysis/           # Analysis agent
│   ├── visualization/      # Visualization agent
│   └── insight_generation/ # Insight generation agent
├── common/                 # Shared utilities and helpers
│   ├── enhanced_adk/       # Enhanced ADK implementation
│   └── utils/              # Utility functions
├── integrations/           # External service integrations
│   └── google_cloud/       # Google Cloud integrations
├── orchestration/          # Orchestration system
│   ├── message_bus/        # Message bus implementation
│   └── workflow_manager/   # Workflow management
├── frontend/               # Frontend application
│   └── intelliflow-ui/     # React application
├── tests/                  # Test suite
├── docs/                   # Documentation
└── main.py                 # Application entry point
```

### Development Workflow

1. Create a new branch for your feature or bugfix:
```bash
git checkout -b feature/your-feature-name
```

2. Make your changes and write tests

3. Run the test suite:
```bash
pytest
```

4. Submit a pull request

## Contributing

We welcome contributions to IntelliFlow! Please see our [Contributing Guide](CONTRIBUTING.md) for more details.

## License

IntelliFlow is licensed under the MIT License. See [LICENSE](LICENSE) for more information.

