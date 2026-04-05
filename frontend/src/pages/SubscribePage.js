import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { resolveTier } from '../lib/tierResolver';
import { apiClient } from '../lib/api';
import { Lock, ArrowRight, Check, Loader2, CheckCircle2, XCircle, Sparkles } from 'lucide-react';
import { PRICING_TIERS } from '../config/pricingTiers';
import { FOUNDATION_FEATURES, WAITLIST_FEATURES } from '../config/launchConfig';
import { fontFamily } from '../design-system/tokens';
import { toast } from 'sonner';


const FEATURE_LABELS = {
  '/exposure-scan': 'Exposure Scan',
  '/marketing-automation': 'Marketing Auto',
  '/reports': 'Reports',
  '/sop-generator': 'SOP Generator',
  '/decisions': 'Decision Tracker',
  '/forensic-audit': 'Ingestion Audit',
};

// Checkout-visible plans: paid tiers that can be self-served.
const PLANS = PRICING_TIERS.filter((t) => ['starter', 'pro', 'enterprise'].includes(t.id));

const SubscribePage = () => {
  const { user, refreshSession } = useSupabaseAuth();
  const navigate = useNavigate();
  const refreshSessionRef = useRef(refreshSession);
  const [searchParams] = useSearchParams();
  const from = searchParams.get('from') || '';
  const sessionId = searchParams.get('session_id');
  const status = searchParams.get('status');
  const section = searchParams.get('section') || '';
  const featureLabel = FEATURE_LABELS[from] || (from ? from.replace(/\//g, '').replace(/-/g, ' ') : '');
  const currentTier = resolveTier(user);
  const foundationUnlocked = ['starter', 'pro', 'enterprise', 'custom_build', 'super_admin'].includes(currentTier);
  const groupedWaitlist = useMemo(() => {
    const map = new Map();
    WAITLIST_FEATURES.forEach((feature) => {
      if (!map.has(feature.category)) map.set(feature.category, []);
      map.get(feature.category).push(feature);
    });
    return [...map.entries()];
  }, []);

  const [checkingPayment, setCheckingPayment] = useState(false);
  const [paymentResult, setPaymentResult] = useState(null);
  const [loading, setLoading] = useState(null);

  useEffect(() => {
    refreshSessionRef.current = refreshSession;
  }, [refreshSession]);

  // Poll payment status if returning from Stripe
  const pollPaymentStatus = useCallback(async (sid, attempt) => {
    if (attempt >= 5) {
      setPaymentResult({ status: 'timeout', message: 'Payment verification timed out. Please refresh.' });
      return;
    }
    setCheckingPayment(true);
    try {
      const res = await apiClient.get(`/payments/status/${sid}`);
      if (res.data?.payment_status === 'paid') {
        setPaymentResult({ status: 'success', message: 'Payment successful! Your account has been upgraded.', tier: res.data.metadata?.tier });
        setCheckingPayment(false);
        try {
          await refreshSessionRef.current?.();
        } catch {
          // non-blocking; success is already persisted server-side
        }
        try {
          window.dispatchEvent(new CustomEvent('biqc:subscription-updated', {
            detail: { tier: res.data.metadata?.tier || 'starter' },
          }));
        } catch {
          // ignore browser event failures
        }
        if (from && from.startsWith('/')) {
          setTimeout(() => navigate(from), 800);
        }
        return;
      }
      if (res.data?.status === 'expired') {
        setPaymentResult({ status: 'expired', message: 'Payment session expired.' });
        setCheckingPayment(false);
        return;
      }
      setTimeout(() => pollPaymentStatus(sid, attempt + 1), 2000);
    } catch {
      setPaymentResult({ status: 'error', message: 'Error checking payment. Please refresh.' });
      setCheckingPayment(false);
    }
  }, [from, navigate]);

  useEffect(() => {
    if (sessionId && status === 'success') {
      pollPaymentStatus(sessionId, 0);
    }
  }, [sessionId, status, pollPaymentStatus]);

  const handleUpgrade = async (packageId) => {
    setLoading(packageId);
    try {
      const origin = window.location.origin;
      const res = await apiClient.post('/payments/checkout', { package_id: packageId, origin_url: origin });
      if (res.data?.url) {
        window.location.href = res.data.url;
        return;
      }
      toast.error('Checkout is unavailable right now. Please try again.');
    } catch (err) {
      console.error('Checkout error:', err);
      toast.error('Checkout failed. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12" style={{ background: 'var(--biqc-bg)' }} data-testid="subscribe-page">
      {/* Payment Result Banner */}
      {paymentResult && (
        <div className="w-full max-w-xl mb-6 p-4 rounded-xl flex items-center gap-3" style={{
          background: paymentResult.status === 'success' ? '#10B98110' : '#EF444410',
          border: `1px solid ${paymentResult.status === 'success' ? '#10B98130' : '#EF444430'}`,
        }}>
          {paymentResult.status === 'success' ? <CheckCircle2 className="w-5 h-5 text-[#10B981]" /> : <XCircle className="w-5 h-5 text-[#EF4444]" />}
          <p className="text-sm" style={{ color: paymentResult.status === 'success' ? '#10B981' : '#EF4444' }}>{paymentResult.message}</p>
        </div>
      )}

      {checkingPayment && (
        <div className="w-full max-w-xl mb-6 p-4 rounded-xl flex items-center gap-3" style={{ background: '#FF6A0010', border: '1px solid #FF6A0030' }}>
          <Loader2 className="w-5 h-5 text-[#FF6A00] animate-spin" />
          <p className="text-sm text-[#FF6A00]">Verifying payment...</p>
        </div>
      )}

      <div className="text-center mb-10 max-w-xl">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ background: '#FF6A0015' }}>
          <Lock className="w-6 h-6 text-[#FF6A00]" />
        </div>
        {featureLabel && <p className="text-xs text-[#FF6A00] mb-2" style={{ fontFamily: fontFamily.mono }}>{featureLabel} requires a paid plan</p>}
        <h1 className="text-3xl font-bold text-[#F4F7FA] mb-3" style={{ fontFamily: fontFamily.display }}>Choose your paid BIQc tier</h1>
        <p className="text-sm text-[#9FB0C3]" style={{ fontFamily: fontFamily.body }}>Current plan: <strong className="text-[#F4F7FA] capitalize">{currentTier}</strong></p>
        <p className="mt-2 text-xs text-[#94A3B8]" style={{ fontFamily: fontFamily.mono }}>
          Transparent billing: shown amount is charged exactly as displayed. No hidden onboarding or compliance fees.
        </p>
      </div>

      <div className="w-full max-w-3xl mb-6 rounded-xl border p-4" style={{ borderColor: 'var(--biqc-border)', background: 'var(--biqc-bg-card)' }}>
        <p className="text-[10px] uppercase tracking-[0.14em]" style={{ color: '#94A3B8', fontFamily: fontFamily.mono }}>Checkout flow</p>
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-4">
          {['Select plan', 'Review amount', 'Secure payment auth', 'Activation confirmation'].map((step, idx) => (
            <div key={step} className="rounded-lg border px-3 py-2 text-xs" style={{ borderColor: 'var(--biqc-border)', color: '#CBD5E1' }}>
              <span style={{ color: '#FF6A00', fontFamily: fontFamily.mono }}>{idx + 1}.</span> {step}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 max-w-4xl w-full mb-8 md:grid-cols-3">
        {PLANS.map(plan => {
          const isCurrent = plan.id === currentTier;
          return (
            <div key={plan.id} className="rounded-xl p-6 relative" style={{
              background: 'var(--biqc-bg-card)',
              border: `2px solid ${plan.recommended ? plan.color : '#243140'}`,
              boxShadow: plan.recommended ? `0 8px 32px ${plan.color}20` : 'none',
            }} data-testid={`plan-${plan.id}`}>
              {plan.recommended && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-semibold px-3 py-1 rounded-full text-white" style={{ background: plan.color, fontFamily: fontFamily.mono }}>RECOMMENDED</span>
              )}
              <h3 className="text-lg font-semibold text-[#F4F7FA] mb-1" style={{ fontFamily: fontFamily.display }}>{plan.name}</h3>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-3xl font-bold" style={{ color: plan.color, fontFamily: fontFamily.mono }}>{plan.price}</span>
                <span className="text-xs text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>{plan.period}</span>
              </div>
              <div className="space-y-2 mb-6">
                {plan.features.map(f => (
                  <div key={f} className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 shrink-0" style={{ color: plan.color }} />
                    <span className="text-xs text-[#9FB0C3]">{f}</span>
                  </div>
                ))}
              </div>
              {isCurrent ? (
                <span className="block text-center text-xs text-[#64748B] py-2.5" style={{ fontFamily: fontFamily.mono }}>Current Plan</span>
              ) : (
                <button onClick={() => handleUpgrade(plan.id)} disabled={loading === plan.id}
                  className="w-full py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50"
                  style={{ background: plan.color }} data-testid={`upgrade-${plan.id}`}>
                  {loading === plan.id ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</> : <>Upgrade <ArrowRight className="w-4 h-4" /></>}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="w-full max-w-4xl mb-8 rounded-xl border p-4" style={{ borderColor: 'var(--biqc-border)', background: 'var(--biqc-bg-card)' }}>
        <p className="text-[10px] uppercase tracking-[0.14em]" style={{ color: '#94A3B8', fontFamily: fontFamily.mono }}>Custom Build</p>
        <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-[#9FB0C3]">
            Need bespoke module packaging, custom entitlements, or contracted integration delivery?
          </p>
          <button
            onClick={() => window.location.assign('/contact?source=subscribe&feature=custom-build')}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
            style={{ background: '#10B981', fontFamily: fontFamily.body }}
            data-testid="contact-custom-build"
          >
            Contact for Custom Build
          </button>
        </div>
      </div>

      <div
        id="foundation"
        className="w-full max-w-4xl mb-8 rounded-xl border p-5"
        style={{ borderColor: 'var(--biqc-border)', background: 'var(--biqc-bg-card)' }}
        data-testid="subscribe-foundation-modules"
      >
        <p className="text-[10px] uppercase tracking-[0.14em]" style={{ color: '#94A3B8', fontFamily: fontFamily.mono }}>
          Foundation Modules
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          {FOUNDATION_FEATURES.map((feature) => (
            <div key={feature.key} className="rounded-lg border p-3" style={{ borderColor: '#243140' }}>
              <p className="text-sm font-semibold text-[#F4F7FA]">{feature.title}</p>
              <p className="text-xs mt-1 text-[#9FB0C3]">{feature.summary}</p>
              <div className="mt-2 flex items-center justify-between">
                <span
                  className="text-[10px] px-2 py-1 rounded-full"
                  style={{
                    background: foundationUnlocked ? '#10B98120' : '#FF6A0018',
                    color: foundationUnlocked ? '#10B981' : '#FF6A00',
                    fontFamily: fontFamily.mono,
                  }}
                >
                  {foundationUnlocked ? 'Unlocked in your tier' : 'Unlock with paid tier'}
                </span>
                <button
                  type="button"
                  className="text-xs text-[#FF6A00] hover:text-[#FDBA74]"
                  onClick={() => window.location.assign(feature.route)}
                  data-testid={`subscribe-open-foundation-${feature.key}`}
                >
                  Open
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        id="advanced"
        className="w-full max-w-4xl mb-8 rounded-xl border p-5"
        style={{ borderColor: 'var(--biqc-border)', background: 'var(--biqc-bg-card)' }}
        data-testid="subscribe-advanced-roadmap"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#FF6A00]" />
          <p className="text-[10px] uppercase tracking-[0.14em]" style={{ color: '#94A3B8', fontFamily: fontFamily.mono }}>
            More Features Roadmap
          </p>
        </div>
        <p className="text-xs mt-2 text-[#9FB0C3]">
          These are staged modules. Join waitlist for priority rollout and packaging feedback.
        </p>
        <div className="mt-3 space-y-3">
          {groupedWaitlist.map(([category, features]) => (
            <div key={category} className="rounded-lg border p-3" style={{ borderColor: '#243140' }}>
              <p className="text-xs uppercase tracking-[0.12em] text-[#94A3B8]">{category}</p>
              <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                {features.map((feature) => (
                  <div key={feature.key} className="rounded-md border px-3 py-2" style={{ borderColor: '#1F2937' }}>
                    <p className="text-sm text-[#F4F7FA]">{feature.title}</p>
                    <p className="text-[11px] mt-1 text-[#9FB0C3] line-clamp-2">{feature.about}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {(section === 'foundation' || section === 'advanced') && (
        <div className="w-full max-w-4xl mb-6 p-3 rounded-xl" style={{ background: '#FF6A0010', border: '1px solid #FF6A0030' }}>
          <p className="text-xs text-[#FDBA74]">
            You were redirected from a legacy subscription path. This page is now the single source of truth for Foundation and More Features.
          </p>
        </div>
      )}

      <Link to="/advisor" className="text-xs text-[#64748B] hover:text-[#9FB0C3]" style={{ fontFamily: fontFamily.mono }}>Back to Intelligence Platform</Link>
    </div>
  );
};

export default SubscribePage;
