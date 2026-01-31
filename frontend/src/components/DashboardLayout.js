import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
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
  LayoutDashboard, MessageSquare, BarChart3, FileText, 
  Target, FolderOpen, Settings, LogOut, Menu, X,
  ChevronDown, Shield, User, Stethoscope, Database, Building2,
  Plug, Zap, Sun, Moon, Bell, Search, HelpCircle, Inbox, Calendar,
  Lightbulb, AlertCircle, Mail, ChevronLeft, ChevronRight
} from 'lucide-react';

const DashboardLayout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useSupabaseAuth();
  
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

  const handleCompleteOnboarding = () => {
    setShowDegradedBanner(false);
    localStorage.setItem('onboarding-completed', 'true');
  };

  const handleDismissBanner = () => {
    setShowDegradedBanner(false);
    localStorage.setItem('banner-dismissed', 'true');
  };

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem('sidebar-collapsed') === 'true';
  });
  const [notifications, setNotifications] = useState({ total: 0, high: 0 });
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationsList, setNotificationsList] = useState([]);
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });
  const [showDegradedBanner, setShowDegradedBanner] = useState(false);

  // Persist sidebar collapsed state
  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', sidebarCollapsed);
  }, [sidebarCollapsed]);

  // Mobile: Lock scroll when sidebar open
  useEffect(() => {
    if (sidebarOpen) {
      document.body.classList.add('sidebar-open');
    } else {
      document.body.classList.remove('sidebar-open');
    }
    
    // Cleanup on unmount
    return () => {
      document.body.classList.remove('sidebar-open');
    };
  }, [sidebarOpen]);

  // Mobile: Close sidebar on Escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && sidebarOpen) {
        setSidebarOpen(false);
      }
    };
    
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [sidebarOpen]);

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
    { type: 'divider', label: 'BUSINESS INTELLIGENCE QUOTIENT CENTRE' },
    { icon: MessageSquare, label: 'BIQc Insights', path: '/advisor', showBadge: true },
    { icon: Lightbulb, label: 'SoundBoard', path: '/soundboard' },
    { icon: Stethoscope, label: 'Diagnosis', path: '/diagnosis', showBadge: true },
    { type: 'divider', label: 'IQ BUILDER' },
    { icon: User, label: 'User Profile', path: '/settings' },
    { icon: Building2, label: 'Business Profile', path: '/business-profile' },
    { icon: Plug, label: 'Integrations', path: '/integrations' },
    { icon: Mail, label: 'Email', path: '/connect-email' },
    { icon: Calendar, label: 'Calendar', path: '/calendar' },
    { type: 'divider', label: 'SETTINGS' },
    { icon: Settings, label: 'Settings', path: '/settings' },
  ];

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <div 
      className="min-h-screen"
      style={{ background: 'var(--bg-secondary)' }}
    >
      {/* Top Navigation Bar - Fixed at top */}
      <header 
        className="fixed top-0 left-0 right-0 h-14 sm:h-16 px-3 sm:px-4 lg:px-6 flex items-center justify-between gap-2 sm:gap-4"
        style={{ 
          background: 'var(--bg-primary)', 
          borderBottom: '1px solid var(--border-light)',
          zIndex: 1000
        }}
      >
        {/* Left: Mobile Menu + Logo */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors touch-manipulation"
            style={{ color: 'var(--text-secondary)' }}
            aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
          >
            {sidebarOpen ? <X className="w-5 h-5 sm:w-6 sm:h-6" /> : <Menu className="w-5 h-5 sm:w-6 sm:h-6" />}
          </button>
          
          <div className="flex items-center gap-2 sm:gap-3">
            <div 
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--accent-primary)' }}
            >
              <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <span 
              className="font-semibold text-base sm:text-lg hidden sm:block"
              style={{ color: 'var(--text-primary)' }}
            >
              Strategy Squad
            </span>
          </div>
        </div>

        {/* Center: Search (Desktop Only) */}
        <div className="hidden md:flex flex-1 max-w-md mx-4 lg:mx-8">
          <div className="relative w-full">
            <Search 
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
              style={{ color: 'var(--text-muted)' }}
            />
            <input
              type="text"
              placeholder="Search anything..."
              className="input-premium pl-10 py-2.5 w-full"
              style={{ background: 'var(--bg-tertiary)', border: 'none' }}
            />
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
                className="flex items-center gap-2 sm:gap-3 p-1.5 sm:pr-3 rounded-xl transition-colors touch-manipulation"
                style={{ background: 'var(--bg-tertiary)' }}
                aria-label="User menu"
              >
                <div className="avatar w-8 h-8 sm:w-9 sm:h-9 text-sm sm:text-base">
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {user?.name?.split(' ')[0] || 'User'}
                  </p>
                </div>
                <ChevronDown className="w-4 h-4 hidden sm:block" style={{ color: 'var(--text-muted)' }} />
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
                <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{user?.name}</p>
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
              {user?.role === 'admin' && (
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

      {/* Degraded Intelligence Banner - Below header */}
      {showDegradedBanner && (
        <div className="fixed left-0 right-0 top-14 sm:top-16 z-50">
          <DegradedIntelligenceBanner
            onComplete={handleCompleteOnboarding}
            onDismiss={handleDismissBanner}
          />
        </div>
      )}

      {/* Sidebar */}
      <aside 
        className={`fixed left-0 w-64 sm:w-72 bg-white shadow-2xl transform transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } ${
          showDegradedBanner 
            ? 'top-[7.5rem] sm:top-32 h-[calc(100vh-7.5rem)] sm:h-[calc(100vh-8rem)]' 
            : 'top-14 sm:top-16 h-[calc(100vh-3.5rem)] sm:h-[calc(100vh-4rem)]'
        }`}
        style={{ zIndex: 999 }}
      >
        <nav className="p-3 sm:p-4 space-y-1 overflow-y-auto h-full bg-white">
          {navItems.map((item, index) => {
            if (item.type === 'divider') {
              return (
                <div key={index} className="pt-6 pb-2">
                  <span 
                    className="px-3 text-xs font-semibold uppercase tracking-wider text-gray-600"
                  >
                    {item.label}
                  </span>
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
                  setSidebarOpen(false);
                }}
                className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  isActive(item.path) 
                    ? 'bg-blue-600 text-white' 
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
                style={{ minHeight: '48px' }}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                <span className="flex-1 text-left">{item.label}</span>
                {showNotificationBadge && (
                  <span 
                    className="w-5 h-5 flex items-center justify-center text-xs font-bold text-white rounded-full bg-red-500"
                  >
                    {notifications.total > 9 ? '•' : notifications.total}
                  </span>
                )}
                {item.isNew && !showNotificationBadge && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-600">New</span>
                )}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Mobile Overlay - Backdrop - BELOW SIDEBAR */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
          style={{ zIndex: 998 }}  /* Below sidebar (999) but above content */
        />
      )}

      {/* Main Content */}
      <main 
        className={`lg:ml-64 ${
          showDegradedBanner 
            ? 'pt-[7.5rem] sm:pt-32' 
            : 'pt-14 sm:pt-16'
        }`}
        style={{ 
          background: 'var(--bg-secondary)',
          position: 'relative',
          zIndex: 1,
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        {children}
      </main>
    </div>
  );
};

export default DashboardLayout;
