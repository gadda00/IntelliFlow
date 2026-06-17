import React, { useState } from 'react';

interface Plan {
  id: string;
  name: string;
  price_ngn: number | null;
  price_usd: number | null;
  analyses_per_month: number | '-1';
  features: string[];
  popular?: boolean;
  color: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentPlan?: string;
  userEmail?: string;
}

const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    price_ngn: 0,
    price_usd: 0,
    analyses_per_month: 5,
    color: '#64748b',
    features: [
      '5 analyses / month',
      'Basic statistical analysis',
      'CSV & JSON upload',
      'Standard charts',
      'Community support'
    ]
  },
  {
    id: 'pro',
    name: 'Pro',
    price_ngn: 15000,
    price_usd: 29,
    analyses_per_month: 50,
    color: '#3b82f6',
    popular: true,
    features: [
      '50 analyses / month',
      'All 12 AI agents',
      'Anomaly detection',
      'Time series forecasting',
      'Causal analysis',
      'API access (1K calls/mo)',
      'PDF export',
      'Email support'
    ]
  },
  {
    id: 'team',
    name: 'Team',
    price_ngn: 50000,
    price_usd: 99,
    analyses_per_month: 200,
    color: '#8b5cf6',
    features: [
      '200 analyses / month',
      'Everything in Pro',
      'Team collaboration',
      'Shared dashboards',
      'API access (10K calls/mo)',
      'Priority support',
      'Advanced exports',
      'Webhook notifications'
    ]
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price_ngn: null,
    price_usd: null,
    analyses_per_month: '-1',
    color: '#f59e0b',
    features: [
      'Unlimited analyses',
      'Dedicated infrastructure',
      'Custom AI agents',
      'SSO integration',
      'SLA guarantee',
      'Dedicated support',
      'On-premise option',
      'Custom integrations'
    ]
  }
];

const FEATURE_ICONS: Record<string, string> = {
  '12 AI agents': '🤖',
  'Anomaly': '🚨',
  'forecasting': '🔮',
  'Causal': '🔗',
  'API': '⚡',
  'collaboration': '👥',
  'SSO': '🔐',
  'Unlimited': '♾️',
  'Custom': '⚙️',
  'PDF': '📄',
  'Priority': '⭐',
  'Dedicated': '🏆'
};

function getFeatureIcon(feature: string): string {
  for (const [key, icon] of Object.entries(FEATURE_ICONS)) {
    if (feature.toLowerCase().includes(key.toLowerCase())) return icon;
  }
  return '✓';
}

