/**
 * CMOReportPage — Chief Marketing Officer Intelligence Report (Pro tier).
 *
 * Full-fidelity implementation matching the cmo-report.html mockup.
 * Sections: Report header, executive summary, market position score (SVG gauge + bars),
 * competitive landscape table + 2x2 position matrix, SWOT analysis,
 * review intelligence (rating + sentiment bar + theme pills + excerpts),
 * strategic roadmap (7d / 30d / 90d numbered items), geographic analysis,
 * and floating PDF FAB.
 *
 * Data sourced from GET /api/intelligence/cmo-report.
 */
import { useState, useEffect, useRef } from 'react';
import {
  Loader2, TrendingUp, Shield, Globe, Star, MapPin, Target,
  AlertTriangle, Lightbulb, ChevronRight, Share2, Download,
  BarChart3, Users, CheckCircle2, PlusCircle, Layers,
} from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { PageSkeleton } from '../components/ui/skeleton-loader';
import { apiClient } from '../lib/api';
import { toast } from 'sonner';
import { fontFamily } from '../design-system/tokens';

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Design tokens (CSS var fallbacks)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const V = {
  surface:     'var(--surface, #0E1628)',
  sunken:      'var(--surface-sunken, #060A12)',
  border:      'var(--border, rgba(140,170,210,0.12))',
  borderStrong:'var(--border-strong, rgba(140,170,210,0.22))',
  lava:        'var(--lava, #E85D00)',
  lavaWarm:    'var(--lava-warm, #FF8A3D)',
  lavaDeep:    'var(--lava-deep, #C44D00)',
  inkDisplay:  'var(--ink-display, #EDF1F7)',
  ink:         'var(--ink, #C8D4E4)',
  inkSecondary:'var(--ink-secondary, #8FA0B8)',
  inkMuted:    'var(--ink-muted, #708499)',
  inkSubtle:   'var(--ink-subtle, #4A5E78)',
  positive:    'var(--positive, #16A34A)',
  positiveWash:'rgba(22,163,74,0.12)',
  warning:     'var(--warning, #D97706)',
  warningWash: 'rgba(217,119,6,0.12)',
  info:        'var(--info, #2563EB)',
  infoWash:    'rgba(37,99,235,0.12)',
  danger:      'var(--danger, #DC2626)',
  dangerWash:  'rgba(220,38,38,0.12)',
};

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Sub-components
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

/** Progress bar with label + value + gradient fill */
const ProgressBar = ({ label, value, max = 100, gradient, animDelay = 0 }) => {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setTimeout(() => setWidth((value / max) * 100), 200 + animDelay); obs.unobserve(el); }
    }, { threshold: 0.2 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [value, max, animDelay]);
  return (
    <div ref={ref} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: V.ink, fontFamily: fontFamily.body }}>{label}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: V.inkDisplay, fontFamily: fontFamily.mono }}>{value}/{max}</span>
      </div>
      <div style={{ height: 8, borderRadius: 999, overflow: 'hidden', background: V.sunken }}>
        <div style={{ height: '100%', borderRadius: 999, width: `${width}%`, background: gradient, transition: 'width 1.4s cubic-bezier(0.25,1,0.5,1)' }} />
      </div>
    </div>
  );
};

/** Threat level badge */
const ThreatBadge = ({ level }) => {
  const map = {
    high:   { bg: 'rgba(220,38,38,0.15)', color: '#F87171' },
    medium: { bg: 'rgba(217,119,6,0.15)', color: '#FBBF24' },
    low:    { bg: 'rgba(22,163,74,0.15)', color: '#4ADE80' },
    you:    { bg: 'rgba(232,93,0,0.15)', color: V.lavaWarm },
  };
  const s = map[level] || map.low;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 999, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', background: s.bg, color: s.color }}>
      {level === 'you' ? 'YOU' : level}
    </span>
  );
};

