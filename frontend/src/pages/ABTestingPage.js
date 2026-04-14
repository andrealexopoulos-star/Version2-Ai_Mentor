import React, { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { apiClient } from '../lib/api';
import { toast } from 'sonner';
import { 
  FlaskConical, Plus, Play, Pause, BarChart3, 
  Loader2, ChevronRight, Clock, CheckCircle2 
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { fontFamily } from '../design-system/tokens';


const Panel = ({ children, className = '' }) => (
  <div className={`rounded-lg p-5 ${className}`} style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }}>{children}</div>
);

const StatusBadge = ({ status }) => {
  const colors = {
    draft: { bg: '#64748B15', text: '#64748B', label: 'Draft' },
    active: { bg: '#10B98115', text: '#10B981', label: 'Active' },
    paused: { bg: '#F59E0B15', text: '#F59E0B', label: 'Paused' },
    completed: { bg: '#3B82F615', text: '#3B82F6', label: 'Completed' },
  };
  const c = colors[status] || colors.draft;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider" 
          style={{ background: c.bg, color: c.text, fontFamily: fontFamily.mono }}>
      {c.label}
    </span>
  );
};

const ABTestingPage = () => {
  const [experiments, setExperiments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', metric: 'conversion_rate' });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchExperiments();
  }, []);

  const fetchExperiments = async () => {
    try {
      const res = await apiClient.get('/experiments/list');
      setExperiments(res.data?.experiments || []);
    } catch {
      // Fallback: show empty state
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    setCreating(true);
    try {
      const res = await apiClient.post('/experiments/create', {
        name: form.name,
        description: form.description,
      });
      toast.success('Experiment created');
      setExperiments(prev => [res.data, ...prev]);
      setShowCreate(false);
      setForm({ name: '', description: '', metric: 'conversion_rate' });
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create experiment');
    } finally {
      setCreating(false);
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      await apiClient.post(`/experiments/${id}/${newStatus === 'active' ? 'start' : 'stop'}`);
      setExperiments(prev => prev.map(e => e.id === id ? { ...e, status: newStatus } : e));
      toast.success(`Experiment ${newStatus}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update experiment');
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-[1200px]" style={{ fontFamily: fontFamily.body }} data-testid="ab-testing-page">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#EDF1F7] mb-1" style={{ fontFamily: fontFamily.display }}>A/B Testing</h1>
            <p className="text-sm text-[#8FA0B8]">Create and manage experiments to optimise your intelligence outputs.</p>
          </div>
          <Button
            onClick={() => setShowCreate(!showCreate)}
            data-testid="ab-create-btn"
            style={{ background: '#E85D00', color: 'white' }}
          >
            <Plus className="w-4 h-4 mr-2" /> New Experiment
          </Button>
        </div>

        {/* Create Form */}
        {showCreate && (
          <Panel>
            <h3 className="text-sm font-semibold text-[#EDF1F7] mb-4" style={{ fontFamily: fontFamily.display }}>New Experiment</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-[#64748B] block mb-1.5" style={{ fontFamily: fontFamily.mono }}>Name *</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g., SoundBoard prompt tone test"
                  data-testid="ab-name-input"
                  className="w-full px-3 py-2.5 rounded-md text-sm"
                  style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)', color: 'var(--biqc-text)' }}
                />
              </div>
              <div>
                <label className="text-xs text-[#64748B] block mb-1.5" style={{ fontFamily: fontFamily.mono }}>Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="What are you testing and why?"
                  rows={2}
                  data-testid="ab-desc-input"
                  className="w-full px-3 py-2.5 rounded-md text-sm resize-none"
                  style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)', color: 'var(--biqc-text)' }}
                />
              </div>
              <div>
                <label className="text-xs text-[#64748B] block mb-1.5" style={{ fontFamily: fontFamily.mono }}>Primary Metric</label>
                <select
                  value={form.metric}
                  onChange={e => setForm(f => ({ ...f, metric: e.target.value }))}
                  data-testid="ab-metric-select"
                  className="w-full px-3 py-2.5 rounded-md text-sm"
                  style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)', color: 'var(--biqc-text)' }}
                >
                  <option value="conversion_rate">Conversion Rate</option>
                  <option value="engagement">Engagement Score</option>
                  <option value="satisfaction">User Satisfaction</option>
                  <option value="response_quality">Response Quality</option>
                </select>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleCreate} disabled={creating} data-testid="ab-submit-btn"
                  style={{ background: '#E85D00', color: 'white' }}>
                  {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Create Experiment
                </Button>
                <Button onClick={() => setShowCreate(false)} variant="outline"
                  className="border-[rgba(140,170,210,0.15)] text-[#8FA0B8]">
                  Cancel
                </Button>
              </div>
            </div>
          </Panel>
        )}

        {/* Experiments List */}
        {loading && (
          <Panel className="text-center py-12">
            <Loader2 className="w-6 h-6 text-[#E85D00] mx-auto mb-3 animate-spin" />
            <p className="text-sm text-[#8FA0B8]">Loading experiments...</p>
          </Panel>
        )}

        {!loading && experiments.length === 0 && (
          <Panel className="text-center py-12">
            <FlaskConical className="w-8 h-8 text-[#64748B] mx-auto mb-3" />
            <p className="text-sm text-[#EDF1F7] mb-1" style={{ fontFamily: fontFamily.display }}>No experiments yet</p>
            <p className="text-xs text-[#64748B] mb-4">Create your first A/B test to start optimising intelligence outputs.</p>
          </Panel>
        )}

        {!loading && experiments.length > 0 && (
          <div className="space-y-3">
            {experiments.map(exp => (
              <Panel key={exp.id} className="cursor-pointer transition-all hover:border-[#E85D00]/30"
                onClick={() => setSelected(selected === exp.id ? null : exp.id)}>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: '#E85D0015' }}>
                    <FlaskConical className="w-5 h-5 text-[#E85D00]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="text-sm font-semibold text-[#EDF1F7] truncate">{exp.name}</h3>
                      <StatusBadge status={exp.status} />
                    </div>
                    <p className="text-xs text-[#64748B] truncate">{exp.description || 'No description'}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {exp.status === 'draft' && (
                      <button onClick={e => { e.stopPropagation(); handleStatusChange(exp.id, 'active'); }}
                        data-testid={`ab-start-${exp.id}`}
                        className="p-2 rounded-md transition-colors" style={{ background: '#10B98115' }}>
                        <Play className="w-4 h-4 text-[#10B981]" />
                      </button>
                    )}
                    {exp.status === 'active' && (
                      <button onClick={e => { e.stopPropagation(); handleStatusChange(exp.id, 'paused'); }}
                        data-testid={`ab-pause-${exp.id}`}
                        className="p-2 rounded-md transition-colors" style={{ background: '#F59E0B15' }}>
                        <Pause className="w-4 h-4 text-[#F59E0B]" />
                      </button>
                    )}
                    <ChevronRight className={`w-4 h-4 text-[#64748B] transition-transform ${selected === exp.id ? 'rotate-90' : ''}`} />
                  </div>
                </div>

                {/* Expanded Details */}
                {selected === exp.id && (
                  <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--biqc-border)' }}>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 rounded-lg" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
                        <span className="text-[10px] text-[#64748B] block mb-1" style={{ fontFamily: fontFamily.mono }}>Metric</span>
                        <span className="text-sm text-[#EDF1F7]" style={{ fontFamily: fontFamily.mono }}>{(exp.metric || 'conversion_rate').replace(/_/g, ' ')}</span>
                      </div>
                      <div className="p-3 rounded-lg" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
                        <span className="text-[10px] text-[#64748B] block mb-1" style={{ fontFamily: fontFamily.mono }}>Variants</span>
                        <span className="text-sm text-[#EDF1F7]" style={{ fontFamily: fontFamily.mono }}>{exp.variants?.length || 2}</span>
                      </div>
                      <div className="p-3 rounded-lg" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
                        <span className="text-[10px] text-[#64748B] block mb-1" style={{ fontFamily: fontFamily.mono }}>Created</span>
                        <span className="text-sm text-[#EDF1F7]" style={{ fontFamily: fontFamily.mono }}>
                          {exp.created_at ? new Date(exp.created_at).toLocaleDateString() : '—'}
                        </span>
                      </div>
                      <div className="p-3 rounded-lg" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
                        <span className="text-[10px] text-[#64748B] block mb-1" style={{ fontFamily: fontFamily.mono }}>Impressions</span>
                        <span className="text-sm text-[#EDF1F7]" style={{ fontFamily: fontFamily.mono }}>{exp.total_impressions || 0}</span>
                      </div>
                    </div>
                  </div>
                )}
              </Panel>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default ABTestingPage;
