/**
 * Knowledge Graph Builder Agent
 * ===============================
 * 
 * Stage 2 - Detect
 * 
 * Responsible for building knowledge graphs from data by extracting entities
 * and relationships. Creates a structured representation of the data's semantic meaning.
 */

import { z } from 'zod';
import {
  AgentStage,
  AgentTier,
  AgentStability,
} from '@busara/core';
import {
  BaseAgent,
  EnhancedAgentMetadata,
  EnhancedAgentContext,
  AgentResult,
  createAgentMetadata,
} from '../../core';
import { mean, stdev, correlation } from '../../math';

// ============================================================================
// Agent Metadata
// ============================================================================

const metadata = createAgentMetadata({
  // Identity
  id: 'knowledge_graph_builder',
  name: 'Knowledge Graph Builder',
  description: 'Builds knowledge graphs from data by extracting entities and relationships, creating a structured semantic representation of the dataset.',
  version: '1.0.0',
  
  // Classification
  stage: 'detect' as AgentStage,
  stageNumber: 2,
  tier: 'advanced' as AgentTier,
  stability: 'stable' as AgentStability,
  
  // Author
  author: 'Busara Team',
  license: 'MIT',
  
  // Dependencies
  dependencies: ['data_ingestion', 'schema_inference', 'data_cleaner'],
  
  // Execution
  timeoutMs: 30000,
  maxRetries: 3,
  
  // Capabilities
  capabilities: [
    'entity_extraction',
    'relationship_extraction',
    'knowledge_graph',
    'semantic_analysis',
    'network_analysis',
  ],
  category: 'analysis',
  tags: ['knowledge-graph', 'entities', 'relationships', 'semantic', 'network'],
  
  // Input/Output
  inputDescription: 'Cleaned dataframe with schema',
  outputDescription: 'Knowledge graph with entities, relationships, and network analysis',
  inputSchema: {
    schema: z.object({
      dataframe: z.array(z.record(z.unknown())),
      schema: z.record(z.string(), z.object({
        type: z.string(),
        confidence: z.number(),
        nullCount: z.number(),
        uniqueCount: z.number(),
      })),
    }),
    description: 'Cleaned dataframe with schema',
  },
  outputSchema: {
    schema: z.object({
      knowledgeGraph: z.object({
        nodes: z.array(z.object({
          id: z.string(),
          label: z.string(),
          type: z.string(),
          properties: z.record(z.string(), z.unknown()),
          degree: z.number(),
          centrality: z.number(),
        })),
        edges: z.array(z.object({
          id: z.string(),
          source: z.string(),
          target: z.string(),
          label: z.string(),
          type: z.string(),
          weight: z.number(),
        })),
      }),
      statistics: z.object({
        nodeCount: z.number(),
        edgeCount: z.number(),
        density: z.number(),
        averageDegree: z.number(),
        connectedComponents: z.number(),
        largestComponentSize: z.number(),
      }),
      analysis: z.object({
        centrality: z.record(z.string(), z.number()),
        communities: z.array(z.object({
          id: z.number(),
          nodes: z.array(z.string()),
          size: z.number(),
          modularity: z.number(),
        })),
        hubs: z.array(z.string()),
        authorities: z.array(z.string()),
      }),
      recommendations: z.array(z.string()),
    }),
    description: 'Knowledge graph with entities, relationships, and network analysis',
  },
  configSchema: {
    schema: z.object({
      // Entity extraction
      entityExtraction: z.object({
        enabled: z.boolean().default(true),
        minFrequency: z.number().int().positive().default(2),
        maxEntities: z.number().int().positive().max(1000).default(100),
        includeNumeric: z.boolean().default(false),
        includeCategorical: z.boolean().default(true),
        includeText: z.boolean().default(true),
      }).default({}),
      
      // Relationship extraction
      relationshipExtraction: z.object({
        enabled: z.boolean().default(true),
        correlationThreshold: z.number().min(0).max(1).default(0.5),
        minCooccurrence: z.number().int().positive().default(3),
        relationshipTypes: z.array(z.string()).default(['correlated', 'similar', 'connected']),
      }).default({}),
      
      // Graph analysis
      graphAnalysis: z.object({
        enabled: z.boolean().default(true),
        centralityMetrics: z.array(z.enum(['degree', 'betweenness', 'closeness', 'eigenvector'])).default(['degree']),
        communityDetection: z.boolean().default(true),
        maxCommunities: z.number().int().positive().max(20).default(10),
      }).default({}),
      
      // Output
      includeStatistics: z.boolean().default(true),
      includeAnalysis: z.boolean().default(true),
      includeRecommendations: z.boolean().default(true),
    }),
    defaults: {
      entityExtraction: {
        enabled: true,
        minFrequency: 2,
        maxEntities: 100,
        includeNumeric: false,
        includeCategorical: true,
        includeText: true,
      },
      relationshipExtraction: {
        enabled: true,
        correlationThreshold: 0.5,
        minCooccurrence: 3,
        relationshipTypes: ['correlated', 'similar', 'connected'],
      },
      graphAnalysis: {
        enabled: true,
        centralityMetrics: ['degree'],
        communityDetection: true,
        maxCommunities: 10,
      },
      includeStatistics: true,
      includeAnalysis: true,
      includeRecommendations: true,
    },
    description: 'Knowledge graph builder configuration',
  },
  
  // Technical requirements
  memoryLimitMB: 1024,
  cpuLimit: 4,
  gpuRequired: false,
  
  // UI
  icon: 'Graph',
  color: '#f59e0b',
});

