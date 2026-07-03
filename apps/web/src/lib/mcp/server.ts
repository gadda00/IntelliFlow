// Busara MCP Server — exposes all 23 agents as Model Context Protocol tools
// This makes Busara callable from Claude Desktop, Cursor, VS Code, and any MCP client.
// The "USB-C for AI" — universal tool interface.
//
// Based on MCP spec: https://modelcontextprotocol.io/
// All 5 advisory documents recommend this as the #1 priority.

import { getAgentPool, listAgents } from '@/lib/agents';

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface MCPToolResponse {
  content: { type: 'text'; text: string }[];
  isError?: boolean;
}

/**
 * Generate the MCP tool list from Busara's 23 agents.
 * Each agent becomes a callable tool with structured input/output.
 */
export function getMCPTools(): MCPTool[] {
  const agents = listAgents();

  const tools: MCPTool[] = [
    // ─── Meta tool: run full analysis ───────────────────────────
    {
      name: 'busara_analyze',
      description: 'Run the full 23-agent analysis pipeline on a dataset. Upload CSV/JSON data and get comprehensive insights, forecasts, anomaly detection, causal analysis, and a narrative report.',
      inputSchema: {
        type: 'object',
        properties: {
          data: {
            type: 'array',
            description: 'Array of row objects (parsed CSV/JSON data)',
            items: { type: 'object' },
          },
          nlq_query: {
            type: 'string',
            description: 'Optional natural language question about the data',
          },
          objectives: {
            type: 'array',
            description: 'Optional analysis objectives',
            items: { type: 'string' },
          },
        },
        required: ['data'],
      },
    },
    // ─── Individual agent tools ─────────────────────────────────
    ...agents.map(agent => ({
      name: `busara_${agent.id}`,
      description: `${agent.name}: ${agent.description}`,
      inputSchema: {
        type: 'object',
        properties: {
          data: {
            type: 'array',
            description: 'Array of row objects',
            items: { type: 'object' },
          },
          context: {
            type: 'object',
            description: 'Optional context from prior agent runs',
          },
        },
        required: ['data'],
      },
    })),
    // ─── Utility tools ──────────────────────────────────────────
    {
      name: 'busara_list_agents',
      description: 'List all 23 Busara agents with their capabilities, tier, and description. Use this to discover what analysis tools are available.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'busara_chat',
      description: 'Ask a question about your data in natural language. The Conversational Analyst will interpret the question and route it to the appropriate agent(s).',
      inputSchema: {
        type: 'object',
        properties: {
          question: {
            type: 'string',
            description: 'The question to ask about the data',
          },
          data: {
            type: 'array',
            description: 'Optional: dataset context for the question',
            items: { type: 'object' },
          },
        },
        required: ['question'],
      },
    },
  ];

  return tools;
}

/**
 * Execute an MCP tool call.
 * Routes to the appropriate Busara agent or utility function.
 */
export async function executeMCPTool(
  toolName: string,
  args: Record<string, any>,
): Promise<MCPToolResponse> {
  const pool = getAgentPool();

  try {
    // ─── Meta tools ─────────────────────────────────────────────
    if (toolName === 'busara_list_agents') {
      const agents = listAgents();
      const text = agents.map(a =>
        `## ${a.name} (${a.tier})\n${a.description}\nCapabilities: ${a.capabilities.join(', ')}`
      ).join('\n\n');
      return { content: [{ type: 'text', text: `# Busara Agents (${agents.length})\n\n${text}` }] };
    }

    if (toolName === 'busara_chat') {
      // Delegate to the chat API
      const question = args.question as string;
      const data = args.data || [];
      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, analysisContext: data }),
      });
      const result = await response.json();
      return { content: [{ type: 'text', text: result.answer || result.error || 'No response' }] };
    }

    if (toolName === 'busara_analyze') {
      // Run the full pipeline
      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileContents: args.data,
          nlqQuery: args.nlq_query,
          objectives: args.objectives,
        }),
      });
      const result = await response.json();

      if (result.status === 'error') {
        return { content: [{ type: 'text', text: `Analysis failed: ${result.error}` }], isError: true };
      }

      // Format the results as readable text
      const summary = formatAnalysisResults(result);
      return { content: [{ type: 'text', text: summary }] };
    }

    // ─── Individual agent tools ─────────────────────────────────
    if (toolName.startsWith('busara_')) {
      const agentId = toolName.replace('busara_', '');
      const agent = pool.get(agentId);

      if (!agent) {
        return { content: [{ type: 'text', text: `Agent '${agentId}' not found` }], isError: true };
      }

      const data = args.data || [];
      if (!data.length) {
        return { content: [{ type: 'text', text: 'No data provided' }], isError: true };
      }

      const { AgentExecutionContext } = await import('@/lib/agents/core');
      const ctx: AgentExecutionContext = {
        analysisId: `mcp_${Date.now()}`,
        analysisConfig: {},
        fileContents: data,
        dependencyResults: args.context || {},
        startedAt: new Date().toISOString(),
      };

      const result = await agent.execute(ctx);
      const text = JSON.stringify(result, null, 2);
      return { content: [{ type: 'text', text: `${agent.name} Result:\n\n${text}` }] };
    }

    return { content: [{ type: 'text', text: `Unknown tool: ${toolName}` }], isError: true };
  } catch (err: any) {
    return { content: [{ type: 'text', text: `Error executing ${toolName}: ${err.message}` }], isError: true };
  }
}

