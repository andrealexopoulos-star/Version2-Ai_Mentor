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
            <h1 className="text-2xl font-semibold text-[#F4F7FA] mb-1.5" style={{ fontFamily: fontFamily.display }}>
              Billing Command Center
            </h1>
            <p className="text-sm text-[#9FB0C3]">
              Unified client billing for charges and supplier obligations across Stripe and Xero-compatible accounting feeds.
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
            <div className="text-2xl font-bold text-[#F4F7FA]" style={{ fontFamily: fontFamily.mono }}>
              {money(chargesSummary.total_paid, chargesSummary.currency)}
            </div>
          </Panel>

          <Panel>
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="w-4 h-4 text-[#F59E0B]" />
              <span className="text-xs text-[#94A3B8]" style={{ fontFamily: fontFamily.mono }}>Pending charges</span>
            </div>
            <div className="text-2xl font-bold text-[#F4F7FA]" style={{ fontFamily: fontFamily.mono }}>
              {money(chargesSummary.total_initiated, chargesSummary.currency)}
            </div>
          </Panel>

          <Panel>
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="w-4 h-4 text-[#FF6A00]" />
              <span className="text-xs text-[#94A3B8]" style={{ fontFamily: fontFamily.mono }}>Supplier outstanding</span>
            </div>
            <div className="text-2xl font-bold text-[#F4F7FA]" style={{ fontFamily: fontFamily.mono }}>
              {money(supplierSummary.total_outstanding_supplier, chargesSummary.currency || 'AUD')}
            </div>
          </Panel>

          <Panel>
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="w-4 h-4 text-[#EF4444]" />
              <span className="text-xs text-[#94A3B8]" style={{ fontFamily: fontFamily.mono }}>Supplier overdue</span>
            </div>
            <div className="text-2xl font-bold text-[#F4F7FA]" style={{ fontFamily: fontFamily.mono }}>
              {money(supplierSummary.total_overdue_supplier, chargesSummary.currency || 'AUD')}
            </div>
          </Panel>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Panel>
            <h2 className="text-sm font-semibold text-[#F4F7FA] mb-3" style={{ fontFamily: fontFamily.display }}>
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
                    <p className="text-xs text-[#F4F7FA]">{row.tier || 'subscription'}</p>
                    <p className="text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>
                      {row.payment_status || 'unknown'} • {row.created_at || ''}
                    </p>
                  </div>
                  <p className="text-xs font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.mono }}>
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
            <h2 className="text-sm font-semibold text-[#F4F7FA] mb-3" style={{ fontFamily: fontFamily.display }}>
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
                    <p className="text-xs text-[#F4F7FA]">{row.supplier}</p>
                    <p className="text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>
                      {row.status} • due {row.due_date || 'n/a'}
                    </p>
                  </div>
                  <p
                    className="text-xs font-semibold"
                    style={{ fontFamily: fontFamily.mono, color: row.is_overdue ? '#EF4444' : '#F4F7FA' }}
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

