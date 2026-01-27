import { AlertCircle, X } from 'lucide-react';
import { Button } from '../components/ui/button';
import { BIQC_LANGUAGE } from '../constants/biqcLanguage';

/**
 * Degraded Intelligence Banner
 * 
 * Shows when onboarding is incomplete and user chose to skip.
 * Non-blocking - allows full app navigation.
 */
const DegradedIntelligenceBanner = ({ onComplete, onDismiss }) => {
  return (
    <div 
      className="bg-amber-50 border-b border-amber-200 px-4 py-3"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-900">
              {BIQC_LANGUAGE.ONBOARDING.DEGRADED_BANNER}
            </p>
            <button 
              onClick={onComplete}
              className="text-xs text-amber-700 hover:text-amber-900 underline"
            >
              {BIQC_LANGUAGE.ONBOARDING.DEGRADED_LINK}
            </button>
          </div>
        </div>
        {onDismiss && (
          <button 
            onClick={onDismiss}
            className="text-amber-600 hover:text-amber-800 flex-shrink-0"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

export default DegradedIntelligenceBanner;
