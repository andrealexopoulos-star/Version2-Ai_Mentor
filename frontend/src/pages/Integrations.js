import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search, CheckCircle2, LogOut, RefreshCw, Loader2, Zap,
  Users, DollarSign, Briefcase, UserPlus, Ticket, HardDrive,
  BookOpen, Mail, LayoutGrid, X, Plug, Calendar,
  TrendingUp, Megaphone, ChevronRight, Clock
} from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { apiClient } from '../lib/api';
import { supabase, useSupabaseAuth } from '../context/SupabaseAuthContext';
import { getBackendUrl } from '../config/urls';
import { toast } from 'sonner';
import { useMergeLink } from '@mergeapi/react-merge-link';
import { fontFamily } from '../design-system/tokens';

// ── Clearbit logo with dark fallback ─────────────────────────────────────────
const Logo = ({ domain, name, size = 36 }) => {
  const [err, setErr] = useState(false);
  if (err) {
    return (
      <div className="flex items-center justify-center rounded-lg font-bold flex-shrink-0"
        style={{ width: size, height: size, background: 'var(--biqc-bg-elevated, #1A2332)', border: '1px solid var(--biqc-border, #243140)', color: '#9FB0C3', fontSize: size * 0.3, fontFamily: fontFamily.mono }}>
        {name.slice(0, 2).toUpperCase()}
      </div>
    );
  }
  return (
    <div className="bg-white rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0"
      style={{ width: size, height: size, boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }}>
      <img src={`https://logo.clearbit.com/${domain}`} alt={name}
        style={{ width: size - 8, height: size - 8, objectFit: 'contain' }}
        loading="lazy"
        onError={() => setErr(true)} />
    </div>
  );
};

// ── Categories ────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: 'all',        label: 'All',            icon: LayoutGrid },
  { id: 'connected',  label: 'Connected',      icon: CheckCircle2 },
  { id: 'crm',        label: 'CRM',            icon: Users      },
  { id: 'financial',  label: 'Financial',      icon: DollarSign },
  { id: 'ecommerce',  label: 'E-Commerce',     icon: TrendingUp },
  { id: 'hris',       label: 'HR & Payroll',   icon: Briefcase  },
  { id: 'ats',        label: 'ATS',            icon: UserPlus   },
  { id: 'ticketing',  label: 'Ticketing',      icon: Ticket     },
  { id: 'storage',    label: 'File Storage',   icon: HardDrive  },
  { id: 'knowledge',  label: 'Knowledge',      icon: BookOpen   },
];

// ── Integration registry ──────────────────────────────────────────────────────
const EMAIL_CALENDAR = [
  { id: 'gmail',            name: 'Gmail',              domain: 'gmail.com',     category: 'email',    desc: 'Inbox intelligence — priority triage, reply drafting, client signals', type: 'gmail'    },
  { id: 'outlook',          name: 'Microsoft Outlook',  domain: 'microsoft.com', category: 'email',    desc: 'Email + Calendar sync via Microsoft 365 OAuth',                       type: 'outlook'  },
  { id: 'outlook-calendar', name: 'Outlook Calendar',   domain: 'microsoft.com', category: 'calendar', desc: 'Meeting intelligence, schedule prep briefs and availability insights',  type: 'outlook_cal' },
  { id: 'google-calendar',  name: 'Google Calendar',    domain: 'google.com',    category: 'calendar', desc: 'Meeting intelligence, schedule analysis and prep briefs',              type: 'gcal'     },
];

const MARKETING_PLATFORMS = [
  { id: 'google-ads', name: 'Google Ads',    domain: 'google.com',    category: 'marketing', desc: 'Search, Display, Shopping and YouTube campaign performance',  type: 'coming_soon' },
  { id: 'meta-ads',   name: 'Meta Ads',      domain: 'meta.com',      category: 'marketing', desc: 'Facebook and Instagram campaign ROAS, reach and engagement',  type: 'coming_soon' },
  { id: 'linkedin',   name: 'LinkedIn Ads',  domain: 'linkedin.com',  category: 'marketing', desc: 'B2B campaign intelligence, lead gen and pipeline attribution', type: 'coming_soon' },
];

