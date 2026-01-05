import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
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
  CheckCircle, Loader2, Sparkles, Target, Users, TrendingUp,
  DollarSign, Zap, Brain, Save
} from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '../lib/api';

const BUSINESS_STAGES = [
  {
    id: 'idea',
    label: 'Business Idea',
    icon: Lightbulb,
    description: 'I have a concept but haven\'t started yet',
    color: '#FF9500'
  },
  {
    id: 'startup',
    label: 'Startup',
    icon: Rocket,
    description: 'Launched recently, building traction',
    color: '#7C3AED'
  },
  {
    id: 'established',
    label: 'Established Business',
    icon: Building2,
    description: 'Operational with consistent revenue',
    color: '#0066FF'
  }
];

const OnboardingWizard = () => {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [businessStage, setBusinessStage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({});

  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  const checkOnboardingStatus = async () => {
    try {
      const res = await apiClient.get('/onboarding/status');
      if (res.data.completed) {
        // Already completed, redirect to dashboard
        navigate('/dashboard');
      } else if (res.data.current_step) {
        // Resume from saved step
        setCurrentStep(res.data.current_step);
        setBusinessStage(res.data.business_stage);
        setFormData(res.data.data || {});
      }
    } catch (error) {
      console.error('Error checking onboarding status:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveProgress = async (data, step, stage) => {
    try {
      await apiClient.post('/onboarding/save', {
        current_step: step,
        business_stage: stage || businessStage,
        data: { ...formData, ...data },
        completed: false
      });
    } catch (error) {
      console.error('Error saving progress:', error);
    }
  };

  const handleStageSelect = async (stage) => {
    setBusinessStage(stage);
    await saveProgress({}, 1, stage);
    setCurrentStep(1);
  };

  const handleNext = async () => {
    const newData = { ...formData };
    await saveProgress(newData, currentStep + 1, businessStage);
    
    if (currentStep === getTotalSteps()) {
      // Complete onboarding
      await completeOnboarding();
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep === 1) {
      setBusinessStage(null);
      setCurrentStep(0);
    } else {
      setCurrentStep(currentStep - 1);
    }
  };

  const completeOnboarding = async () => {
    setSaving(true);
    try {
      // Save final data to business profile
      await apiClient.put('/business-profile', {
        business_stage: businessStage,
        ...formData
      });
      
      // Mark onboarding as complete
      await apiClient.post('/onboarding/complete');
      
      await refreshUser();
      toast.success('🎉 Profile completed! Welcome to Strategy Squad');
      navigate('/dashboard');
    } catch (error) {
      toast.error('Failed to complete onboarding');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const updateFormData = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleArrayItem = (field, item) => {
    const current = formData[field] || [];
    const updated = current.includes(item)
      ? current.filter(i => i !== item)
      : [...current, item];
    updateFormData(field, updated);
  };

  const getTotalSteps = () => {
    return getSteps().length;
  };

  const getSteps = () => {
    if (!businessStage) return [];
    
    const commonSteps = [
      { id: 'basics', label: 'Basics', icon: Building2 },
      { id: 'team', label: 'Team', icon: Users },
      { id: 'goals', label: 'Goals', icon: Target },
      { id: 'tools', label: 'Tools', icon: Zap },
      { id: 'preferences', label: 'Preferences', icon: Brain }
    ];

    if (businessStage === 'idea') {
      return [
        { id: 'basics', label: 'Basics', icon: Lightbulb },
        { id: 'concept', label: 'Your Concept', icon: Brain },
        { id: 'market', label: 'Target Market', icon: Target },
        { id: 'timeline', label: 'Timeline', icon: TrendingUp },
        { id: 'resources', label: 'Resources', icon: DollarSign },
        { id: 'tools', label: 'Tools', icon: Zap },
        { id: 'preferences', label: 'Preferences', icon: Sparkles }
      ];
    } else if (businessStage === 'startup') {
      return [
        { id: 'basics', label: 'Basics', icon: Rocket },
        { id: 'product', label: 'Product/Service', icon: Sparkles },
        { id: 'traction', label: 'Traction', icon: TrendingUp },
        { id: 'team', label: 'Team', icon: Users },
        { id: 'funding', label: 'Funding', icon: DollarSign },
        { id: 'tools', label: 'Tools', icon: Zap },
        { id: 'preferences', label: 'Preferences', icon: Brain }
      ];
    } else {
      return [
        { id: 'basics', label: 'Basics', icon: Building2 },
        { id: 'operations', label: 'Operations', icon: Zap },
        { id: 'performance', label: 'Performance', icon: TrendingUp },
        { id: 'team', label: 'Team', icon: Users },
        { id: 'growth', label: 'Growth', icon: Rocket },
        { id: 'tools', label: 'Tools', icon: DollarSign },
        { id: 'preferences', label: 'Preferences', icon: Brain }
      ];
    }
  };

  const renderStepContent = () => {
    const steps = getSteps();
    if (currentStep === 0) return null;
    const step = steps[currentStep - 1];
    
    return renderStepByStage(step?.id);
  };

  const renderStepByStage = (stepId) => {
    if (businessStage === 'idea') {
      return renderIdeaSteps(stepId);
    } else if (businessStage === 'startup') {
      return renderStartupSteps(stepId);
    } else {
      return renderEstablishedSteps(stepId);
    }
  };

  const renderIdeaSteps = (stepId) => {
    switch (stepId) {
      case 'basics':
        return (
          <div className="space-y-6">
            <div>
              <Label>What's your business idea called?</Label>
              <Input
                value={formData.business_name || ''}
                onChange={(e) => updateFormData('business_name', e.target.value)}
                placeholder="e.g., EcoBox Delivery"
                className="mt-2"
              />
            </div>
            <div>
              <Label>In one sentence, what problem does it solve?</Label>
              <Textarea
                value={formData.problem_statement || ''}
                onChange={(e) => updateFormData('problem_statement', e.target.value)}
                placeholder="e.g., People want sustainable packaging but don't know where to start"
                rows={3}
                className="mt-2"
              />
            </div>
            <div>
              <Label>What industry or sector?</Label>
              <Select 
                value={formData.industry} 
                onValueChange={(val) => updateFormData('industry', val)}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select industry" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Technology">Technology</SelectItem>
                  <SelectItem value="Retail">Retail & E-commerce</SelectItem>
                  <SelectItem value="Professional Services">Professional Services</SelectItem>
                  <SelectItem value="Food">Food & Hospitality</SelectItem>
                  <SelectItem value="Healthcare">Healthcare</SelectItem>
                  <SelectItem value="Manufacturing">Manufacturing</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );
      case 'concept':
        return (
          <div className="space-y-6">
            <div>
              <Label>Who is your ideal customer?</Label>
              <Textarea
                value={formData.target_customer || ''}
                onChange={(e) => updateFormData('target_customer', e.target.value)}
                placeholder="Describe your target customer..."
                rows={3}
                className="mt-2"
              />
            </div>
            <div>
              <Label>What makes your idea unique?</Label>
              <Textarea
                value={formData.unique_value || ''}
                onChange={(e) => updateFormData('unique_value', e.target.value)}
                placeholder="Your unique value proposition..."
                rows={3}
                className="mt-2"
              />
            </div>
          </div>
        );
      case 'market':
        return (
          <div className="space-y-6">
            <div>
              <Label>Where will you operate? (Select all that apply)</Label>
              <div className="grid grid-cols-2 gap-3 mt-2">
                {['Local', 'State-wide', 'National', 'International'].map(loc => (
                  <label key={loc} className="flex items-center gap-2 p-3 rounded-lg border cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={(formData.operating_regions || []).includes(loc)}
                      onChange={() => toggleArrayItem('operating_regions', loc)}
                    />
                    <span>{loc}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label>Do you have competitors?</Label>
              <RadioGroup 
                value={formData.has_competitors} 
                onValueChange={(val) => updateFormData('has_competitors', val)}
                className="mt-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yes" id="comp-yes" />
                  <Label htmlFor="comp-yes">Yes, I know my competitors</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="unsure" id="comp-unsure" />
                  <Label htmlFor="comp-unsure">Not sure yet</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="comp-no" />
                  <Label htmlFor="comp-no">No direct competitors</Label>
                </div>
              </RadioGroup>
            </div>
          </div>
        );
      case 'timeline':
        return (
          <div className="space-y-6">
            <div>
              <Label>When do you plan to launch?</Label>
              <Select 
                value={formData.launch_timeline} 
                onValueChange={(val) => updateFormData('launch_timeline', val)}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select timeline" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1-3 months">1-3 months</SelectItem>
                  <SelectItem value="3-6 months">3-6 months</SelectItem>
                  <SelectItem value="6-12 months">6-12 months</SelectItem>
                  <SelectItem value="12+ months">12+ months</SelectItem>
                  <SelectItem value="still-planning">Still planning</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>What's your biggest challenge right now?</Label>
              <Textarea
                value={formData.biggest_challenge || ''}
                onChange={(e) => updateFormData('biggest_challenge', e.target.value)}
                placeholder="e.g., Finding funding, validating the idea, building a team..."
                rows={4}
                className="mt-2"
              />
            </div>
          </div>
        );
      case 'resources':
        return (
          <div className="space-y-6">
            <div>
              <Label>Do you have funding or capital?</Label>
              <RadioGroup 
                value={formData.funding_status} 
                onValueChange={(val) => updateFormData('funding_status', val)}
                className="mt-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="bootstrapping" id="fund-boot" />
                  <Label htmlFor="fund-boot">Bootstrapping (self-funded)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="seeking" id="fund-seek" />
                  <Label htmlFor="fund-seek">Seeking funding</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="secured" id="fund-sec" />
                  <Label htmlFor="fund-sec">Funding secured</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="not-yet" id="fund-not" />
                  <Label htmlFor="fund-not">Not thought about it yet</Label>
                </div>
              </RadioGroup>
            </div>
            <div>
              <Label>How much time can you dedicate per week?</Label>
              <Select 
                value={formData.time_commitment} 
                onValueChange={(val) => updateFormData('time_commitment', val)}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select time commitment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="<5 hours">Less than 5 hours</SelectItem>
                  <SelectItem value="5-10 hours">5-10 hours</SelectItem>
                  <SelectItem value="10-20 hours">10-20 hours (part-time)</SelectItem>
                  <SelectItem value="20-40 hours">20-40 hours (full-time)</SelectItem>
                  <SelectItem value="40+ hours">40+ hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );
      case 'tools':
        return renderToolsStep();
      case 'preferences':
        return renderPreferencesStep();
      default:
        return <div>Step content</div>;
    }
  };

  const renderStartupSteps = (stepId) => {
    switch (stepId) {
      case 'basics':
        return (
          <div className="space-y-6">
            <div>
              <Label>Business Name</Label>
              <Input
                value={formData.business_name || ''}
                onChange={(e) => updateFormData('business_name', e.target.value)}
                placeholder="Your company name"
                className="mt-2"
              />
            </div>
            <div>
              <Label>Industry</Label>
              <Select 
                value={formData.industry} 
                onValueChange={(val) => updateFormData('industry', val)}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select industry" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Technology">Technology</SelectItem>
                  <SelectItem value="Retail">Retail & E-commerce</SelectItem>
                  <SelectItem value="Professional Services">Professional Services</SelectItem>
                  <SelectItem value="Food">Food & Hospitality</SelectItem>
                  <SelectItem value="Healthcare">Healthcare</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>When did you launch?</Label>
              <Input
                type="month"
                value={formData.launch_date || ''}
                onChange={(e) => updateFormData('launch_date', e.target.value)}
                className="mt-2"
              />
            </div>
          </div>
        );
      case 'product':
        return (
          <div className="space-y-6">
            <div>
              <Label>What do you offer?</Label>
              <Textarea
                value={formData.product_description || ''}
                onChange={(e) => updateFormData('product_description', e.target.value)}
                placeholder="Describe your product or service..."
                rows={4}
                className="mt-2"
              />
            </div>
            <div>
              <Label>Business model</Label>
              <Select 
                value={formData.business_model} 
                onValueChange={(val) => updateFormData('business_model', val)}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="B2B">B2B</SelectItem>
                  <SelectItem value="B2C">B2C</SelectItem>
                  <SelectItem value="B2B2C">B2B2C</SelectItem>
                  <SelectItem value="Marketplace">Marketplace</SelectItem>
                  <SelectItem value="SaaS">SaaS</SelectItem>
                  <SelectItem value="Subscription">Subscription</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );
      case 'traction':
        return (
          <div className="space-y-6">
            <div>
              <Label>Do you have paying customers?</Label>
              <RadioGroup 
                value={formData.has_customers} 
                onValueChange={(val) => updateFormData('has_customers', val)}
                className="mt-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yes" id="cust-yes" />
                  <Label htmlFor="cust-yes">Yes, we have customers</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="trials" id="cust-trial" />
                  <Label htmlFor="cust-trial">Trialing/testing phase</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="not-yet" id="cust-no" />
                  <Label htmlFor="cust-no">Not yet</Label>
                </div>
              </RadioGroup>
            </div>
            <div>
              <Label>Monthly revenue range</Label>
              <Select 
                value={formData.revenue_range} 
                onValueChange={(val) => updateFormData('revenue_range', val)}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pre-revenue">Pre-revenue</SelectItem>
                  <SelectItem value="< $1K">Less than $1K</SelectItem>
                  <SelectItem value="$1K - $5K">$1K - $5K</SelectItem>
                  <SelectItem value="$5K - $10K">$5K - $10K</SelectItem>
                  <SelectItem value="$10K - $50K">$10K - $50K</SelectItem>
                  <SelectItem value="$50K+">$50K+</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );
      case 'team':
        return renderTeamStep();
      case 'funding':
        return (
          <div className="space-y-6">
            <div>
              <Label>Funding stage</Label>
              <Select 
                value={formData.funding_stage} 
                onValueChange={(val) => updateFormData('funding_stage', val)}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select stage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Bootstrapped">Bootstrapped</SelectItem>
                  <SelectItem value="Friends & Family">Friends & Family</SelectItem>
                  <SelectItem value="Angel">Angel</SelectItem>
                  <SelectItem value="Seed">Seed</SelectItem>
                  <SelectItem value="Series A">Series A</SelectItem>
                  <SelectItem value="Series B+">Series B+</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Are you actively fundraising?</Label>
              <RadioGroup 
                value={formData.fundraising_status} 
                onValueChange={(val) => updateFormData('fundraising_status', val)}
                className="mt-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yes" id="fr-yes" />
                  <Label htmlFor="fr-yes">Yes, actively raising</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="planning" id="fr-plan" />
                  <Label htmlFor="fr-plan">Planning to raise soon</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="fr-no" />
                  <Label htmlFor="fr-no">Not at this time</Label>
                </div>
              </RadioGroup>
            </div>
          </div>
        );
      case 'tools':
        return renderToolsStep();
      case 'preferences':
        return renderPreferencesStep();
      default:
        return <div>Step content</div>;
    }
  };

  const renderEstablishedSteps = (stepId) => {
    switch (stepId) {
      case 'basics':
        return (
          <div className="space-y-6">
            <div>
              <Label>Business Name</Label>
              <Input
                value={formData.business_name || ''}
                onChange={(e) => updateFormData('business_name', e.target.value)}
                placeholder="Your company name"
                className="mt-2"
              />
            </div>
            <div>
              <Label>ABN (Australian Business Number)</Label>
              <Input
                value={formData.abn || ''}
                onChange={(e) => updateFormData('abn', e.target.value)}
                placeholder="12 345 678 901"
                className="mt-2"
              />
            </div>
            <div>
              <Label>Industry</Label>
              <Select 
                value={formData.industry} 
                onValueChange={(val) => updateFormData('industry', val)}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select industry" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Technology">Technology</SelectItem>
                  <SelectItem value="Retail">Retail & E-commerce</SelectItem>
                  <SelectItem value="Professional Services">Professional Services</SelectItem>
                  <SelectItem value="Food">Food & Hospitality</SelectItem>
                  <SelectItem value="Healthcare">Healthcare</SelectItem>
                  <SelectItem value="Manufacturing">Manufacturing</SelectItem>
                  <SelectItem value="Construction">Construction</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Years in operation</Label>
              <Select 
                value={formData.years_operating} 
                onValueChange={(val) => updateFormData('years_operating', val)}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1-2 years">1-2 years</SelectItem>
                  <SelectItem value="2-5 years">2-5 years</SelectItem>
                  <SelectItem value="5-10 years">5-10 years</SelectItem>
                  <SelectItem value="10+ years">10+ years</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );
      case 'operations':
        return (
          <div className="space-y-6">
            <div>
              <Label>What do you offer?</Label>
              <Textarea
                value={formData.products_services || ''}
                onChange={(e) => updateFormData('products_services', e.target.value)}
                placeholder="Describe your products or services..."
                rows={4}
                className="mt-2"
              />
            </div>
            <div>
              <Label>Business model</Label>
              <Select 
                value={formData.business_model} 
                onValueChange={(val) => updateFormData('business_model', val)}
              >
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
          </div>
        );
      case 'performance':
        return (
          <div className="space-y-6">
            <div>
              <Label>Annual revenue range</Label>
              <Select 
                value={formData.revenue_range} 
                onValueChange={(val) => updateFormData('revenue_range', val)}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="< $100K">Less than $100K</SelectItem>
                  <SelectItem value="$100K - $500K">$100K - $500K</SelectItem>
                  <SelectItem value="$500K - $1M">$500K - $1M</SelectItem>
                  <SelectItem value="$1M - $5M">$1M - $5M</SelectItem>
                  <SelectItem value="$5M - $10M">$5M - $10M</SelectItem>
                  <SelectItem value="$10M+">$10M+</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Customer count</Label>
              <Select 
                value={formData.customer_count} 
                onValueChange={(val) => updateFormData('customer_count', val)}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="< 10">Less than 10</SelectItem>
                  <SelectItem value="10-50">10-50</SelectItem>
                  <SelectItem value="50-100">50-100</SelectItem>
                  <SelectItem value="100-500">100-500</SelectItem>
                  <SelectItem value="500-1000">500-1000</SelectItem>
                  <SelectItem value="1000+">1000+</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>What's your primary growth challenge?</Label>
              <Textarea
                value={formData.growth_challenge || ''}
                onChange={(e) => updateFormData('growth_challenge', e.target.value)}
                placeholder="e.g., Scaling operations, customer acquisition, competition..."
                rows={4}
                className="mt-2"
              />
            </div>
          </div>
        );
      case 'team':
        return renderTeamStep();
      case 'growth':
        return (
          <div className="space-y-6">
            <div>
              <Label>What are your main growth goals? (Select all that apply)</Label>
              <div className="grid grid-cols-2 gap-3 mt-2">
                {[
                  'Increase revenue',
                  'Expand market',
                  'Improve efficiency',
                  'Scale team',
                  'New products',
                  'Better margins'
                ].map(goal => (
                  <label key={goal} className="flex items-center gap-2 p-3 rounded-lg border cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={(formData.growth_goals || []).includes(goal)}
                      onChange={() => toggleArrayItem('growth_goals', goal)}
                    />
                    <span className="text-sm">{goal}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label>Are you considering expansion or exit?</Label>
              <RadioGroup 
                value={formData.exit_strategy} 
                onValueChange={(val) => updateFormData('exit_strategy', val)}
                className="mt-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="grow" id="exit-grow" />
                  <Label htmlFor="exit-grow">Focused on growth</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="expand" id="exit-expand" />
                  <Label htmlFor="exit-expand">Planning to expand</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="exit" id="exit-exit" />
                  <Label htmlFor="exit-exit">Considering exit/sale</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="maintain" id="exit-main" />
                  <Label htmlFor="exit-main">Maintain current size</Label>
                </div>
              </RadioGroup>
            </div>
          </div>
        );
      case 'tools':
        return renderToolsStep();
      case 'preferences':
        return renderPreferencesStep();
      default:
        return <div>Step content</div>;
    }
  };

  const renderTeamStep = () => (
    <div className="space-y-6">
      <div>
        <Label>Team size (including you)</Label>
        <Select 
          value={formData.team_size} 
          onValueChange={(val) => updateFormData('team_size', val)}
        >
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
        <Label>Are you hiring or planning to hire?</Label>
        <RadioGroup 
          value={formData.hiring_status} 
          onValueChange={(val) => updateFormData('hiring_status', val)}
          className="mt-2"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="actively" id="hire-active" />
            <Label htmlFor="hire-active">Actively hiring</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="planning" id="hire-plan" />
            <Label htmlFor="hire-plan">Planning to hire</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="not-now" id="hire-no" />
            <Label htmlFor="hire-no">Not at this time</Label>
          </div>
        </RadioGroup>
      </div>
    </div>
  );

  const renderToolsStep = () => (
    <div className="space-y-6">
      <div>
        <Label>What tools do you currently use? (Select all that apply)</Label>
        <div className="grid grid-cols-2 gap-3 mt-2">
          {[
            'Xero / QuickBooks',
            'HubSpot / CRM',
            'Slack / Teams',
            'Google Workspace',
            'Notion / Asana',
            'Stripe / Payment',
            'None yet',
            'Other'
          ].map(tool => (
            <label key={tool} className="flex items-center gap-2 p-3 rounded-lg border cursor-pointer hover:bg-gray-50">
              <input
                type="checkbox"
                checked={(formData.current_tools || []).includes(tool)}
                onChange={() => toggleArrayItem('current_tools', tool)}
              />
              <span className="text-sm">{tool}</span>
            </label>
          ))}
        </div>
      </div>
      <div>
        <Label>Website or social media (optional)</Label>
        <Input
          value={formData.website || ''}
          onChange={(e) => updateFormData('website', e.target.value)}
          placeholder="yoursite.com or @handle"
          className="mt-2"
        />
      </div>
    </div>
  );

  const renderPreferencesStep = () => (
    <div className="space-y-6">
      <div>
        <Label>How do you prefer to receive advice?</Label>
        <RadioGroup 
          value={formData.advice_style} 
          onValueChange={(val) => updateFormData('advice_style', val)}
          className="mt-2 space-y-3"
        >
          <div className="flex items-start space-x-2 p-3 rounded-lg border cursor-pointer hover:bg-gray-50">
            <RadioGroupItem value="concise" id="advice-concise" className="mt-1" />
            <Label htmlFor="advice-concise" className="cursor-pointer">
              <div className="font-medium">Quick & Concise</div>
              <div className="text-sm text-gray-500">Give me actionable bullet points</div>
            </Label>
          </div>
          <div className="flex items-start space-x-2 p-3 rounded-lg border cursor-pointer hover:bg-gray-50">
            <RadioGroupItem value="detailed" id="advice-detail" className="mt-1" />
            <Label htmlFor="advice-detail" className="cursor-pointer">
              <div className="font-medium">Detailed & Thorough</div>
              <div className="text-sm text-gray-500">Explain the reasoning and context</div>
            </Label>
          </div>
          <div className="flex items-start space-x-2 p-3 rounded-lg border cursor-pointer hover:bg-gray-50">
            <RadioGroupItem value="conversational" id="advice-conv" className="mt-1" />
            <Label htmlFor="advice-conv" className="cursor-pointer">
              <div className="font-medium">Conversational</div>
              <div className="text-sm text-gray-500">Like chatting with a business partner</div>
            </Label>
          </div>
        </RadioGroup>
      </div>
      <div>
        <Label>Time availability for implementation</Label>
        <Select 
          value={formData.time_availability} 
          onValueChange={(val) => updateFormData('time_availability', val)}
        >
          <SelectTrigger className="mt-2">
            <SelectValue placeholder="Select time availability" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="< 2 hours/week">Less than 2 hours/week</SelectItem>
            <SelectItem value="2-5 hours/week">2-5 hours/week</SelectItem>
            <SelectItem value="5-10 hours/week">5-10 hours/week</SelectItem>
            <SelectItem value="10-20 hours/week">10-20 hours/week</SelectItem>
            <SelectItem value="20+ hours/week">20+ hours/week</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-secondary)' }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--accent-primary)' }} />
      </div>
    );
  }

  const progress = currentStep === 0 ? 0 : Math.round((currentStep / (getTotalSteps() + 1)) * 100);
  const steps = getSteps();

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-secondary)' }}>
      {/* Header */}
      <div 
        className="border-b"
        style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-light)' }}
      >
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--accent-primary)' }}
            >
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Strategy Squad</h3>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Profile Setup</p>
            </div>
          </div>
          {currentStep > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Step {currentStep} of {getTotalSteps()}
              </span>
              <div className="w-32 h-2 rounded-full" style={{ background: 'var(--bg-tertiary)' }}>
                <div 
                  className="h-full rounded-full transition-all"
                  style={{ width: `${progress}%`, background: 'var(--accent-primary)' }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-6">
        <Card className="w-full max-w-2xl" style={{ background: 'var(--bg-card)' }}>
          <CardContent className="p-8">
            {/* Stage Selection */}
            {currentStep === 0 && !businessStage && (
              <div className="space-y-8">
                <div className="text-center">
                  <div 
                    className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                    style={{ background: 'var(--bg-tertiary)' }}
                  >
                    <Sparkles className="w-8 h-8" style={{ color: 'var(--accent-primary)' }} />
                  </div>
                  <h1 className="text-3xl font-serif mb-2" style={{ color: 'var(--text-primary)' }}>
                    Welcome to Strategy Squad! 👋
                  </h1>
                  <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
                    Let's build your personalised AI business advisor
                  </p>
                  <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>
                    This takes about 5-8 minutes. You can save and resume anytime.
                  </p>
                </div>

                <div>
                  <Label className="text-lg mb-4 block">What stage is your business at?</Label>
                  <div className="space-y-3">
                    {BUSINESS_STAGES.map((stage) => (
                      <button
                        key={stage.id}
                        onClick={() => handleStageSelect(stage.id)}
                        className="w-full text-left p-6 rounded-xl border-2 transition-all hover:border-opacity-100"
                        style={{ 
                          borderColor: 'var(--border-medium)',
                          background: 'var(--bg-primary)'
                        }}
                      >
                        <div className="flex items-start gap-4">
                          <div 
                            className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ background: `${stage.color}15` }}
                          >
                            <stage.icon className="w-6 h-6" style={{ color: stage.color }} />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                              {stage.label}
                            </h3>
                            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                              {stage.description}
                            </p>
                          </div>
                          <ArrowRight className="w-5 h-5 flex-shrink-0 mt-1" style={{ color: 'var(--text-muted)' }} />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Steps Content */}
            {currentStep > 0 && (
              <div className="space-y-8">
                {/* Step Title */}
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    {steps[currentStep - 1] && (
                      <>
                        <div 
                          className="w-10 h-10 rounded-xl flex items-center justify-center"
                          style={{ background: 'var(--bg-tertiary)' }}
                        >
                          <steps[currentStep - 1].icon className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
                        </div>
                        <div>
                          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                            Step {currentStep} of {getTotalSteps()}
                          </p>
                          <h2 className="text-2xl font-serif" style={{ color: 'var(--text-primary)' }}>
                            {steps[currentStep - 1].label}
                          </h2>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Step Form */}
                <div>
                  {renderStepContent()}
                </div>

                {/* Navigation */}
                <div className="flex items-center justify-between pt-6 border-t" style={{ borderColor: 'var(--border-light)' }}>
                  {currentStep > 1 ? (
                    <Button
                      onClick={handleBack}
                      variant="outline"
                      className="btn-secondary"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Back
                    </Button>
                  ) : (
                    <Button
                      onClick={() => {
                        setBusinessStage(null);
                        setCurrentStep(0);
                      }}
                      variant="outline"
                      className="btn-secondary"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Change Stage
                    </Button>
                  )}

                  <Button
                    onClick={handleNext}
                    disabled={saving}
                    className="btn-primary"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Completing...
                      </>
                    ) : currentStep === getTotalSteps() ? (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        Complete Setup
                      </>
                    ) : (
                      <>
                        Continue
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </Button>
                </div>

                {/* Save for Later */}
                <div className="text-center pt-4">
                  <button
                    onClick={() => {
                      saveProgress(formData, currentStep, businessStage);
                      toast.success('Progress saved! You can continue anytime.');
                      navigate('/dashboard');
                    }}
                    className="text-sm"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <Save className="w-4 h-4 inline mr-1" />
                    Save and continue later
                  </button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default OnboardingWizard;
