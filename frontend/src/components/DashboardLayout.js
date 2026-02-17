import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSupabaseAuth, AUTH_STATE } from '../context/SupabaseAuthContext';
import { useMobileDrawer } from '../context/MobileDrawerContext';
import { Button } from './ui/button';
import { apiClient } from '../lib/api';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { 
  MessageSquare, Settings, LogOut, Menu, X,
  ChevronDown, Shield, User, Stethoscope, Building2,
  Plug, Zap, Sun, Moon, Bell, Search, HelpCircle, Calendar,
  Lightbulb, AlertCircle, Mail, ChevronLeft, ChevronRight, Terminal,
  Crosshair, BarChart3, Activity, FileText, Inbox, Database, TrendingUp, Radar
} from 'lucide-react';

const DashboardLayout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut, authState } = useSupabaseAuth();
  const { isNavOpen, openNav, closeAll } = useMobileDrawer();
  const isCalibrated = authState === AUTH_STATE.READY;
  
  const logout = async () => {
    try {
      console.log('Logout initiated...');
      
      // Sign out from Supabase
      await signOut();
      
      // Clear local storage
      localStorage.clear();
      sessionStorage.clear();
      
      console.log('Logout complete, redirecting to landing...');
      
      // Force redirect to landing page
      setTimeout(() => {
        window.location.href = '/';
      }, 100);
      
    } catch (error) {
      console.error('Logout error:', error);
      // Force redirect even if logout fails
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = '/';
    }
  };
  
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem('sidebar-collapsed') === 'true';
  });
  const [notifications, setNotifications] = useState({ total: 0, high: 0 });
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationsList, setNotificationsList] = useState([]);
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });

  // Persist sidebar collapsed state
  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', sidebarCollapsed);
  }, [sidebarCollapsed]);

  // Mobile: Lock scroll when nav drawer open
  useEffect(() => {
    if (isNavOpen) {
      document.body.classList.add('sidebar-open');
    } else {
      document.body.classList.remove('sidebar-open');
    }
    
    return () => {
      document.body.classList.remove('sidebar-open');
    };
  }, [isNavOpen]);

  // Mobile: Close nav on Escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isNavOpen) {
        closeAll();
      }
    };
    
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isNavOpen, closeAll]);

  useEffect(() => {
    const theme = darkMode ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [darkMode]);

  // FEATURE FLAG: Disable notifications polling for PoC demo
  const ENABLE_NOTIFICATIONS_POLLING = false;

  useEffect(() => {
    if (!ENABLE_NOTIFICATIONS_POLLING) return;
    
    fetchNotifications();
    // Refresh notifications every 5 minutes
    const interval = setInterval(fetchNotifications, 300000);
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    if (!ENABLE_NOTIFICATIONS_POLLING) return;
    
    try {
      const response = await apiClient.get('/notifications/alerts');
      setNotifications(response.data.summary || { total: 0, high: 0 });
      setNotificationsList(response.data.notifications || []);
    } catch {
      // Silently fail - notifications are non-critical for PoC
    }
  };

  const navItems = [
    { type: 'divider', label: 'INTELLIGENCE' },
    { icon: MessageSquare, label: 'BIQc Insights', path: '/advisor', showBadge: true },
    { icon: Terminal, label: 'Strategic Console', path: '/war-room' },
    { icon: Crosshair, label: 'Board Room', path: '/board-room' },
    { icon: Activity, label: 'Operator View', path: '/operator' },
    { icon: Lightbulb, label: 'SoundBoard', path: '/soundboard' },
    { type: 'divider', label: 'ANALYSIS' },
    { icon: Stethoscope, label: 'Diagnosis', path: '/diagnosis' },
    { icon: TrendingUp, label: 'Analysis', path: '/analysis' },
    { icon: Search, label: 'Market Analysis', path: '/market-analysis' },
    { icon: Radar, label: 'Intel Centre', path: '/intel-centre' },
    { type: 'divider', label: 'TOOLS' },
    { icon: Shield, label: 'SOP Generator', path: '/sop-generator' },
    { icon: Database, label: 'Data Center', path: '/data-center' },
    { icon: FileText, label: 'Documents', path: '/documents' },
    { type: 'divider', label: 'CONFIGURATION' },
    { icon: BarChart3, label: 'Intelligence Baseline', path: '/intelligence-baseline' },
    { icon: Building2, label: 'Business DNA', path: '/business-profile' },
    { icon: Plug, label: 'Integrations', path: '/integrations' },
    { icon: Mail, label: 'Email', path: '/connect-email' },
    { icon: Inbox, label: 'Email Inbox', path: '/email-inbox' },
    { icon: Calendar, label: 'Calendar', path: '/calendar' },
    { type: 'divider', label: 'SETTINGS' },
    { icon: Settings, label: 'Settings', path: '/settings' },
  ];

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isActive = (path) => location.pathname === path;

  // Calculate sidebar width
  const sidebarWidth = sidebarCollapsed ? 'w-16' : 'w-64';
  const sidebarMargin = sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64';

  return (
    <div 
      className="min-h-screen"
      style={{ background: 'var(--bg-secondary)' }}
    >
      {/* Top Navigation Bar - Fixed at top - MOBILE OPTIMIZED */}
      <header 
        className="fixed top-0 left-0 right-0 h-12 md:h-14 px-3 sm:px-4 lg:px-6 flex items-center justify-between gap-2 sm:gap-4"
        style={{ 
          background: 'var(--bg-primary)', 
          borderBottom: '1px solid var(--border-light)',
          zIndex: 1000
        }}
      >
        {/* Left: Mobile Menu + Logo */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button 
            onClick={() => isNavOpen ? closeAll() : openNav()}
            className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100 transition-colors touch-manipulation"
            style={{ color: 'var(--text-secondary)' }}
            aria-label={isNavOpen ? 'Close menu' : 'Open menu'}
          >
            {isNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          
          <div className="flex items-center gap-2">
            <div 
              className="w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--accent-primary)' }}
            >
              <Zap className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
            </div>
            <span 
              className="font-semibold text-sm md:text-base hidden sm:block"
              style={{ color: 'var(--text-primary)' }}
            >
              Strategy Squad
            </span>
          </div>
        </div>

        {/* Right: Actions - Compact on Mobile */}
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 sm:p-2.5 rounded-lg transition-colors touch-manipulation hidden sm:flex"
            style={{ 
              color: 'var(--text-secondary)',
              background: darkMode ? 'var(--bg-tertiary)' : 'transparent'
            }}
            title={darkMode ? 'Light Mode' : 'Dark Mode'}
            aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          
          {/* Notifications Bell */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 sm:p-2.5 rounded-lg transition-colors hidden sm:flex relative touch-manipulation"
              style={{ color: 'var(--text-secondary)' }}
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5" />
              {notifications.total > 0 && (
                <span 
                  className="absolute -top-0.5 -right-0.5 w-5 h-5 flex items-center justify-center text-xs font-bold text-white rounded-full"
                  style={{ background: notifications.high > 0 ? '#EF4444' : '#F59E0B' }}
                >
                  {notifications.total > 9 ? '9+' : notifications.total}
                </span>
              )}
            </button>
            
            {/* Notifications Dropdown */}
            {showNotifications && (
              <div 
                className="absolute right-0 top-12 w-80 max-h-96 overflow-y-auto rounded-xl shadow-xl z-50"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}
              >
                <div className="p-3 border-b" style={{ borderColor: 'var(--border-light)' }}>
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Notifications</h3>
                    {notifications.high > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600">
                        {notifications.high} urgent
                      </span>
                    )}
                  </div>
                </div>
                {notificationsList.length === 0 ? (
                  <div className="p-6 text-center">
                    <Bell className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No notifications</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                      We&apos;ll alert you when something needs attention
                    </p>
                  </div>
                ) : (
                  <div>
                    {notificationsList.map((notif, idx) => (
                      <div 
                        key={idx}
                        className="p-3 border-b cursor-pointer hover:bg-opacity-50 transition-colors"
                        style={{ 
                          borderColor: 'var(--border-light)',
                          background: notif.severity === 'high' ? 'rgba(239, 68, 68, 0.05)' : 'transparent'
                        }}
                        onClick={() => {
                          setShowNotifications(false);
                          if (notif.type === 'email' || notif.type === 'complaint') {
                            navigate('/email-inbox');
                          } else if (notif.type === 'meeting') {
                            navigate('/calendar');
                          } else {
                            navigate('/intel-centre');
                          }
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <div 
                            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ 
                              background: notif.severity === 'high' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)'
                            }}
                          >
                            <AlertCircle 
                              className="w-4 h-4" 
                              style={{ color: notif.severity === 'high' ? '#EF4444' : '#F59E0B' }} 
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                              {notif.title}
                            </p>
                            <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--text-muted)' }}>
                              {notif.message}
                            </p>
                            <p className="text-xs mt-1" style={{ color: 'var(--accent-primary)' }}>
                              {notif.action}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          
          <button
            className="p-2 sm:p-2.5 rounded-lg transition-colors hidden md:flex touch-manipulation"
            style={{ color: 'var(--text-secondary)' }}
            aria-label="Help"
          >
            <HelpCircle className="w-5 h-5" />
          </button>

          <div className="w-px h-6 mx-1 sm:mx-2 hidden md:block" style={{ background: 'var(--border-light)' }} />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button 
                className="flex items-center gap-2 p-1 pr-2 md:pr-3 rounded-xl transition-colors touch-manipulation"
                style={{ background: 'var(--bg-tertiary)' }}
                aria-label="User menu"
              >
                <div className="avatar w-7 h-7 md:w-8 md:h-8 text-xs md:text-sm">
                  {user?.full_name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-xs md:text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {user?.full_name?.split(' ')[0] || 'User'}
                  </p>
                </div>
                <ChevronDown className="w-3.5 h-3.5 md:w-4 md:h-4 hidden sm:block" style={{ color: 'var(--text-muted)' }} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent 
              align="end" 
              className="w-56"
              style={{ 
                background: 'var(--bg-card)', 
                border: '1px solid var(--border-light)',
                borderRadius: '12px'
              }}
            >
              <div className="px-3 py-2.5">
                <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{user?.full_name}</p>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{user?.email}</p>
              </div>
              <DropdownMenuSeparator style={{ background: 'var(--border-light)' }} />
              <DropdownMenuItem 
                onClick={() => navigate('/settings')} 
                className="cursor-pointer py-2.5"
              >
                <User className="w-4 h-4 mr-2" /> Settings
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => navigate('/pricing')} 
                className="cursor-pointer py-2.5"
              >
                <Zap className="w-4 h-4 mr-2" /> Upgrade Plan
              </DropdownMenuItem>
              {(user?.role === 'admin' || user?.role === 'superadmin') && (
                <DropdownMenuItem 
                  onClick={() => navigate('/admin')} 
                  className="cursor-pointer py-2.5"
                >
                  <Shield className="w-4 h-4 mr-2" /> Admin
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator style={{ background: 'var(--border-light)' }} />
              <DropdownMenuItem 
                onClick={handleLogout} 
                className="cursor-pointer py-2.5 text-red-500"
              >
                <LogOut className="w-4 h-4 mr-2" /> Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Sidebar - Desktop: collapsible, Mobile: overlay */}
      <aside 
        className={`fixed left-0 bg-white shadow-2xl transition-all duration-300 ${sidebarWidth} ${
          isNavOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 top-12 md:top-14 h-[calc(100vh-3rem)] md:h-[calc(100vh-3.5rem)]`}
        style={{ zIndex: 999 }}
      >
        {/* Desktop: Collapse Toggle */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="hidden lg:flex absolute -right-3 top-6 w-6 h-6 bg-white rounded-full shadow-md items-center justify-center hover:bg-gray-50 transition-colors"
          style={{ border: '1px solid var(--border-light)' }}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>

        <nav className="p-3 sm:p-4 space-y-1 overflow-y-auto h-full bg-white">
          {navItems.map((item, index) => {
            if (item.type === 'divider') {
              return (
                <div key={index} className="pt-6 pb-2">
                  {!sidebarCollapsed && (
                    <div 
                      className="px-3 text-xs font-semibold uppercase tracking-wider text-gray-600 text-center"
                    >
                      {item.label}
                    </div>
                  )}
                  {sidebarCollapsed && (
                    <div className="h-px bg-gray-200 mx-2" />
                  )}
                </div>
              );
            }
            
            // Check if this nav item should show notification badge
            const showNotificationBadge = item.showBadge && notifications.total > 0;
            
            return (
              <button
                key={item.path}
                onClick={() => {
                  navigate(item.path);
                  closeAll();
                }}
                className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'} w-full ${sidebarCollapsed ? 'px-2' : 'px-4'} py-3 rounded-lg text-sm font-medium transition-colors ${
                  isActive(item.path) 
                    ? 'bg-blue-600 text-white' 
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
                style={{ minHeight: '48px' }}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {!sidebarCollapsed && (
                  <>
                    <span className="flex-1 text-left">{item.label}</span>
                    {showNotificationBadge && (
                      <span 
                        className="w-5 h-5 flex items-center justify-center text-xs font-bold text-white rounded-full bg-red-500"
                      >
                        {notifications.total > 9 ? '•' : notifications.total}
                      </span>
                    )}
                  </>
                )}
                {sidebarCollapsed && showNotificationBadge && (
                  <span 
                    className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full"
                  />
                )}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Mobile Overlay - Backdrop - BELOW SIDEBAR */}
      {isNavOpen && (
        <div 
          className="fixed inset-0 bg-black/40 lg:hidden"
          onClick={closeAll}
          aria-hidden="true"
          style={{ zIndex: 998 }}
        />
      )}

      {/* Main Content */}
      <main 
        className={`${sidebarMargin} pt-12 md:pt-14 transition-all duration-300`}
        style={{ 
          background: 'var(--bg-secondary)',
          position: 'relative',
          zIndex: 1,
          minHeight: '100dvh'
        }}
      >
        <div className="px-4 py-4 md:px-6 md:py-6">
          {children}
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
