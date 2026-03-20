import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, Menu, X, Shield, FileText, Lock, Server, Eye, BookOpen } from 'lucide-react';
import { fontFamily } from '../../design-system/tokens';

const DISPLAY = "'Cormorant Garamond', Georgia, serif";

const TRUST_ITEMS = [
  { label: 'BIQc AI Learning Guarantee', path: '/trust/ai-learning-guarantee', icon: Shield, bold: true },
  { label: 'Security & Infrastructure', path: '/trust/security', icon: Server },
  { label: 'Trust Centre', path: '/trust/centre', icon: Shield },
  { label: 'Data Processing Agreement', path: '/trust/dpa', icon: Lock },
  { label: 'Privacy Policy', path: '/trust/privacy', icon: Eye },
  { label: 'Terms & Conditions', path: '/trust/terms', icon: FileText },
  { label: 'Knowledge Base', path: '/knowledge-base', icon: BookOpen },
];

const NAV_LINKS = [
  { label: 'Platform', path: '/platform' },
  { label: 'Intelligence', path: '/intelligence' },
  { label: 'Integrations', path: '/our-integrations' },
  { label: 'Pricing', path: '/pricing' },
  { label: 'Blog', path: '/blog' },
  { label: 'Trust', path: '/trust', dropdown: true },
];

const TrustDropdown = ({ open, onClose }) => {
  const ref = useRef(null);
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  if (!open) return null;
  return (
    <div ref={ref} className="absolute top-full right-0 mt-2 w-72 rounded-xl overflow-hidden" style={{ background: 'rgba(20,28,38,0.95)', border: '1px solid rgba(255,106,0,0.15)', backdropFilter: 'blur(24px)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
      {TRUST_ITEMS.map((item) => (
        <Link key={item.path} to={item.path} onClick={onClose} className="flex items-center gap-3 px-5 py-3.5 transition-all hover:bg-white/5 group" data-testid={`trust-dropdown-${item.label.toLowerCase().replace(/\s+/g,'-')}`}>
          <item.icon className="w-4 h-4 text-[#9FB0C3] group-hover:text-[#FF6A00] transition-colors" />
          <span className="text-sm text-[#F4F7FA] group-hover:text-white" style={{ fontFamily: fontFamily.display, fontWeight: item.bold ? 600 : 400 }}>{item.label}</span>
        </Link>
      ))}
    </div>
  );
};

const WebsiteNav = () => {
  const location = useLocation();
  const [trustOpen, setTrustOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50" style={{ background: 'rgba(15,23,32,0.85)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }} data-testid="website-nav">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5" data-testid="nav-logo">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #FF6A00, #FF8C33)' }}>
            <span className="text-white font-bold text-sm" style={{ fontFamily: fontFamily.mono }}>B</span>
          </div>
          <span className="text-lg font-semibold text-[#F4F7FA] tracking-tight" style={{ fontFamily: fontFamily.display }}>BIQc</span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((link) => {
            const isActive = location.pathname === link.path || (link.dropdown && location.pathname.startsWith('/trust'));
            return (
              <div key={link.label} className="relative">
                {link.dropdown ? (
                  <button onClick={() => setTrustOpen(!trustOpen)} className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm transition-all" style={{ color: isActive ? '#FF6A00' : '#9FB0C3', fontFamily: fontFamily.display }} data-testid="nav-trust">
                    {link.label} <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <Link to={link.path} className="px-4 py-2 rounded-lg text-sm transition-all hover:text-white" style={{ color: isActive ? '#FF6A00' : '#9FB0C3', fontFamily: fontFamily.display }} data-testid={`nav-${link.label.toLowerCase()}`}>
                    {link.label}
                  </Link>
                )}
                {link.dropdown && <TrustDropdown open={trustOpen} onClose={() => setTrustOpen(false)} />}
              </div>
            );
          })}
        </div>

        {/* CTA + Mobile Toggle */}
        <div className="flex items-center gap-3">
          <Link to="/login-supabase" className="hidden md:block px-4 py-2 rounded-lg text-sm text-[#9FB0C3] hover:text-white transition-colors" style={{ fontFamily: fontFamily.display }} data-testid="nav-login">Log in</Link>
          <Link to="/register-supabase" className="hidden md:block px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:brightness-110" style={{ background: 'linear-gradient(135deg, #FF6A00, #FF6A00)', fontFamily: fontFamily.display, boxShadow: '0 4px 16px rgba(255,106,0,0.3)' }} data-testid="nav-get-started">
            Try It Free
          </Link>
          {/* Mobile: Log In text + hamburger */}
          <Link to="/login-supabase" className="md:hidden text-xs text-[#9FB0C3] hover:text-white" style={{ fontFamily: fontFamily.display }} data-testid="nav-mobile-login">Log in</Link>
          <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden p-2 text-[#9FB0C3]" data-testid="nav-mobile-toggle">
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden px-6 pb-6 space-y-1" style={{ background: 'rgba(15,23,32,0.98)' }}>
          {NAV_LINKS.map((link) => (
            <div key={link.label}>
              <Link to={link.path} onClick={() => setMobileOpen(false)} className="block px-4 py-3 rounded-lg text-sm text-[#9FB0C3] hover:text-white hover:bg-white/5 transition-all" style={{ fontFamily: fontFamily.display }}>{link.label}</Link>
              {link.dropdown && TRUST_ITEMS.map((item) => (
                <Link key={item.path} to={item.path} onClick={() => setMobileOpen(false)} className="block px-8 py-2 text-xs text-[#9FB0C3]/70 hover:text-[#FF6A00] transition-colors" style={{ fontFamily: fontFamily.display }}>{item.label}</Link>
              ))}
            </div>
          ))}
          <div className="pt-4 space-y-2">
            <Link to="/login-supabase" onClick={() => setMobileOpen(false)} className="block px-4 py-3 rounded-lg text-sm text-center text-[#9FB0C3] border border-white/10">Log in</Link>
            <Link to="/register-supabase" onClick={() => setMobileOpen(false)} className="block px-4 py-3 rounded-lg text-sm text-center text-white font-semibold" style={{ background: '#FF6A00' }}>Get started</Link>
          </div>
        </div>
      )}
    </nav>
  );
};

