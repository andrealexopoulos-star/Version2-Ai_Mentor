import React, { useEffect, useState } from 'react';
import { ArrowRight, X, CheckCircle2, Zap, Link2 } from 'lucide-react';
import { supabase } from '../../context/SupabaseAuthContext';
import { getBackendUrl } from '../../config/urls';
import { fontFamily } from '../../design-system/tokens';


const INTEGRATIONS = [
  {
    id: 'gmail',
    name: 'Gmail',
    provider: 'Google',
    color: '#EF4444',
    description: 'Email intelligence, priority inbox, contact signals',
    authType: 'gmail',
    logo: (
      <svg viewBox="0 0 24 24" className="w-5 h-5">
        <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.272H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" fill="#EF4444"/>
      </svg>
    ),
  },
  {
    id: 'outlook',
    name: 'Outlook',
    provider: 'Microsoft',
    color: '#0078D4',
    description: 'Email, calendar, Teams, Azure AD integration',
    authType: 'outlook',
    logo: (
      <svg viewBox="0 0 24 24" className="w-5 h-5">
        <path d="M7.88 12.04q0 .45-.11.87-.1.41-.33.74-.22.33-.58.52-.37.2-.87.2t-.85-.2q-.35-.21-.57-.55-.22-.33-.33-.75-.1-.42-.1-.86t.1-.87q.1-.43.34-.76.22-.34.59-.54.36-.2.87-.2t.86.2q.35.21.57.55.22.34.32.77.1.43.1.88z" fill="#0078D4"/>
        <path d="M24 12v9.38q0 .46-.33.8-.33.32-.8.32H7.13q-.46 0-.8-.33-.32-.33-.32-.8V18H1q-.41 0-.7-.3-.3-.29-.3-.7V7q0-.41.3-.7Q.58 6 1 6h6.5V2.55q0-.44.3-.75.3-.3.75-.3h12.9q.44 0 .75.3.3.3.3.75V10.85l1.24.72h.01q.07.04.11.11z" fill="#0078D4"/>
      </svg>
    ),
  },
  {
    id: 'yahoo',
    name: 'Yahoo Mail',
    provider: 'Yahoo',
    color: '#6001D2',
    description: 'Yahoo Mail and Yahoo Calendar',
    authType: 'coming_soon',
    logo: (
      <svg viewBox="0 0 24 24" className="w-5 h-5">
        <path d="M0 0l6.6 16.47L0 24h5.04l3.36-4.91L11.76 24H24L17.04 7.53 24 0h-5.04l-3.36 5.25L12.24 0H0z" fill="#6001D2"/>
      </svg>
    ),
  },
  {
    id: 'icloud',
    name: 'iCloud Mail',
    provider: 'Apple',
    color: '#555',
    description: 'Apple Mail and iCloud Calendar',
    authType: 'coming_soon',
    logo: (
      <svg viewBox="0 0 24 24" className="w-5 h-5">
        <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09z" fill="#555"/>
      </svg>
    ),
  },
  {
    id: 'exchange',
    name: 'Exchange',
    provider: 'Microsoft Exchange',
    color: '#217346',
    description: 'Corporate Exchange Server email & calendar',
    authType: 'outlook',
    logo: (
      <svg viewBox="0 0 24 24" className="w-5 h-5">
        <rect width="24" height="24" rx="4" fill="#217346"/>
        <path d="M12 6l-6 3v6l6 3 6-3V9l-6-3zm0 2.2l3.6 1.8-3.6 1.8L8.4 10 12 8.2zm-4.5 2.65l3.75 1.875v3.75l-3.75-1.875v-3.75zm4.75 5.625v-3.75l3.75-1.875v3.75l-3.75 1.875z" fill="#fff"/>
      </svg>
    ),
  },
  {
    id: 'imap',
    name: 'Other / IMAP',
    provider: 'Custom',
    color: '#64748B',
    description: 'Any IMAP-compatible email provider',
    authType: 'coming_soon',
    logo: (
      <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: '#64748B' }}>
        <span className="text-white text-[8px] font-bold">@</span>
      </div>
    ),
  },
];

