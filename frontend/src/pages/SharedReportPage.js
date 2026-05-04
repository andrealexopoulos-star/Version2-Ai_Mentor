/**
 * SharedReportPage — public, unauthenticated viewer for CMO Report share links.
 *
 * fix/p0-marjo-f1-spa-share-route — closes R8 P0 blocker on top of E8.
 *
 * Background
 * ----------
 * E8 wired the backend share endpoints (POST /reports/cmo-report/share +
 * GET /reports/cmo-report/shared/{token}) and returned share URLs of the
 * shape `https://biqc.ai/r/{token}`. The frontend SPA had NO route for
 * `/r/:token` — recipients hit the catch-all NotFoundPage and saw a 404.
 * That is the exact silent end-to-end failure PR #449 was supposed to fix
 * (Marjo Critical Incident).
 *
 * What this page does
 * -------------------
 * 1. Reads the `:token` URL param.
 * 2. Fetches `/api/reports/cmo-report/shared/{token}` with NO auth header
 *    — the share URL holder IS the authorisation, per E8 backend contract.
 * 3. Renders the sanitised HTML the backend produces inside an iframe so
 *    the backend-rendered styled document (already Contract v2 sanitised
 *    + assert_no_banned_tokens checked server-side) keeps its own styling
 *    and isolates from the SPA shell's CSS.
 * 4. Shows EXPLICIT messages on 404 / 410 / 5xx — never a generic "404
 *    Page Not Found" and never a silent blank screen.
 * 5. Wraps everything in an "Ask BIQc" branded shell (NEVER "Soundboard"
 *    / "Chat" / "Assistant" — see feedback_ask_biqc_brand_name.md) with
 *    a clear "Sign up for Ask BIQc" CTA pointing at /register-supabase.
 * 6. Renders OUTSIDE the authenticated SPA layout — no Sidebar, no top
 *    nav with user menu, no Supabase session required.
 *
 * Contract v2
 * -----------
 * The backend already strips supplier names + internal codes before
 * returning HTML. This page MUST NOT add anything to the rendered output
 * that could leak supplier names or internal architecture. Only generic
 * "Ask BIQc" / "BIQc" copy + the pre-sanitised iframe payload.
 */

import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getApiBaseUrl } from '../config/urls';

// Display states
const STATE_LOADING = 'loading';
const STATE_READY = 'ready';
const STATE_INVALID = 'invalid';   // 404 — token never existed / malformed (400 also lands here)
const STATE_EXPIRED = 'expired';   // 410 — token expired / revoked
const STATE_ERROR = 'error';       // 5xx / network — temporarily unavailable

const SIGNUP_HREF = '/register-supabase';
const MARKETING_HREF = '/';

const palette = {
  ink: '#0A0A0A',
  inkSecondary: '#525252',
  inkMuted: '#737373',
  surface: '#FFFFFF',
  canvas: '#FAFAFA',
  border: 'rgba(10,10,10,0.08)',
  lava: '#E85D00',
  lavaWarm: '#FF7A1A',
};

// ── Brand header (shared across all states) ─────────────────────────────────
function BrandHeader() {
  return (
    <header
      data-testid="ask-biqc-shared-header"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        padding: '20px 24px',
        background: palette.surface,
        borderBottom: `1px solid ${palette.border}`,
        flexWrap: 'wrap',
      }}
    >
      <Link
        to={MARKETING_HREF}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 10,
          textDecoration: 'none',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 36,
            height: 36,
            background: palette.lava,
            borderRadius: 10,
            color: '#FFFFFF',
            fontWeight: 700,
            fontSize: 18,
            fontFamily: 'var(--font-display, -apple-system, sans-serif)',
          }}
        >
          B
        </span>
        <span
          style={{
            color: palette.ink,
            fontSize: 16,
            fontWeight: 600,
            letterSpacing: '-0.01em',
            fontFamily: 'var(--font-display, -apple-system, sans-serif)',
          }}
        >
          Ask BIQc
        </span>
      </Link>
      <Link
        to={SIGNUP_HREF}
        data-testid="ask-biqc-header-signup-cta"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 16px',
          background: palette.ink,
          color: '#FFFFFF',
          fontSize: 13,
          fontWeight: 600,
          textDecoration: 'none',
          borderRadius: 999,
          letterSpacing: '-0.005em',
        }}
      >
        Sign up for Ask BIQc
      </Link>
    </header>
  );
}

// ── Shared page shell — Ask BIQc brand around any inner content ─────────────
function PageShell({ children }) {
  return (
    <div
      data-testid="shared-report-page"
      style={{
        minHeight: '100vh',
        background: palette.canvas,
        fontFamily: 'var(--font-ui, -apple-system, BlinkMacSystemFont, sans-serif)',
        color: palette.ink,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <BrandHeader />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {children}
      </main>
      <footer
        data-testid="ask-biqc-shared-footer"
        style={{
          padding: '20px 24px',
          background: palette.surface,
          borderTop: `1px solid ${palette.border}`,
          textAlign: 'center',
          fontSize: 12,
          color: palette.inkMuted,
        }}
      >
        Prepared by Ask BIQc. Read-only shared view —{' '}
        <Link
          to={SIGNUP_HREF}
          data-testid="ask-biqc-footer-signup-cta"
          style={{ color: palette.lava, textDecoration: 'none', fontWeight: 600 }}
        >
          sign up for Ask BIQc
        </Link>{' '}
        to generate one for your business.
      </footer>
    </div>
  );
}

// ── Centered status panel (loading / error states) ──────────────────────────
function StatusPanel({ title, message, showCta = false, testId }) {
  return (
    <section
      data-testid={testId || 'shared-report-status'}
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
      }}
    >
      <div
        style={{
          maxWidth: 520,
          width: '100%',
          background: palette.surface,
          border: `1px solid ${palette.border}`,
          borderRadius: 16,
          padding: '32px 28px',
          textAlign: 'center',
        }}
      >
        <h1
          style={{
            margin: '0 0 12px 0',
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: '-0.01em',
            color: palette.ink,
            fontFamily: 'var(--font-display, -apple-system, sans-serif)',
          }}
        >
          {title}
        </h1>
        <p
          style={{
            margin: '0 0 24px 0',
            fontSize: 15,
            lineHeight: 1.55,
            color: palette.inkSecondary,
          }}
        >
          {message}
        </p>
        {showCta && (
          <Link
            to={SIGNUP_HREF}
            data-testid="ask-biqc-cta-signup"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 24px',
              background: palette.lava,
              color: '#FFFFFF',
              fontSize: 14,
              fontWeight: 600,
              textDecoration: 'none',
              borderRadius: 12,
              letterSpacing: '-0.005em',
            }}
          >
            Sign up for Ask BIQc
          </Link>
        )}
      </div>
    </section>
  );
}

