/**
 * `busara analyze` — run a single agent against a data file
 * ==========================================================
 *
 *   busara analyze <agent-id> --data <file.csv> [--config '{"sensitivity":"high"}']
 *     → POST /api/v2/analyze { agentId, dataframe, config }
 *
 *   busara analyze <agent-id> --data <file.csv> --stream
 *     → POST /api/v2/analyze-stream { agentIds:[agentId], dataframe, config }
 *       (Server-Sent Events)
 *
 * Supported data file formats:
 *   - .csv  — comma-separated, first row is headers
 *   - .json — array of objects OR { "data": [...] }
 *   - .jsonl / .ndjson — newline-delimited JSON objects
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
  printKV,
  printSuccess,
  printWarn,
} from '../lib/output';

interface AnalyzeResponse {
  ok: boolean;
  analysisId?: string;
  trajectoryId?: string;
  result?: {
    status: string;
    output?: unknown;
    metrics?: Record<string, unknown>;
    executionTimeMs?: number;
    error?: string;
  };
  error?: { code: string; message: string };
}

/** Parse a CSV file into an array of records, using the first row as headers. */
function parseCSV(text: string): Record<string, unknown>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  // Naive CSV parser — does not handle quoted commas. For production, swap in
  // a real CSV parser (papaparse, csv-parse). Sufficient for CLI testing.
  const headers = lines[0].split(',').map((h) => h.trim());
  const rows: Record<string, unknown>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(',');
    const row: Record<string, unknown> = {};
    for (let j = 0; j < headers.length; j++) {
      const raw = (cells[j] ?? '').trim();
      // Coerce numeric strings to numbers; leave the rest as strings.
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

/** Load a dataframe from a .csv / .json / .jsonl file. */
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
      printError(`JSON file must be an array or { data: [...] }, got: ${typeof parsed}`);
      break;
    }
    case '.jsonl':
    case '.ndjson': {
      return text
        .split(/\r?\n/)
        .filter((l) => l.trim().length > 0)
        .map((l) => JSON.parse(l) as Record<string, unknown>);
    }
    default:
      printError(`Unsupported file extension: ${ext}. Supported: .csv, .json, .jsonl, .ndjson`);
  }
  return []; // unreachable
}

/** Parse a --config string that may be inline JSON or a path to a JSON file. */
function parseConfig(configStr: string | undefined): Record<string, unknown> {
  if (!configStr) return {};
  try {
    return JSON.parse(configStr);
  } catch {
    // Maybe it's a path to a JSON file.
    if (fs.existsSync(configStr)) {
      try {
        return JSON.parse(fs.readFileSync(configStr, 'utf8'));
      } catch (err) {
        printError(
          `Could not parse config file '${configStr}': ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    printError(
      `Could not parse --config value. Pass inline JSON (e.g. '{"sensitivity":"high"}') or a path to a .json file.`,
    );
  }
  return {}; // unreachable
}

/** Stream handler — pretty-prints each SSE event. */
function handleStreamEvent(event: string, data: unknown): void {
  const d = (data ?? {}) as Record<string, unknown>;
  switch (event) {
    case 'connected':
      printInfo(`Connected — analysisId=${color.cyan(String(d.analysisId ?? ''))}, ${String(d.agentCount ?? '?')} agents queued`);
      break;
    case 'agent_start':
      printInfo(
        `[${String(d.stepIndex ?? '?')}/${String(d.totalSteps ?? '?')}] ▶ ${color.bold(String(d.agentName ?? ''))} (${color.dim(String(d.agentId ?? ''))}) starting…`,
      );
      break;
    case 'agent_complete': {
      const status = String(d.status ?? 'unknown');
      const statusLabel =
        status === 'success' ? color.green('✓ success') :
        status === 'failed'  ? color.red('✗ failed')   :
        color.yellow(status);
      const duration = typeof d.durationMs === 'number' ? formatDuration(d.durationMs) : '?';
      process.stdout.write(
        `      ${statusLabel}  ${color.dim(duration)}` +
          (d.trajectoryId ? `  traj=${color.dim(String(d.trajectoryId))}` : '') +
          (d.error ? `\n      ${color.red(String(d.error))}` : '') +
          '\n',
      );
      break;
    }
    case 'complete':
      process.stdout.write('\n');
      printSuccess(
        `Analysis complete — ${color.green(String(d.agentsSucceeded ?? 0))} succeeded, ` +
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

export function registerAnalyzeCommand(program: Command): void {
  program
    .command('analyze')
    .description('Run a single agent against a data file and print the result')
    .argument('<agent-id>', 'Agent ID (e.g. data_ingestion, anomaly_sentinel)')
    .requiredOption('-d, --data <file>', 'Path to data file (.csv, .json, .jsonl)')
    .option('-c, --config <json>', 'Inline JSON config OR path to a .json config file', undefined)
    .option('--stream', 'Stream SSE events from /api/v2/analyze-stream instead of a single POST')
    .action(async (agentId: string, opts: { data: string; config?: string; stream?: boolean }) => {
      const globalOpts = program.opts();
      const output = globalOpts.output as string;

      const dataframe = loadDataframe(opts.data);
      if (dataframe.length === 0) {
        printError(`Data file '${opts.data}' contains no rows.`);
      }
      const config = parseConfig(opts.config);

      printInfo(
        `Loaded ${color.cyan(String(dataframe.length))} rows from ${color.dim(opts.data)} — ` +
          `running agent ${color.bold(agentId)}…`,
      );

      if (opts.stream) {
        if (output === 'json') {
          // Even in JSON mode, the SSE stream is human-readable. We just pass
          // through each event as a JSON line.
          await requestStream(
            '/api/v2/analyze-stream',
            { agentIds: [agentId], dataframe, config },
            (_event, data) => process.stdout.write(JSON.stringify(data) + '\n'),
            { config: globalOpts },
          );
        } else {
          await requestStream(
            '/api/v2/analyze-stream',
            { agentIds: [agentId], dataframe, config },
            handleStreamEvent,
            { config: globalOpts },
          );
        }
        return;
      }

      // Non-streaming: single POST to /api/v2/analyze.
      const res = await post<AnalyzeResponse>('/api/v2/analyze', { agentId, dataframe, config }, { config: globalOpts });

      if (output === 'json') {
        printJSON(res);
        return;
      }

      printHeading(`Analysis result — ${agentId}`);
      printKV('Analysis ID', res.analysisId);
      printKV('Trajectory ID', res.trajectoryId);
      printKV('Status', res.result?.status);

      if (res.result?.executionTimeMs !== undefined) {
        printKV('Duration', formatDuration(res.result.executionTimeMs));
      }

      if (res.result?.metrics && Object.keys(res.result.metrics).length > 0) {
        printHeading('Metrics');
        for (const [k, v] of Object.entries(res.result.metrics)) {
          printKV(k, v, 2);
        }
      }

      if (res.result?.output !== undefined) {
        printHeading('Output');
        process.stdout.write(JSON.stringify(res.result.output, null, 2) + '\n');
      }

      if (res.result?.error) {
        printWarn(res.result.error);
      }

      if (res.result?.status === 'success') {
        printSuccess('Agent completed successfully.');
      } else {
        printWarn(`Agent finished with status: ${res.result?.status ?? 'unknown'}`);
      }
    });
}
