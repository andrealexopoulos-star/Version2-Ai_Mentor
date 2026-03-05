import React, { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { apiClient } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import { trackEvent, EVENTS } from '../lib/analytics';
import { Plus, Clock, CheckCircle2, AlertTriangle, ArrowRight, Loader2, Target, TrendingUp, DollarSign, Users, BarChart3 } from 'lucide-react';

const HEAD = "'Cormorant Garamond', Georgia, serif";
const MONO = "'JetBrains Mono', monospace";
const BODY = "'Inter', sans-serif";

const DECISION_TYPES = [
  { value: 'hiring', label: 'Hiring', icon: Users },
  { value: 'pricing', label: 'Pricing', icon: DollarSign },
  { value: 'client_strategy', label: 'Client Strategy', icon: Target },
  { value: 'operational_change', label: 'Operational Change', icon: TrendingUp },
  { value: 'market_expansion', label: 'Market Expansion', icon: BarChart3 },
  { value: 'cost_reduction', label: 'Cost Reduction', icon: DollarSign },
  { value: 'product_launch', label: 'Product Launch', icon: Plus },
  { value: 'partnership', label: 'Partnership', icon: Users },
];

const DOMAINS = [
  { id: 'revenue', label: 'Revenue', color: '#10B981' },
  { id: 'cash', label: 'Cash', color: '#3B82F6' },
  { id: 'operations', label: 'Operations', color: '#F59E0B' },
  { id: 'people', label: 'People', color: '#8B5CF6' },
  { id: 'market', label: 'Market', color: '#EF4444' },
];

const CHECKPOINT_STATUS = {
  pending: { label: 'Pending', color: '#64748B', icon: Clock },
  positive: { label: 'Positive Impact', color: '#10B981', icon: CheckCircle2 },
  negative: { label: 'Negative Impact', color: '#EF4444', icon: AlertTriangle },
  neutral: { label: 'Neutral', color: '#F59E0B', icon: Clock },
};

export default function DecisionsPage() {
  const [decisions, setDecisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    decision_category: '',
    decision_statement: '',
    expected_instability_change: {},
    affected_domains: [],
    expected_time_horizon: 30,
    evidence_refs: [],
  });

  useEffect(() => {
    fetchDecisions();
  }, []);

  const fetchDecisions = async () => {
    try {
      const res = await apiClient.get('/cognition/decisions');
      setDecisions(res.data?.decisions || []);
    } catch {
      // Migration may not be run yet
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.decision_category || !form.decision_statement) {
      toast.error('Please fill in the decision type and description.');
      return;
    }
    setSubmitting(true);
    try {
      await apiClient.post('/cognition/decisions', form);
      trackEvent(EVENTS.DECISION_RECORDED, { category: form.decision_category, domains: form.affected_domains });
      toast.success('Decision recorded. Checkpoints scheduled at 30, 60, and 90 days.');
      setForm({ decision_category: '', decision_statement: '', expected_instability_change: {}, affected_domains: [], expected_time_horizon: 30, evidence_refs: [] });
      setShowForm(false);
      fetchDecisions();
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data?.detail || 'Failed to record decision.';
      if (msg.includes('MIGRATION')) {
        toast.error('Cognition Core not yet deployed. Please run SQL migrations 044 + 045.');
      } else {
        toast.error(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const toggleDomain = (domainId) => {
    setForm(prev => ({
      ...prev,
      affected_domains: prev.affected_domains.includes(domainId)
        ? prev.affected_domains.filter(d => d !== domainId)
        : [...prev.affected_domains, domainId],
    }));
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto" data-testid="decisions-page">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold" style={{ color: '#F4F7FA', fontFamily: HEAD }} data-testid="decisions-title">
              Decision Tracker
            </h1>
            <p className="text-sm mt-1" style={{ color: '#9FB0C3', fontFamily: BODY }}>
              Record strategic decisions. Track outcomes at 30, 60, and 90 days.
            </p>
          </div>
          <Button
            onClick={() => setShowForm(!showForm)}
            className="gap-2"
            style={{ background: '#FF6A00', color: 'white' }}
            data-testid="new-decision-btn"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Decision</span>
          </Button>
        </div>

        {/* Decision Form */}
        {showForm && (
          <Card className="mb-8" style={{ background: '#141C26', border: '1px solid #243140' }} data-testid="decision-form">
            <CardHeader>
              <CardTitle style={{ color: '#F4F7FA', fontFamily: HEAD }}>Record a Decision</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Decision Type */}
              <div>
                <Label style={{ color: '#9FB0C3', fontFamily: MONO, fontSize: 11 }}>Decision Type</Label>
                <Select value={form.decision_category} onValueChange={v => setForm(p => ({ ...p, decision_category: v }))}>
                  <SelectTrigger className="mt-1.5" style={{ background: '#0A1018', border: '1px solid #243140', color: '#F4F7FA' }} data-testid="decision-type-select">
                    <SelectValue placeholder="Select type..." />
                  </SelectTrigger>
                  <SelectContent style={{ background: '#141C26', border: '1px solid #243140' }}>
                    {DECISION_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value} style={{ color: '#F4F7FA' }}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Description */}
              <div>
                <Label style={{ color: '#9FB0C3', fontFamily: MONO, fontSize: 11 }}>Decision Description</Label>
                <Textarea
                  className="mt-1.5"
                  value={form.decision_statement}
                  onChange={e => setForm(p => ({ ...p, decision_statement: e.target.value }))}
                  placeholder="Describe the decision and its strategic rationale..."
                  rows={3}
                  style={{ background: '#0A1018', border: '1px solid #243140', color: '#F4F7FA' }}
                  data-testid="decision-description"
                />
              </div>

              {/* Affected Domains */}
              <div>
                <Label style={{ color: '#9FB0C3', fontFamily: MONO, fontSize: 11 }}>Domains Affected</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {DOMAINS.map(d => (
                    <button
                      key={d.id}
                      onClick={() => toggleDomain(d.id)}
                      className="px-3 py-2 rounded-lg text-sm font-medium transition-all"
                      style={{
                        background: form.affected_domains.includes(d.id) ? d.color + '20' : '#0A1018',
                        color: form.affected_domains.includes(d.id) ? d.color : '#64748B',
                        border: `1px solid ${form.affected_domains.includes(d.id) ? d.color + '50' : '#243140'}`,
                        fontFamily: BODY,
                      }}
                      data-testid={`domain-${d.id}`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Time Horizon */}
              <div>
                <Label style={{ color: '#9FB0C3', fontFamily: MONO, fontSize: 11 }}>Expected Time Horizon (days)</Label>
                <Input
                  type="number"
                  value={form.expected_time_horizon}
                  onChange={e => setForm(p => ({ ...p, expected_time_horizon: parseInt(e.target.value) || 30 }))}
                  className="mt-1.5 w-32"
                  style={{ background: '#0A1018', border: '1px solid #243140', color: '#F4F7FA' }}
                  data-testid="decision-horizon"
                />
              </div>

              {/* Submit */}
              <div className="flex gap-3 pt-2">
                <Button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="gap-2"
                  style={{ background: '#FF6A00', color: 'white' }}
                  data-testid="submit-decision-btn"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Record Decision
                </Button>
                <Button variant="outline" onClick={() => setShowForm(false)} style={{ borderColor: '#243140', color: '#9FB0C3' }}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Decision History */}
        <div className="space-y-4" data-testid="decisions-list">
          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3" style={{ color: '#FF6A00' }} />
              <p className="text-sm" style={{ color: '#64748B', fontFamily: BODY }}>Loading decisions...</p>
            </div>
          ) : decisions.length === 0 ? (
            <div className="text-center py-16 rounded-xl" style={{ background: '#141C26', border: '1px solid #243140' }} data-testid="no-decisions">
              <Target className="w-10 h-10 mx-auto mb-3" style={{ color: '#243140' }} />
              <p className="text-lg font-semibold" style={{ color: '#F4F7FA', fontFamily: HEAD }}>No decisions recorded yet</p>
              <p className="text-sm mt-1" style={{ color: '#64748B', fontFamily: BODY }}>
                Record your first strategic decision to start tracking outcomes.
              </p>
              <Button onClick={() => setShowForm(true)} className="mt-4 gap-2" style={{ background: '#FF6A00', color: 'white' }} data-testid="first-decision-btn">
                <Plus className="w-4 h-4" /> Record First Decision
              </Button>
            </div>
          ) : (
            decisions.map(d => (
              <DecisionCard key={d.id} decision={d} onOutcomeRecorded={fetchDecisions} />
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

function DecisionCard({ decision, onOutcomeRecorded }) {
  const [expanded, setExpanded] = useState(false);
  const [recordingCheckpoint, setRecordingCheckpoint] = useState(null);
  const typeInfo = DECISION_TYPES.find(t => t.value === decision.decision_category) || { label: decision.decision_category, icon: Target };
  const Icon = typeInfo.icon;
  const checkpoints = decision.checkpoints || [];

  const handleRecordOutcome = async (checkpointDay, effective) => {
    setRecordingCheckpoint(checkpointDay);
    try {
      await apiClient.post('/cognition/decisions/checkpoint-outcome', {
        decision_id: decision.id,
        checkpoint_day: checkpointDay,
        decision_effective: effective,
        variance_delta: 0,
        notes: '',
      });
      trackEvent(EVENTS.DECISION_RECORDED, { action: 'checkpoint_outcome', checkpoint_day: checkpointDay, effective });
      toast.success(`Day ${checkpointDay} outcome recorded.`);
      onOutcomeRecorded?.();
    } catch (err) {
      toast.error('Failed to record outcome.');
    } finally {
      setRecordingCheckpoint(null);
    }
  };

  return (
    <div
      className="rounded-xl p-5 transition-all cursor-pointer hover:border-[#FF6A00]/20"
      style={{ background: '#141C26', border: '1px solid #243140' }}
      onClick={() => setExpanded(!expanded)}
      data-testid={`decision-card-${decision.id}`}
    >
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#FF6A00' + '15' }}>
          <Icon className="w-5 h-5" style={{ color: '#FF6A00' }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#FF6A00', fontFamily: MONO }}>
              {typeInfo.label}
            </span>
            <span className="text-xs" style={{ color: '#64748B', fontFamily: MONO }}>
              {decision.created_at ? new Date(decision.created_at).toLocaleDateString() : ''}
            </span>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: '#F4F7FA', fontFamily: BODY }}>
            {decision.decision_statement}
          </p>

          {/* Affected Domains */}
          {decision.affected_domains?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {decision.affected_domains.map(d => {
                const domain = DOMAINS.find(dm => dm.id === d);
                return (
                  <span key={d} className="px-2 py-0.5 rounded text-xs" style={{ background: (domain?.color || '#64748B') + '15', color: domain?.color || '#64748B', fontFamily: MONO }}>
                    {domain?.label || d}
                  </span>
                );
              })}
            </div>
          )}

          {/* Checkpoints */}
          {expanded && checkpoints.length > 0 && (
            <div className="mt-4 pt-4 space-y-2" style={{ borderTop: '1px solid #243140' }}>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748B', fontFamily: MONO }}>
                Outcome Checkpoints
              </p>
              {checkpoints.map(cp => {
                const st = CHECKPOINT_STATUS[cp.status || 'pending'];
                const StIcon = st.icon;
                return (
                  <div key={cp.id || cp.checkpoint_day} className="flex items-center gap-3 py-2 px-3 rounded-lg" style={{ background: '#0A1018' }}>
                    <StIcon className="w-4 h-4 shrink-0" style={{ color: st.color }} />
                    <span className="text-xs font-medium" style={{ color: '#F4F7FA', fontFamily: MONO }}>Day {cp.checkpoint_day}</span>
                    <span className="text-xs flex-1" style={{ color: '#9FB0C3', fontFamily: BODY }}>
                      {cp.scheduled_at ? new Date(cp.scheduled_at).toLocaleDateString() : 'Scheduled'}
                    </span>
                    {(cp.status === 'pending' && new Date(cp.scheduled_at) <= new Date()) ? (
                      <div className="flex gap-1.5">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRecordOutcome(cp.checkpoint_day, true); }}
                          disabled={recordingCheckpoint === cp.checkpoint_day}
                          className="px-2 py-1 rounded text-xs font-medium transition-all hover:opacity-80"
                          style={{ background: '#10B98120', color: '#10B981', fontFamily: MONO }}
                          data-testid={`outcome-positive-${cp.checkpoint_day}`}
                        >
                          {recordingCheckpoint === cp.checkpoint_day ? '...' : 'Effective'}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRecordOutcome(cp.checkpoint_day, false); }}
                          disabled={recordingCheckpoint === cp.checkpoint_day}
                          className="px-2 py-1 rounded text-xs font-medium transition-all hover:opacity-80"
                          style={{ background: '#EF444420', color: '#EF4444', fontFamily: MONO }}
                          data-testid={`outcome-negative-${cp.checkpoint_day}`}
                        >
                          {recordingCheckpoint === cp.checkpoint_day ? '...' : 'Ineffective'}
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs" style={{ color: st.color, fontFamily: MONO }}>{st.label}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <ArrowRight className={`w-4 h-4 shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`} style={{ color: '#64748B' }} />
      </div>
    </div>
  );
}
