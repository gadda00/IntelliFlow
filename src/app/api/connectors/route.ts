import { NextRequest, NextResponse } from 'next/server';
import { connectToDataSource } from '@/lib/connectors';
import { getUserFromRequest } from '@/lib/auth/server';
import { logAuditEvent } from '@/lib/audit/logger';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { type, connectionString, apiKey, spreadsheetId, range, projectId, query, url, dataPath } = body;

    if (!type) return NextResponse.json({ error: 'Connector type required' }, { status: 400 });

    // Log the connection attempt
    await logAuditEvent({
      userId: user.id,
      action: 'data:connect',
      resourceType: 'connector',
      resourceId: type,
      details: { type, hasQuery: !!query },
    });

    const result = await connectToDataSource({
      type, connectionstring: connectionString, apiKey, spreadsheetId, range, projectId, query, url,
    });

    return NextResponse.json({
      ...result,
      message: `Connected to ${type}. Retrieved ${result.rowCount} rows × ${result.columns.length} columns in ${result.durationMs}ms.`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET — list supported connector types
export async function GET() {
  return NextResponse.json({
    connectors: [
      { type: 'postgresql', name: 'PostgreSQL', description: 'Connect to any PostgreSQL database', required: ['connectionString', 'query'] },
      { type: 'google_sheets', name: 'Google Sheets', description: 'Read data from a Google Sheet', required: ['apiKey', 'spreadsheetId', 'range'] },
      { type: 'bigquery', name: 'BigQuery', description: 'Run queries against Google BigQuery', required: ['projectId', 'apiKey', 'query'] },
      { type: 'rest_api', name: 'REST API', description: 'Fetch data from any REST endpoint', required: ['url'] },
      { type: 'mysql', name: 'MySQL', description: 'Connect to MySQL (via PostgreSQL adapter)', required: ['connectionString', 'query'] },
    ],
  });
}
