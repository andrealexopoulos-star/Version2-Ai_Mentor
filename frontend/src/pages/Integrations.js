import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search, CheckCircle2, LogOut, RefreshCw, Loader2, Zap,
  Users, DollarSign, Briefcase, UserPlus, Ticket, HardDrive,
  BookOpen, Mail, LayoutGrid, ChevronDown, X, Plug, ExternalLink
} from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { apiClient } from '../lib/api';
import { supabase } from '../context/SupabaseAuthContext';
import { getBackendUrl } from '../config/urls';
import { toast } from 'sonner';
import { useMergeLink } from '@mergeapi/react-merge-link';
import { fontFamily } from '../design-system/tokens';

// ── Clearbit logo helper (graceful dark fallback — no orange) ────────────────
const Logo = ({ domain, name, size = 48 }) => {
  const [err, setErr] = useState(false);
  if (err) {
    return (
      <div className="flex items-center justify-center rounded-xl font-bold"
        style={{
          width: size, height: size,
          background: 'var(--biqc-bg-elevated, #1A2332)',
          border: '1px solid var(--biqc-border, #243140)',
          color: '#9FB0C3',
          fontSize: size * 0.28,
          fontFamily: fontFamily.mono,
        }}>
        {name.slice(0, 2).toUpperCase()}
      </div>
    );
  }
  return (
    <div className="bg-white rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0"
      style={{ width: size, height: size, boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }}>
      <img
        src={`https://logo.clearbit.com/${domain}`}
        alt={name}
        style={{ width: size - 10, height: size - 10, objectFit: 'contain' }}
        onError={() => setErr(true)}
      />
    </div>
  );
};

// ── Integration registry ──────────────────────────────────────────────────────
const CATEGORIES = [
  { id: 'all',       label: 'All Apps',       icon: LayoutGrid },
  { id: 'email',     label: 'Email',          icon: Mail       },
  { id: 'crm',       label: 'CRM',            icon: Users      },
  { id: 'financial', label: 'Financial',      icon: DollarSign },
  { id: 'hris',      label: 'HR & Payroll',   icon: Briefcase  },
  { id: 'ats',       label: 'ATS',            icon: UserPlus   },
  { id: 'ticketing', label: 'Ticketing',      icon: Ticket     },
  { id: 'storage',   label: 'File Storage',   icon: HardDrive  },
  { id: 'knowledge', label: 'Knowledge Base', icon: BookOpen   },
];

