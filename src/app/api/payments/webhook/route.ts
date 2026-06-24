import { NextRequest, NextResponse } from 'next/server';
import { getFlutterwave } from '@/lib/flutterwave/server';
import { upgradeUserPlan } from '@/lib/auth/server';
import { db } from '@/lib/db';

// Flutterwave webhook — verification uses the secret hash set in the dashboard.
// The hash is sent in the `verif-hash` header.
export async function POST(req: NextRequest) {
  try {
    const providedHash = req.headers.get('verif-hash') ?? '';
    const flw = getFlutterwave();
    if (!flw.verifyWebhookSignature(providedHash)) {
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
    }

    const event = await req.json();
    const eventType = event?.event;
    const data = event?.data ?? {};

    if (eventType === 'charge.completed' || (eventType === 'transfer.completed' && data.status === 'successful')) {
      const txRef = data.tx_ref;
      const metadata = data.meta ?? {};
      const userId = metadata.user_id;
      const plan = metadata.plan ?? 'pro';

      // Update our payment record
      if (txRef) {
        await db.payment.updateMany({
          where: { reference: txRef },
          data: {
            status: 'success',
            verifiedAt: new Date(),
            providerData: JSON.stringify(data),
          },
        });
      }

      if (userId && plan) {
        await upgradeUserPlan(userId, plan);
      }
    }

    if (eventType === 'subscription.create' || eventType === 'subscription.activate') {
      // Track subscription
      const subCode = data.id?.toString() ?? data.subscription_code;
      const userId = data.meta?.user_id;
      if (userId && subCode) {
        await db.subscription.upsert({
          where: { userId },
          create: {
            userId,
            plan: data.meta?.plan ?? 'pro',
            status: 'active',
            providerSubCode: subCode,
            providerPlanCode: data.plan?.id?.toString(),
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
          update: {
            status: 'active',
            providerSubCode: subCode,
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        });
      }
    }

    if (eventType === 'subscription.cancel') {
      const userId = data.meta?.user_id;
      if (userId) {
        await db.subscription.updateMany({
          where: { userId },
          data: { status: 'canceled' },
        });
        await db.user.update({ where: { id: userId }, data: { plan: 'free' } });
      }
    }

    return NextResponse.json({ status: 'ok' });
  } catch (err: any) {
    console.error('Webhook error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
