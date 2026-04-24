import React, { useMemo, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { CognitiveMesh } from '../components/LoadingSystems';
import { useSnapshot } from '../hooks/useSnapshot';

const Panel = ({ children, className = '', ...props }) => (
  <div
    className={`p-5 ${className}`}
    style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--r-lg)',
      boxShadow: 'var(--elev-1)',
    }}
    {...props}
  >
    {children}
  </div>
);

const SEV = {
  high: { bg: 'var(--danger-wash)', b: 'var(--border)', d: 'var(--danger)' },
  medium: { bg: 'var(--warning-wash)', b: 'var(--border)', d: 'var(--warning)' },
  low: { bg: 'var(--positive-wash)', b: 'var(--border)', d: 'var(--positive)' },
};

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

const EXAMPLE_ACTIONS = [
  {
    priority: 'high',
    title: 'Recover unresponded inbound leads',
    problem: '23 qualified leads from the last 14 days have not received follow-up within 24 hours.',
    whyItMatters: 'Slow response is lowering conversion velocity and pushing ready buyers to competitors.',
    actionSteps: [
      'Prioritize all leads older than 24 hours by deal value and source.',
      'Send a same-day follow-up with one clear next-step call-to-action.',
      'Assign ownership and enforce a 2-hour response SLA for new inbound.',
    ],
    expectedOutcome: 'Increase lead-to-meeting conversion by 12-18% within 30 days.',
    confidence: 'High (86%)',
  },
  {
    priority: 'medium',
    title: 'Reduce proposal drop-off at pricing stage',
    problem: '41% of open opportunities are stalling after proposal delivery between day 3 and day 7.',
    whyItMatters: 'Pipeline is being created but not converted, creating avoidable revenue leakage this quarter.',
    actionSteps: [
      'Introduce a 48-hour proposal follow-up checkpoint on every open quote.',
      'Add two outcome-based pricing options to reduce decision friction.',
      'Embed one quantified ROI proof point in every proposal.',
    ],
    expectedOutcome: 'Improve proposal-to-close rate by 8-12 percentage points over the next quarter.',
    confidence: 'Medium (74%)',
  },
  {
    priority: 'low',
    title: 'Strengthen retention touchpoints for at-risk accounts',
    problem: 'Churn rose to 6.2% this month, with 9 accounts reporting low perceived ongoing value.',
    whyItMatters: 'Retention pressure is silently eroding recurring revenue and increasing replacement acquisition cost.',
    actionSteps: [
      'Run a 30-day success review for accounts with declining engagement.',
      'Publish a monthly value summary with concrete outcomes delivered.',
      'Use a save playbook for at-risk accounts with named owner accountability.',
    ],
    expectedOutcome: 'Reduce monthly churn by 1.0-1.5 points by next billing cycle.',
    confidence: 'Medium (68%)',
  },
];

const normalizePriority = (value) => {
  const v = String(value || '').toLowerCase();
  if (v === 'high' || v === 'urgent' || v === 'critical') return 'high';
  if (v === 'medium' || v === 'med') return 'medium';
  return 'low';
};

const toActionSteps = (item) => {
  if (Array.isArray(item?.action_steps) && item.action_steps.length > 0) {
    return item.action_steps.slice(0, 4).map((s) => String(s));
  }
  return [
    item?.next_step || 'Assign an owner and deadline for this action.',
    'Execute the highest-impact remediation step this cycle.',
    'Confirm this signal clears after completion.',
  ];
};

const confidenceFromScore = (score, fallback = 'Medium (72%)') => {
  if (typeof score !== 'number' || Number.isNaN(score)) return fallback;
  if (score >= 85) return `High (${Math.round(score)}%)`;
  if (score >= 65) return `Medium (${Math.round(score)}%)`;
  return `Low (${Math.round(score)}%)`;
};

