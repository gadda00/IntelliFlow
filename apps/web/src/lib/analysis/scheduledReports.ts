/**
 * Scheduled Reports — recurring workflows that turn a chat tool into a habit.
 * Per the Brutally Honest Review:
 * "Daily-use tools run on a cadence: scheduled reports, threshold alerts,
 * a weekly digest. A WhatsApp- or Slack-delivered daily/weekly insight
 * digest would likely drive far more habitual use in East Africa."
 */

export interface ScheduledReport {
  id: string;
  name: string;
  dataSource: string; // file name or connector ID
  frequency: 'daily' | 'weekly' | 'monthly';
  deliveryChannel: 'email' | 'whatsapp' | 'slack' | 'webhook';
  deliveryTarget: string; // email address, phone, webhook URL, Slack channel
  preset: string; // 'full' | 'forecast' | 'anomaly' | 'quick'
  active: boolean;
  lastRun?: string;
  nextRun?: string;
  createdAt: string;
}

export class ScheduledReports {
  private static KEY = 'busara_scheduled_reports';

  static getAll(): ScheduledReport[] {
    if (typeof window === 'undefined') return [];
    try {
      return JSON.parse(localStorage.getItem(this.KEY) || '[]');
    } catch { return []; }
  }

  static getActive(): ScheduledReport[] {
    return this.getAll().filter(r => r.active);
  }

  static create(report: Omit<ScheduledReport, 'id' | 'createdAt' | 'nextRun'>): ScheduledReport {
    const reports = this.getAll();
    const now = new Date();
    const nextRun = this.calculateNextRun(report.frequency, now);
    const newReport: ScheduledReport = {
      ...report,
      id: `report-${Date.now()}`,
      createdAt: now.toISOString(),
      nextRun: nextRun.toISOString(),
      active: true,
    };
    reports.push(newReport);
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.KEY, JSON.stringify(reports));
    }
    return newReport;
  }

  static update(id: string, updates: Partial<ScheduledReport>): void {
    const reports = this.getAll();
    const idx = reports.findIndex(r => r.id === id);
    if (idx >= 0) {
      reports[idx] = { ...reports[idx], ...updates };
      if (typeof window !== 'undefined') {
        localStorage.setItem(this.KEY, JSON.stringify(reports));
      }
    }
  }

  static delete(id: string): void {
    const reports = this.getAll().filter(r => r.id !== id);
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.KEY, JSON.stringify(reports));
    }
  }

  static toggleActive(id: string): void {
    const reports = this.getAll();
    const report = reports.find(r => r.id === id);
    if (report) {
      report.active = !report.active;
      if (typeof window !== 'undefined') {
        localStorage.setItem(this.KEY, JSON.stringify(reports));
      }
    }
  }

  static calculateNextRun(frequency: string, from: Date): Date {
    const next = new Date(from);
    switch (frequency) {
      case 'daily':
        next.setDate(next.getDate() + 1);
        next.setHours(9, 0, 0, 0); // 9 AM local time
        break;
      case 'weekly':
        next.setDate(next.getDate() + (7 - next.getDay() + 1) % 7); // Next Monday
        next.setHours(9, 0, 0, 0);
        break;
      case 'monthly':
        next.setMonth(next.getMonth() + 1);
        next.setDate(1);
        next.setHours(9, 0, 0, 0);
        break;
    }
    return next;
  }

  /**
   * Generate a digest message for WhatsApp/Slack/email delivery.
   * This would be called by a cron job or serverless function.
   */
  static formatDigest(
    reportName: string,
    summary: { anomalies: number; insights: number; forecastTrend?: string; confidence: number },
  ): { subject: string; body: string; whatsapp: string } {
    const subject = `📊 Busara AI Report: ${reportName}`;
    const body = `
📊 ${reportName} — ${new Date().toLocaleDateString()}

Key Findings:
• ${summary.insights} insights generated
• ${summary.anomalies} anomalies detected
${summary.forecastTrend ? `• Forecast trend: ${summary.forecastTrend}` : ''}
• Overall confidence: ${(summary.confidence * 100).toFixed(0)}%

View full report: https://busara.ai/dashboard

— Busara AI | Built in Nairobi for the world
`.trim();

    const whatsapp = `📊 *${reportName}*\n${new Date().toLocaleDateString()}\n\n• ${summary.insights} insights\n• ${summary.anomalies} anomalies\n${summary.forecastTrend ? `• Trend: ${summary.forecastTrend}\n` : ''}• Confidence: ${(summary.confidence * 100).toFixed(0)}%\n\nhttps://busara.ai/dashboard`;

    return { subject, body, whatsapp };
  }
}
