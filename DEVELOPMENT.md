# Busara Development Guide

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ (recommended: 22+)
- **pnpm** 8+ (required)
- **Git** 2+
- **Docker** (optional, for database)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/gadda00/IntelliFlow.git
   cd IntelliFlow
   ```

2. **Install pnpm** (if not already installed)
   ```bash
   npm install -g pnpm
   ```

3. **Install dependencies**
   ```bash
   pnpm install
   ```

4. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

5. **Generate Prisma client**
   ```bash
   pnpm db:generate
   ```

6. **Start the development server**
   ```bash
   pnpm dev
   ```

7. **Open in browser**
   ```
   http://localhost:3000
   ```

---

## 🛠️ Development Commands

### General

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all development servers |
| `pnpm build` | Build all packages and apps |
| `pnpm start` | Start all production servers |
| `pnpm lint` | Run linting on all packages |
| `pnpm test` | Run tests on all packages |
| `pnpm typecheck` | Run type checking on all packages |
| `pnpm clean` | Clean all build outputs |

### Package-Specific

| Command | Description |
|---------|-------------|
| `pnpm dev:web` | Start web app development server |
| `pnpm dev:agents` | Start agents package development |
| `pnpm dev:core` | Start core package development |
| `pnpm build:web` | Build web app |
| `pnpm build:agents` | Build agents package |
| `pnpm build:core` | Build core package |
| `pnpm lint:web` | Lint web app |
| `pnpm lint:agents` | Lint agents package |
| `pnpm lint:core` | Lint core package |

### Database

| Command | Description |
|---------|-------------|
| `pnpm db:generate` | Generate Prisma client |
| `pnpm db:push` | Push schema to database |
| `pnpm db:migrate` | Create and apply migrations |
| `pnpm db:studio` | Open Prisma Studio |

---

## 📁 Project Structure

```
busara/
├── apps/
│   └── web/                    # Next.js frontend application
│       ├── src/
│       │   ├── app/            # Next.js App Router
│       │   ├── components/    # React components
│       │   ├── lib/           # Utilities and services
│       │   └── styles/        # CSS and styling
│       ├── public/            # Static assets
│       ├── package.json
│       └── tsconfig.json
│
├── packages/
│   ├── @busara/core/           # Shared types, constants, utilities
│   │   ├── src/
│   │   │   ├── types.ts       # TypeScript type definitions
│   │   │   ├── constants.ts   # Application constants
│   │   │   └── index.ts       # Package exports
│   │   └── package.json
│   │
│   ├── @busara/agents/         # Multi-agent orchestration framework
│   │   ├── src/
│   │   │   ├── core.ts        # Base agent class and types
│   │   │   ├── orchestrator.ts # DAG execution engine
│   │   │   ├── registry.ts     # Agent registry
│   │   │   ├── math.ts         # Mathematical utilities
│   │   │   ├── errors.ts       # Custom error classes
│   │   │   ├── validation.ts   # Validation utilities
│   │   │   └── agents/        # Agent implementations
│   │   │       ├── ingest/     # Ingest stage agents
│   │   │       ├── engineer/   # Engineer stage agents
│   │   │       ├── detect/     # Detect stage agents
│   │   │       ├── forecast/   # Forecast stage agents
│   │   │       ├── infer/      # Infer stage agents
│   │   │       ├── cluster/    # Cluster stage agents
│   │   │       └── report/     # Report stage agents
│   │   └── package.json
│   │
│   └── @busara/eslint-config/  # ESLint configuration
│       ├── index.js
│       └── package.json
│
├── infrastructure/
│   └── docker/                # Docker configuration
│       └── docker-compose.yml
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
├── .github/
│   ├── workflows/           # GitHub Actions workflows
│   ├── CODEOWNERS           # Code ownership
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── ISSUE_TEMPLATE/      # Issue templates
│
├── package.json            # Root package.json (monorepo)
├── pnpm-workspace.yaml     # pnpm workspaces configuration
├── turbo.json              # Turborepo configuration
└── tsconfig.json           # Root TypeScript configuration
```

---

## 🧩 Adding a New Agent

### Step 1: Create the Agent File

Create a new file in the appropriate stage directory:
```bash
packages/agents/src/agents/<stage>/<AgentName>Agent.ts
```

### Step 2: Implement the Agent

```typescript
import { z } from 'zod';
import { AgentStage, AgentTier, AgentStability } from '@busara/core';
import { BaseAgent, EnhancedAgentMetadata, createAgentMetadata } from '../../core';

