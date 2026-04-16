import { useState, useMemo, useEffect } from 'react';
import {
  FileText, Plus, Globe, ArrowRight, Clock, Loader2, AlertCircle
} from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
// Design tokens now referenced via CSS custom properties
import { apiClient } from '../lib/api';

/* ---------------------------------------------------------------
   CATEGORY CONFIG
   --------------------------------------------------------------- */
const CATEGORY_COLORS = {
  Competitor:  { bg: 'var(--danger-wash)', text: 'var(--danger)', accent: 'var(--danger)' },
  Market:      { bg: 'var(--info-wash)', text: 'var(--info)', accent: 'var(--info)' },
  Regulatory:  { bg: 'var(--surface-sunken)', text: 'var(--ink-secondary)', accent: 'var(--ink-secondary)' },
  Industry:    { bg: 'var(--positive-wash)', text: 'var(--positive)', accent: 'var(--positive)' },
  Technology:  { bg: 'var(--warning-wash)', text: 'var(--warning)', accent: 'var(--warning)' },
  finance:     { bg: 'var(--warning-wash)', text: 'var(--warning)', accent: 'var(--warning)' },
  sales:       { bg: 'var(--info-wash)', text: 'var(--info)', accent: 'var(--info)' },
  operations:  { bg: 'var(--positive-wash)', text: 'var(--positive)', accent: 'var(--positive)' },
  team:        { bg: 'var(--surface-sunken)', text: 'var(--ink-secondary)', accent: 'var(--ink-secondary)' },
  market:      { bg: 'var(--info-wash)', text: 'var(--info)', accent: 'var(--info)' },
};

