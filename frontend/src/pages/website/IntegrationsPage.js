import React from 'react';
import { Link } from 'react-router-dom';
import WebsiteLayout from '../../components/website/WebsiteLayout';
/* design tokens consumed via CSS custom properties — see liquid-steel-tokens.css */


// ── Integration catalogue organised by category (matches mockup exactly) ─────
const CATEGORIES = [
  {
    id: 'email-calendar',
    title: 'Email & Calendar',
    integrations: [
      { name: 'Outlook',   initial: 'O', desc: 'Microsoft 365 inbox, calendar, and contacts via OAuth. Full read access for intelligence signals.', status: 'available' },
      { name: 'Gmail',     initial: 'G', desc: 'Google Workspace inbox with read-only access. Scans threads for sentiment and escalation risk.', status: 'available' },
    ],
  },
  {
    id: 'crm-sales',
    title: 'CRM & Sales',
    integrations: [
      { name: 'HubSpot',       initial: 'H', desc: 'Deals, contacts, companies, and pipelines. Full bi-directional sync via Merge.', status: 'available' },
      { name: 'Salesforce',    initial: 'S', desc: 'Sales Cloud and Service Cloud with custom object support. Sandbox-aware.', status: 'available' },
      { name: 'Pipedrive',     initial: 'P', desc: 'Activities, deals, and persons. Popular CRM for hands-on SMBs.', status: 'available' },
      { name: 'Zoho CRM',     initial: 'Z', desc: 'Modules, leads, deals, and custom fields. Multi-org supported.', status: 'available' },
      { name: 'Copper',       initial: 'C', desc: 'Google-native CRM with full pipeline visibility via Merge.', status: 'available' },
      { name: 'Freshsales',   initial: 'F', desc: 'Freshworks CRM. Contacts, deals, accounts, and sequences.', status: 'available' },
      { name: 'Close',        initial: 'C', desc: 'Built for inside sales teams. Leads, opportunities, and call logs synced.', status: 'available' },
      { name: 'Insightly',    initial: 'I', desc: 'CRM and project management. Contacts, opportunities, and projects.', status: 'available' },
      { name: 'Nutshell',     initial: 'N', desc: 'Simple CRM for growing teams. Pipeline and contact management.', status: 'available' },
      { name: 'Keap',         initial: 'K', desc: 'Sales and marketing automation for small businesses. Contacts and deals.', status: 'available' },
      { name: 'Teamwork CRM', initial: 'T', desc: 'Pipeline management integrated with Teamwork project tools.', status: 'available' },
      { name: 'Monday CRM',   initial: 'M', desc: 'monday.com CRM workspace. Deals, leads, and activity tracking.', status: 'available' },
    ],
  },
  {
    id: 'accounting-finance',
    title: 'Accounting & Finance',
    integrations: [
      { name: 'Xero',       initial: 'X', desc: 'Invoices, bills, and bank feeds. Native ABN and GST handling for Australian businesses.', status: 'available' },
      { name: 'MYOB',       initial: 'M', desc: 'MYOB Business and AccountRight. Stable connector for Australian SMBs.', status: 'available' },
      { name: 'QuickBooks',  initial: 'Q', desc: 'Online and Desktop editions. Same cash analysis on either backend.', status: 'available' },
      { name: 'FreshBooks',  initial: 'F', desc: 'Time-tracking and invoicing for service businesses.', status: 'available' },
      { name: 'Wave',        initial: 'W', desc: 'Free accounting software. Invoicing, receipts, and financial reports.', status: 'available' },
      { name: 'Sage',        initial: 'S', desc: 'Sage Business Cloud, Sage 50, and Sage Intacct. All variants normalised.', status: 'available' },
      { name: 'NetSuite',    initial: 'N', desc: 'Oracle NetSuite ERP. For SMBs that have scaled up.', status: 'available' },
      { name: 'Zoho Books',  initial: 'Z', desc: "Zoho's accounting platform. Invoices, expenses, and inventory.", status: 'available' },
    ],
  },
  {
    id: 'communications',
    title: 'Communications',
    integrations: [
      { name: 'Slack',            initial: 'S', desc: 'Channel and DM presence. Detect team strain when after-hours messages spike.', status: 'available' },
      { name: 'Microsoft Teams',  initial: 'T', desc: 'Same signal grouping as Slack. Detects always-on patterns in DMs and channels.', status: 'available' },
    ],
  },
  {
    id: 'calendar',
    title: 'Calendar',
    integrations: [
      { name: 'Google Calendar',            initial: 'G', desc: 'Spots meeting overload, deep-work erosion, and quarter-end velocity drops.', status: 'available' },
      { name: 'Microsoft Outlook Calendar', initial: 'O', desc: 'Microsoft Graph calendar integration with the same intelligence signals.', status: 'available' },
    ],
  },
  {
    id: 'marketing',
    title: 'Marketing',
    integrations: [
      { name: 'Mailchimp',        initial: 'M', desc: 'Lists, campaigns, sends, and opens. Correlate campaign drops with pipeline drift.', status: 'available' },
      { name: 'HubSpot Marketing', initial: 'H', desc: 'Marketing automation, email campaigns, and landing page analytics.', status: 'available' },
      { name: 'ActiveCampaign',   initial: 'A', desc: 'Automations, deal pipelines, and contact scoring.', status: 'available' },
      { name: 'Constant Contact', initial: 'C', desc: 'Email marketing and event management for small businesses.', status: 'available' },
      { name: 'SendGrid',         initial: 'S', desc: 'Transactional and marketing email delivery. Send volume and deliverability signals.', status: 'available' },
    ],
  },
  {
    id: 'helpdesk',
    title: 'Helpdesk',
    integrations: [
      { name: 'Zendesk',                  initial: 'Z', desc: 'Tickets, satisfaction scores, and agent load. Customer health in one alert.', status: 'available' },
      { name: 'Freshdesk',                initial: 'F', desc: 'Freshworks helpdesk. Standard ticket and agent normalisation.', status: 'available' },
      { name: 'Intercom',                 initial: 'I', desc: 'Conversations, response times, and NPS. Detects churn risk in language patterns.', status: 'available' },
      { name: 'Help Scout',               initial: 'H', desc: 'Shared inboxes, knowledge base, and customer satisfaction tracking.', status: 'available' },
      { name: 'Jira Service Management',  initial: 'J', desc: 'ITSM and customer service desk. Tickets, SLAs, and queue management.', status: 'available' },
      { name: 'ServiceNow',               initial: 'S', desc: 'Enterprise service management. Incidents, requests, and workflow automation.', status: 'available' },
    ],
  },
  {
    id: 'hr-payroll',
    title: 'HR & Payroll',
    integrations: [
      { name: 'Deputy',          initial: 'D', desc: 'Scheduling, timesheets, and leave management for shift-based teams.', status: 'available' },
      { name: 'Employment Hero', initial: 'E', desc: 'Australian HR and payroll platform. People, leave, and compliance.', status: 'available' },
      { name: 'Xero Payroll',    initial: 'X', desc: 'Payroll processing built into Xero. Payruns, leave, and superannuation.', status: 'available' },
      { name: 'KeyPay',          initial: 'K', desc: 'Cloud payroll for AU and NZ. Automated pay conditions and reporting.', status: 'available' },
      { name: 'Gusto',           initial: 'G', desc: 'US payroll, benefits, and HR. Headcount and payrun data.', status: 'available' },
      { name: 'BambooHR',        initial: 'B', desc: 'People, time off, and performance. Spots burnout patterns from leave data.', status: 'available' },
      { name: 'Workable',        initial: 'W', desc: 'Recruiting and applicant tracking. Pipeline and hiring velocity signals.', status: 'available' },
      { name: 'ADP',             initial: 'A', desc: 'Enterprise payroll and HR. Workforce data, payroll, and compliance.', status: 'available' },
      { name: 'Paylocity',       initial: 'P', desc: 'Payroll, HR, and workforce management for mid-market companies.', status: 'available' },
      { name: 'Deel',            initial: 'D', desc: 'Global contractors and EOR. International team management and payments.', status: 'available' },
    ],
  },
];


