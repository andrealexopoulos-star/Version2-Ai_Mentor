import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, X, Plug, ArrowRight } from 'lucide-react';
import { fontFamily } from '../design-system/tokens';


/**
 * FirstLoginNotification — Shows on first login to prompt connecting email and integrations.
 * Auto-dismisses after user clicks or after 30 seconds.
 */
const FirstLoginNotification = () => {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const key = 'biqc_first_login_shown';
    const shown = localStorage.getItem(key);
    if (shown) return;

    // Check if user already has integrations — don't show if connected
    const checkIntegrations = async () => {
      try {
        const { apiClient } = await import('../lib/api');
        const res = await apiClient.get('/integrations/merge/connected');
        const connected = res.data?.integrations || {};
        const hasAny = Object.values(connected).some(v => v);
        if (hasAny) {
          localStorage.setItem(key, Date.now().toString());
          return; // Already connected — don't show
        }
      } catch {}
      setVisible(true);
      localStorage.setItem(key, Date.now().toString());
      const timer = setTimeout(() => setVisible(false), 15000);
      return () => clearTimeout(timer);
    };
    checkIntegrations();
  }, []);

  if (!visible || dismissed) return null;

  return (
    <div className="fixed top-16 right-[400px] lg:right-[400px] z-50 w-[320px] max-w-[calc(100vw-32px)] rounded-xl overflow-hidden shadow-2xl"
      style={{ background: 'var(--biqc-bg-card)', border: '1px solid #E85D0030', animation: 'fadeIn 0.5s ease' }}
      data-testid="first-login-notification">
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#E85D0020' }}>
              <Plug className="w-4 h-4 text-[#E85D00]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[var(--ink-display)]" style={{ fontFamily: fontFamily.display }}>Get Started</h3>
              <p className="text-[10px] text-[var(--ink-muted)]" style={{ fontFamily: fontFamily.mono }}>Connect your systems</p>
            </div>
          </div>
          <button onClick={() => setDismissed(true)} className="p-1 rounded-lg hover:bg-black/5 text-[var(--ink-muted)]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-[var(--ink-secondary)] mb-4 leading-relaxed" style={{ fontFamily: fontFamily.body }}>
          Connect your email and integrations to unlock full intelligence capabilities.
        </p>

        <div className="space-y-2">
          <button onClick={() => { setDismissed(true); navigate('/connect-email'); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all hover:bg-black/5"
            style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}
            data-testid="connect-email-btn">
            <Mail className="w-4 h-4 text-[#3B82F6]" />
            <div className="flex-1">
              <span className="text-sm text-[var(--ink-display)] block">Connect Email</span>
              <span className="text-[10px] text-[var(--ink-muted)]" style={{ fontFamily: fontFamily.mono }}>Outlook or Gmail</span>
            </div>
            <ArrowRight className="w-4 h-4 text-[var(--ink-muted)]" />
          </button>

          <button onClick={() => { setDismissed(true); navigate('/integrations'); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all hover:bg-black/5"
            style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}
            data-testid="connect-integrations-btn">
            <Plug className="w-4 h-4 text-[#E85D00]" />
            <div className="flex-1">
              <span className="text-sm text-[var(--ink-display)] block">Connect Integrations</span>
              <span className="text-[10px] text-[var(--ink-muted)]" style={{ fontFamily: fontFamily.mono }}>Xero, HubSpot, CRM</span>
            </div>
            <ArrowRight className="w-4 h-4 text-[var(--ink-muted)]" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default FirstLoginNotification;
