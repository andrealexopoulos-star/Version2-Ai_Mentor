import React from 'react';
import { Link } from 'react-router-dom';
import WebsiteLayout from '../../components/website/WebsiteLayout';
import { Shield, Lock, Server, Eye, FileText, ArrowRight, CheckCircle } from 'lucide-react';
import { fontFamily } from '../../design-system/tokens';


const legalDocs = [
  { icon: FileText, title: 'Terms & Conditions', path: '/trust/terms', summary: 'Governs your use of BIQc services, subscription terms, responsibilities, and dispute resolution procedures.' },
  { icon: Eye, title: 'Privacy Policy', path: '/trust/privacy', summary: 'Details how we collect, use, store, and protect your personal and business information under Australian privacy law.' },
  { icon: Lock, title: 'Data Processing Agreement', path: '/trust/dpa', summary: 'Defines the terms under which BIQc processes your business data, data controller/processor responsibilities, and sub-processor disclosures.' },
  { icon: Server, title: 'Security & Infrastructure', path: '/trust/security', summary: 'Technical overview of our security architecture, encryption standards, access controls, and incident response procedures.' },
  { icon: Shield, title: 'Trust Centre', path: '/trust/centre', summary: 'Central hub for all compliance certifications, audit reports, uptime status, and data sovereignty documentation.' },
];

const TrustLandingPage = () => (
  <WebsiteLayout>
    {/* HERO */}
    <section className="relative overflow-hidden" data-testid="trust-hero">
      <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[500px] h-[400px] rounded-full opacity-[0.05]" style={{ background: 'radial-gradient(circle, #FF6A00 0%, transparent 70%)' }} />
      <div className="max-w-5xl mx-auto px-6 pt-24 pb-20 relative z-10 text-center">
        <span className="text-xs font-medium tracking-widest uppercase text-[#FF6A00] mb-6 block" style={{ fontFamily: fontFamily.mono }}>Trust & Security</span>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-[1.2] mb-6 tracking-tight" style={{ fontFamily: fontFamily.displayING, color: '#FFFFFF' }}>
          Built for Businesses That Take<br /><span style={{ color: '#FF6A00' }}>Data Seriously.</span>
        </h1>
        <p className="text-lg text-[#9FB0C3] max-w-xl mx-auto" style={{ fontFamily: fontFamily.body }}>
          Australian sovereign hosting. Enterprise-grade security. Full transparency.
        </p>
      </div>
    </section>

    {/* AUSTRALIAN SOVEREIGN */}
    <section className="py-20" style={{ background: '#141C26' }} data-testid="sovereign-section">
      <div className="max-w-5xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-[2px]" style={{ background: '#FF6A00' }} />
              <span className="text-xs font-medium tracking-widest uppercase text-[#FF6A00]" style={{ fontFamily: fontFamily.mono }}>Australian Sovereign Hosting</span>
            </div>
            <h2 className="text-3xl font-bold mb-4" style={{ fontFamily: fontFamily.displayING, color: '#FFFFFF' }}>Australian-hosted data, transparent processing.</h2>
            <p className="text-base text-[#9FB0C3] mb-6 leading-relaxed" style={{ fontFamily: fontFamily.body }}>
              All data is hosted in Australian infrastructure. Some integrated providers may process limited data outside Australia depending on enabled services. Full compliance with Australian privacy law remains mandatory.
            </p>
            <div className="space-y-3">
              {['Sydney-based data centres', 'Australian-owned infrastructure', 'Compliant with the Privacy Act 1988', 'Sub-processor transparency', 'Data sovereignty controls by design'].map((item) => (
                <div key={item} className="flex items-center gap-2.5">
                  <CheckCircle className="w-4 h-4 text-[#10B981] shrink-0" />
                  <span className="text-sm text-[#9FB0C3]" style={{ fontFamily: fontFamily.body }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-center">
            <div className="w-48 h-48 rounded-full flex items-center justify-center" style={{ background: 'radial-gradient(circle at 35% 35%, #1E2A3A, #0F1720)', border: '2px solid rgba(255,106,0,0.2)', boxShadow: '0 0 60px rgba(255,106,0,0.1)' }}>
              <div className="text-center">
                <Shield className="w-10 h-10 text-[#FF6A00] mx-auto mb-2" />
                <span className="text-xs text-[#9FB0C3]/60 block" style={{ fontFamily: fontFamily.mono }}>Sovereign</span>
                <span className="text-xs text-[#9FB0C3]/60 block" style={{ fontFamily: fontFamily.mono }}>Hosting</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    {/* SECURITY INFRASTRUCTURE */}
    <section className="py-20" data-testid="security-section">
      <div className="max-w-5xl mx-auto px-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-[2px]" style={{ background: '#FF6A00' }} />
          <span className="text-xs font-medium tracking-widest uppercase text-[#FF6A00]" style={{ fontFamily: fontFamily.mono }}>Security Infrastructure</span>
        </div>
        <h2 className="text-3xl font-bold mb-10" style={{ fontFamily: fontFamily.displayING, color: '#FFFFFF' }}>Enterprise-grade by default.</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            { icon: Lock, title: 'Encryption at Rest', desc: 'AES-256 encryption for all stored data. Keys rotated automatically.' },
            { icon: Shield, title: 'Encryption in Transit', desc: 'TLS 1.3 for all communications. No plain-text data transmission.' },
            { icon: Eye, title: 'Access Controls', desc: 'Role-based access, MFA enforcement, and session management.' },
            { icon: FileText, title: 'Audit Logs', desc: 'Complete audit trail of all data access, modifications, and system events.' },
          ].map((item, i) => (
            <div key={i} className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <item.icon className="w-5 h-5 text-[#FF6A00] mb-4" />
              <h3 className="text-sm font-semibold mb-2" style={{ fontFamily: fontFamily.displayING, color: '#FFFFFF' }}>{item.title}</h3>
              <p className="text-xs text-[#9FB0C3] leading-relaxed" style={{ fontFamily: fontFamily.body }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* LEGAL & GOVERNANCE */}
    <section className="py-20" style={{ background: '#141C26' }} data-testid="legal-section">
      <div className="max-w-5xl mx-auto px-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-[2px]" style={{ background: '#FF6A00' }} />
          <span className="text-xs font-medium tracking-widest uppercase text-[#FF6A00]" style={{ fontFamily: fontFamily.mono }}>Legal & Governance</span>
        </div>
        <h2 className="text-3xl font-bold mb-10" style={{ fontFamily: fontFamily.displayING, color: '#FFFFFF' }}>Full transparency. No ambiguity.</h2>

        <div className="space-y-4">
          {legalDocs.map((doc) => (
            <Link key={doc.path} to={doc.path} className="flex items-center gap-5 rounded-2xl p-6 transition-all hover:border-[#FF6A00]/20 group" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }} data-testid={`trust-link-${doc.title.toLowerCase().replace(/\s+/g,'-')}`}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(255,106,0,0.1)' }}>
                <doc.icon className="w-5 h-5 text-[#FF6A00]" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold mb-1 group-hover:text-[#FF6A00] transition-colors" style={{ fontFamily: fontFamily.displayING, color: '#FFFFFF' }}>{doc.title}</h3>
                <p className="text-sm text-[#9FB0C3] leading-relaxed" style={{ fontFamily: fontFamily.body }}>{doc.summary}</p>
              </div>
              <ArrowRight className="w-5 h-5 text-[#9FB0C3]/30 group-hover:text-[#FF6A00] transition-colors shrink-0" />
            </Link>
          ))}
        </div>
      </div>
    </section>
  </WebsiteLayout>
);

export default TrustLandingPage;
