import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { ArrowRight, BarChart3, FileText, Target, Users, Zap, TrendingUp } from 'lucide-react';

const Landing = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: BarChart3,
      title: 'Business Analysis',
      description: 'Deep-dive into your business model, operations, and strategies with AI-powered insights.'
    },
    {
      icon: FileText,
      title: 'SOP Generator',
      description: 'Create professional Standard Operating Procedures, checklists, and action plans instantly.'
    },
    {
      icon: Target,
      title: 'Market Intelligence',
      description: 'Understand your market position, competitors, and growth opportunities.'
    },
    {
      icon: TrendingUp,
      title: 'Financial Guidance',
      description: 'Master cash flow, budgeting, and revenue optimization strategies.'
    },
    {
      icon: Users,
      title: 'Leadership Coaching',
      description: 'Build stronger teams and develop your leadership capabilities.'
    },
    {
      icon: Zap,
      title: 'Action Plans',
      description: 'Transform insights into structured, executable plans with clear milestones.'
    }
  ];

  return (
    <div className="min-h-screen bg-[#f5f5f0]">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#0f2f24] rounded-sm flex items-center justify-center">
              <span className="text-[#ccff00] font-bold text-sm">SA</span>
            </div>
            <span className="font-serif text-xl font-semibold text-[#0f2f24]">Strategic Advisor</span>
          </div>
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              onClick={() => navigate('/login')}
              className="text-[#0f2f24] hover:bg-[#0f2f24]/5"
              data-testid="nav-login-btn"
            >
              Sign In
            </Button>
            <Button 
              onClick={() => navigate('/register')}
              className="btn-lime rounded-full px-6"
              data-testid="nav-register-btn"
            >
              Get Started
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section - Tetris Grid */}
      <section className="pt-32 pb-24 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
          {/* Main Content - Spans 7 columns */}
          <div className="md:col-span-7 space-y-8 animate-fade-in">
            <p className="overline text-[#0f2f24]/60">AI-Powered Business Intelligence</p>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-serif text-[#0f2f24] leading-tight">
              Your Strategic <br />
              <em className="text-[#0f2f24]/70">Business Partner</em>
            </h1>
            <p className="text-lg text-[#0f2f24]/70 max-w-xl leading-relaxed">
              Transform your small or medium business with AI-driven insights, 
              actionable strategies, and professional documentation—all in one powerful platform.
            </p>
            <div className="flex flex-wrap gap-4 pt-4">
              <Button 
                onClick={() => navigate('/register')}
                className="btn-forest rounded-full px-8 py-6 text-base flex items-center gap-2"
                data-testid="hero-cta-btn"
              >
                Start Free Analysis
                <ArrowRight className="w-4 h-4" />
              </Button>
              <Button 
                variant="outline"
                onClick={() => navigate('/login')}
                className="rounded-full px-8 py-6 text-base border-[#0f2f24] text-[#0f2f24] hover:bg-[#0f2f24] hover:text-white"
                data-testid="hero-signin-btn"
              >
                Sign In
              </Button>
            </div>
          </div>

          {/* Stats Card - Spans 5 columns */}
          <div className="md:col-span-5 md:col-start-8" style={{ animationDelay: '0.2s' }}>
            <div className="bg-[#0f2f24] text-white p-8 rounded-sm animate-fade-in">
              <p className="overline text-[#ccff00] mb-6">Trusted by SMBs</p>
              <div className="space-y-6">
                <div>
                  <p className="text-4xl font-serif font-semibold text-[#ccff00]">500+</p>
                  <p className="text-white/60 text-sm mt-1">Businesses Optimized</p>
                </div>
                <div>
                  <p className="text-4xl font-serif font-semibold text-[#ccff00]">10,000+</p>
                  <p className="text-white/60 text-sm mt-1">Strategies Generated</p>
                </div>
                <div>
                  <p className="text-4xl font-serif font-semibold text-[#ccff00]">98%</p>
                  <p className="text-white/60 text-sm mt-1">Satisfaction Rate</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 stagger-children">
            <p className="overline text-[#0f2f24]/60 mb-4">Capabilities</p>
            <h2 className="text-4xl md:text-5xl font-serif text-[#0f2f24] mb-6">
              Everything You Need to <em>Grow</em>
            </h2>
            <p className="text-[#0f2f24]/60 max-w-2xl mx-auto">
              From strategic analysis to actionable documentation, we provide the tools 
              that transform how you run your business.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div 
                key={feature.title}
                className="feature-card animate-fade-in"
                style={{ animationDelay: `${index * 0.1}s` }}
                data-testid={`feature-card-${index}`}
              >
                <div className="w-12 h-12 bg-[#ccff00] rounded-sm flex items-center justify-center mb-6">
                  <feature.icon className="w-6 h-6 text-[#0f2f24]" />
                </div>
                <h3 className="text-xl font-serif text-[#0f2f24] mb-3">{feature.title}</h3>
                <p className="text-[#0f2f24]/60 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-12 items-center">
          <div className="md:col-span-5 space-y-6">
            <p className="overline text-[#0f2f24]/60">How It Works</p>
            <h2 className="text-4xl md:text-5xl font-serif text-[#0f2f24]">
              Three Steps to <br /><em>Business Excellence</em>
            </h2>
          </div>
          <div className="md:col-span-7 md:col-start-7 space-y-8">
            {[
              { num: '01', title: 'Share Your Context', desc: 'Tell us about your business, challenges, and goals.' },
              { num: '02', title: 'Get AI Analysis', desc: 'Our AI advisor analyzes and provides tailored recommendations.' },
              { num: '03', title: 'Execute & Grow', desc: 'Implement action plans with professional SOPs and checklists.' }
            ].map((step, i) => (
              <div key={step.num} className="flex gap-6 items-start animate-fade-in" style={{ animationDelay: `${i * 0.15}s` }}>
                <span className="text-5xl font-serif text-[#ccff00] font-semibold">{step.num}</span>
                <div>
                  <h4 className="text-xl font-serif text-[#0f2f24] mb-2">{step.title}</h4>
                  <p className="text-[#0f2f24]/60">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6 bg-[#0f2f24]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-serif text-white mb-6">
            Ready to Transform Your Business?
          </h2>
          <p className="text-white/60 text-lg mb-10 max-w-2xl mx-auto">
            Join hundreds of SMB owners who are already using Strategic Advisor 
            to optimize their operations and accelerate growth.
          </p>
          <Button 
            onClick={() => navigate('/register')}
            className="btn-lime rounded-full px-10 py-6 text-lg"
            data-testid="cta-register-btn"
          >
            Get Started Free
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 bg-[#0f2f24] border-t border-white/10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#ccff00] rounded-sm flex items-center justify-center">
              <span className="text-[#0f2f24] font-bold text-sm">SA</span>
            </div>
            <span className="font-serif text-xl text-white">Strategic Advisor</span>
          </div>
          <p className="text-white/40 text-sm">
            © 2024 Strategic Advisor. Built for SMB success.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
