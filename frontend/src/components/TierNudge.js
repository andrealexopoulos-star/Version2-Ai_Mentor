/**
 * TierNudge
 * ---------
 * Sprint B #13 (2026-04-22) — per-tier capability nudges.
 *
 * Small inline hint that a richer capability exists one tier up. This is a
 * SUGGESTION, not a wall — it never blocks the current feature, it just
 * informs the user what the next tier unlocks in context.
 *
 * Retention premise (Retention Master Plan §2 row 66): Users on Starter who
 * never learn what Pro/Business unlock will silently under-value BIQc and
 * downgrade or cancel. Walls make them angry; inline nudges convert.
 *
 * Usage:
 *   <TierNudge featureKey="advisor_depth" />            — use named feature preset
 *   <TierNudge label="Deeper scan" requiredTier="pro" /> — ad-hoc nudge
 *
 * Renders null when:
 *   - user already has access (tier >= requiredTier)
 *   - user dismissed this specific nudge (localStorage persistent)
 *   - `requiredTier` is missing/unrecognized
 */
import { useState, useEffect, useMemo } from 'react';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { resolveTier, hasAccess } from '../lib/tierResolver';
import { TIERS } from '../config/tiers';
import { Sparkles, X } from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * NUDGE_FEATURES — central registry so copy is consistent and A/B-able.
 * Each entry: label (what they're missing) + requiredTier + persuasion hint.
 * Add new features here rather than writing one-off props.
 */
export const NUDGE_FEATURES = {
  advisor_depth: {
    label: 'Deeper AI-routed analysis',
    requiredTier: 'pro',
    hint: 'Pro routes your signals through frontier reasoning models for sharper recommendations.',
  },
  advisor_volume: {
    label: 'More than 5 signals at once',
    requiredTier: 'pro',
    hint: 'Pro shows up to 20 watchtower events; Starter caps at 5.',
  },
  market_deep_compare: {
    label: 'Side-by-side competitor deep dive',
    requiredTier: 'business',
    hint: 'Business unlocks full deep-scan comparisons across up to 5 competitors.',
  },
  integrations_15: {
    label: 'More than 5 integrations',
    requiredTier: 'business',
    hint: 'Business raises your integration cap to 15 connectors.',
  },
  team_seats: {
    label: 'Team collaboration (5 seats)',
    requiredTier: 'business',
    hint: 'Invite up to 5 teammates on Business — each keeps their own settings.',
  },
  frontier_models: {
    label: 'Frontier OpenAI + Anthropic + Google routing',
    requiredTier: 'business',
    hint: 'Business routes every query through GPT-5, Claude Opus, and Gemini Pro in parallel.',
  },
};

const DISMISS_KEY = (key) => `biqc_tier_nudge_dismissed_v1_${key}`;

const TierNudge = ({
  featureKey,
  label: labelProp,
  requiredTier: requiredTierProp,
  hint: hintProp,
  compact = false,
  className = '',
  ctaTo = null, // override destination; default /subscribe?from=tier_nudge
  dataTestId = 'tier-nudge',
}) => {
  const { user } = useSupabaseAuth();
  const [dismissed, setDismissed] = useState(false);

  const preset = featureKey ? NUDGE_FEATURES[featureKey] : null;
  const label = labelProp || preset?.label;
  const requiredTier = requiredTierProp || preset?.requiredTier;
  const hint = hintProp || preset?.hint;

  // Persistent dismissal — per-feature so each nudge can be dismissed once.
  useEffect(() => {
    if (!featureKey) return; // ad-hoc nudges aren't persistently dismissed
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY(featureKey)) === '1');
    } catch (_) { /* ignore */ }
  }, [featureKey]);

  const tier = useMemo(() => resolveTier(user), [user]);

  // Never render if:
  // - no content to show
  // - user already has access
  // - user dismissed it
  // - unrecognised required tier
  if (!label || !requiredTier || !TIERS[requiredTier]) return null;
  if (hasAccess(tier, requiredTier)) return null;
  if (dismissed) return null;

  const tierCfg = TIERS[requiredTier];
  const tierLabel = tierCfg.label;
  const accent = tierCfg.color || 'var(--accent)';

  const handleDismiss = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (featureKey) {
      try { localStorage.setItem(DISMISS_KEY(featureKey), '1'); } catch (_) { /* ignore */ }
    }
    setDismissed(true);
  };

  const destination = ctaTo || `/subscribe?from=nudge_${featureKey || 'adhoc'}`;

  return (
    <div
      className={`biqc-tier-nudge flex items-center gap-2 text-xs ${className}`}
      data-testid={dataTestId}
      data-feature={featureKey || 'adhoc'}
      data-required-tier={requiredTier}
      style={{
        padding: compact ? '4px 10px' : '8px 14px',
        borderRadius: 'var(--r-pill)',
        border: `1px solid ${accent}22`,
        background: `${accent}0a`,
        color: 'var(--ink-display)',
        fontFamily: 'var(--font-ui)',
      }}
    >
      <Sparkles className="shrink-0" style={{ width: 14, height: 14, color: accent }} />
      <div className="flex-1 min-w-0">
        <Link
          to={destination}
          className="hover:underline"
          style={{ color: 'var(--ink-display)', textDecoration: 'none' }}
        >
          <span style={{ fontWeight: 'var(--fw-semi)' }}>Unlock {label}</span>
          <span style={{ color: 'var(--ink-muted)' }}> on {tierLabel}</span>
          {!compact && hint && (
            <span style={{ color: 'var(--ink-muted)', display: 'block', marginTop: 2, fontSize: 11 }}>
              {hint}
            </span>
          )}
        </Link>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss upgrade suggestion"
        className="shrink-0 opacity-50 hover:opacity-100 transition-opacity"
        style={{ color: 'var(--ink-muted)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 2 }}
      >
        <X style={{ width: 12, height: 12 }} />
      </button>
    </div>
  );
};

export default TierNudge;
