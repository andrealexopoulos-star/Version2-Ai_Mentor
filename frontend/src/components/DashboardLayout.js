import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSupabaseAuth, AUTH_STATE, supabase } from '../context/SupabaseAuthContext';
import { useMobileDrawer } from '../context/MobileDrawerContext';
import { apiClient } from '../lib/api';
import { useTutorial, HelpButton, PageTutorial } from './TutorialOverlay';
import FirstLoginNotification from './FirstLoginNotification';
import MobileNav from './MobileNav';
import SoundboardPanel from './SoundboardPanel';
import { DailyBriefBanner } from './DailyBriefCard';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  Settings, LogOut, Menu, X, ChevronDown, Shield, User,
  Zap, Bell, AlertCircle, ChevronRight, BarChart3, Activity, FileText,
  TrendingUp, Radar, HelpCircle, LayoutDashboard, AlertTriangle, Workflow, Link2,
  ClipboardList, Inbox, MessageSquare, Lock, Eye, Megaphone, FlaskConical,
  BookOpen, Scale, Gavel, Target, Sun, Moon, Calendar
} from 'lucide-react';
import { ArrowLeft } from 'lucide-react';
import { checkRouteAccess, resolveTier } from '../lib/tierResolver';
import { canAccess, requiredTier, TIERS } from '../config/tiers';
import { fontFamily } from '../design-system/tokens';

const DISPLAY = "'Cormorant Garamond', Georgia, serif";

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

  const color = score > 70 ? '#10B981' : score > 40 ? '#F59E0B' : '#EF4444';

  return (
    <div className="relative hidden md:block">
      <button
        onClick={() => setShowTooltip(!showTooltip)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-colors hover:bg-white/5"
        data-testid="verification-badge"
      >
        <div className="w-2 h-2 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}50` }} />
        <span className="text-[11px] font-semibold" style={{ color, fontFamily: fontFamily.mono }}>{score}%</span>
      </button>
      {showTooltip && (
        <div className="absolute right-0 top-10 w-64 rounded-xl p-4 shadow-xl z-50" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] uppercase tracking-wider" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>Snapshot Confidence</span>
            <span className="text-xs font-bold" style={{ color, fontFamily: fontFamily.mono }}>{score}%</span>
          </div>
          <div className="h-1.5 rounded-full mb-3" style={{ background: '#243140' }}>
            <div className="h-1.5 rounded-full" style={{ width: `${score}%`, background: color }} />
          </div>
          <p className="text-[11px] text-[#9FB0C3] mb-3" style={{ fontFamily: fontFamily.body }}>
            {score > 70 ? 'Strong data coverage. Intelligence is well-grounded.' : score > 40 ? 'Moderate coverage. Connect more systems to improve.' : 'Limited data. Most insights based on public signals.'}
          </p>
          <button onClick={() => { setShowTooltip(false); navigate('/integrations'); }}
            className="text-[11px] text-[#FF6A00] hover:underline w-full text-left" style={{ fontFamily: fontFamily.mono }}>
            Improve score — connect systems
          </button>
        </div>
      )}
    </div>
  );
};