const generateActionsFromSignals = (cognitive) => {
  const c = cognitive || {};
  const queue = Array.isArray(c.resolution_queue) ? c.resolution_queue : [];
  const primary = c?.priority?.primary;
  const secondary = c?.priority?.secondary;

  const generated = queue.slice(0, 5).map((item, idx) => {
    const priority = normalizePriority(item?.severity);
    return {
      priority,
      title: item?.title || item?.issue || `Operational action ${idx + 1}`,
      problem: item?.issue || item?.detail || 'A monitored signal indicates an unresolved operational issue.',
      whyItMatters:
        item?.impact ||
        item?.business_impact ||
        'Unresolved issues can reduce conversion speed and delay revenue outcomes.',
      actionSteps: toActionSteps(item),
      expectedOutcome:
        item?.expected_outcome ||
        'Reduce operational risk and improve execution consistency over the next 14-30 days.',
      confidence: confidenceFromScore(
        Number(item?.confidence),
        priority === 'high' ? 'High (82%)' : priority === 'medium' ? 'Medium (72%)' : 'Low (60%)'
      ),
    };
  });

  if (generated.length > 0) return generated;

  if (primary) {
    return [
      {
        priority: 'high',
        title: primary,
        problem: secondary || 'Primary BIQc focus indicates an active execution bottleneck.',
        whyItMatters: 'Delays on the top priority can cascade into missed weekly delivery targets.',
        actionSteps: [
          'Assign one accountable owner immediately.',
          'Set a this-week checkpoint with measurable completion criteria.',
          'Review and unblock dependencies daily until closed.',
        ],
        expectedOutcome: 'Resolve the top bottleneck within 7 days.',
        confidence: 'High (80%)',
      },
    ];
  }

  return [];
};

