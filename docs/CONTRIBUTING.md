# Contributing to Busara

Thanks for your interest in contributing to Busara! This document covers everything you need to get your first PR merged.

> **TL;DR** — fork → branch → `pnpm install` → `pnpm typecheck` → `pnpm test` → open a PR with a clear description and tests.

---

## 1. Development setup

### Prerequisites

| Tool | Version | Why |
|---|---|---|
| Node.js | 18+ (22+ recommended) | Runtime + test runner |
| pnpm | 8+ | Package manager (the repo enforces pnpm via `preinstall`) |
| Git | 2+ | Version control |
| Docker | (optional) | For running Postgres locally |

### First-time setup

```bash
git clone https://github.com/gadda00/IntelliFlow.git busara
cd busara
git checkout revolution
pnpm install
cp .env.example .env.local
# Edit .env.local — set DATABASE_URL, DIRECT_URL, JWT_SECRET (32+ chars), DATA_SOURCE_ENCRYPTION_KEY (64 hex chars)
pnpm db:generate
pnpm db:push
pnpm typecheck     # should pass 7/7
pnpm --filter @busara/agents test   # 18 tests pass
pnpm dev:web       # http://localhost:3000
```

### Daily workflow

```bash
git checkout -b feat/my-feature    # see "Branch naming" below
# ... make changes ...
pnpm typecheck
pnpm test
pnpm lint
git commit -m "feat(agents): add new detect agent"
git push -u origin feat/my-feature
# Open PR on GitHub
```

---

## 2. Monorepo layout

```
apps/
  web/              # Next.js 15 app (the Busara UI + API routes)
packages/
  core/             # Shared types, constants, validation, errors
  agents/           # 33-agent framework + trajectory/evolution system
  cli/              # @busara/cli — the `busara` terminal command
  ui/               # Shared UI primitives (shadcn/ui wrappers)
  eslint-config/    # Shared ESLint config
prisma/
  schema.prisma     # Database schema (Postgres)
docs/               # Developer docs (this folder)
```

Each package is self-contained with its own `package.json`, `tsconfig.json`, and `vitest.config.ts`. Turborepo wires the build pipeline together.

---

## 3. Code style

### Tooling

| Tool | Purpose | Config |
|---|---|---|
| ESLint 9 | Linting | `eslint.config.mjs` (flat config), shared rules in `packages/eslint-config/` |
| Prettier | Formatting | run via `pnpm lint --fix` |
| TypeScript 5.3+ | Type checking | strict in `@busara/core`, `@busara/cli`, `@busara/ui`; relaxed in `@busara/agents` for legacy reasons |
| Vitest 1+ | Testing | per-package `vitest.config.ts` |

Run the linters:

```bash
pnpm lint                    # all packages
pnpm lint:agents             # one package
pnpm lint:web
pnpm lint:core
```

### Style rules

- **Files** — `kebab-case.ts` for modules, `PascalCase.tsx` for React components
- **Variables / functions** — `camelCase`
- **Constants** — `UPPER_SNAKE_CASE`
- **Classes / interfaces / types / enums** — `PascalCase`
- **Imports** — group by source: Node built-ins → third-party → workspace (`@busara/*`) → relative. Sort alphabetically within each group.
- **No `any`** — use `unknown` and narrow. `@busara/agents` has a few `any` casts for legacy reasons; new code should not add more.
- **Always specify return types** on exported functions.
- **Validate inputs with Zod** — every agent's `inputSchema`, `outputSchema`, and `configSchema` use Zod.

---

## 4. Branch naming

| Pattern | Use case |
|---|---|
| `feat/<scope>/<short-desc>` | New feature (e.g. `feat/agents/causal-architect`) |
| `fix/<scope>/<short-desc>` | Bug fix (e.g. `fix/web/auth-redirect`) |
| `docs/<short-desc>` | Documentation only (e.g. `docs/api-reference`) |
| `refactor/<scope>/<short-desc>` | Refactor with no behaviour change |
| `chore/<short-desc>` | Maintenance (deps, CI, etc.) |
| `test/<scope>/<short-desc>` | Test-only changes |

`<scope>` is one of: `agents`, `web`, `core`, `cli`, `ui`, `db`, `infra`, `docs`.

**Examples:**
- `feat/agents/forecasting-oracle`
- `fix/web/upload-progress`
- `docs/api-reference`

---

## 5. Commit message conventions

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

| Type | When to use |
|---|---|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `refactor` | Code restructure with no behaviour change |
| `perf` | Performance improvement |
| `test` | Test-only changes |
| `chore` | Maintenance (deps, CI, tooling) |
| `style` | Formatting, whitespace (no code logic change) |
| `ci` | CI/CD changes |
| `revert` | Revert a previous commit |

**Examples:**
```
feat(agents): add ForecastingOracle agent (Holt-Winters + FFT)
fix(web): redirect to /dashboard after SSO login
docs(cli): add serve command examples
refactor(core): tighten Zod validation on AgentMetadata
```

Keep the subject line ≤ 72 chars, imperative mood ("add" not "added"), no trailing period.

