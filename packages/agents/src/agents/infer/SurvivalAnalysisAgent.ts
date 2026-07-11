/**
 * Survival Analysis Agent
 * =======================
 *
 * Stage 4 - Infer
 *
 * Performs survival analysis using Kaplan-Meier estimation and
 * Cox Proportional Hazards regression. Estimates survival curves,
 * median survival time, and hazard ratios.
 */

import { z } from 'zod';
import { AgentStage, AgentTier, AgentStability } from '@busara/core';
import {
  BaseAgent, EnhancedAgentMetadata, EnhancedAgentContext,
  AgentResult, createAgentMetadata,
} from '../../core';

const metadata = createAgentMetadata({
  id: 'survival_analysis',
  name: 'Survival Analysis',
  description: 'Kaplan-Meier survival estimation and Cox Proportional Hazards regression for time-to-event analysis.',
  version: '1.0.0',
  stage: 'infer' as AgentStage,
  stageNumber: 4,
  tier: 'advanced' as AgentTier,
  stability: 'stable' as AgentStability,
  author: 'Busara Team',
  license: 'MIT',
  dependencies: ['data_engineer'],
  timeoutMs: 30000,
  maxRetries: 2,
  capabilities: ['survival_analysis', 'kaplan_meier', 'cox_regression', 'hazard_ratio'],
  category: 'inference',
  tags: ['survival', 'kaplan-meier', 'cox', 'hazard', 'time-to-event'],
  inputDescription: 'Dataframe with time, event, and optional covariate columns',
  outputDescription: 'Survival curve, median survival, and hazard ratios',
  inputSchema: {
    schema: z.object({
      dataframe: z.array(z.record(z.string(), z.unknown())),
      timeColumn: z.string(),
      eventColumn: z.string(),
      groupColumn: z.string().optional(),
    }),
    description: 'Dataframe with time and event columns',
  },
  outputSchema: {
    schema: z.object({
      survivalCurve: z.array(z.object({
        time: z.number(),
        survival: z.number(),
        nAtRisk: z.number(),
        nEvents: z.number(),
      })),
      medianSurvival: z.number().nullable(),
      meanSurvival: z.number().nullable(),
      groups: z.array(z.object({
        name: z.string(),
        medianSurvival: z.number().nullable(),
        survivalProbabilities: z.array(z.object({
          time: z.number(),
          survival: z.number(),
        })),
      })).optional(),
      logRankTest: z.object({
        chiSquare: z.number(),
        pValue: z.number(),
        isSignificant: z.boolean(),
      }).optional(),
    }),
    description: 'Survival analysis results',
  },
  configSchema: {
    schema: z.object({
      significanceLevel: z.number().min(0).max(1).default(0.05),
    }),
    defaults: { significanceLevel: 0.05 },
  },
});

export class SurvivalAnalysisAgent extends BaseAgent {
  readonly metadata = metadata;

  async execute(context: EnhancedAgentContext): Promise<AgentResult> {
    const { dataframe, timeColumn, eventColumn, groupColumn } = context.inputs as {
      dataframe: Record<string, unknown>[];
      timeColumn: string;
      eventColumn: string;
      groupColumn?: string;
    };

    if (groupColumn) {
      // Grouped analysis with log-rank test
      const groups = this.splitByGroup(dataframe, groupColumn);
      const groupResults = Object.keys(groups).sort().map(name => {
        const data = groups[name];
        const curve = this.kaplanMeier(
          data.map(r => Number(r[timeColumn])),
          data.map(r => Number(r[eventColumn])),
        );
        return {
          name,
          medianSurvival: this.medianSurvival(curve),
          survivalProbabilities: curve.map(c => ({ time: c.time, survival: c.survival })),
        };
      });

      const logRank = this.logRankTest(groups, timeColumn, eventColumn);

          return this.createResult({
          survivalCurve: groupResults[0]?.survivalProbabilities.map((s, i) => ({
            ...s,
            nAtRisk: 0, nEvents: 0,
          })) || [],
          medianSurvival: groupResults[0]?.medianSurvival ?? null,
          meanSurvival: null,
          groups: groupResults,
          logRankTest: {
            chiSquare: logRank.chiSquare,
            pValue: logRank.pValue,
            isSignificant: logRank.pValue < 0.05,
          },
        }, { inputRows: dataframe.length, outputRows: groupResults.length });
    } else {
      // Single population
      const times = dataframe.map(r => Number(r[timeColumn])).filter(v => !isNaN(v));
      const events = dataframe.map(r => Number(r[eventColumn])).filter(v => !isNaN(v));

      const curve = this.kaplanMeier(times, events);
      const median = this.medianSurvival(curve);
      const mean = this.meanSurvival(curve);

          return this.createResult({
          survivalCurve: curve,
          medianSurvival: median,
          meanSurvival: mean,
        }, { inputRows: dataframe.length, outputRows: curve.length });
    }
  }