const ActionsPage = () => {
  const { cognitive, loading } = useSnapshot();
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const actions = useMemo(() => {
    const generated = generateActionsFromSignals(cognitive);
    return generated.length > 0 ? generated : EXAMPLE_ACTIONS;
  }, [cognitive]);

  const displayQueue = useMemo(() => {
    return [...actions].sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99));
  }, [actions]);

  const filteredDisplayQueue = useMemo(() => {
    return displayQueue
      .filter((item) => {
        if (activeFilter === 'high') return item.priority === 'high';
        if (activeFilter === 'medium') return item.priority === 'medium';
        if (activeFilter === 'low') return item.priority === 'low';
        return true;
      })
      .filter((item) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          (item.title || '').toLowerCase().includes(q) ||
          (item.problem || '').toLowerCase().includes(q) ||
          (item.whyItMatters || '').toLowerCase().includes(q) ||
          (item.expectedOutcome || '').toLowerCase().includes(q)
        );
      });
  }, [displayQueue, activeFilter, searchQuery]);

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-[1200px]" style={{ fontFamily: 'var(--font-ui)' }} data-testid="actions-page">
        <div>
          <div
            className="text-[11px] uppercase mb-2"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--lava)', letterSpacing: 'var(--ls-caps)' }}
          >
            — Actions · {displayQueue.length} open
          </div>
          <h1
            className="font-medium mb-1"
            style={{
              fontFamily: 'var(--font-display)',
              color: 'var(--ink-display)',
              fontSize: 'clamp(1.8rem, 3vw, 2.4rem)',
              letterSpacing: 'var(--ls-display)',
              lineHeight: 1.05,
            }}
          >
            Actions for your business
          </h1>
          <p className="text-sm" style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-ui)' }}>
            {displayQueue.length} actions detected
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'High Priority', value: loading ? '\u2014' : displayQueue.filter((i) => i.priority === 'high').length },
            {
              label: 'Medium Priority',
              value: loading ? '\u2014' : displayQueue.filter((i) => i.priority === 'medium').length,
            },
            { label: 'Low Priority', value: loading ? '\u2014' : displayQueue.filter((i) => i.priority === 'low').length },
            { label: 'Visible', value: loading ? '\u2014' : filteredDisplayQueue.length },
          ].map(({ label, value }) => (
            <div
              key={label}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-lg)',
                padding: '20px',
                boxShadow: 'var(--elev-1)',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 28,
                  color: 'var(--ink-display)',
                  display: 'block',
                  lineHeight: 1,
                }}
              >
                {value}
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: 'var(--ls-caps)',
                  color: 'var(--ink-muted)',
                  display: 'block',
                  marginTop: 8,
                }}
              >
                {label}
              </span>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 flex-wrap" data-testid="actions-toolbar">
          {[
            ['all', 'All'],
            ['high', 'High'],
            ['medium', 'Medium'],
            ['low', 'Low'],
          ].map(([value, label]) => (
            <button
              key={value}
              onClick={() => setActiveFilter(value)}
              className="px-3 py-1.5 text-xs cursor-pointer transition-all"
              style={{
                background: activeFilter === value ? 'var(--lava)' : 'transparent',
                color: activeFilter === value ? 'var(--ink-inverse)' : 'var(--ink-secondary)',
                border: activeFilter === value ? '1px solid var(--lava)' : '1px solid var(--border)',
                borderRadius: 'var(--r-pill)',
                fontFamily: 'var(--font-mono)',
                textTransform: 'uppercase',
                letterSpacing: 'var(--ls-caps)',
              }}
              data-testid={`actions-filter-${value}`}
            >
              {label}
            </button>
          ))}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search actions..."
            className="flex-1 min-w-[200px] px-3 py-2 text-sm actions-toolbar-search"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-lg)',
              color: 'var(--ink-display)',
              fontFamily: 'var(--font-ui)',
              outline: 'none',
            }}
            data-testid="actions-search-input"
          />
          <style>{`
            .actions-toolbar-search::placeholder { color: var(--ink-muted) !important; }
          `}</style>
        </div>

        {loading && <CognitiveMesh message="Scanning action signals..." />}

        {!loading && (
          <>
            {filteredDisplayQueue.length > 0 ? (
              <div>
                <h3
                  className="text-[10px] font-semibold uppercase mb-3"
                  style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)', letterSpacing: 'var(--ls-caps)' }}
                >
                  Resolution Queue ({filteredDisplayQueue.length})
                </h3>
                <div className="space-y-3">
                  {filteredDisplayQueue.map((item, idx) => {
                    const sv = SEV[item.priority] || SEV.medium;
                    return (
                      <div
                        key={`${item.title}-${idx}`}
                        className="p-5"
                        style={{
                          background: sv.bg,
                          border: `1px solid ${sv.b}`,
                          borderRadius: 'var(--r-xl)',
                          boxShadow: 'var(--elev-1)',
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: sv.d }} />
                          <div className="flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <p className="text-sm font-semibold" style={{ color: 'var(--ink-display)', fontFamily: 'var(--font-display)' }}>
                                {item.title}
                              </p>
                              <span className="text-[11px]" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)' }}>
                                {item.confidence}
                              </span>
                            </div>
                            <p className="text-xs mt-2 leading-relaxed" style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-ui)' }}>
                              <span className="font-semibold" style={{ color: 'var(--ink-display)' }}>
                                Problem:
                              </span>{' '}
                              {item.problem}
                            </p>
                            <p className="text-xs mt-2 leading-relaxed" style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-ui)' }}>
                              <span className="font-semibold" style={{ color: 'var(--ink-display)' }}>
                                Why it matters:
                              </span>{' '}
                              {item.whyItMatters}
                            </p>
                            <div className="mt-2">
                              <p className="text-xs font-semibold" style={{ color: 'var(--ink-display)', fontFamily: 'var(--font-ui)' }}>
                                Action:
                              </p>
                              <ol className="list-decimal pl-5 mt-1 space-y-1">
                                {(item.actionSteps || []).map((step, stepIdx) => (
                                  <li
                                    key={`${item.title}-step-${stepIdx}`}
                                    className="text-xs leading-relaxed"
                                    style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-ui)' }}
                                  >
                                    {step}
                                  </li>
                                ))}
                              </ol>
                            </div>
                            <p className="text-xs mt-2 leading-relaxed" style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-ui)' }}>
                              <span className="font-semibold" style={{ color: 'var(--ink-display)' }}>
                                Expected outcome:
                              </span>{' '}
                              {item.expectedOutcome}
                            </p>
                            <div className="flex flex-wrap gap-2 mt-3">
                              <button
                                className="flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] text-[11px] font-semibold"
                                style={{
                                  background: 'rgba(22,163,74,0.08)',
                                  color: 'var(--positive)',
                                  border: '1px solid rgba(22,163,74,0.2)',
                                  borderRadius: 'var(--r-lg)',
                                  fontFamily: 'var(--font-mono)',
                                }}
                              >
                                Mark done
                              </button>
                              <button
                                className="flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] text-[11px] font-semibold"
                                style={{
                                  background: 'rgba(37,99,235,0.08)',
                                  color: 'var(--info)',
                                  border: '1px solid rgba(37,99,235,0.2)',
                                  borderRadius: 'var(--r-lg)',
                                  fontFamily: 'var(--font-mono)',
                                }}
                              >
                                Snooze
                              </button>
                              <button
                                className="px-2 py-2 text-[11px] underline"
                                style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-ui)' }}
                              >
                                Why this?
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <Panel className="text-center py-8">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--positive)' }} />
                <p className="text-sm" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-ui)' }}>
                  No action signals available right now.
                </p>
              </Panel>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default ActionsPage;
