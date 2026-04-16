import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

const WEBSITE_FONTS = {
  display: 'var(--font-display)',
  body: 'var(--font-ui)',
  mono: 'var(--font-mono)',
};

const NAV_LINKS = [
  { label: 'Platform', path: '/platform' },
  { label: 'Intelligence', path: '/intelligence' },
  { label: 'Integrations', path: '/our-integrations' },
  { label: 'Pricing', path: '/pricing' },
  { label: 'About', path: '/about' },
  { label: 'Trust', path: '/trust' },
  { label: 'Blog', path: '/blog' },
];

const WebsiteNav = () => {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="sticky top-0 left-0 right-0 z-50" style={{ background: 'var(--canvas-app, #FAFAFA)', backdropFilter: 'blur(24px) saturate(1.5)', borderBottom: '1px solid var(--border, rgba(10,10,10,0.08))', height: '64px' }} data-testid="website-nav">
      <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center" data-testid="nav-logo">
          <span className="text-[28px] leading-none font-bold tracking-tight" style={{ fontFamily: WEBSITE_FONTS.display, color: 'var(--ink-display)' }}>
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
              <Link key={link.label} to={link.path} className="px-4 py-2 rounded-lg text-sm transition-all hover:text-[var(--ink-display)]" style={{ color: isActive ? 'var(--ink-display)' : 'var(--ink-secondary)', fontWeight: isActive ? 600 : 400, fontFamily: WEBSITE_FONTS.body }} data-testid={`nav-${link.label.toLowerCase()}`}>
                {link.label}
              </Link>
            );
          })}
        </div>

        {/* CTA + Mobile Toggle */}
        <div className="flex items-center gap-3">
          <Link to="/login-supabase" className="hidden md:block px-4 py-2 rounded-lg text-sm text-[var(--ink-secondary)] hover:text-[var(--ink-display)] transition-colors" style={{ fontFamily: WEBSITE_FONTS.body }} data-testid="nav-login">Log in</Link>
          <Link to="/register-supabase" className="hidden md:block px-5 py-2.5 rounded-lg text-sm font-semibold text-[var(--ink-inverse)] transition-all hover:brightness-110" style={{ background: 'linear-gradient(135deg, var(--lava-warm), var(--lava))', fontFamily: WEBSITE_FONTS.body, boxShadow: '0 4px 16px var(--lava-ring)' }} data-testid="nav-get-started">
            Start Free
          </Link>
          {/* Mobile: Log In text + hamburger */}
          <Link to="/login-supabase" className="md:hidden text-xs text-[var(--ink-secondary)] hover:text-[var(--ink-display)]" style={{ fontFamily: WEBSITE_FONTS.body }} data-testid="nav-mobile-login">Log in</Link>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 text-[var(--ink-secondary)]"
            aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
            data-testid="nav-mobile-toggle"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden px-6 pb-6 space-y-1" style={{ background: 'var(--canvas-app, #FAFAFA)' }}>
          {NAV_LINKS.map((link) => (
            <Link key={link.label} to={link.path} onClick={() => setMobileOpen(false)} className="block px-4 py-3 rounded-lg text-sm text-[var(--ink-secondary)] hover:text-[var(--ink-display)] hover:bg-black/5 transition-all" style={{ fontFamily: WEBSITE_FONTS.body }}>{link.label}</Link>
          ))}
          <div className="pt-4 space-y-2">
            <Link to="/login-supabase" onClick={() => setMobileOpen(false)} className="block px-4 py-3 rounded-lg text-sm text-center text-[var(--ink-secondary)] border border-white/10">Log in</Link>
            <Link to="/register-supabase" onClick={() => setMobileOpen(false)} className="block px-4 py-3 rounded-lg text-sm text-center text-[var(--ink-inverse)] font-semibold" style={{ background: 'linear-gradient(135deg, var(--lava-warm), var(--lava))' }}>Start Free</Link>
          </div>
        </div>
      )}
    </nav>
  );
};

