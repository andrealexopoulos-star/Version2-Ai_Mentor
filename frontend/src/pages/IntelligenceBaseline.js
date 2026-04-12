import { RadarSweep } from '../components/LoadingSystems';
import { useState, useEffect } from 'react';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { apiClient } from '../lib/api';
import { toast } from 'sonner';
import { Loader2, Save, Shield, TrendingUp, Users, Globe, Clock, Bell } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { fontFamily } from '../design-system/tokens';

const DOMAINS = [
  { key: 'finance', label: 'Finance', desc: 'Cash flow, invoices, revenue signals' },
  { key: 'sales', label: 'Sales', desc: 'Pipeline, deals, client communication' },
  { key: 'operations', label: 'Operations', desc: 'Meetings, capacity, process drift' },
  { key: 'team', label: 'Team', desc: 'Capacity, strain, gaps' },
  { key: 'market', label: 'Market', desc: 'Competitors, regulatory, external shifts' },
];

const SENSITIVITY_OPTIONS = [
  { value: 'low', label: 'Low', desc: 'Only major shifts' },
  { value: 'medium', label: 'Medium', desc: 'Meaningful changes' },
  { value: 'high', label: 'High', desc: 'Early detection' },
];

const ALERT_OPTIONS = [
  { value: 'silent', label: 'Silent', desc: 'Only critical escalations' },
  { value: 'moderate', label: 'Moderate', desc: 'Balanced awareness' },
  { value: 'aggressive', label: 'Aggressive', desc: 'Maximum visibility' },
];

const FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'fortnightly', label: 'Fortnightly' },
  { value: 'monthly', label: 'Monthly' },
];

const HORIZON_OPTIONS = [
  { value: 'weekly', label: 'This week' },
  { value: 'monthly', label: 'This month' },
  { value: 'quarterly', label: 'This quarter' },
  { value: 'annual', label: 'This year' },
];

const FOCUS_OPTIONS = [
  { value: 'growth', label: 'Growth', desc: 'Prioritise opportunity signals' },
  { value: 'balanced', label: 'Balanced', desc: 'Equal weight' },
  { value: 'efficiency', label: 'Efficiency', desc: 'Prioritise risk and waste signals' },
];

