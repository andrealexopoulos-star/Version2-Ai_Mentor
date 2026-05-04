/**
 * FirstTimeOnboarding — Multi-step integration onboarding modal
 * Shown ONCE after calibration completes, when user first lands on the platform.
 *
 * Flow:
 *  Step 0: Welcome (what BIQc does, security, why integrations matter)
 *  Step 1: Connect Email (Gmail / Outlook)
 *  Step 2: Email connected → "Connect more business tools?" (Yes / No)
 *  Step 3: Integration category picker → specific integration → Merge connect loop
 *  Step 4: "No I'm done" → Final confirmation before dashboard
 */

import React, { useState, useCallback } from 'react';
import { X, Shield, ArrowRight, CheckCircle2, Zap, Database, Lock, RefreshCw, Loader2, ChevronRight } from 'lucide-react';
import { supabase } from '../context/SupabaseAuthContext';
import { getBackendUrl } from '../config/urls';
import { useMergeLink } from '@mergeapi/react-merge-link';
import { fontFamily } from '../design-system/tokens';
import { toast } from 'sonner';

// ── Constants ─────────────────────────────────────────────────────────────────

const INTEGRATION_CATEGORIES = [
  {
    id: 'crm', label: 'CRM', desc: 'HubSpot, Salesforce, Pipedrive', color: '#FF7A59',
    mergeCategories: ['crm'],
  },
  {
    id: 'financial', label: 'Financial & Accounting', desc: 'Xero, MYOB, QuickBooks', color: '#10B981',
    mergeCategories: ['accounting'],
  },
  {
    id: 'hris', label: 'HR & Payroll', desc: 'BambooHR, Employment Hero, Gusto', color: '#3B82F6',
    mergeCategories: ['hris'],
  },
  {
    id: 'ats', label: 'Recruitment', desc: 'Greenhouse, Lever, Workable', color: '#8B5CF6',
    mergeCategories: ['ats'],
  },
  {
    id: 'ticketing', label: 'Project & Support', desc: 'Jira, Asana, Zendesk', color: '#F59E0B',
    mergeCategories: ['ticketing'],
  },
  {
    id: 'storage', label: 'File Storage', desc: 'Google Drive, OneDrive, Dropbox', color: '#06B6D4',
    mergeCategories: ['file_storage'],
  },
];

const SECURITY_POINTS = [
  { icon: Lock, text: 'AES-256 encryption at rest and in transit' },
  { icon: Shield, text: 'Australian hosted — Sydney & Melbourne, zero offshore' },
  { icon: Database, text: 'Read-only access — BIQc never modifies your data' },
  { icon: RefreshCw, text: 'Revoke access instantly at any time' },
];

// ── Step 0: Welcome ───────────────────────────────────────────────────────────

