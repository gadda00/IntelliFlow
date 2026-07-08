/**
 * `busara templates` — list and run agent templates
 * ==================================================
 *
 * Templates are predefined bundles of agents for common workflows. The CLI
 * ships with 8 templates. Running a template POSTs the listed agent IDs to
 * /api/v2/analyze-stream as a single SSE pipeline.
 *
 *   busara templates list
 *   busara templates run <id> --data <file.csv> [--stream]
 *
 * Templates are defined locally in this file (no API endpoint exists yet).
 * They map to real agent IDs from the @busara/agents pool.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Command } from 'commander';
import { post, requestStream } from '../lib/client';
import {
  color,
  formatDuration,
  printError,
  printHeading,
  printInfo,
  printJSON,
  printSuccess,
  printTable,
  type Column,
} from '../lib/output';

export interface Template {
  id: string;
  name: string;
  description: string;
  agentIds: string[];
}

/**
 * The 8 built-in templates. Each is a curated bundle of agents that target a
 * common analysis use-case.
 *
 * These map to the agents that exist in @busara/agents today (3 ingest +
 * 4 engineer + 7 detect = 14 agents). As more stages land (forecast, infer,
 * cluster, report) the templates can be expanded.
 */
export const TEMPLATES: Template[] = [
  {
    id: 'full-pipeline',
    name: 'Full Pipeline',
    description: 'Run every available agent in stage order (ingest → engineer → detect).',
    agentIds: [
      'data_ingestion', 'schema_inference', 'data_profiler',
      'data_cleaner', 'data_transformer', 'data_engineer', 'feature_engineer',
      'analysis_strategist', 'anomaly_sentinel', 'forecasting_oracle',
      'causal_architect', 'knowledge_graph_builder', 'benchmark', 'automl',
    ],
  },
  {
    id: 'quick-profile',
    name: 'Quick Data Profile',
    description: 'Fast read of a dataset — structure, schema, statistics. No transformations.',
    agentIds: ['data_ingestion', 'schema_inference', 'data_profiler'],
  },
  {
    id: 'data-cleaning',
    name: 'Data Cleaning',
    description: 'Detect and fix data quality issues: imputation, transformation, type coercion.',
    agentIds: ['data_ingestion', 'data_cleaner', 'data_transformer', 'data_engineer'],
  },
  {
    id: 'feature-engineering',
    name: 'Feature Engineering',
    description: 'Build new features from existing columns for downstream ML.',
    agentIds: ['data_ingestion', 'schema_inference', 'feature_engineer'],
  },
  {
    id: 'anomaly-detection',
    name: 'Anomaly Detection',
    description: 'Profile the data and flag statistical outliers.',
    agentIds: ['data_ingestion', 'data_profiler', 'anomaly_sentinel'],
  },
  {
    id: 'forecasting',
    name: 'Forecasting',
    description: 'Time-series forecasting via Holt-Winters / FFT decomposition.',
    agentIds: ['data_ingestion', 'schema_inference', 'forecasting_oracle'],
  },
  {
    id: 'causal-analysis',
    name: 'Causal Analysis',
    description: 'Identify causal relationships between variables.',
    agentIds: ['data_ingestion', 'schema_inference', 'causal_architect'],
  },
  {
    id: 'auto-ml',
    name: 'AutoML Benchmark',
    description: 'Run AutoML + Benchmark — model selection and ranking against baselines.',
    agentIds: ['data_ingestion', 'schema_inference', 'feature_engineer', 'automl', 'benchmark'],
  },
];

/** Look up a template by ID (case-insensitive). */
export function getTemplate(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id.toLowerCase() === id.toLowerCase());
}

/** Parse a CSV file into records. Duplicated from analyze.ts to keep commands decoupled. */
function parseCSV(text: string): Record<string, unknown>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const headers = lines[0].split(',').map((h) => h.trim());
  const rows: Record<string, unknown>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(',');
    const row: Record<string, unknown> = {};
    for (let j = 0; j < headers.length; j++) {
      const raw = (cells[j] ?? '').trim();
      if (raw !== '' && !isNaN(Number(raw)) && /^-?\d+(\.\d+)?$/.test(raw)) {
        row[headers[j]] = Number(raw);
      } else if (raw === 'true' || raw === 'false') {
        row[headers[j]] = raw === 'true';
      } else {
        row[headers[j]] = raw;
      }
    }
    rows.push(row);
  }
  return rows;
}

function loadDataframe(filePath: string): Record<string, unknown>[] {
  if (!fs.existsSync(filePath)) {
    printError(`Data file not found: ${filePath}`);
  }
  const ext = path.extname(filePath).toLowerCase();
  const text = fs.readFileSync(filePath, 'utf8');
  switch (ext) {
    case '.csv':
      return parseCSV(text);
    case '.json': {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && Array.isArray((parsed as { data?: unknown[] }).data)) {
        return (parsed as { data: Record<string, unknown>[] }).data;
      }
      printError(`JSON file must be an array or { data: [...] }`);
      break;
    }
    case '.jsonl':
    case '.ndjson':
      return text
        .split(/\r?\n/)
        .filter((l) => l.trim().length > 0)
        .map((l) => JSON.parse(l) as Record<string, unknown>);
    default:
      printError(`Unsupported file extension: ${ext}. Supported: .csv, .json, .jsonl, .ndjson`);
  }
  return [];
}

