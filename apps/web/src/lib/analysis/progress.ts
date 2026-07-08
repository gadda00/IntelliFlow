/**
 * In-memory pub/sub for the legacy `/api/analyze` route's progress updates.
 *
 * Lives outside `app/api/analyze/route.ts` because Next.js route files
 * only allow HTTP-method exports — `analysisEvents`, `getRecentUpdates`,
 * and `clearUpdates` would break route type validation if exported from
 * a route.ts file.
 *
 * The WebSocket mini-service (when deployed) subscribes to the
 * `analysisEvents` EventEmitter; polling clients (e.g. the
 * `/api/analysis-status` route) read from the `recentUpdates` buffer.
 *
 * This is the v1 (legacy) pipeline. The v2 pipeline uses SSE via
 * `/api/v2/analyze-stream` and does not need this module.
 */

import { EventEmitter } from 'events';
import type { ProgressBroadcast } from '@/lib/agents';

// In-memory pub/sub for real-time progress updates.
// The WebSocket mini-service subscribes to this; clients poll or connect via WS.
export const analysisEvents = new EventEmitter();
analysisEvents.setMaxListeners(1000);

// Recent updates buffer (per analysisId) so polling clients can catch up
const recentUpdates = new Map<string, ProgressBroadcast[]>();
const MAX_BUFFER = 200;

export function broadcastAnalysisProgress(update: ProgressBroadcast): void {
  analysisEvents.emit('agent_update', update);
  const list = recentUpdates.get(update.analysisId) ?? [];
  list.push(update);
  if (list.length > MAX_BUFFER) list.shift();
  recentUpdates.set(update.analysisId, list);
}

export function getRecentUpdates(analysisId: string): ProgressBroadcast[] {
  return recentUpdates.get(analysisId) ?? [];
}

export function clearUpdates(analysisId: string): void {
  recentUpdates.delete(analysisId);
}
