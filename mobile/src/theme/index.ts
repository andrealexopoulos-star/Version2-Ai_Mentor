/**
 * BIQc Liquid Steel Theme — React Native
 * Matches web app exactly.
 */
export const theme = {
  colors: {
    // Backgrounds
    bg: '#0F1720',
    bgCard: '#141C26',
    bgInput: '#0A1018',
    bgHover: 'rgba(255,255,255,0.02)',

    // Borders
    border: '#243140',
    borderFocus: '#FF6A00',

    // Text
    text: '#F4F7FA',
    textSecondary: '#9FB0C3',
    textMuted: '#64748B',

    // Brand
    brand: '#FF6A00',
    brandDim: 'rgba(255,106,0,0.15)',

    // Status
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    info: '#3B82F6',
    purple: '#7C3AED',

    // Transparent overlays
    successDim: 'rgba(16,185,129,0.08)',
    warningDim: 'rgba(245,158,11,0.08)',
    dangerDim: 'rgba(239,68,68,0.08)',
    infoDim: 'rgba(59,130,246,0.08)',
  },

  fonts: {
    head: 'Cormorant-SemiBold',
    body: 'Inter-Regular',
    bodyMedium: 'Inter-Medium',
    bodySemiBold: 'Inter-SemiBold',
    mono: 'JetBrainsMono-Regular',
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },

  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    full: 999,
  },

  shadow: {
    card: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 3,
    },
  },
};

export type Theme = typeof theme;
