import { NextRequest, NextResponse } from 'next/server';
import { getPaystack } from '@/lib/paystack/server';
import { upgradeUserPlan } from '@/lib/auth/server';
import { db } from '@/lib/db';

// Paystack webhook — MUST verify signature
export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get('x-paystack-signature') ?? '';
    const rawBody = await req.text();

    const paystack = getPaystack();
    if (!paystack.verifyWebhookSignature(rawBody, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = JSON.parse(rawBody);
    const eventType = event.event;
    const data = event.data ?? {};

    if (eventType === 'charge.success') {
      const reference = data.reference;
      const metadata = data.metadata ?? {};
      const userId = metadata.user_id;
      const plan = metadata.plan ?? 'pro';

      if (userId && plan) {
        await upgradeUserPlan(userId, plan);
      }

      // Update our payment record
      if (reference) {
        await db.payment.updateMany({
          where: { reference },
          data: {
            status: 'success',
            verifiedAt: new Date(),
            paystackData: JSON.stringify(data),
          },
        });
      }
    }

    if (eventType === 'subscription.create' || eventType === 'subscription.enable') {
      // Track subscription
      const subscriptionCode = data.subscription_code;
      const userId = data.metadata?.user_id;
      if (userId && subscriptionCode) {
        await db.subscription.upsert({
          where: { userId },
          create: {
            userId,
            plan: data.metadata?.plan ?? 'pro',
            status: 'active',
            paystackSubCode: subscriptionCode,
            paystackPlanCode: data.plan?.plan_code,
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
          update: {
            status: 'active',
            paystackSubCode: subscriptionCode,
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        });
      }
    }

    if (eventType === 'subscription.disable') {
      const userId = data.metadata?.user_id;
      if (userId) {
        await db.subscription.updateMany({
          where: { userId },
          data: { status: 'canceled' },
        });
        // Downgrade user to free
        await db.user.update({ where: { id: userId }, data: { plan: 'free' } });
      }
    }

    return NextResponse.json({ status: 'ok' });
  } catch (err: any) {
    console.error('Webhook error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
