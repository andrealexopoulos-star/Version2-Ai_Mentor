import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Sparkles, Lock } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { WAITLIST_FEATURES } from '../config/launchConfig';
import { fontFamily } from '../design-system/tokens';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { resolveTier } from '../lib/tierResolver';
import { isPrivilegedUser } from '../lib/privilegedUser';

export default function MoreFeaturesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useSupabaseAuth();
  const highlighted = searchParams.get('feature');
  const hasPlatformOverride = isPrivilegedUser(user) || resolveTier(user) === 'super_admin';

  const grouped = useMemo(() => {
    const map = new Map();
    WAITLIST_FEATURES.forEach((feature) => {
      if (!map.has(feature.category)) map.set(feature.category, []);
      map.get(feature.category).push(feature);
    });
    return [...map.entries()];
  }, []);

  const selectedFeature = useMemo(() => WAITLIST_FEATURES.find((feature) => feature.key === highlighted) || null, [highlighted]);

  const goToWaitlist = (feature) => {
    const query = new URLSearchParams({
      source: 'waitlist',
      feature: feature.key,
      label: feature.title,
    }).toString();
    navigate(`/contact?${query}`);
  };

  const openFeature = (feature) => {
    if (hasPlatformOverride) {
      navigate(feature.route);
      return;
    }
    setSearchParams({ feature: feature.key });
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-8 px-1" data-testid="more-features-page">
        <section className="rounded-[28px] border p-8" style={{ borderColor: 'var(--biqc-border)', background: 'linear-gradient(135deg, rgba(255,106,0,0.08), rgba(15,23,42,0.85))' }}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full px-3 py-1" style={{ background: 'rgba(255,106,0,0.12)', border: '1px solid rgba(255,106,0,0.24)' }}>
                <Sparkles className="h-3.5 w-3.5" style={{ color: '#FF6A00' }} />
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: '#FF6A00', fontFamily: fontFamily.mono }}>Launch roadmap</span>
              </div>
              <h1 className="mt-4 text-4xl sm:text-5xl" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.display }}>More Features</h1>
              <p className="mt-3 max-w-2xl text-sm sm:text-base" style={{ color: 'var(--biqc-text-2)', fontFamily: fontFamily.body }}>
                These modules sit outside the expedited launch package. Explore what each module will do, then join the waitlist with your use case and business context.
              </p>
            </div>
            <div className="rounded-2xl border px-4 py-3" style={{ borderColor: 'rgba(255,255,255,0.12)', background: 'rgba(15,23,42,0.65)' }} data-testid="more-features-package-note">
              <p className="text-[10px] uppercase tracking-[0.14em]" style={{ color: '#94A3B8', fontFamily: fontFamily.mono }}>Current launch package</p>
              <p className="mt-2 text-sm" style={{ color: 'var(--biqc-text)' }}>Free + BIQc Foundation ($349/mo)</p>
            </div>
          </div>
        </section>

        {selectedFeature && (
          <section className="rounded-[26px] border p-6 sm:p-8" style={{ borderColor: 'rgba(255,106,0,0.24)', background: 'rgba(255,106,0,0.05)' }} data-testid={`waitlist-feature-detail-${selectedFeature.key}`}>
            <button
              onClick={() => setSearchParams({})}
              className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs hover:bg-white/5"
              style={{ borderColor: 'var(--biqc-border)', color: 'var(--biqc-text)', fontFamily: fontFamily.mono }}
              data-testid="more-features-detail-back-button"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to More Features
            </button>
            <h2 className="mt-5 text-3xl" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.display }}>{selectedFeature.title}</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7" style={{ color: 'var(--biqc-text-2)' }}>{selectedFeature.about}</p>
            <div className="mt-6 grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
              <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--biqc-border)', background: 'var(--biqc-bg-card)' }}>
                <p className="text-[10px] uppercase tracking-[0.14em]" style={{ color: '#FF6A00', fontFamily: fontFamily.mono }}>What this module would do</p>
                <div className="mt-4 space-y-3">
                  {selectedFeature.features.map((line) => (
                    <div key={line} className="rounded-xl border px-3 py-2 text-sm" style={{ borderColor: 'var(--biqc-border)', background: 'rgba(255,255,255,0.03)', color: 'var(--biqc-text-2)' }}>
                      {line}
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--biqc-border)', background: 'var(--biqc-bg-card)' }}>
                <p className="text-[10px] uppercase tracking-[0.14em]" style={{ color: '#94A3B8', fontFamily: fontFamily.mono }}>Request access</p>
                <p className="mt-3 text-sm leading-7" style={{ color: 'var(--biqc-text-2)' }}>
                  {hasPlatformOverride
                    ? 'You have direct platform access as Andre. Open the live module from here.'
                    : 'Tell us why you need this module, how large the business is, and what operating outcome matters most.'}
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  {hasPlatformOverride ? (
                    <button
                      onClick={() => navigate(selectedFeature.route)}
                      className="inline-flex min-h-[42px] items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white"
                      style={{ background: '#FF6A00', fontFamily: fontFamily.body }}
                      data-testid={`waitlist-feature-open-${selectedFeature.key}`}
                    >
                      Open module <ArrowRight className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      onClick={() => goToWaitlist(selectedFeature)}
                      className="inline-flex min-h-[42px] items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white"
                      style={{ background: '#FF6A00', fontFamily: fontFamily.body }}
                      data-testid={`waitlist-feature-join-detail-${selectedFeature.key}`}
                    >
                      Join waitlist <ArrowRight className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {grouped.map(([category, features]) => (
          <section key={category} className="space-y-4" data-testid={`more-features-group-${category.toLowerCase().replace(/\s+/g, '-')}`}>
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em]" style={{ color: '#94A3B8', fontFamily: fontFamily.mono }}>{category}</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {features.map((feature) => {
                return (
                  <article
                    key={feature.key}
                    className="rounded-[24px] border p-5 transition-all"
                    style={{
                      borderColor: highlighted === feature.key ? 'rgba(255,106,0,0.45)' : 'var(--biqc-border)',
                      background: highlighted === feature.key ? 'rgba(255,106,0,0.06)' : 'var(--biqc-bg-card)',
                    }}
                    data-testid={`waitlist-feature-card-${feature.key}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="inline-flex items-center gap-2 rounded-full px-2.5 py-1" style={{ background: 'rgba(255,106,0,0.08)', color: '#FF6A00' }}>
                          <Lock className="h-3 w-3" />
                          <span className="text-[10px] uppercase tracking-[0.12em]" style={{ fontFamily: fontFamily.mono }}>{hasPlatformOverride ? 'Direct access' : 'Waitlist'}</span>
                        </div>
                        <h2 className="mt-3 text-xl" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.display }}>{feature.title}</h2>
                        <p className="mt-2 text-sm" style={{ color: 'var(--biqc-text-2)' }}>{feature.about}</p>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2" data-testid={`waitlist-feature-details-${feature.key}`}>
                      {feature.features.slice(0, 2).map((item) => (
                        <div key={item} className="rounded-xl px-3 py-2 text-sm" style={{ background: 'rgba(255,255,255,0.03)', color: 'var(--biqc-text-2)' }}>
                          {item}
                        </div>
                      ))}
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                      <button
                        onClick={() => openFeature(feature)}
                        className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-white/5"
                        style={{ borderColor: 'var(--biqc-border)', color: 'var(--biqc-text)', fontFamily: fontFamily.body }}
                        data-testid={`waitlist-feature-open-detail-${feature.key}`}
                      >
                        View detail <ArrowRight className="h-4 w-4" />
                      </button>
                      {hasPlatformOverride ? (
                        <button
                          onClick={() => navigate(feature.route)}
                          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white"
                          style={{ background: '#FF6A00', fontFamily: fontFamily.body }}
                          data-testid={`waitlist-feature-open-direct-${feature.key}`}
                        >
                          Open module
                        </button>
                      ) : (
                        <button
                          onClick={() => goToWaitlist(feature)}
                          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white"
                          style={{ background: '#FF6A00', fontFamily: fontFamily.body }}
                          data-testid={`waitlist-feature-join-${feature.key}`}
                        >
                          Join waitlist
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </DashboardLayout>
  );
}
