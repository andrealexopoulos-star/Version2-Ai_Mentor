/**
 * Retention Policy — plain-English explanation of what BIQc keeps,
 * what it purges, and the 30-day abort window between "Delete" and
 * "actually gone forever".
 *
 * Sprint C #22 Phase 2 (2026-04-22). Paired with:
 *   - POST DELETE /user/account (stamps deletion_requested_at + is_disabled)
 *   - POST /user/account/undo-delete (clears both within the window)
 *   - backend/jobs/hard_delete_worker.py (physically purges rows past 30d)
 *   - Deletion-scheduled confirmation email (E16)
 *
 * Design brief:
 *   - Match `TrustSubPages.js` structural rhythm (shell / heading / body)
 *     but styled with the light-canvas design tokens so it reads as a
 *     BIQc page rather than a dark trust sub-page.
 *   - Visual retention timeline (SVG) — Day 0 → Day 1-30 abort window →
 *     Day 30+ hard purge — so non-technical users see the flow at a glance.
 *   - Mobile responsive: timeline stacks vertically under ~640px.
 *   - No auth required — served at /legal/retention, public.
 *   - No emojis, no raster icons; inline SVG only.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Download, RotateCcw, ShieldCheck, Trash2 } from 'lucide-react';
import { fontFamily } from '../../design-system/tokens';

const HEADING = 'var(--font-display, "Source Serif 4", Georgia, serif)';
const BODY = 'var(--font-ui, Inter, -apple-system, sans-serif)';
const MONO = 'var(--font-mono, "JetBrains Mono", monospace)';


// ─── Timeline graphic ─────────────────────────────────────────────────
//
// Inline SVG so it ships with the bundle (no external asset). Desktop
// renders as a horizontal three-segment bar. Under 640px we switch to
// a vertical stack via a CSS media query local to this file.

const TimelineGraphic = () => (
  <div
    data-testid="retention-timeline"
    className="retention-timeline"
    style={{
      width: '100%',
      padding: '28px 24px',
      borderRadius: '18px',
      background: 'var(--surface, #FFFFFF)',
      border: '1px solid var(--biqc-border, rgba(10,10,10,0.08))',
      boxShadow: 'var(--elev-1, 0 1px 3px rgba(0,0,0,0.04))',
      marginBottom: '32px',
    }}
  >
    <div
      style={{
        fontFamily: MONO,
        fontSize: 10,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: 'var(--lava-deep, #C24D00)',
        fontWeight: 700,
        marginBottom: 16,
      }}
    >
      Retention timeline
    </div>

    <div
      className="timeline-row"
      style={{
        display: 'flex',
        gap: '12px',
        alignItems: 'stretch',
        flexWrap: 'wrap',
      }}
    >
      {/* Day 0 — Delete request */}
      <div
        className="timeline-step"
        style={{
          flex: '1 1 220px',
          minWidth: '200px',
          padding: '16px 18px',
          borderRadius: '14px',
          background: 'rgba(232,93,0,0.06)',
          border: '1px solid rgba(232,93,0,0.24)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: 'var(--lava, #E85D00)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
          </div>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--lava-deep, #C24D00)', fontWeight: 700 }}>Day 0</div>
        </div>
        <div style={{ fontFamily: HEADING, fontSize: 17, color: 'var(--ink-display, #0A0A0A)', fontWeight: 600, marginBottom: 4 }}>
          Delete request
        </div>
        <div style={{ fontFamily: BODY, fontSize: 13, color: 'var(--ink-secondary, #525252)', lineHeight: 1.55 }}>
          Account disabled. All integrations disconnected. Data preserved; nothing purged yet.
        </div>
      </div>

      {/* Day 1-30 — Abort window */}
      <div
        className="timeline-step"
        style={{
          flex: '1 1 220px',
          minWidth: '200px',
          padding: '16px 18px',
          borderRadius: '14px',
          background: 'var(--surface-sunken, #F6F7F1)',
          border: '1px solid var(--biqc-border, rgba(10,10,10,0.08))',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: 'var(--ink-display, #0A0A0A)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          </div>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-muted, #737373)', fontWeight: 700 }}>Day 1 &rarr; Day 30</div>
        </div>
        <div style={{ fontFamily: HEADING, fontSize: 17, color: 'var(--ink-display, #0A0A0A)', fontWeight: 600, marginBottom: 4 }}>
          Undo window
        </div>
        <div style={{ fontFamily: BODY, fontSize: 13, color: 'var(--ink-secondary, #525252)', lineHeight: 1.55 }}>
          Log in and click &ldquo;Cancel deletion&rdquo; to restore access. One click, no support ticket.
        </div>
      </div>

      {/* Day 30+ — Hard purge */}
      <div
        className="timeline-step"
        style={{
          flex: '1 1 220px',
          minWidth: '200px',
          padding: '16px 18px',
          borderRadius: '14px',
          background: 'rgba(185,28,28,0.06)',
          border: '1px solid rgba(185,28,28,0.20)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: 'var(--danger, #B91C1C)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
          </div>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--danger, #B91C1C)', fontWeight: 700 }}>Day 30+</div>
        </div>
        <div style={{ fontFamily: HEADING, fontSize: 17, color: 'var(--ink-display, #0A0A0A)', fontWeight: 600, marginBottom: 4 }}>
          Hard delete
        </div>
        <div style={{ fontFamily: BODY, fontSize: 13, color: 'var(--ink-secondary, #525252)', lineHeight: 1.55 }}>
          Nightly worker purges every row. Auth record removed. Email becomes available for a fresh signup.
        </div>
      </div>
    </div>

    <style>{`
      @media (max-width: 640px) {
        .retention-timeline .timeline-row { flex-direction: column; }
        .retention-timeline .timeline-step { flex: 1 1 auto !important; width: 100%; }
      }
    `}</style>
  </div>
);


// ─── Page shell ───────────────────────────────────────────────────────

const RetentionPolicy = () => (
  <div
    data-testid="retention-policy-page"
    style={{
      minHeight: '100vh',
      background: 'var(--canvas, #F2F4EC)',
      color: 'var(--ink-display, #0A0A0A)',
      fontFamily: BODY,
    }}
  >
    <div
      style={{
        maxWidth: '760px',
        margin: '0 auto',
        padding: 'var(--sp-12, 48px) var(--sp-6, 24px)',
      }}
    >
      <Link
        to="/"
        className="inline-flex items-center gap-2"
        style={{
          fontSize: 13,
          color: 'var(--ink-muted, #737373)',
          fontFamily: MONO,
          textDecoration: 'none',
          marginBottom: 24,
        }}
        data-testid="retention-back-home"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        Back to BIQc
      </Link>

      <p
        style={{
          fontFamily: MONO,
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.16em',
          color: 'var(--lava-deep, #C24D00)',
          fontWeight: 700,
          marginBottom: 8,
        }}
      >
        BIQc Legal
      </p>
      <h1
        style={{
          fontFamily: HEADING,
          fontSize: 'clamp(28px, 5vw, 42px)',
          fontWeight: 700,
          letterSpacing: '-0.02em',
          lineHeight: 1.15,
          color: 'var(--ink-display, #0A0A0A)',
          marginBottom: 12,
        }}
      >
        Retention Policy
      </h1>
      <p
        style={{
          fontFamily: MONO,
          fontSize: 12,
          color: 'var(--ink-muted, #737373)',
          marginBottom: 32,
        }}
      >
        Last updated: April 2026
      </p>

      <p
        style={{
          fontFamily: BODY,
          fontSize: 16,
          lineHeight: 1.7,
          color: 'var(--ink-secondary, #525252)',
          marginBottom: 28,
        }}
      >
        When you ask us to delete your BIQc account we don&rsquo;t purge
        your data instantly. We give you a <strong style={{ color: 'var(--ink-display, #0A0A0A)' }}>30-day window</strong> to change your
        mind and a clear, non-negotiable timeline after that. This page
        explains exactly what happens and when.
      </p>

      <TimelineGraphic />

      {/* Section 1 */}
      <h2 style={sectionHeadingStyle()}>1. What &ldquo;Delete my account&rdquo; actually does</h2>
      <p style={paragraphStyle()}>
        When you click <strong>Delete account</strong> in Settings and
        type the confirmation phrase (<code style={codeStyle()}>DELETE MY ACCOUNT</code>),
        we do three things immediately:
      </p>
      <ul style={listStyle()}>
        <li style={bulletStyle()}>Your account is <strong>disabled</strong> — you&rsquo;re signed out and further logins are blocked.</li>
        <li style={bulletStyle()}>All connected integrations are <strong>disconnected</strong> so we stop pulling new data.</li>
        <li style={bulletStyle()}>A <strong>30-day deletion timer</strong> starts. We record the exact timestamp.</li>
      </ul>
      <p style={paragraphStyle()}>
        We then send you a confirmation email so you have a receipt of
        the action and a one-click &ldquo;Cancel deletion&rdquo; link.
      </p>

      {/* Section 2 */}
      <h2 style={sectionHeadingStyle()}>2. What&rsquo;s kept during the 30-day window</h2>
      <p style={paragraphStyle()}>
        Everything. Your intelligence history, documents, integrations,
        calibration data, billing history &mdash; all of it stays where
        it is. The only change is that the account is flagged as
        &ldquo;pending deletion&rdquo; and login is blocked. We hold
        this data so that if you change your mind we can restore your
        account in full with a single click.
      </p>

      {/* Section 3 */}
      <h2 style={sectionHeadingStyle()}>3. Undoing the deletion</h2>
      <p style={paragraphStyle()}>
        At any point within the 30-day window you can cancel the
        deletion:
      </p>
      <ul style={listStyle()}>
        <li style={bulletStyle()}>
          Click the &ldquo;Cancel deletion&rdquo; link in the confirmation email &mdash; it takes you to your Settings page.
        </li>
        <li style={bulletStyle()}>
          Or sign in at <a href="/login-supabase" style={linkStyle()}>biqc.ai/login-supabase</a> and visit <strong>Settings &rarr; Danger zone</strong>. You&rsquo;ll see a banner offering to restore.
        </li>
        <li style={bulletStyle()}>
          The undo is instant. No support ticket, no cooling-off period, no questions asked.
        </li>
      </ul>

      {/* Section 4 */}
      <h2 style={sectionHeadingStyle()}>4. Exporting your data before deletion</h2>
      <p style={paragraphStyle()}>
        Before you click delete we strongly recommend you download a
        copy of your data. It&rsquo;s one click and takes seconds:
      </p>
      <ol style={listStyle()}>
        <li style={bulletStyle()}>Go to <strong>Settings &rarr; Danger zone</strong>.</li>
        <li style={bulletStyle()}>Click <strong>Export</strong> (the Download icon). You&rsquo;ll get a JSON file with every row you have a right to keep a copy of.</li>
        <li style={bulletStyle()}>Save it somewhere safe. Delete proceeds from there.</li>
      </ol>
      <div
        style={{
          marginTop: 14,
          padding: '14px 16px',
          background: 'rgba(232,93,0,0.06)',
          border: '1px solid rgba(232,93,0,0.24)',
          borderRadius: 12,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
        }}
      >
        <Download className="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden="true" style={{ color: 'var(--lava-deep, #C24D00)' }} />
        <div style={{ fontFamily: BODY, fontSize: 13, color: 'var(--ink-secondary, #525252)', lineHeight: 1.55 }}>
          The exported JSON contains the <em>exact same tables</em> we
          purge at day 30 &mdash; so a round-trip export gives you a
          faithful snapshot of what you lose.
        </div>
      </div>

      {/* Section 5 */}
      <h2 style={sectionHeadingStyle()}>5. What&rsquo;s permanently deleted at day 30</h2>
      <p style={paragraphStyle()}>
        After 30 days a nightly worker purges the following categories
        of data. This is irreversible.
      </p>
      <ul style={listStyle()}>
        <li style={bulletStyle()}><strong>Profile &amp; settings:</strong> business profile, user preferences, notification settings, onboarding state.</li>
        <li style={bulletStyle()}><strong>Communication &amp; work:</strong> chat history, documents, SOPs, email intelligence, calendar intelligence.</li>
        <li style={bulletStyle()}><strong>Intelligence &amp; actions:</strong> intelligence actions, strategy profiles, cognitive profiles, observation events, signal snoozes and feedback.</li>
        <li style={bulletStyle()}><strong>Usage &amp; billing:</strong> usage ledger, payment transactions (subject to minimum legal retention where applicable).</li>
        <li style={bulletStyle()}><strong>Integrations &amp; alerts:</strong> alerts queue, action items, Merge.dev integration tokens.</li>
        <li style={bulletStyle()}><strong>Authentication:</strong> your Supabase auth record, so the email address becomes available again for a fresh signup.</li>
      </ul>

      {/* Section 6 */}
      <h2 style={sectionHeadingStyle()}>6. What we may keep after day 30</h2>
      <p style={paragraphStyle()}>
        A small number of things don&rsquo;t get purged at day 30 because
        we&rsquo;re legally required or operationally obliged to retain
        them for a short period:
      </p>
      <ul style={listStyle()}>
        <li style={bulletStyle()}><strong>Tax &amp; billing records:</strong> Invoice data may be retained in our accounting systems (Stripe, Xero) for up to 7 years to satisfy Australian tax law. This data no longer contains any active account linkage.</li>
        <li style={bulletStyle()}><strong>Security logs:</strong> Anonymised access logs are retained up to 12 months for abuse prevention. These logs do not contain account content.</li>
        <li style={bulletStyle()}><strong>Fraud / legal holds:</strong> If an account is under investigation we may retain data longer than 30 days and will notify you where lawfully permitted.</li>
      </ul>

      {/* Section 7 */}
      <h2 style={sectionHeadingStyle()}>7. Your rights</h2>
      <p style={paragraphStyle()}>
        Under the Australian <em>Privacy Act 1988 (Cth)</em> and the
        Australian Privacy Principles you have the right to request
        access to your personal information, request correction, and
        request deletion. This policy describes the deletion path; for
        access and correction see our <a href="/trust/privacy" style={linkStyle()}>Privacy Policy</a>.
      </p>

      {/* Section 8 */}
      <h2 style={sectionHeadingStyle()}>8. Contact</h2>
      <p style={paragraphStyle()}>
        Questions about this policy, a specific deletion, or how we&rsquo;re
        handling your data? Email <a href="mailto:support@biqc.ai" style={linkStyle()}>support@biqc.ai</a>.
        We answer every email from a real person, usually within one
        business day.
      </p>

      <div
        style={{
          marginTop: 48,
          paddingTop: 24,
          borderTop: '1px solid var(--biqc-border, rgba(10,10,10,0.08))',
          fontFamily: BODY,
          fontSize: 12,
          color: 'var(--ink-muted, #737373)',
        }}
      >
        BIQc Pty Ltd &middot; Melbourne VIC &middot; Australia
        <span style={{ margin: '0 8px' }}>&middot;</span>
        <Link to="/trust" style={linkStyle(12)}>Trust Centre</Link>
        <span style={{ margin: '0 8px' }}>&middot;</span>
        <Link to="/trust/privacy" style={linkStyle(12)}>Privacy</Link>
        <span style={{ margin: '0 8px' }}>&middot;</span>
        <Link to="/trust/terms" style={linkStyle(12)}>Terms</Link>
      </div>
    </div>
  </div>
);

// ─── Style helpers ────────────────────────────────────────────────────
// Kept inline (not CSS modules) to match the rest of the legal surface
// and because the token vars drive everything — no bespoke CSS to
// maintain.

function sectionHeadingStyle() {
  return {
    fontFamily: HEADING,
    fontSize: 22,
    fontWeight: 600,
    letterSpacing: '-0.01em',
    color: 'var(--ink-display, #0A0A0A)',
    marginTop: 32,
    marginBottom: 10,
  };
}

function paragraphStyle() {
  return {
    fontFamily: BODY,
    fontSize: 15,
    lineHeight: 1.7,
    color: 'var(--ink-secondary, #525252)',
    marginBottom: 14,
  };
}

function listStyle() {
  return {
    marginLeft: 20,
    marginBottom: 16,
    padding: 0,
    color: 'var(--ink-secondary, #525252)',
  };
}

function bulletStyle() {
  return {
    fontFamily: BODY,
    fontSize: 15,
    lineHeight: 1.7,
    marginBottom: 8,
  };
}

function linkStyle(size) {
  return {
    color: 'var(--lava-deep, #C24D00)',
    textDecoration: 'underline',
    fontWeight: 500,
    fontSize: size,
  };
}

function codeStyle() {
  return {
    fontFamily: MONO,
    fontSize: '0.9em',
    padding: '2px 6px',
    borderRadius: 4,
    background: 'var(--surface-sunken, #F6F7F1)',
    color: 'var(--ink-display, #0A0A0A)',
  };
}

export default RetentionPolicy;
