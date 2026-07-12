/**
 * Activation & Retention Metrics — instruments the product to track
 * time-to-first-insight, D1/D7/D30 retention, and weekly active users.
 *
 * Per the Brutally Honest Review:
 * "You cannot fix 'daily usable' without first measuring whether anyone
 * is, in fact, using it daily. Track activation (time-to-first-insight),
 * D1/D7/D30 retention, and weekly active users per account."
 */

export interface SessionRecord {
  sessionId: string;
  userId?: string;
  startedAt: string;
  firstInsightAt?: string;
  endedAt?: string;
  analysisCount: number;
  uploadCount: number;
}

export interface ActivationMetrics {
  totalSessions: number;
  avgTimeToFirstInsight: number; // ms
  activationRate: number; // % of sessions that reached first insight
  d1Retention: number;
  d7Retention: number;
  d30Retention: number;
  weeklyActiveUsers: number;
  monthlyActiveUsers: number;
}

export class ActivationTracker {
  private static SESSION_KEY = 'busara_current_session';
  private static HISTORY_KEY = 'busara_session_history';
  private static FIRST_VISIT_KEY = 'busara_first_visit';

  // ─── Session Tracking ────────────────────────────────────────────
  static startSession(userId?: string): SessionRecord {
    const session: SessionRecord = {
      sessionId: `session-${Date.now()}`,
      userId,
      startedAt: new Date().toISOString(),
      analysisCount: 0,
      uploadCount: 0,
    };

    // Track first visit for retention calc
    if (typeof window !== 'undefined' && !localStorage.getItem(this.FIRST_VISIT_KEY)) {
      localStorage.setItem(this.FIRST_VISIT_KEY, new Date().toISOString());
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
    }
    return session;
  }

  static getCurrentSession(): SessionRecord | null {
    if (typeof window === 'undefined') return null;
    try {
      return JSON.parse(localStorage.getItem(this.SESSION_KEY) || 'null');
    } catch { return null; }
  }

  static recordUpload(): void {
    const session = this.getCurrentSession();
    if (!session) return;
    session.uploadCount++;
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
    }
  }

  static recordInsight(): void {
    const session = this.getCurrentSession();
    if (!session) return;
    if (!session.firstInsightAt) {
      session.firstInsightAt = new Date().toISOString();
    }
    session.analysisCount++;
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
    }
  }

  static endSession(): void {
    const session = this.getCurrentSession();
    if (!session) return;
    session.endedAt = new Date().toISOString();

    // Save to history
    if (typeof window !== 'undefined') {
      const history = this.getHistory();
      history.push(session);
      if (history.length > 100) history.shift();
      localStorage.setItem(this.HISTORY_KEY, JSON.stringify(history));
      localStorage.removeItem(this.SESSION_KEY);
    }
  }

  static getHistory(): SessionRecord[] {
    if (typeof window === 'undefined') return [];
    try {
      return JSON.parse(localStorage.getItem(this.HISTORY_KEY) || '[]');
    } catch { return []; }
  }

  // ─── Metrics Calculation ─────────────────────────────────────────
  static getMetrics(): ActivationMetrics {
    const history = this.getHistory();
    const sessionsWithInsight = history.filter(s => s.firstInsightAt);

    // Time to first insight
    const insightTimes = sessionsWithInsight.map(s => {
      return new Date(s.firstInsightAt!).getTime() - new Date(s.startedAt).getTime();
    });
    const avgTimeToFirstInsight = insightTimes.length > 0
      ? insightTimes.reduce((a, b) => a + b, 0) / insightTimes.length
      : 0;

    // Activation rate
    const activationRate = history.length > 0
      ? (sessionsWithInsight.length / history.length) * 100
      : 0;

    // Retention
    const firstVisit = localStorage.getItem(this.FIRST_VISIT_KEY);
    let d1Retention = 0, d7Retention = 0, d30Retention = 0;

    if (firstVisit) {
      const firstDate = new Date(firstVisit);
      const now = new Date();
      const daysSinceFirst = Math.floor((now.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));

      // D1: did they come back the next day?
      if (daysSinceFirst >= 1) {
        const day1Sessions = history.filter(s => {
          const sessionDate = new Date(s.startedAt);
          const diff = Math.floor((sessionDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
          return diff >= 1 && diff <= 2;
        });
        d1Retention = day1Sessions.length > 0 ? 100 : 0;
      }

      // D7
      if (daysSinceFirst >= 7) {
        const day7Sessions = history.filter(s => {
          const sessionDate = new Date(s.startedAt);
          const diff = Math.floor((sessionDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
          return diff >= 7 && diff <= 8;
        });
        d7Retention = day7Sessions.length > 0 ? 100 : 0;
      }

      // D30
      if (daysSinceFirst >= 30) {
        const day30Sessions = history.filter(s => {
          const sessionDate = new Date(s.startedAt);
          const diff = Math.floor((sessionDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
          return diff >= 30 && diff <= 31;
        });
        d30Retention = day30Sessions.length > 0 ? 100 : 0;
      }
    }

    // WAU/MAU (unique days active)
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const weeklyActiveDays = new Set(
      history.filter(s => new Date(s.startedAt) >= weekAgo)
        .map(s => new Date(s.startedAt).toDateString())
    );
    const monthlyActiveDays = new Set(
      history.filter(s => new Date(s.startedAt) >= monthAgo)
        .map(s => new Date(s.startedAt).toDateString())
    );

    return {
      totalSessions: history.length,
      avgTimeToFirstInsight,
      activationRate,
      d1Retention,
      d7Retention,
      d30Retention,
      weeklyActiveUsers: weeklyActiveDays.size,
      monthlyActiveUsers: monthlyActiveDays.size,
    };
  }
}
