/**
 * `busara evolution` — list, approve, and reject evolution actions
 * =================================================================
 *
 * The Evolution Control Plane (Pillar 3 of the AReaL paper) inspects trajectory
 * statistics and suggests evolution actions: promote an agent from beta →
 * stable, optimize a config default, flag drift, schedule a fine-tune, etc.
 *
 * All actions are SUGGESTIONS until a human approves them — the CLI is the
 * human-in-the-loop interface.
 *
 *   busara evolution list [--agent <id>]
 *     → GET /api/v2/evolution?agentId=<id>
 *
 *   busara evolution approve <id> --index <n>
 *     → POST /api/v2/evolution { actionType: 'approve', agentId, actionIndex }
 *
 *   busara evolution reject <id> --index <n>
 *     → POST /api/v2/evolution { actionType: 'reject', agentId, actionIndex }
 *
 * The `<id>` argument is the agent ID (the control plane keys actions by agent).
 * `--index` selects which suggested action to act on (0-based).
 */

import type { Command } from 'commander';
import { get, post } from '../lib/client';
import {
  color,
  printError,
  printHeading,
  printInfo,
  printJSON,
  printSuccess,
  printTable,
  printWarn,
  type Column,
} from '../lib/output';

interface EvolutionEvidence {
  totalTrajectories?: number;
  successRate?: number;
  averageReward?: number;
  driftScore?: number;
}

interface EvolutionAction {
  type: string;
  agentId: string;
  reason: string;
  evidence?: EvolutionEvidence;
  confidence?: number;
  status?: string;
  createdAt?: string;
  suggestedChange?: Record<string, unknown>;
}

interface EvolutionListResponse {
  ok: boolean;
  data?: EvolutionAction[];
  message?: string;
}

interface EvolutionActionResponse {
  ok: boolean;
  data?: {
    actionType: string;
    agentId: string;
    actionIndex: number;
    status: string;
    appliedAt: string;
  };
}

const actionTypeColor = (t: string): string => {
  if (t === 'NONE') return color.gray(t);
  if (t.startsWith('PROMOTE') || t.startsWith('OPTIMIZE')) return color.green(t);
  if (t.startsWith('FLAG') || t.startsWith('DEMOTE') || t.startsWith('DEPRECATE')) return color.yellow(t);
  if (t.startsWith('SCHEDULE')) return color.cyan(t);
  return t;
};

const confidenceColor = (c: number | undefined): string => {
  if (c === undefined) return '—';
  if (c >= 0.8) return color.green(c.toFixed(2));
  if (c >= 0.5) return color.yellow(c.toFixed(2));
  return color.red(c.toFixed(2));
};

export function registerEvolutionCommand(program: Command): void {
  const evolution = program.command('evolution').description('List and act on agent evolution suggestions');

  evolution
    .command('list')
    .description('List pending evolution actions (optionally for a specific agent)')
    .option('--agent <id>', 'Filter to a specific agent ID')
    .action(async (opts: { agent?: string }) => {
      const globalOpts = program.opts();
      const output = globalOpts.output as string;

      const res = await get<EvolutionListResponse>('/api/v2/evolution', {
        config: globalOpts,
        query: { agentId: opts.agent },
      });

      const actions = res.data ?? [];

      if (output === 'json') {
        printJSON(res);
        return;
      }

      if (actions.length === 0) {
        if (res.message) {
          printInfo(res.message);
        } else {
          printInfo('No pending evolution actions. Run more analyses to generate trajectory data.');
        }
        return;
      }

      printHeading(`Evolution actions (${actions.length})`);

      // Add a synthetic index to each row so the "#" column can render it.
      type IndexedAction = EvolutionAction & { _index: number };
      const indexed: IndexedAction[] = actions.map((a, i) => ({ ...a, _index: i }));

      const columns: Column<IndexedAction>[] = [
        { header: '#', get: (a) => String(a._index) },
        { header: 'Type', get: (a) => a.type, color: (_, v) => actionTypeColor(v) },
        { header: 'Agent', get: (a) => a.agentId },
        { header: 'Confidence', get: (a) => confidenceColor(a.confidence) },
        { header: 'Status', get: (a) => a.status ?? 'pending' },
        { header: 'Reason', get: (a) => a.reason },
      ];

      printTable(indexed, columns);

      printInfo('Approve with: busara evolution approve <agent-id> --index <n>');
    });

  evolution
    .command('approve <agent-id>')
    .description('Approve a pending evolution action for the given agent')
    .requiredOption('--index <n>', 'Index of the action (from `evolution list`)', (v: string) => Number(v))
    .action(async (agentId: string, opts: { index: number }) => {
      const globalOpts = program.opts();
      const output = globalOpts.output as string;

      const res = await post<EvolutionActionResponse>(
        '/api/v2/evolution',
        { actionType: 'approve', agentId, actionIndex: opts.index },
        { config: globalOpts },
      );

      if (output === 'json') {
        printJSON(res);
        return;
      }

      if (!res.ok) {
        printError('Approval failed.');
      }
      printSuccess(
        `Approved action #${opts.index} for ${color.cyan(agentId)} — status: ${color.green(res.data?.status ?? 'approved')}`,
      );
    });

  evolution
    .command('reject <agent-id>')
    .description('Reject a pending evolution action for the given agent')
    .requiredOption('--index <n>', 'Index of the action (from `evolution list`)', (v: string) => Number(v))
    .action(async (agentId: string, opts: { index: number }) => {
      const globalOpts = program.opts();
      const output = globalOpts.output as string;

      const res = await post<EvolutionActionResponse>(
        '/api/v2/evolution',
        { actionType: 'reject', agentId, actionIndex: opts.index },
        { config: globalOpts },
      );

      if (output === 'json') {
        printJSON(res);
        return;
      }

      if (!res.ok) {
        printError('Reject failed.');
      }
      printWarn(
        `Rejected action #${opts.index} for ${color.cyan(agentId)} — status: ${color.yellow(res.data?.status ?? 'rejected')}`,
      );
    });
}
