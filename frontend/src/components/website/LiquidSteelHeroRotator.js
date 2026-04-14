import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { fontFamily } from '../../design-system/tokens';


// Parse **word** for orange and //word// for italic
const RichText = ({ text, style }) => {
  const parts = text.split(/(\*\*.*?\*\*|\/\/.*?\/\/)/g);
  return (
    <span style={style}>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) return <span key={i} style={{ color: '#C65F2E', fontWeight: 500 }}>{part.slice(2, -2)}</span>;
        if (part.startsWith('//') && part.endsWith('//')) return <em key={i} style={{ fontStyle: 'italic' }}>{part.slice(2, -2)}</em>;
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
};

const VARIANTS = [
  {
    h1: 'A Single **Intelligence Layer** Across Your Entire Business',
    h2: 'Ask BIQc unifies fragmented tools, teams, and data into one executive decision system.',
  },
  {
    h1: 'Meet //Ask BIQc// - Your **Flagship Decision Council**',
    h2: 'Run CEO, Finance Manager, and Marketing Manager perspectives in one live boardroom before risk compounds.',
  },
  {
    h1: 'Turn Reactive Firefighting Into **Evidence-Led Execution**',
    h2: 'Detect instability early, prioritize what matters now, and act with confidence.',
  },
];

const VIEWPORT_HEIGHT_DESKTOP = 260;
const VIEWPORT_HEIGHT_MOBILE = 300;
const INTERVAL = 8000;

const HeroLayer = ({ variant, phase, zIndex }) => {
  let layerStyle;
  if (phase === 'current-static') {
    layerStyle = { opacity: 1, transition: 'none', zIndex };
  } else if (phase === 'current-exiting') {
    layerStyle = { opacity: 0, transition: 'opacity 1200ms ease-in-out', zIndex };
  } else if (phase === 'next-staged') {
    layerStyle = { opacity: 0, transition: 'none', zIndex };
  } else if (phase === 'next-entering') {
    layerStyle = { opacity: 1, transition: 'opacity 1200ms ease-in-out', zIndex };
  }

  return (
    <div className="hero-layer" style={{
      position: 'absolute', top: 0, left: 0, width: '100%',
      willChange: 'opacity', pointerEvents: phase === 'current-static' ? 'auto' : 'none',
      ...layerStyle,
    }}>
      <h1 className="text-[22px] sm:text-[32px] lg:text-[40px] xl:text-[44px] leading-[1.18] mb-5 tracking-tight max-w-[800px] mx-auto px-4"
        style={{ fontFamily: fontFamily.body, fontWeight: 400, color: '#E6EEF7', letterSpacing: '-0.01em' }}>
        <RichText text={variant.h1} />
      </h1>
      {variant.h2 && (
        <h2 className="text-[13px] sm:text-[16px] lg:text-[18px] max-w-xl mx-auto leading-[1.6] px-4"
          style={{ fontFamily: fontFamily.body, fontWeight: 300, color: 'var(--ink-secondary, #8FA0B8)' }}>
          <RichText text={variant.h2} />
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

  const startAutoTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (pausedRef.current || hoverRef.current) { timerRef.current = setTimeout(() => startAutoTimer(), 1000); return; }
      goTo((activeIndex + 1) % VARIANTS.length);
    }, INTERVAL);
  }, [activeIndex]);

  useEffect(() => {
    if (!transitioning) startAutoTimer();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [activeIndex, transitioning, startAutoTimer]);

  const goTo = useCallback((targetIdx) => {
    if (transitioning || targetIdx === activeIndex) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    setNextIndex(targetIdx);
    requestAnimationFrame(() => { requestAnimationFrame(() => { setTransitioning(true); }); });
  }, [transitioning, activeIndex]);

  useEffect(() => {
    if (!transitioning || nextIndex === null) return;
    transTimerRef.current = setTimeout(() => {
      setActiveIndex(nextIndex);
      setNextIndex(null);
      setTransitioning(false);
    }, 1400);
    return () => { if (transTimerRef.current) clearTimeout(transTimerRef.current); };
  }, [transitioning, nextIndex]);

  useEffect(() => { return () => { if (timerRef.current) clearTimeout(timerRef.current); if (transTimerRef.current) clearTimeout(transTimerRef.current); }; }, []);

  const goNext = () => goTo((activeIndex + 1) % VARIANTS.length);
  const goPrev = () => goTo((activeIndex - 1 + VARIANTS.length) % VARIANTS.length);
  const vpHeight = isMobile ? VIEWPORT_HEIGHT_MOBILE : VIEWPORT_HEIGHT_DESKTOP;

  return (
    <div ref={viewportRef} className="hero-viewport relative"
      style={{ overflow: 'hidden', width: '100%', maxWidth: 960, margin: '0 auto', minHeight: vpHeight, height: vpHeight }}
      onMouseEnter={() => { hoverRef.current = true; }} onMouseLeave={() => { hoverRef.current = false; }}
      data-testid="hero-viewport">
      <HeroLayer variant={VARIANTS[activeIndex]} phase={transitioning ? 'current-exiting' : 'current-static'} zIndex={1} />
      {nextIndex !== null && <HeroLayer variant={VARIANTS[nextIndex]} phase={transitioning ? 'next-entering' : 'next-staged'} zIndex={2} />}
      <button onClick={goPrev} data-testid="hero-prev" aria-label="Previous"
        className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200"
        style={{ zIndex: 5, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: 'var(--ink-secondary, #8FA0B8)', opacity: transitioning ? 0.2 : 0.4, pointerEvents: transitioning ? 'none' : 'auto' }}
        onMouseEnter={e => { e.currentTarget.style.opacity = '0.8'; e.currentTarget.style.borderColor = 'rgba(198,95,46,0.3)'; e.currentTarget.style.color = '#C65F2E'; }}
        onMouseLeave={e => { e.currentTarget.style.opacity = '0.4'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'var(--ink-secondary, #8FA0B8)'; }}>
        <ChevronLeft className="w-5 h-5" />
      </button>
      <button onClick={goNext} data-testid="hero-next" aria-label="Next"
        className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200"
        style={{ zIndex: 5, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: 'var(--ink-secondary, #8FA0B8)', opacity: transitioning ? 0.2 : 0.4, pointerEvents: transitioning ? 'none' : 'auto' }}
        onMouseEnter={e => { e.currentTarget.style.opacity = '0.8'; e.currentTarget.style.borderColor = 'rgba(198,95,46,0.3)'; e.currentTarget.style.color = '#C65F2E'; }}
        onMouseLeave={e => { e.currentTarget.style.opacity = '0.4'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'var(--ink-secondary, #8FA0B8)'; }}>
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
};

export default LiquidSteelHeroRotator;
