/**
 * IntegrationStatusWidget — Granular per-integration status component.
 *
 * Replaces generic "Missing Integrations" banners with specific, actionable statuses:
 *  ✅ Connected + data:    "HubSpot connected — 15 deals"
 *  ⏳ Connected, no data:  "Xero connected — 0 invoices; first sync may take a few minutes"
 *  🔴 Not connected:       "CRM not connected — Connect to analyse pipeline" + CTA
 *
 * Props:
 *   categories  {string[]}   — which categories to show, e.g. ['crm', 'accounting']
 *   status      {object}     — from useIntegrationStatus().status
 *   loading     {boolean}
 *   syncing     {boolean}
 *   onRefresh   {fn}         — triggers sync
 *   compact     {boolean}    — show minimal inline version (for page headers)
 */
import React from 'react';
import { CheckCircle2, AlertCircle, Plug, RefreshCw, ArrowRight, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fontFamily } from '../design-system/tokens';

const CATEGORY_META = {
  crm: {
    label: 'CRM',
    providers: 'HubSpot, Salesforce, Pipedrive',
    recordLabel: 'deals',
    ctaText: 'Connect CRM',
    emptyMsg: 'No pipeline data yet — first sync may take a few minutes.',
    missingMsg: 'Connect your CRM to view pipeline, deal velocity, and churn signals.',
    icon: '👥',
  },
  accounting: {
    label: 'Accounting',
    providers: 'Xero, QuickBooks, MYOB',
    recordLabel: 'invoices',
    ctaText: 'Connect Accounting',
    emptyMsg: '0 invoices found — first sync may take a few minutes.',
    missingMsg: 'Connect your accounting tool to view cash flow, margins, and runway.',
    icon: '💰',
  },
  email: {
    label: 'Email',
    providers: 'Gmail, Outlook',
    recordLabel: 'emails',
    ctaText: 'Connect Email',
    emptyMsg: 'Email connected — intelligence will build as emails are analysed.',
    missingMsg: 'Connect your email to view client intelligence and communication patterns.',
    icon: '📧',
  },
  hris: {
    label: 'HR System',
    providers: 'BambooHR, Workday',
    recordLabel: 'employees',
    ctaText: 'Connect HR System',
    emptyMsg: '0 employee records found — first sync may take a few minutes.',
    missingMsg: 'Connect your HR system to view headcount, capacity, and people signals.',
    icon: '👔',
  },
  ats: {
    label: 'ATS',
    providers: 'Lever, Greenhouse, Workable',
    recordLabel: 'candidates',
    ctaText: 'Connect ATS',
    emptyMsg: '0 candidates found — first sync may take a few minutes.',
    missingMsg: 'Connect your ATS to view hiring pipeline and talent signals.',
    icon: '📋',
  },
};

const STATUS_COLORS = {
  connected: { text: '#10B981', bg: 'rgba(16, 185, 129, 0.06)', border: 'rgba(16, 185, 129, 0.2)' },
  empty:     { text: '#F59E0B', bg: 'rgba(245, 158, 11, 0.06)', border: 'rgba(245, 158, 11, 0.2)' },
  missing:   { text: '#E85D00', bg: 'rgba(232, 93, 0, 0.06)',  border: 'rgba(232, 93, 0, 0.2)'  },
};

