import { InlineLoading } from '../components/LoadingSystems';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';
import { User, Settings as SettingsIcon, Zap, Bell, Activity, BarChart3, Brain, Loader2, Save, CreditCard, RefreshCw, BookOpen, AlertTriangle, Lock, ArrowRight } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { PageSkeleton } from '../components/ui/skeleton-loader';
import { toast } from 'sonner';
import { apiClient } from '../lib/api';
import { supabase } from '../context/SupabaseAuthContext';
import { invalidateTutorialCache } from '../components/TutorialOverlay';
const sectionResizeStyle = { resize: 'horizontal', overflow: 'auto', minWidth: '320px', maxWidth: '100%' };
const TIER_DISPLAY = {
  free: 'Free',
  trial: 'Free Trial',
  starter: 'Growth',
  foundation: 'Growth',
  growth: 'Growth',
  pro: 'Professional',
  professional: 'Professional',
  enterprise: 'Enterprise',
  custom_build: 'Custom',
  beta: 'Beta',
  super_admin: 'Admin',
};

const Settings = () => {
  const { user } = useSupabaseAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('account');
  const [profile, setProfile] = useState({});
  const [calibrationStatus, setCalibrationStatus] = useState(null);
  const [resettingCalibration, setResettingCalibration] = useState(false);
  const [tutorialPrefs, setTutorialPrefs] = useState({ tutorials_disabled: false });
  const [tutorialAction, setTutorialAction] = useState(null); // 'resetting' | 'toggling'
  const [tutorialConfirm, setTutorialConfirm] = useState(null); // 'reset' | 'disable' | null
  const [syncing, setSyncing] = useState(false);
  const [accountData, setAccountData] = useState({
    name: user?.name || '',
    email: user?.email || ''
  });
  const [opsLoading, setOpsLoading] = useState(true);
  const [opsSummary, setOpsSummary] = useState({
    actions_count: 0,
    alerts_total: 0,
    alerts_high: 0,
    business_dna_completeness: 0,
    business_dna_strength: 0,
    data_health_score: 0,
    connected_sources: 0,
  });

  const syncFromCalibration = async () => {
    setSyncing(true);
    try {
      // Pull enriched profile from backend (business_profiles + operator_profile + integrations)
      const res = await apiClient.get('/business-profile/context');
      const ctx = res.data || {};
      const profile = ctx.profile || {};
      const resolved = ctx.resolved_fields || {};

      // Build enriched profile from all available sources
      const enriched = { ...profile };
      for (const [field, factData] of Object.entries(resolved)) {
        if (factData?.value && !enriched[field]) {
          enriched[field] = factData.value;
        }
      }

      // Also pull from operator profile (agent persona = communication preferences)
      if (ctx.calibration_status === 'complete') {
        enriched._calibration_complete = true;
      }

      const fieldsUpdated = Object.values(enriched).filter(v => v).length;

      if (fieldsUpdated > 0) {
        // Save enriched profile back
        await apiClient.put('/business-profile', enriched);
        setProfile(prev => ({ ...prev, ...enriched }));
        toast.success(`Profile synced — ${fieldsUpdated} fields updated from calibration`);
        fetchProfile();
      } else {
        toast.info('Complete calibration first to populate your profile automatically.');
      }
    } catch (e) {
      toast.error('Sync failed — please try again');
    } finally { setSyncing(false); }
  };

  useEffect(() => {
    fetchProfile();
    fetchCalibrationStatus();
    fetchOpsSummary();
    // Safety timeout: don't show loading forever
    const timeout = setTimeout(() => setLoading(false), 5000);
    return () => clearTimeout(timeout);
  }, []);

  const fetchCalibrationStatus = async () => {
    try {
      const res = await apiClient.get('/calibration/status');
      setCalibrationStatus(res.data?.status === 'COMPLETE' ? 'complete' : 'incomplete');
      // console.log('[Settings] Calibration status from DB:', res.data?.status);
    } catch (e) {
      console.error('[Settings] Failed to fetch calibration status:', e);
      setCalibrationStatus('error');
    }
  };

  const fetchOpsSummary = async () => {
    setOpsLoading(true);
    try {
      const [snapshotRes, alertsRes, scoresRes, readinessRes, integrationRes] = await Promise.allSettled([
        apiClient.get('/snapshot/latest'),
        apiClient.get('/notifications/alerts'),
        apiClient.get('/business-profile/scores'),
        apiClient.get('/intelligence/data-readiness'),
        apiClient.get('/user/integration-status'),
      ]);

      const actionsCount = snapshotRes.status === 'fulfilled'
        ? Number((snapshotRes.value?.data?.cognitive?.resolution_queue || []).length || 0)
        : 0;
      const alertsSummary = alertsRes.status === 'fulfilled'
        ? (alertsRes.value?.data?.summary || {})
        : {};
      const scores = scoresRes.status === 'fulfilled'
        ? (scoresRes.value?.data || {})
        : {};
      const readiness = readinessRes.status === 'fulfilled'
        ? (readinessRes.value?.data || {})
        : {};
      const integrationStatus = integrationRes.status === 'fulfilled'
        ? (integrationRes.value?.data || {})
        : {};
      const connectedSources = Array.isArray(integrationStatus?.integrations)
        ? integrationStatus.integrations.filter((row) => Boolean(row?.connected)).length
        : Number(integrationStatus?.total_connected || 0);

      setOpsSummary({
        actions_count: actionsCount,
        alerts_total: Number(alertsSummary.total || 0),
        alerts_high: Number(alertsSummary.high || 0),
        business_dna_completeness: Number(scores.completeness || 0),
        business_dna_strength: Number(scores.strength || 0),
        data_health_score: Number(readiness.score || 0),
        connected_sources: connectedSources,
      });
    } catch {
      // non-blocking, settings core still loads
    } finally {
      setOpsLoading(false);
    }
  };

  const fetchProfile = async () => {
    try {
      const response = await apiClient.get('/business-profile/context');
      const ctx = response.data || {};
      const resolvedFields = ctx.resolved_fields || {};
      const rawProfile = ctx.profile || {};
      const merged = { ...rawProfile };
      for (const [field, factData] of Object.entries(resolvedFields)) {
        if (factData.value && !merged[field]) {
          merged[field] = factData.value;
        }
      }
      setProfile(merged);
    } catch (error) {
      console.error('Failed to load profile:', error);
    } finally {
      setLoading(false);
    }
    // Load tutorial preferences
    try {
      const tutRes = await apiClient.get('/tutorials/status');
      setTutorialPrefs({ tutorials_disabled: tutRes.data?.tutorials_disabled || false });
    } catch { /* non-fatal */ }
  };

  const handleResetTutorials = async () => {
    setTutorialAction('resetting');
    try {
      await apiClient.post('/tutorials/reset');
      invalidateTutorialCache();
      localStorage.removeItem('biqc_tutorials_seen');
      setTutorialPrefs(prev => ({ ...prev }));
      toast.success('Tutorials reset — they will show again on your next visit to each page.');
    } catch {
      toast.error('Could not reset tutorials. Please try again.');
    } finally {
      setTutorialAction(null);
    }
  };

  const handleToggleTutorials = async (disabled) => {
    setTutorialAction('toggling');
    try {
      await apiClient.post('/tutorials/preferences', { tutorials_disabled: disabled });
      invalidateTutorialCache();
      setTutorialPrefs({ tutorials_disabled: disabled });
      toast.success(disabled ? 'Tutorials disabled across all pages.' : 'Tutorials re-enabled.');
    } catch {
      toast.error('Could not update tutorial preferences.');
    } finally {
      setTutorialAction(null);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await apiClient.put('/business-profile', profile);
      toast.success('Settings saved successfully!');
    } catch (error) {
      toast.error('Failed to save settings');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const updateProfile = (field, value) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const toggleArrayItem = (field, item) => {
    const current = profile[field] || [];
    const updated = current.includes(item)
      ? current.filter(i => i !== item)
      : [...current, item];
    updateProfile(field, updated);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-8 max-w-4xl mx-auto">
          <PageSkeleton cards={2} lines={5} />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-heading mb-2" style={{ color: 'var(--text-primary)' }}>
              Settings
            </h1>
            <p style={{ color: 'var(--text-secondary)' }}>
              Manage your account, preferences, and billing
            </p>
          </div>

          {/* Agent Calibration Status — reads from persona_calibration_status ONLY */}
          <Card className="mb-6" style={sectionResizeStyle}>
            <CardContent className="py-4 px-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${calibrationStatus === 'complete' ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`} />
                  <div>
                    <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Agent Calibration</h3>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {calibrationStatus === 'complete' ? 'Calibration complete — BIQC is personalised to your operating style' : 'Incomplete — BIQC needs calibration to advise effectively'}
                    </p>
                  </div>
                </div>
                {calibrationStatus === 'complete' ? (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={syncing} onClick={syncFromCalibration}>
                      {syncing ? <InlineLoading text="syncing" /> : <><RefreshCw className="w-3.5 h-3.5 mr-1" />Sync Profile</>}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={resettingCalibration}
                      onClick={async () => {
                      setResettingCalibration(true);
                      try {
                        await apiClient.post('/calibration/reset');
                        toast.success('Calibration reset. Redirecting...');
                        setTimeout(() => { window.location.href = '/calibration'; }, 1000);
                      } catch (e) {
                        toast.error('Failed to reset calibration');
                        setResettingCalibration(false);
                      }
                    }}
                  >
                    {resettingCalibration ? <InlineLoading text="recalibrating" /> : 'Recalibrate'}
                  </Button>
                  </div>
                ) : (
                  <Button size="sm" className="btn-primary" onClick={() => navigate('/calibration')}>
                    Complete Calibration
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 w-full mb-8 gap-1">
              <TabsTrigger value="account" className="flex items-center gap-2">
                <User className="w-4 h-4" />
                <span className="hidden sm:inline">Account</span>
              </TabsTrigger>
              <TabsTrigger value="preferences" className="flex items-center gap-2">
                <Brain className="w-4 h-4" />
                <span className="hidden sm:inline">Preferences</span>
              </TabsTrigger>
              <TabsTrigger value="tools" className="flex items-center gap-2">
                <Zap className="w-4 h-4" />
                <span className="hidden sm:inline">Tools</span>
              </TabsTrigger>
              <TabsTrigger value="actions" className="flex items-center gap-2">
                <Zap className="w-4 h-4" />
                <span className="hidden sm:inline">Actions</span>
              </TabsTrigger>
              <TabsTrigger value="alerts" className="flex items-center gap-2">
                <Bell className="w-4 h-4" />
                <span className="hidden sm:inline">Alerts</span>
              </TabsTrigger>
              <TabsTrigger value="business-dna" className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                <span className="hidden sm:inline">Business DNA</span>
              </TabsTrigger>
              <TabsTrigger value="data-health" className="flex items-center gap-2">
                <Activity className="w-4 h-4" />
                <span className="hidden sm:inline">Data Health</span>
              </TabsTrigger>
              <TabsTrigger value="connectors" className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4" />
                <span className="hidden sm:inline">Connectors</span>
              </TabsTrigger>
              <TabsTrigger value="billing" className="flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                <span className="hidden sm:inline">Billing</span>
              </TabsTrigger>
            </TabsList>

            {/* ACCOUNT TAB */}
            <TabsContent value="account">
              <Card style={sectionResizeStyle}>
                <CardHeader>
                  <CardTitle>Account Information</CardTitle>
                  <CardDescription>Your personal and business details</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label>Full Name</Label>
                      <Input
                        value={accountData.name}
                        onChange={(e) => setAccountData({ ...accountData, name: e.target.value })}
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <Label>Email Address</Label>
                      <Input
                        value={accountData.email}
                        disabled
                        className="mt-2"
                        style={{ background: 'var(--biqc-bg-card)' }}
                      />
                      <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Email cannot be changed</p>
                    </div>
                  </div>

                  {/* Onboarding Section */}
                  <div className="pt-6 border-t" style={{ borderColor: 'var(--border-light)' }}>
                    <h3 className="font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Onboarding</h3>
                    <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                      Complete your onboarding to help BIQC understand your business better.
                    </p>
                    <Button
                      onClick={() => window.location.href = '/onboarding'}
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <SettingsIcon className="w-4 h-4" />
                      Complete Onboarding
                    </Button>
                  </div>

                  <div className="pt-6 border-t" style={{ borderColor: 'var(--border-light)' }}>
                    <h3 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Business Profile</h3>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label>Business Name</Label>
                          <Input value={profile.business_name || ''} onChange={(e) => updateProfile('business_name', e.target.value)} placeholder="Your Company Name" className="mt-1" />
                        </div>
                        <div>
                          <Label>Industry</Label>
                          <Input value={profile.industry || ''} onChange={(e) => updateProfile('industry', e.target.value)} placeholder="e.g., Technology" className="mt-1" />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label>ABN</Label>
                          <Input value={profile.abn || ''} onChange={(e) => updateProfile('abn', e.target.value)} placeholder="12 345 678 901" className="mt-1" />
                        </div>
                        <div>
                          <Label>Location</Label>
                          <Input value={profile.location || ''} onChange={(e) => updateProfile('location', e.target.value)} placeholder="City, State" className="mt-1" />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label>Website</Label>
                          <Input value={profile.website || ''} onChange={(e) => updateProfile('website', e.target.value)} placeholder="www.company.com" className="mt-1" />
                        </div>
                        <div>
                          <Label>Years Operating</Label>
                          <Input value={profile.years_operating || ''} onChange={(e) => updateProfile('years_operating', e.target.value)} placeholder="e.g., 2-5 years" className="mt-1" />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-4">
                        <div>
                          <Label>Market Position</Label>
                          <Input value={profile.market_position || ''} onChange={(e) => updateProfile('market_position', e.target.value)} placeholder="How your business is positioned in the current market" className="mt-1" />
                        </div>
                        <div>
                          <Label>Competitor Intelligence Snapshot</Label>
                          <Input value={profile.competitor_scan_result || ''} onChange={(e) => updateProfile('competitor_scan_result', e.target.value)} placeholder="Competitor SWOT / SEO / paid / social analysis summary" className="mt-1" />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <Label>Business Stage</Label>
                          <Select value={profile.business_stage || ''} onValueChange={(val) => updateProfile('business_stage', val)}>
                            <SelectTrigger className="mt-1" data-testid="settings-select-stage">
                              <SelectValue placeholder="Select stage" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="idea">Idea</SelectItem>
                              <SelectItem value="startup">Startup</SelectItem>
                              <SelectItem value="established">Established</SelectItem>
                              <SelectItem value="enterprise">Enterprise</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Growth Goals</Label>
                          <Select value={profile.growth_goals || ''} onValueChange={(val) => updateProfile('growth_goals', val)}>
                            <SelectTrigger className="mt-1" data-testid="settings-select-growth-goals">
                              <SelectValue placeholder="Select goal" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="revenue_growth">Revenue Growth</SelectItem>
                              <SelectItem value="market_expansion">Market Expansion</SelectItem>
                              <SelectItem value="product_diversification">Product Diversification</SelectItem>
                              <SelectItem value="operational_efficiency">Operational Efficiency</SelectItem>
                              <SelectItem value="team_scaling">Team Scaling</SelectItem>
                              <SelectItem value="profitability">Profitability Focus</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Risk Profile</Label>
                          <Select value={profile.risk_profile || ''} onValueChange={(val) => updateProfile('risk_profile', val)}>
                            <SelectTrigger className="mt-1" data-testid="settings-select-risk-profile">
                              <SelectValue placeholder="Select profile" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="conservative">Conservative</SelectItem>
                              <SelectItem value="moderate">Moderate</SelectItem>
                              <SelectItem value="aggressive">Aggressive</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex justify-end pt-2">
                        <Button onClick={handleSaveProfile} variant="outline" size="sm" disabled={saving}>
                          {saving ? null : <Save className="w-4 h-4 mr-1" />} Save
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t" style={{ borderColor: 'var(--border-light)' }}>
                    <h3 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Account Details</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center p-4 rounded-lg" style={{ background: 'var(--biqc-bg-card)' }}>
                        <div>
                          <p className="font-medium" style={{ color: 'var(--text-primary)' }}>Account Type</p>
                          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Your current role and access level</p>
                        </div>
                        <span className="badge badge-primary text-xs px-3 py-1 rounded-full"
                          style={{ background: 'rgba(255,106,0,0.1)', color: '#FF6A00', border: '1px solid rgba(255,106,0,0.2)' }}>
                          {user?.role === 'superadmin' ? 'Super Admin' : user?.role === 'admin' ? 'Admin' : 'Business Owner'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center p-4 rounded-lg" style={{ background: 'var(--biqc-bg-card)' }}>
                        <div>
                          <p className="font-medium" style={{ color: 'var(--text-primary)' }}>Member Since</p>
                          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Account creation date</p>
                        </div>
                        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                          {user?.created_at
                            ? new Date(user.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
                            : <span style={{ color: '#64748B', fontStyle: 'italic' }}>Not available</span>
                          }
                        </span>
                      </div>

                      {/* Email lock explanation */}
                      <div className="p-4 rounded-lg" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }}>
                        <div className="flex items-center gap-2 mb-2">
                          <Lock className="w-4 h-4" style={{ color: '#64748B' }} />
                          <p className="font-medium" style={{ color: 'var(--text-primary)' }}>Email Address</p>
                        </div>
                        <p className="text-sm mb-1" style={{ color: 'var(--text-muted)' }}>{user?.email}</p>
                        <p className="text-xs" style={{ color: '#64748B' }}>
                          Your email is managed by your authentication provider (Google or Microsoft) and cannot be changed here.
                          To change it, update your email in Google or Microsoft account settings, then sign in again.
                        </p>
                      </div>

                      {/* Calibration review link */}
                      <div className="p-4 rounded-lg flex items-center justify-between"
                        style={{ background: 'rgba(255,106,0,0.04)', border: '1px solid rgba(255,106,0,0.15)' }}>
                        <div>
                          <p className="font-medium" style={{ color: 'var(--text-primary)' }}>AI Calibration Answers</p>
                          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Review or update your calibration to refine your AI agent's behaviour</p>
                        </div>
                        <Button variant="outline" onClick={() => navigate('/calibration')}
                          className="flex items-center gap-2 text-sm"
                          style={{ borderColor: '#FF6A00', color: '#FF6A00' }}
                          data-testid="recalibrate-btn">
                          Review Calibration <ArrowRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* PREFERENCES TAB */}
            <TabsContent value="preferences">
              <Card style={sectionResizeStyle}>
                <CardHeader>
                  <CardTitle>AI Intelligence Preferences</CardTitle>
                  <CardDescription>Customize how your AI intelligence system communicates and provides guidance</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <Label className="text-base mb-3 block">Communication Style</Label>
                    <RadioGroup 
                      value={profile.advice_style || 'conversational'} 
                      onValueChange={(val) => updateProfile('advice_style', val)}
                      className="space-y-3"
                    >
                      <div className="flex items-start space-x-3 p-4 rounded-lg border cursor-pointer hover:bg-white/5" style={{ borderColor: 'var(--biqc-border)', background: 'var(--biqc-bg-card)' }}>
                        <RadioGroupItem value="concise" id="style-concise" className="mt-1" />
                        <Label htmlFor="style-concise" className="cursor-pointer flex-1">
                          <div className="font-medium" style={{ color: 'var(--text-primary)' }}>Quick & Concise</div>
                          <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Brief, actionable bullet points</div>
                        </Label>
                      </div>
                      <div className="flex items-start space-x-3 p-4 rounded-lg border cursor-pointer hover:bg-white/5" style={{ borderColor: 'var(--biqc-border)', background: 'var(--biqc-bg-card)' }}>
                        <RadioGroupItem value="detailed" id="style-detailed" className="mt-1" />
                        <Label htmlFor="style-detailed" className="cursor-pointer flex-1">
                          <div className="font-medium" style={{ color: 'var(--text-primary)' }}>Detailed & Thorough</div>
                          <div className="text-sm" style={{ color: 'var(--text-muted)' }}>In-depth explanations with context and reasoning</div>
                        </Label>
                      </div>
                      <div className="flex items-start space-x-3 p-4 rounded-lg border cursor-pointer hover:bg-white/5" style={{ borderColor: 'var(--biqc-border)', background: 'var(--biqc-bg-card)' }}>
                        <RadioGroupItem value="conversational" id="style-conversational" className="mt-1" />
                        <Label htmlFor="style-conversational" className="cursor-pointer flex-1">
                          <div className="font-medium" style={{ color: 'var(--text-primary)' }}>Conversational</div>
                          <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Like chatting with a trusted business partner</div>
                        </Label>
                      </div>
                      <div className="flex items-start space-x-3 p-4 rounded-lg border cursor-pointer hover:bg-white/5" style={{ borderColor: 'var(--biqc-border)', background: 'var(--biqc-bg-card)' }}>
                        <RadioGroupItem value="data-driven" id="style-data" className="mt-1" />
                        <Label htmlFor="style-data" className="cursor-pointer flex-1">
                          <div className="font-medium" style={{ color: 'var(--text-primary)' }}>Data-Driven</div>
                          <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Focus on metrics, analytics, and evidence</div>
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="pt-6 border-t" style={{ borderColor: 'var(--border-light)' }}>
                    <Label className="text-base mb-3 block">Time Availability</Label>
                    <Select 
                      value={profile.time_availability || ''} 
                      onValueChange={(val) => updateProfile('time_availability', val)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select your weekly availability" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="< 2 hours/week">Less than 2 hours/week</SelectItem>
                        <SelectItem value="2-5 hours/week">2-5 hours/week</SelectItem>
                        <SelectItem value="5-10 hours/week">5-10 hours/week</SelectItem>
                        <SelectItem value="10-20 hours/week">10-20 hours/week</SelectItem>
                        <SelectItem value="20+ hours/week">20+ hours/week</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>
                      Helps us tailor recommendations to match your capacity
                    </p>
                  </div>

                  <div className="pt-6 border-t" style={{ borderColor: 'var(--border-light)' }}>
                    <Label className="text-base mb-3 block">Preferred Guidance Format</Label>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        'Action items & checklists',
                        'Detailed analysis',
                        'Strategic discussion',
                        'Quick tips',
                        'Step-by-step guides',
                        'Case studies'
                      ].map(format => {
                        const current = profile.advice_formats || [];
                        const isSelected = current.includes(format);
                        return (
                          <label
                            key={format}
                            className="flex items-center gap-2 p-3 rounded-lg border cursor-pointer hover:bg-white/5"
                            style={{ 
                              borderColor: isSelected ? '#FF6A00' : '#243140',
                              background: isSelected ? 'rgba(0,102,255,0.05)' : 'transparent'
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleArrayItem('advice_formats', format)}
                            />
                            <span className="text-sm">{format}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button onClick={handleSaveProfile} className="btn-primary" disabled={saving}>
                      {saving ? null : <Save className="w-4 h-4 mr-2" />}
                      Save Preferences
                    </Button>
                  </div>

                  {/* Tutorial Preferences */}
                  <div className="pt-6 border-t" style={{ borderColor: 'var(--border-light)' }}>
                    <div className="flex items-center gap-2 mb-1">
                      <BookOpen className="w-4 h-4" style={{ color: '#FF6A00' }} />
                      <Label className="text-base">Tutorial Guides</Label>
                    </div>
                    <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
                      Page guides appear once on your first visit to each section. You can reset or disable them here.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3">
                      {/* Tutorial Reset — with confirmation */}
                      {tutorialConfirm === 'reset' ? (
                        <div className="flex items-center gap-2 p-3 rounded-lg" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)' }}>
                          <AlertTriangle className="w-4 h-4 text-[#F59E0B] shrink-0" />
                          <span className="text-xs" style={{ color: '#F59E0B' }}>Reset all tutorial progress?</span>
                          <Button size="sm" onClick={() => { setTutorialConfirm(null); handleResetTutorials(); }}
                            className="text-xs h-7 px-3" style={{ background: '#F59E0B', color: 'white' }}>Confirm</Button>
                          <Button size="sm" variant="ghost" onClick={() => setTutorialConfirm(null)}
                            className="text-xs h-7 px-3" style={{ color: '#64748B' }}>Cancel</Button>
                        </div>
                      ) : (
                        <Button variant="outline" onClick={() => setTutorialConfirm('reset')}
                          disabled={tutorialAction !== null} data-testid="reset-tutorials-btn"
                          className="flex items-center gap-2">
                          {tutorialAction === 'resetting' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                          Reset all tutorials
                        </Button>
                      )}

                      {/* Tutorial Disable — with confirmation */}
                      {tutorialConfirm === 'disable' ? (
                        <div className="flex items-center gap-2 p-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)' }}>
                          <AlertTriangle className="w-4 h-4 text-[#EF4444] shrink-0" />
                          <span className="text-xs" style={{ color: '#EF4444' }}>
                            {tutorialPrefs.tutorials_disabled ? 'Re-enable all tutorials?' : 'Disable all tutorials? You won\'t see guides again.'}
                          </span>
                          <Button size="sm" onClick={() => { setTutorialConfirm(null); handleToggleTutorials(!tutorialPrefs.tutorials_disabled); }}
                            className="text-xs h-7 px-3" style={{ background: '#EF4444', color: 'white' }}>Confirm</Button>
                          <Button size="sm" variant="ghost" onClick={() => setTutorialConfirm(null)}
                            className="text-xs h-7 px-3" style={{ color: '#64748B' }}>Cancel</Button>
                        </div>
                      ) : (
                        <Button variant="outline" onClick={() => setTutorialConfirm('disable')}
                          disabled={tutorialAction !== null} data-testid="toggle-tutorials-btn"
                          className="flex items-center gap-2"
                          style={tutorialPrefs.tutorials_disabled ? { borderColor: '#10B981', color: '#10B981' } : { borderColor: '#64748B', color: '#64748B' }}>
                          {tutorialAction === 'toggling' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                          {tutorialPrefs.tutorials_disabled ? 'Re-enable tutorials' : 'Disable all tutorials'}
                        </Button>
                      )}
                    </div>
                    {tutorialPrefs.tutorials_disabled && (
                      <p className="text-xs mt-2" style={{ color: '#F59E0B' }}>
                        Tutorials are currently disabled. Click Re-enable to turn them back on.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TOOLS TAB */}
            <TabsContent value="tools">
              <Card style={sectionResizeStyle}>
                <CardHeader>
                  <CardTitle>Tools & Systems</CardTitle>
                  <CardDescription>Tools and platforms you use to run your business</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <Label className="text-base mb-3 block">Current Tools (Select all that apply)</Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {[
                        'HubSpot / CRM',
                        'Salesforce',
                        'Xero / QuickBooks',
                        'Slack / Teams',
                        'Google Workspace',
                        'Notion / Asana',
                        'Monday.com',
                        'Trello / ClickUp',
                        'Stripe / Payment',
                        'Mailchimp / Email',
                        'Zapier / Automation',
                        'Analytics Tools',
                        'None yet',
                        'Other'
                      ].map(tool => {
                        const current = profile.current_tools || [];
                        const isSelected = current.includes(tool);
                        return (
                          <label
                            key={tool}
                            className="flex items-center gap-2 p-3 rounded-lg border cursor-pointer hover:bg-white/5"
                            style={{ 
                              borderColor: isSelected ? '#FF6A00' : '#243140',
                              background: isSelected ? 'rgba(0,102,255,0.05)' : 'transparent'
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleArrayItem('current_tools', tool)}
                            />
                            <span className="text-sm">{tool}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-6 border-t" style={{ borderColor: 'var(--border-light)' }}>
                    <Label>CRM System</Label>
                    <Select 
                      value={profile.crm_system || ''} 
                      onValueChange={(val) => updateProfile('crm_system', val)}
                    >
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder="Select your CRM" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="None">None</SelectItem>
                        <SelectItem value="HubSpot">HubSpot</SelectItem>
                        <SelectItem value="Salesforce">Salesforce</SelectItem>
                        <SelectItem value="Zoho CRM">Zoho CRM</SelectItem>
                        <SelectItem value="Pipedrive">Pipedrive</SelectItem>
                        <SelectItem value="Monday.com">Monday.com</SelectItem>
                        <SelectItem value="Custom/Other">Custom/Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Accounting System</Label>
                    <Select 
                      value={profile.accounting_system || ''} 
                      onValueChange={(val) => updateProfile('accounting_system', val)}
                    >
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder="Select your accounting system" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="None">None</SelectItem>
                        <SelectItem value="Xero">Xero</SelectItem>
                        <SelectItem value="QuickBooks">QuickBooks</SelectItem>
                        <SelectItem value="FreshBooks">FreshBooks</SelectItem>
                        <SelectItem value="MYOB">MYOB</SelectItem>
                        <SelectItem value="Sage">Sage</SelectItem>
                        <SelectItem value="Custom/Other">Custom/Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Project Management Tool</Label>
                    <Select 
                      value={profile.project_management_tool || ''} 
                      onValueChange={(val) => updateProfile('project_management_tool', val)}
                    >
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder="Select your PM tool" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="None">None</SelectItem>
                        <SelectItem value="Asana">Asana</SelectItem>
                        <SelectItem value="Monday.com">Monday.com</SelectItem>
                        <SelectItem value="Trello">Trello</SelectItem>
                        <SelectItem value="ClickUp">ClickUp</SelectItem>
                        <SelectItem value="Notion">Notion</SelectItem>
                        <SelectItem value="Jira">Jira</SelectItem>
                        <SelectItem value="Custom/Other">Custom/Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button onClick={handleSaveProfile} className="btn-primary" disabled={saving}>
                      {saving ? null : <Save className="w-4 h-4 mr-2" />}
                      Save Tools
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ACTIONS TAB */}
            <TabsContent value="actions">
              <Card style={sectionResizeStyle}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="w-5 h-5" style={{ color: '#FF6A00' }} />
                    Actions Workspace
                  </CardTitle>
                  <CardDescription>
                    Keep execution work visible and move directly into your full Actions page.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="rounded-xl border p-4" style={{ borderColor: 'var(--biqc-border)', background: 'var(--biqc-bg-card)' }}>
                      <p className="text-[10px] uppercase tracking-[0.12em]" style={{ color: '#94A3B8' }}>Open actions</p>
                      <p className="text-2xl font-semibold mt-1" style={{ color: 'var(--text-primary)' }}>
                        {opsLoading ? '--' : opsSummary.actions_count}
                      </p>
                    </div>
                    <div className="rounded-xl border p-4" style={{ borderColor: 'var(--biqc-border)', background: 'var(--biqc-bg-card)' }}>
                      <p className="text-[10px] uppercase tracking-[0.12em]" style={{ color: '#94A3B8' }}>Connected sources</p>
                      <p className="text-2xl font-semibold mt-1" style={{ color: 'var(--text-primary)' }}>
                        {opsLoading ? '--' : opsSummary.connected_sources}
                      </p>
                    </div>
                    <div className="rounded-xl border p-4" style={{ borderColor: 'var(--biqc-border)', background: 'var(--biqc-bg-card)' }}>
                      <p className="text-[10px] uppercase tracking-[0.12em]" style={{ color: '#94A3B8' }}>Operational posture</p>
                      <p className="text-2xl font-semibold mt-1" style={{ color: 'var(--text-primary)' }}>
                        {opsLoading ? '--' : `${Math.max(0, Math.min(100, Math.round((opsSummary.data_health_score + opsSummary.business_dna_strength) / 2)))}%`}
                      </p>
                    </div>
                  </div>
                  <div className="rounded-xl border p-4" style={{ borderColor: 'var(--biqc-border)', background: 'rgba(255,106,0,0.05)' }}>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      Actions in Settings are a quick control surface. Use the full Actions workspace for prioritization, assignment, and completion tracking.
                    </p>
                    <Button className="mt-3 btn-primary" onClick={() => navigate('/actions')} data-testid="settings-open-actions">
                      Open Actions Page
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ALERTS TAB */}
            <TabsContent value="alerts">
              <Card style={sectionResizeStyle}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="w-5 h-5" style={{ color: '#F59E0B' }} />
                    Alerts Center
                  </CardTitle>
                  <CardDescription>
                    View critical alert pressure before jumping to the full triage console.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="rounded-xl border p-4" style={{ borderColor: 'rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.06)' }}>
                      <p className="text-[10px] uppercase tracking-[0.12em]" style={{ color: '#F59E0B' }}>Total alerts</p>
                      <p className="text-2xl font-semibold mt-1" style={{ color: 'var(--text-primary)' }}>
                        {opsLoading ? '--' : opsSummary.alerts_total}
                      </p>
                    </div>
                    <div className="rounded-xl border p-4" style={{ borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)' }}>
                      <p className="text-[10px] uppercase tracking-[0.12em]" style={{ color: '#EF4444' }}>High urgency</p>
                      <p className="text-2xl font-semibold mt-1" style={{ color: 'var(--text-primary)' }}>
                        {opsLoading ? '--' : opsSummary.alerts_high}
                      </p>
                    </div>
                  </div>
                  <div className="rounded-xl border p-4" style={{ borderColor: 'var(--biqc-border)', background: 'var(--biqc-bg-card)' }}>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      Alerts are grounded in connected systems and BIQc policies. Resolve urgent cards first to stabilize forecasting and execution confidence.
                    </p>
                    <Button className="mt-3 btn-primary" onClick={() => navigate('/alerts')} data-testid="settings-open-alerts">
                      Open Alerts Page
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* BUSINESS DNA TAB */}
            <TabsContent value="business-dna">
              <Card style={sectionResizeStyle}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" style={{ color: '#06B6D4' }} />
                    Business DNA
                  </CardTitle>
                  <CardDescription>
                    Monitor profile completeness and strategic signal strength used by Ask BIQc.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="rounded-xl border p-4" style={{ borderColor: 'var(--biqc-border)', background: 'var(--biqc-bg-card)' }}>
                      <p className="text-[10px] uppercase tracking-[0.12em]" style={{ color: '#94A3B8' }}>Profile completeness</p>
                      <p className="text-2xl font-semibold mt-1" style={{ color: 'var(--text-primary)' }}>
                        {opsLoading ? '--' : `${Math.round(opsSummary.business_dna_completeness)}%`}
                      </p>
                    </div>
                    <div className="rounded-xl border p-4" style={{ borderColor: 'var(--biqc-border)', background: 'var(--biqc-bg-card)' }}>
                      <p className="text-[10px] uppercase tracking-[0.12em]" style={{ color: '#94A3B8' }}>Signal strength</p>
                      <p className="text-2xl font-semibold mt-1" style={{ color: 'var(--text-primary)' }}>
                        {opsLoading ? '--' : `${Math.round(opsSummary.business_dna_strength)}%`}
                      </p>
                    </div>
                  </div>
                  <div className="rounded-xl border p-4" style={{ borderColor: 'var(--biqc-border)', background: 'rgba(6,182,212,0.05)' }}>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      Business DNA drives personalization, priority scoring, and recommendation style across Ask BIQc and operating modules.
                    </p>
                    <Button className="mt-3 btn-primary" onClick={() => navigate('/business-profile')} data-testid="settings-open-business-dna">
                      Open Business DNA Page
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* DATA HEALTH TAB */}
            <TabsContent value="data-health">
              <Card style={sectionResizeStyle}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="w-5 h-5" style={{ color: '#10B981' }} />
                    Data Health
                  </CardTitle>
                  <CardDescription>
                    Check ingestion readiness and connector-backed data confidence.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-xl border p-4" style={{ borderColor: 'rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.06)' }}>
                    <p className="text-[10px] uppercase tracking-[0.12em]" style={{ color: '#10B981' }}>Readiness score</p>
                    <p className="text-2xl font-semibold mt-1" style={{ color: 'var(--text-primary)' }}>
                      {opsLoading ? '--' : `${Math.round(opsSummary.data_health_score)}%`}
                    </p>
                  </div>
                  <div className="rounded-xl border p-4" style={{ borderColor: 'var(--biqc-border)', background: 'var(--biqc-bg-card)' }}>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      Data Health reflects coverage, freshness, and integration validity. Keep this score high to improve Ask BIQc answer depth and reliability.
                    </p>
                    <Button className="mt-3 btn-primary" onClick={() => navigate('/data-health')} data-testid="settings-open-data-health">
                      Open Data Health Page
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* CONNECTORS TAB */}
            <TabsContent value="connectors">
              <Card style={sectionResizeStyle}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <RefreshCw className="w-5 h-5" style={{ color: '#8B5CF6' }} />
                    Connectors
                  </CardTitle>
                  <CardDescription>
                    Manage integrations and validate post-connect sync health.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-xl border p-4" style={{ borderColor: 'var(--biqc-border)', background: 'var(--biqc-bg-card)' }}>
                    <p className="text-[10px] uppercase tracking-[0.12em]" style={{ color: '#94A3B8' }}>Connected systems</p>
                    <p className="text-2xl font-semibold mt-1" style={{ color: 'var(--text-primary)' }}>
                      {opsLoading ? '--' : opsSummary.connected_sources}
                    </p>
                    <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                      Connected sources directly influence retrieval depth across Ask BIQc and platform modules.
                    </p>
                  </div>
                  <Button className="btn-primary" onClick={() => navigate('/integrations')} data-testid="settings-open-connectors">
                    Open Connectors Page
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* BILLING TAB */}
            <TabsContent value="billing">
              <Card style={sectionResizeStyle}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5" style={{ color: '#FF6A00' }} />
                    Billing & Subscription
                  </CardTitle>
                  <CardDescription>Your plan details and payment history</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-10 space-y-4">
                    <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center"
                      style={{ background: 'rgba(255,106,0,0.1)' }}>
                      <CreditCard className="w-8 h-8" style={{ color: '#FF6A00' }} />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                        Billing management coming soon
                      </h3>
                      <p className="text-sm max-w-sm mx-auto" style={{ color: 'var(--text-muted)' }}>
                        Plan upgrades, invoice history and payment method management will be available here shortly.
                        For billing enquiries, contact <span style={{ color: '#FF6A00' }}>billing@biqc.com.au</span>
                      </p>
                    </div>
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium"
                      style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981', border: '1px solid rgba(16,185,129,0.2)' }}>
                      <span className="w-2 h-2 rounded-full" style={{ background: '#10B981' }} />
                      Beta Plan — All features active
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => navigate('/subscribe')}
                      className="mx-auto"
                      data-testid="settings-open-subscription"
                    >
                      Open Subscription Center
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Settings;
