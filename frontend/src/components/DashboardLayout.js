import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSupabaseAuth, AUTH_STATE, supabase } from '../context/SupabaseAuthContext';
import { useMobileDrawer } from '../context/MobileDrawerContext';
import { apiClient } from '../lib/api';
import { useTutorial, HelpButton, PageTutorial } from './TutorialOverlay';
import FirstLoginNotification from './FirstLoginNotification';
import MobileNav from './MobileNav';
import TrialCountdownCard from './TrialCountdownCard';
import AlertStack from './AlertStack';
import { DailyBriefBanner } from './DailyBriefCard';
import NeedsReconnectBanner from './dashboard/NeedsReconnectBanner';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  Settings, LogOut, Menu, X, ChevronDown, Shield, User,
  Zap, Bell, AlertCircle, ChevronRight, BarChart3, Activity,
  Radar, HelpCircle, LayoutDashboard, AlertTriangle, Link2,
  ClipboardList, MessageSquare, Lock, Eye, FlaskConical,
  BookOpen, Scale, Gavel, Target, Sun, Moon, Calendar, Inbox, CreditCard,
  Search
} from 'lucide-react';
import { ArrowLeft } from 'lucide-react';
import { getRouteAccess } from '../lib/tierResolver';
import { canAccess, requiredTier, TIERS } from '../config/tiers';
import { isPrivilegedUser } from '../lib/privilegedUser';
import { fontFamily, colors, shadow } from '../design-system/tokens';

const DISPLAY = fontFamily.display;
const SIDEBAR_WIDTH_STORAGE_KEY = 'biqc_sidebar_width';
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// Business Verification Score Badge — shows identity confidence + data coverage
const VerificationBadge = ({ navigate }) => {
  const [score, setScore] = useState(null);
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    // Fetch latest snapshot confidence
    apiClient.get('/snapshot/latest').then(res => {
      const conf = res.data?.cognitive?.snapshot_confidence || res.data?.cognitive?.system_state?.confidence;
      if (conf) setScore(Math.round(conf));
    }).catch(() => {});
  }, []);

  if (score === null) return null;

  const color = score > 70 ? colors.success : score > 40 ? colors.warning : colors.danger;

  return (
    <div className="relative hidden md:block">
      <button
        onClick={() => setShowTooltip(!showTooltip)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-colors hover:bg-black/5"
        data-testid="verification-badge"
      >
        <div className="w-2 h-2 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}50` }} />
        <span className="text-[11px] font-semibold" style={{ color, fontFamily: fontFamily.mono }}>{score}%</span>
      </button>
      {showTooltip && (
        <div className="absolute right-0 top-10 w-64 rounded-xl p-4 shadow-xl z-50" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--biqc-text-muted)', fontFamily: fontFamily.mono }}>Snapshot Confidence</span>
            <span className="text-xs font-bold" style={{ color, fontFamily: fontFamily.mono }}>{score}%</span>
          </div>
          <div className="h-1.5 rounded-full mb-3" style={{ background: colors.border }}>
            <div className="h-1.5 rounded-full" style={{ width: `${score}%`, background: color }} />
          </div>
          <p className="text-[11px] mb-3" style={{ fontFamily: fontFamily.body, color: 'var(--ink-secondary)' }}>
            {score > 70 ? 'Strong data coverage. Intelligence is well-grounded.' : score > 40 ? 'Moderate coverage. Connect more systems to improve.' : 'Limited data. Most insights based on public signals.'}
          </p>
          <button onClick={() => { setShowTooltip(false); navigate('/integrations'); }}
            className="text-[11px] text-[#E85D00] hover:underline w-full text-left" style={{ fontFamily: fontFamily.mono }}>
            Improve score — connect systems
          </button>
        </div>
      )}
    </div>
  );
};

