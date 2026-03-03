import { useState, useEffect, useRef } from 'react';

const BODY = "'Inter', sans-serif";

// Premium sheen reserved. Not approved.

const HEADING = "'Cormorant Garamond', Georgia, serif";

const VARIANTS = [
  {
    h1: 'The stability layer for your business.',
    h2: 'Unifies systems. Converts fragmented data into decision-ready intelligence.',
    lines: [
      'One platform. One view of risk, pressure, and opportunity.',
    ],
  },
  {
    h1: 'Intelligence above your systems.',
    h2: 'Detects instability. Models consequence. Strengthens decisions.',
    lines: [
      'Sustained operational stability and strategic control.',
    ],
  },
  {
    h1: 'One continuous intelligence framework.',
    h2: 'Financial, revenue, operational, and market systems — integrated.',
    lines: [
      'Reveals pressure. Forecasts spread. Measures decision impact.',
    ],
  },
  {
    h1: 'The stability engine for modern business.',
    h2: 'Connects systems. Detects risk. Measures leadership impact.',
    lines: [
      'One platform. Continuous intelligence. Compounding growth.',
    ],
  },
];

// Fixed heights: H1 (~50px) + H2 (~28px) + 1 line (~24px) + margins
const VIEWPORT_HEIGHT_DESKTOP = 160;
const VIEWPORT_HEIGHT_MOBILE = 180;

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
      <h1
        className="text-[24px] sm:text-3xl lg:text-4xl font-bold leading-[1.2] mb-3 sm:mb-4 tracking-tight max-w-3xl mx-auto"
        style={{ fontFamily: HEADING, color: '#FFFFFF', textShadow: '0 1px 8px rgba(0,0,0,0.5)' }}
      >
        {variant.h1}
      </h1>
      <h2
        className="text-sm sm:text-lg max-w-2xl mx-auto mb-2 sm:mb-3 leading-relaxed"
        style={{ fontFamily: BODY, color: '#9FB0C3', lineHeight: '1.6' }}
      >
        {variant.h2}
      </h2>
      <div className="max-w-xl mx-auto">
        {variant.lines.map((line, i) => (
          <p
            key={i}
            className="text-sm sm:text-base"
            style={{ fontFamily: BODY, color: '#9FB0C3/70', lineHeight: '1.6', opacity: 0.7 }}
          >
            {line}
          </p>
        ))}
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
