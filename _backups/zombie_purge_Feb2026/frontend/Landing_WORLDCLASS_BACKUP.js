import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { ArrowRight, Zap, Shield, Brain, TrendingUp, Check } from 'lucide-react';

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white">
      
      {/* Header - Authority & Restraint */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-gray-900">BIQC</span>
          </div>
          
          <div className="hidden md:flex items-center gap-6 text-sm">
            <a href="#platform" className="text-gray-600 hover:text-gray-900 transition-colors font-medium">Platform</a>
            <a href="#security" className="text-gray-600 hover:text-gray-900 transition-colors font-medium">Security</a>
            <button onClick={() => navigate('/pricing')} className="text-gray-600 hover:text-gray-900 transition-colors font-medium">Pricing</button>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate('/login-supabase')}
              className="text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors px-4 h-9 hidden sm:block"
            >
              Sign in
            </button>
            <Button
              onClick={() => navigate('/register-supabase')}
              className="bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium px-5 h-9 rounded-lg"
            >
              Start free
            </Button>
          </div>
        </div>
      </header>

      {/* Hero - Authority First */}
      <section className="pt-16 sm:pt-24 pb-12 sm:pb-20 px-5 sm:px-6">
        <div className="max-w-3xl mx-auto text-center">
          
          {/* Authority Statement */}
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-gray-900 tracking-tight leading-[1.15] mb-5 sm:mb-6 px-2">
            Business intelligence that learns your business
          </h1>
          
          {/* Value Proposition - One Line */}
          <p className="text-base sm:text-lg text-gray-600 mb-8 sm:mb-10 max-w-2xl mx-auto leading-relaxed px-2">
            BIQC continuously learns from your emails, calendar, and documents to deliver precise, personalised strategic advice.
          </p>
          
          {/* Single Decisive CTA */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center px-2">
            <Button
              onClick={() => navigate('/register-supabase')}
              className="bg-gray-900 hover:bg-gray-800 text-white px-8 h-12 text-base font-medium rounded-lg w-full sm:w-auto max-w-xs sm:max-w-none"
            >
              Start free
            </Button>
            <button
              onClick={() => document.getElementById('platform')?.scrollIntoView({ behavior: 'smooth' })}
              className="text-sm text-gray-600 hover:text-gray-900 font-medium hidden sm:inline-block"
            >
              See how it works →
            </button>
          </div>
          
          {/* Trust Signal - Minimal */}
          <p className="text-xs text-gray-500 mt-6 sm:mt-8">
            No credit card required • Enterprise-grade security
          </p>
          
        </div>
      </section>

      {/* Platform Overview - Minimalist Cards */}
      <section id="platform" className="py-12 sm:py-20 px-5 sm:px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          
          <div className="max-w-2xl mb-12 sm:mb-16 text-center mx-auto px-2">
            <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-3 sm:mb-4 tracking-tight">
              Intelligence that compounds over time
            </h2>
            <p className="text-base text-gray-600 leading-relaxed">
              BIQC builds persistent understanding of your business.
            </p>
          </div>

          {/* Features - Material Design Card Grid */}
          <div className="grid sm:grid-cols-2 gap-4 sm:gap-6 px-2">
            
            {/* Card 1 */}
            <div className="group bg-white rounded-xl p-6 sm:p-8 border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all duration-200">
              <div className="flex items-start gap-4">
                <div className="inline-flex items-center justify-center w-11 h-11 bg-blue-50 rounded-lg flex-shrink-0 group-hover:bg-blue-100 transition-colors">
                  <Brain className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-1.5">
                    Learns your business
                  </h3>
                  <p className="text-gray-600 leading-relaxed text-sm sm:text-[15px]">
                    Integrates emails, calendar, and documents to understand patterns and constraints.
                  </p>
                </div>
              </div>
            </div>

            {/* Card 2 */}
            <div className="group bg-white rounded-xl p-6 sm:p-8 border border-gray-200 hover:border-purple-300 hover:shadow-md transition-all duration-200">
              <div className="flex items-start gap-4">
                <div className="inline-flex items-center justify-center w-11 h-11 bg-purple-50 rounded-lg flex-shrink-0 group-hover:bg-purple-100 transition-colors">
                  <TrendingUp className="w-5 h-5 text-purple-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-1.5">
                    Grounded in reality
                  </h3>
                  <p className="text-gray-600 leading-relaxed text-sm sm:text-[15px]">
                    Advice based on your data—not assumptions or generic frameworks.
                  </p>
                </div>
              </div>
            </div>

            {/* Card 3 */}
            <div className="group bg-white rounded-xl p-6 sm:p-8 border border-gray-200 hover:border-emerald-300 hover:shadow-md transition-all duration-200">
              <div className="flex items-start gap-4">
                <div className="inline-flex items-center justify-center w-11 h-11 bg-emerald-50 rounded-lg flex-shrink-0 group-hover:bg-emerald-100 transition-colors">
                  <Shield className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-1.5">
                    Private by design
                  </h3>
                  <p className="text-gray-600 leading-relaxed text-sm sm:text-[15px]">
                    Enterprise encryption. Australian-hosted. Never used for training.
                  </p>
                </div>
              </div>
            </div>

            {/* Card 4 */}
            <div className="group bg-white rounded-xl p-6 sm:p-8 border border-gray-200 hover:border-orange-300 hover:shadow-md transition-all duration-200">
              <div className="flex items-start gap-4">
                <div className="inline-flex items-center justify-center w-11 h-11 bg-orange-50 rounded-lg flex-shrink-0 group-hover:bg-orange-100 transition-colors">
                  <Check className="w-5 h-5 text-orange-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-1.5">
                    Confidence-based
                  </h3>
                  <p className="text-gray-600 leading-relaxed text-sm sm:text-[15px]">
                    Recommends only when confident. Asks questions when uncertain.
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Trust & Security - Authority */}
      <section id="security" className="py-12 sm:py-20 px-5 sm:px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          
          <div className="grid grid-cols-3 gap-6 sm:gap-12 text-center">
            <div>
              <div className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-1 sm:mb-2">
                Bank-grade
              </div>
              <p className="text-xs sm:text-sm text-gray-600">
                Encryption
              </p>
            </div>
            
            <div>
              <div className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-1 sm:mb-2">
                100%
              </div>
              <p className="text-xs sm:text-sm text-gray-600">
                Your data
              </p>
            </div>
            
            <div>
              <div className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-1 sm:mb-2">
                Australia
              </div>
              <p className="text-xs sm:text-sm text-gray-600">
                Hosted
              </p>
            </div>
          </div>
          
        </div>
      </section>

      {/* How It Works - High Level Only */}
      <section className="py-12 sm:py-20 px-5 sm:px-6 bg-white">
        <div className="max-w-3xl mx-auto">
          
          <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-10 sm:mb-16 tracking-tight text-center">
            Built for how you work
          </h2>

          <div className="space-y-8 sm:space-y-12">
            <div className="flex gap-4 sm:gap-6 items-start">
              <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 bg-gray-900 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                1
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-1">
                  Connect your tools
                </h3>
                <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
                  Email, calendar, documents—BIQC learns from what you use.
                </p>
              </div>
            </div>

            <div className="flex gap-4 sm:gap-6 items-start">
              <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 bg-gray-900 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                2
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-1">
                  BIQC builds your model
                </h3>
                <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
                  Patterns and priorities learned from signals, not surveys.
                </p>
              </div>
            </div>

            <div className="flex gap-4 sm:gap-6 items-start">
              <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 bg-gray-900 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                3
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-1">
                  Get precise advice
                </h3>
                <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
                  Recommendations specific to your business reality.
                </p>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Final CTA - Single, No Repetition */}
      <section className="py-16 sm:py-24 px-5 sm:px-6 bg-gray-50">
        <div className="max-w-2xl mx-auto text-center">
          
          <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-4 tracking-tight">
            Start free today
          </h2>
          
          <p className="text-base sm:text-lg text-gray-600 mb-8">
            No credit card required. Full access from day one.
          </p>
          
          <Button
            onClick={() => navigate('/register-supabase')}
            className="bg-gray-900 hover:bg-gray-800 text-white px-8 h-12 text-base font-medium rounded-lg w-full sm:w-auto max-w-xs sm:max-w-none mx-auto"
          >
            Start free
          </Button>
          
        </div>
      </section>

      {/* Footer - Clean */}
      <footer className="border-t border-gray-100 py-12 px-6">
        <div className="max-w-5xl mx-auto">
          
          <div className="flex flex-col sm:flex-row justify-between items-center gap-6">
            
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-blue-600 rounded-md flex items-center justify-center">
                <Zap className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-sm font-semibold text-gray-900">BIQC</span>
              <span className="text-xs text-gray-500">by The Strategy Squad</span>
            </div>
            
            <div className="flex items-center gap-6 text-sm text-gray-600">
              <button onClick={() => navigate('/pricing')}>Pricing</button>
              <button onClick={() => navigate('/terms')}>Terms</button>
              <a href="#security">Security</a>
            </div>
            
          </div>
          
          <div className="mt-8 pt-8 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-500">
              © 2026 The Strategy Squad Pty Ltd. Business intelligence platform.
            </p>
          </div>
          
        </div>
      </footer>

    </div>
  );
};

export default Landing;
