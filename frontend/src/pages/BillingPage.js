import React, { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { apiClient } from '../lib/api';
import { fontFamily } from '../design-system/tokens';
import { CreditCard, Building2, RefreshCw, CircleCheck, CircleAlert, Download, Clock, Zap, Check } from 'lucide-react';

const TIER_DISPLAY = {
  free: 'Free',
  trial: 'Free Trial',
  starter: 'Growth',
  foundation: 'Growth',
  growth: 'Growth',
  pro: 'Professional',
  professional: 'Professional',
  enterprise: 'Enterprise',
  custom_build: 'Custom',
  beta: 'Beta',
  super_admin: 'Admin',
};

const TIER_PRICE = {
  free: '$0', trial: '$0', starter: '$69', foundation: '$69', growth: '$69',
  pro: '$199', professional: '$199', enterprise: 'Custom',
  custom_build: 'Custom', beta: '$0', super_admin: '$0',
};

const PLAN_FEATURES = {
  free: ['Ask BIQc advisor', 'Alert Centre', 'Basic actions'],
  growth: ['BoardRoom strategic chat', 'Revenue analytics', 'Operations metrics', 'SOP generator', 'Exposure scan', 'Marketing automation', 'Reports library', 'Decision tracker'],
  starter: ['BoardRoom strategic chat', 'Revenue analytics', 'Operations metrics', 'SOP generator', 'Exposure scan', 'Marketing automation', 'Reports library', 'Decision tracker'],
  foundation: ['BoardRoom strategic chat', 'Revenue analytics', 'Operations metrics', 'SOP generator', 'Exposure scan', 'Marketing automation', 'Reports library', 'Decision tracker'],
  pro: ['Everything in Growth', 'WarRoom crisis console', 'Risk intelligence', 'Compliance centre', 'Advanced analysis', 'Unlimited AI queries'],
  professional: ['Everything in Growth', 'WarRoom crisis console', 'Risk intelligence', 'Compliance centre', 'Advanced analysis', 'Unlimited AI queries'],
  enterprise: ['Everything in Pro', 'Dedicated account manager', 'Custom integrations', 'SLA guarantees', 'On-premise option'],
};

const Panel = ({ children, className = '' }) => (
  <div
    className={`rounded-lg p-5 ${className}`}
    style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }}
  >
    {children}
  </div>
);

