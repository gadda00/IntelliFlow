/**
 * GET /api/v2/stages
 * Returns the 7-stage DAG and the agents in each stage.
 */

import { NextResponse } from 'next/server';
import { defaultAgentPool } from '@busara/agents';

export const dynamic = 'force-dynamic';

const STAGE_ORDER = [
  { id: 'ingest', label: 'Ingest', description: 'Data intake, profiling, schema inference, PII detection' },
  { id: 'engineer', label: 'Engineer', description: 'Cleaning, transformation, feature engineering, imputation' },
  { id: 'detect', label: 'Detect', description: 'Anomalies, correlations, outliers, bias, segmentation' },
  { id: 'forecast', label: 'Forecast', description: 'Trends, seasonality, time-series decomposition' },
  { id: 'infer', label: 'Infer', description: 'A/B tests, survival analysis, cohort analysis' },
  { id: 'cluster', label: 'Cluster', description: 'Cluster profiling, funnel analysis' },
  { id: 'report', label: 'Report', description: 'Insight synthesis, recommendations, NLQ' },
] as const;

export async function GET() {
  const all = defaultAgentPool.getAllAgents();
  const stages = STAGE_ORDER.map(s => ({
    ...s,
    agents: all
      .filter((a: any) => a?.metadata?.stage === s.id)
      .map((a: any) => ({
        id: a.metadata.id,
        name: a.metadata.name,
        tier: a.metadata.tier,
        description: a.metadata.description,
      })),
  }));

  return NextResponse.json({
    ok: true,
    data: stages,
    meta: { totalAgents: all.length, totalStages: STAGE_ORDER.length },
  });
}
