import { CognitiveMesh } from '../components/LoadingSystems';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Progress } from '../components/ui/progress';
import { 
  Building2, Users, Target, DollarSign, TrendingUp, Globe,
  Upload, Check, Loader2, ArrowRight, ArrowLeft, Save, Sparkles
} from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { toast } from 'sonner';
import { apiClient } from '../lib/api';

const ProfileImport = () => {
  const navigate = useNavigate();
  const [currentSection, setCurrentSection] = useState(0);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState([]);
  const [profileData, setProfileData] = useState({
    // Business Fundamentals
    business_name: '',
    abn: '',
    acn: '',
    business_type: 'Company (Pty Ltd)',
    year_founded: '',
    location: '',
    website: '',
    industry: '',
    
    // Financial
    revenue_range: '',
    monthly_expenses: '',
    customer_count: '',
    average_customer_value: '',
    retention_rate_range: '',
    
    // Team & Operations
    team_size: '',
    hiring_status: '',
    founder_background: '',
    
    // Products & Services
    products_services: '',
    business_model: '',
    pricing_model: '',
    unique_value_proposition: '',
    
    // Market
    target_market: '',
    ideal_customer_profile: '',
    geographic_focus: '',
    
    // Strategy
    mission_statement: '',
    vision_statement: '',
    short_term_goals: '',
    long_term_goals: '',
    main_challenges: '',
    growth_strategy: '',
    
    // Tools
    current_tools: [],
    crm_system: '',
    accounting_system: '',
  });

  const sections = [
    { id: 'fundamentals', label: 'Business Fundamentals', icon: Building2 },
    { id: 'financial', label: 'Financial Details', icon: DollarSign },
    { id: 'team', label: 'Team & Operations', icon: Users },
    { id: 'market', label: 'Market & Products', icon: Target },
    { id: 'strategy', label: 'Strategy & Vision', icon: TrendingUp },
    { id: 'tools', label: 'Tools & Systems', icon: Globe },
    { id: 'documents', label: 'Upload Documents', icon: Upload },
  ];

  const updateField = (field, value) => {
    setProfileData(prev => ({ ...prev, [field]: value }));
  };

  const toggleTool = (tool) => {
    const current = profileData.current_tools || [];
    const updated = current.includes(tool)
      ? current.filter(t => t !== tool)
      : [...current, tool];
    updateField('current_tools', updated);
  };

  const handleNext = () => {
    if (currentSection < sections.length - 1) {
      setCurrentSection(currentSection + 1);
      window.scrollTo(0, 0);
    }
  };

  const handleBack = () => {
    if (currentSection > 0) {
      setCurrentSection(currentSection - 1);
      window.scrollTo(0, 0);
    }
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploading(true);
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('category', 'Business Profile');
        formData.append('description', 'Profile import document');

        const response = await apiClient.post('/data-center/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        setUploadedDocs(prev => [...prev, response.data]);
      }
      toast.success(`${files.length} document(s) uploaded!`);
    } catch (error) {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleWebsiteScrape = async () => {
    if (!profileData.website) {
      toast.error('Please enter website URL first');
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.post('/business-profile/build', {
        business_name: profileData.business_name,
        website_url: profileData.website,
        abn: profileData.abn
      });

      // Merge scraped data with existing
      const patch = response.data?.patch || {};
      setProfileData(prev => ({ ...prev, ...patch }));
      
      toast.success('Website data imported successfully!');
    } catch (error) {
      toast.error('Website scrape failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveComplete = async () => {
    setLoading(true);
    try {
      // Save to business profile
      await apiClient.put('/business-profile', profileData);
      
      toast.success('🎉 Complete profile saved! Your AI is now fully personalized.');
      navigate('/dashboard');
    } catch (error) {
      toast.error('Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  const progress = ((currentSection + 1) / sections.length) * 100;

  const renderSection = () => {
    switch (sections[currentSection].id) {
      case 'fundamentals':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label>Business Name *</Label>
                <Input
                  value={profileData.business_name}
                  onChange={(e) => updateField('business_name', e.target.value)}
                  placeholder="Business Intelligence Quotient Centre Pty Ltd"
                  className="mt-2"
                />
              </div>
              <div>
                <Label>ABN *</Label>
                <Input
                  value={profileData.abn}
                  onChange={(e) => updateField('abn', e.target.value)}
                  placeholder="12 345 678 901"
                  className="mt-2"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label>ACN (if applicable)</Label>
                <Input
                  value={profileData.acn}
                  onChange={(e) => updateField('acn', e.target.value)}
                  placeholder="123 456 789"
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Year Founded</Label>
                <Input
                  type="number"
                  value={profileData.year_founded}
                  onChange={(e) => updateField('year_founded', e.target.value)}
                  placeholder="2020"
                  className="mt-2"
                />
              </div>
            </div>

            <div>
              <Label>Industry *</Label>
              <Input
                value={profileData.industry}
                onChange={(e) => updateField('industry', e.target.value)}
                placeholder="e.g., Professional Services, Business Advisory"
                className="mt-2"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label>Business Address</Label>
                <Input
                  value={profileData.location}
                  onChange={(e) => updateField('location', e.target.value)}
                  placeholder="City, State, Country"
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Website *</Label>
                <Input
                  value={profileData.website}
                  onChange={(e) => updateField('website', e.target.value)}
                  placeholder="www.thestrategysquad.com"
                  className="mt-2"
                />
              </div>
            </div>

            <div className="p-4 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
              <Button onClick={handleWebsiteScrape} disabled={!profileData.website || loading} className="btn-secondary">
                {loading ? null : <Globe className="w-4 h-4 mr-2" />}
                Auto-fill from Website
              </Button>
              <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                I'll scrape your website and pre-fill what I can find
              </p>
            </div>
          </div>
        );

      case 'financial':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label>Annual Revenue Range *</Label>
                <Select value={profileData.revenue_range} onValueChange={(val) => updateField('revenue_range', val)}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select range" />
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
              </div>
              <div>
                <Label>Monthly Expenses Range</Label>
                <Input
                  value={profileData.monthly_expenses}
                  onChange={(e) => updateField('monthly_expenses', e.target.value)}
                  placeholder="e.g., $10K - $20K"
                  className="mt-2"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label>Number of Clients/Customers *</Label>
                <Input
                  value={profileData.customer_count}
                  onChange={(e) => updateField('customer_count', e.target.value)}
                  placeholder="e.g., 10-50, 100+"
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Average Customer Value</Label>
                <Input
                  value={profileData.average_customer_value}
                  onChange={(e) => updateField('average_customer_value', e.target.value)}
                  placeholder="e.g., $5,000"
                  className="mt-2"
                />
              </div>
            </div>

            <div>
              <Label>Client Retention Rate (if known)</Label>
              <Select value={profileData.retention_rate_range} onValueChange={(val) => updateField('retention_rate_range', val)}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="<20%">Less than 20%</SelectItem>
                  <SelectItem value="20-40%">20-40%</SelectItem>
                  <SelectItem value="40-60%">40-60%</SelectItem>
                  <SelectItem value="60-80%">60-80%</SelectItem>
                  <SelectItem value=">80%">80%+</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 'team':
        return (
          <div className="space-y-6">
            <div>
              <Label>Team Size *</Label>
              <Select value={profileData.team_size} onValueChange={(val) => updateField('team_size', val)}>
                <SelectTrigger className="mt-2">
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
            </div>

            <div>
              <Label>Hiring Status</Label>
              <Select value={profileData.hiring_status} onValueChange={(val) => updateField('hiring_status', val)}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="actively">Actively hiring</SelectItem>
                  <SelectItem value="planning">Planning to hire</SelectItem>
                  <SelectItem value="not-now">Not at this time</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Your Background & Expertise</Label>
              <Textarea
                value={profileData.founder_background}
                onChange={(e) => updateField('founder_background', e.target.value)}
                placeholder="Tell us about your professional background, experience, and what you bring to the business..."
                rows={4}
                className="mt-2"
              />
            </div>
          </div>
        );

      case 'market':
        return (
          <div className="space-y-6">
            <div>
              <Label>What do you offer? (Products/Services) *</Label>
              <Textarea
                value={profileData.products_services}
                onChange={(e) => updateField('products_services', e.target.value)}
                placeholder="Describe your main products or services in detail..."
                rows={4}
                className="mt-2"
              />
            </div>

            <div>
              <Label>Unique Value Proposition *</Label>
              <Textarea
                value={profileData.unique_value_proposition}
                onChange={(e) => updateField('unique_value_proposition', e.target.value)}
                placeholder="What makes you different? Why do customers choose you over alternatives?"
                rows={3}
                className="mt-2"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label>Business Model</Label>
                <Select value={profileData.business_model} onValueChange={(val) => updateField('business_model', val)}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="B2B">B2B</SelectItem>
                    <SelectItem value="B2C">B2C</SelectItem>
                    <SelectItem value="B2B2C">B2B2C</SelectItem>
                    <SelectItem value="Hybrid">Hybrid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Pricing Model</Label>
                <Select value={profileData.pricing_model} onValueChange={(val) => updateField('pricing_model', val)}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Hourly">Hourly</SelectItem>
                    <SelectItem value="Project-based">Project-based</SelectItem>
                    <SelectItem value="Retainer">Retainer</SelectItem>
                    <SelectItem value="Subscription">Subscription</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Target Market / Ideal Customer</Label>
              <Textarea
                value={profileData.target_market}
                onChange={(e) => updateField('target_market', e.target.value)}
                placeholder="Describe your ideal customer - demographics, industry, company size, pain points..."
                rows={4}
                className="mt-2"
              />
            </div>

            <div>
              <Label>Geographic Focus</Label>
              <Input
                value={profileData.geographic_focus}
                onChange={(e) => updateField('geographic_focus', e.target.value)}
                placeholder="e.g., Australia, APAC, Global"
                className="mt-2"
              />
            </div>
          </div>
        );

      case 'strategy':
        return (
          <div className="space-y-6">
            <div>
              <Label>Mission Statement *</Label>
              <Textarea
                value={profileData.mission_statement}
                onChange={(e) => updateField('mission_statement', e.target.value)}
                placeholder="Why does your business exist? What problem do you solve?"
                rows={3}
                className="mt-2"
              />
            </div>

            <div>
              <Label>Vision Statement (5-10 year goal)</Label>
              <Textarea
                value={profileData.vision_statement}
                onChange={(e) => updateField('vision_statement', e.target.value)}
                placeholder="What does success look like in 5-10 years?"
                rows={3}
                className="mt-2"
              />
            </div>

            <div>
              <Label>Short-term Goals (6-12 months) *</Label>
              <Textarea
                value={profileData.short_term_goals}
                onChange={(e) => updateField('short_term_goals', e.target.value)}
                placeholder="What do you want to achieve in the next year?"
                rows={3}
                className="mt-2"
              />
            </div>

            <div>
              <Label>Long-term Goals (2-5 years)</Label>
              <Textarea
                value={profileData.long_term_goals}
                onChange={(e) => updateField('long_term_goals', e.target.value)}
                placeholder="Where do you see the business in 2-5 years?"
                rows={3}
                className="mt-2"
              />
            </div>

            <div>
              <Label>Main Challenges *</Label>
              <Textarea
                value={profileData.main_challenges}
                onChange={(e) => updateField('main_challenges', e.target.value)}
                placeholder="What are your biggest obstacles right now?"
                rows={3}
                className="mt-2"
              />
            </div>

            <div>
              <Label>Growth Strategy</Label>
              <Textarea
                value={profileData.growth_strategy}
                onChange={(e) => updateField('growth_strategy', e.target.value)}
                placeholder="How do you plan to grow? New markets, products, partnerships?"
                rows={3}
                className="mt-2"
              />
            </div>
          </div>
        );

      case 'tools':
        return (
          <div className="space-y-6">
            <div>
              <Label className="text-base mb-3 block">Tools & Systems You Use</Label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  'HubSpot',
                  'Xero',
                  'Google Ads',
                  'Meta Ads',
                  'LinkedIn',
                  'Gmail',
                  'Mailchimp',
                  'Slack',
                  'Salesforce',
                  'QuickBooks',
                  'Google Analytics',
                  'Other'
                ].map(tool => {
                  const isSelected = (profileData.current_tools || []).includes(tool);
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
                        onChange={() => toggleTool(tool)}
                      />
                      <span className="text-sm">{tool}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label>Primary CRM System</Label>
                <Select value={profileData.crm_system} onValueChange={(val) => updateField('crm_system', val)}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select CRM" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HubSpot">HubSpot</SelectItem>
                    <SelectItem value="Salesforce">Salesforce</SelectItem>
                    <SelectItem value="Pipedrive">Pipedrive</SelectItem>
                    <SelectItem value="None">None / Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Accounting System</Label>
                <Select value={profileData.accounting_system} onValueChange={(val) => updateField('accounting_system', val)}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select system" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Xero">Xero</SelectItem>
                    <SelectItem value="QuickBooks">QuickBooks</SelectItem>
                    <SelectItem value="MYOB">MYOB</SelectItem>
                    <SelectItem value="None">None / Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        );

      case 'documents':
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <Sparkles className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--accent-primary)' }} />
              <h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                Upload Business Documents
              </h3>
              <p style={{ color: 'var(--text-secondary)' }}>
                The more documents you upload, the more personalized your AI becomes
              </p>
            </div>

            <div className="border-2 border-dashed rounded-xl p-8 text-center" style={{ borderColor: 'var(--border-medium)' }}>
              <input
                type="file"
                multiple
                onChange={handleFileUpload}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
                className="hidden"
                id="doc-upload"
                disabled={uploading}
              />
              <label htmlFor="doc-upload" className="cursor-pointer">
                {uploading ? (
                  <CognitiveMesh compact />
                ) : (
                  <Upload className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
                )}
                <p className="font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  {uploading ? 'Uploading...' : 'Click to upload documents'}
                </p>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  PDF, Word, Excel, Google Docs supported
                </p>
              </label>
            </div>

            {uploadedDocs.length > 0 && (
              <div>
                <Label className="mb-3 block">Uploaded Documents ({uploadedDocs.length})</Label>
                <div className="space-y-2">
                  {uploadedDocs.map((doc, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                      <Check className="w-5 h-5" style={{ color: 'var(--accent-success)' }} />
                      <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{doc.filename}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="p-4 rounded-lg" style={{ background: 'rgba(0,102,255,0.05)', border: '1px solid rgba(0,102,255,0.2)' }}>
              <p className="text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                💡 Recommended Documents:
              </p>
              <ul className="text-sm space-y-1" style={{ color: 'var(--text-secondary)' }}>
                <li>• Business plan or strategy document</li>
                <li>• Financial reports or projections</li>
                <li>• Client list or case studies</li>
                <li>• Marketing materials or campaigns</li>
                <li>• Existing SOPs or processes</li>
              </ul>
            </div>
          </div>
        );

      default:
        return <div>Section content</div>;
    }
  };

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-serif mb-2" style={{ color: 'var(--text-primary)' }}>
              Complete Business Profile Import
            </h1>
            <p style={{ color: 'var(--text-secondary)' }}>
              Build your AI brain with comprehensive business data
            </p>
          </div>

          {/* Progress */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                Section {currentSection + 1} of {sections.length}: {sections[currentSection].label}
              </span>
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {Math.round(progress)}% complete
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Section Steps */}
          <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
            {sections.map((section, i) => {
              const Icon = section.icon;
              const isActive = i === currentSection;
              const isPast = i < currentSection;
              return (
                <button
                  key={section.id}
                  onClick={() => setCurrentSection(i)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-all"
                  style={{
                    background: isActive ? 'var(--accent-primary)' : isPast ? 'var(--bg-tertiary)' : 'transparent',
                    color: isActive ? 'white' : 'var(--text-secondary)',
                    border: `1px solid ${isActive ? 'var(--accent-primary)' : 'var(--border-medium)'}`
                  }}
                >
                  {isPast && <Check className="w-4 h-4" />}
                  <Icon className="w-4 h-4" />
                  <span className="text-sm hidden md:inline">{section.label}</span>
                </button>
              );
            })}
          </div>

          {/* Content Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {(() => {
                  const Icon = sections[currentSection].icon;
                  return <Icon className="w-5 h-5" />;
                })()}
                {sections[currentSection].label}
              </CardTitle>
              <CardDescription>
                {currentSection === 0 && "Core business information"}
                {currentSection === 1 && "Financial metrics and performance"}
                {currentSection === 2 && "Team structure and capabilities"}
                {currentSection === 3 && "Market positioning and offerings"}
                {currentSection === 4 && "Strategic direction and goals"}
                {currentSection === 5 && "Systems and tools you use"}
                {currentSection === 6 && "Supporting documents for AI analysis"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {renderSection()}

              {/* Navigation */}
              <div className="flex items-center justify-between pt-6 mt-6 border-t" style={{ borderColor: 'var(--border-light)' }}>
                {currentSection > 0 ? (
                  <Button onClick={handleBack} variant="outline" className="btn-secondary">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                ) : (
                  <div />
                )}

                {currentSection < sections.length - 1 ? (
                  <Button onClick={handleNext} className="btn-primary">
                    Continue
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                ) : (
                  <Button onClick={handleSaveComplete} disabled={loading} className="btn-primary">
                    {loading ? (
                      <>
                        
                        Saving...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        Complete Import
                      </>
                    )}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Skip for now */}
          <div className="text-center mt-6">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-sm"
              style={{ color: 'var(--text-muted)' }}
            >
              Skip for now
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ProfileImport;
