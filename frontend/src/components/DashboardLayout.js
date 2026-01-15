import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
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
  Lightbulb, AlertCircle
} from 'lucide-react';

const DashboardLayout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user: mongoUser, logout: mongoLogout, isAdmin } = useAuth();
  const { user: supabaseUser, signOut: supabaseSignOut } = useSupabaseAuth();
  
  // Prefer Supabase user if available
  const user = supabaseUser || mongoUser;
  const logout = async () => {
    try {
      if (supabaseUser) {
        await supabaseSignOut();
      } else if (mongoUser) {
        await mongoLogout();
      }
      // Redirect to landing page after logout
      window.location.href = '/';
    } catch (error) {
      console.error('Logout error:', error);
      // Force redirect even if logout fails
      window.location.href = '/';
    }
  };
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState({ total: 0, high: 0 });
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationsList, setNotificationsList] = useState([]);
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });

  useEffect(() => {
    const theme = darkMode ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [darkMode]);

  useEffect(() => {
    fetchNotifications();
    // Refresh notifications every 5 minutes
    const interval = setInterval(fetchNotifications, 300000);
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    try {
      const response = await apiClient.get('/notifications/alerts');
      setNotifications(response.data.summary || { total: 0, high: 0 });
      setNotificationsList(response.data.notifications || []);
    } catch (error) {
      console.error('Failed to fetch notifications');
    }
  };

  const navItems = [
    { type: 'divider', label: 'Advisory Team' },
    { icon: Target, label: 'MyIntel', path: '/intel-centre', showBadge: true },
    { icon: MessageSquare, label: 'MyAdvisor', path: '/advisor', showBadge: true },
    { icon: Lightbulb, label: 'MySoundBoard', path: '/soundboard' },
    { type: 'divider', label: 'Agent IQ Builder' },
    { icon: Building2, label: 'Business Profile Builder', path: '/business-profile' },
    { icon: Plug, label: 'Integrations', path: '/integrations' },
    { icon: Database, label: 'Data Centre', path: '/data-center' },
    { icon: FileText, label: 'Documents & SOP', path: '/documents' },
    { type: 'divider', label: '' },
    { icon: Inbox, label: 'Priority Inbox', path: '/email-inbox' },
    { icon: Calendar, label: 'Calendar', path: '/calendar' },
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
      {/* Top Navigation Bar */}
      <header 
        className="fixed top-0 left-0 right-0 z-50 h-16 px-4 lg:px-6 flex items-center justify-between"
        style={{ 
          background: 'var(--bg-primary)', 
          borderBottom: '1px solid var(--border-light)'
        }}
      >
        {/* Left: Logo & Mobile Menu */}
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
            style={{ color: 'var(--text-secondary)' }}
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          
          <div className="flex items-center gap-3">
            <div 
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--accent-primary)' }}
            >
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span 
              className="font-semibold text-lg hidden sm:block"
              style={{ color: 'var(--text-primary)' }}
            >
              Strategy Squad
            </span>
          </div>
        </div>

        {/* Center: Search */}
        <div className="hidden md:flex flex-1 max-w-md mx-8">
          <div className="relative w-full">
            <Search 
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
              style={{ color: 'var(--text-muted)' }}
            />
            <input
              type="text"
              placeholder="Search anything..."
              className="input-premium pl-10 py-2.5"
              style={{ background: 'var(--bg-tertiary)', border: 'none' }}
            />
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2.5 rounded-lg transition-colors"
            style={{ 
              color: 'var(--text-secondary)',
              background: darkMode ? 'var(--bg-tertiary)' : 'transparent'
            }}
            title={darkMode ? 'Light Mode' : 'Dark Mode'}
          >
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          
          {/* Notifications Bell */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2.5 rounded-lg transition-colors hidden sm:flex relative"
              style={{ color: 'var(--text-secondary)' }}
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
                      We'll alert you when something needs attention
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
            className="p-2.5 rounded-lg transition-colors hidden sm:flex"
            style={{ color: 'var(--text-secondary)' }}
          >
            <HelpCircle className="w-5 h-5" />
          </button>

          <div className="w-px h-6 mx-2 hidden sm:block" style={{ background: 'var(--border-light)' }} />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button 
                className="flex items-center gap-3 p-1.5 pr-3 rounded-xl transition-colors"
                style={{ background: 'var(--bg-tertiary)' }}
              >
                <div className="avatar">
                  {user?.name?.charAt(0).toUpperCase()}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {user?.name?.split(' ')[0]}
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
              {isAdmin() && (
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

      {/* Sidebar */}
      <aside 
        className={`fixed top-16 left-0 h-[calc(100vh-64px)] w-64 sidebar z-40 transform transition-transform duration-200 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ background: 'var(--bg-primary)' }}
      >
        <nav className="p-4 space-y-1 overflow-y-auto h-full">
          {navItems.map((item, index) => {
            if (item.type === 'divider') {
              return (
                <div key={index} className="pt-6 pb-2">
                  <span 
                    className="px-3 text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--text-muted)' }}
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
                className={`sidebar-item w-full ${isActive(item.path) ? 'active' : ''}`}
              >
                <item.icon className="w-5 h-5" />
                <span className="flex-1 text-left">{item.label}</span>
                {showNotificationBadge && (
                  <span 
                    className="w-5 h-5 flex items-center justify-center text-xs font-bold text-white rounded-full"
                    style={{ background: notifications.high > 0 ? '#EF4444' : '#F59E0B' }}
                  >
                    {notifications.total > 9 ? '•' : notifications.total}
                  </span>
                )}
                {item.isNew && !showNotificationBadge && (
                  <span className="badge-new">New</span>
                )}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/30 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main 
        className="lg:ml-64 pt-16 min-h-screen"
        style={{ background: 'var(--bg-secondary)' }}
      >
        <div className="p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
