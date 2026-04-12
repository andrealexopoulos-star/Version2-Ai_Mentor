import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { apiClient } from '../lib/api';
import { toast } from 'sonner';
import { Sparkles, Lock, RefreshCw } from 'lucide-react';
import { fontFamily } from '../design-system/tokens';
import InsightExplainabilityStrip from '../components/InsightExplainabilityStrip';
import ActionOwnershipCard from '../components/ActionOwnershipCard';

const Panel = ({ children, className = '' }) => (
  <div className={`rounded-xl p-5 ${className}`} style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }}>
    {children}
  </div>
);

const OpsAdvisoryCentre = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  const fetchRecommendations = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/oac/recommendations');
      setData(res.data);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to load recommendations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, []);

  const items = data?.items || [];
  const firstItem = items[0];
  const usage = data?.usage || {};

  const explainability = {
    whyVisible: 'Ops Advisory is generated from your profile, connected operational telemetry, and recent execution signals.',
    whyNow: firstItem?.reason || 'Advisories are refreshed continuously as new operational data enters BIQc.',
    nextAction: firstItem?.actions?.[0] || 'Assign one owner to the top recommendation and execute within this operating cycle.',
    ifIgnored: 'Execution drift can compound into service slippage, rework, and customer trust decline.',
  };

  const actionOwnership = {
    owner: 'Operations lead',
    deadline: 'Within 48 hours',
    checkpoint: firstItem?.title || 'Complete first advisory recommendation and review status in next stand-up.',
    successMetric: `Recommendations used ${usage.used || 0}/${usage.limit || 0}`,
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-[1200px] animate-fade-in" data-testid="ops-advisory-page" style={{ fontFamily: fontFamily.body }}>
        <div>
          <div className="text-[11px] uppercase tracking-[0.08em] mb-2" style={{ fontFamily: fontFamily.mono, color: '#E85D00' }} data-testid="ops-advisory-badge">
            — Ops Advisory
          </div>
          <h1 className="font-medium" style={{ fontFamily: fontFamily.display, color: '#EDF1F7', fontSize: 'clamp(1.8rem, 3vw, 2.4rem)', letterSpacing: '-0.02em', lineHeight: 1.05 }} data-testid="ops-advisory-title">Ops <em style={{ fontStyle: 'italic', color: '#E85D00' }}>advisory</em>.</h1>
          <p className="mt-2 text-sm" style={{ color: '#8FA0B8', fontFamily: fontFamily.body }} data-testid="ops-advisory-subtitle">
            Evidence-backed strategic intelligence based on your profile and recent activity
          </p>
        </div>

        <InsightExplainabilityStrip
          whyVisible={explainability.whyVisible}
          whyNow={explainability.whyNow}
          nextAction={explainability.nextAction}
          ifIgnored={explainability.ifIgnored}
          testIdPrefix="ops-advisory-explainability"
        />

        <ActionOwnershipCard
          title="Ops advisory owner plan"
          owner={actionOwnership.owner}
          deadline={actionOwnership.deadline}
          checkpoint={actionOwnership.checkpoint}
          successMetric={actionOwnership.successMetric}
          testIdPrefix="ops-advisory-action-ownership"
        />

        {loading ? (
          <Panel data-testid="ops-advisory-loading-panel">
            <div className="space-y-3 animate-pulse">
              <div className="h-5 w-52 rounded" style={{ background: '#1E2D3D' }} />
              <div className="h-4 w-80 rounded" style={{ background: '#1E2D3D' }} />
              <div className="h-4 w-full rounded" style={{ background: '#1E2D3D' }} />
              <div className="h-4 w-[88%] rounded" style={{ background: '#1E2D3D' }} />
            </div>
          </Panel>
        ) : data?.locked ? (
          <Panel data-testid="ops-advisory-locked-panel">
            <div className="flex items-start gap-3 mb-3">
              <Lock className="w-4 h-4 mt-0.5" style={{ color: '#E85D00' }} />
              <div>
                <h3 className="text-sm font-semibold text-[#EDF1F7]" style={{ fontFamily: fontFamily.display }}>Upgrade to unlock more recommendations</h3>
                <p className="text-xs mt-1" style={{ color: '#8FA0B8' }}>You&apos;ve reached your monthly limit for your current plan.</p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="text-sm" style={{ color: '#8FA0B8' }}>
                Used {data?.usage?.used || 0} of {data?.usage?.limit || 0} this month.
              </div>
              <Link to="/upgrade" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold" style={{ background: '#E85D00', color: '#fff' }} data-testid="ops-advisory-view-plans-button">
                View Plans
              </Link>
            </div>
          </Panel>
        ) : (
          <>
            <Panel data-testid="ops-advisory-recommendations-panel">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-[#EDF1F7]" style={{ fontFamily: fontFamily.display }}>Recommendations</h2>
                <p className="text-xs mt-1" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>
                  {data?.meta?.date ? `Generated for ${data.meta.date}` : 'Generated today'}
                </p>
              </div>

              <div>
                <div className="space-y-3">
                  {items.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl"
                      style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}
                      data-testid={`ops-advisory-item-${idx}`}
                    >
                      <div className="text-sm font-semibold" style={{ color: '#EDF1F7', fontFamily: fontFamily.display }}>
                        {item.title}
                      </div>
                      {item.reason && (
                        <div className="text-sm mt-1 break-words" style={{ color: '#8FA0B8' }}>
                          {item.reason}
                        </div>
                      )}
                      {item.actions?.length ? (
                        <ul className="mt-3 list-disc pl-5 space-y-1 text-sm" style={{ color: '#8FA0B8' }}>
                          {item.actions.map((a, i) => (
                            <li key={i}>{a}</li>
                          ))}
                        </ul>
                      ) : null}

                      {(item.why || item.citations?.length) ? (
                        <details className="mt-4" data-testid={`ops-advisory-item-details-${idx}`}>
                          <summary className="text-sm cursor-pointer" style={{ color: '#8FA0B8', fontFamily: fontFamily.body }}>Why this recommendation?</summary>
                          <div className="pt-2">
                                {item.why ? (
                                  <div className="text-sm break-words" style={{ color: '#8FA0B8' }}>
                                    {item.why}
                                  </div>
                                ) : null}

                                {item.confidence ? (
                                  <div className="text-xs mt-2" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>
                                    Confidence: {item.confidence}
                                  </div>
                                ) : null}

                                {item.citations?.length ? (
                                  <div className="mt-3">
                                    <div className="text-xs font-medium" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>Sources</div>
                                    <ul className="mt-2 space-y-2">
                                      {item.citations.map((c, i) => (
                                        <li key={i} className="text-sm">
                                          <div style={{ color: '#8FA0B8' }}>
                                            <span className="mr-2 text-xs" style={{ color: '#64748B' }}>[{c.source_type}]</span>
                                            {c.url ? (
                                              <a href={c.url} target="_blank" rel="noreferrer" className="underline">
                                                {c.title || c.url}
                                              </a>
                                            ) : (
                                              <span>{c.title}</span>
                                            )}
                                          </div>
                                          {c.snippet ? (
                                            <div className="text-xs mt-1 break-words" style={{ color: '#64748B' }}>
                                              {c.snippet}
                                            </div>
                                          ) : null}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                ) : null}
                          </div>
                        </details>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            </Panel>

            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="text-sm" style={{ color: '#64748B', fontFamily: fontFamily.mono }} data-testid="ops-advisory-usage-info">
                Used {data?.usage?.used || 0} of {data?.usage?.limit || 0} recommendations this month.
              </div>
              <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold"
                style={{ background: 'rgba(140,170,210,0.15)', color: '#EDF1F7', border: '1px solid #334155' }}
                onClick={fetchRecommendations}
                data-testid="ops-advisory-refresh-button">
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default OpsAdvisoryCentre;