// Define metadata
const metadata = createAgentMetadata({
  id: 'my_agent',
  name: 'My Agent',
  description: 'Description of what this agent does',
  version: '1.0.0',
  stage: 'detect' as AgentStage,
  stageNumber: 2,
  tier: 'specialized' as AgentTier,
  stability: 'stable' as AgentStability,
  dependencies: ['data_ingestion', 'schema_inference'],
  timeoutMs: 30000,
  maxRetries: 3,
  capabilities: ['feature1', 'feature2'],
  category: 'analysis',
  tags: ['tag1', 'tag2'],
  inputDescription: 'Input description',
  outputDescription: 'Output description',
  inputSchema: {
    schema: z.object({ /* input schema */ }),
    description: 'Input schema description',
  },
  outputSchema: {
    schema: z.object({ /* output schema */ }),
    description: 'Output schema description',
  },
  configSchema: {
    schema: z.object({ /* config schema */ }),
    defaults: { /* default values */ },
    description: 'Config schema description',
  },
  icon: 'Cpu',
  color: '#6363f1',
});

// Implement the agent
export class MyAgent extends BaseAgent {
  readonly metadata: EnhancedAgentMetadata = metadata;
  
  async execute(context: EnhancedAgentContext): Promise<AgentResult> {
    const start = Date.now();
    const { dataframe, config, previousResults } = context;
    
    try {
      // Your agent logic here
      const output = { /* your output */ };
      const executionTimeMs = Date.now() - start;
      
      return this.createResult(output, { /* metrics */ }, executionTimeMs);
    } catch (error) {
      const executionTimeMs = Date.now() - start;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return this.createError(errorMessage, executionTimeMs);
    }
  }
}

export { metadata as myAgentMetadata };
export default MyAgent;
```

### Step 3: Export the Agent

Add the export to the stage index file:
```typescript
// packages/agents/src/agents/<stage>/index.ts
export * from './MyAgent';
```

### Step 4: Register the Agent

The agent will be automatically discovered by the `AgentRegistry` and `AgentPool`.

### Step 5: Test the Agent

Create a test file:
```bash
packages/agents/src/agents/<stage>/MyAgent.test.ts
```

```typescript
import { describe, it, expect } from 'vitest';
import MyAgent from './MyAgent';

describe('MyAgent', () => {
  it('should execute successfully', async () => {
    const agent = new MyAgent();
    const context = {
      analysisId: 'test',
      dataframe: [/* test data */],
      metadata: {},
      previousResults: new Map(),
      config: {},
      startedAt: new Date().toISOString(),
    };
    
    const result = await agent.execute(context);
    expect(result.status).toBe('success');
  });
});
```

---

## 🧪 Testing

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Run tests in watch mode
pnpm test:watch

# Run tests for specific package
pnpm test:agents
pnpm test:core
pnpm test:web
```

### Test Structure

Tests are organized by type:

```
tests/
├── unit/                # Unit tests for individual functions/classes
│   ├── agents/
│   ├── core/
│   └── utils/
├── integration/          # Integration tests for component interactions
│   ├── api/
│   ├── agents/
│   └── services/
└── e2e/                 # End-to-end tests for user journeys
    ├── auth/
    ├── analysis/
    └── workflows/
```

### Writing Tests

