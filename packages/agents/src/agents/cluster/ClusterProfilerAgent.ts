/**
 * Cluster Profiler Agent
 * ======================
 *
 * Stage 5 - Cluster
 *
 * Profiles clusters produced by clustering algorithms. Generates
 * detailed persona descriptions, feature distributions, and quality
 * metrics (silhouette score, Davies-Bouldin index) for each cluster.
 */

import { z } from 'zod';
import { AgentStage, AgentTier, AgentStability } from '@busara/core';
import {
  BaseAgent, EnhancedAgentMetadata, EnhancedAgentContext,
  AgentResult, createAgentMetadata,
} from '../../core';
import { mean, stdev, euclideanDistance } from '../../math';

const metadata = createAgentMetadata({
  id: 'cluster_profiler',
  name: 'Cluster Profiler',
  description: 'Profiles clusters with persona descriptions, feature distributions, and quality metrics (silhouette, Davies-Bouldin).',
  version: '1.0.0',
  stage: 'cluster' as AgentStage,
  stageNumber: 5,
  tier: 'core' as AgentTier,
  stability: 'stable' as AgentStability,
  author: 'Busara Team',
  license: 'MIT',
  dependencies: ['auto_ml'],
  timeoutMs: 30000,
  maxRetries: 2,
  capabilities: ['cluster_profiling', 'silhouette_score', 'davies_bouldin', 'persona_generation'],
  category: 'clustering',
  tags: ['cluster', 'profiling', 'silhouette', 'persona', 'segmentation'],
  inputDescription: 'Dataframe with cluster assignments and feature columns',
  outputDescription: 'Cluster profiles with quality metrics and persona descriptions',
  inputSchema: {
    schema: z.object({
      dataframe: z.array(z.record(z.string(), z.unknown())),
      clusterColumn: z.string(),
      featureColumns: z.array(z.string()).optional(),
    }),
    description: 'Dataframe with cluster assignments',
  },
  outputSchema: {
    schema: z.object({
      clusterProfiles: z.array(z.object({
        clusterId: z.number(),
        size: z.number(),
        percentage: z.number(),
        centroid: z.record(z.string(), z.number()),
        featureStats: z.record(z.string(), z.object({
          mean: z.number(),
          stdev: z.number(),
          min: z.number(),
          max: z.number(),
        })),
        persona: z.string(),
        distinguishingFeatures: z.array(z.object({
          feature: z.string(),
          value: z.number(),
          globalMean: z.number(),
          deviation: z.number(),
        })),
      })),
      qualityMetrics: z.object({
        silhouetteScore: z.number(),
        daviesBouldinIndex: z.number(),
        calinskiHarabaszIndex: z.number(),
        inertia: z.number(),
      }),
      summary: z.object({
        numClusters: z.number(),
        totalPoints: z.number(),
        largestCluster: z.number(),
        smallestCluster: z.number(),
      }),
    }),
    description: 'Cluster profiling results',
  },
  configSchema: {
    schema: z.object({
      maxPersonas: z.number().int().min(1).max(20).default(5),
    }),
    defaults: { maxPersonas: 5 },
  },
});

export class ClusterProfilerAgent extends BaseAgent {
  readonly metadata = metadata;

