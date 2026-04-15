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
import AdminConsentModal from '../components/AdminConsentModal';

// Stored in sessionStorage so the target returnTo survives the OAuth roundtrip
// (the backend redirects the browser directly to the returnTo URL on success,
// so ConnectEmail itself is usually bypassed, but we also use this to resume
// cleanly if the user hits /connect-email as a fallback).
const RETURN_TO_STORAGE_KEY = 'biqc_connect_email_return_to';

const readInitialReturnTo = () => {
  try {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('returnTo');
    if (fromUrl) {
      sessionStorage.setItem(RETURN_TO_STORAGE_KEY, fromUrl);
      return fromUrl;
    }
    return sessionStorage.getItem(RETURN_TO_STORAGE_KEY) || '/connect-email';
  } catch {
    return '/connect-email';
  }
};

const ConnectEmail = () => {
  const navigate = useNavigate();
  const [connecting, setConnecting] = useState(null);
  const [outlookStatus, setOutlookStatus] = useState({ connected: false });
  const [gmailStatus, setGmailStatus] = useState({ connected: false });
  const [loading, setLoading] = useState(true);
  const [showAdminConsent, setShowAdminConsent] = useState(false);
  const [adminConsentUrl, setAdminConsentUrl] = useState('');
  // Where to send the user back to after OAuth succeeds. Defaults to staying on
  // this page (legacy behavior); callers that land us here with ?returnTo=/foo
  // or pre-populate sessionStorage will resume there instead.
  const [returnTo] = useState(readInitialReturnTo);

  useEffect(() => {
    checkEmailConnections();

    // Handle OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    const outlookConnected = urlParams.get('outlook_connected');
    const gmailConnected = urlParams.get('gmail_connected');
    const outlookError = urlParams.get('outlook_error');
    const consentUrl = urlParams.get('admin_consent_url');

    // Clear OAuth result params from the URL without dropping ?returnTo=,
    // so a failure + retry still remembers where the user came from.
    const cleanUrl = () => {
      const rt = returnTo && returnTo !== '/connect-email' ? `?returnTo=${encodeURIComponent(returnTo)}` : '';
      window.history.replaceState({}, '', `/connect-email${rt}`);
    };

    // Admin consent required — show modal
    if (outlookError === 'admin_consent_required' && consentUrl) {
      setShowAdminConsent(true);
      setAdminConsentUrl(decodeURIComponent(consentUrl));
      cleanUrl();
    } else if (outlookError) {
      toast.error(`Microsoft connection failed: ${outlookError.replace(/_/g, ' ')}`);
      cleanUrl();
    }

    const connected = outlookConnected === 'true' || gmailConnected === 'true';
    if (connected) {
      const provider = outlookConnected === 'true' ? 'Outlook' : 'Gmail';
      cleanUrl();
      setTimeout(() => checkEmailConnections(), 1500);
      // If the caller passed a returnTo (e.g. a calibration step or post-signup
      // advisor landing), resume there instead of stranding the user on this page.
      if (returnTo && returnTo !== '/connect-email') {
        toast.success(`${provider} connected — returning you to where you left off…`);
        try { sessionStorage.removeItem(RETURN_TO_STORAGE_KEY); } catch {}
        setTimeout(() => navigate(returnTo, { replace: true }), 1500);
      }
    }
  }, [returnTo, navigate]);

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
      
      // Secure: POST token via header, get short-lived auth code for redirect.
      // returnTo is dynamic so the backend's signed-state callback resumes the
      // user at the page they actually came from (calibration step, advisor,
      // settings etc.) instead of always dumping them back on /connect-email.
      const initResp = await fetch(`${getBackendUrl()}/api/auth/email-connect/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ provider: 'outlook', returnTo }),
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
      
      // Secure: POST token via header, get short-lived auth code for redirect.
      // Same dynamic returnTo behavior as outlook above.
      const initResp = await fetch(`${getBackendUrl()}/api/auth/email-connect/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ provider: 'gmail', returnTo }),
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
            <div className="text-[11px] uppercase tracking-[0.08em] mb-2" style={{ fontFamily: 'var(--font-mono)', color: 'var(--lava)', letterSpacing: 'var(--ls-caps, 0.08em)', fontWeight: 600 }}>
              — Connect email
            </div>
            <h1 className="font-medium mb-2" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink-display)', fontSize: 'clamp(1.8rem, 3vw, 2.4rem)', letterSpacing: 'var(--ls-display, -0.02em)', lineHeight: 1.05 }}>
              Link your <em style={{ fontStyle: 'italic', color: 'var(--lava)' }}>inbox</em>.
            </h1>
            <p className="text-sm" style={{ fontFamily: 'var(--font-ui)', color: 'var(--ink-secondary)' }}>
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
                <div className="p-5" style={{ borderRadius: 'var(--r-lg)', border: '1px solid var(--positive)', background: 'linear-gradient(180deg, var(--surface) 0%, rgba(22,163,74,0.04) 100%)', boxShadow: 'var(--elev-1)' }}>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6 flex-shrink-0" style={{ color: 'var(--positive)' }} />
                    <div className="flex-1">
                      <p className="font-semibold" style={{ color: 'var(--ink-display)', fontFamily: 'var(--font-ui)' }}>
                        Email Account Connected
                      </p>
                      <p className="text-sm" style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-ui)' }}>
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
                  className="text-center cursor-pointer"
                  style={{
                    borderRadius: 'var(--r-2xl)',
                    border: outlookStatus.connected ? '1px solid var(--positive)' : '1px solid var(--border)',
                    background: outlookStatus.connected ? 'linear-gradient(180deg, var(--surface) 0%, rgba(22,163,74,0.04) 100%)' : 'var(--surface)',
                    padding: 'var(--sp-7, 28px)',
                    boxShadow: 'var(--elev-1)',
                    transition: 'all 300ms ease',
                    position: 'relative',
                  }}
                  onClick={!outlookStatus.connected ? handleOutlookConnect : undefined}
                >
                  {outlookStatus.connected && (
                    <span className="absolute -top-2.5 right-5 px-3 py-1 rounded-full text-[10px] uppercase font-semibold text-white" style={{ background: 'var(--positive)', fontFamily: 'var(--font-mono)', letterSpacing: 'var(--ls-caps, 0.08em)', boxShadow: '0 4px 12px rgba(22,163,74,0.3)' }}>Connected</span>
                  )}
                  <div
                    className="w-[72px] h-[72px] rounded-xl flex items-center justify-center text-white font-bold text-[28px] mx-auto mb-4 flex-shrink-0"
                    style={{ background: '#0078D4', boxShadow: '0 8px 24px rgba(0,120,212,0.25)' }}
                  >
                    OL
                  </div>
                  <h3 className="text-[22px] mb-2" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink-display)', letterSpacing: 'var(--ls-tight, -0.01em)' }}>
                    Microsoft Outlook
                  </h3>
                  <p className="text-[13px] mb-5" style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-ui)', lineHeight: 1.5 }}>
                    Connect your Outlook email for AI-powered inbox prioritization and email intelligence
                  </p>
                  {outlookStatus.connected ? (
                    <div className="flex items-center justify-center gap-2 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
                      <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--positive)', boxShadow: '0 0 8px var(--positive)' }}></div>
                      <span className="text-[10px] uppercase font-semibold" style={{ color: 'var(--positive)', fontFamily: 'var(--font-mono)', letterSpacing: 'var(--ls-caps, 0.08em)' }}>Connected</span>
                      <Button
                        onClick={(e) => { e.stopPropagation(); handleDisconnect('outlook'); }}
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
                      className="btn-primary w-full"
                      style={{ marginTop: 'var(--sp-3, 12px)' }}
                    >
                      {connecting === 'outlook' ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
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

                {/* Option 2: Gmail */}
                <div
                  className="text-center cursor-pointer"
                  style={{
                    borderRadius: 'var(--r-2xl)',
                    border: gmailStatus.connected ? '1px solid var(--positive)' : '1px solid var(--border)',
                    background: gmailStatus.connected ? 'linear-gradient(180deg, var(--surface) 0%, rgba(22,163,74,0.04) 100%)' : 'var(--surface)',
                    padding: 'var(--sp-7, 28px)',
                    boxShadow: 'var(--elev-1)',
                    transition: 'all 300ms ease',
                    position: 'relative',
                  }}
                  onClick={!gmailStatus.connected ? handleGmailConnect : undefined}
                >
                  {gmailStatus.connected && (
                    <span className="absolute -top-2.5 right-5 px-3 py-1 rounded-full text-[10px] uppercase font-semibold text-white" style={{ background: 'var(--positive)', fontFamily: 'var(--font-mono)', letterSpacing: 'var(--ls-caps, 0.08em)', boxShadow: '0 4px 12px rgba(22,163,74,0.3)' }}>Connected</span>
                  )}
                  <div
                    className="w-[72px] h-[72px] rounded-xl flex items-center justify-center text-white font-bold text-[28px] mx-auto mb-4 flex-shrink-0"
                    style={{ background: '#EA4335', boxShadow: '0 8px 24px rgba(234,67,53,0.25)' }}
                  >
                    GM
                  </div>
                  <h3 className="text-[22px] mb-2" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink-display)', letterSpacing: 'var(--ls-tight, -0.01em)' }}>
                    Gmail
                  </h3>
                  <p className="text-[13px] mb-5" style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-ui)', lineHeight: 1.5 }}>
                    Connect your Google Workspace or personal Gmail. Same signals, different provider.
                  </p>
                  {gmailStatus.connected ? (
                    <div className="flex items-center justify-center gap-2 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
                      <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--positive)', boxShadow: '0 0 8px var(--positive)' }}></div>
                      <span className="text-[10px] uppercase font-semibold" style={{ color: 'var(--positive)', fontFamily: 'var(--font-mono)', letterSpacing: 'var(--ls-caps, 0.08em)' }}>Connected</span>
                      <Button
                        onClick={(e) => { e.stopPropagation(); handleDisconnect('gmail'); }}
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
                      className="btn-primary w-full"
                      style={{ marginTop: 'var(--sp-3, 12px)' }}
                    >
                      {connecting === 'gmail' ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
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

              {/* Info Panel — Permissions card */}
              <div className="p-6" style={{ borderRadius: 'var(--r-lg)', border: '1px solid var(--border)', background: 'var(--surface)', boxShadow: 'var(--elev-1)' }}>
                <h4 className="text-[20px] mb-4" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink-display)' }}>
                  What BIQc reads — and what it doesn't
                </h4>
                <div className="space-y-0">
                  {[
                    { allowed: true, title: 'Email metadata (sender, subject, timestamp)', desc: 'Used to detect reply-time patterns, thread activity, and deal-related correspondence.' },
                    { allowed: true, title: 'Email body text (first 500 chars)', desc: 'Used for sentiment analysis and competitor mention detection. Full body is never stored.' },
                    { allowed: true, title: 'Thread structure (who replied when)', desc: 'Used to calculate customer engagement velocity and churn risk.' },
                    { allowed: false, title: 'Attachments — never accessed', desc: 'BIQc does not open, download, or scan attachments.' },
                    { allowed: false, title: 'Send / compose — never accessed', desc: 'BIQc has read-only OAuth scope. It cannot send, draft, delete, or modify any email.' },
                  ].map((perm, i) => (
                    <div key={i} className="flex items-start gap-3 py-3" style={{ borderBottom: i < 4 ? '1px solid var(--border)' : 'none' }}>
                      <div className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: perm.allowed ? 'var(--lava-wash)' : 'var(--danger-wash)', borderRadius: 'var(--r-sm, 4px)' }}>
                        {perm.allowed
                          ? <CheckCircle2 className="w-3.5 h-3.5" style={{ color: 'var(--lava)' }} />
                          : <X className="w-3.5 h-3.5" style={{ color: 'var(--danger)' }} />
                        }
                      </div>
                      <div>
                        <p className="text-[14px] font-medium" style={{ color: 'var(--ink-display)', fontFamily: 'var(--font-ui)', lineHeight: 1.4 }}>{perm.title}</p>
                        <p className="text-[12px] mt-0.5" style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-ui)', lineHeight: 1.5 }}>{perm.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Trust bar */}
              <div className="flex items-center gap-4 flex-wrap p-5" style={{ borderRadius: 'var(--r-lg)', border: '1px solid var(--border)', background: 'var(--surface-2, var(--surface))' }}>
                {[
                  'Read-only access',
                  'Never sends on your behalf',
                  'Encrypted at rest + in transit',
                  'Delete data anytime',
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-ui)' }}>
                    <CheckCircle2 className="w-3.5 h-3.5" style={{ color: 'var(--positive)' }} />
                    {item}
                  </div>
                ))}
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
