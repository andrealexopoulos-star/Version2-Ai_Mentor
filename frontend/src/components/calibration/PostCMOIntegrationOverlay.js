import React, { useState } from 'react';
import { ArrowRight, X, CheckCircle2, Zap, Link2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const HEAD = "'Cormorant Garamond', Georgia, serif";
const BODY = "'Inter', sans-serif";
const MONO = "'JetBrains Mono', monospace";

const INTEGRATIONS = [
  {
    id: 'gmail',
    name: 'Gmail',
    provider: 'Google',
    color: '#EA4335',
    description: 'Email intelligence, priority inbox, contact signals',
    href: '/connect-email?provider=gmail',
    logo: (
      <svg viewBox="0 0 24 24" className="w-5 h-5">
        <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.272H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" fill="#EA4335"/>
      </svg>
    ),
  },
  {
    id: 'outlook',
    name: 'Outlook',
    provider: 'Microsoft',
    color: '#0078D4',
    description: 'Email, calendar, Teams, Azure AD integration',
    href: '/connect-email?provider=outlook',
    logo: (
      <svg viewBox="0 0 24 24" className="w-5 h-5">
        <path d="M7.88 12.04q0 .45-.11.87-.1.41-.33.74-.22.33-.58.52-.37.2-.87.2t-.85-.2q-.35-.21-.57-.55-.22-.33-.33-.75-.1-.42-.1-.86t.1-.87q.1-.43.34-.76.22-.34.59-.54.36-.2.87-.2t.86.2q.35.21.57.55.22.34.32.77.1.43.1.88zM24 12v9.38q0 .46-.33.8-.33.32-.8.32H7.13q-.46 0-.8-.33-.32-.33-.32-.8V18H1q-.41 0-.7-.3-.3-.29-.3-.7V7q0-.41.3-.7Q.58 6 1 6h6.5V2.55q0-.44.3-.75.3-.3.75-.3h12.9q.44 0 .75.3.3.3.3.75V10.85l1.24.72h.01q.07.04.11.11z" fill="#0078D4"/>
      </svg>
    ),
  },
  {
    id: 'yahoo',
    name: 'Yahoo Mail',
    provider: 'Yahoo',
    color: '#6001D2',
    description: 'Yahoo Mail and Yahoo Calendar',
    href: '/connect-email',
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
    href: '/connect-email',
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
    href: '/connect-email?provider=outlook',
    logo: (
      <svg viewBox="0 0 24 24" className="w-5 h-5">
        <path d="M0 1.75C0 .784.784 0 1.75 0h20.5C23.216 0 24 .784 24 1.75v20.5A1.75 1.75 0 0 1 22.25 24H1.75A1.75 1.75 0 0 1 0 22.25V1.75z" fill="#217346"/>
        <path d="M12 6l-6 3v6l6 3 6-3V9l-6-3zm0 2.2l3.6 1.8-3.6 1.8L8.4 10 12 8.2zm-4.5 2.65l3.75 1.875v3.75l-3.75-1.875v-3.75zm4.75 5.625v-3.75l3.75-1.875v3.75l-3.75 1.875z" fill="#fff"/>
      </svg>
    ),
  },
  {
    id: 'other',
    name: 'Other / IMAP',
    provider: 'Custom',
    color: '#64748B',
    description: 'Any IMAP-compatible email provider',
    href: '/connect-email',
    logo: (
      <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: '#64748B' }}>
        <span className="text-white text-[8px] font-bold">@</span>
      </div>
    ),
  },
];

