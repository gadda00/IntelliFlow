# ADR-0002: Use Zod v4 for validation

## Status

Accepted

## Context

Busara has five layers where data shape matters:

1. **HTTP request bodies** — `/api/v2/analyze` takes a dataframe and a
   config; `/api/v2/trajectory/:id/reward` takes a reward signal with a
   restricted set of sources.
2. **HTTP query parameters** — `/api/v2/trajectory?status=success&minReward=0.5`
   needs type coercion (`minReward` arrives as a string) and enum checks.
3. **Agent inputs** — every agent declares an `inputSchema` that the
   orchestrator validates against before calling `execute()`.
4. **Agent outputs** — every agent declares an `outputSchema` that
   downstream agents (and verification gates) check before consuming.
5. **Config defaults** — every agent declares a `configSchema` with
   defaults so the orchestrator can call it with `{}` and still get
   sensible behavior.

We needed a single schema language that:

- Compiles to TypeScript types (so we don't write the same shape twice)
- Produces good error messages with paths (so the API can return
  `error.details` that pinpoint which field failed)
- Supports composition (an agent's output is another agent's input)
- Supports refinements (e.g. "this string is a valid ISO date")
- Has first-class support for `Record<string, unknown>` (the dataframe
  type — `Record<string, unknown>[]`)
- Works in both Node (API routes, CLI) and the browser (form
  validation in the wizard)

## Decision

Adopt **Zod v4** as the single schema language across the monorepo.

- Every API route handler parses its input with a Zod schema before
  touching it. Invalid input → `400 VALIDATION_ERROR` with the Zod
  issues array attached as `error.details`.
- Every agent declares `inputSchema`, `outputSchema`, and
  `configSchema` as Zod schemas on its metadata.
- The agent framework's `validateInput()` / `validateOutput()` helpers
  accept Zod schemas and produce `AgentValidationError` (a
  `BusaraError` subclass) on failure.
- The CLI uses the same schemas to validate its YAML/JSON config files
  and CLI flags before sending them over HTTP.
- Where TypeScript types are needed, we use `z.infer<typeof schema>`
  to derive them — never hand-written.

## Consequences

**Positive:**

- One mental model. Schemas are types are runtime validators.
- Errors are actionable. The API returns `[{path: ['dataframe', 0, 'id'], message: 'Expected number, received string'}]`, which the UI can highlight.
- Schemas compose. An agent that consumes another agent's output just
  imports the upstream agent's `outputSchema` and reuses it.
- The web UI can render a config form from the agent's `configSchema`
  without writing a separate form spec.
- TypeScript inference means refactoring a schema automatically
  updates every consumer's types.

**Negative:**

- Zod v4 is a non-trivial runtime dependency (~30 KB gzipped). Worth
  it for us; would be overkill for a tiny app.
- Some TypeScript patterns (e.g. branded types, complex generics) are
  awkward to express in Zod. We work around with `.brand()` or with
  hand-written type intersections.
- Zod's error messages are good but not great. We sometimes override
  with `.refine()` to add context.
- Performance: parsing a 100 000-row dataframe with Zod is slow. We
  bypass Zod for the dataframe itself (validate the schema, then pass
  the raw array to the agent) and only validate the *shape* of each
  row in development.

## Alternatives Considered

- **Joi.** Mature, but no first-class TypeScript inference. You'd write
  the schema and the type separately, which defeats the purpose.
- **Yup.** Similar story to Joi. Smaller, but still no inference.
- **io-ts.** Excellent inference, but the API is functional and harder
  to read at a glance. The ecosystem is also smaller.
- **Valibot.** Strong contender — smaller bundle, modular API. We
  chose Zod because the ecosystem (form libraries, OpenAPI exporters,
  Next.js middleware) is more mature. Revisit in 12 months.
- **TypeBox.** JSON-Schema-native, which is attractive, but the
  ergonomics are worse than Zod for hand-written schemas.
- **No validation library.** Hand-rolled `if (typeof x !== 'string')`
  checks. We tried this for the first month. It doesn't scale past
  ~10 endpoints — the boilerplate dominates the logic.
- **JSON Schema.** Standard, but no inference and verbose. We'd end up
  generating TypeScript types from the JSON Schema, which is a build
  step we'd rather avoid.
