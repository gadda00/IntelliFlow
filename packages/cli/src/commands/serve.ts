/**
 * `busara serve` — start the Busara dev server
 * =============================================
 *
 * Looks for the nearest `package.json` with a `dev` script (Busara monorepo
 * root or a scaffolded `busara init` project) and runs `pnpm dev` with the
 * requested port. Streams stdout/stderr to the console.
 *
 *   busara serve [--port 3000]
 */

import * as child_process from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Command } from 'commander';
import { color, printError, printInfo, printSuccess } from '../lib/output';

/** Walk up from `cwd` looking for the nearest package.json with a `dev` script. */
function findProjectRoot(start: string): string | null {
  let dir = start;
  while (true) {
    const pkgPath = path.join(dir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { scripts?: Record<string, string> };
        if (pkg.scripts?.dev) return dir;
      } catch {
        // ignore malformed package.json
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function registerServeCommand(program: Command): void {
  program
    .command('serve')
    .description('Start the Busara dev server (runs `pnpm dev` in the nearest Busara project)')
    .option('-p, --port <port>', 'Port to listen on', '3000')
    .option('--filter <pkg>', 'Turbo filter (e.g. @busara/web)')
    .action((opts: { port: string; filter?: string }) => {
      const port = Number(opts.port);
      if (Number.isNaN(port) || port < 1 || port > 65535) {
        printError(`Invalid port: ${opts.port}. Must be a number between 1 and 65535.`);
      }

      const root = findProjectRoot(process.cwd());
      if (!root) {
        printError(
          'No Busara project found in the current directory or any parent.\n' +
            'Run `busara init <project-name>` to scaffold a new project, or `cd` into an existing one.',
        );
      }

      printInfo(`Starting Busara dev server on port ${color.cyan(String(port))} (project root: ${color.dim(root)})`);
      printInfo(color.dim('Press Ctrl+C to stop.'));

      // Build the command. We use `pnpm dev` with PORT env var; if a turbo
      // filter is given, run `pnpm dev --filter=<pkg>`.
      const args = ['dev'];
      if (opts.filter) {
        args.push('--filter', opts.filter);
      }
      const child = child_process.spawn('pnpm', args, {
        cwd: root,
        stdio: 'inherit',
        env: { ...process.env, PORT: String(port) },
        shell: process.platform === 'win32',
      });

      child.on('error', (err) => {
        printError(`Failed to spawn dev server: ${err.message}`);
      });

      child.on('exit', (code) => {
        if (code === 0) {
          printSuccess('Dev server stopped.');
        } else {
          printError(`Dev server exited with code ${code ?? 'null'}.`);
        }
      });

      // Forward Ctrl+C to the child.
      process.on('SIGINT', () => {
        child.kill('SIGINT');
      });
      process.on('SIGTERM', () => {
        child.kill('SIGTERM');
      });
    });
}
