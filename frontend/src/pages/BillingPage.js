import React, { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { apiClient } from '../lib/api';
import { fontFamily } from '../design-system/tokens';
import { CreditCard, Building2, RefreshCw, CircleCheck, CircleAlert } from 'lucide-react';

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

  const load = async () => {
    setLoading(true);
    try {
      const [overviewRes, chargesRes, suppliersRes] = await Promise.all([
        apiClient.get('/billing/overview'),
        apiClient.get('/billing/charges'),
        apiClient.get('/billing/suppliers'),
      ]);
      setOverview(overviewRes?.data || null);
      setCharges(chargesRes?.data?.charges || []);
      setSuppliers(suppliersRes?.data?.suppliers || []);
    } catch {
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

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-[1200px]" style={{ fontFamily: fontFamily.body }}>
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-medium mb-1.5" style={{ fontFamily: fontFamily.display, color: '#EDF1F7', fontSize: 'clamp(1.8rem, 3vw, 2.4rem)', letterSpacing: '-0.02em', lineHeight: 1.05 }}>
              Billing & Subscription.
            </h1>
            <p className="text-sm" style={{ color: '#8FA0B8' }}>
              Manage your plan, usage, and payment details.
            </p>
            <p className="mt-1 text-xs text-[#94A3B8]" style={{ fontFamily: fontFamily.mono }}>
              Current plan: {planLabel}
            </p>
          </div>
          <button
            onClick={load}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors hover:bg-white/5"
            style={{ border: '1px solid var(--biqc-border)', color: 'var(--biqc-text)', fontFamily: fontFamily.mono }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh billing
          </button>
        </div>

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

        {/* Usage This Period — matches mockup usage meters */}
        <div>
          <h2 className="text-lg font-semibold mb-4" style={{ fontFamily: fontFamily.display, color: '#EDF1F7' }}>Usage This Period</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: 'AI Queries', used: 247, limit: 500, color: '#16A34A', note: 'Resets 10 May 2026' },
              { label: 'BoardRoom Sessions', used: 18, limit: 30, color: '#D97706', note: 'Resets 10 May 2026' },
              { label: 'Report Exports', used: 5, limit: 20, color: '#16A34A', note: 'Resets 10 May 2026' },
            ].map(m => (
              <Panel key={m.label}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold" style={{ color: '#EDF1F7' }}>{m.label}</span>
                  <span className="text-xs" style={{ fontFamily: fontFamily.mono, color: '#8FA0B8' }}>{m.used} / {m.limit}</span>
                </div>
                <div className="h-2 rounded-full mb-2" style={{ background: 'rgba(140,170,210,0.12)' }}>
                  <div className="h-2 rounded-full transition-all" style={{ width: `${(m.used / m.limit) * 100}%`, background: m.color }} />
                </div>
                <span className="text-xs" style={{ color: '#708499' }}>{m.note} · {m.limit - m.used} remaining</span>
              </Panel>
            ))}
          </div>
        </div>

        {/* Payment Method — matches mockup */}
        <div>
          <h2 className="text-lg font-semibold mb-4" style={{ fontFamily: fontFamily.display, color: '#EDF1F7' }}>Payment Method</h2>
          <Panel>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="w-14 h-9 rounded-md flex items-center justify-center text-white text-[11px] font-bold shrink-0" style={{ background: 'linear-gradient(135deg, #1a1f71, #2b4acb)', letterSpacing: '0.05em' }}>VISA</div>
              <div className="flex-1">
                <p className="text-sm font-medium" style={{ fontFamily: fontFamily.mono, color: '#EDF1F7' }}>.... .... .... 4291</p>
                <p className="text-xs" style={{ color: '#708499' }}>Expires 08/2028</p>
              </div>
              <div className="flex gap-2">
                <button className="px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors hover:text-[#EDF1F7]" style={{ border: '1px solid rgba(140,170,210,0.12)', color: '#8FA0B8' }}>Update card</button>
                <button className="px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors hover:text-[#EDF1F7]" style={{ border: '1px solid rgba(140,170,210,0.12)', color: '#8FA0B8' }}>Add new</button>
              </div>
            </div>
          </Panel>
        </div>

        {/* Invoice History — matches mockup table */}
        <div>
          <h2 className="text-lg font-semibold mb-4" style={{ fontFamily: fontFamily.display, color: '#EDF1F7' }}>Invoice History</h2>
          <div className="rounded-2xl overflow-hidden" style={{ background: '#0E1628', border: '1px solid rgba(140,170,210,0.12)' }}>
            <table className="w-full" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(140,170,210,0.06)' }}>
                  {['Date', 'Description', 'Amount', 'Status', 'Invoice'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#708499', borderBottom: '1px solid rgba(140,170,210,0.12)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(charges || []).slice(0, 8).map((row, i) => (
                  <tr key={row.session_id || `${row.created_at}-${row.amount}-${i}`} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-sm" style={{ color: '#8FA0B8', borderBottom: '1px solid rgba(140,170,210,0.06)' }}>{row.created_at || ''}</td>
                    <td className="px-4 py-3 text-sm" style={{ color: '#EDF1F7', borderBottom: '1px solid rgba(140,170,210,0.06)' }}>{row.tier || 'Growth Plan'} — Monthly</td>
                    <td className="px-4 py-3 text-sm font-semibold" style={{ fontFamily: fontFamily.mono, color: '#EDF1F7', borderBottom: '1px solid rgba(140,170,210,0.06)' }}>{money(row.amount, row.currency || chargesSummary.currency || 'AUD')}</td>
                    <td className="px-4 py-3" style={{ borderBottom: '1px solid rgba(140,170,210,0.06)' }}>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: row.payment_status === 'paid' ? '#D1FAE5' : '#FEF3C7', color: row.payment_status === 'paid' ? '#065F46' : '#92400E' }}>{row.payment_status || 'Paid'}</span>
                    </td>
                    <td className="px-4 py-3" style={{ borderBottom: '1px solid rgba(140,170,210,0.06)' }}>
                      <span className="text-xs font-medium cursor-pointer hover:underline" style={{ color: '#E85D00' }}>PDF</span>
                    </td>
                  </tr>
                ))}
                {!loading && (!charges || charges.length === 0) && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-xs" style={{ color: '#64748B' }}>No invoices found yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Upgrade CTA — matches mockup gradient banner */}
        <div className="rounded-2xl p-8 text-center relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #111827, #1A1A2E)' }}>
          <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 50% 120%, rgba(232,93,0,0.25), transparent 60%)' }} />
          <div className="relative z-10">
            <h2 className="text-2xl font-semibold text-white mb-2" style={{ fontFamily: fontFamily.display }}>Unlock the full power of BIQc</h2>
            <p className="text-sm mb-5 mx-auto max-w-md" style={{ color: 'rgba(255,255,255,0.6)' }}>Upgrade to Pro for WarRoom crisis console, risk intelligence, compliance centre, advanced analysis, and unlimited AI queries.</p>
            <button className="inline-flex items-center gap-2 px-8 py-3 rounded-md text-base font-semibold text-white transition-all hover:shadow-lg" style={{ background: 'linear-gradient(135deg, #E85D00, #FF7A1A)' }}>
              Upgrade to Pro — $199/mo
            </button>
          </div>
        </div>

        {/* Stripe & Supplier Data */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Panel>
            <h2 className="text-sm font-semibold text-[#EDF1F7] mb-3" style={{ fontFamily: fontFamily.display }}>
              Recent client charges (Stripe)
            </h2>
            <div className="space-y-2">
              {(charges || []).slice(0, 8).map((row) => (
                <div
                  key={row.session_id || `${row.created_at}-${row.amount}`}
                  className="rounded-lg px-3 py-2 flex items-center justify-between"
                  style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}
                >
                  <div>
                    <p className="text-xs text-[#EDF1F7]">{row.tier || 'subscription'}</p>
                    <p className="text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>
                      {row.payment_status || 'unknown'} • {row.created_at || ''}
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
                  key={row.invoice_id || `${row.supplier}-${row.amount}-${row.due_date}`}
                  className="rounded-lg px-3 py-2 flex items-center justify-between"
                  style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}
                >
                  <div>
                    <p className="text-xs text-[#EDF1F7]">{row.supplier}</p>
                    <p className="text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>
                      {row.status} • due {row.due_date || 'n/a'}
                    </p>
                  </div>
                  <p
                    className="text-xs font-semibold"
                    style={{ fontFamily: fontFamily.mono, color: row.is_overdue ? '#EF4444' : '#EDF1F7' }}
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

