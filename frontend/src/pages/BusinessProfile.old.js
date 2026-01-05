import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Progress } from '../components/ui/progress';
import { Badge } from '../components/ui/badge';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';

import { 
  Building2, Users, Target, Briefcase, TrendingUp, Settings2,
  Loader2, Save, CheckCircle, AlertCircle, Lightbulb, DollarSign,
  Globe, Heart, Rocket, Brain
} from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { toast } from 'sonner';
import { apiClient } from '../lib/api';

const anzsicDivisions = [
  { code: 'A', label: 'A — Agriculture, Forestry and Fishing' },
  { code: 'B', label: 'B — Mining' },
  { code: 'C', label: 'C — Manufacturing' },
  { code: 'D', label: 'D — Electricity, Gas, Water and Waste Services' },
  { code: 'E', label: 'E — Construction' },
  { code: 'F', label: 'F — Wholesale Trade' },
  { code: 'G', label: 'G — Retail Trade' },
  { code: 'H', label: 'H — Accommodation and Food Services' },
  { code: 'I', label: 'I — Transport, Postal and Warehousing' },
  { code: 'J', label: 'J — Information Media and Telecommunications' },
  { code: 'K', label: 'K — Financial and Insurance Services' },
  { code: 'L', label: 'L — Rental, Hiring and Real Estate Services' },
  { code: 'M', label: 'M — Professional, Scientific and Technical Services' },
  { code: 'N', label: 'N — Administrative and Support Services' },
  { code: 'O', label: 'O — Public Administration and Safety' },
  { code: 'P', label: 'P — Education and Training' },
  { code: 'Q', label: 'Q — Health Care and Social Assistance' },
  { code: 'R', label: 'R — Arts and Recreation Services' },
  { code: 'S', label: 'S — Other Services' },
  { code: 'OTHER', label: 'Other / Not sure' },
];

const auBusinessTypes = [
  'Sole Trader',
  'Partnership',
  'Company (Pty Ltd)',
  'Company (Ltd)',
  'Trust',
  'Incorporated Association',
  'Co-operative',
  'Not-for-profit',
  'Government',
  'Other'
];
const employeeCounts = ['Just me', '2-5', '6-10', '11-25', '26-50', '51-100', '101-250', '250+'];
const revenueRanges = ['Pre-revenue', '< $50K', '$50K - $100K', '$100K - $250K', '$250K - $500K', '$500K - $1M', '$1M - $2.5M', '$2.5M - $5M', '$5M - $10M', '$10M+'];
const fundingStages = ['Bootstrapped', 'Friends & Family', 'Angel', 'Seed', 'Series A', 'Series B+', 'Profitable'];
const businessModels = ['B2B', 'B2C', 'B2B2C', 'Marketplace', 'SaaS', 'Subscription', 'Freemium', 'Agency/Services'];
const pricingModels = ['Hourly', 'Project-based', 'Retainer', 'Subscription', 'One-time purchase', 'Freemium', 'Usage-based', 'Tiered'];
const communicationStyles = ['Direct & Concise', 'Detailed & Thorough', 'Visual & Examples', 'Data-driven', 'Conversational'];
const decisionStyles = ['Data-driven', 'Intuitive', 'Collaborative', 'Quick & Decisive', 'Careful & Deliberate'];
const riskTolerances = ['Conservative', 'Moderate', 'Aggressive', 'Calculated Risk-taker'];
const timeAvailabilities = ['< 2 hours/week', '2-5 hours/week', '5-10 hours/week', '10-20 hours/week', '20+ hours/week'];
const adviceFormats = ['Action items & checklists', 'Detailed analysis', 'Strategic discussion', 'Quick tips', 'Step-by-step guides'];

const acquisitionChannels = [
  'Organic Search (SEO)', 'Paid Ads (Google/Meta)', 'Social Media', 'Content Marketing',
  'Email Marketing', 'Referrals', 'Networking', 'Cold Outreach', 'Partnerships',
  'Events & Trade Shows', 'PR & Media', 'Affiliate Marketing'
];

