import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, getUsageForMonth } from '@/lib/auth/server';
import { db } from '@/lib/db';
import { PLANS } from '@/lib/flutterwave/server';

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const usage = await getUsageForMonth(user.id);
  const planDetails = PLANS[user.plan] ?? PLANS.free;
  const subscription = await db.subscription.findUnique({ where: { userId: user.id } });
  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan,
      analysesUsedThisMonth: usage.analysesUsed,
      analysesLimit: usage.limit,
      features: planDetails.features,
      subscription: subscription ? {
        plan: subscription.plan,
        status: subscription.status,
        currentPeriodEnd: subscription.currentPeriodEnd,
      } : null,
    },
  });
}