const Toggle = ({ checked, onChange, label, desc }) => (
  <label data-testid={`toggle-${label.toLowerCase().replace(/\s/g, '-')}`} className="flex items-center justify-between py-3 cursor-pointer group">
    <div>
      <div className="text-sm text-white/80 group-hover:text-white transition-colors">{label}</div>
      {desc && <div className="text-xs text-white/30 mt-0.5">{desc}</div>}
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-5 rounded-full transition-colors ${checked ? 'bg-white/30' : 'bg-white/8'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform ${checked ? 'translate-x-5 bg-white' : 'translate-x-0 bg-white/40'}`} />
    </button>
  </label>
);

const RadioGroup = ({ value, onChange, options, name }) => (
  <div className="flex flex-wrap gap-2">
    {options.map(opt => (
      <button
        key={opt.value}
        type="button"
        data-testid={`radio-${name}-${opt.value}`}
        onClick={() => onChange(opt.value)}
        className={`px-4 py-2 text-xs tracking-wider border transition-all ${
          value === opt.value
            ? 'border-white/40 bg-white/10 text-white'
            : 'border-white/8 bg-transparent text-white/40 hover:border-white/20 hover:text-white/60'
        }`}
      >
        <div>{opt.label}</div>
        {opt.desc && <div className="text-[10px] mt-0.5 opacity-60">{opt.desc}</div>}
      </button>
    ))}
  </div>
);

const Section = ({ icon: Icon, title, children }) => (
  <div className="border border-white/6 p-6 space-y-4">
    <div className="flex items-center gap-3">
      <Icon className="w-4 h-4 text-white/30" />
      <h3 className="text-xs tracking-[0.25em] uppercase text-white/50">{title}</h3>
    </div>
    {children}
  </div>
);

const IntelligenceBaselinePage = () => {
  const { user } = useSupabaseAuth();
  const [baseline, setBaseline] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configured, setConfigured] = useState(false);

  useEffect(() => { loadBaseline(); }, []);

  const loadBaseline = async () => {
    try {
      const res = await apiClient.get('/baseline');
      setBaseline(res.data.baseline);
      setConfigured(res.data.configured);
    } catch (e) {
      console.error('[baseline] Load failed:', e);
      toast.error('Failed to load configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiClient.post('/baseline', { baseline });
      setConfigured(true);
      toast.success('Intelligence baseline saved');
    } catch (e) {
      console.error('[baseline] Save failed:', e);
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const update = (path, value) => {
    setBaseline(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const keys = path.split('.');
      let obj = next;
      for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
      obj[keys[keys.length - 1]] = value;
      return next;
    });
  };

  if (loading || !baseline) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <RadarSweep compact />
        </div>
      </DashboardLayout>
    );
  }

  const domains = baseline.monitored_domains || {};
  const thresholds = baseline.escalation_thresholds || {};

  return (
    <DashboardLayout>
      <div data-testid="intelligence-baseline-page" className="min-h-screen bg-[#050505] text-white/80">
        <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">

          {/* Header */}
          <div>
            <div className="text-[11px] uppercase tracking-[0.08em] mb-2" style={{ fontFamily: fontFamily.mono, color: '#E85D00' }}>— Configuration</div>
            <h1 className="font-medium" style={{ fontFamily: fontFamily.display, color: '#EDF1F7', fontSize: 'clamp(1.8rem, 3vw, 2.4rem)', letterSpacing: '-0.02em', lineHeight: 1.05 }}>Intelligence <em style={{ fontStyle: 'italic', color: '#E85D00' }}>baseline</em>.</h1>
            <p className="text-xs mt-2 leading-relaxed max-w-lg" style={{ color: '#8FA0B8' }}>
              Configure what BIQc monitors, how often it briefs, and how aggressively it escalates. This drives all downstream intelligence.
            </p>
            {!configured && (
              <div className="mt-3 text-xs text-amber-400/70 border border-amber-400/20 px-3 py-2 inline-block">
                Not yet configured. Set your preferences and save.
              </div>
            )}
          </div>

          {/* Monitored Domains */}
          <Section icon={Shield} title="Monitored Domains">
            {DOMAINS.map(d => (
              <Toggle
                key={d.key}
                checked={domains[d.key] || false}
                onChange={v => update(`monitored_domains.${d.key}`, v)}
                label={d.label}
                desc={d.desc}
              />
            ))}
          </Section>

          {/* Risk Sensitivity */}
          <Section icon={TrendingUp} title="Risk Sensitivity">
            <div className="space-y-4">
              <div>
                <div className="text-xs text-white/40 mb-2">Client Risk</div>
                <RadioGroup
                  name="client-risk"
                  value={baseline.client_risk_sensitivity}
                  onChange={v => update('client_risk_sensitivity', v)}
                  options={SENSITIVITY_OPTIONS}
                />
              </div>
              <div>
                <div className="text-xs text-white/40 mb-2">Team Risk</div>
                <RadioGroup
                  name="team-risk"
                  value={baseline.team_risk_sensitivity}
                  onChange={v => update('team_risk_sensitivity', v)}
                  options={SENSITIVITY_OPTIONS}
                />
              </div>
            </div>
          </Section>

          {/* Strategic Focus */}
          <Section icon={Globe} title="Strategic Focus">
            <div className="space-y-4">
              <div>
                <div className="text-xs text-white/40 mb-2">Growth vs Efficiency</div>
                <RadioGroup
                  name="focus"
                  value={baseline.growth_vs_efficiency}
                  onChange={v => update('growth_vs_efficiency', v)}
                  options={FOCUS_OPTIONS}
                />
              </div>
              <div>
                <div className="text-xs text-white/40 mb-2">Time Horizon</div>
                <RadioGroup
                  name="horizon"
                  value={baseline.time_horizon}
                  onChange={v => update('time_horizon', v)}
                  options={HORIZON_OPTIONS}
                />
              </div>
            </div>
          </Section>

          {/* Briefing Preferences */}
          <Section icon={Clock} title="Briefing Preferences">
            <div className="space-y-4">
              <div>
                <div className="text-xs text-white/40 mb-2">Briefing Frequency</div>
                <RadioGroup
                  name="frequency"
                  value={baseline.briefing_frequency}
                  onChange={v => update('briefing_frequency', v)}
                  options={FREQUENCY_OPTIONS}
                />
              </div>
            </div>
          </Section>

          {/* Alert Tolerance */}
          <Section icon={Bell} title="Alert Tolerance">
            <RadioGroup
              name="alerts"
              value={baseline.alert_tolerance}
              onChange={v => update('alert_tolerance', v)}
              options={ALERT_OPTIONS}
            />
          </Section>

          {/* Escalation Thresholds */}
          <Section icon={Users} title="Escalation Thresholds">
            <p className="text-xs text-white/30 mb-3">Confidence threshold before escalation. Lower = more sensitive.</p>
            {DOMAINS.filter(d => domains[d.key]).map(d => (
              <div key={d.key} className="flex items-center justify-between py-2">
                <span className="text-sm text-white/60">{d.label}</span>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0.4"
                    max="0.95"
                    step="0.05"
                    value={thresholds[d.key] || 0.7}
                    onChange={e => update(`escalation_thresholds.${d.key}`, parseFloat(e.target.value))}
                    className="w-32 accent-white/50"
                    data-testid={`threshold-${d.key}`}
                  />
                  <span className="text-xs text-white/40 w-10 text-right">{(thresholds[d.key] || 0.7).toFixed(2)}</span>
                </div>
              </div>
            ))}
          </Section>

          {/* Save */}
          <div className="flex justify-end pt-4 border-t border-white/6">
            <button
              data-testid="save-baseline"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 text-xs tracking-[0.2em] uppercase bg-white/10 border border-white/20 text-white/80 hover:bg-white/15 transition-colors disabled:opacity-30"
            >
              {saving ? null : <Save className="w-3.5 h-3.5" />}
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>

        </div>
      </div>
    </DashboardLayout>
  );
};

export default IntelligenceBaselinePage;
