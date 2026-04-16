import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, CheckCircle2, Loader2, Lock } from 'lucide-react';
import { fontFamily } from '../design-system/tokens';
import { apiClient } from '../lib/api';
import { TIER_FEATURES } from '../config/tiers';
import { PRICING_TIERS } from '../config/pricingTiers';
import { toast } from 'sonner';
import { trackGoogleTagEvent } from '../lib/analytics';

export default function UpgradePage({ success = false }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [selectedTier, setSelectedTier] = useState('starter');
  const purchaseTracked = useRef(false);

  // Fire GA4 purchase conversion event on successful checkout return —
  // ONLY after the server confirms the Stripe session is real, paid, and
  // owned by this user. Without this gate an authenticated attacker could
  // hit /upgrade/success?session_id=FAKE and forge `purchase` events in
  // GA4, poisoning Google Ads conversion data.
  useEffect(() => {
    if (!success || purchaseTracked.current) return;
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    const planId = params.get('plan') || 'starter';

    // No session_id in URL — nothing to confirm. Skip the fire rather than
    // tagging an inaccurate conversion.
    if (!sessionId) {
      purchaseTracked.current = true;
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.get(
          `/stripe/checkout/${encodeURIComponent(sessionId)}/confirm`
        );
        if (cancelled) return;
        const payload = res?.data || {};
        if (!payload.confirmed) {
          // Stripe says not paid (yet) or ownership mismatch — do not fire.
          purchaseTracked.current = true;
          return;
        }

        purchaseTracked.current = true;
        const tierFromConfig =
          PRICING_TIERS.find((t) => t.id === (payload.tier || planId)) ||
          PRICING_TIERS.find((t) => t.id === 'starter');
        const valueDollars =
          typeof payload.amount_total === 'number' && payload.amount_total > 0
            ? payload.amount_total / 100
            : tierFromConfig?.priceNum || 0;
        const currency = (payload.currency || 'AUD').toUpperCase();

        trackGoogleTagEvent('purchase', {
          transaction_id: payload.session_id || sessionId,
          value: valueDollars,
          currency,
          items: [
            {
              item_name: payload.plan_name || tierFromConfig?.name || 'BIQc Subscription',
              item_category: 'subscription',
            },
          ],
        });
        trackGoogleTagEvent('biqc_subscription_activated', {
          plan: payload.tier || planId,
          source: 'stripe_checkout',
        });
      } catch {
        // Swallow — a failed confirmation must never trigger a fake fire.
        if (!cancelled) purchaseTracked.current = true;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [success]);

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const selectedPlan = PRICING_TIERS.find((tier) => tier.id === selectedTier);
      if (!selectedPlan || selectedTier === 'custom_build') {
        navigate('/contact?source=upgrade&feature=custom-build');
        return;
      }
      trackGoogleTagEvent('begin_checkout', {
        plan_name: selectedPlan.name,
        plan_tier: selectedTier,
        value: selectedPlan.priceNum || 0,
        currency: 'AUD',
      });
      trackGoogleTagEvent('biqc_foundation_purchase_click', {
        plan_name: selectedPlan.name,
        value: selectedPlan.priceNum || 0,
        currency: 'AUD',
      });

      const res = await apiClient.post('/stripe/create-checkout-session', {
        tier: selectedTier,
        success_url: `${window.location.origin}/upgrade/success?session_id={CHECKOUT_SESSION_ID}&plan=${selectedTier}`,
        cancel_url: `${window.location.origin}/upgrade`,
      });
      if (res.data?.url) {
        trackGoogleTagEvent('biqc_foundation_checkout_redirect', {
          plan_name: selectedPlan.name,
          value: selectedPlan.priceNum || 0,
          currency: 'AUD',
        });
        window.location.href = res.data.url;
        return;
      }
      toast.error('Failed to start checkout. Please try again.');
    } catch {
      toast.error('Failed to start checkout. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen px-6 py-16" style={{ background: 'var(--canvas-app, #FAFAFA)', fontFamily: fontFamily.body }} data-testid="upgrade-success-page">
        <div className="mx-auto max-w-3xl space-y-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full px-4 py-2" style={{ background: 'rgba(16,185,129,0.14)', border: '1px solid rgba(16,185,129,0.3)' }}>
            <CheckCircle2 className="h-4 w-4 text-[#10B981]" />
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#10B981]" style={{ fontFamily: fontFamily.mono }}>
              Upgrade successful
            </span>
          </div>
          <h1 className="text-4xl sm:text-5xl" style={{ color: 'var(--ink-display, #EDF1F7)', fontFamily: fontFamily.display }}>
            BIQc Foundation is now active
          </h1>
          <p className="mx-auto max-w-2xl text-sm sm:text-base" style={{ color: 'var(--ink-secondary, #8FA0B8)' }}>
            Your subscription has been confirmed. You can now access BIQc Foundation modules from the platform menu.
          </p>
          <div className="mx-auto flex max-w-md flex-col gap-3 sm:flex-row">
            <button
              onClick={() => navigate('/advisor')}
              className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-white"
              style={{ background: '#E85D00', fontFamily: fontFamily.body }}
              data-testid="upgrade-success-go-advisor"
            >
              Go to Advisor <ArrowRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => navigate('/subscribe?section=foundation')}
              className="inline-flex min-h-[48px] flex-1 items-center justify-center rounded-2xl border text-sm font-semibold"
              style={{ borderColor: 'rgba(140,170,210,0.15)', color: 'var(--ink-secondary, #525252)', fontFamily: fontFamily.body }}
              data-testid="upgrade-success-open-foundation"
            >
              View Subscription
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 py-16" style={{ background: 'var(--canvas-app, #FAFAFA)', fontFamily: fontFamily.body }} data-testid="upgrade-page">
      <div className="mx-auto max-w-5xl space-y-10">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full px-4 py-2" style={{ background: 'rgba(232,93,0,0.12)', border: '1px solid rgba(232,93,0,0.24)' }}>
            <Lock className="h-4 w-4" style={{ color: '#E85D00' }} />
            <span className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: '#E85D00', fontFamily: fontFamily.mono }}>Upgrade required</span>
          </div>
          <h1 className="mt-6 font-medium" style={{ color: 'var(--ink-display, #EDF1F7)', fontFamily: fontFamily.display, fontSize: 'clamp(1.8rem, 3vw, 2.4rem)', letterSpacing: '-0.02em', lineHeight: 1.05 }}>
            Unlock <em style={{ fontStyle: 'italic', color: '#E85D00' }}>everything</em>.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm sm:text-base" style={{ color: 'var(--ink-secondary, #8FA0B8)' }}>
            Choose Growth, Pro, Business, or Enterprise based on required depth. Custom Build is available for contracted integrations and entitlements.
          </p>
        </div>

        <div className="mx-auto grid max-w-5xl gap-4 md:grid-cols-4">
          {PRICING_TIERS.filter((tier) => ['starter', 'pro', 'business', 'enterprise'].includes(tier.id)).map((tier) => (
            <button
              key={tier.id}
              onClick={() => setSelectedTier(tier.id)}
              className="rounded-2xl border p-5 text-left"
              style={{
                background: 'rgba(20,28,38,0.95)',
                borderColor: selectedTier === tier.id ? tier.color : 'rgba(140,170,210,0.15)',
              }}
              data-testid={`upgrade-select-${tier.id}`}
            >
              <p className="text-[10px] uppercase tracking-[0.18em]" style={{ color: tier.color, fontFamily: fontFamily.mono }}>{tier.name}</p>
              <div className="mt-2 flex items-end gap-2">
                <span className="text-4xl" style={{ color: 'var(--ink-display, #EDF1F7)', fontFamily: fontFamily.display }}>{tier.price}</span>
                <span className="pb-1 text-sm" style={{ color: '#64748B' }}>{tier.period}</span>
              </div>
              <p className="mt-2 text-xs" style={{ color: 'var(--ink-secondary, #8FA0B8)' }}>{tier.subtitle}</p>
            </button>
          ))}
        </div>

        <div className="mx-auto max-w-5xl rounded-[28px] border p-8" style={{ background: 'rgba(20,28,38,0.95)', borderColor: 'rgba(232,93,0,0.24)' }}>
          <p className="text-[10px] uppercase tracking-[0.18em]" style={{ color: '#E85D00', fontFamily: fontFamily.mono }}>{selectedTier.toUpperCase()} included capabilities</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {(TIER_FEATURES[selectedTier] || TIER_FEATURES.starter).map((feature) => (
              <div key={feature} className="flex items-start gap-2 rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: 'rgba(140,170,210,0.15)', color: 'var(--ink-secondary, #525252)' }}>
                <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: '#E85D00' }} />
                <span>{feature}</span>
              </div>
            ))}
          </div>

          <button
            onClick={handleUpgrade}
            disabled={loading}
            className="mt-8 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-white"
            style={{ background: '#E85D00', fontFamily: fontFamily.body }}
            data-testid="upgrade-starter"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : `Upgrade to ${selectedTier[0].toUpperCase()}${selectedTier.slice(1)}`}
            {!loading && <ArrowRight className="h-4 w-4" />}
          </button>
          <button
            onClick={() => navigate('/contact?source=upgrade&feature=custom-build')}
            className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl border text-sm font-semibold"
            style={{ borderColor: '#10B98140', color: '#10B981', fontFamily: fontFamily.body }}
            data-testid="upgrade-custom-build"
          >
            Need Custom Build?
          </button>
        </div>

        <div className="text-center">
          <button onClick={() => navigate(-1)} className="text-sm" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>
            ← Back to platform
          </button>
        </div>
      </div>
    </div>
  );
}