import { RadarSweep } from '../components/LoadingSystems';
import { getBackendUrl } from '../config/urls';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { supabase } from '../context/SupabaseAuthContext';
import { apiClient } from '../lib/api';
import { toast } from 'sonner';
import { 
  Mail, CheckCircle2, ArrowRight, Loader2, 
  AlertCircle, Inbox, X
} from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { fontFamily } from '../design-system/tokens';
import AdminConsentModal from '../components/AdminConsentModal';

const ConnectEmail = () => {
  const navigate = useNavigate();
  const [connecting, setConnecting] = useState(null);
  const [outlookStatus, setOutlookStatus] = useState({ connected: false });
  const [gmailStatus, setGmailStatus] = useState({ connected: false });
  const [loading, setLoading] = useState(true);
  const [showAdminConsent, setShowAdminConsent] = useState(false);
  const [adminConsentUrl, setAdminConsentUrl] = useState('');

  useEffect(() => {
    checkEmailConnections();

    // Handle OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    const outlookConnected = urlParams.get('outlook_connected');
    const gmailConnected = urlParams.get('gmail_connected');
    const outlookError = urlParams.get('outlook_error');
    const consentUrl = urlParams.get('admin_consent_url');

    // Admin consent required — show modal
    if (outlookError === 'admin_consent_required' && consentUrl) {
      setShowAdminConsent(true);
      setAdminConsentUrl(decodeURIComponent(consentUrl));
      window.history.replaceState({}, '', '/connect-email');
    } else if (outlookError) {
      toast.error(`Microsoft connection failed: ${outlookError.replace(/_/g, ' ')}`);
      window.history.replaceState({}, '', '/connect-email');
    }

    if (outlookConnected === 'true') {
      window.history.replaceState({}, '', '/connect-email');
      setTimeout(() => checkEmailConnections(), 1500);
    }

    if (gmailConnected === 'true') {
      window.history.replaceState({}, '', '/connect-email');
      setTimeout(() => checkEmailConnections(), 1500);
    }
  }, []);

  const checkEmailConnections = async () => {
    try {
      setLoading(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        // console.log("No session - user not authenticated");
        setOutlookStatus({ connected: false });
        setGmailStatus({ connected: false });
        setLoading(false);
        return;
      }
      
      // CANONICAL: Query email_connections ONLY
      // console.log("Querying email_connections for user:", session.user.id);
      
      const { data: rows, error } = await supabase
        .from('email_connections')
        .select('*')
        .eq('user_id', session.user.id);
      
      // console.log("Query result:", { rows, error });
      
      if (error) {
        console.error('Database query error:', error);
        setOutlookStatus({ connected: false });
        setGmailStatus({ connected: false });
        setLoading(false);
        return;
      }
      
      // CANONICAL: rows.length > 0 means connected
      if (!rows || rows.length === 0) {
        // console.log('No email provider connected');
        setOutlookStatus({ connected: false });
        setGmailStatus({ connected: false });
        setLoading(false);
        return;
      }
      
      const connection = rows[0];
      // console.log('Email connection found:', connection);
      
      // Set state based on provider
      if (connection.provider === 'outlook') {
        setOutlookStatus({ 
          connected: true, 
          email: connection.connected_email 
        });
        setGmailStatus({ connected: false });
      } else if (connection.provider === 'gmail') {
        setGmailStatus({ 
          connected: true, 
          email: connection.connected_email 
        });
        setOutlookStatus({ connected: false });
      }
      
    } finally {
      setLoading(false);
    }
  };

  const handleOutlookConnect = async () => {
    try {
      setConnecting('outlook');
      
      // console.log("📧 Email connect provider: outlook");
      
      // Get session with error handling
      let token;
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error("Session error:", sessionError);
          throw new Error(`Session error: ${sessionError.message}`);
        }
        
        if (session?.access_token) {
          token = session.access_token;
        }
      } catch (authError) {
        console.error("Auth error:", authError);
        toast.error(`Authentication error: ${authError.message}`);
        setConnecting(null);
        return;
      }
      
      if (!token) {
        toast.error('Please log in to connect Outlook');
        setConnecting(null);
        return;
      }
      
      // console.log("✅ Token obtained, redirecting to OAuth...");
      
      // Secure: POST token via header, get short-lived auth code for redirect
      const initResp = await fetch(`${getBackendUrl()}/api/auth/email-connect/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ provider: 'outlook', returnTo: '/connect-email' }),
      });
      if (!initResp.ok) throw new Error('Failed to initiate Outlook connection');
      const { redirect_url } = await initResp.json();
      window.location.assign(`${getBackendUrl()}${redirect_url}`);
      
    } catch (error) {
      console.error("Outlook connect error:", error);
      toast.error(`Failed to connect: ${error.message}`);
      setConnecting(null);
    }
  };

  const handleGmailConnect = async () => {
    try {
      setConnecting('gmail');
      
      // console.log("📧 Email connect provider: gmail");
      
      // Get session with error handling
      let token;
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error("Session error:", sessionError);
          throw new Error(`Session error: ${sessionError.message}`);
        }
        
        if (session?.access_token) {
          token = session.access_token;
        }
      } catch (authError) {
        console.error("Auth error:", authError);
        toast.error(`Authentication error: ${authError.message}`);
        setConnecting(null);
        return;
      }
      
      if (!token) {
        toast.error('Please log in to connect Gmail');
        setConnecting(null);
        return;
      }
      
      // console.log("✅ Token obtained, redirecting to OAuth...");
      
      // Secure: POST token via header, get short-lived auth code for redirect
      const initResp = await fetch(`${getBackendUrl()}/api/auth/email-connect/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ provider: 'gmail', returnTo: '/connect-email' }),
      });
      if (!initResp.ok) throw new Error('Failed to initiate Gmail connection');
      const { redirect_url } = await initResp.json();
      window.location.assign(`${getBackendUrl()}${redirect_url}`);
      
    } catch (error) {
      console.error("Gmail connect error:", error);
      toast.error(`Failed to connect: ${error.message}`);
      setConnecting(null);
    }
  };

  const handleViewInbox = () => {
    navigate('/email-inbox');
  };

  const handleDisconnect = async (provider) => {
    if (!window.confirm(`Disconnect ${provider === 'outlook' ? 'Outlook' : 'Gmail'}?`)) {
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Delete from email_connections
      const { error } = await supabase
        .from('email_connections')
        .delete()
        .eq('user_id', session.user.id);

      if (error) {
        console.error('Disconnect error:', error);
        toast.error('Failed to disconnect');
      } else {
        toast.success(`${provider === 'outlook' ? 'Outlook' : 'Gmail'} disconnected`);
        setOutlookStatus({ connected: false });
        setGmailStatus({ connected: false });
        // Refresh connection status
        checkEmailConnections();
      }
    } catch (error) {
      console.error('Disconnect error:', error);
      toast.error('Failed to disconnect');
    }
  };

  return (
    <DashboardLayout>
      {showAdminConsent && (
        <AdminConsentModal
          adminConsentUrl={adminConsentUrl}
          onClose={() => setShowAdminConsent(false)}
        />
      )}
      <div className="px-3 sm:px-6 lg:px-8 py-6 sm:py-8 w-full max-w-[680px] mx-auto">
        <div className="space-y-6">
          {/* Header */}
          <div>
            <div className="text-[11px] uppercase tracking-[0.08em] mb-2" style={{ fontFamily: fontFamily.mono, color: '#E85D00' }}>
              — Connect email
            </div>
            <h1 className="font-medium mb-2" style={{ fontFamily: fontFamily.display, color: '#EDF1F7', fontSize: 'clamp(1.8rem, 3vw, 2.4rem)', letterSpacing: '-0.02em', lineHeight: 1.05 }}>
              Link your <em style={{ fontStyle: 'italic', color: '#E85D00' }}>inbox</em>.
            </h1>
            <p className="text-sm" style={{ fontFamily: fontFamily.body, color: '#8FA0B8' }}>
              BIQc reads your email to detect deal stalls, customer churn signals, and reply-time patterns. Nothing is sent on your behalf — ever. Read-only access only.
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RadarSweep compact />
            </div>
          ) : (
            <>
              {/* Connected Status Banner */}
              {(outlookStatus.connected || gmailStatus.connected) && (
                <div className="p-4 rounded-xl border-2 border-green-500 bg-green-50">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium text-green-900">
                        Email Account Connected
                      </p>
                      <p className="text-sm text-green-700">
                        {outlookStatus.connected && `Connected to Outlook (${outlookStatus.email || 'connected'})`}
                        {gmailStatus.connected && `Connected to Gmail (${gmailStatus.email})`}
                      </p>
                    </div>
                    <Button
                      onClick={handleViewInbox}
                      className="btn-primary"
                    >
                      <Inbox className="w-4 h-4 mr-2" />
                      View Inbox
                    </Button>
                  </div>
                </div>
              )}

              {/* Provider Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Option 1: Microsoft Outlook */}
                <div 
                  className="p-6 rounded-xl border-2 cursor-pointer transition-all duration-150"
                  style={{
                    borderColor: outlookStatus.connected ? '#22c55e' : 'var(--border-light)',
                    background: outlookStatus.connected ? 'rgba(34, 197, 94, 0.05)' : 'var(--bg-card)'
                  }}
                  onClick={!outlookStatus.connected ? handleOutlookConnect : undefined}
                >
                  <div className="flex items-start gap-4">
                    <div 
                      className="w-16 h-16 rounded-xl flex items-center justify-center text-white font-bold text-xl flex-shrink-0"
                      style={{ background: '#0078D4' }}
                    >
                      OL
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                          Microsoft Outlook
                        </h3>
                        {outlookStatus.connected && (
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                        )}
                      </div>
                      <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
                        Connect your Outlook email for AI-powered inbox prioritization and email intelligence
                      </p>
                      {outlookStatus.connected ? (
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                          <span className="text-sm font-medium text-green-700">Connected</span>
                          <Button
                            onClick={() => handleDisconnect('outlook')}
                            variant="outline"
                            size="sm"
                            className="ml-2"
                          >
                            Disconnect
                          </Button>
                        </div>
                      ) : (
                        <Button
                          onClick={handleOutlookConnect}
                          disabled={connecting === 'outlook'}
                          className="btn-primary w-full sm:w-auto"
                        >
                          {connecting === 'outlook' ? (
                            <>
                              
                              Connecting...
                            </>
                          ) : (
                            <>
                              <ArrowRight className="w-4 h-4 mr-2" />
                              Connect Outlook
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Option 2: Gmail */}
                <div 
                  className="p-6 rounded-xl border-2 cursor-pointer transition-all duration-150"
                  style={{
                    borderColor: gmailStatus.connected ? '#22c55e' : 'var(--border-light)',
                    background: gmailStatus.connected ? 'rgba(34, 197, 94, 0.05)' : 'var(--bg-card)'
                  }}
                  onClick={!gmailStatus.connected ? handleGmailConnect : undefined}
                >
                  <div className="flex items-start gap-4">
                    <div 
                      className="w-16 h-16 rounded-xl flex items-center justify-center text-white font-bold text-xl flex-shrink-0"
                      style={{ background: '#EF4444' }}
                    >
                      GM
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                          Gmail
                        </h3>
                        {gmailStatus.connected && (
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                        )}
                      </div>
                      <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
                        Connect your Gmail account for AI-powered inbox prioritization and email intelligence
                      </p>
                      {gmailStatus.connected ? (
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                          <span className="text-sm font-medium text-green-700">Connected</span>
                          <Button
                            onClick={() => handleDisconnect('gmail')}
                            variant="outline"
                            size="sm"
                            className="ml-2"
                          >
                            Disconnect
                          </Button>
                        </div>
                      ) : (
                        <Button
                          onClick={handleGmailConnect}
                          disabled={connecting === 'gmail'}
                          className="btn-primary w-full sm:w-auto"
                        >
                          {connecting === 'gmail' ? (
                            <>
                              
                              Connecting...
                            </>
                          ) : (
                            <>
                              <ArrowRight className="w-4 h-4 mr-2" />
                              Connect Gmail
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Option 3: Other (Coming Soon) */}
                <div 
                  className="p-6 rounded-xl border-2 opacity-60"
                  style={{
                    borderColor: 'var(--border-light)',
                    background: 'var(--bg-card)'
                  }}
                >
                  <div className="flex items-start gap-4">
                    <div 
                      className="w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}
                    >
                      <Mail className="w-8 h-8" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                        Other Email Providers
                      </h3>
                      <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
                        Additional email providers coming soon
                      </p>
                      <span className="text-xs px-3 py-1 rounded-full" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                        Coming Soon
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Info Panel */}
              <div className="p-6 rounded-xl" style={{ background: 'var(--bg-tertiary)' }}>
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--accent-primary)' }} />
                  <div>
                    <h4 className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                      Connector Information
                    </h4>
                    <ul className="text-sm space-y-1" style={{ color: 'var(--text-secondary)' }}>
                      <li>• Your email data is processed securely via Supabase Edge Functions</li>
                      <li>• BIQC analyzes email patterns to provide intelligent business insights</li>
                      <li>• You can disconnect your email at any time from Settings</li>
                      <li>• Priority Inbox uses AI to identify your most important emails</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Bottom quick action removed to avoid duplicated connected CTA cards */}
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ConnectEmail;