const PostCMOIntegrationOverlay = ({ onSkip, onComplete, firstName = '' }) => {
  const [connected, setConnected] = useState([]);
  const [connectedEmail, setConnectedEmail] = useState('');
  const [statusLoading, setStatusLoading] = useState(true);
  const [connecting, setConnecting] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);

  useEffect(() => {
    let mounted = true;
    const loadConnectionStatus = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) {
          if (mounted) setConnected([]);
          return;
        }
        const { data: rows } = await supabase
          .from('email_connections')
          .select('provider, connected, connected_email')
          .eq('user_id', session.user.id);

        const providers = (rows || []).filter((row) => row?.connected !== false);
        const connectedIds = [];
        let emailLabel = '';
        providers.forEach((row) => {
          const provider = String(row?.provider || '').toLowerCase();
          if (provider === 'outlook') {
            connectedIds.push('outlook', 'exchange');
          }
          if (provider === 'gmail') {
            connectedIds.push('gmail');
          }
          if (!emailLabel && row?.connected_email) {
            emailLabel = row.connected_email;
          }
        });
        if (mounted) {
          setConnected(Array.from(new Set(connectedIds)));
          setConnectedEmail(emailLabel);
        }
      } catch {
        if (mounted) setConnected([]);
      } finally {
        if (mounted) setStatusLoading(false);
      }
    };
    loadConnectionStatus();
    return () => {
      mounted = false;
    };
  }, []);

  const handleConnect = async (integration) => {
    if (integration.authType === 'coming_soon') {
      // Mark optimistically — not yet implemented
      setConnected(prev => prev.includes(integration.id) ? prev : [...prev, integration.id]);
      return;
    }

    setConnecting(integration.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        alert('Session expired. Please refresh the page and try again.');
        setConnecting(null);
        return;
      }

      const backendUrl = getBackendUrl();
      const returnTo = '/calibration?step=integration_connect'; // return here, step param resumes integration overlay
      try {
        sessionStorage.setItem('biqc_resume_after_oauth', 'integration_connect');
      } catch {}

      if (integration.authType === 'gmail') {
        window.location.href = `${backendUrl}/api/auth/gmail/login?token=${session.access_token}&returnTo=${encodeURIComponent(returnTo)}`;
      } else if (integration.authType === 'outlook') {
        window.location.href = `${backendUrl}/api/auth/outlook/login?token=${session.access_token}&returnTo=${encodeURIComponent(returnTo)}`;
      }
    } catch (e) {
      console.error('Connect error:', e);
      setConnecting(null);
    }
  };

  const handleContinue = () => {
    if (onComplete) onComplete();
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-[2000]"
      style={{ background: 'rgba(10, 16, 24, 0.97)', backdropFilter: 'blur(20px)' }}
      data-testid="post-cmo-integration-overlay">

      <style>{`
        @keyframes overlayIn{0%{opacity:0;transform:scale(0.96) translateY(16px)}100%{opacity:1;transform:scale(1) translateY(0)}}
        @keyframes pulseRing{0%,100%{opacity:0.4;transform:scale(1)}50%{opacity:0.8;transform:scale(1.08)}}
        @keyframes gridFade{0%{opacity:0;transform:translateY(8px)}100%{opacity:1;transform:translateY(0)}}
      `}</style>

      <div className="w-full max-w-xl mx-4" style={{ animation: 'overlayIn 0.5s cubic-bezier(0.16,1,0.3,1)' }}>

        {/* Skip button */}
        <div className="flex justify-end mb-4">
          <button onClick={onSkip}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors hover:bg-white/10"
            style={{ color: '#64748B', fontFamily: fontFamily.mono }}>
            <X className="w-3.5 h-3.5" /> Skip for now
          </button>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="relative w-16 h-16 mx-auto mb-6">
            <div className="absolute inset-0 rounded-2xl" style={{ background: 'linear-gradient(135deg, #FF6A00, #7C3AED)', animation: 'pulseRing 2.5s ease-in-out infinite' }} />
            <div className="absolute inset-0.5 rounded-2xl flex items-center justify-center" style={{ background: 'var(--biqc-bg-input, #0A1018)' }}>
              <Link2 className="w-7 h-7" style={{ color: '#FF6A00' }} />
            </div>
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-4" style={{ background: '#FF6A0015', border: '1px solid #FF6A0030' }}>
            <Zap className="w-3 h-3" style={{ color: '#FF6A00' }} />
            <span className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: '#FF6A00', fontFamily: fontFamily.mono }}>Unified Integrations Engine</span>
          </div>

          <h1 className="text-2xl font-semibold mb-3" style={{ color: 'var(--biqc-text, #F4F7FA)', fontFamily: fontFamily.display }}>
            Your intelligence foundation is ready.{firstName ? ` Hi ${firstName}!` : ''}
          </h1>
          <p className="text-sm max-w-sm mx-auto leading-relaxed mb-3" style={{ color: 'var(--biqc-text-2, #9FB0C3)', fontFamily: fontFamily.body }}>
            Connect your email to activate priority inbox, calendar intelligence and client signals. Takes 30 seconds.
          </p>
          {!statusLoading && connected.length > 0 && (
            <p className="text-xs mb-3" style={{ color: '#10B981', fontFamily: fontFamily.body }}>
              Connected now: {connected.includes('outlook') ? 'Outlook + Calendar' : 'Email'}{connectedEmail ? ` (${connectedEmail})` : ''}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-center gap-3 text-[10px]" style={{ fontFamily: fontFamily.mono, color: '#64748B' }}>
            {['30 seconds to connect', 'Read-only access', 'Revoke anytime'].map(t => (
              <span key={t} className="flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" style={{ color: '#10B981' }} /> {t}
              </span>
            ))}
          </div>
        </div>

        {/* Integration grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {INTEGRATIONS.map((intg, i) => {
            const isConnected = connected.includes(intg.id);
            const isConnecting = connecting === intg.id;
            const isComingSoon = intg.authType === 'coming_soon';
            return (
              <button
                key={intg.id}
                onClick={() => handleConnect(intg)}
                disabled={isConnecting || isConnected}
                onMouseEnter={() => setHoveredId(intg.id)}
                onMouseLeave={() => setHoveredId(null)}
                className="relative flex items-start gap-3 p-4 rounded-xl text-left transition-all"
                style={{
                  background: isConnected ? `${intg.color}15` : hoveredId === intg.id ? '#243140' : '#141C26',
                  border: `1px solid ${isConnected ? intg.color + '40' : hoveredId === intg.id ? '#334155' : '#243140'}`,
                  animation: `gridFade ${0.3 + i * 0.08}s ease-out`,
                  transform: hoveredId === intg.id && !isConnecting ? 'translateY(-2px)' : 'none',
                  boxShadow: hoveredId === intg.id ? `0 8px 24px ${intg.color}15` : 'none',
                  opacity: isComingSoon ? 0.6 : 1,
                  cursor: (isConnecting || isConnected) ? 'default' : 'pointer',
                }}
                data-testid={`connect-email-${intg.id}`}>
                {isConnected && (
                  <div className="absolute top-2 right-2">
                    <CheckCircle2 className="w-3.5 h-3.5" style={{ color: intg.color }} />
                  </div>
                )}
                {isComingSoon && (
                  <div className="absolute top-2 right-2">
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full" style={{ background: '#64748B20', color: '#64748B', fontFamily: fontFamily.mono }}>Soon</span>
                  </div>
                )}
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${intg.color}15` }}>
                  {intg.logo}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold mb-0.5" style={{ color: 'var(--biqc-text, #F4F7FA)', fontFamily: fontFamily.body }}>
                    {isConnecting ? 'Connecting...' : intg.name}
                  </p>
                  <p className="text-[10px] leading-relaxed" style={{ color: '#64748B', fontFamily: fontFamily.body }}>{intg.description}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Bottom CTA */}
        <div className="space-y-3">
          <button onClick={handleContinue}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-sm transition-all hover:brightness-110"
            style={{ background: 'linear-gradient(135deg, #FF7A18, #E56A08)', color: 'white', fontFamily: fontFamily.display, boxShadow: '0 6px 24px rgba(255,106,0,0.25)' }}>
            {connected.length > 0 ? 'Continue to Intelligence' : 'See What BIQc Found'} <ArrowRight className="w-4 h-4" />
          </button>
          <p className="text-center text-[10px]" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>
            Read-only access · Australian data sovereignty · Connect at any time from Integrations
          </p>
        </div>

      </div>
    </div>
  );
};

export default PostCMOIntegrationOverlay;
