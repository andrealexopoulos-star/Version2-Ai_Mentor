import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, ChevronDown, ChevronUp, Sparkles, Lock } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { WAITLIST_FEATURES } from '../config/launchConfig';
import { fontFamily } from '../design-system/tokens';

export default function MoreFeaturesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const highlighted = searchParams.get('feature');
  const [openCard, setOpenCard] = useState(highlighted || null);

  const grouped = useMemo(() => {
    const map = new Map();
    WAITLIST_FEATURES.forEach((feature) => {
      if (!map.has(feature.category)) map.set(feature.category, []);
      map.get(feature.category).push(feature);
    });
    return [...map.entries()];
  }, []);

  const goToWaitlist = (feature) => {
    const query = new URLSearchParams({
      source: 'waitlist',
      feature: feature.key,
      label: feature.title,
    }).toString();
    navigate(`/contact?${query}`);
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

        {grouped.map(([category, features]) => (
          <section key={category} className="space-y-4" data-testid={`more-features-group-${category.toLowerCase().replace(/\s+/g, '-')}`}>
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em]" style={{ color: '#94A3B8', fontFamily: fontFamily.mono }}>{category}</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {features.map((feature) => {
                const expanded = openCard === feature.key;
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
                          <span className="text-[10px] uppercase tracking-[0.12em]" style={{ fontFamily: fontFamily.mono }}>Waitlist</span>
                        </div>
                        <h2 className="mt-3 text-xl" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.display }}>{feature.title}</h2>
                        <p className="mt-2 text-sm" style={{ color: 'var(--biqc-text-2)' }}>{feature.about}</p>
                      </div>
                      <button
                        onClick={() => setOpenCard(expanded ? null : feature.key)}
                        className="rounded-full p-2 hover:bg-white/5"
                        data-testid={`waitlist-feature-about-${feature.key}`}
                        aria-expanded={expanded}
                      >
                        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                    </div>

                    {expanded && (
                      <div className="mt-4 space-y-2" data-testid={`waitlist-feature-details-${feature.key}`}>
                        {feature.features.map((item) => (
                          <div key={item} className="rounded-xl px-3 py-2 text-sm" style={{ background: 'rgba(255,255,255,0.03)', color: 'var(--biqc-text-2)' }}>
                            {item}
                          </div>
                        ))}
                      </div>
                    )}

                    <button
                      onClick={() => goToWaitlist(feature)}
                      className="mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white"
                      style={{ background: '#FF6A00', fontFamily: fontFamily.body }}
                      data-testid={`waitlist-feature-join-${feature.key}`}
                    >
                      Join waitlist <ArrowRight className="h-4 w-4" />
                    </button>
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