const money = (value, currency = 'AUD') =>
  new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: (currency || 'AUD').toUpperCase(),
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const BillingPage = () => {
  const [overview, setOverview] = useState(null);
  const [charges, setCharges] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  const load = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const [overviewRes, chargesRes, suppliersRes] = await Promise.all([
        apiClient.get('/billing/overview'),
        apiClient.get('/billing/charges'),
        apiClient.get('/billing/suppliers'),
      ]);
      setOverview(overviewRes?.data || null);
      setCharges(chargesRes?.data?.charges || []);
      setSuppliers(suppliersRes?.data?.suppliers || []);
    } catch (err) {
      console.error('[BillingPage] fetch failed:', err);
      setFetchError(err.message || 'Failed to load data');
      setOverview(null);
      setCharges([]);
      setSuppliers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const connectors = overview?.billing_connectors || {};
  const chargesSummary = overview?.charges_summary || {};
  const supplierSummary = overview?.supplier_summary || {};
  const rawTier = String(overview?.subscription?.tier || overview?.user?.subscription_tier || 'free').toLowerCase();
  const planLabel = TIER_DISPLAY[rawTier] || 'Free';

  const connectorBadges = useMemo(
    () => [
      {
        label: 'Stripe billing',
        ok: !!connectors.stripe_connected,
      },
      {
        label: 'Xero/accounting supplier feed',
        ok: !!connectors.xero_or_accounting_connected,
      },
    ],
    [connectors]
  );

  const priceLabel = TIER_PRICE[rawTier] || '$0';
  const features = PLAN_FEATURES[rawTier] || PLAN_FEATURES.free;
  const isHighestPlan = ['enterprise', 'custom_build', 'super_admin'].includes(rawTier);

  // Determine usage meter color: green < 60%, amber 60-85%, red > 85%
  const meterColor = (used, limit) => {
    const pct = limit > 0 ? (used / limit) * 100 : 0;
    if (pct >= 85) return '#DC2626';
    if (pct >= 60) return '#D97706';
    return '#16A34A';
  };

  return (
    <DashboardLayout>
      <div className="space-y-8 max-w-[1200px]" style={{ fontFamily: fontFamily.body }}>

        {/* ── Header ── */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-medium mb-1.5" style={{ fontFamily: fontFamily.display, color: 'var(--ink-display, #EDF1F7)', fontSize: '28px', letterSpacing: '-0.02em', lineHeight: 1.05 }}>
              Billing & Subscription
            </h1>
            <p className="text-sm" style={{ color: 'var(--ink-secondary, #8FA0B8)' }}>
              Manage your plan, payment method, and view invoice history.
            </p>
          </div>
          <button
            onClick={load}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors hover:bg-white/5"
            style={{ border: '1px solid rgba(140,170,210,0.12)', color: 'var(--ink-secondary, #8FA0B8)', fontFamily: fontFamily.mono }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {fetchError && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
            background: 'rgba(232, 93, 0, 0.08)', border: '1px solid rgba(232, 93, 0, 0.2)',
            borderRadius: 12, marginBottom: 16,
            fontFamily: "'Inter', sans-serif", fontSize: 13, color: 'var(--ink-secondary, #8FA0B8)',
          }}>
            <span style={{ color: 'var(--lava, #E85D00)' }}>{'\u26A0'}</span>
            <span style={{ flex: 1 }}>{fetchError}</span>
            <button
              onClick={() => { setFetchError(null); load(); }}
              style={{
                background: 'var(--lava, #E85D00)', color: 'white', border: 'none',
                padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600,
              }}
            >Retry</button>
          </div>
        )}

        {/* ── Connector badges ── */}
        <div className="flex flex-wrap gap-2">
          {connectorBadges.map((badge) => (
            <span
              key={badge.label}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
              style={{
                background: badge.ok ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.12)',
                color: badge.ok ? '#10B981' : '#F59E0B',
                border: `1px solid ${badge.ok ? 'rgba(16,185,129,0.25)' : 'rgba(245,158,11,0.25)'}`,
                fontFamily: fontFamily.mono,
              }}
            >
              {badge.ok ? <CircleCheck className="w-3 h-3" /> : <CircleAlert className="w-3 h-3" />}
              {badge.label}
            </span>
          ))}
        </div>

        {/* ── Plan Card (mockup spec section 1) ── */}
        <div
          className="rounded-2xl p-6"
          style={{ background: 'var(--surface, #0E1628)', border: '1px solid rgba(140,170,210,0.12)' }}
        >
          <div className="grid gap-5" style={{ gridTemplateColumns: '1fr auto' }}>
            {/* Left: plan info */}
            <div>
              {/* Badge */}
              <div
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider mb-3"
                style={{ background: 'rgba(232,93,0,0.12)', color: '#E85D00', letterSpacing: '0.08em' }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#E85D00' }} />
                Current Plan
              </div>

              {/* Plan name */}
              <h2 className="text-2xl mb-1" style={{ fontFamily: fontFamily.display, color: 'var(--ink-display, #EDF1F7)' }}>
                {planLabel}
              </h2>

              {/* Price */}
              <div className="flex items-baseline gap-1 mb-3">
                <span className="font-bold" style={{ fontFamily: fontFamily.mono, fontSize: '36px', color: 'var(--ink-display, #EDF1F7)', lineHeight: 1 }}>
                  {priceLabel}
                </span>
                <span className="text-sm" style={{ color: 'var(--ink-muted, #708499)' }}>/ month</span>
              </div>

              {/* Renewal info */}
              <div className="flex items-center gap-2 text-xs mb-4" style={{ color: 'var(--ink-muted, #708499)' }}>
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span>Renews {overview?.subscription?.next_renewal || 'next billing cycle'} · Billed monthly</span>
              </div>

              {/* Feature checklist */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
                {features.map((feat) => (
                  <div key={feat} className="flex items-center gap-2 text-sm" style={{ color: 'var(--ink-secondary, #8FA0B8)' }}>
                    <Check className="w-4 h-4 shrink-0" style={{ color: '#16A34A' }} />
                    {feat}
                  </div>
                ))}
              </div>
            </div>

            {/* Right: actions */}
            <div className="flex flex-col gap-3 items-end">
              {!isHighestPlan && (
                <button
                  className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:shadow-lg whitespace-nowrap"
                  style={{ background: 'linear-gradient(135deg, #E85D00, #FF7A1A)' }}
                >
                  Upgrade to Pro — $199/mo
                </button>
              )}
              <button
                className="px-5 py-2.5 rounded-lg text-sm font-medium transition-colors hover:text-[#EDF1F7] whitespace-nowrap"
                style={{ border: '1px solid rgba(140,170,210,0.12)', color: 'var(--ink-secondary, #8FA0B8)' }}
              >
                Manage subscription
              </button>
            </div>
          </div>
        </div>

        {/* ── Summary cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <Panel>
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="w-4 h-4 text-[#3B82F6]" />
              <span className="text-xs text-[#94A3B8]" style={{ fontFamily: fontFamily.mono }}>Paid charges</span>
            </div>
            <div className="text-2xl font-bold text-[#EDF1F7]" style={{ fontFamily: fontFamily.mono }}>
              {money(chargesSummary.total_paid, chargesSummary.currency)}
            </div>
          </Panel>

          <Panel>
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="w-4 h-4 text-[#F59E0B]" />
              <span className="text-xs text-[#94A3B8]" style={{ fontFamily: fontFamily.mono }}>Pending charges</span>
            </div>
            <div className="text-2xl font-bold text-[#EDF1F7]" style={{ fontFamily: fontFamily.mono }}>
              {money(chargesSummary.total_initiated, chargesSummary.currency)}
            </div>
          </Panel>

          <Panel>
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="w-4 h-4 text-[#E85D00]" />
              <span className="text-xs text-[#94A3B8]" style={{ fontFamily: fontFamily.mono }}>Supplier outstanding</span>
            </div>
            <div className="text-2xl font-bold text-[#EDF1F7]" style={{ fontFamily: fontFamily.mono }}>
              {money(supplierSummary.total_outstanding_supplier, chargesSummary.currency || 'AUD')}
            </div>
          </Panel>

          <Panel>
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="w-4 h-4 text-[#EF4444]" />
              <span className="text-xs text-[#94A3B8]" style={{ fontFamily: fontFamily.mono }}>Supplier overdue</span>
            </div>
            <div className="text-2xl font-bold text-[#EDF1F7]" style={{ fontFamily: fontFamily.mono }}>
              {money(supplierSummary.total_overdue_supplier, chargesSummary.currency || 'AUD')}
            </div>
          </Panel>
        </div>

        {/* ── Usage This Period (mockup spec section 2) ── */}
        <div>
          <h2 className="text-[22px] font-semibold mb-4" style={{ fontFamily: fontFamily.display, color: 'var(--ink-display, #EDF1F7)' }}>Usage This Period</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: 'AI Queries', used: overview?.usage?.ai_queries_used ?? 0, limit: overview?.usage?.ai_queries_limit ?? 500 },
              { label: 'BoardRoom Sessions', used: overview?.usage?.boardroom_used ?? 0, limit: overview?.usage?.boardroom_limit ?? 30 },
              { label: 'Report Exports', used: overview?.usage?.exports_used ?? 0, limit: overview?.usage?.exports_limit ?? 20 },
            ].map(m => {
              const hasData = overview?.usage != null;
              const displayUsed = hasData ? m.used : '--';
              const displayLimit = hasData ? m.limit : '--';
              const pct = (hasData && m.limit > 0) ? Math.min((m.used / m.limit) * 100, 100) : 0;
              const color = hasData ? meterColor(m.used, m.limit) : 'rgba(140,170,210,0.2)';
              const resetDate = overview?.usage?.period_reset || overview?.subscription?.current_period_end || null;
              const remaining = hasData ? (m.limit - m.used) : '--';
              return (
                <Panel key={m.label}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold" style={{ color: 'var(--ink-display, #EDF1F7)' }}>{m.label}</span>
                    <span className="text-xs" style={{ fontFamily: fontFamily.mono, color: 'var(--ink-secondary, #8FA0B8)' }}>{displayUsed} / {displayLimit}</span>
                  </div>
                  <div className="rounded-full mb-2 overflow-hidden" style={{ height: '8px', background: 'rgba(140,170,210,0.08)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, background: color, transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }}
                    />
                  </div>
                  <span className="text-xs" style={{ color: 'var(--ink-muted, #708499)' }}>
                    {resetDate ? `Resets ${resetDate}` : 'Resets next billing cycle'} · {remaining} remaining
                  </span>
                </Panel>
              );
            })}
          </div>
        </div>

        {/* ── Payment Method (mockup spec section 3) ── */}
        <div>
          <h2 className="text-[22px] font-semibold mb-4" style={{ fontFamily: fontFamily.display, color: 'var(--ink-display, #EDF1F7)' }}>Payment Method</h2>
          <Panel>
            {overview?.payment_method ? (
              <div className="flex items-center gap-4 flex-wrap">
                <div
                  className="w-14 h-9 rounded-md flex items-center justify-center text-white text-[11px] font-bold shrink-0"
                  style={{ background: 'linear-gradient(135deg, #1a1f71, #2b4acb)', letterSpacing: '0.05em' }}
                >
                  {(overview.payment_method.brand || 'CARD').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ fontFamily: fontFamily.mono, color: 'var(--ink-display, #EDF1F7)' }}>
                    {'\u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 '}{overview.payment_method.last4 || '----'}
                  </p>
                  {overview.payment_method.exp_month && overview.payment_method.exp_year && (
                    <p className="text-xs" style={{ color: 'var(--ink-muted, #708499)' }}>
                      Expires {String(overview.payment_method.exp_month).padStart(2, '0')}/{overview.payment_method.exp_year}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    className="px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors hover:text-[#EDF1F7] hover:border-[rgba(140,170,210,0.25)]"
                    style={{ border: '1px solid rgba(140,170,210,0.12)', color: 'var(--ink-secondary, #8FA0B8)' }}
                  >
                    Update card
                  </button>
                  <button
                    className="px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors hover:text-[#EDF1F7] hover:border-[rgba(140,170,210,0.25)]"
                    style={{ border: '1px solid rgba(140,170,210,0.12)', color: 'var(--ink-secondary, #8FA0B8)' }}
                  >
                    Add new
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4 flex-wrap">
                <div
                  className="w-14 h-9 rounded-md flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(140,170,210,0.08)', border: '1px dashed rgba(140,170,210,0.2)' }}
                >
                  <CreditCard className="w-5 h-5" style={{ color: 'var(--ink-muted, #708499)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: 'var(--ink-secondary, #8FA0B8)' }}>
                    No payment method on file
                  </p>
                  <p className="text-xs" style={{ color: 'var(--ink-muted, #708499)' }}>
                    Add a card to enable automatic billing
                  </p>
                </div>
                <button
                  className="px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors hover:shadow-lg whitespace-nowrap"
                  style={{ background: 'linear-gradient(135deg, #E85D00, #FF7A1A)', color: '#FFFFFF', border: 'none' }}
                >
                  Add payment method
                </button>
              </div>
            )}
          </Panel>
        </div>

        {/* ── Invoice History (mockup spec section 4) ── */}
        <div>
          <h2 className="text-[22px] font-semibold mb-4" style={{ fontFamily: fontFamily.display, color: 'var(--ink-display, #EDF1F7)' }}>Invoice History</h2>
          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface, #0E1628)', border: '1px solid rgba(140,170,210,0.12)' }}>
            <table className="w-full" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(140,170,210,0.06)' }}>
                  {['Date', 'Description', 'Amount', 'Status', 'Invoice'].map(h => (
                    <th
                      key={h}
                      className="text-left px-4 py-3 text-[10px] font-semibold uppercase"
                      style={{ color: 'var(--ink-muted, #708499)', borderBottom: '1px solid rgba(140,170,210,0.12)', fontFamily: fontFamily.mono, letterSpacing: '0.08em' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(charges || []).slice(0, 8).map((row, i) => {
                  const status = (row.payment_status || 'paid').toLowerCase();
                  const statusStyles = {
                    paid:    { background: '#D1FAE5', color: '#065F46' },
                    pending: { background: '#FEF3C7', color: '#92400E' },
                    failed:  { background: '#FEE2E2', color: '#991B1B' },
                  };
                  const sStyle = statusStyles[status] || statusStyles.paid;
                  return (
                    <tr key={row.session_id || `${row.created_at}-${row.amount}-${i}`} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-3 text-sm" style={{ color: 'var(--ink-secondary, #8FA0B8)', borderBottom: '1px solid rgba(140,170,210,0.06)' }}>
                        {row.created_at || ''}
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: 'var(--ink-display, #EDF1F7)', borderBottom: '1px solid rgba(140,170,210,0.06)' }}>
                        {row.tier || planLabel} Plan — Monthly
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold" style={{ fontFamily: fontFamily.mono, color: 'var(--ink-display, #EDF1F7)', borderBottom: '1px solid rgba(140,170,210,0.06)' }}>
                        {money(row.amount, row.currency || chargesSummary.currency || 'AUD')}
                      </td>
                      <td className="px-4 py-3" style={{ borderBottom: '1px solid rgba(140,170,210,0.06)' }}>
                        <span
                          className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full"
                          style={{ ...sStyle, letterSpacing: '0.08em' }}
                        >
                          {status}
                        </span>
                      </td>
                      <td className="px-4 py-3" style={{ borderBottom: '1px solid rgba(140,170,210,0.06)' }}>
                        <span className="inline-flex items-center gap-1 text-xs font-medium cursor-pointer hover:underline" style={{ color: '#E85D00' }}>
                          <Download className="w-3.5 h-3.5" />
                          PDF
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {!loading && (!charges || charges.length === 0) && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-xs" style={{ color: '#64748B' }}>
                      No invoices found yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Upgrade CTA (mockup spec section 5) ── */}
        {!isHighestPlan && (
          <div className="rounded-2xl p-8 text-center relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #111827, #1A1A2E)' }}>
            <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 50% 120%, rgba(232,93,0,0.25), transparent 60%)' }} />
            <div className="relative z-10">
              <h2 className="text-[28px] font-semibold text-white mb-2" style={{ fontFamily: fontFamily.display }}>
                Unlock the full power of BIQc
              </h2>
              <p className="text-sm mb-5 mx-auto max-w-[480px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>
                Upgrade to Pro for WarRoom crisis console, risk intelligence, compliance centre, advanced analysis, and unlimited AI queries.
              </p>
              <button
                className="inline-flex items-center gap-2 px-8 py-3 rounded-md text-base font-semibold text-white transition-all hover:shadow-lg hover:-translate-y-0.5"
                style={{ background: 'linear-gradient(135deg, #E85D00, #FF7A1A)' }}
              >
                <Zap className="w-[18px] h-[18px]" />
                Upgrade to Pro — $199/mo
              </button>
            </div>
          </div>
        )}

        {/* ── Stripe & Supplier Data ── */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Panel>
            <h2 className="text-sm font-semibold text-[#EDF1F7] mb-3" style={{ fontFamily: fontFamily.display }}>
              Recent client charges (Stripe)
            </h2>
            <div className="space-y-2">
              {(charges || []).slice(0, 8).map((row) => (
                <div
                  key={row.session_id || `stripe-${row.created_at}-${row.amount}`}
                  className="rounded-lg px-3 py-2 flex items-center justify-between"
                  style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}
                >
                  <div>
                    <p className="text-xs text-[#EDF1F7]">{row.tier || 'subscription'}</p>
                    <p className="text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>
                      {row.payment_status || 'unknown'} · {row.created_at || ''}
                    </p>
                  </div>
                  <p className="text-xs font-semibold text-[#EDF1F7]" style={{ fontFamily: fontFamily.mono }}>
                    {money(row.amount, row.currency || chargesSummary.currency || 'AUD')}
                  </p>
                </div>
              ))}
              {!loading && (!charges || charges.length === 0) && (
                <p className="text-xs text-[#64748B]">No Stripe charges found for this client workspace yet.</p>
              )}
            </div>
          </Panel>

          <Panel>
            <h2 className="text-sm font-semibold text-[#EDF1F7] mb-3" style={{ fontFamily: fontFamily.display }}>
              Supplier invoices (Xero/accounting)
            </h2>
            <div className="space-y-2">
              {(suppliers || []).slice(0, 8).map((row) => (
                <div
                  key={row.invoice_id || `supp-${row.supplier}-${row.amount}-${row.due_date}`}
                  className="rounded-lg px-3 py-2 flex items-center justify-between"
                  style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}
                >
                  <div>
                    <p className="text-xs text-[#EDF1F7]">{row.supplier}</p>
                    <p className="text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>
                      {row.status} · due {row.due_date || 'n/a'}
                    </p>
                  </div>
                  <p
                    className="text-xs font-semibold"
                    style={{ fontFamily: fontFamily.mono, color: row.is_overdue ? '#EF4444' : 'var(--ink-display, #EDF1F7)' }}
                  >
                    {money(row.amount, chargesSummary.currency || 'AUD')}
                  </p>
                </div>
              ))}
              {!loading && (!suppliers || suppliers.length === 0) && (
                <p className="text-xs text-[#64748B]">
                  No supplier invoices found. Connect Xero/accounting integration to activate supplier billing visibility.
                </p>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default BillingPage;

