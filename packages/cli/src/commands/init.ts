/**
 * `busara init` — scaffold a new Busara project
 * ==============================================
 *
 *   busara init <project-name> [--template <id>]
 *
 * Creates a new directory with:
 *   - package.json (pre-wired to @busara/agents and @busara/core)
 *   - .env.example
 *   - README.md
 *   - busara.config.json (CLI config — apiUrl, output format)
 *   - sample.csv (small fixture so you can run `busara analyze` immediately)
 *   - agents.config.ts (placeholder for custom agent registration)
 *   - tsconfig.json
 *
 * Template files live in `packages/cli/templates/project/`.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Command } from 'commander';
import { color, printError, printInfo, printSuccess } from '../lib/output';

/** Resolve the templates directory (always shipped alongside the CLI source). */
function templatesDir(): string {
  // dist/commands/init.js → ../../templates/project
  // src/commands/init.ts → ../../templates/project (when running from source)
  const here = __dirname;
  // Try a few candidate locations — works whether running from dist/ or src/.
  const candidates = [
    path.join(here, '..', '..', 'templates', 'project'),
    path.join(here, '..', '..', '..', 'templates', 'project'),
    path.join(process.cwd(), 'packages', 'cli', 'templates', 'project'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}

/** Recursively copy a directory. */
function copyDir(src: string, dest: string): void {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

/** Substitute {{name}} placeholders in a file's content. */
function substitute(filePath: string, vars: Record<string, string>): void {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');
  for (const [k, v] of Object.entries(vars)) {
    content = content.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v);
  }
  fs.writeFileSync(filePath, content, 'utf8');
}

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Scaffold a new Busara project in the current directory')
    .argument('<project-name>', 'Directory name for the new project')
    .option('--force', 'Overwrite the target directory if it exists')
    .action((projectName: string, opts: { force?: boolean }) => {
      const target = path.resolve(process.cwd(), projectName);

      if (fs.existsSync(target)) {
        if (!opts.force) {
          printError(
            `Directory '${projectName}' already exists. Use --force to overwrite.`,
          );
        }
        printInfo(`--force set — removing existing directory '${projectName}'…`);
        fs.rmSync(target, { recursive: true, force: true });
      }

      fs.mkdirSync(target, { recursive: true });
      const tplDir = templatesDir();

      if (!fs.existsSync(tplDir)) {
        printError(
          `Template files not found at ${tplDir}.\n` +
            'This is a CLI packaging error — the templates/ directory should be shipped alongside dist/.',
        );
      }

      copyDir(tplDir, target);

      // Substitute placeholders.
      const pkgName = projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
      const vars = {
        PROJECT_NAME: pkgName,
        PROJECT_DISPLAY_NAME: projectName,
        BUSARA_VERSION: '8.0.0-alpha.1',
      };
      for (const file of ['package.json', 'README.md', 'busara.config.json', 'agents.config.ts']) {
        substitute(path.join(target, file), vars);
      }

      printSuccess(`Scaffolded Busara project at ${color.cyan(path.relative(process.cwd(), target))}`);
      printInfo('Next steps:');
      process.stdout.write(`\n  ${color.dim('$')} cd ${projectName}\n`);
      process.stdout.write(`  ${color.dim('$')} pnpm install\n`);
      process.stdout.write(`  ${color.dim('$')} busara serve --port 3000\n`);
      process.stdout.write(`  ${color.dim('$')} busara agents list\n`);
      process.stdout.write(`  ${color.dim('$')} busara analyze data_ingestion --data sample.csv\n\n`);
    });
}
