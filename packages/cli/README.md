# @busara/cli

The official command-line interface for the [Busara](https://busara.ai) multi-agent data intelligence platform. Run agents from the terminal, manage templates, inspect trajectories, approve evolution actions, and scaffold new projects — without leaving your shell.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue)](LICENSE)
[![Node: 18+](https://img.shields.io/badge/Node.js-18%2B-339933)](https://nodejs.org)

---

## Install

In the monorepo:

```bash
pnpm install
pnpm --filter @busara/cli build
pnpm --filter @busara/cli link --global   # makes `busara` available on $PATH
```

Or, once published:

```bash
npm install -g @busara/cli
```

## Quick start

```bash
# 1. Point the CLI at your running Busara instance
busara config set apiUrl http://localhost:3000
busara config set apiKey ifl_xxxxxxxxxxxxxxxx   # optional, only if your instance requires auth

# 2. Start the dev server
busara serve --port 3000

# 3. In another terminal, explore
busara agents list
busara agents info data_ingestion
busara templates list

# 4. Run an agent on a CSV file
busara analyze data_ingestion --data sample.csv

# 5. Stream events as the agent runs
busara analyze data_ingestion --data sample.csv --stream

# 6. Run a whole template
busara templates run quick-profile --data sample.csv --stream

# 7. Inspect what happened
busara trajectory list
busara trajectory show <trajectory-id>

# 8. Approve an evolution suggestion
busara evolution list
busara evolution approve <agent-id> --index 0
```

## Commands

### `busara agents`

List and inspect the 33 Busara agents.

```bash
busara agents list                              # table view
busara agents list --stage detect --tier core   # filtered
busara agents list --search anomaly             # full-text search
busara agents info data_ingestion               # full details + schemas
```

### `busara analyze`

Run a single agent against a data file.

```bash
busara analyze <agent-id> --data <file.csv>
busara analyze <agent-id> --data <file.csv> --config '{"sampleSize":10}'
busara analyze <agent-id> --data <file.csv> --config ./config.json
busara analyze <agent-id> --data <file.csv> --stream
```

Supported file formats: `.csv`, `.json` (array or `{ data: [...] }`), `.jsonl` / `.ndjson`.

### `busara templates`

Predefined bundles of agents for common workflows.

```bash
busara templates list
busara templates run <id> --data <file.csv>            # sequential, prints summary
busara templates run <id> --data <file.csv> --stream   # SSE stream (default)
busara templates run <id> --data <file.csv> --no-stream
```

Built-in templates (8):

| ID | Name | Agents |
|---|---|---|
| `full-pipeline` | Full Pipeline | All 14 implemented agents |
| `quick-profile` | Quick Data Profile | data_ingestion, schema_inference, data_profiler |
| `data-cleaning` | Data Cleaning | data_ingestion, data_cleaner, data_transformer, data_engineer |
| `feature-engineering` | Feature Engineering | data_ingestion, schema_inference, feature_engineer |
| `anomaly-detection` | Anomaly Detection | data_ingestion, data_profiler, anomaly_sentinel |
| `forecasting` | Forecasting | data_ingestion, schema_inference, forecasting_oracle |
| `causal-analysis` | Causal Analysis | data_ingestion, schema_inference, causal_architect |
| `auto-ml` | AutoML Benchmark | data_ingestion, schema_inference, feature_engineer, automl, benchmark |

### `busara trajectory`

Inspect agent execution trajectories (the AReaL Pillar 1 records).

```bash
busara trajectory list                           # recent trajectories
busara trajectory list --agent data_ingestion --status success --limit 50
busara trajectory show <id>                      # steps + rewards + metrics
busara trajectory reward <id> --type explicit --source user_thumbs_up --value 1
busara trajectory stats <agent-id>               # aggregate stats per agent
```

### `busara evolution`

Human-in-the-loop interface for the Evolution Control Plane (AReaL Pillar 3).

```bash
busara evolution list                            # pending suggestions
busara evolution list --agent data_ingestion
busara evolution approve <agent-id> --index 0
busara evolution reject  <agent-id> --index 1
```

### `busara serve`

Start the Busara dev server. Walks up from the current directory looking for a `package.json` with a `dev` script, then runs `pnpm dev` with the requested port.

```bash
busara serve
busara serve --port 4000
busara serve --filter @busara/web   # turbo filter
```

### `busara init`

Scaffold a new Busara project.

```bash
busara init my-analysis
cd my-analysis
pnpm install
busara serve --port 3000
busara analyze data_ingestion --data sample.csv
```

The scaffolded project includes:
- `package.json` pre-wired to `@busara/agents`, `@busara/core`, and `@busara/cli`
- `busara.config.json` (CLI config)
- `.env.example` (copy to `.env`)
- `agents.config.ts` (placeholder for custom agent registration)
- `sample.csv` (small fixture so you can run `busara analyze` immediately)
- `tsconfig.json`

### `busara config`

Read and write the user-level config at `~/.busara/config.json`.

```bash
busara config list
busara config get apiUrl
busara config set apiUrl http://localhost:3000
busara config set apiKey ifl_xxxxxxxxxxxxxxxx
busara config set output json    # or "table"
```

## Global flags

| Flag | Description |
|---|---|
| `--api-url <url>` | Override `apiUrl` from config (or `BUSARA_API_URL` env var) |
| `--api-key <key>` | Override `apiKey` from config (or `BUSARA_API_KEY` env var) |
| `--output <format>` | `table` (default) or `json` |
| `-v, --version` | Print CLI version |
| `-h, --help` | Show help |

## Environment variables

| Variable | Equivalent flag |
|---|---|
| `BUSARA_API_URL` | `--api-url` |
| `BUSARA_API_KEY` | `--api-key` |
| `BUSARA_OUTPUT` | `--output` |

## Configuration resolution

For `apiUrl` and `apiKey`, the CLI checks (in order):

1. CLI flag (`--api-url`, `--api-key`)
2. Environment variable (`BUSARA_API_URL`, `BUSARA_API_KEY`)
3. `~/.busara/config.json`
4. Built-in default (`http://localhost:3000`, no key)

## Output formats

Every command supports both `table` (default, human-readable with colors) and `json` (machine-readable, no colors). Use `--output json` or `busara config set output json` to switch.

## API endpoints used

| Command | Endpoint |
|---|---|
| `agents list` | `GET /api/v7/agents` (fallback: `/api/v2/analyze`, `/api/agents`) |
| `agents info <id>` | `GET /api/v7/agents` (filtered locally) |
| `analyze` (no stream) | `POST /api/v2/analyze` |
| `analyze --stream` / `templates run --stream` | `POST /api/v2/analyze-stream` (SSE) |
| `trajectory list` | `GET /api/v2/trajectory` |
| `trajectory show <id>` | `GET /api/v2/trajectory/<id>` |
| `trajectory reward <id>` | `POST /api/v2/trajectory/<id>/reward` |
| `trajectory stats <agent-id>` | `GET /api/v2/trajectory/agent/<agentId>/stats` |
| `evolution list` | `GET /api/v2/evolution` |
| `evolution approve / reject` | `POST /api/v2/evolution` |

See `docs/API_REFERENCE.md` in the monorepo for the full HTTP API.

## Development

```bash
pnpm --filter @busara/cli build        # compile to dist/
pnpm --filter @busara/cli typecheck    # tsc --noEmit
pnpm --filter @busara/cli dev          # watch mode
```

The CLI is intentionally dependency-light: only [`commander`](https://github.com/tj/commander.js) for argument parsing. Everything else (HTTP, SSE, file IO, ANSI colors) is implemented with Node built-ins.

## License

MIT
