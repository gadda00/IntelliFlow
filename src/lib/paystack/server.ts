// Paystack integration — server-side only
// Initialize transactions, verify payments, manage subscriptions, validate webhooks

import crypto from 'crypto';

const PAYSTACK_BASE = 'https://api.paystack.co';

export interface Plan {
  id: string;
  name: string;
  priceNGN: number;  // in naira
  priceUSD: number;
  analysesPerMonth: number;
  features: string[];
  highlight?: boolean;
  paystackPlanCode?: string;
}

export const PLANS: Record<string, Plan> = {
  free: {
    id: 'free',
    name: 'Free',
    priceNGN: 0,
    priceUSD: 0,
    analysesPerMonth: 5,
    features: [
      '5 analyses per month',
      'All 20 agents',
      'CSV, JSON, Excel upload',
      'PDF & Excel export',
      '7-day history',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Professional',
    priceNGN: 15000,
    priceUSD: 29,
    analysesPerMonth: 50,
    features: [
      '50 analyses per month',
      'All 20 agents',
      'Forecasting & anomaly detection',
      'Causal analysis & explainability',
      'API access',
      'Priority support',
      'Unlimited history',
    ],
    highlight: true,
    paystackPlanCode: process.env.PAYSTACK_PRO_PLAN_CODE,
  },
  team: {
    id: 'team',
    name: 'Team',
    priceNGN: 50000,
    priceUSD: 99,
    analysesPerMonth: 200,
    features: [
      '200 analyses per month',
      'Everything in Pro',
      'Team collaboration (5 seats)',
      'Conversational analyst',
      'Synthetic data generation',
      'Priority support',
      'Custom branding',
    ],
    paystackPlanCode: process.env.PAYSTACK_TEAM_PLAN_CODE,
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    priceNGN: 0,
    priceUSD: 0,
    analysesPerMonth: -1,
    features: [
      'Unlimited analyses',
      'Everything in Team',
      'Dedicated support',
      'SSO & SAML',
      'Custom agents',
      'On-premise option',
      'SLA 99.9%',
    ],
  },
};

export interface InitTransactionArgs {
  email: string;
  amountKobo: number;
  currency?: 'NGN' | 'USD' | 'GHS' | 'ZAR' | 'KES';
  metadata?: Record<string, any>;
  callbackUrl?: string;
  planCode?: string;
  subscription?: boolean;
}

export interface InitTransactionResult {
  success: boolean;
  authorizationUrl?: string;
  accessCode?: string;
  reference?: string;
  error?: string;
}

export interface VerifyResult {
  success: boolean;
  reference?: string;
  amount?: number;
  currency?: string;
  status?: string;
  metadata?: Record<string, any>;
  customer?: { email: string };
  error?: string;
}

export class PaystackService {
  private secretKey: string;
  private publicKey: string;

  constructor() {
    this.secretKey = process.env.PAYSTACK_SECRET_KEY ?? '';
    this.publicKey = process.env.PAYSTACK_PUBLIC_KEY ?? '';
  }

  isConfigured(): boolean {
    return !!this.secretKey && this.secretKey.startsWith('sk_');
  }

  async initializeTransaction(args: InitTransactionArgs): Promise<InitTransactionResult> {
    if (!this.isConfigured()) {
      // Mock mode for development — generate a fake reference
      const ref = `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      return {
        success: true,
        authorizationUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/payment/mock?ref=${ref}`,
        accessCode: ref,
        reference: ref,
      };
    }
    const payload: Record<string, any> = {
      email: args.email,
      amount: args.amountKobo,
      currency: args.currency ?? 'NGN',
      metadata: args.metadata ?? {},
    };
    if (args.callbackUrl) payload.callback_url = args.callbackUrl;
    if (args.planCode) payload.plan = args.planCode;

    try {
      const resp = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const data = await resp.json();
      if (data.status && data.data) {
        return {
          success: true,
          authorizationUrl: data.data.authorization_url,
          accessCode: data.data.access_code,
          reference: data.data.reference,
        };
      }
      return { success: false, error: data.message ?? 'Unknown Paystack error' };
    } catch (err: any) {
      return { success: false, error: err?.message ?? 'Network error' };
    }
  }

  async verifyTransaction(reference: string): Promise<VerifyResult> {
    if (!this.isConfigured()) {
      // Mock mode — simulate success
      return {
        success: true,
        reference,
        amount: 1500000,
        currency: 'NGN',
        status: 'success',
        metadata: { plan: 'pro' },
      };
    }
    try {
      const resp = await fetch(`${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${this.secretKey}` },
      });
      const data = await resp.json();
      if (data.status && data.data?.status === 'success') {
        return {
          success: true,
          reference,
          amount: data.data.amount,
          currency: data.data.currency,
          status: data.data.status,
          metadata: data.data.metadata ?? {},
          customer: { email: data.data.customer?.email ?? '' },
        };
      }
      return { success: false, error: data.message ?? 'Verification failed', status: data.data?.status };
    } catch (err: any) {
      return { success: false, error: err?.message ?? 'Network error' };
    }
  }

  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    if (!this.isConfigured()) return true; // skip in dev
    const hash = crypto.createHmac('sha512', this.secretKey).update(rawBody).digest('hex');
    return hash === signature;
  }

  async createPlan(name: string, amountKobo: number, interval: 'monthly' | 'yearly' | 'weekly' | 'daily' = 'monthly'): Promise<{ success: boolean; planCode?: string; error?: string }> {
    if (!this.isConfigured()) return { success: false, error: 'Not configured' };
    try {
      const resp = await fetch(`${PAYSTACK_BASE}/plan`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, amount: amountKobo, interval: interval === 'yearly' ? 'annually' : interval, currency: 'NGN' }),
      });
      const data = await resp.json();
      if (data.status) return { success: true, planCode: data.data.plan_code };
      return { success: false, error: data.message };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}

// Singleton
let _paystack: PaystackService | null = null;
export function getPaystack(): PaystackService {
  if (!_paystack) _paystack = new PaystackService();
  return _paystack;
}