const ALL_INTEGRATIONS = [
  // ── Email ──
  { id:'gmail',      name:'Gmail',             domain:'gmail.com',             category:'email',     desc:'Read emails for AI context and client intelligence',    type:'gmail'   },
  { id:'outlook',    name:'Microsoft Outlook', domain:'microsoft.com',         category:'email',     desc:'Connect Microsoft 365 for email intelligence',          type:'outlook' },
  // ── CRM ──
  { id:'hubspot',       name:'HubSpot',                   domain:'hubspot.com',         category:'crm', desc:'Sync contacts, deals and pipeline data',           type:'merge' },
  { id:'salesforce',    name:'Salesforce',                domain:'salesforce.com',      category:'crm', desc:'Enterprise CRM sync — contacts, pipeline, forecasts', type:'merge' },
  { id:'pipedrive',     name:'Pipedrive',                 domain:'pipedrive.com',       category:'crm', desc:'Sales pipeline and deal management',               type:'merge' },
  { id:'zoho-crm',      name:'Zoho CRM',                  domain:'zoho.com',            category:'crm', desc:'Multichannel CRM platform',                        type:'merge' },
  { id:'microsoft-dynamics-sales', name:'Microsoft Dynamics 365', domain:'microsoft.com', category:'crm', desc:'Enterprise CRM and sales intelligence',         type:'merge' },
  { id:'activecampaign',name:'ActiveCampaign',            domain:'activecampaign.com',  category:'crm', desc:'Marketing automation and CRM',                     type:'merge' },
  { id:'copper',        name:'Copper',                    domain:'copper.com',          category:'crm', desc:'CRM built for Google Workspace',                   type:'merge' },
  { id:'close',         name:'Close',                     domain:'close.com',           category:'crm', desc:'CRM for inside sales teams',                       type:'merge' },
  { id:'freshsales',    name:'Freshsales',                domain:'freshworks.com',      category:'crm', desc:'AI-powered sales CRM',                             type:'merge' },
  { id:'zendesk-sell',  name:'Zendesk Sell',              domain:'zendesk.com',         category:'crm', desc:'Sales CRM to enhance productivity',                type:'merge' },
  { id:'keap',          name:'Keap',                      domain:'keap.com',            category:'crm', desc:'CRM and automation for small businesses',          type:'merge' },
  { id:'insightly',     name:'Insightly',                 domain:'insightly.com',       category:'crm', desc:'CRM and project management',                       type:'merge' },
  { id:'nutshell',      name:'Nutshell',                  domain:'nutshell.com',        category:'crm', desc:'Sales automation CRM',                             type:'merge' },
  { id:'capsule',       name:'Capsule',                   domain:'capsulecrm.com',      category:'crm', desc:'Simple online CRM',                                type:'merge' },
  // ── Financial ──
  { id:'xero',          name:'Xero',            domain:'xero.com',            category:'financial', desc:'Online accounting for small businesses',              type:'merge' },
  { id:'quickbooks',    name:'QuickBooks Online',domain:'quickbooks.intuit.com',category:'financial',desc:'Bookkeeping and financial reporting',                 type:'merge' },
  { id:'netsuite',      name:'NetSuite',         domain:'netsuite.com',        category:'financial', desc:'Cloud ERP and accounting suite',                      type:'merge' },
  { id:'sage',          name:'Sage Business Cloud',domain:'sage.com',          category:'financial', desc:'Accounting and payroll software',                     type:'merge' },
  { id:'freshbooks',    name:'FreshBooks',       domain:'freshbooks.com',      category:'financial', desc:'Invoicing and accounting for SMBs',                   type:'merge' },
  { id:'wave',          name:'Wave Financial',   domain:'waveapps.com',        category:'financial', desc:'Free accounting for small businesses',                type:'merge' },
  { id:'zoho-books',    name:'Zoho Books',        domain:'zoho.com',           category:'financial', desc:'Online accounting software',                          type:'merge' },
  { id:'myob',          name:'MYOB',              domain:'myob.com',           category:'financial', desc:'Business management for Australian SMBs',             type:'merge' },
  { id:'freeagent',     name:'FreeAgent',         domain:'freeagent.com',      category:'financial', desc:'Accounting for freelancers and agencies',             type:'merge' },
  { id:'stripe',        name:'Stripe',            domain:'stripe.com',         category:'financial', desc:'Payment processing and revenue analytics',            type:'merge' },
  // ── HRIS ──
  { id:'bamboohr',      name:'BambooHR',          domain:'bamboohr.com',       category:'hris', desc:'HR software for SMBs — people data and analytics',       type:'merge' },
  { id:'workday',       name:'Workday',            domain:'workday.com',        category:'hris', desc:'Enterprise HR, finance and planning',                     type:'merge' },
  { id:'gusto',         name:'Gusto',              domain:'gusto.com',          category:'hris', desc:'Payroll, benefits and HR platform',                       type:'merge' },
  { id:'deel',          name:'Deel',               domain:'deel.com',           category:'hris', desc:'Global payroll and compliance',                           type:'merge' },
  { id:'dayforce',      name:'Dayforce',           domain:'ceridian.com',       category:'hris', desc:'Human capital management platform',                       type:'merge' },
  { id:'employment-hero',name:'Employment Hero',  domain:'employmenthero.com', category:'hris', desc:'HR, payroll and benefits for Australian businesses',      type:'merge' },
  { id:'rippling',      name:'Rippling',           domain:'rippling.com',       category:'hris', desc:'Workforce management platform',                           type:'merge' },
  { id:'adp',           name:'ADP Workforce Now',  domain:'adp.com',           category:'hris', desc:'Comprehensive HR and payroll solution',                   type:'merge' },
  { id:'freshteam',     name:'Freshteam',          domain:'freshworks.com',     category:'hris', desc:'Smart HR software for growing businesses',                type:'merge' },
  { id:'factorial',     name:'Factorial',          domain:'factorialhr.com',    category:'hris', desc:'HR software for SMBs',                                   type:'merge' },
  // ── ATS ──
  { id:'greenhouse',    name:'Greenhouse',         domain:'greenhouse.io',      category:'ats', desc:'Recruiting and onboarding software',                      type:'merge' },
  { id:'lever',         name:'Lever',              domain:'lever.co',           category:'ats', desc:'Talent acquisition and nurture platform',                  type:'merge' },
  { id:'workable',      name:'Workable',           domain:'workable.com',       category:'ats', desc:'AI-powered recruiting software',                           type:'merge' },
  { id:'jobadder',      name:'JobAdder',           domain:'jobadder.com',       category:'ats', desc:'Recruitment software for agencies',                        type:'merge' },
  { id:'icims',         name:'iCIMS',              domain:'icims.com',          category:'ats', desc:'Enterprise talent acquisition suite',                       type:'merge' },
  { id:'breezy',        name:'Breezy HR',          domain:'breezy.hr',          category:'ats', desc:'Modern recruiting software',                               type:'merge' },
  // ── Ticketing ──
  { id:'jira',          name:'Jira',               domain:'atlassian.com',      category:'ticketing', desc:'Issue tracking and project management',              type:'merge' },
  { id:'asana',         name:'Asana',              domain:'asana.com',          category:'ticketing', desc:'Work management and project tracking',               type:'merge' },
  { id:'clickup',       name:'ClickUp',            domain:'clickup.com',        category:'ticketing', desc:'All-in-one productivity platform',                   type:'merge' },
  { id:'linear',        name:'Linear',             domain:'linear.app',         category:'ticketing', desc:'Modern project management for software teams',       type:'merge' },
  { id:'zendesk',       name:'Zendesk',            domain:'zendesk.com',        category:'ticketing', desc:'Customer service and ticketing platform',            type:'merge' },
  { id:'freshdesk',     name:'Freshdesk',          domain:'freshworks.com',     category:'ticketing', desc:'Customer support software',                         type:'merge' },
  { id:'intercom',      name:'Intercom',           domain:'intercom.com',       category:'ticketing', desc:'Customer messaging and support platform',            type:'merge' },
  { id:'github',        name:'GitHub Issues',      domain:'github.com',         category:'ticketing', desc:'Issue tracking for software projects',              type:'merge' },
  { id:'azure-devops',  name:'Azure DevOps',       domain:'microsoft.com',      category:'ticketing', desc:'Development collaboration tools',                   type:'merge' },
  { id:'monday',        name:'Monday.com',         domain:'monday.com',         category:'ticketing', desc:'Work operating system for teams',                   type:'merge' },
  { id:'basecamp',      name:'Basecamp',           domain:'basecamp.com',       category:'ticketing', desc:'Project management and team collaboration',          type:'merge' },
  // ── File Storage ──
  { id:'google-drive',  name:'Google Drive',       domain:'google.com',         category:'storage', desc:'Cloud storage and document management',               type:'merge_storage' },
  { id:'onedrive',      name:'Microsoft OneDrive', domain:'microsoft.com',      category:'storage', desc:'Cloud storage integrated with Microsoft 365',         type:'merge_storage' },
  { id:'dropbox',       name:'Dropbox',            domain:'dropbox.com',        category:'storage', desc:'Cloud file hosting and collaboration',                 type:'merge_storage' },
  { id:'box',           name:'Box',                domain:'box.com',            category:'storage', desc:'Secure cloud content management',                     type:'merge_storage' },
  // ── Knowledge Base ──
  { id:'confluence',    name:'Confluence',         domain:'atlassian.com',      category:'knowledge', desc:'Team wiki and knowledge management',                 type:'merge_storage' },
  { id:'notion',        name:'Notion',             domain:'notion.so',          category:'knowledge', desc:'All-in-one workspace for notes and docs',            type:'merge_storage' },
  { id:'sharepoint',    name:'SharePoint',         domain:'microsoft.com',      category:'knowledge', desc:'Microsoft collaboration and document management',    type:'merge_storage' },
];

