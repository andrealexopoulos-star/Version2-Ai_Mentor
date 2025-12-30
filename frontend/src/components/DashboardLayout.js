import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/button';
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
  Plug, Zap, Crown, Sun, Moon, Sparkles
} from 'lucide-react';

const DashboardLayout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isAdmin } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(true);

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: MessageSquare, label: 'AI Advisor', path: '/advisor' },
    { icon: Building2, label: 'Business Profile', path: '/business-profile' },
    { icon: Database, label: 'Data Center', path: '/data-center' },
    { icon: Stethoscope, label: 'Business Diagnosis', path: '/diagnosis' },
    { icon: BarChart3, label: 'Business Analysis', path: '/analysis' },
    { icon: FileText, label: 'SOP Generator', path: '/sop-generator' },
    { icon: Target, label: 'Market Analysis', path: '/market-analysis' },
    { icon: FolderOpen, label: 'My Documents', path: '/documents' },
    { type: 'divider' },
    { icon: Plug, label: 'Integrations', path: '/integrations', badge: 'New' },
  ];

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

  const getPlanBadge = () => {
    const plan = user?.subscription_tier || 'free';
    if (plan === 'enterprise') return { label: 'Enterprise', class: 'badge-enterprise', icon: Crown };
    if (plan === 'professional') return { label: 'Pro', class: 'badge-pro', icon: Zap };
    return { label: 'Free', class: 'badge-free', icon: Sparkles };
  };

  const planBadge = getPlanBadge();

  return (
    <div className={`min-h-screen ${darkMode ? '' : '[data-theme="light"]'}`} style={{ background: 'var(--bg-primary)' }}>
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 glass px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            data-testid="mobile-menu-toggle"
          >
            {sidebarOpen ? <X className="w-5 h-5 text-white" /> : <Menu className="w-5 h-5 text-white" />}
          </button>
          <span className="font-heading font-semibold text-lg text-white">Strategy Squad</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`badge-modern ${planBadge.class}`}>
            <planBadge.icon className="w-3 h-3" />
            {planBadge.label}
          </span>
        </div>
      </div>

      {/* Sidebar */}
      <aside 
        className={`fixed top-0 left-0 h-full w-72 sidebar-modern z-40 transform transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ background: 'var(--bg-secondary)' }}
      >
        {/* Logo */}
        <div className="p-6 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: 'var(--gradient-primary)' }}>
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="font-heading font-bold text-lg" style={{ color: 'var(--text-primary)' }}>Strategy Squad</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>AI Business Mentor</p>
            </div>
          </div>
        </div>

        {/* Plan Badge */}
        <div className="px-4 py-3">
          <button 
            onClick={() => navigate('/pricing')}
            className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
              planBadge.label === 'Free' ? 'hover:opacity-90' : ''
            }`}
            style={{ 
              background: planBadge.label === 'Free' 
                ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)' 
                : 'var(--bg-tertiary)',
              border: '1px solid var(--border-subtle)'
            }}
          >
            <div className="flex items-center gap-2">
              <planBadge.icon className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
              <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                {planBadge.label} Plan
              </span>
            </div>
            {planBadge.label === 'Free' && (
              <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ background: 'var(--gradient-primary)', color: 'white' }}>
                Upgrade
              </span>
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="px-4 py-2 space-y-1 flex-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
          {navItems.map((item, index) => {
            if (item.type === 'divider') {
              return <div key={index} className="my-4 border-t" style={{ borderColor: 'var(--border-subtle)' }} />;
            }
            
            return (
              <button
                key={item.path}
                onClick={() => {
                  navigate(item.path);
                  setSidebarOpen(false);
                }}
                className={`sidebar-item w-full ${isActive(item.path) ? 'active' : ''}`}
                data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
              >
                <item.icon className="w-5 h-5" />
                <span className="flex-1 text-left">{item.label}</span>
                {item.badge && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: 'var(--accent-success)', color: 'white' }}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Theme Toggle */}
        <div className="px-4 py-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <button 
            onClick={() => setDarkMode(!darkMode)}
            className="w-full flex items-center justify-between p-3 rounded-xl transition-all"
            style={{ background: 'var(--bg-tertiary)' }}
          >
            <div className="flex items-center gap-2">
              {darkMode ? <Moon className="w-4 h-4" style={{ color: 'var(--text-muted)' }} /> : <Sun className="w-4 h-4" style={{ color: 'var(--accent-warning)' }} />}
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {darkMode ? 'Dark Mode' : 'Light Mode'}
              </span>
            </div>
            <div className={`w-10 h-6 rounded-full relative transition-colors ${darkMode ? 'bg-indigo-500' : 'bg-gray-300'}`}>
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${darkMode ? 'left-5' : 'left-1'}`} />
            </div>
          </button>
        </div>

        {/* User Section */}
        <div className="p-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button 
                className="w-full flex items-center gap-3 p-3 rounded-xl transition-all hover:opacity-90"
                style={{ background: 'var(--bg-tertiary)' }}
                data-testid="user-menu-trigger"
              >
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center font-semibold text-white"
                  style={{ background: 'var(--gradient-primary)' }}
                >
                  {user?.name?.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{user?.name}</p>
                  <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                    {user?.role || 'Owner'}
                  </p>
                </div>
                <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="w-56" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
              <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{user?.name}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{user?.email}</p>
              </div>
              <DropdownMenuItem onClick={() => navigate('/settings')} className="cursor-pointer" data-testid="settings-menu-item">
                <User className="w-4 h-4 mr-2" /> Profile & Settings
              </DropdownMenuItem>
              {isAdmin() && (
                <DropdownMenuItem onClick={() => navigate('/admin')} className="cursor-pointer" data-testid="admin-menu-item">
                  <Shield className="w-4 h-4 mr-2" /> Admin Panel
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator style={{ background: 'var(--border-subtle)' }} />
              <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-400" data-testid="logout-menu-item">
                <LogOut className="w-4 h-4 mr-2" /> Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="lg:ml-72 min-h-screen pt-16 lg:pt-0" style={{ background: 'var(--bg-primary)' }}>
        {children}
      </main>
    </div>
  );
};

export default DashboardLayout;
