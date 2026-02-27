/**
 * BIQc Design System — Unified Components
 * Used by Marketing, Platform, Mobile Web, and App.
 * Single source. No duplication.
 */
import React from 'react';
import { fontFamily, fontSize, fontSizeClass, fontWeight, colors, radius, radiusClass, shadow, spacing, headingStyle, headingStyleWhite, gridOverlay } from './tokens';

// ═══ HEADING — Unified across all surfaces ═══
export const Heading = ({ level = 1, children, className = '', white = false, style = {} }) => {
  const Tag = `h${level}`;
  const sizeMap = { 1: fontSizeClass.h1, 2: fontSizeClass.h2, 3: fontSizeClass.h3 };
  const weightMap = { 1: 'font-bold', 2: 'font-semibold', 3: 'font-semibold' };
  const baseStyle = white ? headingStyleWhite : headingStyle;

  return (
    <Tag
      className={`${sizeMap[level] || sizeMap[1]} ${weightMap[level] || 'font-bold'} leading-tight tracking-tight ${className}`}
      style={{ ...baseStyle, ...style }}
    >
      {children}
    </Tag>
  );
};

// ═══ CARD — Unified card container ═══
export const Card = ({ children, className = '', hover = false, style = {}, ...props }) => (
  <div
    className={`${radiusClass.card} p-4 sm:p-6 ${hover ? 'transition-all duration-300 hover:-translate-y-0.5' : ''} ${className}`}
    style={{
      background: colors.bgCard,
      border: `1px solid ${colors.border}`,
      ...(hover ? { boxShadow: shadow.card } : {}),
      ...style,
    }}
    {...props}
  >
    {children}
  </div>
);

// ═══ BUTTON — Unified button across marketing + platform ═══
export const DSButton = ({
  children, onClick, href, variant = 'primary', size = 'md', disabled = false,
  className = '', style = {}, ...props
}) => {
  const variants = {
    primary: { background: `linear-gradient(135deg, ${colors.brand}, ${colors.brandDark})`, color: '#fff', boxShadow: shadow.brandGlow },
    secondary: { background: colors.bgCard, color: colors.text, border: `1px solid ${colors.border}` },
    ghost: { background: 'transparent', color: colors.textMuted, border: `1px solid ${colors.border}` },
    danger: { background: colors.dangerDim, color: colors.danger, border: `1px solid ${colors.danger}30` },
  };
  const sizes = {
    sm: 'h-9 px-4 text-xs',
    md: 'h-11 px-6 text-sm',
    lg: 'h-12 px-8 text-base',
  };

  const baseClass = `inline-flex items-center justify-center gap-2 ${radiusClass.button} font-semibold transition-all hover:brightness-110 disabled:opacity-50 ${sizes[size]} ${className}`;

  if (href) {
    return (
      <a href={href} className={baseClass} style={{ ...variants[variant], fontFamily: fontFamily.body, ...style }} {...props}>
        {children}
      </a>
    );
  }

  return (
    <button onClick={onClick} disabled={disabled} className={baseClass} style={{ ...variants[variant], fontFamily: fontFamily.body, ...style }} {...props}>
      {children}
    </button>
  );
};

// ═══ STAT BLOCK — Unified stat display ═══
export const StatBlock = ({ value, label }) => (
  <div className="text-center">
    <div className={`${fontSizeClass.h2} mb-1`} style={{ fontFamily: fontFamily.display, color: colors.brand, fontWeight: fontWeight.display, lineHeight: 1.1 }}>
      {value}
    </div>
    <div className="text-[10px] sm:text-xs tracking-widest uppercase" style={{ fontFamily: fontFamily.mono, color: `${colors.textSecondary}99`, fontWeight: fontWeight.body, lineHeight: 1.4 }}>
      {label}
    </div>
  </div>
);

// ═══ SECTION CONTAINER ═══
export const Section = ({ children, className = '', padY = 'xl', bg, style = {}, ...props }) => {
  const padMap = { sm: 'py-8 sm:py-12', md: 'py-12 sm:py-16', lg: 'py-16 sm:py-20', xl: 'py-16 sm:py-24' };
  return (
    <section className={`${padMap[padY] || padMap.xl} ${className}`} style={{ background: bg, ...style }} {...props}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        {children}
      </div>
    </section>
  );
};

// ═══ GLOW WRAPPER — Desktop only, removed on mobile ═══
export const GlowWrapper = ({ children, className = '' }) => (
  <div className={`relative ${className}`}>
    {/* Glow: desktop only */}
    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full hidden sm:block" style={{ background: `radial-gradient(circle, ${colors.brand} 0%, transparent 70%)`, opacity: 0.08 }} />
    {/* Grid: reduced opacity on mobile */}
    <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '64px 64px', opacity: 'var(--grid-opacity, 0.03)' }}>
      <style>{`@media(max-width:768px){[style*="--grid-opacity"]{--grid-opacity:0.01 !important}}`}</style>
    </div>
    <div className="relative z-10">{children}</div>
  </div>
);

// ═══ NAVBAR HEIGHT CONSTANT ═══
export const NAV_HEIGHT = 56;

// ═══ ICON CONTAINER — Fixed size, never stretched ═══
export const IconBox = ({ icon: Icon, color, size = 40, iconSize = 20, className = '' }) => (
  <div className={`rounded-xl flex items-center justify-center shrink-0 ${className}`} style={{ width: size, height: size, minWidth: size, background: `${color}15` }}>
    <Icon style={{ width: iconSize, height: iconSize, color }} />
  </div>
);