Use Vitest for testing:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('MyComponent', () => {
  beforeEach(() => {
    // Setup
  });
  
  it('should do something', () => {
    // Test logic
    expect(result).toBe(expected);
  });
  
  it('should handle errors', () => {
    // Error handling test
    expect(() => { /* code */ }).toThrow();
  });
});
```

---

## 📝 Code Style

### ESLint

The project uses a comprehensive ESLint configuration:

- TypeScript-specific rules
- Import sorting
- Unused import detection
- Complexity limits
- Naming conventions
- Code quality checks

Run linting:
```bash
pnpm lint
pnpm lint:web
pnpm lint:agents
```

### TypeScript

- Use strict TypeScript configuration
- Always specify return types
- Use interfaces for object shapes
- Use type aliases for complex types
- Avoid `any` type (use `unknown` instead)

### Naming Conventions

- **Files:** `kebab-case.ts` or `PascalCase.tsx`
- **Variables:** `camelCase`
- **Constants:** `UPPER_SNAKE_CASE`
- **Functions:** `camelCase`
- **Classes:** `PascalCase`
- **Interfaces:** `PascalCase`
- **Types:** `PascalCase`
- **Enums:** `PascalCase`

### Imports

- Use absolute imports with aliases
- Group imports by source
- Sort imports alphabetically

```typescript
// Good
import { Component } from '@/components';
import { useState } from 'react';
import { z } from 'zod';

// Bad
import { useState } from 'react';
import { z } from 'zod';
import { Component } from '../../../components';
```

---

## 🔧 Configuration

### Environment Variables

Create a `.env` file based on `.env.example`:

```env
# Application
NODE_ENV=development
PORT=3000
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/busara
DIRECT_URL=postgresql://user:password@localhost:5432/busara

# Authentication
JWT_SECRET=your-secret-key
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key

# Payments
FLUTTERWAVE_PUBLIC_KEY=your-public-key
FLUTTERWAVE_SECRET_KEY=your-secret-key
FLUTTERWAVE_ENCRYPTION_KEY=your-encryption-key

# Logging
LOG_LEVEL=debug

# Features
NEXT_PUBLIC_ENABLE_ANALYTICS=true
NEXT_PUBLIC_ENABLE_PAYMENTS=true
NEXT_PUBLIC_ENABLE_MARKETPLACE=false
```

### Database

The project uses Prisma with PostgreSQL:

1. **Set up database**
   ```bash
   # Using Docker
   docker-compose -f infrastructure/docker/docker-compose.yml up -d
   ```

2. **Generate client**
   ```bash
   pnpm db:generate
   ```

3. **Push schema**
   ```bash
   pnpm db:push
   ```

4. **Open Prisma Studio**
   ```bash
   pnpm db:studio
   ```

---

## 🐛 Debugging

### Debugging the Web App

1. **Run in development mode**
   ```bash
   pnpm dev:web
   ```

2. **Attach debugger**
   - VS Code: Use the "Attach to Next.js" configuration
   - Chrome: Open `chrome://inspect` and attach to the Node process

3. **Debug specific issues**
   - Add `debugger;` statements in your code
   - Use `console.log()` for quick debugging
   - Use the browser's developer tools

### Debugging Agents

1. **Add logging**
   ```typescript
   this.logger.debug('Debug message', { data });
   this.logger.info('Info message', { data });
   this.logger.warn('Warning message', { data });
   this.logger.error('Error message', error);
   ```

2. **Enable debug logging**
   ```env
   LOG_LEVEL=debug
   ```

3. **Test agents in isolation**
   ```typescript
   import { MyAgent } from '@busara/agents';
   
   const agent = new MyAgent();
   const context = { /* test context */ };
   const result = await agent.execute(context);
   console.log(result);
   ```

---

## 📊 Monitoring

### Development Metrics

