# Busara AI - Multi-Agent Data Intelligence Platform

> **Twenty+ agents. One mind.**
>
> *Busara* (Swahili for *intelligence* / *mind*) is a production-grade multi-agent data analysis platform that orchestrates **23+ specialized AI agents** in a parallel DAG to extract every actionable insight from your dataset.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue)](LICENSE)
[![Node: 18+](https://img.shields.io/badge/Node.js-18%2B-339933)](https://nodejs.org)
[![pnpm: 8+](https://img.shields.io/badge/pnpm-8%2B-f69220)](https://pnpm.io)
[![Turborepo](https://img.shields.io/badge/Turborepo-2.0-000000)](https://turbo.build/repo)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6)](https://typescriptlang.org)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org)

---

## 🚀 What's New in v8.0

Busara v8.0 is a **complete transformation** from a hackathon project to a production-grade AI platform:

### ✨ Major Improvements

1. **🏗️ Monorepo Architecture**
   - Turborepo for fast, incremental builds
   - pnpm workspaces for efficient dependency management
   - Clear separation of concerns (core, agents, web)

2. **🤖 Enhanced Agent Framework**
   - Type-safe agent definitions with Zod schemas
   - Lifecycle methods (setup, execute, teardown, healthCheck)
   - Enhanced error handling and retry logic
   - Circuit breakers for fault tolerance
   - Smart caching for performance

3. **🎯 Production-Grade Orchestrator**
   - DAG-based execution with Kahn's algorithm
   - Parallel execution within stages
   - Real-time progress broadcasting
   - Dependency failure cascade handling
   - Comprehensive metrics collection

4. **🔧 Developer Experience**
   - Comprehensive documentation
   - Type-safe everything
   - Modern tooling (ESLint, Prettier, Vitest)
   - GitHub best practices (CI/CD, CODEOWNERS, templates)

5. **🛡️ Reliability & Observability**
   - Structured error handling
   - Validation at every layer
   - Health checks for agents
   - Metrics and monitoring ready

---

## 📚 Table of Contents

- [Quick Start](#-quick-start)
- [Architecture](#-architecture)
- [Features](#-features)
- [Agent Framework](#-agent-framework)
- [Development](#-development)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🌟 Quick Start

### Prerequisites

- **Node.js** 18+ (recommended: 22+)
- **pnpm** 8+ (required)
- **Git** 2+

### Installation

```bash
# Clone the repository
git clone https://github.com/gadda00/IntelliFlow.git
cd IntelliFlow

# Install pnpm (if not already installed)
npm install -g pnpm

# Install dependencies
pnpm install

# Set up environment
cp .env.example .env
# Edit .env with your configuration

# Generate Prisma client
pnpm db:generate

# Start development server
pnpm dev

# Open in browser
# http://localhost:3000
```

### Try It Out

1. Open `http://localhost:3000`
2. Scroll to **Analyze** section
3. Click **Load Sample Data**
4. Click **Run Full Analysis**
5. Watch all 20+ agents complete in ~5 seconds
6. Explore the 6 result tabs: Overview, Insights, Charts, Advanced, Code, Agents

---

## 🏗️ Architecture

```
busara/
├── apps/
│   └── web/                    # Next.js 15 frontend
│       ├── src/
│       │   ├── app/            # App Router
│       │   ├── components/    # React components
│       │   └── lib/           # Utilities & services
│       └── public/            # Static assets
│
├── packages/
│   ├── @busara/core/           # Shared types & constants
│   ├── @busara/agents/         # Multi-agent framework
│   └── @busara/eslint-config/  # ESLint configuration
│
├── infrastructure/
│   └── docker/                # Docker configuration
│
├── docs/
│   ├── api/                  # API documentation
│   ├── architecture/         # Architecture docs
│   └── guides/              # User guides
│
├── tests/
│   ├── unit/                # Unit tests
│   ├── integration/          # Integration tests
│   └── e2e/                 # End-to-end tests
│
└── .github/
    ├── workflows/           # CI/CD pipelines
    ├── CODEOWNERS           # Code ownership
    └── templates/           # PR & issue templates
```

### Tech Stack

| Category | Technology |
|----------|------------|
| **Framework** | Next.js 15 (App Router) |
| **Language** | TypeScript 5.3 |
| **Package Manager** | pnpm 8 |
| **Build Tool** | Turborepo 2 |
| **Database** | PostgreSQL (Supabase) |
| **ORM** | Prisma 6 |
| **Styling** | Tailwind CSS 4 |
| **UI Components** | shadcn/ui |
| **State Management** | Zustand |
| **Validation** | Zod 4 |
| **Testing** | Vitest |
| **Linting** | ESLint 9 |
| **Payments** | Flutterwave, Stripe |
| **Real-time** | WebSocket |
| **PWA** | Workbox |

---

## ✨ Features

### 🎯 Core Features

- **Multi-Agent Orchestration**: 23+ specialized agents working in parallel
- **DAG-Based Execution**: Topological sorting with dependency resolution
- **Real-Time Progress**: Live updates via WebSocket
- **Fault Tolerance**: Circuit breakers, retries, timeouts
- **Smart Caching**: Intelligent result caching
- **Type Safety**: 100% TypeScript with comprehensive types

### 📊 Data Analysis

- **Data Ingestion**: CSV, JSON, Excel support
- **Schema Inference**: Automatic type detection
- **Data Profiling**: Comprehensive statistics
- **Data Quality**: Completeness, uniqueness, validity
- **Privacy Guard**: PII detection (GDPR, CCPA, HIPAA)
- **Natural Language**: NLQ to structured analysis

### 🔍 Advanced Analytics

- **Anomaly Detection**: Z-score, IQR, EWMA ensemble
- **Time Series**: Holt-Winters forecasting
- **Causal Inference**: Correlation, regression, Granger
- **Machine Learning**: K-Means, Linear Regression
- **Explainability**: Permutation importance
- **Benchmarking**: Industry comparisons

### 📈 Visualization

- **Interactive Charts**: Recharts integration
- **Custom Visualizations**: Tailored to your data
- **Export Options**: PNG, SVG, PDF
- **Dashboard**: Real-time results

### 💰 Business Features

- **Multi-Tenancy**: User and organization support
- **Authentication**: JWT, Supabase Auth, SSO
- **Payments**: Flutterwave, Stripe, Google Pay, Apple Pay
- **Subscriptions**: Tiered pricing plans
- **API Access**: REST API with rate limiting
- **Usage Tracking**: Monitor resource usage

### 📱 Multi-Platform

- **Web**: Responsive PWA
- **Mobile**: Android TWA (Trusted Web Activity)
- **Desktop**: Installable PWA
- **API**: REST API for integration

---

## 🤖 Agent Framework

### Agent Types

Busara agents are organized into **7 stages** with **50+ agents**:

#### Stage 0: Ingest
- `DataIngestionAgent` - Parse and validate data
- `SchemaInferenceAgent` - Detect column types
- `DataProfilerAgent` - Comprehensive data profiling
- `DataQualityAgent` - Data quality scoring
- `PrivacyGuardianAgent` - PII detection
- `NLQInterpreterAgent` - Natural language to SQL

#### Stage 1: Engineer
- `DataCleanerAgent` - Clean and normalize data
- `DataEngineerAgent` - Feature engineering
- `FeatureEngineerAgent` - Advanced feature extraction
- `DataTransformerAgent` - Data transformation

#### Stage 2: Detect
- `AnalysisStrategistAgent` - Methodology selection
- `AnomalySentinelAgent` - Anomaly detection
- `ForecastingOracleAgent` - Time series forecasting
- `CausalArchitectAgent` - Causal inference
- `KnowledgeGraphBuilderAgent` - Entity extraction
- `BenchmarkAgent` - Industry benchmarks
- `AutoMLAgent` - Automated ML

#### Stage 3: Forecast
- `TimeSeriesForecasterAgent` - Advanced forecasting
- `SeasonalDecomposerAgent` - Seasonality analysis
- `TrendAnalyzerAgent` - Trend detection

#### Stage 4: Infer
- `InsightGeneratorAgent` - Actionable insights
- `ExplainabilityAgent` - Model interpretation
- `HypothesisTesterAgent` - Statistical testing

#### Stage 5: Cluster
- `ClusterAnalyzerAgent` - Pattern discovery
- `SegmenterAgent` - Data segmentation
- `PatternDetectorAgent` - Anomaly patterns

#### Stage 6: Report
- `NarrativeComposerAgent` - Executive summaries
- `VisualizationSpecialistAgent` - Chart generation
- `CodeGeneratorAgent` - Code export
- `SyntheticDataGeneratorAgent` - Privacy-preserving data
- `ConversationalAnalystAgent` - Chat interface
- `OrchestratorAgent` - Result compilation

### Creating a Custom Agent

```typescript
import { z } from 'zod';
import { AgentStage, AgentTier } from '@busara/core';
import { BaseAgent, createAgentMetadata } from '@busara/agents';

const metadata = createAgentMetadata({
  id: 'my_custom_agent',
  name: 'My Custom Agent',
  description: 'Does something amazing',
  stage: 'detect' as AgentStage,
  tier: 'specialized' as AgentTier,
  dependencies: ['data_ingestion'],
  timeoutMs: 30000,
  inputSchema: { schema: z.object({ /* ... */ }) },
  outputSchema: { schema: z.object({ /* ... */ }) },
  icon: 'Sparkles',
  color: '#8b5cf6',
});

export class MyCustomAgent extends BaseAgent {
  readonly metadata = metadata;
  
  async execute(context) {
    // Your logic here
    return this.createResult({ /* output */ }, { /* metrics */ });
  }
}
```

See [DEVELOPMENT.md](DEVELOPMENT.md) for detailed agent development guide.

---

## 💻 Development

### Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development servers |
| `pnpm build` | Build all packages |
| `pnpm lint` | Run linting |
| `pnpm test` | Run tests |
| `pnpm typecheck` | Run type checking |
| `pnpm db:generate` | Generate Prisma client |
| `pnpm db:push` | Push schema to database |

### Project Structure

```
├── apps/web/              # Next.js frontend
├── packages/@busara/core/ # Shared types & utilities
├── packages/@busara/agents/ # Agent framework
└── packages/@busara/eslint-config/ # ESLint config
```

### Documentation

- [Development Guide](DEVELOPMENT.md) - Comprehensive development guide
- [Transformation Plan](TRANSFORMATION_PLAN.md) - Roadmap and vision
- [Implementation Summary](IMPLEMENTATION_SUMMARY.md) - Completed work
- [API Documentation](docs/api/) - REST API reference
- [Architecture Docs](docs/architecture/) - System architecture

---

## 🤝 Contributing

### Getting Started

1. Fork the repository
2. Clone your fork
3. Install dependencies: `pnpm install`
4. Create a feature branch
5. Make your changes
6. Run tests: `pnpm test`
7. Run linting: `pnpm lint`
8. Commit your changes
9. Push to your fork
10. Open a pull request

### Pull Request Guidelines

- Follow [conventional commits](https://www.conventionalcommits.org/)
- Keep PRs small and focused
- Include tests for new functionality
- Update documentation
- Maintain backward compatibility
- Follow the code style

### Code of Conduct

This project follows a code of conduct. Be respectful and inclusive.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- Built by **Victor Ndunda** & contributors
- Inspired by the Swahili word *busara* (intelligence)
- African heritage, global ambition

---

## 📞 Support

- **Documentation**: [DEVELOPMENT.md](DEVELOPMENT.md)
- **Issues**: [GitHub Issues](https://github.com/gadda00/IntelliFlow/issues)
- **Discussions**: [GitHub Discussions](https://github.com/gadda00/IntelliFlow/discussions)
- **Email**: victor@busara.ai

---

**Twenty agents. One mind. Built in Nairobi for the world.**
