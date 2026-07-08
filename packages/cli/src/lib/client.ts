/**
 * Busara CLI — HTTP client
 * =========================
 *
 * Thin wrapper around Node's `fetch` that targets the Busara API.
 *
 * - Reads base URL + API key from `resolveConfig()`.
 * - Auto-injects `Authorization: Bearer <apiKey>` when an API key is set.
 * - Normalises errors into a `BusaraApiError` so commands can print a clean
 *   message and exit with the right status code.
 * - Supports SSE streaming for `POST /api/v2/analyze-stream`.
 */

import { resolveConfig, type BusaraConfig } from './config';

export class BusaraApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | undefined,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'BusaraApiError';
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'DELETE' | 'PATCH' | 'PUT';
  body?: unknown;
  /** Override config (e.g. when a flag is set on a single command). */
  config?: Partial<BusaraConfig>;
  /** Extra headers. */
  headers?: Record<string, string>;
  /** Query string params (appended to path). */
  query?: Record<string, string | number | boolean | undefined>;
}

/** Build a full URL from a path + optional query params. */
function buildUrl(base: string, path: string, query?: RequestOptions['query']): string {
  const url = new URL(path.replace(/^\//, ''), base.endsWith('/') ? base : base + '/');
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

/** Send a JSON request and return the parsed JSON body. Throws on non-2xx. */
export async function request<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const config = resolveConfig(options.config);
  const url = buildUrl(config.apiUrl, path, options.query);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': 'busara-cli/8.0.0',
    ...(options.headers ?? {}),
  };
  if (config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey}`;
  }

  const init: RequestInit = {
    method: options.method ?? 'GET',
    headers,
  };
  if (options.body !== undefined) {
    init.body = JSON.stringify(options.body);
  }

  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new BusaraApiError(
      `Could not reach Busara API at ${config.apiUrl} — ${msg}\n` +
        `Hint: run \`busara serve\` to start the dev server, or \`busara config set apiUrl <url>\` to point at a different host.`,
      0,
      'NETWORK_ERROR',
    );
  }

  const text = await res.text();
  let json: unknown = undefined;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
  }

  if (!res.ok) {
    const errBody = (json && typeof json === 'object' && 'error' in (json as object))
      ? (json as { error?: { code?: string; message?: string; details?: unknown } }).error
      : undefined;
    throw new BusaraApiError(
      errBody?.message ?? `Request failed with status ${res.status}`,
      res.status,
      errBody?.code,
      errBody?.details,
    );
  }

  return json as T;
}

/**
 * POST a request and stream the SSE response, invoking `onEvent` for every
 * parsed event in the stream.
 *
 * The Busara streaming endpoints emit lines like:
 *   event: agent_start
 *   data: {...}
 *
 * We parse those into `{ event, data }` pairs and forward them.
 */
export async function requestStream(
  path: string,
  body: unknown,
  onEvent: (event: string, data: unknown) => void,
  options: { config?: Partial<BusaraConfig> } = {},
): Promise<void> {
  const config = resolveConfig(options.config);
  const url = buildUrl(config.apiUrl, path);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'text/event-stream',
    'User-Agent': 'busara-cli/8.0.0',
  };
  if (config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey}`;
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new BusaraApiError(
      `Could not reach Busara API at ${config.apiUrl} — ${msg}`,
      0,
      'NETWORK_ERROR',
    );
  }

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    throw new BusaraApiError(
      `Streaming request failed (${res.status}) — ${text}`,
      res.status,
      'STREAM_ERROR',
    );
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let currentEvent = 'message';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE messages are separated by a blank line.
    let idx: number;
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const raw = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);

      let dataLines: string[] = [];
      for (const line of raw.split('\n')) {
        if (line.startsWith('event:')) {
          currentEvent = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          dataLines.push(line.slice(5).trim());
        }
      }
      if (dataLines.length > 0) {
        const dataStr = dataLines.join('\n');
        let data: unknown = dataStr;
        try {
          data = JSON.parse(dataStr);
        } catch {
          // Leave as string.
        }
        onEvent(currentEvent, data);
        currentEvent = 'message';
      }
    }
  }
}

/** Convenience GET. */
export function get<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  return request<T>(path, { ...options, method: 'GET' });
}

/** Convenience POST. */
export function post<T = unknown>(path: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
  return request<T>(path, { ...options, method: 'POST', body });
}
