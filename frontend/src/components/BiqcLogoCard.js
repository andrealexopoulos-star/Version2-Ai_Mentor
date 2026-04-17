import React from 'react';
import { Link } from 'react-router-dom';

/**
 * BiqcLogoCard — brushed-metal silver "BIQc.ai" hover card.
 *
 * Recreates the BIQc.ai brand card in pure CSS + SVG so it ships with the
 * bundle (no PNG upload needed). Used on Login / Register / Reset / Update
 * auth pages and anywhere we want a prominent brand moment.
 *
 * Props:
 *   size       — 'sm' | 'md' | 'lg'   (default 'md')
 *   subtitle   — string or false      (default "Cognition as a Platform")
 *   tagline    — string or null       (smaller text under subtitle — off by default)
 *   to         — route path for the wrapping Link  (default '/')
 *   className  — extra classes
 *   static     — boolean              (disable hover animation; default false)
 */
const BiqcLogoCard = ({
  size = 'md',
  subtitle = 'Cognition as a Platform',
  tagline = null,
  to = '/',
  className = '',
  static: isStatic = false,
}) => {
  const sizes = {
    sm: { w: 180, h: 72,  titleSize: 22, subSize: 10, pad: 14, radius: 12 },
    md: { w: 260, h: 104, titleSize: 32, subSize: 12, pad: 18, radius: 16 },
    lg: { w: 340, h: 138, titleSize: 44, subSize: 14, pad: 24, radius: 20 },
  };
  const s = sizes[size] || sizes.md;

  const inner = (
    <div
      className={`biqc-logo-card ${isStatic ? 'is-static' : ''} ${className}`}
      style={{
        width: s.w,
        height: s.h,
        borderRadius: s.radius,
        padding: s.pad,
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'flex-start',
        /* Brushed-metal silver gradient — horizontal sheen + diagonal shimmer */
        background: `
          linear-gradient(135deg,
            rgba(255,255,255,0.15) 0%,
            rgba(255,255,255,0) 40%,
            rgba(10,10,10,0.08) 60%,
            rgba(255,255,255,0.1) 100%),
          linear-gradient(90deg,
            #8B909B 0%,
            #C4C8D0 18%,
            #A9AEB8 38%,
            #D8DCE1 58%,
            #9FA4AE 78%,
            #B8BDC7 100%)
        `,
        boxShadow: `
          0 14px 40px rgba(10,10,10,0.18),
          0 4px 14px rgba(10,10,10,0.12),
          inset 0 1px 0 rgba(255,255,255,0.4),
          inset 0 -1px 0 rgba(10,10,10,0.2)
        `,
        transition: 'transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.35s cubic-bezier(0.2, 0.8, 0.2, 1)',
        cursor: to ? 'pointer' : 'default',
        textDecoration: 'none',
      }}
    >
      {/* Horizontal brushed-metal striations — subtle noise via repeating gradient */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `repeating-linear-gradient(
          90deg,
          rgba(255,255,255,0.02) 0px,
          rgba(255,255,255,0.02) 1px,
          rgba(10,10,10,0.03) 1px,
          rgba(10,10,10,0.03) 2px
        )`,
        pointerEvents: 'none',
        mixBlendMode: 'overlay',
      }} />

      {/* Bottom-right orange accent triangle (matches reference card) */}
      <div style={{
        position: 'absolute',
        bottom: 0, right: 0,
        width: s.w * 0.22,
        height: s.h * 0.42,
        background: 'linear-gradient(135deg, transparent 50%, #E85D00 50%, #FF7A1A 100%)',
        opacity: 0.85,
        borderBottomRightRadius: s.radius,
        pointerEvents: 'none',
      }} />

      {/* Title row */}
      <div style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        position: 'relative',
        zIndex: 2,
      }}>
        <span style={{
          fontFamily: '"Geist", -apple-system, sans-serif',
          fontSize: s.titleSize,
          fontWeight: 800,
          letterSpacing: '-0.04em',
          color: '#0A0A0A',
          lineHeight: 1,
          textShadow: '0 1px 0 rgba(255,255,255,0.3)',
        }}>
          BIQc
        </span>
        <span style={{
          display: 'inline-block',
          width: Math.max(5, s.titleSize * 0.15),
          height: Math.max(5, s.titleSize * 0.15),
          borderRadius: '50%',
          background: '#E85D00',
          boxShadow: '0 0 6px rgba(232,93,0,0.6)',
          margin: `0 ${s.titleSize * 0.08}px ${s.titleSize * 0.12}px`,
        }} />
        <span style={{
          fontFamily: '"Geist", -apple-system, sans-serif',
          fontSize: s.titleSize,
          fontWeight: 800,
          letterSpacing: '-0.04em',
          color: '#0A0A0A',
          lineHeight: 1,
          textShadow: '0 1px 0 rgba(255,255,255,0.3)',
        }}>
          ai
        </span>
      </div>

      {/* Subtitle */}
      {subtitle && (
        <span style={{
          fontFamily: '"Geist", -apple-system, sans-serif',
          fontSize: s.subSize,
          fontWeight: 500,
          letterSpacing: '0.02em',
          color: 'rgba(10,10,10,0.7)',
          marginTop: 6,
          position: 'relative',
          zIndex: 2,
        }}>
          {subtitle}
        </span>
      )}

      {tagline && (
        <span style={{
          fontFamily: '"Geist", -apple-system, sans-serif',
          fontSize: s.subSize - 1,
          fontWeight: 400,
          letterSpacing: '0.01em',
          color: 'rgba(10,10,10,0.5)',
          marginTop: 2,
          position: 'relative',
          zIndex: 2,
        }}>
          {tagline}
        </span>
      )}

      {/* Hover styles — float + tilt + deepen shadow */}
      <style>{`
        .biqc-logo-card:not(.is-static):hover {
          transform: translateY(-4px) rotate(-0.4deg);
          box-shadow:
            0 24px 60px rgba(10,10,10,0.22),
            0 8px 20px rgba(10,10,10,0.14),
            0 0 0 1px rgba(232,93,0,0.15),
            inset 0 1px 0 rgba(255,255,255,0.5),
            inset 0 -1px 0 rgba(10,10,10,0.2);
        }
      `}</style>
    </div>
  );

  if (to) {
    return (
      <Link to={to} style={{ display: 'inline-block', textDecoration: 'none' }} data-testid="biqc-logo-card">
        {inner}
      </Link>
    );
  }
  return inner;
};

export default BiqcLogoCard;
