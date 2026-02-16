import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, Lock, Server, Globe, ChevronLeft, Check, Eye } from 'lucide-react';

const NAVY = '#0A0F1E';
const NAVY_2 = '#0f1629';
const NAVY_3 = '#151e32';
const CYAN = '#00F0FF';
const CYAN_DIM = 'rgba(0, 240, 255, 0.1)';
const SERIF = "'Playfair Display', serif";
const MONO = "'JetBrains Mono', monospace";

const fadeUp = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0, transition: { duration: 0.6 } } };
const stagger = { visible: { transition: { staggerChildren: 0.12 } } };

const PRINCIPLES = [
  { icon: Lock, title: 'AES-256 Encryption', desc: 'All data encrypted at rest and in transit using AES-256, the same standard used by the Australian Defence Force and Five Eyes intelligence alliance.' },
  { icon: Globe, title: 'Australian Data Residency', desc: 'Your business data never leaves Australian jurisdiction. All processing, storage, and backups occur within sovereign Australian data centres.' },
  { icon: Shield, title: 'Zero-Trust Architecture', desc: 'Every API call is authenticated and authorised. No implicit trust between services. Role-based access control enforced at every layer.' },
  { icon: Server, title: 'SOC 2 Aligned', desc: 'Our security practices align with SOC 2 Type II standards for availability, security, processing integrity, and confidentiality.' },
  { icon: Eye, title: 'Minimal Data Collection', desc: 'BIQc observes patterns, not content. We extract intelligence signals without storing raw email bodies or document contents.' },
  { icon: Check, title: 'You Own Your Data', desc: 'Export everything at any time. Delete your account and all associated data is permanently purged within 48 hours. No lock-in.' },
];

const TrustPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen" style={{ background: NAVY, color: 'white' }}>
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50" style={{ background: 'rgba(10,15,30,0.9)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-4 flex items-center justify-between">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 text-sm transition-colors" style={{ color: 'rgba(203,213,225,0.7)' }} data-testid="trust-back-btn">
            <ChevronLeft className="w-4 h-4" /> Back to BIQc
          </button>
          <button onClick={() => navigate('/register-supabase')} className="text-sm font-semibold px-5 py-2.5" style={{ background: CYAN, color: NAVY }} data-testid="trust-start-btn">
            Start Free
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 sm:pt-40 pb-20 px-6 md:px-12" data-testid="trust-hero">
        <motion.div initial="hidden" animate="visible" variants={stagger} className="max-w-4xl mx-auto text-center space-y-8">
          <motion.div variants={fadeUp}>
            <p className="text-xs uppercase tracking-[0.2em] mb-5" style={{ fontFamily: MONO, color: CYAN }}>THE VAULT</p>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.1] tracking-tight" style={{ fontFamily: SERIF }}>
              Trust & Security
            </h1>
          </motion.div>
          <motion.p variants={fadeUp} className="text-lg leading-relaxed max-w-2xl mx-auto" style={{ color: 'rgba(203,213,225,0.7)' }}>
            Your business intelligence is sovereign. BIQc is built from the ground up with Australian data residency, military-grade encryption, and zero-trust principles.
          </motion.p>

          {/* AES-256 Badge */}
          <motion.div variants={fadeUp} className="inline-flex items-center gap-4 px-8 py-5 rounded-sm mx-auto" style={{ background: NAVY_2, border: '1px solid rgba(0,240,255,0.2)', boxShadow: '0 0 40px -10px rgba(0,240,255,0.2)' }}>
            <Lock className="w-8 h-8" style={{ color: CYAN }} strokeWidth={1.5} />
            <div className="text-left">
              <p className="text-2xl font-bold tracking-wider" style={{ fontFamily: MONO, color: CYAN }}>AES-256</p>
              <p className="text-[11px] tracking-widest uppercase" style={{ fontFamily: MONO, color: 'rgba(148,163,184,0.5)' }}>Military-Grade Encryption</p>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* Sovereignty Statement */}
      <section className="py-20 px-6 md:px-12" style={{ background: NAVY_2, borderTop: '1px solid rgba(0,240,255,0.08)', borderBottom: '1px solid rgba(0,240,255,0.08)' }}>
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="max-w-4xl mx-auto">
          <motion.div variants={fadeUp} className="flex items-start gap-6">
            <div className="w-1 self-stretch flex-shrink-0 rounded-full" style={{ background: CYAN }} />
            <div className="space-y-4">
              <h2 className="text-2xl sm:text-3xl font-semibold" style={{ fontFamily: SERIF }}>Australian Data Sovereignty</h2>
              <p className="text-base leading-relaxed" style={{ color: 'rgba(203,213,225,0.7)' }}>
                BIQc is an Australian-owned and operated platform. All business data is processed and stored exclusively within Australian data centres. We do not transfer, mirror, or replicate your data to any offshore jurisdiction — ever.
              </p>
              <p className="text-base leading-relaxed" style={{ color: 'rgba(203,213,225,0.7)' }}>
                This isn't just a compliance checkbox. It's a foundational design principle. Your business intelligence belongs to you, protected by Australian law, and accessible only to you.
              </p>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* Security Principles Grid */}
      <section className="py-24 sm:py-32 px-6 md:px-12" data-testid="trust-principles">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="max-w-6xl mx-auto">
          <motion.div variants={fadeUp} className="text-center mb-16">
            <p className="text-xs uppercase tracking-[0.2em] mb-4" style={{ fontFamily: MONO, color: CYAN }}>SECURITY ARCHITECTURE</p>
            <h2 className="text-3xl sm:text-4xl font-semibold" style={{ fontFamily: SERIF }}>Built for trust at every layer</h2>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {PRINCIPLES.map((p, i) => (
              <motion.div key={i} variants={fadeUp} className="p-7 rounded-sm" style={{ background: NAVY_3, border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="w-10 h-10 rounded-sm flex items-center justify-center mb-5" style={{ background: CYAN_DIM, border: '1px solid rgba(0,240,255,0.15)' }}>
                  <p.icon className="w-5 h-5" style={{ color: CYAN }} strokeWidth={1.5} />
                </div>
                <h3 className="text-base font-semibold text-white mb-2" style={{ fontFamily: SERIF }}>{p.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(203,213,225,0.6)' }}>{p.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 md:px-12" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <h2 className="text-2xl sm:text-3xl font-semibold" style={{ fontFamily: SERIF }}>Ready to deploy sovereign intelligence?</h2>
          <button onClick={() => navigate('/register-supabase')} className="px-10 py-4 text-sm font-semibold tracking-wide inline-flex items-center gap-2" style={{ background: CYAN, color: NAVY }} data-testid="trust-cta-deploy">
            Start Free Trial
          </button>
          <p className="text-xs" style={{ fontFamily: MONO, color: 'rgba(148,163,184,0.4)' }}>
            Australian owned. Australian hosted. Your data, your sovereignty.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 md:px-12" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <p className="text-center text-xs" style={{ color: 'rgba(148,163,184,0.4)' }}>&copy; 2026 BIQc — Business IQ Centre. Powered by The Strategy Squad.</p>
      </footer>
    </div>
  );
};

export default TrustPage;
