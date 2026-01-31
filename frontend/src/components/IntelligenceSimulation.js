import { useState, useEffect, useRef } from 'react';

/**
 * IntelligenceSimulation Component
 * Simulates BIQC analyzing a business scenario
 * NO undefined concatenation, NO clipping, executive feel
 */
const IntelligenceSimulation = () => {
  const [displayLines, setDisplayLines] = useState([]);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [currentCharIndex, setCurrentCharIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const timeoutRef = useRef(null);

  // Intelligence progression - BIQC reasoning pattern
  const lines = [
    "Analyzing business signals...",
    "Revenue growing 22% quarter-on-quarter.",
    "Cash reserves declining despite revenue growth.",
    "Payment terms extended to close deals faster.",
    "This is not a revenue problem.",
    "Growth is outpacing cash collection velocity.",
    "Recommended focus: Restructure payment terms, not new sales."
  ];

  const pauses = [1400, 1300, 1600, 1400, 1600, 1800, 2400];

  useEffect(() => {
    if (currentLineIndex >= lines.length) {
      setIsComplete(true);
      return;
    }

    const currentLine = lines[currentLineIndex];
    const currentDisplayLine = displayLines[currentLineIndex] || '';

    if (currentCharIndex < currentLine.length) {
      // Type next character
      timeoutRef.current = setTimeout(() => {
        const newDisplayLines = [...displayLines];
        newDisplayLines[currentLineIndex] = currentLine.slice(0, currentCharIndex + 1);
        setDisplayLines(newDisplayLines);
        setCurrentCharIndex(currentCharIndex + 1);
      }, 50 + Math.random() * 20);
    } else {
      // Line complete - pause then move to next
      timeoutRef.current = setTimeout(() => {
        setCurrentLineIndex(currentLineIndex + 1);
        setCurrentCharIndex(0);
      }, pauses[currentLineIndex] || 1500);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [currentLineIndex, currentCharIndex, displayLines]);

  return (
    <div className="relative">
      <div 
        className="rounded-2xl border border-slate-700 bg-slate-900/95 backdrop-blur-sm shadow-2xl overflow-hidden"
        style={{
          minHeight: '440px'
        }}
      >
        {/* Terminal header */}
        <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-700 bg-slate-800/50">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
            <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
          </div>
          <span className="text-xs text-slate-400 ml-2 font-medium">BIQC Intelligence Engine</span>
        </div>

        {/* Content area with proper padding to prevent clipping */}
        <div className="px-6 sm:px-8 py-6 sm:py-8">
          <div 
            style={{
              fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
              fontSize: '14px',
              lineHeight: '1.8',
              color: '#e2e8f0',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              WebkitFontSmoothing: 'antialiased',
              MozOsxFontSmoothing: 'grayscale',
              maxWidth: '100%',
              overflowWrap: 'break-word',
              paddingBottom: '12px',
              minHeight: '280px'
            }}
          >
            {displayLines.map((line, index) => (
              <div key={index} style={{ marginBottom: index < displayLines.length - 1 ? '16px' : '0' }}>
                {line}
              </div>
            ))}
            {!isComplete && (
              <span 
                className="inline-block ml-1 bg-blue-400 animate-pulse" 
                style={{
                  width: '8px',
                  height: '18px',
                  verticalAlign: 'text-bottom'
                }}
              />
            )}
          </div>
        </div>

        {/* Completion message */}
        {isComplete && (
          <div className="px-6 sm:px-8 pb-6 sm:pb-8">
            <div className="pt-6 border-t border-slate-700">
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

      {/* Glow effect */}
      <div 
        className="absolute inset-0 rounded-2xl -z-10"
        style={{
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(147, 51, 234, 0.15))',
          filter: 'blur(40px)',
          opacity: 0.4
        }}
      ></div>
    </div>
  );
};

export default IntelligenceSimulation;
