import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Lock, Shield } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { FOUNDATION_FEATURES } from '../config/launchConfig';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { resolveTier } from '../lib/tierResolver';
import { isPrivilegedUser } from '../lib/privilegedUser';
import { fontFamily } from '../design-system/tokens';

export default function BIQcFoundationPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useSupabaseAuth();
  const selectedKey = searchParams.get('feature');
  const tier = resolveTier(user);
  const hasFoundationAccess = isPrivilegedUser(user) || tier !== 'free';

  const selectedFeature = useMemo(() => FOUNDATION_FEATURES.find((feature) => feature.key === selectedKey) || null, [selectedKey]);

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-8" data-testid="biqc-foundation-page">
        <section className="rounded-[30px] border p-8 sm:p-10" style={{ borderColor: 'var(--biqc-border)', background: 'linear-gradient(180deg, rgba(255,106,0,0.08), rgba(20,28,38,0.96))' }}>
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full px-3 py-1" style={{ background: 'rgba(255,106,0,0.12)', border: '1px solid rgba(255,106,0,0.24)' }}>
                <Shield className="h-3.5 w-3.5" style={{ color: '#FF6A00' }} />
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: '#FF6A00', fontFamily: fontFamily.mono }}>BIQc Foundation</span>
              </div>
              <h1 className="mt-4 text-4xl sm:text-5xl" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.display }}>The paid operating layer for decision confidence.</h1>
              <p className="mt-4 max-w-2xl text-sm sm:text-base" style={{ color: 'var(--biqc-text-2)' }}>
                BIQc Foundation extends the free launch with deeper operating control across revenue, operations, marketing intelligence, Boardroom synthesis, governance, and up to 5 integrations.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <div className="rounded-2xl border px-4 py-3" style={{ borderColor: 'rgba(255,255,255,0.12)', background: 'rgba(15,23,42,0.42)' }}>
                  <p className="text-[10px] uppercase tracking-[0.14em]" style={{ color: '#94A3B8', fontFamily: fontFamily.mono }}>Price</p>
                  <p className="mt-1 text-2xl" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.display }}>$349 / month</p>
                </div>
                <div className="rounded-2xl border px-4 py-3" style={{ borderColor: 'rgba(255,255,255,0.12)', background: 'rgba(15,23,42,0.42)' }}>
                  <p className="text-[10px] uppercase tracking-[0.14em]" style={{ color: '#94A3B8', fontFamily: fontFamily.mono }}>Product description</p>
                  <p className="mt-1 max-w-xl text-sm" style={{ color: 'var(--biqc-text-2)' }}>AI operating layer for visibility, decision support, execution control, Boardroom context, and up to 5 integrations.</p>
                </div>
              </div>
            </div>

            <div className="w-full max-w-sm rounded-[24px] border p-5" style={{ borderColor: 'rgba(255,255,255,0.12)', background: 'rgba(15,23,42,0.42)' }} data-testid="biqc-foundation-sidebar-summary">
              <p className="text-[10px] uppercase tracking-[0.14em]" style={{ color: '#94A3B8', fontFamily: fontFamily.mono }}>Included</p>
              <div className="mt-4 space-y-2">
                {FOUNDATION_FEATURES.map((feature) => (
                  <div key={feature.key} className="flex items-start gap-2 text-sm" style={{ color: 'var(--biqc-text-2)' }}>
                    <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: '#FF6A00' }} />
                    <span>{feature.title}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => navigate('/upgrade')}
                className="mt-5 inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-white"
                style={{ background: '#FF6A00', fontFamily: fontFamily.body }}
                data-testid="biqc-foundation-upgrade-button"
              >
                {hasFoundationAccess ? 'Manage Foundation' : 'Upgrade to BIQc Foundation'}
              </button>
            </div>
          </div>
        </section>

        {selectedFeature && (
          <section className="rounded-[26px] border p-6 sm:p-8" style={{ borderColor: 'rgba(255,106,0,0.24)', background: 'rgba(255,106,0,0.05)' }} data-testid={`biqc-foundation-feature-detail-${selectedFeature.key}`}>
            <button
              onClick={() => setSearchParams({})}
              className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs hover:bg-white/5"
              style={{ borderColor: 'var(--biqc-border)', color: 'var(--biqc-text)', fontFamily: fontFamily.mono }}
              data-testid="biqc-foundation-detail-back-button"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Foundation overview
            </button>
            <h2 className="mt-5 text-3xl" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.display }}>{selectedFeature.title}</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7" style={{ color: 'var(--biqc-text-2)' }}>{selectedFeature.summary}</p>
            <div className="mt-6 grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
              <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--biqc-border)', background: 'var(--biqc-bg-card)' }}>
                <p className="text-[10px] uppercase tracking-[0.14em]" style={{ color: '#FF6A00', fontFamily: fontFamily.mono }}>What it does</p>
                <div className="mt-4 space-y-3">
                  {selectedFeature.whatItDoes.map((line) => (
                    <div key={line} className="flex items-start gap-2 text-sm" style={{ color: 'var(--biqc-text-2)' }}>
                      <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: '#FF6A00' }} />
                      <span>{line}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--biqc-border)', background: 'var(--biqc-bg-card)' }}>
                <p className="text-[10px] uppercase tracking-[0.14em]" style={{ color: '#94A3B8', fontFamily: fontFamily.mono }}>Benefits</p>
                <div className="mt-4 space-y-2">
                  {selectedFeature.benefits.map((line) => (
                    <div key={line} className="rounded-xl border px-3 py-2 text-sm" style={{ borderColor: 'var(--biqc-border)', color: 'var(--biqc-text-2)', background: 'rgba(255,255,255,0.03)' }}>
                      {line}
                    </div>
                  ))}
                </div>
                <div className="mt-5">
                  {hasFoundationAccess ? (
                    <button
                      onClick={() => navigate(selectedFeature.route)}
                      className="inline-flex min-h-[42px] items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white"
                      style={{ background: '#FF6A00', fontFamily: fontFamily.body }}
                      data-testid={`biqc-foundation-open-${selectedFeature.key}`}
                    >
                      Open {selectedFeature.title} <ArrowRight className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      onClick={() => navigate('/upgrade')}
                      className="inline-flex min-h-[42px] items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white"
                      style={{ background: '#FF6A00', fontFamily: fontFamily.body }}
                      data-testid={`biqc-foundation-upgrade-${selectedFeature.key}`}
                    >
                      Unlock in BIQc Foundation <Lock className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        <section className="space-y-4" data-testid="biqc-foundation-grid">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.14em]" style={{ color: '#94A3B8', fontFamily: fontFamily.mono }}>Feature detail</p>
              <h2 className="mt-2 text-2xl" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.display }}>What BIQc Foundation actually adds</h2>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {FOUNDATION_FEATURES.map((feature) => (
              <article key={feature.key} className="rounded-[24px] border p-5" style={{ borderColor: selectedKey === feature.key ? 'rgba(255,106,0,0.45)' : 'var(--biqc-border)', background: selectedKey === feature.key ? 'rgba(255,106,0,0.05)' : 'var(--biqc-bg-card)' }} data-testid={`biqc-foundation-card-${feature.key}`}>
                <p className="text-[10px] uppercase tracking-[0.14em]" style={{ color: '#FF6A00', fontFamily: fontFamily.mono }}>{feature.title}</p>
                <p className="mt-3 text-sm leading-7" style={{ color: 'var(--biqc-text-2)' }}>{feature.summary}</p>
                <div className="mt-4 space-y-2">
                  {feature.whatItDoes.slice(0, 2).map((line) => (
                    <div key={line} className="flex items-start gap-2 text-sm" style={{ color: 'var(--biqc-text-2)' }}>
                      <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: '#FF6A00' }} />
                      <span>{line}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    onClick={() => setSearchParams({ feature: feature.key })}
                    className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border px-3 py-2 text-xs hover:bg-white/5"
                    style={{ borderColor: 'var(--biqc-border)', color: 'var(--biqc-text)', fontFamily: fontFamily.mono }}
                    data-testid={`biqc-foundation-learn-${feature.key}`}
                  >
                    View detail <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                  {hasFoundationAccess && (
                    <button
                      onClick={() => navigate(feature.route)}
                      className="inline-flex min-h-[40px] items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-white"
                      style={{ background: '#FF6A00', fontFamily: fontFamily.body }}
                      data-testid={`biqc-foundation-open-card-${feature.key}`}
                    >
                      Open
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}