const MERGE_CATEGORY_MAP = {
  crm: ['accounting','crm','hris','ats'],
  financial: ['accounting','crm','hris','ats'],
  hris: ['hris','ats'],
  ats: ['ats','hris'],
  ticketing: ['ticketing'],
  storage: ['file_storage'],
  knowledge: ['file_storage'],
};

export default function Integrations() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [mergeIntegrations, setMergeIntegrations] = useState({});
  const [outlookStatus, setOutlookStatus] = useState({ connected: false, connected_email: null, emails_synced: 0 });
  const [gmailStatus, setGmailStatus] = useState({ connected: false, connected_email: null });
  const [disconnecting, setDisconnecting] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [openingMerge, setOpeningMerge] = useState(false);
  const [mergeLinkToken, setMergeLinkToken] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Merge Link hook
  const { open: openMergeLinkModal, isReady: mergeLinkReady } = useMergeLink({
    linkToken: mergeLinkToken,
    onSuccess: async (public_token, metadata) => {
      const category = metadata?.integration?.categories?.[0] || metadata?.category || 'crm';
      const provider = metadata?.integration?.name || 'Unknown';
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) { toast.error('Session expired. Please log in again.'); setMergeLinkToken(null); return; }
        const response = await fetch(`${getBackendUrl()}/api/integrations/merge/exchange-account-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': `Bearer ${session.access_token}`, 'Cache-Control': 'no-cache' },
          body: new URLSearchParams({ public_token, category })
        });
        if (response.ok) {
          toast.success(`${provider} connected successfully!`);
          await loadMergeIntegrations();
        } else {
          const err = await response.json().catch(() => ({}));
          toast.error(`Failed to connect ${provider}: ${err.detail || 'Server error'}`);
        }
      } catch (e) {
        toast.error(`Failed to connect ${provider}: ${e.message}`);
      }
      setMergeLinkToken(null);
    },
    onExit: async (error) => {
      if (error) toast.error(`Connection failed: ${error.message || 'Unknown error'}`);
      setTimeout(() => loadMergeIntegrations(), 1500);
      setMergeLinkToken(null);
    },
  });

  // ── Data loading ────────────────────────────────────────────────────────────
  const loadMergeIntegrations = useCallback(async () => {
    try {
      const res = await apiClient.get('/integrations/merge/connected');
      setMergeIntegrations(res.data?.integrations || {});
    } catch {}
  }, []);

  const loadOutlookStatus = useCallback(async () => {
    try {
      const res = await apiClient.get('/outlook/status');
      if (!res.data?.degraded) setOutlookStatus(res.data);
    } catch {}
  }, []);

  const loadGmailStatus = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`${process.env.REACT_APP_SUPABASE_URL}/functions/v1/gmail_prod`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.ok && data.connected) setGmailStatus({ connected: true, connected_email: session.user?.email });
    } catch {}
  }, []);

  useEffect(() => {
    loadMergeIntegrations();
    loadOutlookStatus();
    loadGmailStatus();
  }, [loadMergeIntegrations, loadOutlookStatus, loadGmailStatus]);

  // Handle OAuth callbacks
  useEffect(() => {
    const outlookConnected = searchParams.get('outlook_connected');
    const gmailConnected = searchParams.get('gmail_connected');
    const connectedEmail = searchParams.get('connected_email');
    const err = searchParams.get('outlook_error') || searchParams.get('gmail_error');
    if (outlookConnected === 'true') { toast.success(connectedEmail ? `Outlook (${decodeURIComponent(connectedEmail)}) connected!` : 'Outlook connected!'); setSearchParams({}); setTimeout(loadOutlookStatus, 2000); }
    if (gmailConnected === 'true') { toast.success(connectedEmail ? `Gmail (${decodeURIComponent(connectedEmail)}) connected!` : 'Gmail connected!'); setSearchParams({}); setTimeout(loadGmailStatus, 2000); }
    if (err) { toast.error(`Connection error: ${err}`); setSearchParams({}); }
  }, [searchParams, setSearchParams, loadOutlookStatus, loadGmailStatus]);

  // ── Connection helpers ──────────────────────────────────────────────────────
  const openMergeLink = useCallback(async (categories = ['accounting', 'crm', 'hris', 'ats']) => {
    setOpeningMerge(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { toast.error('Please log in to connect integrations'); setOpeningMerge(false); return; }
      const res = await fetch(`${getBackendUrl()}/api/integrations/merge/link-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}`, 'Cache-Control': 'no-cache' },
        body: JSON.stringify({ categories }),
      });
      if (!res.headers.get('content-type')?.includes('application/json')) {
        toast.error('Connection error — please try again');
        setOpeningMerge(false);
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = res.status === 503
          ? 'Integration service is not yet configured on this environment. Works on production.'
          : err.detail || 'Server error';
        toast.error(msg);
        setOpeningMerge(false);
        return;
      }
      const { link_token } = await res.json();
      if (!link_token) { toast.error('Invalid response from server'); setOpeningMerge(false); return; }
      setMergeLinkToken(link_token);
      // Wait for Merge SDK to become ready before opening
      let attempts = 0;
      const tryOpen = () => {
        attempts++;
        if (mergeLinkReady) { openMergeLinkModal(); setOpeningMerge(false); }
        else if (attempts < 20) setTimeout(tryOpen, 200);
        else { toast.error('Connection modal failed to load. Please refresh and try again.'); setOpeningMerge(false); }
      };
      setTimeout(tryOpen, 150);
    } catch (e) {
      toast.error('Failed to open connection modal');
      setOpeningMerge(false);
    }
  }, [mergeLinkReady, openMergeLinkModal]);

  const handleConnect = useCallback(async (integration) => {
    if (integration.type === 'outlook') {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { toast.error('Please log in'); return; }
      window.location.assign(`${getBackendUrl()}/api/auth/outlook/login?token=${session.access_token}&returnTo=/integrations`);
      return;
    }
    if (integration.type === 'gmail') {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { toast.error('Please log in'); return; }
      window.location.assign(`${getBackendUrl()}/api/auth/gmail/login?token=${session.access_token}&returnTo=/integrations`);
      return;
    }
    if (integration.type === 'merge') {
      const cats = MERGE_CATEGORY_MAP[integration.category] || ['crm'];
      await openMergeLink(cats);
      return;
    }
    if (integration.type === 'merge_storage') {
      await openMergeLink(['file_storage']);
      return;
    }
  }, [openMergeLink]);

  const handleDisconnect = useCallback(async (integration) => {
    if (!window.confirm(`Disconnect ${integration.name}? This will stop data collection.`)) return;
    setDisconnecting(integration.id);
    try {
      if (integration.type === 'outlook') {
        await apiClient.post('/outlook/disconnect');
        setOutlookStatus({ connected: false, connected_email: null, emails_synced: 0 });
        toast.success('Outlook disconnected');
      } else if (integration.type === 'gmail') {
        await apiClient.post('/gmail/disconnect');
        setGmailStatus({ connected: false, connected_email: null });
        toast.success('Gmail disconnected');
      } else {
        const key = Object.keys(mergeIntegrations).find(k => k.toLowerCase() === integration.id || k.toLowerCase() === integration.name.toLowerCase());
        if (key) {
          await apiClient.post('/merge/disconnect', { provider: key, category: integration.category });
          setMergeIntegrations(prev => { const n = { ...prev }; delete n[key]; return n; });
          toast.success(`${integration.name} disconnected`);
        }
      }
    } catch (e) {
      toast.error(`Failed to disconnect: ${e.response?.data?.detail || e.message}`);
    }
    setDisconnecting(null);
  }, [mergeIntegrations]);

  // ── Resolve connected state ─────────────────────────────────────────────────
  const isConnected = useCallback((integration) => {
    if (integration.type === 'outlook') return outlookStatus.connected;
    if (integration.type === 'gmail') return gmailStatus.connected;
    return Object.keys(mergeIntegrations).some(k =>
      k.toLowerCase() === integration.id ||
      k.toLowerCase() === integration.name.toLowerCase() ||
      k.toLowerCase().includes(integration.id)
    );
  }, [outlookStatus, gmailStatus, mergeIntegrations]);

  const getConnectedEmail = (integration) => {
    if (integration.type === 'outlook') return outlookStatus.connected_email;
    if (integration.type === 'gmail') return gmailStatus.connected_email;
    return null;
  };

  // ── Filtering ────────────────────────────────────────────────────────────────
  const filtered = ALL_INTEGRATIONS.filter(i => {
    const matchCat = selectedCategory === 'all' || i.category === selectedCategory;
    const matchSearch = !searchTerm || i.name.toLowerCase().includes(searchTerm.toLowerCase()) || i.desc.toLowerCase().includes(searchTerm.toLowerCase());
    return matchCat && matchSearch;
  });

  const connectedCount = ALL_INTEGRATIONS.filter(i => isConnected(i)).length;

  const catLabel = CATEGORIES.find(c => c.id === selectedCategory)?.label || 'All Apps';

  return (
    <DashboardLayout>
      <div className="flex min-h-[calc(100vh-56px)]" style={{ background: 'var(--biqc-bg)', fontFamily: fontFamily.body }}>

        {/* ── Desktop Sidebar ── */}
        <aside className="hidden lg:flex flex-col w-56 shrink-0 border-r py-6 px-3" style={{ borderColor: 'var(--biqc-border)', background: 'var(--biqc-bg)' }}>
          <p className="text-[10px] font-semibold uppercase tracking-widest px-3 mb-3" style={{ color: '#FF6A00', fontFamily: fontFamily.mono }}>Categories</p>
          {CATEGORIES.map(cat => {
            const Icon = cat.icon;
            const active = selectedCategory === cat.id;
            const count = cat.id === 'all' ? ALL_INTEGRATIONS.length : ALL_INTEGRATIONS.filter(i => i.category === cat.id).length;
            return (
              <button key={cat.id} onClick={() => setSelectedCategory(cat.id)}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm w-full text-left transition-all mb-0.5"
                style={{
                  background: active ? 'rgba(255,106,0,0.1)' : 'transparent',
                  color: active ? '#FF6A00' : '#9FB0C3',
                  borderLeft: active ? '2px solid #FF6A00' : '2px solid transparent',
                  fontWeight: active ? 600 : 400,
                }}
                data-testid={`integrations-category-${cat.id}`}>
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1">{cat.label}</span>
                <span className="text-[10px]" style={{ color: active ? '#FF6A00' : '#4A5568', fontFamily: fontFamily.mono }}>{count}</span>
              </button>
            );
          })}
        </aside>

        {/* ── Main Content ── */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-semibold mb-1" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.display }}>Integrations</h1>
              <p className="text-sm" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>
                {connectedCount > 0
                  ? <span><span style={{ color: '#10B981' }}>{connectedCount} connected</span> · {ALL_INTEGRATIONS.length} total available</span>
                  : `${ALL_INTEGRATIONS.length} integrations available — connect your first system`}
              </p>
            </div>
            {/* Search */}
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#4A5568' }} />
              <input
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search integrations..."
                className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)', color: 'var(--biqc-text)' }}
                data-testid="integrations-search"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#4A5568' }}>
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Mobile category dropdown */}
          <div className="lg:hidden mb-4 relative">
            <button onClick={() => setMobileOpen(!mobileOpen)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm"
              style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)', color: 'var(--biqc-text)' }}>
              <span>{catLabel}</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${mobileOpen ? 'rotate-180' : ''}`} style={{ color: '#64748B' }} />
            </button>
            {mobileOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden z-20 shadow-2xl"
                style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }}>
                {CATEGORIES.map(cat => {
                  const Icon = cat.icon;
                  return (
                    <button key={cat.id} onClick={() => { setSelectedCategory(cat.id); setMobileOpen(false); }}
                      className="flex items-center gap-3 px-4 py-3 w-full text-left text-sm hover:bg-white/5"
                      style={{ color: selectedCategory === cat.id ? '#FF6A00' : '#9FB0C3' }}>
                      <Icon className="w-4 h-4" />
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section title */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#4A5568', fontFamily: fontFamily.mono }}>
              {searchTerm ? `${filtered.length} results for "${searchTerm}"` : catLabel}
            </p>
            {connectedCount > 0 && (
              <div className="flex items-center gap-1.5 text-xs" style={{ color: '#10B981', fontFamily: fontFamily.mono }}>
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#10B981' }} />
                {connectedCount} connected
              </div>
            )}
          </div>

          {/* Grid */}
          {filtered.length === 0 ? (
            <div className="text-center py-20">
              <Plug className="w-8 h-8 mx-auto mb-3" style={{ color: '#243140' }} />
              <p className="text-sm" style={{ color: '#64748B' }}>No integrations found for "{searchTerm}"</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map(integration => {
                const connected = isConnected(integration);
                const connEmail = getConnectedEmail(integration);
                const isDisconnecting = disconnecting === integration.id;

                return (
                  <div key={integration.id}
                    className="group relative flex flex-col rounded-xl p-5 transition-all duration-200 hover:-translate-y-0.5"
                    style={{
                      background: 'var(--biqc-bg-card)',
                      border: `1px solid ${connected ? 'rgba(16,185,129,0.3)' : '#243140'}`,
                      boxShadow: connected ? '0 0 16px rgba(16,185,129,0.08)' : 'none',
                    }}
                    onMouseEnter={e => { if (!connected) e.currentTarget.style.borderColor = 'rgba(255,106,0,0.4)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = connected ? 'rgba(16,185,129,0.3)' : '#243140'; }}
                    data-testid={`integration-card-${integration.id}`}
                  >
                    {/* Connected glow dot */}
                    {connected && (
                      <div className="absolute top-4 right-4 w-2 h-2 rounded-full" style={{ background: '#10B981', boxShadow: '0 0 8px rgba(16,185,129,0.8)' }} />
                    )}

                    {/* Top row: logo + name */}
                    <div className="flex items-center gap-3 mb-3">
                      <Logo domain={integration.domain} name={integration.name} size={44} />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.display }}>{integration.name}</p>
                        {connected && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <CheckCircle2 className="w-3 h-3" style={{ color: '#10B981' }} />
                            <span className="text-[10px] font-medium" style={{ color: '#10B981', fontFamily: fontFamily.mono }}>
                              {connEmail || 'Connected'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-xs leading-relaxed mb-4 flex-1" style={{ color: '#64748B' }}>{integration.desc}</p>

                    {/* Action button */}
                    {connected ? (
                      <button
                        onClick={() => handleDisconnect(integration)}
                        disabled={isDisconnecting}
                        className="w-full py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
                        style={{ background: 'transparent', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        data-testid={`disconnect-${integration.id}`}
                      >
                        {isDisconnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
                        {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleConnect(integration)}
                        disabled={openingMerge}
                        className="w-full py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 text-white"
                        style={{ background: '#FF6A00' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#E55F00'}
                        onMouseLeave={e => e.currentTarget.style.background = '#FF6A00'}
                        data-testid={`connect-${integration.id}`}
                      >
                        {openingMerge ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plug className="w-3.5 h-3.5" />}
                        {openingMerge ? 'Opening...' : 'Connect'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer note */}
          <p className="text-center text-[11px] mt-8 pb-4" style={{ color: '#2D3E50', fontFamily: fontFamily.mono }}>
            Powered by Merge.dev — enterprise-grade data security · All connections encrypted
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
