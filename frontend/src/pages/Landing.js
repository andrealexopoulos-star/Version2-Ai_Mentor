import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { ArrowRight, Zap, Target, FileText, TrendingUp, Brain, Rocket, Check, Star, Shield, BarChart3, Sparkles } from 'lucide-react';

const Landing = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: Brain,
      title: 'Personalised AI That Knows YOUR Business',
      description: 'Tailored strategies based on YOUR data, not generic templates.',
      span: 'md:col-span-2'
    },
    {
      icon: Zap,
      title: 'Instant Business Diagnosis',
      description: 'Find bottlenecks and get actionable fixes in minutes.',
      span: 'md:col-span-1'
    },
    {
      icon: FileText,
      title: 'SOPs On Demand',
      description: 'Generate professional documentation for any process.',
      span: 'md:col-span-1'
    },
    {
      icon: Target,
      title: 'Market Intelligence',
      description: 'Know your competition. Find your competitive edge.',
      span: 'md:col-span-1'
    },
    {
      icon: TrendingUp,
      title: 'Growth Roadmaps',
      description: 'Strategic action plans for your business.',
      span: 'md:col-span-1'
    }
  ];

  const pricingPlans = [
    {
      name: 'Starter',
      price: 'Free',
      period: '',
      description: 'Get started with Personalised AI Intelligence',
      features: ['10 AI intelligence messages/month', 'Basic business profile', '3 document uploads', 'Email support'],
      highlight: false
    },
    {
      name: 'Professional',
      price: '$29',
      period: '/mo',
      description: 'Full Personalised AI Business Intelligence',
      features: ['Unlimited AI intelligence chat', 'Complete business profile', 'Unlimited uploads', 'SOP & Action generators', 'Market analysis', 'Priority support'],
      highlight: true
    },
    {
      name: 'Enterprise',
      price: '$99',
      period: '/mo',
      description: 'Advanced Intelligence Platform for teams',
      features: ['Everything in Pro', '10 team members', 'Admin dashboard', 'API access', 'Dedicated support'],
      highlight: false
    }
  ];

  return (
    <div className="min-h-screen bg-white relative overflow-hidden">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 sm:py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-600/25">
              <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm sm:text-base text-slate-900">BIQC</span>
              <span className="text-[8px] text-gray-500 -mt-0.5 hidden sm:block">powered by Business Intelligence Quotient Centre</span>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <button onClick={() => navigate('/pricing')} className="text-slate-700 hover:text-blue-600 font-medium text-sm transition-colors">Pricing</button>
            <button onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })} className="text-slate-700 hover:text-blue-600 font-medium text-sm transition-colors">Features</button>
            <button onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })} className="text-slate-700 hover:text-blue-600 font-medium text-sm transition-colors">How It Works</button>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Button 
              variant="ghost" 
              onClick={() => navigate('/login-supabase')}
              className="text-slate-700 hover:text-slate-900 hover:bg-slate-100 font-medium text-sm px-3 py-1.5 sm:px-4 sm:py-2 h-8 sm:h-auto"
              data-testid="nav-login-btn"
            >
              Log In
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-16 sm:pt-32 pb-12 sm:pb-20 px-4 sm:px-6 lg:px-6 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-50/80 to-white" />
        <div className="absolute top-20 right-0 w-[600px] h-[600px] bg-blue-100 rounded-full blur-[150px] opacity-50" />
        
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 lg:gap-12 items-center">
            {/* Main Content */}
            <div className="lg:col-span-7 space-y-4 sm:space-y-6 lg:space-y-8 animate-fade-in">
              <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-100 border border-blue-200 rounded-full">
                <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-700" />
                <span className="text-xs sm:text-sm font-semibold text-blue-800">Personalised AI Business Intelligence</span>
              </div>
              
              <h1 className="font-semibold text-2xl sm:text-3xl md:text-4xl lg:text-5xl text-slate-900 leading-tight tracking-tight">
                Your Personalised Business Soundboard —
                <span className="text-blue-600"> Built on Your Business Intelligence</span>
              </h1>
              
              <p className="text-base sm:text-lg lg:text-lg text-slate-600 max-w-2xl leading-relaxed font-normal">
                <strong className="text-slate-900 font-semibold">BIQC</strong> continuously learns your business and delivers sound, personalised intelligence.
              </p>
              
              <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 pt-1 sm:pt-2">
                <Button 
                  onClick={() => navigate('/register-supabase')}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 sm:px-8 py-3.5 sm:py-4 lg:py-4 h-12 sm:h-14 rounded-xl shadow-xl shadow-blue-600/30 flex items-center justify-center gap-2 text-base sm:text-lg w-full sm:w-auto"
                  data-testid="hero-cta-btn"
                >
                  Start For Free
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </div>
              
            </div>

            {/* Stats Card - More Subtle */}
            <div className="lg:col-span-5 animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-3xl p-8 relative overflow-hidden shadow-lg border border-slate-200">
                <div className="absolute top-0 right-0 w-40 h-40 bg-blue-200 opacity-30 blur-3xl" />
                <div className="absolute bottom-0 left-0 w-40 h-40 bg-cyan-200 opacity-20 blur-3xl" />
                
                <p className="text-blue-700 font-semibold text-xs mb-6 tracking-wide uppercase relative z-10">Why BIQC is Different</p>
                
                <div className="space-y-5 relative z-10">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm">
                      <Shield className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-base text-slate-900 mb-0.5">Enterprise Grade Security</p>
                      <p className="text-slate-600 text-xs">Data protection & encryption built-in</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm">
                      <Shield className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-base text-slate-900 mb-0.5">100% Your Data</p>
                      <p className="text-slate-600 text-xs">Never shared, sold, or used for training</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm">
                      <Brain className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-base text-slate-900 mb-0.5">100% Personalised</p>
                      <p className="text-slate-600 text-xs">Trained on YOUR business, not templates</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm">
                      <Zap className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-base text-slate-900 mb-0.5">24/7 Available</p>
                      <p className="text-slate-600 text-xs">Strategic intelligence whenever you need it</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Logos / Trust */}
      <section className="py-12 px-6 bg-slate-50 border-y border-slate-200">
        <div className="max-w-7xl mx-auto">
          <p className="text-center text-sm font-medium text-slate-600 mb-8">Trusted by growing businesses across industries</p>
          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16">
            {['Professional Services', 'E-commerce', 'SaaS', 'Healthcare', 'Manufacturing'].map((industry, i) => (
              <div key={i} className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-slate-500" />
                <span className="font-semibold text-slate-700">{industry}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-blue-600 font-bold text-sm tracking-wide uppercase">Personalised AI Features</span>
            <h2 className="font-bold text-3xl md:text-4xl text-slate-900 mt-3 mb-4">
              Everything you need for personalised business growth
            </h2>
            <p className="text-slate-600 text-lg max-w-2xl mx-auto">
              Powerful AI tools designed specifically for small and medium businesses, 
              personalised to your unique situation.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div 
                key={feature.title}
                className={`group relative overflow-hidden rounded-2xl border-2 border-slate-200 bg-white p-8 hover:border-blue-300 hover:shadow-xl hover:shadow-blue-100/50 transition-all duration-300 ${feature.span}`}
                style={{ animationDelay: `${index * 0.1}s` }}
                data-testid={`feature-card-${index}`}
              >
                <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-blue-600 group-hover:scale-110 transition-all duration-300">
                  <feature.icon className="w-7 h-7 text-blue-600 group-hover:text-white transition-colors" />
                </div>
                <h3 className="font-bold text-xl text-slate-900 mb-3">{feature.title}</h3>
                <p className="text-slate-600 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24 px-6 bg-slate-900 text-white relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-500 opacity-10 blur-[150px]" />
        
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center mb-16">
            <span className="text-blue-400 font-bold text-sm tracking-wide uppercase">How It Works</span>
            <h2 className="font-bold text-3xl md:text-4xl mt-4 mb-4">
              From sign-up to
              <span className="text-blue-400"> strategic execution</span> in 5 simple steps
            </h2>
            <p className="text-slate-300 text-lg max-w-2xl mx-auto">
              Get your personalised AI business soundboard working for you in under 15 minutes
            </p>
          </div>
          
          <div className="max-w-4xl mx-auto space-y-6">
            {[
              { 
                num: '01', 
                title: 'Sign Up — Free Account', 
                desc: 'Create your account in 60 seconds. No credit card required. No lengthy forms. Just your name, email, and you\'re in.',
                icon: '✓'
              },
              { 
                num: '02', 
                title: 'Complete Onboarding Questionnaire', 
                desc: 'Answer 7 quick questions about your business stage, goals, and challenges. Takes 5-10 minutes. The AI learns your business from the start.',
                icon: '📋'
              },
              { 
                num: '03', 
                title: 'Integrate Business Tools', 
                desc: 'Connect your CRM, accounting software, and email (optional but powerful). The more integrated, the smarter your AI becomes about YOUR business reality.',
                icon: '🔗'
              },
              { 
                num: '04', 
                title: 'Start Getting Strategic Advice', 
                desc: 'Chat with BIQC Intelligence, run business diagnoses, get strategic guidance daily. Your AI platform knows your business, your goals, your constraints — and provides evidence-backed intelligence accordingly.',
                icon: '💡'
              },
              { 
                num: '05', 
                title: 'Execute & Grow', 
                desc: 'Implement AI-generated SOPs, action plans, and strategies built specifically for your business. Track progress as your Business Score evolves with every decision you execute.',
                icon: '🚀'
              }
            ].map((step, i) => (
              <div key={step.num} className="flex gap-6 items-start bg-white/5 rounded-2xl p-8 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-all hover:scale-[1.02]">
                <div className="flex-shrink-0">
                  <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-2xl font-bold">
                    {step.num}
                  </div>
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-xl mb-3 text-white">{step.title}</h4>
                  <p className="text-slate-300 leading-relaxed text-base">{step.desc}</p>
                </div>
                <div className="text-3xl opacity-50">
                  {step.icon}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Button 
              onClick={() => navigate('/register-supabase')}
              size="lg" 
              className="bg-blue-600 hover:bg-blue-700 text-white text-lg px-8 py-6 shadow-xl shadow-blue-600/30"
            >
              Start Your Free Account Now
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <p className="text-slate-400 text-sm mt-4">
              Setup takes 15 minutes • Strategic intelligence starts immediately
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Preview */}
      <section className="py-24 px-6 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-blue-600 font-bold text-sm tracking-wide uppercase">Pricing</span>
            <h2 className="font-bold text-3xl md:text-4xl text-slate-900 mt-3 mb-4">
              Simple, transparent pricing
            </h2>
            <p className="text-slate-600 text-lg max-w-2xl mx-auto">
              Start free with personalised AI intelligence and scale as you grow. No hidden fees.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {pricingPlans.map((plan, index) => (
              <div 
                key={plan.name}
                className={`relative rounded-2xl p-8 transition-all duration-300 ${
                  plan.highlight 
                    ? 'bg-white border-2 border-blue-600 shadow-xl shadow-blue-100 scale-105' 
                    : 'bg-white border-2 border-slate-200'
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="bg-blue-600 text-white text-xs font-bold px-4 py-1.5 rounded-full">
                      Most Popular
                    </span>
                  </div>
                )}
                
                <h3 className="font-bold text-xl text-slate-900 mb-2">{plan.name}</h3>
                <p className="text-slate-500 text-sm mb-4">{plan.description}</p>
                
                <div className="mb-6">
                  <span className="font-bold text-4xl text-slate-900">{plan.price}</span>
                  <span className="text-slate-500">{plan.period}</span>
                </div>
                
                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-slate-700">
                      <Check className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                
                <Button 
                  onClick={() => navigate('/register-supabase')}
                  variant={plan.highlight ? 'default' : 'outline'}
                  className={`w-full h-12 font-semibold rounded-xl ${plan.highlight ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'border-2'}`}
                >
                  Try It For Free
                </Button>
              </div>
            ))}
          </div>
          
          <div className="text-center mt-8">
            <Button variant="link" onClick={() => navigate('/pricing')} className="text-blue-600 font-semibold">
              View full pricing details
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6 bg-gradient-to-br from-blue-600 to-indigo-700 relative overflow-hidden">
        <div className="absolute inset-0 opacity-30" style={{backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px)", backgroundSize: "24px 24px"}} />
        
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <Rocket className="w-16 h-16 mx-auto mb-8 text-blue-200" />
          <h2 className="font-bold text-3xl md:text-5xl text-white mb-6">
            Ready for personalised business intelligence?
          </h2>
          <p className="text-blue-100 text-xl mb-10 max-w-2xl mx-auto">
            Join hundreds of business owners who stopped guessing and started growing with 
            their <strong>Personalised AI Business Intelligence Platform</strong>.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button 
              onClick={() => navigate('/register-supabase')}
              className="bg-white text-blue-600 hover:bg-blue-50 px-10 py-4 h-auto text-lg font-bold rounded-xl shadow-xl"
              data-testid="cta-register-btn"
            >
              Get Your Personalised Intelligence
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
          <p className="text-blue-200 text-sm mt-6 font-medium">
            No credit card required • Free forever plan available
          </p>
        </div>
      </section>

      {/* General Advice Disclaimer */}
      <section className="py-6 px-6 bg-slate-800">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-slate-400 text-xs leading-relaxed">
            <strong className="text-slate-300">Important:</strong> Business Intelligence Quotient Centre provides general information and educational content only.
            It does not constitute financial, legal, tax, or professional advice. You should seek independent professional advice 
            before making any business decisions. See our <button onClick={() => navigate('/terms')} className="text-blue-400 hover:underline">Terms and Conditions</button> for full details.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 bg-slate-900 border-t border-slate-800">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-white text-lg">Business Intelligence Quotient Centre</span>
            </div>
            <div className="flex items-center gap-8">
              <button onClick={() => navigate('/pricing')} className="text-slate-400 hover:text-white text-sm font-medium transition-colors">Pricing</button>
              <button onClick={() => navigate('/terms')} className="text-slate-400 hover:text-white text-sm font-medium transition-colors">Terms & Conditions</button>
              <button className="text-slate-400 hover:text-white text-sm font-medium transition-colors">Privacy Policy</button>
            </div>
          </div>
          <div className="pt-8 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-slate-500 text-sm">
              © 2025 Business Intelligence Quotient Centre Pty Ltd. All rights reserved.
            </p>
            <p className="text-slate-600 text-xs">
              Personalised AI Business Intelligence • General Information Only • Not Professional Advice
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
