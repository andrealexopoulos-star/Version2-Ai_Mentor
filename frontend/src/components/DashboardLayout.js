import { useState, useEffect } from 'react';
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
  Plug, Zap, Sun, Moon, Bell, Search, HelpCircle
} from 'lucide-react';

const DashboardLayout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isAdmin } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });

  useEffect(() => {
    const theme = darkMode ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [darkMode]);

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: Building2, label: 'Business Profile Builder', path: '/business-profile' },
    { icon: Zap, label: 'Advisory Centre', path: '/oac' },
    { type: 'divider', label: 'Tools' },
    { icon: MessageSquare, label: 'MyAdvisor', path: '/advisor' },
    { icon: Target, label: 'Intel Centre', path: '/intel-centre', isNew: true },
    { type: 'divider', label: 'Workspace' },
    { icon: Database, label: 'Data Centre', path: '/data-center' },
    { icon: FileText, label: 'SOP Generator', path: '/sop-generator' },
    { icon: FolderOpen, label: 'Documents', path: '/documents' },
    { icon: Plug, label: 'Integrations', path: '/integrations' },
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
          
          <button
            className="p-2.5 rounded-lg transition-colors hidden sm:flex"
            style={{ color: 'var(--text-secondary)' }}
          >
            <Bell className="w-5 h-5" />
          </button>
          
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
                {item.isNew && (
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
        <div className="p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
