import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, TrendingUp, Settings as SettingsIcon, Shield, Radar, AlertTriangle, Zap, Workflow, Link2, Activity, FileText, ClipboardList, Bell, ChevronDown, ChevronRight, Menu, X, BarChart3 } from 'lucide-react';
import { fontFamily } from '../../design-system/tokens';
import brandLogoHead from '../../assets/biqc-logo-head.png';


const NAV_GROUPS = [
  {
    label: 'Intelligence', items: [
      { label: 'BIQc Insights', path: '/platform/overview', icon: LayoutDashboard },
      { label: 'Revenue', path: '/platform/revenue', icon: TrendingUp },
      { label: 'Operations', path: '/platform/operations', icon: SettingsIcon },
      { label: 'Risk', path: '/platform/risk', icon: AlertTriangle },
      { label: 'Compliance', path: '/platform/compliance', icon: Shield },
      { label: 'Market', path: '/platform/market', icon: Radar },
    ],
  },
  {
    label: 'Execution', items: [
      { label: 'Alerts', path: '/platform/alerts', icon: Bell },
      { label: 'Actions', path: '/platform/actions', icon: Zap },
      { label: 'Automations', path: '/platform/automations', icon: Workflow },
    ],
  },
  {
    label: 'Systems', items: [
      { label: 'Integrations', path: '/platform/integrations', icon: Link2 },
      { label: 'Data Health', path: '/platform/data-health', icon: Activity },
    ],
  },
  {
    label: 'Governance', items: [
      { label: 'Reports', path: '/platform/reports', icon: FileText },
      { label: 'Audit Log', path: '/platform/audit', icon: ClipboardList },
      { label: 'Settings', path: '/platform/settings', icon: SettingsIcon },
    ],
  },
];

const PlatformLayout = ({ children, title }) => {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState({ Intelligence: true, Execution: true, Systems: true, Governance: true });

  const toggleGroup = (g) => setExpandedGroups(prev => ({ ...prev, [g]: !prev[g] }));

  const Sidebar = ({ mobile = false }) => (
    <aside className={`${mobile ? 'fixed inset-0 z-50' : 'hidden lg:flex'} flex-col`} style={{ width: mobile ? '100%' : 260 }}>
      {mobile && <div className="absolute inset-0 bg-black/60" onClick={() => setMobileSidebar(false)} />}
      <div className={`${mobile ? 'relative z-10 w-[280px] h-full' : 'h-full'} flex flex-col overflow-y-auto`} style={{ background: '#0A1018', borderRight: '1px solid rgba(140,170,210,0.15)' }}>
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 h-16 shrink-0" style={{ borderBottom: '1px solid rgba(140,170,210,0.15)' }}>
          <img src={brandLogoHead} alt="BIQc logo mark" className="h-8 w-auto object-contain" />
          <span className="text-[28px] leading-none font-semibold tracking-tight text-white" style={{ fontFamily: fontFamily.display }}>BIQc</span>
          <span className="text-[10px] text-[#64748B] ml-1" style={{ fontFamily: fontFamily.mono }}>v2.1</span>
        </div>

        {/* Nav groups */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="mb-3">
              <button onClick={() => toggleGroup(group.label)} className="flex items-center justify-between w-full px-2 py-1.5 mb-1">
                <span className="text-[10px] font-semibold tracking-[0.15em] uppercase text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>{group.label}</span>
                {expandedGroups[group.label] ? <ChevronDown className="w-3 h-3 text-[#64748B]" /> : <ChevronRight className="w-3 h-3 text-[#64748B]" />}
              </button>
              {expandedGroups[group.label] && group.items.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link key={item.path} to={item.path} onClick={() => mobile && setMobileSidebar(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-all"
                    style={{
                      fontFamily: fontFamily.body,
                      color: isActive ? '#EDF1F7' : '#9FB0C3',
                      background: isActive ? '#E85D00' + '15' : 'transparent',
                      borderLeft: isActive ? '2px solid #E85D00' : '2px solid transparent',
                    }}
                    data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <item.icon className="w-4 h-4" style={{ color: isActive ? '#E85D00' : '#64748B' }} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Bottom */}
        <div className="px-4 py-4 shrink-0" style={{ borderTop: '1px solid rgba(140,170,210,0.15)' }}>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>All systems nominal</span>
          </div>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen flex" style={{ background: '#0F1720', color: '#EDF1F7' }}>
      <Sidebar />
      {mobileSidebar && <Sidebar mobile />}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-16 flex items-center justify-between px-6 shrink-0" style={{ background: '#0A1018', borderBottom: '1px solid rgba(140,170,210,0.15)' }} data-testid="platform-topbar">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileSidebar(true)} className="lg:hidden p-1.5 rounded-md hover:bg-white/5 text-[#9FB0C3]">
              <Menu className="w-5 h-5" />
            </button>
            {title && <h1 className="text-base font-semibold text-[#EDF1F7]" style={{ fontFamily: fontFamily.display }}>{title}</h1>}
          </div>

          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-md" style={{ background: '#0E1628', border: '1px solid rgba(140,170,210,0.15)' }}>
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-[11px] text-[#9FB0C3]" style={{ fontFamily: fontFamily.mono }}>Production Environment</span>
          </div>

          <div className="flex items-center gap-4">
            <button className="relative p-2 rounded-md hover:bg-white/5 text-[#9FB0C3]" data-testid="notifications-btn">
              <Bell className="w-4.5 h-4.5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full" style={{ background: '#E85D00' }} />
            </button>
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-md" style={{ background: '#0E1628', border: '1px solid rgba(140,170,210,0.15)' }}>
              <BarChart3 className="w-3.5 h-3.5 text-green-500" />
              <span className="text-xs font-medium text-[#EDF1F7]" style={{ fontFamily: fontFamily.mono }}>74%</span>
            </div>
            <div className="flex items-center gap-2.5" data-testid="user-menu">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold" style={{ background: '#E85D00', fontFamily: fontFamily.display }}>A</div>
              <span className="hidden sm:block text-sm text-[#EDF1F7]" style={{ fontFamily: fontFamily.body }}>Andre</span>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6" data-testid="platform-content">
          {children}
        </main>
      </div>
    </div>
  );
};

export default PlatformLayout;