const IntegrationStatusRow = ({ category, integrationData, compact, navigate }) => {
  const meta = CATEGORY_META[category];
  if (!meta) return null;

  if (!integrationData) {
    // Not connected
    const col = STATUS_COLORS.missing;
    if (compact) {
      return (
        <button
          onClick={() => navigate('/integrations')}
          data-testid={`integration-status-${category}-cta`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:brightness-110"
          style={{ color: col.text, background: col.bg, border: `1px solid ${col.border}` }}
        >
          <Plug className="w-3.5 h-3.5" />
          {meta.ctaText}
          <ArrowRight className="w-3 h-3" />
        </button>
      );
    }
    return (
      <div
        data-testid={`integration-status-${category}-missing`}
        className="flex items-start gap-3 p-4 rounded-xl"
        style={{ background: col.bg, border: `1px solid ${col.border}` }}
      >
        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: col.text }} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.display }}>
            {meta.label} not connected
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--biqc-text-2)', fontFamily: fontFamily.body }}>
            {meta.missingMsg}
          </p>
        </div>
        <button
          onClick={() => navigate('/integrations')}
          data-testid={`integration-status-${category}-connect-btn`}
          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:brightness-110 whitespace-nowrap"
          style={{ color: '#fff', background: col.text }}
        >
          <Plug className="w-3 h-3" />
          {meta.ctaText}
        </button>
      </div>
    );
  }

  const hasData = (integrationData.records_count || 0) > 0;
  const col = hasData ? STATUS_COLORS.connected : STATUS_COLORS.empty;
  const providerName = integrationData.provider || meta.label;
  const count = integrationData.records_count || 0;
  const syncedAt = integrationData.last_sync_at
    ? new Date(integrationData.last_sync_at).toLocaleString('en-AU', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null;

  if (compact) {
    return (
      <div
        data-testid={`integration-status-${category}-connected`}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
        style={{ color: col.text, background: col.bg, border: `1px solid ${col.border}` }}
      >
        <CheckCircle2 className="w-3.5 h-3.5" />
        {providerName}
        {hasData && <span style={{ color: 'var(--biqc-text-2)' }}>· {count} {meta.recordLabel}</span>}
      </div>
    );
  }

  return (
    <div
      data-testid={`integration-status-${category}-${hasData ? 'has-data' : 'no-data'}`}
      className="flex items-start gap-3 p-4 rounded-xl"
      style={{ background: col.bg, border: `1px solid ${col.border}` }}
    >
      <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: col.text }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.display }}>
          {providerName} connected
          {hasData && (
            <span className="font-normal ml-1" style={{ color: 'var(--biqc-text-2)' }}>
              — {count} {meta.recordLabel} {count === 1 ? 'imported' : 'imported'}
            </span>
          )}
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--biqc-text-2)', fontFamily: fontFamily.body }}>
          {hasData
            ? (syncedAt ? `Last synced ${syncedAt}` : `Syncing automatically`)
            : meta.emptyMsg
          }
        </p>
        {integrationData.error_message && (
          <p className="text-xs mt-1" style={{ color: '#EF4444', fontFamily: fontFamily.mono }}>
            Error: {integrationData.error_message}
          </p>
        )}
      </div>
    </div>
  );
};

const IntegrationStatusWidget = ({
  categories = ['crm', 'accounting', 'email'],
  status,
  loading,
  syncing,
  onRefresh,
  compact = false,
  showRefresh = true,
}) => {
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2" data-testid="integration-status-loading">
        <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#E85D00' }} />
        <span className="text-xs" style={{ color: 'var(--biqc-text-2)' }}>Checking integrations...</span>
      </div>
    );
  }

  const getIntegration = (category) => {
    if (!status?.integrations) return null;
    return status.integrations.find(i => i.category === category && i.connected) || null;
  };

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-2" data-testid="integration-status-compact">
        {categories.map(cat => (
          <IntegrationStatusRow
            key={cat}
            category={cat}
            integrationData={getIntegration(cat)}
            compact
            navigate={navigate}
          />
        ))}
        {showRefresh && onRefresh && (
          <button
            onClick={onRefresh}
            disabled={syncing}
            data-testid="integration-status-refresh-compact"
            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs transition-all hover:brightness-110"
            style={{ color: '#64748B', background: 'transparent', border: '1px solid var(--biqc-border)' }}
          >
            <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="integration-status-widget">
      {categories.map(cat => (
        <IntegrationStatusRow
          key={cat}
          category={cat}
          integrationData={getIntegration(cat)}
          compact={false}
          navigate={navigate}
        />
      ))}
      {showRefresh && onRefresh && (
        <div className="flex justify-end pt-1">
          <button
            onClick={onRefresh}
            disabled={syncing}
            data-testid="integration-status-refresh-btn"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{ color: 'var(--biqc-text-2)', background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#E85D00'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(140,170,210,0.15)'}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} style={{ color: syncing ? '#E85D00' : undefined }} />
            {syncing ? 'Syncing...' : 'Refresh Data'}
          </button>
        </div>
      )}
    </div>
  );
};

export default IntegrationStatusWidget;
