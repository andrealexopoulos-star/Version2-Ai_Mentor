import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield, Lock, Server, Globe, ChevronLeft, Check, Eye, Database, Scale } from 'lucide-react';
import { fontFamily } from '../design-system/tokens';

const AZURE = '#007AFF';
const MINT = '#00D995';
const SLATE = 'rgba(140,170,210,0.15)';
const MUTED = '#64748B';

const glass = { background: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.3)', boxShadow: '0 24px 48px -12px rgba(0,0,0,0.05)' };
const up = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.55 } } };
const stg = { visible: { transition: { staggerChildren: 0.08 } } };

const CARDS = [
  { icon: Globe, title: 'Australian Data Residency', desc: 'All data is hosted on encrypted Australian infrastructure with documented processing boundaries for enabled providers.', accent: AZURE },
  { icon: Lock, title: 'Zero-Leakage Guarantee', desc: 'BIQc uses private, containerised AI instances. Your strategic insights are never used to improve the general models used by your competitors. Siloed intelligence, permanently.', accent: MINT },
  { icon: Database, title: 'Ownership & Portability', desc: 'You own the intelligence. Complete data portability and 48-hour purge protocols. Export everything at any time. Delete your account and all data is permanently purged. No lock-in.', accent: AZURE },
  { icon: Shield, title: 'AES-256 Encryption', desc: 'Military-grade encryption at rest and in transit — the same standard used by the Australian Defence Force and Five Eyes intelligence alliance.', accent: MINT },
  { icon: Scale, title: 'Australian Privacy Principles', desc: 'Customer data handling is aligned to Australian Privacy Principles with contractual and technical controls across supported providers.', accent: AZURE },
  { icon: Eye, title: 'Minimal Collection', desc: 'BIQc observes patterns, not content. Intelligence signals extracted without storing raw email bodies or document contents. We see what matters, not what\'s private.', accent: MINT },
];

