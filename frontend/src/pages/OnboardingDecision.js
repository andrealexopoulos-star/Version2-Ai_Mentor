import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Sparkles, ArrowRight, Clock } from 'lucide-react';

const OnboardingDecision = () => {
  const navigate = useNavigate();

  const handleStartOnboarding = () => {
    // Clear any deferral flag
    sessionStorage.removeItem('onboarding_deferred');
    navigate('/onboarding', { replace: true });
  };

  const handleDefer = () => {
    // Set session-only deferral flag
    sessionStorage.setItem('onboarding_deferred', 'true');
    navigate('/advisor', { replace: true });
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'var(--bg-secondary)' }}
    >
      <Card className="max-w-2xl w-full">
        <CardContent className="p-8 md:p-12">
          {/* Header */}
          <div className="text-center mb-8">
            <div 
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: 'var(--accent-primary)' }}
            >
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h1 
              className="text-2xl md:text-3xl font-serif mb-3"
              style={{ color: 'var(--text-primary)' }}
            >
              Welcome to BIQC
            </h1>
            <p 
              className="text-base md:text-lg"
              style={{ color: 'var(--text-secondary)' }}
            >
              Let's set up your intelligent advisor
            </p>
          </div>

          {/* Description */}
          <div 
            className="mb-8 p-4 rounded-lg"
            style={{ background: 'var(--bg-tertiary)' }}
          >
            <p 
              className="text-sm md:text-base leading-relaxed"
              style={{ color: 'var(--text-secondary)' }}
            >
              BIQC learns about your business to provide personalized intelligence. 
              This 5-minute setup helps us understand your context and deliver relevant insights.
            </p>
          </div>

          {/* Decision Options */}
          <div className="space-y-4">
            {/* Option 1: Complete Now */}
            <button
              onClick={handleStartOnboarding}
              className="w-full p-6 rounded-xl border-2 text-left transition-all hover:border-blue-600 hover:bg-blue-50 group"
              style={{ 
                borderColor: 'var(--border-light)',
                background: 'var(--bg-primary)'
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <Sparkles className="w-5 h-5 text-blue-600" />
                    <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                      Complete Setup Now
                    </h3>
                  </div>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    5 minutes to unlock personalized intelligence and insights
                  </p>
                </div>
                <ArrowRight className="w-6 h-6 text-blue-600 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>

            {/* Option 2: Later (Session-Only) */}
            <button
              onClick={handleDefer}
              className="w-full p-6 rounded-xl border text-left transition-all hover:border-gray-300 hover:bg-gray-50"
              style={{ 
                borderColor: 'var(--border-light)',
                background: 'var(--bg-primary)'
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <Clock className="w-5 h-5 text-gray-400" />
                    <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                      I'll Do This Later
                    </h3>
                  </div>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    You'll be asked again next time you sign in
                  </p>
                </div>
                <ArrowRight className="w-6 h-6 text-gray-400" />
              </div>
            </button>
          </div>

          {/* Disclaimer */}
          <p 
            className="text-xs text-center mt-6"
            style={{ color: 'var(--text-muted)' }}
          >
            You can complete this anytime from Settings
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default OnboardingDecision;
