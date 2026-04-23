import React, { useCallback, useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { useSnapshot } from '../hooks/useSnapshot';
import { useIntegrationStatus } from '../hooks/useIntegrationStatus';
import { CognitiveMesh } from '../components/LoadingSystems';
import { useLocation } from 'react-router-dom';
import { Zap, Mail, MessageSquare, Users, CheckCircle2, Clock, ArrowRight } from 'lucide-react';
import { apiClient } from '../lib/api';
import { toast } from 'sonner';
import { DelegateActionModal } from '../components/advisor/DelegateActionModal';


const Panel = ({ children, className = '', ...props }) => (
  <div className={`p-5 ${className}`} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--elev-1)' }} {...props}>{children}</div>
);

const SEV = { high: { bg: 'var(--danger-wash)', b: 'var(--border)', d: 'var(--danger)' }, medium: { bg: 'var(--warning-wash)', b: 'var(--border)', d: 'var(--warning)' }, low: { bg: 'var(--positive-wash)', b: 'var(--border)', d: 'var(--positive)' } };

const ActionsPage = () => {
  const location = useLocation();
  const { cognitive, loading } = useSnapshot();
  const { status: integrationStatus } = useIntegrationStatus();
  const c = cognitive || {};
  const rawRq = c.resolution_queue || [];
  const reallocation = c.reallocation || [];
  const priority = c.priority || {};
  const advisorAssignment = location.state?.advisorAssignment || null;
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [delegateModalOpen, setDelegateModalOpen] = useState(false);
  const [delegateSubmitting, setDelegateSubmitting] = useState(false);
  const [delegateProviders, setDelegateProviders] = useState([]);
  const [delegateProviderOptions, setDelegateProviderOptions] = useState({
    provider: 'auto',
    recommendedProvider: 'auto',
    assignees: [],
    collections: [],
  });
  const [delegateOptionsLoading, setDelegateOptionsLoading] = useState(false);

  const delegateDecision = useMemo(() => {
    if (!advisorAssignment) return null;
    return {
      signal: {
        id: advisorAssignment.alertId || 'advisor-assignment',
        title: advisorAssignment.title,
        detail: advisorAssignment.whyNow,
        action: advisorAssignment.summary,
        domain: advisorAssignment.domain,
        severity: advisorAssignment.severity,
      },
    };
  }, [advisorAssignment]);

  const fetchDelegateProviders = useCallback(async () => {
    try {
      const response = await apiClient.get('/workflows/delegate/providers', { timeout: 10000 });
      const providers = response?.data?.providers || [];
      const recommendedProvider = response?.data?.recommended_provider || 'auto';
      setDelegateProviders(providers);
      setDelegateProviderOptions((prev) => ({
        ...prev,
        recommendedProvider,
      }));
      return recommendedProvider;
    } catch {
      setDelegateProviders([
        { id: 'auto', label: 'Auto (based on connected tools)', available: true },
        { id: 'manual', label: 'Manual follow-up', available: true },
      ]);
      return 'auto';
    }
  }, []);

  const fetchDelegateOptions = useCallback(async (providerChoice = 'auto') => {
    setDelegateOptionsLoading(true);
    try {
      const response = await apiClient.get('/workflows/delegate/options', {
        params: { provider: providerChoice },
        timeout: 12000,
      });
      setDelegateProviderOptions((prev) => ({
        ...prev,
        provider: response?.data?.provider || providerChoice,
        assignees: response?.data?.assignees || [],
        collections: response?.data?.collections || [],
      }));
    } catch {
      setDelegateProviderOptions((prev) => ({
        ...prev,
        provider: providerChoice,
        assignees: [],
        collections: [],
      }));
    } finally {
      setDelegateOptionsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!advisorAssignment) return;
    const setup = async () => {
      const recommended = await fetchDelegateProviders();
      await fetchDelegateOptions(recommended || 'auto');
    };
    setup();
  }, [advisorAssignment, fetchDelegateOptions, fetchDelegateProviders]);

  const handleDelegateSubmit = useCallback(async (form) => {
    if (!advisorAssignment || !delegateDecision) return;
    setDelegateSubmitting(true);
    try {
      await apiClient.post('/workflows/delegate/execute', {
        decision_id: advisorAssignment.alertId || 'advisor-assignment',
        decision_title: advisorAssignment.title,
        decision_summary: `${advisorAssignment.summary}\n\nWhy now: ${advisorAssignment.whyNow}\n\nIf ignored: ${advisorAssignment.ifIgnored}`,
        domain: advisorAssignment.domain,
        severity: advisorAssignment.severity,
        provider_preference: form.providerPreference,
        assignee_name: form.assigneeName || null,
        assignee_email: form.assigneeEmail || null,
        assignee_remote_id: form.assigneeRemoteId || null,
        due_at: form.dueAt ? new Date(form.dueAt).toISOString() : null,
        collection_remote_id: form.collectionRemoteId || null,
        create_calendar_event: Boolean(form.createCalendarEvent),
      }, { timeout: 20000 });
      toast.success('Assignment brief prepared and follow-up workflow triggered.');
      setDelegateModalOpen(false);
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Assignment workflow failed. Please check provider connection.');
    } finally {
      setDelegateSubmitting(false);
    }
  }, [advisorAssignment, delegateDecision]);

  // Filter out resolution items that are no longer relevant based on current connections
  const connectedCategories = (integrationStatus?.integrations || [])
    .filter(i => i.connected)
    .map(i => i.category?.toLowerCase());
  const hasEmail = connectedCategories.includes('email') || connectedCategories.some(c => c?.includes('outlook') || c?.includes('gmail'));
  const hasCRM = connectedCategories.includes('crm');
  const hasAccounting = connectedCategories.includes('accounting');

  const rq = rawRq.filter(item => {
    const title = (item.title || item.issue || '').toLowerCase();
    const isIntegrationPrompt = title.includes('integration required') || title.includes('integration missing') || title.includes('not connected') || title.includes('no email') || title.includes('no crm') || title.includes('no accounting');
    if (!isIntegrationPrompt) return true;
    if (hasEmail && (title.includes('email'))) return false;
    if (hasCRM && (title.includes('crm'))) return false;
    if (hasAccounting && (title.includes('accounting') || title.includes('financial'))) return false;
    return true;
  });

  // Also filter the priority focus if it's just asking to integrate tools we already have
  const priorityPrimary = (priority.primary || '').toLowerCase();
  const isStaleIntegrationPriority = 
    (priorityPrimary.includes('integrate email') && hasEmail) ||
    (priorityPrimary.includes('connect email') && hasEmail) ||
    (priorityPrimary.includes('integrate crm') && hasCRM) ||
    (priorityPrimary.includes('connect crm') && hasCRM) ||
    (priorityPrimary.includes('integrate accounting') && hasAccounting) ||
    (priorityPrimary.includes('connect accounting') && hasAccounting) ||
    (priorityPrimary.includes('integrate email, crm') && hasEmail && hasCRM);
  const cleanPriority = isStaleIntegrationPriority ? {} : priority;

  // Filter resolution queue based on toolbar filter and search query
  const filteredRq = rq.filter(item => {
    // Filter by status/severity pill
    if (activeFilter === 'urgent') return item.severity === 'high';
    if (activeFilter === 'inprogress') return item.status === 'in_progress';
    if (activeFilter === 'done') return item.status === 'done' || item.status === 'complete';
    if (activeFilter === 'overdue') return item.severity === 'high' || item.overdue;
    return true; // 'all'
  }).filter(item => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (item.title || '').toLowerCase().includes(q) ||
           (item.issue || '').toLowerCase().includes(q) ||
           (item.detail || '').toLowerCase().includes(q);
  });

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-[1200px]" style={{ fontFamily: 'var(--font-ui)' }} data-testid="actions-page">
        <div>
          <div className="text-[11px] uppercase mb-2" style={{ fontFamily: 'var(--font-mono)', color: 'var(--lava)', letterSpacing: 'var(--ls-caps)' }}>
            — Actions · {rq.length} open
          </div>
          <h1 className="font-medium mb-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink-display)', fontSize: 'clamp(1.8rem, 3vw, 2.4rem)', letterSpacing: 'var(--ls-display)', lineHeight: 1.05 }}>
            What's <em style={{ fontStyle: 'italic', color: 'var(--lava)' }}>actually moving</em>.
          </h1>
          <p className="text-sm" style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-ui)' }}>Every action started life as an alert, an email thread, a deal change, or a BIQc nudge. Drag a card forward when you've done it.</p>
        </div>

        {/* Stats cards — derived from resolution_queue rather than hardcoded
            zeros. Stats were previously all "0" regardless of state. */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'To-Do', value: loading ? '\u2014' : rq.filter(i => !i.status || i.status === 'pending' || i.status === 'to-do').length },
            { label: 'In Flight', value: loading ? '\u2014' : rq.filter(i => i.status === 'in_progress' || i.status === 'in-flight' || i.status === 'active').length },
            { label: 'Done This Week', value: loading ? '\u2014' : rq.filter(i => (i.status === 'done' || i.status === 'complete' || i.status === 'completed') && (i.completed_at ? (Date.now() - new Date(i.completed_at).getTime()) < 7 * 24 * 60 * 60 * 1000 : false)).length },
            { label: 'Overdue', value: loading ? '\u2014' : rq.filter(i => i.overdue === true || (i.due_at && new Date(i.due_at).getTime() < Date.now() && i.status !== 'done' && i.status !== 'complete')).length },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '20px', boxShadow: 'var(--elev-1)' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: 'var(--ink-display)', display: 'block', lineHeight: 1 }}>{value}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 'var(--ls-caps)', color: 'var(--ink-muted)', display: 'block', marginTop: 8 }}>{label}</span>
            </div>
          ))}
        </div>

        {/* Filter + Search toolbar */}
        <div className="flex items-center gap-3 flex-wrap" data-testid="actions-toolbar">
          {[['all','All'],['urgent','Urgent'],['inprogress','In Progress'],['done','Done'],['overdue','Overdue']].map(([val,label]) => (
            <button key={val} onClick={() => setActiveFilter(val)}
              className="px-3 py-1.5 text-xs cursor-pointer transition-all"
              style={{
                background: activeFilter === val ? 'var(--lava)' : 'transparent',
                color: activeFilter === val ? 'var(--ink-inverse)' : 'var(--ink-secondary)',
                border: activeFilter === val ? '1px solid var(--lava)' : '1px solid var(--border)',
                borderRadius: 'var(--r-pill)',
                fontFamily: 'var(--font-mono)',
                textTransform: 'uppercase',
                letterSpacing: 'var(--ls-caps)',
              }}
              data-testid={`actions-filter-${val}`}>
              {label}
            </button>
          ))}
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
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

        {loading && <CognitiveMesh message="Scanning resolution queue..." />}

        {!loading && (
          <>
            {advisorAssignment && delegateDecision && (
              <Panel className="mb-2" data-testid="actions-advisor-assignment-card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="max-w-3xl">
                    <p className="text-[10px] font-semibold uppercase mb-2" style={{ color: 'var(--lava)', fontFamily: 'var(--font-mono)', letterSpacing: 'var(--ls-caps)' }}>Advisor handoff</p>
                    <p className="text-sm font-semibold" style={{ color: 'var(--ink-display)', fontFamily: 'var(--font-display)' }}>{advisorAssignment.title}</p>
                    <p className="mt-2 text-xs leading-relaxed" style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-ui)' }}>{advisorAssignment.summary}</p>
                    <p className="mt-2 text-xs" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-ui)' }}>Why now: {advisorAssignment.whyNow}</p>
                    <p className="mt-2 text-xs" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-ui)' }}>If ignored: {advisorAssignment.ifIgnored}</p>
                  </div>
                  <button
                    onClick={() => setDelegateModalOpen(true)}
                    className="inline-flex min-h-[44px] items-center gap-1.5 px-4 py-2.5 rounded-lg text-[11px] font-semibold"
                    style={{ background: 'rgba(37,99,235,0.08)', color: 'var(--info)', border: '1px solid rgba(37,99,235,0.25)', fontFamily: 'var(--font-mono)', borderRadius: 'var(--r-lg)' }}
                    data-testid="actions-open-assignment-workflow"
                  >
                    <Users className="w-3.5 h-3.5" /> Prepare assignment
                  </button>
                </div>
              </Panel>
            )}

            {/* Priority Focus — filtered to remove stale integration prompts */}
            {(cleanPriority.primary || cleanPriority.secondary) && (
              <div className="p-5" style={{ background: 'var(--lava-wash)', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', boxShadow: 'var(--elev-1)' }}>
                <h3 className="text-[10px] font-semibold uppercase mb-3" style={{ color: 'var(--lava)', fontFamily: 'var(--font-mono)', letterSpacing: 'var(--ls-caps)' }}>Priority Focus</h3>
                {cleanPriority.primary && (
                  <div className="mb-3">
                    <span className="text-sm font-semibold" style={{ color: 'var(--ink-display)', fontFamily: 'var(--font-display)' }}>{cleanPriority.primary}</span>
                    {cleanPriority.primary_hrs && <span className="text-xs ml-2" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)' }}>{cleanPriority.primary_hrs}</span>}
                  </div>
                )}
                {cleanPriority.secondary && (
                  <div className="mb-2">
                    <span className="text-sm" style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-ui)' }}>{cleanPriority.secondary}</span>
                    {cleanPriority.delegate && <span className="text-xs ml-2" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)' }}>Delegate: {cleanPriority.delegate}</span>}
                  </div>
                )}
                {cleanPriority.noise && <p className="text-xs mt-2" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)' }}>Ignore: {cleanPriority.noise}</p>}
              </div>
            )}

            {/* Resolution Queue */}
            {filteredRq.length > 0 ? (
              <div>
                <h3 className="text-[10px] font-semibold uppercase mb-3" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)', letterSpacing: 'var(--ls-caps)' }}>Resolution Queue ({filteredRq.length})</h3>
                <div className="space-y-3">
                  {filteredRq.map((item, i) => {
                    const sv = SEV[item.severity] || SEV.medium;
                    return (
                      <div key={i} className="p-5" style={{ background: sv.bg, border: `1px solid ${sv.b}`, borderRadius: 'var(--r-xl)', boxShadow: 'var(--elev-1)' }}>
                        <div className="flex items-start gap-3">
                          <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: sv.d }} />
                          <div className="flex-1">
                            <p className="text-sm font-semibold" style={{ color: 'var(--ink-display)', fontFamily: 'var(--font-display)' }}>{item.title}</p>
                            {item.detail && <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-ui)' }}>{item.detail}</p>}
                            <div className="flex flex-wrap gap-2 mt-3">
                              {(item.actions || []).includes('auto-email') && <button onClick={async () => { try { await apiClient.post('/intelligence/alerts/action', { alert_id: item.id || item.signal_key, action: 'auto-email' }); toast.success('Drafting auto-email\u2026'); } catch { toast.error('Could not queue email action'); } }} className="flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] text-[11px] font-semibold" style={{ background: 'rgba(37,99,235,0.08)', color: 'var(--info)', border: '1px solid rgba(37,99,235,0.2)', borderRadius: 'var(--r-lg)', fontFamily: 'var(--font-mono)' }}><Mail className="w-3.5 h-3.5" />Auto-Email</button>}
                              {(item.actions || []).includes('quick-sms') && <button onClick={async () => { try { await apiClient.post('/intelligence/alerts/action', { alert_id: item.id || item.signal_key, action: 'quick-sms' }); toast.success('SMS queued'); } catch { toast.error('Could not queue SMS'); } }} className="flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] text-[11px] font-semibold" style={{ background: 'rgba(22,163,74,0.08)', color: 'var(--positive)', border: '1px solid rgba(22,163,74,0.2)', borderRadius: 'var(--r-lg)', fontFamily: 'var(--font-mono)' }}><MessageSquare className="w-3.5 h-3.5" />Quick-SMS</button>}
                              {(item.actions || []).includes('hand-off') && <button onClick={() => setDelegateModalOpen(true)} className="flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] text-[11px] font-semibold" style={{ background: 'var(--lava-wash)', color: 'var(--lava)', border: '1px solid rgba(232,93,0,0.2)', borderRadius: 'var(--r-lg)', fontFamily: 'var(--font-mono)' }}><Users className="w-3.5 h-3.5" />Hand Off</button>}
                              <button onClick={async () => { try { await apiClient.post('/intelligence/alerts/action', { alert_id: item.id || item.signal_key, action: 'complete' }); toast.success('Marked complete'); } catch { toast.error('Could not mark complete'); } }} className="flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] text-[11px] font-semibold" style={{ background: 'rgba(22,163,74,0.08)', color: 'var(--positive)', border: '1px solid rgba(22,163,74,0.2)', borderRadius: 'var(--r-lg)', fontFamily: 'var(--font-mono)' }}><CheckCircle2 className="w-3.5 h-3.5" />Complete</button>
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
                <p className="text-sm" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-ui)' }}>No items in the resolution queue. Connect integrations to activate AI monitoring.</p>
              </Panel>
            )}

            {/* Reallocation Recommendations */}
            {reallocation.length > 0 && (
              <div>
                <h3 className="text-[10px] font-semibold uppercase mb-3" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)', letterSpacing: 'var(--ls-caps)' }}>Resource Reallocation</h3>
                <div className="space-y-2">
                  {reallocation.map((r, i) => (
                    <Panel key={i}>
                      <div className="flex items-start gap-3">
                        <ArrowRight className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--info)' }} />
                        <div>
                          <p className="text-sm" style={{ color: 'var(--ink-display)', fontFamily: 'var(--font-display)' }}>{r.action}</p>
                          <p className="text-xs mt-1" style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-ui)' }}>{r.impact}</p>
                        </div>
                      </div>
                    </Panel>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <DelegateActionModal
          open={delegateModalOpen}
          decision={delegateDecision}
          providers={delegateProviders}
          providerOptions={delegateProviderOptions}
          optionsLoading={delegateOptionsLoading}
          submitting={delegateSubmitting}
          defaultCreateCalendarEvent={Boolean(advisorAssignment?.createCalendarEvent)}
          onClose={() => setDelegateModalOpen(false)}
          onProviderChange={fetchDelegateOptions}
          onSubmit={handleDelegateSubmit}
        />
      </div>
    </DashboardLayout>
  );
};

export default ActionsPage;
