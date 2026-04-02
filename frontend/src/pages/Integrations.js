import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search, CheckCircle2, LogOut, RefreshCw, Loader2, Zap,
  Users, DollarSign, Briefcase, UserPlus, Ticket, HardDrive,
  BookOpen, Mail, LayoutGrid, X, Plug, Plus,
  TrendingUp, Megaphone, ChevronRight, Clock
} from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { PageLoadingState, PageErrorState } from '../components/PageStateComponents';
import { apiClient } from '../lib/api';
import { supabase, useSupabaseAuth } from '../context/SupabaseAuthContext';
import { getBackendUrl } from '../config/urls';
import { toast } from 'sonner';
import { useMergeLink } from '@mergeapi/react-merge-link';
import { fontFamily } from '../design-system/tokens';
import { resolveTier } from '../lib/tierResolver';
import { isPrivilegedUser } from '../lib/privilegedUser';

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

const CONNECTOR_TABS = [
  { id: 'all', label: 'All' },
  { id: 'connected', label: 'Connected' },
  { id: 'available', label: 'Available' },
];

const CONNECTOR_CATEGORY_FILTERS = [
  { id: 'all', label: 'All categories' },
  { id: 'email', label: 'Email' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'crm', label: 'CRM' },
  { id: 'financial', label: 'Financial' },
  { id: 'ecommerce', label: 'E-Commerce' },
  { id: 'hris', label: 'HR & Payroll' },
  { id: 'ats', label: 'ATS' },
  { id: 'ticketing', label: 'Ticketing' },
  { id: 'storage', label: 'File Storage' },
  { id: 'knowledge', label: 'Knowledge' },
  { id: 'marketing', label: 'Marketing' },
];

const mapMergeCategoryToUiCategory = (mergeCategory) => {
  const normalized = String(mergeCategory || '').toLowerCase().trim();
  if (normalized === 'accounting') return 'financial';
  if (normalized === 'file_storage') return 'storage';
  if (normalized === 'knowledge_base') return 'knowledge';
  if (normalized === 'marketing_automation') return 'marketing';
  return normalized || 'crm';
};

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

const normalizeIntegrationKey = (value) => String(value || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '');
const INTEGRATION_PROVIDER_ALIASES = {
  quickbooks: ['quickbooks', 'quickbooksonline'],
  'ms-dynamics': ['dynamics365', 'microsoftdynamics365', 'msdynamics'],
  'zoho-crm': ['zohocrm', 'zoho'],
  'zoho-books': ['zohobooks', 'zoho'],
  'zendesk-sell': ['zendesksell'],
  'sage-hr': ['sagehr'],
  'azure-devops': ['azuredevops'],
};

const getVerifiedConnectedCount = (rows = []) => {
  const unique = new Set();
  rows.forEach((row) => {
    if (!row?.connected) return;
    const category = String(row.category || '').toLowerCase();
    if (category === 'email') return;
    const providerKey = normalizeIntegrationKey(
      row.integration_slug || row.provider_key || row.integration_name || row.provider
    );
    if (!providerKey) return;
    unique.add(`${category}:${providerKey}`);
  });
  return unique.size;
};

const rowMatchesIntegration = (row, integration) => {
  if (!row?.connected) return false;
  if (!categoryMatches(integration.category, row.category)) return false;

  const integrationKeys = new Set([
    normalizeIntegrationKey(integration.id),
    normalizeIntegrationKey(integration.name),
    ...(INTEGRATION_PROVIDER_ALIASES[integration.id] || []).map(normalizeIntegrationKey),
  ]);

  const rowKeys = [
    row.integration_slug,
    row.provider_key,
    row.integration_name,
    row.provider,
  ]
    .map(normalizeIntegrationKey)
    .filter(Boolean);

  return rowKeys.some((key) => integrationKeys.has(key));
};

