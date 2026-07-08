import { describe, it, expect, beforeEach } from 'vitest';
import { KnowledgeGraphBuilderAgent } from '../agents/detect/KnowledgeGraphBuilderAgent';
import { buildContextWithSchema, sampleDataframe, sampleSchema } from './testUtils';

/**
 * KnowledgeGraphBuilderAgent extracts entities from the dataframe's columns,
 * connects them with co-occurrence / correlation / similarity edges, and runs
 * graph analysis. Output shape:
 *
 *   {
 *     knowledgeGraph: { nodes: Entity[], edges: Relationship[] },
 *     statistics: { nodeCount, edgeCount, density, averageDegree,
 *                   connectedComponents, largestComponentSize },
 *     analysis: { centrality, communities, hubs, authorities },
 *     recommendations: Array<unknown>,
 *   }
 *
 * IMPORTANT agent quirks:
 *   1. Entity extraction is gated on `entityExtraction.enabled`. The default
 *      config is `{}`, so without enabling it the agent fails with
 *      "No entities found for knowledge graph".
 *   2. Similarly for relationships: `relationshipExtraction.enabled` must be
 *      true to extract edges.
 */
const ENABLED = (overrides: Record<string, unknown> = {}) => ({
  entityExtraction: {
    enabled: true,
    includeCategorical: true,
    includeNumeric: true,
    minFrequency: 1,
    ...overrides,
  },
  relationshipExtraction: {
    enabled: true,
    minCooccurrence: 1,
    correlationThreshold: 0.5,
  },
});

describe('KnowledgeGraphBuilderAgent', () => {
  let agent: KnowledgeGraphBuilderAgent;

  beforeEach(() => {
    agent = new KnowledgeGraphBuilderAgent();
  });

  it('exposes correct metadata', () => {
    expect(agent.metadata.id).toBe('knowledge_graph_builder');
    expect(agent.metadata.stage).toBe('detect');
    expect(agent.metadata.stageNumber).toBe(2);
    expect(agent.metadata.tier).toBe('advanced');
  });

  it('builds a graph with nodes + edges and reports statistics', async () => {
    const result = await agent.execute(
      buildContextWithSchema(sampleSchema, {
        dataframe: sampleDataframe,
        config: ENABLED(),
      }),
    );
    expect(result.status).toBe('success');

    const output = result.output as {
      knowledgeGraph: {
        nodes: Array<{ id: string; label: string; type: string; sourceColumn: string; degree: number; centrality: number }>;
        edges: Array<{ id: string; source: string; target: string; label: string; type: string; weight: number }>;
      };
      statistics: { nodeCount: number; edgeCount: number; density: number; averageDegree: number; connectedComponents: number; largestComponentSize: number };
      analysis: { centrality: Record<string, unknown>; communities: unknown[]; hubs: unknown[]; authorities: unknown[] };
      recommendations: unknown[];
    };

    expect(output.knowledgeGraph.nodes.length).toBeGreaterThan(0);
    expect(output.statistics.nodeCount).toBe(output.knowledgeGraph.nodes.length);
    expect(output.statistics.edgeCount).toBe(output.knowledgeGraph.edges.length);
    expect(output.statistics.density).toBeGreaterThanOrEqual(0);
    expect(output.statistics.density).toBeLessThanOrEqual(1);
    expect(output.statistics.averageDegree).toBeGreaterThanOrEqual(0);
    expect(output.analysis).toBeDefined();
    expect(Array.isArray(output.recommendations)).toBe(true);

    // Every node has the documented fields
    const firstNode = output.knowledgeGraph.nodes[0];
    expect(firstNode.id).toBeTruthy();
    expect(firstNode.label).toBeTruthy();
    expect(typeof firstNode.degree).toBe('number');
  });

  it('reports nodeCount/edgeCount/density/communitiesFound metrics', async () => {
    const result = await agent.execute(
      buildContextWithSchema(sampleSchema, {
        dataframe: sampleDataframe,
        config: ENABLED(),
      }),
    );
    expect(result.metrics.nodeCount).toBeGreaterThan(0);
    expect(result.metrics.edgeCount).toBeGreaterThanOrEqual(0);
    expect(typeof result.metrics.density).toBe('number');
    expect(typeof result.metrics.communitiesFound).toBe('number');
  });

  it('returns error when entityExtraction is not enabled', async () => {
    const result = await agent.execute(
      buildContextWithSchema(sampleSchema, { dataframe: sampleDataframe }),
    );
    expect(result.status).toBe('failed');
    expect(result.error).toMatch(/no entities/i);
  });

  it('returns error when no categorical/string/numeric entities are available', async () => {
    const result = await agent.execute(
      buildContextWithSchema(
        { x: { type: 'integer', confidence: 1, nullCount: 0, uniqueCount: 3 } },
        {
          dataframe: [{ x: 1 }, { x: 2 }, { x: 3 }],
          config: {
            entityExtraction: { enabled: true, includeCategorical: true, includeNumeric: false, minFrequency: 1 },
            relationshipExtraction: { enabled: true, minCooccurrence: 1, correlationThreshold: 0.5 },
          },
        },
      ),
    );
    expect(result.status).toBe('failed');
    expect(result.error).toMatch(/no entities/i);
  });

  it('returns error for empty dataframe', async () => {
    const result = await agent.execute(buildContextWithSchema({}, { dataframe: [], config: ENABLED() }));
    expect(result.status).toBe('failed');
    expect(result.error).toMatch(/no data/i);
  });

  it('returns error for null input', async () => {
    const result = await agent.execute(
      buildContextWithSchema({}, { dataframe: null as unknown as Record<string, unknown>[], config: ENABLED() }),
    );
    expect(result.status).toBe('failed');
  });

  it('respects maxEntities config', async () => {
    // 5 rows × 1 categorical column = 5 distinct entities; cap at 2.
    const df = [
      { cat: 'a' }, { cat: 'b' }, { cat: 'c' }, { cat: 'd' }, { cat: 'e' },
    ];
    const schema = { cat: { type: 'string', confidence: 1, nullCount: 0, uniqueCount: 5 } };
    const result = await agent.execute(
      buildContextWithSchema(schema, {
        dataframe: df,
        config: ENABLED({ maxEntities: 2 }),
      }),
    );
    expect(result.status).toBe('success');
    const output = result.output as { knowledgeGraph: { nodes: unknown[] }; statistics: { nodeCount: number } };
    expect(output.knowledgeGraph.nodes.length).toBeLessThanOrEqual(2);
    expect(output.statistics.nodeCount).toBe(output.knowledgeGraph.nodes.length);
  });

  it('handles a single row', async () => {
    const result = await agent.execute(
      buildContextWithSchema(
        { cat: { type: 'string', confidence: 1, nullCount: 0, uniqueCount: 1 } },
        {
          dataframe: [{ cat: 'only' }],
          config: ENABLED(),
        },
      ),
    );
    expect(result.status).toBe('success');
    const output = result.output as { knowledgeGraph: { nodes: unknown[] }; statistics: { nodeCount: number } };
    expect(output.statistics.nodeCount).toBeGreaterThan(0);
  });
});