function handleStreamEvent(event: string, data: unknown): void {
  const d = (data ?? {}) as Record<string, unknown>;
  switch (event) {
    case 'connected':
      printInfo(`Connected — analysisId=${color.cyan(String(d.analysisId ?? ''))}, ${String(d.agentCount ?? '?')} agents queued`);
      break;
    case 'agent_start':
      printInfo(`[${String(d.stepIndex ?? '?')}/${String(d.totalSteps ?? '?')}] ▶ ${color.bold(String(d.agentName ?? ''))} starting…`);
      break;
    case 'agent_complete': {
      const status = String(d.status ?? 'unknown');
      const statusLabel =
        status === 'success' ? color.green('✓') :
        status === 'failed'  ? color.red('✗')   :
        color.yellow('?');
      const duration = typeof d.durationMs === 'number' ? formatDuration(d.durationMs) : '?';
      process.stdout.write(`      ${statusLabel} ${color.dim(String(d.agentName ?? ''))}  ${color.dim(duration)}\n`);
      break;
    }
    case 'complete':
      process.stdout.write('\n');
      printSuccess(
        `Template run complete — ${color.green(String(d.agentsSucceeded ?? 0))} succeeded, ` +
          `${color.red(String(d.agentsFailed ?? 0))} failed in ` +
          `${typeof d.totalDurationMs === 'number' ? formatDuration(d.totalDurationMs) : '?'}`,
      );
      break;
    case 'error':
      printError(`Stream error: ${String((d as { message?: string }).message ?? 'unknown')}`);
      break;
    default:
      process.stdout.write(`${color.gray(event)} ${JSON.stringify(data)}\n`);
  }
}

export function registerTemplatesCommand(program: Command): void {
  const templates = program.command('templates').description('List and run Busara agent templates');

  templates
    .command('list')
    .description('List all available templates')
    .action(() => {
      const globalOpts = program.opts();
      const output = globalOpts.output as string;

      if (output === 'json') {
        printJSON({ total: TEMPLATES.length, templates: TEMPLATES });
        return;
      }

      printHeading(`Busara templates (${TEMPLATES.length})`);

      const columns: Column<Template>[] = [
        { header: 'ID', get: (t) => t.id },
        { header: 'Name', get: (t) => t.name },
        { header: 'Agents', get: (t) => String(t.agentIds.length) },
        { header: 'Description', get: (t) => t.description },
      ];

      printTable(TEMPLATES, columns);
    });

  templates
    .command('run <id>')
    .description('Run all agents in a template against a data file')
    .argument('<id>', 'Template ID (e.g. quick-profile)')
    .requiredOption('-d, --data <file>', 'Path to data file (.csv, .json, .jsonl)')
    .option('--stream', 'Stream SSE events (default: on)')
    .option('--no-stream', 'Wait for all agents to finish, then print the combined result')
    .action(async (id: string, opts: { data: string; stream: boolean }) => {
      const globalOpts = program.opts();
      const output = globalOpts.output as string;

      const template = getTemplate(id);
      if (!template) {
        printError(
          `Template '${id}' not found. Run \`busara templates list\` to see all templates.`,
        );
      }

      const dataframe = loadDataframe(opts.data);
      if (dataframe.length === 0) {
        printError(`Data file '${opts.data}' contains no rows.`);
      }

      printInfo(
        `Running template ${color.bold(template.name)} (${color.cyan(String(template.agentIds.length))} agents) ` +
          `on ${color.dim(opts.data)} (${dataframe.length} rows)…`,
      );

      if (opts.stream) {
        if (output === 'json') {
          await requestStream(
            '/api/v2/analyze-stream',
            { agentIds: template.agentIds, dataframe, config: {} },
            (_event, data) => process.stdout.write(JSON.stringify(data) + '\n'),
            { config: globalOpts },
          );
        } else {
          await requestStream(
            '/api/v2/analyze-stream',
            { agentIds: template.agentIds, dataframe, config: {} },
            handleStreamEvent,
            { config: globalOpts },
          );
        }
        return;
      }

      // Non-streaming — call /api/v2/analyze once per agent and collect results.
      printInfo('Streaming disabled — running agents sequentially...');
      const results: { agentId: string; ok: boolean; durationMs?: number; error?: string }[] = [];
      for (const agentId of template.agentIds) {
        try {
          const res = await post<{ ok: boolean; result?: { status?: string; executionTimeMs?: number; error?: string } }>(
            '/api/v2/analyze',
            { agentId, dataframe, config: {} },
            { config: globalOpts },
          );
          results.push({
            agentId,
            ok: res.ok && res.result?.status !== 'failed',
            durationMs: res.result?.executionTimeMs,
            error: res.result?.error,
          });
          const status = res.ok ? color.green('✓') : color.red('✗');
          process.stdout.write(`  ${status} ${color.dim(agentId)}\n`);
        } catch (err) {
          results.push({
            agentId,
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          });
          process.stdout.write(`  ${color.red('✗')} ${color.dim(agentId)} — ${color.red(err instanceof Error ? err.message : String(err))}\n`);
        }
      }

      if (output === 'json') {
        printJSON({ template: template.id, results });
        return;
      }

      printHeading('Template run summary');
      const succeeded = results.filter((r) => r.ok).length;
      const failed = results.length - succeeded;
      printSuccess(`${succeeded}/${results.length} agents succeeded, ${failed} failed.`);
    });
}
