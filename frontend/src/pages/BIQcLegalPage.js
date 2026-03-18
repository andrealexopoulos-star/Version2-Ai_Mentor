import { useMemo, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { LEGAL_TABS } from '../config/launchConfig';
import { fontFamily } from '../design-system/tokens';

export default function BIQcLegalPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const active = useMemo(() => LEGAL_TABS.find((tab) => tab.id === activeTab) || LEGAL_TABS[0], [activeTab]);

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
                  onClick={() => setActiveTab(tab.id)}
                  className="mb-2 flex w-full items-start rounded-2xl px-4 py-3 text-left transition-all"
                  style={{
                    background: activeState ? 'rgba(255,106,0,0.08)' : 'transparent',
                    border: `1px solid ${activeState ? 'rgba(255,106,0,0.28)' : 'transparent'}`,
                    color: activeState ? 'var(--biqc-text)' : 'var(--biqc-text-2)',
                  }}
                  data-testid={`biqc-legal-tab-${tab.id}`}
                >
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.14em]" style={{ color: activeState ? '#FF6A00' : '#94A3B8', fontFamily: fontFamily.mono }}>{tab.label}</p>
                    <p className="mt-1 text-sm" style={{ fontFamily: fontFamily.body }}>{tab.title}</p>
                  </div>
                </button>
              );
            })}
          </aside>

          <section className="rounded-[24px] border p-6 sm:p-8" style={{ borderColor: 'var(--biqc-border)', background: 'var(--biqc-bg-card)' }} data-testid={`biqc-legal-panel-${active.id}`}>
            <p className="text-[10px] uppercase tracking-[0.16em]" style={{ color: '#FF6A00', fontFamily: fontFamily.mono }}>{active.label}</p>
            <h2 className="mt-3 text-3xl" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.display }}>{active.title}</h2>
            <p className="mt-4 text-sm leading-7" style={{ color: 'var(--biqc-text-2)' }}>{active.body}</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {active.bullets.map((bullet) => (
                <div key={bullet} className="rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: 'var(--biqc-border)', background: 'rgba(255,255,255,0.03)', color: 'var(--biqc-text-2)' }}>
                  {bullet}
                </div>
              ))}
            </div>
            <div className="mt-8 rounded-2xl border p-4" style={{ borderColor: 'rgba(255,106,0,0.24)', background: 'rgba(255,106,0,0.06)' }}>
              <p className="text-[10px] uppercase tracking-[0.14em]" style={{ color: '#FF6A00', fontFamily: fontFamily.mono }}>Contact</p>
              <p className="mt-2 text-sm" style={{ color: 'var(--biqc-text)' }}>legal@thestrategysquad.com.au</p>
              <p className="mt-1 text-xs" style={{ color: 'var(--biqc-text-2)' }}>For legal, privacy, or trust-centre questions.</p>
            </div>
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
}