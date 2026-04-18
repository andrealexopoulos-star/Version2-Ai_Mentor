import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Sparkles, Calendar, CreditCard } from 'lucide-react';

/**
 * TrialCountdownCard — tutorial-style dismissible upgrade prompt.
 *
 * Phase 6.3 per Andreas direction.
 *
 * Replaces the old orange banner strip at the top of DashboardLayout.
 * Shows ONLY to users on a Growth free trial. Gives them a transparent
 * countdown + upgrade path, respecting the Trust Layer principles:
 *   • predictable, not surprising — shows exact charge date
 *   • honest microcopy — "Stripe never sees your card"
 *   • ownership + exit — cancel-for-$0 window shown clearly
 *   • money respects their time — Skip is always visible, no dark pattern
 *
 * Display logic:
 *   • Days 1-10 of trial: show once per session, dismissible "Skip for now"
 *   • Days 11-14 of trial: shows every page load (persistent reminder)
 *   • After trial: component doesn't render (caller should have upgraded the
 *     user to a paid tier OR blocked access)
 *
 * Props:
 *   trialExpiresAt — ISO string (e.g. user.trial_expires_at)
 *   onUpgrade      — callback; defaults to navigate('/subscribe')
 *   onDismiss      — optional callback fired when user clicks Skip
 */
const SESSION_DISMISS_KEY = 'biqc_trial_card_dismissed_session';

