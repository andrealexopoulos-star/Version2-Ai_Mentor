import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { resolveTier } from '../lib/tierResolver';
import { apiClient } from '../lib/api';
import { Lock, ArrowRight, Check, Loader2, CheckCircle2, XCircle, Sparkles, ChevronDown, Minus } from 'lucide-react';
import { PRICING_TIERS } from '../config/pricingTiers';
import { FOUNDATION_FEATURES, WAITLIST_FEATURES } from '../config/launchConfig';
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
// 2026-05-04: 'lite' added at $14 entry tier per code 13041978.
const PLANS = PRICING_TIERS.filter((t) => ['lite', 'starter', 'pro', 'business', 'enterprise'].includes(t.id));

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
  // Lite gets foundation unlocked too (paid tier).
  const foundationUnlocked = ['lite', 'starter', 'pro', 'business', 'enterprise', 'custom_build', 'super_admin'].includes(currentTier);
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
    // Increased from 5 to 12 attempts with exponential backoff (total ~50s)
    // Stripe webhooks can take 10-30s under load
    const MAX_ATTEMPTS = 12;
    if (attempt >= MAX_ATTEMPTS) {
      setPaymentResult({
        status: 'timeout',
        message: 'Payment verification is taking longer than expected. Your payment was likely processed successfully — please refresh the page in a moment. If the issue persists, contact support@biqc.ai.',
      });
      setCheckingPayment(false);
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
      // Exponential backoff: 2s, 3s, 4s, 5s, 5s, 5s...
      const delay = Math.min(2000 + attempt * 1000, 5000);
      setTimeout(() => pollPaymentStatus(sid, attempt + 1), delay);
    } catch {
      if (attempt < 3) {
        // Retry on network errors for first few attempts
        setTimeout(() => pollPaymentStatus(sid, attempt + 1), 3000);
      } else {
        setPaymentResult({ status: 'error', message: 'Error checking payment. Your payment may still be processing — please refresh in a moment.' });
        setCheckingPayment(false);
      }
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
    <div className="min-h-screen flex flex-col items-center px-6 py-12 max-w-4xl mx-auto" style={{ background: 'var(--canvas-app, var(--surface))' }} data-testid="subscribe-page">
      {/* Payment Result Banner */}
      {paymentResult && (
        <div className="w-full max-w-xl mb-6 p-4 rounded-xl flex items-center gap-3" style={{
          background: paymentResult.status === 'success' ? 'var(--positive-wash)' : 'var(--danger-wash)',
          border: `1px solid ${paymentResult.status === 'success' ? 'var(--positive)' : 'var(--danger)'}`,
          borderRadius: 'var(--r-lg)',
        }}>
          {paymentResult.status === 'success' ? <CheckCircle2 className="w-5 h-5" style={{ color: 'var(--positive)' }} /> : <XCircle className="w-5 h-5" style={{ color: 'var(--danger)' }} />}
          <p className="text-sm" style={{ color: paymentResult.status === 'success' ? 'var(--positive)' : 'var(--danger)', fontFamily: 'var(--font-ui)' }}>{paymentResult.message}</p>
        </div>
      )}

      {checkingPayment && (
        <div className="w-full max-w-xl mb-6 p-4 rounded-xl flex items-center gap-3" style={{ background: 'var(--lava-wash)', border: '1px solid var(--lava)', borderRadius: 'var(--r-lg)' }}>
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--lava)' }} />
          <p className="text-sm" style={{ color: 'var(--lava)', fontFamily: 'var(--font-ui)' }}>Verifying payment...</p>
        </div>
      )}

      <div className="text-center mb-10 max-w-xl">
        <div className="text-[11px] uppercase tracking-[0.08em] mb-2" style={{ fontFamily: 'var(--font-mono)', color: 'var(--lava)', letterSpacing: 'var(--ls-caps, 0.08em)', fontWeight: 600 }}>
          — Choose your plan
        </div>
        <h1 className="font-medium mb-3" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink-display)', fontSize: 'clamp(2rem, 4vw, 3rem)', letterSpacing: 'var(--ls-display, -0.02em)', lineHeight: 1.05 }}>
          One platform, <em style={{ fontStyle: 'italic', color: 'var(--lava)' }}>three ways in</em>.
        </h1>
        {featureLabel && <p className="text-xs mb-2" style={{ fontFamily: 'var(--font-mono)', color: 'var(--lava)' }}>{featureLabel} requires a paid plan</p>}
        <p className="text-sm" style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-ui)' }}>Current plan: <strong style={{ color: 'var(--ink-display)', textTransform: 'capitalize' }}>{currentTier}</strong></p>
        <p className="mt-2 text-xs" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)' }}>
          Transparent billing: shown amount is charged exactly as displayed. No hidden fees.
        </p>
      </div>

      <div className="w-full max-w-3xl mb-6 p-4" style={{ borderRadius: 'var(--r-lg)', border: '1px solid var(--border)', background: 'var(--surface)', boxShadow: 'var(--elev-1)' }}>
        <p className="text-[10px] uppercase tracking-[0.14em]" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)', letterSpacing: 'var(--ls-caps, 0.08em)' }}>Checkout flow</p>
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-4">
          {['Select plan', 'Review amount', 'Secure payment auth', 'Activation confirmation'].map((step, idx) => (
            <div key={step} className="px-3 py-2 text-xs" style={{ borderRadius: 'var(--r-md, 8px)', border: '1px solid var(--border)', color: 'var(--ink)', fontFamily: 'var(--font-ui)' }}>
              <span style={{ color: 'var(--lava)', fontFamily: 'var(--font-mono)' }}>{idx + 1}.</span> {step}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 max-w-4xl w-full mb-8 md:grid-cols-3" style={{ alignItems: 'start' }}>
        {PLANS.map(plan => {
          const isCurrent = plan.id === currentTier;
          const isPopular = plan.recommended;
          return (
            <div key={plan.id} className="relative flex flex-col" style={{
              background: 'var(--surface)',
              border: isCurrent ? '1px solid var(--lava)' : isPopular ? '1px solid var(--ink-display)' : '1px solid var(--border)',
              borderRadius: 'var(--r-2xl)',
              padding: 'var(--sp-8, 32px)',
              boxShadow: isCurrent ? '0 0 0 1px var(--lava), var(--elev-2)' : isPopular ? '0 0 0 1px var(--ink-display), var(--elev-3)' : 'var(--elev-1)',
              transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
            }} data-testid={`plan-${plan.id}`}>
              {isCurrent && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[11px] font-semibold px-4 py-1 rounded-full whitespace-nowrap" style={{ background: 'var(--lava-wash)', color: 'var(--lava-deep, var(--lava))', fontFamily: 'var(--font-mono)', letterSpacing: 'var(--ls-caps, 0.08em)', textTransform: 'uppercase' }}>Current plan</span>
              )}
              {isPopular && !isCurrent && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[11px] font-semibold px-4 py-1 rounded-full text-white whitespace-nowrap" style={{ background: 'var(--surface-sunken, #F5F5F5)', fontFamily: 'var(--font-mono)', letterSpacing: 'var(--ls-caps, 0.08em)', textTransform: 'uppercase' }}>Most popular</span>
              )}
              <h3 className="text-[28px] font-semibold mb-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink-display)', lineHeight: 1 }}>{plan.name}</h3>
              <p className="text-sm mb-6" style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-ui)', lineHeight: 1.5, minHeight: 44 }}>{plan.tagline || ''}</p>
              <div className="flex items-baseline gap-2 mb-1">
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '48px', lineHeight: 1, letterSpacing: '-0.03em', color: 'var(--ink-display)' }}>{plan.price}</span>
                <span className="text-sm" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)' }}>{plan.period}</span>
              </div>
              <div className="mb-6" style={{ minHeight: 18 }} />
              {isCurrent ? (
                <div className="w-full py-3.5 text-center text-sm font-semibold" style={{ borderRadius: 'var(--r-lg)', border: '1px solid var(--border-strong, var(--border))', color: 'var(--ink-secondary)', fontFamily: 'var(--font-ui)', marginBottom: 'var(--sp-6, 24px)', cursor: 'default' }}>Current Plan</div>
              ) : (
                <button onClick={() => handleUpgrade(plan.id)} disabled={loading === plan.id}
                  className="w-full py-3.5 text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50"
                  style={{
                    borderRadius: 'var(--r-lg)',
                    background: isPopular ? 'linear-gradient(135deg, var(--lava), var(--lava-warm, #FF7A1A))' : 'var(--ink-display, #0A0A0A)',
                    border: '1px solid transparent',
                    marginBottom: 'var(--sp-6, 24px)',
                    fontFamily: 'var(--font-ui)',
                    transition: 'all 0.15s ease',
                  }} data-testid={`upgrade-${plan.id}`}>
                  {loading === plan.id ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</> : <>Upgrade <ArrowRight className="w-4 h-4" /></>}
                </button>
              )}
              <div style={{ height: 1, background: 'var(--border)', marginBottom: 'var(--sp-5, 20px)' }} />
              <p className="text-[11px] font-semibold uppercase mb-4" style={{ letterSpacing: 'var(--ls-caps, 0.08em)', color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)' }}>What's included</p>
              <div className="flex flex-col gap-3 flex-1">
                {plan.features.map(f => (
                  <div key={f} className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: 'var(--positive)' }} />
                    <span className="text-sm" style={{ color: 'var(--ink)', fontFamily: 'var(--font-ui)', lineHeight: 1.4 }}>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="w-full max-w-4xl mb-8 p-5" style={{ borderRadius: 'var(--r-lg)', border: '1px solid var(--border)', background: 'var(--surface)', boxShadow: 'var(--elev-1)' }}>
        <p className="text-[10px] uppercase tracking-[0.14em]" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)', letterSpacing: 'var(--ls-caps, 0.08em)' }}>Custom Build</p>
        <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-sm" style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-ui)' }}>
            Need bespoke module packaging, custom entitlements, or contracted integration delivery?
          </p>
          <button
            onClick={() => window.location.assign('/contact?source=subscribe&feature=custom-build')}
            className="px-4 py-2 text-sm font-semibold text-white"
            style={{ background: 'var(--positive)', fontFamily: 'var(--font-ui)', borderRadius: 'var(--r-lg)' }}
            data-testid="contact-custom-build"
          >
            Contact for Custom Build
          </button>
        </div>
      </div>

      <div
        id="foundation"
        className="w-full max-w-4xl mb-8 p-5"
        style={{ borderRadius: 'var(--r-lg)', border: '1px solid var(--border)', background: 'var(--surface)', boxShadow: 'var(--elev-1)' }}
        data-testid="subscribe-foundation-modules"
      >
        <p className="text-[10px] uppercase tracking-[0.14em]" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)', letterSpacing: 'var(--ls-caps, 0.08em)' }}>
          Foundation Modules
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          {FOUNDATION_FEATURES.map((feature) => (
            <div key={feature.key} className="p-3" style={{ borderRadius: 'var(--r-md, 8px)', border: '1px solid var(--border)' }}>
              <p className="text-sm font-semibold" style={{ color: 'var(--ink-display)', fontFamily: 'var(--font-ui)' }}>{feature.title}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-ui)' }}>{feature.summary}</p>
              <div className="mt-2 flex items-center justify-between">
                <span
                  className="text-[10px] px-2 py-1 rounded-full"
                  style={{
                    background: foundationUnlocked ? 'var(--positive-wash)' : 'var(--lava-wash)',
                    color: foundationUnlocked ? 'var(--positive)' : 'var(--lava)',
                    fontFamily: 'var(--font-mono)',
                    letterSpacing: 'var(--ls-caps, 0.08em)',
                    textTransform: 'uppercase',
                  }}
                >
                  {foundationUnlocked ? 'Unlocked in your tier' : 'Unlock with paid tier'}
                </span>
                <button
                  type="button"
                  className="text-xs hover:opacity-80"
                  style={{ color: 'var(--lava)', fontFamily: 'var(--font-mono)' }}
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
        className="w-full max-w-4xl mb-8 p-5"
        style={{ borderRadius: 'var(--r-lg)', border: '1px solid var(--border)', background: 'var(--surface)', boxShadow: 'var(--elev-1)' }}
        data-testid="subscribe-advanced-roadmap"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4" style={{ color: 'var(--lava)' }} />
          <p className="text-[10px] uppercase tracking-[0.14em]" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)', letterSpacing: 'var(--ls-caps, 0.08em)' }}>
            More Features Roadmap
          </p>
        </div>
        <p className="text-xs mt-2" style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-ui)' }}>
          These are staged modules. Join waitlist for priority rollout and packaging feedback.
        </p>
        <div className="mt-3 space-y-3">
          {groupedWaitlist.map(([category, features]) => (
            <div key={category} className="p-3" style={{ borderRadius: 'var(--r-md, 8px)', border: '1px solid var(--border)' }}>
              <p className="text-xs uppercase" style={{ letterSpacing: 'var(--ls-caps, 0.08em)', color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)' }}>{category}</p>
              <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                {features.map((feature) => (
                  <div key={feature.key} className="px-3 py-2" style={{ borderRadius: 'var(--r-sm, 6px)', border: '1px solid var(--border)' }}>
                    <p className="text-sm" style={{ color: 'var(--ink-display)', fontFamily: 'var(--font-ui)' }}>{feature.title}</p>
                    <p className="text-[11px] mt-1 line-clamp-2" style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-ui)' }}>{feature.about}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {(section === 'foundation' || section === 'advanced') && (
        <div className="w-full max-w-4xl mb-6 p-3" style={{ borderRadius: 'var(--r-lg)', background: 'var(--lava-wash)', border: '1px solid var(--lava)' }}>
          <p className="text-xs" style={{ color: 'var(--warning)', fontFamily: 'var(--font-ui)' }}>
            You were redirected from a legacy subscription path. This page is now the single source of truth for Foundation and More Features.
          </p>
        </div>
      )}

      {/* Feature Comparison Table */}
      <FeatureComparisonTable />

      {/* FAQ Accordion */}
      <FAQAccordion />

      {/* Bottom CTA — gradient hero */}
      <div className="w-full max-w-4xl mt-14 text-center relative overflow-hidden" style={{ padding: 'var(--sp-12, 48px) var(--sp-6, 24px)', background: 'linear-gradient(160deg, #F8FAFC, #F0F4F8)', borderRadius: 'var(--r-2xl)' }}>
        {/* Lava radial glow */}
        <div style={{ position: 'absolute', top: '-40%', right: '-20%', width: 400, height: 400, background: 'radial-gradient(circle, var(--lava) 0%, transparent 60%)', opacity: 0.35, pointerEvents: 'none' }} />
        <h3 className="font-medium relative mb-4" style={{ fontFamily: 'var(--font-display)', color: '#FFFFFF', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', lineHeight: 1.05, letterSpacing: 'var(--ls-display, -0.02em)' }}>
          Still exploring?
        </h3>
        <p className="relative text-sm mb-6 mx-auto" style={{ color: 'var(--ink-secondary, #525252)', maxWidth: '48ch', fontFamily: 'var(--font-ui)' }}>
          Every feature is unlocked during your trial — use them, break them, ask BIQc anything. When you're ready, pick the plan that fits.
        </p>
        <Link to="/advisor" className="relative inline-flex items-center gap-2 text-sm font-semibold text-white transition-all hover:-translate-y-0.5" style={{ padding: '14px 28px', background: 'linear-gradient(135deg, var(--lava), var(--lava-warm, #FF7A1A))', borderRadius: 'var(--r-lg)', fontFamily: 'var(--font-ui)', boxShadow: '0 4px 20px rgba(232,93,0,0.4)' }}>
          Back to Advisor <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
};

/* ── Feature Comparison Table ─────────────────────────────────────────────── */
// 2026-05-04: Lite column added per code 13041978.
const COMPARISON_DATA = [
  { category: 'Core platform', features: [
    { name: 'Advisor (daily brief)', lite: false, growth: true, pro: true, business: true },
    { name: 'Email inbox + priority scoring', lite: false, growth: true, pro: true, business: true },
    { name: 'Calendar intelligence', lite: false, growth: true, pro: true, business: true },
    { name: 'Alert centre', lite: false, growth: true, pro: true, business: true },
    { name: 'Ask BIQc queries', lite: '150K tokens', growth: '1M tokens', pro: '5M tokens', business: '20M tokens' },
    { name: 'Market position', lite: false, growth: true, pro: true, business: true },
    { name: 'Business DNA', lite: false, growth: true, pro: true, business: true },
    { name: 'Supported integrations', lite: '1', growth: 'Unlimited', pro: 'Unlimited', business: 'Unlimited' },
  ]},
  { category: 'Growth intelligence', features: [
    { name: 'Market & Business Forensic Snapshot', lite: false, growth: true, pro: true, business: true },
    { name: 'Intelligence Spine', lite: false, growth: true, pro: true, business: true },
    { name: 'Revenue analytics', lite: false, growth: true, pro: true, business: true },
    { name: 'Operations metrics', lite: false, growth: true, pro: true, business: true },
    { name: 'Reports', lite: false, growth: true, pro: true, business: true },
    { name: 'Decision tracker', lite: false, growth: true, pro: true, business: true },
    { name: 'SOP generator', lite: false, growth: true, pro: true, business: true },
    { name: 'Marketing automation', lite: false, growth: true, pro: true, business: true },
    { name: 'Marketing intelligence', lite: false, growth: true, pro: true, business: true },
    { name: 'Exposure scan', lite: false, growth: true, pro: true, business: true },
  ]},
  { category: 'Pro intelligence', features: [
    { name: 'Risk matrix', lite: false, growth: false, pro: true, business: true },
    { name: 'Compliance tracking', lite: false, growth: false, pro: true, business: true },
    { name: 'Cross-domain signals', lite: false, growth: false, pro: true, business: true },
    { name: 'Watchtower', lite: false, growth: false, pro: true, business: true },
    { name: 'Document library', lite: false, growth: false, pro: true, business: true },
    { name: 'Intel centre', lite: false, growth: false, pro: true, business: true },
    { name: 'Audit log', lite: false, growth: false, pro: true, business: true },
  ]},
  { category: 'Support', features: [
    { name: 'Community', lite: true, growth: true, pro: true, business: true },
    { name: 'Self-serve docs', lite: true, growth: true, pro: true, business: true },
    { name: 'Email support', lite: false, growth: true, pro: true, business: true },
    { name: 'Priority support', lite: false, growth: false, pro: true, business: true },
  ]},
];

const CellIcon = ({ value }) => {
  if (value === true) return <Check className="w-4 h-4 mx-auto" style={{ color: 'var(--positive)' }} />;
  if (value === false) return <Minus className="w-3.5 h-3.5 mx-auto" style={{ color: 'var(--ink-subtle)' }} />;
  return <span className="text-xs font-medium" style={{ color: 'var(--ink)', fontFamily: 'var(--font-mono)' }}>{value}</span>;
};

const FeatureComparisonTable = () => (
  <div className="w-full max-w-4xl mt-12">
    <h2 className="text-center mb-8" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.5rem, 3vw, 2.25rem)', lineHeight: 1.1, letterSpacing: 'var(--ls-heading, -0.01em)', color: 'var(--ink-display)' }}>
      Compare every feature.
    </h2>
    <div className="overflow-hidden" style={{ borderRadius: 'var(--r-xl)', border: '1px solid var(--border)', background: 'var(--surface)' }}>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: 'var(--surface-sunken)' }}>
            <th className="text-left px-5 py-4 text-[11px] font-semibold uppercase" style={{ color: 'var(--ink-muted)', letterSpacing: 'var(--ls-caps, 0.08em)', fontFamily: 'var(--font-mono)' }}>Feature</th>
            <th className="text-center px-4 py-4 text-sm font-semibold" style={{ color: 'var(--ink-display)', fontFamily: 'var(--font-ui)' }}>Lite $14</th>
            <th className="text-center px-4 py-4 text-sm font-semibold" style={{ color: 'var(--ink-display)', fontFamily: 'var(--font-ui)' }}>Growth $69</th>
            <th className="text-center px-4 py-4 text-sm font-semibold" style={{ color: 'white', background: 'var(--surface-sunken, #F5F5F5)', fontFamily: 'var(--font-ui)' }}>Pro $199</th>
            <th className="text-center px-4 py-4 text-sm font-semibold" style={{ color: 'var(--ink-display)', fontFamily: 'var(--font-ui)' }}>Business $349</th>
          </tr>
        </thead>
        <tbody>
          {COMPARISON_DATA.map(section => (
            <React.Fragment key={section.category}>
              <tr style={{ background: 'var(--surface-sunken)' }}>
                <td colSpan={5} className="px-4 py-3 text-[11px] font-semibold uppercase"
                  style={{ color: 'var(--ink-muted)', borderBottom: '1px solid var(--border)', letterSpacing: 'var(--ls-caps, 0.08em)', fontFamily: 'var(--font-mono)' }}>
                  {section.category}
                </td>
              </tr>
              {section.features.map(f => (
                <tr key={f.name} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--ink-secondary)', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-ui)' }}>{f.name}</td>
                  <td className="px-4 py-3 text-center" style={{ borderBottom: '1px solid var(--border)' }}><CellIcon value={f.lite} /></td>
                  <td className="px-4 py-3 text-center" style={{ borderBottom: '1px solid var(--border)' }}><CellIcon value={f.growth} /></td>
                  <td className="px-4 py-3 text-center" style={{ borderBottom: '1px solid var(--border)' }}><CellIcon value={f.pro} /></td>
                  <td className="px-4 py-3 text-center" style={{ borderBottom: '1px solid var(--border)' }}><CellIcon value={f.business} /></td>
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

/* ── FAQ Accordion ────────────────────────────────────────────────────────── */
const FAQ_ITEMS = [
  { q: 'What happens when my 14-day trial ends?', a: 'You\'ll be charged for the plan you selected at signup (Growth $69 by default) and your full platform access continues uninterrupted. No charges happen before day 14. You can downgrade, upgrade, or cancel at any time from Settings → Billing. If you cancel during the trial you are never charged.' },
  { q: 'Can I switch plans later?', a: 'Absolutely. Upgrade or downgrade at any time from Settings → Billing. When you upgrade, you get instant access to all features in your new tier. When you downgrade, you keep access until the end of your current billing period.' },
  { q: 'What happens when I hit my AI allowance?', a: 'AI usage is capped by your plan allowance. You can continue by upgrading or by requesting an approved top-up; BIQc does not silently continue paid overage usage.' },
  { q: 'How do integrations work across tiers?', a: 'All paid plans can connect supported integrations. Capacity is controlled by token allowance, sync history, and storage/refresh behaviour rather than plan-specific connector lockouts.' },
  { q: 'Is my data secure?', a: 'Yes. All data is encrypted in transit (TLS 1.3) and at rest (AES-256). We never use your data for AI model training. You retain full ownership and can export or delete everything at any time. We\'re SOC 2 compliant and GDPR/APPs aligned.' },
  { q: 'Do you offer discounts for annual billing?', a: 'Yes — save 20% with annual billing. Growth drops from $69/month to $55/month ($660/year). Pro drops from $199/month to $159/month ($1,908/year). All annual plans include priority onboarding.' },
  { q: 'What payment methods do you accept?', a: 'We accept all major credit and debit cards (Visa, Mastercard, Amex) via Stripe. For Enterprise plans, we also offer invoice billing with NET 30 terms. All prices are in AUD.' },
];

const FAQAccordion = () => {
  const [openIdx, setOpenIdx] = useState(null);
  return (
    <div className="w-full max-w-3xl mt-12 mb-8">
      <h2 className="text-center mb-8" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.5rem, 3vw, 2.25rem)', lineHeight: 1.1, letterSpacing: 'var(--ls-heading, -0.01em)', color: 'var(--ink-display)' }}>
        Frequently asked questions
      </h2>
      <div style={{ borderTop: '1px solid var(--border)' }}>
        {FAQ_ITEMS.map((item, i) => (
          <div key={i} style={{ borderBottom: '1px solid var(--border)' }}>
            <button
              onClick={() => setOpenIdx(openIdx === i ? null : i)}
              className="w-full flex items-center justify-between px-0 py-5 text-left font-semibold transition-colors"
              style={{ color: 'var(--ink-display)', fontFamily: 'var(--font-ui)', fontSize: 'var(--size-body, 15px)' }}
            >
              <span>{item.q}</span>
              <ChevronDown className="w-4 h-4 shrink-0 ml-3 transition-transform duration-200"
                style={{ color: 'var(--ink-muted)', transform: openIdx === i ? 'rotate(180deg)' : 'rotate(0deg)' }} />
            </button>
            {openIdx === i && (
              <div className="pb-5">
                <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-ui)' }}>{item.a}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SubscribePage;
