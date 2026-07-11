/**
 * A/B Test Significance Agent
 * ===========================
 *
 * Stage 4 - Infer
 *
 * Performs statistical significance testing for A/B experiments using
 * two-sample t-tests (for continuous metrics) and chi-square tests
 * (for conversion rates). Calculates p-values, confidence intervals,
 * and effect sizes (Cohen's d).
 */

import { z } from 'zod';
import { AgentStage, AgentTier, AgentStability } from '@busara/core';
import {
  BaseAgent, EnhancedAgentMetadata, EnhancedAgentContext,
  AgentResult, createAgentMetadata,
} from '../../core';
import { mean, stdev } from '../../math';

const metadata = createAgentMetadata({
  id: 'ab_test_significance',
  name: 'A/B Test Significance',
  description: 'Performs two-sample t-tests and chi-square tests for A/B experiments with p-values, confidence intervals, and effect sizes (Cohen\'s d).',
  version: '1.0.0',
  stage: 'infer' as AgentStage,
  stageNumber: 4,
  tier: 'core' as AgentTier,
  stability: 'stable' as AgentStability,
  author: 'Busara Team',
  license: 'MIT',
  dependencies: ['data_engineer'],
  timeoutMs: 15000,
  maxRetries: 2,
  capabilities: ['ab_testing', 't_test', 'chi_square', 'effect_size'],
  category: 'inference',
  tags: ['ab-testing', 'significance', 't-test', 'chi-square', 'cohen-d'],
  inputDescription: 'Dataframe with group column (A/B) and metric column',
  outputDescription: 'Significance test results with p-value, CI, and effect size',
  inputSchema: {
    schema: z.object({
      dataframe: z.array(z.record(z.string(), z.unknown())),
      groupColumn: z.string(),
      metricColumn: z.string(),
    }),
    description: 'Dataframe with group and metric columns',
  },
  outputSchema: {
    schema: z.object({
      testType: z.enum(['t_test', 'chi_square']),
      groupA: z.object({
        name: z.string(), count: z.number(), mean: z.number().optional(),
        stdev: z.number().optional(), conversionRate: z.number().optional(),
      }),
      groupB: z.object({
        name: z.string(), count: z.number(), mean: z.number().optional(),
        stdev: z.number().optional(), conversionRate: z.number().optional(),
      }),
      statistic: z.number(),
      pValue: z.number(),
      isSignificant: z.boolean(),
      effectSize: z.number().optional(),
      effectSizeLabel: z.string().optional(),
      confidenceInterval: z.object({
        lower: z.number(), upper: z.number(), level: z.number(),
      }),
      recommendation: z.string(),
    }),
    description: 'A/B test significance results',
  },
  configSchema: {
    schema: z.object({
      significanceLevel: z.number().min(0).max(1).default(0.05),
      testType: z.enum(['auto', 't_test', 'chi_square']).default('auto'),
    }),
    defaults: { significanceLevel: 0.05, testType: 'auto' },
  },
});

export class ABTestSignificanceAgent extends BaseAgent {
  readonly metadata = metadata;

  async execute(context: EnhancedAgentContext): Promise<AgentResult> {
    const { dataframe, groupColumn, metricColumn } = context.inputs as {
      dataframe: Record<string, unknown>[];
      groupColumn: string;
      metricColumn: string;
    };
    const config = { ...metadata.configSchema.defaults, ...(context.config || {}) };
    const sigLevel = config.significanceLevel ?? 0.05;

    // Split into groups
    const groups = this.splitByGroup(dataframe, groupColumn);
    const groupKeys = Object.keys(groups).sort();
    if (groupKeys.length < 2) {
      return this.createError('Need at least 2 groups for A/B test');
    }

    const groupAData = groups[groupKeys[0]];
    const groupBData = groups[groupKeys[1]];

    // Determine test type
    const metricValues = groupAData.map(row => row[metricColumn]).filter(v => v !== null && v !== undefined);
    const isBinary = metricValues.every(v => v === 0 || v === 1 || v === true || v === false);
    const testType = config.testType === 'auto' ? (isBinary ? 'chi_square' : 't_test') : config.testType;

    let result;
    if (testType === 'chi_square') {
      result = this.chiSquareTest(groupAData, groupBData, metricColumn, groupKeys[0], groupKeys[1]);
    } else {
      result = this.tTest(groupAData, groupBData, metricColumn, groupKeys[0], groupKeys[1]);
    }

    const isSignificant = result.pValue < sigLevel;
    const recommendation = this.getRecommendation(isSignificant, result, testType, sigLevel);

        return this.createResult({
        ...result,
        testType,
        isSignificant,
        recommendation,
      }, { inputRows: dataframe.length, outputRows: 1 });
  }

