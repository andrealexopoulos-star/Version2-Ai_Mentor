import { useState, useEffect, useRef } from 'react';

/**
 * NarrativeTypewriter Component
 * Natural, human-paced typewriter for BIQC narrative
 * Triggers only on meaningful context changes
 */
const NarrativeTypewriter = ({ 
  text, 
  trigger, 
  onComplete = () => {},
  speed = 40 // slower, more deliberate
}) => {
  const [displayText, setDisplayText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const timeoutRef = useRef(null);
  const lastTriggerRef = useRef(null);

  useEffect(() => {
    // Only retype if trigger has meaningfully changed
    if (trigger === lastTriggerRef.current) {
      // Same trigger - show full text immediately
      setDisplayText(text);
      return;
    }

    // New trigger detected - start typing
    lastTriggerRef.current = trigger;
    setDisplayText('');
    setIsTyping(true);

    let currentIndex = 0;

    const typeNextChar = () => {
      if (currentIndex < text.length) {
        setDisplayText(text.slice(0, currentIndex + 1));
        currentIndex++;
        
        // Variable speed - pause at punctuation for natural rhythm
        const char = text[currentIndex - 1];
        const delay = char === '.' ? 300 : char === ',' ? 150 : speed;
        
        timeoutRef.current = setTimeout(typeNextChar, delay);
      } else {
        // Typing complete
        setIsTyping(false);
        onComplete();
      }
    };

    typeNextChar();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [text, trigger, speed, onComplete]);

  return (
    <div className="min-h-[80px]">
      <p 
        className="text-base leading-relaxed font-serif"
        style={{ 
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-display)'
        }}
      >
        {displayText}
        {isTyping && (
          <span 
            className="inline-block w-0.5 h-5 ml-1 bg-gray-400"
            style={{ animation: 'pulse 1s ease-in-out infinite' }}
          />
        )}
      </p>
    </div>
  );
};

export default NarrativeTypewriter;
