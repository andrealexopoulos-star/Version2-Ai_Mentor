/**
 * TrustBadges — in-app trust strip shown at the bottom of every dashboard page.
 *
 * Sprint C #20. Marketing pages carry the same four trust claims (see
 * pages/website/HomePage.js L290-300 for the inline hero strip and
 * L537-560 for the richer four-card variant). Logged-in surfaces previously
 * had NO equivalent — so a paying user who signed up from the homepage lost
 * every assurance the moment they crossed the dashboard boundary. This
 * component closes that gap.
 *
 * Design:
 *   - Four monoline lucide icons (Shield / Lock / ShieldCheck / Clock) matching
 *     the lucide set already in use across DashboardLayout.
 *   - Muted, small type — design-token colors only (var(--ink-muted),
 *     var(--biqc-border)). No hex literals. Works in both light and dark themes
 *     because every token is theme-aware via data-theme on <html>.
 *   - Horizontal row on ≥640px (Tailwind `sm:` breakpoint — the same breakpoint
 *     DashboardLayout already uses elsewhere for trial card, user menu, etc.),
 *     stacks vertically on mobile.
 *   - Dismissable — one tiny X on the right. Click persists
 *     `biqc_trust_badges_dismissed=1` in localStorage and the component
 *     returns null on subsequent mounts. No server round-trip.
 */
import { useState } from 'react';
import { Shield, Lock, ShieldCheck, Clock, X } from 'lucide-react';
import { fontFamily } from '../../design-system/tokens';

const DISMISS_KEY = 'biqc_trust_badges_dismissed';

const BADGES = [
  { icon: Shield, label: 'AU-hosted' },
  { icon: Lock, label: 'AES-256' },
  { icon: ShieldCheck, label: 'Privacy Act' },
  { icon: Clock, label: '14-day guarantee' },
];

const TrustBadges = () => {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });

  if (dismissed) return null;

  const handleDismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* storage unavailable — dismiss this session only */
    }
    setDismissed(true);
  };

  return (
    <div
      className="mt-8 pt-4 flex flex-col sm:flex-row sm:items-center sm:justify-center gap-3 sm:gap-5"
      style={{
        borderTop: '1px solid var(--biqc-border)',
        fontFamily: fontFamily.body,
      }}
      role="contentinfo"
      aria-label="Trust and compliance"
      data-testid="trust-badges-strip"
    >
      <ul
        className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-5 m-0 p-0 list-none"
      >
        {BADGES.map(({ icon: Icon, label }) => (
          <li
            key={label}
            className="flex items-center gap-1.5"
            style={{
              color: 'var(--ink-muted)',
              fontSize: '11px',
              letterSpacing: '-0.002em',
            }}
          >
            <Icon
              className="w-3.5 h-3.5 shrink-0"
              aria-hidden="true"
              style={{ color: 'var(--ink-muted)' }}
            />
            <span>{label}</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={handleDismiss}
        className="self-end sm:self-auto p-1 rounded hover:bg-black/5 transition-colors shrink-0"
        style={{ color: 'var(--ink-muted)' }}
        aria-label="Dismiss trust badges"
        data-testid="trust-badges-dismiss"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
};

export default TrustBadges;
