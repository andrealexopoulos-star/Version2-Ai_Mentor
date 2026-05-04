import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { fontFamily } from '../../design-system/tokens';
import BiqcLogoCard from '../BiqcLogoCard';


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
          <span className="text-[28px] leading-none font-bold tracking-tight" style={{ fontFamily: fontFamily.display, color: 'var(--ink-display, #0A0A0A)' }}>
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
              <Link key={link.label} to={link.path} className="px-4 py-2 rounded-lg text-sm transition-all hover:text-[var(--ink-display)]" style={{ color: isActive ? 'var(--ink-display, #0A0A0A)' : 'var(--ink-secondary, #525252)', fontWeight: isActive ? 600 : 400, fontFamily: fontFamily.body }} data-testid={`nav-${link.label.toLowerCase()}`}>
                {link.label}
              </Link>
            );
          })}
        </div>

        {/* CTA + Mobile Toggle */}
        <div className="flex items-center gap-3">
          <Link to="/login-supabase" className="hidden md:block px-4 py-2 rounded-lg text-sm text-[var(--ink-secondary)] hover:text-[var(--ink-display)] transition-colors" style={{ fontFamily: fontFamily.body }} data-testid="nav-login">Login</Link>
          <Link
            to="/speak-with-local-specialist"
            className="hidden md:block px-5 py-2.5 rounded-lg text-sm font-semibold transition-all hover:brightness-110 text-center"
            style={{ color: 'var(--ink-display, #0A0A0A)', border: '1px solid rgba(10,10,10,0.12)', background: 'rgba(255,255,255,0.75)', fontFamily: fontFamily.body }}
            data-testid="nav-book-demo"
          >
            Talk to a Local Specialist
          </Link>
          {/* 2026-05-04: Start Trial CTA restored per Andreas direction (code 13041978).
              WIP previously removed it; reverted to maintain conversion funnel. */}
          <Link to="/register-supabase" className="hidden md:block px-5 py-2.5 rounded-lg text-sm font-semibold text-[var(--ink-inverse)] transition-all hover:brightness-110" style={{ background: 'linear-gradient(135deg, #FF7A18, #E85D00)', fontFamily: fontFamily.body, boxShadow: '0 4px 16px rgba(232,93,0,0.3)' }} data-testid="nav-start-trial">
            Start Free Trial
          </Link>
          {/* Mobile: Login text + hamburger */}
          <Link to="/login-supabase" className="md:hidden text-xs text-[var(--ink-secondary)] hover:text-[var(--ink-display)]" style={{ fontFamily: fontFamily.body }} data-testid="nav-mobile-login">Login</Link>
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
            <Link key={link.label} to={link.path} onClick={() => setMobileOpen(false)} className="block px-4 py-3 rounded-lg text-sm text-[var(--ink-secondary)] hover:text-[var(--ink-display)] hover:bg-black/5 transition-all" style={{ fontFamily: fontFamily.body }}>{link.label}</Link>
          ))}
          <div className="pt-4 space-y-2">
            <Link to="/login-supabase" onClick={() => setMobileOpen(false)} className="block px-4 py-3 rounded-lg text-sm text-center text-[var(--ink-secondary)] border border-white/10">Login</Link>
            <Link
              to="/speak-with-local-specialist"
              onClick={() => setMobileOpen(false)}
              className="block w-full px-4 py-3 rounded-lg text-sm text-center font-semibold"
              style={{ color: 'var(--ink-display, #0A0A0A)', border: '1px solid rgba(10,10,10,0.12)', background: 'rgba(255,255,255,0.8)' }}
            >
              Talk to a Local Specialist
            </Link>
            {/* 2026-05-04: Start Trial CTA restored on mobile per Andreas direction (code 13041978). */}
            <Link to="/register-supabase" onClick={() => setMobileOpen(false)} className="block px-4 py-3 rounded-lg text-sm text-center text-[var(--ink-inverse)] font-semibold" style={{ background: 'linear-gradient(135deg, #FF7A18, #E85D00)' }} data-testid="nav-mobile-start-trial">Start Free Trial</Link>
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
          {/* Hovering BIQc.ai brand card */}
          <div className="mb-6">
            <BiqcLogoCard size="sm" to="/" />
          </div>
          <p className="text-xs text-[var(--ink-secondary)]/60 leading-relaxed" style={{ fontFamily: fontFamily.body }}>Business Intelligence that works while you sleep. One intelligence layer for every decision that matters.</p>
          <div className="mt-6 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />
            <span className="text-[10px] text-[var(--ink-secondary)]/50" style={{ fontFamily: fontFamily.mono }}>All data hosted in Australia</span>
          </div>
        </div>
        <div>
          <h2 className="text-xs font-semibold tracking-widest uppercase text-[var(--ink-secondary)]/40 mb-4" style={{ fontFamily: fontFamily.mono }}>Product</h2>
          <div className="space-y-2.5">
            {[['Platform', '/platform'], ['Intelligence', '/intelligence'], ['Integrations', '/our-integrations'], ['Pricing', '/pricing']].map(([l, p]) => (
              <Link key={p} to={p} className="block text-sm text-[var(--ink-secondary)] hover:text-[#E85D00] transition-colors" style={{ fontFamily: fontFamily.body }}>{l}</Link>
            ))}
          </div>
        </div>
        <div>
          <h2 className="text-xs font-semibold tracking-widest uppercase text-[var(--ink-secondary)]/40 mb-4" style={{ fontFamily: fontFamily.mono }}>Legal</h2>
          <div className="space-y-2.5">
            {[['Privacy Policy', '/trust/privacy'], ['Terms of Service', '/trust/terms'], ['Data Processing Agreement', '/trust/dpa'], ['Refund Policy', '/trust/refund-policy'], ['Trust & Security', '/trust/security']].map(([l, p]) => (
              <Link key={p} to={p} className="block text-sm text-[var(--ink-secondary)] hover:text-[#E85D00] transition-colors" style={{ fontFamily: fontFamily.body }}>{l}</Link>
            ))}
          </div>
        </div>
        <div>
          <h2 className="text-xs font-semibold tracking-widest uppercase text-[var(--ink-secondary)]/40 mb-4" style={{ fontFamily: fontFamily.mono }}>Company</h2>
          <div className="space-y-2.5">
            {[['About', '/about'], ['Blog', '/blog'], ['Knowledge Base', '/knowledge-base'], ['Contact', '/contact'], ['Log In', '/login-supabase'], ['Start Your Trial', '/register-supabase']].map(([l, p]) => (
              <Link key={l} to={p} className="block text-sm text-[var(--ink-secondary)] hover:text-[#E85D00] transition-colors" style={{ fontFamily: fontFamily.body }}>{l}</Link>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-12 pt-6 border-t flex flex-col sm:flex-row items-center justify-between gap-4" style={{ borderColor: 'rgba(140,170,210,0.12)' }}>
        <span className="text-xs text-[var(--ink-secondary)]/40" style={{ fontFamily: fontFamily.mono }}>&copy; 2026 BIQc Pty Ltd. All rights reserved.</span>
        <span className="text-xs text-[var(--ink-secondary)]/40" style={{ fontFamily: fontFamily.mono }}>Australian Owned &amp; Operated</span>
      </div>
    </div>
  </footer>
);

const WebsiteLayout = ({ children }) => {
  const navigate = useNavigate();

  // Marketing website FORCES light theme. Without this, a user who has
  // toggled dark mode in the app (which persists data-theme="dark" on <html>)
  // would see the marketing site inherit dark-mode token values — making
  // text nearly invisible on the sage/light canvas. Restore previous theme
  // on unmount so we don't affect the app after navigation.
  useEffect(() => {
    const prev = document.documentElement.getAttribute('data-theme');
    document.documentElement.setAttribute('data-theme', 'light');
    return () => {
      if (prev) document.documentElement.setAttribute('data-theme', prev);
      else document.documentElement.removeAttribute('data-theme');
    };
  }, []);

  // Catch stray OAuth hash tokens (biqc.ai/#access_token=... loop).
  // Happens when Supabase redirects back to the Site URL instead of
  // /auth/callback. Without this, user sees home page, must click Log in
  // a second time to be picked up and redirected to the platform.
  useEffect(() => {
    const hash = window.location.hash || '';
    const hasAuthTokens = /[#&](access_token|refresh_token|provider_token)=/.test(hash)
      || /[#&]error=/.test(hash);
    if (hasAuthTokens) {
      navigate(`/auth/callback${hash}`, { replace: true });
    }
  }, [navigate]);

  return (
    <div className="biqc-marketing min-h-screen" style={{ background: 'var(--canvas, #FFFFFF)', color: 'var(--ink-display, #0A0A0A)' }}>
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <WebsiteNav />
      <main id="main-content">{children}</main>
      <WebsiteFooter />
    </div>
  );
};

export default WebsiteLayout;
