import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/server';
import { getPaystack, PLANS } from '@/lib/paystack/server';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const plan = body.plan;
    const currency = body.currency ?? 'NGN';

    if (!plan || !PLANS[plan]) {
      return NextResponse.json({ error: `Invalid plan. Choose: ${Object.keys(PLANS).join(', ')}` }, { status: 400 });
    }
    if (plan === 'free') {
      return NextResponse.json({ error: 'Free plan requires no payment' }, { status: 400 });
    }
    if (plan === 'enterprise') {
      return NextResponse.json({
        message: 'Contact sales@intelliflow.ai for enterprise pricing',
        contact: true,
      });
    }

    const planDetails = PLANS[plan];
    const amountKobo = planDetails.priceNGN * 100; // NGN → kobo
    const reference = `ifl_${user.id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/billing?verify=${reference}`;

    // Persist payment record
    await db.payment.create({
      data: {
        userId: user.id,
        reference,
        amount: amountKobo,
        currency,
        plan,
        status: 'initialized',
      },
    });

    const paystack = getPaystack();
    const result = await paystack.initializeTransaction({
      email: user.email,
      amountKobo,
      currency: currency as any,
      metadata: {
        user_id: user.id,
        plan,
        reference,
        currency_display: currency,
      },
      callbackUrl,
      planCode: planDetails.paystackPlanCode,
    });

    if (!result.success) {
      return NextResponse.json({ error: 'Payment initialization failed', details: result.error }, { status: 500 });
    }

    return NextResponse.json({
      authorizationUrl: result.authorizationUrl,
      accessCode: result.accessCode,
      reference: result.reference ?? reference,
      plan,
      amountNGN: planDetails.priceNGN,
      amountUSD: planDetails.priceUSD,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
