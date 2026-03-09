/**
 * BIQc Mobile Theme — Phase 5 Aligned (Mar 2026)
 * Mirrors web design system tokens (design-system/tokens.js + index.css --biqc-* vars).
 *
 * FONT STRATEGY (React Native):
 *   React Native uses native platform fonts for reliability.
 *   Web equivalent → Native equivalent:
 *     Cormorant Garamond (headings) → Georgia (iOS/Android serif, closest available)
 *     Inter (body/UI)              → System (San Francisco on iOS, Roboto on Android)
 *     JetBrains Mono (data)        → 'Courier New' (or SpaceMono if loaded via Expo)
 *
 *   To use the exact web fonts in Expo, install:
 *     yarn add @expo-google-fonts/cormorant-garamond @expo-google-fonts/inter
 *   and load them in App.tsx with useFonts().
 */
export const theme = {
  colors: {
    // ── Backgrounds (matches --biqc-bg-* CSS vars) ──
    bg:          '#0F1720',   // --biqc-bg
    bgCard:      '#141C26',   // --biqc-bg-card
    bgPanel:     '#141C26',   // --biqc-bg-panel
    bgInput:     '#0A1018',   // --biqc-bg-input
    bgElevated:  '#1A2332',   // --biqc-bg-elevated
    bgSidebar:   '#0A1018',   // --biqc-sidebar-bg

    // ── Borders ──
    border:      '#243140',   // --biqc-border
    borderFocus: '#FF6A00',   // --biqc-border-focus

    // ── Text (all WCAG AA on dark bg) ──
    text:          '#F4F7FA',   // --biqc-text        (15.8:1 on bg)
    textSecondary: '#9FB0C3',   // --biqc-text-2       (6.2:1 on bg)
    textMuted:     '#8B9DB5',   // --biqc-text-muted   (4.6:1 — was #64748B which failed AA)
    textPlaceholder: '#4A5568',

    // ── Brand & Accent ──
    brand:       '#FF6A00',   // --biqc-brand
    brandDark:   '#E85D00',   // --biqc-brand-dark
    brandDim:    'rgba(255,106,0,0.15)',

    // ── Semantic ──
    success:     '#10B981',   // --biqc-success
    warning:     '#F59E0B',   // --biqc-warning
    danger:      '#EF4444',   // --biqc-danger
    info:        '#3B82F6',   // --biqc-info

    // ── Semantic dims ──
    successDim:  'rgba(16,185,129,0.08)',
    warningDim:  'rgba(245,158,11,0.08)',
    dangerDim:   'rgba(239,68,68,0.08)',
    infoDim:     'rgba(59,130,246,0.08)',
    brandDimSolid: '#FF6A0015',

    // ── Tab bar ──
    tabActive:   '#FF6A00',
    tabInactive: '#8B9DB5',  // updated from #64748B for AA compliance
    tabBg:       '#141C26',
  },

  fonts: {
    // Web equivalent in comments. Use Expo Google Fonts for exact match.
    head:         'Georgia',         // → Cormorant Garamond (headings/display)
    display:      'Georgia',         // → Cormorant Garamond (editorial)
    body:         undefined,         // → Inter (System/SF Pro/Roboto)
    bodyMedium:   undefined,         // → Inter 500
    bodySemiBold: undefined,         // → Inter 600
    mono:         'Courier New',     // → JetBrains Mono (data/numbers/labels)
  },

  fontWeight: {
    display:  '700' as const,
    headline: '600' as const,
    body:     '400' as const,
    light:    '300' as const,
  },

  // ── Typography scale (matches web tokens.js fontSize) ──
  fontSize: {
    h1:        28,   // mobile: 28px (web: 28→48px responsive)
    h2:        22,
    h3:        18,
    bodyLarge: 16,
    body:      14,
    caption:   12,
    micro:     10,
    mono:      11,   // data labels, metrics
  },

  // ── Spacing (8px base grid — matches web) ──
  spacing: {
    xs:  8,
    sm:  16,
    md:  24,
    lg:  32,
    xl:  48,
    xxl: 64,
  },

  // ── Border radius ──
  radius: {
    sm:     8,
    md:     12,
    lg:     16,
    button: 14,
    card:   16,
    full:   999,
  },

  // ── Shadows ──
  shadow: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.3,
      shadowRadius: 2,
      elevation: 2,
    },
    card: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.35,
      shadowRadius: 24,
      elevation: 8,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 16 },
      shadowOpacity: 0.45,
      shadowRadius: 40,
      elevation: 16,
    },
  },

  // ── Touch targets (WCAG 2.1 minimum 44×44px) ──
  touch: {
    minHeight: 44,
    minWidth:  44,
  },
};

export type Theme = typeof theme;

// ── Design token helpers ──────────────────────────────────────────────────────

/** Card/panel base style — use everywhere a dark panel is needed */
export const cardStyle = {
  backgroundColor: theme.colors.bgCard,
  borderRadius: theme.radius.card,
  borderWidth: 1,
  borderColor: theme.colors.border,
};

/** Input base style */
export const inputStyle = {
  backgroundColor: theme.colors.bgInput,
  borderRadius: theme.radius.md,
  borderWidth: 1,
  borderColor: theme.colors.border,
  color: theme.colors.text,
  fontSize: theme.fontSize.body,
  minHeight: theme.touch.minHeight,
  paddingHorizontal: theme.spacing.sm,
};

/** Brand CTA button style */
export const ctaButtonStyle = {
  backgroundColor: theme.colors.brand,
  borderRadius: theme.radius.button,
  minHeight: theme.touch.minHeight,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};
