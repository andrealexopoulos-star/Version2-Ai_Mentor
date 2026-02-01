import { useState, useEffect, useRef } from 'react';

/**
 * IntelligenceSimulation Component
 * Rotates leadership thoughts continuously
 * NO BIQC mention, NO system language
 */
const IntelligenceSimulation = () => {
  const [displayLines, setDisplayLines] = useState([]);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [currentCharIndex, setCurrentCharIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const timeoutRef = useRef(null);

  // Leadership thoughts - rotate continuously
  const lines = [
    "Something important is forming — you just haven't named it yet.",
    "Growth feels good… until capacity starts to strain quietly.",
    "Some decisions get delayed because the full picture isn't clear.",
    "Risk rarely announces itself. It builds slowly.",
    "Opportunities show up before they're obvious.",
    "Being busy isn't the same as being in control.",
    "Most problems are visible earlier — if someone's watching.",
    "Staying ahead is about noticing patterns, not working harder."
  ];

  const pauses = [1800, 1900, 1800, 1700, 1700, 1800, 1900, 2000];

  useEffect(() => {
    if (currentLineIndex >= lines.length) {
      const completeTimeout = setTimeout(() => setIsComplete(true), 0);
      return () => clearTimeout(completeTimeout);
    }

    const currentLine = lines[currentLineIndex];

    if (currentCharIndex < currentLine.length) {
      timeoutRef.current = setTimeout(() => {
        const newDisplayLines = [...displayLines];
        newDisplayLines[currentLineIndex] = currentLine.slice(0, currentCharIndex + 1);
        setDisplayLines(newDisplayLines);
        setCurrentCharIndex(currentCharIndex + 1);
      }, 50 + Math.random() * 20);
    } else {
      timeoutRef.current = setTimeout(() => {
        setCurrentLineIndex(currentLineIndex + 1);
        setCurrentCharIndex(0);
      }, pauses[currentLineIndex] || 1800);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [currentLineIndex, currentCharIndex, displayLines, lines, pauses]);

  return (
    <div className="relative">
      <div 
        className="rounded-2xl border border-slate-700 bg-slate-900/95 backdrop-blur-sm shadow-2xl overflow-hidden"
        style={{
          minHeight: '440px'
        }}
      >
        <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-700 bg-slate-800/50">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
            <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
          </div>
          <span className="text-xs text-slate-400 ml-2 font-medium">BIQC Intelligence</span>
        </div>

        <div className="px-6 sm:px-8 py-6 sm:py-8">
          <div 
            className="font-mono text-sm leading-relaxed min-h-[360px]"
            style={{
              paddingBottom: '2rem'
            }}
          >
            {displayLines.map((line, index) => (
              <div key={index} className="mb-3 text-slate-300">
                {line}
                {index === currentLineIndex && currentCharIndex < lines[currentLineIndex].length && (
                  <span className="inline-block w-2 h-4 bg-blue-500 ml-1 animate-pulse"></span>
                )}
              </div>
            ))}
            {isComplete && (
              <div className="mt-6 pt-6 border-t border-slate-700">
                <p className="text-slate-500 text-xs">Analysis complete</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default IntelligenceSimulation;
