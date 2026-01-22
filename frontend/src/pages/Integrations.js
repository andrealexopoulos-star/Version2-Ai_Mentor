import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { apiClient } from '../lib/api';
import { supabase } from '../context/SupabaseAuthContext';
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
    user_email: null,
    needs_reconnect: false // Track if reconnection required
  });

  // Handle URL parameters from OAuth callback
  useEffect(() => {
    const outlookConnected = searchParams.get('outlook_connected');
    const outlookError = searchParams.get('outlook_error');
    const jobId = searchParams.get('job_id');
    const connectedEmail = searchParams.get('connected_email');

    if (outlookConnected === 'true') {
      console.log('✅ Outlook OAuth completed successfully - setting optimistic connected state');
      
      // OPTIMISTIC UPDATE: Immediately show as connected
      setOutlookStatus(prev => ({
        ...prev,
        connected: true,
        emails_synced: prev.emails_synced || 0
      }));
      
      const message = connectedEmail 
        ? `Microsoft Outlook (${decodeURIComponent(connectedEmail)}) connected successfully!`
        : 'Microsoft Outlook connected successfully!';
      toast.success(message + ' Your AI is now analyzing your emails.');
      
      // Clear URL parameters
      setSearchParams({});
      
      // Background: Refresh actual status from backend to reconcile
      setTimeout(() => {
        console.log('🔄 Reconciling Outlook status with backend...');
        checkOutlookStatus();
      }, 2000);
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
      console.log('📊 Backend Outlook status:', response.data);
      
      // If backend says not connected but we have optimistic state, mark as needs_reconnect
      if (!response.data.connected && outlookStatus.connected) {
        console.log('⚠️ Backend reports disconnected - token may have expired');
        setOutlookStatus({
          ...response.data,
          needs_reconnect: true
        });
      } else {
        setOutlookStatus({
          ...response.data,
          needs_reconnect: false
        });
      }
    } catch (error) {
      console.log('⚠️ Could not fetch Outlook status - user may not be connected yet');
      // Don't overwrite optimistic state on error
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
    setConnecting('outlook');
    try {
      // Get current Supabase session to ensure user is authenticated
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session || !session.access_token) {
        toast.error('Please log in to connect Outlook');
        setConnecting(null);
        return;
      }

      // Use Supabase Edge Function for Outlook OAuth
      // The Edge Function handles the Microsoft OAuth flow
      const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
      const outlookAuthUrl = `${supabaseUrl}/functions/v1/outlook-auth/start?state=${session.access_token}`;
      
      console.log('Redirecting to Microsoft Outlook OAuth via Supabase Edge Function');
      
      // Redirect to Supabase Edge Function which initiates Microsoft OAuth
      window.location.href = outlookAuthUrl;
      
    } catch (error) {
      console.error('Outlook connection error:', error);
      toast.error('Failed to connect Outlook. Please try again.');
      setConnecting(null);
    }
  };

  const handleOutlookDisconnect = async () => {
    if (!window.confirm(`Are you sure you want to disconnect Microsoft Outlook (${outlookStatus.connected_email})?\n\nThis will remove all synced emails and calendar data from your Strategy Squad account.`)) {
      return;
    }
    
    setDisconnecting(true);
    try {
      const response = await apiClient.post('/outlook/disconnect');
      toast.success(response.data.message || 'Outlook disconnected successfully');
      setOutlookStatus({ 
        connected: false, 
        emails_synced: 0,
        connected_email: null,
        connected_name: null,
        user_email: null
      });
    } catch (error) {
      console.error('Disconnect error:', error);
      toast.error('Failed to disconnect Outlook: ' + (error.response?.data?.detail || error.message));
    } finally {
      setDisconnecting(false);
    }
  };

  const closeModal = () => setShowModal(null);

  return (
    <DashboardLayout>
      <div className="space-y-6 sm:space-y-8 max-w-6xl animate-fade-in">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 sm:gap-3 mb-2 flex-wrap">
            <Plug className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: 'var(--accent-primary)' }} />
            <span className="badge badge-primary text-xs sm:text-sm">
              <Zap className="w-3 h-3" />
              Power Up
            </span>
          </div>
          <h1 style={{ color: 'var(--text-primary)' }}>Integrations</h1>
          <p className="mt-2 text-sm sm:text-base" style={{ color: 'var(--text-secondary)' }}>
            Connect your business tools for ultra-personalised AI insights
          </p>
        </div>

        {/* Connected Business Tools Section */}
        {outlookStatus.connected && (
          <div className="card p-4 sm:p-6" style={{ background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.05) 0%, var(--bg-card) 100%)', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
            <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
              <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
              <h2 className="text-lg sm:text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                Connected Tools
              </h2>
            </div>
            <p className="text-xs sm:text-sm mb-3 sm:mb-4" style={{ color: 'var(--text-secondary)' }}>
              Your AI has access to these tools for deeper business intelligence
            </p>
            <div className="grid grid-cols-1 gap-3 sm:gap-4">
              {outlookStatus.connected && (
                <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl" style={{ background: 'var(--bg-tertiary)' }}>
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#0078D4' }}>
                      <span className="text-white font-bold text-base sm:text-lg">OL</span>
                    </div>
                    <div className="flex-1 min-w-0 sm:hidden">
                      <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Microsoft Outlook</h3>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-xs text-green-600">Connected</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 hidden sm:block">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Microsoft Outlook</h3>
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" title="Connected"></div>
                    </div>
                    {outlookStatus.connected_email && (
                      <p className="text-sm font-medium mt-1" style={{ color: 'var(--text-primary)' }}>
                        {outlookStatus.connected_email}
                      </p>
                    )}
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                      {outlookStatus.emails_synced} emails synced • AI intelligence active
                    </p>
                    {outlookStatus.connected_email && outlookStatus.user_email && 
                     outlookStatus.connected_email.toLowerCase() !== outlookStatus.user_email.toLowerCase() && (
                      <div className="flex items-center gap-2 mt-2 p-2 rounded-lg" style={{ background: 'rgba(251, 191, 36, 0.1)' }}>
                        <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0" />
                        <p className="text-xs text-amber-700">
                          Note: This Microsoft account ({outlookStatus.connected_email}) is different from your Strategy Squad account ({outlookStatus.user_email})
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <Button 
                      onClick={handleOutlookDisconnect}
                      disabled={disconnecting}
                      className="btn-secondary text-sm py-1.5 px-3"
                      title="Disconnect Outlook"
                    >
                      {disconnecting ? (
                        <span className="animate-pulse">...</span>
                      ) : (
                        <LogOut className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {filteredIntegrations.map((integration) => {
            const isConnected = integration.id === 'outlook' && outlookStatus.connected;
            const needsReconnect = integration.id === 'outlook' && outlookStatus.needs_reconnect;
            
            return (
              <div key={integration.id} className={`integration-card ${isConnected ? 'border-2 border-green-500' : needsReconnect ? 'border-2 border-orange-400' : ''}`}>
              <div className="flex items-start gap-3 sm:gap-4 mb-3 sm:mb-4">
                <div 
                  className="integration-logo"
                  style={{ background: integration.color }}
                >
                  {integration.logo}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-semibold text-sm sm:text-base" style={{ color: 'var(--text-primary)' }}>
                      {integration.name}
                    </h4>
                    {isConnected && (
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-xs font-medium text-green-700">Connected</span>
                      </div>
                    )}
                    {needsReconnect && (
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-100">
                        <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                        <span className="text-xs font-medium text-orange-700">Reconnect Required</span>
                      </div>
                    )}
                    {integration.popular && !isConnected && (
                      <span 
                        className="text-xs px-2 py-0.5 rounded-full hidden sm:inline-block"
                        style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}
                      >
                        Popular
                      </span>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                    {integration.description}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center justify-between pt-3 sm:pt-4" style={{ borderTop: '1px solid var(--border-light)' }}>
                {integration.tier !== 'free' && (
                  <span 
                    className="badge text-xs"
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
                  className={`text-xs sm:text-sm py-2 px-3 sm:px-4 ${
                    isConnected ? 'btn-secondary' : 
                    needsReconnect ? 'btn-warning' :
                    integration.tier === 'free' ? 'btn-primary' : 'btn-secondary'
                  }`}
                  disabled={connecting === integration.id}
                >
                  {isConnected ? (
                    <>
                      <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                      <span className="hidden sm:inline">Connected</span>
                      <span className="sm:hidden">✓</span>
                    </>
                  ) : needsReconnect ? (
                    <>
                      <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                      <span>Reconnect</span>
                    </>
                  ) : connecting === integration.id ? (
                    <span className="animate-pulse">Connecting...</span>
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
