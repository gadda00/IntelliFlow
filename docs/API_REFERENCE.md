# Busara API Reference

This is the complete HTTP API reference for the Busara platform. The API is served by the Next.js app at `apps/web/` and lives under `/api/`. The current modern surface is `/api/v2/` and `/api/v7/`; the legacy `/api/` routes are still supported for backwards compatibility.

> **Base URL:** `http://localhost:3000` (local dev) or your production URL.
> **Auth:** Bearer token via `Authorization: Bearer ifl_...` header (optional for local dev).
> **Content type:** `application/json` for request and response bodies, except streaming endpoints which use `text/event-stream`.

---

## Table of contents

- [Authentication](#authentication)
- [Rate limiting](#rate-limiting)
- [Error format](#error-format)
- [Agents](#agents)
  - [`GET /api/v7/agents`](#get-apiv7agents)
  - [`GET /api/v2/analyze`](#get-apiv2analyze)
  - [`GET /api/agents`](#get-apiagents)
- [Analysis](#analysis)
  - [`POST /api/v2/analyze`](#post-apiv2analyze)
  - [`POST /api/v2/analyze-stream`](#post-apiv2analyze-stream)
- [Trajectory](#trajectory)
  - [`GET /api/v2/trajectory`](#get-apiv2trajectory)
  - [`GET /api/v2/trajectory/:id`](#get-apiv2trajectoryid)
  - [`POST /api/v2/trajectory/:id/reward`](#post-apiv2trajectoryidreward)
  - [`GET /api/v2/trajectory/agent/:agentId/stats`](#get-apiv2trajectoryagentagentidstats)
- [Evolution](#evolution)
  - [`GET /api/v2/evolution`](#get-apiv2evolution)
  - [`POST /api/v2/evolution`](#post-apiv2evolution)
- [Health](#health)
  - [`GET /api/health`](#get-apihealth)
- [Legacy / v1 routes](#legacy--v1-routes)
- [Error codes](#error-codes)

---

## Authentication

The Busara API uses Bearer token authentication. Tokens are prefixed with `ifl_` and can be created in the web UI (Profile → API Keys) or via the API:

```http
POST /api/auth/api-keys
Authorization: Bearer <session-token>
Content-Type: application/json

{ "name": "My CLI key" }
```

Response (201):

```json
{
  "id": "key_abc123",
  "name": "My CLI key",
  "prefix": "ifl_abc…",
  "key": "ifl_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "createdAt": "2026-01-15T10:30:00.000Z",
  "message": "Store this key safely — it will not be shown again."
}
```

The `key` is only shown once. Use it in subsequent requests:

```http
Authorization: Bearer ifl_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Auth is optional for local development.** Anonymous callers get a synthetic user ID (`anon_<ip>`) so trajectories still have an owner for governance and dedup.

---

## Rate limiting

Production deployments use Upstash Redis for rate limiting. Limits are per-API-key (or per-IP for anonymous):

| Endpoint group | Limit | Window |
|---|---|---|
| `/api/v2/analyze` | 60 | per minute |
| `/api/v2/analyze-stream` | 20 | per minute |
| `/api/v2/trajectory*` | 200 | per minute |
| All other endpoints | 300 | per minute |

When you exceed the limit, the API returns `429 Too Many Requests` with a `Retry-After` header.

Rate limiting is disabled in local dev (no Redis required).

---

## Error format

All errors follow the same shape:

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request",
    "details": [ /* Zod issue objects, when applicable */ ]
  }
}
```

| Field | Type | Description |
|---|---|---|
| `ok` | boolean | Always `false` for errors |
| `error.code` | string | Machine-readable error code (see [Error codes](#error-codes)) |
| `error.message` | string | Human-readable error message |
| `error.details` | any | Optional structured details (e.g. Zod issues) |

HTTP status codes follow REST conventions: `400` for client errors, `401` for auth, `404` for not found, `429` for rate limit, `500` for server errors.

---

## Agents

### `GET /api/v7/agents`

List metadata for every registered agent. This is the preferred endpoint for agent discovery — it returns the full metadata including schemas.

**Request:**

```http
GET /api/v7/agents
```

No query parameters, no auth required.

**Response (200):**

```json
{
  "total": 14,
  "agents": [
    {
      "id": "data_ingestion",
      "name": "Data Ingestion",
      "description": "Validates the uploaded dataset...",
      "version": "1.0.0",
      "stage": "ingest",
      "stageNumber": 0,
      "tier": "core",
      "stability": "stable",
      "capabilities": ["data_validation", "structure_check", "format_detection"],
      "tags": ["ingestion", "validation", "parsing"],
      "category": "data",
      "dependencies": [],
      "timeoutMs": 15000,
      "maxRetries": 3,
      "inputDescription": "Raw data in various formats (CSV, JSON, Excel)",
      "outputDescription": "Validated and parsed data with metadata",
      "inputSchema": { "description": "Raw data to be ingested" },
      "outputSchema": { "description": "Ingestion result with data metadata" },
      "configSchema": {
        "defaults": {
          "sampleSize": 5,
          "inferTypes": true,
          "validateRows": true
        },
        "description": "Data ingestion configuration"
      }
    }
    /* ...13 more agents... */
  ],
  "tiers": { "core": 3, "advanced": 0, "specialized": 11, "ml": 0, "stats": 0 },
  "byStage": { "ingest": 3, "engineer": 4, "detect": 7 },
  "stages": 3,
  "version": "7.0"
}
```

---

### `GET /api/v2/analyze`

Lightweight agent list — only `id`, `name`, `stage`, `stability`. Useful when you don't need the full metadata.

**Request:**

```http
GET /api/v2/analyze
```

**Response (200):**

```json
{
  "ok": true,
  "agents": [
    { "id": "data_ingestion", "name": "Data Ingestion", "stage": "ingest", "stability": "stable" }
    /* ... */
  ]
}
```

---

### `GET /api/agents`

Legacy v1 endpoint. Returns the same shape as `/api/v7/agents` but with slightly different field names. Still supported; new code should use `/api/v7/agents` instead.

**Response (200):**

```json
{
  "total": 14,
  "agents": [ /* same shape as v7 */ ],
  "tiers": { "core": 3, "advanced": 0, "specialized": 11 },
  "poolSize": 14
}
```

---

## Analysis

### `POST /api/v2/analyze`

Run a single agent against a dataframe, with full trajectory recording wired in automatically.

**Request:**

```http
POST /api/v2/analyze
Content-Type: application/json

{
  "agentId": "data_ingestion",
  "dataframe": [
    { "id": 1, "name": "Alice", "score": 95 },
    { "id": 2, "name": "Bob", "score": 87 }
  ],
  "config": {
    "sampleSize": 5,
    "inferTypes": true
  },
  "analysisId": "an_my_run_001",
  "workspaceId": "ws_abc",
  "organizationId": "org_xyz"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `agentId` | string | yes | Agent ID (e.g. `data_ingestion`) |
| `dataframe` | `Record<string, unknown>[]` | yes | Array of records (rows). Must have at least 1 row. |
| `config` | object | no | Agent config. Defaults are merged in. |
| `analysisId` | string | no | Auto-generated if omitted (`an_<timestamp>_<rand>`) |
| `workspaceId` | string | no | Multi-tenant workspace ID |
| `organizationId` | string | no | Multi-tenant org ID |

**Response (200):**

```json
{
  "ok": true,
  "analysisId": "an_my_run_001",
  "trajectoryId": "traj_abc123def456",
  "result": {
    "status": "success",
    "output": {
      "rowCount": 2,
      "columnCount": 3,
      "columns": ["id", "name", "score"],
      "memorySize": 128,
      "isEmpty": false,
      "hasHeaders": true,
      "sampleRows": [ /* ... */ ]
    },
    "metrics": {
      "rowsProcessed": 2,
      "columnsDetected": 3
    },
    "executionTimeMs": 12
  }
}
```

**Errors:**

| Status | Code | Cause |
|---|---|---|
| 400 | `BAD_JSON` | Request body is not valid JSON |
| 400 | `VALIDATION_ERROR` | Body failed Zod validation (see `details`) |
| 404 | `AGENT_NOT_FOUND` | `agentId` is not registered |
| 500 | `AGENT_EXECUTION_ERROR` | Agent threw during execution |

The `trajectoryId` can be used with [`POST /api/v2/trajectory/:id/reward`](#post-apiv2trajectoryidreward) to attach reward signals after the user interacts with the result. This closes the RL feedback loop.

---

### `POST /api/v2/analyze-stream`

Streaming variant of `/api/v2/analyze`. Executes one or more agents from the pool against the supplied dataframe, emitting Server-Sent Events as each agent starts and completes.

**Request:**

```http
POST /api/v2/analyze-stream
Content-Type: application/json
Accept: text/event-stream

{
  "dataframe": [ /* ... */ ],
  "agentIds": ["data_ingestion", "schema_inference", "data_profiler"],
  "config": { "sensitivity": "high" },
  "analysisId": "an_stream_001",
  "workspaceId": "ws_abc"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `dataframe` | `Record<string, unknown>[]` | yes | Input dataframe |
| `agentIds` | string[] | no | Defaults to all registered agents |
| `config` | object | no | Config passed to every agent |
| `analysisId` | string | no | Auto-generated if omitted |
| `workspaceId` | string | no | |
| `organizationId` | string | no | |

**Response:** `Content-Type: text/event-stream`

The stream emits the following events:

#### `event: connected`

Sent immediately when the connection opens.

```
event: connected
data: {"analysisId":"an_stream_001","agentCount":3,"timestamp":"2026-01-15T10:30:00.000Z"}
```

#### `event: agent_start`

Sent when an agent begins executing.

```
event: agent_start
data: {
  "analysisId": "an_stream_001",
  "agentId": "data_ingestion",
  "agentName": "Data Ingestion",
  "stage": "ingest",
  "stepIndex": 0,
  "totalSteps": 3,
  "timestamp": "2026-01-15T10:30:00.012Z"
}
```

#### `event: agent_complete`

Sent when an agent finishes (success or failure). Includes the trajectory ID for reward attachment.

```
event: agent_complete
data: {
  "analysisId": "an_stream_001",
  "agentId": "data_ingestion",
  "agentName": "Data Ingestion",
  "status": "success",
  "trajectoryId": "traj_abc123",
  "durationMs": 12,
  "error": null,
  "timestamp": "2026-01-15T10:30:00.025Z"
}
```

#### `event: complete`

Sent once at the end of the stream.

```
event: complete
data: {
  "analysisId": "an_stream_001",
  "status": "success",
  "agentsSucceeded": 3,
  "agentsFailed": 0,
  "totalDurationMs": 47,
  "timestamp": "2026-01-15T10:30:00.047Z"
}
```

#### `event: error`

Sent on a stream-level error.

```
event: error
data: { "analysisId": "an_stream_001", "message": "..." }
```

---

## Trajectory

### `GET /api/v2/trajectory`

List recent trajectories, with optional filters.

**Request:**

```http
GET /api/v2/trajectory?agentId=data_ingestion&status=success&limit=20&offset=0&orderBy=startedAt&orderDirection=desc
```

| Query param | Type | Default | Description |
|---|---|---|---|
| `agentId` | string | — | Filter by agent ID |
| `userId` | string | — | Filter by user ID |
| `workspaceId` | string | — | Filter by workspace |
| `status` | enum | — | `running` \| `success` \| `failed` \| `cancelled` \| `timeout` |
| `startDate` | ISO date | — | Filter by `startedAt >=` |
| `endDate` | ISO date | — | Filter by `startedAt <=` |
| `minReward` | number | — | Filter by average reward >= |
| `maxReward` | number | — | Filter by average reward <= |
| `tags` | string[] | — | Filter by tags (JSON-encoded array) |
| `limit` | number | 50 | 1-200 |
| `offset` | number | 0 | Pagination offset |
| `orderBy` | enum | `startedAt` | `startedAt` \| `completedAt` \| `reward` \| `duration` |
| `orderDirection` | enum | `desc` | `asc` \| `desc` |

**Response (200):**

```json
{
  "ok": true,
  "data": [
    {
      "id": "traj_abc123",
      "analysisId": "an_001",
      "agentId": "data_ingestion",
      "agentVersion": "1.0.0",
      "agentStability": "stable",
      "startedAt": "2026-01-15T10:30:00.000Z",
      "completedAt": "2026-01-15T10:30:00.012Z",
      "status": "success",
      "steps": [ /* ... */ ],
      "rewards": [ /* ... */ ],
      "metrics": { /* ... */ }
    }
  ],
  "total": 142,
  "limit": 20,
  "offset": 0
}
```

---

### `GET /api/v2/trajectory/:id`

Get a single trajectory by ID, including all steps and rewards.

**Request:**

```http
GET /api/v2/trajectory/traj_abc123
```

**Response (200):**

```json
{
  "ok": true,
  "data": {
    "id": "traj_abc123",
    "analysisId": "an_001",
    "userId": "user_xyz",
    "agentId": "data_ingestion",
    "agentVersion": "1.0.0",
    "agentStability": "stable",
    "startedAt": "2026-01-15T10:30:00.000Z",
    "completedAt": "2026-01-15T10:30:00.012Z",
    "status": "success",
    "steps": [
      {
        "id": "step_001",
        "name": "validate_input",
        "startedAt": "2026-01-15T10:30:00.001Z",
        "completedAt": "2026-01-15T10:30:00.003Z",
        "observation": { /* ... */ },
        "action": { /* ... */ },
        "result": { /* ... */ }
      }
    ],
    "rewards": [
      {
        "type": "explicit",
        "source": "user_thumbs_up",
        "value": 1.0,
        "timestamp": "2026-01-15T10:35:00.000Z"
      }
    ],
    "contextSnapshot": {
      "dataframeHash": "sha256:...",
      "configHash": "sha256:...",
      "config": { /* ... */ }
    },
    "metrics": {
      "rowCount": 2,
      "executionTimeMs": 12
    }
  }
}
```

**Errors:**

| Status | Code | Cause |
|---|---|---|
| 404 | `NOT_FOUND` | Trajectory ID does not exist |

---

### `POST /api/v2/trajectory/:id/reward`

Attach a reward signal to a trajectory. This is the explicit feedback channel that closes the RL loop.

**Request:**

```http
POST /api/v2/trajectory/traj_abc123/reward
Content-Type: application/json

{
  "type": "explicit",
  "source": "user_thumbs_up",
  "value": 1.0,
  "text": "This analysis was exactly what I needed!",
  "provider": "busara-web"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `type` | enum | yes | `explicit` \| `implicit` \| `automated` |
| `source` | enum | yes | See sources table below |
| `value` | number | yes | -1.0 to 1.0 |
| `text` | string | no | Optional comment |
| `provider` | string | no | Who attached the reward (e.g. `busara-web`, `busara-cli`, `reward-model-v1`) |

**Reward sources:**

| Source | Type | Description |
|---|---|---|
| `user_thumbs_up` | explicit | User clicked 👍 |
| `user_thumbs_down` | explicit | User clicked 👎 |
| `user_cited_insight` | explicit | User copied / cited an insight |
| `user_returned` | implicit | User came back to the analysis within 24h |
| `user_shared` | implicit | User shared the analysis |
| `user_ignored` | implicit | User dismissed without interacting |
| `quality_score` | automated | Reward model assigned a quality score |
| `validation_pass` | automated | Output passed all verification gates |
| `validation_fail` | automated | Output failed verification gates |
| `peer_agreement` | automated | Other agents agreed with this output |
| `peer_disagreement` | automated | Other agents disagreed |
| `custom` | any | Anything else |

**Response (200):**

```json
{
  "ok": true,
  "data": {
    "reward": {
      "type": "explicit",
      "source": "user_thumbs_up",
      "value": 1.0,
      "text": "This analysis was exactly what I needed!",
      "timestamp": "2026-01-15T10:35:00.000Z"
    }
  }
}
```

---

### `GET /api/v2/trajectory/agent/:agentId/stats`

Get aggregate trajectory statistics for a single agent.

**Request:**

```http
GET /api/v2/trajectory/agent/data_ingestion/stats
```

**Response (200):**

```json
{
  "ok": true,
  "data": {
    "totalTrajectories": 142,
    "successRate": 0.97,
    "failureRate": 0.03,
    "averageReward": 0.62,
    "averageDurationMs": 18,
    "byStatus": {
      "success": 138,
      "failed": 3,
      "timeout": 1
    }
  }
}
```

---

## Evolution

### `GET /api/v2/evolution`

List pending evolution actions for one agent (or get instructions for listing across all agents).

**Request:**

```http
GET /api/v2/evolution?agentId=data_ingestion
```

| Query param | Type | Required | Description |
|---|---|---|---|
| `agentId` | string | no | Get actions for a specific agent |

**Response (200) — with `agentId`:**

```json
{
  "ok": true,
  "data": [
    {
      "type": "OPTIMIZE_CONFIG",
      "agentId": "data_ingestion",
      "reason": "Config key 'sampleSize' has higher avg reward at value 10 (current default: 5)",
      "evidence": {
        "totalTrajectories": 142,
        "successRate": 0.97,
        "averageReward": 0.62,
        "configInsights": [
          {
            "configKey": "sampleSize",
            "currentValue": 5,
            "suggestedValue": 10,
            "reason": "Higher reward observed with sampleSize=10",
            "evidence": {
              "highRewardOccurrences": 47,
              "lowRewardOccurrences": 3,
              "averageRewardWithCurrent": 0.55,
              "averageRewardWithSuggested": 0.74
            }
          }
        ]
      },
      "suggestedChange": { "config.defaults.sampleSize": 10 },
      "confidence": 0.82,
      "createdAt": "2026-01-15T11:00:00.000Z",
      "status": "pending"
    }
  ]
}
```

**Response (200) — without `agentId`:**

```json
{
  "ok": true,
  "data": [],
  "message": "Pass ?agentId=X to get evolution actions for a specific agent"
}
```

---

### `POST /api/v2/evolution`

Approve, reject, apply, or roll back an evolution action.

**Request:**

```http
POST /api/v2/evolution
Content-Type: application/json

{
  "actionType": "approve",
  "agentId": "data_ingestion",
  "actionIndex": 0
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `actionType` | enum | yes | `approve` \| `reject` \| `apply` \| `rollback` |
| `agentId` | string | yes | The agent the action targets |
| `actionIndex` | number | yes | 0-based index from the `GET /api/v2/evolution?agentId=...` response |

**Response (200):**

```json
{
  "ok": true,
  "data": {
    "actionType": "approve",
    "agentId": "data_ingestion",
    "actionIndex": 0,
    "appliedAt": "2026-01-15T11:05:00.000Z",
    "status": "approved"
  }
}
```

The `status` field is `approved` for `approve`, `rejected` for `reject`, `applied` for `apply`, and `rolled_back` for `rollback`.

---

## Health

### `GET /api/health`

Liveness probe. Returns the server status, agent pool size, DAG structure, and cache stats.

**Request:**

```http
GET /api/health
```

**Response (200):**

```json
{
  "status": "healthy",
  "version": "3.0.0",
  "timestamp": "2026-01-15T10:30:00.000Z",
  "agents": {
    "total": 14,
    "ids": ["data_ingestion", "schema_inference", /* ... */]
  },
  "dag": {
    "stages": 7,
    "edges": 12
  },
  "cache": {
    "hits": 142,
    "misses": 18,
    "size": 14,
    "hitRate": 0.887
  },
  "environment": "development",
  "flwConfigured": true
}
```

---

## Legacy / v1 routes

The following v1 routes are still supported but deprecated. New integrations should use the v2 / v7 equivalents.

| v1 route | v2 / v7 replacement |
|---|---|
| `GET /api/agents` | `GET /api/v7/agents` |
| `POST /api/analyze` | `POST /api/v2/analyze` |
| `POST /api/analyze-stream` | `POST /api/v2/analyze-stream` |
| `GET /api/stats` | (no replacement; use `/api/v2/trajectory/agent/:id/stats`) |
| `GET /api/analyses` | (no replacement; query `/api/v2/trajectory`) |

Other v1 routes that remain in active use:

| Route | Method | Description |
|---|---|---|
| `/api/health` | GET | Health check |
| `/api/auth/register` | POST | Register a new user |
| `/api/auth/login` | POST | Login with email + password |
| `/api/auth/me` | GET | Get current user |
| `/api/auth/api-keys` | GET, POST, DELETE | Manage API keys |
| `/api/auth/sso` | POST | Single sign-on callback |
| `/api/analyses` | GET, DELETE | List / delete saved analyses |
| `/api/anomalies` | GET | Query saved anomalies |
| `/api/forecast` | POST | Run a forecast |
| `/api/knowledge-graph` | GET | Fetch the knowledge graph |
| `/api/causal` | POST | Run a causal analysis |
| `/api/benchmark` | POST | Run a benchmark |
| `/api/quality` | POST | Score data quality |
| `/api/explain` | POST | Explain an analysis result |
| `/api/nlq` | POST | Natural-language query |
| `/api/ai-narrative` | POST | Generate an AI narrative for an analysis |
| `/api/synthetic` | POST | Generate synthetic data |
| `/api/connectors` | GET | List data connectors |
| `/api/codegen` | POST | Generate code from an analysis |
| `/api/chat` | POST | Chat with the assistant |
| `/api/mcp` | GET, POST | Model Context Protocol bridge |
| `/api/audit` | GET | Audit log |
| `/api/rbac` | GET | RBAC permissions |
| `/api/plans` | GET | Subscription plans |
| `/api/payments/initialize` | POST | Initialize a payment |
| `/api/payments/verify` | POST | Verify a payment |
| `/api/payments/webhook` | POST | Payment webhook (Flutterwave) |
| `/api/pdf-export` | POST | Export an analysis as PDF |
| `/api/analysis-status` | GET | Check analysis status (long-running) |

---

## Error codes

| Code | HTTP status | Description |
|---|---|---|
| `NETWORK_ERROR` | (CLI only) | The CLI could not reach the API |
| `BAD_JSON` | 400 | Request body is not valid JSON |
| `VALIDATION_ERROR` | 400 | Body or query failed Zod validation |
| `UNAUTHORIZED` | 401 | Missing or invalid auth token |
| `FORBIDDEN` | 403 | Auth token doesn't have permission |
| `NOT_FOUND` | 404 | Resource not found |
| `AGENT_NOT_FOUND` | 404 | `agentId` is not registered |
| `NO_AGENTS` | 400 | `agentIds` array was empty or contained no valid agents |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `AGENT_EXECUTION_ERROR` | 500 | Agent threw during execution |
| `STREAM_ERROR` | (CLI only) | SSE stream failed mid-flight |
| `INTERNAL_ERROR` | 500 | Catch-all server error |

---

## Client libraries

- **`@busara/cli`** — the official CLI. See `packages/cli/README.md`.
- **JavaScript/TypeScript** — use `fetch` directly, or import `@busara/agents` for type definitions.
- **cURL** — see examples above.
- **Python** — planned. For now, use `requests` with the examples above as a template.

---

## Changelog

| Version | Date | Changes |
|---|---|---|
| v7.0 | 2026-01 | Added `/api/v7/agents` (full metadata) |
| v2.0 | 2025-12 | Added `/api/v2/*` (analyze, analyze-stream, trajectory, evolution) with AReaL trajectory protocol |
| v1.0 | 2025-10 | Initial API (`/api/agents`, `/api/analyze`, etc.) |