// ============================================================================
// Agent Implementation
// ============================================================================

/**
 * KnowledgeGraphBuilderAgent builds knowledge graphs from data.
 */
export class KnowledgeGraphBuilderAgent extends BaseAgent {
  readonly metadata: EnhancedAgentMetadata = metadata;
  
  async execute(context: EnhancedAgentContext): Promise<AgentResult> {
    const start = Date.now();
    const { dataframe, config, previousResults } = context;
    
    try {
      // Validate input
      if (!dataframe || !Array.isArray(dataframe) || dataframe.length === 0) {
        return this.createError('No data provided for knowledge graph building', Date.now() - start);
      }
      
      // Get schema from previous results
      const schemaResult = previousResults.get('schema_inference');
      const schema = schemaResult?.output?.schema ?? {};
      
      // Get configuration
      const entityConfig = config.entityExtraction ?? {};
      const relationshipConfig = config.relationshipExtraction ?? {};
      const graphConfig = config.graphAnalysis ?? {};
      const includeStatistics = config.includeStatistics ?? true;
      const includeAnalysis = config.includeAnalysis ?? true;
      const includeRecommendations = config.includeRecommendations ?? true;
      
      // Extract entities
      const entities = entityConfig.enabled
        ? this.extractEntities(dataframe, schema, entityConfig)
        : [];
      
      if (entities.length === 0) {
        return this.createError('No entities found for knowledge graph', Date.now() - start);
      }
      
      // Extract relationships
      const relationships = relationshipConfig.enabled
        ? this.extractRelationships(dataframe, schema, entities, relationshipConfig)
        : [];
      
      // Build knowledge graph
      const knowledgeGraph = this.buildKnowledgeGraph(entities, relationships);
      
      // Calculate statistics
      const statistics = includeStatistics
        ? this.calculateGraphStatistics(knowledgeGraph)
        : {
            nodeCount: 0,
            edgeCount: 0,
            density: 0,
            averageDegree: 0,
            connectedComponents: 0,
            largestComponentSize: 0,
          };
      
      // Perform graph analysis
      const analysis = includeAnalysis
        ? this.analyzeGraph(knowledgeGraph, graphConfig)
        : {
            centrality: {},
            communities: [],
            hubs: [],
            authorities: [],
          };
      
      // Generate recommendations
      const recommendations = includeRecommendations
        ? this.generateRecommendations(knowledgeGraph, analysis)
        : [];
      
      const output = {
        knowledgeGraph,
        statistics,
        analysis,
        recommendations,
      };
      
      const executionTimeMs = Date.now() - start;
      
      return this.createResult(output, {
        nodeCount: statistics.nodeCount,
        edgeCount: statistics.edgeCount,
        density: statistics.density,
        communitiesFound: analysis.communities.length,
      }, executionTimeMs);
      
    } catch (error) {
      const executionTimeMs = Date.now() - start;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return this.createError(errorMessage, executionTimeMs);
    }
  }
  
