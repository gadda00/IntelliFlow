/**
 * Cohort Analysis Agent
 * =====================
 *
 * Stage 4 - Infer
 *
 * Performs cohort analysis by grouping users by acquisition period
 * and tracking retention/metrics over time. Generates retention
 * matrices, churn rates, and cohort-level comparisons.
 */

import { z } from 'zod';
import { AgentStage, AgentTier, AgentStability } from '@busara/core';
import {
  BaseAgent, EnhancedAgentMetadata, EnhancedAgentContext,
  AgentResult, createAgentMetadata,
} from '../../core';

const metadata = createAgentMetadata({
  id: 'cohort_analysis',
  name: 'Cohort Analysis',
  description: 'Groups users by acquisition period and tracks retention, churn, and metrics over time. Generates retention matrices and cohort comparisons.',
  version: '1.0.0',
  stage: 'infer' as AgentStage,
  stageNumber: 4,
  tier: 'core' as AgentTier,
  stability: 'stable' as AgentStability,
  author: 'Busara Team',
  license: 'MIT',
  dependencies: ['data_engineer'],
  timeoutMs: 20000,
  maxRetries: 2,
  capabilities: ['cohort_analysis', 'retention', 'churn', 'customer_lifecycle'],
  category: 'inference',
  tags: ['cohort', 'retention', 'churn', 'lifecycle', 'analytics'],
  inputDescription: 'Dataframe with user ID, acquisition date, and activity dates',
  outputDescription: 'Retention matrix, churn rates, and cohort comparisons',
  inputSchema: {
    schema: z.object({
      dataframe: z.array(z.record(z.string(), z.unknown())),
      userIdColumn: z.string(),
      dateColumn: z.string(),
      activityColumn: z.string().optional(),
    }),
    description: 'Dataframe with user ID and date columns',
  },
  outputSchema: {
    schema: z.object({
      cohorts: z.array(z.object({
        cohortLabel: z.string(),
        cohortSize: z.number(),
        retention: z.array(z.object({
          period: z.number(),
          activeUsers: z.number(),
          retentionRate: z.number(),
        })),
      })),
      retentionMatrix: z.array(z.array(z.number())),
      summary: z.object({
        totalCohorts: z.number(),
        totalUsers: z.number(),
        averageRetention: z.record(z.string(), z.number()),
        bestCohort: z.string(),
        worstCohort: z.string(),
      }),
    }),
    description: 'Cohort analysis results',
  },
  configSchema: {
    schema: z.object({
      cohortPeriod: z.enum(['day', 'week', 'month']).default('month'),
      maxPeriods: z.number().int().min(1).max(24).default(12),
    }),
    defaults: { cohortPeriod: 'month', maxPeriods: 12 },
  },
});

export class CohortAnalysisAgent extends BaseAgent {
  readonly metadata = metadata;

  async execute(context: EnhancedAgentContext): Promise<AgentResult> {
    const { dataframe, userIdColumn, dateColumn } = context.inputs as {
      dataframe: Record<string, unknown>[];
      userIdColumn: string;
      dateColumn: string;
    };
    const config = { ...metadata.configSchema.defaults, ...(context.config || {}) };
    const maxPeriods = config.maxPeriods ?? 12;

    // Group events by user, track first activity date
    const userFirstActivity = new Map<string, Date>();
    const userActivities = new Map<string, Set<string>>();

    for (const row of dataframe) {
      const userId = String(row[userIdColumn]);
      const dateStr = String(row[dateColumn]);
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) continue;

      if (!userFirstActivity.has(userId) || date < userFirstActivity.get(userId)!) {
        userFirstActivity.set(userId, date);
      }
      if (!userActivities.has(userId)) userActivities.set(userId, new Set());
      userActivities.get(userId)!.add(this.formatPeriod(date, config.cohortPeriod));
    }

    // Group users into cohorts by first activity period
    const cohorts = new Map<string, string[]>();
    for (const [userId, firstDate] of userFirstActivity) {
      const cohortLabel = this.formatPeriod(firstDate, config.cohortPeriod);
      if (!cohorts.has(cohortLabel)) cohorts.set(cohortLabel, []);
      cohorts.get(cohortLabel)!.push(userId);
    }

    // Calculate retention for each cohort
    const cohortResults = Array.from(cohorts.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([cohortLabel, users]) => {
        const cohortSize = users.length;
        const cohortDate = this.parsePeriod(cohortLabel, config.cohortPeriod);
        const retention: { period: number; activeUsers: number; retentionRate: number }[] = [];

        for (let p = 0; p <= maxPeriods; p++) {
          const periodDate = this.addPeriod(cohortDate, p, config.cohortPeriod);
          const periodLabel = this.formatPeriod(periodDate, config.cohortPeriod);
          let activeUsers = 0;
          for (const userId of users) {
            if (userActivities.get(userId)!.has(periodLabel)) activeUsers++;
          }
          retention.push({
            period: p,
            activeUsers,
            retentionRate: cohortSize > 0 ? activeUsers / cohortSize : 0,
          });
        }
        return { cohortLabel, cohortSize, retention };
      });

    // Build retention matrix (cohorts × periods)
    const retentionMatrix = cohortResults.map(c =>
      c.retention.map(r => r.retentionRate),
    );

    // Summary
    const averageRetention: Record<string, number> = {};
    for (let p = 0; p <= maxPeriods; p++) {
      const values = cohortResults
        .map(c => c.retention[p]?.retentionRate)
        .filter(v => v !== undefined && v !== null) as number[];
      if (values.length > 0) {
        averageRetention[`period_${p}`] = values.reduce((a, b) => a + b, 0) / values.length;
      }
    }

    // Find best/worst cohorts by average retention
    let bestCohort = '';
    let worstCohort = '';
    let bestRate = -1;
    let worstRate = 2;
    for (const c of cohortResults) {
      const avgRate = c.retention.reduce((a, r) => a + r.retentionRate, 0) / c.retention.length;
      if (avgRate > bestRate) { bestRate = avgRate; bestCohort = c.cohortLabel; }
      if (avgRate < worstRate) { worstRate = avgRate; worstCohort = c.cohortLabel; }
    }

        return this.createResult({
        cohorts: cohortResults,
        retentionMatrix,
        summary: {
          totalCohorts: cohortResults.length,
          totalUsers: userFirstActivity.size,
          averageRetention,
          bestCohort,
          worstCohort,
        },
      }, { inputRows: dataframe.length, outputRows: cohortResults.length });
  }

  // ─── Date helpers ────────────────────────────────────────────────
  private formatPeriod(date: Date, period: string): string {
    if (period === 'day') return date.toISOString().slice(0, 10);
    if (period === 'week') {
      const week = this.getISOWeek(date);
      return `${date.getFullYear()}-W${String(week).padStart(2, '0')}`;
    }
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  private parsePeriod(label: string, period: string): Date {
    if (period === 'day') return new Date(label);
    if (period === 'week') {
      const [year, week] = label.split('-W');
      const date = new Date(parseInt(year), 0, 1 + (parseInt(week) - 1) * 7);
      return date;
    }
    const [year, month] = label.split('-');
    return new Date(parseInt(year), parseInt(month) - 1, 1);
  }

  private addPeriod(date: Date, n: number, period: string): Date {
    const result = new Date(date);
    if (period === 'day') result.setDate(result.getDate() + n);
    else if (period === 'week') result.setDate(result.getDate() + n * 7);
    else result.setMonth(result.getMonth() + n);
    return result;
  }

  private getISOWeek(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  }
}

export default CohortAnalysisAgent;
