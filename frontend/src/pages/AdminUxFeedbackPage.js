import React, { useEffect, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { apiClient } from '../lib/api';
import { toast } from 'sonner';
import { fontFamily } from '../design-system/tokens';

const cardStyle = {
  background: 'var(--biqc-bg-card)',
  border: '1px solid var(--biqc-border)',
  borderRadius: 12,
};

const inputStyle = {
  width: '100%',
  background: 'var(--biqc-bg)',
  border: '1px solid var(--biqc-border)',
  color: 'var(--biqc-text)',
  borderRadius: 8,
  padding: '8px 10px',
  fontFamily: fontFamily.mono,
  fontSize: 12,
};

const AdminUxFeedbackPage = () => {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState(null);
  const [events, setEvents] = useState([]);
  const [checkpoints, setCheckpoints] = useState([]);
  const [deferredItems, setDeferredItems] = useState([]);
  const [checkpointForm, setCheckpointForm] = useState({
    milestone_key: 'wave-c-ux-validation',
    checkpoint_key: 'pricing-comprehension',
    target_metric: 'pricing_confusion_rate',
    baseline_value: 1.0,
    target_value: 0.75,
    current_value: 1.0,
    status: 'planned',
    notes: 'Track misunderstanding incidents per 100 sessions',
    owner_user_id: '',
    due_at: '',
  });

  const refresh = async () => {
    setLoading(true);
    try {
      const [summaryRes, checkpointsRes] = await Promise.all([
        apiClient.get('/admin/ux-feedback/summary'),
        apiClient.get('/admin/ux-feedback/checkpoints'),
      ]);
      const deferredRes = await apiClient.get('/admin/deferred-integrations');
      setSummary(summaryRes?.data?.summary || null);
      setEvents(summaryRes?.data?.events || []);
      setCheckpoints(checkpointsRes?.data?.checkpoints || []);
      setDeferredItems(deferredRes?.data?.items || []);
    } catch {
      toast.error('Failed to load UX feedback data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const saveCheckpoint = async () => {
    try {
      await apiClient.put('/admin/ux-feedback/checkpoints', {
        ...checkpointForm,
        baseline_value: checkpointForm.baseline_value === '' ? null : Number(checkpointForm.baseline_value),
        target_value: checkpointForm.target_value === '' ? null : Number(checkpointForm.target_value),
        current_value: checkpointForm.current_value === '' ? null : Number(checkpointForm.current_value),
        owner_user_id: checkpointForm.owner_user_id || null,
        due_at: checkpointForm.due_at || null,
      });
      toast.success('Checkpoint saved');
      await refresh();
    } catch {
      toast.error('Failed to save checkpoint');
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-4 max-w-[1280px]" style={{ fontFamily: fontFamily.body, color: 'var(--biqc-text)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl text-[#EDF1F7]" style={{ fontFamily: fontFamily.display }}>UX Feedback Control</h1>
            <p className="text-xs text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>
              User feedback events, usability checkpoints, and milestone success tracking.
            </p>
          </div>
          <button onClick={refresh} disabled={loading} className="px-3 py-2 rounded-lg text-xs" style={{ ...cardStyle, fontFamily: fontFamily.mono }}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3" style={cardStyle}>
            <div className="text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>Total Feedback Events</div>
            <div className="text-xl text-[#EDF1F7]" style={{ fontFamily: fontFamily.mono }}>{summary?.total_events ?? 0}</div>
          </div>
          <div className="p-3" style={cardStyle}>
            <div className="text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>Average Rating</div>
            <div className="text-xl text-[#EDF1F7]" style={{ fontFamily: fontFamily.mono }}>{summary?.average_rating ?? '—'}</div>
          </div>
          <div className="p-3" style={cardStyle}>
            <div className="text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>Checkpoint Count</div>
            <div className="text-xl text-[#EDF1F7]" style={{ fontFamily: fontFamily.mono }}>{checkpoints.length}</div>
          </div>
          <div className="p-3" style={cardStyle}>
            <div className="text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>Open Checkpoints</div>
            <div className="text-xl text-[#EDF1F7]" style={{ fontFamily: fontFamily.mono }}>
              {checkpoints.filter((c) => !['completed', 'pass'].includes(String(c.status || '').toLowerCase())).length}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="p-4 space-y-2" style={cardStyle}>
            <h2 className="text-lg" style={{ fontFamily: fontFamily.display }}>Feedback Type Breakdown</h2>
            <div className="space-y-1">
              {Object.entries(summary?.by_type || {}).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between px-2 py-1 rounded" style={{ background: 'var(--biqc-bg)' }}>
                  <span className="text-xs" style={{ fontFamily: fontFamily.mono }}>{k}</span>
                  <span className="text-xs text-[#EDF1F7]" style={{ fontFamily: fontFamily.mono }}>{v}</span>
                </div>
              ))}
              {Object.keys(summary?.by_type || {}).length === 0 && (
                <div className="text-xs text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>No feedback events yet.</div>
              )}
            </div>
          </div>

          <div className="p-4 space-y-2" style={cardStyle}>
            <h2 className="text-lg" style={{ fontFamily: fontFamily.display }}>Upsert Usability Checkpoint</h2>
            <div className="grid grid-cols-2 gap-2">
              {[
                ['milestone_key', 'Milestone key'],
                ['checkpoint_key', 'Checkpoint key'],
                ['target_metric', 'Target metric'],
                ['status', 'Status'],
                ['owner_user_id', 'Owner user id'],
                ['due_at', 'Due at (ISO)'],
              ].map(([field, label]) => (
                <div key={field}>
                  <div className="text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>{label}</div>
                  <input
                    style={inputStyle}
                    value={checkpointForm[field]}
                    onChange={(e) => setCheckpointForm((p) => ({ ...p, [field]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                ['baseline_value', 'Baseline'],
                ['target_value', 'Target'],
                ['current_value', 'Current'],
              ].map(([field, label]) => (
                <div key={field}>
                  <div className="text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>{label}</div>
                  <input
                    style={inputStyle}
                    value={checkpointForm[field]}
                    onChange={(e) => setCheckpointForm((p) => ({ ...p, [field]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <div>
              <div className="text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>Notes</div>
              <textarea
                style={{ ...inputStyle, minHeight: 80 }}
                value={checkpointForm.notes}
                onChange={(e) => setCheckpointForm((p) => ({ ...p, notes: e.target.value }))}
              />
            </div>
            <button onClick={saveCheckpoint} className="px-3 py-2 rounded-lg text-xs" style={{ ...cardStyle, borderColor: '#E85D0030', color: '#E85D00', fontFamily: fontFamily.mono }}>
              Save Checkpoint
            </button>
          </div>
        </div>

        <div className="p-4" style={cardStyle}>
          <h2 className="text-lg mb-2" style={{ fontFamily: fontFamily.display }}>Latest Feedback Events</h2>
          <div className="max-h-[260px] overflow-auto">
            {(events || []).map((e) => (
              <div key={e.id} className="px-3 py-2 flex items-center gap-3" style={{ borderBottom: '1px solid var(--biqc-border)' }}>
                <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: '#3B82F615', color: '#3B82F6', fontFamily: fontFamily.mono }}>
                  {e.feedback_type || 'unknown'}
                </span>
                <span className="text-xs text-[#EDF1F7]" style={{ fontFamily: fontFamily.body }}>{e.message || '—'}</span>
                <span className="ml-auto text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>
                  {e.rating ? `rating ${e.rating}` : ''}
                </span>
              </div>
            ))}
            {events.length === 0 && (
              <div className="text-xs text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>No feedback events captured yet.</div>
            )}
          </div>
        </div>

        <div className="p-4" style={cardStyle}>
          <h2 className="text-lg mb-2" style={{ fontFamily: fontFamily.display }}>Deferred Integrations Tracker</h2>
          <div className="max-h-[260px] overflow-auto">
            {deferredItems.map((item) => (
              <div key={item.id} className="px-3 py-2 flex items-center gap-3" style={{ borderBottom: '1px solid var(--biqc-border)' }}>
                <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: '#E85D0015', color: '#E85D00', fontFamily: fontFamily.mono }}>
                  {item.integration_key}
                </span>
                <span className="text-xs text-[#EDF1F7] flex-1">{item.display_name}</span>
                <span className="text-[10px] text-[#8FA0B8]" style={{ fontFamily: fontFamily.mono }}>P{item.priority}</span>
                <span className="text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>{item.status}</span>
              </div>
            ))}
            {deferredItems.length === 0 && (
              <div className="text-xs text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>No deferred integrations tracked yet.</div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminUxFeedbackPage;
