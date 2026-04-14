/**
 * NarrativePanel — Displays AI-generated strategic narratives
 * (weekly/monthly summaries with key developments, risks, opportunities).
 */
import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../lib/api';
import { fontFamily } from '../../design-system/tokens';
import {
  BookOpen, TrendingUp, AlertTriangle, Lightbulb,
  CheckCircle2, RefreshCw, Calendar, ChevronDown
} from 'lucide-react';

const SECTION_ICONS = {
  key_developments:    { icon: TrendingUp,    color: '#3B82F6', label: 'Key Developments' },
  risk_assessment:     { icon: AlertTriangle,  color: '#EF4444', label: 'Risk Assessment' },
  opportunities:       { icon: Lightbulb,      color: '#22C55E', label: 'Opportunities' },
  recommended_actions: { icon: CheckCircle2,   color: '#E85D00', label: 'Recommended Actions' },
};

const NarrativePanel = () => {
  const [narrative, setNarrative] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [expandedSection, setExpandedSection] = useState('executive_summary');

  const fetchNarrative = useCallback(async () => {
    try {
      const res = await apiClient.get('/intelligence/narrative');
      setNarrative(res.data?.narrative || null);
    } catch (e) {
      console.error('[NarrativePanel] fetch failed:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchNarrative(); }, [fetchNarrative]);

  const generateNarrative = async () => {
    setGenerating(true);
    try {
      await apiClient.post('/intelligence/narrative/generate');
      await fetchNarrative();
    } catch (e) {
      console.error('[NarrativePanel] generate failed:', e);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-32 rounded-xl animate-pulse" style={{ background: 'var(--bg-tertiary)' }} />
        <div className="h-20 rounded-xl animate-pulse" style={{ background: 'var(--bg-tertiary)' }} />
      </div>
    );
  }

  if (!narrative) {
    return (
      <div className="text-center py-12">
        <BookOpen className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--ink-muted, #708499)' }} />
        <p className="text-sm mb-1" style={{ color: 'var(--ink-display, #EDF1F7)', fontFamily: fontFamily.body }}>
          No strategic narrative yet
        </p>
        <p className="text-xs mb-4" style={{ color: 'var(--ink-secondary, #8FA0B8)', fontFamily: fontFamily.body }}>
          Generate your first weekly intelligence narrative for a complete strategic briefing.
        </p>
        <button onClick={generateNarrative} disabled={generating}
          className="px-4 py-2 rounded-lg text-sm flex items-center gap-2 mx-auto transition-all hover:opacity-80"
          style={{ background: 'rgba(232, 93, 0, 0.12)', color: '#E85D00', fontFamily: fontFamily.mono }}>
          <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
          {generating ? 'Generating...' : 'Generate narrative'}
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-xs uppercase tracking-wider" style={{ fontFamily: fontFamily.mono, color: '#E85D00' }}>
            {narrative.narrative_type} Narrative
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#93C5FD', fontFamily: fontFamily.mono }}>
            <Calendar className="w-3 h-3 inline mr-1" />
            {narrative.period_start} — {narrative.period_end}
          </span>
        </div>
        <button onClick={generateNarrative} disabled={generating}
          className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all hover:opacity-80"
          style={{ background: 'rgba(232, 93, 0, 0.08)', color: '#E85D00', fontFamily: fontFamily.mono }}>
          <RefreshCw className={`w-3 h-3 ${generating ? 'animate-spin' : ''}`} />
          Regenerate
        </button>
      </div>

      {/* Executive Summary */}
      {narrative.executive_summary && (
        <div className="p-5 rounded-xl mb-4" style={{ background: 'linear-gradient(135deg, rgba(232, 93, 0, 0.06), var(--bg-card))', border: '1px solid rgba(232, 93, 0, 0.15)' }}>
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="w-4 h-4" style={{ color: '#E85D00' }} />
            <span className="text-sm font-medium" style={{ color: '#E85D00', fontFamily: fontFamily.body }}>Executive Summary</span>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-display, #EDF1F7)', fontFamily: fontFamily.body }}>
            {narrative.executive_summary}
          </p>
          {narrative.data_completeness != null && (
            <div className="mt-3 flex items-center gap-2">
              <div className="h-1 flex-1 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div className="h-full rounded-full" style={{ width: `${narrative.data_completeness * 100}%`, background: '#E85D00' }} />
              </div>
              <span className="text-[10px]" style={{ color: 'var(--ink-muted, #708499)', fontFamily: fontFamily.mono }}>
                {(narrative.data_completeness * 100).toFixed(0)}% data coverage
              </span>
            </div>
          )}
        </div>
      )}

      {/* Collapsible Sections */}
      <div className="space-y-2">
        {Object.entries(SECTION_ICONS).map(([key, meta]) => {
          const data = narrative[key];
          if (!data || (Array.isArray(data) && data.length === 0) || (typeof data === 'object' && !Array.isArray(data) && Object.keys(data).length === 0)) return null;
          const Icon = meta.icon;
          const isOpen = expandedSection === key;

          return (
            <div key={key} className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
              <button className="w-full px-4 py-3 flex items-center justify-between"
                onClick={() => setExpandedSection(isOpen ? null : key)}>
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4" style={{ color: meta.color }} />
                  <span className="text-sm font-medium" style={{ color: 'var(--ink-display, #EDF1F7)', fontFamily: fontFamily.body }}>
                    {meta.label}
                  </span>
                  {Array.isArray(data) && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: `${meta.color}15`, color: meta.color, fontFamily: fontFamily.mono }}>
                      {data.length}
                    </span>
                  )}
                </div>
                <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} style={{ color: 'var(--ink-muted, #708499)' }} />
              </button>
              {isOpen && (
                <div className="px-4 pb-4">
                  {Array.isArray(data) ? (
                    <ul className="space-y-2">
                      {data.map((item, i) => (
                        <li key={i} className="text-xs flex items-start gap-2 leading-relaxed" style={{ color: 'var(--ink-secondary, #8FA0B8)', fontFamily: fontFamily.body }}>
                          <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: meta.color }} />
                          {typeof item === 'string' ? item : (item.title || item.description || JSON.stringify(item))}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="space-y-1">
                      {Object.entries(data).map(([k, v]) => (
                        <div key={k} className="flex items-center justify-between text-xs">
                          <span style={{ color: 'var(--ink-muted, #708499)', fontFamily: fontFamily.mono }}>{k.replace(/_/g, ' ')}</span>
                          <span style={{ color: 'var(--ink-secondary, #8FA0B8)', fontFamily: fontFamily.mono }}>{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default NarrativePanel;
