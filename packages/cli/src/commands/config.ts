/**
 * `busara config` — read and write the user-level config file
 * ============================================================
 *
 *   busara config list
 *   busara config get <key>
 *   busara config set <key> <value>
 *
 * Keys: apiUrl, apiKey, output
 *
 * Config is stored at ~/.busara/config.json.
 */

import type { Command } from 'commander';
import {
  configPath,
  loadConfig,
  resolveConfig,
  setConfigValue,
} from '../lib/config';
import { color, printError, printHeading, printInfo, printJSON, printKV, printSuccess } from '../lib/output';

const VALID_KEYS = ['apiUrl', 'apiKey', 'output'] as const;
type ConfigKey = (typeof VALID_KEYS)[number];

function isValidKey(k: string): k is ConfigKey {
  return (VALID_KEYS as readonly string[]).includes(k);
}

export function registerConfigCommand(program: Command): void {
  const config = program.command('config').description('Read and write the Busara CLI config (~/.busara/config.json)');

  config
    .command('list')
    .description('Print the current config')
    .action(() => {
      const globalOpts = program.opts();
      const output = globalOpts.output as string | undefined;
      const cfg = resolveConfig(globalOpts);

      if (output === 'json') {
        printJSON(cfg);
        return;
      }

      printHeading('Busara CLI config');
      printKV('File', configPath());
      printKV('apiUrl', cfg.apiUrl);
      printKV('apiKey', cfg.apiKey ? color.dim(`${cfg.apiKey.slice(0, 8)}…${cfg.apiKey.slice(-4)}`) : color.dim('(not set)'));
      printKV('output', cfg.output);
    });

  config
    .command('get <key>')
    .description('Get a single config value')
    .action((key: string) => {
      if (!isValidKey(key)) {
        printError(`Unknown config key: '${key}'. Valid keys: ${VALID_KEYS.join(', ')}`);
      }
      const cfg = loadConfig();
      const value = cfg[key];
      if (value === undefined) {
        printInfo(`${color.bold(key)} is not set.`);
        return;
      }
      process.stdout.write(`${String(value)}\n`);
    });

  config
    .command('set <key> <value>')
    .description('Set a config value and persist it to ~/.busara/config.json')
    .action((key: string, value: string) => {
      if (!isValidKey(key)) {
        printError(`Unknown config key: '${key}'. Valid keys: ${VALID_KEYS.join(', ')}`);
      }
      try {
        const updated = setConfigValue(key, value);
        printSuccess(`Set ${color.bold(key)} = ${color.cyan(value)} in ${color.dim(configPath())}`);
        // `updated` is the full config after the change; reference it so
        // TypeScript confirms the return type is what callers expect.
        void updated;
      } catch (err) {
        printError(err instanceof Error ? err.message : String(err));
      }
    });
}
