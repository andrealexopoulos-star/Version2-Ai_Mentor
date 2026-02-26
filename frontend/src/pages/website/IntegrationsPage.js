import React from 'react';
import { Link } from 'react-router-dom';
import WebsiteLayout from '../../components/website/WebsiteLayout';
import { ArrowRight, Shield, Lock, Eye, RefreshCw, X, Globe, Webhook, FileSpreadsheet, Code } from 'lucide-react';

const HEADING = "'Cormorant Garamond', Georgia, serif";
const MONO = "'JetBrains Mono', monospace";
const BODY = "'Inter', sans-serif";

const integrationGroups = [
  {
    category: 'Accounting',
    items: ['Xero', 'MYOB', 'QuickBooks'],
  },
  {
    category: 'CRM',
    items: ['HubSpot', 'Salesforce', 'Pipedrive'],
  },
  {
    category: 'Payments',
    items: ['Stripe', 'Square', 'PayPal'],
  },
  {
    category: 'Ecommerce',
    items: ['Shopify', 'WooCommerce'],
  },
  {
    category: 'Communication',
    items: ['Slack', 'Microsoft Teams', 'Google Workspace', 'Outlook'],
  },
  {
    category: 'HR & Payroll',
    items: ['Deputy', 'Employment Hero', 'ADP'],
  },
];

const customAPIs = [
  { icon: Code, label: 'Open API Support', desc: 'Connect any platform with a REST or GraphQL API' },
  { icon: Webhook, label: 'Webhook Ingestion', desc: 'Receive real-time events from any system' },
  { icon: FileSpreadsheet, label: 'CSV Ingestion', desc: 'Bulk import structured data from spreadsheets' },
  { icon: Globe, label: 'Secure Data Sync', desc: 'Encrypted, role-based continuous synchronisation' },
];