const crmSystems = ['None', 'HubSpot', 'Salesforce', 'Zoho CRM', 'Pipedrive', 'Monday.com', 'Notion', 'Airtable', 'Custom/Other'];
const accountingSystems = ['None', 'QuickBooks', 'Xero', 'FreshBooks', 'Wave', 'Sage', 'NetSuite', 'Custom/Other'];
const pmTools = ['None', 'Asana', 'Monday.com', 'Trello', 'ClickUp', 'Notion', 'Jira', 'Basecamp', 'Custom/Other'];

const retentionRanges = ['<20%', '20-40%', '40-60%', '60-80%', '>80%'];

const BusinessProfile = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({});
  const [completeness, setCompleteness] = useState(0);
  const [activeTab, setActiveTab] = useState('basics');

  // Quick Setup / Autofill
  const [quickSetup, setQuickSetup] = useState({ business_name: '', abn: '', website_url: '' });
  const [files, setFiles] = useState([]);
  const [selectedFileIds, setSelectedFileIds] = useState([]);
  const [autofillLoading, setAutofillLoading] = useState(false);
  const [buildLoading, setBuildLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [missingFields, setMissingFields] = useState([]);

  useEffect(() => {
    fetchProfile();
    fetchFiles();
  }, []);

  const fetchProfile = async () => {
    try {
      const [profileRes, statsRes] = await Promise.all([
        apiClient.get(`/business-profile`),
        apiClient.get(`/data-center/stats`)
      ]);
      setProfile(profileRes.data);
      setCompleteness(statsRes.data.profile_completeness || 0);
    } catch (error) {
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const fetchFiles = async () => {
    try {
      const res = await apiClient.get('/data-center/files');
      setFiles(res.data || []);
    } catch (e) {
      // non-blocking
    }
  };

  const buildBusinessProfile = async () => {
    setBuildLoading(true);
    try {
      const res = await apiClient.post('/business-profile/build', {
        business_name: quickSetup.business_name || profile.business_name,
        abn: quickSetup.abn || profile.abn,
        website_url: quickSetup.website_url || profile.website,
      });

      const patch = res.data?.patch || {};
      setMissingFields(res.data?.missing_fields || []);
      setProfile((p) => ({ ...p, ...patch }));

      toast.success('Business profile built from web + your workspace');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Build Business Profile failed');
    } finally {
      setBuildLoading(false);
    }
  };

  const runAutofill = async () => {
    setAutofillLoading(true);
    try {
      const res = await apiClient.post('/business-profile/autofill', {
        business_name: quickSetup.business_name || profile.business_name,
        abn: quickSetup.abn || profile.abn,
        website_url: quickSetup.website_url || profile.website,
        data_file_ids: selectedFileIds,
      });

      const patch = res.data?.patch || {};
      setMissingFields(res.data?.missing_fields || []);
      setProfile((p) => ({ ...p, ...patch }));

      toast.success('Profile updated from your sources');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Autofill failed');
    } finally {
      setAutofillLoading(false);
    }
  };

  const uploadQuickFiles = async (fileList) => {
    if (!fileList?.length) return;
    setUploading(true);
    try {
      // Upload each file (small count). Data Centre already does text extraction.
      for (const file of Array.from(fileList).slice(0, 3)) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('category', 'Business Profile');
        formData.append('description', 'Quick setup upload');
        await apiClient.post('/data-center/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
      toast.success('Uploaded. You can now run Auto-Fill.');
      await fetchFiles();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiClient.put(`/business-profile`, profile);
      toast.success('Profile saved successfully!');
      fetchProfile();
    } catch (error) {
      toast.error('Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const isMissing = (field) => missingFields?.includes(field);

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
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-[#0f2f24]" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-8" data-testid="business-profile-page">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-8">
            <div>
              <p className="overline text-[#0f2f24]/60 mb-2">Your Business DNA</p>
              <h1 className="text-3xl md:text-4xl font-serif text-[#0f2f24]">Business Profile</h1>
              <p className="text-[#0f2f24]/60 mt-2">
                The more we know, the better your AI advisor becomes
              </p>
            </div>
            <Button onClick={handleSave} className="btn-primary" disabled={saving} data-testid="save-profile-btn">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Profile
            </Button>
          </div>

          {/* Progress Card */}
          <Card className="card-clean mb-8" style={{ background: 'linear-gradient(90deg, rgba(29,78,216,0.12), rgba(17,24,39,0.08))' }}>
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {completeness >= 80 ? (
                      <CheckCircle className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
                    ) : (
                      <AlertCircle className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
                    )}
                    <span className="font-medium">Profile Completeness</span>
                  </div>
                  <Progress value={completeness} className="h-3" />
                  <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
                    {completeness < 50 && "Complete your profile to unlock personalized AI insights"}
                    {completeness >= 50 && completeness < 80 && "Good progress! Add more details for better recommendations"}
                    {completeness >= 80 && "Excellent! Your AI advisor is fully personalized"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-4xl font-serif" style={{ color: 'var(--accent-primary)' }}>{completeness}%</p>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Complete</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Setup / Autofill */}
          <Card className="card-clean mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
                Quick Setup
              </CardTitle>
              <CardDescription>
                Upload docs or add your website and we&apos;ll pre-fill what we can. Anything missing will be highlighted.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {missingFields?.length ? (
                <div className="p-4 rounded-xl border" style={{ borderColor: 'rgba(255, 149, 0, 0.25)', background: 'rgba(255, 149, 0, 0.06)' }}>
                  <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Missing essentials</div>
                  <div className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
                    {missingFields.map((f) => (
                      <span key={f} className="inline-flex mr-2 mt-2 px-2 py-1 rounded-full" style={{ background: 'rgba(255, 149, 0, 0.12)', color: 'var(--accent-warning)' }}>
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Business name</Label>
                  <Input
                    value={quickSetup.business_name}
                    onChange={(e) => setQuickSetup((s) => ({ ...s, business_name: e.target.value }))}
                    placeholder="e.g., Acme Pty Ltd"
                  />
                </div>
                <div className="space-y-2">
                  <Label>ABN (optional)</Label>
                  <Input
                    value={quickSetup.abn}
                    onChange={(e) => setQuickSetup((s) => ({ ...s, abn: e.target.value }))}
                    placeholder="11 111 111 111"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Website URL (optional)</Label>
                  <Input
                    value={quickSetup.website_url}
                    onChange={(e) => setQuickSetup((s) => ({ ...s, website_url: e.target.value }))}
                    placeholder="https://yourcompany.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Use uploaded documents (Data Centre)</Label>
                  <div className="p-4 rounded-xl border" style={{ borderColor: 'var(--border-light)', background: 'var(--bg-tertiary)' }}>
                    <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      Select up to 3 documents to extract business details.
                    </div>
                    <div className="mt-3 space-y-2">
                      {(files || []).slice(0, 8).map((f) => {
                        const checked = selectedFileIds.includes(f.id);
                        return (
                          <label key={f.id} className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={!checked && selectedFileIds.length >= 3}
                              onChange={() => {
                                setSelectedFileIds((prev) => {
                                  if (prev.includes(f.id)) return prev.filter((x) => x !== f.id);
                                  if (prev.length >= 3) return prev;
                                  return [...prev, f.id];
                                });
                              }}
                            />
                            <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{f.filename}</span>
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{f.category}</span>
                          </label>
                        );
                      })}
                      {!files?.length ? (
                        <div className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>
                          No documents found yet. Upload files in Data Centre first.
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Autofill</Label>
                  <div className="p-4 rounded-xl border" style={{ borderColor: 'var(--border-light)', background: 'var(--bg-tertiary)' }}>
                    <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      Build Business Profile uses AU web search + website scrape + your workspace to prefill as much as possible.
                    </div>
                    <div className="mt-4 flex items-center gap-3 flex-wrap">
                      <Button className="btn-primary" onClick={buildBusinessProfile} disabled={buildLoading}>
                        {buildLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                        Build Business Profile
                      </Button>
                      <Button className="btn-secondary" onClick={runAutofill} disabled={autofillLoading}>
                        {autofillLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                        Auto-fill from docs & website
                      </Button>
                      <Button className="btn-secondary" onClick={() => (window.location.href = '/data-center')}>Upload documents</Button>
                      <div>
                        <input
                          type="file"
                          multiple
                          className="text-sm"
                          onChange={(e) => uploadQuickFiles(e.target.files)}
                        />
                        {uploading ? (
                          <div className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>Uploading…</div>
                        ) : (
                          <div className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>Upload up to 3 files. We’ll extract what we can.</div>
                        )}
                      </div>

                    </div>
                    <div className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
                      Tip: after autofill, hit Save Profile.
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>


          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-[#f5f5f0] p-1 mb-6 flex-wrap h-auto gap-1">
              <TabsTrigger value="basics" className="data-[state=active]:bg-white">
                <Building2 className="w-4 h-4 mr-2" /> Basics
              </TabsTrigger>
              <TabsTrigger value="market" className="data-[state=active]:bg-white">
                <Target className="w-4 h-4 mr-2" /> Market
              </TabsTrigger>
              <TabsTrigger value="product" className="data-[state=active]:bg-white">
                <Briefcase className="w-4 h-4 mr-2" /> Product
              </TabsTrigger>
              <TabsTrigger value="team" className="data-[state=active]:bg-white">
                <Users className="w-4 h-4 mr-2" /> Team
              </TabsTrigger>
              <TabsTrigger value="strategy" className="data-[state=active]:bg-white">
                <Rocket className="w-4 h-4 mr-2" /> Strategy
              </TabsTrigger>
              <TabsTrigger value="preferences" className="data-[state=active]:bg-white">
                <Brain className="w-4 h-4 mr-2" /> Preferences
              </TabsTrigger>
              <TabsTrigger value="tools" className="data-[state=active]:bg-white">
                <Settings2 className="w-4 h-4 mr-2" /> Tools
              </TabsTrigger>
            </TabsList>

            {/* BASICS TAB */}
            <TabsContent value="basics">
              <Card className="card-clean">
                <CardHeader>
                  <CardTitle className="font-serif flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-[#ccff00]" />
                    Business Basics
                  </CardTitle>
                  <CardDescription>Core information about your business</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>Business Name *</Label>
                      <Input
                        value={profile.business_name || ''}
                        onChange={(e) => updateProfile('business_name', e.target.value)}
                        placeholder="Your Company Pty Ltd"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>
                        Industry (ANZSIC) *
                        {isMissing('industry') ? (
                          <span className="ml-2 text-xs" style={{ color: 'var(--accent-warning)' }}>(missing)</span>
                        ) : null}
                      </Label>
                      <Select value={profile.industry || ''} onValueChange={(v) => updateProfile('industry', v)}>
                        <SelectTrigger style={isMissing('industry') ? { borderColor: 'rgba(245, 158, 11, 0.5)' } : undefined}><SelectValue placeholder="Select industry" /></SelectTrigger>
                        <SelectContent className="bg-white">
                          {anzsicDivisions.map(i => (
                            <SelectItem key={i.code} value={i.code}>{i.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Target Country</Label>
                      <Select value={profile.target_country || 'Australia'} onValueChange={(v) => updateProfile('target_country', v)}>
                        <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
                        <SelectContent className="bg-white">
                          <SelectItem value="Australia">Australia</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>
                        Business Type
                        {isMissing('business_type') ? (
                          <span className="ml-2 text-xs" style={{ color: 'var(--accent-warning)' }}>(missing)</span>
                        ) : null}
                      </Label>
                      <Select value={profile.business_type || ''} onValueChange={(v) => updateProfile('business_type', v)}>
                        <SelectTrigger style={isMissing('business_type') ? { borderColor: 'rgba(245, 158, 11, 0.5)' } : undefined}><SelectValue placeholder="Select type" /></SelectTrigger>
                        <SelectContent className="bg-white">
                          {auBusinessTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Year Founded</Label>
                      <Input
                        type="number"
                        value={profile.year_founded || ''}
                        onChange={(e) => updateProfile('year_founded', parseInt(e.target.value) || null)}
                        placeholder="2020"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Location</Label>
                      <Input
                        value={profile.location || ''}
                        onChange={(e) => updateProfile('location', e.target.value)}
                        placeholder="City, State/Country"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Website</Label>
                      <Input
                        value={profile.website || ''}
                        onChange={(e) => updateProfile('website', e.target.value)}
                        placeholder="https://yourcompany.com"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>ABN</Label>
                      <Input
                        value={profile.abn || ''}
                        onChange={(e) => updateProfile('abn', e.target.value)}
                        placeholder="11 111 111 111"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>ACN</Label>
                      <Input
                        value={profile.acn || ''}
                        onChange={(e) => updateProfile('acn', e.target.value)}
                        placeholder="111 111 111"
                      />
                    </div>
                  </div>

                  <div className="border-t pt-6">
                    <h4 className="font-medium mb-4 flex items-center gap-2">
                      <DollarSign className="w-4 h-4" /> Size & Financials
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <Label>Employee Count</Label>
                        <Select value={profile.employee_count || ''} onValueChange={(v) => updateProfile('employee_count', v)}>
                          <SelectTrigger><SelectValue placeholder="Select range" /></SelectTrigger>
                          <SelectContent className="bg-white">
                            {employeeCounts.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Annual Revenue</Label>
                        <Select value={profile.annual_revenue || ''} onValueChange={(v) => updateProfile('annual_revenue', v)}>
                          <SelectTrigger><SelectValue placeholder="Select range" /></SelectTrigger>
                          <SelectContent className="bg-white">
                            {revenueRanges.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Funding Stage</Label>
                        <Select value={profile.funding_stage || ''} onValueChange={(v) => updateProfile('funding_stage', v)}>
                          <SelectTrigger><SelectValue placeholder="Select stage" /></SelectTrigger>
                          <SelectContent className="bg-white">
                            {fundingStages.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* MARKET TAB */}
            <TabsContent value="market">
              <Card className="card-clean">
                <CardHeader>
                  <CardTitle className="font-serif flex items-center gap-2">
                    <Target className="w-5 h-5 text-[#ccff00]" />
                    Market & Customers
                  </CardTitle>
                  <CardDescription>Understanding your market helps us tailor recommendations</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label>Target Market *</Label>
                    <Textarea
                      value={profile.target_market || ''}
                      onChange={(e) => updateProfile('target_market', e.target.value)}
                      placeholder="Describe your target market (demographics, psychographics, pain points)..."
                      className="min-h-[100px]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Ideal Customer Profile *</Label>
                    <Textarea
                      value={profile.ideal_customer_profile || ''}
                      onChange={(e) => updateProfile('ideal_customer_profile', e.target.value)}
                      placeholder="Describe your perfect customer - who are they, what do they need, why do they buy from you?"
                      className="min-h-[100px]"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>Geographic Focus</Label>
                      <Input
                        value={profile.geographic_focus || ''}
                        onChange={(e) => updateProfile('geographic_focus', e.target.value)}
                        placeholder="Local, Regional, National, Global..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Business Model</Label>
                      <Select value={profile.business_model || ''} onValueChange={(v) => updateProfile('business_model', v)}>
                        <SelectTrigger><SelectValue placeholder="Select model" /></SelectTrigger>
                        <SelectContent className="bg-white">
                          {businessModels.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label>Customer Acquisition Channels (select all that apply)</Label>
                    <div className="flex flex-wrap gap-2">
                      {acquisitionChannels.map(channel => (
                        <Badge
                          key={channel}
                          variant={profile.customer_acquisition_channels?.includes(channel) ? 'default' : 'outline'}
                          className={`cursor-pointer transition-colors ${
                            profile.customer_acquisition_channels?.includes(channel)
                              ? 'bg-[#ccff00] text-[#0f2f24] hover:bg-[#b8e600]'
                              : 'hover:bg-[#0f2f24]/5'
                          }`}
                          onClick={() => toggleArrayItem('customer_acquisition_channels', channel)}
                        >
                          {channel}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>Average Customer Lifetime Value</Label>
                      <Input
                        value={profile.average_customer_value || ''}
                        onChange={(e) => updateProfile('average_customer_value', e.target.value)}
                        placeholder="e.g., $5,000"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>
                        Customer Retention
                        {isMissing('retention_known') ? (
                          <span className="ml-2 text-xs" style={{ color: 'var(--accent-warning)' }}>(missing)</span>
                        ) : null}
                      </Label>
                      <div className="p-4 rounded-xl border" style={{ borderColor: isMissing('retention_known') ? 'rgba(245, 158, 11, 0.5)' : 'var(--border-light)', background: 'var(--bg-tertiary)' }}>
                        <RadioGroup
                          value={profile.retention_known === true ? 'known' : profile.retention_known === false ? 'unknown' : ''}
                          onValueChange={(v) => {
                            if (v === 'known') {
                              updateProfile('retention_known', true);
                            } else if (v === 'unknown') {
                              updateProfile('retention_known', false);
                              updateProfile('retention_rate_range', null);
                              updateProfile('customer_retention_rate', null);
                            }
                          }}
                          className="grid gap-3"
                        >
                          <div className="flex items-center gap-3">
                            <RadioGroupItem value="unknown" id="retention_unknown" />
                            <Label htmlFor="retention_unknown" className="cursor-pointer">Unknown</Label>
                          </div>
                          <div className="flex items-center gap-3">
                            <RadioGroupItem value="known" id="retention_known" />
                            <Label htmlFor="retention_known" className="cursor-pointer">Known</Label>
                          </div>
                        </RadioGroup>

                        {profile.retention_known === true && (
                          <div className="mt-4 space-y-2">
                            <Label>Retention rate (approx.)</Label>
                            <Select
                              value={profile.retention_rate_range || ''}
                              onValueChange={(v) => {
                                updateProfile('retention_rate_range', v);
                                updateProfile('customer_retention_rate', v);
                              }}
                            >
                              <SelectTrigger><SelectValue placeholder="Select range" /></SelectTrigger>
                              <SelectContent className="bg-white">
                                {retentionRanges.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            {profile.retention_rag && (
                              <div className="flex items-center gap-2 text-sm">
                                <span
                                  className="inline-flex items-center gap-2 px-2 py-1 rounded-full"
                                  style={{
                                    background:
                                      profile.retention_rag === 'green'
                                        ? 'rgba(0, 200, 83, 0.12)'
                                        : profile.retention_rag === 'amber'
                                          ? 'rgba(255, 149, 0, 0.12)'
                                          : 'rgba(255, 59, 48, 0.12)',
                                    color:
                                      profile.retention_rag === 'green'
                                        ? 'var(--accent-success)'
                                        : profile.retention_rag === 'amber'
                                          ? 'var(--accent-warning)'
                                          : 'var(--accent-danger)'
                                  }}
                                >
                                  <span className="w-2 h-2 rounded-full" style={{
                                    background:
                                      profile.retention_rag === 'green'
                                        ? 'var(--accent-success)'
                                        : profile.retention_rag === 'amber'
                                          ? 'var(--accent-warning)'
                                          : 'var(--accent-danger)'
                                  }} />
                                  Customer retention: {profile.retention_rag.toUpperCase()} vs AU benchmark
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* PRODUCT TAB */}
            <TabsContent value="product">
              <Card className="card-clean">
                <CardHeader>
                  <CardTitle className="font-serif flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-[#ccff00]" />
                    Products & Services
                  </CardTitle>
                  <CardDescription>What you offer and why customers choose you</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label>Main Products/Services *</Label>
                    <Textarea
                      value={profile.main_products_services || ''}
                      onChange={(e) => updateProfile('main_products_services', e.target.value)}
                      placeholder="List and describe your main products or services..."
                      className="min-h-[120px]"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>Pricing Model</Label>
                      <Select value={profile.pricing_model || ''} onValueChange={(v) => updateProfile('pricing_model', v)}>
                        <SelectTrigger><SelectValue placeholder="Select model" /></SelectTrigger>
                        <SelectContent className="bg-white">
                          {pricingModels.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Sales Cycle Length</Label>
                      <Input
                        value={profile.sales_cycle_length || ''}
                        onChange={(e) => updateProfile('sales_cycle_length', e.target.value)}
                        placeholder="e.g., 2-4 weeks, 3 months"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Unique Value Proposition</Label>
                    <Textarea
                      value={profile.unique_value_proposition || ''}
                      onChange={(e) => updateProfile('unique_value_proposition', e.target.value)}
                      placeholder="What makes your offering unique? Why should customers choose you over alternatives?"
                      className="min-h-[100px]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Competitive Advantages *</Label>
                    <Textarea
                      value={profile.competitive_advantages || ''}
                      onChange={(e) => updateProfile('competitive_advantages', e.target.value)}
                      placeholder="What do you do better than your competitors? What's your moat?"
                      className="min-h-[100px]"
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TEAM TAB */}
            <TabsContent value="team">
              <Card className="card-clean">
                <CardHeader>
                  <CardTitle className="font-serif flex items-center gap-2">
                    <Users className="w-5 h-5 text-[#ccff00]" />
                    Team & Leadership
                  </CardTitle>
                  <CardDescription>Your team is your greatest asset</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label>Founder/Owner Background</Label>
                    <Textarea
                      value={profile.founder_background || ''}
                      onChange={(e) => updateProfile('founder_background', e.target.value)}
                      placeholder="Your professional background, expertise, and why you started this business..."
                      className="min-h-[100px]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Key Team Members & Roles</Label>
                    <Textarea
                      value={profile.key_team_members || ''}
                      onChange={(e) => updateProfile('key_team_members', e.target.value)}
                      placeholder="List key team members and their roles/responsibilities..."
                      className="min-h-[100px]"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>Team Strengths</Label>
                      <Textarea
                        value={profile.team_strengths || ''}
                        onChange={(e) => updateProfile('team_strengths', e.target.value)}
                        placeholder="What does your team excel at?"
                        className="min-h-[80px]"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Team Gaps / Hiring Needs</Label>
                      <Textarea
                        value={profile.team_gaps || ''}
                        onChange={(e) => updateProfile('team_gaps', e.target.value)}
                        placeholder="What roles or skills are you missing?"
                        className="min-h-[80px]"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Company Culture</Label>
                    <Textarea
                      value={profile.company_culture || ''}
                      onChange={(e) => updateProfile('company_culture', e.target.value)}
                      placeholder="How would you describe your company culture? What values drive your team?"
                      className="min-h-[80px]"
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* STRATEGY TAB */}
            <TabsContent value="strategy">
              <Card className="card-clean">
                <CardHeader>
                  <CardTitle className="font-serif flex items-center gap-2">
                    <Rocket className="w-5 h-5 text-[#ccff00]" />
                    Strategy & Vision
                  </CardTitle>
                  <CardDescription>Where you&apos;re going and how you&apos;ll get there</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>Mission Statement</Label>
                      <Textarea
                        value={profile.mission_statement || ''}
                        onChange={(e) => updateProfile('mission_statement', e.target.value)}
                        placeholder="Why does your business exist? What problem do you solve?"
                        className="min-h-[80px]"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Vision Statement</Label>
                      <Textarea
                        value={profile.vision_statement || ''}
                        onChange={(e) => updateProfile('vision_statement', e.target.value)}
                        placeholder="What does success look like in 5-10 years?"
                        className="min-h-[80px]"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Short-term Goals (6-12 months)</Label>
                    <Textarea
                      value={profile.short_term_goals || ''}
                      onChange={(e) => updateProfile('short_term_goals', e.target.value)}
                      placeholder="What do you want to achieve in the next year?"
                      className="min-h-[80px]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Long-term Goals (2-5 years)</Label>
                    <Textarea
                      value={profile.long_term_goals || ''}
                      onChange={(e) => updateProfile('long_term_goals', e.target.value)}
                      placeholder="Where do you see the business in 2-5 years?"
                      className="min-h-[80px]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Main Challenges *</Label>
                    <Textarea
                      value={profile.main_challenges || ''}
                      onChange={(e) => updateProfile('main_challenges', e.target.value)}
                      placeholder="What are your biggest obstacles or pain points right now?"
                      className="min-h-[100px]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Growth Strategy</Label>
                    <Textarea
                      value={profile.growth_strategy || ''}
                      onChange={(e) => updateProfile('growth_strategy', e.target.value)}
                      placeholder="How do you plan to grow? New markets, products, partnerships?"
                      className="min-h-[80px]"
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* PREFERENCES TAB */}
            <TabsContent value="preferences">
              <Card className="card-clean">
                <CardHeader>
                  <CardTitle className="font-serif flex items-center gap-2">
                    <Brain className="w-5 h-5 text-[#ccff00]" />
                    Advisory Preferences
                  </CardTitle>
                  <CardDescription>Help us communicate with you effectively</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="p-4 bg-[#ccff00]/10 rounded-sm mb-6">
                    <div className="flex items-start gap-3">
                      <Lightbulb className="w-5 h-5 text-[#0f2f24] flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-[#0f2f24]">
                        These preferences help your AI advisor tailor its communication style, 
                        recommendations, and advice format to match how you work best.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>Communication Style</Label>
                      <Select value={profile.communication_style || ''} onValueChange={(v) => updateProfile('communication_style', v)}>
                        <SelectTrigger><SelectValue placeholder="How should we communicate?" /></SelectTrigger>
                        <SelectContent className="bg-white">
                          {communicationStyles.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Decision Making Style</Label>
                      <Select value={profile.decision_making_style || ''} onValueChange={(v) => updateProfile('decision_making_style', v)}>
                        <SelectTrigger><SelectValue placeholder="How do you make decisions?" /></SelectTrigger>
                        <SelectContent className="bg-white">
                          {decisionStyles.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Risk Tolerance</Label>
                      <Select value={profile.risk_tolerance || ''} onValueChange={(v) => updateProfile('risk_tolerance', v)}>
                        <SelectTrigger><SelectValue placeholder="Your risk appetite" /></SelectTrigger>
                        <SelectContent className="bg-white">
                          {riskTolerances.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Time for Strategy (weekly)</Label>
                      <Select value={profile.time_availability || ''} onValueChange={(v) => updateProfile('time_availability', v)}>
                        <SelectTrigger><SelectValue placeholder="How much time?" /></SelectTrigger>
                        <SelectContent className="bg-white">
                          {timeAvailabilities.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Preferred Advice Format</Label>
                    <Select value={profile.preferred_advice_format || ''} onValueChange={(v) => updateProfile('preferred_advice_format', v)}>
                      <SelectTrigger><SelectValue placeholder="How should advice be delivered?" /></SelectTrigger>
                      <SelectContent className="bg-white">
                        {adviceFormats.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TOOLS TAB */}
            <TabsContent value="tools">
              <Card className="card-clean">
                <CardHeader>
                  <CardTitle className="font-serif flex items-center gap-2">
                    <Settings2 className="w-5 h-5 text-[#ccff00]" />
                    Tools & Integrations
                  </CardTitle>
                  <CardDescription>The software and systems you use</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <Label>CRM System</Label>
                      <Select value={profile.crm_system || ''} onValueChange={(v) => updateProfile('crm_system', v)}>
                        <SelectTrigger><SelectValue placeholder="Select CRM" /></SelectTrigger>
                        <SelectContent className="bg-white">
                          {crmSystems.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Accounting System</Label>
                      <Select value={profile.accounting_system || ''} onValueChange={(v) => updateProfile('accounting_system', v)}>
                        <SelectTrigger><SelectValue placeholder="Select system" /></SelectTrigger>
                        <SelectContent className="bg-white">
                          {accountingSystems.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Project Management</Label>
                      <Select value={profile.project_management_tool || ''} onValueChange={(v) => updateProfile('project_management_tool', v)}>
                        <SelectTrigger><SelectValue placeholder="Select tool" /></SelectTrigger>
                        <SelectContent className="bg-white">
                          {pmTools.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Tech Stack / Other Tools</Label>
                    <Textarea
                      value={profile.tech_stack || ''}
                      onChange={(e) => updateProfile('tech_stack', e.target.value)}
                      placeholder="List other tools, platforms, or technology you use (e.g., Shopify, WordPress, AWS, Zapier...)"
                      className="min-h-[80px]"
                    />
                  </div>

                  <div className="p-4 bg-[#f5f5f0] rounded-sm">
                    <h4 className="font-medium text-[#0f2f24] mb-2">Coming Soon: Direct Integrations</h4>
                    <p className="text-sm text-[#0f2f24]/60">
                      We&apos;re working on direct integrations with HubSpot, QuickBooks, and other platforms
                      to automatically sync your business data for even smarter AI recommendations.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Floating Save Button */}
          <div className="fixed bottom-8 right-8 z-50">
            <Button onClick={handleSave} className="btn-forest shadow-lg" disabled={saving} size="lg">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Profile
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default BusinessProfile;
