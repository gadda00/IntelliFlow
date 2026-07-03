import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, generateApiKey } from '@/lib/auth/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const keys = await db.apiKey.findMany({
    where: { userId: user.id },
    select: { id: true, name: true, prefix: true, lastUsedAt: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ apiKeys: keys });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  const name = body.name ?? `Key ${new Date().toISOString().split('T')[0]}`;
  const { key, keyHash, prefix } = generateApiKey();
  const record = await db.apiKey.create({
    data: { userId: user.id, name, keyHash, prefix },
  });
  return NextResponse.json({
    id: record.id,
    name: record.name,
    prefix: record.prefix,
    key, // ONLY shown once
    createdAt: record.createdAt,
    message: 'Store this key safely — it will not be shown again.',
  }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id parameter required' }, { status: 400 });
  await db.apiKey.deleteMany({ where: { id, userId: user.id } });
  return NextResponse.json({ success: true });
}
