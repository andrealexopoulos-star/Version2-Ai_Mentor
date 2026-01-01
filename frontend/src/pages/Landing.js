import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { ArrowRight, Zap, Target, FileText, TrendingUp, Brain, Rocket, Check, Star, Shield, BarChart3, Sparkles } from 'lucide-react';

const Landing = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: Brain,
      title: 'Personalised AI That Knows YOUR Business',
      description: 'Upload your documents, fill your profile, and watch our AI become your dedicated business advisor. Tailored strategies based on YOUR data, not generic templates.',
      span: 'md:col-span-2'
    },
    {
      icon: Zap,
      title: 'Instant Business Diagnosis',
      description: 'Find bottlenecks and get actionable fixes in minutes, not months.',
      span: 'md:col-span-1'
    },
    {
      icon: FileText,
      title: 'SOPs On Demand',
      description: 'Generate professional documentation for any process automatically.',
      span: 'md:col-span-1'
    },
    {
      icon: Target,
      title: 'Market Intelligence',
      description: 'Know your competition. Find your competitive edge with AI-powered analysis.',
      span: 'md:col-span-1'
    },
    {
      icon: TrendingUp,
      title: 'Growth Roadmaps',
      description: 'Strategic action plans tailored to your unique business reality.',
      span: 'md:col-span-1'
    }
  ];

  const pricingPlans = [
    {
      name: 'Starter',
      price: 'Free',
      period: '',
      description: 'Get started with Personalised AI Advisory',
      features: ['10 AI advisory messages/month', 'Basic business profile', '3 document uploads', 'Email support'],
      highlight: false
    },
    {
      name: 'Professional',
      price: '$29',
      period: '/mo',
      description: 'Full Personalised AI Business Advisory',
      features: ['Unlimited AI advisory chat', 'Complete business profile', 'Unlimited uploads', 'SOP & Action generators', 'Market analysis', 'Priority support'],
      highlight: true
    },
    {
      name: 'Enterprise',
      price: '$99',
      period: '/mo',
      description: 'Advanced Personalised Advisory for teams',
      features: ['Everything in Pro', '10 team members', 'Admin dashboard', 'API access', 'Dedicated advisor'],
      highlight: false
    }
  ];

  return (
    <div className="min-h-screen bg-white relative overflow-hidden">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/25">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl text-slate-900 hidden sm:block">The Strategy Squad</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <button onClick={() => navigate('/pricing')} className="text-slate-700 hover:text-blue-600 font-medium text-sm transition-colors">Pricing</button>
            <button onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })} className="text-slate-700 hover:text-blue-600 font-medium text-sm transition-colors">Features</button>
            <button onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })} className="text-slate-700 hover:text-blue-600 font-medium text-sm transition-colors">How It Works</button>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              onClick={() => navigate('/login')}
              className="text-slate-700 hover:text-slate-900 hover:bg-slate-100 font-medium"
              data-testid="nav-login-btn"
            >
              Log In
            </Button>
            <Button 
              onClick={() => navigate('/register')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-600/25"
              data-testid="nav-register-btn"
            >
              Start Free
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-50/80 to-white" />
        <div className="absolute top-20 right-0 w-[600px] h-[600px] bg-blue-100 rounded-full blur-[150px] opacity-50" />
        
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Main Content */}
            <div className="lg:col-span-7 space-y-8 animate-fade-in">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 border border-blue-200 rounded-full">
                <Sparkles className="w-4 h-4 text-blue-700" />
                <span className="text-sm font-semibold text-blue-800">Personalised AI Business Advisory</span>
              </div>
              
              <h1 className="font-bold text-4xl sm:text-5xl lg:text-6xl text-slate-900 leading-tight">
                Your Personalised AI Business Advisor That 
                <span className="text-blue-600"> Actually Gets You</span>
              </h1>
              
              <p className="text-lg text-slate-700 max-w-xl leading-relaxed">
                Stop guessing. Start growing. Get <strong>personalised strategic advice</strong> from an AI that 
                knows YOUR business — your challenges, your market, your goals. Not generic tips.
              </p>
              
              <div className="flex flex-wrap gap-4 pt-2">
                <Button 
                  onClick={() => navigate('/register')}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-4 h-auto rounded-xl shadow-xl shadow-blue-600/30 flex items-center gap-2 text-lg"
                  data-testid="hero-cta-btn"
                >
                  Get Your Personalised Advisor
                  <ArrowRight className="w-5 h-5" />
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => navigate('/pricing')}
                  className="border-2 border-slate-300 text-slate-800 hover:bg-slate-100 font-semibold px-8 py-4 h-auto rounded-xl"
                  data-testid="hero-pricing-btn"
                >
                  View Pricing
                </Button>
              </div>
              
              {/* Social Proof */}
              <div className="flex items-center gap-6 pt-4">
                <div className="flex -space-x-2">
                  {['bg-blue-600', 'bg-purple-600', 'bg-emerald-600', 'bg-orange-500'].map((bg, i) => (
                    <div key={i} className={`w-10 h-10 rounded-full ${bg} border-2 border-white flex items-center justify-center`}>
                      <span className="text-white text-xs font-bold">{['SC', 'MJ', 'ER', 'AK'][i]}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="flex items-center gap-1 mb-0.5">
                    {[1,2,3,4,5].map(i => (
                      <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />
                    ))}
                  </div>
                  <p className="text-sm text-slate-600">
                    <span className="font-bold text-slate-800">500+</span> business owners getting personalised advice
                  </p>
                </div>
              </div>
            </div>

            {/* Stats Card */}
            <div className="lg:col-span-5 animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <div className="bg-slate-900 text-white rounded-3xl p-8 relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500 opacity-20 blur-3xl" />
                <div className="absolute bottom-0 left-0 w-40 h-40 bg-purple-500 opacity-20 blur-3xl" />
                
                <p className="text-blue-400 font-semibold text-sm mb-8 tracking-wide uppercase">Why Choose Personalised AI Advisory</p>
                
                <div className="space-y-8 relative z-10">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Zap className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                      <p className="font-bold text-3xl text-white mb-1">24/7</p>
                      <p className="text-slate-400 text-sm">Personalised AI advisor available anytime</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Target className="w-6 h-6 text-purple-400" />
                    </div>
                    <div>
                      <p className="font-bold text-3xl text-white mb-1">100%</p>
                      <p className="text-slate-400 text-sm">Personalised to YOUR specific business</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                      <TrendingUp className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div>
                      <p className="font-bold text-3xl text-white mb-1">10x</p>
                      <p className="text-slate-400 text-sm">Faster than traditional consulting</p>
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
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
            <div className="lg:col-span-5 space-y-6">
              <span className="text-blue-400 font-bold text-sm tracking-wide uppercase">How It Works</span>
              <h2 className="font-bold text-3xl md:text-4xl">
                Three steps to
                <span className="text-blue-400"> personalised business clarity</span>
              </h2>
              <p className="text-slate-300 text-lg">
                Get your personalised AI business advisor in minutes. No complex setup, no lengthy onboarding.
              </p>
            </div>
            
            <div className="lg:col-span-7 space-y-6">
              {[
                { num: '01', title: 'Share Your Business Story', desc: 'Fill your profile and upload key documents. The more context you provide, the more personalised your AI advisor becomes.' },
                { num: '02', title: 'Get Personalised AI Superpowers', desc: 'Chat with an AI that truly understands YOUR business. Ask anything — strategy, operations, marketing, finance. Get advice tailored to you.' },
                { num: '03', title: 'Execute & Grow', desc: 'Get personalised SOPs, action plans, and strategies built for YOUR reality. Implement with confidence.' }
              ].map((step, i) => (
                <div key={step.num} className="flex gap-6 items-start bg-white/5 rounded-2xl p-6 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-colors">
                  <span className="font-bold text-4xl text-blue-500/40">{step.num}</span>
                  <div>
                    <h4 className="font-bold text-xl mb-2 text-white">{step.title}</h4>
                    <p className="text-slate-300 leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
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
              Start free with personalised AI advisory and scale as you grow. No hidden fees.
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
                  onClick={() => navigate('/register')}
                  variant={plan.highlight ? 'default' : 'outline'}
                  className={`w-full h-12 font-semibold rounded-xl ${plan.highlight ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'border-2'}`}
                >
                  Get Started
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
            Ready for personalised business advice?
          </h2>
          <p className="text-blue-100 text-xl mb-10 max-w-2xl mx-auto">
            Join hundreds of business owners who stopped guessing and started growing with 
            their <strong>Personalised AI Business Advisor</strong>.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button 
              onClick={() => navigate('/register')}
              className="bg-white text-blue-600 hover:bg-blue-50 px-10 py-4 h-auto text-lg font-bold rounded-xl shadow-xl"
              data-testid="cta-register-btn"
            >
              Get Your Personalised Advisor
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
            <strong className="text-slate-300">Important:</strong> The Strategy Squad provides general information and educational content only. 
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
              <span className="font-bold text-white text-lg">The Strategy Squad</span>
            </div>
            <div className="flex items-center gap-8">
              <button onClick={() => navigate('/pricing')} className="text-slate-400 hover:text-white text-sm font-medium transition-colors">Pricing</button>
              <button onClick={() => navigate('/terms')} className="text-slate-400 hover:text-white text-sm font-medium transition-colors">Terms & Conditions</button>
              <button className="text-slate-400 hover:text-white text-sm font-medium transition-colors">Privacy Policy</button>
            </div>
          </div>
          <div className="pt-8 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-slate-500 text-sm">
              © 2025 The Strategy Squad Pty Ltd. All rights reserved.
            </p>
            <p className="text-slate-600 text-xs">
              Personalised AI Business Advisory • General Information Only • Not Professional Advice
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
