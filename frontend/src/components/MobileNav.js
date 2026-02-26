import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Radar, TrendingUp, Bell, MoreHorizontal, X, Link2, Activity, FileText, Settings, Dna } from 'lucide-react';

const MONO = "'JetBrains Mono', monospace";

const NAV_ITEMS = [
  { id: 'pulse', label: 'Overview', icon: LayoutDashboard, path: '/advisor' },
  { id: 'market', label: 'Market', icon: Radar, path: '/market' },
  { id: 'revenue', label: 'Revenue', icon: TrendingUp, path: '/revenue' },
  { id: 'alerts', label: 'Alerts', icon: Bell, path: '/alerts' },
  { id: 'more', label: 'More', icon: MoreHorizontal, path: null },
];

const MORE_ITEMS = [
  { label: 'Integrations', icon: Link2, path: '/integrations' },
  { label: 'Operations', icon: Activity, path: '/operations' },
  { label: 'Risk', icon: Bell, path: '/risk' },
  { label: 'Compliance', icon: FileText, path: '/compliance' },
  { label: 'Settings', icon: Settings, path: '/settings' },
  { label: 'Business DNA', icon: Dna, path: '/business-profile' },
];

const MobileNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  const handleNav = (item) => {
    if (item.id === 'more') {
      setMoreOpen(prev => !prev);
      return;
    }
    setMoreOpen(false);
    navigate(item.path);
  };

  return (
    <>
      {/* More Sheet */}
      {moreOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 z-[1100]" onClick={() => setMoreOpen(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-[1101] rounded-t-2xl" style={{ background: '#0A1018', borderTop: '1px solid #243140', paddingBottom: 'calc(68px + env(safe-area-inset-bottom, 0px))' }} data-testid="mobile-more-sheet">
            <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid #243140' }}>
              <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#64748B', fontFamily: MONO }}>More</span>
              <button onClick={() => setMoreOpen(false)} className="p-2 rounded-lg hover:bg-white/5" data-testid="close-more-sheet">
                <X className="w-4 h-4 text-[#64748B]" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1 p-3">
              {MORE_ITEMS.map(item => {
                const active = location.pathname === item.path;
                return (
                  <button key={item.path} onClick={() => { setMoreOpen(false); navigate(item.path); }}
                    className="flex flex-col items-center gap-1.5 py-4 rounded-xl transition-colors"
                    style={{ background: active ? '#FF6A0010' : 'transparent', color: active ? '#FF6A00' : '#9FB0C3' }}
                    data-testid={`more-${item.label.toLowerCase().replace(/\s/g, '-')}`}>
                    <item.icon className="w-5 h-5" />
                    <span className="text-[11px]" style={{ fontFamily: MONO }}>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Bottom Nav Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-[1099] lg:hidden" style={{ background: '#0A1018', borderTop: '1px solid #243140', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }} data-testid="mobile-bottom-nav">
        <div className="flex items-center justify-around h-[68px]">
          {NAV_ITEMS.map(item => {
            const active = item.path && location.pathname === item.path;
            const isMore = item.id === 'more';
            return (
              <button key={item.id} onClick={() => handleNav(item)}
                className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors"
                style={{ color: active ? '#FF6A00' : isMore && moreOpen ? '#FF6A00' : '#64748B' }}
                data-testid={`mobile-nav-${item.id}`}>
                <item.icon className="w-5 h-5" />
                <span className="text-[10px] font-medium" style={{ fontFamily: MONO }}>{item.label}</span>
                {active && <div className="w-4 h-0.5 rounded-full mt-0.5" style={{ background: '#FF6A00' }} />}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};

export default MobileNav;
