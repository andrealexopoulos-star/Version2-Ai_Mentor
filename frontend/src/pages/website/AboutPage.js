/**
 * AboutPage — "Built by Operators, for Operators" marketing page.
 *
 * Sections: Hero, Origin Story, Mission (3 cards), Values (4 cards), CTA.
 * Uses WebsiteLayout wrapper. No auth required.
 *
 * Liquid-Steel visual language: steel-toned gradients, chrome-glint card
 * overlays, floating orbs, section-tag with decorative line, scroll-reveal
 * fade-up on mount.  Matches /tmp/biqc-mockups/marketing/about.html.
 */
import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import WebsiteLayout from '../../components/website/WebsiteLayout';
import { fontFamily } from '../../design-system/tokens';
import { Shield, Zap, Users, Eye, ArrowRight, Lock, Heart, Layers, Smile, MinusCircle } from 'lucide-react';

/* ═══ PALETTE CONSTANTS ═══ */
const C = {
  bgPrimary:    '#080C14',
  bgSecondary:  '#0B1120',
  bgCard:       'rgba(140,165,200,0.04)',
  borderCard:   'rgba(160,185,220,0.12)',
  steelBorder:  'rgba(140,170,210,0.15)',
  textH:        '#EDF1F7',
  textB:        '#8FA0B8',
  textM:        '#5C6E82',
  steel100:     'var(--ink, #C8D4E4)',
  steel300:     '#6E8AAE',
  brand:        '#FF7A18',
  brandDark:    '#E85D00',
  brandGlow:    'rgba(255,122,24,0.25)',
  chromeGlint:  'linear-gradient(105deg, rgba(200,220,240,0.0) 0%, rgba(200,220,240,0.06) 45%, rgba(200,220,240,0.0) 55%, rgba(200,220,240,0.0) 100%)',
  steelSheen:   'linear-gradient(135deg, rgba(160,185,220,0.06) 0%, rgba(160,185,220,0.02) 40%, rgba(160,185,220,0.08) 100%)',
};

/* ═══ SCROLL-REVEAL HOOK ═══ */
function useScrollReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const targets = el.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) {
      targets.forEach(t => { t.style.opacity = 1; t.style.transform = 'none'; });
      return;
    }
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const stagger = getComputedStyle(entry.target).getPropertyValue('--stagger');
            if (stagger && stagger.trim() !== '0s') {
              entry.target.style.transitionDelay = stagger.trim();
            }
            entry.target.classList.add('revealed');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' },
    );
    targets.forEach(t => observer.observe(t));
    return () => observer.disconnect();
  }, []);
  return ref;
}

/* ═══ SECTION TAG ═══ */
const SectionTag = ({ children }) => (
  <span style={{
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '1.5px',
    color: C.brand,
    marginBottom: 16,
    fontFamily: fontFamily.mono,
  }}>
    <span style={{
      display: 'block',
      width: 24,
      height: 2,
      background: `linear-gradient(90deg, ${C.steel300}, ${C.brand})`,
      borderRadius: 1,
    }} />
    {children}
  </span>
);

/* ═══ MISSION CARD ═══ */
const MissionCard = ({ icon, title, description, stagger = '0s' }) => (
  <div
    className="reveal"
    style={{
      '--stagger': stagger,
      opacity: 0,
      transform: 'translateY(32px)',
      transition: 'opacity 0.7s ease, transform 0.7s ease',
      background: `${C.chromeGlint}, ${C.bgCard}`,
      border: `1px solid ${C.steelBorder}`,
      borderRadius: 16,
      padding: '32px 28px',
    }}
    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.borderColor = 'rgba(140,170,210,0.25)'; }}
    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = C.steelBorder; }}
  >
    <div style={{
      width: 44,
      height: 44,
      borderRadius: 10,
      background: C.steelSheen,
      border: `1px solid ${C.borderCard}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
      color: C.steel300,
    }}>
      {icon}
    </div>
    <h3 style={{ fontFamily: fontFamily.display, fontSize: 20, fontWeight: 600, color: C.textH, marginBottom: 12 }}>{title}</h3>
    <p style={{ fontSize: 14, lineHeight: 1.7, color: C.textB, fontFamily: fontFamily.body }}>{description}</p>
  </div>
);

/* ═══ VALUE CARD ═══ */
const ValueCard = ({ icon, title, description, stagger = '0s' }) => (
  <div
    className="reveal"
    style={{
      '--stagger': stagger,
      opacity: 0,
      transform: 'translateY(32px)',
      transition: 'opacity 0.7s ease, transform 0.7s ease',
      background: `${C.chromeGlint}, ${C.bgCard}`,
      border: `1px solid ${C.steelBorder}`,
      borderRadius: 16,
      padding: '32px 28px',
    }}
    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.borderColor = 'rgba(140,170,210,0.25)'; }}
    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = C.steelBorder; }}
  >
    <div style={{
      width: 44,
      height: 44,
      borderRadius: 10,
      background: C.steelSheen,
      border: `1px solid ${C.borderCard}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
      color: C.steel300,
    }}>
      {icon}
    </div>
    <h3 style={{ fontFamily: fontFamily.display, fontSize: 20, fontWeight: 600, color: C.textH, marginBottom: 10 }}>{title}</h3>
    <p style={{ fontSize: 14, lineHeight: 1.7, color: C.textB, fontFamily: fontFamily.body }}>{description}</p>
  </div>
);

