import { useState, useEffect, useRef, useCallback } from 'react';

const HEADING = "'Cormorant Garamond', Georgia, serif";
const MONO = "'JetBrains Mono', monospace";
const BODY = "'Inter', sans-serif";

const VARIANTS = [
  {
    label: 'Australian Owned & Operated',
    headline: (
      <>
        BIQc is the stability layer that unifies your business systems and converts fragmented data into structured, decision-ready intelligence.
      </>
    ),
    lines: [
      'One platform across your tools.',
      'One continuous view of risk, pressure, and opportunity.',
      'Built to protect performance and drive disciplined growth.',
    ],
  },
  {
    label: 'Australian Owned & Operated',
    headline: (
      <>
        BIQc is a unified intelligence layer that sits above your systems — detecting instability, modelling consequence, and strengthening leadership decisions.
      </>
    ),
    lines: [
      'A single platform for sustained operational stability and strategic control.',
    ],
  },
  {
    label: 'Australian Owned & Operated',
    headline: (
      <>
        BIQc integrates your financial, revenue, operational, and market systems into one continuous intelligence framework.
      </>
    ),
    lines: [
      'It reveals where pressure is building, how it will spread, and whether your decisions are strengthening the business.',
      '',
      'Designed to protect, stabilise, and strengthen growing organisations.',
    ],
  },
  {
    label: 'Australian Owned & Operated',
    headline: (
      <>
        BIQc is the stability engine for modern businesses.
      </>
    ),
    lines: [
      'It connects your systems, detects emerging risk, and measures the real impact of leadership decisions.',
      '',
      'One integrated platform.',
      'Continuous stability intelligence.',
      'Compounding growth.',
    ],
  },
];

const EASING = 'cubic-bezier(0.42, 0.0, 0.2, 1)';
const DESKTOP_TRANSLATE = 80;
const MOBILE_TRANSLATE = 40;
const DESKTOP_DURATION = 1100;
const MOBILE_DURATION = 900;
const INTERVAL = 10000;

const HeroLayer = ({ variant, state, isMobile }) => {
  const translate = isMobile ? MOBILE_TRANSLATE : DESKTOP_TRANSLATE;
  const duration = isMobile ? MOBILE_DURATION : DESKTOP_DURATION;

  let transform, opacity, transition;

  if (state === 'active') {
    transform = 'translateX(0px)';
    opacity = 1;
    transition = `transform ${duration}ms ${EASING}, opacity ${duration}ms ${EASING}`;
  } else if (state === 'exiting') {
    transform = `translateX(${translate}px)`;
    opacity = 0;
    // Opacity fades slightly slower than transform but finishes by duration
    transition = `transform ${duration}ms ${EASING}, opacity ${duration + 50}ms ${EASING}`;
  } else if (state === 'entering') {
    transform = 'translateX(0px)';
    opacity = 1;
    // Opacity starts 100ms after transform
    transition = `transform ${duration}ms ${EASING}, opacity ${duration}ms ${EASING} 100ms`;
  } else if (state === 'staged') {
    transform = `translateX(-${translate}px)`;
    opacity = 0;
    transition = 'none';
  } else {
    // hidden
    transform = `translateX(-${translate}px)`;
    opacity = 0;
    transition = 'none';
  }

  return (
    <div
      data-state={state}
      className="absolute inset-0 flex flex-col items-center justify-center text-center"
      style={{
        transform,
        opacity,
        transition,
        willChange: 'transform, opacity',
        pointerEvents: state === 'active' ? 'auto' : 'none',
      }}
    >
      <p
        className="text-sm sm:text-lg max-w-2xl mx-auto mb-3 sm:mb-5 leading-relaxed"
        style={{ fontFamily: BODY, color: '#9FB0C3' }}
      >
        {variant.headline}
      </p>
      <div className="max-w-xl mx-auto">
        {variant.lines.map((line, i) =>
          line === '' ? (
            <div key={i} className="h-2" />
          ) : (
            <p
              key={i}
              className="text-sm sm:text-base leading-relaxed"
              style={{ fontFamily: BODY, color: '#9FB0C3' }}
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
  const [current, setCurrent] = useState(0);
  const [next, setNext] = useState(null);
  const [phase, setPhase] = useState('idle'); // idle | transitioning
  const [isMobile, setIsMobile] = useState(false);
  const [paused, setPaused] = useState(false);
  const containerRef = useRef(null);
  const timerRef = useRef(null);
  const visibleRef = useRef(true);
  const hoverRef = useRef(false);
  const inViewRef = useRef(true);

  // Detect mobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Visibility API
  useEffect(() => {
    const handler = () => {
      visibleRef.current = !document.hidden;
      checkPause();
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);

  // IntersectionObserver
  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        inViewRef.current = entry.isIntersecting;
        checkPause();
      },
      { threshold: 0.35 }
    );
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const checkPause = useCallback(() => {
    const shouldPause = !visibleRef.current || !inViewRef.current || hoverRef.current;
    setPaused(shouldPause);
  }, []);

  // Main rotation timer
  useEffect(() => {
    if (paused || phase === 'transitioning') {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    timerRef.current = setInterval(() => {
      triggerTransition();
    }, INTERVAL);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [paused, phase, current]);

  const triggerTransition = useCallback(() => {
    const nextIdx = (current + 1) % VARIANTS.length;
    setNext(nextIdx);
    setPhase('transitioning');

    const duration = isMobile ? MOBILE_DURATION : DESKTOP_DURATION;

    // After transition completes
    setTimeout(() => {
      setCurrent(nextIdx);
      setNext(null);
      setPhase('idle');
    }, duration + 150);
  }, [current, isMobile]);

  const handleMouseEnter = () => {
    hoverRef.current = true;
    checkPause();
  };
  const handleMouseLeave = () => {
    hoverRef.current = false;
    checkPause();
  };

  // Compute min-height to prevent layout shift
  // Conservative fixed height matching current hero block
  const minHeight = isMobile ? 180 : 160;

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden"
      style={{ minHeight: `${minHeight}px` }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      data-testid="hero-rotator"
    >
      {/* Active layer */}
      <HeroLayer
        variant={VARIANTS[current]}
        state={phase === 'transitioning' ? 'exiting' : 'active'}
        isMobile={isMobile}
      />

      {/* Incoming layer */}
      {next !== null && (
        <HeroLayer
          variant={VARIANTS[next]}
          state={phase === 'transitioning' ? 'entering' : 'staged'}
          isMobile={isMobile}
        />
      )}
    </div>
  );
};

export default LiquidSteelHeroRotator;
