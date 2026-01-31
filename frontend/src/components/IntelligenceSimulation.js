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
      pause: 1200,
      type: "system"
    },
    {
      text: "Revenue growing 22% but cash reserves declining.",
      pause: 1800,
      type: "observation"
    },
    {
      text: "Client acquisition strong. Payment terms extended to win deals.",
      pause: 1600,
      type: "observation"
    },
    {
      text: "This isn't a revenue problem.",
      pause: 1400,
      type: "understanding",
      emphasis: true
    },
    {
      text: "Growth is outpacing collection velocity. Cash timing mismatch creating pressure.",
      pause: 2000,
      type: "insight"
    },
    {
      text: "Recommended focus: Payment terms restructure, not new sales.",
      pause: 2200,
      type: "recommendation",
      final: true
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
        setDisplayText(prev => prev + chars[charIndex]);
        charIndex++;
        // Human-like typing cadence (40-60ms per character)
        timeoutRef.current = setTimeout(typeCharacter, 45 + Math.random() * 15);
      } else {
        // Typing complete - pause before next step
        timeoutRef.current = setTimeout(() => {
          setDisplayText(prev => prev + '\n\n');
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
        className="rounded-2xl border p-8 sm:p-10 bg-slate-900/95 backdrop-blur-sm shadow-2xl"
        style={{
          minHeight: '400px',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
        }}
      >
        {/* Terminal-style header */}
        <div className="flex items-center gap-2 mb-6 pb-4 border-b border-slate-700">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
            <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
          </div>
          <span className="text-xs text-slate-400 ml-2">BIQC Intelligence Engine</span>
        </div>

        {/* Typed content */}
        <div className="space-y-4">
          <pre 
            className="text-sm leading-relaxed whitespace-pre-wrap"
            style={{
              color: '#e2e8f0',
              fontFamily: 'inherit'
            }}
          >
            {displayText}
            {!isComplete && <span className="inline-block w-2 h-4 ml-1 bg-blue-400 animate-pulse" />}
          </pre>
        </div>

        {/* Completion state */}
        {isComplete && (
          <div className="mt-8 pt-6 border-t border-slate-700 animate-fade-in">
            <p className="text-xs text-slate-400 italic">
              This is how BIQC thinks. Continuously. About your business.
            </p>
          </div>
        )}
      </div>

      {/* Subtle glow effect */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 blur-xl -z-10"></div>
    </div>
  );
};

export default IntelligenceSimulation;
