import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Zap, ArrowRight, X, Loader2, Lock } from 'lucide-react';
import { fontFamily } from '../design-system/tokens';
import { apiClient } from '../lib/api';
import { TIER_FEATURES, TIERS } from '../config/tiers';
import { toast } from 'sonner';

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    period: 'forever',
    desc: 'Get started with core market intelligence.',
    color: '#64748B',
    cta: 'Current Plan',
    ctaAction: null,
  },
  {
    id: 'foundation',
    name: 'Foundation',
    price: 99,
    period: 'per month',
    desc: 'Full revenue, operations and AI advisor access.',
    color: '#3B82F6',
    cta: 'Upgrade to Foundation',
    popular: false,
    ctaAction: 'foundation',
  },
  {
    id: 'growth',
    name: 'Growth',
    price: 249,
    period: 'per month',
    desc: 'Complete platform access including Risk, Boardroom and Watchtower.',
    color: '#FF6A00',
    cta: 'Upgrade to Growth',
    popular: true,
    ctaAction: 'growth',
  },
  {
    id: 'custom',
    name: 'Enterprise',
    price: null,
    period: 'custom pricing',
    desc: 'Multi-user, white labelling and dedicated support.',
    color: '#8B5CF6',
    cta: 'Contact Sales',
    ctaAction: 'contact',
  },
];

export default function UpgradePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(null);

  const handleUpgrade = async (plan) => {
    if (plan === 'contact') {
      window.location.href = 'mailto:sales@biqc.com.au?subject=Enterprise enquiry';
      return;
    }
    setLoading(plan);
    try {
      const res = await apiClient.post('/stripe/create-checkout-session', {
        tier: plan,
        success_url: `${window.location.origin}/upgrade/success`,
        cancel_url:  `${window.location.origin}/upgrade`,
      });
      if (res.data?.url) {
        window.location.href = res.data.url;
      } else {
        toast.error('Failed to start checkout. Please try again.');
      }
    } catch {
      toast.error('Failed to start checkout. Please try again.');
    }
    setLoading(null);
  };

  return (
    <div className="min-h-screen" style={{ background: '#070E18', fontFamily: fontFamily.body }}>
      <div className="max-w-6xl mx-auto px-6 py-16">

        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-4"
            style={{ background: 'rgba(255,106,0,0.1)', border: '1px solid rgba(255,106,0,0.2)' }}>
            <Lock className="w-3.5 h-3.5" style={{ color: '#FF6A00' }} />
            <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#FF6A00', fontFamily: fontFamily.mono }}>
              Upgrade Required
            </span>
          </div>
          <h1 className="text-4xl font-bold mb-4" style={{ color: '#F4F7FA', fontFamily: fontFamily.display }}>
            Unlock the full power of BIQc
          </h1>
          <p className="text-lg max-w-xl mx-auto" style={{ color: '#9FB0C3' }}>
            Your free plan gives you the foundations. Upgrade to access Revenue intelligence, Risk monitoring, AI Advisor and more.
          </p>
        </div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-16">
          {PLANS.map(plan => (
            <div key={plan.id} className="relative rounded-2xl p-6 flex flex-col"
              style={{
                background: plan.popular ? 'rgba(255,106,0,0.08)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${plan.popular ? 'rgba(255,106,0,0.4)' : '#1E2D3D'}`,
                boxShadow: plan.popular ? '0 0 40px rgba(255,106,0,0.12)' : 'none',
              }}>
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-bold"
                  style={{ background: '#FF6A00', color: 'white', fontFamily: fontFamily.mono }}>
                  MOST POPULAR
                </div>
              )}

              <div className="mb-5">
                <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: plan.color, fontFamily: fontFamily.mono }}>{plan.name}</p>
                <div className="flex items-end gap-1 mb-2">
                  {plan.price != null
                    ? <>
                        <span className="text-4xl font-bold" style={{ color: '#F4F7FA', fontFamily: fontFamily.display }}>${plan.price}</span>
                        <span className="text-sm pb-1" style={{ color: '#64748B' }}>/mo</span>
                      </>
                    : <span className="text-2xl font-bold" style={{ color: '#F4F7FA', fontFamily: fontFamily.display }}>Custom</span>
                  }
                </div>
                <p className="text-sm" style={{ color: '#9FB0C3' }}>{plan.desc}</p>
              </div>

              <ul className="space-y-2 flex-1 mb-6">
                {(TIER_FEATURES[plan.id] || []).map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs" style={{ color: '#9FB0C3' }}>
                    <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: plan.color }} />
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => plan.ctaAction && handleUpgrade(plan.ctaAction)}
                disabled={!plan.ctaAction || loading === plan.ctaAction}
                className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all"
                style={{
                  background: !plan.ctaAction ? 'transparent'
                    : plan.popular ? '#FF6A00'
                    : `${plan.color}20`,
                  color: !plan.ctaAction ? '#4A5568' : plan.popular ? 'white' : plan.color,
                  border: !plan.ctaAction ? '1px solid #243140' : plan.popular ? 'none' : `1px solid ${plan.color}40`,
                  cursor: !plan.ctaAction ? 'default' : 'pointer',
                }}
                data-testid={`upgrade-${plan.id}`}>
                {loading === plan.ctaAction
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <>
                      {plan.cta}
                      {plan.ctaAction && <ArrowRight className="w-4 h-4" />}
                    </>
                }
              </button>
            </div>
          ))}
        </div>

        {/* Back link */}
        <div className="text-center">
          <button onClick={() => navigate(-1)} className="text-sm" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>
            ← Back to platform
          </button>
        </div>

      </div>
    </div>
  );
}
