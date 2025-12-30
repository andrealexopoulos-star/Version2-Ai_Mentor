import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { ArrowRight, Zap, Target, FileText, TrendingUp, Brain, Rocket } from 'lucide-react';

const Landing = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: Brain,
      title: 'AI That Gets You',
      description: 'Upload your docs, fill your profile, and watch the AI become your personal business expert.',
      span: 'md:col-span-2'
    },
    {
      icon: Zap,
      title: 'Instant Diagnosis',
      description: 'Find bottlenecks and get fixes in minutes, not months.',
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
      title: 'Market Intel',
      description: 'Know your competition. Find your edge.',
      span: 'md:col-span-1'
    },
    {
      icon: TrendingUp,
      title: 'Growth Roadmaps',
      description: 'Strategic action plans tailored to YOUR business reality.',
      span: 'md:col-span-1'
    }
  ];

  return (
    <div className="min-h-screen bg-[#F3F3EE] relative overflow-hidden">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass">
        <div className="max-w-[1400px] mx-auto px-6 md:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#CCFF00] flex items-center justify-center">
              <span className="font-heading font-extrabold text-[#051F1A] text-lg">TS</span>
            </div>
            <span className="font-heading font-bold text-xl text-[#051F1A] hidden sm:block">THE STRATEGY SQUAD</span>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              onClick={() => navigate('/login')}
              className="text-[#051F1A] hover:bg-[#051F1A]/5 font-semibold"
              data-testid="nav-login-btn"
            >
              Log In
            </Button>
            <Button 
              onClick={() => navigate('/register')}
              className="btn-primary text-sm"
              data-testid="nav-register-btn"
            >
              Get Started
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-24 px-6 md:px-8 relative">
        {/* Background Image */}
        <div 
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: 'url(https://images.pexels.com/photos/18545023/pexels-photo-18545023.jpeg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        />
        
        <div className="max-w-[1400px] mx-auto relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
            {/* Main Content - Spans 8 columns */}
            <div className="md:col-span-8 space-y-8 animate-fade-in">
              <p className="label-mono text-[#FF0099]">AI-Powered Business Mentorship</p>
              <h1 className="font-heading font-extrabold text-5xl sm:text-6xl md:text-7xl lg:text-8xl text-[#051F1A] tracking-tighter leading-[0.9] uppercase">
                Your Secret<br />
                <span className="text-[#051F1A]/60">Weapon</span> for<br />
                Growth
              </h1>
              <p className="text-lg md:text-xl text-[#051F1A]/70 max-w-xl leading-relaxed font-body">
                Stop guessing. Start growing. Get an AI advisor that actually knows 
                your business — your challenges, your market, your goals.
              </p>
              <div className="flex flex-wrap gap-4 pt-4">
                <Button 
                  onClick={() => navigate('/register')}
                  className="btn-primary text-base flex items-center gap-2"
                  data-testid="hero-cta-btn"
                >
                  Start Free
                  <ArrowRight className="w-5 h-5" />
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => navigate('/login')}
                  className="btn-secondary text-base"
                  data-testid="hero-signin-btn"
                >
                  I Have an Account
                </Button>
              </div>
              
              {/* Social Proof */}
              <div className="flex items-center gap-6 pt-8">
                <div className="flex -space-x-2">
                  {[1,2,3,4].map(i => (
                    <div key={i} className="w-10 h-10 rounded-full bg-gradient-to-br from-[#CCFF00] to-[#FF0099] border-2 border-[#F3F3EE]" />
                  ))}
                </div>
                <p className="text-sm text-[#051F1A]/60">
                  <span className="font-bold text-[#051F1A]">500+</span> entrepreneurs leveling up
                </p>
              </div>
            </div>

            {/* Stats Card - Spans 4 columns */}
            <div className="md:col-span-4 animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <div className="bg-[#051F1A] text-white p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#CCFF00] opacity-20 blur-3xl" />
                <p className="label-mono text-[#CCFF00] mb-8">Why We're Different</p>
                <div className="space-y-8 relative z-10">
                  <div>
                    <p className="font-heading font-extrabold text-5xl text-[#CCFF00]">24/7</p>
                    <p className="text-white/60 text-sm mt-1">AI advisor that never sleeps</p>
                  </div>
                  <div>
                    <p className="font-heading font-extrabold text-5xl text-[#CCFF00]">100%</p>
                    <p className="text-white/60 text-sm mt-1">Personalized to YOUR business</p>
                  </div>
                  <div>
                    <p className="font-heading font-extrabold text-5xl text-[#CCFF00]">10x</p>
                    <p className="text-white/60 text-sm mt-1">Faster than traditional consulting</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section - Bento Grid */}
      <section className="py-24 md:py-32 px-6 md:px-8 bg-white">
        <div className="max-w-[1400px] mx-auto">
          <div className="mb-16">
            <p className="label-mono text-[#FF0099] mb-4">What You Get</p>
            <h2 className="font-heading font-bold text-4xl md:text-5xl text-[#051F1A] tracking-tight max-w-2xl">
              Everything you need to run smarter, not harder
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {features.map((feature, index) => (
              <div 
                key={feature.title}
                className={`group relative overflow-hidden border border-[#E5E5E0] bg-[#F3F3EE] p-8 hover:bg-white hover:border-[#CCFF00] transition-all duration-300 ${feature.span}`}
                style={{ animationDelay: `${index * 0.1}s` }}
                data-testid={`feature-card-${index}`}
              >
                <div className="w-12 h-12 bg-[#051F1A] flex items-center justify-center mb-6 group-hover:bg-[#CCFF00] transition-colors duration-300">
                  <feature.icon className="w-6 h-6 text-[#CCFF00] group-hover:text-[#051F1A] transition-colors duration-300" />
                </div>
                <h3 className="font-heading font-bold text-xl text-[#051F1A] mb-3">{feature.title}</h3>
                <p className="text-[#051F1A]/60 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 md:py-32 px-6 md:px-8 bg-[#051F1A] text-white relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#CCFF00] opacity-10 blur-[150px]" />
        
        <div className="max-w-[1400px] mx-auto relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-12 items-center">
            <div className="md:col-span-5 space-y-6">
              <p className="label-mono text-[#CCFF00]">How It Works</p>
              <h2 className="font-heading font-bold text-4xl md:text-5xl tracking-tight">
                Three steps to<br />
                <span className="text-[#CCFF00]">business clarity</span>
              </h2>
            </div>
            <div className="md:col-span-7 md:col-start-7 space-y-8">
              {[
                { num: '01', title: 'Tell Us Everything', desc: 'Fill your profile. Upload your docs. The more we know, the smarter we get.' },
                { num: '02', title: 'Get AI Superpowers', desc: 'Your AI advisor learns your business inside out. Ask anything.' },
                { num: '03', title: 'Execute & Win', desc: 'Get SOPs, action plans, and strategies built for YOUR reality.' }
              ].map((step, i) => (
                <div key={step.num} className="flex gap-6 items-start animate-fade-in" style={{ animationDelay: `${i * 0.15}s` }}>
                  <span className="font-heading font-extrabold text-6xl text-[#CCFF00]/30">{step.num}</span>
                  <div className="pt-2">
                    <h4 className="font-heading font-bold text-xl mb-2">{step.title}</h4>
                    <p className="text-white/60">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 md:py-32 px-6 md:px-8 bg-[#CCFF00] relative overflow-hidden">
        <div className="absolute inset-0 noise-overlay" />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <Rocket className="w-16 h-16 mx-auto mb-8 text-[#051F1A]" />
          <h2 className="font-heading font-extrabold text-4xl md:text-6xl text-[#051F1A] tracking-tight mb-6 uppercase">
            Ready to Level Up?
          </h2>
          <p className="text-[#051F1A]/70 text-lg mb-10 max-w-2xl mx-auto">
            Join hundreds of entrepreneurs who stopped guessing and started growing. 
            Your AI business mentor is waiting.
          </p>
          <Button 
            onClick={() => navigate('/register')}
            className="bg-[#051F1A] text-white hover:bg-[#0a3d32] px-12 py-6 text-lg font-bold uppercase tracking-wide rounded-full"
            data-testid="cta-register-btn"
          >
            Get Started Free
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 md:px-8 bg-[#051F1A] border-t border-white/10">
        <div className="max-w-[1400px] mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#CCFF00] flex items-center justify-center">
              <span className="font-heading font-extrabold text-[#051F1A]">TS</span>
            </div>
            <span className="font-heading font-bold text-white">THE STRATEGY SQUAD</span>
          </div>
          <p className="text-white/40 text-sm">
            © 2024 The Strategy Squad. Built for entrepreneurs who want more.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