/** Priority badge for roadmap items */
const PriorityBadge = ({ priority }) => {
  const map = {
    critical: { bg: 'rgba(220,38,38,0.15)', color: '#F87171' },
    high:     { bg: 'rgba(217,119,6,0.15)', color: '#FBBF24' },
    medium:   { bg: 'rgba(37,99,235,0.15)', color: '#60A5FA' },
  };
  const s = map[priority] || map.medium;
  return (
    <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap', flexShrink: 0, marginTop: 2, background: s.bg, color: s.color }}>
      {priority}
    </span>
  );
};

/** SWOT card */
const SwotCard = ({ type, icon, label, items }) => {
  const colors = {
    strength:    { border: V.positive,  bg: V.positiveWash, dot: V.positive },
    weakness:    { border: V.warning,   bg: V.warningWash,  dot: V.warning },
    opportunity: { border: V.info,      bg: V.infoWash,     dot: V.info },
    threat:      { border: V.danger,    bg: V.dangerWash,   dot: V.danger },
  };
  const c = colors[type] || colors.strength;
  return (
    <div style={{ background: V.surface, border: `1px solid ${V.border}`, borderRadius: 12, padding: 20, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: c.border }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <div style={{ width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: c.bg, color: c.border }}>{icon}</div>
        <span style={{ fontSize: 14, fontWeight: 600, color: V.inkDisplay, fontFamily: fontFamily.body }}>{label}</span>
      </div>
      <ul style={{ display: 'flex', flexDirection: 'column', gap: 12, listStyle: 'none', margin: 0, padding: 0 }}>
        {items.map((item, i) => (
          <li key={i} style={{ fontSize: 14, color: V.inkSecondary, lineHeight: 1.55, paddingLeft: 16, position: 'relative' }}>
            <span style={{ position: 'absolute', left: 0, top: 8, width: 5, height: 5, borderRadius: '50%', background: c.dot }} />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
};

/** Section header with icon */
const SectionHead = ({ icon, iconBg, iconColor, title }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
    <div style={{ width: 32, height: 32, flexShrink: 0, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, background: iconBg, color: iconColor }}>{icon}</div>
    <span style={{ fontFamily: fontFamily.display, fontSize: 'clamp(1.2rem, 2vw, 1.5rem)', color: V.inkDisplay, letterSpacing: '-0.01em' }}>{title}</span>
  </div>
);

/** Review excerpt card */
const ReviewExcerpt = ({ quote, stars, source, author }) => (
  <div style={{ background: V.surface, border: `1px solid ${V.border}`, borderRadius: 12, padding: 20 }}>
    <p style={{ fontSize: 14, color: V.inkSecondary, lineHeight: 1.6, fontStyle: 'italic', marginBottom: 12, position: 'relative', paddingLeft: 20 }}>
      <span style={{ position: 'absolute', left: 0, top: -4, fontFamily: fontFamily.display, fontSize: 32, color: V.lava, lineHeight: 1 }}>{'\u201C'}</span>
      {quote}
    </p>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: V.inkMuted }}>
      <span style={{ color: '#FBBF24', fontSize: 12 }}>{'★'.repeat(stars)}{'☆'.repeat(5 - stars)}</span>
      <span style={{ fontWeight: 500, color: V.inkSecondary }}>{source}</span>
      <span>{author}</span>
    </div>
  </div>
);

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Main Page
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export default function CMOReportPage() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  // SVG gauge animation
  const gaugeRef = useRef(null);
  const [gaugeVisible, setGaugeVisible] = useState(false);
  useEffect(() => {
    const el = gaugeRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setGaugeVisible(true); obs.unobserve(el); }
    }, { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [loading]);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const res = await apiClient.get('/intelligence/cmo-report');
        setReport(res.data);
      } catch {
        setReport(null);
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, []);

  if (loading) {
    return <DashboardLayout><div style={{ padding: 32, maxWidth: 1100, margin: '0 auto' }}><PageSkeleton cards={4} lines={6} /></div></DashboardLayout>;
  }

  /* ── Fallback data when API is unavailable ── */
  const data = report || {};
  const mps = data.market_position || { overall: 0, brand: 0, digital: 0, sentiment: 0, competitive: 0 };
  const competitors = data.competitors || [];
  const positionDots = data.position_dots || [];
  const swot = data.swot || { strengths: [], weaknesses: [], opportunities: [], threats: [] };
  const reviews = data.reviews || { rating: 0, count: 0, positive_pct: 0, neutral_pct: 0, negative_pct: 0 };
  const reviewThemes = data.review_themes || { positive: [], negative: [] };
  const reviewExcerpts = data.review_excerpts || [];
  const roadmap = data.roadmap || { quick_wins: [], priorities: [], strategic: [] };
  const geo = data.geographic || { established: [], growth: [] };

  // Gauge math: circumference of r=70 circle = 2*PI*70 ~= 440
  const gaugeCirc = 440;
  const overall = mps.overall || 0;
  const gaugeOffset = gaugeVisible ? gaugeCirc - (gaugeCirc * overall / 100) : gaugeCirc;

  const handleShare = () => toast.info('Share dialog coming soon');
  const handleDownloadPDF = () => toast.info('PDF generation coming soon');

  return (
    <DashboardLayout>
      <div style={{ padding: '24px 24px 48px', maxWidth: 1100, margin: '0 auto', fontFamily: fontFamily.body }}>

        {/* ═══════════════════════════════════════════════════
            1. REPORT HEADER
            ═══════════════════════════════════════════════════ */}
        <header style={{
          background: V.surface, border: `1px solid ${V.border}`, borderRadius: 16,
          padding: '32px 32px 24px', marginBottom: 24, position: 'relative', overflow: 'hidden',
        }}>
          {/* Lava top stripe with shimmer */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${V.lava}, ${V.lavaWarm}, ${V.lava})`, backgroundSize: '200% 100%', animation: 'lava-shimmer 6s ease-in-out infinite' }} />

          {/* Top row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Eyebrow */}
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: V.lava }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: V.lava, boxShadow: `0 0 6px ${V.lava}`, animation: 'pulse 2s infinite' }} />
                CMO Intelligence Report
              </span>
              <h1 style={{ fontFamily: fontFamily.display, fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)', lineHeight: 1.15, letterSpacing: '-0.02em', color: V.inkDisplay, margin: 0 }}>
                Chief Marketing Summary
              </h1>
              <span style={{ fontSize: 16, color: V.inkSecondary, fontWeight: 500 }}>
                {data.company_name || 'Your business'}
              </span>
            </div>
            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', background: V.sunken, border: `1px solid ${V.border}`, borderRadius: 999, fontSize: 10, fontWeight: 600, color: V.inkMuted, letterSpacing: '0.08em' }}>
                {data.version || '\u2014'} &middot; {data.status || 'Draft'}
              </span>
              <button onClick={handleShare} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500, border: `1px solid ${V.border}`, background: 'transparent', color: V.ink, cursor: 'pointer', fontFamily: fontFamily.body }}>
                <Share2 size={14} /> Share Report
              </button>
              <button onClick={handleDownloadPDF} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500, border: 'none', background: `linear-gradient(135deg, ${V.lava}, ${V.lavaWarm})`, color: '#fff', cursor: 'pointer', fontFamily: fontFamily.body }}>
                <Download size={14} /> Download PDF
              </button>
            </div>
          </div>

          {/* Meta row */}
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', paddingTop: 16, borderTop: `1px solid ${V.border}` }}>
            {[
              { label: 'Report Date', value: data.report_date || new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }) },
              { label: 'Scan Source', value: data.scan_source || 'Connected integrations' },
              { label: 'Engine', value: data.engine || 'BIQc Intelligence Engine' },
              { label: 'Data Points', value: data.data_points || '-- analysed' },
              { label: 'Confidence', value: data.confidence ? `${data.confidence}%` : '--' },
            ].map(m => (
              <div key={m.label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: V.inkMuted }}>{m.label}</span>
                <span style={{ fontSize: 13, color: V.ink, fontWeight: 500 }}>{m.value}</span>
              </div>
            ))}
          </div>
        </header>

        {/* ═══════════════════════════════════════════════════
            2. EXECUTIVE SUMMARY
            ═══════════════════════════════════════════════════ */}
        <div style={{
          background: V.surface, border: `1px solid ${V.border}`, borderLeft: `3px solid ${V.lava}`,
          borderRadius: 12, padding: 24, marginBottom: 32,
        }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: V.lava, marginBottom: 12 }}>
            <Layers size={14} /> Executive Summary
          </div>
          <p style={{ fontSize: 16, lineHeight: 1.7, color: V.inkSecondary, margin: 0 }}>
            {data.executive_summary || 'No executive summary available yet. Connect your integrations to generate intelligence.'}
          </p>
        </div>

        {/* ═══════════════════════════════════════════════════
            3. MARKET POSITION SCORE
            ═══════════════════════════════════════════════════ */}
        <div style={{ marginBottom: 32 }}>
          <SectionHead icon={<BarChart3 size={18} />} iconBg="rgba(232,93,0,0.12)" iconColor={V.lava} title="Market Position Score" />
          <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 24 }}>
            {/* Gauge */}
            <div ref={gaugeRef} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, background: V.surface, border: `1px solid ${V.border}`, borderRadius: 12 }}>
              <div style={{ position: 'relative', width: 160, height: 160, marginBottom: 16 }}>
                <svg viewBox="0 0 160 160" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                  <circle cx="80" cy="80" r="70" fill="none" stroke={V.sunken} strokeWidth="10" />
                  <circle cx="80" cy="80" r="70" fill="none" stroke={V.lava} strokeWidth="10" strokeLinecap="round"
                    strokeDasharray={gaugeCirc} strokeDashoffset={gaugeOffset}
                    style={{ transition: 'stroke-dashoffset 1.8s cubic-bezier(0.25,1,0.5,1)' }} />
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontFamily: fontFamily.display, fontSize: 48, lineHeight: 1, color: V.inkDisplay, letterSpacing: '-0.03em' }}>{overall || '\u2014'}</span>
                  <span style={{ fontSize: 12, color: V.inkMuted, fontWeight: 500, marginTop: 2 }}>out of 100</span>
                </div>
              </div>
              <span style={{ fontSize: 14, color: V.inkSecondary, fontWeight: 600, textAlign: 'center' }}>Overall Market Position</span>
            </div>
            {/* Bars */}
            <div style={{ background: V.surface, border: `1px solid ${V.border}`, borderRadius: 12, padding: 24, display: 'flex', flexDirection: 'column', gap: 20, justifyContent: 'center' }}>
              <ProgressBar label="Brand Strength"       value={mps.brand}       gradient={`linear-gradient(90deg, ${V.lava}, ${V.lavaWarm})`} animDelay={0} />
              <ProgressBar label="Digital Presence"      value={mps.digital}     gradient="linear-gradient(90deg, #2563EB, #60A5FA)" animDelay={100} />
              <ProgressBar label="Customer Sentiment"    value={mps.sentiment}   gradient="linear-gradient(90deg, #16A34A, #4ADE80)" animDelay={200} />
              <ProgressBar label="Competitive Position"  value={mps.competitive} gradient="linear-gradient(90deg, #D97706, #FBBF24)" animDelay={300} />
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════
            4. COMPETITIVE LANDSCAPE
            ═══════════════════════════════════════════════════ */}
        <div style={{ marginBottom: 32 }}>
          <SectionHead icon={<Users size={18} />} iconBg={V.infoWash} iconColor={V.info} title="Competitive Landscape" />

          {/* Table */}
          {competitors.length > 0 && (
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', marginBottom: 20 }}>
              <div style={{ background: V.surface, border: `1px solid ${V.border}`, borderRadius: 12, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: V.sunken }}>
                      {['Company', 'Market Share Est.', 'Key Strengths', 'Digital Visibility', 'Threat Level'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: V.inkMuted, borderBottom: `1px solid ${V.border}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {competitors.map((c, i) => (
                      <tr key={i} style={c.is_you ? { background: 'rgba(232,93,0,0.06)' } : {}}>
                        <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 600, color: V.inkDisplay, borderBottom: `1px solid ${V.border}` }}>{c.name}</td>
                        <td style={{ padding: '12px 16px', fontSize: 14, color: V.ink, borderBottom: `1px solid ${V.border}` }}>{c.market_share}</td>
                        <td style={{ padding: '12px 16px', fontSize: 14, color: V.ink, borderBottom: `1px solid ${V.border}` }}>{c.strengths}</td>
                        <td style={{ padding: '12px 16px', fontSize: 14, color: V.ink, borderBottom: `1px solid ${V.border}` }}>{c.digital_visibility}</td>
                        <td style={{ padding: '12px 16px', borderBottom: `1px solid ${V.border}` }}><ThreatBadge level={c.threat_level} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 2x2 Position Map */}
          {positionDots.length > 0 && (
            <div style={{ background: V.surface, border: `1px solid ${V.border}`, borderRadius: 12, padding: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: V.ink, marginBottom: 16, textAlign: 'center' }}>Competitive Position Matrix</div>
              <div style={{ position: 'relative', width: '100%', maxWidth: 420, aspectRatio: '1', margin: '0 auto', border: `1px solid ${V.borderStrong}` }}>
                {/* Quadrants */}
                {[
                  { pos: { top: 0, left: 0 }, label: 'Niche Leaders', bg: 'rgba(37,99,235,0.04)' },
                  { pos: { top: 0, right: 0 }, label: 'Market Leaders', bg: 'rgba(22,163,74,0.04)' },
                  { pos: { bottom: 0, left: 0 }, label: 'Emerging', bg: 'rgba(255,255,255,0.01)' },
                  { pos: { bottom: 0, right: 0 }, label: 'Challengers', bg: 'rgba(217,119,6,0.04)' },
                ].map(q => (
                  <div key={q.label} style={{
                    position: 'absolute', width: '50%', height: '50%', ...q.pos,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, color: V.inkSubtle, textTransform: 'uppercase', letterSpacing: '0.06em',
                    border: `1px solid ${V.border}`, background: q.bg,
                  }}>{q.label}</div>
                ))}
                {/* Dots */}
                {positionDots.map((d, i) => (
                  <div key={i} style={{
                    position: 'absolute', left: d.x, top: d.y, transform: 'translate(-50%, -50%)', zIndex: 2,
                    width: d.is_you ? 40 : 36, height: d.is_you ? 40 : 36, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: d.is_you ? 8 : 9, fontWeight: 700, color: '#fff',
                    background: d.color || V.lava, border: `2px solid ${V.surface}`,
                    boxShadow: d.is_you ? `0 0 0 4px rgba(232,93,0,0.25)` : 'none',
                  }}>
                    <span style={{ position: 'absolute', top: '110%', fontSize: 9, color: V.inkSecondary, whiteSpace: 'nowrap', fontWeight: 500, letterSpacing: 0 }}>{d.label}</span>
                  </div>
                ))}
                {/* Axis labels */}
                <span style={{ position: 'absolute', bottom: -22, left: '50%', transform: 'translateX(-50%)', fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: V.inkMuted }}>
                  Market Presence &rarr;
                </span>
                <span style={{ position: 'absolute', top: '50%', left: -40, transform: 'rotate(-90deg) translateX(-50%)', transformOrigin: 'center', whiteSpace: 'nowrap', fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: V.inkMuted }}>
                  Growth Rate &rarr;
                </span>
              </div>
            </div>
          )}

          {/* Empty state if no competitors */}
          {competitors.length === 0 && positionDots.length === 0 && (
            <div style={{ background: V.surface, border: `1px solid ${V.border}`, borderRadius: 12, padding: 40, textAlign: 'center' }}>
              <p style={{ color: V.inkMuted, fontSize: 14 }}>No competitive data available yet. Connect integrations to generate landscape analysis.</p>
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════
            5. SWOT ANALYSIS
            ═══════════════════════════════════════════════════ */}
        <div style={{ marginBottom: 32 }}>
          <SectionHead icon={<Target size={18} />} iconBg={V.positiveWash} iconColor={V.positive} title="SWOT Analysis" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            <SwotCard type="strength"    label="Strengths"     icon={<CheckCircle2 size={16} />} items={swot.strengths.length  ? swot.strengths  : ['No data available yet']} />
            <SwotCard type="weakness"    label="Weaknesses"    icon={<AlertTriangle size={16} />} items={swot.weaknesses.length ? swot.weaknesses : ['No data available yet']} />
            <SwotCard type="opportunity" label="Opportunities" icon={<PlusCircle size={16} />}    items={swot.opportunities.length ? swot.opportunities : ['No data available yet']} />
            <SwotCard type="threat"      label="Threats"       icon={<AlertTriangle size={16} />} items={swot.threats.length    ? swot.threats    : ['No data available yet']} />
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════
            6. REVIEW INTELLIGENCE
            ═══════════════════════════════════════════════════ */}
        <div style={{ marginBottom: 32 }}>
          <SectionHead icon={<Star size={18} />} iconBg="rgba(251,191,36,0.12)" iconColor="#FBBF24" title="Review Intelligence" />

          {/* Rating + Sentiment */}
          <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 20, marginBottom: 20 }}>
            {/* Rating */}
            <div style={{
              background: V.surface, border: `1px solid ${V.border}`, borderRadius: 12, padding: 24,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
            }}>
              <span style={{ fontFamily: fontFamily.display, fontSize: 56, lineHeight: 1, color: V.inkDisplay, letterSpacing: '-0.03em' }}>{reviews.rating || '\u2014'}</span>
              <div style={{ display: 'flex', gap: 2, margin: '8px 0 4px', color: '#FBBF24', fontSize: 18 }}>
                {[1,2,3,4,5].map(s => <span key={s}>{s <= Math.round(reviews.rating) ? '\u2605' : '\u2606'}</span>)}
              </div>
              <span style={{ fontSize: 12, color: V.inkMuted }}>Based on {reviews.count || 0} reviews</span>
            </div>
            {/* Sentiment breakdown */}
            <div style={{
              background: V.surface, border: `1px solid ${V.border}`, borderRadius: 12, padding: 24,
              display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 16,
            }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: V.ink, marginBottom: 4 }}>Sentiment Breakdown</span>
              {/* Stacked bar */}
              <div style={{ height: 12, borderRadius: 999, display: 'flex', overflow: 'hidden' }}>
                <span style={{ height: '100%', width: `${reviews.positive_pct || 0}%`, background: V.positive, transition: 'width 1.2s cubic-bezier(0.25,1,0.5,1)' }} />
                <span style={{ height: '100%', width: `${reviews.neutral_pct || 0}%`, background: '#64748B', transition: 'width 1.2s cubic-bezier(0.25,1,0.5,1)' }} />
                <span style={{ height: '100%', width: `${reviews.negative_pct || 0}%`, background: V.danger, transition: 'width 1.2s cubic-bezier(0.25,1,0.5,1)' }} />
              </div>
              {/* Legend */}
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                {[
                  { label: 'Positive', pct: reviews.positive_pct, color: V.positive },
                  { label: 'Neutral',  pct: reviews.neutral_pct,  color: '#64748B' },
                  { label: 'Negative', pct: reviews.negative_pct, color: V.danger },
                ].map(l => (
                  <span key={l.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, color: V.inkSecondary }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: l.color }} />
                    {l.label} {l.pct || 0}%
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Theme pills */}
          {(reviewThemes.positive.length > 0 || reviewThemes.negative.length > 0) && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginBottom: 20 }}>
              {reviewThemes.positive.length > 0 && (
                <div style={{ background: V.surface, border: `1px solid ${V.border}`, borderRadius: 12, padding: 20 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: V.positive, marginBottom: 12 }}>Top Positive Themes</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {reviewThemes.positive.map((t, i) => (
                      <span key={i} style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 500, background: 'rgba(22,163,74,0.12)', color: '#4ADE80' }}>{t}</span>
                    ))}
                  </div>
                </div>
              )}
              {reviewThemes.negative.length > 0 && (
                <div style={{ background: V.surface, border: `1px solid ${V.border}`, borderRadius: 12, padding: 20 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: V.danger, marginBottom: 12 }}>Top Negative Themes</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {reviewThemes.negative.map((t, i) => (
                      <span key={i} style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 500, background: 'rgba(220,38,38,0.12)', color: '#F87171' }}>{t}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Excerpts */}
          {reviewExcerpts.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {reviewExcerpts.map((ex, i) => (
                <ReviewExcerpt key={i} quote={ex.quote} stars={ex.stars || 5} source={ex.source || ''} author={ex.author || ''} />
              ))}
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════
            7. STRATEGIC ROADMAP
            ═══════════════════════════════════════════════════ */}
        <div style={{ marginBottom: 32 }}>
          <SectionHead icon={<Target size={18} />} iconBg="rgba(232,93,0,0.12)" iconColor={V.lava} title="Strategic Roadmap" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            {[
              { title: '7-Day Quick Wins',     sub: 'Immediate',  items: roadmap.quick_wins, dotColor: V.danger },
              { title: '30-Day Priorities',     sub: 'Short-term', items: roadmap.priorities,  dotColor: V.warning },
              { title: '90-Day Strategic Goals', sub: 'Long-term',  items: roadmap.strategic,  dotColor: V.info },
            ].map(col => (
              <div key={col.title} style={{ background: V.surface, border: `1px solid ${V.border}`, borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column' }}>
                {/* Column head */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, paddingBottom: 12, borderBottom: `1px solid ${V.border}` }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, background: col.dotColor }} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: V.inkDisplay }}>{col.title}</span>
                  <span style={{ fontSize: 12, color: V.inkMuted, marginLeft: 'auto' }}>{col.sub}</span>
                </div>
                {/* Items */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
                  {(col.items.length ? col.items : [{ text: 'No recommendations yet', priority: 'medium' }]).map((item, i) => {
                    const text = typeof item === 'string' ? item : item.text;
                    const priority = typeof item === 'string' ? 'medium' : (item.priority || 'medium');
                    return (
                      <div key={i} style={{ display: 'flex', gap: 12, padding: 12, borderRadius: 8, background: V.sunken, alignItems: 'flex-start' }}>
                        <span style={{
                          width: 22, height: 22, flexShrink: 0, borderRadius: '50%',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 10, fontWeight: 700, color: '#fff', background: col.dotColor,
                        }}>{i + 1}</span>
                        <span style={{ fontSize: 14, color: V.inkSecondary, lineHeight: 1.5, flex: 1 }}>{text}</span>
                        <PriorityBadge priority={priority} />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════
            8. GEOGRAPHIC ANALYSIS
            ═══════════════════════════════════════════════════ */}
        {(geo.established.length > 0 || geo.growth.length > 0) && (
          <div style={{ marginBottom: 32 }}>
            <SectionHead icon={<MapPin size={18} />} iconBg={V.positiveWash} iconColor={V.positive} title="Geographic Analysis" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              {/* Established Presence */}
              {geo.established.length > 0 && (
                <div style={{ background: V.surface, border: `1px solid ${V.border}`, borderRadius: 12, padding: 20 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: V.inkDisplay, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CheckCircle2 size={14} style={{ color: V.positive }} /> Established Presence
                  </div>
                  {geo.established.map((g, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < geo.established.length - 1 ? `1px solid ${V.border}` : 'none' }}>
                      <span style={{ fontSize: 14, color: V.ink, fontWeight: 500 }}>{g.region}</span>
                      <div style={{ width: 100, height: 6, background: V.sunken, borderRadius: 999, overflow: 'hidden', margin: '0 12px', flexShrink: 0 }}>
                        <div style={{ height: '100%', borderRadius: 999, width: `${g.pct}%`, background: `linear-gradient(90deg, ${V.lava}, ${V.lavaWarm})` }} />
                      </div>
                      <span style={{ fontFamily: fontFamily.mono, fontSize: 12, color: V.inkMuted, fontWeight: 500, minWidth: 36, textAlign: 'right' }}>{g.pct}%</span>
                    </div>
                  ))}
                </div>
              )}
              {/* Growth Opportunities */}
              {geo.growth.length > 0 && (
                <div style={{ background: V.surface, border: `1px solid ${V.border}`, borderRadius: 12, padding: 20 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: V.inkDisplay, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <TrendingUp size={14} style={{ color: V.info }} /> Growth Opportunities
                  </div>
                  {geo.growth.map((g, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < geo.growth.length - 1 ? `1px solid ${V.border}` : 'none' }}>
                      <span style={{ fontSize: 14, color: V.ink, fontWeight: 500 }}>{g.region}</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', background: 'rgba(37,99,235,0.12)', color: '#60A5FA' }}>
                        {g.status || g.label || 'Opportunity'}
                      </span>
                      <span style={{ fontFamily: fontFamily.mono, fontSize: 12, color: V.inkMuted, fontWeight: 500, minWidth: 48, textAlign: 'right' }}>{g.market_size}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════
            REPORT FOOTER
            ═══════════════════════════════════════════════════ */}
        <div style={{ textAlign: 'center', padding: '40px 0 24px', borderTop: `1px solid ${V.border}`, marginTop: 24 }}>
          <p style={{ fontSize: 12, color: V.inkMuted, margin: '0 0 8px' }}>
            Generated by {data.engine || 'BIQc Intelligence Engine'} &middot; Data accuracy: {data.confidence || '--'}% confidence &middot; Report ID: {data.report_id || '--'}
          </p>
          <p style={{ fontSize: 12, color: V.inkSubtle, margin: 0 }}>
            This report is confidential and intended for authorised personnel only. &copy; {new Date().getFullYear()} BIQc Pty Ltd. All rights reserved.
          </p>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════
          FLOATING PDF BUTTON
          ═══════════════════════════════════════════════════ */}
      <FloatingPDFButton onClick={handleDownloadPDF} />

      {/* Animation keyframes matching mockup */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes lava-shimmer {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @media (max-width: 767px) {
          /* Stack gauge grid on mobile */
          div[style*="gridTemplateColumns: '240px 1fr'"],
          div[style*="grid-template-columns: 240px 1fr"] {
            grid-template-columns: 1fr !important;
          }
        }
        @media print {
          .fab-pdf-btn { display: none !important; }
        }
      `}</style>
    </DashboardLayout>
  );
}

/** Floating action button for PDF download - appears on scroll */
function FloatingPDFButton({ onClick }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const y = window.pageYOffset || document.documentElement.scrollTop;
      setVisible(y > 200);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <button
      onClick={onClick}
      aria-label="Download PDF"
      className="fab-pdf-btn"
      style={{
        position: 'fixed', bottom: 32, right: 32, zIndex: 50,
        width: 56, height: 56, borderRadius: '50%', border: 'none',
        background: `linear-gradient(135deg, ${V.lava}, ${V.lavaDeep})`,
        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: `0 4px 20px rgba(232,93,0,0.4), 0 0 0 4px rgba(232,93,0,0.12)`,
        cursor: 'pointer',
        opacity: visible ? 1 : 0, pointerEvents: visible ? 'auto' : 'none',
        transition: 'opacity 0.3s ease, transform 0.2s ease, box-shadow 0.2s ease',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px) scale(1.05)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(232,93,0,0.5), 0 0 0 6px rgba(232,93,0,0.16)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(232,93,0,0.4), 0 0 0 4px rgba(232,93,0,0.12)'; }}
    >
      <Download size={24} />
      <span style={{ position: 'absolute', bottom: -20, fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', color: V.inkMuted }}>PDF</span>
    </button>
  );
}
