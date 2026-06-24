import { NextRequest, NextResponse } from 'next/server';
import { getFlutterwave } from '@/lib/flutterwave/server';
import { upgradeUserPlan } from '@/lib/auth/server';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { reference, txRef } = body;
    const txRefToUse = txRef ?? reference;
    if (!txRefToUse) {
      return NextResponse.json({ error: 'txRef or reference is required' }, { status: 400 });
    }

    const flw = getFlutterwave();
    const result = await flw.verifyTransaction(txRefToUse);

    if (!result.success) {
      return NextResponse.json({ error: 'Payment verification failed', details: result.error }, { status: 400 });
    }

    // Find our payment record
    const payment = await db.payment.findUnique({ where: { reference: txRefToUse } });
    if (!payment) {
      return NextResponse.json({ error: 'Payment record not found' }, { status: 404 });
    }

    // Update payment record
    await db.payment.update({
      where: { reference: txRefToUse },
      data: {
        status: 'success',
        verifiedAt: new Date(),
        providerData: JSON.stringify(result),
      },
    });

    // Upgrade user plan
    const metadata = result.metadata ?? {};
    const plan = metadata.plan ?? payment.plan;
    const userId = metadata.user_id ?? payment.userId;
    if (userId && plan) {
      await upgradeUserPlan(userId, plan);
    }

    return NextResponse.json({
      status: 'success',
      message: `Payment verified. Upgraded to ${plan.toUpperCase()}!`,
      plan,
      amountPaid: result.amount,
      reference: txRefToUse,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