const IntegrationsPage = () => (
  <WebsiteLayout>
    {/* HERO */}
    <section className="relative overflow-hidden" data-testid="integrations-hero">
      <div className="absolute bottom-0 right-0 w-[500px] h-[400px] rounded-full opacity-[0.05]" style={{ background: 'radial-gradient(circle, #FF6A00 0%, transparent 70%)' }} />
      <div className="max-w-5xl mx-auto px-6 pt-24 pb-20 relative z-10">
        <div className="max-w-3xl">
          <span className="text-xs font-medium tracking-widest uppercase text-[#FF6A00] mb-6 block" style={{ fontFamily: MONO }}>Integrations</span>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-[1.2] mb-6 tracking-tight" style={{ fontFamily: HEADING, color: '#FFFFFF' }}>
            Connect Any Platform.<br /><span style={{ color: '#FF6A00' }}>Gain Total Business Context.</span>
          </h1>
          <p className="text-lg text-[#9FB0C3] mb-8 leading-relaxed max-w-xl" style={{ fontFamily: BODY }}>
            BIQc integrates with virtually any system that has an API, data export, webhook, or secure connection capability. Your entire business, unified.
          </p>
        </div>
      </div>
    </section>

    {/* SUPPORTED INTEGRATIONS */}
    <section className="py-24" style={{ background: '#141C26' }} data-testid="integration-grid">
      <div className="max-w-5xl mx-auto px-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-[2px]" style={{ background: '#FF6A00' }} />
          <span className="text-xs font-medium tracking-widest uppercase text-[#FF6A00]" style={{ fontFamily: MONO }}>Supported Integrations</span>
        </div>
        <h2 className="text-3xl font-bold mb-12" style={{ fontFamily: HEADING, color: '#FFFFFF' }}>Direct integrations with the platforms you already use.</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {integrationGroups.map((group) => (
            <div key={group.category} className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <h3 className="text-xs font-semibold tracking-widest uppercase text-[#FF6A00]/70 mb-5" style={{ fontFamily: MONO }}>{group.category}</h3>
              <div className="space-y-2">
                {group.items.map((name) => (
                  <div key={name} className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all group cursor-default hover:bg-[#FF6A00]/5" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all" style={{ background: 'rgba(159,176,195,0.08)' }}>
                      <span className="text-xs font-bold text-[#9FB0C3] group-hover:text-[#FF6A00] transition-colors" style={{ fontFamily: MONO }}>{name.charAt(0)}</span>
                    </div>
                    <span className="text-sm font-medium text-[#F4F7FA] group-hover:text-white" style={{ fontFamily: HEADING, color: '#FFFFFF' }}>{name}</span>
                    <div className="ml-auto w-2 h-2 rounded-full bg-green-500/50 group-hover:bg-green-500 transition-colors" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Custom APIs */}
        <div className="mt-10">
          <h3 className="text-xs font-semibold tracking-widest uppercase text-[#FF6A00]/70 mb-5" style={{ fontFamily: MONO }}>Custom & Open APIs</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {customAPIs.map((api) => (
              <div key={api.label} className="rounded-xl p-5 transition-all hover:border-[#FF6A00]/20" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <api.icon className="w-5 h-5 text-[#FF6A00] mb-3" />
                <h4 className="text-sm font-semibold mb-1" style={{ fontFamily: HEADING, color: '#FFFFFF' }}>{api.label}</h4>
                <p className="text-xs text-[#9FB0C3]" style={{ fontFamily: BODY }}>{api.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>

    {/* HOW INTEGRATION WORKS */}
    <section className="py-24" data-testid="how-integration-works">
      <div className="max-w-5xl mx-auto px-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-[2px]" style={{ background: '#FF6A00' }} />
          <span className="text-xs font-medium tracking-widest uppercase text-[#FF6A00]" style={{ fontFamily: MONO }}>How Integration Works</span>
        </div>
        <h2 className="text-3xl font-bold mb-12" style={{ fontFamily: HEADING, color: '#FFFFFF' }}>Enterprise-grade security. Zero complexity.</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            { icon: Lock, title: 'Secure OAuth Connection', desc: 'Industry-standard authentication. Your credentials never touch our servers.' },
            { icon: Shield, title: 'Encrypted Data Ingestion', desc: 'All data encrypted in transit (TLS 1.3) and at rest (AES-256). Zero plain-text storage.' },
            { icon: Eye, title: 'Role-Based Access', desc: 'Granular permissions control. Define exactly what BIQc can access per platform.' },
            { icon: RefreshCw, title: 'Continuous Sync', desc: 'Real-time data synchronisation. Always current, always accurate.' },
            { icon: X, title: 'No Data Resale', desc: 'Your data is yours. It is never sold, shared, or used for training purposes.' },
            { icon: X, title: 'No Data Scraping', desc: 'BIQc only accesses data you explicitly authorise. No background harvesting.' },
          ].map((item, i) => (
            <div key={i} className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <item.icon className="w-5 h-5 text-[#FF6A00] mb-3" />
              <h3 className="text-base font-semibold mb-2" style={{ fontFamily: HEADING, color: '#FFFFFF' }}>{item.title}</h3>
              <p className="text-sm text-[#9FB0C3] leading-relaxed" style={{ fontFamily: BODY }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* DATA CONTROL */}
    <section className="py-20" style={{ background: '#141C26' }} data-testid="data-control">
      <div className="max-w-3xl mx-auto px-6">
        <div className="rounded-2xl p-8 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,106,0,0.15)' }}>
          <Shield className="w-8 h-8 text-[#FF6A00] mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-6" style={{ fontFamily: HEADING, color: '#FFFFFF' }}>Your Data. Your Control.</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { title: 'You Own Your Data', desc: 'All business data remains your intellectual property. Always.' },
              { title: 'Revoke Anytime', desc: 'Disconnect any integration instantly. Data removed within 24 hours.' },
              { title: 'Transparent Permissions', desc: 'Clear visibility into exactly what data BIQc accesses and why.' },
            ].map((item) => (
              <div key={item.title}>
                <h4 className="text-sm font-semibold mb-1 text-[#FF6A00]" style={{ fontFamily: HEADING, color: '#FFFFFF' }}>{item.title}</h4>
                <p className="text-xs text-[#9FB0C3]" style={{ fontFamily: BODY }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>

    {/* CTA */}
    <section className="py-20">
      <div className="max-w-3xl mx-auto px-6 text-center">
        <h2 className="text-3xl font-bold mb-4" style={{ fontFamily: HEADING, color: '#FFFFFF' }}>Connect your first platform in <span style={{ color: '#FF6A00' }}>under 2 minutes.</span></h2>
        <Link to="/register-supabase" className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-base font-semibold text-white mt-4" style={{ background: 'linear-gradient(135deg, #FF6A00, #E85D00)', fontFamily: HEADING, boxShadow: '0 8px 32px rgba(255,106,0,0.3)' }}>
          Try It For Free <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </section>
  </WebsiteLayout>
);

export default IntegrationsPage;