const WebsiteFooter = () => (
  <footer className="border-t" style={{ background: '#0A1018', borderColor: 'rgba(255,255,255,0.06)' }} data-testid="website-footer">
    <div className="max-w-7xl mx-auto px-6 py-16">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 sm:gap-10">
        <div>
          <div className="flex items-center gap-2 mb-6">
            <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: '#FF6A00' }}>
              <span className="text-white font-bold text-xs" style={{ fontFamily: fontFamily.mono }}>B</span>
            </div>
            <span className="text-base font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>BIQc</span>
          </div>
          <p className="text-xs text-[#9FB0C3]/60 leading-relaxed" style={{ fontFamily: fontFamily.display }}>Autonomous Business Intelligence for SMBs. Australian owned & operated.</p>
        </div>
        <div>
          <h4 className="text-xs font-semibold tracking-widest uppercase text-[#9FB0C3]/40 mb-4" style={{ fontFamily: fontFamily.mono }}>Product</h4>
          <div className="space-y-2.5">
            {[['Platform', '/platform'], ['Intelligence', '/intelligence'], ['Integrations', '/our-integrations'], ['Pricing', '/pricing']].map(([l, p]) => (
              <Link key={p} to={p} className="block text-sm text-[#9FB0C3] hover:text-[#FF6A00] transition-colors" style={{ fontFamily: fontFamily.display }}>{l}</Link>
            ))}
          </div>
        </div>
        <div>
          <h4 className="text-xs font-semibold tracking-widest uppercase text-[#9FB0C3]/40 mb-4" style={{ fontFamily: fontFamily.mono }}>Legal</h4>
          <div className="space-y-2.5">
            {TRUST_ITEMS.map((item) => (
              <Link key={item.path} to={item.path} className="block text-sm text-[#9FB0C3] hover:text-[#FF6A00] transition-colors" style={{ fontFamily: fontFamily.display }}>{item.label}</Link>
            ))}
          </div>
        </div>
        <div>
          <h4 className="text-xs font-semibold tracking-widest uppercase text-[#9FB0C3]/40 mb-4" style={{ fontFamily: fontFamily.mono }}>Company</h4>
          <div className="space-y-2.5">
            {[['Contact', '/contact'], ['Trust', '/trust'], ['Try It Free', '/register-supabase']].map(([l, p]) => (
              <Link key={l} to={p} className="block text-sm text-[#9FB0C3] hover:text-[#FF6A00] transition-colors" style={{ fontFamily: fontFamily.display }}>{l}</Link>
            ))}
          </div>
          <div className="mt-6 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />
            <span className="text-[10px] text-[#9FB0C3]/50" style={{ fontFamily: fontFamily.mono }}>Australian Sovereign Data</span>
          </div>
        </div>
      </div>
      <div className="mt-12 pt-6 border-t flex flex-col sm:flex-row items-center justify-between gap-4" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <span className="text-xs text-[#9FB0C3]/40" style={{ fontFamily: fontFamily.mono }}>&copy; {new Date().getFullYear()} The Strategy Squad Pty Ltd. ABN 12 345 678 901</span>
        <span className="text-xs text-[#9FB0C3]/40" style={{ fontFamily: fontFamily.mono }}>Sydney, Australia</span>
      </div>
    </div>
  </footer>
);

const WebsiteLayout = ({ children }) => (
  <div className="min-h-screen" style={{ background: '#0F1720', color: '#F4F7FA' }}>
    <a href="#main-content" className="skip-link">Skip to main content</a>
    <WebsiteNav />
    <main id="main-content" className="pt-16">{children}</main>
    <WebsiteFooter />
  </div>
);

export default WebsiteLayout;