const RELEVANCE_STYLES = {
  High:   { bg: 'var(--danger-wash)', text: 'var(--danger)' },
  Medium: { bg: 'var(--warning-wash)', text: 'var(--warning)' },
  Low:    { bg: 'var(--surface-sunken)', text: 'var(--ink-muted)' },
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
  const cardBg = 'var(--surface)';
  const borderColor = 'var(--border)';
  const lava = 'var(--lava)';

  return (
    <DashboardLayout>
      <div className="intel-centre-root" style={{ padding: '32px 32px 48px', maxWidth: 1280, margin: '0 auto' }}>

        {/* HEADER */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color: 'var(--ink-display)', letterSpacing: 'var(--ls-display)', margin: 0 }}>
            Intel Centre
          </h1>
          <button
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '10px 20px', borderRadius: 'var(--r-md)',
              background: 'linear-gradient(135deg, var(--lava), var(--lava-warm))',
              color: 'var(--ink-inverse)', fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-ui)',
              border: 'none', cursor: 'pointer',
              transition: 'box-shadow 0.2s, transform 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 8px 20px var(--lava-ring)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
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
            borderRadius: 'var(--r-xl)',
            padding: 20,
            marginBottom: 32,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: lava }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--lava-deep)', textTransform: 'uppercase', letterSpacing: 'var(--ls-caps)', fontFamily: 'var(--font-mono)' }}>
              AI Daily Intelligence Brief
            </span>
            <span style={{ fontSize: 12, color: 'var(--ink-muted)', marginLeft: 'auto', fontFamily: 'var(--font-ui)' }}>
              {formatToday()}
            </span>
          </div>
          <div style={{ fontSize: 14, color: 'var(--ink-secondary)', lineHeight: 1.6, fontFamily: 'var(--font-ui)' }}>
            {loading ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                Loading intelligence brief...
              </span>
            ) : briefText ? (
              <span>{briefText}</span>
            ) : (
              <span style={{ color: 'var(--ink-muted)' }}>
                No intelligence brief available yet. Connect integrations and enable monitoring to receive daily intelligence summaries.
              </span>
            )}
          </div>
          {briefText && !loading && (
            <button
              style={{
                marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 6,
                fontSize: 13, fontWeight: 600, color: lava, background: 'none', border: 'none',
                cursor: 'pointer', fontFamily: 'var(--font-ui)', padding: 0,
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
            background: 'var(--danger-wash)', border: '1px solid var(--danger)',
            borderRadius: 'var(--r-xl)', padding: 16, marginBottom: 24,
            fontSize: 13, color: 'var(--danger)', fontFamily: 'var(--font-ui)',
          }}>
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {/* 2-COLUMN LAYOUT: FEED + TRACKED */}
        <div className="intel-main-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, alignItems: 'start' }}>

          {/* LEFT: INTELLIGENCE FEED */}
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--ink-display)', marginBottom: 16, marginTop: 0 }}>
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
                      fontFamily: 'var(--font-mono)',
                      textTransform: 'uppercase',
                      letterSpacing: 'var(--ls-caps)',
                      color: isActive ? 'var(--ink-inverse)' : 'var(--ink-muted)',
                      background: isActive ? 'var(--ink-display)' : 'transparent',
                      border: 'none',
                      borderRadius: 999,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.background = 'var(--surface-sunken)'; e.currentTarget.style.color = 'var(--ink-display)'; } }}
                    onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ink-muted)'; } }}
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
                padding: 48, color: 'var(--ink-muted)', fontSize: 14, fontFamily: 'var(--font-ui)',
              }}>
                <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                Loading intelligence signals...
              </div>
            ) : filteredItems.length === 0 ? (
              <div style={{
                background: cardBg, border: '1px solid ' + borderColor,
                borderRadius: 'var(--r-xl)', padding: '32px 24px',
                textAlign: 'center', color: 'var(--ink-muted)', fontSize: 14,
                fontFamily: 'var(--font-ui)', lineHeight: 1.6,
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
                        borderRadius: 'var(--r-xl)',
                        padding: '16px 20px',
                        display: 'grid',
                        gridTemplateColumns: '1fr auto',
                        gap: 16,
                        alignItems: 'start',
                        cursor: 'pointer',
                        transition: 'border-color 0.15s, box-shadow 0.15s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-hover)'; e.currentTarget.style.boxShadow = 'var(--elev-2)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = borderColor; e.currentTarget.style.boxShadow = 'none'; }}
                    >
                      {/* Left content */}
                      <div>
                        {/* Category badge */}
                        <span
                          style={{
                            fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 'var(--ls-caps)',
                            padding: '3px 8px', borderRadius: 'var(--r-pill)',
                            display: 'inline-block', marginBottom: 8,
                            background: catColor.bg, color: catColor.text,
                            fontFamily: 'var(--font-mono)',
                          }}
                        >
                          {item.category}
                        </span>

                        {/* Title */}
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-display)', marginBottom: 4, lineHeight: 1.4, fontFamily: 'var(--font-ui)' }}>
                          {item.title}
                        </div>

                        {/* Summary */}
                        {item.summary !== item.title && (
                          <div style={{ fontSize: 13, color: 'var(--ink-secondary)', lineHeight: 1.5, fontFamily: 'var(--font-ui)' }}>
                            {item.summary}
                          </div>
                        )}

                        {/* Meta row: source + time + confidence + analyse button */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, fontSize: 12, color: 'var(--ink-muted)', fontFamily: 'var(--font-ui)' }}>
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
                            <span style={{ fontSize: 11, color: 'var(--ink-muted)' }}>
                              {Math.round(item.confidence * 100)}% confidence
                            </span>
                          )}
                          <button
                            style={{
                              marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4,
                              fontSize: 12, fontWeight: 600, color: lava,
                              background: 'none', border: 'none', cursor: 'pointer',
                              fontFamily: 'var(--font-ui)', padding: 0,
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
                          borderRadius: 'var(--r-pill)', whiteSpace: 'nowrap',
                          background: relStyle.bg, color: relStyle.text,
                          fontFamily: 'var(--font-mono)',
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
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--ink-display)', margin: 0 }}>
                Tracked Entities
              </h2>
              <button
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontSize: 12, fontWeight: 600, color: lava,
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontFamily: 'var(--font-ui)', padding: 0,
                }}
              >
                <Plus size={14} /> Add entity
              </button>
            </div>

            <div style={{
              background: cardBg, border: '1px solid ' + borderColor,
              borderRadius: 'var(--r-xl)', padding: '24px 20px',
              textAlign: 'center', color: 'var(--ink-muted)', fontSize: 14,
              fontFamily: 'var(--font-ui)', lineHeight: 1.6,
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
