import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { apiClient } from '../lib/api';
import { supabase } from '../context/SupabaseAuthContext';
import { toast } from 'sonner';
import { 
  Plug, Check, ExternalLink, Search, X,
  Lock, ArrowRight, Zap, AlertCircle, CheckCircle2,
  LogOut, ShieldAlert, RefreshCw, ChevronRight, Sparkles
} from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { useMergeLink } from '@mergeapi/react-merge-link';

/**
 * CANONICAL INTEGRATION STATE RESOLVER
 * 
 * Implements strict precedence rules for integration connection state:
 * 
 * EMAIL (Outlook / Gmail):
 *   1. Direct Edge Function connections (PRIMARY)
 *   2. Merge.dev email connections (SUPPRESSED if Edge exists)
 * 
 * CRM / FINANCE / HR / ATS:
 *   1. Merge.dev connections ONLY
 * 
 * Returns: { connected: boolean, source: 'edge' | 'merge' | null }
 */
const resolveIntegrationState = (integration, outlookStatus, gmailStatus, mergeIntegrations) => {
  const integrationId = integration.id?.toLowerCase();
  const integrationName = integration.name?.toLowerCase();
  
  // EMAIL CATEGORY: Edge Functions take absolute precedence
  if (integration.isOutlook || integrationId === 'outlook') {
    if (outlookStatus.connected) {
      return { connected: true, source: 'edge' };
    }
    // Do NOT check Merge for Outlook if Edge is the canonical source
    return { connected: false, source: null };
  }
  
  if (integration.isGmail || integrationId === 'gmail') {
    if (gmailStatus.connected) {
      return { connected: true, source: 'edge' };
    }
    // Do NOT check Merge for Gmail if Edge is the canonical source
    return { connected: false, source: null };
  }
  
  // CRM / FINANCE / HR / ATS: Merge.dev is the ONLY source
  if (integration.viaMerge) {
    const mergeConnected = mergeIntegrations[integrationId] || 
                          mergeIntegrations[integrationName];
    if (mergeConnected) {
      return { connected: true, source: 'merge' };
    }
    return { connected: false, source: null };
  }
  
  // Default: not connected
  return { connected: false, source: null };
};