const DashboardLayout = ({ children, actionMessage, onActionConsumed }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut, authState } = useSupabaseAuth();
  const { isNavOpen, openNav, closeAll } = useMobileDrawer();
  const isCalibrated = authState === AUTH_STATE.READY;
  const { openTutorial, tutorial } = useTutorial(location.pathname);
  const [sbOpen, setSbOpen] = useState(false);

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
  const [notifications, setNotifications] = useState({ total: 0, high: 0 });
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationsList, setNotificationsList] = useState([]);

  useEffect(() => { localStorage.setItem('sidebar-collapsed', sidebarCollapsed); }, [sidebarCollapsed]);

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

  // Theme management — dark (default) or light, persisted to localStorage
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('biqc_theme');
    return saved ? saved === 'dark' : true; // default dark
  });

  useEffect(() => {
    const theme = isDark ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('biqc_theme', theme);
  }, [isDark]);

  const toggleTheme = () => setIsDark(prev => !prev);

  // Notifications — Supabase Realtime (replaces polling)
  useEffect(() => {
    fetchNotifications();

    // Subscribe to watchtower_events for real-time alert updates
    let channel;
    const setup = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return;
      channel = supabase
        .channel('notification-updates')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'watchtower_events',
          filter: `user_id=eq.${session.user.id}`,
        }, () => {
          fetchNotifications();
        })
        .subscribe();
    };
    setup();

    return () => { if (channel) supabase.removeChannel(channel); };
  }, []);

  const fetchNotifications = async () => {
    try {
      const response = await apiClient.get('/notifications/alerts');
      setNotifications(response.data.summary || { total: 0, high: 0 });
      setNotificationsList(response.data.notifications || []);
    } catch {}
  };

  // Multi-expand sections — keep key navigation groups open by default
  const [expandedSections, setExpandedSections] = useState(() => new Set(['intelligence', 'execution', 'governance', 'legal']));

  const toggleSection = (sectionId) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      next.has(sectionId) ? next.delete(sectionId) : next.add(sectionId);
      return next;
    });
  };

  const navSections = [
    { id: 'intelligence', label: 'Intelligence', items: [
      {
        icon: LayoutDashboard, label: 'BIQc Overview', path: '/advisor', showBadge: true,
        children: [
          { icon: MessageSquare, label: 'Boardroom', path: '/board-room' },
          { icon: BookOpen, label: 'Intel Centre', path: '/intel-centre' },
          { icon: Zap, label: 'Soundboard', path: '/soundboard' },
          { icon: Target, label: 'War Room', path: '/war-room' },
        ],
      },
      {
        icon: Radar, label: 'Market & Positioning', path: '/market',
        children: [
          { icon: Workflow, label: 'Automations', path: '/automations' },
          { icon: Target, label: 'Competitive Benchmark', path: '/competitive-benchmark' },
          { icon: Eye, label: 'Exposure Scan', path: '/exposure-scan' },
          { icon: Megaphone, label: 'Marketing Auto', path: '/marketing-automation' },
          { icon: BarChart3, label: 'Marketing Intel', path: '/marketing-intelligence' },
        ],
      },
      { icon: Settings, label: 'Operations', path: '/operations',
        children: [
          { icon: Activity, label: 'Ops Advisory', path: '/ops-advisory' },
          { icon: FileText, label: 'SOP Generator', path: '/sop-generator' },
        ],
      },
      { icon: TrendingUp, label: 'Revenue', path: '/revenue' },
      {
        icon: AlertTriangle, label: 'Risk', path: '/risk',
        children: [
          { icon: BarChart3, label: 'Analysis', path: '/analysis' },
          { icon: ClipboardList, label: 'Audit Log', path: '/audit-log' },
          { icon: Shield, label: 'Compliance', path: '/compliance' },
          { icon: Target, label: 'Decisions', path: '/decisions' },
          { icon: Eye, label: 'Diagnosis', path: '/diagnosis' },
          { icon: Shield, label: 'Ingestion Audit', path: '/forensic-audit' },
        ],
      },
    ]},
    { id: 'execution', label: 'Execution', items: [
      { icon: Zap, label: 'Actions', path: '/actions' },
      { icon: Bell, label: 'Alerts', path: '/alerts' },
      { icon: Calendar, label: 'Calendar', path: '/calendar' },
      { icon: Inbox, label: 'Priority Inbox', path: '/email-inbox' },
    ]},
    { id: 'governance', label: 'Settings & Growth', items: [
      { icon: BarChart3, label: 'Business DNA', path: '/business-profile' },
      { icon: Activity, label: 'Data Health', path: '/data-health' },
      { icon: FileText, label: 'Documents', path: '/documents' },
      { icon: Link2, label: 'Integrations', path: '/integrations' },
      { icon: FileText, label: 'Reports', path: '/reports' },
      { icon: Settings, label: 'Settings', path: '/settings' },
    ]},
  ];

  // Admin section — ONLY visible to andre@thestrategysquad.com.au (hardcoded)
  const isSA = user?.email === 'andre@thestrategysquad.com.au';
  if (isSA) {
    navSections.push({
      id: 'admin', label: 'Admin', items: [
        { icon: FlaskConical, label: 'A/B Testing', path: '/ab-testing' },
        { icon: Settings, label: 'Admin Dashboard', path: '/admin' },
        { icon: Activity, label: 'Data Center', path: '/data-center' },
        { icon: BookOpen, label: 'Knowledge Base', path: '/knowledge-base' },
        { icon: Activity, label: 'Observability', path: '/observability' },
        { icon: Zap, label: 'Prompt Lab', path: '/admin/prompt-lab' },
        { icon: Shield, label: 'Support Console', path: '/support-admin' },
        { icon: Eye, label: 'Watchtower', path: '/watchtower' },
      ],
    });
  }

  // Track which parent items with children are expanded (e.g. Market & Positioning)
  const [expandedParents, setExpandedParents] = useState(() => new Set());

  // Auto-expand parent item if its child route is active (only expand the parent, not the section)
  useEffect(() => {
    navSections.forEach(section => {
      section.items.forEach(item => {
        if (item.children?.some(c => isActive(c.path))) {
          setExpandedParents(prev => new Set([...prev, item.path]));
        }
      });
    });
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const visibleSections = useMemo(() => {
    return navSections.map(section => ({
      ...section,
      items: section.items.filter(item => !item.requiresCalibration || isCalibrated),
    }));
  }, [isCalibrated]); // eslint-disable-line react-hooks/exhaustive-deps

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(`${path}/`);
  const currentPageLabel = useMemo(() => {
    for (const section of visibleSections) {
      for (const item of section.items) {
        if (isActive(item.path)) return item.label;
        if (item.children) {
          const child = item.children.find((entry) => isActive(entry.path));
          if (child) return child.label;
        }
      }
    }
    return 'Current page';
  }, [visibleSections, location.pathname]);

  useEffect(() => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      visibleSections.forEach((section) => {
        const sectionHasActiveItem = section.items.some((item) => isActive(item.path) || item.children?.some((child) => isActive(child.path)));
        if (sectionHasActiveItem) next.add(section.id);
      });
      if (isSA) next.add('admin');
      next.add('legal');
      return next;
    });
  }, [visibleSections, location.pathname, isSA]);
  const sidebarWidth = sidebarCollapsed ? 'w-16' : 'w-64';
