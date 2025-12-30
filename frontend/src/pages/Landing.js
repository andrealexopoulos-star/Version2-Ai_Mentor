import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { ArrowRight, Zap, Target, FileText, TrendingUp, Brain, Rocket, Check, Star, Shield, BarChart3 } from 'lucide-react';

const Landing = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: Brain,
      title: 'AI That Knows Your Business',
      description: 'Upload your documents, fill your profile, and watch the AI become your personal business expert. Tailored advice, not generic tips.',
      span: 'md:col-span-2'
    },
    {
      icon: Zap,
      title: 'Instant Diagnosis',
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
      description: 'Know your competition. Find your competitive edge with AI analysis.',
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
      description: 'Get started with AI business mentorship',
      features: ['10 AI messages/month', 'Basic profile', '3 document uploads', 'Email support'],
      highlight: false
    },
    {
      name: 'Professional',
      price: '$29',
      period: '/mo',
      description: 'Everything you need to grow',
      features: ['Unlimited AI chat', 'Full business profile', 'Unlimited uploads', 'SOP & Action generators', 'Market analysis', 'Priority support'],
      highlight: true
    },
    {
      name: 'Enterprise',
      price: '$99',
      period: '/mo',
      description: 'For growing teams',
      features: ['Everything in Pro', '10 team members', 'Admin dashboard', 'API access', 'Dedicated manager'],
      highlight: false
    }
  ];

  return (
    <div className="min-h-screen bg-white relative overflow-hidden">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center shadow-lg shadow-blue-600/20">
              <span className="font-heading font-bold text-white text-sm">TS</span>
            </div>
            <span className="font-heading font-bold text-lg text-slate-900 hidden sm:block">The Strategy Squad</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <button onClick={() => navigate('/pricing')} className="text-slate-600 hover:text-slate-900 font-medium text-sm transition-colors">Pricing</button>
            <button onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })} className="text-slate-600 hover:text-slate-900 font-medium text-sm transition-colors">Features</button>
            <button onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })} className="text-slate-600 hover:text-slate-900 font-medium text-sm transition-colors">How It Works</button>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              onClick={() => navigate('/login')}
              className="text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-medium"
              data-testid="nav-login-btn"
            >
              Log In
            </Button>
            <Button 
              onClick={() => navigate('/register')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-lg shadow-blue-600/20"
              data-testid="nav-register-btn"
            >
              Get Started Free
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6 relative">
        {/* Subtle gradient background */}
        <div className="absolute inset-0 bg-gradient-to-b from-blue-50/50 to-white" />
        <div className="absolute top-20 right-0 w-[600px] h-[600px] bg-blue-100 rounded-full blur-[150px] opacity-40" />
        
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Main Content */}
            <div className="lg:col-span-7 space-y-8 animate-fade-in">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-100 rounded-full">
                <Star className="w-4 h-4 text-blue-600 fill-blue-600" />
                <span className="text-sm font-medium text-blue-700">AI-Powered Business Mentorship for SMBs</span>
              </div>
              
              <h1 className="font-heading font-bold text-4xl sm:text-5xl lg:text-6xl text-slate-900 leading-tight">
                Your AI Business Advisor That 
                <span className="gradient-text"> Actually Gets You</span>
              </h1>
              
              <p className="text-lg text-slate-600 max-w-xl leading-relaxed">
                Stop guessing. Start growing. Get personalized strategic advice from an AI that 
                knows your business — your challenges, your market, your goals.
              </p>
              
              <div className="flex flex-wrap gap-4 pt-2">
                <Button 
                  onClick={() => navigate('/register')}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 h-auto rounded-lg shadow-lg shadow-blue-600/25 flex items-center gap-2"
                  data-testid="hero-cta-btn"
                >
                  Start Free Today
                  <ArrowRight className="w-5 h-5" />
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => navigate('/pricing')}
                  className="border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold px-6 py-3 h-auto rounded-lg"
                  data-testid="hero-pricing-btn"
                >
                  View Pricing
                </Button>
              </div>
              
              {/* Social Proof */}
              <div className="flex items-center gap-6 pt-4">
                <div className="flex -space-x-2">
                  {['bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-orange-500'].map((bg, i) => (
                    <div key={i} className={`w-10 h-10 rounded-full ${bg} border-2 border-white flex items-center justify-center`}>
                      <span className="text-white text-xs font-semibold">{['SC', 'MJ', 'ER', 'AK'][i]}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="flex items-center gap-1 mb-0.5">
                    {[1,2,3,4,5].map(i => (
                      <Star key={i} className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                    ))}
                  </div>
                  <p className="text-sm text-slate-500">
                    <span className="font-semibold text-slate-700">500+</span> entrepreneurs growing their business
                  </p>
                </div>
              </div>
            </div>

            {/* Stats Card */}
            <div className="lg:col-span-5 animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <div className="bg-slate-900 text-white rounded-2xl p-8 relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500 opacity-10 blur-3xl" />
                <div className="absolute bottom-0 left-0 w-40 h-40 bg-purple-500 opacity-10 blur-3xl" />
                
                <p className="text-blue-400 font-medium text-sm mb-8 tracking-wide uppercase">Why Choose Us</p>
                
                <div className="space-y-8 relative z-10">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Zap className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                      <p className="font-heading font-bold text-3xl text-white mb-1">24/7</p>
                      <p className="text-slate-400 text-sm">AI advisor that never sleeps</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Target className="w-6 h-6 text-purple-400" />
                    </div>
                    <div>
                      <p className="font-heading font-bold text-3xl text-white mb-1">100%</p>
                      <p className="text-slate-400 text-sm">Personalized to YOUR business</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <TrendingUp className="w-6 h-6 text-green-400" />
                    </div>
                    <div>
                      <p className="font-heading font-bold text-3xl text-white mb-1">10x</p>
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
      <section className="py-12 px-6 bg-slate-50 border-y border-slate-100">
        <div className="max-w-7xl mx-auto">
          <p className="text-center text-sm text-slate-500 mb-8">Trusted by growing businesses across industries</p>
          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 opacity-60">
            {['Professional Services', 'E-commerce', 'SaaS', 'Healthcare', 'Manufacturing'].map((industry, i) => (
              <div key={i} className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-slate-400" />
                <span className="font-medium text-slate-600">{industry}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-blue-600 font-semibold text-sm tracking-wide uppercase">Features</span>
            <h2 className="font-heading font-bold text-3xl md:text-4xl text-slate-900 mt-3 mb-4">
              Everything you need to grow smarter
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              Powerful AI tools designed specifically for small and medium businesses.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div 
                key={feature.title}
                className={`group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-8 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-100/50 transition-all duration-300 ${feature.span}`}
                style={{ animationDelay: `${index * 0.1}s` }}
                data-testid={`feature-card-${index}`}
              >
                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mb-6 group-hover:bg-blue-100 transition-colors duration-300">
                  <feature.icon className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="font-heading font-semibold text-xl text-slate-900 mb-3">{feature.title}</h3>
                <p className="text-slate-600 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24 px-6 bg-slate-900 text-white relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-500 opacity-5 blur-[150px]" />
        
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
            <div className="lg:col-span-5 space-y-6">
              <span className="text-blue-400 font-semibold text-sm tracking-wide uppercase">How It Works</span>
              <h2 className="font-heading font-bold text-3xl md:text-4xl">
                Three steps to
                <span className="text-blue-400"> business clarity</span>
              </h2>
              <p className="text-slate-400 text-lg">
                Get started in minutes. No complex setup, no lengthy onboarding. Just results.
              </p>
            </div>
            
            <div className="lg:col-span-7 space-y-6">
              {[
                { num: '01', title: 'Share Your Business', desc: 'Fill your profile and upload key documents. The more context you provide, the smarter your AI advisor becomes.' },
                { num: '02', title: 'Get AI Superpowers', desc: 'Chat with an AI that truly understands your business. Ask anything — strategy, operations, marketing, finance.' },
                { num: '03', title: 'Execute & Grow', desc: 'Get SOPs, action plans, and strategies built for your reality. Implement with confidence and track your progress.' }
              ].map((step, i) => (
                <div key={step.num} className="flex gap-6 items-start bg-white/5 rounded-xl p-6 backdrop-blur-sm border border-white/10">
                  <span className="font-heading font-bold text-4xl text-blue-500/30">{step.num}</span>
                  <div>
                    <h4 className="font-heading font-semibold text-xl mb-2 text-white">{step.title}</h4>
                    <p className="text-slate-400 leading-relaxed">{step.desc}</p>
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
            <span className="text-blue-600 font-semibold text-sm tracking-wide uppercase">Pricing</span>
            <h2 className="font-heading font-bold text-3xl md:text-4xl text-slate-900 mt-3 mb-4">
              Simple, transparent pricing
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              Start free and scale as you grow. No hidden fees.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {pricingPlans.map((plan, index) => (
              <div 
                key={plan.name}
                className={`relative rounded-2xl p-8 transition-all duration-300 ${
                  plan.highlight 
                    ? 'bg-white border-2 border-blue-600 shadow-xl shadow-blue-100' 
                    : 'bg-white border border-slate-200'
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-blue-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                      Most Popular
                    </span>
                  </div>
                )}
                
                <h3 className="font-heading font-semibold text-lg text-slate-900 mb-2">{plan.name}</h3>
                <p className="text-slate-500 text-sm mb-4">{plan.description}</p>
                
                <div className="mb-6">
                  <span className="font-heading font-bold text-4xl text-slate-900">{plan.price}</span>
                  <span className="text-slate-500">{plan.period}</span>
                </div>
                
                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-slate-600">
                      <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                
                <Button 
                  onClick={() => navigate('/register')}
                  variant={plan.highlight ? 'default' : 'outline'}
                  className={`w-full ${plan.highlight ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}`}
                >
                  Get Started
                </Button>
              </div>
            ))}
          </div>
          
          <div className="text-center mt-8">
            <Button variant="link" onClick={() => navigate('/pricing')} className="text-blue-600">
              View full pricing details
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6 bg-gradient-to-br from-blue-600 to-blue-700 relative overflow-hidden">
        <div className="absolute inset-0 opacity-20" style={{backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px)", backgroundSize: "20px 20px"}} />
        
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <Rocket className="w-16 h-16 mx-auto mb-8 text-blue-200" />
          <h2 className="font-heading font-bold text-3xl md:text-5xl text-white mb-6">
            Ready to transform your business?
          </h2>
          <p className="text-blue-100 text-lg mb-10 max-w-2xl mx-auto">
            Join hundreds of entrepreneurs who stopped guessing and started growing. 
            Your AI business mentor is waiting.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button 
              onClick={() => navigate('/register')}
              className="bg-white text-blue-600 hover:bg-blue-50 px-8 py-3 h-auto text-lg font-semibold rounded-lg shadow-lg"
              data-testid="cta-register-btn"
            >
              Get Started Free
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
          <p className="text-blue-200 text-sm mt-6">
            No credit card required • Free forever plan available
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 bg-slate-900 border-t border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
              <span className="font-heading font-bold text-white text-sm">TS</span>
            </div>
            <span className="font-heading font-semibold text-white">The Strategy Squad</span>
          </div>
          <div className="flex items-center gap-6">
            <button onClick={() => navigate('/pricing')} className="text-slate-400 hover:text-white text-sm transition-colors">Pricing</button>
            <button className="text-slate-400 hover:text-white text-sm transition-colors">Privacy</button>
            <button className="text-slate-400 hover:text-white text-sm transition-colors">Terms</button>
          </div>
          <p className="text-slate-500 text-sm">
            © 2024 The Strategy Squad. Built for businesses that want more.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