const ALL_INTEGRATIONS = [
  // CRM
  { id:'hubspot',        name:'HubSpot',              domain:'hubspot.com',          category:'crm',       desc:'Deals, pipeline, contacts and revenue forecasting',      type:'merge' },
  { id:'salesforce',     name:'Salesforce',           domain:'salesforce.com',       category:'crm',       desc:'Enterprise CRM — contacts, opportunities, forecasts',    type:'merge' },
  { id:'pipedrive',      name:'Pipedrive',            domain:'pipedrive.com',        category:'crm',       desc:'Visual pipeline and deal velocity tracking',             type:'merge' },
  { id:'zoho-crm',       name:'Zoho CRM',             domain:'zoho.com',             category:'crm',       desc:'Multichannel CRM with AI sales assistant',               type:'merge' },
  { id:'ms-dynamics',    name:'Dynamics 365',         domain:'microsoft.com',        category:'crm',       desc:'Microsoft enterprise CRM and sales intelligence',        type:'merge' },
  { id:'activecampaign', name:'ActiveCampaign',       domain:'activecampaign.com',   category:'crm',       desc:'Marketing automation merged with CRM pipeline',          type:'merge' },
  { id:'copper',         name:'Copper',               domain:'copper.com',           category:'crm',       desc:'CRM native to Google Workspace',                         type:'merge' },
  { id:'close',          name:'Close',                domain:'close.com',            category:'crm',       desc:'Inside sales CRM with built-in calling',                 type:'merge' },
  { id:'freshsales',     name:'Freshsales',           domain:'freshworks.com',       category:'crm',       desc:'AI-powered sales CRM with Freddy AI',                    type:'merge' },
  { id:'zendesk-sell',   name:'Zendesk Sell',         domain:'zendesk.com',          category:'crm',       desc:'Sales CRM connected to support data',                    type:'merge' },
  { id:'keap',           name:'Keap',                 domain:'keap.com',             category:'crm',       desc:'CRM and automation for small businesses',                type:'merge' },
  { id:'insightly',      name:'Insightly',            domain:'insightly.com',        category:'crm',       desc:'CRM with project management built in',                   type:'merge' },
  { id:'nutshell',       name:'Nutshell',             domain:'nutshell.com',         category:'crm',       desc:'Sales automation and pipeline CRM',                      type:'merge' },
  { id:'capsule',        name:'Capsule',              domain:'capsulecrm.com',       category:'crm',       desc:'Simple CRM for relationship management',                 type:'merge' },
  { id:'sugar',          name:'SugarCRM',             domain:'sugarcrm.com',         category:'crm',       desc:'Open-source enterprise CRM platform',                    type:'merge' },
  // Financial
  { id:'xero',           name:'Xero',                 domain:'xero.com',             category:'financial', desc:'Cash flow, P&L and invoicing for Australian businesses', type:'merge' },
  { id:'quickbooks',     name:'QuickBooks Online',    domain:'quickbooks.intuit.com',category:'financial', desc:'Bookkeeping, invoicing and financial reporting',          type:'merge' },
  { id:'myob',           name:'MYOB',                 domain:'myob.com',             category:'financial', desc:'Accounting and payroll built for Australian SMBs',       type:'merge' },
  { id:'netsuite',       name:'NetSuite',             domain:'netsuite.com',         category:'financial', desc:'Cloud ERP — financials, inventory and commerce',         type:'merge' },
  { id:'sage',           name:'Sage Business Cloud',  domain:'sage.com',             category:'financial', desc:'Accounting, payroll and HR suite',                       type:'merge' },
  { id:'freshbooks',     name:'FreshBooks',           domain:'freshbooks.com',       category:'financial', desc:'Invoicing and expense tracking for SMBs',                type:'merge' },
  { id:'wave',           name:'Wave Financial',       domain:'waveapps.com',         category:'financial', desc:'Free accounting software for small businesses',          type:'merge' },
  { id:'zoho-books',     name:'Zoho Books',           domain:'zoho.com',             category:'financial', desc:'Online accounting with GST compliance',                  type:'merge' },
  { id:'freeagent',      name:'FreeAgent',            domain:'freeagent.com',        category:'financial', desc:'Accounting for freelancers and project-based businesses', type:'merge' },
  { id:'stripe',         name:'Stripe',               domain:'stripe.com',           category:'financial', desc:'Revenue, MRR, churn and payment analytics',              type:'merge' },
  { id:'reckon',         name:'Reckon',               domain:'reckon.com',           category:'financial', desc:'Australian accounting and payroll software',             type:'merge' },
  { id:'shopify',        name:'Shopify',              domain:'shopify.com',          category:'ecommerce', desc:'E-commerce revenue, orders and customer analytics',      type:'merge' },
  { id:'woocommerce',    name:'WooCommerce',          domain:'woocommerce.com',      category:'ecommerce', desc:'WordPress e-commerce orders and revenue data',           type:'merge' },
  { id:'bigcommerce',    name:'BigCommerce',          domain:'bigcommerce.com',      category:'ecommerce', desc:'Enterprise e-commerce platform analytics',               type:'merge' },
  // HRIS
  { id:'bamboohr',       name:'BambooHR',             domain:'bamboohr.com',         category:'hris',      desc:'People analytics — headcount, leave, capacity',          type:'merge' },
  { id:'employment-hero',name:'Employment Hero',      domain:'employmenthero.com',   category:'hris',      desc:'HR, payroll and benefits for Australian teams',           type:'merge' },
  { id:'workday',        name:'Workday',              domain:'workday.com',          category:'hris',      desc:'Enterprise HR, finance and workforce planning',          type:'merge' },
  { id:'gusto',          name:'Gusto',                domain:'gusto.com',            category:'hris',      desc:'Payroll, benefits and HR platform',                      type:'merge' },
  { id:'deel',           name:'Deel',                 domain:'deel.com',             category:'hris',      desc:'Global payroll and compliance management',               type:'merge' },
  { id:'rippling',       name:'Rippling',             domain:'rippling.com',         category:'hris',      desc:'Unified HR, IT and finance workforce platform',          type:'merge' },
  { id:'adp',            name:'ADP Workforce Now',    domain:'adp.com',              category:'hris',      desc:'Comprehensive payroll and HR solution',                  type:'merge' },
  { id:'dayforce',       name:'Dayforce',             domain:'ceridian.com',         category:'hris',      desc:'HCM platform by Ceridian',                               type:'merge' },
  { id:'factorial',      name:'Factorial',            domain:'factorialhr.com',      category:'hris',      desc:'HR software built for growing SMBs',                     type:'merge' },
  { id:'hibob',          name:'HiBob',                domain:'hibob.com',            category:'hris',      desc:'Modern HR platform for scaling companies',               type:'merge' },
  { id:'sage-hr',        name:'Sage HR',              domain:'sage.com',             category:'hris',      desc:'HR management connected to Sage payroll',                type:'merge' },
  // ATS
  { id:'greenhouse',     name:'Greenhouse',           domain:'greenhouse.io',        category:'ats',       desc:'Recruiting and onboarding — pipeline velocity',          type:'merge' },
  { id:'lever',          name:'Lever',                domain:'lever.co',             category:'ats',       desc:'Talent acquisition and candidate nurture',               type:'merge' },
  { id:'workable',       name:'Workable',             domain:'workable.com',         category:'ats',       desc:'AI-powered recruiting and job management',               type:'merge' },
  { id:'jobadder',       name:'JobAdder',             domain:'jobadder.com',         category:'ats',       desc:'Recruiting software for agencies and SMBs',              type:'merge' },
  { id:'icims',          name:'iCIMS',                domain:'icims.com',            category:'ats',       desc:'Enterprise talent acquisition suite',                    type:'merge' },
  { id:'breezy',         name:'Breezy HR',            domain:'breezy.hr',            category:'ats',       desc:'Visual recruiting pipeline and job boards',              type:'merge' },
  { id:'smartrecruiters',name:'SmartRecruiters',      domain:'smartrecruiters.com',  category:'ats',       desc:'Collaborative hiring platform for enterprise teams',     type:'merge' },
  { id:'teamtailor',     name:'Teamtailor',           domain:'teamtailor.com',       category:'ats',       desc:'Employer branding ATS with career pages',                type:'merge' },
  // Ticketing
  { id:'jira',           name:'Jira',                 domain:'atlassian.com',        category:'ticketing', desc:'Issue tracking, sprints and project management',         type:'merge' },
  { id:'asana',          name:'Asana',                domain:'asana.com',            category:'ticketing', desc:'Work management — tasks, projects, portfolios',          type:'merge' },
  { id:'clickup',        name:'ClickUp',              domain:'clickup.com',          category:'ticketing', desc:'All-in-one productivity and project management',         type:'merge' },
  { id:'linear',         name:'Linear',               domain:'linear.app',           category:'ticketing', desc:'Software project management for engineering teams',      type:'merge' },
  { id:'zendesk',        name:'Zendesk',              domain:'zendesk.com',          category:'ticketing', desc:'Customer service ticketing and support',                 type:'merge' },
  { id:'freshdesk',      name:'Freshdesk',            domain:'freshworks.com',       category:'ticketing', desc:'Helpdesk and customer support platform',                 type:'merge' },
  { id:'intercom',       name:'Intercom',             domain:'intercom.com',         category:'ticketing', desc:'Customer messaging, support and engagement',             type:'merge' },
  { id:'github',         name:'GitHub',               domain:'github.com',           category:'ticketing', desc:'Code repository, issues and pull requests',              type:'merge' },
  { id:'azure-devops',   name:'Azure DevOps',         domain:'microsoft.com',        category:'ticketing', desc:'Microsoft dev tools — boards, pipelines, repos',         type:'merge' },
  { id:'monday',         name:'Monday.com',           domain:'monday.com',           category:'ticketing', desc:'Work OS for cross-functional team management',           type:'merge' },
  { id:'basecamp',       name:'Basecamp',             domain:'basecamp.com',         category:'ticketing', desc:'Project management and team communication',              type:'merge' },
  { id:'trello',         name:'Trello',               domain:'trello.com',           category:'ticketing', desc:'Visual Kanban boards and project collaboration',         type:'merge' },
  // File Storage
  { id:'google-drive',   name:'Google Drive',         domain:'google.com',           category:'storage',   desc:'Document intelligence from your cloud file store',       type:'merge_storage' },
  { id:'onedrive',       name:'Microsoft OneDrive',   domain:'microsoft.com',        category:'storage',   desc:'Microsoft 365 file storage and document sync',           type:'merge_storage' },
  { id:'dropbox',        name:'Dropbox',              domain:'dropbox.com',          category:'storage',   desc:'Cloud file hosting and team collaboration',              type:'merge_storage' },
  { id:'box',            name:'Box',                  domain:'box.com',              category:'storage',   desc:'Secure enterprise cloud content management',             type:'merge_storage' },
  { id:'sharepoint',     name:'SharePoint',           domain:'microsoft.com',        category:'storage',   desc:'Microsoft intranet and document management',             type:'merge_storage' },
  // Knowledge Base
  { id:'confluence',     name:'Confluence',           domain:'atlassian.com',        category:'knowledge', desc:'Team wiki, SOPs and documentation hub',                  type:'merge_storage' },
  { id:'notion',         name:'Notion',               domain:'notion.so',            category:'knowledge', desc:'All-in-one workspace — notes, docs and databases',       type:'merge_storage' },
  { id:'guru',           name:'Guru',                 domain:'getguru.com',          category:'knowledge', desc:'Company knowledge base and internal wiki',               type:'merge_storage' },
];

