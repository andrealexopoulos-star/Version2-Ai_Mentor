import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import WebsiteLayout from '../../components/website/WebsiteLayout';
import {
  Shield, Lock, Eye, RefreshCw, ArrowRight, Info,
  CheckCircle2, Code, Webhook, FileSpreadsheet, Globe,
} from 'lucide-react';
import { fontFamily } from '../../design-system/tokens';


// ── Deterministic local connector badge (no external DNS dependency) ─────────
const Logo = ({ domain, name, size = 44 }) => {
  const seed = `${domain || ''}:${name || ''}`;
  const hash = Array.from(seed).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const hue = hash % 360;
  const initials = (name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || '?';
  return (
    <div
      className="rounded-xl flex items-center justify-center font-bold flex-shrink-0"
      aria-label={name}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, hsla(${hue}, 70%, 45%, 0.28), hsla(${(hue + 36) % 360}, 70%, 38%, 0.28))`,
        border: '1px solid #243140',
        color: '#E2E8F0',
        fontSize: size * 0.28,
        fontFamily: fontFamily.mono,
      }}
    >
      {initials}
    </div>
  );
};

// ── Filter chips ─────────────────────────────────────────────────────────────
const FILTERS = [
  { id: 'all',         label: 'All',          tooltip: null },
  { id: 'email',       label: 'Email',        tooltip: 'Read-only access to metadata (sender, subject, date). BIQc never reads email body content.' },
  { id: 'crm',         label: 'CRM',          tooltip: 'Read-only: contacts, deals, pipeline stages, activity logs.' },
  { id: 'accounting',  label: 'Accounting',   tooltip: 'Read-only: invoices, payments, P&L summaries, cashflow.' },
  { id: 'hris',        label: 'HR & Payroll', tooltip: 'Read-only: headcount, roles, leave balances. No salary data shared.' },
  { id: 'ats',         label: 'ATS',          tooltip: 'Read-only: job listings, candidate pipeline, hiring velocity.' },
  { id: 'storage',     label: 'File Storage', tooltip: 'Read-only: file metadata and document indexing for AI context.' },
];

// ── Integration catalogue ─────────────────────────────────────────────────────
const ALL_INTEGRATIONS = [
  // Email
  { id: 'gmail',       name: 'Gmail',                domain: 'gmail.com',         cat: 'email',      benefit: 'Sync your inbox to power AI-driven client intelligence and communication signals.' },
  { id: 'outlook',     name: 'Microsoft Outlook',    domain: 'microsoft.com',     cat: 'email',      benefit: 'Connect Microsoft 365 for email, calendar and Teams intelligence.' },
  // CRM
  { id: 'hubspot',     name: 'HubSpot',              domain: 'hubspot.com',       cat: 'crm',        benefit: 'Consolidate deals and pipeline forecasts for revenue intelligence.' },
  { id: 'salesforce',  name: 'Salesforce',           domain: 'salesforce.com',    cat: 'crm',        benefit: 'Unify enterprise CRM data across contacts, opportunities and forecasts.' },
  { id: 'pipedrive',   name: 'Pipedrive',            domain: 'pipedrive.com',     cat: 'crm',        benefit: 'Track pipeline velocity and deal health in real time.' },
  { id: 'zoho',        name: 'Zoho CRM',             domain: 'zoho.com',          cat: 'crm',        benefit: 'Connect multichannel CRM data for client and sales intelligence.' },
  { id: 'activecampaign', name: 'ActiveCampaign',   domain: 'activecampaign.com',cat: 'crm',        benefit: 'Merge marketing automation signals with pipeline and revenue data.' },
  // Accounting
  { id: 'xero',        name: 'Xero',                 domain: 'xero.com',          cat: 'accounting', benefit: 'Connect Xero to unify cashflow, payables and financial runway insights.' },
  { id: 'quickbooks',  name: 'QuickBooks',           domain: 'quickbooks.intuit.com', cat: 'accounting', benefit: 'Integrate bookkeeping and invoicing data for margin intelligence.' },
  { id: 'netsuite',    name: 'NetSuite',             domain: 'netsuite.com',      cat: 'accounting', benefit: 'Unify ERP financials for enterprise-grade revenue and cost analysis.' },
  { id: 'myob',        name: 'MYOB',                 domain: 'myob.com',          cat: 'accounting', benefit: 'Connect Australian accounting data for cashflow and compliance signals.' },
  { id: 'freshbooks',  name: 'FreshBooks',           domain: 'freshbooks.com',    cat: 'accounting', benefit: 'Sync invoicing and expense data for SMB financial intelligence.' },
  // HRIS
  { id: 'bamboohr',    name: 'BambooHR',             domain: 'bamboohr.com',      cat: 'hris',       benefit: 'Connect people data to track headcount, capacity and workforce health.' },
  { id: 'deel',        name: 'Deel',                 domain: 'deel.com',          cat: 'hris',       benefit: 'Integrate global payroll data for distributed workforce intelligence.' },
  { id: 'employment-hero', name: 'Employment Hero',  domain: 'employmenthero.com',cat: 'hris',       benefit: 'Sync HR and payroll for Australian workforce compliance signals.' },
  { id: 'gusto',       name: 'Gusto',                domain: 'gusto.com',         cat: 'hris',       benefit: 'Connect payroll and benefits data for people cost intelligence.' },
  { id: 'rippling',    name: 'Rippling',             domain: 'rippling.com',      cat: 'hris',       benefit: 'Unify IT and HR data for workforce capacity and productivity signals.' },
  // ATS
  { id: 'greenhouse',  name: 'Greenhouse',           domain: 'greenhouse.io',     cat: 'ats',        benefit: 'Track hiring pipeline velocity and candidate conversion rates.' },
  { id: 'lever',       name: 'Lever',                domain: 'lever.co',          cat: 'ats',        benefit: 'Connect talent acquisition data for headcount growth forecasting.' },
  { id: 'workable',    name: 'Workable',             domain: 'workable.com',      cat: 'ats',        benefit: 'Integrate ATS data to align hiring velocity with business targets.' },
  // File Storage
  { id: 'google-drive',name: 'Google Drive',         domain: 'google.com',        cat: 'storage',    benefit: 'Index documents for AI-powered business context and knowledge retrieval.' },
  { id: 'onedrive',    name: 'Microsoft OneDrive',   domain: 'microsoft.com',     cat: 'storage',    benefit: 'Connect Microsoft 365 file storage for document intelligence.' },
  { id: 'dropbox',     name: 'Dropbox',              domain: 'dropbox.com',       cat: 'storage',    benefit: 'Sync cloud file storage to enrich AI context with business documents.' },
  { id: 'notion',      name: 'Notion',               domain: 'notion.so',         cat: 'storage',    benefit: 'Index your workspace wiki and SOPs for operational intelligence.' },
];

const COMING_SOON_INTEGRATIONS = [
  { id: 'meta-ads', name: 'Meta Ads', domain: 'meta.com', cat: 'marketing', benefit: 'Connect paid social signals to campaign and revenue intelligence.' },
  { id: 'linkedin-ads', name: 'LinkedIn Ads', domain: 'linkedin.com', cat: 'marketing', benefit: 'Track B2B acquisition pressure and channel contribution.' },
  { id: 'google-ads', name: 'Google Ads', domain: 'google.com', cat: 'marketing', benefit: 'Unify paid search performance with pipeline outcomes.' },
  { id: 'intercom', name: 'Intercom', domain: 'intercom.com', cat: 'support', benefit: 'Link customer conversation quality to retention risk.' },
];

// ── Tooltip component ─────────────────────────────────────────────────────────
const Tooltip = ({ text }) => {
  const [show, setShow] = useState(false);
  if (!text) return null;
  return (
    <div className="relative inline-flex items-center" style={{ verticalAlign: 'middle' }}>
      <button
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        className="ml-1 p-0.5 rounded-full focus:outline-none"
        aria-label="More information"
        style={{ color: 'rgba(255,255,255,0.25)' }}
      >
        <Info className="w-3.5 h-3.5" />
      </button>
      {show && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-56 px-3 py-2.5 rounded-xl text-xs leading-relaxed pointer-events-none"
          style={{ background: '#1A2332', border: '1px solid #2D3E50', color: '#9FB0C3', fontFamily: fontFamily.body, boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0"
            style={{ borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '5px solid #2D3E50' }} />
        </div>
      )}
    </div>
  );
};

// ── Integration card ──────────────────────────────────────────────────────────
const IntegrationCard = ({ integration, index, comingSoon = false }) => (
  <div
    className="rounded-2xl p-5 flex flex-col gap-4 transition-all duration-200 hover:-translate-y-1 group"
    style={{
      background: '#141C26',
      border: '1px solid #243140',
      boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
      animation: `fadeInUp 0.4s ease-out ${index * 60}ms both`,
    }}
  >
    <div className="flex items-center gap-3">
      <Logo domain={integration.domain} name={integration.name} size={44} />
      <div>
        <p className="font-semibold text-sm" style={{ color: '#F4F7FA', fontFamily: fontFamily.display }}>{integration.name}</p>
        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wider"
          style={{ background: 'rgba(255,106,0,0.1)', color: '#FF6A00', fontFamily: fontFamily.mono }}>
          {integration.cat === 'storage' ? 'File Storage' : integration.cat.toUpperCase()}
        </span>
      </div>
    </div>
    <p className="text-xs leading-relaxed flex-1" style={{ color: '#9FB0C3', fontFamily: fontFamily.body }}>
      {integration.benefit}
    </p>
    {comingSoon ? (
      <button
        type="button"
        className="w-full py-2.5 rounded-xl text-xs font-semibold text-center transition-all"
        style={{ border: '1px solid rgba(148,163,184,0.35)', color: '#94A3B8', background: 'transparent', fontFamily: fontFamily.body }}
        data-testid={`integration-card-coming-soon-${integration.id}`}
      >
        Coming soon
      </button>
    ) : (
      <Link to={`/register-supabase?integration=${integration.id}`}
        className="w-full py-2.5 rounded-xl text-xs font-semibold text-center transition-all"
        style={{ border: '1px solid rgba(255,106,0,0.35)', color: '#FF6A00', background: 'transparent', fontFamily: fontFamily.body }}
        onMouseEnter={e => { e.currentTarget.style.background = '#FF6A00'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#FF6A00'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#FF6A00'; e.currentTarget.style.borderColor = 'rgba(255,106,0,0.35)'; }}
        data-testid={`integration-card-${integration.id}`}
      >
        Connect
      </Link>
    )}
  </div>
);

// ── Main page ─────────────────────────────────────────────────────────────────
const IntegrationsPage = () => {
  const [activeFilter, setActiveFilter] = useState('all');
  const [showTooltip, setShowTooltip] = useState(null);

  const filtered = activeFilter === 'all'
    ? ALL_INTEGRATIONS
    : ALL_INTEGRATIONS.filter(i => i.cat === activeFilter);

  const activeCatTooltip = FILTERS.find(f => f.id === activeFilter)?.tooltip;

  return (
    <WebsiteLayout>
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* ── HERO ── */}
      <section className="relative overflow-hidden" data-testid="integrations-hero"
        style={{ background: 'linear-gradient(180deg, #070E18 0%, #0F1720 100%)' }}>
        <div className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none'%3E%3Cpath d='M30 3L57 30L30 57L3 30z' stroke='%23ffffff' stroke-opacity='0.025' stroke-width='1'/%3E%3C/g%3E%3C/svg%3E")`, backgroundSize: '60px 60px' }} />
        <div className="max-w-5xl mx-auto px-6 pt-20 pb-16 relative z-10">
          <div className="max-w-2xl">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-4"
              style={{ fontFamily: fontFamily.display, color: '#F4F7FA' }}>
              500+ Integrations
            </h1>
            <p className="text-xl sm:text-2xl font-medium mb-6"
              style={{ fontFamily: fontFamily.display, color: '#FF6A00' }}>
              Connects to the tools your business already uses.
            </p>
            <p className="text-base sm:text-lg mb-8 leading-relaxed max-w-xl"
              style={{ fontFamily: fontFamily.body, color: '#9FB0C3' }}>
              Connect your CRM, accounting, email and HR tools to give BIQc the full picture. All data is Australian-hosted, encrypted at rest, and read-only — you can revoke access at any time.
            </p>
            <div className="flex flex-wrap gap-3">
              <a href="#integrations-grid"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110"
                style={{ background: '#FF6A00', fontFamily: fontFamily.body, boxShadow: '0 6px 24px rgba(255,106,0,0.28)' }}>
                Connect Now <ArrowRight className="w-4 h-4" />
              </a>
              <Link to="/trust"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl text-sm font-semibold transition-all hover:bg-white/5"
                style={{ border: '1px solid rgba(255,255,255,0.15)', color: '#9FB0C3', fontFamily: fontFamily.body }}>
                <Shield className="w-4 h-4" /> Security & Privacy
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── FILTER CHIPS + GRID ── */}
      <section id="integrations-grid" className="py-14 px-4 sm:px-6"
        style={{ background: '#0F1720' }} data-testid="integrations-grid">
        <div className="max-w-6xl mx-auto">

          {/* Filter chips */}
          <div className="flex flex-wrap gap-2 mb-8" role="group" aria-label="Filter integrations by category">
            {FILTERS.map(f => (
              <div key={f.id} className="relative flex items-center">
                <button
                  onClick={() => setActiveFilter(f.id)}
                  className="px-4 py-2 rounded-full text-xs font-semibold transition-all"
                  style={{
                    background: activeFilter === f.id ? '#FF6A00' : '#141C26',
                    color: activeFilter === f.id ? '#FFFFFF' : '#9FB0C3',
                    border: `1px solid ${activeFilter === f.id ? '#FF6A00' : '#243140'}`,
                    fontFamily: fontFamily.mono,
                  }}
                  aria-pressed={activeFilter === f.id}
                >
                  {f.label}
                </button>
                <Tooltip text={f.tooltip} />
              </div>
            ))}
          </div>

          {/* Active category tooltip hint */}
          {activeCatTooltip && (
            <div className="flex items-start gap-2 mb-6 p-3 rounded-xl text-xs"
              style={{ background: 'rgba(255,106,0,0.06)', border: '1px solid rgba(255,106,0,0.15)', color: '#9FB0C3', fontFamily: fontFamily.body, maxWidth: 480 }}>
              <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: '#FF6A00' }} />
              {activeCatTooltip}
            </div>
          )}

          <div className="mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em]" style={{ color: '#F4F7FA', fontFamily: fontFamily.mono }}>
              Available integrations
            </h2>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((integration, i) => (
              <IntegrationCard key={integration.id} integration={integration} index={i} />
            ))}
          </div>

          {!activeFilter || activeFilter === 'all' ? (
            <div className="mt-10" data-testid="integrations-coming-soon-section">
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em]" style={{ color: '#F4F7FA', fontFamily: fontFamily.mono }}>
                Coming soon
              </h2>
              <p className="mt-2 text-xs" style={{ color: '#9FB0C3', fontFamily: fontFamily.body }}>
                Planned connectors currently in rollout.
              </p>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {COMING_SOON_INTEGRATIONS.map((integration, i) => (
                  <IntegrationCard key={integration.id} integration={integration} index={i} comingSoon />
                ))}
              </div>
            </div>
          ) : null}

          {/* Custom API callout */}
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: Code, label: 'Open API', desc: 'Connect any REST or GraphQL API' },
              { icon: Webhook, label: 'Webhooks', desc: 'Real-time events from supported connectors' },
              { icon: FileSpreadsheet, label: 'CSV Import', desc: 'Bulk import structured data' },
              { icon: Globe, label: 'Custom Sync', desc: 'Encrypted, role-based data sync' },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 p-4 rounded-xl"
                style={{ background: '#141C26', border: '1px solid #243140' }}>
                <item.icon className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#FF6A00' }} />
                <div>
                  <p className="text-xs font-semibold mb-0.5" style={{ color: '#F4F7FA', fontFamily: fontFamily.mono }}>{item.label}</p>
                  <p className="text-xs" style={{ color: '#64748B', fontFamily: fontFamily.body }}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECURE & UNIFIED ── */}
      <section className="py-14 px-4 sm:px-6" style={{ background: '#07121E' }} data-testid="integrations-security">
        <div className="max-w-4xl mx-auto text-center">
          <span className="text-xs font-semibold tracking-widest uppercase mb-4 block"
            style={{ fontFamily: fontFamily.mono, color: '#FF6A00' }}>
            Secure & Unified
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold mb-4"
            style={{ fontFamily: fontFamily.display, color: '#F4F7FA' }}>
            Your data stays yours — always.
          </h2>
          <p className="text-base mb-10 max-w-2xl mx-auto" style={{ color: '#9FB0C3', fontFamily: fontFamily.body }}>
            Integrations are routed through supported connector layers with audit trails and revocation controls. Processing location may vary by enabled provider.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { icon: Lock,         title: 'AES-256 Encrypted',      desc: 'All data encrypted at rest and in transit with military-grade AES-256 encryption.' },
              { icon: Shield,       title: 'Australian Data Residency', desc: 'Core platform data is hosted in Australian infrastructure with transparent provider processing disclosures.' },
              { icon: RefreshCw,    title: 'Revoke Anytime',          desc: 'Disconnect any integration instantly. Your data is purged within 24 hours.' },
            ].map((item, i) => (
              <div key={i} className="flex flex-col items-center text-center gap-3 p-6 rounded-2xl"
                style={{ background: '#141C26', border: '1px solid #243140' }}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(255,106,0,0.08)', border: '1px solid rgba(255,106,0,0.15)' }}>
                  <item.icon className="w-5 h-5" style={{ color: '#FF6A00' }} />
                </div>
                <p className="text-sm font-bold" style={{ color: '#F4F7FA', fontFamily: fontFamily.display }}>{item.title}</p>
                <p className="text-xs leading-relaxed" style={{ color: '#9FB0C3', fontFamily: fontFamily.body }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-14 px-6 text-center" style={{ background: '#0F1720' }}>
        <div className="max-w-lg mx-auto">
          <h2 className="text-2xl font-bold mb-3" style={{ fontFamily: fontFamily.display, color: '#F4F7FA' }}>
            Ready to unify your business?
          </h2>
          <p className="text-sm mb-6" style={{ color: '#9FB0C3', fontFamily: fontFamily.body }}>
            Connect your first system in under 30 seconds. No credit card required.
          </p>
          <Link to="/register-supabase?source=integrations-page"
            className="inline-flex items-center gap-2 px-10 py-3.5 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110"
            style={{ background: 'linear-gradient(135deg, #FF6A00, #E55F00)', fontFamily: fontFamily.body, boxShadow: '0 6px 24px rgba(255,106,0,0.28)' }}
            data-testid="integrations-final-cta">
            Start Free — Connect Now <ArrowRight className="w-4 h-4" />
          </Link>
          <p className="text-xs mt-4" style={{ color: '#4A5568', fontFamily: fontFamily.mono }}>
            Read-only access · Australian hosted · Revoke anytime
          </p>
        </div>
      </section>
    </WebsiteLayout>
  );
};

export default IntegrationsPage;
