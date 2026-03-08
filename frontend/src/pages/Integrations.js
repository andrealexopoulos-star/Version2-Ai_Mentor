import { InlineLoading } from '../components/LoadingSystems';
import { getBackendUrl } from '../config/urls';
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { apiClient } from '../lib/api';
import { supabase } from '../context/SupabaseAuthContext';
import { toast } from 'sonner';
import { useIntegrationStatus } from '../hooks/useIntegrationStatus';
import { 
  Plug, Check, ExternalLink, Search, X,
  Lock, ArrowRight, Zap, AlertCircle, CheckCircle2,
  LogOut, ShieldAlert, RefreshCw, ChevronRight, Sparkles, Loader2
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
  if (integration.viaMerge || integration.category === 'crm' || integration.category === 'financial' || integration.category === 'hris' || integration.category === 'ats') {
    // Check both lowercase and original case
    const mergeConnected = mergeIntegrations[integrationId] || 
                          mergeIntegrations[integrationName] ||
                          mergeIntegrations[integration.name] ||
                          mergeIntegrations[integration.id];
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
  const [activeTab, setActiveTab] = useState('connected-apps'); // 'connected-apps' or 'data-connections'
  const [selectedCategory, setSelectedCategory] = useState(null); // null = no category selected
  const [selectedIntegration, setSelectedIntegration] = useState(null); // For detail panel
  const [connecting, setConnecting] = useState(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [mergeIntegrations, setMergeIntegrations] = useState({});
  const [mergeLoading, setMergeLoading] = useState(false); // Start false — show content immediately, load state async
  const { status: unifiedStatus, loading: unifiedLoading, syncing: unifiedSyncing, refresh: refreshUnifiedStatus } = useIntegrationStatus();
  
  // Merge Link integration
  const [mergeLinkToken, setMergeLinkToken] = useState(null);
  const { open: openMergeLinkModal, isReady: mergeLinkReady } = useMergeLink({
    linkToken: mergeLinkToken,
    onSuccess: async (public_token, metadata) => {
      // console.log('✅ Merge onboarding success', { public_token, metadata });
      // Extract category from Merge API response structure
      const category = metadata?.integration?.categories?.[0] || metadata?.category || 'crm';
      const provider = metadata?.integration?.name || 'unknown';
      
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session || !session.access_token) {
          console.error('❌ No active session for token exchange');
          toast.error('Session expired. Please log in again.');
          setMergeLinkToken(null);
          return;
        }
        
        // console.log('🔄 Exchanging token...', { category, provider });
        
        const response = await fetch(`${getBackendUrl()}/api/integrations/merge/exchange-account-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Bearer ${session.access_token}`,
            'Cache-Control': 'no-cache, no-store',
          },
          body: new URLSearchParams({
            public_token,
            category
          })
        });
        
        if (response.ok) {
          const result = await response.json();
          // console.log('✅ Token exchange successful:', result);
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
    onExit: async (error) => {
      if (error) {
        console.error('❌ Merge onboarding error:', error);
        toast.error(`Connection failed: ${error.message || 'Unknown error'}`);
      } else {
        // console.log('ℹ️ Merge onboarding exited - checking connection status...');
        // FALLBACK: Check if connection succeeded even if onSuccess didn't fire
        setTimeout(async () => {
          try {
            // console.log('🔍 Checking Merge integrations after modal close...');
            await checkMergeIntegrations();
            const response = await apiClient.get('/integrations/merge/connected');
            const integrations = response.data?.integrations || {};
            
            if (Object.keys(integrations).length > 0) {
              // console.log('✅ Integration detected after modal close:', integrations);
              const connectedProvider = Object.keys(integrations)[0];
              toast.success(`${connectedProvider} connected successfully!`);
            }
          } catch (err) {
            console.error('Failed to verify connection:', err);
          }
        }, 2000);
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
      // console.log('✅ Gmail OAuth completed successfully');
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
      // console.log('✅ Outlook OAuth completed successfully');
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
      // console.log('📊 Connected Merge integrations:', integrations);
      setMergeIntegrations(integrations);
    } catch (error) {
      console.warn('Could not fetch Merge integrations:', error.message);
      // Fail-open: show UI without integration data rather than blocking
    } finally {
      setMergeLoading(false);
    }
  };

  const checkOutlookStatus = async () => {
    try {
      const response = await apiClient.get('/outlook/status');
      // console.log('📊 Outlook status:', response.data);
      
      if (response.data.degraded) {
        console.warn('Outlook status check degraded');
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
      console.warn('Outlook status check failed:', error.message);
      // FAIL OPEN: Preserve current connection state on error
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
        // console.log('⚠️ No active session - cannot check Gmail status');
        // FAIL OPEN: Preserve current state if no session
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
        console.warn('Gmail Edge Function check failed');
        // FAIL OPEN: Preserve current state on error
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
      console.warn('Gmail status check failed:', error.message);
      // FAIL OPEN: Preserve current state on exception
    }
  };

  // Categories for navigation (Email & Communication removed - handled via sidebar)
  const categories = [
    { id: 'crm', label: 'CRM', icon: '👥' },
    { id: 'financial', label: 'Financial', icon: '💰' },
    { id: 'hris', label: 'HRIS', icon: '👔' },
    { id: 'ats', label: 'ATS', icon: '📋' },
    { id: 'ecommerce', label: 'E-Commerce', icon: '🛒' },
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
      color: '#EF4444',
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
      color: '#FF6A00',
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
      tier: 'free',
      popular: true,
      viaMerge: true
    },
    // E-Commerce
    {
      id: 'shopify',
      name: 'Shopify',
      description: 'Sync orders, products, and customer data from your Shopify store',
      category: 'ecommerce',
      logo: 'SH',
      color: '#96BF48',
      tier: 'free',
      popular: true,
      comingSoon: true
    },
    {
      id: 'woocommerce',
      name: 'WooCommerce',
      description: 'WordPress e-commerce data and analytics',
      category: 'ecommerce',
      logo: 'WC',
      color: '#96588A',
      tier: 'free',
      comingSoon: true
    },
    // Knowledge Base (File Storage)
    {
      id: 'google_drive',
      name: 'Google Drive',
      description: 'Read-only access for intelligence context',
      category: 'knowledge',
      logo: 'GD',
      color: '#4285F4',
      tier: 'free',
      popular: true,
      viaMerge: true,
      safetyNote: 'Document metadata only, no file editing'
    },
    {
      id: 'onedrive',
      name: 'Microsoft OneDrive',
      description: 'Read-only access for intelligence context',
      category: 'knowledge',
      logo: 'OD',
      color: '#0078D4',
      tier: 'free',
      popular: true,
      viaMerge: true,
      safetyNote: 'Document metadata only, no file editing'
    },
  ];

  // Filter integrations by category (EXCLUDE email/communication - handled via sidebar)
  const filteredIntegrations = integrations.filter(integration => {
    // Exclude email integrations (Outlook, Gmail) - these are managed via Communications menu
    if (integration.category === 'communication') {
      return false;
    }
    
    const matchesSearch = integration.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          integration.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === null || integration.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Get connected count using the resolver (EXCLUDE email integrations)
  const connectedCount = integrations.filter(int => {
    // Exclude email category - managed separately via Communications menu
    if (int.category === 'communication') {
      return false;
    }
    
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
    
    if (integration.comingSoon) {
      toast.info(`${integration.name} integration coming soon! We'll notify you when it's available.`);
      return;
    }

    if (integration.viaMerge) {
      // KNOWLEDGE BASE (File Storage) uses separate category
      if (integration.category === 'knowledge') {
        openMergeLinkForFileStorage();
      } else {
        openMergeLink();
      }
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

  const handleOutlookConnect = async () => {
    setConnecting('outlook');
    
    // Get current session token
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    
    if (!token) {
      toast.error('Please log in to connect Outlook');
      setConnecting(null);
      return;
    }
    
    // Pass token as query parameter (browser redirects can't send headers)
    window.location.assign(
      `${getBackendUrl()}/api/auth/outlook/login?token=${token}&returnTo=/integrations`
    );
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

  const handleGmailConnect = async () => {
    setConnecting('gmail');
    
    // Get current session token
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    
    if (!token) {
      toast.error('Please log in to connect Gmail');
      setConnecting(null);
      return;
    }
    
    // Pass token as query parameter (browser redirects can't send headers)
    window.location.assign(
      `${getBackendUrl()}/api/auth/gmail/login?token=${token}&returnTo=/integrations`
    );
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
  
  const openMergeLink = async (categories = ['accounting', 'crm', 'hris', 'ats']) => {
    try {
      setOpeningMergeLink(true);
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session || !session.access_token) {
        toast.error('Please log in to connect integrations');
        setOpeningMergeLink(false);
        return;
      }
      
      const response = await fetch(`${getBackendUrl()}/api/integrations/merge/link-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'Cache-Control': 'no-cache, no-store',
        },
        body: JSON.stringify({ categories })
      });
      
      // Check for HTML response (stale cache)
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        toast.error('Connection error — please refresh the page and try again');
        setOpeningMergeLink(false);
        return;
      }

      if (!response.ok) {
        let detail = `Server error (${response.status})`;
        try {
          const errData = await response.clone().text();
          try { detail = JSON.parse(errData).detail || detail; } catch {}
        } catch {}
        toast.error(`Failed: ${detail}`);
        setOpeningMergeLink(false);
        return;
      }
      
      const data = await response.json();
      const link_token = data.link_token;
      
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

  const openMergeLinkForFileStorage = async () => {
    await openMergeLink(['file_storage']);
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

        {/* Top-Level Navigation Tabs - MOBILE SAFE */}
        <div className="border-b overflow-x-auto" style={{ borderColor: 'var(--border-light)' }}>
          <div className="flex gap-2 min-w-max">
            <button
              onClick={() => {
                setActiveTab('connected-apps');
                setSelectedCategory(null);
                setSelectedIntegration(null);
              }}
              data-testid="integrations-tab-connected-apps"
              className={`px-3 md:px-4 py-2.5 md:py-3 text-xs md:text-sm font-medium transition-all duration-150 rounded-t-lg relative whitespace-nowrap`}
              style={{ 
                color: activeTab === 'connected-apps' ? '#FF6A00' : '#9FB0C3',
                background: activeTab === 'connected-apps' ? 'rgba(255, 106, 0, 0.08)' : 'transparent',
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
                setActiveTab('data-connections');
                setSelectedCategory(null);
                setSelectedIntegration(null);
              }}
              data-testid="integrations-tab-data-connections"
              className={`px-3 md:px-4 py-2.5 md:py-3 text-xs md:text-sm font-medium transition-all duration-150 rounded-t-lg relative whitespace-nowrap`}
              style={{ 
                color: activeTab === 'data-connections' ? '#FF6A00' : '#9FB0C3',
                background: activeTab === 'data-connections' ? 'rgba(255, 106, 0, 0.08)' : 'transparent',
                fontWeight: activeTab === 'data-connections' ? '600' : '500'
              }}
            >
              Data Connections
              {activeTab === 'data-connections' && (
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
                    data-testid={`integrations-category-${cat.id}`}
                    className="w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-all duration-120 flex items-center gap-3"
                    style={{
                      background: selectedCategory === cat.id ? 'rgba(255, 106, 0, 0.1)' : 'transparent',
                      color: selectedCategory === cat.id ? '#FF6A00' : '#9FB0C3',
                      border: selectedCategory === cat.id ? '1px solid rgba(255, 106, 0, 0.2)' : '1px solid transparent'
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
                  data-testid="integrations-category-select"
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
                        data-testid={`integration-card-${integration.id}`}
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
                                <CheckCircle2 className="w-4 h-4 text-[#10B981] flex-shrink-0" />
                              )}
                              {integration.comingSoon && !isConnected && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded font-mono uppercase tracking-wider" 
                                      style={{ background: '#FF6A00/10', color: '#FF6A00', border: '1px solid rgba(255, 106, 0, 0.2)' }}>
                                  Soon
                                </span>
                              )}
                            </div>
                            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                              {integration.description}
                            </p>
                            {isConnected && (
                              <button
                                data-testid={`disconnect-${integration.id}`}
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (!window.confirm(`Disconnect ${integration.name}? This will stop data collection.`)) return;
                                  try {
                                    if (connectionState.source === 'merge') {
                                      await apiClient.post('/merge/disconnect', { provider: integration.id, category: integration.category });
                                      setMergeIntegrations(prev => { const n = {...prev}; delete n[integration.id?.toLowerCase()]; delete n[integration.name?.toLowerCase()]; return n; });
                                    } else if (integration.isOutlook || integration.id === 'outlook') {
                                      await apiClient.post('/outlook/disconnect');
                                      setOutlookStatus({ connected: false });
                                    } else if (integration.isGmail || integration.id === 'gmail') {
                                      await apiClient.post('/gmail/disconnect');
                                      setGmailStatus({ connected: false });
                                    } else if (integration.id === 'google_drive') {
                                      await apiClient.post('/integrations/google-drive/disconnect');
                                    }
                                    toast.success(`${integration.name} disconnected`);
                                  } catch (err) {
                                    toast.error(`Disconnect failed: ${err.response?.data?.detail || err.message}`);
                                  }
                                }}
                                className="mt-2 text-xs px-3 py-1 rounded border transition-colors"
                                style={{ borderColor: 'var(--border-light)', color: 'var(--text-muted)' }}
                                onMouseEnter={e => { e.target.style.borderColor = '#ef4444'; e.target.style.color = '#ef4444'; }}
                                onMouseLeave={e => { e.target.style.borderColor = 'var(--border-light)'; e.target.style.color = 'var(--text-muted)'; }}
                              >
                                Disconnect
                              </button>
                            )}
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

        {activeTab === 'data-connections' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                  Connected Data Sources
                </h2>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Real-time status of all integrations powering BIQC intelligence
                </p>
              </div>
              <button
                onClick={refreshUnifiedStatus}
                disabled={unifiedSyncing}
                data-testid="integrations-refresh-all-btn"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all"
                style={{ color: 'var(--text-muted)', background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#FF6A00'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-light)'}
              >
                <RefreshCw className={`w-4 h-4 ${unifiedSyncing ? 'animate-spin' : ''}`} style={{ color: unifiedSyncing ? '#FF6A00' : undefined }} />
                {unifiedSyncing ? 'Syncing...' : 'Refresh All'}
              </button>
            </div>

            {unifiedLoading ? (
              <div className="flex items-center gap-2 py-4">
                <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#FF6A00' }} />
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading integration status...</span>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Email Connections */}
                {(outlookStatus.connected || gmailStatus.connected) && (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
                      Email Providers
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {outlookStatus.connected && (
                        <div className="p-4 rounded-xl" style={{ background: 'rgba(16, 185, 129, 0.06)', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-lg bg-[#0078D4] flex items-center justify-center text-white font-bold flex-shrink-0">OL</div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold text-sm text-[#F4F7FA]">Microsoft Outlook</span>
                                <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
                              </div>
                              <p className="text-xs text-[#64748B]">{outlookStatus.connected_email || 'Connected'}</p>
                              {outlookStatus.emails_synced > 0 && (
                                <p className="text-xs mt-1" style={{ color: '#10B981' }}>{outlookStatus.emails_synced} emails synced</p>
                              )}
                            </div>
                            <Button onClick={handleOutlookDisconnect} variant="outline" size="sm" disabled={disconnecting}
                              data-testid="integrations-outlook-disconnect-inline-button"
                              className="text-[#EF4444] hover:bg-[#EF4444]/10 border-[#EF4444]/30 flex-shrink-0">
                              {disconnecting ? <InlineLoading text="..." /> : 'Disconnect'}
                            </Button>
                          </div>
                        </div>
                      )}
                      {gmailStatus.connected && (
                        <div className="p-4 rounded-xl" style={{ background: 'rgba(16, 185, 129, 0.06)', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-lg bg-[#EF4444] flex items-center justify-center text-white font-bold flex-shrink-0">GM</div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold text-sm text-[#F4F7FA]">Gmail</span>
                                <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
                              </div>
                              <p className="text-xs text-[#64748B]">{gmailStatus.connected_email || 'Connected'}</p>
                              {gmailStatus.labels_count > 0 && (
                                <p className="text-xs mt-1" style={{ color: '#10B981' }}>{gmailStatus.labels_count} labels accessible</p>
                              )}
                            </div>
                            <Button onClick={handleGmailDisconnect} variant="outline" size="sm" disabled={disconnecting}
                              data-testid="integrations-gmail-disconnect-inline-button"
                              className="text-[#EF4444] hover:bg-[#EF4444]/10 border-[#EF4444]/30 flex-shrink-0">
                              {disconnecting ? <InlineLoading text="..." /> : 'Disconnect'}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Business Systems — Merge.dev CRM/Finance etc. with record counts */}
                {Object.keys(mergeIntegrations).length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
                      Business Systems
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Object.entries(mergeIntegrations).map(([key, integration]) => {
                        const integrationConfig = integrations.find(i =>
                          i.name.toLowerCase() === key.toLowerCase() ||
                          i.id.toLowerCase() === key.toLowerCase()
                        );
                        // Get record count from unified status
                        const statusEntry = unifiedStatus?.integrations?.find(
                          i => i.provider?.toLowerCase() === key.toLowerCase() && i.connected
                        );
                        const recordCount = statusEntry?.records_count || 0;
                        const recordType = statusEntry?.record_type || 'records';
                        const lastSync = statusEntry?.last_sync_at
                          ? new Date(statusEntry.last_sync_at).toLocaleString('en-AU', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                          : null;

                        return (
                          <div key={key} className="p-4 rounded-xl" style={{ background: 'rgba(16, 185, 129, 0.06)', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                            <div className="flex items-center gap-3">
                              {integrationConfig && (
                                <div className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold flex-shrink-0" style={{ background: integrationConfig.color }}>
                                  {integrationConfig.logo}
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{key}</span>
                                  <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
                                </div>
                                {recordCount > 0 ? (
                                  <p className="text-xs" style={{ color: '#10B981' }}>
                                    {recordCount} {recordType} imported
                                    {lastSync && <span style={{ color: '#64748B' }}> · {lastSync}</span>}
                                  </p>
                                ) : (
                                  <p className="text-xs" style={{ color: '#64748B' }}>
                                    {integration.category} · Connected via Merge.dev
                                    <span className="ml-1" style={{ color: '#F59E0B' }}>· 0 {recordType} yet — sync may take a few minutes</span>
                                  </p>
                                )}
                              </div>
                              <button
                                data-testid={`data-connections-disconnect-${key}`}
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (!window.confirm(`Disconnect ${key}? This will stop data collection.`)) return;
                                  try {
                                    await apiClient.post('/merge/disconnect', { provider: key, category: integration.category });
                                    setMergeIntegrations(prev => { const n = {...prev}; delete n[key]; return n; });
                                    await refreshUnifiedStatus();
                                    toast.success(`${key} disconnected`);
                                  } catch (err) {
                                    toast.error(`Disconnect failed: ${err.response?.data?.detail || err.message}`);
                                  }
                                }}
                                className="flex-shrink-0 text-xs px-2 py-1 rounded border transition-colors"
                                style={{ borderColor: 'var(--border-light)', color: 'var(--text-muted)' }}
                                onMouseEnter={e => { e.target.style.borderColor = '#ef4444'; e.target.style.color = '#ef4444'; }}
                                onMouseLeave={e => { e.target.style.borderColor = 'var(--border-light)'; e.target.style.color = 'var(--text-muted)'; }}
                              >
                                Disconnect
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Not-connected categories — show CTAs */}
                {(() => {
                  const missingCategories = [
                    { cat: 'crm', label: 'CRM', desc: 'HubSpot, Salesforce, Pipedrive', color: '#FF7A59' },
                    { cat: 'accounting', label: 'Accounting', desc: 'Xero, QuickBooks, MYOB', color: '#13B5EA' },
                    { cat: 'email', label: 'Email', desc: 'Gmail, Outlook', color: '#EF4444' },
                  ].filter(m => {
                    if (m.cat === 'email') return !outlookStatus.connected && !gmailStatus.connected;
                    const connected = unifiedStatus?.canonical_truth;
                    if (m.cat === 'crm') return !connected?.crm_connected;
                    if (m.cat === 'accounting') return !connected?.accounting_connected;
                    return true;
                  });
                  if (missingCategories.length === 0) return null;
                  return (
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
                        Not Yet Connected
                      </h3>
                      <div className="space-y-3">
                        {missingCategories.map(m => (
                          <div key={m.cat} className="flex items-center gap-4 p-4 rounded-xl" style={{ background: 'rgba(255, 106, 0, 0.04)', border: '1px solid rgba(255, 106, 0, 0.15)' }}>
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-xs flex-shrink-0" style={{ background: m.color }}>
                              {m.label[0]}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{m.label} not connected</p>
                              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{m.desc}</p>
                            </div>
                            <button
                              onClick={() => { setActiveTab('connected-apps'); setSelectedCategory(m.cat === 'email' ? null : m.cat); }}
                              data-testid={`data-connections-connect-${m.cat}`}
                              className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all hover:brightness-110"
                              style={{ background: m.color }}
                            >
                              <Plug className="w-3 h-3" />
                              Connect
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Fully empty state — only show when no categories to display as CTAs */}
                {!mergeLoading && !outlookStatus.connected && !gmailStatus.connected && Object.keys(mergeIntegrations).length === 0 && !unifiedStatus && (
                  <div className="text-center py-16">
                    <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: 'var(--bg-tertiary)' }}>
                      <Sparkles className="w-8 h-8" style={{ color: 'var(--text-muted)' }} />
                    </div>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      No data connections yet. Connect integrations from the Connected Apps tab.
                    </p>
                  </div>
                )}
              </div>
            )}
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
                  data-testid="integrations-detail-close-button"
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
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(16, 185, 129, 0.1)' }}>
                          <CheckCircle2 className="w-5 h-5 text-[#10B981]" />
                          <span className="text-sm font-medium text-[#10B981]">Connected</span>
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
                                data-testid="integrations-outlook-refresh-button"
                                className="w-full btn-secondary"
                              >
                                {syncing ? <RefreshCw className="w-4 h-4  mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                                Refresh
                              </Button>
                              <Button
                                onClick={handleOutlookDisconnect}
                                disabled={disconnecting}
                                data-testid="integrations-outlook-disconnect-button"
                                className="w-full btn-secondary text-[#EF4444]"
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
                              data-testid="integrations-gmail-disconnect-button"
                              className="w-full btn-secondary text-red-600"
                            >
                              <LogOut className="w-4 h-4 mr-2" />
                              Disconnect
                            </Button>
                          </>
                        )}
                        
                        {connectionSource === 'merge' && !selectedIntegration.isOutlook && !selectedIntegration.isGmail && (
                          <div className="text-sm space-y-2">
                            <p style={{ color: 'var(--text-secondary)' }}>
                              <strong>Connection Type:</strong> Merge.dev Unified API
                            </p>
                            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                              This integration is managed through Merge.dev's unified platform.
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
                          data-testid={`integrations-connect-${selectedIntegration.id}-button`}
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
            data-testid="integrations-mobile-overlay"
          >
            <div
              className="absolute bottom-0 left-0 right-0 rounded-t-3xl shadow-2xl animate-slide-up overflow-hidden"
              style={{ 
                background: 'var(--bg-card)',
                maxHeight: '85vh'
              }}
              onClick={(e) => e.stopPropagation()}
              data-testid="integrations-mobile-sheet"
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
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(16, 185, 129, 0.1)' }}>
                          <CheckCircle2 className="w-5 h-5 text-[#10B981]" />
                          <span className="text-sm font-medium text-[#10B981]">Connected</span>
                        </div>
                        
                        {connectionSource === 'edge' && (selectedIntegration.id === 'outlook' || selectedIntegration.id === 'gmail') && (
                          <Button
                            onClick={selectedIntegration.id === 'outlook' ? handleOutlookDisconnect : handleGmailDisconnect}
                            disabled={disconnecting}
                            data-testid={`integrations-mobile-disconnect-${selectedIntegration.id}-button`}
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
                        data-testid={`integrations-mobile-connect-${selectedIntegration.id}-button`}
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
          data-testid="integrations-desktop-overlay"
        />
      )}
    </DashboardLayout>
  );
};

export default Integrations;