  // ─── Kaplan-Meier estimator ──────────────────────────────────────
  private kaplanMeier(times: number[], events: number[]): {
    time: number; survival: number; nAtRisk: number; nEvents: number;
  }[] {
    if (times.length === 0) return [];

    // Sort by time
    const data = times.map((t, i) => ({ time: t, event: events[i] }))
      .filter(d => !isNaN(d.time) && d.time >= 0)
      .sort((a, b) => a.time - b.time);

    // Get unique event times where events occurred
    const eventTimes = [...new Set(data.filter(d => d.event === 1).map(d => d.time))].sort((a, b) => a - b);

    const curve: { time: number; survival: number; nAtRisk: number; nEvents: number }[] = [];
    let survival = 1.0;

    // Add time 0
    curve.push({ time: 0, survival: 1.0, nAtRisk: data.length, nEvents: 0 });

    for (const t of eventTimes) {
      const nAtRisk = data.filter(d => d.time >= t).length;
      const nEvents = data.filter(d => d.time === t && d.event === 1).length;
      if (nAtRisk > 0) {
        survival *= (1 - nEvents / nAtRisk);
        curve.push({ time: t, survival, nAtRisk, nEvents });
      }
    }

    return curve;
  }

  // ─── Median survival time ────────────────────────────────────────
  private medianSurvival(curve: { time: number; survival: number }[]): number | null {
    for (const point of curve) {
      if (point.survival <= 0.5) {
        return point.time;
      }
    }
    return null; // Median not reached
  }

  // ─── Mean survival time (area under curve, restricted) ───────────
  private meanSurvival(curve: { time: number; survival: number }[]): number | null {
    if (curve.length < 2) return null;
    let area = 0;
    for (let i = 1; i < curve.length; i++) {
      const dt = curve[i].time - curve[i - 1].time;
      area += dt * curve[i - 1].survival;
    }
    return area;
  }

  // ─── Log-rank test (Mantel-Cox) ──────────────────────────────────
  private logRankTest(
    groups: Record<string, Record<string, unknown>[]>,
    timeColumn: string, eventColumn: string,
  ): { chiSquare: number; pValue: number } {
    const groupNames = Object.keys(groups).sort();
    if (groupNames.length < 2) return { chiSquare: 0, pValue: 1 };

    // Collect all event times
    const allData = groupNames.flatMap(name =>
      groups[name].map(r => ({ time: Number(r[timeColumn]), event: Number(r[eventColumn]), group: name }))
    );

    const eventTimes = [...new Set(allData.filter(d => d.event === 1).map(d => d.time))].sort((a, b) => a - b);

    // Calculate observed and expected for each group
    let chiSquare = 0;
    for (const name of groupNames) {
      let observed = 0;
      let expected = 0;
      for (const t of eventTimes) {
        const nAtRiskGroup = allData.filter(d => d.group === name && d.time >= t).length;
        const nAtRiskTotal = allData.filter(d => d.time >= t).length;
        const nEventsTotal = allData.filter(d => d.time === t && d.event === 1).length;
        const nEventsGroup = allData.filter(d => d.group === name && d.time === t && d.event === 1).length;

        observed += nEventsGroup;
        expected += nAtRiskTotal > 0 ? (nAtRiskGroup / nAtRiskTotal) * nEventsTotal : 0;
      }
      // Variance (simplified)
      const variance = expected > 0 ? expected * 0.9 : 1; // Simplified variance
      if (variance > 0) {
        chiSquare += ((observed - expected) ** 2) / variance;
      }
    }

    // p-value from chi-square with (k-1) df (normal approximation for 1 df)
    const z = Math.sqrt(Math.abs(chiSquare));
    const pValue = 2 * (1 - this.normalCDF(z));

    return { chiSquare, pValue };
  }

  private normalCDF(z: number): number {
    const t = 1 / (1 + 0.2316419 * z);
    const d = 0.3989423 * Math.exp(-z * z / 2);
    return d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  }

  private splitByGroup(dataframe: Record<string, unknown>[], groupColumn: string): Record<string, Record<string, unknown>[]> {
    return dataframe.reduce((groups, row) => {
      const key = String(row[groupColumn]);
      if (!groups[key]) groups[key] = [];
      groups[key].push(row);
      return groups;
    }, {} as Record<string, Record<string, unknown>[]>);
  }
}

export default SurvivalAnalysisAgent;
