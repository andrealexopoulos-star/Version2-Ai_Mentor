import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Check, X, ArrowRight, Sparkles, Shield, Zap, Users, HeadphonesIcon, Building2 } from 'lucide-react';

const Pricing = () => {
  const navigate = useNavigate();

  const plans = [
    {
      name: 'Starter',
      price: 'Free',
      period: 'forever',
      description: 'Perfect for exploring and getting started with AI business mentorship.',
      highlight: false,
      features: [
        { text: '10 AI chat messages/month', included: true },
        { text: 'Basic business profile', included: true },
        { text: '3 document uploads', included: true },
        { text: 'Business diagnosis (1/month)', included: true },
        { text: 'Email support', included: true },
        { text: 'SOP generator', included: false },
        { text: 'Action plan generator', included: false },
        { text: 'Market analysis tools', included: false },
        { text: 'Priority AI responses', included: false },
        { text: 'Team collaboration', included: false },
      ],
      cta: 'Get Started Free',
      ctaVariant: 'outline'
    },
    {
      name: 'Professional',
      price: '$29',
      period: '/month',
      description: 'Everything you need to accelerate your business growth.',
      highlight: true,
      badge: 'Most Popular',
      features: [
        { text: 'Unlimited AI chat messages', included: true },
        { text: 'Complete business profile', included: true },
        { text: 'Unlimited document uploads', included: true },
        { text: 'Unlimited business diagnoses', included: true },
        { text: 'Priority email support', included: true },
        { text: 'SOP generator', included: true },
        { text: 'Action plan generator', included: true },
        { text: 'Checklist generator', included: true },
        { text: 'Market analysis tools', included: true },
        { text: 'Export to PDF', included: true },
      ],
      cta: 'Start 14-Day Free Trial',
      ctaVariant: 'default'
    },
    {
      name: 'Enterprise',
      price: '$99',
      period: '/month',
      description: 'Advanced features for growing teams and organizations.',
      highlight: false,
      features: [
        { text: 'Everything in Professional', included: true },
        { text: 'Up to 10 team members', included: true },
        { text: 'Admin dashboard & controls', included: true },
        { text: 'Priority AI responses', included: true },
        { text: 'Dedicated account manager', included: true },
        { text: 'Custom integrations', included: true },
        { text: 'API access', included: true },
        { text: 'White-glove onboarding', included: true },
        { text: 'Phone support', included: true },
        { text: 'Custom AI training', included: true },
      ],
      cta: 'Contact Sales',
      ctaVariant: 'outline'
    }
  ];

  const testimonials = [
    {
      quote: "The Strategy Squad helped me identify bottlenecks I didn't even know existed. Revenue up 40% in 3 months.",
      author: "Sarah Chen",
      role: "Founder, Bloom Digital",
      avatar: "SC"
    },
    {
      quote: "Like having a McKinsey consultant on retainer, but affordable. The SOPs alone saved us 20 hours/week.",
      author: "Marcus Johnson",
      role: "CEO, TechFlow Solutions",
      avatar: "MJ"
    },
    {
      quote: "Finally, an AI that actually understands MY business. Not generic advice - real, actionable strategies.",
      author: "Elena Rodriguez",
      role: "Owner, Craft & Co",
      avatar: "ER"
    }
  ];

  const faqs = [
    {
      q: "Can I switch plans anytime?",
      a: "Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately, and we'll prorate your billing."
    },
    {
      q: "What happens when I hit my message limit?",
      a: "On the Starter plan, you'll be notified when approaching your limit. Upgrade anytime to continue chatting with your AI advisor."
    },
    {
      q: "Is my business data secure?",
      a: "Absolutely. We use enterprise-grade encryption and never share your data. Your business information is used only to personalize your AI experience."
    },
    {
      q: "Do you offer refunds?",
      a: "Yes, we offer a 30-day money-back guarantee. If you're not satisfied, contact us for a full refund."
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <button 
            onClick={() => navigate('/')}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center">
              <span className="font-heading font-bold text-white text-sm">TS</span>
            </div>
            <span className="font-heading font-bold text-lg text-slate-900 hidden sm:block">The Strategy Squad</span>
          </button>
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              onClick={() => navigate('/login')}
              className="text-slate-600 hover:text-slate-900 font-medium"
            >
              Log In
            </Button>
            <Button 
              onClick={() => navigate('/register')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg"
            >
              Get Started
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-full mb-6">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-700">Simple, transparent pricing</span>
          </div>
          <h1 className="font-heading font-bold text-4xl md:text-5xl lg:text-6xl text-slate-900 mb-6">
            Choose the plan that's
            <span className="gradient-text"> right for you</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto">
            Start free and scale as you grow. No hidden fees, no long-term contracts. 
            Cancel anytime.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-12 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-6">
            {plans.map((plan, index) => (
              <div 
                key={plan.name}
                className={`relative rounded-2xl p-8 transition-all duration-300 ${
                  plan.highlight 
                    ? 'bg-white border-2 border-blue-600 shadow-xl shadow-blue-100 scale-105 z-10' 
                    : 'bg-white border border-slate-200 hover:border-slate-300 hover:shadow-lg'
                }`}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                {plan.highlight && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm font-semibold px-4 py-1.5 rounded-full">
                      Most Popular
                    </span>
                  </div>
                )}
                
                <div className="mb-6">
                  <h3 className="font-heading font-bold text-xl text-slate-900 mb-2">{plan.name}</h3>
                  <p className="text-slate-500 text-sm">{plan.description}</p>
                </div>

                <div className="mb-6">
                  <span className="font-heading font-bold text-5xl text-slate-900">{plan.price}</span>
                  <span className="text-slate-500 text-lg">{plan.period}</span>
                </div>

                <Button 
                  onClick={() => navigate('/register')}
                  variant={plan.ctaVariant}
                  className={`w-full mb-8 h-12 font-semibold rounded-lg ${
                    plan.highlight 
                      ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                      : 'border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {plan.cta}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>

                <div className="space-y-3">
                  {plan.features.map((feature, i) => (
                    <div key={i} className="flex items-start gap-3">
                      {feature.included ? (
                        <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      ) : (
                        <X className="w-5 h-5 text-slate-300 flex-shrink-0 mt-0.5" />
                      )}
                      <span className={feature.included ? 'text-slate-700' : 'text-slate-400'}>
                        {feature.text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Badges */}
      <section className="py-16 px-6 bg-slate-50">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center mx-auto mb-3">
                <Shield className="w-6 h-6 text-blue-600" />
              </div>
              <p className="font-medium text-slate-900">Bank-level Security</p>
              <p className="text-sm text-slate-500">256-bit encryption</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center mx-auto mb-3">
                <Zap className="w-6 h-6 text-blue-600" />
              </div>
              <p className="font-medium text-slate-900">99.9% Uptime</p>
              <p className="text-sm text-slate-500">Always available</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center mx-auto mb-3">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <p className="font-medium text-slate-900">500+ Businesses</p>
              <p className="text-sm text-slate-500">Trust us daily</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center mx-auto mb-3">
                <HeadphonesIcon className="w-6 h-6 text-blue-600" />
              </div>
              <p className="font-medium text-slate-900">Expert Support</p>
              <p className="text-sm text-slate-500">We're here to help</p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-heading font-bold text-3xl md:text-4xl text-slate-900 mb-4">
              Loved by entrepreneurs worldwide
            </h2>
            <p className="text-slate-600">See what business owners are saying about The Strategy Squad</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((testimonial, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-center gap-1 mb-4">
                  {[1,2,3,4,5].map(star => (
                    <svg key={star} className="w-5 h-5 text-yellow-400 fill-current" viewBox="0 0 20 20">
                      <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z"/>
                    </svg>
                  ))}
                </div>
                <p className="text-slate-700 mb-6 leading-relaxed">"{testimonial.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-semibold">{testimonial.avatar}</span>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{testimonial.author}</p>
                    <p className="text-sm text-slate-500">{testimonial.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-6 bg-slate-50">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-heading font-bold text-3xl md:text-4xl text-slate-900 mb-4">
              Frequently asked questions
            </h2>
            <p className="text-slate-600">Everything you need to know about our pricing</p>
          </div>
          
          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-xl p-6">
                <h3 className="font-semibold text-slate-900 mb-2">{faq.q}</h3>
                <p className="text-slate-600">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 bg-gradient-to-br from-blue-600 to-blue-700">
        <div className="max-w-4xl mx-auto text-center">
          <Building2 className="w-12 h-12 text-blue-200 mx-auto mb-6" />
          <h2 className="font-heading font-bold text-3xl md:text-4xl text-white mb-4">
            Ready to transform your business?
          </h2>
          <p className="text-blue-100 text-lg mb-8 max-w-2xl mx-auto">
            Join 500+ entrepreneurs who are using AI to work smarter, not harder. 
            Start your free account today.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button 
              onClick={() => navigate('/register')}
              className="bg-white text-blue-600 hover:bg-blue-50 font-semibold px-8 h-12 rounded-lg"
            >
              Get Started Free
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button 
              variant="outline"
              onClick={() => navigate('/login')}
              className="border-white/30 text-white hover:bg-white/10 font-semibold px-8 h-12 rounded-lg"
            >
              Talk to Sales
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 bg-slate-900">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
              <span className="font-heading font-bold text-white text-sm">TS</span>
            </div>
            <span className="font-heading font-semibold text-white">The Strategy Squad</span>
          </div>
          <p className="text-slate-400 text-sm">
            © 2024 The Strategy Squad. Built for businesses that want more.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Pricing;