const MERGE_CATEGORY_MAP = {
  crm: ['crm'],
  financial: ['accounting'],
  ecommerce: ['accounting'],
  hris: ['hris'],
  ats: ['ats'],
  ticketing: ['ticketing'],
  storage: ['file_storage'],
  knowledge: ['file_storage'],
};

const CATEGORY_ALIASES = {
  financial: ['financial', 'accounting'],
  ecommerce: ['ecommerce', 'accounting'],
  storage: ['storage', 'file_storage'],
  knowledge: ['knowledge', 'file_storage'],
};

const categoryMatches = (integrationCategory, rowCategory) => {
  const normalizedIntegration = String(integrationCategory || '').toLowerCase();
  const normalizedRow = String(rowCategory || '').toLowerCase();
  if (normalizedIntegration === normalizedRow) return true;
  return (CATEGORY_ALIASES[normalizedIntegration] || [normalizedIntegration]).includes(normalizedRow);
};

export default function Integrations() {
  const { user } = useSupabaseAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [mergeIntegrations, setMergeIntegrations] = useState({});
  const [integrationStatusRows, setIntegrationStatusRows] = useState([]);
  const [outlookStatus, setOutlookStatus] = useState({ connected: false, connected_email: null });
  const [gmailStatus, setGmailStatus] = useState({ connected: false, connected_email: null });
  const [disconnecting, setDisconnecting] = useState(null);
  const [openingMerge, setOpeningMerge] = useState(null);
  const [mergeLinkToken, setMergeLinkToken] = useState('');
  const [pendingOpen, setPendingOpen] = useState(false);

  // Merge Link hook — token starts as '' so SDK initialises cleanly
  const { open: openMergeLinkModal, isReady: mergeLinkReady } = useMergeLink({
    linkToken: mergeLinkToken,
    onSuccess: async (public_token, metadata) => {
      const category = metadata?.integration?.categories?.[0] || metadata?.category || 'crm';
      const provider = metadata?.integration?.name || 'Unknown';
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) { toast.error('Session expired. Please log in again.'); setMergeLinkToken(''); return; }
        const response = await fetch(`${getBackendUrl()}/api/integrations/merge/exchange-account-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': `Bearer ${session.access_token}` },
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
      setMergeLinkToken('');
      setOpeningMerge(null);
      setPendingOpen(false);
    },
    onExit: () => {
      setMergeLinkToken('');
      setOpeningMerge(null);
      setPendingOpen(false);
      setTimeout(() => loadMergeIntegrations(), 1500);
    },
  });

  // KEY FIX: use useEffect to open modal — avoids stale closure on mergeLinkReady/openMergeLinkModal
  // When both token is set AND SDK is ready, open the modal
  useEffect(() => {
    if (pendingOpen && mergeLinkToken && mergeLinkReady) {
      openMergeLinkModal();
      setPendingOpen(false);
    }
  }, [pendingOpen, mergeLinkToken, mergeLinkReady, openMergeLinkModal]);

  const loadMergeIntegrations = useCallback(async () => {
    try {
      const [res, fallbackRes] = await Promise.allSettled([
        apiClient.get('/integrations/merge/connected'),
        apiClient.get('/user/integration-status'),
      ]);
      const directMap = res.status === 'fulfilled' ? (res.value.data?.integrations || {}) : {};
      const rows = fallbackRes.status === 'fulfilled' ? (fallbackRes.value.data?.integrations || []) : [];
      setIntegrationStatusRows(rows);
      if (Object.keys(directMap).length > 0) {
        setMergeIntegrations(directMap);
        return;
      }
      const derivedMap = rows.reduce((acc, row) => {
        if (!row?.connected) return acc;
        const provider = String(row.integration_name || row.provider || '').trim().toLowerCase().replace(/\s+/g, '-');
        const category = String(row.category || 'general').trim().toLowerCase();
        acc[`${category}:${provider}`] = {
          provider: row.integration_name || row.provider,
          category,
          connected: true,
          connected_at: row.connected_at || row.last_sync_at || null,
        };
        return acc;
      }, {});
      setMergeIntegrations(derivedMap);
    } catch {
      try {
        const fallbackRes = await apiClient.get('/user/integration-status');
        const rows = fallbackRes.data?.integrations || [];
        setIntegrationStatusRows(rows);
        const derivedMap = rows.reduce((acc, row) => {
          if (!row?.connected) return acc;
          const provider = String(row.integration_name || row.provider || '').trim().toLowerCase().replace(/\s+/g, '-');
          const category = String(row.category || 'general').trim().toLowerCase();
          acc[`${category}:${provider}`] = {
            provider: row.integration_name || row.provider,
            category,
            connected: true,
            connected_at: row.connected_at || row.last_sync_at || null,
          };
          return acc;
        }, {});
        setMergeIntegrations(derivedMap);
      } catch {
        setMergeIntegrations({});
      }
    }
  }, []);

  const loadOutlookStatus = useCallback(async () => {
    try {
      const res = await apiClient.get('/outlook/status');
      if (!res.data?.degraded) setOutlookStatus(res.data);
    } catch {}
  }, []);

  const loadGmailStatus = useCallback(async () => {
    try {
      // Primary: use backend API — validates token expiry properly
      const res = await apiClient.get('/gmail/status');
      const data = res.data;
      if (data?.connected) {
        setGmailStatus({ connected: true, connected_email: data.connected_email || null });
        return;
      }
    } catch { /* fall through to Supabase direct */ }
    // Fallback: Supabase direct query
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: rows } = await supabase
        .from('email_connections')
        .select('provider, connected_email, connected')
        .eq('user_id', session.user.id)
        .eq('provider', 'gmail');
      const gmail = rows?.[0];
      if (gmail?.connected !== false) {
        setGmailStatus({ connected: !!gmail, connected_email: gmail?.connected_email || null });
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!user?.id) return undefined;
    loadMergeIntegrations();
    loadOutlookStatus();
    loadGmailStatus();
    const retryTimer = setTimeout(() => {
      loadMergeIntegrations();
      loadOutlookStatus();
      loadGmailStatus();
    }, 3000);
    // Handle deep-link from Revenue/Operations pages: ?category=crm
    const urlCategory = searchParams.get('category');
    if (urlCategory && CATEGORIES.some(c => c.id === urlCategory)) {
      setSelectedCategory(urlCategory);
      setSearchParams({});
    }
    return () => clearTimeout(retryTimer);
  }, [loadMergeIntegrations, loadOutlookStatus, loadGmailStatus, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const outlookConnected = searchParams.get('outlook_connected');
    const gmailConnected = searchParams.get('gmail_connected');
    const connectedEmail = searchParams.get('connected_email');
    const err = searchParams.get('outlook_error') || searchParams.get('gmail_error');
    if (outlookConnected === 'true') { toast.success(connectedEmail ? `Outlook (${decodeURIComponent(connectedEmail)}) connected!` : 'Outlook connected!'); setSearchParams({}); setTimeout(loadOutlookStatus, 2000); }
    if (gmailConnected === 'true') { toast.success(connectedEmail ? `Gmail (${decodeURIComponent(connectedEmail)}) connected!` : 'Gmail connected!'); setSearchParams({}); setTimeout(loadGmailStatus, 2000); }
    if (err) { toast.error(`Connection error: ${err}`); setSearchParams({}); }
  }, [searchParams, setSearchParams, loadOutlookStatus, loadGmailStatus]);

  const openMergeLink = useCallback(async (integrationId, categories, integrationName = null) => {
    setOpeningMerge(integrationId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error('Please log in to connect integrations');
        setOpeningMerge(null);
        return;
      }
      // Pass integration name to pre-select in Merge modal (bypasses category picker)
      const body = { categories };
      if (integrationName) body.integration = integrationName;

      const res = await fetch(`${getBackendUrl()}/api/integrations/merge/link-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = res.status === 503
          ? 'Integration service not configured. Please contact support.'
          : err.detail || 'Failed to connect — please try again';
        toast.error(msg);
        setOpeningMerge(null);
        return;
      }
      const resBody = await res.json();
      const link_token = resBody?.link_token;
      if (!link_token) {
        toast.error('No link token returned — please try again');
        setOpeningMerge(null);
        return;
      }
      setMergeLinkToken(link_token);
      setPendingOpen(true);
    } catch (e) {
      toast.error('Failed to open connection modal — please try again');
      setOpeningMerge(null);
    }
  }, []);

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
    if (integration.type === 'gcal') {
      toast.info('Google Calendar connects automatically when Gmail is connected.');
      return;
    }
    if (integration.type === 'coming_soon') {
      toast.info(`${integration.name} integration is coming soon. We'll notify you when it's ready.`);
      return;
    }
    if (integration.type === 'merge') {
      const cats = MERGE_CATEGORY_MAP[integration.category] || ['crm'];
      await openMergeLink(integration.id, cats, integration.name);
      return;
    }
    if (integration.type === 'merge_storage') {
      await openMergeLink(integration.id, ['file_storage'], integration.name);
      return;
    }
  }, [openMergeLink]);

  const handleDisconnect = useCallback(async (integration) => {
    if (!window.confirm(`Disconnect ${integration.name}? This will stop data collection.`)) return;
    setDisconnecting(integration.id);
    try {
      if (integration.type === 'outlook') {
        await apiClient.post('/outlook/disconnect');
        setOutlookStatus({ connected: false, connected_email: null });
        toast.success('Outlook disconnected');
      } else if (integration.type === 'gmail') {
        await apiClient.post('/gmail/disconnect');
        setGmailStatus({ connected: false, connected_email: null });
        toast.success('Gmail disconnected');
      } else {
        const match = Object.entries(mergeIntegrations).find(([key, meta]) => {
          const k = key.toLowerCase();
          const provider = String(meta?.provider || '').toLowerCase();
          const slug = String(meta?.integration_slug || '').toLowerCase();
          return k === integration.id
            || k === integration.name.toLowerCase()
            || k.includes(integration.id)
            || provider === integration.name.toLowerCase()
            || provider.includes(integration.id)
            || slug === integration.id;
        });

        if (match) {
          const [key, meta] = match;
          await apiClient.post('/merge/disconnect', {
            provider: meta?.provider || key,
            provider_hint: key,
            integration_slug: integration.id,
            category: integration.category,
          });
          setMergeIntegrations(prev => { const n = { ...prev }; delete n[key]; return n; });
          await loadMergeIntegrations();
          toast.success(`${integration.name} disconnected`);
        } else {
          toast.error('Could not find an active integration record to disconnect. Please refresh and try again.');
        }
      }
    } catch (e) {
      toast.error(`Failed to disconnect: ${e.response?.data?.detail || e.message}`);
    }
    setDisconnecting(null);
  }, [mergeIntegrations, loadMergeIntegrations]);

  const isConnected = useCallback((integration) => {
    if (integration.type === 'outlook' || integration.type === 'outlook_cal') return outlookStatus.connected;
    if (integration.type === 'gmail' || integration.type === 'gcal') return gmailStatus.connected;
    if (integration.type === 'coming_soon') return false;
    const directMatch = Object.keys(mergeIntegrations).some(k =>
      k.toLowerCase() === integration.id || k.toLowerCase() === integration.name.toLowerCase() || k.toLowerCase().includes(integration.id)
    );
    if (directMatch) return true;
    return integrationStatusRows.some((row) => {
      const provider = String(row.integration_name || row.provider || '').toLowerCase();
      return Boolean(row.connected) && categoryMatches(integration.category, row.category) && (provider === integration.name.toLowerCase() || provider.includes(integration.id));
    });
  }, [outlookStatus, gmailStatus, mergeIntegrations, integrationStatusRows]);

  const getConnectedLabel = (integration) => {
    if (integration.type === 'outlook') return outlookStatus.connected_email || 'Connected';
    if (integration.type === 'gmail') return gmailStatus.connected_email || 'Connected';
    const statusRow = integrationStatusRows.find((row) => {
      const provider = String(row.integration_name || row.provider || '').toLowerCase();
      return Boolean(row.connected) && categoryMatches(integration.category, row.category) && (provider === integration.name.toLowerCase() || provider.includes(integration.id));
    });
    if (statusRow) return 'Connected';
    return 'Connected';
  };

  // Detect stale Merge connections and prompt re-link
  const isMergeStale = useCallback((integration) => {
    if (!isConnected(integration)) return false;
    const key = Object.keys(mergeIntegrations).find(k =>
      k.toLowerCase().includes(integration.id) || k.toLowerCase().includes(integration.name.toLowerCase())
    );
    if (!key) return false;
    const meta = mergeIntegrations[key];
    // Flag as stale if last_sync is > 24 hours ago or sync_status indicates error
    if (meta?.sync_status === 'token_expired' || meta?.sync_status === 'error') return true;
    return false;
  }, [mergeIntegrations, isConnected]);

  const filtered = ALL_INTEGRATIONS.filter(i => {
    if (selectedCategory === 'connected') return isConnected(i);
    const matchCat = selectedCategory === 'all' || i.category === selectedCategory;
    const matchSearch = !searchTerm || i.name.toLowerCase().includes(searchTerm.toLowerCase()) || i.desc.toLowerCase().includes(searchTerm.toLowerCase());
    return matchCat && matchSearch;
  });

  const connectedCount = [
    Math.max(Object.keys(mergeIntegrations).length, integrationStatusRows.filter((row) => row.connected && row.category !== 'email').length),
    gmailStatus.connected ? 1 : 0,
    outlookStatus.connected ? 1 : 0,
  ].reduce((sum, value) => sum + value, 0);
  const isFreeTier = (user?.subscription_tier || 'free').toLowerCase() === 'free';
  const freeTierLimitReached = isFreeTier && connectedCount >= 1;

  return (
    <DashboardLayout>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        .int-card { animation: fadeUp 0.3s ease both; }
        .int-card:hover .connect-btn { opacity: 1 !important; }
      `}</style>

      <div style={{ background: 'var(--biqc-bg, #070E18)', minHeight: '100%', fontFamily: fontFamily.body }}>

        {/* ── HEADER ── */}
        <div className="px-6 pt-6 pb-4" style={{ borderBottom: '1px solid var(--biqc-border, #1E2D3D)' }}>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-semibold tracking-[0.15em] uppercase" style={{ color: '#FF6A00', fontFamily: fontFamily.mono }}>Data Sources</span>
                {connectedCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981', border: '1px solid rgba(16,185,129,0.2)', fontFamily: fontFamily.mono }}>
                    {connectedCount} live
                  </span>
                )}
              </div>
              <h1 className="text-2xl font-semibold" style={{ color: 'var(--biqc-text, #F4F7FA)', fontFamily: fontFamily.display }}>Connected Intelligence</h1>
              <p className="text-sm mt-0.5" style={{ color: '#64748B' }}>
                {connectedCount > 0 ? `${connectedCount} systems feeding your intelligence engine` : 'Connect your business stack to activate AI intelligence'}
              </p>
            </div>
            {/* Search */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: '#4A5568' }} />
              <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search platforms..."
                className="w-full pl-9 pr-8 py-2 rounded-lg text-sm outline-none"
                style={{ background: 'var(--biqc-bg-card, #141C26)', border: '1px solid var(--biqc-border, #243140)', color: 'var(--biqc-text, #F4F7FA)', fontFamily: fontFamily.body }}
                data-testid="integrations-search" />
              {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#4A5568' }}><X className="w-3.5 h-3.5" /></button>}
            </div>
          </div>

          {/* Category tabs */}
          {!searchTerm && (
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar" role="group" aria-label="Filter by category">
              {CATEGORIES.map(cat => {
                const active = selectedCategory === cat.id;
                const Icon = cat.icon;
                const count = cat.id === 'all' 
                  ? ALL_INTEGRATIONS.length 
                  : cat.id === 'connected' 
                  ? connectedCount
                  : ALL_INTEGRATIONS.filter(i => i.category === cat.id).length;
                return (
                  <button key={cat.id} onClick={() => setSelectedCategory(cat.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all"
                    style={{
                      background: active ? 'rgba(255,106,0,0.12)' : 'transparent',
                      color: active ? '#FF6A00' : '#64748B',
                      border: `1px solid ${active ? 'rgba(255,106,0,0.3)' : 'transparent'}`,
                      fontFamily: fontFamily.mono,
                    }}
                    data-testid={`cat-${cat.id}`}>
                    <Icon className="w-3 h-3" />
                    {cat.label}
                    <span style={{ color: active ? '#FF6A00' : '#2D3E50' }}>{count}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-6 py-5 space-y-7">

          {isFreeTier && (
            <div className="rounded-2xl border p-4" style={{ borderColor: freeTierLimitReached ? 'rgba(255,106,0,0.28)' : 'var(--biqc-border, #243140)', background: freeTierLimitReached ? 'rgba(255,106,0,0.08)' : 'var(--biqc-bg-card, #141C26)' }} data-testid="integrations-free-tier-banner">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold tracking-[0.14em] uppercase" style={{ color: '#FF6A00', fontFamily: fontFamily.mono }}>Free Tier Access</p>
                  <p className="mt-2 text-sm" style={{ color: 'var(--biqc-text, #F4F7FA)' }}>Free tier includes 1 connected integration.</p>
                  <p className="mt-1 text-xs" style={{ color: '#94A3B8' }}>{freeTierLimitReached ? 'You have reached the free-tier limit. Disconnect the current source or upgrade to connect more.' : 'Choose the one system that matters most to your operating rhythm right now.'}</p>
                </div>
                <span className="rounded-full px-3 py-1 text-[10px]" style={{ background: 'rgba(255,106,0,0.12)', color: '#FF6A00', fontFamily: fontFamily.mono }} data-testid="integrations-free-tier-counter">{connectedCount}/1 connected</span>
              </div>
            </div>
          )}

          {/* ── EMAIL & CALENDAR — visible on All and Connected tabs ── */}
          {!searchTerm && (selectedCategory === 'all' || selectedCategory === 'connected') && (
            <div>
              <SectionLabel icon={Mail} label="Email & Calendar" badge="Supabase OAuth" badgeColor="#3B82F6" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
                {EMAIL_CALENDAR
                  .filter(item => selectedCategory !== 'connected' || isConnected(item))
                  .map((item, i) => (
                  <IntCard key={item.id} integration={item} index={i}
                    connected={isConnected(item)} connectedLabel={getConnectedLabel(item)}
                    disconnecting={disconnecting === item.id} openingMerge={openingMerge === item.id}
                    onConnect={handleConnect} onDisconnect={handleDisconnect}
                    canConnectMore={!freeTierLimitReached || isConnected(item)}
                    isStale={false}
                    badge="Supabase" badgeColor="#3B82F6" />
                ))}
              </div>
            </div>
          )}

          {/* ── MAIN INTEGRATIONS GRID ── */}
          {filtered.length > 0 ? (
            <div>
              {!searchTerm && (
                <SectionLabel
                  icon={Plug}
                  label={selectedCategory === 'all' ? 'All Platforms' : CATEGORIES.find(c => c.id === selectedCategory)?.label}
                  badge={`${filtered.length} available · 220+ via Merge`}
                  badgeColor="#FF6A00"
                />
              )}
              {searchTerm && (
                <p className="text-xs mb-3" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>{filtered.length} result{filtered.length !== 1 ? 's' : ''} for "{searchTerm}"</p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mt-3">
                {filtered.map((integration, i) => (
                  <IntCard key={integration.id} integration={integration} index={i}
                    connected={isConnected(integration)} connectedLabel={getConnectedLabel(integration)}
                    disconnecting={disconnecting === integration.id} openingMerge={openingMerge === integration.id}
                    onConnect={handleConnect} onDisconnect={handleDisconnect}
                    canConnectMore={!freeTierLimitReached || isConnected(integration)}
                    isStale={isMergeStale(integration)}
                    badge="Merge API" badgeColor="#FF6A00" />
                ))}
              </div>

              {/* Browse all CTA */}
              {!searchTerm && (
                <button
                  onClick={() => openMergeLink('browse-all', ['accounting', 'crm', 'hris', 'ats', 'ticketing', 'file_storage'])}
                  disabled={!!openingMerge}
                  className="mt-5 w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all"
                  style={{ border: '1px dashed rgba(255,106,0,0.25)', color: '#FF6A00', background: 'rgba(255,106,0,0.04)', fontFamily: fontFamily.body }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,106,0,0.5)'; e.currentTarget.style.background = 'rgba(255,106,0,0.08)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,106,0,0.25)'; e.currentTarget.style.background = 'rgba(255,106,0,0.04)'; }}
                  data-testid="browse-all-platforms">
                  {openingMerge === 'browse-all' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  {openingMerge === 'browse-all' ? 'Opening...' : "Can't find yours? Browse all 220+ platforms"}
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ) : searchTerm ? (
            <div className="py-16 text-center">
              <Search className="w-8 h-8 mx-auto mb-3" style={{ color: '#243140' }} />
              <p className="text-sm mb-1" style={{ color: '#64748B' }}>No platforms found for "{searchTerm}"</p>
              <button onClick={() => openMergeLink('browse-all', ['accounting', 'crm', 'hris', 'ats', 'ticketing', 'file_storage'])}
                className="text-xs mt-3 underline" style={{ color: '#FF6A00' }}>
                Browse all 220+ platforms
              </button>
            </div>
          ) : null}

          {/* ── MARKETING PLATFORMS — Coming Soon ── */}
          {!searchTerm && selectedCategory === 'all' && (
            <div>
              <SectionLabel icon={Megaphone} label="Marketing & Advertising" badge="Coming Soon" badgeColor="#F59E0B" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
                {MARKETING_PLATFORMS.map((item, i) => (
                  <IntCard key={item.id} integration={item} index={i}
                    connected={false} connectedLabel={null}
                    disconnecting={false} openingMerge={false}
                    onConnect={handleConnect} onDisconnect={handleDisconnect}
                    canConnectMore={!freeTierLimitReached}
                    badge="Coming Soon" badgeColor="#F59E0B" comingSoon />
                ))}
              </div>
            </div>
          )}

          {/* ── FOOTER NOTE ── */}
          <div className="flex items-center justify-center gap-3 py-3" style={{ borderTop: '1px solid var(--biqc-border, #1E2D3D)' }}>
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#10B981' }} />
            <p className="text-[11px]" style={{ color: '#2D3E50', fontFamily: fontFamily.mono }}>
              All connections encrypted · Australian hosted · Revoke anytime
            </p>
          </div>

        </div>
      </div>
    </DashboardLayout>
  );
}

// ── Section label component ───────────────────────────────────────────────────
function SectionLabel({ icon: Icon, label, badge, badgeColor }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <Icon className="w-3.5 h-3.5" style={{ color: badgeColor || '#FF6A00' }} />
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--biqc-text-muted, #8B9DB5)', fontFamily: fontFamily.mono }}>{label}</span>
      </div>
      {badge && (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: `${badgeColor}15`, color: badgeColor, border: `1px solid ${badgeColor}30`, fontFamily: fontFamily.mono }}>
          {badge}
        </span>
      )}
    </div>
  );
}

// ── Integration card ──────────────────────────────────────────────────────────
function IntCard({ integration, index, connected, connectedLabel, disconnecting, openingMerge, onConnect, onDisconnect, badge, badgeColor, comingSoon, isStale = false, canConnectMore = true }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="int-card relative flex flex-col rounded-xl overflow-hidden transition-all duration-200"
      style={{
        background: connected ? 'rgba(16,185,129,0.04)' : 'var(--biqc-bg-card, #141C26)',
        border: `1px solid ${connected ? 'rgba(16,185,129,0.2)' : hovered && !comingSoon ? 'rgba(255,106,0,0.3)' : 'var(--biqc-border, #1E2D3D)'}`,
        boxShadow: connected ? '0 0 20px rgba(16,185,129,0.06)' : 'none',
        animationDelay: `${index * 30}ms`,
        opacity: comingSoon ? 0.7 : 1,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      data-testid={`integration-card-${integration.id}`}
    >
      {/* Connected indicator */}
      {connected && (
        <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: 'linear-gradient(90deg, #10B981, transparent)' }} />
      )}

      <div className="p-4 flex flex-col gap-3 flex-1">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <Logo domain={integration.domain} name={integration.name} size={34} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate leading-tight" style={{ color: 'var(--biqc-text, #F4F7FA)', fontFamily: fontFamily.display }}>{integration.name}</p>
              {connected ? (
                <div className="flex items-center gap-1 mt-0.5">
                  <CheckCircle2 className="w-2.5 h-2.5 flex-shrink-0" style={{ color: '#10B981' }} />
                  <span className="text-[10px] truncate" style={{ color: '#10B981', fontFamily: fontFamily.mono }}>{connectedLabel}</span>
                </div>
              ) : (
                <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium"
                  style={{ color: badgeColor, background: `${badgeColor}12`, fontFamily: fontFamily.mono }}>
                  {comingSoon ? 'Soon' : badge}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Description */}
        <p className="text-xs leading-relaxed flex-1" style={{ color: '#64748B', fontFamily: fontFamily.body }}>{integration.desc}</p>

        {/* Action button */}
        {comingSoon ? (
          <button
            onClick={() => onConnect(integration)}
            className="w-full py-2 rounded-lg text-xs font-medium transition-all"
            style={{ background: 'transparent', border: '1px solid rgba(245,158,11,0.2)', color: '#F59E0B', fontFamily: fontFamily.body }}
            data-testid={`notify-${integration.id}`}>
            <Clock className="w-3 h-3 inline mr-1.5" />
            Notify Me
          </button>
        ) : connected ? (
          <button
            onClick={() => isStale ? onConnect(integration) : onDisconnect(integration)}
            disabled={disconnecting}
            className="w-full py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5"
            style={{
              background: 'transparent',
              border: `1px solid ${isStale ? 'rgba(245,158,11,0.35)' : 'rgba(239,68,68,0.25)'}`,
              color: isStale ? '#F59E0B' : '#EF4444',
              fontFamily: fontFamily.body,
            }}
            onMouseEnter={e => e.currentTarget.style.background = isStale ? 'rgba(245,158,11,0.08)' : 'rgba(239,68,68,0.08)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            data-testid={`disconnect-${integration.id}`}>
            {disconnecting ? <Loader2 className="w-3 h-3 animate-spin" /> : isStale ? <RefreshCw className="w-3 h-3" /> : <LogOut className="w-3 h-3" />}
            {disconnecting ? 'Working...' : isStale ? 'Re-link Required' : 'Disconnect'}
          </button>
        ) : (
          <button
            onClick={() => onConnect(integration)}
            disabled={openingMerge || !canConnectMore}
            className="w-full py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
            style={{
              background: !canConnectMore
                ? 'rgba(71,85,105,0.22)'
                : openingMerge
                ? 'rgba(255,106,0,0.15)'
                : 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(200,210,220,0.04) 100%)',
              border: !canConnectMore ? '1px solid #334155' : '1px solid #FF6A00',
              color: !canConnectMore ? '#94A3B8' : (openingMerge ? '#FF6A00' : '#E8F0F8'),
              fontFamily: fontFamily.body,
              boxShadow: hovered && !openingMerge
                ? '0 0 12px rgba(255,106,0,0.35), inset 0 1px 0 rgba(255,255,255,0.12)'
                : 'inset 0 1px 0 rgba(255,255,255,0.08)',
              textShadow: '0 1px 2px rgba(0,0,0,0.4)',
              backdropFilter: 'blur(4px)',
            }}
            onMouseEnter={e => {
              if (!openingMerge) {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255,106,0,0.18) 0%, rgba(200,160,100,0.12) 100%)';
                e.currentTarget.style.color = '#FFFFFF';
                e.currentTarget.style.boxShadow = '0 0 16px rgba(255,106,0,0.4), inset 0 1px 0 rgba(255,255,255,0.15)';
              }
            }}
            onMouseLeave={e => {
              if (!openingMerge) {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(200,210,220,0.04) 100%)';
                e.currentTarget.style.color = '#E8F0F8';
                e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.08)';
              }
            }}
            data-testid={`connect-${integration.id}`}>
            {openingMerge ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plug className="w-3 h-3" />}
            {openingMerge ? 'Opening...' : (!canConnectMore ? 'Free limit reached' : 'Connect')}
          </button>
        )}
      </div>
    </div>
  );
}
