/**
 * `busara trajectory` — list and inspect agent trajectories
 * ==========================================================
 *
 *   busara trajectory list [--agent <id>] [--status <status>] [--limit 20]
 *     → GET /api/v2/trajectory?agentId=...&status=...&limit=...
 *
 *   busara trajectory show <id>
 *     → GET /api/v2/trajectory/<id>
 *
 *   busara trajectory reward <id> --type explicit --source user_thumbs_up --value 1
 *     → POST /api/v2/trajectory/<id>/reward
 *
 *   busara trajectory stats <agent-id>
 *     → GET /api/v2/trajectory/agent/<agentId>/stats
 */

import type { Command } from 'commander';
import { get, post } from '../lib/client';
import {
  color,
  formatDuration,
  printError,
  printHeading,
  printInfo,
  printJSON,
  printKV,
  printSuccess,
  printTable,
  type Column,
} from '../lib/output';

interface TrajectoryListItem {
  id: string;
  analysisId: string;
  agentId: string;
  agentVersion?: string;
  status: 'running' | 'success' | 'failed' | 'cancelled' | 'timeout';
  startedAt: string;
  completedAt?: string;
  metrics?: Record<string, unknown>;
  rewards?: unknown[];
}

interface TrajectoryListResponse {
  ok: boolean;
  data?: TrajectoryListItem[];
  total?: number;
  limit?: number;
  offset?: number;
}

interface TrajectoryDetail extends TrajectoryListItem {
  agentStability: string;
  userId?: string;
  workspaceId?: string;
  organizationId?: string;
  steps: unknown[];
  contextSnapshot?: unknown;
  metadata?: unknown;
}

interface TrajectoryStats {
  totalTrajectories?: number;
  successRate?: number;
  averageReward?: number;
  averageDurationMs?: number;
  failureRate?: number;
  byStatus?: Record<string, number>;
}

const statusColor = (s: string): string => {
  switch (s) {
    case 'success': return color.green(s);
    case 'failed':  return color.red(s);
    case 'running': return color.cyan(s);
    case 'timeout': return color.yellow(s);
    case 'cancelled': return color.gray(s);
    default: return s;
  }
};

