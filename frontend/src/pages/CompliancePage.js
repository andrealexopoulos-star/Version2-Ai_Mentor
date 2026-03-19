import React, { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { useSnapshot } from '../hooks/useSnapshot';
import { apiClient } from '../lib/api';
import { Shield, CheckCircle2, AlertTriangle, FileText, BadgeCheck } from 'lucide-react';
import { fontFamily } from '../design-system/tokens';
import { EmptyStateCard, MetricCard, QuietActionLink, SectionLabel, SignalCard, SurfaceCard, SurfaceHeader } from '../components/intelligence/SurfacePrimitives';
import LineageBadge from '../components/LineageBadge';
import { PageLoadingState, PageErrorState } from '../components/PageStateComponents';

const CompliancePage = () => {
  const { cognitive, loading, error, refresh } = useSnapshot();
  const [profile, setProfile] = useState(null);
  const c = cognitive || {};
  const risk = c.risk || {};
  const alignment = c.alignment || {};
  const regulatory = Array.isArray(risk.regulatory) ? risk.regulatory : [];
  const spofs = Array.isArray(risk.spof) ? risk.spof : [];
  const contradictions = Array.isArray(alignment.contradictions) ? alignment.contradictions : [];

  useEffect(() => {
    apiClient.get('/business-profile/context', { timeout: 10000 })
      .then((response) => setProfile(response?.data?.profile || response?.data || null))
      .catch(() => setProfile(null));
  }, []);

  const abnValue = profile?.abn || profile?.business_identity?.abn || '';
  const verificationLabel = abnValue ? 'ABN on file' : 'ABN not yet confirmed';
  const verificationTone = abnValue ? '#10B981' : '#F59E0B';

  const topObligationSignals = useMemo(() => regulatory.slice(0, 3).map((item, index) => ({
    id: `compliance-obligation-${index}`,
    title: item?.item || 'Compliance item requires review',
    detail: item?.detail || `Severity: ${item?.sev || 'review'}.`,
    action: item?.action || 'Assign an owner and confirm document, contract, or process evidence.',
    source: 'Snapshot',
    signalType: 'regulatory_obligation',
    timestamp: c?.computed_at || null,
    severity: item?.sev === 'high' ? 'high' : item?.sev === 'med' ? 'warning' : 'medium',
  })), [regulatory, c?.computed_at]);

  const summary = regulatory.length > 0
    ? `${regulatory.length} live compliance obligation${regulatory.length === 1 ? '' : 's'} need review. BIQc is only surfacing real snapshot-backed items here.`
    : 'No active compliance obligations are flagged right now. This page stays quiet unless the live risk layer finds something real.';

  const toConfidencePct = (raw) => {
    if (raw == null) return undefined;
    const n = Number(raw);
    if (!Number.isFinite(n)) return undefined;
    return n > 0 && n <= 1 ? n * 100 : n;
  };
  const complianceIntelConfidence = toConfidencePct(c?.confidence_score)
    ?? toConfidencePct(typeof c.system_state === 'object' ? c.system_state?.confidence : c.confidence_level);

  if (loading && !cognitive) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-10" style={{ fontFamily: fontFamily.body }} data-testid="compliance-page">
          <PageLoadingState message="Loading compliance..." />
        </div>
      </DashboardLayout>
    );
  }

  if (error && !cognitive) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-10" style={{ fontFamily: fontFamily.body }} data-testid="compliance-page">
          <PageErrorState error={error} onRetry={refresh} moduleName="Compliance" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-10" style={{ fontFamily: fontFamily.body }} data-testid="compliance-page">
        <SurfaceHeader
          eyebrow="BIQc insights · compliance"
          title="What must be verified right now?"
          question="This page only shows real obligations, dependencies, and alignment risks that could expose the business."
          summary={summary}
          testIdPrefix="compliance"
          rightSlot={(
            <div className="rounded-full border px-3 py-1.5 text-xs" style={{ borderColor: `${verificationTone}40`, color: verificationTone, fontFamily: fontFamily.mono }} data-testid="compliance-abn-status-badge">
              <BadgeCheck className="mr-1 inline h-3.5 w-3.5" /> {verificationLabel}
            </div>
          )}
        />

        <div className="grid gap-4 md:grid-cols-3" data-testid="compliance-summary-grid">
          <MetricCard label="Live obligations" value={String(regulatory.length)} caption="Snapshot-backed regulatory items" tone={regulatory.length > 0 ? '#F59E0B' : '#10B981'} testId="compliance-obligations-count" />
          <MetricCard label="Single points of failure" value={String(spofs.length)} caption="Dependencies with real supporting evidence" tone={spofs.length > 0 ? '#EF4444' : '#10B981'} testId="compliance-spof-count" />
          <MetricCard label="Alignment contradictions" value={String(contradictions.length)} caption="Strategic conflicts surfaced by cognition" tone={contradictions.length > 0 ? '#FF6A00' : '#10B981'} testId="compliance-contradictions-count" />
        </div>

        <div className="flex flex-wrap items-center gap-2" data-testid="compliance-lineage-badge">
          <LineageBadge lineage={c?.lineage} data_freshness={c?.data_freshness ?? c?.computed_at} confidence_score={complianceIntelConfidence} compact />
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]" data-testid="compliance-main-grid">
          <div className="space-y-4" data-testid="compliance-obligations-column">
            <SectionLabel title="Real obligation feed" detail="Each item below is tied to the live risk/alignment snapshot — no placeholder compliance theatre." testId="compliance-obligations-label" />
            {topObligationSignals.length > 0 ? topObligationSignals.map((signal) => (
              <SignalCard
                key={signal.id}
                title={signal.title}
                detail={signal.detail}
                action={signal.action}
                source={signal.source}
                signalType={signal.signalType}
                timestamp={signal.timestamp}
                severity={signal.severity}
                testId={signal.id}
              />
            )) : (
              <EmptyStateCard
                title="All clear right now."
                detail="No live regulatory obligation is currently flagged. Keep your profile and integrations up to date so BIQc can surface the next real issue quickly."
                testId="compliance-obligations-empty"
              />
            )}
          </div>

          <div className="space-y-4" data-testid="compliance-side-column">
            <SurfaceCard testId="compliance-abn-card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.14em] text-[#94A3B8]" style={{ fontFamily: fontFamily.mono }}>ABN status</p>
                  <p className="mt-2 text-lg" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.display }} data-testid="compliance-abn-title">
                    {abnValue ? 'ABN captured for this business' : 'ABN still needs confirmation'}
                  </p>
                  <p className="mt-2 text-sm text-[#94A3B8]" data-testid="compliance-abn-detail">
                    {abnValue ? `Stored ABN: ${abnValue}` : 'Once the business identity scan is confirmed, the ABN can be stored here and reused in the verified business profile.'}
                  </p>
                </div>
                <Shield className="h-5 w-5" style={{ color: verificationTone }} />
              </div>
            </SurfaceCard>

            <SurfaceCard testId="compliance-spof-card">
              <p className="text-[10px] uppercase tracking-[0.14em] text-[#94A3B8]" style={{ fontFamily: fontFamily.mono }}>Dependencies</p>
              {spofs.length > 0 ? (
                <div className="mt-3 space-y-2" data-testid="compliance-spof-list">
                  {spofs.slice(0, 4).map((item, index) => (
                    <div key={`${item}-${index}`} className="rounded-xl border px-3 py-2 text-sm text-[#CBD5E1]" style={{ borderColor: 'rgba(239,68,68,0.24)', background: 'rgba(239,68,68,0.08)' }} data-testid={`compliance-spof-item-${index}`}>
                      {item}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-[#94A3B8]" data-testid="compliance-spof-empty">No single point of failure is currently surfaced in the live risk feed.</p>
              )}
            </SurfaceCard>

            <SurfaceCard testId="compliance-alignment-card">
              <p className="text-[10px] uppercase tracking-[0.14em] text-[#94A3B8]" style={{ fontFamily: fontFamily.mono }}>Strategic alignment</p>
              <p className="mt-3 text-sm text-[#CBD5E1]" data-testid="compliance-alignment-narrative">
                {alignment.narrative || 'No live alignment narrative is available in this cycle.'}
              </p>
              {contradictions.length > 0 ? (
                <div className="mt-3 space-y-2" data-testid="compliance-contradictions-list">
                  {contradictions.slice(0, 3).map((item, index) => (
                    <div key={`${item}-${index}`} className="rounded-xl border px-3 py-2 text-sm text-[#FDE68A]" style={{ borderColor: 'rgba(245,158,11,0.28)', background: 'rgba(245,158,11,0.1)' }} data-testid={`compliance-contradiction-${index}`}>
                      {item}
                    </div>
                  ))}
                </div>
              ) : null}
            </SurfaceCard>

            <QuietActionLink label="Review Business DNA" onClick={() => { window.location.href = '/business-profile'; }} testId="compliance-business-dna-link" />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default CompliancePage;