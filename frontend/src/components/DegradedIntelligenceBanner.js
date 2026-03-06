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
      className="px-4 py-3 sm:py-4"
      style={{
        background: '#F5F1E8',
        borderBottom: '1px solid #E8DCC8'
      }}
    >
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#F59E0B' }} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium leading-relaxed" style={{ color: '#78350F' }}>
                {BIQC_LANGUAGE.ONBOARDING.DEGRADED_BANNER}
              </p>
              <button 
                onClick={onComplete}
                className="text-xs font-medium mt-1 hover:underline"
                style={{ color: '#F59E0B' }}
              >
                {BIQC_LANGUAGE.ONBOARDING.DEGRADED_LINK}
              </button>
            </div>
          </div>
          {onDismiss && (
            <button 
              onClick={onDismiss}
              className="flex-shrink-0 p-1 rounded hover:bg-black/5 transition-colors self-start sm:self-auto"
              aria-label="Dismiss"
              style={{ color: '#F59E0B' }}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default DegradedIntelligenceBanner;