  /**
   * Extract entities from dataframe
   */
  private extractEntities(
    dataframe: Record<string, unknown>[],
    schema: Record<string, any>,
    config: any
  ): any[] {
    const entities: any[] = [];
    const entityMap = new Map<string, any>();
    
    // Extract from categorical columns
    if (config.includeCategorical) {
      for (const [col, colSchema] of Object.entries(schema)) {
        if (colSchema.type === 'categorical' || colSchema.type === 'string') {
          const values = dataframe.map(row => row[col]).filter(v => v !== null && v !== undefined);
          
          // Count frequencies
          const frequencyMap = new Map<unknown, number>();
          for (const value of values) {
            frequencyMap.set(value, (frequencyMap.get(value) ?? 0) + 1);
          }
          
          // Add entities that meet frequency threshold
          for (const [value, frequency] of frequencyMap) {
            if (frequency >= config.minFrequency) {
              const entityId = `${col}_${String(value).replace(/[^a-zA-Z0-9]/g, '_')}`;
              
              if (!entityMap.has(entityId)) {
                entityMap.set(entityId, {
                  id: entityId,
                  label: String(value),
                  type: colSchema.type,
                  sourceColumn: col,
                  properties: {
                    frequency,
                    column: col,
                    type: colSchema.type,
                  },
                });
              }
            }
          }
        }
      }
    }
    
    // Extract from numeric columns (if enabled)
    if (config.includeNumeric) {
      for (const [col, colSchema] of Object.entries(schema)) {
        if (colSchema.type === 'integer' || colSchema.type === 'float') {
          const values = this.extractNumericColumn(dataframe, col);
          
          if (values.length > 0) {
            const entityId = `${col}_numeric`;
            
            if (!entityMap.has(entityId)) {
              entityMap.set(entityId, {
                id: entityId,
                label: col,
                type: 'numeric',
                sourceColumn: col,
                properties: {
                  mean: mean(values),
                  stdev: stdev(values),
                  min: Math.min(...values),
                  max: Math.max(...values),
                  column: col,
                  type: colSchema.type,
                },
              });
            }
          }
        }
      }
    }
    
    // Limit entities
    const allEntities = Array.from(entityMap.values());
    if (config.maxEntities && allEntities.length > config.maxEntities) {
      // Sort by frequency and take top
      allEntities.sort((a, b) => (b.properties.frequency ?? 0) - (a.properties.frequency ?? 0));
      return allEntities.slice(0, config.maxEntities);
    }
    
    return allEntities;
  }
  
