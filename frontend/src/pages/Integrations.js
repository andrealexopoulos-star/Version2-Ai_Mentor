import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { 
  Plug, Check, ExternalLink, Search, Zap, 
  Lock, ArrowRight, Sparkles, Building2
} from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';

const Integrations = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const categories = [
    { id: 'all', label: 'All' },
    { id: 'crm', label: 'CRM' },
    { id: 'accounting', label: 'Accounting' },
    { id: 'marketing', label: 'Marketing' },
    { id: 'social', label: 'Social' },
    { id: 'productivity', label: 'Productivity' },
  ];

  const integrations = [
    {
      id: 'linkedin',
      name: 'LinkedIn',
      description: 'Import professional profiles and company data',
      category: 'social',
      logo: 'LI',
      logoColor: 'from-blue-600 to-blue-700',
      connected: false,
      popular: true,
      tier: 'free'
    },
    {
      id: 'hubspot',
      name: 'HubSpot',
      description: 'Sync contacts, deals, and customer data',
      category: 'crm',
      logo: 'HS',
      logoColor: 'from-orange-500 to-red-500',
      connected: false,
      popular: true,
      tier: 'professional'
    },
    {
      id: 'salesforce',
      name: 'Salesforce',
      description: 'CRM data, pipeline, and analytics',
      category: 'crm',
      logo: 'SF',
      logoColor: 'from-blue-400 to-cyan-500',
      connected: false,
      popular: true,
      tier: 'professional'
    },
    {
      id: 'xero',
      name: 'Xero',
      description: 'Financial data and accounting insights',
      category: 'accounting',
      logo: 'XE',
      logoColor: 'from-cyan-500 to-blue-500',
      connected: false,
      popular: true,
      tier: 'professional'
    },
    {
      id: 'myob',
      name: 'MYOB',
      description: 'Accounting and business management',
      category: 'accounting',
      logo: 'MY',
      logoColor: 'from-purple-500 to-indigo-500',
      connected: false,
      tier: 'professional'
    },
    {
      id: 'quickbooks',
      name: 'QuickBooks',
      description: 'Bookkeeping and financial reports',
      category: 'accounting',
      logo: 'QB',
      logoColor: 'from-green-500 to-emerald-500',
      connected: false,
      popular: true,
      tier: 'professional'
    },
    {
      id: 'google-analytics',
      name: 'Google Analytics',
      description: 'Website traffic and user behavior',
      category: 'marketing',
      logo: 'GA',
      logoColor: 'from-orange-400 to-yellow-500',
      connected: false,
      tier: 'professional'
    },
    {
      id: 'mailchimp',
      name: 'Mailchimp',
      description: 'Email marketing campaigns and analytics',
      category: 'marketing',
      logo: 'MC',
      logoColor: 'from-yellow-400 to-yellow-500',
      connected: false,
      tier: 'professional'
    },
    {
      id: 'slack',
      name: 'Slack',
      description: 'Team communication and notifications',
      category: 'productivity',
      logo: 'SL',
      logoColor: 'from-purple-500 to-pink-500',
      connected: false,
      tier: 'free'
    },
    {
      id: 'notion',
      name: 'Notion',
      description: 'Docs, wikis, and project management',
      category: 'productivity',
      logo: 'NO',
      logoColor: 'from-gray-700 to-gray-900',
      connected: false,
      tier: 'professional'
    },
    {
      id: 'stripe',
      name: 'Stripe',
      description: 'Payment data and revenue analytics',
      category: 'accounting',
      logo: 'ST',
      logoColor: 'from-indigo-500 to-purple-600',
      connected: false,
      tier: 'enterprise'
    },
    {
      id: 'shopify',
      name: 'Shopify',
      description: 'E-commerce sales and inventory',
      category: 'crm',
      logo: 'SH',
      logoColor: 'from-green-400 to-lime-500',
      connected: false,
      tier: 'professional'
    },
  ];

  const filteredIntegrations = integrations.filter(integration => {
    const matchesSearch = integration.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          integration.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || integration.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getTierBadge = (tier) => {
    if (tier === 'enterprise') return { label: 'Enterprise', class: 'badge-enterprise' };
    if (tier === 'professional') return { label: 'Pro', class: 'badge-pro' };
    return null;
  };

  const handleConnect = (integration) => {
    // For now, show upgrade modal for paid tiers
    if (integration.tier !== 'free') {
      // Would show upgrade modal
      navigate('/pricing');
    } else {
      // Would initiate OAuth flow
      alert(`Connecting to ${integration.name}... (OAuth flow would start here)`);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 space-y-8 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Plug className="w-6 h-6" style={{ color: 'var(--accent-primary)' }} />
              <span className="badge-modern badge-connected">
                <Sparkles className="w-3 h-3" />
                New
              </span>
            </div>
            <h1 className="font-heading text-3xl lg:text-4xl font-bold" style={{ color: 'var(--text-primary)' }}>
              Integrations
            </h1>
            <p className="mt-2" style={{ color: 'var(--text-secondary)' }}>
              Connect your business tools to unlock ultra-personalized AI insights
            </p>
          </div>
        </div>

        {/* Info Banner */}
        <div 
          className="p-6 rounded-2xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4"
          style={{ 
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)',
            border: '1px solid rgba(99, 102, 241, 0.2)'
          }}
        >
          <div className="flex items-start gap-4">
            <div 
              className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--gradient-primary)' }}
            >
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                Supercharge Your AI Advisor
              </h3>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                The more data your AI has, the better advice it can give. Connect your tools to get insights 
                based on your real business metrics, not generic advice.
              </p>
            </div>
          </div>
          <Button 
            className="btn-modern-primary flex-shrink-0"
            onClick={() => navigate('/advisor')}
          >
            Try AI Advisor
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search integrations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-modern w-full pl-12"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 lg:pb-0">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                  selectedCategory === cat.id
                    ? 'text-white'
                    : ''
                }`}
                style={{
                  background: selectedCategory === cat.id ? 'var(--gradient-primary)' : 'var(--bg-tertiary)',
                  color: selectedCategory === cat.id ? 'white' : 'var(--text-secondary)'
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Connected Integrations */}
        {integrations.some(i => i.connected) && (
          <div>
            <h2 className="font-heading text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
              Connected
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {integrations.filter(i => i.connected).map((integration) => (
                <div key={integration.id} className="integration-card connected">
                  <div className="flex items-start gap-4">
                    <div className={`integration-logo bg-gradient-to-br ${integration.logoColor} text-white`}>
                      {integration.logo}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {integration.name}
                        </h3>
                        <span className="badge-modern badge-connected">
                          <Check className="w-3 h-3" />
                          Connected
                        </span>
                      </div>
                      <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                        {integration.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-4 pt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      Last synced: Just now
                    </span>
                    <Button variant="ghost" size="sm" className="btn-modern-ghost">
                      Settings
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Available Integrations */}
        <div>
          <h2 className="font-heading text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
            Available Integrations
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredIntegrations.filter(i => !i.connected).map((integration) => {
              const tierBadge = getTierBadge(integration.tier);
              return (
                <div key={integration.id} className="integration-card">
                  <div className="flex items-start gap-4">
                    <div className={`integration-logo bg-gradient-to-br ${integration.logoColor} text-white`}>
                      {integration.logo}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {integration.name}
                        </h3>
                        {integration.popular && (
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                            Popular
                          </span>
                        )}
                        {tierBadge && (
                          <span className={`badge-modern ${tierBadge.class}`}>
                            <Lock className="w-3 h-3" />
                            {tierBadge.label}
                          </span>
                        )}
                      </div>
                      <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                        {integration.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-4 pt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <a 
                      href="#" 
                      className="text-xs flex items-center gap-1 hover:underline"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      Learn more <ExternalLink className="w-3 h-3" />
                    </a>
                    <Button 
                      onClick={() => handleConnect(integration)}
                      className={integration.tier === 'free' ? 'btn-modern-primary' : 'btn-modern-secondary'}
                      size="sm"
                    >
                      {integration.tier === 'free' ? 'Connect' : 'Upgrade to Connect'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Custom Integration Request */}
        <div 
          className="p-6 rounded-2xl text-center"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
        >
          <Building2 className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
          <h3 className="font-heading font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>
            Need a different integration?
          </h3>
          <p className="mt-2 max-w-md mx-auto" style={{ color: 'var(--text-secondary)' }}>
            We're constantly adding new integrations. Let us know what tools you use and we'll prioritize them.
          </p>
          <Button className="btn-modern-secondary mt-4">
            Request Integration
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Integrations;
