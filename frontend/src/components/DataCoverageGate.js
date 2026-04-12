/**
 * DataCoverageGate — Shows data coverage status and missing-field guidance.
 *
 * blocked: prominent banner with critical fields + CTA to fix
 * degraded: inline notice with missing fields
 * full: hidden (renders children normally)
 *
 * Props:
 *   guardrail   'BLOCKED' | 'DEGRADED' | 'FULL' | null
 *   coveragePct  number (0-100)
 *   missingFields array[{key, label, path, critical}]
 *   compact     boolean — use smaller inline variant (for chat UI)
 */
import React, { useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, ArrowRight, X } from 'lucide-react';
import { fontFamily } from '../design-system/tokens';

const CoverageBar = ({ pct }) => {
  const color = pct >= 40 ? '#10B981' : pct >= 20 ? '#F59E0B' : '#EF4444';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(140,170,210,0.15)' }}>
        <div className="h-1.5 rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[10px] font-semibold flex-shrink-0" style={{ color, fontFamily: fontFamily.mono }}>{pct}%</span>
    </div>
  );
};

const DataCoverageGate = ({ guardrail, coveragePct = 0, missingFields = [], compact = false, onDismiss }) => {
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (!guardrail || guardrail === 'FULL' || dismissed) return null;

  const criticalMissing = missingFields.filter(f => f.critical);
  const optionalMissing = missingFields.filter(f => !f.critical);

  if (guardrail === 'BLOCKED') {
    return (
      <div
        className="rounded-xl p-4 mb-3"
        style={{ background: 'rgba(239, 68, 68, 0.06)', border: '1px solid rgba(239, 68, 68, 0.25)' }}
        data-testid="coverage-gate-blocked"
      >
        <div className="flex items-start gap-3">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-[#EF4444]" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold mb-1" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.display }}>
              I need a bit more information before I can help
            </p>
            <CoverageBar pct={coveragePct} />
            <p className="text-xs mt-2 mb-3" style={{ color: 'var(--biqc-text-2)' }}>
              I'm working with {coveragePct}% data coverage. Complete your business profile to unlock personalised guidance.
            </p>
            {criticalMissing.length > 0 && (
              <div className="space-y-1.5">
                {criticalMissing.slice(0, 4).map(f => (
                  <a
                    key={f.key}
                    href={f.path}
                    className="flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-all hover:brightness-110"
                    style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#EF4444' }}
                    data-testid={`coverage-fix-${f.key}`}
                  >
                    <span>Add {f.label}</span>
                    <ArrowRight className="w-3 h-3" />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (guardrail === 'DEGRADED') {
    if (compact) {
      return (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg mb-2 text-xs"
          style={{ background: 'rgba(245, 158, 11, 0.06)', border: '1px solid rgba(245, 158, 11, 0.2)' }}
          data-testid="coverage-gate-degraded-compact"
        >
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#F59E0B' }} />
          <span style={{ color: 'var(--biqc-text-2)' }}>
            Advice based on {coveragePct}% data coverage — connecting
            {criticalMissing[0] ? ` ${criticalMissing[0].label}` : ' more systems'} would sharpen results.
          </span>
          <button onClick={() => setDismissed(true)} className="ml-auto flex-shrink-0" style={{ color: '#64748B' }}>
            <X className="w-3 h-3" />
          </button>
        </div>
      );
    }

    return (
      <div
        className="rounded-xl mb-3 overflow-hidden"
        style={{ background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.2)' }}
        data-testid="coverage-gate-degraded"
      >
        <button
          onClick={() => setExpanded(v => !v)}
          className="w-full flex items-center gap-3 px-4 py-3 text-left"
        >
          <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: '#F59E0B' }} />
          <div className="flex-1 min-w-0">
            <span className="text-xs font-medium" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.display }}>
              Advice based on limited data ({coveragePct}% coverage)
            </span>
            <span className="block text-[10px] mt-0.5" style={{ color: 'var(--biqc-text-2)', fontFamily: fontFamily.mono }}>
              {criticalMissing.length > 0 ? `${criticalMissing.length} key fields missing — tap to see` : 'Connect integrations to improve accuracy'}
            </span>
          </div>
          {expanded ? <ChevronUp className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#64748B' }} /> : <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#64748B' }} />}
        </button>

        {expanded && (
          <div className="px-4 pb-4 space-y-3">
            <CoverageBar pct={coveragePct} />
            {criticalMissing.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: '#F59E0B', fontFamily: fontFamily.mono }}>
                  High-impact fields missing
                </p>
                <div className="space-y-1.5">
                  {criticalMissing.slice(0, 4).map(f => (
                    <a
                      key={f.key}
                      href={f.path}
                      className="flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-all hover:brightness-110"
                      style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.15)', color: '#F59E0B' }}
                      data-testid={`coverage-improve-${f.key}`}
                    >
                      <span>Add {f.label}</span>
                      <ArrowRight className="w-3 h-3" />
                    </a>
                  ))}
                </div>
              </div>
            )}
            {optionalMissing.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>
                  Optional improvements
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {optionalMissing.slice(0, 4).map(f => (
                    <a
                      key={f.key}
                      href={f.path}
                      className="px-2.5 py-1 rounded-md text-[10px] transition-all"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--biqc-border)', color: '#64748B' }}
                    >
                      {f.label}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return null;
};

export default DataCoverageGate;
