import { NextResponse } from 'next/server';
import { PLANS } from '@/lib/paystack/server';

export async function GET() {
  return NextResponse.json({
    plans: Object.values(PLANS).map(p => ({
      ...p,
      paystackPlanCode: undefined, // don't expose internal codes
    })),
    currency: 'NGN',
    paystackPublicKey: process.env.PAYSTACK_PUBLIC_KEY ?? '',
    configured: !!(process.env.PAYSTACK_SECRET_KEY && process.env.PAYSTACK_SECRET_KEY.startsWith('sk_')),
  });
}