const WebsiteFooter = () => (
  <footer style={{ background: 'var(--surface-sunken, #F5F5F5)', borderTop: '1px solid var(--border, rgba(10,10,10,0.08))' }} data-testid="website-footer">
    <div className="max-w-7xl mx-auto px-6 py-16">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 sm:gap-10">
        <div>
          <span className="text-[30px] leading-none font-semibold tracking-tight block mb-6" style={{ fontFamily: WEBSITE_FONTS.display, color: 'var(--ink-display)' }}>
            BIQc
          </span>
          <p className="text-xs text-[var(--ink-secondary)]/60 leading-relaxed" style={{ fontFamily: WEBSITE_FONTS.body }}>Business Intelligence that works while you sleep. One intelligence layer for every decision that matters.</p>
          <div className="mt-6 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />
            <span className="text-[10px] text-[var(--ink-secondary)]/50" style={{ fontFamily: WEBSITE_FONTS.mono }}>All data hosted in Australia</span>
          </div>
        </div>
        <div>
          <h2 className="text-xs font-semibold tracking-widest uppercase text-[var(--ink-secondary)]/40 mb-4" style={{ fontFamily: WEBSITE_FONTS.mono }}>Product</h2>
          <div className="space-y-2.5">
            {[['Platform', '/platform'], ['Intelligence', '/intelligence'], ['Integrations', '/our-integrations'], ['Pricing', '/pricing']].map(([l, p]) => (
              <Link key={p} to={p} className="block text-sm text-[var(--ink-secondary)] hover:text-[var(--lava)] transition-colors" style={{ fontFamily: WEBSITE_FONTS.body }}>{l}</Link>
            ))}
          </div>
        </div>
        <div>
          <h2 className="text-xs font-semibold tracking-widest uppercase text-[var(--ink-secondary)]/40 mb-4" style={{ fontFamily: WEBSITE_FONTS.mono }}>Legal</h2>
          <div className="space-y-2.5">
            {[['Privacy Policy', '/trust/privacy'], ['Terms of Service', '/trust/terms'], ['Refund Policy', '/trust/refund-policy'], ['Trust & Security', '/trust/security']].map(([l, p]) => (
              <Link key={p} to={p} className="block text-sm text-[var(--ink-secondary)] hover:text-[var(--lava)] transition-colors" style={{ fontFamily: WEBSITE_FONTS.body }}>{l}</Link>
            ))}
          </div>
        </div>
        <div>
          <h2 className="text-xs font-semibold tracking-widest uppercase text-[var(--ink-secondary)]/40 mb-4" style={{ fontFamily: WEBSITE_FONTS.mono }}>Company</h2>
          <div className="space-y-2.5">
            {[['Blog', '/blog'], ['Contact', '/contact'], ['Log In', '/login-supabase'], ['Start Free Trial', '/register-supabase']].map(([l, p]) => (
              <Link key={l} to={p} className="block text-sm text-[var(--ink-secondary)] hover:text-[var(--lava)] transition-colors" style={{ fontFamily: WEBSITE_FONTS.body }}>{l}</Link>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-12 pt-6 border-t flex flex-col sm:flex-row items-center justify-between gap-4" style={{ borderColor: 'rgba(140,170,210,0.12)' }}>
        <span className="text-xs text-[var(--ink-secondary)]/40" style={{ fontFamily: WEBSITE_FONTS.mono }}>&copy; 2026 BIQc Pty Ltd. All rights reserved.</span>
        <span className="text-xs text-[var(--ink-secondary)]/40" style={{ fontFamily: WEBSITE_FONTS.mono }}>Australian Owned &amp; Operated</span>
      </div>
    </div>
  </footer>
);

const WebsiteLayout = ({ children }) => {
  // Marketing website respects user's theme preference (light is default).
  // Previously forced dark mode — removed to match platform light default.

  return (
    <div className="min-h-screen" style={{ background: 'var(--canvas, #FFFFFF)', color: 'var(--ink-display, #0A0A0A)' }}>
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <WebsiteNav />
      <main id="main-content">{children}</main>
      <WebsiteFooter />
    </div>
  );
};

export default WebsiteLayout;
