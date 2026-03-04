/**
 * BIQc Mobile Theme
 * Mirrors web design system tokens exactly.
 */
export const theme = {
  colors: {
    bg: '#0F1720',
    bgCard: '#141C26',
    bgInput: '#0A1018',
    bgElevated: '#1A2332',
    border: '#243140',
    borderFocus: '#FF6A00',
    text: '#F4F7FA',
    textSecondary: '#9FB0C3',
    textMuted: '#64748B',
    brand: '#FF6A00',
    brandDark: '#E85D00',
    brandDim: 'rgba(255,106,0,0.15)',
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    info: '#3B82F6',
    purple: '#7C3AED',
    successDim: 'rgba(16,185,129,0.08)',
    warningDim: 'rgba(245,158,11,0.08)',
    dangerDim: 'rgba(239,68,68,0.08)',
    infoDim: 'rgba(59,130,246,0.08)',
  },
  fonts: {
    head: 'System',
    display: 'System',
    body: 'System',
    bodyMedium: 'System',
    bodySemiBold: 'System',
    mono: 'System',
  },
  spacing: { xs: 8, sm: 16, md: 24, lg: 32, xl: 48, xxl: 64 },
  fontSize: { h1: 28, h2: 22, h3: 18, bodyLarge: 16, body: 14, caption: 12, micro: 10 },
  radius: { sm: 8, md: 12, lg: 16, button: 14, full: 999 },
  shadow: {
    card: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 24, elevation: 8 },
  },
  touch: { minHeight: 44, minWidth: 44 },
};

export type Theme = typeof theme;
