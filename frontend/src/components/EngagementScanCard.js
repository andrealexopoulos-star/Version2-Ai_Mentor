import React, { useState } from 'react';
import { apiClient } from '../lib/api';
import { Shield, Search, Loader2, AlertTriangle, CheckCircle2, TrendingUp, MapPin, Star, ExternalLink, ChevronDown, ChevronUp, Eye } from 'lucide-react';
import { fontFamily } from '../design-system/tokens';


const Panel = ({ children, className = '' }) => (
  <div className={`rounded-lg p-5 ${className}`} style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }}>{children}</div>
);

const EngagementScanCard = ({ url, businessName, location }) => {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState({});

  const runScan = async () => {
    setScanning(true);
    setError(null);
    try {
      const res = await apiClient.post('/engagement/scan', {
        url, business_name: businessName || '', location: location || '',
      });
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Scan failed');
    } finally {
      setScanning(false);
    }
  };

  const toggle = (key) => setExpanded(p => ({ ...p, [key]: !p[key] }));

  if (!result && !scanning) {
    return (
      <Panel className="text-center py-8" data-testid="engagement-scan-trigger">
        <Eye className="w-8 h-8 text-[#E85D00] mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-[var(--ink-display)] mb-2" style={{ fontFamily: fontFamily.display }}>Forensic Market Exposure Scan</h3>
        <p className="text-xs text-[var(--ink-muted)] mb-4 max-w-md mx-auto">Analyse your competitive position, review presence, search visibility, and authority markers against real competitors.</p>
        <button onClick={runScan} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white" style={{ background: '#E85D00' }} data-testid="run-engagement-scan">
          <Search className="w-4 h-4" /> Run Exposure Scan
        </button>
        {error && <p className="text-xs text-[#EF4444] mt-3">{error}</p>}
      </Panel>
    );
  }

  if (scanning) {
    return (
      <Panel className="text-center py-10" data-testid="engagement-scanning">
        <Loader2 className="w-8 h-8 text-[#E85D00] mx-auto mb-3 animate-spin" />
        <h3 className="text-lg font-semibold text-[var(--ink-display)] mb-2" style={{ fontFamily: fontFamily.display }}>Scanning competitive landscape...</h3>
        <p className="text-xs text-[var(--ink-muted)]">Checking reviews, search presence, competitors, and authority markers.</p>
      </Panel>
    );
  }

  // Results
  const r = result;
  const confScore = r.confidence?.confidence_score || 0;
  const confColor = confScore >= 50 ? '#F59E0B' : confScore >= 30 ? '#E85D00' : '#EF4444';
  const asymCount = r.asymmetry_count || 0;

  return (
    <div className="space-y-4" data-testid="engagement-results">
      {/* Confidence Banner */}
      <div className="rounded-xl p-6" style={{ background: '#E85D0008', border: '1px solid #E85D0025' }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-[#E85D00]" />
            <h2 className="text-lg font-semibold text-[var(--ink-display)]" style={{ fontFamily: fontFamily.display }}>Competitive Exposure Report</h2>
          </div>
          <div className="text-right">
            <span className="text-2xl font-bold" style={{ color: confColor, fontFamily: fontFamily.mono }}>{confScore}%</span>
            <span className="text-[10px] text-[var(--ink-muted)] block" style={{ fontFamily: fontFamily.mono }}>confidence</span>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded" style={{ background: 'var(--biqc-bg)' }}>
            <span className="text-[10px] text-[var(--ink-muted)] block" style={{ fontFamily: fontFamily.mono }}>Structure</span>
            <span className="text-sm font-bold text-[var(--ink-display)] capitalize" style={{ fontFamily: fontFamily.mono }}>{r.structure?.structure?.replace(/_/g, ' ')}</span>
          </div>
          <div className="p-3 rounded" style={{ background: 'var(--biqc-bg)' }}>
            <span className="text-[10px] text-[var(--ink-muted)] block" style={{ fontFamily: fontFamily.mono }}>Asymmetries</span>
            <span className="text-sm font-bold" style={{ color: asymCount >= 3 ? '#EF4444' : '#F59E0B', fontFamily: fontFamily.mono }}>{asymCount}</span>
          </div>
          <div className="p-3 rounded" style={{ background: 'var(--biqc-bg)' }}>
            <span className="text-[10px] text-[var(--ink-muted)] block" style={{ fontFamily: fontFamily.mono }}>Reviews</span>
            <span className="text-sm font-bold text-[var(--ink-display)]" style={{ fontFamily: fontFamily.mono }}>{r.reviews?.total_reviews || 0}</span>
          </div>
          <div className="p-3 rounded" style={{ background: 'var(--biqc-bg)' }}>
            <span className="text-[10px] text-[var(--ink-muted)] block" style={{ fontFamily: fontFamily.mono }}>Competitors</span>
            <span className="text-sm font-bold text-[var(--ink-display)]" style={{ fontFamily: fontFamily.mono }}>{r.competitors?.length || 0}</span>
          </div>
        </div>
      </div>

      {/* Asymmetries — The Core */}
      {r.asymmetries?.length > 0 && (
        <Panel>
          <button onClick={() => toggle('asym')} className="w-full flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#EF4444]" />
              <h3 className="text-sm font-semibold text-[var(--ink-display)]" style={{ fontFamily: fontFamily.display }}>Structural Exposures ({r.asymmetries.length})</h3>
            </div>
            {expanded.asym ? <ChevronUp className="w-4 h-4 text-[var(--ink-muted)]" /> : <ChevronDown className="w-4 h-4 text-[var(--ink-muted)]" />}
          </button>
          {(expanded.asym !== false) && (
            <div className="mt-4 space-y-3">
              {r.asymmetries.map((a, i) => (
                <div key={i} className="p-4 rounded-lg" style={{ background: '#EF444406', border: '1px solid #EF444415' }}>
                  <span className="text-xs font-semibold text-[#EF4444] block mb-2" style={{ fontFamily: fontFamily.mono }}>{a.structural_implication}</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] text-[var(--ink-muted)] block mb-0.5" style={{ fontFamily: fontFamily.mono }}>You</span>
                      <span className="text-[var(--ink-secondary)]">{a.subject_signal}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[var(--ink-muted)] block mb-0.5" style={{ fontFamily: fontFamily.mono }}>Competitor</span>
                      <span className="text-[var(--ink-display)]">{a.competitor_signal}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-[10px] text-[var(--ink-muted)]" style={{ fontFamily: fontFamily.mono }}>Source: {a.evidence_source}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ color: '#F59E0B', background: '#F59E0B15', fontFamily: fontFamily.mono }}>{Math.round(a.confidence * 100)}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}

      {/* Review Surface */}
      <Panel>
        <button onClick={() => toggle('reviews')} className="w-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-[#F59E0B]" />
            <h3 className="text-sm font-semibold text-[var(--ink-display)]" style={{ fontFamily: fontFamily.display }}>Review Surface</h3>
          </div>
          {expanded.reviews ? <ChevronUp className="w-4 h-4 text-[var(--ink-muted)]" /> : <ChevronDown className="w-4 h-4 text-[var(--ink-muted)]" />}
        </button>
        {expanded.reviews && (
          <div className="mt-4 space-y-2">
            {r.reviews?.google_maps ? (
              <div className="flex items-center justify-between p-3 rounded" style={{ background: 'var(--biqc-bg)' }}>
                <div className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-[#10B981]" /><span className="text-xs text-[var(--ink-display)]">Google Maps</span></div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#F59E0B]" style={{ fontFamily: fontFamily.mono }}>{r.reviews.google_maps.rating}/5</span>
                  <span className="text-xs text-[var(--ink-secondary)]" style={{ fontFamily: fontFamily.mono }}>{r.reviews.google_maps.reviews} reviews</span>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded" style={{ background: '#EF444406' }}><span className="text-xs text-[#EF4444]">No Google Maps listing detected</span></div>
            )}
            {r.reviews?.platforms_found?.map(p => (
              <div key={p} className="flex items-center gap-2 p-2 rounded" style={{ background: '#10B98108' }}>
                <CheckCircle2 className="w-3 h-3 text-[#10B981]" /><span className="text-xs text-[var(--ink-secondary)]">{p}</span>
              </div>
            ))}
            {r.reviews?.platforms_absent?.map(p => (
              <div key={p} className="flex items-center gap-2 p-2 rounded" style={{ background: 'var(--biqc-bg)' }}>
                <span className="w-3 h-3 rounded-full border border-[var(--ink-muted)]" /><span className="text-xs text-[var(--ink-muted)]">{p} — not found</span>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* Search Dominance */}
      {r.search_dominance && (
        <Panel>
          <button onClick={() => toggle('search')} className="w-full flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#3B82F6]" />
              <h3 className="text-sm font-semibold text-[var(--ink-display)]" style={{ fontFamily: fontFamily.display }}>Search Visibility</h3>
              <span className="text-[10px] px-2 py-0.5 rounded" style={{
                color: r.search_dominance.search_dominance === 'present' ? '#10B981' : '#EF4444',
                background: (r.search_dominance.search_dominance === 'present' ? '#10B981' : '#EF4444') + '15',
                fontFamily: fontFamily.mono,
              }}>{r.search_dominance.search_dominance}</span>
            </div>
            {expanded.search ? <ChevronUp className="w-4 h-4 text-[var(--ink-muted)]" /> : <ChevronDown className="w-4 h-4 text-[var(--ink-muted)]" />}
          </button>
          {expanded.search && (
            <div className="mt-4">
              <p className="text-xs text-[var(--ink-muted)] mb-2" style={{ fontFamily: fontFamily.mono }}>Query: "{r.search_dominance.query}"</p>
              {r.search_dominance.subject_found ? (
                <p className="text-xs text-[#10B981] mb-2">You appear at position {r.search_dominance.subject_position}</p>
              ) : (
                <p className="text-xs text-[#EF4444] mb-2">You do not appear in top 10 results</p>
              )}
              {r.search_dominance.top_competitors?.slice(0, 3).map((c, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded mb-1" style={{ background: 'var(--biqc-bg)' }}>
                  <span className="text-xs text-[var(--ink-secondary)] truncate flex-1">{c.name}</span>
                  <span className="text-[10px] text-[var(--ink-muted)]" style={{ fontFamily: fontFamily.mono }}>Position {c.position}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}

      {/* Competitor Reviews Comparison */}
      {r.competitor_reviews?.length > 0 && (
        <Panel>
          <h3 className="text-sm font-semibold text-[var(--ink-display)] mb-3" style={{ fontFamily: fontFamily.display }}>Competitor Review Comparison</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 rounded" style={{ background: '#E85D0008', border: '1px solid #E85D0015' }}>
              <span className="text-xs font-semibold text-[#E85D00]">You ({r.business_name})</span>
              <span className="text-xs font-bold" style={{ fontFamily: fontFamily.mono, color: '#E85D00' }}>{r.reviews?.google_maps?.reviews || 0} reviews</span>
            </div>
            {r.competitor_reviews.filter(c => c.reviews > 0).map((c, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded" style={{ background: 'var(--biqc-bg)' }}>
                <span className="text-xs text-[var(--ink-secondary)] truncate">{c.name}</span>
                <div className="flex items-center gap-2">
                  {c.rating && <span className="text-xs text-[#F59E0B]" style={{ fontFamily: fontFamily.mono }}>{c.rating}/5</span>}
                  <span className="text-xs font-bold text-[var(--ink-display)]" style={{ fontFamily: fontFamily.mono }}>{c.reviews} reviews</span>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* Rescan button */}
      <div className="text-center">
        <button onClick={runScan} className="text-xs text-[var(--ink-muted)] hover:text-[#E85D00] transition-colors" style={{ fontFamily: fontFamily.mono }}>
          Re-run scan
        </button>
      </div>
    </div>
  );
};

export default EngagementScanCard;
