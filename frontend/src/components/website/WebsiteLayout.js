import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { fontFamily } from '../../design-system/tokens';

const NAV_LINKS = [
  { label: 'Platform', path: '/platform' },
  { label: 'Intelligence', path: '/intelligence' },
  { label: 'Integrations', path: '/integrations-platform' },
  { label: 'Pricing', path: '/pricing' },
  { label: 'About', path: '/about' },
  { label: 'Trust', path: '/trust' },
  { label: 'Blog', path: '/blog' },
];

const WebsiteNav = () => {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="sticky top-0 left-0 right-0 z-50" style={{ background: 'linear-gradient(180deg, rgba(8,12,20,0.95), rgba(11,17,32,0.92))', backdropFilter: 'blur(24px) saturate(1.5)', borderBottom: '1px solid rgba(255,255,255,0.06)', height: '64px' }} data-testid="website-nav">
      <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center" data-testid="nav-logo">
          <span className="text-[28px] leading-none font-bold tracking-tight text-white" style={{ fontFamily: fontFamily.display }}>
            BIQc
          </span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((link) => {
            const isActive = location.pathname === link.path
              || (link.label === 'Trust' && location.pathname.startsWith('/trust'))
              || (link.label === 'Platform' && location.pathname.startsWith('/platform'))
              || (link.label === 'Blog' && location.pathname.startsWith('/blog'));
            return (
              <Link key={link.label} to={link.path} className="px-4 py-2 rounded-lg text-sm transition-all hover:text-white" style={{ color: isActive ? 'var(--ink-display, #EDF1F7)' : '#8FA0B8', fontWeight: isActive ? 600 : 400, fontFamily: fontFamily.display }} data-testid={`nav-${link.label.toLowerCase()}`}>
                {link.label}
              </Link>
            );
          })}
        </div>

        {/* CTA + Mobile Toggle */}
        <div className="flex items-center gap-3">
          <Link to="/login-supabase" className="hidden md:block px-4 py-2 rounded-lg text-sm text-[#8FA0B8] hover:text-white transition-colors" style={{ fontFamily: fontFamily.display }} data-testid="nav-login">Log in</Link>
          <Link to="/register-supabase" className="hidden md:block px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:brightness-110" style={{ background: 'linear-gradient(135deg, #FF7A18, #E85D00)', fontFamily: fontFamily.display, boxShadow: '0 4px 16px rgba(232,93,0,0.3)' }} data-testid="nav-get-started">
            Start Free
          </Link>
          {/* Mobile: Log In text + hamburger */}
          <Link to="/login-supabase" className="md:hidden text-xs text-[#8FA0B8] hover:text-white" style={{ fontFamily: fontFamily.display }} data-testid="nav-mobile-login">Log in</Link>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 text-[#8FA0B8]"
            aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
            data-testid="nav-mobile-toggle"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden px-6 pb-6 space-y-1" style={{ background: 'linear-gradient(180deg, rgba(8,12,20,0.98), rgba(11,17,32,0.95))' }}>
          {NAV_LINKS.map((link) => (
            <Link key={link.label} to={link.path} onClick={() => setMobileOpen(false)} className="block px-4 py-3 rounded-lg text-sm text-[#8FA0B8] hover:text-white hover:bg-white/5 transition-all" style={{ fontFamily: fontFamily.display }}>{link.label}</Link>
          ))}
          <div className="pt-4 space-y-2">
            <Link to="/login-supabase" onClick={() => setMobileOpen(false)} className="block px-4 py-3 rounded-lg text-sm text-center text-[#8FA0B8] border border-white/10">Log in</Link>
            <Link to="/register-supabase" onClick={() => setMobileOpen(false)} className="block px-4 py-3 rounded-lg text-sm text-center text-white font-semibold" style={{ background: 'linear-gradient(135deg, #FF7A18, #E85D00)' }}>Start Free</Link>
          </div>
        </div>
      )}
    </nav>
  );
};

const WebsiteFooter = () => (
  <footer style={{ background: 'linear-gradient(180deg, #060B16, #040810)', borderTop: '1px solid rgba(140,170,210,0.12)' }} data-testid="website-footer">
    <div className="max-w-7xl mx-auto px-6 py-16">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 sm:gap-10">
        <div>
          <span className="text-[30px] leading-none font-semibold tracking-tight text-white block mb-6" style={{ fontFamily: fontFamily.display }}>
            BIQc
          </span>
          <p className="text-xs text-[#8FA0B8]/60 leading-relaxed" style={{ fontFamily: fontFamily.display }}>Business Intelligence that works while you sleep. One intelligence layer for every decision that matters.</p>
          <div className="mt-6 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />
            <span className="text-[10px] text-[#8FA0B8]/50" style={{ fontFamily: fontFamily.mono }}>All data hosted in Australia</span>
          </div>
        </div>
        <div>
          <h2 className="text-xs font-semibold tracking-widest uppercase text-[#8FA0B8]/40 mb-4" style={{ fontFamily: fontFamily.mono }}>Product</h2>
          <div className="space-y-2.5">
            {[['Platform', '/platform'], ['Intelligence', '/intelligence'], ['Integrations', '/integrations-platform'], ['Pricing', '/pricing']].map(([l, p]) => (
              <Link key={p} to={p} className="block text-sm text-[#8FA0B8] hover:text-[#E85D00] transition-colors" style={{ fontFamily: fontFamily.display }}>{l}</Link>
            ))}
          </div>
        </div>
        <div>
          <h2 className="text-xs font-semibold tracking-widest uppercase text-[#8FA0B8]/40 mb-4" style={{ fontFamily: fontFamily.mono }}>Legal</h2>
          <div className="space-y-2.5">
            {[['Privacy Policy', '/trust/privacy'], ['Terms of Service', '/trust/terms'], ['Trust & Security', '/trust/security']].map(([l, p]) => (
              <Link key={p} to={p} className="block text-sm text-[#8FA0B8] hover:text-[#E85D00] transition-colors" style={{ fontFamily: fontFamily.display }}>{l}</Link>
            ))}
          </div>
        </div>
        <div>
          <h2 className="text-xs font-semibold tracking-widest uppercase text-[#8FA0B8]/40 mb-4" style={{ fontFamily: fontFamily.mono }}>Company</h2>
          <div className="space-y-2.5">
            {[['Blog', '/blog'], ['Contact', '/contact'], ['Log In', '/login-supabase'], ['Start Free Trial', '/register-supabase']].map(([l, p]) => (
              <Link key={l} to={p} className="block text-sm text-[#8FA0B8] hover:text-[#E85D00] transition-colors" style={{ fontFamily: fontFamily.display }}>{l}</Link>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-12 pt-6 border-t flex flex-col sm:flex-row items-center justify-between gap-4" style={{ borderColor: 'rgba(140,170,210,0.12)' }}>
        <span className="text-xs text-[#8FA0B8]/40" style={{ fontFamily: fontFamily.mono }}>&copy; 2026 BIQc Pty Ltd. All rights reserved.</span>
        <span className="text-xs text-[#8FA0B8]/40" style={{ fontFamily: fontFamily.mono }}>Australian Owned &amp; Operated</span>
      </div>
    </div>
  </footer>
);

const WebsiteLayout = ({ children }) => {
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
  }, []);

  return (
    <div className="min-h-screen" style={{ background: '#0F1720', color: 'var(--ink-display, #EDF1F7)' }}>
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <WebsiteNav />
      <main id="main-content">{children}</main>
      <WebsiteFooter />
    </div>
  );
};

export default WebsiteLayout;
