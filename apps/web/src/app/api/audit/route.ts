import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/server';
import { getAuditEvents, exportAuditCSV } from '@/lib/audit/logger';

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const userId = url.searchParams.get('userId') || user.id;
  const action = url.searchParams.get('action') || undefined;
  const limit = parseInt(url.searchParams.get('limit') || '100');
  const format = url.searchParams.get('format');

  const events = await getAuditEvents({ userId, action, limit });

  if (format === 'csv') {
    const csv = exportAuditCSV(events);
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="audit-log-${Date.now()}.csv"`,
      },
    });
  }

  return NextResponse.json({ events, count: events.length });
}
