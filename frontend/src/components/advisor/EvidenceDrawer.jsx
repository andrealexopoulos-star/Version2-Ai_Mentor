import React from 'react';
import { ArrowUpRight, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SourceProvenanceBadge } from './SourceProvenanceBadge';
import { fontFamily } from '../../design-system/tokens';

/** Convert raw evidence (metric_name, metric_value, JSON) to SMB-friendly plain language. */
function humanizeEvidence(item) {
  if (typeof item === 'string') return item;
  const m = item?.metric_name || item?.name || item?.subject || item?.summary || item?.reason;
  if (!m && typeof item === 'object') {
    const val = item?.metric_value ?? item?.value;
    const conf = item?.metric_confidence ?? item?.confidence;
    if (val !== undefined) {
      const fmt = typeof val === 'number' ? (Number.isInteger(val) ? val : val.toLocaleString(undefined, { maximumFractionDigits: 1 })) : String(val);
      const confStr = conf != null ? ` (${Math.round((conf || 0) * 100)}% confidence)` : '';
      const label = item?.metric_name || item?.label || 'Value';
      const labelFriendly = String(label).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      return `${labelFriendly}: ${fmt}${confStr}`;
    }
  }
  if (m) {
    const val = item?.metric_value ?? item?.value;
    const conf = item?.metric_confidence ?? item?.confidence;
    if (val !== undefined) {
      const fmt = typeof val === 'number' ? (Number.isInteger(val) ? val : val.toLocaleString(undefined, { maximumFractionDigits: 1 })) : String(val);
      const confStr = conf != null ? ` — ${Math.round((conf || 0) * 100)}% confidence` : '';
      const labelFriendly = String(m).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      return `${labelFriendly}: ${fmt}${confStr}`;
    }
    return String(m);
  }
  try {
    const s = JSON.stringify(item);
    if (s.length > 150) return `${s.slice(0, 120)}…`;
    return s;
  } catch {
    return 'Evidence item';
  }
}

const SOURCE_ROUTE = {
  CRM: '/revenue',
  Accounting: '/revenue',
  'Email/Calendar': '/email-inbox',
  'Observation Events': '/alerts',
  'Market Feed': '/market',
  Snapshot: '/alerts',
};

export const EvidenceDrawer = ({ open, decision, onClose }) => {
  if (!open || !decision) return null;

  const signal = decision.signal;
  const targetRoute = SOURCE_ROUTE[signal.source] || '/alerts';
  const evidenceRefs = Array.isArray(signal.evidenceRefs) ? signal.evidenceRefs : [];

  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-black/50" data-testid="advisor-evidence-drawer-overlay">
      <aside
        className="h-full w-full max-w-xl overflow-y-auto border-l p-5"
        style={{ background: 'var(--biqc-bg)', borderColor: 'var(--biqc-border)' }}
        data-testid="advisor-evidence-drawer"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-[#94A3B8]" style={{ fontFamily: fontFamily.mono }} data-testid="advisor-evidence-drawer-kicker">
              Contextual evidence
            </p>
            <h3 className="text-xl" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.display }} data-testid="advisor-evidence-drawer-title">
              {signal.title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="inline-flex min-h-[40px] items-center rounded-xl border px-3"
            style={{ borderColor: '#334155', color: '#CBD5E1' }}
            data-testid="advisor-evidence-drawer-close-button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <SourceProvenanceBadge
          source={signal.source}
          signalType={signal.signalType}
          timestamp={signal.createdAt}
          testId="advisor-evidence-drawer-provenance"
        />

        <div className="mt-4 space-y-4 text-sm" style={{ color: 'var(--biqc-text-2)' }}>
          <section className="rounded-2xl border p-4" style={{ borderColor: 'var(--biqc-border)', background: 'var(--biqc-bg-card)' }} data-testid="advisor-evidence-drawer-chain">
            <h4 className="mb-1 text-sm" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.display }}>Signal → Decision → Action</h4>
            <p data-testid="advisor-evidence-drawer-chain-signal"><strong>Signal:</strong> {signal.detail}</p>
            <p data-testid="advisor-evidence-drawer-chain-decision"><strong>Decision:</strong> {decision.headline || decision.whyNow}</p>
            <p data-testid="advisor-evidence-drawer-chain-action"><strong>Action:</strong> {signal.action}</p>
          </section>

          <section className="rounded-2xl border p-4" style={{ borderColor: 'var(--biqc-border)', background: 'var(--biqc-bg-card)' }} data-testid="advisor-evidence-drawer-why-now">
            <h4 className="mb-1 text-sm" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.display }}>Why this came up</h4>
            <p>{decision.whyNow}</p>
          </section>

          <section className="rounded-2xl border p-4" style={{ borderColor: 'var(--biqc-border)', background: 'var(--biqc-bg-card)' }} data-testid="advisor-evidence-drawer-impact">
            <h4 className="mb-1 text-sm" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.display }}>Potential impact</h4>
            <p>{signal.ifIgnored}</p>
          </section>

          <section className="rounded-2xl border p-4" style={{ borderColor: 'var(--biqc-border)', background: 'var(--biqc-bg-card)' }} data-testid="advisor-evidence-drawer-recommended-action">
            <h4 className="mb-1 text-sm" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.display }}>Recommended owner action</h4>
            <p>{signal.action}</p>
          </section>

          {evidenceRefs.length > 0 && (
            <section className="rounded-2xl border p-4" style={{ borderColor: 'var(--biqc-border)', background: 'var(--biqc-bg-card)' }} data-testid="advisor-evidence-drawer-refs">
              <h4 className="mb-2 text-sm" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.display }}>Supporting evidence</h4>
              <p className="mb-3 text-xs" style={{ color: '#94A3B8', fontFamily: fontFamily.body }}>Plain-language summary of what BIQc found in your data.</p>
              <ul className="list-disc space-y-2 pl-5 text-sm" data-testid="advisor-evidence-drawer-refs-list">
                {evidenceRefs.slice(0, 5).map((item, index) => {
                  const human = humanizeEvidence(item);
                  return (
                    <li key={`${signal.id}-ref-${index}`} data-testid={`advisor-evidence-drawer-ref-${index}`} style={{ color: 'var(--biqc-text-2)' }}>
                      {human}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            to={targetRoute}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border px-3 py-2 text-xs"
            style={{ borderColor: '#334155', color: '#CBD5E1', fontFamily: fontFamily.mono }}
            data-testid="advisor-evidence-drawer-open-source-page"
          >
            Open source context <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
          <Link
            to="/soundboard"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border px-3 py-2 text-xs"
            style={{ borderColor: '#334155', color: '#CBD5E1', fontFamily: fontFamily.mono }}
            data-testid="advisor-evidence-drawer-open-soundboard"
          >
            Ask BIQc for supporting evidence <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </aside>
    </div>
  );
};