const sidebarMargin = sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64';

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: 'var(--biqc-bg, #0F1720)', color: 'var(--biqc-text, #F4F7FA)' }}>
      {/* ═══ TOP BAR ═══ */}
      <header className="fixed top-0 left-0 right-0 h-14 px-4 lg:px-6 flex items-center justify-between" style={{ background: 'var(--biqc-bg-input, #0A1018)', borderBottom: '1px solid var(--biqc-border, #243140)', zIndex: 1000 }}>
        <div className="flex items-center gap-3">
          <button onClick={() => isNavOpen ? closeAll() : openNav()} className="lg:hidden p-1.5 rounded-lg hover:bg-white/5 transition-colors" style={{ color: 'var(--biqc-text-2)' }} aria-label={isNavOpen ? 'Close navigation menu' : 'Open navigation menu'} data-testid="mobile-menu-toggle">
            {isNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: '#FF6A00' }}>
              <span className="text-white font-bold text-xs" style={{ fontFamily: fontFamily.mono }}>B</span>
            </div>
            <span className="font-semibold text-sm hidden sm:block" style={{ fontFamily: DISPLAY, color: 'var(--biqc-text)' }}>Strategy Squad</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {tutorial && <HelpButton onClick={openTutorial} />}

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg transition-colors hover:bg-white/5"
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
            <button onClick={() => setShowNotifications(!showNotifications)} className="p-2 rounded-lg hover:bg-white/5 transition-colors relative" style={{ color: 'var(--biqc-text-2)' }} aria-label="Notifications">
              <Bell className="w-5 h-5" />
              {notifications.total > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-5 h-5 flex items-center justify-center text-xs font-bold text-white rounded-full" style={{ background: notifications.high > 0 ? '#EF4444' : '#F59E0B' }}>
                  {notifications.total > 9 ? '9+' : notifications.total}
                </span>
              )}
            </button>
            {showNotifications && (
              <div className="absolute right-0 top-12 w-96 max-h-[480px] overflow-y-auto rounded-xl shadow-xl" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)', zIndex: 9999, position: 'fixed', right: 16, top: 64 }}>
                <div className="p-3 flex items-center justify-between sticky top-0" style={{ borderBottom: '1px solid var(--biqc-border)', background: 'var(--biqc-bg-card)' }}>
                  <h3 className="font-semibold text-sm text-[#F4F7FA]" style={{ fontFamily: DISPLAY }}>Alerts</h3>
                  <div className="flex items-center gap-2">
                    {notifications.high > 0 && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#EF444415', color: '#EF4444', fontFamily: fontFamily.mono }}>{notifications.high} urgent</span>}
                    <button onClick={() => { setShowNotifications(false); navigate('/alerts'); }} className="text-xs px-2 py-1 rounded-lg" style={{ color: '#FF6A00', background: '#FF6A0015', fontFamily: fontFamily.mono }}>View all</button>
                  </div>
                </div>
                {notificationsList.length === 0 ? (
                  <div className="p-6 text-center">
                    <Bell className="w-8 h-8 mx-auto mb-2 text-[#64748B]" />
                    <p className="text-sm text-[#64748B]" style={{ fontFamily: fontFamily.body }}>No alerts</p>
                    <p className="text-xs mt-1 text-[#64748B]">Connect integrations to activate real-time alerts</p>
                  </div>
                ) : (
                  <div>
                    {notificationsList.map((notif, idx) => (
                      <div key={notif.id || idx} className="p-3" style={{ borderBottom: '1px solid var(--biqc-border)', background: notif.severity === 'high' ? 'rgba(239,68,68,0.04)' : 'transparent' }}>
                        <div className="flex items-start gap-3">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: notif.severity === 'high' ? '#EF444415' : '#F59E0B15' }}>
                            <AlertCircle className="w-3.5 h-3.5" style={{ color: notif.severity === 'high' ? '#EF4444' : '#F59E0B' }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-[#F4F7FA] mb-0.5" style={{ fontFamily: fontFamily.body }}>{notif.title}</p>
                            <p className="text-[11px] text-[#64748B] line-clamp-2 mb-1" style={{ fontFamily: fontFamily.body }}>{notif.message}</p>
                            {notif.action && <p className="text-[11px] text-[#FF6A00]">{notif.action}</p>}
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
                                style={{ background: '#64748B15', color: '#64748B', border: '1px solid #64748B30', fontFamily: fontFamily.mono }}
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

          <button className="p-2 rounded-lg hover:bg-white/5 hidden md:flex" style={{ color: 'var(--biqc-text-2)' }} aria-label="Help"><HelpCircle className="w-5 h-5" /></button>

          <div className="w-px h-6 mx-1 hidden md:block" style={{ background: '#243140' }} />

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 p-1 pr-3 rounded-xl hover:bg-white/5 transition-colors" aria-label="User menu">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white" style={{ background: '#FF6A00', fontFamily: fontFamily.body }}>
                  {user?.full_name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <span className="hidden sm:block text-sm font-medium text-[#F4F7FA]" style={{ fontFamily: fontFamily.body }}>{user?.full_name?.split(' ')[0] || 'User'}</span>
                <ChevronDown className="w-3.5 h-3.5 hidden sm:block text-[#64748B]" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)', borderRadius: '12px' }}>
              <div className="px-3 py-2.5">
                <p className="font-medium text-[#F4F7FA]" style={{ fontFamily: fontFamily.body }}>{user?.full_name}</p>
                <p className="text-sm text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>{user?.email}</p>
              </div>
              <DropdownMenuSeparator style={{ background: '#243140' }} />
              <DropdownMenuItem onClick={() => navigate('/settings')} className="cursor-pointer py-2.5 text-[#9FB0C3] hover:text-[#F4F7FA] focus:text-[#F4F7FA] focus:bg-white/5"><User className="w-4 h-4 mr-2" /> Settings</DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/pricing')} className="cursor-pointer py-2.5 text-[#9FB0C3] hover:text-[#F4F7FA] focus:text-[#F4F7FA] focus:bg-white/5"><Zap className="w-4 h-4 mr-2" /> Upgrade Plan</DropdownMenuItem>
              {(user?.role === 'admin' || user?.role === 'superadmin' || user?.email === 'andre@thestrategysquad.com.au') && (
                <>
                  <DropdownMenuItem onClick={() => navigate('/admin')} className="cursor-pointer py-2.5 text-[#9FB0C3] hover:text-[#F4F7FA] focus:text-[#F4F7FA] focus:bg-white/5"><Shield className="w-4 h-4 mr-2" /> Super Admin</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/calibration')} className="cursor-pointer py-2.5 text-[#9FB0C3] hover:text-[#F4F7FA] focus:text-[#F4F7FA] focus:bg-white/5"><Settings className="w-4 h-4 mr-2" /> Recalibrate</DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator style={{ background: '#243140' }} />
              <DropdownMenuItem onClick={() => { logout(); navigate('/'); }} className="cursor-pointer py-2.5 text-[#EF4444] focus:text-[#EF4444] focus:bg-red-500/5"><LogOut className="w-4 h-4 mr-2" /> Sign Out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* ═══ SIDEBAR ═══ */}
      <aside className={`fixed left-0 transition-all duration-300 ${sidebarWidth} ${isNavOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 top-14 h-[calc(100vh-3.5rem)]`}
        style={{ zIndex: 999, background: 'var(--biqc-sidebar-bg, #0A1018)', borderRight: '1px solid var(--biqc-border, #243140)' }}
        role="navigation" aria-label="Main navigation">

        <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="hidden lg:flex absolute -right-3 top-6 w-6 h-6 rounded-full items-center justify-center hover:bg-white/10 transition-colors"
          style={{ background: 'var(--biqc-bg-card, #141C26)', border: '1px solid var(--biqc-border, #243140)' }}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          {sidebarCollapsed ? <ChevronRight className="w-4 h-4" style={{ color: 'var(--biqc-text-muted)' }} /> : <ChevronRight className="w-4 h-4 rotate-180" style={{ color: 'var(--biqc-text-muted)' }} />}
        </button>

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
          className="p-3 space-y-1 overflow-y-auto flex flex-col" style={{ height: '100%' }} aria-label="Platform navigation">
          {visibleSections.map((section) => {
            const isExpanded = expandedSections.has(section.id);
            const hasActiveChild = section.items.some(i => isActive(i.path) || i.children?.some((child) => isActive(child.path)));

            return (
              <div key={section.id} className="mb-1">
                <button onClick={() => toggleSection(section.id)}
                  className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3 justify-between'} w-full ${sidebarCollapsed ? 'px-2' : 'px-3'} py-2.5 rounded-lg text-xs font-semibold uppercase tracking-[0.1em] transition-all`}
                  style={{ color: hasActiveChild ? '#FF6A00' : 'var(--biqc-text-muted, #8B9DB5)', fontFamily: fontFamily.mono, minHeight: '40px' }}
                  title={sidebarCollapsed ? section.label : undefined}
                  aria-expanded={isExpanded}
                  aria-controls={`nav-section-items-${section.id}`}
                  data-testid={`nav-section-${section.id}`}>
                  {!sidebarCollapsed && <span>{section.label}</span>}
                  {!sidebarCollapsed && <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} style={{ color: 'var(--biqc-text-muted)' }} />}
                </button>

                {isExpanded && !sidebarCollapsed && (
                  <div id={`nav-section-items-${section.id}`} className="space-y-0.5 mb-2">
                    {section.items.map((item) => {
                      const active = isActive(item.path);
                      const showBadge = item.showBadge && notifications.total > 0;
                      const hasChildren = item.children?.length > 0;
                      const childActive = hasChildren && item.children.some(c => isActive(c.path));
                      const parentExpanded = expandedParents.has(item.path);
                      const userTier = user?.subscription_tier || 'free';
                      const locked = !canAccess(userTier, item.path, user?.email || '');

                      const handleNavClick = () => {
                        if (locked) { navigate('/upgrade'); return; }
                        navigate(item.path);
                        if (!hasChildren) closeAll();
                      };

                      return (
                        <div key={item.path}>
                          <div className="flex items-center gap-0.5">
                            <button
                              onClick={handleNavClick}
                              className="flex items-center gap-2.5 flex-1 px-3 py-2.5 min-h-[44px] rounded-lg text-sm transition-all"
                              aria-current={active ? 'page' : undefined}
                              style={{
                                fontFamily: fontFamily.body,
                                color: locked ? '#4A5568' : active || childActive ? 'var(--biqc-text, #F4F7FA)' : 'var(--biqc-text-2, #9FB0C3)',
                                background: active ? '#FF6A00' + '15' : childActive ? '#FF6A0008' : 'transparent',
                                borderLeft: active ? '2px solid #FF6A00' : childActive ? '2px solid rgba(255,106,0,0.3)' : '2px solid transparent',
                                cursor: locked ? 'pointer' : 'pointer',
                              }}
                              data-testid={`nav-item-${item.path.replace('/', '')}`}
                              title={locked ? `Requires ${TIERS[requiredTier(item.path)]?.label} plan` : item.label}>
                              <item.icon className="w-4 h-4 shrink-0" style={{ color: locked ? '#4A5568' : active || childActive ? '#FF6A00' : '#64748B' }} />
                              <span className="flex-1 text-left">{item.label}</span>
                              {locked && <Lock className="w-3 h-3 shrink-0" style={{ color: '#4A5568' }} />}
                              {showBadge && !locked && <span className="w-5 h-5 flex items-center justify-center text-xs font-bold text-white rounded-full bg-[#EF4444]">{notifications.total > 9 ? '9+' : notifications.total}</span>}
                            </button>
                            {hasChildren && !locked && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedParents(prev => {
                                    const next = new Set(prev);
                                    if (next.has(item.path)) next.delete(item.path);
                                    else next.add(item.path);
                                    return next;
                                  });
                                }}
                                className="p-1.5 rounded-lg hover:bg-white/5 transition-colors shrink-0"
                                style={{ color: childActive ? '#FF6A00' : '#64748B' }}>
                                <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-200 ${parentExpanded ? 'rotate-90' : ''}`} />
                              </button>
                            )}
                          </div>

                          {hasChildren && parentExpanded && !locked && (
                            <div className="ml-3 mt-0.5 mb-1 pl-3 space-y-0.5"
                              style={{ borderLeft: '1px solid rgba(255,106,0,0.2)' }}>
                              {item.children.map((child) => {
                                const childIsActive = isActive(child.path);
                                const childLocked = !canAccess(userTier, child.path, user?.email || '');
                                return (
                                  <button key={child.path}
                                    onClick={() => {
                                      if (childLocked) { navigate('/upgrade'); return; }
                                      navigate(child.path); closeAll();
                                    }}
                                    className="flex items-center gap-2 w-full px-2.5 py-2 min-h-[36px] rounded-lg text-sm transition-all"
                                    style={{
                                      fontFamily: fontFamily.body,
                                      fontSize: '0.8125rem',
                                      color: childLocked ? '#4A5568' : childIsActive ? '#F4F7FA' : '#9FB0C3',
                                      background: childIsActive ? '#FF6A0015' : 'transparent',
                                      borderLeft: childIsActive ? '2px solid #FF6A00' : '2px solid transparent',
                                    }}
                                    title={childLocked ? `Requires ${TIERS[requiredTier(child.path)]?.label} plan` : child.label}>
                                    <child.icon className="w-3.5 h-3.5 shrink-0" style={{ color: childLocked ? '#4A5568' : childIsActive ? '#FF6A00' : '#4A5568' }} />
                                    <span className="flex-1 text-left">{child.label}</span>
                                    {childLocked && <Lock className="w-3 h-3 shrink-0" style={{ color: '#4A5568' }} />}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* BIQc Legal — collapsible section at bottom */}
          {!sidebarCollapsed && (
            <div className="mt-auto pt-2 pb-2" style={{ borderTop: '1px solid var(--biqc-border, #243140)' }}>
              <button
                onClick={() => toggleSection('legal')}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors hover:bg-white/5 group"
                style={{ color: 'var(--biqc-text-muted, #8B9DB5)' }}
                aria-expanded={expandedSections.has('legal')}
              >
                <div className="flex items-center gap-2">
                  <Scale className="w-3.5 h-3.5" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ fontFamily: fontFamily.mono }}>BIQc Legal</span>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expandedSections.has('legal') ? 'rotate-180' : ''}`} />
              </button>
              {expandedSections.has('legal') && (
                <div className="mt-1 space-y-0.5">
                  {[
                    { label: 'BIQc AI Learning Guarantee', path: '/trust/ai-learning-guarantee', icon: Zap },
                    { label: 'Security & Infrastructure', path: '/trust/security', icon: Shield },
                    { label: 'Trust Centre', path: '/trust/centre', icon: Gavel },
                    { label: 'Data Processing Agreement', path: '/trust/dpa', icon: FileText },
                    { label: 'Privacy Policy', path: '/trust/privacy', icon: FileText },
                    { label: 'Terms & Conditions', path: '/terms', icon: Scale },
                  ].map(({ label, path, icon: Icon }) => (
                    <button key={path} onClick={() => navigate(path)}
                      className="flex items-center gap-2 text-left text-[11px] px-3 py-1.5 rounded-lg w-full transition-colors hover:bg-white/5 hover:text-[#9FB0C3]"
                      style={{ color: '#64748B', fontFamily: fontFamily.body }}>
                      <Icon className="w-3 h-3 shrink-0" />
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </nav>
      </aside>

      {/* Daily Brief Banner — shows once per day on login */}
      <DailyBriefBanner onOpen={() => navigate('/soundboard')} />

      {/* Mobile Overlay */}
      {isNavOpen && <div className="fixed inset-0 bg-black/50 lg:hidden" onClick={closeAll} aria-hidden="true" style={{ zIndex: 998 }} />}

      {/* ═══ MAIN CONTENT + DESKTOP SOUNDBOARD PANEL ═══ */}
      <div className={`${sidebarMargin} pt-14 pb-[76px] lg:pb-0 transition-all duration-300 flex`} style={{ minHeight: '100dvh' }}>
        <main className="flex-1" style={{ background: 'var(--biqc-bg, #0F1720)', overflowY: 'visible' }}>
          <div className="px-4 py-4 md:px-6 md:py-6">
            <div className="mb-4 flex items-center justify-between gap-3" data-testid="page-navigation-row">
              <button
                onClick={() => navigate(-1)}
                className="inline-flex min-h-[38px] items-center gap-2 rounded-xl border px-3 py-1.5 text-xs transition-colors hover:bg-white/5"
                style={{ borderColor: 'var(--biqc-border)', color: 'var(--biqc-text)', fontFamily: fontFamily.mono }}
                data-testid="page-back-button"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
              <p className="text-xs text-[#94A3B8]" style={{ fontFamily: fontFamily.mono }} data-testid="page-current-label">
                {currentPageLabel}
              </p>
            </div>
            {children}
          </div>
        </main>

        {/* Desktop Soundboard Panel — always visible on lg+ */}
        <aside className="hidden lg:flex w-[380px] shrink-0 flex-col" style={{ background: 'var(--biqc-bg-input, #0A1018)', borderLeft: '1px solid var(--biqc-border, #243140)', height: 'calc(100dvh - 56px)', position: 'sticky', top: '56px' }}>
          <SoundboardPanel actionMessage={actionMessage} onActionConsumed={onActionConsumed} />
        </aside>
      </div>

      {/* Mobile Soundboard FAB + Overlay */}
      <div className="lg:hidden">
        {!sbOpen ? (
          <button onClick={() => setSbOpen(true)}
            className="fixed bottom-20 right-4 z-50 w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-105 active:scale-95"
            style={{ background: 'linear-gradient(135deg, #FF6A00, #FF6A00)', boxShadow: '0 8px 32px rgba(255,106,0,0.4)' }}
            data-testid="soundboard-fab">
            <MessageSquare className="w-5 h-5 text-white" />
          </button>
        ) : (
          <>
            <div className="fixed inset-0 bg-black/60 z-[1200]" onClick={() => setSbOpen(false)} />
            <div className="fixed inset-0 z-[1201] flex flex-col" style={{ background: 'var(--biqc-bg-input, #0A1018)' }}>
              <div className="flex items-center justify-between px-4 py-2" style={{ borderBottom: '1px solid var(--biqc-border)' }}>
                <span className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>SoundBoard</span>
                <button onClick={() => setSbOpen(false)} className="p-2 rounded-lg hover:bg-white/5"><X className="w-5 h-5 text-[#64748B]" /></button>
              </div>
              <div className="flex-1 overflow-hidden">
                <SoundboardPanel actionMessage={actionMessage} onActionConsumed={onActionConsumed} />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileNav />

      {/* First Login Notification */}
      <FirstLoginNotification />

      {/* Tutorial */}
      <PageTutorial pageKey={location.pathname} />
    </div>
  );
};

export default DashboardLayout;
