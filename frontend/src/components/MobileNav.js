import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Bell, MoreHorizontal, X, Link2, Activity,
  FileText, Settings, Radar, Target, Workflow, Inbox, MessageSquare, Calendar, Eye, Megaphone, ClipboardList, Shield } from 'lucide-react';
import { fontFamily } from '../design-system/tokens';


// ── Primary 5-tab bar ─────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: 'pulse',   label: 'Overview', icon: LayoutDashboard, path: '/advisor' },
  { id: 'soundboard', label: 'Soundboard', icon: MessageSquare, path: '/soundboard' },
  { id: 'inbox',   label: 'Inbox',    icon: Inbox,      path: '/email-inbox' },
  { id: 'alerts',  label: 'Alerts',   icon: Bell,            path: '/alerts' },
  { id: 'more',    label: 'More',     icon: MoreHorizontal,  path: null },
];

// ── More sheet — grouped for scannability ─────────────────────────────────────
const MORE_SECTIONS = [
  {
    label: 'Free',
    items: [
      { label: 'Market & Positioning', icon: Radar,       path: '/market' },
      { label: 'Calendar',             icon: Calendar,    path: '/calendar' },
      { label: 'Competitive Benchmark',icon: Target,      path: '/competitive-benchmark' },
    ],
  },
  {
    label: 'Operate',
    items: [
      { label: 'Actions',       icon: Bell,     path: '/actions' },
      { label: 'Data Health',   icon: Activity, path: '/data-health' },
      { label: 'Business DNA',  icon: FileText, path: '/business-profile' },
    ],
  },
  {
    label: 'Foundation',
    items: [
      { label: 'Exposure Scan', icon: Eye,           path: '/exposure-scan' },
      { label: 'Marketing Auto',icon: Megaphone,    path: '/marketing-automation' },
      { label: 'Reports',       icon: FileText,     path: '/reports' },
    ],
  },
  {
    label: 'More',
    items: [
      { label: 'Decision Tracker', icon: ClipboardList, path: '/decisions' },
      { label: 'Ingestion Audit',  icon: Shield,        path: '/forensic-audit' },
      { label: 'Email Integration',icon: Link2,         path: '/integrations' },
      { label: 'Settings',         icon: Settings,      path: '/settings' },
      { label: 'More Features',    icon: Workflow,      path: '/more-features' },
    ],
  },
];

const MobileNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  const handleNav = (item) => {
    if (item.id === 'more') { setMoreOpen(prev => !prev); return; }
    setMoreOpen(false);
    navigate(item.path);
  };

  return (
    <>
      {/* ── More Sheet ── */}
      {moreOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/60 z-[1100]"
            onClick={() => setMoreOpen(false)}
            aria-hidden="true"
          />
          <div
            className="fixed bottom-0 left-0 right-0 z-[1101] rounded-t-2xl"
            style={{
              background: 'var(--biqc-bg-input, #0A1018)',
              borderTop: '1px solid var(--biqc-border, #243140)',
              paddingBottom: 'calc(68px + env(safe-area-inset-bottom, 0px))',
            }}
            role="dialog"
            aria-label="More navigation options"
            data-testid="mobile-more-sheet"
          >
            {/* Sheet header */}
            <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid var(--biqc-border, #243140)' }}>
              <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--biqc-text-muted)', fontFamily: fontFamily.mono }}>
                More
              </span>
              <button
                onClick={() => setMoreOpen(false)}
                className="p-2 rounded-lg hover:bg-white/5"
                aria-label="Close more menu"
                data-testid="close-more-sheet"
              >
                <X className="w-4 h-4" style={{ color: 'var(--biqc-text-muted)' }} />
              </button>
            </div>

            {/* Grouped sections */}
            <div className="px-3 py-2 space-y-4 overflow-y-auto max-h-[60vh]">
              {MORE_SECTIONS.map(section => (
                <div key={section.label}>
                  <p
                    className="px-2 mb-1.5 text-[10px] font-semibold uppercase tracking-widest"
                    style={{ color: 'var(--biqc-text-muted)', fontFamily: fontFamily.mono }}
                  >
                    {section.label}
                  </p>
                  <div className="grid grid-cols-3 gap-1">
                    {section.items.map(item => {
                      const active = location.pathname === item.path;
                      return (
                        <button
                          key={item.path}
                          onClick={() => { setMoreOpen(false); navigate(item.path); }}
                          className="flex flex-col items-center gap-1.5 py-3 rounded-xl transition-all min-h-[64px]"
                          style={{
                            background: active ? 'rgba(255,106,0,0.1)' : 'transparent',
                            color: active ? '#FF6A00' : 'var(--biqc-text-2, #9FB0C3)',
                          }}
                          aria-current={active ? 'page' : undefined}
                          data-testid={`more-${item.label.toLowerCase().replace(/[\s&]/g, '-')}`}
                        >
                          <item.icon className="w-5 h-5" />
                          <span className="text-[10px] text-center leading-tight" style={{ fontFamily: fontFamily.mono }}>
                            {item.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── Bottom Nav Bar ── */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-[1099] lg:hidden"
        style={{
          background: 'var(--biqc-bg-input, #0A1018)',
          borderTop: '1px solid var(--biqc-border, #243140)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
        aria-label="Mobile navigation"
        data-testid="mobile-bottom-nav"
      >
        <div className="flex items-center justify-around h-[68px]">
          {NAV_ITEMS.map(item => {
            const active = item.path && location.pathname === item.path;
            const isMore = item.id === 'more';
            return (
              <button
                key={item.id}
                onClick={() => handleNav(item)}
                className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors"
                style={{ color: active ? '#FF6A00' : (isMore && moreOpen ? '#FF6A00' : 'var(--biqc-text-muted, #8B9DB5)') }}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
                data-testid={`mobile-nav-${item.id}`}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-[11px] font-medium" style={{ fontFamily: fontFamily.mono }}>{item.label}</span>
                {active && (
                  <div className="w-4 h-0.5 rounded-full mt-0.5" style={{ background: '#FF6A00' }} />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};

export default MobileNav;
