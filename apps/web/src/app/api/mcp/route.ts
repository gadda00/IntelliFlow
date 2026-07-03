// MCP API endpoint — exposes Busara as an MCP-compatible server
// Supports both JSON-RPC (for MCP clients like Claude Desktop) and
// simple REST (for curl/Postman testing)
//
// Usage from Claude Desktop config:
// {
//   "mcpServers": {
//     "busara": {
//       "url": "https://busaraai.com/api/mcp"
//     }
//   }
// }

import { NextRequest, NextResponse } from 'next/server';
import { getMCPTools, executeMCPTool, getMCPServerManifest } from '@/lib/mcp/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

// GET — return the server manifest (tool list)
export async function GET() {
  return NextResponse.json(getMCPServerManifest());
}

// POST — handle MCP tool calls (JSON-RPC 2.0 or simple REST)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // ─── JSON-RPC 2.0 format (MCP standard) ────────────────────
    if (body.jsonrpc === '2.0') {
      if (body.method === 'tools/list') {
        return NextResponse.json({
          jsonrpc: '2.0',
          id: body.id,
          result: {
            tools: getMCPTools(),
          },
        });
      }

      if (body.method === 'tools/call') {
        const { name, arguments: args } = body.params;
        const result = await executeMCPTool(name, args || {});
        return NextResponse.json({
          jsonrpc: '2.0',
          id: body.id,
          result,
        });
      }

      if (body.method === 'initialize') {
        return NextResponse.json({
          jsonrpc: '2.0',
          id: body.id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {},
              resources: {},
              prompts: {},
            },
            serverInfo: {
              name: 'busara-analytics',
              version: '5.0.0',
            },
          },
        });
      }

      return NextResponse.json({
        jsonrpc: '2.0',
        id: body.id,
        error: { code: -32601, message: `Method not found: ${body.method}` },
      });
    }

    // ─── Simple REST format (for easy testing) ──────────────────
    if (body.tool && body.arguments) {
      const result = await executeMCPTool(body.tool, body.arguments);
      return NextResponse.json(result);
    }

    // ─── Direct tool name as key ────────────────────────────────
    if (body.name && body.args) {
      const result = await executeMCPTool(body.name, body.args);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Invalid request format' }, { status: 400 });
  } catch (err: any) {
    console.error('[MCP] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
