import { useState, useEffect, useRef } from 'react';

/**
 * TypingInsights Component
 * Displays insights with typing → pause → delete → loop animation
 * CONSTITUTION-BOUND: Only displays existing, constitution-compliant insights
 */
const TypingInsights = ({ insights = [] }) => {
  const [displayText, setDisplayText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const timeoutRef = useRef(null);

  // Filter for valid insights only
  const validInsights = insights.filter(insight => 
    insight && 
    typeof insight === 'string' && 
    insight.trim().length > 0
  );

  useEffect(() => {
    // Abort if no valid insights
    if (validInsights.length === 0) {
      setDisplayText('');
      return;
    }

    const currentInsight = validInsights[currentIndex];
    const fullText = currentInsight;

    const typeCharacter = () => {
      setDisplayText(prev => {
        if (prev.length < fullText.length) {
          return fullText.slice(0, prev.length + 1);
        }
        // Typing complete - pause
        setIsTyping(false);
        setIsPaused(true);
        timeoutRef.current = setTimeout(() => {
          setIsPaused(false);
          startDeleting();
        }, 2000); // Pause for 2 seconds
        return prev;
      });
    };

    const startDeleting = () => {
      const deleteCharacter = () => {
        setDisplayText(prev => {
          if (prev.length > 0) {
            return prev.slice(0, -1);
          }
          // Deletion complete - move to next insight
          setIsTyping(true);
          setCurrentIndex((prevIndex) => (prevIndex + 1) % validInsights.length);
          return '';
        });
      };

      timeoutRef.current = setInterval(deleteCharacter, 20); // Faster delete
    };

    if (isTyping && !isPaused && displayText.length < fullText.length) {
      timeoutRef.current = setTimeout(typeCharacter, 50); // Human cadence typing
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        clearInterval(timeoutRef.current);
      }
    };
  }, [displayText, isTyping, isPaused, currentIndex, validInsights]);

  if (validInsights.length === 0) {
    return null;
  }

  return (
    <div className="min-h-[60px] flex items-center">
      <p 
        className="text-sm leading-relaxed"
        style={{ color: 'var(--text-secondary)' }}
      >
        {displayText}
        <span className="inline-block w-0.5 h-4 ml-1 bg-blue-600 animate-pulse" />
      </p>
    </div>
  );
};

export default TypingInsights;
