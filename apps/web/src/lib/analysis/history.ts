/**
 * Analysis History — persists completed analyses to localStorage.
 * Allows users to view "Recent Analyses" and re-open past results.
 */

export interface AnalysisHistoryEntry {
  id: string;
  fileName: string;
  rowCount: number;
  columnCount: number;
  preset: string;
  timestamp: string;
  durationMs: number;
  agentsSucceeded: number;
  agentsFailed: number;
  // Full results stored for re-opening
  agentStates?: Record<string, any>;
  executionSummary?: any;
}

const STORAGE_KEY = 'busara_analysis_history';
const MAX_ENTRIES = 20;

export function getHistory(): AnalysisHistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addToHistory(entry: AnalysisHistoryEntry): void {
  if (typeof window === 'undefined') return;
  try {
    const history = getHistory();
    // Remove duplicate if same ID
    const filtered = history.filter(h => h.id !== entry.id);
    filtered.unshift(entry);
    // Keep only last MAX_ENTRIES
    if (filtered.length > MAX_ENTRIES) filtered.length = MAX_ENTRIES;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch {
    // localStorage may be full — try without agentStates
    try {
      const entryLite = { ...entry, agentStates: undefined, executionSummary: undefined };
      const history = getHistory().filter(h => h.id !== entry.id);
      history.unshift(entryLite);
      if (history.length > MAX_ENTRIES) history.length = MAX_ENTRIES;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch {}
  }
}

export function getHistoryEntry(id: string): AnalysisHistoryEntry | null {
  return getHistory().find(h => h.id === id) || null;
}

export function deleteHistoryEntry(id: string): void {
  if (typeof window === 'undefined') return;
  const history = getHistory().filter(h => h.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

export function clearHistory(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}
