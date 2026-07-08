'use client';

import { useEffect, useState, useCallback } from 'react';

interface ApiResult<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string; details?: unknown };
}

interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Tiny SWR-style fetch hook for dashboard pages.
 * Calls fetch on mount and whenever `url` changes; supports manual refetch.
 */
export function useApi<T>(url: string | null, opts?: { refreshMs?: number }): UseApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(url !== null);
  const [error, setError] = useState<string | null>(null);

  const doFetch = useCallback(async () => {
    if (!url) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as ApiResult<T>;
        throw new Error(body.error?.message ?? `Request failed (${res.status})`);
      }
      const body = (await res.json()) as ApiResult<T>;
      if (!body.ok) {
        throw new Error(body.error?.message ?? 'API returned !ok');
      }
      setData(body.data ?? null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    void doFetch();
  }, [doFetch]);

  useEffect(() => {
    if (!opts?.refreshMs) return;
    const id = setInterval(() => void doFetch(), opts.refreshMs);
    return () => clearInterval(id);
  }, [doFetch, opts?.refreshMs]);

  return { data, loading, error, refetch: doFetch };
}

/** POST helper that returns the parsed body or throws. */
export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as ApiResult<T>;
  if (!res.ok || !json.ok) {
    throw new Error(json.error?.message ?? `Request failed (${res.status})`);
  }
  return (json.data ?? null) as T;
}
