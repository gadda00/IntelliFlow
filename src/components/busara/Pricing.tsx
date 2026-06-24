'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Check, Sparkles, Zap, Building2, ArrowRight, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api, Plan, storage } from '@/lib/api-client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function Pricing() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [paymentOpen, setFlutterwaveOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<string | null>(null);

  useEffect(() => {
    setUser(storage.getUser());
    api.getPlans().then(data => {
      setPlans(data.plans);
      setConfigured(data.configured);
      setLoading(false);
    });
  }, []);

  const handleUpgrade = async (plan: Plan) => {
    if (plan.id === 'free') return;
    if (plan.id === 'enterprise') {
      window.location.href = 'mailto:sales@busara.ai?subject=Enterprise Inquiry';
      return;
    }
    if (!user) {
      // Redirect to auth (just scroll to analyzer for demo)
      document.getElementById('analyze')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    setSelectedPlan(plan);
    setFlutterwaveOpen(true);
    setPaymentUrl(null);
    setVerifyResult(null);

    try {
      const result = await api.initializePayment(plan.id, 'NGN');
      if (result.authorizationUrl) {
        setPaymentUrl(result.authorizationUrl);
      }
    } catch (err: any) {
      setVerifyResult(`Error: ${err.message}`);
    }
  };

  const handleVerify = async () => {
    if (!selectedPlan) return;
    setVerifying(true);
    setVerifyResult(null);
    try {
      // Extract reference from URL or use a mock one
      const url = new URL(paymentUrl ?? '');
      const reference = url.searchParams.get('reference') || url.pathname.split('/').pop() || `ifl_mock_${Date.now()}`;
      const result = await api.verifyPayment(reference);
      if (result.status === 'success') {
        setVerifyResult(`✓ Payment verified! Your account has been upgraded to ${result.plan?.toUpperCase()}.`);
        // Refresh user
        const meResp = await api.me().catch(() => null);
        if (meResp?.user) {
          storage.setUser(meResp.user);
          setUser(meResp.user);
        }
      } else {
        setVerifyResult(`Payment not yet verified: ${result.error ?? 'pending'}`);
      }
    } catch (err: any) {
      setVerifyResult(`Verification failed: ${err.message}`);
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <section id="pricing" className="py-24">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 max-w-6xl mx-auto">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-96 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="pricing" className="py-24 relative">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-2xl mx-auto text-center mb-12"
        >
          <Badge variant="secondary" className="mb-3">Pricing · Flutterwave</Badge>
          <h2 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
            Pay only for value.<br />
            <span className="gradient-text">Cancel anytime.</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            {configured ? 'Secure payments via Flutterwave · Google Pay · Apple Pay · Mobile Money · Cards. NGN, USD, GHS, ZAR, KES supported.' : 'Demo mode — Flutterwave not configured. Set FLW_SECRET_KEY to enable live payments.'}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <Card className={`relative p-6 h-full flex flex-col ${
                plan.highlight ? 'border-primary shadow-lg ring-1 ring-primary/30' : ''
              }`}>
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground">
                      <Sparkles className="h-3 w-3 mr-1" /> Most Popular
                    </Badge>
                  </div>
                )}

                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    {plan.id === 'free' && <Zap className="h-4 w-4 text-muted-foreground" />}
                    {plan.id === 'pro' && <Sparkles className="h-4 w-4 text-primary" />}
                    {plan.id === 'team' && <Building2 className="h-4 w-4 text-chart-2" />}
                    {plan.id === 'enterprise' && <Building2 className="h-4 w-4 text-chart-5" />}
                    <h3 className="font-semibold text-lg">{plan.name}</h3>
                    {user?.plan === plan.id && (
                      <Badge variant="secondary" className="text-[10px]">Current</Badge>
                    )}
                  </div>
                  <div className="flex items-baseline gap-1">
                    {plan.priceNGN === 0 && plan.id === 'enterprise' ? (
                      <span className="text-3xl font-bold">Custom</span>
                    ) : (
                      <>
                        <span className="text-3xl font-bold">₦{plan.priceNGN.toLocaleString()}</span>
                        <span className="text-sm text-muted-foreground">/mo</span>
                      </>
                    )}
                  </div>
                  {plan.priceUSD > 0 && (
                    <div className="text-xs text-muted-foreground mt-1">≈ ${plan.priceUSD}/mo USD</div>
                  )}
                  <div className="text-xs text-muted-foreground mt-1">
                    {plan.analysesPerMonth === -1 ? 'Unlimited analyses' : `${plan.analysesPerMonth} analyses/mo`}
                  </div>
                </div>

                <ul className="space-y-2 text-sm flex-1 mb-4">
                  {plan.features.map(feature => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <span className="text-foreground/80">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  onClick={() => handleUpgrade(plan)}
                  variant={plan.highlight ? 'default' : 'outline'}
                  className="w-full"
                  disabled={user?.plan === plan.id}
                >
                  {user?.plan === plan.id ? 'Current Plan' :
                   plan.id === 'free' ? 'Get Started' :
                   plan.id === 'enterprise' ? 'Contact Sales' :
                   `Upgrade to ${plan.name}`}
                  {plan.id !== 'free' && plan.id !== 'enterprise' && user?.plan !== plan.id && (
                    <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  )}
                </Button>
              </Card>
            </motion.div>
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-8 max-w-md mx-auto">
          All plans include access to all 20+ AI agents. Higher tiers unlock more analyses per month,
          team features, and API access. Subscriptions renew automatically; cancel anytime.
        </p>
      </div>

      {/* Flutterwave Modal */}
      <Dialog open={paymentOpen} onOpenChange={setFlutterwaveOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Upgrade to {selectedPlan?.name}
            </DialogTitle>
            <DialogDescription>
              You'll be redirected to Flutterwave's secure payment page to complete your upgrade to {selectedPlan?.name}.
              {configured ? '' : ' (Demo mode — Flutterwave not configured, using mock flow.)'}
            </DialogDescription>
          </DialogHeader>

          {paymentUrl && !verifyResult && (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-muted/30 border border-border text-sm">
                <div className="flex justify-between mb-1">
                  <span className="text-muted-foreground">Plan</span>
                  <span className="font-medium">{selectedPlan?.name}</span>
                </div>
                <div className="flex justify-between mb-1">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-medium">₦{selectedPlan?.priceNGN.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Analyses/mo</span>
                  <span className="font-medium">{selectedPlan?.analysesPerMonth}</span>
                </div>
              </div>
              <Button
                onClick={() => window.open(paymentUrl, '_blank')}
                className="w-full gap-2"
              >
                <CreditCard className="h-4 w-4" />
                Pay with Flutterwave
              </Button>
              <Button
                onClick={handleVerify}
                variant="outline"
                className="w-full"
                disabled={verifying}
              >
                {verifying ? 'Verifying...' : 'I\'ve Paid — Verify'}
              </Button>
            </div>
          )}

          {verifyResult && (
            <div className="p-4 rounded-lg bg-muted/30 border border-border text-sm whitespace-pre-wrap">
              {verifyResult}
            </div>
          )}

          {!paymentUrl && !verifyResult && (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">Initializing payment...</div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary animate-pulse" style={{ width: '60%' }} />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