const TrustPage = () => {
  const nav = useNavigate();

  useEffect(() => {
    document.title = 'Trust & Data Sovereignty | BIQc - Australian Business Intelligence';
    const metas = [
      { name: 'description', content: 'BIQc provides all data hosted in Australian infrastructure, AES-256 encryption, and transparent provider processing controls aligned to Australian privacy requirements.' },
      { name: 'keywords', content: 'Australian data sovereignty, business data security Australia, AES-256 encryption, zero leakage AI, Australian Privacy Principles, data residency Australia, sovereign cloud Australia, business intelligence security, SME data protection' },
      { property: 'og:title', content: 'Trust & Data Sovereignty | BIQc' },
      { property: 'og:description', content: 'All data hosted in Australian infrastructure, AES-256 encryption, and transparent provider processing controls for business intelligence.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:title', content: 'Trust & Data Sovereignty | BIQc' },
      { name: 'twitter:description', content: 'All data hosted in Australian infrastructure, AES-256 encryption, and transparent provider processing controls aligned to Australian privacy requirements.' },
    ];
    const created = metas.map(attrs => {
      const el = document.createElement('meta');
      Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
      document.head.appendChild(el);
      return el;
    });
    return () => created.forEach(el => el.remove());
  }, []);

  return (
    <div className="min-h-screen bg-white relative" style={{ color: SLATE }}>
      <div className="fixed inset-0 pointer-events-none z-0" style={{ background: 'radial-gradient(ellipse at 85% -5%, #F0FFF4 0%, transparent 55%)' }} />

      <nav className="fixed top-0 inset-x-0 z-50 bg-white/80" style={{ backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-16 py-4 flex items-center justify-between">
          <button onClick={() => nav('/')} className="flex items-center gap-2 text-[13px] font-medium rounded-lg px-3 py-1.5 hover:bg-slate-50" style={{ color: MUTED, fontFamily: fontFamily.display }} data-testid="trust-back-btn">
            <ChevronLeft className="w-4 h-4" /> Back to BIQc
          </button>
          <button onClick={() => nav('/register-supabase')} className="text-[13px] font-semibold px-5 py-2.5 rounded-lg text-white" style={{ background: AZURE, fontFamily: fontFamily.display, boxShadow: '0 4px 14px rgba(0,122,255,0.25)' }} data-testid="trust-start-btn">Start Free</button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 pt-36 sm:pt-44 pb-20 px-6 lg:px-16" data-testid="trust-hero">
        <motion.div initial="hidden" animate="visible" variants={stg} className="max-w-3xl mx-auto text-center space-y-8">
          <motion.p variants={up} className="text-[11px] uppercase tracking-[0.3em] font-semibold" style={{ fontFamily: fontFamily.mono, color: AZURE }}>The Vault</motion.p>
          <motion.h1 variants={up} className="text-[2.6rem] sm:text-[3.2rem] font-semibold leading-[1.08] tracking-[-0.02em]" style={{ fontFamily: fontFamily.display }}>
            Trust & Security
          </motion.h1>
          <motion.p variants={up} className="text-base leading-[1.75] max-w-xl mx-auto" style={{ color: MUTED }}>
            Your business intelligence is sovereign. BIQc is built from the ground up as a Sovereign Intelligence Partner — not a data broker.
          </motion.p>
          <motion.div variants={up} className="inline-flex items-center gap-4 px-8 py-5 rounded-2xl" style={{ ...glass, boxShadow: '0 24px 48px -12px rgba(0,122,255,0.08)' }}>
            <Lock className="w-7 h-7" style={{ color: AZURE }} strokeWidth={1.5} />
            <div className="text-left">
              <p className="text-2xl font-bold tracking-wider" style={{ fontFamily: fontFamily.mono, color: AZURE }}>AES-256</p>
              <p className="text-[9px] tracking-[0.2em] uppercase font-medium" style={{ fontFamily: fontFamily.mono, color: MUTED }}>Military-Grade Encryption</p>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* Sovereignty + Siloed Intelligence */}
      <section className="relative z-10 py-20 px-6 lg:px-16" style={{ background: '#FAFCFE' }}>
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stg} className="max-w-4xl mx-auto space-y-8">
          <motion.div variants={up} className="rounded-2xl p-10" style={{ ...glass }}>
            <div className="flex items-start gap-6">
              <div className="w-1 self-stretch flex-shrink-0 rounded-full" style={{ background: `linear-gradient(${AZURE}, ${MINT})` }} />
              <div className="space-y-4">
                <h2 className="text-2xl sm:text-3xl font-semibold tracking-[-0.02em]" style={{ fontFamily: fontFamily.display }}>Your Business DNA is yours.</h2>
                <p className="text-sm leading-[1.8]" style={{ color: MUTED }}>
                  All data is hosted on encrypted Australian infrastructure. Enabled providers may process scoped data based on selected integrations and AI features.
                </p>
                <p className="text-sm leading-[1.8]" style={{ color: MUTED }}>
                  BIQc uses private, containerised AI instances. Your strategic insights are never used to improve the general models used by your competitors. What you build in BIQc stays in BIQc — permanently siloed, permanently yours.
                </p>
              </div>
            </div>
          </motion.div>
          <motion.div variants={up} className="rounded-2xl p-10" style={{ ...glass }}>
            <div className="flex items-start gap-6">
              <div className="w-1 self-stretch flex-shrink-0 rounded-full" style={{ background: AZURE }} />
              <div className="space-y-4">
                <h2 className="text-xl font-semibold tracking-[-0.02em]" style={{ fontFamily: fontFamily.display }}>Australian Jurisdiction, Australian Law</h2>
                <p className="text-sm leading-[1.8]" style={{ color: MUTED }}>
                  In the event of legal or compliance review, BIQc applies Australian privacy obligations and maintains documented sub-processor controls for enabled services.
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* Security Architecture Grid */}
      <section className="relative z-10 py-24 sm:py-32 px-6 lg:px-16" data-testid="trust-principles">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stg} className="max-w-6xl mx-auto">
          <motion.div variants={up} className="text-center mb-16">
            <p className="text-[11px] uppercase tracking-[0.25em] font-semibold mb-4" style={{ fontFamily: fontFamily.mono, color: AZURE }}>Security Architecture</p>
            <h2 className="text-[2rem] sm:text-[2.4rem] font-semibold tracking-[-0.02em]" style={{ fontFamily: fontFamily.display }}>Built for trust at every layer</h2>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {CARDS.map((c, i) => (
              <motion.div key={i} variants={up} className="p-7 rounded-2xl hover:translate-y-[-2px] transition-all" style={{ ...glass }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-5" style={{ background: `${c.accent}10` }}>
                  <c.icon className="w-5 h-5" style={{ color: c.accent }} strokeWidth={1.5} />
                </div>
                <h3 className="text-sm font-semibold mb-2 tracking-tight" style={{ fontFamily: fontFamily.display }}>{c.title}</h3>
                <p className="text-[12px] leading-relaxed" style={{ color: MUTED }}>{c.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* CTA */}
      <section className="relative z-10 py-20 px-6 lg:px-16" style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-[-0.02em]" style={{ fontFamily: fontFamily.display }}>Ready to deploy sovereign intelligence?</h2>
          <button onClick={() => nav('/register-supabase')} className="px-10 py-4 rounded-xl text-[13px] font-semibold inline-flex items-center gap-2 text-white" style={{ background: AZURE, fontFamily: fontFamily.display, boxShadow: '0 8px 24px rgba(0,122,255,0.25)' }} data-testid="trust-cta-deploy">
            Start Free Trial
          </button>
          <p className="text-[10px] tracking-[0.1em] uppercase font-medium" style={{ fontFamily: fontFamily.mono, color: '#94A3B8' }}>Australian owned · Australian hosted · Your data, your sovereignty</p>
        </div>
      </section>

      <footer className="relative z-10 py-8 px-6 lg:px-16" style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
        <p className="text-center text-[11px]" style={{ color: '#94A3B8', fontFamily: fontFamily.mono }}>&copy; 2026 BIQc — Business IQ Centre. Powered by Business Intelligence Quotient Centre.</p>
      </footer>
    </div>
  );
};

export default TrustPage;
