import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { LEGAL_TABS } from '../config/launchConfig';
import { fontFamily } from '../design-system/tokens';

export default function BIQcLegalPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'overview';
  const active = useMemo(() => LEGAL_TABS.find((tab) => tab.id === activeTab) || LEGAL_TABS[0], [activeTab]);

  useEffect(() => {
    if (!searchParams.get('tab')) {
      setSearchParams({ tab: 'overview' }, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-8" data-testid="biqc-legal-page">
        <section className="rounded-[28px] border p-8" style={{ borderColor: 'var(--biqc-border)', background: 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(15,23,42,0.85))' }}>
          <p className="text-[10px] uppercase tracking-[0.2em]" style={{ color: '#94A3B8', fontFamily: fontFamily.mono }}>BIQc Legal</p>
          <h1 className="mt-3 text-4xl sm:text-5xl" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.display }}>One place for trust, privacy, and terms.</h1>
          <p className="mt-3 max-w-3xl text-sm sm:text-base" style={{ color: 'var(--biqc-text-2)' }}>
            All BIQc legal reading is consolidated here to reduce cognitive load. Switch tabs to review security, privacy, DPA, terms, and enterprise commitments.
          </p>
        </section>

        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="rounded-[24px] border p-3" style={{ borderColor: 'var(--biqc-border)', background: 'var(--biqc-bg-card)' }}>
            {LEGAL_TABS.map((tab) => {
              const activeState = tab.id === activeTab;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSearchParams({ tab: tab.id })}
                  className="mb-2 flex w-full items-start rounded-2xl px-4 py-3 text-left transition-all"
                  style={{
                    background: activeState ? 'rgba(232,93,0,0.08)' : 'transparent',
                    border: `1px solid ${activeState ? 'rgba(232,93,0,0.28)' : 'transparent'}`,
                    color: activeState ? 'var(--biqc-text)' : 'var(--biqc-text-2)',
                  }}
                  data-testid={`biqc-legal-tab-${tab.id}`}
                >
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.14em]" style={{ color: activeState ? '#E85D00' : '#94A3B8', fontFamily: fontFamily.mono }}>{tab.label}</p>
                    <p className="mt-1 text-sm" style={{ fontFamily: fontFamily.body }}>{tab.title}</p>
                  </div>
                </button>
              );
            })}
          </aside>

          <section className="rounded-[24px] border p-6 sm:p-8" style={{ borderColor: 'var(--biqc-border)', background: 'var(--biqc-bg-card)' }} data-testid={`biqc-legal-panel-${active.id}`}>
            <p className="text-[10px] uppercase tracking-[0.16em]" style={{ color: '#E85D00', fontFamily: fontFamily.mono }}>{active.label}</p>
            <h2 className="mt-3 text-3xl" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.display }}>{active.title}</h2>
            <p className="mt-4 text-sm leading-7" style={{ color: 'var(--biqc-text-2)' }}>{active.summary}</p>

            {active.id !== 'overview' && (
              <button
                onClick={() => setSearchParams({ tab: 'overview' })}
                className="mt-4 inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs hover:bg-white/5"
                style={{ borderColor: 'var(--biqc-border)', color: 'var(--biqc-text)', fontFamily: fontFamily.mono }}
                data-testid="biqc-legal-back-to-overview"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to legal overview
              </button>
            )}

            {active.id === 'overview' && (
              <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {LEGAL_TABS.filter((tab) => tab.id !== 'overview').map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setSearchParams({ tab: tab.id })}
                    className="rounded-2xl border px-4 py-4 text-left transition-all hover:bg-white/5"
                    style={{ borderColor: 'var(--biqc-border)', background: 'rgba(255,255,255,0.03)' }}
                    data-testid={`biqc-legal-overview-card-${tab.id}`}
                  >
                    <p className="text-[10px] uppercase tracking-[0.12em]" style={{ color: '#E85D00', fontFamily: fontFamily.mono }}>{tab.label}</p>
                    <p className="mt-2 text-sm" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.display }}>{tab.title}</p>
                    <p className="mt-2 text-xs leading-6" style={{ color: 'var(--biqc-text-2)' }}>{tab.summary}</p>
                  </button>
                ))}
              </div>
            )}

            <div className="mt-6 space-y-4">
              {active.sections.map((section) => (
                <article key={section.title} className="rounded-2xl border p-5" style={{ borderColor: 'var(--biqc-border)', background: 'rgba(255,255,255,0.03)' }} data-testid={`biqc-legal-section-${active.id}-${section.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}>
                  <h3 className="text-lg" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.display }}>{section.title}</h3>
                  <p className="mt-3 text-sm leading-7" style={{ color: 'var(--biqc-text-2)' }}>{section.body}</p>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {section.bullets.map((bullet) => (
                      <div key={bullet} className="rounded-xl border px-3 py-2 text-sm" style={{ borderColor: 'var(--biqc-border)', color: 'var(--biqc-text-2)', background: 'rgba(15,23,42,0.45)' }}>
                        {bullet}
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>

            <div className="mt-8 rounded-2xl border p-4" style={{ borderColor: 'rgba(232,93,0,0.24)', background: 'rgba(232,93,0,0.06)' }}>
              <p className="text-[10px] uppercase tracking-[0.14em]" style={{ color: '#E85D00', fontFamily: fontFamily.mono }}>Contact</p>
              <p className="mt-2 text-sm" style={{ color: 'var(--biqc-text)' }}>support@biqc.ai</p>
              <p className="mt-1 text-xs" style={{ color: 'var(--biqc-text-2)' }}>For legal, privacy, or trust-centre questions.</p>
            </div>
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
}