const WelcomeStep = ({ firstName, onConnect, onSkip }) => (
  <div className="space-y-6">
    <div className="text-center">
      <div className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #E85D00, #E56A08)', boxShadow: '0 0 40px rgba(232,93,0,0.3)' }}>
        <Zap className="w-8 h-8 text-white" />
      </div>
      <h2 className="text-2xl font-semibold mb-2" style={{ color: 'var(--ink-display, #0A0A0A)', fontFamily: fontFamily.display }}>
        Welcome to BIQc{firstName ? `, ${firstName}` : ''}.
      </h2>
      <p className="text-sm leading-relaxed max-w-sm mx-auto" style={{ color: 'var(--ink-secondary, #8FA0B8)', fontFamily: fontFamily.body }}>
        This is your autonomous intelligence system. It monitors your business 24/7, detects risks before they compound, and delivers executive-level briefings — without you having to ask.
      </p>
    </div>

    {/* What BIQc does */}
    <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(232,93,0,0.06)', border: '1px solid rgba(232,93,0,0.15)' }}>
      <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#E85D00', fontFamily: fontFamily.mono }}>How BIQc Works</p>
      {[
        'Connects to your business systems (email, CRM, accounting, HR)',
        'Reads signals across financial, revenue, risk and market data',
        'Surfaces what matters — before it becomes a problem',
        'Delivers daily executive briefs, alerts and recommended actions',
      ].map((item, i) => (
        <div key={i} className="flex items-start gap-2.5">
          <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: '#E85D00' }} />
          <p className="text-xs leading-relaxed" style={{ color: 'var(--ink-secondary, #8FA0B8)', fontFamily: fontFamily.body }}>{item}</p>
        </div>
      ))}
    </div>

    {/* Security */}
    <div className="rounded-xl p-4" style={{ background: 'var(--surface-sunken, #F5F5F5)', border: '1px solid #1E2D3D' }}>
      <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: '#10B981', fontFamily: fontFamily.mono }}>Your Data Security</p>
      <div className="grid grid-cols-2 gap-2">
        {SECURITY_POINTS.map((pt, i) => (
          <div key={i} className="flex items-start gap-2">
            <pt.icon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: '#10B981' }} />
            <p className="text-[10px] leading-snug" style={{ color: '#6B7B8D', fontFamily: fontFamily.body }}>{pt.text}</p>
          </div>
        ))}
      </div>
    </div>

    <p className="text-xs text-center" style={{ color: '#64748B', fontFamily: fontFamily.body }}>
      The more systems you connect, the more accurate and specific your intelligence becomes.
      BIQc needs full context to deliver real insight — not guesswork.
    </p>

    <div className="flex flex-col gap-3">
      <button onClick={onConnect}
        className="w-full py-3.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all hover:brightness-110"
        style={{ background: 'linear-gradient(135deg, #E85D00, #E56A08)', color: 'white', fontFamily: fontFamily.body, boxShadow: '0 6px 24px rgba(232,93,0,0.28)' }}
        data-testid="onboarding-connect-email">
        Connect Email to Get Started <ArrowRight className="w-4 h-4" />
      </button>
      <button onClick={onSkip}
        className="w-full py-2.5 text-xs transition-colors"
        style={{ color: '#4A5568', fontFamily: fontFamily.mono }}
        data-testid="onboarding-skip">
        Skip for now — I'll connect later from Integrations
      </button>
    </div>
  </div>
);

// ── Step 1: Email provider ────────────────────────────────────────────────────

const EMAIL_PROVIDERS = [
  { id: 'outlook', name: 'Microsoft Outlook', desc: 'Email, calendar, Teams', color: '#0078D4', authType: 'outlook' },
  { id: 'gmail',   name: 'Gmail',             desc: 'Inbox intelligence, priority triage', color: '#EF4444', authType: 'gmail' },
];