export default function Integrations() {
  const { user, session, authState } = useSupabaseAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedTab, setSelectedTab] = useState('all');
  const [mergeIntegrations, setMergeIntegrations] = useState({});
  const [integrationStatusRows, setIntegrationStatusRows] = useState([]);
  const [canonicalTruth, setCanonicalTruth] = useState({});
  const [integrationTruthReady, setIntegrationTruthReady] = useState(false);
  const [outlookStatus, setOutlookStatus] = useState({ connected: false, connected_email: null });
  const [gmailStatus, setGmailStatus] = useState({ connected: false, connected_email: null });
  const [disconnecting, setDisconnecting] = useState(null);
  const [openingMerge, setOpeningMerge] = useState(null);
  const [mergeLinkToken, setMergeLinkToken] = useState('');
  const [pendingOpen, setPendingOpen] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState(null);
  const [mergeCatalog, setMergeCatalog] = useState([]);

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

  const authedJsonGet = useCallback(async (path) => {
    const activeToken = session?.access_token || (await supabase.auth.getSession()).data.session?.access_token;
    if (!activeToken) throw new Error('AUTH_NOT_READY');
    const res = await fetch(`${getBackendUrl()}/api${path}${path.includes('?') ? '&' : '?'}_t=${Date.now()}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${activeToken}`,
        'Accept': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
      },
    });
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error(`NON_JSON_${res.status}`);
    }
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.detail || data?.message || `HTTP_${res.status}`);
    }
    return data;
  }, [session?.access_token]);

  const loadMergeIntegrations = useCallback(async () => {
    setPageError(null);
    try {
      const statusPayload = await authedJsonGet('/user/integration-status');
      const rows = statusPayload?.integrations || [];
      const statusTruth = statusPayload?.canonical_truth || {};
      setIntegrationStatusRows(rows);
      setCanonicalTruth(statusTruth);
      setIntegrationTruthReady(Boolean(rows.length));
      const derivedMap = rows.reduce((acc, row) => {
        if (!row?.connected) return acc;
        const provider = String(row.integration_name || row.provider || '').trim().toLowerCase().replace(/\s+/g, '-');
        const category = String(row.category || 'general').trim().toLowerCase();
        acc[`${category}:${provider}`] = {
          provider: row.integration_name || row.provider,
          category,
          connected: true,
          connected_at: row.connected_at || row.last_sync_at || null,
          truth_state: row.truth_state,
          truth_reason: row.truth_reason,
          last_verified_at: row.last_verified_at,
        };
        return acc;
      }, {});
      setMergeIntegrations(derivedMap);
    } catch (e) {
      try {
        const directPayload = await authedJsonGet('/integrations/merge/connected');
        const directMap = directPayload?.integrations || {};
        const directTruth = directPayload?.canonical_truth || {};
        const rows = Object.values(directMap).map((item) => ({
          integration_name: item?.provider || item?.integration_name || 'Unknown',
          category: item?.category || 'general',
          connected: Boolean(item?.connected),
          provider: item?.provider || item?.integration_name || 'Unknown',
          provider_key: item?.provider_key || null,
          integration_slug: item?.integration_slug || item?.provider_key || null,
          connected_at: item?.connected_at || null,
          last_sync_at: item?.last_sync_at || item?.connected_at || null,
          truth_state: item?.truth_state,
          truth_reason: item?.truth_reason,
          last_verified_at: item?.last_verified_at || item?.connected_at || null,
        }));
        setIntegrationStatusRows(rows);
        setCanonicalTruth(directTruth);
        setIntegrationTruthReady(Boolean(rows.length));
        setMergeIntegrations(directMap);
      } catch {
        setMergeIntegrations({});
        setIntegrationStatusRows([]);
        setIntegrationTruthReady(false);
        setPageError(e?.message || 'Failed to load integration status');
      }
    }
    setPageLoading(false);
  }, [authedJsonGet]);

  const loadOutlookStatus = useCallback(async () => {
    try {
      const res = await apiClient.get('/outlook/status');
      if (!res.data?.degraded) setOutlookStatus(res.data);
    } catch {}
  }, []);

  const loadMergeCatalog = useCallback(async () => {
    try {
      const data = await authedJsonGet('/integrations/merge/catalog');
      const rows = Array.isArray(data?.integrations) ? data.integrations : [];
      setMergeCatalog(rows);
    } catch {
      setMergeCatalog([]);
    }
  }, [authedJsonGet]);
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
    if (authState === 'LOADING' || (!user && !session)) return undefined;
    setPageLoading(true);
    loadMergeIntegrations();
    loadOutlookStatus();
    loadGmailStatus();
    loadMergeCatalog();
    const retryTimer = setTimeout(() => {
      loadMergeIntegrations();
      loadOutlookStatus();
      loadGmailStatus();
      loadMergeCatalog();
    }, 3000);
    const resilienceTimer = setTimeout(() => {
      loadMergeIntegrations();
    }, 9000);
    // Handle deep-link from Revenue/Operations pages: ?category=crm
    const urlCategory = searchParams.get('category');
    if (urlCategory && CATEGORIES.some(c => c.id === urlCategory)) {
      if (urlCategory === 'connected') {
        setSelectedTab('connected');
        setSelectedCategory('all');
      } else {
        setSelectedCategory(urlCategory);
      }
      setSearchParams({});
    }
    return () => {
      clearTimeout(retryTimer);
      clearTimeout(resilienceTimer);
    };
  }, [loadMergeIntegrations, loadOutlookStatus, loadGmailStatus, loadMergeCatalog, user?.id, session?.access_token, authState]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (integration.type === 'merge_catalog') {
      const cats = Array.isArray(integration.mergeCategories) && integration.mergeCategories.length
        ? integration.mergeCategories
        : (MERGE_CATEGORY_MAP[integration.category] || ['crm']);
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
    return integrationStatusRows.some((row) => rowMatchesIntegration(row, integration));
  }, [outlookStatus, gmailStatus, integrationStatusRows]);

  const getConnectedLabel = (integration) => {
    if (integration.type === 'outlook') return outlookStatus.connected_email || 'Connected';
    if (integration.type === 'gmail') return gmailStatus.connected_email || 'Connected';
    const statusRow = integrationStatusRows.find((row) => rowMatchesIntegration(row, integration));
    if (statusRow) return 'Connected';
    return 'Connected';
  };

  const truthStateForIntegration = useCallback((integration) => {
    if (!isConnected(integration)) return 'unverified';
    const category = String(integration.category || '').toLowerCase();
    if (category === 'crm') return canonicalTruth.crm_state || 'live';
    if (category === 'financial' || category === 'ecommerce') return canonicalTruth.accounting_state || 'live';
    if (category === 'email' || category === 'calendar') return canonicalTruth.email_state || 'live';
    return 'live';
  }, [canonicalTruth, isConnected]);

  const truthReasonForIntegration = useCallback((integration) => {
    const row = integrationStatusRows.find((item) => rowMatchesIntegration(item, integration));
    return row?.truth_reason || '';
  }, [integrationStatusRows]);

  // Detect stale Merge connections and prompt re-link
  const isMergeStale = useCallback((integration) => {
    if (!isConnected(integration)) return false;
    const key = Object.keys(mergeIntegrations).find(k =>
      k.toLowerCase().includes(integration.id) || k.toLowerCase().includes(integration.name.toLowerCase())
    );
    const meta = key ? mergeIntegrations[key] : null;
    // Flag as stale if last_sync is > 24 hours ago or sync_status indicates error
    if (meta?.sync_status === 'token_expired' || meta?.sync_status === 'error') return true;
    const statusRow = integrationStatusRows.find((row) => rowMatchesIntegration(row, integration));
    if (statusRow?.truth_state === 'stale' || statusRow?.truth_state === 'error') return true;
    return false;
  }, [mergeIntegrations, integrationStatusRows, isConnected]);

  const curatedIds = new Set([...EMAIL_CALENDAR, ...ALL_INTEGRATIONS, ...MARKETING_PLATFORMS].map((i) => i.id));
  const mergeSearchCatalog = (searchTerm ? mergeCatalog : [])
    .map((row) => {
      const mergeCategories = Array.isArray(row?.categories) ? row.categories : [];
      const primaryCategory = mapMergeCategoryToUiCategory(mergeCategories[0] || 'crm');
      return {
        id: String(row?.id || '').trim().toLowerCase(),
        name: row?.name || 'Unknown provider',
        domain: 'integration-network',
        category: primaryCategory,
        desc: row?.description || `Connect ${row?.name || 'provider'} through BIQc Connector Hub`,
        type: 'merge_catalog',
        mergeCategories,
      };
    })
    .filter((item) => item.id && !curatedIds.has(item.id));
  const connectorPool = [...EMAIL_CALENDAR, ...ALL_INTEGRATIONS, ...MARKETING_PLATFORMS, ...mergeSearchCatalog];
  const filtered = connectorPool.filter((integration) => {
    const connected = isConnected(integration);
    if (selectedTab === 'connected' && !connected) return false;
    if (selectedTab === 'available' && connected) return false;
    if (selectedCategory !== 'all' && integration.category !== selectedCategory) return false;
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return integration.name.toLowerCase().includes(q) || integration.desc.toLowerCase().includes(q);
  });
  const connectedCount = [
    getVerifiedConnectedCount(integrationStatusRows),
    gmailStatus.connected ? 1 : 0,
    outlookStatus.connected ? 1 : 0,
  ].reduce((sum, value) => sum + value, 0);
  const isMasterAccount = user?.is_master_account === true || ['superadmin', 'super_admin', 'admin'].includes((user?.role || '').toLowerCase()) || isPrivilegedUser(user);
  const effectiveTier = resolveTier(user);
  const hasPaidLaunchAccess = isMasterAccount || effectiveTier !== 'free';
  const launchIntegrationLimit = hasPaidLaunchAccess ? 5 : 1;
  const freeTierLimitReached = connectedCount >= launchIntegrationLimit;
  if (pageLoading && !integrationTruthReady && !pageError) {
    return (
      <DashboardLayout>
        <div className="p-6" style={{ minHeight: '40vh' }}>
          <PageLoadingState message="Loading integrations…" />
        </div>
      </DashboardLayout>
    );
  }
  if (pageError) {
    return (
      <DashboardLayout>
        <div className="p-6" style={{ minHeight: '40vh' }}>
          <PageErrorState error={pageError} onRetry={() => { setPageLoading(true); loadMergeIntegrations(); }} moduleName="Integrations" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        .int-card { animation: fadeUp 0.3s ease both; }
        .int-card:hover .connect-btn { opacity: 1 !important; }
      `}</style>

      <div style={{ background: '#050A14', minHeight: '100%', fontFamily: fontFamily.body }}>
        <div className="max-w-[1140px] mx-auto px-4 sm:px-6 py-8">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h1 className="text-[36px] leading-[1.05] font-semibold tracking-[-0.01em]" style={{ color: '#F8FAFC', fontFamily: fontFamily.display }}>Connectors</h1>
                <p className="mt-2 text-[14px]" style={{ color: '#94A3B8' }}>
                  Connect your tools to BIQc to search across them and take action. Your permissions are always respected.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/contact?source=custom_connector&label=Custom%20Connector')}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3.5 text-[13px] font-semibold"
                style={{ border: '1px solid #2B3545', color: '#E5E7EB', background: '#0B1220' }}
                data-testid="custom-connector-button"
              >
                <Plus className="w-4 h-4" />
                Add custom connector
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-[1fr_210px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: '#64748B' }} />
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search all connectors"
                  className="w-full rounded-lg py-2.5 pl-9 pr-9 text-[13px] outline-none"
                  style={{ background: '#0B1220', border: '1px solid #1E293B', color: '#F4F7FA' }}
                  data-testid="integrations-search"
                />
                {searchTerm && (
                  <button type="button" onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#64748B' }}>
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full rounded-lg px-3 py-2.5 text-[13px] outline-none"
                style={{ background: '#0B1220', border: '1px solid #1E293B', color: '#E2E8F0' }}
                data-testid="integrations-category-filter"
              >
                {CONNECTOR_CATEGORY_FILTERS.map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {CONNECTOR_TABS.map((tab) => {
                const active = selectedTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSelectedTab(tab.id)}
                    className="rounded-full px-3 py-1.5 text-[11px] font-semibold"
                    style={{
                      border: active ? '1px solid #334155' : '1px solid #1E293B',
                      background: active ? '#111827' : '#0B1220',
                      color: active ? '#F8FAFC' : '#94A3B8',
                    }}
                    data-testid={`cat-${tab.id}`}
                  >
                    {tab.label}
                  </button>
                );
              })}
              <span className="ml-auto text-[11px]" style={{ color: '#64748B' }}>
                {connectedCount} connected
              </span>
            </div>
            {searchTerm && (
              <p className="text-[11px]" style={{ color: '#64748B' }}>
                Search includes BIQc connectors plus the live unified integration catalog.
              </p>
            )}
          </div>

          {filtered.length > 0 ? (
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 mt-4">
              {filtered.map((integration, i) => (
                // Free tier can connect one email provider only; paid tiers can connect all supported providers.
                <IntCard
                  key={integration.id}
                  integration={integration}
                  index={i}
                  connected={isConnected(integration)}
                  connectedLabel={getConnectedLabel(integration)}
                  disconnecting={disconnecting === integration.id}
                  openingMerge={openingMerge === integration.id}
                  onConnect={handleConnect}
                  onDisconnect={handleDisconnect}
                  canConnectMore={
                    (
                      hasPaidLaunchAccess
                      || ['gmail', 'outlook', 'gcal', 'outlook_cal'].includes(integration.type)
                    ) && (!freeTierLimitReached || isConnected(integration))
                  }
                  isStale={isMergeStale(integration)}
                  truthState={truthStateForIntegration(integration)}
                  truthReason={truthReasonForIntegration(integration)}
                  badge={integration.type === 'coming_soon' ? 'Coming soon' : integration.type === 'gmail' || integration.type === 'outlook' || integration.type === 'gcal' || integration.type === 'outlook_cal' ? 'OAuth' : 'Connector'}
                  comingSoon={integration.type === 'coming_soon'}
                />
              ))}
            </div>
          ) : (
            <div className="py-20 text-center">
              <Search className="w-8 h-8 mx-auto mb-3" style={{ color: '#243140' }} />
              <p className="text-sm mb-1" style={{ color: '#64748B' }}>No connectors found for this filter.</p>
            </div>
          )}

          <button
            onClick={() => openMergeLink('browse-all', ['accounting', 'crm', 'hris', 'ats', 'ticketing', 'file_storage'])}
            disabled={!!openingMerge}
            className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-[13px] font-medium transition-all"
            style={{ border: '1px dashed #334155', color: '#CBD5E1', background: '#0B1220', fontFamily: fontFamily.body }}
            data-testid="browse-all-platforms"
          >
            {openingMerge === 'browse-all' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {openingMerge === 'browse-all' ? 'Opening...' : "Can't find yours? Browse all 220+ platforms"}
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

    </DashboardLayout>
  );
}

// ── Integration card ──────────────────────────────────────────────────────────
function IntCard({ integration, index, connected, connectedLabel, disconnecting, openingMerge, onConnect, onDisconnect, badge, comingSoon, isStale = false, canConnectMore = true, truthState = 'unverified', truthReason = '' }) {
  const statusTone = connected
    ? { text: '#34D399', bg: 'rgba(16,185,129,0.14)' }
    : comingSoon
      ? { text: '#F59E0B', bg: 'rgba(245,158,11,0.14)' }
      : { text: '#94A3B8', bg: 'rgba(148,163,184,0.14)' };

  const actionLabel = comingSoon
    ? 'Notify me'
    : connected
      ? (isStale ? 'Re-link' : 'Disconnect')
      : (!canConnectMore ? 'Free limit reached' : 'Connect');

  return (
    <div
      className="int-card rounded-xl border px-3.5 py-3 transition-colors"
      style={{
        background: '#0B1220',
        borderColor: connected ? 'rgba(52,211,153,0.35)' : '#1E293B',
        animationDelay: `${index * 30}ms`,
        opacity: comingSoon ? 0.7 : 1,
      }}
      data-testid={`integration-card-${integration.id}`}
    >
      <div className="flex items-start gap-2.5">
        <Logo domain={integration.domain} name={integration.name} size={36} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[14px] font-semibold truncate leading-tight" style={{ color: '#F8FAFC', fontFamily: fontFamily.display }}>{integration.name}</p>
              <p
                className="text-[12px] mt-1 leading-[1.35]"
                style={{
                  color: '#94A3B8',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {integration.desc}
              </p>
            </div>
            <span
              className="inline-flex items-center rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wide shrink-0"
              style={{ color: statusTone.text, background: statusTone.bg }}
            >
              {connected ? 'Connected' : (comingSoon ? 'Soon' : badge)}
            </span>
          </div>

          <div className="mt-2.5 flex items-center justify-between gap-2">
            <span className="text-[10.5px]" style={{ color: connected ? '#34D399' : '#64748B' }}>
              {connected ? connectedLabel : (truthReason || '')}
            </span>
            <button
              onClick={() => {
                if (comingSoon) onConnect(integration);
                else if (connected) {
                  if (isStale) onConnect(integration);
                  else onDisconnect(integration);
                } else {
                  onConnect(integration);
                }
              }}
              disabled={disconnecting || openingMerge || (!connected && !comingSoon && !canConnectMore)}
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-2.5 text-[11px] font-semibold"
              style={{
                background: '#111827',
                border: '1px solid #334155',
                color: (!connected && !comingSoon && !canConnectMore) ? '#64748B' : '#E2E8F0',
              }}
              data-testid={
                connected
                  ? `disconnect-${integration.id}`
                  : comingSoon
                    ? `notify-${integration.id}`
                    : `connect-${integration.id}`
              }
            >
              {(disconnecting || openingMerge) ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : connected ? (
                isStale ? <RefreshCw className="w-3 h-3" /> : <LogOut className="w-3 h-3" />
              ) : comingSoon ? (
                <Clock className="w-3 h-3" />
              ) : (
                <Plug className="w-3 h-3" />
              )}
              {disconnecting || openingMerge ? 'Working...' : actionLabel}
            </button>
          </div>
          {connected && (
            <span className="inline-block mt-1.5 text-[10px] uppercase tracking-wide" style={{ color: truthState === 'live' ? '#34D399' : '#F59E0B' }} data-testid={`integration-truth-state-${integration.id}`}>
              Source {truthState}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