// ── Integration card (matches mockup: icon + status badge + name + desc + category badge) ──
const IntegrationCard = ({ integration, categoryTitle }) => (
  <div
    className="rounded-xl p-5 flex flex-col gap-2.5 transition-all duration-200 group"
    style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--r-lg)',
      boxShadow: 'var(--elev-1)',
    }}
    onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(140,170,210,0.25)'; }}
    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(140,170,210,0.12)'; }}
  >
    {/* Top row: icon + status badge */}
    <div className="flex items-center justify-between">
      <div
        className="w-10 h-10 rounded-[10px] flex items-center justify-center text-base font-bold flex-shrink-0"
        style={{ background: 'var(--canvas-app, #FAFAFA)', color: 'var(--ink-display)' }}
      >
        {integration.initial}
      </div>
      {integration.status === 'available' ? (
        <span
          className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
          style={{
            color: '#4ADE80',
            background: 'rgba(22,163,74,0.12)',
            border: '1px solid rgba(22,163,74,0.2)',
          }}
        >
          Available
        </span>
      ) : (
        <span
          className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
          style={{
            color: '#5C6E82',
            background: 'rgba(140,170,210,0.08)',
            border: '1px solid rgba(140,170,210,0.12)',
          }}
        >
          Coming Soon
        </span>
      )}
    </div>

    {/* Name */}
    <p className="text-base font-semibold" style={{ color: 'var(--ink-display)' }}>
      {integration.name}
    </p>

    {/* Description */}
    <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-secondary)' }}>
      {integration.desc}
    </p>

    {/* Category badge */}
    <span
      className="text-[11px] font-semibold rounded-full px-2.5 py-0.5 mt-1 w-fit"
      style={{ color: '#5C6E82', background: 'var(--canvas-app, #FAFAFA)' }}
    >
      {categoryTitle}
    </span>
  </div>
);