const DashboardLayout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut, authState } = useSupabaseAuth();
  const { isNavOpen, openNav, closeAll } = useMobileDrawer();
  const isCalibrated = authState === AUTH_STATE.READY;
  const { openTutorial, tutorial } = useTutorial(location.pathname);

  // Selective clear — preserve tutorials and preferences on logout
  const clearAuthStorage = () => {
    const preserve = ['biqc_tutorials_seen', 'sidebar-collapsed'];
    const saved = {};
    preserve.forEach(k => { const v = localStorage.getItem(k); if (v) saved[k] = v; });
    localStorage.clear();
    sessionStorage.clear();
    Object.entries(saved).forEach(([k, v]) => localStorage.setItem(k, v));
  };

  const logout = async () => {
    try {
      await signOut();
      clearAuthStorage();
      setTimeout(() => { window.location.href = '/'; }, 100);
    } catch (error) {
      clearAuthStorage();
      window.location.href = '/';
    }
  };

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('sidebar-collapsed') === 'true');
  const [sidebarWidthPx, setSidebarWidthPx] = useState(() => {
    const stored = Number(localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY));
    return Number.isFinite(stored) ? clamp(stored, 220, 420) : 248;
  });
  const trialDaysLeft = useMemo(() => {
    if (!user?.trial_expires_at) return null;
    const expiry = new Date(user.trial_expires_at);
    const now = new Date();
    if (expiry <= now) return null;
    return Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
  }, [user]);
  const [isDesktopViewport, setIsDesktopViewport] = useState(() => (typeof window !== 'undefined' ? window.innerWidth >= 1024 : false));
  const [activeResizeTarget, setActiveResizeTarget] = useState(null);
  const [notifications, setNotifications] = useState({ total: 0, high: 0 });
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationsList, setNotificationsList] = useState([]);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackForm, setFeedbackForm] = useState({ rating: 8, sentiment: 'positive', message: '' });
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);

  // Token budget warning banner (free tier users nearing quota)
  const [budgetWarning, setBudgetWarning] = useState(null);

  useEffect(() => { localStorage.setItem('sidebar-collapsed', sidebarCollapsed); }, [sidebarCollapsed]);
  useEffect(() => { localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(sidebarWidthPx)); }, [sidebarWidthPx]);

  useEffect(() => {
    const handleResize = () => setIsDesktopViewport(window.innerWidth >= 1024);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setSidebarCollapsed(true);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Mobile scroll lock
  useEffect(() => {
    if (isNavOpen) {
      document.body.classList.add('sidebar-open');
      const scrollY = window.scrollY;
      document.body.style.top = `-${scrollY}px`;
    } else {
      const scrollY = document.body.style.top;
      document.body.classList.remove('sidebar-open');
      document.body.style.top = '';
      if (scrollY) window.scrollTo(0, parseInt(scrollY || '0') * -1);
    }
    return () => { document.body.classList.remove('sidebar-open'); document.body.style.top = ''; };
  }, [isNavOpen]);

  useEffect(() => {
    const handleEscape = (e) => { if (e.key === 'Escape' && isNavOpen) closeAll(); };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isNavOpen, closeAll]);

  useEffect(() => {
    if (!activeResizeTarget) return undefined;

    const handleMouseMove = (e) => {
      if (activeResizeTarget === 'sidebar' && !sidebarCollapsed) {
        setSidebarWidthPx(clamp(e.clientX, 220, 420));
        return;
      }
    };

    const handleMouseUp = () => setActiveResizeTarget(null);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [activeResizeTarget, sidebarCollapsed]);

  // Theme management — light (default) or dark, session-scoped.
  // A new browser session (new tab, or re-login) always starts on the light
  // default; within one session the user's toggle is respected. Switched from
  // localStorage to sessionStorage 2026-04-19 after Andreas reported dark mode
  // persisting across logins (P2 regression).
  const [isDark, setIsDark] = useState(() => {
    const saved = sessionStorage.getItem('biqc_theme');
    return saved ? saved === 'dark' : false; // default light
  });

  useEffect(() => {
    const theme = isDark ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    sessionStorage.setItem('biqc_theme', theme);
  }, [isDark]);

  const toggleTheme = () => setIsDark(prev => !prev);

  // Notifications — Supabase Realtime (replaces polling)
  // Depends on user?.id so channel re-subscribes if user changes (logout → login as different user)
  useEffect(() => {
    if (!user?.id) return;
    fetchNotifications();

    // Subscribe to watchtower_events for real-time alert updates
    let channel;
    const setup = async () => {
      channel = supabase
        .channel(`notification-updates-${user.id}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'watchtower_events',
          filter: `user_id=eq.${user.id}`,
        }, () => {
          fetchNotifications();
        })
        .subscribe();
    };
    setup();

    return () => { if (channel) supabase.removeChannel(channel); };
  }, [user?.id]);

  const fetchNotifications = async () => {
    try {
      const response = await apiClient.get('/notifications/alerts');
      setNotifications(response.data.summary || { total: 0, high: 0 });
      setNotificationsList(response.data.notifications || []);
    } catch {}
  };

  // Budget warning — check free tier usage (once per session, cached)
  useEffect(() => {
    if (sessionStorage.getItem('biqc_budget_warning_dismissed')) return;
    const cached = sessionStorage.getItem('biqc_billing_overview');
    if (cached) {
      try {
        const data = JSON.parse(cached);
        checkBudgetThreshold(data);
      } catch { /* ignore bad cache */ }
      return;
    }
    apiClient.get('/billing/overview')
      .then(res => {
        const data = res.data;
        if (data) {
          sessionStorage.setItem('biqc_billing_overview', JSON.stringify(data));
          checkBudgetThreshold(data);
        }
      })
      .catch(() => { /* fail silently */ });
  }, []);

  const checkBudgetThreshold = (data) => {
    // Trial banner: only show for users in the 14-day trial (or legacy 'free' string
    // which is treated as 'trial' until backend rename lands). Paid users aren't nagged.
    const tier = String(data?.usage?.tier || data?.subscription?.tier || user?.subscription_tier || 'trial').toLowerCase();
    if (!['trial', 'free', ''].includes(tier)) return; // only during trial
    const features = data?.usage?.features || {};
    let maxPct = 0;
    for (const feat of Object.values(features)) {
      if (feat.unlimited || !feat.limit || feat.limit <= 0) continue;
      const pct = Math.round((feat.used / feat.limit) * 100);
      if (pct > maxPct) maxPct = pct;
    }
    if (maxPct > 80) {
      setBudgetWarning(maxPct);
    }
  };

  const dismissBudgetWarning = () => {
    setBudgetWarning(null);
    sessionStorage.setItem('biqc_budget_warning_dismissed', 'true');
  };

  // Multi-expand sections — collapsed by default until a paid item is active.
  const [expandedSections, setExpandedSections] = useState(() => new Set());

  const toggleSection = (sectionId) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      next.has(sectionId) ? next.delete(sectionId) : next.add(sectionId);
      return next;
    });
  };

  const isSA = isPrivilegedUser(user);

  // Navigation sections matching mockup groupings: Today, Inbox, Intelligence, System
  const navSections = useMemo(() => {
    const sections = [
      // — Today
      { id: 'overview', label: 'Advisor', path: '/advisor', icon: LayoutDashboard, showBadge: true, items: [], group: 'today' },
      { id: 'alerts', label: 'Alert Centre', path: '/settings/alerts', icon: Bell, showBadge: true, items: [], group: 'today' },
      { id: 'soundboard', label: 'Ask BIQc', path: '/soundboard', icon: MessageSquare, items: [], group: 'today' },
      { id: 'actions', label: 'Actions', path: '/settings/actions', icon: Zap, items: [], group: 'today' },
      // — Inbox
      { id: 'priority-inbox', label: 'Email', path: '/email-inbox', icon: Inbox, items: [], group: 'inbox' },
      { id: 'calendar', label: 'Calendar', path: '/calendar', icon: Calendar, items: [], group: 'inbox' },
      // — Intelligence
      { id: 'market', label: 'Market & position', path: '/market', icon: Radar, items: [], group: 'intelligence' },
      { id: 'business-dna', label: 'Business DNA', path: '/business-profile', icon: BarChart3, items: [], group: 'intelligence' },
      { id: 'benchmark', label: 'Benchmark', path: '/competitive-benchmark', icon: Target, items: [], group: 'intelligence' },
      { id: 'boardroom', label: 'BoardRoom', path: '/board-room', icon: Target, items: [], group: 'intelligence' },
      { id: 'warroom', label: 'WarRoom', path: '/war-room', icon: Shield, items: [], group: 'intelligence' },
      // — System
      { id: 'data-health', label: 'Data health', path: '/data-health', icon: Activity, items: [], group: 'system' },
      { id: 'integrations', label: 'Integrations', path: '/integrations', icon: Link2, items: [], group: 'system' },
      { id: 'settings', label: 'Settings', path: '/settings', icon: Settings, items: [], group: 'system' },
    ];

    // Free tier: show all groups but lock paid items via canAccess
    // No need to filter sections — tier gating handles visibility
    if (isSA) {
      sections.push(
        // — Admin (only for super_admin / privileged)
        { id: 'admin', label: 'Admin', group: 'admin', items: [
          { icon: FlaskConical, label: 'A/B Testing', path: '/ab-testing' },
          { icon: Settings, label: 'Admin Dashboard', path: '/admin' },
          { icon: CreditCard, label: 'Pricing Control', path: '/admin/pricing' },
          { icon: Bell, label: 'UX Feedback', path: '/admin/ux-feedback' },
          { icon: ClipboardList, label: 'Scope Checkpoints', path: '/admin/scope-checkpoints' },
          { icon: Activity, label: 'Data Center', path: '/data-center' },
          { icon: BookOpen, label: 'Knowledge Base', path: '/knowledge-base' },
          { icon: Activity, label: 'Observability', path: '/observability' },
          { icon: Zap, label: 'Prompt Lab', path: '/admin/prompt-lab' },
          { icon: Shield, label: 'Support Console', path: '/support-admin' },
          { icon: Eye, label: 'Watchtower', path: '/watchtower' },
        ]},
      );
    }
    return sections;
  }, [isSA]);

  const visibleSections = useMemo(() => {
    return navSections.map(section => ({
      ...section,
      items: section.items.filter(item => !item.requiresCalibration || isCalibrated),
    }));
  }, [navSections, isCalibrated]);

  const isActive = useCallback((path) => location.pathname === path || location.pathname.startsWith(`${path}/`), [location.pathname]);
  const getLockedRedirect = useCallback((path) => {
    const config = getRouteAccess(path);
    const required = config?.minTier || TIERS[requiredTier(path)]?.id || 'starter';
    const baseParams = new URLSearchParams({
      from: path,
      required,
      launch: config?.launchType || 'foundation',
    });
    if (config?.featureKey) {
      baseParams.set('feature', config.featureKey);
    }
    if (config?.launchType === 'waitlist' || config?.launchType === 'foundation' || config?.launchType === 'paid') {
      return `/subscribe?${baseParams.toString()}`;
    }
    return `/upgrade?${baseParams.toString()}`;
  }, []);
  const currentPageLabel = useMemo(() => {
    for (const section of visibleSections) {
      if (section.path && isActive(section.path)) return section.label;
      for (const item of section.items) {
        if (isActive(item.path)) return item.label;
      }
    }
    return 'Current page';
  }, [visibleSections, isActive]);

  useEffect(() => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      visibleSections.forEach((section) => {
        const sectionHasActiveItem = (section.path && isActive(section.path)) || section.items.some((item) => isActive(item.path));
        if (sectionHasActiveItem) next.add(section.id);
      });
      if (isSA) next.add('admin');
      return next;
    });
  }, [visibleSections, isSA, isActive]);
  const activeSidebarWidth = sidebarCollapsed ? 68 : sidebarWidthPx;
  const startSidebarResize = (event) => {
    if (sidebarCollapsed) return;
    event.preventDefault();
    setActiveResizeTarget('sidebar');
  };

  const submitFeedback = async () => {
    if (feedbackSubmitting) return;
    setFeedbackSubmitting(true);
    try {
      await apiClient.post('/ux-feedback/events', {
        route: location.pathname,
        feedback_type: 'ui_feedback',
        rating: Number(feedbackForm.rating || 0) || null,
        sentiment: feedbackForm.sentiment || null,
        message: feedbackForm.message || null,
        metadata: { source: 'dashboard_feedback_fab' },
      });
      setFeedbackOpen(false);
      setFeedbackForm({ rating: 8, sentiment: 'positive', message: '' });
    } catch {
      // ignore; non-blocking UI
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: `var(--biqc-bg, ${colors.bg})`, color: `var(--biqc-text, ${colors.text})` }}>
      {/* ═══ TOP BAR ═══ */}
      <header className="fixed top-0 left-0 right-0 h-[60px] px-4 lg:px-6 flex items-center justify-between" style={{ background: 'var(--biqc-sidebar-bg)', backdropFilter: 'saturate(180%) blur(16px)', WebkitBackdropFilter: 'saturate(180%) blur(16px)', borderBottom: `1px solid var(--biqc-border, ${colors.border})`, zIndex: 1000 }}>
        <div className="flex items-center gap-3">
          <button onClick={() => isNavOpen ? closeAll() : openNav()} className="lg:hidden p-1.5 rounded-lg hover:bg-black/5 transition-colors" style={{ color: 'var(--biqc-text-2)' }} aria-label={isNavOpen ? 'Close navigation menu' : 'Open navigation menu'} data-testid="mobile-menu-toggle">
            {isNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: '#E85D00', boxShadow: '0 0 8px rgba(232,93,0,0.4)' }} />
            <span className="font-semibold text-sm" style={{ fontFamily: DISPLAY, color: 'var(--ink-display, #0A0A0A)' }}>BIQc</span>
          </div>
        </div>

        {/* ═══ SEARCH BAR (center of topbar) ═══ */}
        <div className="hidden md:flex flex-1 justify-center px-4" style={{ maxWidth: 560 }}>
          <button
            onClick={() => navigate('/soundboard')}
            className="flex items-center gap-2 w-full px-3 rounded-lg transition-colors hover:border-[rgba(140,170,210,0.25)]"
            style={{
              maxWidth: 520,
              height: 36,
              background: `var(--biqc-bg-input, ${colors.bgInput})`,
              border: '1px solid var(--biqc-border, rgba(140,170,210,0.15))',
              borderRadius: 'var(--r-md, 8px)',
              cursor: 'text',
            }}
            aria-label="Search signals, actions, insights"
            data-testid="topbar-search"
          >
            <Search className="w-4 h-4 shrink-0" style={{ color: 'var(--ink-muted, #708499)' }} />
            <span className="flex-1 text-left text-sm" style={{ color: 'var(--ink-muted, #708499)', fontFamily: fontFamily.body }}>
              Search signals, actions, insights...
            </span>
            <kbd
              className="hidden lg:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium"
              style={{
                background: 'rgba(140,170,210,0.08)',
                border: '1px solid rgba(140,170,210,0.15)',
                color: 'var(--ink-muted, #708499)',
                fontFamily: fontFamily.mono,
                lineHeight: 1,
              }}
            >
              ⌘K
            </kbd>
          </button>
        </div>
        {/* Mobile: search icon only */}
        <button
          className="md:hidden p-1.5 rounded-lg hover:bg-black/5 transition-colors"
          style={{ color: 'var(--biqc-text-2)' }}
          aria-label="Search"
          data-testid="topbar-search-mobile"
          onClick={() => {/* future: open search modal */}}
        >
          <Search className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          {tutorial && <HelpButton onClick={openTutorial} />}

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg transition-colors hover:bg-black/5"
            style={{ color: 'var(--biqc-text-2)' }}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={isDark ? 'Light mode' : 'Dark mode'}
            data-testid="theme-toggle"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Business Verification Score Badge */}
          <VerificationBadge navigate={navigate} />

          {/* Notifications */}
          <div className="relative">
            <button onClick={() => setShowNotifications(!showNotifications)} className="p-2 rounded-lg hover:bg-black/5 transition-colors relative" style={{ color: 'var(--biqc-text-2)' }} aria-label="Notifications">
              <Bell className="w-5 h-5" />
              {notifications.total > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-5 h-5 flex items-center justify-center text-xs font-bold text-white rounded-full" style={{ background: notifications.high > 0 ? colors.danger : colors.warning }}>
                  {notifications.total > 9 ? '9+' : notifications.total}
                </span>
              )}
            </button>
            {showNotifications && (
              <div className="absolute right-0 top-12 w-96 max-h-[480px] overflow-y-auto rounded-xl shadow-xl" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)', zIndex: 9999 }}>
                <div className="p-3 flex items-center justify-between sticky top-0" style={{ borderBottom: '1px solid var(--biqc-border)', background: 'var(--biqc-bg-card)' }}>
                  <h3 className="font-semibold text-sm" style={{ fontFamily: DISPLAY, color: 'var(--ink-display)' }}>Alerts</h3>
                  <div className="flex items-center gap-2">
                    {notifications.high > 0 && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: colors.dangerDim, color: colors.danger, fontFamily: fontFamily.mono }}>{notifications.high} urgent</span>}
                    <button onClick={() => { setShowNotifications(false); navigate('/settings/alerts'); }} className="text-xs px-2 py-1 rounded-lg" style={{ color: colors.brand, background: colors.brandDim, fontFamily: fontFamily.mono }}>View all</button>
                  </div>
                </div>
                {notificationsList.length === 0 ? (
                  <div className="p-6 text-center">
                    <Bell className="w-8 h-8 mx-auto mb-2 text-[var(--ink-muted)]" />
                    <p className="text-sm text-[var(--ink-muted)]" style={{ fontFamily: fontFamily.body }}>No alerts</p>
                    <p className="text-xs mt-1 text-[var(--ink-muted)]">Connect integrations to activate real-time alerts</p>
                  </div>
                ) : (
                  <div>
                    {notificationsList.map((notif, idx) => (
                      <div key={notif.id || idx} className="p-3" style={{ borderBottom: '1px solid var(--biqc-border)', background: notif.severity === 'high' ? colors.dangerDim : 'transparent' }}>
                        <div className="flex items-start gap-3">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: notif.severity === 'high' ? colors.dangerDim : colors.warningDim }}>
                            <AlertCircle className="w-3.5 h-3.5" style={{ color: notif.severity === 'high' ? colors.danger : colors.warning }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold mb-0.5" style={{ fontFamily: fontFamily.body, color: 'var(--ink-display)' }}>{notif.title}</p>
                            <p className="text-[11px] text-[var(--ink-muted)] line-clamp-2 mb-1" style={{ fontFamily: fontFamily.body }}>{notif.message}</p>
                            {notif.action && <p className="text-[11px] text-[#E85D00]">{notif.action}</p>}
                            {/* Action buttons inline in bell */}
                            <div className="flex gap-1.5 mt-2">
                              <button
                                onClick={async (e) => { e.stopPropagation(); try { await apiClient.post(`/notifications/dismiss/${notif.id}`); fetchNotifications(); } catch {} }}
                                className="text-[10px] px-2 py-1 rounded-md flex items-center gap-1"
                                style={{ background: '#10B98115', color: '#10B981', border: '1px solid #10B98130', fontFamily: fontFamily.mono }}
                                data-testid={`notif-dismiss-${notif.id}`}>
                                ✓ Done
                              </button>
                              <button
                                onClick={async (e) => { e.stopPropagation(); try { await apiClient.post(`/notifications/dismiss/${notif.id}`); fetchNotifications(); } catch {} }}
                                className="text-[10px] px-2 py-1 rounded-md flex items-center gap-1"
                                style={{ background: '#64748B15', color: 'var(--ink-muted)', border: '1px solid #64748B30', fontFamily: fontFamily.mono }}
                                data-testid={`notif-ignore-${notif.id}`}>
                                Ignore
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setShowNotifications(false); navigate(notif.type === 'email' || notif.type === 'complaint' ? '/email-inbox' : notif.type === 'meeting' ? '/calendar' : '/intel-centre'); }}
                                className="text-[10px] px-2 py-1 rounded-md"
                                style={{ background: '#3B82F615', color: '#3B82F6', border: '1px solid #3B82F630', fontFamily: fontFamily.mono }}>
                                Review
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <button className="p-2 rounded-lg hover:bg-black/5 hidden md:flex" style={{ color: 'var(--biqc-text-2)' }} aria-label="Help"><HelpCircle className="w-5 h-5" /></button>

          <div className="w-px h-6 mx-1 hidden md:block" style={{ background: 'rgba(140,170,210,0.15)' }} />

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 p-1 pr-3 rounded-xl hover:bg-black/5 transition-colors" aria-label="User menu">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white" style={{ background: '#E85D00', fontFamily: fontFamily.body }}>
                  {user?.full_name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <span className="hidden sm:block text-sm font-medium" style={{ fontFamily: fontFamily.body, color: 'var(--ink-display)' }}>{user?.full_name?.split(' ')[0] || 'User'}</span>
                <ChevronDown className="w-3.5 h-3.5 hidden sm:block text-[var(--ink-muted)]" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)', borderRadius: '12px' }}>
              <div className="px-3 py-2.5">
                <p className="font-medium" style={{ fontFamily: fontFamily.body, color: 'var(--ink-display)' }}>{user?.full_name}</p>
                <p className="text-sm text-[var(--ink-muted)]" style={{ fontFamily: fontFamily.mono }}>{user?.email}</p>
              </div>
              <DropdownMenuSeparator style={{ background: 'rgba(140,170,210,0.15)' }} />
              <DropdownMenuItem onClick={() => navigate('/settings')} className="cursor-pointer py-2.5" style={{ color: 'var(--ink-secondary)' }}><User className="w-4 h-4 mr-2" /> Settings</DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/subscribe')} className="cursor-pointer py-2.5" style={{ color: 'var(--ink-secondary)' }}><Zap className="w-4 h-4 mr-2" /> Subscription: plans and feature unlocks</DropdownMenuItem>
              {(user?.role === 'admin' || user?.role === 'superadmin' || isPrivilegedUser(user)) && (
                <>
                  <DropdownMenuItem onClick={() => navigate('/admin')} className="cursor-pointer py-2.5" style={{ color: 'var(--ink-secondary)' }}><Shield className="w-4 h-4 mr-2" /> Super Admin</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/calibration')} className="cursor-pointer py-2.5" style={{ color: 'var(--ink-secondary)' }}><Settings className="w-4 h-4 mr-2" /> Recalibrate</DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator style={{ background: 'rgba(140,170,210,0.15)' }} />
              <DropdownMenuItem onClick={() => { logout(); navigate('/'); }} className="cursor-pointer py-2.5 text-[#EF4444] focus:text-[#EF4444] focus:bg-red-500/5"><LogOut className="w-4 h-4 mr-2" /> Sign Out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* ═══ SIDEBAR ═══ */}
      <aside className={`fixed left-0 transition-all duration-300 ${isNavOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 top-[60px] h-[calc(100vh-60px)]`}
        style={{ zIndex: 999, background: 'var(--biqc-sidebar-bg, var(--surface))', borderRight: '1px solid rgba(140,170,210,0.08)', width: `${activeSidebarWidth}px` }}
        role="navigation" aria-label="Main navigation">

        <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="hidden lg:flex absolute -right-3 top-6 w-6 h-6 rounded-full items-center justify-center hover:bg-white/10 transition-colors"
          style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border, rgba(140,170,210,0.15))' }}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          {sidebarCollapsed ? <ChevronRight className="w-4 h-4" style={{ color: 'var(--biqc-text-muted)' }} /> : <ChevronRight className="w-4 h-4 rotate-180" style={{ color: 'var(--biqc-text-muted)' }} />}
        </button>
        {!sidebarCollapsed && (
          <div
            className="hidden lg:block absolute top-0 right-0 h-full w-1 cursor-col-resize hover:bg-white/10"
            onMouseDown={startSidebarResize}
            role="separator"
            aria-label="Resize navigation panel"
            data-testid="sidebar-resize-handle"
          />
        )}

        <nav
          ref={(el) => {
            if (!el) return;
            // Restore scroll position on mount
            const saved = sessionStorage.getItem('sidebar-scroll');
            if (saved) el.scrollTop = parseInt(saved, 10);
            // Save scroll position on scroll
            const handler = () => sessionStorage.setItem('sidebar-scroll', el.scrollTop);
            el.addEventListener('scroll', handler, { passive: true });
            return () => el.removeEventListener('scroll', handler);
          }}
          className="p-3 space-y-0.5 overflow-y-auto flex flex-col" style={{ height: '100%' }} aria-label="Platform navigation">
          {visibleSections.map((section, idx) => {
            const isExpanded = expandedSections.has(section.id);
            const sectionActive = (section.path && isActive(section.path)) || section.items.some((item) => isActive(item.path));
            const sectionLocked = section.path ? !canAccess(user?.subscription_tier || 'free', section.path, user?.email || '') : false;
            const SectionIcon = section.icon;
            // Render group header when group changes (mockup: "— Today", "— Inbox", etc.)
            const prevGroup = idx > 0 ? visibleSections[idx - 1].group : null;
            const showGroupHeader = section.group && section.group !== prevGroup && !sidebarCollapsed;
            const groupLabels = { today: 'Today', inbox: 'Inbox', intelligence: 'Intelligence', system: 'System', admin: 'Admin' };

            return (
              <div key={section.id}>
                {showGroupHeader && (
                  <div className="px-3 pt-4 pb-1 text-[10px] font-medium uppercase tracking-[0.12em]"
                    style={{ color: 'var(--ink-muted, #708499)', fontFamily: fontFamily.mono }}>
                    {groupLabels[section.group] || section.group}
                  </div>
                )}
                {section.path ? (
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => {
                        if (sectionLocked) { navigate(getLockedRedirect(section.path)); return; }
                        navigate(section.path);
                      }}
                      className="flex items-center gap-2.5 flex-1 px-3 py-2.5 min-h-[44px] rounded-lg text-sm transition-all"
                      aria-current={sectionActive ? 'page' : undefined}
                      style={{
                        fontFamily: fontFamily.body,
                        color: sectionLocked ? '#4A5568' : sectionActive ? 'var(--biqc-text, #0A0A0A)' : 'var(--biqc-text-2, #8FA0B8)',
                        background: sectionActive ? 'var(--surface-sunken)' : 'transparent',
                        borderLeft: sectionActive ? '2px solid var(--lava, #E85D00)' : '2px solid transparent',
                      }}
                      data-testid={`nav-section-${section.id}`}
                      title={sectionLocked ? `Requires ${TIERS[requiredTier(section.path)]?.label} plan` : section.label}
                    >
                      {SectionIcon ? <SectionIcon className="w-4 h-4 shrink-0" style={{ color: sectionLocked ? '#4A5568' : sectionActive ? 'var(--lava, #E85D00)' : 'var(--ink-muted, #708499)' }} /> : null}
                      <span className="flex-1 text-left">{section.label}</span>
                      {section.showBadge && notifications.total > 0 && !sectionLocked && <span className="w-5 h-5 flex items-center justify-center text-xs font-bold text-white rounded-full bg-[#EF4444]">{notifications.total > 9 ? '9+' : notifications.total}</span>}
                      {sectionLocked && <Lock className="w-3 h-3 shrink-0" style={{ color: '#4A5568' }} />}
                    </button>
                    {section.items.length > 0 && !sidebarCollapsed && !sectionLocked && (
                      <button
                        onClick={() => toggleSection(section.id)}
                        className="p-1.5 rounded-lg hover:bg-black/5 transition-colors shrink-0"
                        style={{ color: sectionActive ? 'var(--lava, #E85D00)' : 'var(--ink-muted, #708499)' }}
                        aria-expanded={isExpanded}
                        aria-controls={`nav-section-items-${section.id}`}
                        data-testid={`nav-section-toggle-${section.id}`}
                      >
                        <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                      </button>
                    )}
                  </div>
                ) : (
                  <button onClick={() => toggleSection(section.id)}
                    className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3 justify-between'} w-full ${sidebarCollapsed ? 'px-2' : 'px-3'} py-2.5 rounded-lg text-xs font-semibold uppercase tracking-[0.1em] transition-all`}
                    style={{ color: sectionActive ? '#E85D00' : 'var(--biqc-text-muted, #8B9DB5)', fontFamily: fontFamily.mono, minHeight: '40px' }}
                    title={sidebarCollapsed ? section.label : undefined}
                    aria-expanded={isExpanded}
                    aria-controls={`nav-section-items-${section.id}`}
                    data-testid={`nav-section-${section.id}`}>
                    {!sidebarCollapsed && <span>{section.label}</span>}
                    {!sidebarCollapsed && <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} style={{ color: 'var(--biqc-text-muted)' }} />}
                  </button>
                )}

                {isExpanded && !sidebarCollapsed && (
                  <div id={`nav-section-items-${section.id}`} className="space-y-0.5 mb-2">
                    {section.items.map((item) => {
                      const active = isActive(item.path);
                      const showBadge = item.showBadge && notifications.total > 0;
                      const userTier = user?.subscription_tier || 'free';
                      const locked = !canAccess(userTier, item.path, user?.email || '');

                      const handleNavClick = () => {
                        if (locked) { navigate(getLockedRedirect(item.path)); return; }
                        navigate(item.path);
                        closeAll();
                      };

                      return (
                        <button
                          key={item.path}
                          onClick={handleNavClick}
                          className="flex items-center gap-2.5 w-full px-3 py-2.5 min-h-[40px] rounded-lg text-sm transition-all"
                          aria-current={active ? 'page' : undefined}
                          style={{
                            fontFamily: fontFamily.body,
                            color: locked ? '#4A5568' : active ? 'var(--biqc-text, #0A0A0A)' : 'var(--biqc-text-2, #8FA0B8)',
                            background: active ? '#E85D0015' : 'transparent',
                            borderLeft: active ? '2px solid #E85D00' : '2px solid transparent',
                            cursor: 'pointer',
                          }}
                          data-testid={`nav-item-${item.path.replace('/', '')}`}
                          title={locked ? `Requires ${TIERS[requiredTier(item.path)]?.label} plan` : item.label}>
                          <item.icon className="w-4 h-4 shrink-0" style={{ color: locked ? '#4A5568' : active ? 'var(--lava, #E85D00)' : 'var(--ink-muted, #708499)' }} />
                          <span className="flex-1 text-left">{item.label}</span>
                          {locked && <Lock className="w-3 h-3 shrink-0" style={{ color: '#4A5568' }} />}
                          {showBadge && !locked && <span className="w-5 h-5 flex items-center justify-center text-xs font-bold text-white rounded-full bg-[#EF4444]">{notifications.total > 9 ? '9+' : notifications.total}</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          <div className="mt-auto pt-2 pb-2" style={{ borderTop: '1px solid var(--biqc-border, rgba(140,170,210,0.15))' }}>
            <button
              onClick={() => { navigate('/biqc-legal'); closeAll(); }}
              className="flex items-center gap-2.5 w-full px-3 py-2.5 min-h-[44px] rounded-lg text-sm transition-all hover:bg-black/5"
              style={{
                color: isActive('/biqc-legal') ? 'var(--biqc-text, #0A0A0A)' : 'var(--biqc-text-2, #8FA0B8)',
                background: isActive('/biqc-legal') ? 'var(--surface-sunken)' : 'transparent',
                borderLeft: isActive('/biqc-legal') ? '2px solid var(--lava, #E85D00)' : '2px solid transparent',
                fontFamily: fontFamily.body,
              }}
              data-testid="nav-biqc-legal"
            >
              <Scale className="w-4 h-4 shrink-0" style={{ color: isActive('/biqc-legal') ? 'var(--lava, #E85D00)' : 'var(--ink-muted, #708499)' }} />
              {!sidebarCollapsed && <span className="flex-1 text-left">BIQc Legal</span>}
            </button>
          </div>

          {/* ═══ USER PROFILE BLOCK ═══ */}
          <div
            className="mx-2 mb-2 flex items-center gap-2.5 rounded-xl"
            style={{
              background: `var(--biqc-bg-input, ${colors.bgInput})`,
              padding: sidebarCollapsed ? '8px' : '12px',
              borderRadius: 'var(--r-lg, 12px)',
            }}
            data-testid="sidebar-user-profile"
          >
            {/* Avatar */}
            <div
              className="shrink-0 flex items-center justify-center rounded-full text-xs font-semibold text-white"
              style={{
                width: 36,
                height: 36,
                background: 'linear-gradient(135deg, #E85D00, #FF8A3D)',
                fontFamily: fontFamily.body,
              }}
            >
              {user?.full_name
                ? user.full_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
                : (user?.email?.charAt(0).toUpperCase() || 'U')}
            </div>
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <p
                  className="text-sm font-medium truncate"
                  style={{ color: 'var(--biqc-text, #0A0A0A)', fontFamily: fontFamily.body, lineHeight: 1.3 }}
                >
                  {user?.full_name || user?.email || 'User'}
                </p>
                <p
                  className="text-[11px] capitalize"
                  style={{ color: 'var(--ink-muted, #708499)', fontFamily: fontFamily.mono, lineHeight: 1.3 }}
                >
                  {/* 2026-04-19: no free tier — default label is Trial for users without an active paid sub */}
                  {(() => {
                    const raw = (user?.subscription_tier || 'trial').toString();
                    if (raw === 'free') return 'trial';
                    return raw.replace('_', ' ');
                  })()}
                </p>
              </div>
            )}
          </div>
        </nav>
      </aside>

      {/* Daily Brief Banner — shows once per day on login */}
      <DailyBriefBanner onOpen={() => navigate('/advisor', { state: { focusBrief: true } })} />

      {/* Mobile Overlay */}
      {isNavOpen && <div className="fixed inset-0 bg-black/50 lg:hidden" onClick={closeAll} aria-hidden="true" style={{ zIndex: 998 }} />}

      {/* ═══ MAIN CONTENT + DESKTOP SOUNDBOARD PANEL ═══ */}
      {/* 2026-04-18 Phase 6.2 + 6.3: orange banner REPLACED with
          TrialCountdownCard — tutorial-style, dismissible, bottom-right,
          shows exact charge date, persistent in final 3 days of trial. */}
      {user?.trial_expires_at && (
        <TrialCountdownCard
          trialExpiresAt={user.trial_expires_at}
          onUpgrade={() => navigate('/subscribe')}
        />
      )}

      <div
        className="pt-[60px] pb-[76px] lg:pb-0 transition-all duration-300 flex"
        style={{
          minHeight: '100dvh',
          marginLeft: isDesktopViewport ? `${activeSidebarWidth}px` : undefined,
        }}
      >
        <main id="main-content" className="flex-1" style={{ background: 'var(--canvas-app)', overflowY: 'visible' }}>
          <div className="px-4 py-4 md:px-6 md:py-6">
            {/* Sprint A #6: Stale/errored integrations call-out — appears once at
                the top of every dashboard page, silent when everything is healthy. */}
            <NeedsReconnectBanner />
            {/* Phase 6.5: Active alerts stack — auto-clears on target-page visit */}
            <AlertStack maxVisible={3} position="top" />
            <div className="mb-4 flex items-center justify-between gap-3" data-testid="page-navigation-row">
              <button
                onClick={() => navigate(-1)}
                className="inline-flex min-h-[38px] items-center gap-2 rounded-xl border px-3 py-1.5 text-xs transition-colors"
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                style={{ borderColor: 'var(--biqc-border)', color: 'var(--biqc-text)', fontFamily: fontFamily.mono }}
                data-testid="page-back-button"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
              <p className="text-xs text-[var(--ink-secondary)]" style={{ fontFamily: fontFamily.mono }} data-testid="page-current-label">
                {currentPageLabel}
              </p>
            </div>
            {/* Budget warning banner — free tier users nearing quota */}
            {budgetWarning !== null && (
              <div
                className="flex items-center justify-between gap-3 mb-4 px-4 py-2.5 rounded-lg"
                style={{
                  background: 'rgba(245,158,11,0.12)',
                  border: '1px solid rgba(245,158,11,0.3)',
                  fontFamily: fontFamily.body,
                }}
                data-testid="budget-warning-banner"
                role="alert"
              >
                <p className="text-sm" style={{ color: 'var(--ink-display, #0A0A0A)' }}>
                  <AlertTriangle className="w-4 h-4 inline-block mr-1.5 -mt-0.5" style={{ color: '#D97706' }} />
                  You've used <strong>{budgetWarning}%</strong> of your free AI quota.{' '}
                  <a
                    href="/subscribe"
                    onClick={(e) => { e.preventDefault(); navigate('/subscribe'); }}
                    style={{ color: 'var(--lava, #E85D00)', fontWeight: 600, textDecoration: 'underline' }}
                  >
                    Upgrade for unlimited.
                  </a>
                </p>
                <button
                  onClick={dismissBudgetWarning}
                  className="shrink-0 p-1 rounded hover:bg-black/5 transition-colors"
                  style={{ color: 'var(--ink-muted, #737373)' }}
                  aria-label="Dismiss budget warning"
                  data-testid="budget-warning-dismiss"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            {children}
          </div>
        </main>

      </div>

      {/* Mobile Bottom Navigation */}
      <MobileNav />

      {/* UX Feedback FAB */}
      <button
        onClick={() => setFeedbackOpen(true)}
        className="fixed bottom-20 left-4 z-40 px-3 py-2 rounded-full text-xs"
        style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)', color: 'var(--ink-secondary, #8FA0B8)', fontFamily: fontFamily.mono }}
        data-testid="ux-feedback-fab"
      >
        Feedback
      </button>

      {feedbackOpen && (
        <>
          <div className="fixed inset-0 z-[1200] bg-black/50" onClick={() => setFeedbackOpen(false)} />
          <div className="fixed z-[1201] w-[min(460px,92vw)] p-4 rounded-xl" style={{ ...cardStyleFromTheme(), right: 16, bottom: 84 }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm" style={{ fontFamily: fontFamily.display, color: 'var(--ink-display)' }}>Quick UX Feedback</span>
              <button onClick={() => setFeedbackOpen(false)} className="text-[var(--ink-muted)]">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <label className="text-[10px] text-[var(--ink-muted)]" style={{ fontFamily: fontFamily.mono }}>
                Rating (1-10)
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={feedbackForm.rating}
                  onChange={(e) => setFeedbackForm((p) => ({ ...p, rating: e.target.value }))}
                  style={inputStyleFromTheme()}
                />
              </label>
              <label className="text-[10px] text-[var(--ink-muted)]" style={{ fontFamily: fontFamily.mono }}>
                Sentiment
                <select
                  value={feedbackForm.sentiment}
                  onChange={(e) => setFeedbackForm((p) => ({ ...p, sentiment: e.target.value }))}
                  style={inputStyleFromTheme()}
                >
                  <option value="positive">positive</option>
                  <option value="neutral">neutral</option>
                  <option value="negative">negative</option>
                </select>
              </label>
            </div>
            <label className="text-[10px] text-[var(--ink-muted)]" style={{ fontFamily: fontFamily.mono }}>
              Message
              <textarea
                value={feedbackForm.message}
                onChange={(e) => setFeedbackForm((p) => ({ ...p, message: e.target.value }))}
                style={{ ...inputStyleFromTheme(), minHeight: 76 }}
                placeholder="What should be improved?"
              />
            </label>
            <div className="flex justify-end mt-2">
              <button
                onClick={submitFeedback}
                disabled={feedbackSubmitting}
                className="px-3 py-2 rounded-lg text-xs"
                style={{ background: '#E85D0015', border: '1px solid #E85D0030', color: '#E85D00', fontFamily: fontFamily.mono }}
              >
                {feedbackSubmitting ? 'Sending...' : 'Send feedback'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* First Login Notification */}
      <FirstLoginNotification />

      {/* Tutorial */}
      <PageTutorial pageKey={location.pathname} />
    </div>
  );
};

export default DashboardLayout;

function cardStyleFromTheme() {
  return { background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' };
}

function inputStyleFromTheme() {
  return {
    width: '100%',
    marginTop: 4,
    padding: '8px 10px',
    borderRadius: 8,
    background: 'var(--biqc-bg)',
    border: '1px solid var(--biqc-border)',
    color: 'var(--biqc-text)',
    fontFamily: fontFamily.mono,
    fontSize: 12,
  };
}
