import { useState, useEffect, useRef, useCallback } from 'react';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Progress } from '../components/ui/progress';
import { 
  Building2, Users, Target, Briefcase, TrendingUp,
  Loader2, Save, CheckCircle, AlertCircle, Package
} from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { fontFamily } from '../design-system/tokens';
import { PageSkeleton } from '../components/ui/skeleton-loader';
import { toast } from 'sonner';
import { apiClient } from '../lib/api';
import { KpiThresholdTab } from '../components/business-dna/KpiThresholdTab';

const businessTypes = [
  'Sole Trader', 'Partnership', 'Company (Pty Ltd)', 'Company (Ltd)',
  'Trust', 'Incorporated Association', 'Co-operative', 'Not-for-profit',
  'Government', 'Other'
];

const businessModels = ['B2B', 'B2C', 'B2B2C', 'Hybrid'];
const pricingModels = ['Hourly', 'Project-based', 'Retainer', 'Subscription', 'One-time purchase', 'Usage-based', 'Tiered'];
const sectionResizeStyle = { resize: 'horizontal', overflow: 'auto', minWidth: '320px', maxWidth: '100%' };

const BusinessProfile = () => {
  const { user } = useSupabaseAuth();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState({});
  const [scores, setScores] = useState({ completeness: 0, strength: 0 });
  const [activeTab, setActiveTab] = useState('market');
  const [autoSaveStatus, setAutoSaveStatus] = useState(null); // null | 'saving' | 'saved' | 'error'
  const saveTimerRef = useRef(null);

  // DEFENSIVE: Get user subscription tier with fallbacks
  const userTier = user?.subscription_tier || 'free';
  const isMasterAccount = user?.is_master_account === true || user?.features?.all_access === true;
  const isPaidUser = isMasterAccount || !['free', 'trial'].includes(userTier.toLowerCase());
  const isEnterprise = isMasterAccount || userTier.toLowerCase() === 'enterprise';

  useEffect(() => {
    // DEFENSIVE: Only fetch if we have basic auth
    if (user?.id) {
      fetchProfile();
      fetchScores();
    } else {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 5000);
    return () => clearTimeout(safetyTimer);
  }, []);

  const fetchProfile = async () => {
    try {
      const profileRes = await apiClient.get('/business-profile/context', { timeout: 5000 });
      const ctx = profileRes.data || {};

      const rawProfile = ctx.profile || {};
      const resolvedFields = ctx.resolved_fields || {};

      // Merge: raw profile takes precedence, then resolved facts
      const merged = { ...rawProfile };
      for (const [field, factData] of Object.entries(resolvedFields)) {
        if (factData?.value && !merged[field]) {
          merged[field] = factData.value;
        }
      }

      setProfile(merged);
      setLoading(false);

      // Enrich from CRM integration data in the background so the page renders fast.
      const enrichFromIntegrations = async () => {
        try {
          const intRes = await apiClient.get('/integrations/merge/connected', { timeout: 8000 });
          const integrations = intRes?.data?.integrations || {};
          if (!(integrations.hubspot || integrations.salesforce)) return;

          const crmRes = await apiClient.get('/integrations/crm/company', { timeout: 8000 });
          const company = crmRes?.data || {};
          setProfile((prev) => ({
            ...prev,
            business_name: prev.business_name || company.name || prev.business_name,
            industry: prev.industry || company.industry || prev.industry,
            website: prev.website || company.website || prev.website,
            location: prev.location || company.city || prev.location,
          }));
        } catch {
          // Background enrichment is non-blocking.
        }
      };

      enrichFromIntegrations();
    } catch (error) {
      try {
        const snapshotRes = await apiClient.get('/snapshot/latest', { timeout: 5000 });
        const cognitiveProfile = snapshotRes?.data?.cognitive?.business_profile || {};
        setProfile((prev) => ({
          business_name: prev.business_name || user?.company_name || user?.business_name || '',
          industry: prev.industry || user?.industry || '',
          website: cognitiveProfile.website || prev.website || '',
          location: cognitiveProfile.location || prev.location || '',
          target_market: cognitiveProfile.target_market || prev.target_market || '',
          ...prev,
        }));
      } catch {
        setProfile((prev) => ({
          business_name: prev.business_name || user?.company_name || user?.business_name || '',
          industry: prev.industry || user?.industry || '',
          ...prev,
        }));
      }
      console.error('Failed to load profile:', error);
      toast.error('Business DNA loaded in fallback mode while profile data catches up.');
    } finally {
      setLoading(false);
    }
  };

  const fetchScores = async () => {
    try {
      const response = await apiClient.get('/business-profile/scores', { timeout: 5000 });
      setScores(response.data || { completeness: 0, strength: 0 });
    } catch {
      setScores({ completeness: 0, strength: 0 });
    }
  };

  const debouncedSave = useCallback((updatedProfile) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setAutoSaveStatus('saving');
    saveTimerRef.current = setTimeout(async () => {
      try {
        await apiClient.put('/business-profile', updatedProfile);
        setAutoSaveStatus('saved');
        fetchScores();
        setTimeout(() => setAutoSaveStatus(null), 2000);
      } catch (e) {
        setAutoSaveStatus('error');
        console.error('[BusinessDNA] Auto-save failed:', e);
      }
    }, 1500);
  }, []);

  const updateProfile = (field, value) => {
    setProfile(prev => {
      const updated = { ...prev, [field]: value };
      debouncedSave(updated);
      return updated;
    });
  };

  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});

  const handleSave = async () => {
    // Validate required fields
    const errors = {};
    if (!profile.unique_value_proposition?.trim()) errors.unique_value_proposition = 'Value proposition is required — this powers your AI recommendations';
    if (!profile.business_stage) errors.business_stage = 'Please select your business stage';
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      toast.error('Please fill in the required fields before saving');
      if (errors.unique_value_proposition) setActiveTab('product');
      else if (errors.business_stage) setActiveTab('strategy');
      return;
    }
    setValidationErrors({});
    setSaving(true);
    try {
      await apiClient.put('/business-profile', profile);
      toast.success('Business DNA saved — your AI agent has been updated with the latest profile.');
      fetchScores();
    } catch (e) {
      toast.error('Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-8 max-w-5xl mx-auto">
          <PageSkeleton cards={4} lines={6} />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
            <div>
              <div className="text-[11px] uppercase tracking-[0.08em] mb-2" style={{ fontFamily: fontFamily.mono, color: '#E85D00' }}>
                — Business DNA
              </div>
              <h1 className="font-medium mb-2" style={{ fontFamily: fontFamily.display, color: '#EDF1F7', fontSize: 'clamp(1.8rem, 3vw, 2.4rem)', letterSpacing: '-0.02em', lineHeight: 1.05 }}>
                How BIQc <em style={{ fontStyle: 'italic', color: '#E85D00' }}>sees you</em>.
              </h1>
              <p className="text-sm" style={{ fontFamily: fontFamily.body, color: '#8FA0B8' }}>
                This is the working profile every signal, alert, and brief is calibrated against. The more BIQc learns from your inbox and tools, the sharper this gets.
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
              {autoSaveStatus === 'saving' && <><span className="text-xs" style={{ color: '#E85D00' }}>saving...</span></>}
              {autoSaveStatus === 'saved' && <><CheckCircle className="w-4 h-4 text-emerald-500" /> Saved</>}
              {autoSaveStatus === 'error' && <><AlertCircle className="w-4 h-4 text-red-500" /> Save failed</>}
              {!autoSaveStatus && <span className="text-xs">Auto-saves as you type</span>}
            </div>
          </div>

          {/* DNA Hero Card */}
          <div className="mb-6 rounded-xl overflow-hidden" style={{ background: 'linear-gradient(160deg, #111827, #1A1A2E)', position: 'relative' }}>
            {/* Lava accent line */}
            <div style={{ height: 3, background: 'linear-gradient(90deg, #E85D00, #FF7A1A, #E85D00)', width: '100%' }} />
            <div className="p-6 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold" style={{ fontFamily: fontFamily.display, color: '#EDF1F7' }}>
                  {profile.business_name || user?.company_name || user?.business_name || 'Your Business'}
                </h2>
                <p className="text-sm mt-1" style={{ fontFamily: fontFamily.body, color: '#8FA0B8' }}>
                  Business DNA Profile
                </p>
              </div>
              {/* Completion ring gauge */}
              <div className="flex flex-col items-center">
                <svg width="48" height="48" viewBox="0 0 48 48">
                  <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(140,170,210,0.12)" strokeWidth="4" />
                  <circle cx="24" cy="24" r="20" fill="none" stroke="#E85D00" strokeWidth="4"
                    strokeDasharray={`${2 * Math.PI * 20}`}
                    strokeDashoffset={`${2 * Math.PI * 20 * (1 - (scores.completeness || 0) / 100)}`}
                    strokeLinecap="round" transform="rotate(-90 24 24)"
                    style={{ transition: 'stroke-dashoffset 0.8s ease-out' }} />
                  <text x="24" y="26" textAnchor="middle" style={{ fill: '#EDF1F7', fontSize: '11px', fontFamily: fontFamily.mono, fontWeight: 700 }}>
                    {scores.completeness || 0}%
                  </text>
                </svg>
                <span className="text-[10px] mt-1" style={{ color: '#8FA0B8', fontFamily: fontFamily.mono }}>Complete</span>
              </div>
            </div>
          </div>

          {/* Tabs — Live Baselines only (admin fields moved to Settings) */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-2 sm:grid-cols-5 w-full mb-8">
              <TabsTrigger value="market" className="flex items-center gap-2">
                <Target className="w-4 h-4" />
                <span className="hidden sm:inline">Market</span>
              </TabsTrigger>
              <TabsTrigger value="product" className="flex items-center gap-2">
                <Package className="w-4 h-4" />
                <span className="hidden sm:inline">Product</span>
              </TabsTrigger>
              <TabsTrigger value="team" className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline">Team</span>
              </TabsTrigger>
              <TabsTrigger value="strategy" className="flex items-center gap-2">
                <Briefcase className="w-4 h-4" />
                <span className="hidden sm:inline">Strategy</span>
              </TabsTrigger>
              <TabsTrigger value="kpis" className="flex items-center gap-2" data-testid="business-dna-kpi-tab-trigger">
                <TrendingUp className="w-4 h-4" />
                <span className="hidden sm:inline">KPIs</span>
              </TabsTrigger>
            </TabsList>

            {/* MARKET TAB */}
            <TabsContent value="market">
              <Card style={sectionResizeStyle}>
                <CardHeader>
                  <CardTitle>Market & Customers</CardTitle>
                  <CardDescription>Understanding your market helps us tailor recommendations</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <Label>Target Market</Label>
                    <Textarea
                      value={profile.target_market || ''}
                      onChange={(e) => updateProfile('target_market', e.target.value)}
                      placeholder="Describe your target market (demographics, psychographics, pain points)..."
                      rows={4}
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label>Ideal Customer Profile</Label>
                    <Textarea
                      value={profile.ideal_customer_profile || ''}
                      onChange={(e) => updateProfile('ideal_customer_profile', e.target.value)}
                      placeholder="Describe your perfect customer - who are they, what do they need, why do they buy from you?"
                      rows={4}
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label>Market Position</Label>
                    <Textarea
                      value={profile.market_position || ''}
                      onChange={(e) => updateProfile('market_position', e.target.value)}
                      placeholder="How your business is currently positioned in the market..."
                      rows={3}
                      className="mt-2"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label>Business Model</Label>
                      <Select value={profile.business_model || ''} onValueChange={(val) => updateProfile('business_model', val)}>
                        <SelectTrigger className="mt-2">
                          <SelectValue placeholder="Select model" />
                        </SelectTrigger>
                        <SelectContent>
                          {businessModels.map(model => (
                            <SelectItem key={model} value={model}>{model}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Geographic Focus</Label>
                      <Input
                        value={profile.geographic_focus || ''}
                        onChange={(e) => updateProfile('geographic_focus', e.target.value)}
                        placeholder="Local, Regional, National, Global"
                        className="mt-2"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label>Customer Count</Label>
                      <Input
                        value={profile.customer_count || ''}
                        onChange={(e) => updateProfile('customer_count', e.target.value)}
                        placeholder="e.g., < 10, 10-50, 100+"
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <Label>Revenue Range</Label>
                      <Input
                        value={profile.revenue_range || ''}
                        onChange={(e) => updateProfile('revenue_range', e.target.value)}
                        placeholder="e.g., $100K - $500K"
                        className="mt-2"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* PRODUCT TAB */}
            <TabsContent value="product">
              <Card style={sectionResizeStyle}>
                <CardHeader>
                  <CardTitle>Products & Services</CardTitle>
                  <CardDescription>What you offer and why customers choose you</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <Label>Main Products/Services</Label>
                    <Textarea
                      value={profile.main_products_services || ''}
                      onChange={(e) => updateProfile('main_products_services', e.target.value)}
                      placeholder="List and describe your main products or services..."
                      rows={4}
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label>Unique Value Proposition <span style={{ color: '#EF4444' }}>*</span></Label>
                    <Textarea
                      value={profile.unique_value_proposition || ''}
                      onChange={(e) => { updateProfile('unique_value_proposition', e.target.value); if (validationErrors.unique_value_proposition) setValidationErrors(v => ({...v, unique_value_proposition: null})); }}
                      placeholder="What makes your offering unique? Why should customers choose you over alternatives? e.g. 'We are the only HR firm in Victoria that specialises in construction SMBs.'"
                      rows={4}
                      className="mt-2"
                      style={validationErrors.unique_value_proposition ? { borderColor: '#EF4444' } : {}}
                    />
                    {validationErrors.unique_value_proposition && (
                      <p className="text-xs mt-1" style={{ color: '#EF4444' }}>{validationErrors.unique_value_proposition}</p>
                    )}
                  </div>

                  <div>
                    <Label>Competitive Advantages</Label>
                    <Textarea
                      value={profile.competitive_advantages || ''}
                      onChange={(e) => updateProfile('competitive_advantages', e.target.value)}
                      placeholder="What do you do better than your competitors? What's your moat?"
                      rows={3}
                      className="mt-2"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label>Pricing Model</Label>
                      <Select value={profile.pricing_model || ''} onValueChange={(val) => updateProfile('pricing_model', val)}>
                        <SelectTrigger className="mt-2">
                          <SelectValue placeholder="Select model" />
                        </SelectTrigger>
                        <SelectContent>
                          {pricingModels.map(model => (
                            <SelectItem key={model} value={model}>{model}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Sales Cycle Length</Label>
                      <Input
                        value={profile.sales_cycle_length || ''}
                        onChange={(e) => updateProfile('sales_cycle_length', e.target.value)}
                        placeholder="e.g., 2-4 weeks, 3 months"
                        className="mt-2"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TEAM TAB */}
            <TabsContent value="team">
              <Card style={sectionResizeStyle}>
                <CardHeader>
                  <CardTitle>Team & Leadership</CardTitle>
                  <CardDescription>Your people and organizational structure</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label>Team Size</Label>
                      <Input
                        value={profile.team_size || ''}
                        onChange={(e) => updateProfile('team_size', e.target.value)}
                        placeholder="e.g., Just me, 2-5, 10-25"
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <Label>Hiring Status</Label>
                      <Input
                        value={profile.hiring_status || ''}
                        onChange={(e) => updateProfile('hiring_status', e.target.value)}
                        placeholder="Actively hiring, Planning, Not now"
                        className="mt-2"
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Founder Background</Label>
                    <Textarea
                      value={profile.founder_background || ''}
                      onChange={(e) => updateProfile('founder_background', e.target.value)}
                      placeholder="Your experience, expertise, and what you bring to the business..."
                      rows={3}
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label>Key Team Members</Label>
                    <Textarea
                      value={profile.key_team_members || ''}
                      onChange={(e) => updateProfile('key_team_members', e.target.value)}
                      placeholder="Who are your key team members and what do they do?"
                      rows={3}
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label>Team Strengths</Label>
                    <Textarea
                      value={profile.team_strengths || ''}
                      onChange={(e) => updateProfile('team_strengths', e.target.value)}
                      placeholder="What are your team's core strengths and capabilities?"
                      rows={3}
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label>Team Gaps</Label>
                    <Textarea
                      value={profile.team_gaps || ''}
                      onChange={(e) => updateProfile('team_gaps', e.target.value)}
                      placeholder="What skills or roles are you missing?"
                      rows={2}
                      className="mt-2"
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* STRATEGY TAB */}
            <TabsContent value="strategy">
              <Card style={sectionResizeStyle}>
                <CardHeader>
                  <CardTitle>Strategy & Vision</CardTitle>
                  <CardDescription>Where you're going and how you'll get there — used to personalise your AI agent's recommendations</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">

                  {/* Business Stage, Growth Goals, Risk Profile — implemented dropdowns */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label>Business Stage <span style={{ color: '#EF4444' }}>*</span></Label>
                      <Select value={profile.business_stage || ''} onValueChange={(val) => updateProfile('business_stage', val)}>
                        <SelectTrigger className="mt-2">
                          <SelectValue placeholder="Select stage" />
                        </SelectTrigger>
                        <SelectContent>
                          {['Pre-revenue / Idea', 'Startup (0-2 years)', 'Early Growth (2-5 years)', 'Growth (5-10 years)', 'Established (10+ years)', 'Scaling / Expansion', 'Mature / Optimising', 'Exit / Succession'].map(s => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Primary Growth Goal <span style={{ color: '#EF4444' }}>*</span></Label>
                      <Select value={profile.growth_goal || ''} onValueChange={(val) => updateProfile('growth_goal', val)}>
                        <SelectTrigger className="mt-2">
                          <SelectValue placeholder="Select goal" />
                        </SelectTrigger>
                        <SelectContent>
                          {['Revenue growth', 'Market expansion', 'New product launch', 'Geographic expansion', 'Client retention', 'Team growth', 'Profit margin improvement', 'Acquisition preparation', 'Digital transformation', 'Operational efficiency'].map(g => (
                            <SelectItem key={g} value={g}>{g}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Risk Profile <span style={{ color: '#EF4444' }}>*</span></Label>
                      <Select value={profile.risk_profile || ''} onValueChange={(val) => updateProfile('risk_profile', val)}>
                        <SelectTrigger className="mt-2">
                          <SelectValue placeholder="Select profile" />
                        </SelectTrigger>
                        <SelectContent>
                          {['Very conservative — protect what we have', 'Conservative — small calculated risks', 'Moderate — balanced growth and protection', 'Growth-focused — accept higher risk for growth', 'Aggressive — maximum growth over stability'].map(r => (
                            <SelectItem key={r} value={r}>{r}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>Mission Statement</Label>
                    <Textarea
                      value={profile.mission_statement || ''}
                      onChange={(e) => updateProfile('mission_statement', e.target.value)}
                      placeholder="Why does your business exist? What problem do you solve?"
                      rows={3}
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label>Vision Statement</Label>
                    <Textarea
                      value={profile.vision_statement || ''}
                      onChange={(e) => updateProfile('vision_statement', e.target.value)}
                      placeholder="What does success look like in 5-10 years?"
                      rows={3}
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label>Short-term Goals (6-12 months)</Label>
                    <Textarea
                      value={profile.short_term_goals || ''}
                      onChange={(e) => updateProfile('short_term_goals', e.target.value)}
                      placeholder="What do you want to achieve in the next year?"
                      rows={3}
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label>Long-term Goals (2-5 years)</Label>
                    <Textarea
                      value={profile.long_term_goals || ''}
                      onChange={(e) => updateProfile('long_term_goals', e.target.value)}
                      placeholder="Where do you see the business in 2-5 years?"
                      rows={3}
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label>Main Challenges</Label>
                    <Textarea
                      value={profile.main_challenges || profile.growth_challenge || ''}
                      onChange={(e) => updateProfile('main_challenges', e.target.value)}
                      placeholder="What are your biggest obstacles or pain points right now?"
                      rows={3}
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label>Growth Strategy</Label>
                    <Textarea
                      value={profile.growth_strategy || ''}
                      onChange={(e) => updateProfile('growth_strategy', e.target.value)}
                      placeholder="How do you plan to grow? New markets, products, partnerships?"
                      rows={3}
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label>Competitor Intelligence & SWOT Notes</Label>
                    <Textarea
                      value={profile.competitor_scan_result || ''}
                      onChange={(e) => updateProfile('competitor_scan_result', e.target.value)}
                      placeholder="Stored competitor analysis, SWOT, and channel diagnostics from calibration scan..."
                      rows={6}
                      className="mt-2"
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="kpis">
              <KpiThresholdTab />
            </TabsContent>
          </Tabs>

          {/* Save Button at Bottom */}
          {activeTab !== 'kpis' && (
            <div className="mt-8 flex justify-end" data-testid="business-dna-save-profile-wrapper">
              <Button onClick={handleSave} className="btn-primary" disabled={saving} data-testid="business-dna-save-profile-button">
                {saving ? null : <Save className="w-4 h-4 mr-2" />}
                Save Profile
              </Button>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default BusinessProfile;
/* Cache bust: 1769204044 */
