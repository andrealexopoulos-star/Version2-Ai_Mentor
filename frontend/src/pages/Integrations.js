import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { apiClient } from '../lib/api';
import { toast } from 'sonner';
import { 
  Plug, Check, ExternalLink, Search, X,
  Lock, ArrowRight, Zap, AlertCircle, CheckCircle2,
  LogOut, ShieldAlert
} from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';

const Integrations = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showModal, setShowModal] = useState(null);
  const [connecting, setConnecting] = useState(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [outlookStatus, setOutlookStatus] = useState({ 
    connected: false, 
    emails_synced: 0,
    connected_email: null,
    connected_name: null,
    user_email: null
  });

  // Handle URL parameters from OAuth callback
  useEffect(() => {
    const outlookConnected = searchParams.get('outlook_connected');
    const outlookError = searchParams.get('outlook_error');
    const jobId = searchParams.get('job_id');
    const connectedEmail = searchParams.get('connected_email');

    if (outlookConnected === 'true') {
      const message = connectedEmail 
        ? `Microsoft Outlook (${decodeURIComponent(connectedEmail)}) connected successfully!`
        : 'Microsoft Outlook connected successfully!';
      toast.success(message + ' Your AI is now analyzing your emails.');
      // Clear URL parameters
      setSearchParams({});
      // Refresh status
      checkOutlookStatus();
    } else if (outlookError) {
      const errorMessages = {
        'auth_failed': 'Failed to authenticate with Microsoft. Please try again.',
        'user_not_found': 'Your account was not found. Please ensure you are logged in.',
        'invalid_state': 'Security validation failed. Please try again.',
        'invalid_state_signature': 'Security signature mismatch. Please try connecting again.',
        'token_exchange_failed': 'Failed to complete Microsoft authentication. Please try again.',
      };
      toast.error(errorMessages[outlookError] || `Connection error: ${outlookError}`);
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    checkOutlookStatus();
  }, []);

  const checkOutlookStatus = async () => {
    try {
      const response = await apiClient.get('/outlook/status');
      setOutlookStatus(response.data);
    } catch (error) {
      // Not connected yet
    }
  };

  const categories = [
    { id: 'all', label: 'All' },
    { id: 'crm', label: 'CRM' },
    { id: 'financial', label: 'Financial' },
    { id: 'marketing', label: 'Marketing' },
    { id: 'communication', label: 'Email & Communication' },
  ];

  const integrations = [
    // Email & Communication (PRIORITY)
    {
      id: 'outlook',
      name: 'Microsoft Outlook',
      description: 'Read emails for AI context and client intelligence',
      category: 'communication',
      logo: 'OL',
      color: '#0078D4',
      tier: 'free',
      popular: true,
      isOutlook: true
    },
    // CRM
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
      id: 'pipedrive',
      name: 'Pipedrive',
      description: 'Sales CRM and pipeline management',
      category: 'crm',
      logo: 'PD',
      color: '#1A1A1A',
      tier: 'pro'
    },
    // Financial
    {
      id: 'xero',
      name: 'Xero',
      description: 'Financial data and accounting insights',
      category: 'financial',
      logo: 'XE',
      color: '#13B5EA',
      tier: 'pro',
      popular: true
    },
    {
      id: 'quickbooks',
      name: 'QuickBooks',
      description: 'Bookkeeping and financial reports',
      category: 'financial',
      logo: 'QB',
      color: '#2CA01C',
      tier: 'pro',
      popular: true
    },
    {
      id: 'myob',
      name: 'MYOB',
      description: 'Accounting and business management',
      category: 'financial',
      logo: 'MY',
      color: '#6B21A8',
      tier: 'pro'
    },
    {
      id: 'stripe',
      name: 'Stripe',
      description: 'Payment data and revenue analytics',
      category: 'financial',
      logo: 'ST',
      color: '#635BFF',
      tier: 'pro',
      popular: true
    },
    // Marketing
    {
      id: 'google-analytics',
      name: 'Google Analytics',
      description: 'Website traffic and user behavior',
      category: 'marketing',
      logo: 'GA',
      color: '#E37400',
      tier: 'pro',
      popular: true
    },
    {
      id: 'linkedin',
      name: 'LinkedIn',
      description: 'Professional network and lead generation',
      category: 'marketing',
      logo: 'LI',
      color: '#0A66C2',
      tier: 'pro',
      popular: true
    },
    {
      id: 'meta-ads',
      name: 'Meta Ads',
      description: 'Facebook and Instagram advertising data',
      category: 'marketing',
      logo: 'FB',
      color: '#1877F2',
      tier: 'pro'
    },
    // Email & Communication
    {
      id: 'mailchimp',
      name: 'Mailchimp',
      description: 'Email marketing campaigns and analytics',
      category: 'communication',
      logo: 'MC',
      color: '#FFE01B',
      tier: 'free',
      popular: true
    },
    {
      id: 'sendgrid',
      name: 'SendGrid',
      description: 'Transactional email and delivery tracking',
      category: 'communication',
      logo: 'SG',
      color: '#1A82E2',
      tier: 'pro'
    },
    {
      id: 'slack',
      name: 'Slack',
      description: 'Team communication and notifications',
      category: 'communication',
      logo: 'SL',
      color: '#4A154B',
      tier: 'free',
      popular: true
    },
  ];

  const filteredIntegrations = integrations.filter(integration => {
    const matchesSearch = integration.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          integration.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || integration.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleConnect = (integration) => {
    // Special handling for Outlook
    if (integration.isOutlook || integration.id === 'outlook') {
      handleOutlookConnect();
      return;
    }
    
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

  const handleOutlookConnect = async () => {
    try {
      console.log('Starting Outlook connection...');
      const response = await apiClient.get('/auth/outlook/login');
      console.log('Got auth URL:', response.data);
      
      if (response.data && response.data.auth_url) {
        console.log('Redirecting to:', response.data.auth_url);
        window.location.href = response.data.auth_url;
      } else {
        toast.error('No auth URL received from server');
        console.error('Invalid response:', response.data);
      }
    } catch (error) {
      console.error('Outlook connection error:', error);
      toast.error('Failed to initiate Outlook connection: ' + (error.message || 'Unknown error'));
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

        {/* Connected Business Tools Section */}
        {outlookStatus.connected && (
          <div className="card p-6" style={{ background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.05) 0%, var(--bg-card) 100%)', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
              <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                Connected Business Tools
              </h2>
            </div>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
              Your AI has access to these tools for deeper business intelligence
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {outlookStatus.connected && (
                <div className="flex items-center gap-4 p-4 rounded-xl" style={{ background: 'var(--bg-tertiary)' }}>
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: '#0078D4' }}>
                    <span className="text-white font-bold text-lg">OL</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Microsoft Outlook</h3>
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" title="Connected"></div>
                    </div>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {outlookStatus.emails_synced} emails synced • AI intelligence active
                    </p>
                  </div>
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                </div>
              )}
            </div>
          </div>
        )}

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
          {filteredIntegrations.map((integration) => {
            const isConnected = integration.id === 'outlook' && outlookStatus.connected;
            
            return (
              <div key={integration.id} className={`integration-card ${isConnected ? 'border-2 border-green-500' : ''}`}>
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
                    {isConnected && (
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-xs font-medium text-green-700">Connected</span>
                      </div>
                    )}
                    {integration.popular && !isConnected && (
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
                  className={isConnected ? 'btn-secondary text-sm py-2 px-4' : integration.tier === 'free' ? 'btn-primary text-sm py-2 px-4' : 'btn-secondary text-sm py-2 px-4'}
                  disabled={connecting === integration.id || isConnected}
                >
                  {isConnected ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-1" />
                      Connected
                    </>
                  ) : connecting === integration.id ? (
                    <>
                      <span className="animate-pulse">Connecting...</span>
                    </>
                  ) : (
                    integration.tier === 'free' ? 'Connect' : 'Upgrade'
                  )}
                </Button>
              </div>
            </div>
          );
          })}
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
                  We&apos;re working hard to bring {showModal.integration.name} integration to Strategy Squad.
                  We&apos;ll notify you when it&apos;s ready!
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