const EmailStep = ({ onSkip }) => {
  const [connecting, setConnecting] = useState(null);

  const connect = async (provider) => {
    setConnecting(provider.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { toast.error('Session expired. Please refresh.'); setConnecting(null); return; }
      const backendUrl = getBackendUrl();
      const returnTo = '/advisor?onboarding=email_connected';
      const providerType = provider.authType === 'outlook' ? 'outlook' : 'gmail';
      const initResp = await fetch(`${backendUrl}/api/auth/email-connect/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ provider: providerType, returnTo }),
      });
      if (!initResp.ok) throw new Error('Failed to initiate connection');
      const { redirect_url } = await initResp.json();
      window.location.href = `${backendUrl}${redirect_url}`;
    } catch { toast.error('Failed to connect. Please try again.'); setConnecting(null); }
  };

  return (
    <div className="space-y-5">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--ink-display, #0A0A0A)', fontFamily: fontFamily.display }}>
          Connect Your Email
        </h2>
        <p className="text-sm" style={{ color: 'var(--ink-secondary, #8FA0B8)', fontFamily: fontFamily.body }}>
          Email is the foundation of client intelligence. Priority inbox, meeting signals and communication patterns all start here.
        </p>
      </div>

      <div className="space-y-3">
        {EMAIL_PROVIDERS.map(p => (
          <button key={p.id} onClick={() => connect(p)} disabled={!!connecting}
            className="w-full flex items-center gap-4 p-4 rounded-xl text-left transition-all"
            style={{ background: 'var(--surface, #0E1628)', border: '1px solid rgba(140,170,210,0.15)' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = p.color + '60'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(140,170,210,0.15)'}
            data-testid={`connect-email-${p.id}`}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: p.color + '15' }}>
              {connecting === p.id
                ? <Loader2 className="w-5 h-5 animate-spin" style={{ color: p.color }} />
                : <span className="text-sm font-bold" style={{ color: p.color }}>{p.name.slice(0,2)}</span>
              }
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold" style={{ color: 'var(--ink-display, #0A0A0A)', fontFamily: fontFamily.body }}>{p.name}</p>
              <p className="text-xs" style={{ color: '#64748B', fontFamily: fontFamily.body }}>{p.desc}</p>
            </div>
            <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: '#64748B' }} />
          </button>
        ))}
      </div>

      <button onClick={onSkip} className="w-full py-2 text-xs text-center"
        style={{ color: '#4A5568', fontFamily: fontFamily.mono }}>
        Skip email — connect business tools instead
      </button>
    </div>
  );
};

// ── Step 2: "Connect more?" prompt ───────────────────────────────────────────

const ConnectMoreStep = ({ emailProvider, onYes, onNo }) => (
  <div className="space-y-5">
    <div className="text-center">
      <div className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center"
        style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)' }}>
        <CheckCircle2 className="w-6 h-6" style={{ color: '#10B981' }} />
      </div>
      <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--ink-display, #0A0A0A)', fontFamily: fontFamily.display }}>
        {emailProvider ? `${emailProvider} Connected` : 'Email Connected'}
      </h2>
      <p className="text-sm leading-relaxed max-w-xs mx-auto" style={{ color: 'var(--ink-secondary, #8FA0B8)', fontFamily: fontFamily.body }}>
        BIQc will start analysing your inbox immediately. Do you have other business tools we can connect for deeper intelligence?
      </p>
    </div>

    <div className="rounded-xl p-4" style={{ background: 'rgba(232,93,0,0.06)', border: '1px solid rgba(232,93,0,0.15)' }}>
      <p className="text-xs mb-2 font-semibold" style={{ color: '#E85D00', fontFamily: fontFamily.mono }}>MORE CONNECTIONS = BETTER INTELLIGENCE</p>
      <p className="text-xs leading-relaxed" style={{ color: 'var(--ink-secondary, #8FA0B8)', fontFamily: fontFamily.body }}>
        Connect your CRM to see deal risks. Accounting for cash flow signals. HR for capacity and compliance. Each integration adds a new layer of intelligence BIQc can act on.
      </p>
    </div>

    <div className="space-y-3">
      <button onClick={onYes}
        className="w-full py-3.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all hover:brightness-110"
        style={{ background: 'linear-gradient(135deg, #E85D00, #E56A08)', color: 'white', fontFamily: fontFamily.body, boxShadow: '0 6px 24px rgba(232,93,0,0.25)' }}
        data-testid="connect-more-yes">
        Yes, Connect More Business Tools <ArrowRight className="w-4 h-4" />
      </button>
      <button onClick={onNo}
        className="w-full py-3 rounded-xl text-sm font-semibold transition-all"
        style={{ background: 'transparent', border: '1px solid rgba(140,170,210,0.15)', color: 'var(--ink-secondary, #8FA0B8)', fontFamily: fontFamily.body }}
        onMouseEnter={e => e.currentTarget.style.borderColor = '#334155'}
        onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(140,170,210,0.15)'}
        data-testid="connect-more-no">
        No, I'm Done for Now
      </button>
    </div>
  </div>
);

// ── Step 3: Integration category + Merge connect ──────────────────────────────

const IntegrationStep = ({ connectedList, onConnected, onDone, mergeLinkToken, setMergeLinkToken }) => {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [openingMerge, setOpeningMerge] = useState(false);
  const [pendingOpen, setPendingOpen] = useState(false);

  const { open: openMergeModal, isReady: mergeReady } = useMergeLink({
    linkToken: mergeLinkToken || '',
    onSuccess: async (public_token, metadata) => {
      const category = metadata?.integration?.categories?.[0] || selectedCategory?.id || 'crm';
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;
        const res = await fetch(`${getBackendUrl()}/api/integrations/merge/exchange-account-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': `Bearer ${session.access_token}` },
          body: new URLSearchParams({ public_token, category }),
        });
        if (res.ok) {
          toast.success('Source connected.');
          onConnected(selectedCategory?.label || 'Connected source');
        } else {
          toast.error('Connection service error. Please try again or contact support.');
        }
      } catch { toast.error('Connection service error. Please try again or contact support.'); }
      setMergeLinkToken('');
      setOpeningMerge(false);
      setPendingOpen(false);
    },
    onExit: () => { setMergeLinkToken(''); setOpeningMerge(false); setPendingOpen(false); },
  });

  // Open modal when token + SDK both ready
  React.useEffect(() => {
    if (pendingOpen && mergeLinkToken && mergeReady) {
      openMergeModal();
      setPendingOpen(false);
    }
  }, [pendingOpen, mergeLinkToken, mergeReady, openMergeModal]);

  const connectCategory = async (cat) => {
    setSelectedCategory(cat);
    setOpeningMerge(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { toast.error('Please log in'); setOpeningMerge(false); return; }
      const res = await fetch(`${getBackendUrl()}/api/integrations/merge/link-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ categories: cat.mergeCategories }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.detail || 'Failed to open connection modal');
        setOpeningMerge(false);
        return;
      }
      const { link_token } = await res.json();
      setMergeLinkToken(link_token);
      setPendingOpen(true);
    } catch { toast.error('Connection failed'); setOpeningMerge(false); }
  };

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--ink-display, #0A0A0A)', fontFamily: fontFamily.display }}>
          Connect Business Tools
        </h2>
        <p className="text-sm" style={{ color: 'var(--ink-secondary, #8FA0B8)', fontFamily: fontFamily.body }}>
          Select a category to connect your systems.
        </p>
        <p className="text-xs mt-1" style={{ color: '#64748B', fontFamily: fontFamily.body }}>
          File Storage connects first; document analysis starts after source scope is selected.
        </p>
        {connectedList.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2 mt-2">
            {connectedList.map(c => (
              <span key={c} className="text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1"
                style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981', border: '1px solid rgba(16,185,129,0.2)', fontFamily: fontFamily.mono }}>
                <CheckCircle2 className="w-3 h-3" /> {c}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {INTEGRATION_CATEGORIES.map(cat => (
          <button key={cat.id}
            onClick={() => connectCategory(cat)}
            disabled={openingMerge}
            className="flex flex-col gap-2 p-3.5 rounded-xl text-left transition-all"
            style={{ background: 'var(--surface, #0E1628)', border: '1px solid rgba(140,170,210,0.15)' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = cat.color + '60'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(140,170,210,0.15)'}
            data-testid={`integration-cat-${cat.id}`}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: cat.color + '15' }}>
              {openingMerge && selectedCategory?.id === cat.id
                ? <Loader2 className="w-4 h-4 animate-spin" style={{ color: cat.color }} />
                : <Zap className="w-4 h-4" style={{ color: cat.color }} />
              }
            </div>
            <div>
              <p className="text-xs font-semibold" style={{ color: 'var(--ink-display, #0A0A0A)', fontFamily: fontFamily.body }}>{cat.label}</p>
              <p className="text-[10px]" style={{ color: '#64748B', fontFamily: fontFamily.body }}>{cat.desc}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="space-y-2 pt-1">
        <button onClick={onDone}
          className="w-full py-3 rounded-xl text-sm font-semibold transition-all"
          style={{ background: 'transparent', border: '1px solid rgba(140,170,210,0.15)', color: 'var(--ink-secondary, #8FA0B8)', fontFamily: fontFamily.body }}
          data-testid="integration-done">
          No, I'm Done for Now
        </button>
      </div>
    </div>
  );
};

// ── Step 4: All done ──────────────────────────────────────────────────────────

const AllDoneStep = ({ connectedList, onFinish }) => (
  <div className="space-y-5 text-center">
    <div>
      <div className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #E85D00, #E56A08)', boxShadow: '0 0 40px rgba(232,93,0,0.3)' }}>
        <Zap className="w-8 h-8 text-white" />
      </div>
      <h2 className="text-2xl font-semibold mb-2" style={{ color: 'var(--ink-display, #0A0A0A)', fontFamily: fontFamily.display }}>
        BIQc Is Active
      </h2>
      <p className="text-sm max-w-xs mx-auto leading-relaxed" style={{ color: 'var(--ink-secondary, #8FA0B8)', fontFamily: fontFamily.body }}>
        Your intelligence engine is now running. BIQc will monitor your connected systems and surface what matters.
      </p>
    </div>

    {connectedList.length > 0 && (
      <div className="rounded-xl p-4" style={{ background: 'var(--surface-sunken, #F5F5F5)', border: '1px solid #1E2D3D' }}>
        <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: '#E85D00', fontFamily: fontFamily.mono }}>Connected Systems</p>
        <div className="flex flex-wrap gap-2 justify-center">
          {connectedList.map(c => (
            <span key={c} className="text-[10px] px-2.5 py-1 rounded-full flex items-center gap-1"
              style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981', border: '1px solid rgba(16,185,129,0.2)', fontFamily: fontFamily.mono }}>
              <CheckCircle2 className="w-3 h-3" /> {c}
            </span>
          ))}
        </div>
      </div>
    )}

    <p className="text-xs" style={{ color: '#64748B', fontFamily: fontFamily.body }}>
      You can connect more systems at any time from <span style={{ color: '#E85D00' }}>Integrations</span> in the sidebar.
    </p>

    <button onClick={onFinish}
      className="w-full py-3.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all hover:brightness-110"
      style={{ background: 'linear-gradient(135deg, #E85D00, #E56A08)', color: 'white', fontFamily: fontFamily.body, boxShadow: '0 6px 24px rgba(232,93,0,0.25)' }}
      data-testid="onboarding-finish">
      Enter BIQc <ArrowRight className="w-4 h-4" />
    </button>
  </div>
);

// ── Welcome Back step (for returning users with integrations) ─────────────────
const WelcomeBackStep = ({ firstName, connectedCount, connectedNames, onConnectMore, onContinue }) => (
  <div className="space-y-5">
    <div className="text-center">
      <div className="w-14 h-14 rounded-2xl mx-auto mb-5 flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #E85D00, #E56A08)', boxShadow: '0 0 32px rgba(232,93,0,0.25)' }}>
        <Zap className="w-7 h-7 text-white" />
      </div>
      <h2 className="text-2xl font-semibold mb-2" style={{ color: 'var(--ink-display, #0A0A0A)', fontFamily: fontFamily.display }}>
        Welcome back{firstName ? `, ${firstName}` : ''}.
      </h2>
      <p className="text-sm" style={{ color: 'var(--ink-secondary, #8FA0B8)', fontFamily: fontFamily.body }}>
        {connectedCount > 0
          ? `Your intelligence engine is running with ${connectedCount} connected system${connectedCount !== 1 ? 's' : ''}${connectedNames ? ` (${connectedNames})` : ''}.`
          : 'Your BIQc Intelligence Platform is ready.'}
      </p>
    </div>

    <div className="rounded-xl p-4" style={{ background: 'rgba(232,93,0,0.06)', border: '1px solid rgba(232,93,0,0.15)' }}>
      <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: '#E85D00', fontFamily: fontFamily.mono }}>How BIQc works</p>
      {[
        'Connects to your business systems and reads signals continuously',
        'Detects risks before they compound across your operations',
        'Delivers personalised executive briefings — without you having to ask',
      ].map((item, i) => (
        <div key={i} className="flex items-start gap-2.5 mb-1.5">
          <div className="w-1 h-1 rounded-full mt-2 flex-shrink-0" style={{ background: '#E85D00' }} />
          <p className="text-xs leading-relaxed" style={{ color: 'var(--ink-secondary, #8FA0B8)', fontFamily: fontFamily.body }}>{item}</p>
        </div>
      ))}
    </div>

    <div className="rounded-xl p-4" style={{ background: 'var(--surface-sunken, #F5F5F5)', border: '1px solid #1E2D3D' }}>
      <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: '#10B981', fontFamily: fontFamily.mono }}>Your data security</p>
      <div className="grid grid-cols-2 gap-2">
        {[
          { icon: Lock, text: 'AES-256 encryption, at rest and in transit' },
          { icon: Shield, text: 'Australian hosted — zero offshore' },
          { icon: Database, text: 'Read-only — BIQc never modifies your data' },
          { icon: RefreshCw, text: 'Revoke access instantly at any time' },
        ].map((pt, i) => (
          <div key={i} className="flex items-start gap-1.5">
            <pt.icon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: '#10B981' }} />
            <p className="text-[10px] leading-snug" style={{ color: '#64748B', fontFamily: fontFamily.body }}>{pt.text}</p>
          </div>
        ))}
      </div>
    </div>

    <div className="space-y-2.5">
      <button onClick={onContinue}
        className="w-full py-3.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all hover:brightness-110"
        style={{ background: 'linear-gradient(135deg, #E85D00, #E56A08)', color: 'white', fontFamily: fontFamily.body, boxShadow: '0 6px 20px rgba(232,93,0,0.25)' }}
        data-testid="welcome-back-continue">
        Continue to Intelligence Platform <ArrowRight className="w-4 h-4" />
      </button>
      <button onClick={onConnectMore}
        className="w-full py-2.5 rounded-xl text-sm font-medium transition-all"
        style={{ background: 'transparent', border: '1px solid rgba(140,170,210,0.15)', color: 'var(--ink-secondary, #8FA0B8)', fontFamily: fontFamily.body }}
        data-testid="welcome-back-connect-more">
        <Plug className="w-3.5 h-3.5 inline mr-2" />Connect More Integrations
      </button>
    </div>
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────

// sessionStorage key — resets on every new browser session (every login)
const SESSION_KEY = 'biqc_onboarding_shown';
const PERSISTENT_KEY = 'biqc_onboarding_shown_persist';

export const useFirstTimeOnboarding = ({ enabled = false } = {}) => {
  // Read URL params synchronously BEFORE setting initial state
  const params = new URLSearchParams(window.location.search);
  const isOAuthReturn = params.get('onboarding') === 'email_connected';
  const returnProvider = isOAuthReturn
    ? (params.get('outlook_connected') === 'true' ? 'Outlook' : params.get('gmail_connected') === 'true' ? 'Gmail' : null)
    : null;

  const [show, setShow] = useState(() => isOAuthReturn);
  const [emailConnectedProvider, setEmailConnectedProvider] = useState(returnProvider);
  const [dismissed, setDismissed] = useState(() => {
    return sessionStorage.getItem(SESSION_KEY) === '1' || localStorage.getItem(PERSISTENT_KEY) === '1';
  });

  React.useEffect(() => {
    if (isOAuthReturn) {
      window.history.replaceState({}, '', '/advisor');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    if (isOAuthReturn) {
      setShow(true);
      return;
    }
    setShow(Boolean(enabled) && !dismissed);
  }, [enabled, dismissed, isOAuthReturn]);

  const dismiss = useCallback(() => {
    sessionStorage.setItem(SESSION_KEY, '1');
    localStorage.setItem(PERSISTENT_KEY, '1');
    setDismissed(true);
    setShow(false);
  }, []);

  return { show: show && !dismissed, dismiss, emailConnectedProvider };
};

const FirstTimeOnboarding = ({ onClose, initialEmailProvider = null, hasConnections = false, connectedCount = 0, connectedNames = '', firstName = '' }) => {
  // Returning users with integrations start at 'welcome_back' step
  const [step, setStep] = useState(() => {
    if (hasConnections) return 'welcome_back';
    return initialEmailProvider ? 2 : 0;
  });
  const [connectedList, setConnectedList] = useState(initialEmailProvider ? [initialEmailProvider] : []);
  const [mergeLinkToken, setMergeLinkToken] = useState('');

  // Jump to Step 2 if initialEmailProvider arrives after mount (OAuth return race)
  React.useEffect(() => {
    if (initialEmailProvider && step === 0) {
      setStep(2);
      setConnectedList([initialEmailProvider]);
    }
  }, [initialEmailProvider]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleEmailConnected = (provider) => {
    setConnectedList(prev => [...prev, provider]);
    setStep(2);
  };

  const handleMoreYes = () => setStep(3);

  const handleMoreNo = () => setStep(4);

  const handleIntegrationConnected = (provider) => {
    setConnectedList(prev => [...prev, provider]);
    // Stay on step 3 — show "connect more?" options again by staying in loop
  };

  const handleIntegrationDone = () => setStep(4);

  const handleFinish = () => {
    sessionStorage.setItem(SESSION_KEY, '1');
    localStorage.setItem(PERSISTENT_KEY, '1');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4"
      style={{ background: 'rgba(7,14,24,0.92)', backdropFilter: 'blur(16px)' }}
      data-testid="first-time-onboarding">

      <div className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background: 'var(--surface, #FFFFFF)', border: '1px solid #1E2D3D', boxShadow: '0 24px 80px rgba(0,0,0,0.7)', maxHeight: '90vh', overflowY: 'auto' }}>

        {/* Header bar */}
        <div className="flex items-center justify-between px-5 py-3.5"
          style={{ borderBottom: '1px solid #1E2D3D' }}>
          <div className="flex items-center gap-2">
            <img src="/biqc-horizontal-light.svg" alt="BIQc.ai" style={{ width: 42, height: 'auto' }} />
            <span className="text-xs font-semibold" style={{ color: 'var(--ink-secondary, #8FA0B8)', fontFamily: fontFamily.mono }}>
              {step === 'welcome_back' ? 'Welcome Back' : step === 0 ? 'Getting Started' : step === 1 ? 'Connect Email' : step === 2 ? 'Build Intelligence' : step === 3 ? 'Connect Tools' : 'Ready'}
            </span>
          </div>
          {(step !== 0) && (
            <button onClick={handleFinish} className="p-1 rounded-lg hover:bg-black/5"
              style={{ color: '#4A5568' }} data-testid="onboarding-close">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Step content */}
        <div className="p-5">
          {step === 'welcome_back' && (
            <WelcomeBackStep
              firstName={firstName}
              connectedCount={connectedCount}
              connectedNames={connectedNames}
              onContinue={handleFinish}
              onConnectMore={() => setStep(3)}
            />
          )}
          {step === 0 && (
            <WelcomeStep
              onConnect={() => setStep(1)}
              onSkip={handleFinish}
            />
          )}
          {step === 1 && (
            <EmailStep
              onSkip={() => setStep(3)}
              onConnected={handleEmailConnected}
            />
          )}
          {step === 2 && (
            <ConnectMoreStep
              emailProvider={connectedList[connectedList.length - 1]}
              onYes={handleMoreYes}
              onNo={handleMoreNo}
            />
          )}
          {step === 3 && (
            <IntegrationStep
              connectedList={connectedList}
              onConnected={handleIntegrationConnected}
              onDone={handleIntegrationDone}
              mergeLinkToken={mergeLinkToken}
              setMergeLinkToken={setMergeLinkToken}
            />
          )}
          {step === 4 && (
            <AllDoneStep
              connectedList={connectedList}
              onFinish={handleFinish}
            />
          )}
        </div>

        {/* Progress dots */}
        {step < 4 && (
          <div className="flex justify-center gap-1.5 pb-4">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="w-1.5 h-1.5 rounded-full transition-all"
                style={{ background: i === step ? '#E85D00' : 'rgba(140,170,210,0.15)', width: i === step ? 20 : 6 }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FirstTimeOnboarding;