// ── Loading spinner ─────────────────────────────────────────────────────────
function LoadingPanel() {
  return (
    <section
      data-testid="shared-report-loading"
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div
          aria-hidden="true"
          style={{
            width: 36,
            height: 36,
            border: `3px solid ${palette.border}`,
            borderTopColor: palette.lava,
            borderRadius: '50%',
            animation: 'shared-report-spin 0.8s linear infinite',
            margin: '0 auto 16px',
          }}
        />
        <p
          style={{
            margin: 0,
            fontSize: 14,
            color: palette.inkSecondary,
          }}
        >
          Loading shared report...
        </p>
        <style>{`@keyframes shared-report-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </section>
  );
}

// ── Report frame — backend returns full HTML document, iframe is correct
//    isolation: backend's <head>/<style>/<body> render unchanged + the SPA
//    shell's CSS can never bleed into the report. srcDoc avoids a second
//    network hop and works for unauthenticated public payloads. ──────────────
function ReportFrame({ html }) {
  return (
    <section
      data-testid="shared-report-content"
      style={{ flex: 1, padding: '24px 24px 0', display: 'flex', flexDirection: 'column' }}
    >
      <iframe
        title="Shared CMO Report"
        data-testid="shared-report-iframe"
        srcDoc={html}
        // Sandbox: allow same-origin so the iframe can render styles + fonts,
        // but BLOCK scripts and form submissions. The backend HTML is
        // already sanitised but defence-in-depth.
        sandbox="allow-same-origin"
        referrerPolicy="no-referrer"
        style={{
          flex: 1,
          width: '100%',
          minHeight: '70vh',
          border: `1px solid ${palette.border}`,
          borderRadius: 12,
          background: palette.surface,
        }}
      />
    </section>
  );
}

// ── Page component ──────────────────────────────────────────────────────────
export default function SharedReportPage() {
  const { token } = useParams();
  const [state, setState] = useState(STATE_LOADING);
  const [html, setHtml] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // Defensive — useParams should always populate from the route, but
      // a missing/empty token must NEVER fall through to "loading forever".
      if (!token || typeof token !== 'string' || token.length < 8) {
        if (!cancelled) setState(STATE_INVALID);
        return;
      }

      setState(STATE_LOADING);
      try {
        const apiBase = getApiBaseUrl();
        const url = `${apiBase}/reports/cmo-report/shared/${encodeURIComponent(token)}`;

        // Use fetch directly — apiClient enforces JSON responses + adds an
        // Authorization header. The share endpoint returns text/html and is
        // public (no auth header). Both reasons => bypass apiClient.
        const res = await fetch(url, {
          method: 'GET',
          headers: { Accept: 'text/html' },
          // No credentials — the URL token is the auth.
          credentials: 'omit',
        });

        if (cancelled) return;

        if (res.status === 200) {
          const body = await res.text();
          if (!cancelled) {
            setHtml(body || '');
            setState(STATE_READY);
          }
          return;
        }

        if (res.status === 410) {
          setState(STATE_EXPIRED);
          return;
        }

        if (res.status === 404 || res.status === 400) {
          setState(STATE_INVALID);
          return;
        }

        // 5xx / unexpected — surface explicitly, never silent.
        setState(STATE_ERROR);
      } catch (err) {
        if (!cancelled) {
          // Network / CORS / abort — explicit error state, not a silent blank.
          setState(STATE_ERROR);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state === STATE_LOADING) {
    return (
      <PageShell>
        <LoadingPanel />
      </PageShell>
    );
  }

  if (state === STATE_INVALID) {
    return (
      <PageShell>
        <StatusPanel
          testId="shared-report-invalid"
          title="This share link is invalid"
          message="This share link is invalid or no longer exists. Ask the sender for an updated link, or sign up for Ask BIQc to create your own report."
          showCta
        />
      </PageShell>
    );
  }

  if (state === STATE_EXPIRED) {
    return (
      <PageShell>
        <StatusPanel
          testId="shared-report-expired"
          title="This share link has expired"
          message="This share link has expired or been revoked. Ask the sender for a fresh link, or sign up for Ask BIQc to create your own report."
          showCta
        />
      </PageShell>
    );
  }

  if (state === STATE_ERROR) {
    return (
      <PageShell>
        <StatusPanel
          testId="shared-report-error"
          title="This shared report is temporarily unavailable"
          message="We couldn't load this shared report right now. Please try again in a few minutes, or contact the sender."
          showCta
        />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <ReportFrame html={html} />
    </PageShell>
  );
}
