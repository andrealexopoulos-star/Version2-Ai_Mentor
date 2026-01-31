import { useState, useEffect, useRef } from 'react';

/**
 * IntelligenceSimulation Component
 * Simulates BIQC analyzing a business scenario
 * Shows: observation → understanding → insight → recommendation
 * Deliberate, executive-grade interaction
 */
const IntelligenceSimulation = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [displayText, setDisplayText] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const timeoutRef = useRef(null);

  // Intelligence progression - actual BIQC reasoning pattern
  const steps = [
    {
      text: "Analyzing business signals...",
      pause: 1400,
      type: "system"
    },
    {
      text: "Revenue growing 22% quarter-on-quarter.",
      pause: 1200,
      type: "observation"
    },
    {
      text: "Cash reserves declining despite revenue growth.",
      pause: 1600,
      type: "observation"
    },
    {
      text: "Payment terms extended to close deals faster.",
      pause: 1800,
      type: "observation",
      editMoment: true  // This step will be refined
    },
    {
      text: "Payment terms extended — sacrificing cash timing to win deals.",
      pause: 2000,
      type: "observation"
    },
    {
      text: "This is not a revenue problem.",
      pause: 1600,
      type: "understanding"
    },
    {
      text: "Growth is outpacing cash collection velocity.",
      pause: 2200,
      type: "insight"
    },
    {
      text: "Recommended focus: Restructure payment terms, not new sales.",
      pause: 2400,
      type: "recommendation"
    }
  ];

  useEffect(() => {
    if (currentStep >= steps.length) {
      setIsComplete(true);
      return;
    }

    const step = steps[currentStep];
    const chars = step.text.split('');
    let charIndex = 0;

    const typeCharacter = () => {
      if (charIndex < chars.length) {
        setDisplayText(prev => {
          const current = prev === null || prev === undefined ? '' : prev;
          return current + chars[charIndex];
        });
        charIndex++;
        timeoutRef.current = setTimeout(typeCharacter, 50 + Math.random() * 20);
      } else {
        // Typing complete - pause before next step
        timeoutRef.current = setTimeout(() => {
          setDisplayText(prev => {
            const current = prev === null || prev === undefined ? '' : prev;
            return current + '\n\n';
          });
          setCurrentStep(prev => prev + 1);
        }, step.pause);
      }
    };

    typeCharacter();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [currentStep]);

  return (
    <div className="relative">
      <div 
        className="rounded-2xl border border-slate-700 bg-slate-900/95 backdrop-blur-sm shadow-2xl overflow-hidden"
        style={{
          minHeight: '420px'
        }}
      >
        {/* Terminal-style header */}
        <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-700 bg-slate-800/50">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
            <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
          </div>
          <span className="text-xs text-slate-400 ml-2 font-medium">BIQC Intelligence Engine</span>
        </div>

        {/* Typed content - with proper padding to prevent clipping */}
        <div className="px-6 sm:px-8 py-6 sm:py-8 pb-8">
          <div 
            className="text-sm leading-relaxed"
            style={{
              fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
              color: '#e2e8f0',
              lineHeight: '1.7',
              fontSize: '14px',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              WebkitFontSmoothing: 'antialiased',
              MozOsxFontSmoothing: 'grayscale',
              maxWidth: '100%',
              overflowWrap: 'break-word',
              paddingBottom: '8px'  // Prevent descender clipping
            }}
          >
            {displayText || ''}
            {!isComplete && (
              <span 
                className="inline-block ml-1 bg-blue-400 animate-pulse" 
                style={{
                  width: '8px',
                  height: '16px',
                  verticalAlign: 'text-bottom'
                }}
              />
            )}
          </div>
        </div>

        {/* Completion state */}
        {isComplete && (
          <div className="px-6 sm:px-8 pb-6 sm:pb-8">
            <div className="pt-6 border-t border-slate-700 animate-fade-in">
              <p 
                className="text-xs italic"
                style={{
                  color: '#94a3b8',
                  lineHeight: '1.6'
                }}
              >
                This is how BIQC thinks. Continuously. About your business.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Subtle glow effect */}
      <div 
        className="absolute inset-0 rounded-2xl -z-10 opacity-40"
        style={{
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(147, 51, 234, 0.15))',
          filter: 'blur(40px)'
        }}
      ></div>
    </div>
  );
};

export default IntelligenceSimulation;