function formatAnalysisResults(result: any): string {
  const results = result.results || {};
  const insights = results.insight_generator?.result || {};
  const narrative = results.narrative_composer?.result || {};
  const scout = results.data_scout?.result || {};
  const anomalies = results.anomaly_sentinel?.result || {};
  const forecast = results.forecasting_oracle?.result || {};

  let text = `# Busara Analysis Complete\n\n`;
  text += `**Status**: ${result.status}\n`;
  text += `**Agents**: ${result.execution?.agentsSucceeded}/${(result.execution?.agentsSucceeded || 0) + (result.execution?.agentsFailed || 0)} succeeded\n`;
  text += `**Duration**: ${result.totalDurationMs}ms\n\n`;

  if (scout.profile) {
    text += `## Dataset Overview\n`;
    text += `- Rows: ${scout.profile.rowCount?.toLocaleString()}\n`;
    text += `- Columns: ${scout.profile.columnCount}\n`;
    text += `- Quality Score: ${scout.profile.qualityScore}/100\n`;
    text += `- Domain: ${scout.detectedDomain || 'general'}\n\n`;
  }

  if (narrative.executiveSummary) {
    text += `## Executive Summary\n${narrative.executiveSummary}\n\n`;
  }

  if (insights.insights?.length) {
    text += `## Key Insights\n`;
    insights.insights.forEach((ins: any, i: number) => {
      text += `${i + 1}. **${ins.title}** (${ins.impact} impact, ${Math.round(ins.confidence * 100)}% confidence)\n   ${ins.description}\n\n`;
    });
  }

  if (anomalies.totalAnomalies > 0) {
    text += `## Anomalies\n${anomalies.totalAnomalies} anomalies detected using ${anomalies.methodsUsed?.join(', ')}\n\n`;
  }

  if (forecast.forecast?.length) {
    text += `## Forecast\nMethod: ${forecast.method}, Accuracy: ${forecast.accuracy}%, Trend: ${forecast.trend}\n\n`;
  }

  if (insights.recommendations?.length) {
    text += `## Recommendations\n`;
    insights.recommendations.forEach((rec: any, i: number) => {
      text += `${i + 1}. **${rec.title}** (${rec.priority} priority)\n   ${rec.description}\n\n`;
    });
  }

  return text;
}

/**
 * Generate the MCP server manifest (Agent Card for A2A protocol).
 * This is what external agents use to discover Busara's capabilities.
 */
export function getMCPServerManifest() {
  return {
    name: 'busara-analytics',
    version: '5.0.0',
    description: 'Busara — 23-agent data intelligence platform. Analyze any dataset with 23 specialized AI agents running in a parallel DAG. Real math, real insights, real fast.',
    capabilities: {
      streaming: true,
      pushNotifications: false,
      stateTransitionHistory: true,
    },
    tools: getMCPTools().map(t => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
    authentication: {
      schemes: ['apiKey', 'bearer'],
    },
    links: {
      homepage: 'https://busaraai.com',
      documentation: 'https://github.com/gadda00/IntelliFlow',
      signup: 'https://busaraai.com',
    },
  };
}