const PostCMOIntegrationOverlay = ({ onSkip, onComplete, firstName = '' }) => {
  const navigate = useNavigate();
  const [connected, setConnected] = useState([]);
  const [hoveredId, setHoveredId] = useState(null);

  const handleConnect = (integration) => {
    // Mark as connected (visual feedback)
    setConnected(prev => prev.includes(integration.id) ? prev : [...prev, integration.id]);
    // Open connection flow
    navigate(integration.href);
  };

  const handleContinue = () => {
    if (onComplete) onComplete();
    else navigate('/market');
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
            style={{ color: '#64748B', fontFamily: MONO }}>
            <X className="w-3.5 h-3.5" /> Skip for now
          </button>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          {/* Animated logo */}
          <div className="relative w-16 h-16 mx-auto mb-6">
            <div className="absolute inset-0 rounded-2xl" style={{ background: 'linear-gradient(135deg, #FF6A00, #7C3AED)', animation: 'pulseRing 2.5s ease-in-out infinite' }} />
            <div className="absolute inset-0.5 rounded-2xl flex items-center justify-center" style={{ background: '#0A1018' }}>
              <Link2 className="w-7 h-7" style={{ color: '#FF6A00' }} />
            </div>
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-4" style={{ background: '#FF6A0015', border: '1px solid #FF6A0030' }}>
            <Zap className="w-3 h-3" style={{ color: '#FF6A00' }} />
            <span className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: '#FF6A00', fontFamily: MONO }}>Unified Integrations Engine</span>
          </div>

          <h1 className="text-2xl font-semibold mb-3" style={{ color: '#F4F7FA', fontFamily: HEAD }}>
            Activate Your Intelligence{firstName ? `, ${firstName}` : ''}
          </h1>
          <p className="text-sm max-w-sm mx-auto leading-relaxed" style={{ color: '#9FB0C3', fontFamily: BODY }}>
            Connect your email and calendar to unlock priority inbox intelligence, communication pattern analysis, and calendar density signals.
          </p>
        </div>

        {/* Integration grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {INTEGRATIONS.map((intg, i) => {
            const isConnected = connected.includes(intg.id);
            return (
              <button
                key={intg.id}
                onClick={() => handleConnect(intg)}
                onMouseEnter={() => setHoveredId(intg.id)}
                onMouseLeave={() => setHoveredId(null)}
                className="relative flex items-start gap-3 p-4 rounded-xl text-left transition-all"
                style={{
                  background: isConnected ? `${intg.color}15` : hoveredId === intg.id ? '#1E293B' : '#141C26',
                  border: `1px solid ${isConnected ? intg.color + '40' : hoveredId === intg.id ? '#334155' : '#1E293B'}`,
                  animation: `gridFade ${0.3 + i * 0.08}s ease-out`,
                  transform: hoveredId === intg.id ? 'translateY(-2px)' : 'none',
                  boxShadow: hoveredId === intg.id ? `0 8px 24px ${intg.color}15` : 'none',
                }}
                data-testid={`connect-${intg.id}`}>
                {/* Connected badge */}
                {isConnected && (
                  <div className="absolute top-2 right-2">
                    <CheckCircle2 className="w-3.5 h-3.5" style={{ color: intg.color }} />
                  </div>
                )}
                {/* Logo */}
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${intg.color}15` }}>
                  {intg.logo}
                </div>
                {/* Text */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold mb-0.5" style={{ color: '#F4F7FA', fontFamily: BODY }}>{intg.name}</p>
                  <p className="text-[10px] leading-relaxed" style={{ color: '#64748B', fontFamily: BODY }}>{intg.description}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Bottom section */}
        <div className="space-y-3">
          {connected.length > 0 ? (
            <button onClick={handleContinue}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-sm transition-all hover:brightness-110"
              style={{ background: '#FF6A00', color: 'white', fontFamily: HEAD }}>
              Continue to Market Intelligence <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={handleContinue}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-sm transition-all hover:brightness-110"
              style={{ background: 'linear-gradient(135deg, #FF6A00, #E85D00)', color: 'white', fontFamily: HEAD }}>
              Go to Market Intelligence <ArrowRight className="w-4 h-4" />
            </button>
          )}
          <p className="text-center text-[10px]" style={{ color: '#4A5568', fontFamily: MONO }}>
            Read-only access · Australian data sovereignty · Connect at any time from Settings
          </p>
        </div>

      </div>
    </div>
  );
};

export default PostCMOIntegrationOverlay;
