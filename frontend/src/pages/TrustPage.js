import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, Lock, Server, Globe, ChevronLeft, Check, Eye } from 'lucide-react';

const BG = '#050505';
const BG2 = '#0a0a0a';
const BG3 = '#111111';
const CYAN = '#00F5FF';
const CYAN_DIM = 'rgba(0,245,255,0.08)';
const HEAD = "'Inter Tight', sans-serif";
const MONO = "'Geist Mono', monospace";

const up = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0, transition: { duration: 0.6 } } };
const stg = { visible: { transition: { staggerChildren: 0.1 } } };

const CARDS = [
  { icon: Lock, title: 'AES-256 Encryption', desc: 'All data encrypted at rest and in transit using AES-256 — the same standard used by the Australian Defence Force and Five Eyes intelligence alliance.' },
  { icon: Globe, title: 'Australian Data Residency', desc: 'Your business data never leaves Australian jurisdiction. All processing, storage, and backups occur within sovereign Australian data centres.' },
  { icon: Shield, title: 'Zero-Trust Architecture', desc: 'Every API call authenticated and authorised. No implicit trust between services. Role-based access control enforced at every layer.' },
  { icon: Server, title: 'SOC 2 Aligned', desc: 'Security practices align with SOC 2 Type II standards for availability, security, processing integrity, and confidentiality.' },
  { icon: Eye, title: 'Minimal Data Collection', desc: 'BIQc observes patterns, not content. Intelligence signals extracted without storing raw email bodies or document contents.' },
  { icon: Check, title: 'You Own Your Data', desc: 'Export everything at any time. Delete your account and all associated data is permanently purged within 48 hours. No lock-in.' },
];

const TrustPage = () => {
  const nav = useNavigate();
  return (
    <div className="min-h-screen" style={{ background: BG, color: '#fff' }}>

      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50" style={{ background: 'rgba(5,5,5,0.9)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-16 py-4 flex items-center justify-between">
          <button onClick={() => nav('/')} className="flex items-center gap-2 text-[13px] font-medium" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: HEAD }} data-testid="trust-back-btn">
            <ChevronLeft className="w-4 h-4" /> Back to BIQc
          </button>
          <button onClick={() => nav('/register-supabase')} className="text-[13px] font-bold px-5 py-2" style={{ background: CYAN, color: BG, fontFamily: HEAD }} data-testid="trust-start-btn">
            Start Free
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-36 sm:pt-44 pb-24 px-6 lg:px-16" data-testid="trust-hero">
        <motion.div initial="hidden" animate="visible" variants={stg} className="max-w-3xl mx-auto text-center space-y-8">
          <motion.p variants={up} className="text-[10px] uppercase tracking-[0.3em]" style={{ fontFamily: MONO, color: CYAN }}>The Vault</motion.p>
          <motion.h1 variants={up} className="text-[3rem] sm:text-[4rem] font-black leading-[0.95] tracking-tight" style={{ fontFamily: HEAD }}>
            Trust & Security
          </motion.h1>
          <motion.p variants={up} className="text-base leading-relaxed max-w-xl mx-auto" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Your business intelligence is sovereign. BIQc is built from the ground up with Australian data residency, military-grade encryption, and zero-trust principles.
          </motion.p>
          <motion.div variants={up} className="inline-flex items-center gap-4 px-8 py-5 rounded-md" style={{ background: BG2, border: '1px solid rgba(0,245,255,0.15)', boxShadow: '0 0 60px -15px rgba(0,245,255,0.15)' }}>
            <Lock className="w-7 h-7" style={{ color: CYAN }} strokeWidth={1.5} />
            <div className="text-left">
              <p className="text-2xl font-black tracking-wider" style={{ fontFamily: MONO, color: CYAN }}>AES-256</p>
              <p className="text-[9px] tracking-[0.2em] uppercase" style={{ fontFamily: MONO, color: 'rgba(255,255,255,0.25)' }}>Military-Grade Encryption</p>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* Sovereignty */}
      <section className="py-20 px-6 lg:px-16" style={{ background: BG2, borderTop: '1px solid rgba(0,245,255,0.06)', borderBottom: '1px solid rgba(0,245,255,0.06)' }}>
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stg} className="max-w-3xl mx-auto">
          <motion.div variants={up} className="flex items-start gap-6">
            <div className="w-1 self-stretch flex-shrink-0 rounded-full" style={{ background: CYAN }} />
            <div className="space-y-4">
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight" style={{ fontFamily: HEAD }}>Australian Data Sovereignty</h2>
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
                BIQc is Australian-owned and operated. All business data is processed and stored exclusively within Australian data centres. We do not transfer, mirror, or replicate your data to any offshore jurisdiction — ever.
              </p>
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
                This isn't a compliance checkbox. It's a foundational design principle. Your business intelligence belongs to you, protected by Australian law.
              </p>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* Security Grid */}
      <section className="py-28 sm:py-36 px-6 lg:px-16" data-testid="trust-principles">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stg} className="max-w-6xl mx-auto">
          <motion.div variants={up} className="text-center mb-16">
            <p className="text-[10px] uppercase tracking-[0.25em] mb-4" style={{ fontFamily: MONO, color: CYAN }}>Security Architecture</p>
            <h2 className="text-[2rem] sm:text-[2.5rem] font-extrabold tracking-tight" style={{ fontFamily: HEAD }}>Built for trust at every layer</h2>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {CARDS.map((c, i) => (
              <motion.div key={i} variants={up} className="p-7 rounded-md" style={{ background: BG3, border: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="w-9 h-9 rounded-md flex items-center justify-center mb-5" style={{ background: CYAN_DIM, border: '1px solid rgba(0,245,255,0.12)' }}>
                  <c.icon className="w-4 h-4" style={{ color: CYAN }} strokeWidth={1.5} />
                </div>
                <h3 className="text-sm font-bold mb-2 tracking-tight" style={{ fontFamily: HEAD }}>{c.title}</h3>
                <p className="text-[12px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>{c.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 lg:px-16" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight" style={{ fontFamily: HEAD }}>Ready to deploy sovereign intelligence?</h2>
          <button onClick={() => nav('/register-supabase')} className="px-10 py-4 text-[13px] font-bold tracking-wide inline-flex items-center gap-2" style={{ background: CYAN, color: BG, fontFamily: HEAD }} data-testid="trust-cta-deploy">
            Start Free Trial
          </button>
          <p className="text-[10px] tracking-[0.12em] uppercase" style={{ fontFamily: MONO, color: 'rgba(255,255,255,0.15)' }}>Australian owned · Australian hosted · Your data, your sovereignty</p>
        </div>
      </section>

      <footer className="py-8 px-6 lg:px-16" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <p className="text-center text-[11px]" style={{ color: 'rgba(255,255,255,0.15)', fontFamily: MONO }}>&copy; 2026 BIQc — Business IQ Centre. Powered by The Strategy Squad.</p>
      </footer>
    </div>
  );
};

export default TrustPage;
