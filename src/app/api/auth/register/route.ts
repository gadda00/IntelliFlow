import { NextRequest, NextResponse } from 'next/server';
import { createUser, signToken } from '@/lib/auth/server';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, name } = body;
    if (!email || !password || !name) {
      return NextResponse.json({ error: 'email, password, and name are required' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const user = await createUser(email, password, name);
    if (!user) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    }

    // Initialize usage record
    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    await db.usageRecord.create({
      data: { userId: user.id, month: monthStr, analysesUsed: 0, agentsInvoked: 0 },
    }).catch(() => { /* unique constraint may exist */ });

    const token = signToken(user);
    return NextResponse.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, plan: user.plan },
      expiresIn: 86400,
      message: 'Welcome to IntelliFlow!',
    }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
