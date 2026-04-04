import { CognitiveMesh } from '../components/LoadingSystems';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Progress } from '../components/ui/progress';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';
import { 
  Rocket, Building2, Lightbulb, ArrowRight, ArrowLeft, 
  CheckCircle, Loader2, Target, Users, TrendingUp,
  DollarSign, Zap, Brain, Globe, ExternalLink, Package
} from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '../lib/api';
import { trackActivationStep } from '../lib/analytics';

const STEPS = [
  { id: 'welcome', label: 'Welcome', icon: Zap },
  { id: 'basics', label: 'Business Identity', icon: Building2 },
  { id: 'website', label: 'Website', icon: Globe },
  { id: 'market', label: 'Market & Customers', icon: Target },
  { id: 'product', label: 'Products & Services', icon: Package },
  { id: 'team', label: 'Team', icon: Users },
  { id: 'goals', label: 'Goals & Strategy', icon: TrendingUp },
  { id: 'preferences', label: 'BIQC Preferences', icon: Brain },
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

  const completeOnboarding = async () => {
    setSaving(true);
    try {
      await apiClient.put('/business-profile', formData);
      await apiClient.post('/onboarding/complete');
      markOnboardingComplete();
      trackActivationStep('onboarding_complete', { entrypoint: 'onboarding_wizard' });
      toast.success('Profile completed! Start your first Ask BIQc briefing.');
      navigate('/soundboard', { replace: true, state: { fromOnboarding: true, firstValuePath: true } });
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
        <Label className="flex items-center gap-2">
          {label}
          {existing && isConfirmed && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-normal">
              confirmed
            </span>
          )}
          {existing && !isConfirmed && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 font-normal">
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
      <div className="min-h-screen flex items-center justify-center bg-[#080c14]">
        <div className="text-center space-y-4">
          <CognitiveMesh compact />
          <p className="text-sm text-white/40">Loading your profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-[#080c14] via-[#0f172a] to-[#162032]" data-testid="onboarding-wizard">
      {/* Header */}
      <header className="border-b border-white/10 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-white text-sm">BIQC Setup</h3>
            <p className="text-xs text-white/40">{STEPS[currentStep]?.label}</p>
          </div>
        </div>
        {currentStep > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-white/40 font-mono">
              {currentStep}/{STEPS.length - 1}
            </span>
            <div className="w-24 h-1.5 rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-blue-500 transition-all duration-300"
                style={{ width: `${completeness}%` }}
              />
            </div>
          </div>
        )}
      </header>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-6">
        <Card className="w-full max-w-2xl bg-[#0f1629]/80 border-white/10 backdrop-blur-sm" data-testid="onboarding-card">
          <CardContent className="p-8">
            {/* STEP 0: Welcome */}
            {currentStep === 0 && (
              <div className="space-y-8" data-testid="onboarding-welcome">
                <div className="text-center space-y-3">
                  <div className="w-16 h-16 rounded-2xl bg-blue-600/20 flex items-center justify-center mx-auto">
                    <Zap className="w-8 h-8 text-blue-400" />
                  </div>
                  <h1 className="text-3xl font-bold text-white">Welcome to BIQC</h1>
                  <p className="text-white/60 max-w-md mx-auto">
                    Your continuous business intelligence and situational awareness system.
                  </p>
                </div>

                <div className="space-y-4 max-w-lg mx-auto">
                  {[
                    { icon: Target, title: 'BIQC Insights', desc: 'Real-time intelligence on your business health across finance, operations, and growth.' },
                    { icon: Building2, title: 'Business DNA', desc: 'Your core identity, team, market, and strategy — the foundation BIQC uses to understand you.' },
                    { icon: TrendingUp, title: 'Goals & Objectives', desc: 'Your priorities drive what BIQC monitors and what it escalates.' },
                    { icon: Brain, title: 'How BIQC works', desc: 'BIQC observes signals, forms positions, and only speaks when findings cross your thresholds.' },
                  ].map(item => (
                    <div key={item.title} className="flex items-start gap-4 p-4 rounded-xl bg-white/5 border border-white/5">
                      <div className="w-10 h-10 rounded-lg bg-blue-600/10 flex items-center justify-center flex-shrink-0">
                        <item.icon className="w-5 h-5 text-blue-400" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-white">{item.title}</h3>
                        <p className="text-xs text-white/50 mt-0.5">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <p className="text-xs text-white/30 text-center">
                  Takes about 5 minutes. Your progress is saved automatically.
                </p>
              </div>
            )}

            {/* STEP 1: Business Identity */}
            {currentStep === 1 && (
              <div className="space-y-6" data-testid="step-basics">
                <StepHeader icon={Building2} title="Business Identity" subtitle="Let's start with who you are." />
                
                {renderField('business_name', 'Business Name',
                  <Input
                    value={formData.business_name || ''}
                    onChange={(e) => updateField('business_name', e.target.value)}
                    placeholder="Your company name"
                    className="mt-2 bg-white/5 border-white/10 text-white placeholder:text-white/30"
                    data-testid="input-business-name"
                  />
                )}

                {renderField('industry', 'Industry',
                  <Select value={formData.industry || ''} onValueChange={(val) => updateField('industry', val)}>
                    <SelectTrigger className="mt-2 bg-white/5 border-white/10 text-white" data-testid="select-industry">
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
                      <SelectTrigger className="mt-2 bg-white/5 border-white/10 text-white" data-testid="select-stage">
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
                      className="mt-2 bg-white/5 border-white/10 text-white placeholder:text-white/30"
                      data-testid="input-location"
                    />
                  )}
                </div>
              </div>
            )}

            {/* STEP 2: Website */}
            {currentStep === 2 && (
              <div className="space-y-6" data-testid="step-website">
                <StepHeader icon={Globe} title="Website" subtitle="We can auto-detect details from your website." />
                
                <div>
                  <Label className="text-white/70">Website URL</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      value={formData.website || ''}
                      onChange={(e) => updateField('website', e.target.value)}
                      placeholder="www.yourcompany.com"
                      className="flex-1 bg-white/5 border-white/10 text-white placeholder:text-white/30"
                      data-testid="input-website"
                    />
                    <Button
                      onClick={enrichWebsite}
                      disabled={!formData.website || enriching}
                      variant="outline"
                      className="border-white/10 text-white/70 hover:bg-white/5"
                      data-testid="btn-enrich"
                    >
                      {enriching ? <CognitiveMesh compact /> : <ExternalLink className="w-4 h-4" />}
                      Detect
                    </Button>
                  </div>
                </div>

                {enrichPreview && (
                  <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 space-y-3" data-testid="enrich-preview">
                    <p className="text-sm font-medium text-blue-400">Detected from your website:</p>
                    {enrichPreview.title && (
                      <div className="text-sm text-white/70">
                        <span className="text-white/40 text-xs">Title: </span>{enrichPreview.title}
                      </div>
                    )}
                    {enrichPreview.description && (
                      <div className="text-sm text-white/70">
                        <span className="text-white/40 text-xs">Description: </span>{enrichPreview.description}
                      </div>
                    )}
                    {enrichPreview.inferred_name && (
                      <div className="text-sm text-white/70">
                        <span className="text-white/40 text-xs">Business name: </span>{enrichPreview.inferred_name}
                      </div>
                    )}
                    <Button
                      onClick={applyEnrichment}
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700 text-white"
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
                      className="mt-2 bg-white/5 border-white/10 text-white placeholder:text-white/30"
                      data-testid="input-abn"
                    />
                  )}

                  {renderField('years_operating', 'Years Operating',
                    <Select value={formData.years_operating || ''} onValueChange={(val) => updateField('years_operating', val)}>
                      <SelectTrigger className="mt-2 bg-white/5 border-white/10 text-white" data-testid="select-years">
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
                <StepHeader icon={Target} title="Market & Customers" subtitle="Understanding your market helps BIQC prioritize signals." />
                
                {renderField('target_market', 'Target Market',
                  <Textarea
                    value={formData.target_market || ''}
                    onChange={(e) => updateField('target_market', e.target.value)}
                    placeholder="Describe your target market..."
                    rows={3}
                    className="mt-2 bg-white/5 border-white/10 text-white placeholder:text-white/30"
                    data-testid="input-target-market"
                  />
                )}

                <div className="grid grid-cols-2 gap-4">
                  {renderField('business_model', 'Business Model',
                    <Select value={formData.business_model || ''} onValueChange={(val) => updateField('business_model', val)}>
                      <SelectTrigger className="mt-2 bg-white/5 border-white/10 text-white" data-testid="select-model">
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
                      <SelectTrigger className="mt-2 bg-white/5 border-white/10 text-white" data-testid="select-revenue">
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
                    <SelectTrigger className="mt-2 bg-white/5 border-white/10 text-white" data-testid="select-customers">
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
                <StepHeader icon={Package} title="Products & Services" subtitle="What you offer and why customers choose you." />
                
                {renderField('products_services', 'Main Products/Services',
                  <Textarea
                    value={formData.products_services || ''}
                    onChange={(e) => updateField('products_services', e.target.value)}
                    placeholder="Describe your main offerings..."
                    rows={3}
                    className="mt-2 bg-white/5 border-white/10 text-white placeholder:text-white/30"
                    data-testid="input-products"
                  />
                )}

                {renderField('unique_value_proposition', 'What makes you different?',
                  <Textarea
                    value={formData.unique_value_proposition || ''}
                    onChange={(e) => updateField('unique_value_proposition', e.target.value)}
                    placeholder="Your unique value proposition..."
                    rows={3}
                    className="mt-2 bg-white/5 border-white/10 text-white placeholder:text-white/30"
                    data-testid="input-uvp"
                  />
                )}

                {renderField('pricing_model', 'Pricing Model',
                  <Select value={formData.pricing_model || ''} onValueChange={(val) => updateField('pricing_model', val)}>
                    <SelectTrigger className="mt-2 bg-white/5 border-white/10 text-white" data-testid="select-pricing">
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
                <StepHeader icon={Users} title="Team" subtitle="Your people and organizational shape." />

                {renderField('team_size', 'Team Size',
                  <Select value={formData.team_size || ''} onValueChange={(val) => updateField('team_size', val)}>
                    <SelectTrigger className="mt-2 bg-white/5 border-white/10 text-white" data-testid="select-team-size">
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
                      <div key={opt.value} className="flex items-center gap-2 p-3 rounded-lg bg-white/5 border border-white/5">
                        <RadioGroupItem value={opt.value} id={`hire-${opt.value}`} />
                        <Label htmlFor={`hire-${opt.value}`} className="text-white/70 cursor-pointer">{opt.label}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                )}
              </div>
            )}

            {/* STEP 6: Goals & Strategy */}
            {currentStep === 6 && (
              <div className="space-y-6" data-testid="step-goals">
                <StepHeader icon={TrendingUp} title="Goals & Strategy" subtitle="Your priorities drive what BIQC monitors." />

                {renderField('short_term_goals', 'Short-term Goals (6-12 months)',
                  <Textarea
                    value={formData.short_term_goals || ''}
                    onChange={(e) => updateField('short_term_goals', e.target.value)}
                    placeholder="What do you want to achieve in the next year?"
                    rows={3}
                    className="mt-2 bg-white/5 border-white/10 text-white placeholder:text-white/30"
                    data-testid="input-short-goals"
                  />
                )}

                {renderField('main_challenges', 'Biggest Challenges',
                  <Textarea
                    value={formData.main_challenges || ''}
                    onChange={(e) => updateField('main_challenges', e.target.value)}
                    placeholder="What obstacles are you facing right now?"
                    rows={3}
                    className="mt-2 bg-white/5 border-white/10 text-white placeholder:text-white/30"
                    data-testid="input-challenges"
                  />
                )}

                {renderField('growth_strategy', 'Growth Strategy',
                  <Textarea
                    value={formData.growth_strategy || ''}
                    onChange={(e) => updateField('growth_strategy', e.target.value)}
                    placeholder="How do you plan to grow?"
                    rows={3}
                    className="mt-2 bg-white/5 border-white/10 text-white placeholder:text-white/30"
                    data-testid="input-growth"
                  />
                )}

                {renderField('growth_goals', 'Growth Goals',
                  <Select value={formData.growth_goals || ''} onValueChange={(val) => updateField('growth_goals', val)}>
                    <SelectTrigger className="mt-2 bg-white/5 border-white/10 text-white" data-testid="select-growth-goals">
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
                <StepHeader icon={Brain} title="BIQC Preferences" subtitle="How should BIQC communicate with you?" />

                <div>
                  <Label className="text-white/70">Communication Style</Label>
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
                      <div key={opt.value} className="flex items-start gap-3 p-4 rounded-lg bg-white/5 border border-white/5 cursor-pointer hover:bg-white/8">
                        <RadioGroupItem value={opt.value} id={`style-${opt.value}`} className="mt-0.5" />
                        <Label htmlFor={`style-${opt.value}`} className="cursor-pointer">
                          <div className="text-sm font-medium text-white">{opt.label}</div>
                          <div className="text-xs text-white/40">{opt.desc}</div>
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                <div>
                  <Label className="text-white/70">What tools do you use?</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {['Xero / QuickBooks', 'HubSpot / CRM', 'Slack / Teams', 'Google Workspace', 'Notion / Asana', 'Stripe', 'None yet', 'Other'].map(tool => (
                      <label key={tool} className="flex items-center gap-2 p-3 rounded-lg bg-white/5 border border-white/5 cursor-pointer hover:bg-white/8 text-white/70 text-sm">
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

            {/* Navigation */}
            <div className="flex items-center justify-between pt-8 mt-8 border-t border-white/10">
              {currentStep > 0 ? (
                <Button
                  onClick={handleBack}
                  variant="ghost"
                  className="text-white/50 hover:text-white hover:bg-white/5"
                  data-testid="btn-back"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" /> Back
                </Button>
              ) : <div />}

              <Button
                onClick={handleNext}
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6"
                data-testid="btn-next"
              >
                {saving ? (
                  <><CognitiveMesh compact /> Completing...</>
                ) : currentStep === STEPS.length - 1 ? (
                  <><CheckCircle className="w-4 h-4 mr-1" /> Complete Setup</>
                ) : currentStep === 0 ? (
                  <>Get Started <ArrowRight className="w-4 h-4 ml-1" /></>
                ) : (
                  <>Continue <ArrowRight className="w-4 h-4 ml-1" /></>
                )}
              </Button>
            </div>

            {/* Save for later */}
            {currentStep > 0 && (
              <div className="text-center pt-4">
                <button
                  onClick={() => {
                    persistProgress(formData, currentStep);
                    deferOnboarding();
                    toast.success('Progress saved. You can continue anytime.');
                    navigate('/advisor');
                  }}
                  className="text-xs text-white/30 hover:text-white/50 transition-colors"
                  data-testid="btn-save-later"
                >
                  Save and continue later
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const StepHeader = ({ icon: Icon, title, subtitle }) => (
  <div className="flex items-center gap-3 pb-2">
    <div className="w-10 h-10 rounded-xl bg-blue-600/10 flex items-center justify-center">
      <Icon className="w-5 h-5 text-blue-400" />
    </div>
    <div>
      <h2 className="text-xl font-bold text-white">{title}</h2>
      <p className="text-sm text-white/40">{subtitle}</p>
    </div>
  </div>
);

export default OnboardingWizard;
