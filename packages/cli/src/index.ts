#!/usr/bin/env node
/**
 * Busara CLI
 * ==========
 *
 * Developer-experience CLI for the Busara multi-agent data intelligence
 * platform. Run agents, list templates, inspect trajectories, approve
 * evolution actions, and start the dev server — all from the terminal.
 *
 * Config: ~/.busara/config.json
 *   { "apiUrl": "http://localhost:3000", "apiKey": "ifl_...", "output": "table" }
 *
 * Quick start:
 *   busara config set apiUrl http://localhost:3000
 *   busara agents list
 *   busara analyze data_ingestion --data sample.csv
 *   busara templates run quick-profile --data sample.csv --stream
 */

import { Command } from 'commander';
import { loadConfig } from './lib/config';
import { color, printError } from './lib/output';
import { registerAgentsCommand } from './commands/agents';
import { registerAnalyzeCommand } from './commands/analyze';
import { registerTemplatesCommand } from './commands/templates';
import { registerTrajectoryCommand } from './commands/trajectory';
import { registerEvolutionCommand } from './commands/evolution';
import { registerServeCommand } from './commands/serve';
import { registerInitCommand } from './commands/init';
import { registerConfigCommand } from './commands/config';

const program = new Command();

program
  .name('busara')
  .description('Busara CLI — run agents, inspect trajectories, and manage the Busara platform from the terminal.')
  .version('8.0.0-alpha.1')
  .option('--api-url <url>', 'Busara API URL (overrides config)')
  .option('--api-key <key>', 'Busara API key (overrides config)')
  .option('--output <format>', 'Output format: table | json', 'table')
  .hook('preAction', (cmd) => {
    // Validate the global --output flag early so a bad value fails before the
    // command runs.
    const opts = cmd.opts();
    if (opts.output && opts.output !== 'table' && opts.output !== 'json') {
      printError(`Invalid --output value: ${opts.output}. Must be 'table' or 'json'.`);
    }
  });

// Register every subcommand.
registerAgentsCommand(program);
registerAnalyzeCommand(program);
registerTemplatesCommand(program);
registerTrajectoryCommand(program);
registerEvolutionCommand(program);
registerServeCommand(program);
registerInitCommand(program);
registerConfigCommand(program);

// Help tweak: show current config in the help output.
program.addHelpText(
  'after',
  `\n${color.dim('Current config:')}\n  ${JSON.stringify(loadConfig(), null, 2).replace(/\n/g, '\n  ')}\n`,
);

async function main() {
  try {
    await program.parseAsync(process.argv);
  } catch (err) {
    if (err instanceof Error) {
      printError(err.message);
    } else {
      printError('Unknown error: ' + String(err));
    }
  }
}

void main();

export { program };