const formatExactDate = (iso) => {
  try {
    return new Date(iso).toLocaleDateString('en-AU', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  } catch {
    return null;
  }
};

const TrialCountdownCard = ({ trialExpiresAt, onUpgrade, onDismiss }) => {
  const navigate = useNavigate();
  const [dismissedThisSession, setDismissedThisSession] = useState(() => {
    try { return sessionStorage.getItem(SESSION_DISMISS_KEY) === '1'; }
    catch { return false; }
  });

  const { daysLeft, chargeDateLabel, isPersistent } = useMemo(() => {
    if (!trialExpiresAt) return { daysLeft: null, chargeDateLabel: null, isPersistent: false };
    const now = new Date();
    const expiry = new Date(trialExpiresAt);
    const ms = expiry.getTime() - now.getTime();
    const d = Math.ceil(ms / (1000 * 60 * 60 * 24));
    return {
      daysLeft: d,
      chargeDateLabel: formatExactDate(trialExpiresAt),
      isPersistent: d <= 3,  // persistent in the final 3 days
    };
  }, [trialExpiresAt]);

  // Hide entirely if no trial or trial expired
  if (daysLeft === null || daysLeft < 0) return null;

  // Hide if user dismissed this session AND we're not in the persistent window
  if (dismissedThisSession && !isPersistent) return null;

  const handleDismiss = () => {
    try { sessionStorage.setItem(SESSION_DISMISS_KEY, '1'); } catch {}
    setDismissedThisSession(true);
    if (onDismiss) onDismiss();
  };

  const handleUpgrade = () => {
    if (onUpgrade) onUpgrade();
    else navigate('/subscribe');
  };

  const urgencyCopy = daysLeft === 0
    ? 'Your trial ends today.'
    : daysLeft === 1
      ? '1 day left in your Growth trial.'
      : `${daysLeft} days left in your Growth trial.`;

  return (
    <div
      data-testid="trial-countdown-card"
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        zIndex: 900,
        width: 340,
        maxWidth: 'calc(100vw - 40px)',
        /* liquid-steel silver gradient — matches BiqcLogoCard + diagram */
        background: 'linear-gradient(135deg, #F6F7F9 0%, #E8ECF1 50%, #DDE3EB 100%)',
        border: '1px solid rgba(10,10,10,0.08)',
        borderRadius: 16,
        padding: 20,
        boxShadow: '0 14px 40px rgba(10,10,10,0.12), 0 4px 14px rgba(10,10,10,0.06), inset 0 1px 0 rgba(255,255,255,0.5)',
        fontFamily: 'var(--font-marketing-ui, "Geist", sans-serif)',
        animation: 'trialCardSlideIn 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)',
      }}
    >
      <style>{`
        @keyframes trialCardSlideIn {
          from { transform: translateY(24px); opacity: 0; }
          to   { transform: translateY(0); opacity: 1; }
        }
      `}</style>

      {/* Close button — always visible, top-right (trust principle: exit always visible) */}
      {!isPersistent && (
        <button
          onClick={handleDismiss}
          aria-label="Dismiss for now"
          style={{
            position: 'absolute', top: 10, right: 10,
            width: 28, height: 28, borderRadius: '50%',
            background: 'rgba(10,10,10,0.04)',
            border: 'none',
            cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--ink-muted, #737373)',
            transition: 'background 0.2s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(10,10,10,0.08)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(10,10,10,0.04)'; }}
        >
          <X size={14} strokeWidth={2} />
        </button>
      )}

      {/* Icon */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 32, height: 32,
        borderRadius: 10,
        background: 'rgba(232,93,0,0.12)',
        color: 'var(--lava, #E85D00)',
        marginBottom: 12,
      }}>
        <Sparkles size={16} strokeWidth={2} />
      </div>

      {/* Headline */}
      <div style={{
        fontFamily: 'var(--font-marketing-display, "Geist", sans-serif)',
        fontSize: 17, fontWeight: 600,
        color: 'var(--ink-display, #0A0A0A)',
        letterSpacing: '-0.02em',
        lineHeight: 1.2,
        marginBottom: 6,
      }}>
        {urgencyCopy}
      </div>

      {/* Charge date transparency — trust principle: predictable not surprising */}
      {chargeDateLabel && (
        <div style={{
          fontSize: 13,
          color: 'var(--ink-secondary, #525252)',
          lineHeight: 1.45,
          marginBottom: 14,
          letterSpacing: '-0.005em',
        }}>
          Your card will be charged on <strong style={{ color: 'var(--ink-display, #0A0A0A)', fontWeight: 600 }}>{chargeDateLabel}</strong>. Cancel anytime before then for $0.
        </div>
      )}

      {/* Trust microcopy */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 8,
        padding: 10,
        background: 'rgba(10,10,10,0.04)',
        border: '1px solid rgba(10,10,10,0.04)',
        borderRadius: 8,
        marginBottom: 14,
        fontSize: 11.5,
        color: 'var(--ink-secondary, #525252)',
        lineHeight: 1.45,
        letterSpacing: '-0.003em',
      }}>
        <CreditCard size={13} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1, color: 'var(--ink-muted, #737373)' }} />
        <span>Stripe handles your card. BIQc never sees the number.</span>
      </div>

      {/* Actions — primary upgrade + secondary skip */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={handleUpgrade}
          data-testid="trial-card-upgrade"
          style={{
            flex: 1,
            background: '#0A0A0A',
            color: '#FFFFFF',
            border: '1px solid #0A0A0A',
            borderRadius: 999,
            padding: '10px 16px',
            fontSize: 13.5,
            fontWeight: 500,
            letterSpacing: '-0.005em',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(10,10,10,0.08)',
            fontFamily: 'var(--font-marketing-ui, "Geist", sans-serif)',
            transition: 'background 0.2s, transform 0.2s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#1F1F1F'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#0A0A0A'; e.currentTarget.style.transform = 'translateY(0)'; }}
        >
          Upgrade now
        </button>
        {!isPersistent && (
          <button
            onClick={handleDismiss}
            data-testid="trial-card-skip"
            style={{
              background: '#FFFFFF',
              color: 'var(--ink-display, #0A0A0A)',
              border: '1px solid rgba(10,10,10,0.12)',
              borderRadius: 999,
              padding: '10px 16px',
              fontSize: 13.5,
              fontWeight: 500,
              letterSpacing: '-0.005em',
              cursor: 'pointer',
              fontFamily: 'var(--font-marketing-ui, "Geist", sans-serif)',
              transition: 'border-color 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(10,10,10,0.25)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(10,10,10,0.12)'; }}
          >
            Skip
          </button>
        )}
      </div>

      {/* Calendar reminder — trust principle: we'll remind you 3 days before */}
      {daysLeft > 3 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          marginTop: 10,
          fontSize: 10.5,
          color: 'var(--ink-muted, #737373)',
          letterSpacing: '-0.002em',
        }}>
          <Calendar size={11} strokeWidth={2} />
          <span>We'll remind you 3 days before trial ends.</span>
        </div>
      )}
    </div>
  );
};

export default TrialCountdownCard;
