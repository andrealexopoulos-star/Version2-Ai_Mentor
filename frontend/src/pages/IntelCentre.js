import { useState, useMemo, useEffect } from 'react';
import {
  FileText, Plus, Globe, ArrowRight, Clock, Loader2, AlertCircle
} from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { fontFamily, colors, radius } from '../design-system/tokens';
import { apiClient } from '../lib/api';

/* ---------------------------------------------------------------
   CATEGORY CONFIG
   --------------------------------------------------------------- */
const CATEGORY_COLORS = {
  Competitor:  { bg: '#FEE2E2', text: '#991B1B', accent: '#DC2626' },
  Market:      { bg: 'rgba(59,130,246,0.10)', text: '#2563EB', accent: '#2563EB' },
  Regulatory:  { bg: '#F3E8FF', text: '#7C3AED', accent: '#7C3AED' },
  Industry:    { bg: 'rgba(34,197,94,0.10)', text: '#16A34A', accent: '#0891B2' },
  Technology:  { bg: 'rgba(245,158,11,0.10)', text: '#D97706', accent: '#16A34A' },
  finance:     { bg: 'rgba(245,158,11,0.10)', text: '#D97706', accent: '#F59E0B' },
  sales:       { bg: 'rgba(59,130,246,0.10)', text: '#2563EB', accent: '#2563EB' },
  operations:  { bg: 'rgba(34,197,94,0.10)', text: '#16A34A', accent: '#16A34A' },
  team:        { bg: '#F3E8FF', text: '#7C3AED', accent: '#7C3AED' },
  market:      { bg: 'rgba(59,130,246,0.10)', text: '#2563EB', accent: '#2563EB' },
};

const RELEVANCE_STYLES = {
  High:   { bg: '#FEE2E2', text: '#991B1B' },
  Medium: { bg: '#FEF3C7', text: '#92400E' },
  Low:    { bg: 'rgba(140,170,210,0.08)', text: 'var(--ink-muted, #708499)' },
};

const TABS = ['All', 'Competitor', 'Market', 'Regulatory', 'Industry', 'Technology'];

/* ---------------------------------------------------------------
   MAP WATCHTOWER FINDING -> SIGNAL CARD
   --------------------------------------------------------------- */
const DOMAIN_TO_CATEGORY = {
  finance: 'Market',
  sales: 'Competitor',
  operations: 'Industry',
  team: 'Industry',
  market: 'Market',
};

const POSITION_TO_RELEVANCE = {
  CRITICAL: 'High',
  ELEVATED: 'High',
  WATCH: 'Medium',
  STABLE: 'Low',
};

function mapFindingToSignal(finding, idx) {
  const domain = (finding.domain || '').toLowerCase();
  const category = DOMAIN_TO_CATEGORY[domain] || 'Industry';
  const position = (finding.position || '').toUpperCase();
  const relevance = POSITION_TO_RELEVANCE[position] || 'Medium';

  const detectedAt = finding.detected_at || finding.created_at;
  let timeLabel = '';
  if (detectedAt) {
    const diff = Date.now() - new Date(detectedAt).getTime();
    if (diff < 3600000) timeLabel = Math.floor(diff / 60000) + 'm ago';
    else if (diff < 86400000) timeLabel = Math.floor(diff / 3600000) + 'h ago';
    else {
      const days = Math.floor(diff / 86400000);
      timeLabel = days === 1 ? 'Yesterday' : days + ' days ago';
    }
  }

  return {
    id: finding.id || idx,
    category,
    relevance,
    title: finding.finding || 'Watchtower signal detected',
    summary: finding.finding || '',
    source: 'Watchtower (' + (finding.domain || 'unknown') + ')',
    time: timeLabel,
    position: finding.position,
    confidence: finding.confidence,
    domain: finding.domain,
  };
}

/* ---------------------------------------------------------------
   HELPERS
   --------------------------------------------------------------- */
const formatToday = () => {
  const d = new Date();
  return d.toLocaleDateString('en-AU', { month: 'short', day: 'numeric', year: 'numeric' });
};

/* ---------------------------------------------------------------
   COMPONENT
   --------------------------------------------------------------- */
