import { CognitiveMesh } from '../components/LoadingSystems';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';
import {
  Building2, ArrowRight, ArrowLeft,
  CheckCircle, Target, Users, TrendingUp,
  Zap, Brain, Globe, ExternalLink, Package, Check, Activity
} from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '../lib/api';
import { trackActivationStep } from '../lib/analytics';
import { fontFamily } from '../design-system/tokens';

const STEPS = [
  { id: 'welcome', label: 'Welcome', icon: Zap },
  { id: 'basics', label: 'Business Identity', icon: Building2 },
  { id: 'website', label: 'Website', icon: Globe },
  { id: 'market', label: 'Market & Customers', icon: Target },
  { id: 'product', label: 'Products & Services', icon: Package },
  { id: 'team', label: 'Team', icon: Users },
  { id: 'goals', label: 'Goals & Strategy', icon: TrendingUp },
  { id: 'preferences', label: 'BIQC Preferences', icon: Brain },
  { id: 'signals', label: 'Tune Signals', icon: Activity },
];

/* Sidebar steps match the mockup's 5-step wizard chrome */
const SIDEBAR_STEPS = [
  { num: 1, name: 'Account created', hint: 'Done' },
  { num: 2, name: "What's your business?", hint: '~3 min' },
  { num: 3, name: 'Connect your tools', hint: 'Inbox, CRM, accounting' },
  { num: 4, name: 'Tune your signals', hint: 'What good looks like' },
  { num: 5, name: 'Your first brief', hint: 'Live in 90 seconds' },
];

