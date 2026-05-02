import React from 'react';
import { Check } from 'lucide-react';
import { fontFamily } from '../design-system/tokens';

/**
 * Phase 6.11 — plan picker for CC-mandatory signup.
 *
 * Three cards: Growth ($69), Pro ($199), Business ($349) — all AUD/mo.
 * Growth is default + tagged "Most Popular" per the /pricing page Trust Layer.
 *
 * Clicking a card calls onChange with the plan id ("starter" | "pro" |
 * "business"). Uses radio-style single-select with visible selection ring.
 */

const DISPLAY = 'var(--font-marketing-display, ' + fontFamily.display + ')';
const UI = 'var(--font-marketing-ui, ' + fontFamily.body + ')';
const MONO = 'var(--font-mono, ' + fontFamily.mono + ')';

const PLANS = [
  {
    id: 'starter',
    name: 'Growth',
    price: '$69',
    period: 'AUD/mo',
    tagline: 'For solo operators and early-stage teams.',
    features: ['1 user included', '1,000,000 AI tokens / month per account', 'Recent data sync history'],
    highlight: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$199',
    period: 'AUD/mo',
    tagline: 'For teams running weekly intelligence workflows.',
    features: ['Up to 5 users included', '5,000,000 AI tokens / month per account', 'Extended data sync history'],
    highlight: false,
  },
  {
    id: 'business',
    name: 'Business',
    price: '$349',
    period: 'AUD/mo',
    tagline: 'For established teams needing deeper monthly capacity.',
    features: ['Up to 12 users included', '20,000,000 AI tokens / month per account', 'Advanced data sync history'],
    highlight: false,
  },
];

const PlanPicker = ({ value, onChange, disabled = false }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }} data-testid="plan-picker">
      <label style={{
        fontFamily: MONO,
        fontSize: 10,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: 'var(--ink-muted, #737373)',
        fontWeight: 500,
      }}>
        Choose your plan
      </label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {PLANS.map((plan) => {
          const selected = value === plan.id;
          return (
            <button
              type="button"
              key={plan.id}
              onClick={() => !disabled && onChange(plan.id)}
              disabled={disabled}
              data-testid={`plan-option-${plan.id}`}
              aria-pressed={selected}
              style={{
                textAlign: 'left',
                padding: '14px 16px',
                borderRadius: 12,
                background: selected ? 'linear-gradient(135deg, #F6F7F9 0%, #E8ECF1 100%)' : '#FFFFFF',
                border: selected
                  ? '2px solid var(--ink-display, #0A0A0A)'
                  : '1px solid rgba(10,10,10,0.1)',
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.6 : 1,
                transition: 'all 0.15s',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                fontFamily: UI,
              }}
            >
              <div style={{
                width: 18,
                height: 18,
                borderRadius: '50%',
                border: selected ? '2px solid var(--ink-display, #0A0A0A)' : '1px solid rgba(10,10,10,0.25)',
                background: selected ? 'var(--ink-display, #0A0A0A)' : '#FFFFFF',
                flexShrink: 0,
                marginTop: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {selected && <Check size={10} strokeWidth={3} color="#FFFFFF" />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
                  <span style={{
                    fontFamily: DISPLAY,
                    fontSize: 15,
                    fontWeight: 600,
                    color: 'var(--ink-display, #0A0A0A)',
                    letterSpacing: '-0.02em',
                  }}>
                    {plan.name}
                  </span>
                  {plan.highlight && (
                    <span style={{
                      fontFamily: MONO,
                      fontSize: 9,
                      color: 'var(--lava, #E85D00)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      fontWeight: 600,
                    }}>
                      Most popular
                    </span>
                  )}
                  <span style={{ flex: 1 }} />
                  <span style={{
                    fontFamily: DISPLAY,
                    fontSize: 16,
                    fontWeight: 600,
                    color: 'var(--ink-display, #0A0A0A)',
                    letterSpacing: '-0.02em',
                  }}>
                    {plan.price}
                  </span>
                  <span style={{
                    fontFamily: MONO,
                    fontSize: 10,
                    color: 'var(--ink-muted, #737373)',
                  }}>
                    {plan.period}
                  </span>
                </div>
                <div style={{
                  fontSize: 12,
                  color: 'var(--ink-secondary, #525252)',
                  lineHeight: 1.45,
                  marginBottom: 6,
                }}>
                  {plan.tagline}
                </div>
                <ul style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: 0,
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 6,
                }}>
                  {plan.features.map((f, i) => (
                    <li
                      key={i}
                      style={{
                        fontSize: 11,
                        color: 'var(--ink-muted, #737373)',
                        fontFamily: MONO,
                      }}
                    >
                      · {f}
                    </li>
                  ))}
                </ul>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default PlanPicker;
export { PLANS as PLAN_OPTIONS };
