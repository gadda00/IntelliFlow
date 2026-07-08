/**
 * Busara CLI — Output formatting
 * ===============================
 *
 * Helpers for printing data as tables or JSON, with ANSI colors.
 *
 * Color codes are the standard 8-color ANSI set. We detect a TTY so piping to
 * a file produces plain text (no escape sequences).
 */

import * as tty from 'node:tty';

const isTTY = process.stdout.isTTY ?? false;

// ANSI color helpers (only emitted when stdout is a TTY).
const C = {
  reset: isTTY ? '\x1b[0m' : '',
  bold: isTTY ? '\x1b[1m' : '',
  dim: isTTY ? '\x1b[2m' : '',
  red: isTTY ? '\x1b[31m' : '',
  green: isTTY ? '\x1b[32m' : '',
  yellow: isTTY ? '\x1b[33m' : '',
  blue: isTTY ? '\x1b[34m' : '',
  magenta: isTTY ? '\x1b[35m' : '',
  cyan: isTTY ? '\x1b[36m' : '',
  gray: isTTY ? '\x1b[90m' : '',
};

/** Color a string (no-op when not a TTY). */
export const color = {
  red: (s: string) => `${C.red}${s}${C.reset}`,
  green: (s: string) => `${C.green}${s}${C.reset}`,
  yellow: (s: string) => `${C.yellow}${s}${C.reset}`,
  blue: (s: string) => `${C.blue}${s}${C.reset}`,
  cyan: (s: string) => `${C.cyan}${s}${C.reset}`,
  magenta: (s: string) => `${C.magenta}${s}${C.reset}`,
  gray: (s: string) => `${C.gray}${s}${C.reset}`,
  dim: (s: string) => `${C.dim}${s}${C.reset}`,
  bold: (s: string) => `${C.bold}${s}${C.reset}`,
};

/** Print a structured error and exit. */
export function printError(message: string, details?: unknown): never {
  process.stderr.write(`${color.red('error')} ${message}\n`);
  if (details !== undefined) {
    process.stderr.write(color.dim(JSON.stringify(details, null, 2)) + '\n');
  }
  process.exit(1);
}

/** Print a success message. */
export function printSuccess(message: string): void {
  process.stdout.write(`${color.green('✔')} ${message}\n`);
}

/** Print an info message. */
export function printInfo(message: string): void {
  process.stdout.write(`${color.cyan('ℹ')} ${message}\n`);
}

/** Print a warning message. */
export function printWarn(message: string): void {
  process.stdout.write(`${color.yellow('⚠')} ${message}\n`);
}

/** Pretty-print a JSON value. */
export function printJSON(value: unknown): void {
  process.stdout.write(JSON.stringify(value, null, 2) + '\n');
}

/** A column definition for `printTable`. */
export interface Column<T> {
  /** Header label. */
  header: string;
  /** Cell value getter. */
  get: (row: T) => string | number | undefined | null;
  /** Optional width hint (in chars). Min content width is always respected. */
  width?: number;
  /** Optional cell colorer. */
  color?: (row: T, value: string) => string;
}

/**
 * Render an array of rows as a fixed-width text table.
 *
 * Example:
 *   printTable(agents, [
 *     { header: 'ID',         get: a => a.id },
 *     { header: 'Name',       get: a => a.name },
 *     { header: 'Stability',  get: a => a.stability, color: (_, v) => v === 'stable' ? color.green(v) : color.yellow(v) },
 *   ]);
 */
export function printTable<T>(rows: T[], columns: Column<T>[]): void {
  if (rows.length === 0) {
    process.stdout.write(color.dim('(no rows)') + '\n');
    return;
  }

  // Compute display width per column.
  const widths = columns.map((col) => {
    const headerW = col.header.length;
    const maxCellW = Math.max(
      ...rows.map((r) => {
        const v = col.get(r);
        const s = v === undefined || v === null ? '' : String(v);
        // Strip ANSI codes when measuring width.
        return s.replace(/\x1b\[[0-9;]*m/g, '').length;
      }),
    );
    return Math.max(headerW, maxCellW, col.width ?? 0);
  });

  // Render header.
  const header = columns
    .map((col, i) => color.bold(pad(col.header, widths[i])))
    .join('  ');
  process.stdout.write(header + '\n');

  // Render separator.
  const sep = columns.map((_, i) => color.dim('-'.repeat(widths[i]))).join('  ');
  process.stdout.write(sep + '\n');

  // Render rows.
  for (const row of rows) {
    const cells = columns.map((col, i) => {
      const raw = col.get(row);
      const s = raw === undefined || raw === null ? '' : String(raw);
      const padded = pad(s.replace(/\x1b\[[0-9;]*m/g, ''), widths[i]);
      return col.color ? col.color(row, s) : padded;
    });
    process.stdout.write(cells.join('  ') + '\n');
  }
}

/** Pad a string to the given width. */
function pad(s: string, width: number): string {
  const stripped = s.replace(/\x1b\[[0-9;]*m/g, '');
  if (stripped.length >= width) return s;
  return s + ' '.repeat(width - stripped.length);
}

/** Print a key/value pair, aligned. */
export function printKV(key: string, value: unknown, indent = 0): void {
  const prefix = ' '.repeat(indent);
  const k = color.bold(key.padEnd(18));
  let v: string;
  if (value === undefined || value === null) {
    v = color.dim('—');
  } else if (typeof value === 'object') {
    v = JSON.stringify(value);
  } else {
    v = String(value);
  }
  process.stdout.write(`${prefix}${k}  ${v}\n`);
}

/** Print a section heading. */
export function printHeading(text: string): void {
  process.stdout.write(`\n${color.bold(color.cyan(text))}\n`);
  process.stdout.write(color.dim('─'.repeat(Math.max(text.length, 40))) + '\n');
}

/**
 * Format a millisecond duration as a human-readable string.
 * 1234 → "1.2s", 74000 → "1m 14s"
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.round((ms % 60_000) / 1000);
  return `${m}m ${s}s`;
}

/** Truncate a string to `max` chars, appending an ellipsis if cut. */
export function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, Math.max(0, max - 1)) + '…';
}
