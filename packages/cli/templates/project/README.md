# {{PROJECT_DISPLAY_NAME}}

A Busara multi-agent data analysis project. 33 AI agents run a 7-stage
pipeline (Ingest → Engineer → Detect → Forecast → Infer → Cluster → Report)
and learn from every execution via the trajectory-based self-evolution system.

## Quick start

```bash
pnpm install

# Start the dev server (Next.js app at http://localhost:3000)
busara serve --port 3000

# In another terminal, list the 33 agents
busara agents list

# Run the data_ingestion agent on the sample CSV
busara analyze data_ingestion --data sample.csv

# Or run a full template (all ingest + engineer + detect agents)
busara templates run full-pipeline --data sample.csv --stream
```

## Project layout

```
.
├── package.json
├── busara.config.json   # CLI config (apiUrl, output format)
├── agents.config.ts     # Custom agent registration (optional)
├── sample.csv           # Tiny fixture so you can `busara analyze` right away
└── .env.example         # Copy to .env and fill in secrets
```

## Useful commands

| Command | Description |
|---|---|
| `busara agents list` | List all 33 agents |
| `busara agents info <id>` | Show details for one agent |
| `busara analyze <id> --data file.csv` | Run one agent |
| `busara analyze <id> --data file.csv --stream` | Stream events as the agent runs |
| `busara templates list` | List the 8 built-in templates |
| `busara templates run <id> --data file.csv` | Run a whole template |
| `busara trajectory list` | List recent trajectories |
| `busara trajectory show <id>` | Show one trajectory in detail |
| `busara evolution list` | List pending evolution actions |
| `busara evolution approve <agent> --index <n>` | Approve an evolution action |
| `busara config set apiUrl <url>` | Point the CLI at a different host |

See `busara --help` for the full list.
