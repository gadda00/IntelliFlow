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
  - [`GET /api/v2/agents/:agentId`](#get-apiv2agentsagentid)
  - [`PATCH /api/v2/agents/:agentId`](#patch-apiv2agentsagentid)
- [Analysis](#analysis)
  - [`POST /api/v2/analyze`](#post-apiv2analyze)
  - [`POST /api/v2/analyze-stream`](#post-apiv2analyze-stream)
- [Trajectory](#trajectory)
  - [`GET /api/v2/trajectory`](#get-apiv2trajectory)
  - [`GET /api/v2/trajectory/:id`](#get-apiv2trajectoryid)
  - [`DELETE /api/v2/trajectory/:id`](#delete-apiv2trajectoryid)
  - [`POST /api/v2/trajectory/:id/reward`](#post-apiv2trajectoryidreward)
  - [`GET /api/v2/trajectory/agent/:agentId/stats`](#get-apiv2trajectoryagentagentidstats)
  - [`POST /api/v2/trajectory/export`](#post-apiv2trajectoryexport)
- [Evolution](#evolution)
  - [`GET /api/v2/evolution`](#get-apiv2evolution)
  - [`POST /api/v2/evolution`](#post-apiv2evolution)
- [System](#system)
  - [`GET /api/v2/system`](#get-apiv2system)
  - [`GET /api/health`](#get-apihealth)
- [Admin](#admin)
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

### `GET /api/v2/agents/:agentId`

Get the full metadata for a single agent, plus its live trajectory stats
and any admin override (stability / enabled / config defaults).

**Auth:** Optional. **Rate limited:** No.

**Request:**

```http
GET /api/v2/agents/data_ingestion
```

**Path parameters:**

| Param | Type | Description |
|---|---|---|
| `agentId` | string | The agent's ID (e.g. `data_ingestion`) |

**Response (200):**

```json
{
  "ok": true,
  "data": {
    "id": "data_ingestion",
    "name": "Data Ingestion",
    "role": "Parse and validate incoming data",
    "tier": "core",
    "stage": "ingest",
    "stageNumber": 0,
    "description": "Validates the uploaded dataset, checks for structural integrity, and prepares it for downstream analysis.",
    "capabilities": ["data_validation", "structure_check", "format_detection"],
    "dependencies": [],
    "icon": "FileInput",
    "color": "#10b981",
    "timeoutMs": 15000,
    "stability": "stable",
    "enabled": true,
    "configDefaults": {},
    "overrideUpdatedAt": "2026-01-20T11:42:13.000Z",
    "stats": {
      "agentId": "data_ingestion",
      "totalTrajectories": 142,
      "successCount": 138,
      "failureCount": 3,
      "successRate": 0.97,
      "averageDurationMs": 18,
      "averageReward": 0.62,
      "totalTokens": 0,
      "totalCost": 0,
      "uniqueDataframeCount": 12,
      "rewardDistribution": { "positive": 88, "neutral": 50, "negative": 4 },
      "recentTrend": [
        { "date": "2026-01-14", "successRate": 1.0, "averageReward": 0.7, "count": 12 },
        { "date": "2026-01-15", "successRate": 0.9, "averageReward": 0.6, "count": 10 }
      ]
    }
  }
}
```

**Errors:**

| Status | Code | Cause |
|---|---|---|
| 404 | `AGENT_NOT_FOUND` | `agentId` is not registered |

---

### `PATCH /api/v2/agents/:agentId`

Update admin-controlled fields on an agent: stability tier, enabled
state, or config-defaults overrides. Used by the admin console
(`/admin/agents/[agentId]`).

**Auth:** Required in production (admin role). Optional in dev. **Rate
limited:** Yes — admin endpoints, 60 req/min.

**Request:**

```http
PATCH /api/v2/agents/data_ingestion
Authorization: Bearer ifl_admin_…
Content-Type: application/json

{
  "stability": "stable",
  "enabled": true,
  "configDefaults": { "sampleSize": 10 },
  "updatedBy": "admin-console"
}
```

**Body schema (Zod):**

```typescript
z.object({
  stability: z.enum(['experimental', 'beta', 'stable', 'deprecated']).optional(),
  enabled: z.boolean().optional(),
  configDefaults: z.record(z.string(), z.unknown()).optional(),
  updatedBy: z.string().optional(),
})
```

At least one of `stability`, `enabled`, or `configDefaults` must be
supplied. `configDefaults` is merged into the existing override (not a
replacement) — pass only the keys you want to change.

**Response (200):**

```json
{
  "ok": true,
  "data": {
    "agentId": "data_ingestion",
    "stability": "stable",
    "enabled": true,
    "configDefaults": { "sampleSize": 10 },
    "updatedAt": "2026-01-20T11:42:13.000Z",
    "updatedBy": "admin-console"
  }
}
```

**Errors:**

| Status | Code | Cause |
|---|---|---|
| 400 | `BAD_JSON` | Request body is not valid JSON |
| 400 | `VALIDATION_ERROR` | Body failed Zod validation |
| 404 | `AGENT_NOT_FOUND` | `agentId` is not registered |

> **Persistence:** The override is stored in an in-process map (per
> server instance). In production, this should be backed by a Prisma
> `AgentOverride` model so the override survives restarts and is shared
> across instances. The API surface is stable; only the storage layer
> changes.

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

### `DELETE /api/v2/trajectory/:id`

Delete a single trajectory. Used by the admin console to satisfy GDPR
right-to-be-forgotten requests and to prune the in-memory store.

**Auth:** Required in production (admin role). **Rate limited:** Yes —
admin endpoints, 60 req/min.

**Request:**

```http
DELETE /api/v2/trajectory/traj_abc123
Authorization: Bearer ifl_admin_…
```

**Response (200):**

```json
{
  "ok": true,
  "data": { "id": "traj_abc123", "deleted": true }
}
```

**Errors:**

| Status | Code | Cause |
|---|---|---|
| 404 | `NOT_FOUND` | Trajectory ID does not exist |

> **GDPR note:** Deletion is permanent. The trajectory is removed from
> the store entirely — steps, rewards, context snapshot, metrics.
> Aggregated stats (e.g. `getAgentStats`) are recomputed on the next
> call. If you need to keep an audit trail of *which* trajectories were
> deleted and when, log the deletion in a separate `AuditLog` table
> before calling `DELETE`.

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

### `POST /api/v2/trajectory/export`

Export a filtered, scrubbed, deduplicated dataset of trajectories via
the AReaL DataProxy (Pillar 2). Used by the admin console to ship
learning datasets to fine-tuning pipelines, external benchmark tools,
or research collaborators.

**Auth:** Required in production (admin role). **Rate limited:** Yes —
admin endpoints, 60 req/min.

**Request:**

```http
POST /api/v2/trajectory/export
Authorization: Bearer ifl_admin_…
Content-Type: application/json

{
  "agentIds": ["data_ingestion", "schema_inference"],
  "scrubPII": true,
  "deduplicate": true,
  "maxPerAgent": 1000,
  "requireRewards": false,
  "minQualityScore": 0.4,
  "purpose": "q1-fine-tuning-run",
  "exportedBy": "admin-console"
}
```

**Body schema (Zod):**

```typescript
z.object({
  agentIds: z.array(z.string()).optional(),              // restrict to a set of agents
  minSuccessRate: z.number().min(0).max(1).optional(),   // drop agents below this rate
  minQualityScore: z.number().min(0).max(1).optional(),  // drop trajectories below this score
  scrubPII: z.boolean().optional(),                      // default true
  deduplicate: z.boolean().optional(),                   // default true
  maxPerAgent: z.number().int().positive().max(10_000).optional(),
  requireRewards: z.boolean().optional(),                // default false
  startDate: z.string().optional(),                      // ISO
  endDate: z.string().optional(),                        // ISO
  purpose: z.string().min(1).default('admin-export'),
  exportedBy: z.string().min(1).default('admin-console'),
})
```

**Response (200):**

```json
{
  "ok": true,
  "data": {
    "id": "dataset_1737849000123_a1b2c3",
    "createdAt": "2026-01-25T22:30:00.123Z",
    "config": {
      "scrubPII": true,
      "deduplicate": true,
      "maxPerAgent": 1000,
      "requireRewards": false,
      "minQualityScore": 0.4
    },
    "trajectories": [ /* Trajectory[] */ ],
    "stats": {
      "totalTrajectories": 1842,
      "uniqueAgents": 2,
      "uniqueDataframes": 47,
      "totalSteps": 9210,
      "totalTokens": 0,
      "averageQuality": 0.71,
      "averageReward": 0.58,
      "dateRange": { "start": "2026-01-01", "end": "2026-01-25" }
    },
    "audit": {
      "exportedBy": "admin-console",
      "exportedAt": "2026-01-25T22:30:00.123Z",
      "purpose": "q1-fine-tuning-run",
      "trajectoryCount": 1842,
      "agentIds": ["data_ingestion", "schema_inference"]
    }
  }
}
```

If `agentIds` is supplied, the response is `data: ExportedDataset[]`
(one dataset per agent).

**Errors:**

| Status | Code | Cause |
|---|---|---|
| 400 | `BAD_JSON` | Request body is not valid JSON |
| 400 | `VALIDATION_ERROR` | Body failed Zod validation |
| 500 | `EXPORT_ERROR` | DataProxy threw (e.g. store unavailable) |

> **PII scrubbing:** Every string field in every step (observation,
> action, result, LLM prompts, tool I/O) is passed through the PII
> regex set — emails, phones, SSNs, credit cards, IPs, API keys — and
> replaced with `[EMAIL]`, `[PHONE]`, etc. The scrub report is included
> in each trajectory's metadata. **Never** disable `scrubPII` for
> exports that leave the production VPC.

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
