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
      outcome: "See issues and opportunities while there's still time to act",
      detail: "Risk and opportunity rarely arrive as clear events. They build slowly: conversations that don't resolve, effort increasing without results, capacity stretching quietly, decisions being deferred. BIQC helps surface these shifts early, so you're not reacting once the cost is already locked in."
    },
    {
      outcome: "Stay across the business without being everywhere",
      detail: "BIQC doesn't replace your judgement. It extends it. By holding context you don't have time to track, watching across multiple disciplines at once, and connecting signals that are easy to miss. BIQC helps you lead with more clarity and less effort."
    },
    {
      outcome: "Fewer reactive decisions. Fewer late surprises. More deliberate control.",
      detail: "Built for judgement, not dashboards. Dashboards show numbers. Reports explain the past. Chatbots answer questions. BIQC supports judgement. It builds awareness over time, across the whole business, and surfaces insight only when it crosses a threshold of relevance. That restraint is what makes it useful."
    },
    {
      outcome: "A place to reason with context already in place",
      detail: "When something feels off — or when you're weighing a decision — BIQC gives you a way to think it through with awareness of the wider business. You can explore trade-offs, pressure-test assumptions, and understand implications across sales, operations, finance, and team — without starting from scratch."
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
              <span className="text-white font-bold text-xl">B</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-lg text-slate-900 tracking-tight">BIQC</span>
              <span className="text-[10px] text-slate-500 tracking-wide hidden sm:inline">powered by The Strategy Squad</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              onClick={() => navigate('/login-supabase')}
              className="text-slate-800 hover:text-slate-900 hover:bg-slate-50 font-semibold text-sm px-4 py-2"
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
      <section className="pt-52 sm:pt-32 pb-16 sm:pb-24 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            
            {/* Left: Messaging */}
            <div className="space-y-7 sm:space-y-9">
              <div className="space-y-5">
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-slate-900 leading-[1.15] tracking-tight">
                  BIQc - Now You can be across everything always with insights and intelligence.
                </h1>
                
                <p className="text-lg sm:text-xl text-slate-700 leading-relaxed max-w-xl font-medium">
                  Conversations drift. Patterns repeat. Risk builds quietly. Revenue stalls for reasons no one names.
                </p>
                
                <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl">
                  BIQC monitors your business like an intelligence system—across email, meetings, deals, and operations. It notices what forms before you see it. It surfaces what matters before it's urgent.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <Button
                  onClick={() => navigate('/register-supabase')}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-semibold px-10 py-6 text-base rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  Start monitoring
                  <ArrowRight className="w-5 h-5" />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowInteractiveDemo(true)}
                  className="border-2 border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400 font-medium px-10 py-6 text-base rounded-xl transition-all"
                >
                  See what it notices
                </Button>
              </div>

              <div className="flex items-center gap-6 text-sm text-slate-500 pt-1">
                <div className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-slate-400" />
                  <span>Free to start</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-slate-400" />
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

      {/* The Leadership Reality */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 bg-slate-50">
        <div className="max-w-4xl mx-auto space-y-10">
          <div className="text-center space-y-5">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-slate-900 leading-tight">
              No one sees the whole system
            </h2>
          </div>
          
          <div className="space-y-5 text-base sm:text-lg text-slate-700 leading-relaxed max-w-3xl mx-auto">
            <p>
              You're accountable for sales, operations, cash, capacity, and risk—but no single tool shows how they interact.
            </p>
            <p>
              Important patterns form across systems. Conversations stall. Commitments slip. Opportunities pass before anyone connects them.
            </p>
            <p className="font-semibold text-slate-900 text-lg sm:text-xl pt-2">
              Leaders don't miss things because they're careless. They miss them because nothing is monitoring the system end-to-end.
            </p>
            <p className="text-slate-600 italic pt-2">
              BIQC is.
            </p>
          </div>
        </div>
      </section>

      {/* What BIQC Does */}
      <section className="py-20 sm:py-28 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div className="space-y-7">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 border border-slate-300 rounded-full">
                <Brain className="w-4 h-4 text-slate-700" />
                <span className="text-sm font-semibold text-slate-800 tracking-wide">INTELLIGENCE LAYER</span>
              </div>
              
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-slate-900 leading-tight">
                BIQC monitors your business like a control system
              </h2>
              
              <div className="space-y-5 text-base sm:text-lg text-slate-700 leading-relaxed">
                <p>
                  It sits across email, calendar, CRM, and operations. It observes conversations. It tracks commitments. It detects patterns you don't have time to see.
                </p>
                <p>
                  When something repeats, when risk forms, when capacity strains, when deals stall—BIQC notices.
                </p>
                <p className="font-semibold text-slate-900 text-lg pt-1">
                  It doesn't report everything. It surfaces what requires attention.
                </p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-100 to-slate-50 rounded-2xl p-8 sm:p-10 relative overflow-hidden border border-slate-200">
              <div className="space-y-7 relative z-10">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center flex-shrink-0">
                    <MessageSquare className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 mb-1.5 text-base">Monitors continuously</h3>
                    <p className="text-sm text-slate-600 leading-relaxed">Watches communications, meetings, and deals in real time</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Target className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 mb-1.5 text-base">Detects patterns</h3>
                    <p className="text-sm text-slate-600 leading-relaxed">Identifies what's recurring, what's drifting, what's being deferred</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center flex-shrink-0">
                    <BarChart3 className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 mb-1.5 text-base">Reports what matters</h3>
                    <p className="text-sm text-slate-600 leading-relaxed">Surfaces only what crosses a threshold of relevance</p>
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
              What BIQC does for you
            </h2>
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
              <h3 className="font-semibold text-slate-900 mb-2">Owners and leaders</h3>
              <p className="text-slate-600 text-sm">
                Accountable for the entire business. Want to spot risk earlier, recognize opportunity sooner, achieve more without carrying everything themselves.
              </p>
            </div>
            <div className="p-6 rounded-xl bg-slate-50 border border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-2">Looking for better judgement</h3>
              <p className="text-slate-600 text-sm">
                If you're looking for another tool, BIQC isn't it. If you want better judgement across the business, it is.
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
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold leading-tight text-white">
            Let BIQC help you stay ahead
          </h2>
          <p className="text-lg sm:text-xl text-slate-300 leading-relaxed">
            Connect the systems you already rely on. Let BIQC build context across the business. Use it to stay oriented, spot what matters, and act with confidence.
          </p>
          <div className="pt-4">
            <Button
              onClick={() => navigate('/register-supabase')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-10 py-6 text-lg rounded-xl shadow-lg"
            >
              Get started
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
          <p className="text-sm text-slate-400 pt-4">
            Free to start. No credit card. See what BIQC notices in your business.
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
