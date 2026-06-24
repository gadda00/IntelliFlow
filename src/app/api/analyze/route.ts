import { NextRequest, NextResponse } from 'next/server';
import { ParallelAgentExecutor, getAgentPool, ProgressBroadcast } from '@/lib/agents';
import { parseFile } from '@/lib/data/parsers';
import { db } from '@/lib/db';
import { getUserFromRequest, AuthUser, incrementUsage } from '@/lib/auth/server';
import { EventEmitter } from 'events';

// In-memory pub/sub for real-time progress updates.
// The WebSocket mini-service subscribes to this; clients poll or connect via WS.
export const analysisEvents = new EventEmitter();
analysisEvents.setMaxListeners(1000);

// Recent updates buffer (per analysisId) so polling clients can catch up
const recentUpdates = new Map<string, ProgressBroadcast[]>();
const MAX_BUFFER = 200;

function broadcast(update: ProgressBroadcast) {
  analysisEvents.emit('agent_update', update);
  const list = recentUpdates.get(update.analysisId) ?? [];
  list.push(update);
  if (list.length > MAX_BUFFER) list.shift();
  recentUpdates.set(update.analysisId, list);
}

export function getRecentUpdates(analysisId: string): ProgressBroadcast[] {
  return recentUpdates.get(analysisId) ?? [];
}

export function clearUpdates(analysisId: string) {
  recentUpdates.delete(analysisId);
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  let analysisId: string | null = null;

  try {
    const body = await req.json();
    const user: AuthUser | null = await getUserFromRequest(req);

    // Parse input
    let fileContents: any[] = [];
    let rawFiles: { name: string; type: string; size: number }[] = [];

    if (body.fileContents && Array.isArray(body.fileContents)) {
      fileContents = body.fileContents;
    } else if (body.fileText && body.fileName) {
      const parsed = parseFile(body.fileText, body.fileName, body.fileType);
      fileContents = parsed.rows;
      rawFiles = [{ name: parsed.fileName, type: parsed.format, size: parsed.fileSize }];
    } else if (body.url) {
      // Fetch URL server-side
      const resp = await fetch(body.url);
      const text = await resp.text();
      const fileName = body.url.split('/').pop() ?? 'data.csv';
      const parsed = parseFile(text, fileName);
      fileContents = parsed.rows;
      rawFiles = [{ name: parsed.fileName, type: parsed.format, size: parsed.fileSize }];
    }

    if (!fileContents.length) {
      return NextResponse.json(
        { status: 'error', error: 'No data provided. Send fileContents, fileText+fileName, or url.' },
        { status: 400 }
      );
    }

    // Cap data size for safety
    const MAX_ROWS = 50000;
    if (fileContents.length > MAX_ROWS) {
      fileContents = fileContents.slice(0, MAX_ROWS);
    }

    analysisId = body.analysisId ?? `an_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const analysisName = body.analysisName ?? `Analysis ${new Date().toLocaleString()}`;

    // Persist analysis record (if user is authenticated)
    if (user) {
      await db.analysis.create({
        data: {
          id: analysisId,
          userId: user.id,
          name: analysisName,
          dataSource: JSON.stringify(rawFiles),
          config: JSON.stringify(body.analysisConfig ?? {}),
          status: 'running',
          startedAt: new Date(),
        },
      });
    }

    // Build executor
    const pool = getAgentPool();
    const executor = new ParallelAgentExecutor(pool, broadcast);

    const result = await executor.runFullPipeline({
      analysisId,
      analysisConfig: body.analysisConfig ?? {},
      fileContents,
      rawFiles,
      nlqQuery: body.nlqQuery,
      objectives: body.objectives,
      userId: user?.id,
      enabledAgents: body.enabledAgents,
    });

    const totalDurationMs = Date.now() - startTime;

    // Update analysis record
    if (user) {
      await db.analysis.update({
        where: { id: analysisId },
        data: {
          status: result.status === 'success' ? 'completed' : result.status === 'partial' ? 'completed' : 'failed',
          result: JSON.stringify(result.results),
          completedAt: new Date(),
        },
      });

      // Persist agent runs
      for (const [agentId, agentResult] of Object.entries(result.results)) {
        await db.agentRun.create({
          data: {
            analysisId,
            agentId,
            agentName: agentResult.agentName,
            status: agentResult.status,
            stage: 0, // would need to track per-agent
            startedAt: new Date(Date.now() - agentResult.durationMs),
            completedAt: new Date(),
            durationMs: agentResult.durationMs,
            result: agentResult.result ? JSON.stringify(agentResult.result) : null,
            error: agentResult.error,
          },
        });
      }

      // Increment usage
      await incrementUsage(user.id, result.execution.agentsSucceeded);
    }

    return NextResponse.json({
      status: result.status,
      analysisId,
      totalDurationMs,
      execution: result.execution,
      results: result.results,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Analysis failed:', err);
    return NextResponse.json({
      status: 'error',
      analysisId,
      error: err?.message ?? 'Unknown error',
      stack: process.env.NODE_ENV === 'development' ? err?.stack : undefined,
    }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  // Get analysis by ID
  const url = new URL(req.url);
  const analysisId = url.searchParams.get('id');
  if (!analysisId) {
    return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 });
  }
  const analysis = await db.analysis.findUnique({ where: { id: analysisId } });
  if (!analysis) {
    return NextResponse.json({ error: 'Analysis not found' }, { status: 404 });
  }
  return NextResponse.json({
    ...analysis,
    dataSource: JSON.parse(analysis.dataSource),
    config: JSON.parse(analysis.config),
    result: analysis.result ? JSON.parse(analysis.result) : null,
  });
}
