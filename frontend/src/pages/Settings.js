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
import { User, Building, Settings as SettingsIcon, Zap, Brain, Loader2, Save, CreditCard, RefreshCw } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { PageSkeleton } from '../components/ui/skeleton-loader';
import { toast } from 'sonner';
import { apiClient } from '../lib/api';
import { supabase } from '../context/SupabaseAuthContext';

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

const Settings = () => {
  const { user } = useSupabaseAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('account');
  const [profile, setProfile] = useState({});
  const [calibrationStatus, setCalibrationStatus] = useState(null); // DB authority only
  const [resettingCalibration, setResettingCalibration] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [accountData, setAccountData] = useState({
    name: user?.name || '',
    email: user?.email || ''
  });

  const syncFromCalibration = async () => {
    setSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error('Not authenticated'); return; }
      const res = await fetch(`${SUPABASE_URL}/functions/v1/calibration-sync`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json', 'apikey': ANON_KEY },
        body: '{}',
      });
      const data = await res.json();
      if (data.ok) {
        toast.success(`Synced ${data.fields_updated} fields from calibration`);
        fetchProfile(); // Reload
      } else {
        toast.error(data.error || 'Sync failed');
      }
    } catch (e) {
      toast.error('Failed to sync from calibration');
    } finally { setSyncing(false); }
  };

  useEffect(() => {
    fetchProfile();
    fetchCalibrationStatus();
  }, []);

  const fetchCalibrationStatus = async () => {
    try {
      const res = await apiClient.get('/calibration/status');
      setCalibrationStatus(res.data?.status === 'COMPLETE' ? 'complete' : 'incomplete');
      console.log('[Settings] Calibration status from DB:', res.data?.status);
    } catch (e) {
      console.error('[Settings] Failed to fetch calibration status:', e);
      setCalibrationStatus('error');
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

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
          <Card className="mb-6">
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
                      {syncing ? <span className="text-xs text-[#FF6A00]" style={{ fontFamily: "monospace" }}>loading...</span> : <><RefreshCw className="w-3.5 h-3.5 mr-1" />Sync Profile</>}
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
                    {resettingCalibration ? <span className="text-xs text-[#FF6A00]" style={{ fontFamily: "monospace" }}>loading...</span> : 'Recalibrate'}
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
            <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full mb-8">
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
              <TabsTrigger value="billing" className="flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                <span className="hidden sm:inline">Billing</span>
              </TabsTrigger>
            </TabsList>

            {/* ACCOUNT TAB */}
            <TabsContent value="account">
              <Card>
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
                        style={{ background: 'var(--bg-tertiary)' }}
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
                          {saving ?  : <Save className="w-4 h-4 mr-1" />} Save
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t" style={{ borderColor: 'var(--border-light)' }}>
                    <h3 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Account Details</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center p-4 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                        <div>
                          <p className="font-medium" style={{ color: 'var(--text-primary)' }}>Account Type</p>
                          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Your current role</p>
                        </div>
                        <span className="badge badge-primary">
                          {user?.role || 'user'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center p-4 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                        <div>
                          <p className="font-medium" style={{ color: 'var(--text-primary)' }}>Member Since</p>
                          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Account creation date</p>
                        </div>
                        <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                          {user?.created_at ? new Date(user.created_at).toLocaleDateString() : '-'}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* PREFERENCES TAB */}
            <TabsContent value="preferences">
              <Card>
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
                      <div className="flex items-start space-x-3 p-4 rounded-lg border cursor-pointer hover:bg-gray-50" style={{ borderColor: 'var(--border-medium)' }}>
                        <RadioGroupItem value="concise" id="style-concise" className="mt-1" />
                        <Label htmlFor="style-concise" className="cursor-pointer flex-1">
                          <div className="font-medium" style={{ color: 'var(--text-primary)' }}>Quick & Concise</div>
                          <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Brief, actionable bullet points</div>
                        </Label>
                      </div>
                      <div className="flex items-start space-x-3 p-4 rounded-lg border cursor-pointer hover:bg-gray-50" style={{ borderColor: 'var(--border-medium)' }}>
                        <RadioGroupItem value="detailed" id="style-detailed" className="mt-1" />
                        <Label htmlFor="style-detailed" className="cursor-pointer flex-1">
                          <div className="font-medium" style={{ color: 'var(--text-primary)' }}>Detailed & Thorough</div>
                          <div className="text-sm" style={{ color: 'var(--text-muted)' }}>In-depth explanations with context and reasoning</div>
                        </Label>
                      </div>
                      <div className="flex items-start space-x-3 p-4 rounded-lg border cursor-pointer hover:bg-gray-50" style={{ borderColor: 'var(--border-medium)' }}>
                        <RadioGroupItem value="conversational" id="style-conversational" className="mt-1" />
                        <Label htmlFor="style-conversational" className="cursor-pointer flex-1">
                          <div className="font-medium" style={{ color: 'var(--text-primary)' }}>Conversational</div>
                          <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Like chatting with a trusted business partner</div>
                        </Label>
                      </div>
                      <div className="flex items-start space-x-3 p-4 rounded-lg border cursor-pointer hover:bg-gray-50" style={{ borderColor: 'var(--border-medium)' }}>
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
                            className="flex items-center gap-2 p-3 rounded-lg border cursor-pointer hover:bg-gray-50"
                            style={{ 
                              borderColor: isSelected ? 'var(--accent-primary)' : 'var(--border-medium)',
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
                      {saving ?  : <Save className="w-4 h-4 mr-2" />}
                      Save Preferences
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TOOLS TAB */}
            <TabsContent value="tools">
              <Card>
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
                            className="flex items-center gap-2 p-3 rounded-lg border cursor-pointer hover:bg-gray-50"
                            style={{ 
                              borderColor: isSelected ? 'var(--accent-primary)' : 'var(--border-medium)',
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
                      {saving ?  : <Save className="w-4 h-4 mr-2" />}
                      Save Tools
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* BILLING TAB */}
            <TabsContent value="billing">
              <Card>
                <CardHeader>
                  <CardTitle>Billing & Subscription</CardTitle>
                  <CardDescription>Manage your subscription and payment methods</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="p-6 rounded-lg border" style={{ borderColor: 'var(--border-medium)', background: 'var(--bg-tertiary)' }}>
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Current Plan</h3>
                          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Free Tier</p>
                        </div>
                        <span className="badge badge-primary">Active</span>
                      </div>
                      <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                        You&apos;re currently on the free plan. Upgrade to unlock advanced features and unlimited access.
                      </p>
                      <Button className="btn-primary">
                        Upgrade Plan
                      </Button>
                    </div>

                    <div className="pt-6 border-t" style={{ borderColor: 'var(--border-light)' }}>
                      <h3 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Payment Method</h3>
                      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                        No payment method on file
                      </p>
                    </div>

                    <div className="pt-6 border-t" style={{ borderColor: 'var(--border-light)' }}>
                      <h3 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Billing History</h3>
                      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                        No invoices available
                      </p>
                    </div>
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
