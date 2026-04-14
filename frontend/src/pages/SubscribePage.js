import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { resolveTier } from '../lib/tierResolver';
import { apiClient } from '../lib/api';
import { Lock, ArrowRight, Check, Loader2, CheckCircle2, XCircle, Sparkles, ChevronDown, Minus } from 'lucide-react';
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
    <div className="min-h-screen flex flex-col items-center px-6 py-12 max-w-4xl mx-auto" style={{ background: 'var(--biqc-bg)' }} data-testid="subscribe-page">
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
        <div className="w-full max-w-xl mb-6 p-4 rounded-xl flex items-center gap-3" style={{ background: '#E85D0010', border: '1px solid #E85D0030' }}>
          <Loader2 className="w-5 h-5 text-[#E85D00] animate-spin" />
          <p className="text-sm text-[#E85D00]">Verifying payment...</p>
        </div>
      )}

      <div className="text-center mb-10 max-w-xl">
        <div className="text-[11px] uppercase tracking-[0.08em] mb-2" style={{ fontFamily: fontFamily.mono, color: '#E85D00' }}>
          — Choose your plan
        </div>
        <h1 className="font-medium mb-3" style={{ fontFamily: fontFamily.display, color: 'var(--ink-display, #EDF1F7)', fontSize: 'clamp(1.8rem, 3vw, 2.4rem)', letterSpacing: '-0.02em', lineHeight: 1.05 }}>
          One platform, <em style={{ fontStyle: 'italic', color: '#E85D00' }}>three ways in</em>.
        </h1>
        {featureLabel && <p className="text-xs text-[#E85D00] mb-2" style={{ fontFamily: fontFamily.mono }}>{featureLabel} requires a paid plan</p>}
        <p className="text-sm text-[var(--ink-secondary)]" style={{ fontFamily: fontFamily.body }}>Current plan: <strong className="text-[var(--ink-display)] capitalize">{currentTier}</strong></p>
        <p className="mt-2 text-xs" style={{ color: 'var(--ink-muted, #708499)', fontFamily: fontFamily.mono }}>
          Transparent billing: shown amount is charged exactly as displayed. No hidden fees.
        </p>
      </div>

      <div className="w-full max-w-3xl mb-6 rounded-xl border p-4" style={{ borderColor: 'var(--biqc-border)', background: 'var(--biqc-bg-card)' }}>
        <p className="text-[10px] uppercase tracking-[0.14em]" style={{ color: 'var(--ink-secondary)', fontFamily: fontFamily.mono }}>Checkout flow</p>
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-4">
          {['Select plan', 'Review amount', 'Secure payment auth', 'Activation confirmation'].map((step, idx) => (
            <div key={step} className="rounded-lg border px-3 py-2 text-xs" style={{ borderColor: 'var(--biqc-border)', color: '#CBD5E1' }}>
              <span style={{ color: '#E85D00', fontFamily: fontFamily.mono }}>{idx + 1}.</span> {step}
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
              border: `2px solid ${plan.recommended ? plan.color : 'rgba(140,170,210,0.12)'}`,
              boxShadow: plan.recommended ? `0 8px 32px ${plan.color}20` : 'none',
            }} data-testid={`plan-${plan.id}`}>
              {plan.recommended && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-semibold px-3 py-1 rounded-full text-white" style={{ background: plan.color, fontFamily: fontFamily.mono }}>RECOMMENDED</span>
              )}
              <h3 className="text-lg font-semibold text-[var(--ink-display)] mb-1" style={{ fontFamily: fontFamily.display }}>{plan.name}</h3>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-3xl font-bold" style={{ color: plan.color, fontFamily: fontFamily.mono }}>{plan.price}</span>
                <span className="text-xs text-[var(--ink-muted)]" style={{ fontFamily: fontFamily.mono }}>{plan.period}</span>
              </div>
              <div className="space-y-2 mb-6">
                {plan.features.map(f => (
                  <div key={f} className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 shrink-0" style={{ color: plan.color }} />
                    <span className="text-xs text-[var(--ink-secondary)]">{f}</span>
                  </div>
                ))}
              </div>
              {isCurrent ? (
                <span className="block text-center text-xs text-[var(--ink-muted)] py-2.5" style={{ fontFamily: fontFamily.mono }}>Current Plan</span>
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
        <p className="text-[10px] uppercase tracking-[0.14em]" style={{ color: 'var(--ink-secondary)', fontFamily: fontFamily.mono }}>Custom Build</p>
        <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-[var(--ink-secondary)]">
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
        <p className="text-[10px] uppercase tracking-[0.14em]" style={{ color: 'var(--ink-secondary)', fontFamily: fontFamily.mono }}>
          Foundation Modules
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          {FOUNDATION_FEATURES.map((feature) => (
            <div key={feature.key} className="rounded-lg border p-3" style={{ borderColor: 'rgba(140,170,210,0.12)' }}>
              <p className="text-sm font-semibold text-[var(--ink-display)]">{feature.title}</p>
              <p className="text-xs mt-1 text-[var(--ink-secondary)]">{feature.summary}</p>
              <div className="mt-2 flex items-center justify-between">
                <span
                  className="text-[10px] px-2 py-1 rounded-full"
                  style={{
                    background: foundationUnlocked ? '#10B98120' : '#E85D0018',
                    color: foundationUnlocked ? '#10B981' : '#E85D00',
                    fontFamily: fontFamily.mono,
                  }}
                >
                  {foundationUnlocked ? 'Unlocked in your tier' : 'Unlock with paid tier'}
                </span>
                <button
                  type="button"
                  className="text-xs text-[#E85D00] hover:text-[#FDBA74]"
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
          <Sparkles className="w-4 h-4 text-[#E85D00]" />
          <p className="text-[10px] uppercase tracking-[0.14em]" style={{ color: 'var(--ink-secondary)', fontFamily: fontFamily.mono }}>
            More Features Roadmap
          </p>
        </div>
        <p className="text-xs mt-2 text-[var(--ink-secondary)]">
          These are staged modules. Join waitlist for priority rollout and packaging feedback.
        </p>
        <div className="mt-3 space-y-3">
          {groupedWaitlist.map(([category, features]) => (
            <div key={category} className="rounded-lg border p-3" style={{ borderColor: 'rgba(140,170,210,0.12)' }}>
              <p className="text-xs uppercase tracking-[0.12em] text-[var(--ink-secondary)]">{category}</p>
              <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                {features.map((feature) => (
                  <div key={feature.key} className="rounded-md border px-3 py-2" style={{ borderColor: '#1F2937' }}>
                    <p className="text-sm text-[var(--ink-display)]">{feature.title}</p>
                    <p className="text-[11px] mt-1 text-[var(--ink-secondary)] line-clamp-2">{feature.about}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {(section === 'foundation' || section === 'advanced') && (
        <div className="w-full max-w-4xl mb-6 p-3 rounded-xl" style={{ background: '#E85D0010', border: '1px solid #E85D0030' }}>
          <p className="text-xs text-[#FDBA74]">
            You were redirected from a legacy subscription path. This page is now the single source of truth for Foundation and More Features.
          </p>
        </div>
      )}

      {/* Feature Comparison Table */}
      <FeatureComparisonTable />

      {/* FAQ Accordion */}
      <FAQAccordion />

      {/* Bottom CTA — gradient hero */}
      <div className="w-full max-w-4xl mt-14 rounded-2xl text-center relative overflow-hidden" style={{ padding: '3rem 1.5rem', background: 'linear-gradient(160deg, #111827, #1A1A2E)' }}>
        {/* Lava radial glow */}
        <div style={{ position: 'absolute', top: '-40%', right: '-20%', width: 400, height: 400, background: 'radial-gradient(circle, #E85D00 0%, transparent 60%)', opacity: 0.35, pointerEvents: 'none' }} />
        <h3 className="font-medium relative mb-4" style={{ fontFamily: fontFamily.display, color: '#FFFFFF', fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', lineHeight: 1.05, letterSpacing: '-0.02em' }}>
          Still exploring?
        </h3>
        <p className="relative text-sm mb-6 mx-auto" style={{ color: 'rgba(255,255,255,0.7)', maxWidth: '48ch' }}>
          Every feature is unlocked during your trial — use them, break them, ask BIQc anything. When you're ready, pick the plan that fits.
        </p>
        <Link to="/advisor" className="relative inline-flex items-center gap-2 text-sm font-semibold text-white rounded-lg transition-all hover:-translate-y-0.5" style={{ padding: '14px 28px', background: 'linear-gradient(135deg, #E85D00, #FF7A1A)', boxShadow: '0 4px 20px rgba(232,93,0,0.25)' }}>
          Back to Advisor <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
};

/* ── Feature Comparison Table ─────────────────────────────────────────────── */
const COMPARISON_DATA = [
  { category: 'Core platform', features: [
    { name: 'Advisor (daily brief)', free: true, growth: true, pro: true },
    { name: 'Email inbox + priority scoring', free: true, growth: true, pro: true },
    { name: 'Calendar intelligence', free: true, growth: true, pro: true },
    { name: 'Alert centre', free: true, growth: true, pro: true },
    { name: 'Ask BIQc queries', free: '10 / day', growth: 'Unlimited', pro: 'Unlimited' },
    { name: 'Market position', free: true, growth: true, pro: true },
    { name: 'Business DNA', free: true, growth: true, pro: true },
    { name: 'Integrations', free: '4', growth: '10', pro: 'Unlimited' },
  ]},
  { category: 'Growth intelligence', features: [
    { name: 'BoardRoom AI', free: false, growth: true, pro: true },
    { name: 'Revenue analytics', free: false, growth: true, pro: true },
    { name: 'Operations metrics', free: false, growth: true, pro: true },
    { name: 'Reports', free: false, growth: true, pro: true },
    { name: 'Decision tracker', free: false, growth: true, pro: true },
    { name: 'SOP generator', free: false, growth: true, pro: true },
    { name: 'Marketing automation', free: false, growth: true, pro: true },
    { name: 'Marketing intelligence', free: false, growth: true, pro: true },
    { name: 'Exposure scan', free: false, growth: true, pro: true },
  ]},
  { category: 'Pro intelligence', features: [
    { name: 'WarRoom crisis AI', free: false, growth: false, pro: true },
    { name: 'Risk matrix', free: false, growth: false, pro: true },
    { name: 'Compliance tracking', free: false, growth: false, pro: true },
    { name: 'Cross-domain signals', free: false, growth: false, pro: true },
    { name: 'Watchtower', free: false, growth: false, pro: true },
    { name: 'Document library', free: false, growth: false, pro: true },
    { name: 'Intel centre', free: false, growth: false, pro: true },
    { name: 'Audit log', free: false, growth: false, pro: true },
  ]},
  { category: 'Support', features: [
    { name: 'Community', free: true, growth: true, pro: true },
    { name: 'Email support', free: false, growth: true, pro: true },
    { name: 'Priority support', free: false, growth: false, pro: true },
  ]},
];

const CellIcon = ({ value }) => {
  if (value === true) return <Check className="w-4 h-4 mx-auto" style={{ color: 'var(--positive, #16A34A)' }} />;
  if (value === false) return <Minus className="w-3.5 h-3.5 mx-auto" style={{ color: 'var(--ink-muted, #708499)' }} />;
  return <span className="text-xs font-medium" style={{ color: 'var(--ink, #C8D4E4)' }}>{value}</span>;
};

const FeatureComparisonTable = () => (
  <div className="w-full max-w-4xl mt-12">
    <h2 className="text-xl font-semibold text-center mb-6" style={{ color: 'var(--ink-display, #EDF1F7)' }}>
      Compare every feature.
    </h2>
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border, rgba(140,170,210,0.12))', background: 'var(--surface, #0E1628)' }}>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: 'var(--surface-sunken, #060A12)' }}>
            <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-muted)' }}>Feature</th>
            <th className="text-center px-4 py-3 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-muted)' }}>Free</th>
            <th className="text-center px-4 py-3 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--lava, #E85D00)' }}>Growth $69</th>
            <th className="text-center px-4 py-3 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-muted)' }}>Pro $199</th>
          </tr>
        </thead>
        <tbody>
          {COMPARISON_DATA.map(section => (
            <React.Fragment key={section.category}>
              <tr style={{ background: 'var(--surface-sunken, #060A12)' }}>
                <td colSpan={4} className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--ink-muted, #708499)', borderBottom: '1px solid var(--border)' }}>
                  {section.category}
                </td>
              </tr>
              {section.features.map(f => (
                <tr key={f.name} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-2.5" style={{ color: 'var(--ink)', borderBottom: '1px solid var(--border)' }}>{f.name}</td>
                  <td className="px-4 py-2.5 text-center" style={{ borderBottom: '1px solid var(--border)' }}><CellIcon value={f.free} /></td>
                  <td className="px-4 py-2.5 text-center" style={{ borderBottom: '1px solid var(--border)' }}><CellIcon value={f.growth} /></td>
                  <td className="px-4 py-2.5 text-center" style={{ borderBottom: '1px solid var(--border)' }}><CellIcon value={f.pro} /></td>
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
  { q: 'What happens when my 14-day Pro trial ends?', a: 'You\'ll be moved to the Free plan automatically. No charges, no surprises. You keep access to Advisor, Alerts, Email, Calendar, Ask BIQc, Market, Business DNA, and up to 4 integrations. Paid features (BoardRoom, WarRoom, advanced analytics) lock until you upgrade.' },
  { q: 'Can I switch plans later?', a: 'Absolutely. Upgrade or downgrade at any time from Settings → Billing. When you upgrade, you get instant access to all features in your new tier. When you downgrade, you keep access until the end of your current billing period.' },
  { q: 'How do integrations work across tiers?', a: 'Free: up to 4 integrations (email, calendar, CRM, accounting). Growth: up to 10 integrations with deeper sync. Pro: unlimited integrations with real-time webhook processing and advanced data enrichment.' },
  { q: 'Is my data secure?', a: 'Yes. All data is encrypted in transit (TLS 1.3) and at rest (AES-256). We never use your data for AI model training. You retain full ownership and can export or delete everything at any time. We\'re SOC 2 compliant and GDPR/APPs aligned.' },
  { q: 'Do you offer discounts for annual billing?', a: 'Yes — save 20% with annual billing. Growth drops from $69/month to $55/month ($660/year). Pro drops from $199/month to $159/month ($1,908/year). All annual plans include priority onboarding.' },
  { q: 'What payment methods do you accept?', a: 'We accept all major credit and debit cards (Visa, Mastercard, Amex) via Stripe. For Enterprise plans, we also offer invoice billing with NET 30 terms. All prices are in AUD.' },
];

const FAQAccordion = () => {
  const [openIdx, setOpenIdx] = useState(null);
  return (
    <div className="w-full max-w-3xl mt-12 mb-8">
      <h2 className="text-xl font-semibold text-center mb-6" style={{ color: 'var(--ink-display, #EDF1F7)' }}>
        Frequently asked questions
      </h2>
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)', background: 'var(--surface, #0E1628)' }}>
        {FAQ_ITEMS.map((item, i) => (
          <div key={i} style={{ borderBottom: i < FAQ_ITEMS.length - 1 ? '1px solid var(--border, rgba(140,170,210,0.12))' : 'none' }}>
            <button
              onClick={() => setOpenIdx(openIdx === i ? null : i)}
              className="w-full flex items-center justify-between px-5 py-4 text-left text-sm font-medium transition-colors hover:bg-white/[0.02]"
              style={{ color: 'var(--ink-display, #EDF1F7)' }}
            >
              <span>{item.q}</span>
              <ChevronDown className="w-4 h-4 shrink-0 ml-3 transition-transform duration-200"
                style={{ color: 'var(--ink-muted)', transform: openIdx === i ? 'rotate(180deg)' : 'rotate(0deg)' }} />
            </button>
            {openIdx === i && (
              <div className="px-5 pb-4">
                <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-secondary, #8FA0B8)' }}>{item.a}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SubscribePage;