  // ─── Two-sample t-test (Welch's) ─────────────────────────────────
  private tTest(
    groupA: Record<string, unknown>[], groupB: Record<string, unknown>[],
    metricColumn: string, nameA: string, nameB: string,
  ): any {
    const valuesA = groupA.map(r => Number(r[metricColumn])).filter(v => !isNaN(v));
    const valuesB = groupB.map(r => Number(r[metricColumn])).filter(v => !isNaN(v));

    const meanA = mean(valuesA);
    const meanB = mean(valuesB);
    const stdevA = stdev(valuesA);
    const stdevB = stdev(valuesB);
    const nA = valuesA.length;
    const nB = valuesB.length;

    // Welch's t-test
    const se = Math.sqrt(stdevA ** 2 / nA + stdevB ** 2 / nB);
    const t = se > 0 ? (meanB - meanA) / se : 0;

    // Welch-Satterthwaite degrees of freedom
    const num = (stdevA ** 2 / nA + stdevB ** 2 / nB) ** 2;
    const denom = (stdevA ** 2 / nA) ** 2 / (nA - 1) + (stdevB ** 2 / nB) ** 2 / (nB - 1);
    const df = denom > 0 ? num / denom : nA + nB - 2;

    // Two-tailed p-value (using normal approximation for large df)
    const pValue = 2 * (1 - this.normalCDF(Math.abs(t)));

    // Cohen's d effect size
    const pooledStdev = Math.sqrt((stdevA ** 2 + stdevB ** 2) / 2);
    const effectSize = pooledStdev > 0 ? (meanB - meanA) / pooledStdev : 0;
    const effectSizeLabel = Math.abs(effectSize) < 0.2 ? 'negligible'
      : Math.abs(effectSize) < 0.5 ? 'small'
      : Math.abs(effectSize) < 0.8 ? 'medium'
      : 'large';

    // 95% confidence interval for difference of means
    const margin = 1.96 * se;
    const diff = meanB - meanA;

    return {
      groupA: { name: nameA, count: nA, mean: meanA, stdev: stdevA },
      groupB: { name: nameB, count: nB, mean: meanB, stdev: stdevB },
      statistic: t,
      pValue,
      effectSize,
      effectSizeLabel,
      confidenceInterval: { lower: diff - margin, upper: diff + margin, level: 0.95 },
    };
  }

  // ─── Chi-square test for conversion rates ────────────────────────
  private chiSquareTest(
    groupA: Record<string, unknown>[], groupB: Record<string, unknown>[],
    metricColumn: string, nameA: string, nameB: string,
  ): any {
    const conversionsA = groupA.filter(r => Number(r[metricColumn]) === 1 || r[metricColumn] === true).length;
    const conversionsB = groupB.filter(r => Number(r[metricColumn]) === 1 || r[metricColumn] === true).length;
    const nA = groupA.length;
    const nB = groupB.length;
    const nTotal = nA + nB;
    const conversionsTotal = conversionsA + conversionsB;

    const rateA = nA > 0 ? conversionsA / nA : 0;
    const rateB = nB > 0 ? conversionsB / nB : 0;

    // Chi-square 2x2 contingency table
    const expectedAConversions = (nA * conversionsTotal) / nTotal;
    const expectedBConversions = (nB * conversionsTotal) / nTotal;
    const expectedANon = nA - expectedAConversions;
    const expectedBNon = nB - expectedBConversions;

    const chi2 =
      ((conversionsA - expectedAConversions) ** 2 / Math.max(1, expectedAConversions)) +
      ((conversionsB - expectedBConversions) ** 2 / Math.max(1, expectedBConversions)) +
      (((nA - conversionsA) - expectedANon) ** 2 / Math.max(1, expectedANon)) +
      (((nB - conversionsB) - expectedBNon) ** 2 / Math.max(1, expectedBNon));

    // p-value from chi-square with 1 df (normal approximation)
    const z = Math.sqrt(chi2);
    const pValue = 2 * (1 - this.normalCDF(z));

    // Effect size: Cohen's h
    const h = 2 * Math.asin(Math.sqrt(rateB)) - 2 * Math.asin(Math.sqrt(rateA));
    const effectSizeLabel = Math.abs(h) < 0.2 ? 'negligible'
      : Math.abs(h) < 0.5 ? 'small'
      : Math.abs(h) < 0.8 ? 'medium'
      : 'large';

    // 95% CI for difference of proportions
    const se = Math.sqrt(rateA * (1 - rateA) / nA + rateB * (1 - rateB) / nB);
    const margin = 1.96 * se;
    const diff = rateB - rateA;

    return {
      groupA: { name: nameA, count: nA, conversionRate: rateA },
      groupB: { name: nameB, count: nB, conversionRate: rateB },
      statistic: chi2,
      pValue,
      effectSize: h,
      effectSizeLabel,
      confidenceInterval: { lower: diff - margin, upper: diff + margin, level: 0.95 },
    };
  }

  private getRecommendation(
    isSignificant: boolean, result: any, testType: string, sigLevel: number,
  ): string {
    if (isSignificant) {
      const winner = result.groupB.mean > result.groupB.mean || result.groupB.conversionRate > result.groupA.conversionRate
        ? result.groupB.name : result.groupA.name;
      return `Statistically significant result (p=${result.pValue.toFixed(4)} < ${sigLevel}). ${winner} performs better. Effect size: ${result.effectSizeLabel}.`;
    } else {
      return `No statistically significant difference (p=${result.pValue.toFixed(4)} ≥ ${sigLevel}). Cannot reject null hypothesis. Consider collecting more data.`;
    }
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

export default ABTestSignificanceAgent;
