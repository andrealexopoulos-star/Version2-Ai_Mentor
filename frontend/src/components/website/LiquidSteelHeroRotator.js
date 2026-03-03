import { useState, useEffect, useRef } from 'react';

const BODY = "'Inter', sans-serif";

// Premium sheen reserved. Not approved.

const HEADING = "'Cormorant Garamond', Georgia, serif";

const VARIANTS = [
  {
    h1: 'A Single Stability Engine Across All Departments & Tools',
    h2: 'BIQc unifies your business systems and converts fragmented data into structured decision ready intelligence.',
    bullets: [
      'One platform across all your tools.',
      'One continuous view of risk, pressure, and opportunity.',
      'Built to protect performance and drive disciplined growth.',
    ],
    prefix: null,
    inlineBullets: null,
  },
  {
    h1: 'BIQc integrates your financial, revenue, operational, and marketing systems into one continuous intelligence framework.',
    h2: 'It reveals where pressure is building, how it will spread, and whether your decisions are strengthening the business.',
    bullets: null,
    prefix: 'Continuously Learning & Designed to;',
    inlineBullets: ['Protect', 'Stabilise', 'Strengthen'],
  },
  {
    h1: 'BIQc is the stability engine for modern businesses.',
    h2: 'It connects your systems, detects emerging risk, and measures the real impact of leadership decisions.',
    bullets: null,
    prefix: null,
    inlineBullets: null,
    taglines: [
      'One integrated platform.',
      'Continuous stability intelligence.',
      'Compounding growth.',
    ],
  },
];

// Fixed heights: tallest variant is Hero 2 (long H1 + H2 + prefix + inline bullets)
const VIEWPORT_HEIGHT_DESKTOP = 270;
const VIEWPORT_HEIGHT_MOBILE = 340;

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
        className="text-[22px] sm:text-3xl lg:text-[34px] font-bold leading-[1.2] mb-3 sm:mb-4 tracking-tight max-w-3xl mx-auto"
        style={{ fontFamily: HEADING, color: '#FFFFFF', textShadow: '0 1px 8px rgba(0,0,0,0.5)' }}
      >
        {variant.h1}
      </h1>
      <h2
        className="text-sm sm:text-base lg:text-lg max-w-2xl mx-auto mb-4 leading-relaxed"
        style={{ fontFamily: BODY, color: '#9FB0C3', lineHeight: '1.6' }}
      >
        {variant.h2}
      </h2>

      {/* Bullet points with orange ticks */}
      {variant.bullets && (
        <div className="flex flex-col items-center gap-1.5 sm:gap-2">
          {variant.bullets.map((b, i) => (
            <div key={i} className="flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none"><path d="M13.3 4.3L6.5 11.1 2.7 7.3" stroke="#FF6A00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <span className="text-xs sm:text-sm" style={{ fontFamily: BODY, color: '#9FB0C3' }}>{b}</span>
            </div>
          ))}
        </div>
      )}

      {/* Prefix + inline orange tick words */}
      {variant.prefix && variant.inlineBullets && (
        <div className="flex flex-col items-center gap-2">
          <span className="text-xs sm:text-sm" style={{ fontFamily: BODY, color: '#9FB0C3' }}>{variant.prefix}</span>
          <div className="flex items-center gap-4 sm:gap-6">
            {variant.inlineBullets.map((word, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none"><path d="M13.3 4.3L6.5 11.1 2.7 7.3" stroke="#FF6A00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                <span className="text-sm sm:text-base font-semibold" style={{ fontFamily: BODY, color: '#FF6A00' }}>{word}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Taglines */}
      {variant.taglines && (
        <div className="flex flex-col items-center gap-0.5">
          {variant.taglines.map((line, i) => (
            <span key={i} className="text-xs sm:text-sm font-medium" style={{ fontFamily: BODY, color: '#9FB0C3', opacity: 0.8 }}>{line}</span>
          ))}
        </div>
      )}
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
