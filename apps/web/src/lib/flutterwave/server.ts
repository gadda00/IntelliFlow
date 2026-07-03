// Flutterwave payment integration — server-side only
// Replaces Paystack. Supports NGN, USD, GHS, ZAR, KES, UGX, TZS, RWF, EUR, GBP.
// https://developer.flutterwave.com

import crypto from 'crypto';

const FLW_BASE = 'https://api.flutterwave.com/v3';

export interface Plan {
  id: string;
  name: string;
  priceNGN: number;
  priceUSD: number;
  analysesPerMonth: number;
  features: string[];
  highlight?: boolean;
  flwPlanId?: number; // Flutterwave plan ID for recurring
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
      'All 20+ AI agents',
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
      'All 20+ AI agents',
      'Forecasting & anomaly detection',
      'Causal analysis & explainability',
      'API access',
      'Priority support',
      'Unlimited history',
    ],
    highlight: true,
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
  amountKobo: number; // Flutterwave also uses smallest currency unit
  currency?: string;
  customerName?: string;
  customerPhone?: string;
  metadata?: Record<string, any>;
  callbackUrl?: string;
  planId?: number;
  paymentOptions?: string; // e.g., "card, googlepay, applepay, mobilemoneyghana, mobilemoneyrwanda"
}

export interface InitTransactionResult {
  success: boolean;
  authorizationUrl?: string;
  flwRef?: string;
  reference?: string;
  error?: string;
}

export interface VerifyResult {
  success: boolean;
  reference?: string;
  flwRef?: string;
  amount?: number;
  currency?: string;
  status?: string;
  metadata?: Record<string, any>;
  customer?: { email: string; name?: string };
  error?: string;
}

export class FlutterwaveService {
  private secretKey: string;
  private publicKey: string;
  private webhookHash: string;

  constructor() {
    this.secretKey = process.env.FLW_SECRET_KEY ?? '';
    this.publicKey = process.env.FLW_PUBLIC_KEY ?? '';
    this.webhookHash = process.env.FLW_WEBHOOK_HASH ?? '';
  }

  isConfigured(): boolean {
    return !!this.secretKey && this.secretKey.startsWith('FLWSECK-');
  }

  async initializeTransaction(args: InitTransactionArgs): Promise<InitTransactionResult> {
    if (!this.isConfigured()) {
      // Mock mode for development
      const ref = `busara_mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      return {
        success: true,
        authorizationUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/billing?mock_ref=${ref}`,
        flwRef: ref,
        reference: ref,
      };
    }

    const txRef = `busara_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const payload: Record<string, any> = {
      tx_ref: txRef,
      amount: args.amountKobo / 100, // Flutterwave uses major currency unit
      currency: args.currency ?? 'NGN',
      customer: {
        email: args.email,
        name: args.customerName ?? args.email,
      },
      customizations: {
        title: 'Busara',
        logo: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/icon-512.png`,
      },
      meta: args.metadata ?? {},
    };
    if (args.customerPhone) payload.customer.phone_number = args.customerPhone;
    if (args.callbackUrl) payload.redirect_url = args.callbackUrl;
    if (args.planId) payload.payment_plan = args.planId;
    // Default: enable card + Google Pay + Apple Pay + mobile money (Africa)
    payload.payment_options = args.paymentOptions ?? 'card, googlepay, applepay, mobilemoneyghana, mobilemoneyrwanda, mobilemoneyuganda, mobilemoneyzambia, mpesa, accountbank';

    try {
      const resp = await fetch(`${FLW_BASE}/payments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const data = await resp.json();
      if (data.status === 'success' && data.data) {
        return {
          success: true,
          authorizationUrl: data.data.link,
          flwRef: data.data.flw_ref,
          reference: txRef,
        };
      }
      return { success: false, error: data.message ?? 'Unknown Flutterwave error' };
    } catch (err: any) {
      return { success: false, error: err?.message ?? 'Network error' };
    }
  }

  async verifyTransaction(txRef: string): Promise<VerifyResult> {
    if (!this.isConfigured()) {
      // Mock mode — simulate success
      return {
        success: true,
        reference: txRef,
        flwRef: txRef,
        amount: 15000 * 100,
        currency: 'NGN',
        status: 'successful',
        metadata: { plan: 'pro' },
      };
    }
    try {
      const resp = await fetch(`${FLW_BASE}/transactions/${encodeURIComponent(txRef)}/verify`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${this.secretKey}` },
      });
      const data = await resp.json();
      if (data.status === 'success' && data.data?.status === 'successful') {
        return {
          success: true,
          reference: txRef,
          flwRef: data.data.flw_ref,
          amount: data.data.amount * 100, // back to kobo
          currency: data.data.currency,
          status: data.data.status,
          metadata: data.data.meta ?? {},
          customer: {
            email: data.data.customer?.email ?? '',
            name: data.data.customer?.name,
          },
        };
      }
      return { success: false, error: data.message ?? 'Verification failed', status: data.data?.status };
    } catch (err: any) {
      return { success: false, error: err?.message ?? 'Network error' };
    }
  }

  /**
   * Flutterwave webhook verification uses a secret hash (verif-hash) that you set
   * in the dashboard. The hash is sent in the `verif-hash` header.
   */
  verifyWebhookSignature(providedHash: string): boolean {
    if (!this.webhookHash) return true; // skip in dev if not configured
    return providedHash === this.webhookHash;
  }

  async createPlan(name: string, amountNGN: number, interval: 'daily' | 'weekly' | 'monthly' | 'yearly' = 'monthly'): Promise<{ success: boolean; planId?: number; error?: string }> {
    if (!this.isConfigured()) return { success: false, error: 'Not configured' };
    try {
      const resp = await fetch(`${FLW_BASE}/payment-plans`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          amount: amountNGN,
          interval,
          currency: 'NGN',
        }),
      });
      const data = await resp.json();
      if (data.status === 'success') return { success: true, planId: data.data.id };
      return { success: false, error: data.message };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}

// Singleton
let _flw: FlutterwaveService | null = null;
export function getFlutterwave(): FlutterwaveService {
  if (!_flw) _flw = new FlutterwaveService();
  return _flw;
}
