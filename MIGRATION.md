# Busara Migration Guide
## From v7 to v8 (Monorepo Structure)

---

## 📋 Overview

Busara v8 introduces a **monorepo architecture** with significant structural changes. This guide helps you migrate from v7 to v8 and understand the new structure.

---

## 🔄 What Changed

### Project Structure

**v7 (Before):**
```
busara/
├── src/
│   ├── app/
│   ├── components/
│   └── lib/
├── prisma/
├── public/
└── package.json
```

**v8 (After):**
```
busara/
├── apps/
│   └── web/                    # Next.js frontend (migrated from src/)
├── packages/
│   ├── @busara/core/           # Shared types & constants
│   ├── @busara/agents/         # Multi-agent framework
│   └── @busara/eslint-config/  # ESLint configuration
├── infrastructure/
│   └── docker/                # Docker configuration
├── docs/
│   ├── api/
│   ├── architecture/
│   └── guides/
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
└── package.json               # Monorepo root
```

### Package Manager

**v7:** npm or bun
**v8:** pnpm (required for monorepo)

### Build System

**v7:** Next.js standalone
**v8:** Turborepo for multi-package builds

---

## 🚀 Migration Steps

### Option 1: Fresh Start (Recommended)

1. **Clone the new repository**
   ```bash
   git clone https://github.com/gadda00/IntelliFlow.git
   cd IntelliFlow
   ```

2. **Install pnpm**
   ```bash
   npm install -g pnpm
   ```

3. **Install dependencies**
   ```bash
   pnpm install
   ```

4. **Start development**
   ```bash
   pnpm dev
   ```

### Option 2: Incremental Migration

If you have custom modifications to v7, follow these steps:

1. **Backup your changes**
   ```bash
   git checkout -b my-custom-changes
   git add -A
   git commit -m "Backup my custom changes"
   ```

2. **Pull the latest v8 changes**
   ```bash
   git checkout main
   git pull origin main
   ```

3. **Reapply your changes** to the new structure
   - Move custom components to `apps/web/src/components/`
   - Move custom lib code to `apps/web/src/lib/`
   - Move custom API routes to `apps/web/src/app/api/`

4. **Update imports**
   - Change `src/lib/...` to `@/lib/...`
   - Change `src/components/...` to `@/components/...`
   - Add `@busara/core` and `@busara/agents` imports where needed

---

## 📦 Package Structure

### `@busara/core`

**Purpose:** Shared types, constants, and utilities

**Contents:**
- `types.ts` - TypeScript type definitions
- `constants.ts` - Application constants
- `index.ts` - Package exports

**Usage:**
```typescript
import { AgentMetadata, AgentStage, ID } from '@busara/core';
```

### `@busara/agents`

**Purpose:** Multi-agent orchestration framework

**Contents:**
- `core.ts` - Base agent class and types
- `orchestrator.ts` - DAG execution engine
- `registry.ts` - Agent discovery and management
- `math.ts` - Mathematical utilities
- `errors.ts` - Custom error classes
- `validation.ts` - Validation utilities
- `agents/` - Agent implementations

**Usage:**
```typescript
import { BaseAgent, DAGOrchestrator, AgentRegistry } from '@busara/agents';
```

### `@busara/web`

**Purpose:** Next.js frontend application

**Contents:**
- All existing `src/` files migrated here
- Next.js App Router
- React components
- API routes
- Static assets

**Usage:**
```bash
cd apps/web
pnpm dev
```

---

## 🔧 Configuration Changes

### Environment Variables

The `.env.example` file has been updated. Compare with your existing `.env`:

**New variables in v8:**
```env
# Monorepo-specific
TURBO_TOKEN=your-turbo-token
TURBO_TEAM=your-turbo-team

# Package-specific (moved from root)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### TypeScript Configuration

Each package now has its own `tsconfig.json` with proper path aliases:

**Root tsconfig.json:**
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@busara/core": ["packages/core/src"],
      "@busara/agents": ["packages/agents/src"],
      "@busara/web": ["apps/web/src"]
    }
  }
}
```

---

## 📝 Code Changes

### Import Paths

**v7:**
```typescript
import { AgentMetadata } from '../../lib/agents/core';
import { orchestrator } from '../../lib/agents/orchestrator';
```

**v8:**
```typescript
import { AgentMetadata } from '@busara/core';
import { DAGOrchestrator } from '@busara/agents';
```

### Agent Development

**v7:**
```typescript
import { BaseAgent } from '../../lib/agents/core';

export class MyAgent extends BaseAgent {
  // ...
}
```

**v8:**
```typescript
import { BaseAgent, createAgentMetadata } from '@busara/agents';

const metadata = createAgentMetadata({
  id: 'my_agent',
  name: 'My Agent',
  // ...
});

export class MyAgent extends BaseAgent {
  readonly metadata = metadata;
  // ...
}
```

### API Routes

