import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { AlertCircle, Zap, ArrowRight, SkipForward } from 'lucide-react';
import { BIQC_LANGUAGE } from '../constants/biqcLanguage';

/**
 * Onboarding Intelligence Gate
 * 
 * Shows when onboarding is incomplete.
 * Provides user choice rather than forced redirect.
 * 
 * Behavior:
 * - Primary action: Continue onboarding
 * - Secondary action: Skip (limited intelligence mode)
 * - Does NOT block access to features
 */
const OnboardingGate = ({ onSkip, onContinue }) => {
  const navigate = useNavigate();
  const [skipping, setSkipping] = useState(false);

  const handleContinue = () => {
    if (onContinue) {
      onContinue();
    } else {
      navigate('/onboarding');
    }
  };

  const handleSkip = () => {
    setSkipping(true);
    if (onSkip) {
      onSkip();
    }
    // Allow app access with degraded intelligence banner
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div 
        className="max-w-md w-full rounded-2xl p-8 shadow-2xl"
        style={{ background: 'var(--bg-card)' }}
      >
        {/* Icon */}
        <div 
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
          style={{ background: 'linear-gradient(135deg, rgba(0, 102, 255, 0.1) 0%, rgba(99, 102, 241, 0.1) 100%)' }}
        >
          <Zap className="w-8 h-8" style={{ color: 'var(--accent-primary)' }} />
        </div>

        {/* Title */}
        <h2 
          className="text-2xl font-serif text-center mb-4"
          style={{ color: 'var(--text-primary)' }}
        >
          {BIQC_LANGUAGE.ONBOARDING.GATE_TITLE}
        </h2>

        {/* Body */}
        <p 
          className="text-center mb-8"
          style={{ color: 'var(--text-secondary)' }}
        >
          {BIQC_LANGUAGE.ONBOARDING.GATE_BODY}
        </p>

        {/* Actions */}
        <div className="space-y-3">
          <Button
            onClick={handleContinue}
            className="w-full btn-primary"
          >
            <ArrowRight className="w-4 h-4 mr-2" />
            {BIQC_LANGUAGE.ONBOARDING.GATE_PRIMARY}
          </Button>

          <Button
            onClick={handleSkip}
            disabled={skipping}
            variant="outline"
            className="w-full btn-secondary"
          >
            <SkipForward className="w-4 h-4 mr-2" />
            {skipping ? 'Entering limited mode...' : BIQC_LANGUAGE.ONBOARDING.GATE_SECONDARY}
          </Button>
        </div>

        {/* Info */}
        <div 
          className="mt-6 p-4 rounded-lg flex items-start gap-3"
          style={{ background: 'rgba(251, 191, 36, 0.1)' }}
        >
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-700">
            Limited intelligence mode allows app access but reduces confidence and accuracy of insights.
          </p>
        </div>
      </div>
    </div>
  );
};

export default OnboardingGate;