const IntelCentre = () => {
  const [activeTab, setActiveTab] = useState('All');
  const [signals, setSignals] = useState([]);
  const [briefText, setBriefText] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [findingsRes, snapshotRes] = await Promise.allSettled([
          apiClient.get('/watchtower/findings?limit=20'),
          apiClient.get('/snapshot/latest'),
        ]);

        if (cancelled) return;

        // Process findings
        if (findingsRes.status === 'fulfilled') {
          const findings = findingsRes.value.data?.findings || [];
          const mapped = findings.map(mapFindingToSignal);
          setSignals(mapped);
        }

        // Process snapshot for daily brief
        if (snapshotRes.status === 'fulfilled') {
          const cognitive = snapshotRes.value.data?.cognitive;
          if (cognitive) {
            const memo = cognitive.executive_memo;
            const rq = cognitive.resolution_queue || [];
            const openRisks = cognitive.open_risks || [];
            const highCount = rq.filter(r => r.severity === 'high' || r.severity === 'critical').length
              + openRisks.filter(r => r.severity === 'high' || r.severity === 'critical').length;

            if (memo) {
              setBriefText(memo);
            } else if (highCount > 0) {
              setBriefText(
                highCount + ' high-priority signal' + (highCount === 1 ? '' : 's')
                + ' detected. Review the intelligence feed below for details.'
              );
            } else if (rq.length > 0 || openRisks.length > 0) {
              setBriefText(
                (rq.length + openRisks.length) + ' active signal' + ((rq.length + openRisks.length) === 1 ? '' : 's')
                + ' in the resolution queue. No critical items at this time.'
              );
            }
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.response?.data?.detail || err?.message || 'Failed to load intelligence data.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadData();
    return () => { cancelled = true; };
  }, []);

  const filteredItems = useMemo(() => {
    if (activeTab === 'All') return signals;
    return signals.filter((item) => item.category === activeTab);
  }, [activeTab, signals]);

  /* shared styles */
  const cardBg = colors.bgCard;
  const borderColor = colors.border;
  const lava = colors.brand;

  return (
    <DashboardLayout>
      <div className="intel-centre-root" style={{ padding: '32px 32px 48px', maxWidth: 1280, margin: '0 auto' }}>

        {/* HEADER */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <h1 style={{ fontFamily: fontFamily.display, fontSize: 28, fontWeight: 700, color: colors.text, letterSpacing: '-0.02em', margin: 0 }}>
            Intel Centre
          </h1>
          <button
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '10px 20px', borderRadius: radius.badge,
              background: 'linear-gradient(135deg, ' + lava + ', #FF7A1A)',
              color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: fontFamily.body,
              border: 'none', cursor: 'pointer',
              transition: 'box-shadow 0.2s, transform 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(232,93,0,0.35)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}
          >
            <FileText size={16} />
            Generate Brief
          </button>
        </div>

        {/* AI DAILY BRIEF */}
        <div
          style={{
            background: cardBg,
            border: '1px solid ' + borderColor,
            borderLeft: '3px solid ' + lava,
            borderRadius: radius.card,
            padding: 20,
            marginBottom: 32,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: lava }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: colors.brandDark, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: fontFamily.mono }}>
              AI Daily Intelligence Brief
            </span>
            <span style={{ fontSize: 12, color: colors.textMuted, marginLeft: 'auto', fontFamily: fontFamily.body }}>
              {formatToday()}
            </span>
          </div>
          <div style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 1.6, fontFamily: fontFamily.body }}>
            {loading ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                Loading intelligence brief...
              </span>
            ) : briefText ? (
              <span>{briefText}</span>
            ) : (
              <span style={{ color: colors.textMuted }}>
                No intelligence brief available yet. Connect integrations and enable monitoring to receive daily intelligence summaries.
              </span>
            )}
          </div>
          {briefText && !loading && (
            <button
              style={{
                marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 6,
                fontSize: 13, fontWeight: 600, color: lava, background: 'none', border: 'none',
                cursor: 'pointer', fontFamily: fontFamily.body, padding: 0,
              }}
            >
              Read full brief <ArrowRight size={14} />
            </button>
          )}
        </div>

        {/* ERROR STATE */}
        {error && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: colors.dangerDim, border: '1px solid rgba(220,38,38,0.3)',
            borderRadius: radius.card, padding: 16, marginBottom: 24,
            fontSize: 13, color: '#F87171', fontFamily: fontFamily.body,
          }}>
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {/* 2-COLUMN LAYOUT: FEED + TRACKED */}
        <div className="intel-main-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, alignItems: 'start' }}>

          {/* LEFT: INTELLIGENCE FEED */}
          <div>
            <h2 style={{ fontFamily: fontFamily.display, fontSize: 22, fontWeight: 700, color: colors.text, marginBottom: 16, marginTop: 0 }}>
              Intelligence Feed
            </h2>

            {/* Tab pills */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
              {TABS.map((tab) => {
                const isActive = activeTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    style={{
                      padding: '6px 14px',
                      fontSize: 11,
                      fontWeight: 500,
                      fontFamily: fontFamily.mono,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      color: isActive ? '#fff' : colors.textMuted,
                      background: isActive ? '#1E293B' : 'transparent',
                      border: 'none',
                      borderRadius: 999,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.background = 'rgba(140,170,210,0.08)'; e.currentTarget.style.color = colors.text; } }}
                    onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = colors.textMuted; } }}
                  >
                    {tab}
                  </button>
                );
              })}
            </div>

            {/* Feed items */}
            {loading ? (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                padding: 48, color: colors.textMuted, fontSize: 14, fontFamily: fontFamily.body,
              }}>
                <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                Loading intelligence signals...
              </div>
            ) : filteredItems.length === 0 ? (
              <div style={{
                background: cardBg, border: '1px solid ' + borderColor,
                borderRadius: radius.card, padding: '32px 24px',
                textAlign: 'center', color: colors.textMuted, fontSize: 14,
                fontFamily: fontFamily.body, lineHeight: 1.6,
              }}>
                {signals.length === 0
                  ? 'No intelligence signals detected yet. Connect integrations and enable monitoring to receive signals.'
                  : 'No signals match the selected filter.'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {filteredItems.map((item) => {
                  const catColor = CATEGORY_COLORS[item.category] || CATEGORY_COLORS[item.domain] || CATEGORY_COLORS.Market;
                  const relStyle = RELEVANCE_STYLES[item.relevance] || RELEVANCE_STYLES.Low;
                  return (
                    <div
                      key={item.id}
                      className="intel-feed-item"
                      style={{
                        background: cardBg,
                        border: '1px solid ' + borderColor,
                        borderRadius: radius.card,
                        padding: '16px 20px',
                        display: 'grid',
                        gridTemplateColumns: '1fr auto',
                        gap: 16,
                        alignItems: 'start',
                        cursor: 'pointer',
                        transition: 'border-color 0.15s, box-shadow 0.15s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(140,170,210,0.3)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = borderColor; e.currentTarget.style.boxShadow = 'none'; }}
                    >
                      {/* Left content */}
                      <div>
                        {/* Category badge */}
                        <span
                          style={{
                            fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                            padding: '3px 8px', borderRadius: radius.full,
                            display: 'inline-block', marginBottom: 8,
                            background: catColor.bg, color: catColor.text,
                            fontFamily: fontFamily.mono,
                          }}
                        >
                          {item.category}
                        </span>

                        {/* Title */}
                        <div style={{ fontSize: 14, fontWeight: 600, color: colors.text, marginBottom: 4, lineHeight: 1.4, fontFamily: fontFamily.body }}>
                          {item.title}
                        </div>

                        {/* Summary */}
                        {item.summary !== item.title && (
                          <div style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 1.5, fontFamily: fontFamily.body }}>
                            {item.summary}
                          </div>
                        )}

                        {/* Meta row: source + time + confidence + analyse button */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, fontSize: 12, color: colors.textMuted, fontFamily: fontFamily.body }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Globe size={12} />
                            {item.source}
                          </span>
                          {item.time && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Clock size={12} />
                              {item.time}
                            </span>
                          )}
                          {item.confidence != null && (
                            <span style={{ fontSize: 11, color: colors.textMuted }}>
                              {Math.round(item.confidence * 100)}% confidence
                            </span>
                          )}
                          <button
                            style={{
                              marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4,
                              fontSize: 12, fontWeight: 600, color: lava,
                              background: 'none', border: 'none', cursor: 'pointer',
                              fontFamily: fontFamily.body, padding: 0,
                            }}
                          >
                            Analyse <ArrowRight size={12} />
                          </button>
                        </div>
                      </div>

                      {/* Relevance badge */}
                      <span
                        style={{
                          fontSize: 10, fontWeight: 700, padding: '3px 8px',
                          borderRadius: radius.full, whiteSpace: 'nowrap',
                          background: relStyle.bg, color: relStyle.text,
                          fontFamily: fontFamily.mono,
                        }}
                      >
                        {item.relevance}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* RIGHT: TRACKED ENTITIES */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ fontFamily: fontFamily.display, fontSize: 22, fontWeight: 700, color: colors.text, margin: 0 }}>
                Tracked Entities
              </h2>
              <button
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontSize: 12, fontWeight: 600, color: lava,
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontFamily: fontFamily.body, padding: 0,
                }}
              >
                <Plus size={14} /> Add entity
              </button>
            </div>

            <div style={{
              background: cardBg, border: '1px solid ' + borderColor,
              borderRadius: radius.card, padding: '24px 20px',
              textAlign: 'center', color: colors.textMuted, fontSize: 14,
              fontFamily: fontFamily.body, lineHeight: 1.6,
            }}>
              No entities tracked yet. Add competitors or partners to monitor.
            </div>
          </div>
        </div>

      </div>

      {/* RESPONSIVE: stack columns on mobile */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @media (max-width: 900px) {
          .intel-main-grid {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 640px) {
          .intel-centre-root {
            padding: 16px 16px 32px !important;
          }
          .intel-feed-item {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </DashboardLayout>
  );
};

export default IntelCentre;
