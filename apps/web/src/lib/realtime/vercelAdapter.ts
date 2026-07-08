// Busara — Vercel realtime adapter
//
// Vercel serverless functions do NOT support long-lived WebSocket
// servers (no persistent process, 60–300s timeout, no upgrade on the
// edge). The standalone `mini-services/websocket-server` (socket.io on
// port 3003) is designed for self-hosted / Docker / Railway / Fly.io
// deployments — it cannot run on Vercel.
//
// This module provides a single source of truth for "how do I get
// realtime agent progress on Vercel?" and gracefully degrades when the
// WebSocket service is unreachable.
//
// ── Strategy ──────────────────────────────────────────────────────────────
// 1. If NEXT_PUBLIC_WS_SERVER_URL is set AND we're not on Vercel → connect
//    via socket.io (full-duplex chat + agent updates). This is the
//    self-hosted path.
// 2. If NEXT_PUBLIC_WS_SERVER_URL is unset OR we're on Vercel → use
//    Server-Sent Events via /api/v2/analyze-stream. SSE is unidirectional
//    (server→client only) but is fully supported on Vercel's edge + node
//    runtimes and is all the analyze pipeline needs (clients don't push
//    messages mid-analysis; they POST once and listen).
//
// ── Deployment note ───────────────────────────────────────────────────────
// To keep the chat / multi-client fan-out features (which SSE alone
// can't provide), deploy the WebSocket mini-service separately on
// Railway, Render, or Fly.io and point NEXT_PUBLIC_WS_SERVER_URL at it.
// The web client will detect it and prefer it for chat; agent progress
// will still flow through SSE so Vercel cold starts don't break anything.

import { isVercel } from '@/lib/env/vercel';

export type RealtimeMode = 'websocket' | 'sse' | 'none';

/**
 * Which realtime transport should the client use right now?
 *
 * - 'websocket' — NEXT_PUBLIC_WS_SERVER_URL is set AND we're not on Vercel.
 * - 'sse'       — we're on Vercel, or WS_SERVER_URL is unset but the
 *                 SSE endpoints exist. This is the default Vercel path.
 * - 'none'      — no realtime transport is available (e.g. SSR pass).
 */
export function getRealtimeMode(): RealtimeMode {
  if (typeof window === 'undefined') return 'none'; // SSR — no realtime
  const wsUrl = process.env.NEXT_PUBLIC_WS_SERVER_URL;
  if (wsUrl && !isVercel()) return 'websocket';
  return 'sse';
}

/**
 * Returns the URL the client should hit for agent-progress streaming.
 * On Vercel this is the SSE endpoint relative to the current origin;
 * off-Vercel with a WebSocket server, it's the WS URL.
 */
export function getRealtimeEndpoint(): string {
  const mode = getRealtimeMode();
  if (mode === 'websocket') {
    return process.env.NEXT_PUBLIC_WS_SERVER_URL as string;
  }
  // SSE — same-origin relative URL works on Vercel previews + prod.
  return '/api/v2/analyze-stream';
}

/**
 * True if the chat features (multi-client fan-out) are available.
 * Chat requires the WebSocket service — SSE alone can't fan a message
 * out to multiple subscribers of the same analysis.
 */
export function isChatAvailable(): boolean {
  return getRealtimeMode() === 'websocket';
}

/**
 * Log a one-shot dev warning when the app boots on Vercel without a
 * WS server. Idempotent — only logs once per page load.
 */
let _warned = false;
export function warnIfNoWebSocket(): void {
  if (_warned) return;
  _warned = true;
  if (isVercel() && !process.env.NEXT_PUBLIC_WS_SERVER_URL) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        '[realtime] Vercel deployment detected without NEXT_PUBLIC_WS_SERVER_URL. ' +
          'Falling back to SSE for agent progress. Chat / multi-client fan-out ' +
          'features are disabled. To enable them, deploy mini-services/websocket-server ' +
          'on Railway/Render/Fly.io and set NEXT_PUBLIC_WS_SERVER_URL.',
      );
    }
  }
}
