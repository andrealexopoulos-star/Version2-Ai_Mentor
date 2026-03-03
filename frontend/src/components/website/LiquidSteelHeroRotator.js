import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const BODY = "'Inter', sans-serif";
const HEADING = "'Cormorant Garamond', Georgia, serif";

// Premium sheen reserved. Not approved.

// Parse **word** markers into orange-highlighted spans
const RichText = ({ text, className, style }) => {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return (
    <span className={className} style={style}>
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**') ? (
          <span key={i} style={{ color: '#FF6A00' }}>{part.slice(2, -2)}</span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
};

const VARIANTS = [
  {
    h1: 'BIQc — A Single **Stability Engine** Across All Departments & Tools',
    h2: 'Unify fragmented business tools, data and departments into structured decision ready intelligence',
  },
  {
    h1: '**Integrates** your Financials, Operational, Sales & Marketing Systems Into **One Intelligence Layer**',
    h2: 'BIQc connects your systems, detects emerging risk, and measures the real impact of leadership decisions.',
  },
  {
    h1: 'BIQc — **Intelligence** Above Your Systems',
    h2: 'Detect instability, constantly learning from every past and present to strengthen your business decisions',
  },
];

// Fixed viewport: H1 + gap + H2 only (prefix/bullets moved to CTA block)
const VIEWPORT_HEIGHT_DESKTOP = 260;
const VIEWPORT_HEIGHT_MOBILE = 300;

const EASING = 'cubic-bezier(0.42, 0, 0.2, 1)';
const INTERVAL = 12000;

const HeroLayer = ({ variant, phase, isMobile, zIndex }) => {
  const tx = isMobile ? 30 : 60;
  const dur = isMobile ? 900 : 1000;

  let layerStyle;
  if (phase === 'current-static') {
    layerStyle = { transform: 'translateX(0px)', opacity: 1, transition: 'none', zIndex };
  } else if (phase === 'current-exiting') {
    layerStyle = { transform: `translateX(${tx}px)`, opacity: 0, transition: `transform ${dur}ms ${EASING}, opacity 600ms ease-out 200ms`, zIndex };
  } else if (phase === 'next-staged') {
    layerStyle = { transform: `translateX(-${tx}px)`, opacity: 0, transition: 'none', zIndex };
  } else if (phase === 'next-entering') {
    layerStyle = { transform: 'translateX(0px)', opacity: 1, transition: `transform ${dur}ms ${EASING}, opacity 600ms ease-in 200ms`, zIndex };
  }

  return (
    <div
      className="hero-layer"
      style={{
        position: 'absolute', top: 0, left: 0, width: '100%',
        willChange: 'transform, opacity',
        pointerEvents: phase === 'current-static' ? 'auto' : 'none',
        ...layerStyle,
      }}
    >
      {/* H1 */}
      <h1
        className="text-[26px] sm:text-[40px] lg:text-[52px] font-bold leading-[1.12] mb-6 sm:mb-10 tracking-tight max-w-[900px] mx-auto px-4"
        style={{ fontFamily: HEADING, color: '#FFFFFF', textShadow: '0 2px 20px rgba(255,255,255,0.15), 0 1px 8px rgba(0,0,0,0.5)' }}
      >
        <RichText text={variant.h1} />
      </h1>

      {/* H2 — plain text, no orange highlights */}
      {variant.h2 && (
        <h2
          className="text-[14px] sm:text-[19px] lg:text-[22px] max-w-2xl mx-auto leading-[1.5] px-4"
          style={{ fontFamily: BODY, color: '#9FB0C3' }}
        >
          {variant.h2}
        </h2>
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

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    const onVis = () => { pausedRef.current = document.hidden; };
    document.addEventListener('visibilitychange', onVis);
    let obs;
    if (viewportRef.current) {
      obs = new IntersectionObserver(([e]) => { if (!e.isIntersecting) pausedRef.current = true; }, { threshold: 0.35 });
      obs.observe(viewportRef.current);
    }
    return () => { document.removeEventListener('visibilitychange', onVis); if (obs) obs.disconnect(); };
  }, []);

  // Reset and start auto timer
  const startAutoTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (pausedRef.current || hoverRef.current) {
        timerRef.current = setTimeout(() => startAutoTimer(), 1000);
        return;
      }
      goTo((activeIndex + 1) % VARIANTS.length);
    }, INTERVAL);
  }, [activeIndex]);

  useEffect(() => {
    if (!transitioning) startAutoTimer();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [activeIndex, transitioning, startAutoTimer]);

  // Transition to a specific index
  const goTo = useCallback((targetIdx) => {
    if (transitioning || targetIdx === activeIndex) return;
    if (timerRef.current) clearTimeout(timerRef.current);

    setNextIndex(targetIdx);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTransitioning(true);
      });
    });
  }, [transitioning, activeIndex]);

  // Transition completion
  useEffect(() => {
    if (!transitioning || nextIndex === null) return;
    const dur = isMobile ? 900 : 1000;
    transTimerRef.current = setTimeout(() => {
      setActiveIndex(nextIndex);
      setNextIndex(null);
      setTransitioning(false);
    }, dur + 600);
    return () => { if (transTimerRef.current) clearTimeout(transTimerRef.current); };
  }, [transitioning, nextIndex, isMobile]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (transTimerRef.current) clearTimeout(transTimerRef.current);
    };
  }, []);

  const goNext = () => goTo((activeIndex + 1) % VARIANTS.length);
  const goPrev = () => goTo((activeIndex - 1 + VARIANTS.length) % VARIANTS.length);

  const vpHeight = isMobile ? VIEWPORT_HEIGHT_MOBILE : VIEWPORT_HEIGHT_DESKTOP;

  return (
    <div
      ref={viewportRef}
      className="hero-viewport relative"
      style={{ overflow: 'hidden', width: '100%', maxWidth: 960, margin: '0 auto', minHeight: vpHeight, height: vpHeight }}
      onMouseEnter={() => { hoverRef.current = true; }}
      onMouseLeave={() => { hoverRef.current = false; }}
      data-testid="hero-viewport"
    >
      {/* Current layer */}
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

      {/* Manual navigation arrows */}
      <button
        onClick={goPrev}
        data-testid="hero-prev"
        className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all duration-200"
        style={{
          zIndex: 5,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          color: '#9FB0C3',
          opacity: transitioning ? 0.3 : 0.6,
          pointerEvents: transitioning ? 'none' : 'auto',
        }}
        onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = 'rgba(255,106,0,0.1)'; e.currentTarget.style.borderColor = 'rgba(255,106,0,0.3)'; e.currentTarget.style.color = '#FF6A00'; }}
        onMouseLeave={e => { e.currentTarget.style.opacity = '0.6'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#9FB0C3'; }}
        aria-label="Previous hero"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>

      <button
        onClick={goNext}
        data-testid="hero-next"
        className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all duration-200"
        style={{
          zIndex: 5,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          color: '#9FB0C3',
          opacity: transitioning ? 0.3 : 0.6,
          pointerEvents: transitioning ? 'none' : 'auto',
        }}
        onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = 'rgba(255,106,0,0.1)'; e.currentTarget.style.borderColor = 'rgba(255,106,0,0.3)'; e.currentTarget.style.color = '#FF6A00'; }}
        onMouseLeave={e => { e.currentTarget.style.opacity = '0.6'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#9FB0C3'; }}
        aria-label="Next hero"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
};

export default LiquidSteelHeroRotator;
