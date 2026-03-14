import React from 'react';
import { ArrowUpRight, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SourceProvenanceBadge } from './SourceProvenanceBadge';
import { fontFamily } from '../../design-system/tokens';

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
            <p className="mt-1 text-xs" style={{ color: '#94A3B8', fontFamily: fontFamily.mono }} data-testid="advisor-evidence-drawer-thread-id">
              Evidence thread key: {signal.dedupeKey || signal.id}
            </p>
          </section>

          <section className="rounded-2xl border p-4" style={{ borderColor: 'var(--biqc-border)', background: 'var(--biqc-bg-card)' }} data-testid="advisor-evidence-drawer-why-now">
            <h4 className="mb-1 text-sm" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.display }}>Why this decision surfaced</h4>
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
            Ask BIQc for supporting traces <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </aside>
    </div>
  );
};
