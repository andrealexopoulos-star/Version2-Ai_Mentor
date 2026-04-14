import React, { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { useSnapshot } from '../hooks/useSnapshot';
import { apiClient } from '../lib/api';
import { Shield, CheckCircle2, AlertTriangle, FileText, BadgeCheck, Sparkles, Check, Clock, AlertCircle, X, TrendingUp, TrendingDown } from 'lucide-react';
import { fontFamily, colors } from '../design-system/tokens';
import { EmptyStateCard, MetricCard, QuietActionLink, SectionLabel, SignalCard, SurfaceCard } from '../components/intelligence/SurfacePrimitives';
import LineageBadge from '../components/LineageBadge';
import { PageLoadingState, PageErrorState } from '../components/PageStateComponents';

/* ── Static compliance data (will be replaced by API once available) ── */
const SCORE_GAUGES = [
  { label: 'Overall', score: 78, color: '#E85D00', sub: '12 of 14 controls met', trend: +3 },
  { label: 'Data Privacy', score: 85, color: '#16A34A', sub: 'AU Privacy Act', trend: +5 },
  { label: 'Financial', score: 72, color: '#F59E0B', sub: 'ASIC / ATO', trend: -2 },
  { label: 'Security', score: 81, color: '#2563EB', sub: 'Essential Eight', trend: +4 },
];

const FRAMEWORKS = [
  {
    name: 'Privacy Act 1988',
    pct: 85,
    status: 'Compliant',
    statusClass: 'compliant',
    barColor: '#16A34A',
    desc: 'Privacy principles, data breach notification, consent management, and cross-border data transfer requirements under the Privacy Act 1988.',
    meta: { controls: '11 of 13 controls met', audit: 'Last audit: 2 weeks ago' },
    items: [
      { text: 'Data breach notification process documented', done: true },
      { text: 'Consent management mechanisms in place', done: true },
      { text: 'Cross-border transfer safeguards configured', done: false },
    ],
  },
  {
    name: 'ACSC Essential Eight',
    pct: 62,
    status: 'Partial',
    statusClass: 'partial',
    barColor: '#D97706',
    desc: 'Australian Cyber Security Centre mitigation strategies including application control, patching, MFA, and admin privilege restriction.',
    meta: { controls: '5 of 8 strategies met', audit: 'Last audit: 1 week ago' },
    items: [
      { text: 'Application whitelisting enabled', done: true },
      { text: 'MFA enforced for all privileged accounts', done: false },
      { text: 'Daily backup strategy validated', done: true },
    ],
  },
  {
    name: 'ATO BAS Requirements',
    pct: 91,
    status: 'Compliant',
    statusClass: 'compliant',
    barColor: '#16A34A',
    desc: 'Business Activity Statement lodgement, GST reporting, PAYG withholding, superannuation guarantee, and record-keeping requirements.',
    meta: { controls: '10 of 11 controls met', audit: 'Last audit: 3 weeks ago' },
    items: [
      { text: 'Q1 BAS lodged and paid on time', done: true },
      { text: 'PAYG withholding reconciled', done: true },
      { text: 'BAS reconciliation step documented', done: false },
    ],
  },
  {
    name: 'ASIC Reporting',
    pct: 78,
    status: 'Partial',
    statusClass: 'partial',
    barColor: '#D97706',
    desc: 'Company registration, annual review, director obligations, financial reporting, and change notification requirements under the Corporations Act.',
    meta: { controls: '7 of 9 controls met', audit: 'Last audit: 1 month ago' },
    items: [
      { text: 'Annual review submitted', done: true },
      { text: 'Director ID verified for all directors', done: false },
      { text: 'Financial reporting schedule on track', done: true },
    ],
  },
];

const PRIORITY_ACTIONS = [
  { text: 'Update privacy policy for 2026 AU Privacy Act amendments', sub: 'Data breach notification timeline changed to 72 hours', status: 'overdue', label: 'Overdue' },
  { text: 'Complete MFA rollout for remaining 2 team accounts', sub: 'Marcus Chen and contractor account still password-only', status: 'overdue', label: 'Overdue' },
  { text: 'Add BAS reconciliation step to financial SOP', sub: 'Missing documented reconciliation before quarterly lodgement', status: 'pending', label: 'Due 30 Apr' },
  { text: 'Document data retention and deletion procedures', sub: 'Required under APP 11.2 for all personal information held', status: 'pending', label: 'Due 15 May' },
  { text: 'Submit director ID verification for J. Park', sub: 'ASIC requirement for all company directors', status: 'pending', label: 'Due 30 May' },
  { text: 'Annual ASIC review submitted', sub: 'Completed 15 Mar 2026', status: 'done', label: 'Completed' },
  { text: 'Q1 BAS lodged and paid', sub: 'Lodged 28 Mar 2026 — on time', status: 'done', label: 'Completed' },
  { text: 'Application whitelisting configured on all endpoints', sub: 'Essential Eight Level 2 requirement', status: 'done', label: 'Completed' },
];

/* ── Score Ring SVG component ── */
const ScoreRing = ({ score, color, label, sub, trend }) => {
  const circumference = 2 * Math.PI * 52; // ~326.73
  const dashLen = (score / 100) * circumference;
  return (
    <div
      className="rounded-2xl border p-5 text-center"
      style={{ background: 'var(--biqc-bg-card)', borderColor: 'var(--biqc-border)' }}
      data-testid={`compliance-score-${label.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <svg viewBox="0 0 120 120" style={{ width: 90, height: 90, margin: '0 auto 12px' }}>
        <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(140,170,210,0.12)" strokeWidth="8" />
        <circle
          cx="60" cy="60" r="52" fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${dashLen} ${circumference}`} strokeLinecap="round"
          transform="rotate(-90 60 60)"
          style={{ transition: 'stroke-dasharray 0.8s ease' }}
        />
        <text x="60" y="56" textAnchor="middle" fill="#EDF1F7" fontSize="28" fontWeight="700">{score}</text>
        <text x="60" y="74" textAnchor="middle" fill="var(--ink-muted, #708499)" fontSize="11">%</text>
      </svg>
      <p className="text-sm font-semibold" style={{ color: 'var(--ink-display, #EDF1F7)', fontFamily: fontFamily.display }}>{label}</p>
      <p className="text-xs mt-0.5" style={{ color: 'var(--ink-muted, #708499)' }}>{sub}</p>
      <div className="mt-2 flex items-center justify-center gap-1 text-xs" style={{ color: trend >= 0 ? '#16A34A' : '#EF4444' }}>
        {trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        <span>{trend >= 0 ? '+' : ''}{trend}% from last month</span>
      </div>
    </div>
  );
};

/* ── Framework Card component ── */
const FrameworkCard = ({ fw }) => {
  const badgeBg = fw.statusClass === 'compliant' ? '#D1FAE5' : fw.statusClass === 'partial' ? '#FEF3C7' : '#FEE2E2';
  const badgeColor = fw.statusClass === 'compliant' ? '#065F46' : fw.statusClass === 'partial' ? '#92400E' : '#991B1B';
  return (
    <div
      className="rounded-2xl border p-5 transition-all hover:shadow-lg cursor-pointer"
      style={{ background: 'var(--biqc-bg-card)', borderColor: 'var(--biqc-border)' }}
      data-testid={`compliance-fw-${fw.name.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <div className="flex items-start justify-between mb-3">
        <p className="text-lg font-semibold" style={{ color: 'var(--ink-display, #EDF1F7)', fontFamily: fontFamily.display }}>{fw.name}</p>
        <span
          className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"
          style={{ background: badgeBg, color: badgeColor }}
        >
          {fw.status}
        </span>
      </div>
      <p className="text-sm mb-4" style={{ color: 'var(--ink-secondary, #8FA0B8)', lineHeight: 1.5 }}>{fw.desc}</p>
      <div className="flex items-center gap-3 mb-2">
        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(140,170,210,0.12)' }}>
          <div className="h-full rounded-full" style={{ width: `${fw.pct}%`, background: fw.barColor, transition: 'width 0.8s ease' }} />
        </div>
        <span className="text-xs font-bold" style={{ color: 'var(--ink-display, #EDF1F7)', fontFamily: fontFamily.mono }}>{fw.pct}%</span>
      </div>
      <div className="flex gap-4 text-xs mb-4" style={{ color: 'var(--ink-muted, #708499)' }}>
        <span>{fw.meta.controls}</span>
        <span>{fw.meta.audit}</span>
      </div>
      <div className="space-y-2 pt-3 border-t" style={{ borderColor: 'rgba(140,170,210,0.1)' }}>
        {fw.items.map((item, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            {item.done
              ? <CheckCircle2 className="h-4 w-4 flex-shrink-0" style={{ color: '#16A34A' }} />
              : <X className="h-4 w-4 flex-shrink-0" style={{ color: '#EF4444' }} />}
            <span style={{ color: item.done ? '#CBD5E1' : '#94A3B8' }}>{item.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ── Priority Action item component ── */
const ActionItem = ({ item }) => {
  const iconMap = {
    done: { Icon: Check, bg: '#16A34A', border: '#16A34A', color: '#fff' },
    pending: { Icon: Clock, bg: 'transparent', border: '#D97706', color: '#D97706' },
    overdue: { Icon: AlertCircle, bg: 'transparent', border: '#DC2626', color: '#DC2626' },
  };
  const { Icon, bg, border, color: iconColor } = iconMap[item.status];
  const labelBg = item.status === 'done' ? '#D1FAE5' : item.status === 'pending' ? '#FEF3C7' : '#FEE2E2';
  const labelColor = item.status === 'done' ? '#065F46' : item.status === 'pending' ? '#92400E' : '#991B1B';

  return (
    <div
      className="grid items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.03]"
      style={{ gridTemplateColumns: '28px 1fr auto', borderBottom: '1px solid rgba(140,170,210,0.08)' }}
    >
      <div
        className="flex items-center justify-center rounded-full"
        style={{ width: 22, height: 22, background: bg, border: `2px solid ${border}` }}
      >
        <Icon className="h-3 w-3" style={{ color: iconColor }} />
      </div>
      <div>
        <p className="text-sm" style={{ color: 'var(--ink-display, #EDF1F7)' }}>{item.text}</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--ink-muted, #708499)' }}>{item.sub}</p>
      </div>
      <span
        className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap"
        style={{ background: labelBg, color: labelColor }}
      >
        {item.label}
      </span>
    </div>
  );
};

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
        <div className="flex flex-wrap items-start justify-between gap-4" data-testid="compliance-header">
          <div>
            <h1 className="font-medium" style={{ fontFamily: fontFamily.display, color: 'var(--ink-display, #EDF1F7)', fontSize: 28, letterSpacing: '-0.02em', lineHeight: 1.05 }} data-testid="compliance-title">
              Compliance Centre
            </h1>
            <p className="text-sm mt-2" style={{ fontFamily: fontFamily.body, color: 'var(--ink-secondary, #8FA0B8)' }} data-testid="compliance-summary">
              {summary}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="rounded-full border px-3 py-1.5 text-xs" style={{ borderColor: `${verificationTone}40`, color: verificationTone, fontFamily: fontFamily.mono }} data-testid="compliance-abn-status-badge">
              <BadgeCheck className="mr-1 inline h-3.5 w-3.5" /> {verificationLabel}
            </div>
            <button
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '10px 20px', borderRadius: 8,
                background: 'linear-gradient(135deg, #E85D00, #FF7A1A)',
                color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: fontFamily.body,
                border: 'none', cursor: 'pointer',
                transition: 'box-shadow 0.2s, transform 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(232,93,0,0.35)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}
            >
              <CheckCircle2 size={16} />
              Run Compliance Audit
            </button>
          </div>
        </div>

        {/* ═══ 1. SCORE RING GAUGES ═══ */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4" data-testid="compliance-score-rings">
          {SCORE_GAUGES.map((g) => (
            <ScoreRing key={g.label} score={g.score} color={g.color} label={g.label} sub={g.sub} trend={g.trend} />
          ))}
        </div>

        {/* ═══ 2. AI COMPLIANCE INSIGHT ═══ */}
        <div
          className="rounded-2xl border p-5"
          style={{
            background: 'linear-gradient(135deg, rgba(232,93,0,0.06), rgba(232,93,0,0.02))',
            borderColor: 'var(--biqc-border)',
            borderLeft: '4px solid #E85D00',
          }}
          data-testid="compliance-ai-insight"
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="rounded-full" style={{ width: 8, height: 8, background: '#E85D00', animation: 'pulse 2s ease-in-out infinite' }} />
            <Sparkles className="h-4 w-4" style={{ color: '#E85D00' }} />
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#E85D00', fontFamily: fontFamily.mono }}>
              BIQc Compliance AI
            </span>
          </div>
          <p className="text-sm" style={{ color: 'var(--ink-secondary, #8FA0B8)', lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--ink-display, #EDF1F7)' }}>Two compliance gaps need attention before July 2026.</strong>{' '}
            The Australian Privacy Act amendments require updated data breach notification timelines (now 72 hours, down from 30 days)
            and explicit consent mechanisms for data processing. Your current privacy policy was last updated 8 months ago.
            Additionally, your BAS lodgement process lacks a documented reconciliation step, which could trigger an ATO review
            if flagged during a random audit. Both items have clear remediation paths that BIQc can generate as SOPs.
          </p>
        </div>
        <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>

        {/* ═══ 3. FRAMEWORK CARDS (2x2 grid) ═══ */}
        <div>
          <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--ink-display, #EDF1F7)', fontFamily: fontFamily.display }}>
            Compliance Frameworks
          </h2>
          <div className="grid gap-4 md:grid-cols-2" data-testid="compliance-frameworks-grid">
            {FRAMEWORKS.map((fw) => (
              <FrameworkCard key={fw.name} fw={fw} />
            ))}
          </div>
        </div>

        {/* ═══ 4. PRIORITY ACTIONS CHECKLIST ═══ */}
        <div>
          <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--ink-display, #EDF1F7)', fontFamily: fontFamily.display }}>
            Priority Actions
          </h2>
          <div
            className="rounded-2xl border overflow-hidden"
            style={{ background: 'var(--biqc-bg-card)', borderColor: 'var(--biqc-border)' }}
            data-testid="compliance-priority-actions"
          >
            {PRIORITY_ACTIONS.map((item, i) => (
              <ActionItem key={i} item={item} />
            ))}
          </div>
        </div>

        {/* ═══ EXISTING: Summary Metric Cards ═══ */}
        <div className="grid gap-4 md:grid-cols-3" data-testid="compliance-summary-grid">
          <MetricCard label="Live obligations" value={String(regulatory.length)} caption="Snapshot-backed regulatory items" tone={regulatory.length > 0 ? '#F59E0B' : '#10B981'} testId="compliance-obligations-count" />
          <MetricCard label="Single points of failure" value={String(spofs.length)} caption="Dependencies with real supporting evidence" tone={spofs.length > 0 ? '#EF4444' : '#10B981'} testId="compliance-spof-count" />
          <MetricCard label="Alignment contradictions" value={String(contradictions.length)} caption="Strategic conflicts surfaced by cognition" tone={contradictions.length > 0 ? '#E85D00' : '#10B981'} testId="compliance-contradictions-count" />
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