**v7:**
```typescript
// src/app/api/analyze/route.ts
import { getAgentPool } from '@/lib/agents';
```

**v8:**
```typescript
// apps/web/src/app/api/analyze/route.ts
import { getAgentPool } from '@busara/agents';
```

---

## 🛠️ Tooling Changes

### Package Manager

**v7:**
```bash
npm install
npm run dev
npm run build
```

**v8:**
```bash
pnpm install
pnpm dev
pnpm build
```

### Monorepo Commands

**Run all:**
```bash
pnpm dev        # Start all apps
pnpm build      # Build all packages
pnpm lint       # Lint all packages
pnpm test       # Test all packages
```

**Run specific:**
```bash
pnpm dev:web        # Start web app only
pnpm build:agents   # Build agents package only
pnpm lint:core      # Lint core package only
```

### Database Commands

**v7:**
```bash
npx prisma generate
npx prisma db push
```

**v8:**
```bash
pnpm db:generate
pnpm db:push
```

---

## 🧪 Testing Changes

### Test Structure

**v7:** Tests in `src/` alongside code
**v8:** Tests in `tests/` directory with proper organization

**New test structure:**
```
tests/
├── unit/
│   ├── agents/
│   ├── core/
│   └── utils/
├── integration/
│   ├── api/
│   ├── agents/
│   └── services/
└── e2e/
    ├── auth/
    ├── analysis/
    └── workflows/
```

### Test Commands

**v7:**
```bash
npm test
```

**v8:**
```bash
pnpm test           # Run all tests
pnpm test:web       # Run web app tests
pnpm test:agents    # Run agents tests
pnpm test:coverage  # Run tests with coverage
```

---

## 🚨 Breaking Changes

### 1. Project Structure

All source code has moved from `src/` to `apps/web/src/`. Update your:
- IDE configurations
- Debug configurations
- Path references
- Bookmarks

### 2. Import Paths

All internal imports now use package names instead of relative paths:
- `@busara/core` instead of `../../lib/core`
- `@busara/agents` instead of `../../lib/agents`
- `@/` for app-local imports (configured in `apps/web/tsconfig.json`)

### 3. Package Manager

pnpm is now required. If you must use npm:
```bash
# Remove the preinstall check
npm install
# But this is not recommended for monorepos
```

### 4. Environment Variables

Some environment variables have changed names or locations. Check `.env.example` for the latest.

### 5. Script Names

Some scripts have been renamed or reorganized:
- `npm run dev` → `pnpm dev`
- `npm run build` → `pnpm build`
- `npx prisma generate` → `pnpm db:generate`

---

## ✅ Migration Checklist

- [ ] Install pnpm globally
- [ ] Clone the v8 repository
- [ ] Run `pnpm install`
- [ ] Update `.env` file with new variables
- [ ] Run `pnpm db:generate`
- [ ] Test with `pnpm dev`
- [ ] Update custom code to new import paths
- [ ] Update IDE configurations
- [ ] Update CI/CD pipelines (if applicable)
- [ ] Test all functionality

---

## 🆘 Troubleshooting

### pnpm install fails with "out of memory"

**Solution:** Increase Node.js memory limit
```bash
NODE_OPTIONS=--max-old-space-size=8192 pnpm install
```

Or use npm temporarily:
```bash
# Remove the preinstall check from package.json
npm install
```

### Imports not resolving

**Solution:** Check your import paths
```typescript
// Wrong (v7 style)
import { Agent } from '../../lib/agents';

// Right (v8 style)
import { Agent } from '@busara/agents';
```

### TypeScript errors

**Solution:** Run type checking
```bash
pnpm typecheck
```

Fix any type errors that appear.

### Missing dependencies

**Solution:** Install missing dependencies
```bash
cd apps/web
pnpm add missing-package
```

### Database connection fails

**Solution:** Check your `.env` file
```bash
# Make sure DATABASE_URL is correct
cp .env.example .env
# Edit with your database credentials
```

---

## 📚 Resources

- [Development Guide](DEVELOPMENT.md) - Comprehensive development guide
- [Transformation Plan](TRANSFORMATION_PLAN.md) - Roadmap and vision
- [Implementation Summary](IMPLEMENTATION_SUMMARY.md) - Completed work
- [Turborepo Documentation](https://turbo.build/repo)
- [pnpm Documentation](https://pnpm.io/)

---

## 🙏 Support

If you encounter issues during migration:

1. **Check this guide** for common issues
2. **Check the documentation** in `docs/`
3. **Open an issue** on GitHub with details about your problem
4. **Join the community** for help from other developers

---

## 🎯 Next Steps

After successful migration:

1. **Test thoroughly** - Make sure all functionality works
2. **Update custom agents** - Migrate any custom agents to the new framework
3. **Update CI/CD** - Configure your deployment pipelines for the monorepo
4. **Start using new features** - Take advantage of the enhanced agent framework
5. **Contribute back** - Share your improvements with the community