---

## 6. Pull request process

### Before opening a PR

1. **Rebase on `revolution`** — `git fetch origin && git rebase origin/revolution`
2. **Run the full check suite** — `pnpm typecheck && pnpm test && pnpm lint`
3. **Add tests** for any new functionality (see §7 below)
4. **Update docs** if you changed the public API or added a new feature
5. **Keep the PR small and focused** — one feature per PR, ≤ 500 lines if possible

### PR template

When you open a PR, fill in the template:

```markdown
## What
A clear 1-2 sentence description of what this PR changes.

## Why
The motivation. What problem does this solve? Link to issue #N if applicable.

## How
Brief description of the approach. Mention any non-obvious design decisions.

## Testing
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes
- [ ] New tests added for new functionality
- [ ] Manually tested (describe how)

## Screenshots / output
(If UI or CLI output changed, paste a screenshot or terminal output.)

## Checklist
- [ ] Code follows the style guide
- [ ] Self-reviewed
- [ ] Docs updated
- [ ] No new warnings in `pnpm typecheck` or `pnpm lint`
```

### Review criteria

Reviewers will check:

- **Correctness** — does it do what the PR says?
- **Tests** — are there tests? Do they cover edge cases?
- **Types** — no new `any`, no `@ts-ignore` without a comment
- **Performance** — no N+1 queries, no unnecessary re-renders, no blocking the event loop
- **Security** — no secrets in code, input validation, no SSRF vectors
- **Docs** — public API changes are documented
- **Backward compatibility** — unless explicitly breaking, don't break existing consumers

### Merging

- PRs need **at least 1 approval** from a code owner
- **Squash-and-merge** is the default (keeps history clean)
- Delete the branch after merge

---

## 7. Testing requirements

### What needs tests

| Change type | Test required? |
|---|---|
| New agent | **Yes** — unit test for `execute()` + a Zod schema test |
| New API route | **Yes** — integration test that hits the route |
| New CLI command | **Yes** — smoke test that runs the command with `--help` and a happy path |
| Bug fix | **Yes** — regression test that fails before the fix, passes after |
| Refactor | If existing tests cover it, no new tests needed; otherwise yes |
| Docs only | No |
| Dependency bump | Run the existing test suite; no new tests needed |

### Test runner

We use [Vitest](https://vitest.dev/). Tests live next to the source file:

```
packages/agents/src/agents/detect/ForecastingOracleAgent.ts
packages/agents/src/agents/detect/ForecastingOracleAgent.test.ts
```

Or in a `__tests__/` directory for cross-cutting tests:

```
packages/agents/src/__tests__/trajectory.test.ts
```

### Running tests

```bash
pnpm test                       # all packages
pnpm test:agents                # just @busara/agents
pnpm test:core
pnpm test:web
pnpm test --watch               # watch mode
pnpm test:coverage              # with coverage report
```

### Writing a good test

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { ForecastingOracleAgent } from './ForecastingOracleAgent';

describe('ForecastingOracleAgent', () => {
  let agent: ForecastingOracleAgent;

  beforeEach(() => {
    agent = new ForecastingOracleAgent();
  });

  it('should produce a forecast for a regular time series', async () => {
    const ctx = makeContext({ /* fixture */ });
    const result = await agent.execute(ctx);
    expect(result.status).toBe('success');
    expect(result.output).toMatchObject({
      forecast: expect.any(Array),
      horizon: expect.any(Number),
    });
  });

  it('should return an error result when the input is empty', async () => {
    const ctx = makeContext({ dataframe: [] });
    const result = await agent.execute(ctx);
    expect(result.status).toBe('failed');
  });
});
```

Aim for **80%+ coverage** on new code. Use `pnpm test:coverage` to check.

---

## 8. Adding a new agent

See [`docs/AGENTS.md`](./AGENTS.md) for the complete step-by-step guide. The short version:

1. Create `packages/agents/src/agents/<stage>/<Name>Agent.ts`
2. Implement the `BaseAgent` interface with Zod schemas
3. Export it from the stage's `index.ts`
4. Write tests next to the source file
5. Run `pnpm --filter @busara/agents test` to verify
6. The `AgentPool` auto-discovers it — no manual registration needed

---

## 9. Reporting bugs

Open a [GitHub Issue](https://github.com/gadda00/IntelliFlow/issues/new) with:

1. **Busara version** — `git rev-parse HEAD` or the version in `package.json`
2. **Node version** — `node --version`
3. **OS** — `uname -a` or Windows version
4. **Steps to reproduce** — be specific, include the smallest dataset that triggers the bug
5. **Expected vs actual behaviour**
6. **Logs** — set `LOG_LEVEL=debug` and paste the relevant output

---

## 10. Code of conduct

Be kind. Be patient. Assume good intent. Critique the code, not the person.

---

## 11. Getting help

- **GitHub Issues** — bugs and feature requests
- **GitHub Discussions** — questions, design ideas, "how do I…"
- **Code owners** — see `.github/CODEOWNERS` for who reviews what

Happy coding! 🚀
