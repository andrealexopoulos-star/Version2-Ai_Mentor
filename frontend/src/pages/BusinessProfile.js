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
import { 
  Building2, Users, Target, Briefcase, TrendingUp,
  Loader2, Save, CheckCircle, AlertCircle, Package
} from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { toast } from 'sonner';
import { apiClient } from '../lib/api';

const businessTypes = [
  'Sole Trader', 'Partnership', 'Company (Pty Ltd)', 'Company (Ltd)',
  'Trust', 'Incorporated Association', 'Co-operative', 'Not-for-profit',
  'Government', 'Other'
];

const businessModels = ['B2B', 'B2C', 'B2B2C', 'Hybrid'];
const pricingModels = ['Hourly', 'Project-based', 'Retainer', 'Subscription', 'One-time purchase', 'Usage-based', 'Tiered'];

const BusinessProfile = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({});
  const [scores, setScores] = useState({ completeness: 0, strength: 0 });
  const [activeTab, setActiveTab] = useState('basics');

  // Get user subscription tier
  const userTier = user?.subscription_tier || 'free';
  const isPaidUser = !['free', 'trial'].includes(userTier.toLowerCase());
  const isEnterprise = userTier.toLowerCase() === 'enterprise';

  useEffect(() => {
    fetchProfile();
    fetchScores();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await apiClient.get('/business-profile');
      setProfile(response.data || {});
    } catch (error) {
      toast.error('Failed to load profile');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchScores = async () => {
    try {
      const response = await apiClient.get('/business-profile/scores');
      setScores(response.data);
    } catch (error) {
      console.error('Failed to fetch scores:', error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      console.log('Saving profile data:', profile);
      const response = await apiClient.put('/business-profile', profile);
      console.log('Save response:', response.data);
      
      toast.success('Profile saved successfully!');
      
      // Refresh scores immediately after save
      await fetchScores();
      
      // Refresh profile data to confirm save
      await fetchProfile();
    } catch (error) {
      const errorMsg = error.response?.data?.detail || error.message || 'Failed to save profile';
      toast.error(errorMsg);
      console.error('Save error:', error.response?.data || error);
    } finally {
      setSaving(false);
    }
  };

  const updateProfile = (field, value) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--accent-primary)' }} />
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
              <h1 className="text-3xl md:text-4xl font-serif mb-2" style={{ color: 'var(--text-primary)' }}>
                Business Profile
              </h1>
              <p style={{ color: 'var(--text-secondary)' }}>
                Your business DNA - the foundation for personalized AI advice
              </p>
            </div>
            <Button onClick={handleSave} className="btn-primary" disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Profile
            </Button>
          </div>

          {/* Profile Completeness Card */}
          <div 
            className="p-5 rounded-xl mb-8"
            style={{ 
              background: 'linear-gradient(135deg, rgba(0, 102, 255, 0.08) 0%, var(--bg-card) 100%)',
              border: '1px solid rgba(0, 102, 255, 0.2)'
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
                <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>Profile Completeness</span>
              </div>
              <span className="text-3xl font-serif" style={{ color: 'var(--accent-primary)' }}>{scores.completeness}%</span>
            </div>
            <Progress value={scores.completeness} className="h-2 mb-2" />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {scores.completeness < 50 
                ? 'Add more details to unlock personalized AI insights'
                : scores.completeness < 80 
                  ? 'Good progress! A few more fields will maximize AI accuracy'
                  : 'Excellent! Your profile is well-detailed'
              }
            </p>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-5 w-full mb-8">
              <TabsTrigger value="basics" className="flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                <span className="hidden sm:inline">Basics</span>
              </TabsTrigger>
              <TabsTrigger value="market" disabled={!isPaidUser} className="flex items-center gap-2">
                <Target className="w-4 h-4" />
                <span className="hidden sm:inline">Market</span>
                {!isPaidUser && <span className="text-xs ml-1">🔒</span>}
              </TabsTrigger>
              <TabsTrigger value="product" disabled={!isPaidUser} className="flex items-center gap-2">
                <Package className="w-4 h-4" />
                <span className="hidden sm:inline">Product</span>
                {!isPaidUser && <span className="text-xs ml-1">🔒</span>}
              </TabsTrigger>
              <TabsTrigger value="team" disabled={!isEnterprise} className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline">Team</span>
                {!isEnterprise && <span className="text-xs ml-1">🔒</span>}
              </TabsTrigger>
              <TabsTrigger value="strategy" disabled={!isPaidUser} className="flex items-center gap-2">
                <Briefcase className="w-4 h-4" />
                <span className="hidden sm:inline">Strategy</span>
                {!isPaidUser && <span className="text-xs ml-1">🔒</span>}
              </TabsTrigger>
            </TabsList>

            {/* BASICS TAB */}
            <TabsContent value="basics">
              <Card>
                <CardHeader>
                  <CardTitle>Business Basics</CardTitle>
                  <CardDescription>Core information about your business</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label>Business Name *</Label>
                      <Input
                        value={profile.business_name || ''}
                        onChange={(e) => updateProfile('business_name', e.target.value)}
                        placeholder="Your Company Name"
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <Label>Industry *</Label>
                      <Input
                        value={profile.industry || ''}
                        onChange={(e) => updateProfile('industry', e.target.value)}
                        placeholder="e.g., Professional Services, Technology"
                        className="mt-2"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label>Business Type</Label>
                      <Select value={profile.business_type || ''} onValueChange={(val) => updateProfile('business_type', val)}>
                        <SelectTrigger className="mt-2">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          {businessTypes.map(type => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Business Stage</Label>
                      <Select value={profile.business_stage || ''} onValueChange={(val) => updateProfile('business_stage', val)}>
                        <SelectTrigger className="mt-2">
                          <SelectValue placeholder="Select stage" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="idea">Business Idea</SelectItem>
                          <SelectItem value="startup">Startup</SelectItem>
                          <SelectItem value="established">Established</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label>Years Operating</Label>
                      <Input
                        value={profile.years_operating || ''}
                        onChange={(e) => updateProfile('years_operating', e.target.value)}
                        placeholder="e.g., 2-5 years"
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <Label>Website</Label>
                      <Input
                        value={profile.website || ''}
                        onChange={(e) => updateProfile('website', e.target.value)}
                        placeholder="www.yourcompany.com"
                        className="mt-2"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label>ABN (Australian Business Number)</Label>
                      <Input
                        value={profile.abn || ''}
                        onChange={(e) => updateProfile('abn', e.target.value)}
                        placeholder="12 345 678 901"
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <Label>Location</Label>
                      <Input
                        value={profile.location || ''}
                        onChange={(e) => updateProfile('location', e.target.value)}
                        placeholder="City, State/Country"
                        className="mt-2"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* MARKET TAB */}
            <TabsContent value="market">
              <Card>
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
              <Card>
                <CardHeader>
                  <CardTitle>Products & Services</CardTitle>
                  <CardDescription>What you offer and why customers choose you</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <Label>Main Products/Services</Label>
                    <Textarea
                      value={profile.products_services || profile.main_products_services || ''}
                      onChange={(e) => updateProfile('products_services', e.target.value)}
                      placeholder="List and describe your main products or services..."
                      rows={4}
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label>Unique Value Proposition</Label>
                    <Textarea
                      value={profile.unique_value_proposition || ''}
                      onChange={(e) => updateProfile('unique_value_proposition', e.target.value)}
                      placeholder="What makes your offering unique? Why should customers choose you over alternatives?"
                      rows={4}
                      className="mt-2"
                    />
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
              <Card>
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
              <Card>
                <CardHeader>
                  <CardTitle>Strategy & Vision</CardTitle>
                  <CardDescription>Where you're going and how you'll get there</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
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
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Save Button at Bottom */}
          <div className="mt-8 flex justify-end">
            <Button onClick={handleSave} className="btn-primary" disabled={saving}>
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
