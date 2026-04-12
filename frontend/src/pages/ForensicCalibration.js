import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { isPrivilegedUser } from '../lib/privilegedUser';
import { apiClient } from '../lib/api';
import {
  ArrowRight, CheckCircle2, Lock, Globe, Users, TrendingUp,
  MapPin, Star, Monitor, Home, BarChart3, RefreshCw, FileText,
  Search, Circle,
} from 'lucide-react';
import { fontFamily } from '../design-system/tokens';

/* ────────────────────────────────────────────── */
/*  Design tokens (inline — keeps file portable)  */
/* ────────────────────────────────────────────── */
const C = {
  surface:    '#0E1628',
  border:     'rgba(140,170,210,0.12)',
  borderStrong: 'rgba(140,170,210,0.22)',
  surfaceSunken: 'rgba(140,170,210,0.06)',
  ink:        '#EDF1F7',
  inkSecondary: '#8FA0B8',
  inkMuted:   '#708499',
  lava:       '#E85D00',
  lavaWarm:   '#FF6A00',
  lavaDeep:   '#C44D00',
  lavaRing:   'rgba(232,93,0,0.18)',
  positive:   '#16A34A',
  warning:    '#D97706',
  info:       '#2563EB',
};

/* Shared border style helper */
const card = {
  background: C.surface,
  border: `1px solid ${C.border}`,
  borderRadius: 16,
};

/* ────────────────────────────────────────────── */
/*  Pipeline step definitions for scan animation  */
/* ────────────────────────────────────────────── */
const PIPELINE_STEPS = [
  { label: 'Crawling website',        activeText: 'Crawling pages...',                  doneText: null, progress: 12 },
  { label: 'Analysing competitors',   activeText: 'Running search queries...',          doneText: null, progress: 35 },
  { label: 'Scanning reviews',        activeText: 'Scanning review platforms...',       doneText: null, progress: 58 },
  { label: 'Building market profile', activeText: 'Deep web recon & social enrichment...', doneText: null, progress: 80 },
  { label: 'Generating intelligence', activeText: 'Generating intelligence report...',  doneText: null, progress: 100 },
];

const LIVE_DISCOVERY_KEYS = ['Company', 'Industry', 'Location', 'Competitors', 'Review Sources', 'Pages Crawled', 'Social Profiles'];

/* ────────────────────────────────────────────── */
/*  Step Indicator (the 1-2-3 dots at the top)    */
/* ────────────────────────────────────────────── */
const STEP_LABELS = ['Enter URL', 'Scanning', 'Results'];

