import { useState, useEffect, useRef } from 'react';

const BODY = "'Inter', sans-serif";

// Premium sheen reserved. Not approved.

const VARIANTS = [
  {
    headline: 'BIQc is the stability layer that unifies your business systems and converts fragmented data into structured, decision-ready intelligence.',
    lines: [
      'One platform across your tools.',
      'One continuous view of risk, pressure, and opportunity.',
      'Built to protect performance and drive disciplined growth.',
    ],
  },
  {
    headline: 'BIQc is a unified intelligence layer that sits above your systems — detecting instability, modelling consequence, and strengthening leadership decisions.',
    lines: [
      'A single platform for sustained operational stability and strategic control.',
    ],
  },
  {
    headline: 'BIQc integrates your financial, revenue, operational, and market systems into one continuous intelligence framework.',
    lines: [
      'It reveals where pressure is building, how it will spread, and whether your decisions are strengthening the business.',
      '',
      'Designed to protect, stabilise, and strengthen growing organisations.',
    ],
  },
  {
    headline: 'BIQc is the stability engine for modern businesses.',
    lines: [
      'It connects your systems, detects emerging risk, and measures the real impact of leadership decisions.',
      '',
      'One integrated platform.',
      'Continuous stability intelligence.',
      'Compounding growth.',
    ],
  },
];

// Fixed heights measured to contain tallest variant (Variant 3/4 with 5 lines)
// Desktop: headline ~48px + gap 12px + 5 lines * 24px + padding = ~190px
// Mobile: headline ~64px + gap 12px + 5 lines * 22px + padding = ~200px
const VIEWPORT_HEIGHT_DESKTOP = 190;
const VIEWPORT_HEIGHT_MOBILE = 200;

const EASING = 'cubic-bezier(0.42, 0, 0.2, 1)';

const HeroLayer = ({ variant, phase, isMobile, zIndex }) => {
  const tx = isMobile ? 30 : 60;
  const dur = isMobile ? 900 : 1000;

  let style;

  if (phase === 'current-static') {
    style = {
      transform: 'translateX(0px)',
      opacity: 1,
      transition: 'none',
      zIndex,
    };
  } else if (phase === 'current-exiting') {
    style = {
      transform: `translateX(${tx}px)`,
      opacity: 0,
      transition: `transform ${dur}ms ${EASING}, opacity 600ms ease-out 200ms`,
      zIndex,
    };
  } else if (phase === 'next-staged') {
    // Positioned off-left, invisible, no transition
    style = {
      transform: `translateX(-${tx}px)`,
      opacity: 0,
      transition: 'none',
      zIndex,
    };
  } else if (phase === 'next-entering') {
    style = {
      transform: 'translateX(0px)',
      opacity: 1,
      transition: `transform ${dur}ms ${EASING}, opacity 600ms ease-in 200ms`,
      zIndex,
    };
  }

  return (
    <div
      className="hero-layer"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        willChange: 'transform, opacity',
        pointerEvents: phase === 'current-static' ? 'auto' : 'none',
        ...style,
      }}
    >
      <p
        className="text-sm sm:text-lg max-w-2xl mx-auto mb-3 leading-relaxed"
        style={{ fontFamily: BODY, color: '#9FB0C3', lineHeight: '1.6' }}
      >
        {variant.headline}
      </p>
      <div className="max-w-xl mx-auto">
        {variant.lines.map((line, i) =>
          line === '' ? (
            <div key={i} style={{ height: 8 }} />
          ) : (
            <p
              key={i}
              className="text-sm sm:text-base"
              style={{ fontFamily: BODY, color: '#9FB0C3', lineHeight: '1.6' }}
            >
              {line}
            </p>
          )
        )}
      </div>
    </div>
  );
};

export const LiquidSteelHeroRotator = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const [nextIndex, setNextIndex] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const timerRef = useRef(null);
  const transTimerRef = useRef(null);
  const viewportRef = useRef(null);
  const pausedRef = useRef(false);
  const hoverRef = useRef(false);

  // Detect mobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Visibility + IntersectionObserver pause
  useEffect(() => {
    const onVis = () => { pausedRef.current = document.hidden; };
    document.addEventListener('visibilitychange', onVis);

    let obs;
    if (viewportRef.current) {
      obs = new IntersectionObserver(
        ([e]) => { if (!e.isIntersecting) pausedRef.current = true; },
        { threshold: 0.35 }
      );
      obs.observe(viewportRef.current);
    }

    return () => {
      document.removeEventListener('visibilitychange', onVis);
      if (obs) obs.disconnect();
    };
  }, []);

  // Main rotation: 8000ms static display, then trigger transition
  useEffect(() => {
    if (transitioning) return;

    timerRef.current = setTimeout(() => {
      if (pausedRef.current || hoverRef.current) {
        // Retry in 1s if paused
        timerRef.current = setTimeout(() => {
          setActiveIndex(prev => prev);
        }, 1000);
        return;
      }

      const ni = (activeIndex + 1) % VARIANTS.length;

      // Stage the next layer off-screen first
      setNextIndex(ni);
      // On next frame, begin transition (so CSS sees the staged position first)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTransitioning(true);
        });
      });
    }, 8000);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [activeIndex, transitioning]);

  // Transition completion: swap at 1600ms
  useEffect(() => {
    if (!transitioning || nextIndex === null) return;

    const dur = isMobile ? 900 : 1000;
    transTimerRef.current = setTimeout(() => {
      setActiveIndex(nextIndex);
      setNextIndex(null);
      setTransitioning(false);
    }, dur + 600); // Movement (1000ms) + opacity overlap (600ms)

    return () => { if (transTimerRef.current) clearTimeout(transTimerRef.current); };
  }, [transitioning, nextIndex, isMobile]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (transTimerRef.current) clearTimeout(transTimerRef.current);
    };
  }, []);

  const vpHeight = isMobile ? VIEWPORT_HEIGHT_MOBILE : VIEWPORT_HEIGHT_DESKTOP;

  return (
    <div
      ref={viewportRef}
      className="hero-viewport"
      style={{
        position: 'relative',
        overflow: 'hidden',
        width: '100%',
        maxWidth: 920,
        margin: '0 auto',
        minHeight: vpHeight,
        height: vpHeight,
      }}
      onMouseEnter={() => { hoverRef.current = true; }}
      onMouseLeave={() => { hoverRef.current = false; }}
      data-testid="hero-viewport"
    >
      {/* Current layer — always rendered */}
      <HeroLayer
        variant={VARIANTS[activeIndex]}
        phase={transitioning ? 'current-exiting' : 'current-static'}
        isMobile={isMobile}
        zIndex={1}
      />

      {/* Next layer — only in DOM during transition */}
      {nextIndex !== null && (
        <HeroLayer
          variant={VARIANTS[nextIndex]}
          phase={transitioning ? 'next-entering' : 'next-staged'}
          isMobile={isMobile}
          zIndex={2}
        />
      )}
    </div>
  );
};

export default LiquidSteelHeroRotator;
