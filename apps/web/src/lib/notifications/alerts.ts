/**
 * Notification Service — sends real-time alerts via email and webhooks.
 *
 * Supports:
 * - Email notifications (via configurable SMTP or API endpoint)
 * - Slack webhook notifications
 * - Generic webhook (Zapier, Make.com, custom)
 *
 * All credentials are read from environment variables — never hardcoded.
 */

export interface AlertNotification {
  type: 'anomaly' | 'threshold' | 'fraud' | 'system';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  data?: Record<string, any>;
  timestamp: string;
}

export interface NotificationConfig {
  emailEnabled: boolean;
  emailTo?: string;
  slackWebhookUrl?: string;
  genericWebhookUrl?: string;
}

export function getNotificationConfig(): NotificationConfig {
  return {
    emailEnabled: !!process.env.ALERT_EMAIL_TO,
    emailTo: process.env.ALERT_EMAIL_TO,
    slackWebhookUrl: process.env.SLACK_WEBHOOK_URL,
    genericWebhookUrl: process.env.ALERT_WEBHOOK_URL,
  };
}

export async function sendAlert(notification: AlertNotification): Promise<{
  email: boolean;
  slack: boolean;
  webhook: boolean;
  errors: string[];
}> {
  const config = getNotificationConfig();
  const results = { email: false, slack: false, webhook: false, errors: [] as string[] };

  if (config.slackWebhookUrl) {
    try {
      const slackPayload = formatSlackMessage(notification);
      const resp = await fetch(config.slackWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(slackPayload),
      });
      results.slack = resp.ok;
      if (!resp.ok) results.errors.push(`Slack: HTTP ${resp.status}`);
    } catch (err: any) {
      results.errors.push(`Slack: ${err.message}`);
    }
  }

  if (config.genericWebhookUrl) {
    try {
      const resp = await fetch(config.genericWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notification),
      });
      results.webhook = resp.ok;
      if (!resp.ok) results.errors.push(`Webhook: HTTP ${resp.status}`);
    } catch (err: any) {
      results.errors.push(`Webhook: ${err.message}`);
    }
  }

  if (config.emailEnabled && config.emailTo) {
    try {
      const resp = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/notifications/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: config.emailTo,
          subject: `[Busara Alert] ${notification.severity.toUpperCase()}: ${notification.title}`,
          body: notification.message,
          data: notification.data,
        }),
      });
      results.email = resp.ok;
      if (!resp.ok) results.errors.push(`Email: HTTP ${resp.status}`);
    } catch (err: any) {
      results.errors.push(`Email: ${err.message}`);
    }
  }

  return results;
}

function formatSlackMessage(notification: AlertNotification): any {
  const colorMap = { low: '#36a64f', medium: '#f59e0b', high: '#ff6b35', critical: '#ff0000' };
  const emojiMap = { anomaly: '🚨', threshold: '⚠️', fraud: '🔍', system: '🔧' };
  return {
    attachments: [{
      color: colorMap[notification.severity],
      title: `${emojiMap[notification.type]} ${notification.title}`,
      text: notification.message,
      fields: notification.data
        ? Object.entries(notification.data).slice(0, 8).map(([key, value]) => ({
            title: key, value: String(value).substring(0, 500), short: String(value).length < 50,
          }))
        : [],
      footer: 'Busara AI',
      ts: Math.floor(new Date(notification.timestamp).getTime() / 1000),
    }],
  };
}

const recentAlerts = new Map<string, number>();
const DEDUP_WINDOW_MS = 5 * 60 * 1000;

export async function sendAlertDeduplicated(notification: AlertNotification): Promise<boolean> {
  const key = `${notification.type}:${notification.title}`;
  const now = Date.now();
  const lastSent = recentAlerts.get(key);
  if (lastSent && now - lastSent < DEDUP_WINDOW_MS) return false;
  recentAlerts.set(key, now);
  for (const [k, t] of recentAlerts.entries()) {
    if (now - t > DEDUP_WINDOW_MS) recentAlerts.delete(k);
  }
  await sendAlert(notification);
  return true;
}