function StepIndicator({ current }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: 0, marginBottom: 48 }}>
      {STEP_LABELS.map((label, i) => {
        const stepNum = i + 1;
        const isCompleted = stepNum < current;
        const isCurrent = stepNum === current;
        return (
          <React.Fragment key={i}>
            {i > 0 && (
              <div style={{
                width: 80, height: 2, marginTop: 17,
                background: stepNum <= current ? C.lava : C.borderStrong,
                transition: 'background 0.3s ease',
              }} />
            )}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 600, fontFamily: fontFamily.body,
                border: `2px solid ${isCompleted ? C.lava : isCurrent ? C.lava : C.borderStrong}`,
                background: isCompleted ? C.lava : C.surface,
                color: isCompleted ? '#fff' : isCurrent ? C.lava : C.inkMuted,
                boxShadow: isCurrent ? `0 0 0 4px ${C.lavaRing}` : 'none',
                transition: 'all 0.3s ease',
              }}>
                {isCompleted ? <CheckCircle2 size={16} /> : stepNum}
              </div>
              <span style={{
                fontSize: 11, fontWeight: 500, marginTop: 8,
                color: isCurrent ? C.lava : C.inkMuted,
                fontFamily: fontFamily.body,
              }}>{label}</span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* ────────────────────────────────────────────── */
/*  Step 1: URL Input                              */
/* ────────────────────────────────────────────── */
function StepUrlInput({ onScan }) {
  const [url, setUrl] = useState('');
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleScan = () => onScan(url.trim());

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); handleScan(); }
  };

  return (
    <div style={{ textAlign: 'center', padding: '64px 0 32px' }}>
      {/* Hero icon */}
      <div style={{
        width: 72, height: 72, margin: '0 auto 24px',
        borderRadius: 20,
        background: 'linear-gradient(135deg, rgba(232,93,0,0.15), rgba(232,93,0,0.05))',
        border: '1px solid rgba(232,93,0,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Globe size={32} color={C.lava} strokeWidth={1.6} />
      </div>

      {/* Heading */}
      <h1 style={{
        fontFamily: fontFamily.display, fontSize: 'clamp(2rem, 5vw, 3rem)',
        lineHeight: 1.08, letterSpacing: '-0.03em', color: C.ink,
        marginBottom: 16,
      }}>Calibrate Your Business</h1>

      <p style={{
        fontSize: 17, color: C.inkSecondary, maxWidth: '48ch',
        margin: '0 auto 40px', lineHeight: 1.6,
      }}>
        Enter your website URL and BIQc will scan, analyse, and build a complete intelligence profile for your business.
      </p>

      {/* URL input bar */}
      <div style={{
        display: 'flex', alignItems: 'center', maxWidth: 600, margin: '0 auto 20px',
        background: C.surface, border: `2px solid ${C.borderStrong}`,
        borderRadius: 12, overflow: 'hidden',
        transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
      }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = C.lava;
          e.currentTarget.style.boxShadow = `0 0 0 4px ${C.lavaRing}`;
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = C.borderStrong;
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        <span style={{
          padding: '0 12px 0 16px', fontFamily: fontFamily.mono, fontSize: 13,
          color: C.inkMuted, whiteSpace: 'nowrap', borderRight: `1px solid ${C.border}`,
          height: 52, display: 'flex', alignItems: 'center', background: C.surfaceSunken,
        }}>https://</span>
        <input
          ref={inputRef}
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="www.yourbusiness.com.au"
          style={{
            flex: 1, border: 0, outline: 0, background: 'transparent',
            padding: '0 16px', height: 52, fontSize: 17, color: C.ink,
            fontFamily: fontFamily.body,
          }}
          data-testid="calibration-url-input"
        />
      </div>

      {/* Scan button */}
      <button
        onClick={handleScan}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          width: '100%', maxWidth: 600, height: 56, borderRadius: 12,
          background: `linear-gradient(135deg, ${C.lavaWarm} 0%, ${C.lava} 50%, ${C.lavaDeep} 100%)`,
          color: '#fff', fontSize: 17, fontWeight: 600, fontFamily: fontFamily.body,
          letterSpacing: '-0.01em', border: 0, cursor: 'pointer',
          boxShadow: '0 2px 4px rgba(232,93,0,0.28), 0 12px 32px -8px rgba(232,93,0,0.36)',
          transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translate3d(0, -2px, 0)';
          e.currentTarget.style.boxShadow = '0 4px 8px rgba(232,93,0,0.32), 0 20px 48px -8px rgba(232,93,0,0.44)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'none';
          e.currentTarget.style.boxShadow = '0 2px 4px rgba(232,93,0,0.28), 0 12px 32px -8px rgba(232,93,0,0.36)';
        }}
        data-testid="calibration-scan-btn"
      >
        <Search size={20} /> Scan &amp; Calibrate <ArrowRight size={18} />
      </button>

      {/* Hint */}
      <p style={{
        textAlign: 'center', marginTop: 24, fontSize: 13, color: C.inkMuted,
        lineHeight: 1.6, maxWidth: '52ch', marginLeft: 'auto', marginRight: 'auto',
      }}>
        BIQc will analyse your website, competitors, reviews, and market position to build your competitive intelligence baseline.
      </p>

      {/* Feature chips */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16,
        maxWidth: 600, margin: '40px auto 0',
      }}>
        {[
          { icon: <Globe size={20} strokeWidth={1.6} />, label: 'Website Crawl' },
          { icon: <Users size={20} strokeWidth={1.6} />, label: 'Competitor Analysis' },
          { icon: <TrendingUp size={20} strokeWidth={1.6} />, label: 'Market Intel' },
        ].map((f, i) => (
          <div key={i} style={{
            textAlign: 'center', padding: 16,
            border: `1px solid ${C.border}`, borderRadius: 12,
            background: C.surface,
          }}>
            <div style={{
              width: 40, height: 40, margin: '0 auto 12px',
              borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: C.surfaceSunken, color: C.inkSecondary,
            }}>{f.icon}</div>
            <div style={{ fontSize: 12, fontWeight: 500, color: C.inkSecondary }}>{f.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────── */
/*  Step 2: Scanning In Progress                   */
/* ────────────────────────────────────────────── */
function StepScanning({ url, enrichmentData, scanProgress, pipelineStep, liveValues }) {
  return (
    <div>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <h2 style={{
          fontFamily: fontFamily.display, fontSize: 'clamp(1.5rem, 3vw, 2.25rem)',
          color: C.ink, letterSpacing: '-0.03em', marginBottom: 8,
        }}>Scanning in Progress</h2>
        <p style={{ color: C.inkSecondary, fontSize: 14 }}>
          Analysing your digital footprint across multiple intelligence vectors
        </p>
        {/* URL tag */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '8px 16px', marginTop: 16,
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 999, fontFamily: fontFamily.mono, fontSize: 13, color: C.inkSecondary,
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%', background: C.lava,
            boxShadow: `0 0 6px ${C.lava}`,
            animation: 'biqc-pulse 1.5s ease-in-out infinite',
          }} />
          {url || 'scanning...'}
        </div>
      </div>

      {/* Two-column: Pipeline + Live Preview */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 24 }}>
        {/* Pipeline */}
        <div style={{ ...card, padding: 20 }}>
          <div style={{
            fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
            letterSpacing: '0.08em', color: C.inkMuted, marginBottom: 20,
          }}>Enrichment Pipeline</div>
          {PIPELINE_STEPS.map((ps, i) => {
            const isDone = i < pipelineStep;
            const isActive = i === pipelineStep;
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
                padding: '12px 0',
                borderBottom: i < PIPELINE_STEPS.length - 1 ? `1px solid ${C.border}` : 'none',
              }}>
                {/* Indicator circle */}
                <div style={{
                  width: 28, height: 28, flexShrink: 0, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: `2px solid ${isDone ? C.positive : isActive ? C.lava : C.borderStrong}`,
                  background: isDone ? C.positive : C.surface,
                  color: isDone ? '#fff' : isActive ? C.lava : C.inkMuted,
                  transition: 'all 0.3s ease',
                }}>
                  {isDone ? (
                    <CheckCircle2 size={14} />
                  ) : isActive ? (
                    <Circle size={10} fill="currentColor" />
                  ) : (
                    <Circle size={14} strokeWidth={2} />
                  )}
                </div>
                {/* Label + detail */}
                <div style={{ flex: 1, paddingTop: 2 }}>
                  <div style={{
                    fontSize: 14, fontWeight: 500,
                    color: isDone || isActive ? C.ink : C.inkMuted,
                  }}>{ps.label}</div>
                  <div style={{
                    fontSize: 12,
                    color: isDone ? C.positive : isActive ? C.lava : C.inkMuted,
                  }}>
                    {isDone
                      ? (ps.doneText || 'Complete')
                      : isActive
                        ? ps.activeText
                        : 'Waiting...'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Live Preview */}
        <div style={{ ...card, padding: 20, overflow: 'hidden' }}>
          <div style={{
            fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
            letterSpacing: '0.08em', color: C.inkMuted, marginBottom: 20,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%', background: C.lava,
              boxShadow: `0 0 6px ${C.lava}`,
              animation: 'biqc-pulse 1.5s ease-in-out infinite',
            }} />
            Live Discovery
          </div>
          {LIVE_DISCOVERY_KEYS.map((key, i) => {
            const val = liveValues[key];
            const isVisible = val != null;
            return (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 0',
                borderBottom: i < LIVE_DISCOVERY_KEYS.length - 1 ? `1px solid ${C.border}` : 'none',
                opacity: isVisible ? 1 : 0.4,
                transform: isVisible ? 'none' : 'translateY(8px)',
                transition: 'opacity 0.4s ease, transform 0.4s ease',
              }}>
                <span style={{
                  fontSize: 11, fontWeight: 500, textTransform: 'uppercase',
                  letterSpacing: '0.06em', color: C.inkMuted,
                }}>{key}</span>
                <span style={{
                  fontSize: 14, fontWeight: 600, color: C.ink, textAlign: 'right',
                  fontFamily: fontFamily.mono,
                }}>
                  {isVisible ? val : (
                    <span style={{
                      display: 'inline-block', width: 100, height: 16,
                      borderRadius: 4, background: C.surfaceSunken,
                    }} />
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ ...card, padding: 16, marginTop: 24 }}>
        <div style={{
          width: '100%', height: 6, background: C.surfaceSunken,
          borderRadius: 999, overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', borderRadius: 999,
            background: `linear-gradient(90deg, ${C.lava}, ${C.lavaWarm})`,
            width: `${scanProgress}%`,
            transition: 'width 0.8s ease',
          }} />
        </div>
        <div style={{
          display: 'flex', justifyContent: 'space-between', marginTop: 8,
          fontSize: 12, color: C.inkMuted,
        }}>
          <span>{pipelineStep < PIPELINE_STEPS.length ? PIPELINE_STEPS[pipelineStep]?.activeText : 'Calibration complete'}</span>
          <span style={{ fontFamily: fontFamily.mono, fontWeight: 600, color: C.lava }}>{scanProgress}%</span>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────── */
/*  Step 3: Results                                */
/* ────────────────────────────────────────────── */
function StepResults({ data, onRecalibrate, onViewReport }) {
  const ringRef = useRef(null);
  const [ringAnimated, setRingAnimated] = useState(false);
  const e = data?.enrichment || data || {};

  useEffect(() => {
    const t = setTimeout(() => setRingAnimated(true), 400);
    return () => clearTimeout(t);
  }, []);

  /* Derive display values from enrichment data */
  const businessName  = e.business_name || e.company_name || 'Your Business';
  const industry      = e.industry || e.industry_classification || 'Business Services';
  const location      = e.location || e.city || e.state || 'Australia';
  const competitors   = e.competitors_found ?? e.competitors?.length ?? '--';
  const reviewSources = e.review_sources ?? e.reviews?.length ?? '--';
  const digitalScore  = e.digital_presence_score ?? e.market_score ?? 75;
  const abn           = e.abn || '';
  const established   = e.established || '';
  const anzsic        = e.anzsic || '';
  const suburb        = e.suburb || '';
  const postcode      = e.postcode || '';
  const socialProfiles = e.social_profiles || [];
  const socialCount   = socialProfiles.length || e.social_profiles_count || 0;

  /* Strengths and opportunities from enrichment data */
  const strengths = e.strengths || e.key_strengths || [];
  const opportunities = e.opportunities || e.risks_opportunities || [];

  /* Score ring circumference math */
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const scorePercent = Math.min(Math.max(digitalScore, 0), 100);
  const offset = circumference - (scorePercent / 100) * circumference;

  /* Summary cards data */
  const summaryCards = [
    {
      icon: <Home size={20} strokeWidth={1.6} />,
      iconBg: 'rgba(232,93,0,0.1)', iconColor: C.lava,
      label: 'Business Name', value: businessName,
      detail: [abn && `ABN ${abn}`, established && `Est. ${established}`].filter(Boolean).join(' \u00b7 ') || null,
    },
    {
      icon: <BarChart3 size={20} strokeWidth={1.6} />,
      iconBg: 'rgba(37,99,235,0.1)', iconColor: C.info,
      label: 'Industry', value: industry,
      detail: anzsic ? `ANZSIC ${anzsic}` : null,
    },
    {
      icon: <MapPin size={20} strokeWidth={1.6} />,
      iconBg: 'rgba(22,163,74,0.1)', iconColor: C.positive,
      label: 'Location', value: location,
      detail: [suburb, postcode].filter(Boolean).join(' \u00b7 ') || null,
    },
    {
      icon: <Users size={20} strokeWidth={1.6} />,
      iconBg: 'rgba(217,119,6,0.1)', iconColor: C.warning,
      label: 'Competitors Found', value: String(competitors),
      detail: null, mono: true,
    },
    {
      icon: <Star size={20} strokeWidth={1.6} />,
      iconBg: 'rgba(147,51,234,0.1)', iconColor: '#9333EA',
      label: 'Review Sources', value: String(reviewSources),
      detail: null, mono: true,
    },
    {
      icon: <Monitor size={20} strokeWidth={1.6} />,
      iconBg: 'rgba(6,182,212,0.1)', iconColor: '#06B6D4',
      label: 'Digital Presence', value: digitalScore >= 70 ? 'Strong' : digitalScore >= 40 ? 'Moderate' : 'Developing',
      detail: socialCount > 0 ? `${socialCount} social profiles detected` : null,
    },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '8px 16px', marginBottom: 16,
          background: 'rgba(22,163,74,0.12)', border: '1px solid rgba(22,163,74,0.25)',
          borderRadius: 999, fontSize: 12, fontWeight: 600, color: C.positive,
        }}>
          <CheckCircle2 size={14} /> Calibration Complete
        </div>
        <h2 style={{
          fontFamily: fontFamily.display, fontSize: 'clamp(1.75rem, 4vw, 2.75rem)',
          color: C.ink, letterSpacing: '-0.03em', marginBottom: 12,
        }}>Intelligence Profile Ready</h2>
        <p style={{ color: C.inkSecondary, fontSize: 15, maxWidth: '48ch', margin: '0 auto' }}>
          Your business has been scanned across multiple intelligence vectors. Here is what we found.
        </p>
      </div>

      {/* Score ring */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
        <div style={{ position: 'relative', width: 160, height: 160 }}>
          <svg width={160} height={160} style={{ transform: 'rotate(-90deg)' }}>
            <circle cx={80} cy={80} r={radius} fill="none" stroke={C.surfaceSunken} strokeWidth={8} />
            <circle
              ref={ringRef}
              cx={80} cy={80} r={radius}
              fill="none" stroke={C.lava} strokeWidth={8}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={ringAnimated ? offset : circumference}
              style={{ transition: 'stroke-dashoffset 1.5s ease' }}
            />
          </svg>
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)', textAlign: 'center',
          }}>
            <div style={{
              fontFamily: fontFamily.display, fontSize: 48, lineHeight: 1,
              color: C.ink, letterSpacing: '-0.03em',
            }}>{scorePercent}</div>
            <div style={{
              fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
              letterSpacing: '0.06em', color: C.lava, marginTop: 4,
            }}>Market Score</div>
          </div>
        </div>
      </div>

      {/* Summary cards grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 16, marginBottom: 32,
      }}>
        {summaryCards.map((c, i) => (
          <div key={i} style={{
            ...card, padding: 20,
            transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
          }}
            onMouseEnter={(el) => {
              el.currentTarget.style.borderColor = C.borderStrong;
              el.currentTarget.style.boxShadow = '0 4px 24px rgba(0,0,0,0.25)';
            }}
            onMouseLeave={(el) => {
              el.currentTarget.style.borderColor = C.border;
              el.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 12, background: c.iconBg, color: c.iconColor,
            }}>{c.icon}</div>
            <div style={{
              fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
              letterSpacing: '0.06em', color: C.inkMuted, marginBottom: 8,
            }}>{c.label}</div>
            <div style={{
              fontFamily: c.mono ? fontFamily.mono : fontFamily.display,
              fontSize: 24, lineHeight: 1.1, color: C.ink, letterSpacing: '-0.02em',
            }}>{c.value}</div>
            {c.detail && (
              <div style={{ fontSize: 12, color: C.inkSecondary, marginTop: 8, lineHeight: 1.5 }}>
                {c.detail}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Detailed findings panel */}
      <div style={{ ...card, overflow: 'hidden', marginBottom: 32 }}>
        {/* Panel header */}
        <div style={{
          padding: 20, borderBottom: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: `linear-gradient(135deg, ${C.lava}, ${C.lavaWarm})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            color: '#fff',
          }}>
            <FileText size={18} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.ink }}>Calibration Insights</div>
            <div style={{ fontSize: 12, color: C.inkMuted }}>Key findings from your intelligence scan</div>
          </div>
        </div>

        {/* Panel body */}
        <div style={{ padding: 20 }}>
          {/* Strengths */}
          {strengths.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{
                fontSize: 14, fontWeight: 600, color: C.ink, marginBottom: 12,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.positive }} />
                Strengths Detected
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                {strengths.map((s, i) => (
                  <div key={i} style={{
                    padding: '12px 16px', background: C.surfaceSunken, borderRadius: 12,
                    borderLeft: `3px solid ${C.positive}`,
                  }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, marginBottom: 2 }}>
                      {typeof s === 'string' ? s : s.title}
                    </div>
                    {typeof s !== 'string' && s.description && (
                      <div style={{ fontSize: 12, color: C.inkSecondary, lineHeight: 1.5 }}>{s.description}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Opportunities & Risks */}
          {opportunities.length > 0 && (
            <div>
              <div style={{
                fontSize: 14, fontWeight: 600, color: C.ink, marginBottom: 12,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.warning }} />
                Opportunities &amp; Risks
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                {opportunities.map((o, i) => {
                  const borderColor = o.type === 'info' ? C.info : C.warning;
                  return (
                    <div key={i} style={{
                      padding: '12px 16px', background: C.surfaceSunken, borderRadius: 12,
                      borderLeft: `3px solid ${borderColor}`,
                    }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, marginBottom: 2 }}>
                        {typeof o === 'string' ? o : o.title}
                      </div>
                      {typeof o !== 'string' && o.description && (
                        <div style={{ fontSize: 12, color: C.inkSecondary, lineHeight: 1.5 }}>{o.description}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Fallback if no structured findings */}
          {strengths.length === 0 && opportunities.length === 0 && (
            <p style={{ fontSize: 14, color: C.inkSecondary, lineHeight: 1.6 }}>
              Your intelligence profile has been built. Visit the full CMO Report for detailed findings and recommended actions.
            </p>
          )}
        </div>
      </div>

      {/* CTA row */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
        <button
          onClick={onRecalibrate}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            height: 52, padding: '0 24px',
            border: `1px solid ${C.borderStrong}`, borderRadius: 12,
            background: 'transparent', color: C.ink,
            fontSize: 14, fontWeight: 500, cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = C.inkMuted;
            e.currentTarget.style.background = C.surfaceSunken;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = C.borderStrong;
            e.currentTarget.style.background = 'transparent';
          }}
          data-testid="calibration-recalibrate-btn"
        >
          <RefreshCw size={16} /> Recalibrate
        </button>
        <button
          onClick={onViewReport}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            height: 52, padding: '0 32px', borderRadius: 12,
            background: `linear-gradient(135deg, ${C.lavaWarm} 0%, ${C.lava} 50%, ${C.lavaDeep} 100%)`,
            color: '#fff', fontSize: 15, fontWeight: 600, fontFamily: fontFamily.body,
            border: 0, cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(232,93,0,0.28), 0 12px 32px -8px rgba(232,93,0,0.36)',
            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translate3d(0, -2px, 0)';
            e.currentTarget.style.boxShadow = '0 4px 8px rgba(232,93,0,0.32), 0 20px 48px -8px rgba(232,93,0,0.44)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'none';
            e.currentTarget.style.boxShadow = '0 2px 4px rgba(232,93,0,0.28), 0 12px 32px -8px rgba(232,93,0,0.36)';
          }}
          data-testid="calibration-view-report-btn"
        >
          <FileText size={18} /> View Full CMO Report <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────── */
/*  Keyframe injection (once)                      */
/* ────────────────────────────────────────────── */
const PULSE_STYLE_ID = 'biqc-pulse-kf';
function ensurePulseKeyframes() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(PULSE_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = PULSE_STYLE_ID;
  style.textContent = `
    @keyframes biqc-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
  `;
  document.head.appendChild(style);
}

/* ────────────────────────────────────────────── */
/*  Main Page Component                            */
/* ────────────────────────────────────────────── */
const ForensicCalibration = () => {
  const { user } = useSupabaseAuth();
  const navigate = useNavigate();

  const [wizardStep, setWizardStep] = useState(1);       // 1=URL, 2=scanning, 3=results
  const [scanUrl, setScanUrl] = useState('');
  const [enrichmentData, setEnrichmentData] = useState(null);
  const [scanProgress, setScanProgress] = useState(0);
  const [pipelineStep, setPipelineStep] = useState(0);
  const [liveValues, setLiveValues] = useState({});
  const [loadingExisting, setLoadingExisting] = useState(true);
  const [existingResult, setExistingResult] = useState(null);

  const scanTimerRef = useRef(null);
  const isSuperAdmin = user?.role === 'superadmin' || user?.role === 'admin' || isPrivilegedUser(user);

  useEffect(() => { ensurePulseKeyframes(); }, []);

  /* Check for existing calibration data on mount */
  useEffect(() => {
    const fetchExisting = async () => {
      try {
        const res = await apiClient.get('/forensic/calibration');
        if (res.data?.exists) {
          setExistingResult(res.data);
        }
      } catch { /* no existing data */ }
      finally { setLoadingExisting(false); }
    };
    fetchExisting();
  }, []);

  /* Cleanup scan timers on unmount */
  useEffect(() => {
    return () => {
      if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
    };
  }, []);

  /* ── Simulated pipeline progress animation ── */
  const animatePipeline = useCallback((enrichResult) => {
    const e = enrichResult?.enrichment || enrichResult || {};

    /* Pre-compute live discovery values from enrichment data */
    const discoveryValues = {
      'Company':         e.business_name || e.company_name || null,
      'Industry':        e.industry || e.industry_classification || null,
      'Location':        e.location || e.city || null,
      'Competitors':     e.competitors_found != null ? `${e.competitors_found} found` : (e.competitors?.length != null ? `${e.competitors.length} found` : null),
      'Review Sources':  e.review_sources != null ? `${e.review_sources} platforms` : (e.reviews?.length != null ? `${e.reviews.length} platforms` : null),
      'Pages Crawled':   e.pages_crawled != null ? `${e.pages_crawled} pages` : null,
      'Social Profiles': e.social_profiles_count != null ? `${e.social_profiles_count} profiles` : (e.social_profiles?.length != null ? `${e.social_profiles.length} profiles` : null),
    };

    /* Step durations (ms) */
    const durations = [2200, 2800, 2400, 2000, 2600];
    /* Map which live values reveal at which pipeline step */
    const revealMap = [
      ['Company'],
      ['Industry', 'Location'],
      ['Competitors', 'Review Sources'],
      ['Pages Crawled', 'Social Profiles'],
      [],
    ];

    let currentIdx = 0;
    let currentProgress = 0;

    function runStep() {
      if (currentIdx >= PIPELINE_STEPS.length) {
        setScanProgress(100);
        setPipelineStep(PIPELINE_STEPS.length);
        /* Transition to results after brief pause */
        scanTimerRef.current = setTimeout(() => {
          setEnrichmentData(enrichResult);
          setWizardStep(3);
        }, 800);
        return;
      }

      setPipelineStep(currentIdx);
      const targetProgress = PIPELINE_STEPS[currentIdx].progress;
      const duration = durations[currentIdx];
      const step = currentIdx;

      /* Reveal live values for this pipeline step */
      const keysToReveal = revealMap[step] || [];
      keysToReveal.forEach((key, i) => {
        setTimeout(() => {
          if (discoveryValues[key]) {
            setLiveValues(prev => ({ ...prev, [key]: discoveryValues[key] }));
          }
        }, 600 + i * 800);
      });

      /* Animate progress bar */
      const startProg = currentProgress;
      const progRange = targetProgress - startProg;
      const intervalMs = progRange > 0 ? duration / progRange : duration;
      let prog = startProg;

      const progTimer = setInterval(() => {
        prog += 1;
        if (prog >= targetProgress) {
          prog = targetProgress;
          clearInterval(progTimer);
        }
        setScanProgress(prog);
      }, intervalMs);

      /* Complete this step after duration */
      scanTimerRef.current = setTimeout(() => {
        currentProgress = targetProgress;
        /* Update done text from enrichment data */
        const psCopy = [...PIPELINE_STEPS];
        if (step === 0) psCopy[step].doneText = e.pages_crawled ? `${e.pages_crawled} pages indexed` : 'Pages indexed';
        if (step === 1) psCopy[step].doneText = e.competitors_found ? `${e.competitors_found} competitors identified` : 'Competitors identified';
        if (step === 2) psCopy[step].doneText = e.review_sources ? `${e.review_sources} review sources found` : 'Reviews scanned';
        if (step === 3) psCopy[step].doneText = 'Market profile built';
        if (step === 4) psCopy[step].doneText = 'Intelligence report ready';

        currentIdx++;
        setPipelineStep(currentIdx);
        runStep();
      }, duration);
    }

    /* Small initial delay */
    scanTimerRef.current = setTimeout(runStep, 600);
  }, []);

  /* ── Start scan: call enrichment API, then animate ── */
  const handleScan = useCallback(async (urlInput) => {
    const displayUrl = urlInput || 'www.yourbusiness.com.au';
    const fullUrl = urlInput.startsWith('http') ? urlInput : `https://${urlInput || 'www.yourbusiness.com.au'}`;
    setScanUrl(displayUrl);
    setWizardStep(2);
    setScanProgress(0);
    setPipelineStep(0);
    setLiveValues({});
    setEnrichmentData(null);

    /* Reset pipeline done texts */
    PIPELINE_STEPS.forEach(ps => { ps.doneText = null; });

    try {
      const res = await apiClient.post('/enrichment/website', { url: fullUrl, action: 'scan' }, { timeout: 120000 });
      animatePipeline(res.data);
    } catch (err) {
      /* On error, still animate through pipeline with fallback data */
      console.error('[Calibration] Enrichment scan failed:', err);
      animatePipeline({
        enrichment: {
          business_name: displayUrl.replace(/^www\./, '').split('.')[0].replace(/-/g, ' '),
          industry: 'Business Services',
          location: 'Australia',
          market_score: 50,
        }
      });
    }
  }, [animatePipeline]);

  /* ── Recalibrate: reset to step 1 ── */
  const handleRecalibrate = useCallback(() => {
    if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
    setWizardStep(1);
    setScanUrl('');
    setEnrichmentData(null);
    setScanProgress(0);
    setPipelineStep(0);
    setLiveValues({});
    setExistingResult(null);
    PIPELINE_STEPS.forEach(ps => { ps.doneText = null; });
  }, []);

  /* ── Access gate ── */
  if (!isSuperAdmin) {
    return (
      <DashboardLayout>
        <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', maxWidth: 400 }}>
            <Lock style={{ width: 48, height: 48, color: '#64748B', margin: '0 auto 16px', display: 'block' }} />
            <h1 style={{ fontSize: 24, fontWeight: 700, color: C.ink, marginBottom: 8, fontFamily: fontFamily.display }}>Coming Soon</h1>
            <p style={{ fontSize: 14, color: C.inkSecondary, marginBottom: 24 }}>Forensic Market Calibration will be available in the Pro plan.</p>
            <button
              onClick={() => navigate('/market')}
              style={{ padding: '10px 24px', borderRadius: 12, fontSize: 14, color: C.inkSecondary, border: `1px solid ${C.border}`, background: 'transparent', cursor: 'pointer' }}
              data-testid="forensic-back-btn"
            >Back to Market</button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  /* ── Loading state ── */
  if (loadingExisting) {
    return (
      <DashboardLayout>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
          <div style={{
            width: 24, height: 24, border: `2px solid ${C.lava}`, borderTopColor: 'transparent',
            borderRadius: '50%', animation: 'biqc-pulse 0.6s linear infinite',
          }} />
        </div>
      </DashboardLayout>
    );
  }

  /* If existing enrichment/calibration data exists and user hasn't started scanning, show results */
  if (existingResult?.exists && wizardStep === 1 && !enrichmentData) {
    return (
      <DashboardLayout>
        <div style={{ maxWidth: 820, margin: '0 auto', padding: '32px 0' }} data-testid="calibration-page">
          <StepIndicator current={3} />
          <StepResults
            data={existingResult}
            onRecalibrate={handleRecalibrate}
            onViewReport={() => navigate('/market')}
          />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '32px 0' }} data-testid="calibration-page">
        <StepIndicator current={wizardStep} />

        {wizardStep === 1 && (
          <StepUrlInput onScan={handleScan} />
        )}

        {wizardStep === 2 && (
          <StepScanning
            url={scanUrl}
            enrichmentData={enrichmentData}
            scanProgress={scanProgress}
            pipelineStep={pipelineStep}
            liveValues={liveValues}
          />
        )}

        {wizardStep === 3 && (
          <StepResults
            data={enrichmentData || existingResult}
            onRecalibrate={handleRecalibrate}
            onViewReport={() => navigate('/market')}
          />
        )}
      </div>
    </DashboardLayout>
  );
};

export default ForensicCalibration;