// ── Main page ────────────────────────────────────────────────────────────────
const IntegrationsPage = () => {
  return (
    <WebsiteLayout>
      {/* ── HERO (center-aligned, no CTA buttons) ── */}
      <section className="relative overflow-hidden" data-testid="integrations-hero"
        style={{
          background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(46,74,110,0.08) 0%, transparent 60%), linear-gradient(180deg, #FAFAFA 0%, var(--canvas-app, #FAFAFA) 100%)',
        }}>
        <div className="max-w-7xl mx-auto px-6 pt-20 pb-14 relative z-10 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold leading-tight mb-4"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--ink-display)', letterSpacing: 'var(--ls-display)' }}>
            Connect everything. Miss nothing.
          </h1>
          <p className="text-base sm:text-lg leading-relaxed mx-auto"
            style={{ fontFamily: 'var(--font-ui)', color: 'var(--ink-secondary)', maxWidth: 560 }}>
            BIQc connects to your existing tools through a unified integration layer &mdash; no custom setup required. One connection, every signal.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8 mt-8">
            <span className="text-[15px] font-semibold" style={{ color: 'var(--ink-display)' }}>40+ integrations</span>
            <span className="w-1 h-1 rounded-full" style={{ background: '#5C6E82' }} />
            <span className="text-[15px] font-semibold" style={{ color: 'var(--ink-display)' }}>8 categories</span>
            <span className="w-1 h-1 rounded-full" style={{ background: '#5C6E82' }} />
            <span className="text-[15px] font-semibold" style={{ color: 'var(--ink-display)' }}>5-minute setup</span>
          </div>
        </div>
      </section>

      {/* ── CATEGORY SECTIONS ── */}
      <div style={{ background: 'var(--canvas-app, #FAFAFA)' }} data-testid="integrations-grid">
        {CATEGORIES.map((cat) => (
          <section key={cat.id} className="pb-14 px-4 sm:px-6">
            <div className="max-w-7xl mx-auto">
              {/* Category header */}
              <div className="mb-6">
                <h2 className="text-2xl sm:text-[28px] font-semibold"
                  style={{ fontFamily: 'var(--font-display)', color: 'var(--ink-display)', letterSpacing: 'var(--ls-display)' }}>
                  {cat.title}{' '}
                  <span
                    className="inline-block text-xs font-semibold rounded-full px-3 py-0.5 ml-2 align-middle"
                    style={{ color: 'var(--ink-secondary)', background: 'var(--canvas-app, #FAFAFA)', border: '1px solid rgba(140,170,210,0.12)' }}
                  >
                    {cat.integrations.length} integration{cat.integrations.length !== 1 ? 's' : ''}
                  </span>
                </h2>
              </div>

              {/* Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {cat.integrations.map((integration) => (
                  <IntegrationCard
                    key={`${cat.id}-${integration.name}`}
                    integration={integration}
                    categoryTitle={cat.title}
                  />
                ))}
              </div>
            </div>
          </section>
        ))}
      </div>

      {/* ── MERGE.DEV BANNER ── */}
      <section className="pb-14 px-4 sm:px-6" style={{ background: 'var(--canvas-app, #FAFAFA)' }} data-testid="integrations-merge-banner">
        <div className="max-w-7xl mx-auto">
          <div className="rounded-2xl p-10 sm:p-14 grid grid-cols-1 lg:grid-cols-5 gap-10 items-center"
            style={{ background: 'var(--canvas-app, #FAFAFA)', border: '1px solid rgba(140,170,210,0.12)' }}>
            <div className="lg:col-span-3">
              <h3 className="text-2xl sm:text-[32px] font-bold leading-snug mb-3"
                style={{ fontFamily: 'var(--font-display)', color: 'var(--ink-display)', letterSpacing: 'var(--ls-display)' }}>
                One unified integration layer
              </h3>
              <p className="text-base leading-relaxed" style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-ui)' }}>
                BIQc uses a unified integration layer so you never wait for a custom connector. Add a system, sync starts in under 60 seconds, and BIQc picks up signals on the next cycle. One OAuth handshake connects your entire stack.
              </p>
            </div>
            <div className="lg:col-span-2 flex flex-row lg:flex-col gap-6 sm:gap-8">
              {[
                { num: '40+', label: 'Connectors live' },
                { num: '60s', label: 'Average sync handshake' },
                { num: 'OAuth', label: 'Secure per-connector' },
              ].map((stat) => (
                <div key={stat.label}>
                  <div className="text-[40px] font-bold leading-none"
                    style={{ fontFamily: 'var(--font-display)', color: '#E85D00' }}>
                    {stat.num}
                  </div>
                  <div className="text-[13px] font-medium mt-0.5" style={{ color: 'var(--ink-secondary)' }}>
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="pb-24 px-6 text-center" style={{ background: 'var(--canvas-app, #FAFAFA)' }}>
        <div className="max-w-xl mx-auto rounded-2xl p-14"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-lg)',
            boxShadow: 'var(--elev-1)',
          }}>
          <h2 className="text-[28px] font-semibold mb-3 tracking-tight"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--ink-display)' }}>
            Ready to connect your tools?
          </h2>
          <p className="text-base mb-7" style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-ui)' }}>
            Set up your first integration in under five minutes. No engineering required.
          </p>
          <Link to="/register-supabase?source=integrations-page"
            className="inline-flex items-center gap-2 px-7 py-3 text-[15px] font-semibold text-white transition-all hover:brightness-110"
            style={{ background: 'var(--lava)', borderRadius: 'var(--r-md)', fontFamily: 'var(--font-ui)' }}
            data-testid="integrations-final-cta">
            Start Your Trial
          </Link>
        </div>
      </section>
    </WebsiteLayout>
  );
};

export default IntegrationsPage;