  /**
   * Extract relationships between entities
   */
  private extractRelationships(
    dataframe: Record<string, unknown>[],
    schema: Record<string, any>,
    entities: any[],
    config: any
  ): any[] {
    const relationships: any[] = [];
    const entityIds = new Set(entities.map(e => e.id));
    
    // Create entity lookup
    const entityLookup = new Map<string, any>();
    for (const entity of entities) {
      entityLookup.set(entity.id, entity);
    }
    
    // Relationship 1: Co-occurrence (for categorical entities)
    for (const entity of entities) {
      if (entity.type === 'categorical' || entity.type === 'string') {
        const sourceColumn = entity.sourceColumn;
        const entityValue = entity.label;
        
        // Find rows where this entity appears
        const rowsWithEntity = dataframe
          .map((row, index) => ({ row, index }))
          .filter(({ row }) => row[sourceColumn] === entityValue);
        
        // Find co-occurring entities
        for (const otherEntity of entities) {
          if (otherEntity.id === entity.id) continue;
          
          if (otherEntity.type === 'categorical' || otherEntity.type === 'string') {
            const otherSourceColumn = otherEntity.sourceColumn;
            const otherEntityValue = otherEntity.label;
            
            // Count co-occurrences
            const cooccurrences = rowsWithEntity.filter(
              ({ row }) => row[otherSourceColumn] === otherEntityValue
            ).length;
            
            if (cooccurrences >= config.minCooccurrence) {
              relationships.push({
                id: `${entity.id}_cooccur_${otherEntity.id}`,
                source: entity.id,
                target: otherEntity.id,
                label: 'co-occurs with',
                type: 'cooccurrence',
                weight: cooccurrences,
              });
            }
          }
        }
      }
    }
    
    // Relationship 2: Correlation (for numeric entities)
    const numericEntities = entities.filter(e => e.type === 'numeric');
    
    for (let i = 0; i < numericEntities.length; i++) {
      for (let j = i + 1; j < numericEntities.length; j++) {
        const entity1 = numericEntities[i];
        const entity2 = numericEntities[j];
        
        const col1 = entity1.sourceColumn;
        const col2 = entity2.sourceColumn;
        
        const values1 = this.extractNumericColumn(dataframe, col1);
        const values2 = this.extractNumericColumn(dataframe, col2);
        
        if (values1.length > 0 && values2.length > 0) {
          const corr = correlation(values1, values2);
          
          if (Math.abs(corr) >= config.correlationThreshold) {
            relationships.push({
              id: `${entity1.id}_corr_${entity2.id}`,
              source: entity1.id,
              target: entity2.id,
              label: 'correlated with',
              type: 'correlation',
              weight: Math.abs(corr),
              correlation: corr,
            });
          }
        }
      }
    }
    
    // Relationship 3: Similarity (for all entities)
    // This is a placeholder - in a real implementation, you'd use more sophisticated similarity measures
    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const entity1 = entities[i];
        const entity2 = entities[j];
        
        // Simple similarity based on shared properties
        const sharedProps = Object.keys(entity1.properties)
          .filter(key => key in entity2.properties && entity1.properties[key] === entity2.properties[key])
          .length;
        
        const totalProps = Math.max(
          Object.keys(entity1.properties).length,
          Object.keys(entity2.properties).length
        );
        
        const similarity = totalProps > 0 ? sharedProps / totalProps : 0;
        
        if (similarity > 0.5) {
          relationships.push({
            id: `${entity1.id}_similar_${entity2.id}`,
            source: entity1.id,
            target: entity2.id,
            label: 'similar to',
            type: 'similarity',
            weight: similarity,
          });
        }
      }
    }
    
    return relationships;
  }
  
  /**
   * Build knowledge graph from entities and relationships
   */
  private buildKnowledgeGraph(entities: any[], relationships: any[]): any {
    // Add degree to nodes
    const nodeDegrees = new Map<string, number>();
    
    for (const rel of relationships) {
      nodeDegrees.set(rel.source, (nodeDegrees.get(rel.source) ?? 0) + 1);
      nodeDegrees.set(rel.target, (nodeDegrees.get(rel.target) ?? 0) + 1);
    }
    
    const nodes = entities.map(entity => ({
      ...entity,
      degree: nodeDegrees.get(entity.id) ?? 0,
      centrality: 0, // Will be calculated in analysis
    }));
    
    const edges = relationships.map(rel => ({
      ...rel,
      id: rel.id || `${rel.source}_to_${rel.target}`,
    }));
    
    return { nodes, edges };
  }
  
  /**
   * Calculate graph statistics
   */
  private calculateGraphStatistics(graph: any): any {
    const nodeCount = graph.nodes.length;
    const edgeCount = graph.edges.length;
    
    // Calculate density
    const density = nodeCount > 1 ? (2 * edgeCount) / (nodeCount * (nodeCount - 1)) : 0;
    
    // Calculate average degree
    const totalDegree = graph.nodes.reduce((sum: number, node: any) => sum + node.degree, 0);
    const averageDegree = nodeCount > 0 ? totalDegree / nodeCount : 0;
    
    // Find connected components
    const { connectedComponents, componentSizes } = this.findConnectedComponents(graph);
    const largestComponentSize = Math.max(...componentSizes, 0);
    
    return {
      nodeCount,
      edgeCount,
      density,
      averageDegree,
      connectedComponents,
      largestComponentSize,
    };
  }
  
  /**
   * Find connected components using BFS
   */
  private findConnectedComponents(graph: any): { connectedComponents: number; componentSizes: number[] } {
    const visited = new Set<string>();
    const componentSizes: number[] = [];
    
    for (const node of graph.nodes) {
      if (!visited.has(node.id)) {
        // BFS
        const queue = [node.id];
        const component = new Set<string>();
        
        while (queue.length > 0) {
          const current = queue.shift()!;
          
          if (visited.has(current)) continue;
          visited.add(current);
          component.add(current);
          
          // Find neighbors
          const neighbors = graph.edges
            .filter((edge: any) => edge.source === current || edge.target === current)
            .map((edge: any) => edge.source === current ? edge.target : edge.source);
          
          for (const neighbor of neighbors) {
            if (!visited.has(neighbor)) {
              queue.push(neighbor);
            }
          }
        }
        
        componentSizes.push(component.size);
      }
    }
    
    return {
      connectedComponents: componentSizes.length,
      componentSizes,
    };
  }
  
  /**
   * Analyze graph structure
   */
  private analyzeGraph(graph: any, config: any): any {
    const analysis: any = {
      centrality: {},
      communities: [],
      hubs: [],
      authorities: [],
    };
    
    // Calculate centrality metrics
    if (config.centralityMetrics?.length > 0) {
      for (const metric of config.centralityMetrics) {
        switch (metric) {
          case 'degree':
            for (const node of graph.nodes) {
              analysis.centrality[node.id] = (analysis.centrality[node.id] ?? 0) + node.degree;
            }
            break;
          case 'betweenness':
            analysis.centrality = { ...analysis.centrality, ...this.calculateBetweennessCentrality(graph) };
            break;
          case 'closeness':
            analysis.centrality = { ...analysis.centrality, ...this.calculateClosenessCentrality(graph) };
            break;
          case 'eigenvector':
            analysis.centrality = { ...analysis.centrality, ...this.calculateEigenvectorCentrality(graph) };
            break;
        }
      }
    }
    
    // Detect communities
    if (config.communityDetection) {
      analysis.communities = this.detectCommunities(graph, config.maxCommunities);
    }
    
    // Find hubs and authorities
    const sortedNodes = graph.nodes.sort((a: any, b: any) => (b.degree ?? 0) - (a.degree ?? 0));
    analysis.hubs = sortedNodes.slice(0, 5).map((n: any) => n.id);
    
    return analysis;
  }
  
  /**
   * Calculate betweenness centrality
   */
  private calculateBetweennessCentrality(graph: any): Record<string, number> {
    const centrality: Record<string, number> = {};
    
    // Initialize
    for (const node of graph.nodes) {
      centrality[node.id] = 0;
    }
    
    // For each node as source
    for (const source of graph.nodes) {
      const queue: string[] = [];
      const predecessors: Map<string, string[]> = new Map();
      const distances: Map<string, number> = new Map();
      const stack: string[] = [];
      
      distances.set(source.id, 0);
      queue.push(source.id);
      
      // BFS
      while (queue.length > 0) {
        const current = queue.shift()!;
        stack.push(current);
        
        // Find neighbors
        const neighbors = graph.edges
          .filter((edge: any) => edge.source === current || edge.target === current)
          .map((edge: any) => edge.source === current ? edge.target : edge.source)
          .filter((n: string) => !distances.has(n));
        
        for (const neighbor of neighbors) {
          distances.set(neighbor, distances.get(current)! + 1);
          queue.push(neighbor);
          
          if (!predecessors.has(neighbor)) {
            predecessors.set(neighbor, []);
          }
          predecessors.get(neighbor)!.push(current);
        }
      }
      
      // Accumulate dependencies
      const dependencies: Map<string, number> = new Map();
      for (const node of graph.nodes) {
        dependencies.set(node.id, 0);
      }
      
      // Process in reverse order
      while (stack.length > 0) {
        const current = stack.pop()!;
        
        if (predecessors.has(current)) {
          for (const predecessor of predecessors.get(current)!) {
            const dependency = dependencies.get(predecessor) ?? 0;
            dependencies.set(predecessor, dependency + (dependencies.get(current) ?? 0));
          }
        }
        
        if (current !== source.id) {
          centrality[current] = (centrality[current] ?? 0) + (dependencies.get(current) ?? 0);
        }
      }
    }
    
    // Normalize
    const maxCentrality = Math.max(...Object.values(centrality), 1);
    for (const nodeId in centrality) {
      centrality[nodeId] /= maxCentrality;
    }
    
    return centrality;
  }
  
  /**
   * Calculate closeness centrality
   */
  private calculateClosenessCentrality(graph: any): Record<string, number> {
    const centrality: Record<string, number> = {};
    
    for (const node of graph.nodes) {
      const distances = this.calculateShortestPaths(graph, node.id);
      const sumDistances = Object.values(distances).reduce((sum, d) => sum + d, 0);
      const reachableNodes = Object.values(distances).filter(d => d < Infinity).length;
      
      centrality[node.id] = reachableNodes > 1 ? (reachableNodes - 1) / sumDistances : 0;
    }
    
    // Normalize
    const maxCentrality = Math.max(...Object.values(centrality), 1);
    for (const nodeId in centrality) {
      centrality[nodeId] /= maxCentrality;
    }
    
    return centrality;
  }
  
  /**
   * Calculate eigenvector centrality
   */
  private calculateEigenvectorCentrality(graph: any): Record<string, number> {
    const n = graph.nodes.length;
    const nodeIds = graph.nodes.map((n: any) => n.id);
    const nodeIndex = new Map(nodeIds.map((id, i) => [id, i]));
    
    // Create adjacency matrix
    const adjMatrix: number[][] = new Array(n).fill(0).map(() => new Array(n).fill(0));
    
    for (const edge of graph.edges) {
      const sourceIndex = nodeIndex.get(edge.source);
      const targetIndex = nodeIndex.get(edge.target);
      
      if (sourceIndex !== undefined && targetIndex !== undefined) {
        adjMatrix[sourceIndex][targetIndex] = 1;
        adjMatrix[targetIndex][sourceIndex] = 1; // Undirected graph
      }
    }
    
    // Power iteration for eigenvector centrality
    let vector = new Array(n).fill(1 / n);
    
    for (let iter = 0; iter < 100; iter++) {
      const newVector = new Array(n).fill(0);
      
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          newVector[i] += adjMatrix[i][j] * vector[j];
        }
      }
      
      // Normalize
      const norm = Math.sqrt(newVector.reduce((sum, v) => sum + v * v, 0));
      if (norm > 0) {
        vector = newVector.map(v => v / norm);
      }
    }
    
    // Create centrality map
    const centrality: Record<string, number> = {};
    for (let i = 0; i < n; i++) {
      centrality[nodeIds[i]] = vector[i];
    }
    
    return centrality;
  }
  
  /**
   * Calculate shortest paths from a source node
   */
  private calculateShortestPaths(graph: any, sourceId: string): Record<string, number> {
    const distances: Record<string, number> = {};
    const queue: string[] = [];
    
    distances[sourceId] = 0;
    queue.push(sourceId);
    
    while (queue.length > 0) {
      const current = queue.shift()!;
      
      // Find neighbors
      const neighbors = graph.edges
        .filter((edge: any) => edge.source === current || edge.target === current)
        .map((edge: any) => edge.source === current ? edge.target : edge.source)
        .filter((n: string) => !(n in distances));
      
      for (const neighbor of neighbors) {
        distances[neighbor] = distances[current] + 1;
        queue.push(neighbor);
      }
    }
    
    // Set unreachable nodes to Infinity
    for (const node of graph.nodes) {
      if (!(node.id in distances)) {
        distances[node.id] = Infinity;
      }
    }
    
    return distances;
  }
  
  /**
   * Detect communities using Louvain method (simplified)
   */
  private detectCommunities(graph: any, maxCommunities: number): any[] {
    // Simplified community detection
    // In a real implementation, use a proper algorithm like Louvain or Leiden
    
    const communities: any[] = [];
    const nodeCommunities = new Map<string, number>();
    
    // Assign each node to its own community initially
    for (const node of graph.nodes) {
      nodeCommunities.set(node.id, communities.length);
      communities.push({
        id: communities.length,
        nodes: [node.id],
        size: 1,
        modularity: 0,
      });
    }
    
    // Simple merging based on connectivity
    let changed = true;
    while (changed) {
      changed = false;
      
      for (let i = 0; i < communities.length; i++) {
        for (let j = i + 1; j < communities.length; j++) {
          // Count edges between communities
          let betweenEdges = 0;
          let totalEdges = 0;
          
          for (const nodeId of communities[i].nodes) {
            const neighbors = graph.edges
              .filter((edge: any) => edge.source === nodeId || edge.target === nodeId)
              .map((edge: any) => edge.source === nodeId ? edge.target : edge.source);
            
            for (const neighbor of neighbors) {
              totalEdges++;
              if (communities[j].nodes.includes(neighbor)) {
                betweenEdges++;
              }
            }
          }
          
          // Simple merging heuristic
          if (betweenEdges > 0 && communities.length > maxCommunities) {
            // Merge community j into i
            communities[i].nodes.push(...communities[j].nodes);
            communities[i].size += communities[j].size;
            communities.splice(j, 1);
            
            // Update node communities
            for (const nodeId of communities[i].nodes) {
              nodeCommunities.set(nodeId, i);
            }
            
            changed = true;
            break;
          }
        }
        if (changed) break;
      }
    }
    
    // Calculate modularity for each community
    const totalEdges = graph.edges.length;
    for (const community of communities) {
      let withinEdges = 0;
      
      for (const nodeId of community.nodes) {
        const neighbors = graph.edges
          .filter((edge: any) => edge.source === nodeId || edge.target === nodeId)
          .map((edge: any) => edge.source === nodeId ? edge.target : edge.source);
        
        for (const neighbor of neighbors) {
          if (community.nodes.includes(neighbor)) {
            withinEdges++;
          }
        }
      }
      
      // Modularity contribution
      const expectedEdges = Math.pow(community.size / graph.nodes.length, 2) * totalEdges * 2;
      community.modularity = withinEdges - expectedEdges / 2;
    }
    
    return communities;
  }
  
  /**
   * Generate recommendations
   */
  private generateRecommendations(graph: any, analysis: any): string[] {
    const recommendations: string[] = [];
    
    // Graph statistics
    recommendations.push(
      `Knowledge graph contains ${graph.nodes.length} entities and ${graph.edges.length} relationships`
    );
    
    if (analysis.statistics?.density > 0.5) {
      recommendations.push('Highly connected graph - entities are well-related');
    } else if (analysis.statistics?.density < 0.1) {
      recommendations.push('Sparse graph - consider adding more relationships');
    }
    
    // Centrality
    if (analysis.centrality && Object.keys(analysis.centrality).length > 0) {
      const mostCentral = Object.entries(analysis.centrality)
        .sort(([, a], [, b]) => (b as number) - (a as number))[0];
      
      if (mostCentral) {
        recommendations.push(
          `Most central entity: ${mostCentral[0]} (centrality: ${mostCentral[1].toFixed(3)})`
        );
      }
    }
    
    // Communities
    if (analysis.communities?.length > 1) {
      recommendations.push(
        `${analysis.communities.length} communities detected in the graph`
      );
      
      const largestCommunity = analysis.communities
        .sort((a: any, b: any) => b.size - a.size)[0];
      
      if (largestCommunity) {
        recommendations.push(
          `Largest community has ${largestCommunity.size} entities`
        );
      }
    } else if (analysis.communities?.length === 1) {
      recommendations.push('All entities belong to a single community');
    }
    
    // Hubs
    if (analysis.hubs?.length > 0) {
      recommendations.push(
        `Top hubs: ${analysis.hubs.slice(0, 3).join(', ')}`
      );
    }
    
    return recommendations;
  }
}

// ============================================================================
// Exports
// ============================================================================

export { metadata as knowledgeGraphBuilderAgentMetadata };
export default KnowledgeGraphBuilderAgent;