- **Build Time:** Monitor with `pnpm build`
- **Test Coverage:** Check with `pnpm test:coverage`
- **Bundle Size:** Analyze with `npx next-build-analyzer`

### Production Metrics

The project includes:
- Health check endpoints
- Prometheus metrics (to be implemented)
- Distributed tracing (to be implemented)
- Error tracking (to be implemented)

---

## 🤝 Contributing

### Getting Started

1. Fork the repository
2. Clone your fork
3. Install dependencies with `pnpm install`
4. Create a feature branch
5. Make your changes
6. Run tests and linting
7. Commit your changes
8. Push to your fork
9. Open a pull request

### Pull Request Guidelines

- Follow the PR template
- Keep PRs small and focused
- Include tests for new functionality
- Update documentation
- Maintain backward compatibility
- Follow the code style

### Commit Guidelines

Use conventional commits:

```
feat: add new feature
fix: fix a bug
docs: update documentation
test: add tests
refactor: refactor code
perf: improve performance
style: fix formatting
chore: maintenance tasks
```

---

## 📚 Resources

### Documentation

- [Transformation Plan](TRANSFORMATION_PLAN.md) - Detailed roadmap
- [Implementation Summary](IMPLEMENTATION_SUMMARY.md) - Completed work
- [API Documentation](docs/api/) - API reference
- [Architecture Docs](docs/architecture/) - System architecture
- [User Guides](docs/guides/) - How-to guides

### External Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/)
- [Turborepo Documentation](https://turbo.build/repo)
- [pnpm Documentation](https://pnpm.io/)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [Zod Documentation](https://zod.dev/)

### Community

- [GitHub Issues](https://github.com/gadda00/IntelliFlow/issues)
- [GitHub Discussions](https://github.com/gadda00/IntelliFlow/discussions)
- [Discord](https://discord.gg/...) (coming soon)

---

## 🎯 Best Practices

### Code Quality

1. **Write Tests** - Always include tests for new functionality
2. **Type Safety** - Use TypeScript types for everything
3. **Documentation** - Document functions, classes, and modules
4. **Error Handling** - Handle errors gracefully
5. **Performance** - Optimize for performance
6. **Security** - Follow security best practices

### Agent Development

1. **Keep Agents Focused** - Each agent should do one thing well
2. **Validate Inputs** - Always validate inputs and outputs
3. **Handle Errors** - Provide meaningful error messages
4. **Add Metrics** - Track execution time and other metrics
5. **Document** - Document what the agent does and its configuration

### API Design

1. **RESTful** - Follow REST conventions
2. **Consistent** - Use consistent naming and structure
3. **Versioned** - Version your APIs
4. **Documented** - Document all endpoints
5. **Tested** - Test all endpoints

---

## 🚨 Troubleshooting

### Common Issues

#### `pnpm install` fails

```bash
# Clear cache and retry
pnpm store prune
rm -rf node_modules
pnpm install
```

#### Build fails

```bash
# Clean and rebuild
pnpm clean
pnpm install
pnpm build
```

#### Database connection fails

```bash
# Check your .env file
# Make sure DATABASE_URL is correct
# Try connecting manually with psql or pgAdmin
```

#### Tests fail

```bash
# Run tests with more details
pnpm test --reporter=verbose

# Run specific test
pnpm test packages/agents/src/agents/ingest/DataIngestionAgent.test.ts
```

#### Linting fails

```bash
# Fix linting issues
pnpm lint

# Fix specific file
pnpm eslint packages/agents/src/agents/ingest/DataIngestionAgent.ts --fix
```

---

## 🎉 Conclusion

This development guide provides everything you need to contribute to Busara. The project uses modern tools and best practices to ensure:

- **Quality** - Strong typing, comprehensive testing, thorough linting
- **Performance** - Optimized builds, efficient code, fast execution
- **Maintainability** - Clean architecture, good documentation, consistent style
- **Scalability** - Monorepo structure, modular design, clear separation of concerns

Happy coding! 🚀
