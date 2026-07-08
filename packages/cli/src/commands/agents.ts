/**
 * `busara agents` — list and inspect agents
 * ==========================================
 *
 *   busara agents list
 *     → GET /api/v7/agents            (preferred; full metadata)
 *     → fallback: GET /api/v2/analyze (returns { agents: [{id,name,stage,stability}] })
 *     → fallback: GET /api/agents     (legacy v1 endpoint)
 *
 *   busara agents info <id>
 *     → GET /api/v7/agents, then filter locally (single round-trip).
 */

import type { Command } from 'commander';
import { get } from '../lib/client';
import { color, printError, printHeading, printJSON, printKV, printTable, truncate, type Column } from '../lib/output';

interface AgentMetadata {
  id: string;
  name: string;
  description?: string;
  version?: string;
  stage: string;
  stageNumber?: number;
  tier: string;
  stability: string;
  capabilities?: string[];
  tags?: string[];
  category?: string;
  dependencies?: string[];
  timeoutMs?: number;
  maxRetries?: number;
  inputDescription?: string;
  outputDescription?: string;
  configSchema?: { defaults?: Record<string, unknown>; description?: string };
  inputSchema?: { description?: string };
  outputSchema?: { description?: string };
}

interface V7AgentsResponse {
  total: number;
  agents: AgentMetadata[];
  tiers?: Record<string, number>;
  byStage?: Record<string, number>;
  stages?: number;
  version?: string;
}

interface V2AnalyzeListResponse {
  ok: boolean;
  agents: { id: string; name: string; stage: string; stability: string }[];
}

interface LegacyAgentsResponse {
  total: number;
  agents: AgentMetadata[];
  tiers?: Record<string, number>;
  poolSize?: number;
}

const stabilityColor = (s: string): string => {
  switch (s) {
    case 'stable': return color.green(s);
    case 'beta': return color.cyan(s);
    case 'experimental': return color.yellow(s);
    case 'deprecated': return color.red(s);
    default: return s;
  }
};

/** Try the v7 endpoint, then v2, then legacy v1. Returns the agent list + total. */
async function fetchAgents(): Promise<{ agents: AgentMetadata[]; total: number }> {
  // 1. Try v7 (full metadata).
  try {
    const res = await get<V7AgentsResponse>('/api/v7/agents');
    if (res?.agents?.length) {
      return { agents: res.agents, total: res.total ?? res.agents.length };
    }
  } catch {
    // fall through
  }

  // 2. Try v2 analyze list (lightweight).
  try {
    const res = await get<V2AnalyzeListResponse>('/api/v2/analyze');
    if (res?.ok && res.agents?.length) {
      return { agents: res.agents as AgentMetadata[], total: res.agents.length };
    }
  } catch {
    // fall through
  }

  // 3. Try legacy v1 /api/agents.
  try {
    const res = await get<LegacyAgentsResponse>('/api/agents');
    if (res?.agents?.length) {
      return { agents: res.agents, total: res.total ?? res.agents.length };
    }
  } catch {
    // fall through
  }

  throw new Error(
    'Could not fetch agent list from any of /api/v7/agents, /api/v2/analyze, or /api/agents.\n' +
      'Hint: run `busara serve` to start the dev server.',
  );
}

export function registerAgentsCommand(program: Command): void {
  const agents = program.command('agents').description('List and inspect Busara agents');

  agents
    .command('list')
    .description('List all agents (table format)')
    .option('--stage <stage>', 'Filter by stage (ingest, engineer, detect, forecast, infer, cluster, report)')
    .option('--tier <tier>', 'Filter by tier (core, advanced, specialized, ml, stats, experimental)')
    .option('--stability <stability>', 'Filter by stability (stable, beta, experimental, deprecated)')
    .option('--search <q>', 'Search by id, name, or description')
    .action(async (opts) => {
      const globalOpts = program.opts();
      const output = globalOpts.output as string;
      const { agents: all, total } = await fetchAgents();

      let filtered = all;
      if (opts.stage) filtered = filtered.filter((a) => a.stage === opts.stage);
      if (opts.tier) filtered = filtered.filter((a) => a.tier === opts.tier);
      if (opts.stability) filtered = filtered.filter((a) => a.stability === opts.stability);
      if (opts.search) {
        const q = opts.search.toLowerCase();
        filtered = filtered.filter(
          (a) =>
            a.id.toLowerCase().includes(q) ||
            a.name.toLowerCase().includes(q) ||
            (a.description ?? '').toLowerCase().includes(q),
        );
      }

      if (output === 'json') {
        printJSON({ total, filtered: filtered.length, agents: filtered });
        return;
      }

      printHeading(`Busara agents (${filtered.length}/${total})`);

      const columns: Column<AgentMetadata>[] = [
        { header: 'ID', get: (a) => a.id },
        { header: 'Name', get: (a) => a.name },
        { header: 'Stage', get: (a) => a.stage },
        { header: 'Tier', get: (a) => a.tier },
        {
          header: 'Stability',
          get: (a) => a.stability,
          color: (_, v) => stabilityColor(v),
        },
        {
          header: 'Capabilities',
          get: (a) => truncate((a.capabilities ?? []).join(', '), 40),
        },
      ];

      printTable(filtered, columns);
    });

  agents
    .command('info <id>')
    .description('Show details for a single agent')
    .action(async (id: string) => {
      const globalOpts = program.opts();
      const output = globalOpts.output as string;
      const { agents } = await fetchAgents();
      const agent = agents.find((a) => a.id === id);
      if (!agent) {
        printError(`Agent '${id}' not found. Run \`busara agents list\` to see all agents.`);
      }

      if (output === 'json') {
        printJSON(agent);
        return;
      }

      printHeading(`Agent: ${agent.name}`);

      printKV('ID', agent.id);
      printKV('Name', agent.name);
      printKV('Version', agent.version);
      printKV('Stage', `${agent.stage}${agent.stageNumber !== undefined ? ` (${agent.stageNumber})` : ''}`);
      printKV('Tier', agent.tier);
      printKV('Stability', agent.stability);
      printKV('Category', agent.category);
      printKV('Timeout', agent.timeoutMs ? `${agent.timeoutMs}ms` : undefined);
      printKV('Max retries', agent.maxRetries);
      printKV('Dependencies', (agent.dependencies ?? []).join(', ') || undefined);

      printHeading('Description');
      process.stdout.write(`  ${agent.description ?? color.dim('(none)')}\n`);

      if (agent.capabilities?.length) {
        printHeading('Capabilities');
        process.stdout.write(`  ${agent.capabilities.map((c) => color.cyan(c)).join('  ')}\n`);
      }

      if (agent.tags?.length) {
        printHeading('Tags');
        process.stdout.write(`  ${agent.tags.map((t) => color.dim(t)).join('  ')}\n`);
      }

      printHeading('Input');
      printKV('Description', agent.inputDescription, 2);

      printHeading('Output');
      printKV('Description', agent.outputDescription, 2);

      printHeading('Config defaults');
      if (agent.configSchema?.defaults && Object.keys(agent.configSchema.defaults).length > 0) {
        for (const [k, v] of Object.entries(agent.configSchema.defaults)) {
          printKV(k, v, 2);
        }
      } else {
        process.stdout.write(`  ${color.dim('(no defaults)')}\n`);
      }
    });
}