/* ═══ GLOBAL REVEAL STYLE (injected once) ═══ */
const revealCSS = `
.reveal{opacity:0;transform:translateY(32px);transition:opacity .7s ease,transform .7s ease}
.revealed{opacity:1!important;transform:translateY(0)!important}
@keyframes orbFloat1{0%,100%{transform:translate(0,0)}50%{transform:translate(-30px,20px)}}
@keyframes orbFloat2{0%,100%{transform:translate(0,0)}50%{transform:translate(20px,-30px)}}
@keyframes fadeUp{to{opacity:1;transform:translateY(0)}}
`;

/* ═══════════════════════════════════════════════════════════════
   PAGE COMPONENT
   ═══════════════════════════════════════════════════════════════ */
export default function AboutPage() {
  const wrapRef = useScrollReveal();

  return (
    <WebsiteLayout>
      <style>{revealCSS}</style>
      <div ref={wrapRef}>

        {/* ─── HERO ─── */}
        <section style={{
          position: 'relative',
          padding: '80px 0 72px',
          background: [
            'radial-gradient(ellipse 80% 50% at 20% 80%, rgba(46,74,110,0.12) 0%, transparent 60%)',
            'radial-gradient(ellipse 60% 60% at 80% 20%, rgba(74,106,144,0.08) 0%, transparent 50%)',
            `radial-gradient(ellipse 100% 80% at 50% 0%, rgba(14,22,40,1) 0%, ${C.bgPrimary} 100%)`,
          ].join(','),
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
        }}>
          {/* Floating orbs */}
          <div style={{
            position: 'absolute', borderRadius: '50%', filter: 'blur(100px)', opacity: 0.3, pointerEvents: 'none',
            width: 500, height: 500,
            background: 'radial-gradient(circle, rgba(100,140,190,0.1), rgba(46,74,110,0.05) 50%, transparent 70%)',
            top: -180, right: -80,
            animation: 'orbFloat1 14s ease-in-out infinite',
          }} />
          <div style={{
            position: 'absolute', borderRadius: '50%', filter: 'blur(100px)', opacity: 0.3, pointerEvents: 'none',
            width: 400, height: 400,
            background: 'radial-gradient(circle, rgba(160,185,220,0.06), transparent 70%)',
            bottom: -120, left: -60,
            animation: 'orbFloat2 18s ease-in-out infinite',
          }} />

          {/* Subtle sheen overlay */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1,
            background: 'linear-gradient(160deg, rgba(140,170,210,0.03) 0%, transparent 30%), linear-gradient(340deg, rgba(140,170,210,0.02) 0%, transparent 25%)',
          }} />

          <div style={{ position: 'relative', zIndex: 2, textAlign: 'center', maxWidth: 760, margin: '0 auto', padding: '0 24px', width: '100%' }}>
            <h1 style={{
              fontFamily: fontFamily.display,
              fontSize: 'clamp(30px, 5vw, 52px)',
              fontWeight: 700,
              lineHeight: 1.12,
              color: C.textH,
              letterSpacing: '-1.5px',
              marginBottom: 24,
              opacity: 0,
              transform: 'translateY(24px)',
              animation: 'fadeUp 0.7s ease 0.2s forwards',
            }}>
              The Story Behind BIQc
            </h1>
            <p style={{
              fontFamily: fontFamily.body,
              fontSize: 'clamp(16px, 2vw, 18px)',
              lineHeight: 1.7,
              color: C.textB,
              maxWidth: 620,
              margin: '0 auto',
              opacity: 0,
              transform: 'translateY(24px)',
              animation: 'fadeUp 0.7s ease 0.4s forwards',
            }}>
              Built by operators, for operators. One intelligence layer for every business decision.
            </p>
          </div>
        </section>

        {/* ─── ORIGIN STORY ─── */}
        <section style={{
          padding: '80px 0',
          background: `radial-gradient(ellipse 70% 50% at 30% 50%, rgba(46,74,110,0.06) 0%, transparent 50%), ${C.bgPrimary}`,
        }}>
          <div style={{ maxWidth: 1120, margin: '0 auto', padding: '0 24px' }}>
            <div className="reveal" style={{ textAlign: 'center', marginBottom: 40, opacity: 0, transform: 'translateY(32px)', transition: 'opacity .7s ease, transform .7s ease' }}>
              <SectionTag>Our Origin</SectionTag>
              <h2 style={{ fontFamily: fontFamily.display, fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 700, color: C.textH, letterSpacing: '-1px', lineHeight: 1.2 }}>
                Born from the Trenches
              </h2>
            </div>

            <div className="reveal" style={{ maxWidth: 720, margin: '0 auto', opacity: 0, transform: 'translateY(32px)', transition: 'opacity .7s ease, transform .7s ease' }}>
              {[
                'Our founder spent years building and scaling SaaS startups across Australia. Not in a corporate tower \u2014 in the trenches, alongside small business owners trying to make sense of their own data.',
                'The pattern was always the same: brilliant operators making gut-feel decisions because their tools were fragmented. CRM in one tab, accounting in another, reviews on a third, market data buried in PDFs no one reads. Every decision was a guess wrapped in experience.',
                'BIQc was born from a simple question: what if every business decision \u2014 from pricing to hiring to expansion \u2014 could be informed by intelligence that actually understands your specific context? Not generic dashboards. Not more data dumps. Real intelligence, calibrated to your business.',
                'That question became an obsession. The result is BIQc \u2014 a platform that connects your existing tools, understands your competitive landscape, and gives you the strategic clarity that used to require a boardroom full of consultants.',
              ].map((text, i) => (
                <p key={i} style={{
                  fontFamily: fontFamily.body,
                  fontSize: 'clamp(15px, 1.5vw, 16px)',
                  lineHeight: 1.8,
                  color: C.steel100,
                  marginBottom: i < 3 ? 24 : 0,
                }}>
                  {text}
                </p>
              ))}
            </div>
          </div>
        </section>

        {/* ─── MISSION ─── */}
        <section style={{
          padding: '80px 0',
          background: [
            'radial-gradient(ellipse 60% 50% at 70% 30%, rgba(74,106,144,0.06) 0%, transparent 50%)',
            `linear-gradient(180deg, ${C.bgSecondary} 0%, ${C.bgPrimary} 100%)`,
          ].join(','),
        }}>
          <div style={{ maxWidth: 1120, margin: '0 auto', padding: '0 24px' }}>
            <div className="reveal" style={{ textAlign: 'center', marginBottom: 8, opacity: 0, transform: 'translateY(32px)', transition: 'opacity .7s ease, transform .7s ease' }}>
              <SectionTag>Why We Exist</SectionTag>
              <h2 style={{ fontFamily: fontFamily.display, fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 700, color: C.textH, letterSpacing: '-1px', lineHeight: 1.2 }}>
                Our Mission
              </h2>
            </div>

            <p className="reveal" style={{
              maxWidth: 720,
              margin: '0 auto 48px',
              fontFamily: fontFamily.body,
              fontSize: 'clamp(16px, 1.8vw, 18px)',
              lineHeight: 1.8,
              color: C.steel100,
              textAlign: 'center',
              opacity: 0,
              transform: 'translateY(32px)',
              transition: 'opacity .7s ease, transform .7s ease',
            }}>
              Help Australian SMBs navigate the challenges of day-to-day operations and transition into
              the era of AI &mdash; with practical intelligence, not hype. One layer. Every decision.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
              <MissionCard
                icon={<Layers size={22} strokeWidth={2} />}
                title="Practical Intelligence"
                description="No buzzwords. No dashboards you'll never check. Intelligence that speaks your language and drives action."
                stagger="0s"
              />
              <MissionCard
                icon={<Users size={22} strokeWidth={2} />}
                title="Built for SMBs"
                description="Enterprise-grade intelligence, sized for businesses that don't have a data team. Starting from $0."
                stagger="0.1s"
              />
              <MissionCard
                icon={<Smile size={22} strokeWidth={2} />}
                title="AI That Serves You"
                description="AI should amplify human judgement, not replace it. BIQc keeps you in the driver's seat."
                stagger="0.2s"
              />
            </div>
          </div>
        </section>

        {/* ─── VALUES ─── */}
        <section style={{
          padding: '80px 0',
          background: `radial-gradient(ellipse 60% 50% at 40% 60%, rgba(46,74,110,0.06) 0%, transparent 50%), ${C.bgPrimary}`,
        }}>
          <div style={{ maxWidth: 1120, margin: '0 auto', padding: '0 24px' }}>
            <div className="reveal" style={{ textAlign: 'center', marginBottom: 40, opacity: 0, transform: 'translateY(32px)', transition: 'opacity .7s ease, transform .7s ease' }}>
              <SectionTag>Our Principles</SectionTag>
              <h2 style={{ fontFamily: fontFamily.display, fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 700, color: C.textH, letterSpacing: '-1px', lineHeight: 1.2 }}>
                What We Stand For
              </h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24, maxWidth: 900, margin: '0 auto' }}>
              <ValueCard
                icon={<Eye size={22} strokeWidth={2} />}
                title="Transparency"
                description="Every insight has a source. Every recommendation has reasoning. No black boxes."
                stagger="0s"
              />
              <ValueCard
                icon={<Lock size={22} strokeWidth={2} />}
                title="Data Sovereignty"
                description="Australian-first infrastructure. Your data stays in your control. We never sell it, share it, or train on it."
                stagger="0.1s"
              />
              <ValueCard
                icon={<Heart size={22} strokeWidth={2} />}
                title="Empowering Humans"
                description="Technology should amplify your expertise, not replace your judgement. We build tools for decision-makers, not decision-replacers."
                stagger="0.15s"
              />
              <ValueCard
                icon={<MinusCircle size={22} strokeWidth={2} />}
                title="Relentless Simplicity"
                description="The best intelligence platform is one you actually use. We obsess over making complexity invisible."
                stagger="0.25s"
              />
            </div>
          </div>
        </section>

        {/* ─── BOTTOM CTA ─── */}
        <section style={{
          padding: '80px 0',
          background: [
            'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(46,74,110,0.08) 0%, transparent 60%)',
            `linear-gradient(180deg, ${C.bgPrimary} 0%, ${C.bgSecondary} 100%)`,
          ].join(','),
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Decorative center orb */}
          <div style={{
            position: 'absolute',
            width: 600, height: 600,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,122,24,0.05), rgba(140,170,210,0.03) 50%, transparent 70%)',
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
          }} />

          <div className="reveal" style={{ position: 'relative', zIndex: 1, maxWidth: 1120, margin: '0 auto', padding: '0 24px', opacity: 0, transform: 'translateY(32px)', transition: 'opacity .7s ease, transform .7s ease' }}>
            <h2 style={{
              fontFamily: fontFamily.display,
              fontSize: 'clamp(28px, 4vw, 40px)',
              fontWeight: 700,
              color: C.textH,
              marginBottom: 16,
              letterSpacing: '-1px',
            }}>
              Ready to See Your Business Clearly?
            </h2>
            <p style={{
              fontFamily: fontFamily.body,
              fontSize: 'clamp(15px, 1.6vw, 17px)',
              color: C.textB,
              maxWidth: 560,
              margin: '0 auto 32px',
              lineHeight: 1.7,
            }}>
              Start free. No credit card required. Intelligence in minutes.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
              <Link
                to="/register"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '14px 32px',
                  fontSize: 16,
                  fontWeight: 600,
                  fontFamily: fontFamily.body,
                  color: '#FFFFFF',
                  background: 'linear-gradient(135deg, #FF7A18, #E85D00)',
                  border: 'none',
                  borderRadius: 10,
                  textDecoration: 'none',
                  transition: 'transform 0.2s, box-shadow 0.3s',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 8px 32px ${C.brandGlow}`; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                Start Free Today <ArrowRight size={16} />
              </Link>
              <Link
                to="/contact"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '12px 28px',
                  fontSize: 15,
                  fontWeight: 500,
                  fontFamily: fontFamily.body,
                  color: '#9BB0CC',
                  background: 'transparent',
                  border: `1px solid ${C.steelBorder}`,
                  borderRadius: 10,
                  textDecoration: 'none',
                  transition: 'color 0.2s, border-color 0.2s, background 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = C.textH; e.currentTarget.style.borderColor = 'rgba(140,170,210,0.3)'; e.currentTarget.style.background = 'rgba(140,170,210,0.04)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = '#9BB0CC'; e.currentTarget.style.borderColor = C.steelBorder; e.currentTarget.style.background = 'transparent'; }}
              >
                Talk to us
              </Link>
            </div>
          </div>
        </section>

      </div>
    </WebsiteLayout>
  );
}