export const PaystackModal: React.FC<Props> = ({
  isOpen,
  onClose,
  currentPlan = 'free',
  userEmail = ''
}) => {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [currency, setCurrency] = useState<'NGN' | 'USD'>('NGN');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleUpgrade = async (planId: string) => {
    if (planId === 'free' || planId === currentPlan) return;
    if (planId === 'enterprise') {
      window.location.href = 'mailto:sales@intelliflow.ai?subject=Enterprise Enquiry';
      return;
    }

    setIsLoading(true);
    setError(null);
    setSelectedPlan(planId);

    try {
      const token = localStorage.getItem('intelliflow_token');
      const res = await fetch('/api/payments/initialize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ plan: planId, currency })
      });
      const data = await res.json();

      if (data.authorization_url) {
        // Open Paystack checkout in a popup
        const popup = window.open(
          data.authorization_url,
          'Paystack Checkout',
          'width=600,height=700,scrollbars=yes,resizable=yes'
        );

        // Poll for popup close
        const pollClose = setInterval(() => {
          if (popup?.closed) {
            clearInterval(pollClose);
            setSuccessMessage(`Payment complete! Your ${planId.toUpperCase()} plan is now active.`);
            setIsLoading(false);
            setTimeout(() => { setSuccessMessage(null); onClose(); }, 3000);
          }
        }, 500);
      } else {
        setError(data.error || 'Payment initialisation failed. Please try again.');
        setIsLoading(false);
      }
    } catch (e) {
      setError('Network error. Please check your connection and try again.');
      setIsLoading(false);
    }
    setSelectedPlan(null);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
      padding: 20
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
        border: '1px solid #334155',
        borderRadius: 20,
        padding: 32,
        width: '100%',
        maxWidth: 920,
        maxHeight: '90vh',
        overflowY: 'auto',
        fontFamily: "'Inter', -apple-system, sans-serif"
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
          <div>
            <h2 style={{ color: '#f1f5f9', margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em' }}>
              Upgrade IntelliFlow
            </h2>
            <p style={{ color: '#94a3b8', margin: '6px 0 0', fontSize: 14 }}>
              Unlock AI-powered analysis, forecasting, and causal insights
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* Currency toggle */}
            <div style={{
              display: 'flex', background: '#1e293b', borderRadius: 8,
              padding: 2, border: '1px solid #334155'
            }}>
              {(['NGN', 'USD'] as const).map(cur => (
                <button key={cur} onClick={() => setCurrency(cur)} style={{
                  background: currency === cur ? '#3b82f6' : 'transparent',
                  border: 'none', color: currency === cur ? '#fff' : '#64748b',
                  borderRadius: 6, padding: '4px 12px', fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', transition: 'all 0.2s'
                }}>{cur}</button>
              ))}
            </div>
            <button onClick={onClose} style={{
              background: '#1e293b', border: '1px solid #334155', color: '#94a3b8',
              borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 16
            }}>✕</button>
          </div>
        </div>

        {/* Success / Error messages */}
        {successMessage && (
          <div style={{
            background: 'rgba(34,197,94,0.1)', border: '1px solid #22c55e',
            borderRadius: 10, padding: '12px 16px', marginBottom: 20,
            color: '#86efac', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8
          }}>
            🎉 {successMessage}
          </div>
        )}
        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444',
            borderRadius: 10, padding: '12px 16px', marginBottom: 20,
            color: '#fca5a5', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8
          }}>
            ⚠️ {error}
            <button onClick={() => setError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer' }}>✕</button>
          </div>
        )}

        {/* Plan cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 14
        }}>
          {PLANS.map(plan => {
            const isCurrent = plan.id === currentPlan;
            const isSelected = selectedPlan === plan.id;
            const price = currency === 'NGN' ? plan.price_ngn : plan.price_usd;
            const symbol = currency === 'NGN' ? '₦' : '$';

            return (
              <div key={plan.id} style={{
                background: plan.popular ? `${plan.color}12` : 'rgba(15,23,42,0.6)',
                border: `1.5px solid ${isCurrent ? '#22c55e' : plan.popular ? plan.color : '#334155'}`,
                borderRadius: 14,
                padding: 20,
                position: 'relative',
                transition: 'transform 0.2s, box-shadow 0.2s',
                boxShadow: plan.popular ? `0 0 20px ${plan.color}22` : 'none'
              }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)';
                  (e.currentTarget as HTMLDivElement).style.boxShadow = `0 8px 24px ${plan.color}33`;
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
                  (e.currentTarget as HTMLDivElement).style.boxShadow = plan.popular ? `0 0 20px ${plan.color}22` : 'none';
                }}
              >
                {plan.popular && (
                  <div style={{
                    position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
                    background: plan.color, color: '#fff', fontSize: 10, fontWeight: 700,
                    padding: '2px 10px', borderRadius: 20, whiteSpace: 'nowrap'
                  }}>
                    ⭐ MOST POPULAR
                  </div>
                )}
                {isCurrent && (
                  <div style={{
                    position: 'absolute', top: -10, right: 12,
                    background: '#22c55e', color: '#fff', fontSize: 10, fontWeight: 700,
                    padding: '2px 8px', borderRadius: 20
                  }}>
                    CURRENT
                  </div>
                )}

                {/* Plan name */}
                <div style={{ color: plan.color, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                  {plan.name}
                </div>

                {/* Price */}
                <div style={{ marginBottom: 16 }}>
                  {price === null ? (
                    <div style={{ color: '#f1f5f9', fontSize: 22, fontWeight: 800 }}>Custom</div>
                  ) : price === 0 ? (
                    <div style={{ color: '#f1f5f9', fontSize: 22, fontWeight: 800 }}>Free</div>
                  ) : (
                    <div>
                      <span style={{ color: '#94a3b8', fontSize: 14 }}>{symbol}</span>
                      <span style={{ color: '#f1f5f9', fontSize: 28, fontWeight: 800 }}>{price.toLocaleString()}</span>
                      <span style={{ color: '#64748b', fontSize: 12 }}>/mo</span>
                    </div>
                  )}
                  <div style={{ color: '#64748b', fontSize: 11, marginTop: 2 }}>
                    {plan.analyses_per_month === '-1' ? 'Unlimited' : `${plan.analyses_per_month}`} analyses/month
                  </div>
                </div>

                {/* Features */}
                <div style={{ marginBottom: 18 }}>
                  {plan.features.map((f, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 6,
                      marginBottom: 5, color: '#cbd5e1', fontSize: 12
                    }}>
                      <span style={{ fontSize: 13, flexShrink: 0 }}>{getFeatureIcon(f)}</span>
                      <span>{f}</span>
                    </div>
                  ))}
                </div>

                {/* CTA button */}
                <button
                  onClick={() => handleUpgrade(plan.id)}
                  disabled={isCurrent || isLoading}
                  style={{
                    width: '100%',
                    background: isCurrent
                      ? 'rgba(34,197,94,0.15)'
                      : plan.id === 'enterprise'
                        ? '#f59e0b22'
                        : `linear-gradient(135deg, ${plan.color}, ${plan.color}cc)`,
                    border: `1px solid ${isCurrent ? '#22c55e' : plan.color}`,
                    borderRadius: 9,
                    color: isCurrent ? '#22c55e' : '#fff',
                    padding: '10px 0',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: isCurrent || isLoading ? 'not-allowed' : 'pointer',
                    opacity: isLoading && selectedPlan !== plan.id ? 0.5 : 1,
                    transition: 'all 0.2s',
                    letterSpacing: '0.01em'
                  }}
                >
                  {isCurrent ? '✓ Active Plan' :
                   isLoading && selectedPlan === plan.id ? '⟳ Redirecting…' :
                   plan.id === 'enterprise' ? '📧 Contact Sales' :
                   plan.id === 'free' ? 'Downgrade' :
                   `Upgrade to ${plan.name}`}
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{
          marginTop: 24, paddingTop: 20, borderTop: '1px solid #1e293b',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexWrap: 'wrap', gap: 12
        }}>
          <div style={{ display: 'flex', gap: 20 }}>
            {['🔒 Secured by Paystack', '↩ Cancel anytime', '🌍 NGN & USD accepted'].map((item, i) => (
              <span key={i} style={{ color: '#64748b', fontSize: 12 }}>{item}</span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <img
              src="https://paystack.com/assets/img/logos/paystack-logo-white.svg"
              alt="Paystack"
              style={{ height: 16, opacity: 0.5 }}
              onError={e => (e.currentTarget.style.display = 'none')}
            />
            <span style={{ color: '#334155', fontSize: 11 }}>Payments secured by Paystack</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaystackModal;
