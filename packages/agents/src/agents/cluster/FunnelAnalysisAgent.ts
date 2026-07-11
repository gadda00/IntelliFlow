/**
 * Funnel Analysis Agent
 * =====================
 *
 * Stage 5 - Cluster
 *
 * Analyzes conversion funnels by tracking user progression through
 * defined stages. Calculates drop-off rates, conversion rates,
 * and time-to-convert for each funnel step.
 */

import { z } from 'zod';
import { AgentStage, AgentTier, AgentStability } from '@busara/core';
import {
  BaseAgent, EnhancedAgentMetadata, EnhancedAgentContext,
  AgentResult, createAgentMetadata,
} from '../../core';

const metadata = createAgentMetadata({
  id: 'funnel_analysis',
  name: 'Funnel Analysis',
  description: 'Analyzes conversion funnels with drop-off rates, conversion rates, and time-to-convert for each stage.',
  version: '1.0.0',
  stage: 'cluster' as AgentStage,
  stageNumber: 5,
  tier: 'core' as AgentTier,
  stability: 'stable' as AgentStability,
  author: 'Busara Team',
  license: 'MIT',
  dependencies: ['data_engineer'],
  timeoutMs: 20000,
  maxRetries: 2,
  capabilities: ['funnel_analysis', 'conversion_tracking', 'drop_off_analysis', 'time_to_convert'],
  category: 'analytics',
  tags: ['funnel', 'conversion', 'drop-off', 'analytics', 'user-journey'],
  inputDescription: 'Dataframe with user ID, event/stage, and timestamp',
  outputDescription: 'Funnel metrics with conversion and drop-off rates per stage',
  inputSchema: {
    schema: z.object({
      dataframe: z.array(z.record(z.string(), z.unknown())),
      userIdColumn: z.string(),
      stageColumn: z.string(),
      timestampColumn: z.string(),
    }),
    description: 'Dataframe with user, stage, and timestamp',
  },
  outputSchema: {
    schema: z.object({
      stages: z.array(z.object({
        stage: z.string(),
        users: z.number(),
        conversionRate: z.number(),
        dropOffRate: z.number(),
        dropOffCount: z.number(),
        avgTimeToConvert: z.number().nullable(),
      })),
      overallConversionRate: z.number(),
      totalUsers: z.number(),
      totalConverted: z.number(),
      bottleneck: z.object({
        stage: z.string(),
        dropOffRate: z.number(),
      }),
    }),
    description: 'Funnel analysis results',
  },
  configSchema: {
    schema: z.object({
      stageOrder: z.array(z.string()).optional(),
    }),
    defaults: {},
  },
});

export class FunnelAnalysisAgent extends BaseAgent {
  readonly metadata = metadata;

  async execute(context: EnhancedAgentContext): Promise<AgentResult> {
    const { dataframe, userIdColumn, stageColumn, timestampColumn } = context.inputs as {
      dataframe: Record<string, unknown>[];
      userIdColumn: string;
      stageColumn: string;
      timestampColumn: string;
    };
    const config = { ...metadata.configSchema.defaults, ...(context.config || {}) };

    // Track each user's progression through stages
    const userStages = new Map<string, Map<string, Date>>();

    for (const row of dataframe) {
      const userId = String(row[userIdColumn]);
      const stage = String(row[stageColumn]);
      const timestamp = new Date(String(row[timestampColumn]));
      if (isNaN(timestamp.getTime())) continue;

      if (!userStages.has(userId)) userStages.set(userId, new Map());
      const userMap = userStages.get(userId)!;
      if (!userMap.has(stage) || timestamp < userMap.get(stage)!) {
        userMap.set(stage, timestamp);
      }
    }

    // Determine stage order
    const stageSet = new Set<string>();
    for (const userMap of userStages.values()) {
      for (const stage of userMap.keys()) stageSet.add(stage);
    }
    const stages = config.stageOrder
      ? config.stageOrder.filter(s => stageSet.has(s))
      : Array.from(stageSet).sort();

    if (stages.length === 0) {
      return this.createError('No valid stages found');
    }

    // Count users at each stage (sequential progression)
    const stageCounts = new Array(stages.length).fill(0);
    const stageTimes: number[][] = new Array(stages.length).fill(null).map(() => []);

    for (const [userId, userMap] of userStages) {
      // Check if user progressed through stages in order
      let prevTime: Date | null = null;
      for (let i = 0; i < stages.length; i++) {
        const stageTime = userMap.get(stages[i]);
        if (!stageTime) break;
        if (prevTime && stageTime < prevTime) break; // Must be sequential

        stageCounts[i]++;
        if (prevTime) {
          stageTimes[i].push(stageTime.getTime() - prevTime.getTime());
        }
        prevTime = stageTime;
      }
    }

    // Build stage results
    const stageResults = stages.map((stage, i) => {
      const users = stageCounts[i];
      const prevUsers = i > 0 ? stageCounts[i - 1] : users;
      const conversionRate = i === 0 ? 1 : (prevUsers > 0 ? users / prevUsers : 0);
      const dropOffRate = i === 0 ? 0 : 1 - conversionRate;
      const dropOffCount = prevUsers - users;
      const avgTimeToConvert = stageTimes[i].length > 0
        ? stageTimes[i].reduce((a, b) => a + b, 0) / stageTimes[i].length / (1000 * 60 * 60 * 24) // days
        : null;

      return {
        stage,
        users,
        conversionRate,
        dropOffRate,
        dropOffCount,
        avgTimeToConvert,
      };
    });

    // Find bottleneck (highest drop-off)
    let bottleneck = { stage: stages[0], dropOffRate: 0 };
    for (let i = 1; i < stageResults.length; i++) {
      if (stageResults[i].dropOffRate > bottleneck.dropOffRate) {
        bottleneck = { stage: stageResults[i].stage, dropOffRate: stageResults[i].dropOffRate };
      }
    }

    const totalUsers = stageCounts[0];
    const totalConverted = stageCounts[stages.length - 1];
    const overallConversionRate = totalUsers > 0 ? totalConverted / totalUsers : 0;

        return this.createResult({
        stages: stageResults,
        overallConversionRate,
        totalUsers,
        totalConverted,
        bottleneck,
      }, { inputRows: dataframe.length, outputRows: stageResults.length });
  }
}

export default FunnelAnalysisAgent;