const Integrations = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('connected-apps'); // 'connected-apps' or 'intelligence-sources'
  const [selectedCategory, setSelectedCategory] = useState(null); // null = no category selected
  const [selectedIntegration, setSelectedIntegration] = useState(null); // For detail panel
  const [connecting, setConnecting] = useState(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [mergeIntegrations, setMergeIntegrations] = useState({});
  
  // Merge Link integration
  const [mergeLinkToken, setMergeLinkToken] = useState(null);
  const { open: openMergeLinkModal, isReady: mergeLinkReady } = useMergeLink({
    linkToken: mergeLinkToken,
    onSuccess: async (public_token, metadata) => {
      console.log('✅ Merge onboarding success', { public_token, metadata });
      const category = metadata?.category || 'crm';
      const provider = metadata?.integration?.name || 'unknown';
      
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session || !session.access_token) {
          console.error('❌ No active session for token exchange');
          toast.error('Session expired. Please log in again.');
          setMergeLinkToken(null);
          return;
        }
        
        console.log('🔄 Exchanging token...', { category, provider });
        
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/integrations/merge/exchange-account-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: new URLSearchParams({
            public_token,
            category
          })
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log('✅ Token exchange successful:', result);
          toast.success(`${provider} connected successfully!`);
          await checkMergeIntegrations();
          setSelectedIntegration(null); // Close detail panel
        } else {
          const errorText = await response.text();
          console.error('❌ Token exchange failed:', response.status, errorText);
          try {
            const error = JSON.parse(errorText);
            toast.error(`Failed to connect ${provider}: ${error.detail || 'Unknown error'}`);
          } catch {
            toast.error(`Failed to connect ${provider}: Server error (${response.status})`);
          }
        }
      } catch (error) {
        console.error('❌ Error during token exchange:', error);
        toast.error(`Failed to connect ${provider}: ${error.message}`);
      }
      
      setMergeLinkToken(null);
    },
    onExit: (error) => {
      if (error) {
        console.error('❌ Merge onboarding error:', error);
        toast.error(`Connection failed: ${error.message || 'Unknown error'}`);
      } else {
        console.log('ℹ️ Merge onboarding exited by user');
      }
      setMergeLinkToken(null);
    }
  });
  
  const [outlookStatus, setOutlookStatus] = useState({ 
    connected: false, 
    emails_synced: 0,
    connected_email: null,
    connected_name: null,
    user_email: null,
    needs_reconnect: false
  });
  const [gmailStatus, setGmailStatus] = useState({
    connected: false,
    labels_count: 0,
    inbox_type: null,
    connected_email: null,
    needs_reconnect: false,
    testing: false
  });

  // Handle URL parameters from OAuth callback
  useEffect(() => {
    const outlookConnected = searchParams.get('outlook_connected');
    const outlookError = searchParams.get('outlook_error');
    const gmailConnected = searchParams.get('gmail_connected');
    const gmailError = searchParams.get('gmail_error');
    const connectedEmail = searchParams.get('connected_email');

    if (gmailConnected === 'true') {
      console.log('✅ Gmail OAuth completed successfully');
      const message = connectedEmail 
        ? `Gmail (${decodeURIComponent(connectedEmail)}) connected successfully!`
        : 'Gmail connected successfully!';
      toast.success(message);
      setSearchParams({});
      setTimeout(() => {
        checkGmailStatus();
      }, 2000);
    } else if (gmailError) {
      const errorMessages = {
        'auth_failed': 'Failed to authenticate with Google. Please try again.',
        'invalid_state': 'Security validation failed. Please try again.',
        'invalid_state_signature': 'Security signature mismatch. Please try connecting again.',
        'token_exchange_failed': 'Failed to complete Google authentication. Please try again.',
        'no_access_token': 'Failed to obtain Gmail access token. Please try again.',
        'storage_failed': 'Failed to save Gmail connection. Please try again.',
      };
      toast.error(errorMessages[gmailError] || `Connection error: ${gmailError}`);
      setSearchParams({});
    }

    if (outlookConnected === 'true') {
      console.log('✅ Outlook OAuth completed successfully');
      setOutlookStatus(prev => ({
        ...prev,
        connected: true,
        emails_synced: prev.emails_synced || 0
      }));
      const message = connectedEmail 
        ? `Microsoft Outlook (${decodeURIComponent(connectedEmail)}) connected successfully!`
        : 'Microsoft Outlook connected successfully!';
      toast.success(message);
      setSearchParams({});
      setTimeout(() => {
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
    checkGmailStatus();
    checkMergeIntegrations();
  }, []);

  const checkMergeIntegrations = async () => {
    try {
      const response = await apiClient.get('/integrations/merge/connected');
      const integrations = response.data?.integrations || {};
      console.log('📊 Connected Merge integrations:', integrations);
      setMergeIntegrations(integrations);
    } catch (error) {
      console.warn('⚠️ Could not fetch Merge integrations:', error);
      setMergeIntegrations({});
    }
  };

  const checkOutlookStatus = async () => {
    try {
      const response = await apiClient.get('/outlook/status');
      console.log('📊 Outlook status:', response.data);
      
      if (response.data.degraded) {
        console.log('⚠️ Outlook status check degraded');
        setOutlookStatus(prev => ({
          ...prev,
          health_check_failed: true
        }));
        return;
      }
      
      setOutlookStatus({
        ...response.data,
        needs_reconnect: false,
        health_check_failed: false
      });
    } catch (error) {
      console.warn('⚠️ Outlook status check failed:', error);
      setOutlookStatus(prev => ({
        ...prev,
        health_check_failed: true
      }));
    }
  };

  const checkGmailStatus = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session || !session.access_token) {
        setGmailStatus({
          connected: false,
          labels_count: 0,
          inbox_type: null,
          connected_email: null,
          needs_reconnect: false,
          testing: false
        });
        return;
      }

      const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
      const edgeFunctionUrl = `${supabaseUrl}/functions/v1/gmail_prod`;
      
      const response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        setGmailStatus({
          connected: false,
          labels_count: 0,
          inbox_type: null,
          connected_email: null,
          needs_reconnect: false,
          testing: false
        });
        return;
      }

      const data = await response.json();

      if (data.ok && data.connected) {
        setGmailStatus({
          connected: true,
          labels_count: data.labels_count || 0,
          inbox_type: data.inbox_type || 'standard',
          connected_email: session.user?.email || null,
          needs_reconnect: false,
          testing: false
        });
      } else {
        setGmailStatus({
          connected: false,
          labels_count: 0,
          inbox_type: null,
          connected_email: null,
          needs_reconnect: false,
          testing: false
        });
      }
    } catch (error) {
      console.error('⚠️ Could not fetch Gmail status:', error);
      setGmailStatus({
        connected: false,
        labels_count: 0,
        inbox_type: null,
        connected_email: null,
        needs_reconnect: false,
        testing: false
      });
    }
  };

  // Categories for navigation
  const categories = [
    { id: 'crm', label: 'CRM', icon: '👥' },
    { id: 'communication', label: 'Email & Communication', icon: '✉️' },
    { id: 'financial', label: 'Financial', icon: '💰' },
    { id: 'hris', label: 'HRIS', icon: '👔' },
    { id: 'ats', label: 'ATS', icon: '📋' },
    { id: 'knowledge', label: 'Knowledge Base', icon: '📚' }
  ];

  const integrations = [
    // Email & Communication
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
    {
      id: 'gmail',
      name: 'Gmail',
      description: 'Read emails for AI context and client intelligence',
      category: 'communication',
      logo: 'GM',
      color: '#EA4335',
      tier: 'free',
      popular: true,
      isGmail: true
    },
    // CRM
    {
      id: 'hubspot',
      name: 'HubSpot',
      description: 'Sync contacts, deals, and customer data',
      category: 'crm',
      logo: 'HS',
      color: '#FF7A59',
      tier: 'free',
      popular: true,
      viaMerge: true
    },
    {
      id: 'salesforce',
      name: 'Salesforce',
      description: 'CRM data, pipeline, and analytics',
      category: 'crm',
      logo: 'SF',
      color: '#00A1E0',
      tier: 'free',
      popular: true,
      viaMerge: true
    },
    {
      id: 'pipedrive',
      name: 'Pipedrive',
      description: 'Sales CRM and pipeline management',
      category: 'crm',
      logo: 'PD',
      color: '#1A1A1A',
      tier: 'free',
      viaMerge: true
    },
    // Financial
    {
      id: 'xero',
      name: 'Xero',
      description: 'Financial data and accounting insights',
      category: 'financial',
      logo: 'XE',
      color: '#13B5EA',
      tier: 'free',
      popular: true,
      viaMerge: true
    },
    {
      id: 'quickbooks',
      name: 'QuickBooks',
      description: 'Bookkeeping and financial reports',
      category: 'financial',
      logo: 'QB',
      color: '#2CA01C',
      tier: 'free',
      popular: true,
      viaMerge: true
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
  ];

  // Filter integrations by category
  const filteredIntegrations = integrations.filter(integration => {
    const matchesSearch = integration.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          integration.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === null || integration.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Get connected count using the resolver
  const connectedCount = integrations.filter(int => {
    const state = resolveIntegrationState(int, outlookStatus, gmailStatus, mergeIntegrations);
    return state.connected;
  }).length;

  const handleConnect = (integration) => {
    if (integration.isOutlook || integration.id === 'outlook') {
      handleOutlookConnect();
      return;
    }
    
    if (integration.isGmail || integration.id === 'gmail') {
      handleGmailConnect();
      return;
    }
    
    if (integration.viaMerge) {
      openMergeLink();
      return;
    }
    
    if (integration.tier === 'pro' || integration.tier === 'enterprise') {
      toast.info(`${integration.name} requires an upgrade. Contact support for details.`);
      return;
    }
    
    setConnecting(integration.id);
    setTimeout(() => {
      setConnecting(null);
      toast.info(`${integration.name} integration coming soon!`);
    }, 1500);
  };

  const handleOutlookConnect = () => {
    setConnecting('outlook');
    window.location.assign(`${process.env.REACT_APP_BACKEND_URL}/api/auth/outlook/login?returnTo=/integrations`);
  };

  const handleOutlookDisconnect = async () => {
    if (!window.confirm(`Disconnect Microsoft Outlook (${outlookStatus.connected_email})?`)) {
      return;
    }
    
    setDisconnecting(true);
    try {
      const response = await apiClient.post('/outlook/disconnect');
      toast.success(response.data.message || 'Outlook disconnected');
      setOutlookStatus({ 
        connected: false, 
        emails_synced: 0,
        connected_email: null,
        connected_name: null,
        user_email: null
      });
    } catch (error) {
      toast.error('Failed to disconnect: ' + (error.response?.data?.detail || error.message));
    } finally {
      setDisconnecting(false);
    }
  };

  const handleGmailConnect = () => {
    setConnecting('gmail');
    window.location.assign(`${process.env.REACT_APP_BACKEND_URL}/api/auth/gmail/login?returnTo=/integrations`);
  };

  const handleGmailDisconnect = async () => {
    if (!window.confirm(`Disconnect Gmail (${gmailStatus.connected_email})?`)) {
      return;
    }
    
    setDisconnecting(true);
    try {
      const response = await apiClient.post('/gmail/disconnect');
      toast.success(response.data.message || 'Gmail disconnected');
      setGmailStatus({
        connected: false,
        labels_count: 0,
        inbox_type: null,
        connected_email: null,
        needs_reconnect: false,
        testing: false
      });
    } catch (error) {
      toast.error('Failed to disconnect: ' + (error.response?.data?.detail || error.message));
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSyncEmails = async () => {
    setSyncing(true);
    try {
      toast.info('Syncing emails...');
      const response = await apiClient.get('/outlook/emails/sync');
      if (response.data.emails_synced > 0) {
        toast.success(`Synced ${response.data.emails_synced} emails`);
      } else {
        toast.info('No new emails');
      }
      await checkOutlookStatus();
    } catch (error) {
      toast.error('Sync failed: ' + (error.response?.data?.detail || error.message));
    } finally {
      setSyncing(false);
    }
  };

  const [openingMergeLink, setOpeningMergeLink] = useState(false);
  
  const openMergeLink = async () => {
    try {
      setOpeningMergeLink(true);
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session || !session.access_token) {
        toast.error('Please log in to connect integrations');
        setOpeningMergeLink(false);
        return;
      }
      
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/integrations/merge/link-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        toast.error(`Failed: ${errorData.detail || 'Unknown error'}`);
        setOpeningMergeLink(false);
        return;
      }
      
      const { link_token } = await response.json();
      
      if (!link_token) {
        toast.error('Invalid response from server');
        setOpeningMergeLink(false);
        return;
      }
      
      setMergeLinkToken(link_token);
      
      setTimeout(() => {
        if (mergeLinkReady) {
          openMergeLinkModal();
        } else {
          toast.error('Merge Link not ready');
        }
        setOpeningMergeLink(false);
      }, 100);
      
    } catch (error) {
      console.error('❌ Error opening Merge Link:', error);
      toast.error('Failed to open Merge Link');
      setOpeningMergeLink(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-7xl mx-auto">
        <div className="space-y-6 animate-fade-in">
          {/* Header */}
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
              Integrations
            </h1>
            
            {/* Ambient System Status */}
            <div className="mt-3 flex items-start gap-2 text-sm transition-opacity duration-300" 
                 style={{ color: 'var(--text-muted)' }}>
              <Sparkles className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--accent-primary)' }} />
              <p className="animate-fade-in leading-relaxed">
                {connectedCount === 0 
                  ? 'BIQC is ready to learn. Connect your first system to begin intelligence gathering.'
                  : connectedCount === 1
                  ? 'BIQC is currently learning from 1 connected system. Add more sources to deepen intelligence.'
                  : `BIQC is learning from ${connectedCount} connected systems. Intelligence depth increasing.`
                }
              </p>
            </div>
          </div>

        {/* Top-Level Navigation Tabs */}
        <div className="border-b" style={{ borderColor: 'var(--border-light)' }}>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setActiveTab('connected-apps');
                setSelectedCategory(null);
                setSelectedIntegration(null);
              }}
              className={`px-4 py-3 text-sm font-medium transition-all duration-150 rounded-t-lg relative ${
                activeTab === 'connected-apps'
                  ? 'text-blue-700'
                  : 'hover:bg-gray-50'
              }`}
              style={{ 
                color: activeTab === 'connected-apps' ? 'var(--accent-primary)' : 'var(--text-muted)',
                background: activeTab === 'connected-apps' ? 'rgba(29, 78, 216, 0.08)' : 'transparent',
                fontWeight: activeTab === 'connected-apps' ? '600' : '500'
              }}
            >
              Connected Apps
              {activeTab === 'connected-apps' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full" 
                     style={{ background: 'var(--accent-primary)' }} />
              )}
            </button>
            <button
              onClick={() => {
                setActiveTab('intelligence-sources');
                setSelectedCategory(null);
                setSelectedIntegration(null);
              }}
              className={`px-4 py-3 text-sm font-medium transition-all duration-150 rounded-t-lg relative ${
                activeTab === 'intelligence-sources'
                  ? 'text-blue-700'
                  : 'hover:bg-gray-50'
              }`}
              style={{ 
                color: activeTab === 'intelligence-sources' ? 'var(--accent-primary)' : 'var(--text-muted)',
                background: activeTab === 'intelligence-sources' ? 'rgba(29, 78, 216, 0.08)' : 'transparent',
                fontWeight: activeTab === 'intelligence-sources' ? '600' : '500'
              }}
            >
              Intelligence Sources
              {activeTab === 'intelligence-sources' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full" 
                     style={{ background: 'var(--accent-primary)' }} />
              )}
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'connected-apps' && (
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 min-h-[600px]">
            {/* Left Panel - Category Navigator (Desktop) */}
            <div className="hidden lg:block">
              <div className="sticky top-6 space-y-1">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setSelectedCategory(cat.id);
                      setSelectedIntegration(null);
                    }}
                    className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-all duration-120 flex items-center gap-3 ${
                      selectedCategory === cat.id
                        ? 'bg-blue-50 text-blue-700'
                        : 'hover:bg-gray-50'
                    }`}
                    style={{
                      background: selectedCategory === cat.id ? 'rgba(29, 78, 216, 0.08)' : 'transparent',
                      color: selectedCategory === cat.id ? 'var(--accent-primary)' : 'var(--text-secondary)'
                    }}
                  >
                    <span className="text-lg">{cat.icon}</span>
                    <span className="flex-1">{cat.label}</span>
                    {selectedCategory === cat.id && <ChevronRight className="w-4 h-4" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Mobile Category Selector */}
            <div className="lg:hidden">
              <div className="relative">
                <select
                  value={selectedCategory || ''}
                  onChange={(e) => {
                    setSelectedCategory(e.target.value || null);
                    setSelectedIntegration(null);
                  }}
                  className="w-full px-4 py-3.5 pr-10 rounded-xl border text-sm font-medium appearance-none"
                  style={{
                    background: 'var(--bg-card)',
                    borderColor: selectedCategory ? 'var(--accent-primary)' : 'var(--border-light)',
                    color: 'var(--text-primary)',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
                  }}
                >
                  <option value="">Select a category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.icon} {cat.label}
                    </option>
                  ))}
                </select>
                <ChevronRight 
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none rotate-90" 
                  style={{ color: 'var(--text-muted)' }} 
                />
              </div>
            </div>

            {/* Right Panel - Content */}
            <div className="flex-1">
              {selectedCategory === null ? (
                /* Default State - No Category Selected */
                <div className="h-full flex items-center justify-center p-8">
                  <div className="text-center max-w-md">
                    <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                         style={{ background: 'var(--bg-tertiary)' }}>
                      <Plug className="w-8 h-8" style={{ color: 'var(--text-muted)' }} />
                    </div>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      Select a category to explore supported platforms and connect your data.
                    </p>
                  </div>
                </div>
              ) : (
                /* Category Selected - Show Integration Cards */
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {filteredIntegrations.map((integration) => {
                    const connectionState = resolveIntegrationState(
                      integration, 
                      outlookStatus, 
                      gmailStatus, 
                      mergeIntegrations
                    );
                    const isConnected = connectionState.connected;

                    return (
                      <div
                        key={integration.id}
                        onClick={() => setSelectedIntegration(integration)}
                        className="p-4 rounded-xl border cursor-pointer transition-all duration-120 active:scale-[0.98]"
                        style={{
                          background: 'var(--bg-card)',
                          borderColor: isConnected ? '#22c55e' : 'var(--border-light)',
                          borderWidth: isConnected ? '2px' : '1px',
                          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
                          e.currentTarget.style.transform = 'translateY(-2px)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)';
                          e.currentTarget.style.transform = 'translateY(0)';
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-white font-bold"
                            style={{ background: integration.color }}
                          >
                            {integration.logo}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                                {integration.name}
                              </h3>
                              {isConnected && (
                                <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                              )}
                            </div>
                            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                              {integration.description}
                            </p>
                          </div>
                          <ChevronRight className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'intelligence-sources' && (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                 style={{ background: 'var(--bg-tertiary)' }}>
              <Sparkles className="w-8 h-8" style={{ color: 'var(--text-muted)' }} />
            </div>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Intelligence Sources tab - Coming soon
            </p>
          </div>
        )}
        </div>
      </div>

      {/* Detail Panel / Bottom Sheet */}
      {selectedIntegration && (
        <>
          {/* Desktop - Right Side Panel */}
          <div 
            className="hidden lg:block fixed right-0 w-96 shadow-2xl animate-slide-in-right overflow-hidden"
            style={{ 
              background: 'var(--bg-card)',
              top: 'var(--header-height)',
              bottom: 0,
              zIndex: 50
            }}
          >
            <div className="h-full flex flex-col">
              {/* Header */}
              <div className="p-6 border-b flex-shrink-0" style={{ borderColor: 'var(--border-light)' }}>
                <button
                  onClick={() => setSelectedIntegration(null)}
                  className="absolute top-4 right-4 p-2 rounded-lg transition-colors"
                  style={{ 
                    background: 'transparent',
                    color: 'var(--text-muted)'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <X className="w-5 h-5" />
                </button>
                
                <div
                  className="w-16 h-16 rounded-xl flex items-center justify-center text-white font-bold text-xl mb-4"
                  style={{ background: selectedIntegration.color }}
                >
                  {selectedIntegration.logo}
                </div>
                
                <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                  {selectedIntegration.name}
                </h2>
                
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {selectedIntegration.description}
                </p>
              </div>

              {/* Status & Actions */}
              <div className="flex-1 p-6 overflow-y-auto">
                {(() => {
                  const connectionState = resolveIntegrationState(
                    selectedIntegration,
                    outlookStatus,
                    gmailStatus,
                    mergeIntegrations
                  );
                  const isConnected = connectionState.connected;
                  const connectionSource = connectionState.source;

                  if (isConnected) {
                    return (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50">
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                          <span className="text-sm font-medium text-green-700">Connected</span>
                        </div>
                        
                        {selectedIntegration.id === 'outlook' && connectionSource === 'edge' && (
                          <>
                            <div className="text-sm space-y-2">
                              <p style={{ color: 'var(--text-secondary)' }}>
                                <strong>Email:</strong> {outlookStatus.connected_email}
                              </p>
                              <p style={{ color: 'var(--text-secondary)' }}>
                                <strong>Synced:</strong> {outlookStatus.emails_synced} emails
                              </p>
                            </div>
                            <div className="space-y-2">
                              <Button
                                onClick={handleSyncEmails}
                                disabled={syncing}
                                className="w-full btn-secondary"
                              >
                                {syncing ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                                Refresh
                              </Button>
                              <Button
                                onClick={handleOutlookDisconnect}
                                disabled={disconnecting}
                                className="w-full btn-secondary text-red-600"
                              >
                                <LogOut className="w-4 h-4 mr-2" />
                                Disconnect
                              </Button>
                            </div>
                          </>
                        )}
                        
                        {selectedIntegration.id === 'gmail' && connectionSource === 'edge' && (
                          <>
                            <div className="text-sm space-y-2">
                              <p style={{ color: 'var(--text-secondary)' }}>
                                <strong>Email:</strong> {gmailStatus.connected_email}
                              </p>
                              <p style={{ color: 'var(--text-secondary)' }}>
                                <strong>Labels:</strong> {gmailStatus.labels_count}
                              </p>
                            </div>
                            <Button
                              onClick={handleGmailDisconnect}
                              disabled={disconnecting}
                              className="w-full btn-secondary text-red-600"
                            >
                              <LogOut className="w-4 h-4 mr-2" />
                              Disconnect
                            </Button>
                          </>
                        )}
                        
                        {mergeConnected && !selectedIntegration.isOutlook && !selectedIntegration.isGmail && (
                          <div className="text-sm space-y-2">
                            <p style={{ color: 'var(--text-secondary)' }}>
                              Integration Type: <strong>Merge.dev</strong>
                            </p>
                            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                              This integration is powered by Merge.dev's unified API platform.
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  } else {
                    return (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
                             style={{ background: 'var(--bg-tertiary)' }}>
                          <span className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
                            Available
                          </span>
                        </div>
                        <Button
                          onClick={() => handleConnect(selectedIntegration)}
                          disabled={connecting === selectedIntegration.id}
                          className="w-full btn-primary"
                        >
                          {connecting === selectedIntegration.id ? 'Connecting...' : 'Connect'}
                        </Button>
                      </div>
                    );
                  }
                })()}
              </div>
            </div>
          </div>

          {/* Mobile - Bottom Sheet */}
          <div 
            className="lg:hidden fixed inset-0 bg-black/40 z-50 animate-fade-in"
            onClick={() => setSelectedIntegration(null)}
          >
            <div
              className="absolute bottom-0 left-0 right-0 rounded-t-3xl shadow-2xl animate-slide-up overflow-hidden"
              style={{ 
                background: 'var(--bg-card)',
                maxHeight: '85vh'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Swipe Indicator */}
              <div className="pt-3 pb-2 flex justify-center flex-shrink-0">
                <div className="w-12 h-1 rounded-full" style={{ background: 'var(--border-medium)' }} />
              </div>

              <div className="px-6 pb-6 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 32px)' }}>
                <div
                  className="w-16 h-16 rounded-xl flex items-center justify-center text-white font-bold text-xl mb-4"
                  style={{ background: selectedIntegration.color }}
                >
                  {selectedIntegration.logo}
                </div>
                
                <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                  {selectedIntegration.name}
                </h2>
                
                <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                  {selectedIntegration.description}
                </p>

                {(() => {
                  const mergeConnected = mergeIntegrations[selectedIntegration.id?.toLowerCase()] || 
                                        mergeIntegrations[selectedIntegration.name?.toLowerCase()];
                  const isConnected = (selectedIntegration.id === 'outlook' && outlookStatus.connected) || 
                                     (selectedIntegration.id === 'gmail' && gmailStatus.connected) ||
                                     mergeConnected;

                  if (isConnected) {
                    return (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50">
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                          <span className="text-sm font-medium text-green-700">Connected</span>
                        </div>
                        
                        {(selectedIntegration.id === 'outlook' || selectedIntegration.id === 'gmail') && (
                          <Button
                            onClick={selectedIntegration.id === 'outlook' ? handleOutlookDisconnect : handleGmailDisconnect}
                            disabled={disconnecting}
                            className="w-full btn-secondary text-red-600"
                          >
                            <LogOut className="w-4 h-4 mr-2" />
                            Disconnect
                          </Button>
                        )}
                      </div>
                    );
                  } else {
                    return (
                      <Button
                        onClick={() => handleConnect(selectedIntegration)}
                        disabled={connecting === selectedIntegration.id}
                        className="w-full btn-primary sticky bottom-0"
                      >
                        {connecting === selectedIntegration.id ? 'Connecting...' : 'Connect'}
                      </Button>
                    );
                  }
                })()}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Overlay for desktop detail panel */}
      {selectedIntegration && (
        <div
          className="hidden lg:block fixed inset-0 bg-black/20 animate-fade-in"
          style={{ 
            top: 'var(--header-height)',
            zIndex: 40
          }}
          onClick={() => setSelectedIntegration(null)}
        />
      )}
    </DashboardLayout>
  );
};

export default Integrations;
