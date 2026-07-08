/**
 * Busara CLI — Config
 * ====================
 *
 * Reads and writes the user-level config at `~/.busara/config.json`.
 *
 * Example config:
 *   {
 *     "apiUrl": "http://localhost:3000",
 *     "apiKey": "ifl_...",
 *     "output": "table"          // "table" | "json"
 *   }
 *
 * Resolution order for `apiUrl` and `apiKey`:
 *   1. CLI flags (--api-url, --api-key)
 *   2. Process env vars (BUSARA_API_URL, BUSARA_API_KEY)
 *   3. ~/.busara/config.json
 *   4. Built-in defaults (http://localhost:3000, no key)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

export type OutputFormat = 'table' | 'json';

export interface BusaraConfig {
  apiUrl: string;
  apiKey?: string;
  output: OutputFormat;
}

const DEFAULT_API_URL = 'http://localhost:3000';
const DEFAULT_OUTPUT: OutputFormat = 'table';

/** Directory that holds user-level Busara state. */
export function busaraDir(): string {
  return path.join(os.homedir(), '.busara');
}

/** Path to the config file. */
export function configPath(): string {
  return path.join(busaraDir(), 'config.json');
}

/** Load the config file, returning defaults if it does not exist. */
export function loadConfig(): BusaraConfig {
  const file = configPath();
  try {
    const raw = fs.readFileSync(file, 'utf8');
    const parsed = JSON.parse(raw) as Partial<BusaraConfig>;
    return {
      apiUrl: parsed.apiUrl ?? DEFAULT_API_URL,
      apiKey: parsed.apiKey,
      output: parsed.output === 'json' ? 'json' : DEFAULT_OUTPUT,
    };
  } catch {
    // Missing file or invalid JSON — fall back to defaults.
    return {
      apiUrl: DEFAULT_API_URL,
      apiKey: undefined,
      output: DEFAULT_OUTPUT,
    };
  }
}

/** Persist the config to disk, creating the directory if needed. */
export function saveConfig(config: BusaraConfig): void {
  const dir = busaraDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(configPath(), JSON.stringify(config, null, 2) + '\n', 'utf8');
}

/** Set a single key on the config and persist it. */
export function setConfigValue(
  key: 'apiUrl' | 'apiKey' | 'output',
  value: string,
): BusaraConfig {
  const current = loadConfig();
  if (key === 'output') {
    if (value !== 'table' && value !== 'json') {
      throw new Error(`Invalid output format: ${value}. Must be 'table' or 'json'.`);
    }
    current.output = value;
  } else if (key === 'apiUrl') {
    current.apiUrl = value;
  } else if (key === 'apiKey') {
    current.apiKey = value;
  }
  saveConfig(current);
  return current;
}

/**
 * Resolve effective runtime config from flags, env, and file.
 *
 * Priority: flag (if provided) > env var > file > default.
 */
export function resolveConfig(opts?: {
  apiUrl?: string;
  apiKey?: string;
  output?: OutputFormat;
}): BusaraConfig {
  const file = loadConfig();
  return {
    apiUrl:
      opts?.apiUrl ??
      process.env.BUSARA_API_URL ??
      file.apiUrl ??
      DEFAULT_API_URL,
    apiKey:
      opts?.apiKey ??
      process.env.BUSARA_API_KEY ??
      file.apiKey,
    output:
      opts?.output ??
      (process.env.BUSARA_OUTPUT as OutputFormat | undefined) ??
      file.output ??
      DEFAULT_OUTPUT,
  };
}
