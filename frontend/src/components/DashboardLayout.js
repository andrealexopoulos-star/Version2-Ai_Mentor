import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSupabaseAuth, AUTH_STATE } from '../context/SupabaseAuthContext';
import { useMobileDrawer } from '../context/MobileDrawerContext';
import { apiClient } from '../lib/api';
import { useTutorial, HelpButton, TutorialModal } from './TutorialOverlay';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  MessageSquare, Settings, LogOut, Menu, X, ChevronDown, Shield, User, Stethoscope, Building2,
  Plug, Zap, Bell, Calendar, Lightbulb, AlertCircle, Mail, ChevronRight, Terminal,
  Crosshair, BarChart3, Activity, FileText, Inbox, Database, TrendingUp, Radar, HelpCircle
} from 'lucide-react';

const DISPLAY = "'Cormorant Garamond', Georgia, serif";
const BODY = "'Inter', sans-serif";
const MONO = "'JetBrains Mono', monospace";

const DashboardLayout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut, authState } = useSupabaseAuth();
  const { isNavOpen, openNav, closeAll } = useMobileDrawer();
  const isCalibrated = authState === AUTH_STATE.READY;
  const { showTutorial, closeTutorial, openTutorial, tutorial } = useTutorial(location.pathname);

  const logout = async () => {
    try {
      await signOut();
      localStorage.clear();
      sessionStorage.clear();
      setTimeout(() => { window.location.href = '/'; }, 100);
    } catch (error) {
      localStorage.clear();
      sessionStorage.clear();
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

  // Force dark mode for Liquid Steel
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('theme', 'dark');
  }, []);

  // Notifications polling
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 300000);
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    try {
      const response = await apiClient.get('/notifications/alerts');
      setNotifications(response.data.summary || { total: 0, high: 0 });
      setNotificationsList(response.data.notifications || []);
    } catch {}
  };

  const [expandedSection, setExpandedSection] = useState(null);

  const navSections = [
    { id: 'intelligence', label: 'Intelligence', items: [
      { icon: MessageSquare, label: 'BIQc Insights', path: '/advisor', showBadge: true },
      { icon: Terminal, label: 'Strategic Console', path: '/war-room', requiresCalibration: true },
      { icon: Crosshair, label: 'Board Room', path: '/board-room', requiresCalibration: true },
      { icon: Activity, label: 'Operator View', path: '/operator', requiresCalibration: true },
      { icon: Lightbulb, label: 'SoundBoard', path: '/soundboard' },
    ]},
    { id: 'analysis', label: 'Analysis', items: [
      { icon: Stethoscope, label: 'Diagnosis', path: '/diagnosis', requiresCalibration: true },
      { icon: TrendingUp, label: 'Analysis', path: '/analysis' },
      { icon: Radar, label: 'Market Analysis', path: '/market-analysis' },
      { icon: BarChart3, label: 'Intel Centre', path: '/intel-centre' },
    ]},
    { id: 'tools', label: 'Tools', items: [
      { icon: Shield, label: 'SOP Generator', path: '/sop-generator' },
      { icon: Database, label: 'Data Center', path: '/data-center' },
      { icon: FileText, label: 'Documents', path: '/documents' },
    ]},
    { id: 'configuration', label: 'Configuration', items: [
      { icon: BarChart3, label: 'Intelligence Baseline', path: '/intelligence-baseline' },
      { icon: Plug, label: 'Integrations', path: '/integrations' },
      { icon: Mail, label: 'Email', path: '/connect-email' },
      { icon: Inbox, label: 'Email Inbox', path: '/email-inbox' },
      { icon: Calendar, label: 'Calendar', path: '/calendar' },
    ]},
    { id: 'settings', label: 'Settings', items: [
      { icon: Settings, label: 'Account', path: '/settings' },
      { icon: Building2, label: 'Business DNA', path: '/business-profile' },
    ]},
  ];

  useEffect(() => {
    if (!expandedSection) {
      const active = navSections.find(s => s.items.some(i => isActive(i.path)));
      if (active) setExpandedSection(active.id);
    }
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const visibleSections = useMemo(() => {
    return navSections.map(section => ({
      ...section,
      items: section.items.filter(item => !item.requiresCalibration || isCalibrated),
    }));
  }, [isCalibrated]); // eslint-disable-line react-hooks/exhaustive-deps

  const isActive = (path) => location.pathname === path;
  const sidebarWidth = sidebarCollapsed ? 'w-16' : 'w-64';
  const sidebarMargin = sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64';

  return (
    <div className="min-h-screen" style={{ background: '#0F1720', color: '#F4F7FA' }}>
      {/* ═══ TOP BAR ═══ */}
      <header className="fixed top-0 left-0 right-0 h-14 px-4 lg:px-6 flex items-center justify-between" style={{ background: '#0A1018', borderBottom: '1px solid #243140', zIndex: 1000 }}>
        <div className="flex items-center gap-3">
          <button onClick={() => isNavOpen ? closeAll() : openNav()} className="lg:hidden p-1.5 rounded-lg hover:bg-white/5 transition-colors" style={{ color: '#9FB0C3' }} aria-label={isNavOpen ? 'Close menu' : 'Open menu'}>
            {isNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: '#FF6A00' }}>
              <span className="text-white font-bold text-xs" style={{ fontFamily: MONO }}>B</span>
            </div>
            <span className="font-semibold text-sm hidden sm:block text-[#F4F7FA]" style={{ fontFamily: DISPLAY }}>Strategy Squad</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {tutorial && <HelpButton onClick={openTutorial} />}

          {/* Notifications */}
          <div className="relative">
            <button onClick={() => setShowNotifications(!showNotifications)} className="p-2 rounded-lg hover:bg-white/5 transition-colors relative" style={{ color: '#9FB0C3' }} aria-label="Notifications">
              <Bell className="w-5 h-5" />
              {notifications.total > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-5 h-5 flex items-center justify-center text-xs font-bold text-white rounded-full" style={{ background: notifications.high > 0 ? '#EF4444' : '#F59E0B' }}>
                  {notifications.total > 9 ? '9+' : notifications.total}
                </span>
              )}
            </button>
            {showNotifications && (
              <div className="absolute right-0 top-12 w-80 max-h-96 overflow-y-auto rounded-xl shadow-xl z-50" style={{ background: '#141C26', border: '1px solid #243140' }}>
                <div className="p-3" style={{ borderBottom: '1px solid #243140' }}>
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm text-[#F4F7FA]" style={{ fontFamily: DISPLAY }}>Notifications</h3>
                    {notifications.high > 0 && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#EF444415', color: '#EF4444', fontFamily: MONO }}>{notifications.high} urgent</span>}
                  </div>
                </div>
                {notificationsList.length === 0 ? (
                  <div className="p-6 text-center">
                    <Bell className="w-8 h-8 mx-auto mb-2 text-[#64748B]" />
                    <p className="text-sm text-[#64748B]" style={{ fontFamily: BODY }}>No notifications</p>
                    <p className="text-xs mt-1 text-[#64748B]" style={{ fontFamily: BODY }}>We'll alert you when something needs attention</p>
                  </div>
                ) : (
                  <div>
                    {notificationsList.map((notif, idx) => (
                      <div key={idx} className="p-3 cursor-pointer hover:bg-white/5 transition-colors" style={{ borderBottom: '1px solid #243140', background: notif.severity === 'high' ? 'rgba(239,68,68,0.05)' : 'transparent' }}
                        onClick={() => { setShowNotifications(false); navigate(notif.type === 'email' || notif.type === 'complaint' ? '/email-inbox' : notif.type === 'meeting' ? '/calendar' : '/intel-centre'); }}>
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: notif.severity === 'high' ? '#EF444415' : '#F59E0B15' }}>
                            <AlertCircle className="w-4 h-4" style={{ color: notif.severity === 'high' ? '#EF4444' : '#F59E0B' }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[#F4F7FA]" style={{ fontFamily: BODY }}>{notif.title}</p>
                            <p className="text-xs mt-0.5 text-[#64748B] line-clamp-2" style={{ fontFamily: BODY }}>{notif.message}</p>
                            <p className="text-xs mt-1 text-[#FF6A00]" style={{ fontFamily: BODY }}>{notif.action}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <button className="p-2 rounded-lg hover:bg-white/5 hidden md:flex" style={{ color: '#9FB0C3' }} aria-label="Help"><HelpCircle className="w-5 h-5" /></button>

          <div className="w-px h-6 mx-1 hidden md:block" style={{ background: '#243140' }} />

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 p-1 pr-3 rounded-xl hover:bg-white/5 transition-colors" aria-label="User menu">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white" style={{ background: '#FF6A00', fontFamily: BODY }}>
                  {user?.full_name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <span className="hidden sm:block text-sm font-medium text-[#F4F7FA]" style={{ fontFamily: BODY }}>{user?.full_name?.split(' ')[0] || 'User'}</span>
                <ChevronDown className="w-3.5 h-3.5 hidden sm:block text-[#64748B]" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56" style={{ background: '#141C26', border: '1px solid #243140', borderRadius: '12px' }}>
              <div className="px-3 py-2.5">
                <p className="font-medium text-[#F4F7FA]" style={{ fontFamily: BODY }}>{user?.full_name}</p>
                <p className="text-sm text-[#64748B]" style={{ fontFamily: MONO }}>{user?.email}</p>
              </div>
              <DropdownMenuSeparator style={{ background: '#243140' }} />
              <DropdownMenuItem onClick={() => navigate('/settings')} className="cursor-pointer py-2.5 text-[#9FB0C3] hover:text-[#F4F7FA] focus:text-[#F4F7FA] focus:bg-white/5"><User className="w-4 h-4 mr-2" /> Settings</DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/pricing')} className="cursor-pointer py-2.5 text-[#9FB0C3] hover:text-[#F4F7FA] focus:text-[#F4F7FA] focus:bg-white/5"><Zap className="w-4 h-4 mr-2" /> Upgrade Plan</DropdownMenuItem>
              {(user?.role === 'admin' || user?.role === 'superadmin') && (
                <DropdownMenuItem onClick={() => navigate('/admin')} className="cursor-pointer py-2.5 text-[#9FB0C3] hover:text-[#F4F7FA] focus:text-[#F4F7FA] focus:bg-white/5"><Shield className="w-4 h-4 mr-2" /> Admin</DropdownMenuItem>
              )}
              <DropdownMenuSeparator style={{ background: '#243140' }} />
              <DropdownMenuItem onClick={() => { logout(); navigate('/'); }} className="cursor-pointer py-2.5 text-[#EF4444] focus:text-[#EF4444] focus:bg-red-500/5"><LogOut className="w-4 h-4 mr-2" /> Sign Out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* ═══ SIDEBAR ═══ */}
      <aside className={`fixed left-0 transition-all duration-300 ${sidebarWidth} ${isNavOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 top-14 h-[calc(100vh-3.5rem)]`}
        style={{ zIndex: 999, background: '#0A1018', borderRight: '1px solid #243140' }}>

        <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="hidden lg:flex absolute -right-3 top-6 w-6 h-6 rounded-full items-center justify-center hover:bg-white/10 transition-colors"
          style={{ background: '#141C26', border: '1px solid #243140' }}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          {sidebarCollapsed ? <ChevronRight className="w-4 h-4 text-[#64748B]" /> : <ChevronRight className="w-4 h-4 text-[#64748B] rotate-180" />}
        </button>

        <nav className="p-3 space-y-1 overflow-y-auto flex flex-col" style={{ height: '100%' }}>
          {visibleSections.map((section) => {
            const isExpanded = expandedSection === section.id;
            const hasActiveChild = section.items.some(i => isActive(i.path));

            return (
              <div key={section.id} className="mb-1">
                <button onClick={() => setExpandedSection(isExpanded ? null : section.id)}
                  className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3 justify-between'} w-full ${sidebarCollapsed ? 'px-2' : 'px-3'} py-2.5 rounded-lg text-xs font-semibold uppercase tracking-[0.1em] transition-all`}
                  style={{ color: hasActiveChild ? '#FF6A00' : '#64748B', fontFamily: MONO, minHeight: '40px' }}
                  title={sidebarCollapsed ? section.label : undefined}
                  data-testid={`nav-section-${section.id}`}>
                  {!sidebarCollapsed && <span>{section.label}</span>}
                  {!sidebarCollapsed && <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} style={{ color: '#64748B' }} />}
                </button>

                {isExpanded && !sidebarCollapsed && (
                  <div className="space-y-0.5 mb-2">
                    {section.items.map((item) => {
                      const active = isActive(item.path);
                      const showBadge = item.showBadge && notifications.total > 0;
                      return (
                        <button key={item.path} onClick={() => { navigate(item.path); closeAll(); }}
                          className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm transition-all"
                          style={{
                            fontFamily: BODY,
                            color: active ? '#F4F7FA' : '#9FB0C3',
                            background: active ? '#FF6A00' + '15' : 'transparent',
                            borderLeft: active ? '2px solid #FF6A00' : '2px solid transparent',
                          }}
                          data-testid={`nav-item-${item.path.replace('/', '')}`}>
                          <item.icon className="w-4 h-4" style={{ color: active ? '#FF6A00' : '#64748B' }} />
                          <span className="flex-1 text-left">{item.label}</span>
                          {showBadge && <span className="w-5 h-5 flex items-center justify-center text-xs font-bold text-white rounded-full bg-[#EF4444]">{notifications.total > 9 ? '9+' : notifications.total}</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* Legal footer */}
          {!sidebarCollapsed && (
            <div className="mt-auto pt-4 pb-2" style={{ borderTop: '1px solid #243140' }}>
              {[
                { label: 'Enterprise Terms', path: '/enterprise-terms' },
                { label: 'Terms & Conditions', path: '/terms' },
                { label: 'Trust & Security', path: '/trust' },
              ].map(({ label, path }) => (
                <button key={path} onClick={() => navigate(path)} className="text-left text-xs px-3 py-2 rounded-lg w-full transition-colors hover:bg-white/5" style={{ color: '#64748B', fontFamily: BODY }}>{label}</button>
              ))}
            </div>
          )}
        </nav>
      </aside>

      {/* Mobile Overlay */}
      {isNavOpen && <div className="fixed inset-0 bg-black/50 lg:hidden" onClick={closeAll} aria-hidden="true" style={{ zIndex: 998 }} />}

      {/* ═══ MAIN CONTENT ═══ */}
      <main className={`${sidebarMargin} pt-14 transition-all duration-300`} style={{ background: '#0F1720', minHeight: '100dvh' }}>
        <div className="px-4 py-4 md:px-6 md:py-6">{children}</div>
      </main>

      {/* Tutorial */}
      {showTutorial && tutorial && <TutorialModal tutorial={tutorial} onClose={closeTutorial} />}
    </div>
  );
};

export default DashboardLayout;
