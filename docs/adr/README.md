# Architecture Decision Records (ADRs)

This directory contains the ADRs for the Busara platform. Each ADR
documents a significant architectural decision: why it was made, what
the alternatives were, and what consequences it has.

## What an ADR looks like

Every ADR follows the [Nygard
template](https://github.com/joelparkerhenderson/architecture-decision-record):

```markdown
# ADR-NNNN: Title

## Status
Accepted | Proposed | Deprecated | Superseded by ADR-XXXX

## Context
[Why this decision was needed]

## Decision
[What was decided]

## Consequences
[Positive and negative impacts]

## Alternatives Considered
[What else was on the table]
```

## Index

| # | Title | Status |
|---|---|---|
| [0001](./0001-use-monorepo-with-turborepo.md) | Use a monorepo with Turborepo | Accepted |
| [0002](./0002-zod-v4-for-validation.md) | Use Zod v4 for validation | Accepted |
| [0003](./0003-trajectory-based-self-evolution.md) | Trajectory-based self-evolution | Accepted |
| [0004](./0004-agent-pipeline-dag-orchestration.md) | Agent pipeline DAG orchestration | Accepted |
| [0005](./0005-aes-gcm-datasource-encryption.md) | AES-GCM datasource encryption | Accepted |
| [0006](./0006-opentelemetry-genai-export.md) | OpenTelemetry GenAI export | Accepted |
| [0007](./0007-verification-gates-and-replanning.md) | Verification gates and replanning | Accepted |

## When to write an ADR

Write an ADR when you make a decision that:

- Is **hard to reverse** (e.g. choosing a database, an encryption
  scheme, a monorepo tool).
- Has **multiple reasonable alternatives** (if there's only one
  obvious choice, an ADR is overkill).
- **Affects multiple teams or packages** (a decision that only affects
  one file doesn't need an ADR).
- **Will be questioned later** (new contributors will ask "why did you
  do it this way?" — the ADR is the answer).

You don't need an ADR for:

- Bug fixes.
- Adding a new agent.
- Refactoring within a package.
- Upgrading a dependency (unless it's a major version with breaking
  changes).

## How to propose a new ADR

1. Copy `0000-template.md` (or the closest existing ADR) to
   `NNNN-short-title.md`, where `NNNN` is the next available number.
2. Fill in the sections. Be specific — name the alternatives you
   considered and why you rejected them.
3. Open a PR. The ADR's `Status` is `Proposed` until the PR is merged,
   then it becomes `Accepted`.
4. If an ADR supersedes an earlier one, set the earlier one's status
   to `Superseded by ADR-XXXX` and add a link at the top.

## ADRs we may write next

- Per-tenant encryption keys (superseding ADR-0005)
- Prisma vs. Drizzle for the ORM layer
- SSE vs. WebSocket for streaming
- Upstash Redis vs. in-process rate limiting
- Edge runtime vs. Node runtime for API routes
- Langfuse vs. Arize Phoenix as the primary observability backend