const OnboardingWizard = () => {
  const navigate = useNavigate();
  const { user, markOnboardingComplete, deferOnboarding } = useSupabaseAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({});
  const [existingProfile, setExistingProfile] = useState({});
  const [resolvedFieldsMap, setResolvedFieldsMap] = useState({});
  const [enriching, setEnriching] = useState(false);
  const [signalToggles, setSignalToggles] = useState({
    deal_stalled: true,
    cash_runway: true,
    churn_risk: true,
    invoice_aging: true,
    meeting_overload: false,
    competitor_mentions: true,
    press_mentions: false,
  });
  const [enrichPreview, setEnrichPreview] = useState(null);
  const saveTimerRef = useRef(null);

  // Load existing data on mount
  useEffect(() => {
    loadExistingData();
  }, []);

  const loadExistingData = async () => {
    try {
      const res = await apiClient.get('/business-profile/context');
      const ctx = res.data;
      
      const profile = ctx.profile || {};
      const onboarding = ctx.onboarding || {};
      const resolvedFields = ctx.resolved_fields || {};
      
      setExistingProfile(profile);
      setResolvedFieldsMap(resolvedFields);
      
      // If onboarding is complete, go to dashboard
      if (onboarding.completed) {
        navigate('/advisor', { replace: true });
        return;
      }
      
      // Merge data: resolved facts → onboarding data → profile fields
      const merged = { ...onboarding.data };
      
      // Apply resolved facts (from Global Fact Authority)
      for (const [field, factData] of Object.entries(resolvedFields)) {
        if (factData.value && !merged[field]) {
          merged[field] = factData.value;
        }
      }
      
      // Fallback: pre-populate from business_profiles for any remaining fields
      const profileFields = [
        'business_name', 'industry', 'business_type', 'business_stage',
        'website', 'location', 'years_operating',
        'target_market', 'business_model', 'revenue_range',
        'products_services', 'unique_value_proposition', 'competitive_advantages',
        'pricing_model', 'team_size', 'hiring_status',
        'short_term_goals', 'long_term_goals',
        'main_challenges', 'growth_strategy',
        'abn', 'acn', 'company_abn', 'phone', 'email', // ← Identity fields from calibration
      ];
      
      for (const field of profileFields) {
        if (profile[field] && !merged[field]) {
          merged[field] = profile[field];
        }
      }
      
      if (onboarding.business_stage) {
        merged.business_stage = onboarding.business_stage;
      }
      
      setFormData(merged);
      
      // Resume from last step
      if (onboarding.current_step && onboarding.current_step > 0) {
        setCurrentStep(onboarding.current_step);
      }
    } catch (error) {
      console.warn('[Onboarding] Failed to load context:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateField = useCallback((field, value) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      // Debounced auto-save to onboarding state
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        persistProgress(updated, currentStep);
      }, 1500);
      return updated;
    });
    // Immediate upsert to business_profiles for card selections
    syncToBusinessProfile(field, value);
  }, [currentStep]);

  const toggleArrayItem = useCallback((field, item) => {
    setFormData(prev => {
      const current = prev[field] || [];
      const updated = current.includes(item)
        ? current.filter(i => i !== item)
        : [...current, item];
      const newData = { ...prev, [field]: updated };
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        persistProgress(newData, currentStep);
      }, 1500);
      return newData;
    });
  }, [currentStep]);

  const persistProgress = async (data, step) => {
    try {
      await apiClient.post('/onboarding/save', {
        current_step: step,
        business_stage: data.business_stage || null,
        data: data,
        completed: false
      });
    } catch (error) {
      console.error('Auto-save failed:', error);
    }
  };

  // Card Persistence: upsert selected fields directly to business_profiles
  const PROFILE_SYNC_FIELDS = [
    'business_name', 'industry', 'business_stage', 'location', 'website',
    'target_market', 'business_model', 'main_products_services', 'unique_value_proposition',
    'team_size', 'years_operating', 'short_term_goals', 'long_term_goals',
    'main_challenges', 'growth_strategy', 'growth_goals', 'risk_profile'
  ];

  const syncToBusinessProfile = async (field, value) => {
    if (!PROFILE_SYNC_FIELDS.includes(field) || !value) return;
    try {
      await apiClient.put('/business-profile', { [field]: value });
    } catch (err) {
      console.warn('[Onboarding] business_profiles sync failed:', err);
    }
  };

  const handleNext = async () => {
    // Save current step
    await persistProgress(formData, currentStep + 1);
    
    if (currentStep === STEPS.length - 1) {
      await completeOnboarding();
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const toggleSignal = (key) => {
    setSignalToggles(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const completeOnboarding = async () => {
    setSaving(true);
    try {
      await apiClient.put('/business-profile', { ...formData, signal_preferences: signalToggles });
      await apiClient.post('/onboarding/complete');
      markOnboardingComplete();
      trackActivationStep('onboarding_complete', { entrypoint: 'onboarding_wizard' });
      toast.success('Profile complete — running your Deep Scan now.');
      // Chain into ForensicCalibration so the Deep Scan
      // (POST /enrichment/website?action=scan) actually fires and populates
      // business_dna_enrichment. Without this, Market & Position / Benchmark
      // pages stay empty because the lightweight /website/enrich used earlier
      // in this wizard only extracts title/description — it does not produce
      // the full enrichment payload those pages depend on.
      navigate('/market/calibration', { replace: true, state: { fromOnboarding: true } });
    } catch (error) {
      toast.error('Failed to complete setup');
      console.error('Onboarding completion error:', error);
    } finally {
      setSaving(false);
    }
  };

  const enrichWebsite = async () => {
    const url = formData.website;
    if (!url) return;
    
    setEnriching(true);
    setEnrichPreview(null);
    try {
      const res = await apiClient.post('/website/enrich', { url });
      const data = res.data;
      if (data.title || data.description) {
        setEnrichPreview(data);
      } else {
        toast.info('Could not extract details from this website');
      }
    } catch {
      toast.error('Failed to fetch website details');
    } finally {
      setEnriching(false);
    }
  };

  const applyEnrichment = () => {
    if (!enrichPreview) return;
    const updates = {};
    if (enrichPreview.inferred_name && !formData.business_name) {
      updates.business_name = enrichPreview.inferred_name;
    }
    if (enrichPreview.description && !formData.mission_statement) {
      updates.mission_statement = enrichPreview.description;
    }
    setFormData(prev => ({ ...prev, ...updates }));
    setEnrichPreview(null);
    toast.success('Details applied from website');
  };

  const hasExistingValue = (field) => {
    // Check resolved facts first (Global Fact Authority), then existingProfile
    if (resolvedFieldsMap[field] && resolvedFieldsMap[field].value) return true;
    return existingProfile[field] && existingProfile[field] !== '';
  };

  const getFieldSource = (field) => {
    if (resolvedFieldsMap[field]) return resolvedFieldsMap[field].source;
    return null;
  };

  // Render a field with confirmation hint if value already exists
  const renderField = (field, label, component) => {
    const existing = hasExistingValue(field);
    const source = getFieldSource(field);
    const isConfirmed = resolvedFieldsMap[field]?.confirmed;
    return (
      <div key={field}>
        <Label className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.08em]" style={{ fontFamily: fontFamily.mono, color: 'var(--ink-muted, #708499)' }}>
          {label}
          {existing && isConfirmed && (
            <span className="text-[10px] px-1.5 py-0.5 rounded font-normal" style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981' }}>
              confirmed
            </span>
          )}
          {existing && !isConfirmed && (
            <span className="text-[10px] px-1.5 py-0.5 rounded font-normal" style={{ background: 'rgba(245,158,11,0.1)', color: '#F59E0B' }}>
              {source === 'profile' ? 'from profile' : 'detected'}
            </span>
          )}
        </Label>
        {component}
      </div>
    );
  };

  const completeness = Math.round(((currentStep) / (STEPS.length - 1)) * 100);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#FAFAFA' }}>
        <div className="text-center space-y-4">
          <CognitiveMesh compact />
          <p className="text-sm" style={{ color: 'var(--ink-muted, #737373)' }}>Loading your profile...</p>
        </div>
      </div>
    );
  }

  /* Map internal wizard steps to the 5-step sidebar:
     Sidebar 1 = Account created (always done)
     Sidebar 2 = What's your business? (steps 0-7: welcome through preferences)
     Sidebar 3 = Connect your tools (handled externally)
     Sidebar 4 = Tune your signals (step 8: signal tuning)
     Sidebar 5 = Your first brief (handled externally) */
  const sidebarActive = currentStep >= 8 ? 4 : 2;

  return (
    <div className="min-h-screen flex flex-col relative" style={{ background: '#FAFAFA' }} data-testid="onboarding-wizard">
      {/* Background glow */}
      <div className="fixed -top-[300px] -right-[200px] w-[700px] h-[700px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(232,93,0,0.15) 0%, transparent 60%)', opacity: 0.4, filter: 'blur(100px)' }} />

      <style>{`
        .wiz-shell { display: grid; grid-template-columns: 1fr; flex: 1; position: relative; z-index: 1; }
        .wiz-sidebar { display: none; }
        @media (min-width: 1100px) { .wiz-shell { grid-template-columns: 320px 1fr; } .wiz-sidebar { display: flex; } }
        .wiz-radio-card { transition: all 200ms cubic-bezier(0.4,0,0.2,1); cursor: pointer; }
        .wiz-radio-card:hover { border-color: #E85D00 !important; transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.3) !important; }
        .wiz-radio-grid { display: grid; gap: 12px; grid-template-columns: 1fr; }
        @media (min-width: 720px) { .wiz-radio-grid { grid-template-columns: 1fr 1fr; } }
      `}</style>
      <div className="wiz-shell">
        {/* ── Wizard Sidebar ── */}
        <aside className="wiz-sidebar flex-col justify-between relative overflow-hidden" style={{ background: 'var(--surface, #FFFFFF)', color: '#FFFFFF', padding: '40px 32px' }}>
          {/* Animated lava orb */}
          <div className="absolute -bottom-[100px] -left-[100px] w-[400px] h-[400px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, #E85D00 0%, transparent 60%)', opacity: 0.25, filter: 'blur(60px)', animation: 'wizOrbDrift 18s ease-in-out infinite' }} />
          <style>{`@keyframes wizOrbDrift { 0%, 100% { transform: translate(0,0); } 50% { transform: translate(40px, -30px); } }`}</style>

          <div className="relative z-[1]">
            {/* Brand */}
            <Link to="/" className="flex items-center gap-3" style={{ color: '#FFFFFF', textDecoration: 'none' }}>
              <span className="inline-block rounded-full" style={{ width: 10, height: 10, background: '#E85D00', boxShadow: '0 0 16px #E85D00' }} />
              <span className="text-[22px] font-semibold" style={{ fontFamily: fontFamily.display }}>BIQc</span>
            </Link>

            {/* Step indicators */}
            <div className="flex flex-col gap-4 mt-12">
              {SIDEBAR_STEPS.map((s) => {
                const isDone = s.num < sidebarActive;
                const isActive = s.num === sidebarActive;
                return (
                  <div key={s.num} className="flex items-start gap-4 p-3 rounded-lg transition-all" style={{ background: isActive ? 'rgba(232,93,0,0.12)' : 'transparent' }}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-[13px] font-semibold" style={{
                      fontFamily: fontFamily.mono,
                      background: isDone || isActive ? '#E85D00' : 'rgba(255,255,255,0.08)',
                      color: isDone || isActive ? 'white' : 'rgba(255,255,255,0.5)',
                      border: isDone || isActive ? 'none' : '1px solid rgba(255,255,255,0.1)',
                      boxShadow: isActive ? '0 0 20px rgba(232,93,0,0.5)' : 'none',
                    }}>
                      {isDone ? <Check className="w-3.5 h-3.5" /> : s.num}
                    </div>
                    <div className="flex-1 pt-1">
                      <div className="text-sm font-medium" style={{ color: isActive ? '#FF8C33' : '#FFFFFF' }}>{s.name}</div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--ink-muted, #737373)' }}>
                        {isDone && s.num === 1 ? (user?.email || 'Done') : s.hint}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="relative z-[1] text-[11px] uppercase tracking-[0.08em]" style={{ fontFamily: fontFamily.mono, color: 'var(--ink-muted, #737373)' }}>
            Skip any step. Resume anytime. Your account is already created.
          </div>
        </aside>

        {/* ── Main Content ── */}
        <main className="overflow-y-auto" style={{ padding: 'clamp(24px, 4vw, 48px) clamp(24px, 4vw, 40px)' }}>
          <div className="max-w-[720px] mx-auto">

            {/* STEP 0: Welcome */}
            {currentStep === 0 && (
              <div className="space-y-8" data-testid="onboarding-welcome">
                <div className="text-center space-y-3">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto" style={{ background: 'rgba(232,93,0,0.12)' }}>
                    <Zap className="w-8 h-8" style={{ color: '#E85D00' }} />
                  </div>
                  <h1 className="font-medium" style={{ fontFamily: fontFamily.display, color: 'var(--ink-display, #0A0A0A)', fontSize: 'clamp(2.4rem, 4vw, 3.4rem)', letterSpacing: '-0.02em', lineHeight: 1.05 }}>
                    Welcome to <em style={{ fontStyle: 'italic', color: '#E85D00' }}>BIQc</em>
                  </h1>
                  <p className="max-w-md mx-auto" style={{ color: 'var(--ink-secondary, #8FA0B8)', fontFamily: fontFamily.body, fontSize: '18px', lineHeight: 1.5 }}>
                    Your continuous business intelligence and situational awareness system.
                  </p>
                </div>

                <div className="space-y-4 max-w-lg mx-auto">
                  {[
                    { icon: Target, title: 'BIQc Insights', desc: 'Real-time intelligence on your business health across finance, operations, and growth.' },
                    { icon: Building2, title: 'Business DNA', desc: 'Your core identity, team, market, and strategy — the foundation BIQc uses to understand you.' },
                    { icon: TrendingUp, title: 'Goals & Objectives', desc: 'Your priorities drive what BIQc monitors and what it escalates.' },
                    { icon: Brain, title: 'How BIQc works', desc: 'BIQc observes signals, forms positions, and only speaks when findings cross your thresholds.' },
                  ].map(item => (
                    <div key={item.title} className="flex items-start gap-4 p-4 rounded-xl" style={{ background: 'var(--surface, #0E1628)', border: '1px solid rgba(140,170,210,0.15)' }}>
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(232,93,0,0.12)' }}>
                        <item.icon className="w-5 h-5" style={{ color: '#E85D00' }} />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold" style={{ color: 'var(--ink-display, #0A0A0A)' }}>{item.title}</h3>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--ink-muted, #708499)' }}>{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <p className="text-xs text-center" style={{ color: 'var(--ink-muted, #708499)', fontFamily: fontFamily.mono }}>
                  Takes about 5 minutes. Your progress is saved automatically.
                </p>
              </div>
            )}

            {/* STEP 1: Business Identity */}
            {currentStep === 1 && (
              <div className="space-y-6" data-testid="step-basics">
                <WizStepHeader step={2} total={STEPS.length} title={<>What kind of <em style={{ fontStyle: 'italic', color: '#E85D00' }}>business</em> are you?</>} subtitle="This shapes which signals BIQc surfaces and which thresholds we use. You can fine-tune later." />

                {/* Business type radio cards from mockup */}
                <div style={{ marginTop: 40 }}>
                  <h3 style={{ fontFamily: fontFamily.display, fontSize: 22, color: 'var(--ink-display, #0A0A0A)', marginBottom: 16 }}>Pick what fits closest</h3>
                  <div className="wiz-radio-grid">
                    {[
                      { value: 'services', title: 'Services / consulting', desc: 'Project-based revenue, billable hours, retainers, proposals in flight.', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M2 3h20M5 3v18h14V3M9 8h6M9 12h6M9 16h6"/></svg> },
                      { value: 'saas', title: 'SaaS / software', desc: 'MRR, trials, churn, expansion. Product-led or sales-led growth.', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg> },
                      { value: 'ecommerce', title: 'E-commerce / DTC', desc: 'Orders, AOV, inventory, marketing spend, ad performance.', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/></svg> },
                      { value: 'agency', title: 'Agency / studio', desc: 'Client retainers, project profitability, team utilisation, scope creep.', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg> },
                      { value: 'trades', title: 'Trades / field services', desc: 'Job pipeline, quotes, scheduling, invoicing, AR aging.', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
                      { value: 'other', title: 'Something else', desc: 'Tell us in one line and BIQc will pick smart defaults.', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="10"/><path d="M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20M2 12h20"/></svg> },
                    ].map(opt => {
                      const isSelected = formData.business_type === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          className="wiz-radio-card"
                          onClick={() => updateField('business_type', opt.value)}
                          style={{
                            padding: 20,
                            background: isSelected ? 'rgba(232,93,0,0.06)' : 'var(--surface, #0E1628)',
                            border: isSelected ? '1px solid #E85D00' : '1px solid rgba(140,170,210,0.12)',
                            borderRadius: 12,
                            textAlign: 'left',
                            boxShadow: isSelected ? '0 8px 24px rgba(0,0,0,0.3)' : 'none',
                            position: 'relative',
                          }}
                          data-testid={`radio-type-${opt.value}`}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                            <div style={{
                              width: 36, height: 36, borderRadius: 8,
                              display: 'grid', placeItems: 'center',
                              background: isSelected ? '#E85D00' : 'var(--surface-2, #F1F5F9)',
                              color: isSelected ? 'white' : 'var(--ink-display, #0A0A0A)',
                            }}>
                              {opt.icon}
                            </div>
                            <div style={{
                              width: 22, height: 22, borderRadius: '50%',
                              background: isSelected ? '#E85D00' : 'transparent',
                              border: isSelected ? '2px solid #E85D00' : '2px solid rgba(140,170,210,0.12)',
                              display: 'grid', placeItems: 'center',
                              fontSize: 13, fontWeight: 700, color: 'white',
                            }}>
                              {isSelected && <Check style={{ width: 12, height: 12 }} />}
                            </div>
                          </div>
                          <h4 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink-display, #0A0A0A)', fontFamily: fontFamily.body }}>{opt.title}</h4>
                          <p style={{ marginTop: 8, color: 'var(--ink-secondary, #8FA0B8)', fontSize: 13, lineHeight: 1.5, fontFamily: fontFamily.body }}>{opt.desc}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {renderField('business_name', 'Business Name',
                  <Input
                    value={formData.business_name || ''}
                    onChange={(e) => updateField('business_name', e.target.value)}
                    placeholder="Your company name"
                    className="mt-2 bg-[var(--surface)] border-[rgba(140,170,210,0.15)] text-[var(--ink-display)] placeholder:text-[var(--ink-muted)]"
                    data-testid="input-business-name"
                  />
                )}

                {renderField('industry', 'Industry',
                  <Select value={formData.industry || ''} onValueChange={(val) => updateField('industry', val)}>
                    <SelectTrigger className="mt-2 bg-[var(--surface)] border-[rgba(140,170,210,0.15)] text-[var(--ink-display)]" data-testid="select-industry">
                      <SelectValue placeholder="Select industry" />
                    </SelectTrigger>
                    <SelectContent>
                      {['Technology', 'Professional Services', 'Retail & E-commerce', 'Food & Hospitality', 'Healthcare', 'Manufacturing', 'Construction', 'Finance', 'Education', 'Other'].map(i => (
                        <SelectItem key={i} value={i}>{i}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <div className="grid grid-cols-2 gap-4">
                  {renderField('business_stage', 'Business Stage',
                    <Select value={formData.business_stage || ''} onValueChange={(val) => updateField('business_stage', val)}>
                      <SelectTrigger className="mt-2 bg-[var(--surface)] border-[rgba(140,170,210,0.15)] text-[var(--ink-display)]" data-testid="select-stage">
                        <SelectValue placeholder="Select stage" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="idea">Business Idea</SelectItem>
                        <SelectItem value="startup">Startup</SelectItem>
                        <SelectItem value="established">Established</SelectItem>
                      </SelectContent>
                    </Select>
                  )}

                  {renderField('location', 'Location',
                    <Input
                      value={formData.location || ''}
                      onChange={(e) => updateField('location', e.target.value)}
                      placeholder="City, Country"
                      className="mt-2 bg-[var(--surface)] border-[rgba(140,170,210,0.15)] text-[var(--ink-display)] placeholder:text-[var(--ink-muted)]"
                      data-testid="input-location"
                    />
                  )}
                </div>
              </div>
            )}

            {/* STEP 2: Website */}
            {currentStep === 2 && (
              <div className="space-y-6" data-testid="step-website">
                <WizStepHeader step={3} total={STEPS.length} title={<>Your <em style={{ fontStyle: 'italic', color: '#E85D00' }}>website</em></>} subtitle="We can auto-detect details from your website." />
                
                <div>
                  <Label className="text-[10px] font-medium uppercase tracking-[0.08em]" style={{ fontFamily: fontFamily.mono, color: 'var(--ink-muted, #708499)' }}>Website URL</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      value={formData.website || ''}
                      onChange={(e) => updateField('website', e.target.value)}
                      placeholder="www.yourcompany.com"
                      className="flex-1 bg-[var(--surface)] border-[rgba(140,170,210,0.15)] text-[var(--ink-display)] placeholder:text-[var(--ink-muted)]"
                      data-testid="input-website"
                    />
                    <Button
                      onClick={enrichWebsite}
                      disabled={!formData.website || enriching}
                      variant="outline"
                      className="text-[var(--ink-secondary)]"
                      style={{ border: '1px solid rgba(140,170,210,0.15)' }}
                      data-testid="btn-enrich"
                    >
                      {enriching ? <CognitiveMesh compact /> : <ExternalLink className="w-4 h-4" />}
                      Detect
                    </Button>
                  </div>
                </div>

                {enrichPreview && (
                  <div className="p-4 rounded-xl space-y-3" style={{ background: 'rgba(232,93,0,0.08)', border: '1px solid rgba(232,93,0,0.2)' }} data-testid="enrich-preview">
                    <p className="text-sm font-medium" style={{ color: '#E85D00' }}>Detected from your website:</p>
                    {enrichPreview.title && (
                      <div className="text-sm" style={{ color: 'var(--ink-secondary, #8FA0B8)' }}>
                        <span className="text-xs" style={{ color: 'var(--ink-muted, #708499)' }}>Title: </span>{enrichPreview.title}
                      </div>
                    )}
                    {enrichPreview.description && (
                      <div className="text-sm" style={{ color: 'var(--ink-secondary, #8FA0B8)' }}>
                        <span className="text-xs" style={{ color: 'var(--ink-muted, #708499)' }}>Description: </span>{enrichPreview.description}
                      </div>
                    )}
                    {enrichPreview.inferred_name && (
                      <div className="text-sm" style={{ color: 'var(--ink-secondary, #8FA0B8)' }}>
                        <span className="text-xs" style={{ color: 'var(--ink-muted, #708499)' }}>Business name: </span>{enrichPreview.inferred_name}
                      </div>
                    )}
                    <Button
                      onClick={applyEnrichment}
                      size="sm"
                      className="text-white"
                      style={{ background: '#E85D00' }}
                      data-testid="btn-apply-enrichment"
                    >
                      <CheckCircle className="w-3 h-3 mr-1" /> Apply these details
                    </Button>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  {renderField('abn', 'ABN (optional)',
                    <Input
                      value={formData.abn || ''}
                      onChange={(e) => updateField('abn', e.target.value)}
                      placeholder="12 345 678 901"
                      className="mt-2 bg-[var(--surface)] border-[rgba(140,170,210,0.15)] text-[var(--ink-display)] placeholder:text-[var(--ink-muted)]"
                      data-testid="input-abn"
                    />
                  )}

                  {renderField('years_operating', 'Years Operating',
                    <Select value={formData.years_operating || ''} onValueChange={(val) => updateField('years_operating', val)}>
                      <SelectTrigger className="mt-2 bg-[var(--surface)] border-[rgba(140,170,210,0.15)] text-[var(--ink-display)]" data-testid="select-years">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="< 1 year">Less than 1 year</SelectItem>
                        <SelectItem value="1-2 years">1-2 years</SelectItem>
                        <SelectItem value="2-5 years">2-5 years</SelectItem>
                        <SelectItem value="5-10 years">5-10 years</SelectItem>
                        <SelectItem value="10+ years">10+ years</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            )}

            {/* STEP 3: Market & Customers */}
            {currentStep === 3 && (
              <div className="space-y-6" data-testid="step-market">
                <WizStepHeader step={4} total={STEPS.length} title={<>Market & <em style={{ fontStyle: 'italic', color: '#E85D00' }}>customers</em></>} subtitle="Understanding your market helps BIQc prioritize signals." />
                
                {renderField('target_market', 'Target Market',
                  <Textarea
                    value={formData.target_market || ''}
                    onChange={(e) => updateField('target_market', e.target.value)}
                    placeholder="Describe your target market..."
                    rows={3}
                    className="mt-2 bg-[var(--surface)] border-[rgba(140,170,210,0.15)] text-[var(--ink-display)] placeholder:text-[var(--ink-muted)]"
                    data-testid="input-target-market"
                  />
                )}

                <div className="grid grid-cols-2 gap-4">
                  {renderField('business_model', 'Business Model',
                    <Select value={formData.business_model || ''} onValueChange={(val) => updateField('business_model', val)}>
                      <SelectTrigger className="mt-2 bg-[var(--surface)] border-[rgba(140,170,210,0.15)] text-[var(--ink-display)]" data-testid="select-model">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {['B2B', 'B2C', 'B2B2C', 'Marketplace', 'SaaS', 'Subscription', 'Hybrid'].map(m => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {renderField('revenue_range', 'Revenue Range',
                    <Select value={formData.revenue_range || ''} onValueChange={(val) => updateField('revenue_range', val)}>
                      <SelectTrigger className="mt-2 bg-[var(--surface)] border-[rgba(140,170,210,0.15)] text-[var(--ink-display)]" data-testid="select-revenue">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Pre-revenue">Pre-revenue</SelectItem>
                        <SelectItem value="< $100K">Less than $100K</SelectItem>
                        <SelectItem value="$100K - $500K">$100K - $500K</SelectItem>
                        <SelectItem value="$500K - $1M">$500K - $1M</SelectItem>
                        <SelectItem value="$1M - $5M">$1M - $5M</SelectItem>
                        <SelectItem value="$5M+">$5M+</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {renderField('customer_count', 'Customer Count',
                  <Select value={formData.customer_count || ''} onValueChange={(val) => updateField('customer_count', val)}>
                    <SelectTrigger className="mt-2 bg-[var(--surface)] border-[rgba(140,170,210,0.15)] text-[var(--ink-display)]" data-testid="select-customers">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="None yet">None yet</SelectItem>
                      <SelectItem value="< 10">Less than 10</SelectItem>
                      <SelectItem value="10-50">10-50</SelectItem>
                      <SelectItem value="50-100">50-100</SelectItem>
                      <SelectItem value="100-500">100-500</SelectItem>
                      <SelectItem value="500+">500+</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {/* STEP 4: Products & Services */}
            {currentStep === 4 && (
              <div className="space-y-6" data-testid="step-product">
                <WizStepHeader step={5} total={STEPS.length} title={<>Products & <em style={{ fontStyle: 'italic', color: '#E85D00' }}>services</em></>} subtitle="What you offer and why customers choose you." />
                
                {renderField('products_services', 'Main Products/Services',
                  <Textarea
                    value={formData.products_services || ''}
                    onChange={(e) => updateField('products_services', e.target.value)}
                    placeholder="Describe your main offerings..."
                    rows={3}
                    className="mt-2 bg-[var(--surface)] border-[rgba(140,170,210,0.15)] text-[var(--ink-display)] placeholder:text-[var(--ink-muted)]"
                    data-testid="input-products"
                  />
                )}

                {renderField('unique_value_proposition', 'What makes you different?',
                  <Textarea
                    value={formData.unique_value_proposition || ''}
                    onChange={(e) => updateField('unique_value_proposition', e.target.value)}
                    placeholder="Your unique value proposition..."
                    rows={3}
                    className="mt-2 bg-[var(--surface)] border-[rgba(140,170,210,0.15)] text-[var(--ink-display)] placeholder:text-[var(--ink-muted)]"
                    data-testid="input-uvp"
                  />
                )}

                {renderField('pricing_model', 'Pricing Model',
                  <Select value={formData.pricing_model || ''} onValueChange={(val) => updateField('pricing_model', val)}>
                    <SelectTrigger className="mt-2 bg-[var(--surface)] border-[rgba(140,170,210,0.15)] text-[var(--ink-display)]" data-testid="select-pricing">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {['Hourly', 'Project-based', 'Retainer', 'Subscription', 'One-time purchase', 'Usage-based', 'Tiered'].map(m => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {/* STEP 5: Team */}
            {currentStep === 5 && (
              <div className="space-y-6" data-testid="step-team">
                <WizStepHeader step={6} total={STEPS.length} title={<>Your <em style={{ fontStyle: 'italic', color: '#E85D00' }}>team</em></>} subtitle="Your people and organizational shape." />

                {renderField('team_size', 'Team Size',
                  <Select value={formData.team_size || ''} onValueChange={(val) => updateField('team_size', val)}>
                    <SelectTrigger className="mt-2 bg-[var(--surface)] border-[rgba(140,170,210,0.15)] text-[var(--ink-display)]" data-testid="select-team-size">
                      <SelectValue placeholder="Select size" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Just me">Just me (solo)</SelectItem>
                      <SelectItem value="2-5">2-5 people</SelectItem>
                      <SelectItem value="6-10">6-10 people</SelectItem>
                      <SelectItem value="11-25">11-25 people</SelectItem>
                      <SelectItem value="26-50">26-50 people</SelectItem>
                      <SelectItem value="51+">51+ people</SelectItem>
                    </SelectContent>
                  </Select>
                )}

                {renderField('hiring_status', 'Hiring Status',
                  <RadioGroup
                    value={formData.hiring_status || ''}
                    onValueChange={(val) => updateField('hiring_status', val)}
                    className="mt-2 space-y-2"
                  >
                    {[
                      { value: 'actively', label: 'Actively hiring' },
                      { value: 'planning', label: 'Planning to hire' },
                      { value: 'not-now', label: 'Not at this time' },
                    ].map(opt => (
                      <div key={opt.value} className="flex items-center gap-2 p-3 rounded-lg bg-[var(--surface)] border border-[rgba(140,170,210,0.15)]">
                        <RadioGroupItem value={opt.value} id={`hire-${opt.value}`} />
                        <Label htmlFor={`hire-${opt.value}`} className="text-[var(--ink-secondary)] cursor-pointer">{opt.label}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                )}
              </div>
            )}

            {/* STEP 6: Goals & Strategy */}
            {currentStep === 6 && (
              <div className="space-y-6" data-testid="step-goals">
                <WizStepHeader step={7} total={STEPS.length} title={<>Goals & <em style={{ fontStyle: 'italic', color: '#E85D00' }}>strategy</em></>} subtitle="Your priorities drive what BIQc monitors." />

                {renderField('short_term_goals', 'Short-term Goals (6-12 months)',
                  <Textarea
                    value={formData.short_term_goals || ''}
                    onChange={(e) => updateField('short_term_goals', e.target.value)}
                    placeholder="What do you want to achieve in the next year?"
                    rows={3}
                    className="mt-2 bg-[var(--surface)] border-[rgba(140,170,210,0.15)] text-[var(--ink-display)] placeholder:text-[var(--ink-muted)]"
                    data-testid="input-short-goals"
                  />
                )}

                {renderField('main_challenges', 'Biggest Challenges',
                  <Textarea
                    value={formData.main_challenges || ''}
                    onChange={(e) => updateField('main_challenges', e.target.value)}
                    placeholder="What obstacles are you facing right now?"
                    rows={3}
                    className="mt-2 bg-[var(--surface)] border-[rgba(140,170,210,0.15)] text-[var(--ink-display)] placeholder:text-[var(--ink-muted)]"
                    data-testid="input-challenges"
                  />
                )}

                {renderField('growth_strategy', 'Growth Strategy',
                  <Textarea
                    value={formData.growth_strategy || ''}
                    onChange={(e) => updateField('growth_strategy', e.target.value)}
                    placeholder="How do you plan to grow?"
                    rows={3}
                    className="mt-2 bg-[var(--surface)] border-[rgba(140,170,210,0.15)] text-[var(--ink-display)] placeholder:text-[var(--ink-muted)]"
                    data-testid="input-growth"
                  />
                )}

                {renderField('growth_goals', 'Growth Goals',
                  <Select value={formData.growth_goals || ''} onValueChange={(val) => updateField('growth_goals', val)}>
                    <SelectTrigger className="mt-2 bg-[var(--surface)] border-[rgba(140,170,210,0.15)] text-[var(--ink-display)]" data-testid="select-growth-goals">
                      <SelectValue placeholder="Select primary growth goal" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="revenue_growth">Revenue Growth</SelectItem>
                      <SelectItem value="market_expansion">Market Expansion</SelectItem>
                      <SelectItem value="product_diversification">Product Diversification</SelectItem>
                      <SelectItem value="operational_efficiency">Operational Efficiency</SelectItem>
                      <SelectItem value="team_scaling">Team Scaling</SelectItem>
                      <SelectItem value="profitability">Profitability Focus</SelectItem>
                      <SelectItem value="customer_retention">Customer Retention</SelectItem>
                      <SelectItem value="brand_building">Brand Building</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {/* STEP 7: BIQC Preferences */}
            {currentStep === 7 && (
              <div className="space-y-6" data-testid="step-preferences">
                <WizStepHeader step={8} total={STEPS.length} title={<>BIQc <em style={{ fontStyle: 'italic', color: '#E85D00' }}>preferences</em></>} subtitle="How should BIQc communicate with you?" />

                <div>
                  <Label className="text-[10px] font-medium uppercase tracking-[0.08em]" style={{ fontFamily: fontFamily.mono, color: 'var(--ink-muted, #708499)' }}>Communication Style</Label>
                  <RadioGroup
                    value={formData.advice_style || ''}
                    onValueChange={(val) => updateField('advice_style', val)}
                    className="mt-3 space-y-2"
                  >
                    {[
                      { value: 'concise', label: 'Quick & Concise', desc: 'Actionable bullet points' },
                      { value: 'detailed', label: 'Detailed & Thorough', desc: 'Explain the reasoning and context' },
                      { value: 'conversational', label: 'Conversational', desc: 'Like chatting with a business partner' },
                    ].map(opt => (
                      <div key={opt.value} className="flex items-start gap-3 p-4 rounded-lg bg-[var(--surface)] border border-[rgba(140,170,210,0.15)] cursor-pointer hover:bg-[var(--surface-2)]">
                        <RadioGroupItem value={opt.value} id={`style-${opt.value}`} className="mt-0.5" />
                        <Label htmlFor={`style-${opt.value}`} className="cursor-pointer">
                          <div className="text-sm font-medium" style={{ color: 'var(--ink-display, #0A0A0A)' }}>{opt.label}</div>
                          <div className="text-xs" style={{ color: 'var(--ink-muted, #708499)' }}>{opt.desc}</div>
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                <div>
                  <Label className="text-[10px] font-medium uppercase tracking-[0.08em]" style={{ fontFamily: fontFamily.mono, color: 'var(--ink-muted, #708499)' }}>What tools do you use?</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {['Xero / QuickBooks', 'HubSpot / CRM', 'Slack / Teams', 'Google Workspace', 'Notion / Asana', 'Stripe', 'None yet', 'Other'].map(tool => (
                      <label key={tool} className="flex items-center gap-2 p-3 rounded-lg bg-[var(--surface)] border border-[rgba(140,170,210,0.15)] cursor-pointer hover:bg-[var(--surface-2)] text-[var(--ink-secondary)] text-sm">
                        <input
                          type="checkbox"
                          checked={(formData.current_tools || []).includes(tool)}
                          onChange={() => toggleArrayItem('current_tools', tool)}
                          className="rounded"
                        />
                        {tool}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* STEP 8: Tune Signals — matches calibration.html mockup */}
            {currentStep === 8 && (
              <div className="space-y-6" data-testid="step-signals">
                <WizStepHeader step={9} total={STEPS.length} title={<>Which signals matter <em style={{ fontStyle: 'italic', color: '#E85D00' }}>most to you</em>?</>} subtitle="BIQc starts with default signals tuned for your business type. Toggle anything you don't care about — you can adjust thresholds later." />

                <div className="flex flex-col gap-3">
                  {[
                    { key: 'deal_stalled', title: 'Deal stalled in pipeline', hint: 'Active opportunity with no inbox activity for N days', threshold: 'Default threshold \u00b7 14 days' },
                    { key: 'cash_runway', title: 'Cash runway alert', hint: 'Burn rate \u00f7 cash on hand drops below threshold', threshold: 'Default threshold \u00b7 6 months' },
                    { key: 'churn_risk', title: 'Customer churn risk', hint: 'Engagement drop or sentiment shift in inbound emails', threshold: 'Default threshold \u00b7 21 days silence' },
                    { key: 'invoice_aging', title: 'Invoice aging spike', hint: 'AR over 60 days as % of total trending up', threshold: 'Default threshold \u00b7 15% of AR' },
                    { key: 'meeting_overload', title: 'Meeting overload', hint: 'Calendar density above your historical baseline', threshold: 'Default threshold \u00b7 60% above 4-week avg' },
                    { key: 'competitor_mentions', title: 'Competitor mentions', hint: 'Inbound emails referencing named competitors', threshold: 'Default threshold \u00b7 3 mentions / 7 days' },
                    { key: 'press_mentions', title: 'Press / media mentions', hint: 'Your business name surfacing in news, blogs, social', threshold: 'Default threshold \u00b7 Any mention' },
                  ].map(signal => (
                    <div key={signal.key} className="flex items-center justify-between gap-4 p-5 rounded-xl transition-all" style={{ background: 'var(--surface, #0E1628)', border: `1px solid ${signalToggles[signal.key] ? 'rgba(232,93,0,0.3)' : 'rgba(140,170,210,0.15)'}` }}>
                      <div className="flex-1 min-w-0">
                        <div className="text-[15px] font-semibold" style={{ color: 'var(--ink-display, #0A0A0A)' }}>{signal.title}</div>
                        <div className="text-[13px] mt-0.5" style={{ color: 'var(--ink-secondary, #8FA0B8)' }}>{signal.hint}</div>
                        <div className="text-[11px] mt-2 uppercase tracking-[0.08em]" style={{ fontFamily: fontFamily.mono, color: '#E85D00' }}>{signal.threshold}</div>
                      </div>
                      <button
                        onClick={() => toggleSignal(signal.key)}
                        className="relative shrink-0 rounded-full transition-all duration-200"
                        style={{
                          width: 44, height: 26,
                          background: signalToggles[signal.key] ? '#E85D00' : 'rgba(140,170,210,0.3)',
                          cursor: 'pointer', border: 'none',
                        }}
                        aria-label={`${signal.title} signal ${signalToggles[signal.key] ? 'enabled' : 'disabled'}`}
                        data-testid={`toggle-${signal.key}`}
                      >
                        <span className="absolute top-[3px] rounded-full transition-all duration-200" style={{
                          width: 20, height: 20,
                          background: 'white',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                          left: signalToggles[signal.key] ? 21 : 3,
                        }} />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-4">
                  <span className="text-xs" style={{ color: 'var(--ink-muted, #708499)', fontFamily: fontFamily.mono }}>
                    {Object.values(signalToggles).filter(Boolean).length} of 7 signals active
                  </span>
                  <button
                    onClick={() => setSignalToggles({ deal_stalled: true, cash_runway: true, churn_risk: true, invoice_aging: true, meeting_overload: false, competitor_mentions: true, press_mentions: false })}
                    className="text-xs transition-colors"
                    style={{ color: '#E85D00', background: 'none', border: 'none', cursor: 'pointer', fontFamily: fontFamily.body }}
                  >
                    Use defaults
                  </button>
                </div>
              </div>
            )}

            {/* Progress bar */}
            <div className="mt-6 h-1 rounded-full overflow-hidden" style={{ background: 'var(--surface-2, #F1F5F9)' }}>
              <div className="h-full rounded-full transition-all duration-500" style={{ background: 'linear-gradient(90deg, #E85D00, #FF8C33)', width: `${completeness}%` }} />
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between pt-6 mt-6" style={{ borderTop: '1px solid rgba(140,170,210,0.15)' }}>
              {currentStep > 0 ? (
                <button
                  onClick={handleBack}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-all hover:bg-black/5"
                  style={{ color: 'var(--ink-secondary, #8FA0B8)', fontFamily: fontFamily.body, background: 'transparent', border: '1px solid rgba(140,170,210,0.15)', cursor: 'pointer' }}
                  data-testid="btn-back"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
              ) : <div />}

              <div className="flex items-center gap-3">
                {currentStep > 0 && (
                  <button
                    onClick={() => {
                      persistProgress(formData, currentStep);
                      deferOnboarding();
                      toast.success('Progress saved. You can continue anytime.');
                      navigate('/advisor');
                    }}
                    className="text-sm transition-colors"
                    style={{ color: 'var(--ink-muted, #708499)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: fontFamily.body }}
                    data-testid="btn-save-later"
                  >
                    Skip for now
                  </button>
                )}
                <button
                  onClick={handleNext}
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-[15px] font-semibold transition-all disabled:opacity-50"
                  style={{ background: '#E85D00', color: 'white', fontFamily: fontFamily.body, border: 'none', cursor: 'pointer' }}
                  data-testid="btn-next"
                >
                  {saving ? (
                    <><CognitiveMesh compact /> Completing...</>
                  ) : currentStep === STEPS.length - 1 ? (
                    <><CheckCircle className="w-4 h-4" /> Complete Setup</>
                  ) : currentStep === 0 ? (
                    <>Get Started <ArrowRight className="w-4 h-4" /></>
                  ) : (
                    <>Continue <ArrowRight className="w-4 h-4" /></>
                  )}
                </button>
              </div>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
};

const WizStepHeader = ({ step, total, title, subtitle }) => (
  <div className="pb-2">
    <div className="text-[11px] uppercase tracking-[0.08em] mb-3" style={{ fontFamily: fontFamily.mono, color: '#E85D00' }}>
      — Step {step} of {total}
    </div>
    <h1 className="font-medium mb-3" style={{ fontFamily: fontFamily.display, color: 'var(--ink-display, #0A0A0A)', fontSize: 'clamp(2.4rem, 4vw, 3.4rem)', letterSpacing: '-0.02em', lineHeight: 1.05 }}>
      {title}
    </h1>
    {subtitle && (
      <p className="text-lg leading-relaxed max-w-[580px]" style={{ fontFamily: fontFamily.body, color: 'var(--ink-secondary, #8FA0B8)' }}>
        {subtitle}
      </p>
    )}
  </div>
);

export default OnboardingWizard;
