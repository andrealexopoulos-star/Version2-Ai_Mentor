import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { 
  Plug, Check, ExternalLink, Search, X,
  Lock, ArrowRight, Zap, AlertCircle
} from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { toast } from 'sonner';

const Integrations = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showModal, setShowModal] = useState(null);
  const [connecting, setConnecting] = useState(null);

  const categories = [
    { id: 'all', label: 'All' },
    { id: 'crm', label: 'CRM' },
    { id: 'accounting', label: 'Accounting' },
    { id: 'marketing', label: 'Marketing' },
    { id: 'productivity', label: 'Productivity' },
  ];

  const integrations = [
    {
      id: 'linkedin',
      name: 'LinkedIn',
      description: 'Import professional profiles and company data',
      category: 'marketing',
      logo: 'in',
      color: '#0A66C2',
      tier: 'free',
      popular: true
    },
    {
      id: 'hubspot',
      name: 'HubSpot',
      description: 'Sync contacts, deals, and customer data',
      category: 'crm',
      logo: 'HS',
      color: '#FF7A59',
      tier: 'pro',
      popular: true
    },
    {
      id: 'salesforce',
      name: 'Salesforce',
      description: 'CRM data, pipeline, and analytics',
      category: 'crm',
      logo: 'SF',
      color: '#00A1E0',
      tier: 'pro',
      popular: true
    },
    {
      id: 'xero',
      name: 'Xero',
      description: 'Financial data and accounting insights',
      category: 'accounting',
      logo: 'XE',
      color: '#13B5EA',
      tier: 'pro',
      popular: true
    },
    {
      id: 'myob',
      name: 'MYOB',
      description: 'Accounting and business management',
      category: 'accounting',
      logo: 'MY',
      color: '#6B21A8',
      tier: 'pro'
    },
    {
      id: 'quickbooks',
      name: 'QuickBooks',
      description: 'Bookkeeping and financial reports',
      category: 'accounting',
      logo: 'QB',
      color: '#2CA01C',
      tier: 'pro',
      popular: true
    },
    {
      id: 'google-analytics',
      name: 'Google Analytics',
      description: 'Website traffic and user behavior',
      category: 'marketing',
      logo: 'GA',
      color: '#E37400',
      tier: 'pro'
    },
    {
      id: 'slack',
      name: 'Slack',
      description: 'Team communication and notifications',
      category: 'productivity',
      logo: 'SL',
      color: '#4A154B',
      tier: 'free',
      popular: true
    },
    {
      id: 'notion',
      name: 'Notion',
      description: 'Docs, wikis, and project management',
      category: 'productivity',
      logo: 'NO',
      color: '#000000',
      tier: 'pro'
    },
    {
      id: 'stripe',
      name: 'Stripe',
      description: 'Payment data and revenue analytics',
      category: 'accounting',
      logo: 'ST',
      color: '#635BFF',
      tier: 'enterprise'
    },
  ];

  const filteredIntegrations = integrations.filter(integration => {
    const matchesSearch = integration.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          integration.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || integration.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleConnect = (integration) => {
    if (integration.tier === 'enterprise') {
      setShowModal({
        type: 'enterprise',
        integration
      });
    } else if (integration.tier === 'pro') {
      setShowModal({
        type: 'upgrade',
        integration
      });
    } else {
      // Free tier - show connecting flow
      setConnecting(integration.id);
      setTimeout(() => {
        setConnecting(null);
        setShowModal({
          type: 'coming-soon',
          integration
        });
      }, 1500);
    }
  };

  const closeModal = () => setShowModal(null);

  return (
    <DashboardLayout>
      <div className="space-y-8 max-w-6xl animate-fade-in">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Plug className="w-6 h-6" style={{ color: 'var(--accent-primary)' }} />
            <span className="badge badge-primary">
              <Zap className="w-3 h-3" />
              Power Up
            </span>
          </div>
          <h1 style={{ color: 'var(--text-primary)' }}>Integrations</h1>
          <p className="mt-2" style={{ color: 'var(--text-secondary)' }}>
            Connect your business tools for ultra-personalised AI insights
          </p>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search 
              className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5"
              style={{ color: 'var(--text-muted)' }}
            />
            <input
              type="text"
              placeholder="Search integrations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-premium pl-12"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                  selectedCategory === cat.id ? 'btn-primary' : 'btn-secondary'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Integration Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredIntegrations.map((integration) => (
            <div key={integration.id} className="integration-card">
              <div className="flex items-start gap-4 mb-4">
                <div 
                  className="integration-logo"
                  style={{ background: integration.color }}
                >
                  {integration.logo}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {integration.name}
                    </h4>
                    {integration.popular && (
                      <span 
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}
                      >
                        Popular
                      </span>
                    )}
                  </div>
                  <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                    {integration.description}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center justify-between pt-4" style={{ borderTop: '1px solid var(--border-light)' }}>
                {integration.tier !== 'free' && (
                  <span 
                    className="badge"
                    style={{ 
                      background: integration.tier === 'enterprise' ? 'rgba(255, 149, 0, 0.1)' : 'rgba(124, 58, 237, 0.1)',
                      color: integration.tier === 'enterprise' ? 'var(--accent-warning)' : 'var(--accent-secondary)'
                    }}
                  >
                    <Lock className="w-3 h-3" />
                    {integration.tier === 'enterprise' ? 'Enterprise' : 'Pro'}
                  </span>
                )}
                {integration.tier === 'free' && <div />}
                
                <Button 
                  onClick={() => handleConnect(integration)}
                  className={integration.tier === 'free' ? 'btn-primary text-sm py-2 px-4' : 'btn-secondary text-sm py-2 px-4'}
                  disabled={connecting === integration.id}
                >
                  {connecting === integration.id ? (
                    <>
                      <span className="animate-pulse">Connecting...</span>
                    </>
                  ) : (
                    integration.tier === 'free' ? 'Connect' : 'Upgrade'
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>

        {filteredIntegrations.length === 0 && (
          <div className="text-center py-16">
            <div 
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: 'var(--bg-tertiary)' }}
            >
              <Search className="w-8 h-8" style={{ color: 'var(--text-muted)' }} />
            </div>
            <h3 style={{ color: 'var(--text-primary)' }}>No integrations found</h3>
            <p className="mt-2" style={{ color: 'var(--text-muted)' }}>
              Try adjusting your search or filters
            </p>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button 
              onClick={closeModal}
              className="absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-100"
              style={{ color: 'var(--text-muted)' }}
            >
              <X className="w-5 h-5" />
            </button>
            
            {showModal.type === 'upgrade' && (
              <>
                <div 
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
                  style={{ background: showModal.integration.color }}
                >
                  <span className="text-white text-xl font-bold">{showModal.integration.logo}</span>
                </div>
                <h2 className="mb-2" style={{ color: 'var(--text-primary)' }}>
                  Upgrade to Connect {showModal.integration.name}
                </h2>
                <p className="mb-6" style={{ color: 'var(--text-secondary)' }}>
                  {showModal.integration.name} integration is available on the Professional plan. 
                  Upgrade to unlock all integrations and get personalised AI insights from your business data.
                </p>
                <div className="flex gap-3">
                  <Button onClick={closeModal} className="btn-secondary flex-1">
                    Maybe Later
                  </Button>
                  <Button onClick={() => navigate('/pricing')} className="btn-primary flex-1">
                    View Plans
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </>
            )}
            
            {showModal.type === 'enterprise' && (
              <>
                <div 
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
                  style={{ background: showModal.integration.color }}
                >
                  <span className="text-white text-xl font-bold">{showModal.integration.logo}</span>
                </div>
                <h2 className="mb-2" style={{ color: 'var(--text-primary)' }}>
                  Enterprise Integration
                </h2>
                <p className="mb-6" style={{ color: 'var(--text-secondary)' }}>
                  {showModal.integration.name} is available on our Enterprise plan. Contact our sales team to learn more about enterprise features and custom integrations.
                </p>
                <div className="flex gap-3">
                  <Button onClick={closeModal} className="btn-secondary flex-1">
                    Cancel
                  </Button>
                  <Button onClick={() => navigate('/pricing')} className="btn-primary flex-1">
                    Contact Sales
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </>
            )}
            
            {showModal.type === 'coming-soon' && (
              <>
                <div 
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
                  style={{ background: 'var(--bg-tertiary)' }}
                >
                  <AlertCircle className="w-8 h-8" style={{ color: 'var(--accent-primary)' }} />
                </div>
                <h2 className="mb-2" style={{ color: 'var(--text-primary)' }}>
                  Coming Soon!
                </h2>
                <p className="mb-6" style={{ color: 'var(--text-secondary)' }}>
                  We're working hard to bring {showModal.integration.name} integration to Strategy Squad. 
                  We'll notify you when it's ready!
                </p>
                <Button onClick={closeModal} className="btn-primary w-full">
                  Got It
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default Integrations;
