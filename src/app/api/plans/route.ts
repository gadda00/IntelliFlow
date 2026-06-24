import { NextResponse } from 'next/server';
import { PLANS } from '@/lib/flutterwave/server';

export async function GET() {
  return NextResponse.json({
    plans: Object.values(PLANS).map(p => ({
      ...p,
      flwPlanId: undefined, // don't expose internal IDs
    })),
    currency: 'NGN',
    provider: 'flutterwave',
    publicKey: process.env.FLW_PUBLIC_KEY ?? '',
    configured: !!(process.env.FLW_SECRET_KEY && process.env.FLW_SECRET_KEY.startsWith('FLWSECK-')),
  });
}
