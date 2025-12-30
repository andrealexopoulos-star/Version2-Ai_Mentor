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
  ChevronDown, Shield, User, Stethoscope, Database, Building2
} from 'lucide-react';

const DashboardLayout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isAdmin } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
  ];

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-slate-900 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-white/10 rounded-lg"
            data-testid="mobile-menu-toggle"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <span className="font-heading font-semibold text-lg">The Strategy Squad</span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-medium text-sm">
              {user?.name?.charAt(0).toUpperCase()}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-white w-48">
            <DropdownMenuItem onClick={() => navigate('/settings')}>
              <Settings className="w-4 h-4 mr-2" /> Settings
            </DropdownMenuItem>
            {isAdmin() && (
              <DropdownMenuItem onClick={() => navigate('/admin')}>
                <Shield className="w-4 h-4 mr-2" /> Admin Panel
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-red-600">
              <LogOut className="w-4 h-4 mr-2" /> Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Sidebar */}
      <aside 
        className={`fixed top-0 left-0 h-full w-64 bg-slate-900 z-40 transform transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-heading font-bold text-sm">TS</span>
            </div>
            <div>
              <p className="font-heading font-semibold text-white">The Strategy</p>
              <p className="text-slate-400 text-sm -mt-0.5">Squad</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.path}
              onClick={() => {
                navigate(item.path);
                setSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive(item.path) 
                  ? 'bg-blue-600 text-white' 
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
              data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </button>
          ))}
        </nav>

        {/* User Section */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center gap-3 p-3 hover:bg-white/5 rounded-lg transition-colors" data-testid="user-menu-trigger">
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-medium">
                  {user?.name?.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 text-left">
                  <p className="text-white text-sm font-medium truncate">{user?.name}</p>
                  <p className="text-slate-500 text-xs truncate">{user?.email}</p>
                </div>
                <ChevronDown className="w-4 h-4 text-slate-500" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="bg-white w-56">
              <div className="px-3 py-2 border-b">
                <p className="text-sm font-medium text-slate-900">{user?.name}</p>
                <p className="text-xs text-slate-500">{user?.email}</p>
                {user?.role === 'admin' && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 mt-2">
                    Admin
                  </span>
                )}
              </div>
              <DropdownMenuItem onClick={() => navigate('/settings')} data-testid="settings-menu-item">
                <User className="w-4 h-4 mr-2" /> Profile & Settings
              </DropdownMenuItem>
              {isAdmin() && (
                <DropdownMenuItem onClick={() => navigate('/admin')} data-testid="admin-menu-item">
                  <Shield className="w-4 h-4 mr-2" /> Admin Panel
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-red-600" data-testid="logout-menu-item">
                <LogOut className="w-4 h-4 mr-2" /> Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="lg:ml-64 min-h-screen pt-16 lg:pt-0">
        {children}
      </main>
    </div>
  );
};

export default DashboardLayout;