export function registerTrajectoryCommand(program: Command): void {
  const trajectory = program.command('trajectory').description('List and inspect agent trajectories');

  trajectory
    .command('list')
    .description('List recent trajectories')
    .option('--agent <id>', 'Filter by agent ID')
    .option('--status <status>', 'Filter by status (running, success, failed, cancelled, timeout)')
    .option('--limit <n>', 'Maximum number of trajectories to return', '20')
    .option('--offset <n>', 'Pagination offset', '0')
    .action(async (opts: { agent?: string; status?: string; limit: string; offset: string }) => {
      const globalOpts = program.opts();
      const output = globalOpts.output as string;

      const res = await get<TrajectoryListResponse>('/api/v2/trajectory', {
        config: globalOpts,
        query: {
          agentId: opts.agent,
          status: opts.status,
          limit: Number(opts.limit),
          offset: Number(opts.offset),
        },
      });

      const items = res.data ?? [];

      if (output === 'json') {
        printJSON(res);
        return;
      }

      printHeading(`Trajectories (${items.length}${res.total ? ` of ${res.total}` : ''})`);

      const columns: Column<TrajectoryListItem>[] = [
        { header: 'ID', get: (t) => t.id.slice(0, 12) },
        { header: 'Agent', get: (t) => t.agentId },
        { header: 'Status', get: (t) => t.status, color: (_, v) => statusColor(v) },
        { header: 'Started', get: (t) => new Date(t.startedAt).toLocaleString() },
        {
          header: 'Duration',
          get: (t) => {
            if (!t.completedAt) return '—';
            const ms = new Date(t.completedAt).getTime() - new Date(t.startedAt).getTime();
            return formatDuration(ms);
          },
        },
        { header: 'Rewards', get: (t) => String((t.rewards ?? []).length) },
      ];

      printTable(items, columns);
    });

  trajectory
    .command('show <id>')
    .description('Show details for a single trajectory')
    .action(async (id: string) => {
      const globalOpts = program.opts();
      const output = globalOpts.output as string;

      const res = await get<{ ok: boolean; data?: TrajectoryDetail }>(
        `/api/v2/trajectory/${id}`,
        { config: globalOpts },
      );

      const traj = res.data;
      if (!traj) {
        printError('Trajectory not found.');
      }

      if (output === 'json') {
        printJSON(traj);
        return;
      }

      printHeading(`Trajectory: ${traj.id}`);

      printKV('Analysis ID', traj.analysisId);
      printKV('Agent', traj.agentId);
      printKV('Agent version', traj.agentVersion);
      printKV('Agent stability', traj.agentStability);
      printKV('Status', statusColor(traj.status));
      printKV('Started', new Date(traj.startedAt).toLocaleString());
      printKV('Completed', traj.completedAt ? new Date(traj.completedAt).toLocaleString() : undefined);
      if (traj.completedAt) {
        const ms = new Date(traj.completedAt).getTime() - new Date(traj.startedAt).getTime();
        printKV('Duration', formatDuration(ms));
      }
      printKV('User', traj.userId);
      printKV('Workspace', traj.workspaceId);
      printKV('Org', traj.organizationId);

      if (traj.steps && Array.isArray(traj.steps) && traj.steps.length > 0) {
        printHeading(`Steps (${traj.steps.length})`);
        for (let i = 0; i < traj.steps.length; i++) {
          const step = traj.steps[i] as Record<string, unknown>;
          process.stdout.write(
            `  ${color.cyan(`#${i}`)}  ${color.bold(String(step.name ?? step.action ?? 'step'))}  ` +
              color.dim(step.startedAt ? new Date(String(step.startedAt)).toISOString() : '') + '\n',
          );
        }
      }

      if (traj.rewards && Array.isArray(traj.rewards) && traj.rewards.length > 0) {
        printHeading(`Rewards (${traj.rewards.length})`);
        for (const r of traj.rewards) {
          const reward = r as Record<string, unknown>;
          process.stdout.write(
            `  ${color.green(String(reward.value ?? '?'))}  ${color.dim(String(reward.source ?? reward.type ?? ''))}  ` +
              color.gray(String(reward.timestamp ?? '')) + '\n',
          );
        }
      }

      if (traj.metrics && Object.keys(traj.metrics as object).length > 0) {
        printHeading('Metrics');
        for (const [k, v] of Object.entries(traj.metrics as Record<string, unknown>)) {
          printKV(k, v, 2);
        }
      }
    });

  trajectory
    .command('reward <id>')
    .description('Attach a reward signal to a trajectory (closes the RL feedback loop)')
    .argument('<id>', 'Trajectory ID')
    .requiredOption('--type <type>', 'Reward type: explicit | implicit | automated')
    .requiredOption('--source <source>', 'Reward source (e.g. user_thumbs_up, user_thumbs_down, quality_score)')
    .requiredOption('--value <n>', 'Reward value between -1 and 1')
    .option('--text <text>', 'Optional comment / reason text')
    .action(
      async (
        id: string,
        opts: { type: string; source: string; value: string; text?: string },
      ) => {
        const globalOpts = program.opts();
        const output = globalOpts.output as string;

        const value = Number(opts.value);
        if (Number.isNaN(value) || value < -1 || value > 1) {
          printError(`--value must be a number between -1 and 1, got: ${opts.value}`);
        }

        const res = await post(
          `/api/v2/trajectory/${id}/reward`,
          {
            type: opts.type,
            source: opts.source,
            value,
            text: opts.text,
          },
          { config: globalOpts },
        );

        if (output === 'json') {
          printJSON(res);
          return;
        }
        printSuccess(`Reward attached to trajectory ${color.cyan(id)}: ${color.green(String(value))} (${opts.source})`);
      },
    );

  trajectory
    .command('stats <agent-id>')
    .description('Show aggregate trajectory statistics for an agent')
    .action(async (agentId: string) => {
      const globalOpts = program.opts();
      const output = globalOpts.output as string;

      const res = await get<{ ok: boolean; data?: TrajectoryStats }>(
        `/api/v2/trajectory/agent/${agentId}/stats`,
        { config: globalOpts },
      );

      const stats = res.data ?? {};

      if (output === 'json') {
        printJSON(res);
        return;
      }

      printHeading(`Trajectory stats — ${agentId}`);
      printKV('Total trajectories', stats.totalTrajectories ?? 0);
      printKV('Success rate', stats.successRate !== undefined ? `${(stats.successRate * 100).toFixed(1)}%` : undefined);
      printKV('Failure rate', stats.failureRate !== undefined ? `${(stats.failureRate * 100).toFixed(1)}%` : undefined);
      printKV('Average reward', stats.averageReward?.toFixed(3));
      printKV('Average duration', stats.averageDurationMs !== undefined ? formatDuration(stats.averageDurationMs) : undefined);

      if (stats.byStatus && Object.keys(stats.byStatus).length > 0) {
        printHeading('By status');
        for (const [status, count] of Object.entries(stats.byStatus)) {
          printKV(status, count, 2);
        }
      }
    });
}
