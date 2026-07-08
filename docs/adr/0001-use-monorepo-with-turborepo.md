# ADR-0001: Use a monorepo with Turborepo

## Status

Accepted

## Context

Busara is a multi-agent data intelligence platform with five tightly-coupled
concerns:

1. **The agent framework** — 33 statistical/ML agents, the trajectory
   protocol, and the self-evolution control plane.
2. **The web app** — a Next.js 15 app that hosts both the UI and the HTTP
   API the framework is exposed through.
3. **The CLI** — a terminal command (`busara`) that drives the API for
   scripting and local development.
4. **Shared types** — `AgentMetadata`, `Trajectory`, `EvolutionAction`,
   etc. that flow end-to-end from the agent → the API response → the CLI
   output.
5. **Shared UI primitives** — the `cn()` helper, theme tokens, future
   component library.

When the project was a single Next.js app (`apps/web`) the agent code lived
inside the web app's `src/lib/`. This caused three problems:

- **Tight coupling.** The CLI (which only needs HTTP) was forced to
  import the agent framework, dragging in Prisma, React, and 80+ web
  deps it never used.
- **No atomic releases.** A change to an agent's metadata required
  touching the web app, the API route, and the CLI in three separate
  repos. PRs were split, drift crept in, and CI re-ran the whole world
  for every change.
- **No type sharing.** The CLI was duplicating types that the web app
  already declared. Every schema change was a manual sync.

We needed a structure that let us share types end-to-end, keep the CLI
lightweight, and run cross-package tests in CI without publishing private
packages.

## Decision

Adopt a **pnpm + Turborepo monorepo** with the following layout:

```
apps/web/         Next.js 15 — UI + HTTP API
packages/core/    Shared types, constants, errors, validation
packages/agents/  Agent framework + AReaL trajectory/evolution system
packages/cli/     The `busara` CLI (commander.js, CommonJS, no React)
packages/ui/      Shared UI primitives (cn helper, types)
```

- **pnpm workspaces** for package resolution. `workspace:*` protocol
  links local packages at install time — no publish required.
- **Turborepo** for the task graph (`turbo.json`). `pnpm typecheck`
  runs every package's `typecheck` script in parallel, with caching
  keyed on input hashes.
- **Strict pnpm** (enforced via `.npmrc` and a `preinstall` hook) — no
  phantom dependencies, no hoisting of implicit deps.
- A single root `tsconfig.json` with project references, plus per-
  package `tsconfig.json` files that extend it.

## Consequences

**Positive:**

- Atomic cross-package PRs. A new agent + its API route + its CLI
  command ship in one diff.
- Types flow from `@busara/core` → `@busara/agents` → `@busara/web` →
  `@busara/cli`. Breaking changes surface as TypeScript errors at
  build time, not at runtime.
- The CLI's `pnpm install` is fast — it doesn't pull React, Prisma, or
  any of the web app's deps.
- Turborepo's remote cache (when wired up) makes CI fast: a code change
  in `packages/agents` only re-typechecks `packages/agents` and its
  dependents.

**Negative:**

- Local development requires pnpm installed globally (we enforce it
  via a `preinstall` hook that errors on `npm`/`yarn`).
- New contributors must learn workspace concepts. The `workspace:*`
  syntax and the `pnpm --filter` workflow are not obvious.
- IDE tooling has to be workspace-aware. VS Code's TypeScript server
  handles this out of the box, but other tooling occasionally stumbles
  on the symlinks in `node_modules`.
- One Git history for everything means a refactor that touches all
  packages produces a large diff. We accept this — the alternative
  (split repos) produces coordinated-update hell.

## Alternatives Considered

- **Single Next.js app.** What we had before. Fastest to start, but
  doesn't scale to a CLI or a separate agent-framework consumer. The
  CLI would either have to live in a separate repo (losing type
  sharing) or pull in the entire web app's dep tree (slow installs).
- **Nx.** Similar to Turborepo but with more opinionated generators and
  a heavier config surface. We don't need the generator story; we do
  need fast caching. Turborepo wins on simplicity.
- **Lerna.** Largely superseded by Nx + Turborepo. The Lerna project
  itself recommends migrating to Nx. Not a serious contender in 2026.
- **Bun workspaces.** Promising — Bun is fast — but the runtime isn't
  mature enough for a Next.js 15 + Prisma + Edge-runtime production
  stack yet. Worth revisiting in 12-18 months.
- **Polyrepo with published private packages.** Would solve the
  "CLI is lightweight" concern but introduce a publish step, version
  skew, and slower inner-loop feedback. Not worth the overhead for a
  team of our size.
