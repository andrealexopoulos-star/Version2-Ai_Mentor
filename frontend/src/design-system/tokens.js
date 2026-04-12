/**
 * BIQc Design System — Single Source Design Tokens
 * ALL UI surfaces (Marketing, Platform, Mobile, App) must use these tokens.
 * No inline font sizes. No arbitrary padding. No hardcoded radius.
 *
 * TYPOGRAPHY DECISION (Unified — Mar 2026):
 *  Headings/UI/Data → Inter
 *  Single-family typography lowers visual switching cost and improves readability.
 *
 *  displayING = alias for display (used by marketing site pages)
 */

// ═══ TYPOGRAPHY ═══
export const fontFamily = {
  display:    "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  displayING: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",  // alias for marketing site
  body:       "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  mono:       "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

export const fontSize = {
  h1: { desktop: '48px', tablet: '36px', mobile: '28px' },
  h2: { desktop: '32px', tablet: '26px', mobile: '22px' },
  h3: { desktop: '22px', tablet: '20px', mobile: '18px' },
  bodyLarge: { desktop: '18px', tablet: '16px', mobile: '16px' },
  body: { desktop: '15px', tablet: '14px', mobile: '14px' },
  caption: { desktop: '13px', tablet: '12px', mobile: '12px' },
  micro: { desktop: '11px', tablet: '10px', mobile: '10px' },
  mono: { desktop: '12px', tablet: '11px', mobile: '10px' },
};

// Tailwind class equivalents
export const fontSizeClass = {
  h1: 'text-[28px] sm:text-4xl lg:text-5xl',
  h2: 'text-[22px] sm:text-[26px] lg:text-[32px]',
  h3: 'text-lg sm:text-xl lg:text-[22px]',
  bodyLarge: 'text-base sm:text-lg',
  body: 'text-sm sm:text-[15px]',
  caption: 'text-xs sm:text-[13px]',
  micro: 'text-[10px] sm:text-[11px]',
};

export const fontWeight = {
  display: 700,
  headline: 600,
  body: 400,
  meta: 300,
};

export const lineHeight = {
  tight: 1.15,
  heading: 1.2,
  body: 1.5,
  relaxed: 1.7,
};

// ═══ SPACING (8px system) ═══
export const spacing = {
  xs: 8,
  sm: 16,
  md: 24,
  lg: 32,
  xl: 48,
  xxl: 64,
};

// Tailwind equivalents: xs=2, sm=4, md=6, lg=8, xl=12, xxl=16
export const spacingClass = {
  xs: '2',   // 8px
  sm: '4',   // 16px
  md: '6',   // 24px
  lg: '8',   // 32px
  xl: '12',  // 48px
  xxl: '16', // 64px
};

// ═══ COLORS ═══
export const colors = {
  bg: '#0B1120',           // --canvas-app (dark)
  bgCard: '#0E1628',       // --surface (dark)
  bgPanel: '#0E1628',      // --surface (dark)
  bgInput: '#060A12',      // --surface-sunken (dark)
  bgElevated: '#121D30',   // --surface-raised / --surface-2 (dark)
  bgSidebar: '#060A12',    // --surface-sunken (dark)
  border: 'rgba(140,170,210,0.15)', // --steel-border (dark)
  borderFocus: '#E85D00',  // --lava
  text: '#EDF1F7',         // --ink-display (dark)
  textSecondary: '#8FA0B8',// --ink-secondary (dark)
  textMuted: '#708499',    // --ink-muted (dark) — WCAG AA compliant
  brand: '#E85D00',        // --lava
  brandDark: '#C24D00',    // --lava-deep
  brandDim: 'rgba(232,93,0,0.12)',  // --lava-wash (dark)
  brandGlow: 'rgba(232,93,0,0.4)',
  success: '#16A34A',      // --positive
  warning: '#D97706',      // --warning
  danger: '#DC2626',       // --danger
  info: '#2563EB',         // --info
  purple: '#7C3AED',
  successDim: 'rgba(34,197,94,0.10)',   // --positive-wash (dark)
  warningDim: 'rgba(245,158,11,0.10)',  // --warning-wash (dark)
  dangerDim: 'rgba(239,68,68,0.10)',    // --danger-wash (dark)
  infoDim: 'rgba(59,130,246,0.10)',     // --info-wash (dark)
};

// ═══ BORDER RADIUS ═══
export const radius = {
  card: '16px',
  cardSm: '12px',
  button: '14px',
  input: '12px',
  badge: '8px',
  full: '9999px',
};

export const radiusClass = {
  card: 'rounded-2xl',
  cardSm: 'rounded-xl',
  button: 'rounded-[14px]',
  input: 'rounded-xl',
  badge: 'rounded-lg',
  full: 'rounded-full',
};

// ═══ SHADOWS ═══
export const shadow = {
  card: '0 8px 24px rgba(0,0,0,0.35)',
  cardHover: '0 12px 32px rgba(0,0,0,0.45)',
  button: '0 4px 16px rgba(0,0,0,0.2)',
  brandGlow: '0 8px 32px rgba(232,93,0,0.3)',
  // Mobile: NO heavy glow
  glowDesktop: '0 0 60px rgba(232,93,0,0.4)',
  glowMobile: 'none',
};

// ═══ GRID / MESH OVERLAY ═══
export const gridOverlay = {
  desktop: 0.03,
  mobile: 0.01,
};

// ═══ TOUCH TARGETS ═══
export const touch = {
  minHeight: 44,
  minWidth: 44,
};

// ═══ BREAKPOINTS ═══
export const breakpoints = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  xxl: 1440,
};

// ═══ HEADING STYLE (serif visibility fix) ═══
export const headingStyle = {
  fontFamily: fontFamily.display,
  color: colors.text,
  WebkitTextStroke: '0.3px currentColor',
  textShadow: '0 1px 6px rgba(0,0,0,0.4)',
  WebkitFontSmoothing: 'antialiased',
};

export const headingStyleWhite = {
  ...headingStyle,
  color: '#FFFFFF',
  WebkitTextStroke: '0.3px #FFFFFF',
};
