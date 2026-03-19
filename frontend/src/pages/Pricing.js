import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { ArrowRight, Check, Shield } from 'lucide-react';
import { fontFamily } from '../design-system/tokens';
import { PRICING_TIERS } from '../config/pricingTiers';

export default function Pricing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen" style={{ background: '#0A0F18', color: '#F4F7FA' }} data-testid="pricing-page">
      <nav className="fixed top-0 left-0 right-0 z-50" style={{ background: '#0A0F18E0', backdropFilter: 'blur(12px)', borderBottom: '1px solid #243140' }}>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded-md flex items-center justify-center" style={{ background: '#FF6A00' }}>
              <span className="text-white font-bold text-xs" style={{ fontFamily: fontFamily.mono }}>B</span>
            </div>
            <span className="font-semibold text-sm text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>BIQc</span>
          </button>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => navigate('/login-supabase')} className="text-[#9FB0C3] hover:text-white" data-testid="pricing-login">Log In</Button>
            <Button onClick={() => navigate('/register-supabase')} className="text-white font-medium rounded-lg" style={{ background: '#FF6A00' }} data-testid="pricing-cta-nav">Start Free</Button>
          </div>
        </div>
      </nav>

      <section className="px-6 pt-32 pb-12 text-center">
        <div className="mx-auto max-w-3xl">
          <h1 className="font-bold text-4xl md:text-6xl" style={{ fontFamily: fontFamily.display }}>
            One free launch tier.<br />One paid operating tier.
          </h1>
          <p className="mt-5 text-base md:text-lg" style={{ color: '#9FB0C3', fontFamily: fontFamily.body }}>
            Launch fast with the core BIQc surfaces for free. Upgrade to BIQc Foundation when you need deeper operating control.
          </p>
        </div>
      </section>

      <section className="px-6 pb-10">
        <div className="mx-auto grid max-w-5xl gap-5 md:grid-cols-2">
          {PRICING_TIERS.map((plan) => (
            <div key={plan.id} className="rounded-[28px] border p-7" style={{ background: '#141C26', borderColor: plan.popular ? 'rgba(255,106,0,0.35)' : '#243140', boxShadow: plan.popular ? '0 0 32px rgba(255,106,0,0.12)' : 'none' }} data-testid={`plan-${plan.id}`}>
              <p className="text-[10px] uppercase tracking-[0.18em]" style={{ color: plan.color, fontFamily: fontFamily.mono }}>{plan.subtitle}</p>
              <h2 className="mt-3 text-3xl" style={{ fontFamily: fontFamily.display }}>{plan.name}</h2>
              <div className="mt-4 flex items-end gap-2">
                <span className="text-5xl" style={{ fontFamily: fontFamily.display }}>{plan.price}</span>
                <span className="pb-2 text-sm" style={{ color: '#64748B' }}>{plan.period}</span>
              </div>
              <div className="mt-8 space-y-3">
                {plan.features.map((feature) => (
                  <div key={feature} className="flex items-start gap-2 text-sm" style={{ color: '#C9D5E2' }}>
                    <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: plan.color }} />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
              <Button
                onClick={() => navigate(plan.id === 'free' ? '/register-supabase' : '/register-supabase')}
                className="mt-8 h-12 w-full rounded-2xl text-white"
                style={{ background: plan.id === 'free' ? '#243140' : '#FF6A00', fontFamily: fontFamily.body }}
                data-testid={`cta-${plan.id}`}
              >
                {plan.id === 'free' ? 'Start Free' : 'Start with Free, then Upgrade'} <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </section>

      <section className="px-6 pb-16">
        <div className="mx-auto max-w-5xl rounded-[28px] border p-6 sm:p-8" style={{ background: '#0F1720', borderColor: '#243140' }}>
          <div className="flex flex-wrap items-center gap-3">
            <Shield className="h-5 w-5" style={{ color: '#FF6A00' }} />
            <p className="text-sm" style={{ color: '#9FB0C3' }}>Australian hosted · sovereign posture · email-only free tier · one commercial paid tier for expedited launch</p>
          </div>
        </div>
      </section>
    </div>
  );
}