  async execute(context: EnhancedAgentContext): Promise<AgentResult> {
    const { dataframe, clusterColumn, featureColumns } = context.inputs as {
      dataframe: Record<string, unknown>[];
      clusterColumn: string;
      featureColumns?: string[];
    };

    // Determine feature columns
    const features = featureColumns || this.getNumericColumns(dataframe).filter(c => c !== clusterColumn);
    if (features.length === 0) {
      return this.createError('No numeric feature columns found');
    }

    // Group by cluster
    const clusters = new Map<number, Record<string, unknown>[]>();
    for (const row of dataframe) {
      const clusterId = Number(row[clusterColumn]);
      if (isNaN(clusterId)) continue;
      if (!clusters.has(clusterId)) clusters.set(clusterId, []);
      clusters.get(clusterId)!.push(row);
    }

    const clusterIds = Array.from(clusters.keys()).sort((a, b) => a - b);
    const totalPoints = dataframe.length;

    // Calculate global means for comparison
    const globalMeans: Record<string, number> = {};
    for (const f of features) {
      const values = dataframe.map(r => Number(r[f])).filter(v => !isNaN(v));
      globalMeans[f] = mean(values);
    }

    // Profile each cluster
    const clusterProfiles = clusterIds.map(clusterId => {
      const clusterData = clusters.get(clusterId)!;
      const size = clusterData.length;
      const percentage = (size / totalPoints) * 100;

      // Centroid
      const centroid: Record<string, number> = {};
      const featureStats: Record<string, { mean: number; stdev: number; min: number; max: number }> = {};

      for (const f of features) {
        const values = clusterData.map(r => Number(r[f])).filter(v => !isNaN(v));
        if (values.length > 0) {
          centroid[f] = mean(values);
          featureStats[f] = {
            mean: mean(values),
            stdev: values.length > 1 ? stdev(values) : 0,
            min: Math.min(...values),
            max: Math.max(...values),
          };
        }
      }

      // Distinguishing features (largest deviation from global mean)
      const distinguishingFeatures = features
        .map(f => ({
          feature: f,
          value: centroid[f] ?? 0,
          globalMean: globalMeans[f],
          deviation: globalMeans[f] !== 0
            ? ((centroid[f] ?? 0) - globalMeans[f]) / Math.abs(globalMeans[f])
            : 0,
        }))
        .sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation))
        .slice(0, 5);

      // Generate persona description
      const persona = this.generatePersona(clusterId, size, percentage, distinguishingFeatures);

      return {
        clusterId,
        size,
        percentage,
        centroid,
        featureStats,
        persona,
        distinguishingFeatures,
      };
    });

    // Calculate quality metrics
    const dataPoints = dataframe.map(row => ({
      cluster: Number(row[clusterColumn]),
      features: features.map(f => Number(row[f])),
    })).filter(d => !isNaN(d.cluster) && d.features.every(v => !isNaN(v)));

    const qualityMetrics = this.calculateQualityMetrics(dataPoints, clusterIds);

        return this.createResult({
        clusterProfiles,
        qualityMetrics,
        summary: {
          numClusters: clusterIds.length,
          totalPoints,
          largestCluster: clusterProfiles.reduce((a, b) => a.size > b.size ? a : b).clusterId,
          smallestCluster: clusterProfiles.reduce((a, b) => a.size < b.size ? a : b).clusterId,
        },
      }, { silhouette: qualityMetrics.silhouetteScore, inputRows: dataframe.length, outputRows: clusterProfiles.length });
  }

  // ─── Generate persona description ────────────────────────────────
  private generatePersona(
    clusterId: number, size: number, percentage: number,
    features: { feature: string; deviation: number }[],
  ): string {
    const topFeatures = features.slice(0, 3);
    const traits: string[] = [];

    for (const f of topFeatures) {
      const direction = f.deviation > 0 ? 'high' : 'low';
      const magnitude = Math.abs(f.deviation) > 0.5 ? 'very' : 'moderately';
      traits.push(`${magnitude} ${direction} ${f.feature.replace(/_/g, ' ')}`);
    }

    const traitsStr = traits.length > 0 ? traits.join(', ') : 'average characteristics';
    return `Cluster ${clusterId} (${size} members, ${percentage.toFixed(1)}% of data): Characterized by ${traitsStr}.`;
  }

  // ─── Calculate clustering quality metrics ────────────────────────
  private calculateQualityMetrics(
    data: { cluster: number; features: number[] }[],
    clusterIds: number[],
  ): {
    silhouetteScore: number; daviesBouldinIndex: number;
    calinskiHarabaszIndex: number; inertia: number;
  } {
    if (data.length === 0 || clusterIds.length === 0) {
      return { silhouetteScore: 0, daviesBouldinIndex: 0, calinskiHarabaszIndex: 0, inertia: 0 };
    }

    // Calculate centroids
    const centroids = new Map<number, number[]>();
    for (const cid of clusterIds) {
      const clusterPoints = data.filter(d => d.cluster === cid);
      if (clusterPoints.length > 0) {
        const centroid = clusterPoints[0].features.map((_, i) =>
          mean(clusterPoints.map(p => p.features[i]))
        );
        centroids.set(cid, centroid);
      }
    }

    // Inertia (within-cluster sum of squares)
    let inertia = 0;
    for (const point of data) {
      const centroid = centroids.get(point.cluster);
      if (centroid) {
        inertia += euclideanDistance(point.features, centroid) ** 2;
      }
    }

    // Silhouette score (sample if too many points)
    const sample = data.length > 1000 ? data.slice(0, 1000) : data;
    let silhouetteSum = 0;
    for (const point of sample) {
      const a = this.meanIntraClusterDistance(point, data, centroids);
      const b = this.minInterClusterDistance(point, data, centroids);
      const s = (a + b) > 0 ? (b - a) / Math.max(a, b) : 0;
      silhouetteSum += s;
    }
    const silhouetteScore = sample.length > 0 ? silhouetteSum / sample.length : 0;

    // Davies-Bouldin index
    let dbSum = 0;
    for (const ci of clusterIds) {
      let maxRatio = 0;
      for (const cj of clusterIds) {
        if (ci === cj) continue;
        const ciPoints = data.filter(d => d.cluster === ci);
        const cjPoints = data.filter(d => d.cluster === cj);
        if (ciPoints.length === 0 || cjPoints.length === 0) continue;

        const si = this.avgDistToCentroid(ciPoints, centroids.get(ci));
        const sj = this.avgDistToCentroid(cjPoints, centroids.get(cj));
        const dij = euclideanDistance(centroids.get(ci)!, centroids.get(cj)!);
        if (dij > 0) maxRatio = Math.max(maxRatio, (si + sj) / dij);
      }
      dbSum += maxRatio;
    }
    const daviesBouldinIndex = clusterIds.length > 0 ? dbSum / clusterIds.length : 0;

    // Calinski-Harabasz index
    const globalCentroid = data[0].features.map((_, i) =>
      mean(data.map(p => p.features[i]))
    );
    let bgVar = 0;
    let wgVar = 0;
    for (const cid of clusterIds) {
      const clusterPoints = data.filter(d => d.cluster === cid);
      const centroid = centroids.get(cid)!;
      bgVar += clusterPoints.length * euclideanDistance(centroid, globalCentroid) ** 2;
      for (const p of clusterPoints) {
        wgVar += euclideanDistance(p.features, centroid) ** 2;
      }
    }
    const k = clusterIds.length;
    const n = data.length;
    const calinskiHarabaszIndex = wgVar > 0 && k > 1
      ? (bgVar / (k - 1)) / (wgVar / (n - k))
      : 0;

    return { silhouetteScore, daviesBouldinIndex, calinskiHarabaszIndex, inertia };
  }

  private meanIntraClusterDistance(
    point: { cluster: number; features: number[] },
    data: { cluster: number; features: number[] }[],
    centroids: Map<number, number[]>,
  ): number {
    const clusterPoints = data.filter(d => d.cluster === point.cluster && d !== point);
    if (clusterPoints.length === 0) return 0;
    const sum = clusterPoints.reduce((acc, p) => acc + euclideanDistance(point.features, p.features), 0);
    return sum / clusterPoints.length;
  }

  private minInterClusterDistance(
    point: { cluster: number; features: number[] },
    data: { cluster: number; features: number[] }[],
    centroids: Map<number, number[]>,
  ): number {
    let minDist = Infinity;
    for (const [cid, centroid] of centroids) {
      if (cid === point.cluster) continue;
      const dist = euclideanDistance(point.features, centroid);
      minDist = Math.min(minDist, dist);
    }
    return minDist === Infinity ? 0 : minDist;
  }

  private avgDistToCentroid(points: { features: number[] }[], centroid?: number[]): number {
    if (!centroid || points.length === 0) return 0;
    const sum = points.reduce((acc, p) => acc + euclideanDistance(p.features, centroid), 0);
    return sum / points.length;
  }

  private getNumericColumns(dataframe: Record<string, unknown>[]): string[] {
    if (dataframe.length === 0) return [];
    const sample = dataframe[0];
    return Object.keys(sample).filter(key => {
      const val = sample[key];
      return typeof val === 'number' || (!isNaN(Number(val)) && val !== null && val !== '');
    });
  }
}

export default ClusterProfilerAgent;
