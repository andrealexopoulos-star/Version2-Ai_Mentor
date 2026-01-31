import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import IntelligenceSimulation from '../components/IntelligenceSimulation';
import { 
  ArrowRight, Brain, Target, TrendingUp, 
  MessageSquare, BarChart3, Zap, Check, ChevronRight
} from 'lucide-react';

const LandingIntelligent = () => {
  const navigate = useNavigate();

  const capabilities = [
    {
      outcome: "Decisions backed by your actual business data",
      detail: "BIQC integrates with your email, CRM, and calendar to understand what's actually happening"
    },
    {
      outcome: "Strategic clarity when you're overwhelmed",
      detail: "Surface what matters, filter what doesn't, based on your business reality"
    },
    {
      outcome: "Advice that remembers your context",
      detail: "Every conversation builds on what BIQC has learned about how you operate"
    }
  ];

  const howItWorks = [
    {
      number: "01",
      title: "Connect your business data",
      description: "Email, CRM, calendar. BIQC integrates with systems you already use."
    },
    {
      number: "02",
      title: "BIQC builds understanding",
      description: "Continuous learning from communications, patterns, and business signals."
    },
    {
      number: "03",
      title: "Intelligence, on demand",
      description: "Ask questions. Make decisions. BIQC provides context-aware guidance."
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 sm:py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
              <Brain className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm sm:text-base text-slate-900">BIQC</span>
              <span className="text-[8px] text-gray-500 -mt-0.5 hidden sm:block">Business IQ Centre</span>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Button 
              variant="ghost" 
              onClick={() => navigate('/login-supabase')}
              className="text-slate-700 hover:text-slate-900 hover:bg-slate-100 font-medium text-sm px-3 py-1.5 sm:px-4 sm:py-2 h-8 sm:h-auto"
            >
              Log In
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section - Interactive Intelligence */}
      <section className="pt-20 sm:pt-28 pb-16 sm:pb-24 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            
            {/* Left: Messaging */}
            <div className="space-y-6 sm:space-y-8">
              <div className="space-y-4">
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-slate-900 leading-tight tracking-tight">
                  Your business,
                  <br />
                  <span className="text-blue-600">understood continuously</span>
                </h1>
                
                <p className="text-lg sm:text-xl text-slate-600 leading-relaxed max-w-xl">
                  BIQC is a personalised AI advisory system that learns how your business operates and helps you make better decisions.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <Button
                  onClick={() => navigate('/register-supabase')}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-6 text-lg rounded-xl shadow-lg flex items-center justify-center gap-2"
                >
                  Start Free
                  <ArrowRight className="w-5 h-5" />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => document.getElementById('how-it-thinks')?.scrollIntoView({ behavior: 'smooth' })}
                  className="border-slate-300 text-slate-700 hover:bg-slate-50 font-medium px-8 py-6 text-lg rounded-xl"
                >
                  See How BIQC Thinks
                </Button>
              </div>

              <div className="flex items-center gap-6 text-sm text-slate-600 pt-2">
                <div className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-green-600" />
                  <span>Free to start</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-green-600" />
                  <span>No credit card</span>
                </div>
              </div>
            </div>

            {/* Right: Interactive Intelligence Simulation */}
            <div className="order-first lg:order-last">
              <IntelligenceSimulation />
            </div>
          </div>
        </div>
      </section>

      {/* Problem Reframe */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 bg-slate-50">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-slate-900">
            Most business decisions lack intelligence
          </h2>
          <div className="space-y-4 text-base sm:text-lg text-slate-600 leading-relaxed max-w-3xl mx-auto text-left sm:text-center">
            <p>
              You make decisions using fragmented data, gut feel, and generic business advice that doesn't know your reality.
            </p>
            <p>
              Tools give you features. Templates give you frameworks. Generic AI gives you responses.
            </p>
            <p className="font-medium text-slate-900">
              BIQC gives you intelligence — personalised, continuous, and grounded in your business.
            </p>
          </div>
        </div>
      </section>

      {/* What BIQC Is */}
      <section className="py-16 sm:py-24 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-full">
                <Brain className="w-4 h-4 text-blue-700" />
                <span className="text-sm font-medium text-blue-900">Intelligence Layer</span>
              </div>
              
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-slate-900 leading-tight">
                An intelligence layer for your business
              </h2>
              
              <div className="space-y-4 text-base sm:text-lg text-slate-600 leading-relaxed">
                <p>
                  BIQC is not a chatbot. It's not a dashboard. It's not another tool.
                </p>
                <p>
                  It's a persistent intelligence system that learns your business reality, recognizes patterns you miss, and provides advisory guidance when you need it.
                </p>
                <p className="font-medium text-slate-900">
                  Think of it as having a senior advisor who knows your business intimately and is available whenever you need to think through a decision.
                </p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-2xl p-8 border border-slate-200">
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <MessageSquare className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 mb-1">Learns continuously</h3>
                    <p className="text-sm text-slate-600">From your communications, data, and decision patterns</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Target className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 mb-1">Surfaces what matters</h3>
                    <p className="text-sm text-slate-600">Filters noise, highlights signals you'd otherwise miss</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <BarChart3 className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 mb-1">Advises with context</h3>
                    <p className="text-sm text-slate-600">Every insight is grounded in your business reality</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How BIQC Thinks */}
      <section id="how-it-thinks" className="py-16 sm:py-24 px-4 sm:px-6 bg-slate-900 text-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold mb-4">
              How BIQC Thinks
            </h2>
            <p className="text-lg text-slate-300 max-w-2xl mx-auto">
              Intelligence is a process, not a response
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Input */}
            <div className="space-y-4">
              <div className="w-12 h-12 bg-blue-600/20 rounded-xl flex items-center justify-center">
                <Zap className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold">Inputs</h3>
              <p className="text-slate-300 leading-relaxed">
                Email patterns, CRM data, calendar behavior, communication signals, and business profile.
              </p>
            </div>

            {/* Arrow */}
            <div className="hidden md:flex items-center justify-center">
              <ChevronRight className="w-8 h-8 text-slate-600" />
            </div>

            {/* Understanding */}
            <div className="space-y-4">
              <div className="w-12 h-12 bg-purple-600/20 rounded-xl flex items-center justify-center">
                <Brain className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="text-xl font-semibold">Understanding</h3>
              <p className="text-slate-300 leading-relaxed">
                Pattern recognition, context synthesis, decision velocity tracking, and behavioral modeling.
              </p>
            </div>

            {/* Arrow */}
            <div className="hidden md:flex items-center justify-center md:col-start-2">
              <ChevronRight className="w-8 h-8 text-slate-600" />
            </div>

            {/* Output */}
            <div className="space-y-4 md:col-start-3">
              <div className="w-12 h-12 bg-emerald-600/20 rounded-xl flex items-center justify-center">
                <Target className="w-6 h-6 text-emerald-400" />
              </div>
              <h3 className="text-xl font-semibold">Advisory Output</h3>
              <p className="text-slate-300 leading-relaxed">
                Specific insights, prioritized actions, and strategic guidance tailored to your situation.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Capabilities - Framed as Outcomes */}
      <section className="py-16 sm:py-24 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-slate-900 mb-4">
              What BIQC delivers
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Intelligence outcomes, not features
            </p>
          </div>

          <div className="space-y-6">
            {capabilities.map((cap, index) => (
              <div 
                key={index}
                className="p-6 rounded-xl border border-slate-200 bg-white hover:border-blue-300 hover:shadow-md transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg sm:text-xl font-semibold text-slate-900 mb-2">
                      {cap.outcome}
                    </h3>
                    <p className="text-slate-600 leading-relaxed">
                      {cap.detail}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 bg-slate-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-slate-900 mb-4">
              How it works
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {howItWorks.map((step, index) => (
              <div key={index} className="space-y-4">
                <div className="text-5xl font-bold text-blue-600/20">
                  {step.number}
                </div>
                <h3 className="text-xl font-semibold text-slate-900">
                  {step.title}
                </h3>
                <p className="text-slate-600 leading-relaxed">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Who It's For */}
      <section className="py-16 sm:py-24 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-slate-900 mb-4">
              Built for operators and decision-makers
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              If you run a business, make strategic decisions, or need to think clearly under pressure — BIQC is for you.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="p-6 rounded-xl bg-slate-50 border border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-2">Founders & Business Owners</h3>
              <p className="text-slate-600 text-sm">
                Running the business while making strategy decisions. Need clarity, not more complexity.
              </p>
            </div>
            <div className="p-6 rounded-xl bg-slate-50 border border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-2">Executives & Operators</h3>
              <p className="text-slate-600 text-sm">
                Managing multiple priorities. Need intelligence that cuts through noise.
              </p>
            </div>
            <div className="p-6 rounded-xl bg-slate-50 border border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-2">Strategic Advisors</h3>
              <p className="text-slate-600 text-sm">
                Guiding clients with real data, not assumptions. Need intelligence depth fast.
              </p>
            </div>
            <div className="p-6 rounded-xl bg-slate-50 border border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-2">Growth-Stage Leaders</h3>
              <p className="text-slate-600 text-sm">
                Scaling operations while maintaining strategic clarity. Need to move fast without breaking things.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Closing Statement */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 bg-slate-900 text-white">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold leading-tight">
            Intelligence you can trust
          </h2>
          <p className="text-lg sm:text-xl text-slate-300 leading-relaxed">
            BIQC doesn't guess. It learns your business, recognizes patterns, and provides guidance grounded in your reality.
          </p>
          <div className="pt-4">
            <Button
              onClick={() => navigate('/register-supabase')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-10 py-6 text-lg rounded-xl shadow-lg"
            >
              Start Free Today
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
          <p className="text-sm text-slate-400 pt-4">
            Free to start. No credit card required. Intelligence from day one.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 sm:px-6 border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-sm text-slate-500">
            © 2026 BIQC - Business IQ Centre. Powered by The Strategy Squad.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default LandingIntelligent;
