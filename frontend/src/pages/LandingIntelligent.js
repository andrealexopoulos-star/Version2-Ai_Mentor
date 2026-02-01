import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Button } from '../components/ui/button';
import IntelligenceSimulation from '../components/IntelligenceSimulation';
import InteractiveDemoExpanded from '../components/InteractiveDemoExpanded';
import { 
  ArrowRight, Brain, Target, TrendingUp, 
  MessageSquare, BarChart3, Zap, Check, ChevronRight, Shield
} from 'lucide-react';

const LandingIntelligent = () => {
  const navigate = useNavigate();
  const [showInteractiveDemo, setShowInteractiveDemo] = useState(false);

  const capabilities = [
    {
      outcome: "Less second-guessing",
      detail: "BIQC watches what's happening and tells you what actually needs a decision versus what can wait."
    },
    {
      outcome: "Catch problems earlier",
      detail: "Spots patterns before they become fires. Things that would normally slip through get flagged while they're still fixable."
    },
    {
      outcome: "Know where money's really going",
      detail: "Sees who pays on time, who doesn't, and where cash flow pressure is building based on what's actually happening."
    },
    {
      outcome: "Stop dropping commitments",
      detail: "Notices when you're overcommitted or when deadlines are drifting before clients start calling."
    }
  ];

  const howItWorks = [
    {
      number: "01",
      title: "Connect once",
      description: "Link your email, calendar, or CRM. Takes two minutes. BIQC starts watching quietly in the background."
    },
    {
      number: "02",
      title: "It learns while you work",
      description: "Observes conversations, meetings, and commitments. Picks up on what's normal for your business and what's changing."
    },
    {
      number: "03",
      title: "You check when you want",
      description: "Open BIQC when you need clarity. It shows you what's worth paying attention to. No alerts, no noise."
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation - Premium styling */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-slate-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-lg text-slate-900 tracking-tight">BIQC</span>
              <span className="text-[9px] text-slate-500 -mt-0.5 tracking-wide hidden sm:block">INTELLIGENCE LAYER</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              onClick={() => navigate('/login-supabase')}
              className="text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium text-sm px-4 py-2"
            >
              Log In
            </Button>
            <Button
              onClick={() => navigate('/register-supabase')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-5 py-2 rounded-lg shadow-md hover:shadow-lg transition-shadow hidden sm:inline-flex"
            >
              Start Free
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
                  See what actually deserves
                  <br />
                  <span className="text-blue-600">your attention</span>
                </h1>
                
                <p className="text-lg sm:text-xl text-slate-600 leading-relaxed max-w-xl">
                  Running a business means being buried in decisions. BIQC watches what's happening and tells you what actually matters.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <Button
                  onClick={() => navigate('/register-supabase')}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-10 py-7 text-lg rounded-xl shadow-xl shadow-blue-600/25 hover:shadow-2xl transition-all flex items-center justify-center gap-2"
                >
                  Get clarity
                  <ArrowRight className="w-5 h-5" />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowInteractiveDemo(true)}
                  className="border-2 border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400 font-semibold px-10 py-7 text-lg rounded-xl transition-all"
                >
                  See how it works
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
            You're busy, but nothing feels clearer
          </h2>
          <div className="space-y-4 text-base sm:text-lg text-slate-600 leading-relaxed max-w-3xl mx-auto text-left sm:text-center">
            <p>
              You're in meetings. You're answering emails. You're making decisions. But there's always this feeling that something's off, something's been missed, something needs attention and you can't quite pin it down.
            </p>
            <p>
              It's not that you're not working. It's that you're reacting more than steering. By the time you notice a problem, it's already costing you.
            </p>
            <p className="font-medium text-slate-900">
              The issue isn't effort. It's visibility.
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
                BIQC watches while you work
              </h2>
              
              <div className="space-y-4 text-base sm:text-lg text-slate-600 leading-relaxed">
                <p>
                  You connect your email, calendar, and CRM once. After that, BIQC quietly observes what's happening day to day.
                </p>
                <p>
                  It watches patterns. Who's reaching out. What keeps resurfacing. Where time's going. What's stalling.
                </p>
                <p className="font-medium text-slate-900">
                  When something actually needs your attention, BIQC surfaces it. Otherwise, it stays quiet.
                </p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-50 to-blue-50/30 rounded-3xl p-8 sm:p-10 relative overflow-hidden">
              <div className="space-y-6 relative z-10">
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-600/20">
                    <MessageSquare className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 mb-1.5 text-base">Observes quietly</h3>
                    <p className="text-sm text-slate-600 leading-relaxed">Watches communications and commitments without interrupting your work</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 bg-purple-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-purple-600/20">
                    <Target className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 mb-1.5 text-base">Notices patterns</h3>
                    <p className="text-sm text-slate-600 leading-relaxed">Picks up on what's recurring, what's stalling, what's being ignored</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 bg-emerald-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-600/20">
                    <BarChart3 className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 mb-1.5 text-base">Speaks when it matters</h3>
                    <p className="text-sm text-slate-600 leading-relaxed">Only surfaces what deserves your attention, not everything it sees</p>
                  </div>
                </div>
              </div>

              {/* Subtle accent */}
              <div className="absolute top-0 right-0 w-40 h-40 bg-blue-300 opacity-10 blur-3xl"></div>
              <div className="absolute bottom-0 left-0 w-40 h-40 bg-purple-300 opacity-10 blur-3xl"></div>
            </div>
          </div>
        </div>
      </section>

      {/* How BIQC Thinks */}
      <section id="how-it-thinks" className="py-16 sm:py-24 px-4 sm:px-6 bg-slate-900 text-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold mb-4">
              How it works
            </h2>
            <p className="text-lg text-slate-300 max-w-2xl mx-auto">
              Simple setup. Quiet observation. Clear insight when you need it.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Input */}
            <div className="space-y-4">
              <div className="w-12 h-12 bg-blue-600/20 rounded-xl flex items-center justify-center">
                <Zap className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold">What's happening</h3>
              <p className="text-slate-300 leading-relaxed">
                Your email, calendar, and client conversations. The day-to-day of running the business.
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
              <h3 className="text-xl font-semibold">What BIQC notices</h3>
              <p className="text-slate-300 leading-relaxed">
                What keeps coming up. What's being avoided. Where your time actually goes versus where you think it goes.
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
              <h3 className="text-xl font-semibold">What you see</h3>
              <p className="text-slate-300 leading-relaxed">
                A calm summary of what deserves attention. No dashboards. No alerts. Just clarity when you open it.
              </p>
            </div>
          </div>
        </div>
      </section>


      {/* Security & Trust */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 bg-white border-y border-slate-200">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-slate-900 mb-4">
              Your data stays yours
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              BIQC only sees what you explicitly connect. Nothing more.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-xl bg-slate-50 border border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                <Check className="w-5 h-5 text-green-600" />
                Workspace data isolation
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Each business operates in an isolated workspace. No data sharing across organizations. Row-level security enforced at database layer.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-slate-50 border border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                <Check className="w-5 h-5 text-green-600" />
                OAuth via trusted providers
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Authentication through Microsoft, Google, and established identity providers. No password storage. Industry-standard OAuth 2.0 flows.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-slate-50 border border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                <Check className="w-5 h-5 text-green-600" />
                Least-privilege access model
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Read-only integration access. BIQC observes and advises — it does not write to your systems. No data modification capability.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-slate-50 border border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                <Check className="w-5 h-5 text-green-600" />
                User-controlled revocation
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Disconnect integrations at any time from settings. Immediate access termination. Data retention policies user-configurable.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-slate-50 border border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                <Check className="w-5 h-5 text-green-600" />
                Audit-ready activity logging
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                All data access logged with timestamps, user context, and operation type. Compliance-friendly audit trails maintained.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-slate-50 border border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                <Check className="w-5 h-5 text-green-600" />
                Encryption at rest and in transit
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                TLS 1.3 for all connections. Database encryption enabled. Integration tokens stored with encryption at rest via Supabase security infrastructure.
              </p>
            </div>
          </div>

          {/* Key Differentiators */}
          <div className="mt-12 pt-12 border-t border-slate-200">
            <h3 className="text-xs uppercase tracking-wide text-slate-500 mb-4 text-center">What makes this different</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
              <div>
                <p className="font-semibold text-slate-900 mb-1">Not a chatbot</p>
                <p className="text-xs text-slate-600">Doesn't wait for you to ask. Observes and surfaces.</p>
              </div>
              <div>
                <p className="font-semibold text-slate-900 mb-1">Not another tool</p>
                <p className="text-xs text-slate-600">You don't check it constantly. Check it when you need clarity.</p>
              </div>
              <div>
                <p className="font-semibold text-slate-900 mb-1">Not a dashboard</p>
                <p className="text-xs text-slate-600">No metrics. No charts. Just what matters right now.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Capabilities - Framed as Outcomes */}
      <section className="py-16 sm:py-24 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-slate-900 mb-4">
              What this gets you
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Less noise. More clarity.
            </p>
          </div>

          <div className="space-y-5">
            {capabilities.map((cap, index) => (
              <div 
                key={index}
                className="p-6 sm:p-7 rounded-2xl bg-white hover:shadow-lg transition-shadow border border-slate-100"
              >
                <div className="flex items-start gap-4">
                  <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      {cap.outcome}
                    </h3>
                    <p className="text-slate-600 leading-relaxed text-base">
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
              Who this is for
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              People running businesses who are tired of reacting
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="p-6 rounded-xl bg-slate-50 border border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-2">Founders and owners</h3>
              <p className="text-slate-600 text-sm">
                You're making all the calls. You need to know what's actually urgent versus what just feels urgent.
              </p>
            </div>
            <div className="p-6 rounded-xl bg-slate-50 border border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-2">Operators under pressure</h3>
              <p className="text-slate-600 text-sm">
                Too many balls in the air. You need something watching for what you're about to drop.
              </p>
            </div>
            <div className="p-6 rounded-xl bg-slate-50 border border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-2">People stretched too thin</h3>
              <p className="text-slate-600 text-sm">
                You don't have time to analyze everything. You need someone—or something—doing that for you.
              </p>
            </div>
            <div className="p-6 rounded-xl bg-slate-50 border border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-2">Teams that keep missing things</h3>
              <p className="text-slate-600 text-sm">
                Client issues surface late. Cash gets tight unexpectedly. Deadlines slip. You need earlier warning.
              </p>
            </div>
          </div>
        </div>
      </section>


      {/* Proof of Intelligence */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 bg-gradient-to-br from-blue-50 to-slate-50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-semibold text-slate-900 mb-3">
              Why this helps
            </h2>
            <p className="text-slate-600">What you actually get day to day</p>
          </div>

          <div className="space-y-6">
            <div className="flex items-start gap-4 p-6 rounded-xl bg-white border border-slate-200 shadow-sm">
              <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 mb-1.5">Notices what you're too busy to see</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Certain clients always pay late. Same issues keep resurfacing in emails. Meetings keep getting rescheduled. You're moving too fast to connect these dots. BIQC isn't.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-6 rounded-xl bg-white border border-slate-200 shadow-sm">
              <div className="w-10 h-10 rounded-lg bg-purple-600 flex items-center justify-center flex-shrink-0">
                <Brain className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 mb-1.5">Shows where money's actually tied up</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Cash flow doesn't break because revenue drops. It breaks because three clients all paid 30 days late and you didn't notice until the account ran dry. BIQC notices.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-6 rounded-xl bg-white border border-slate-200 shadow-sm">
              <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center flex-shrink-0">
                <Target className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 mb-1.5">Helps you decide, not just report</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Dashboards tell you what happened. BIQC tells you what's worth doing something about based on how your business actually works, not generic advice.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* Closing Statement */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 bg-slate-900 text-white">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold leading-tight">
            Let BIQC watch while you run the business
          </h2>
          <p className="text-lg sm:text-xl text-slate-300 leading-relaxed">
            You don't need another tool to check. You need something watching for you. That's what BIQC does.
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


      {/* Interactive Demo Modal */}
      {showInteractiveDemo && (
        <InteractiveDemoExpanded onClose={() => setShowInteractiveDemo(false)} />
      )}

        </div>
      </footer>
    </div>
  );
};

export default LandingIntelligent;
