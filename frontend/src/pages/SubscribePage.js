import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { resolveTier } from '../lib/tierResolver';
import { Lock, ArrowRight, Check, Zap, Shield, TrendingUp, BarChart3 } from 'lucide-react';

const HEAD = "'Cormorant Garamond', Georgia, serif";
const BODY = "'Inter', sans-serif";
const MONO = "'JetBrains Mono', monospace";

const FEATURE_LABELS = {
  '/revenue': 'Revenue Engine',
  '/operations': 'Operations Intelligence',
  '/risk': 'Risk & Workforce',
  '/compliance': 'Compliance Intelligence',
  '/reports': 'Intelligence Reports',
  '/audit-log': 'Governance Audit Log',
  '/soundboard': 'Soundboard Chat',
  '/war-room': 'War Room',
  '/board-room': 'Board Room',
  '/sop-generator': 'SOP Generator',
  '/alerts': 'Alerts',
  '/actions': 'Actions',
  '/email-inbox': 'Priority Inbox',
  '/market': 'Market Deep Analysis',
};

const PLANS = [
  {
    name: 'Free',
    price: '$0',
    period: '/month',
    color: '#64748B',
    current: true,
    features: ['Market Intelligence (basic)', 'Business DNA', '1 Forensic Audit/month', '3 Snapshots/month', 'Email Integration'],
  },
  {
    name: 'Starter',
    price: '$197',
    period: '/month',
    color: '#FF6A00',
    recommended: true,
    features: ['Everything in Free', 'Revenue Engine', 'Risk & Workforce', 'Operations Intelligence', 'Compliance', 'Reports & Audit Log', 'Soundboard Chat', 'SOP Generator', 'Priority Inbox', 'Unlimited Snapshots'],
  },
  {
    name: 'Professional',
    price: '$497',
    period: '/month',
    color: '#7C3AED',
    features: ['Everything in Starter', 'War Room', 'Board Room', 'Deep Market Analysis', 'Outcome Tracking', 'Custom Integrations', 'Priority Support'],
  },
];

const SubscribePage = () => {
  const { user } = useSupabaseAuth();
  const [searchParams] = useSearchParams();
  const from = searchParams.get('from') || '';
  const featureLabel = FEATURE_LABELS[from] || from.replace('/', '').replace('-', ' ');
  const currentTier = resolveTier(user);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12" style={{ background: '#0F1720' }} data-testid="subscribe-page">
      {/* Header */}
      <div className="text-center mb-10 max-w-xl">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ background: '#FF6A0015' }}>
          <Lock className="w-6 h-6 text-[#FF6A00]" />
        </div>
        {featureLabel && (
          <p className="text-xs text-[#FF6A00] mb-2" style={{ fontFamily: MONO }}>
            {featureLabel} requires a paid plan
          </p>
        )}
        <h1 className="text-3xl font-bold text-[#F4F7FA] mb-3" style={{ fontFamily: HEAD }}>
          Upgrade Your Intelligence
        </h1>
        <p className="text-sm text-[#9FB0C3]" style={{ fontFamily: BODY }}>
          Unlock the full power of BIQc's cognitive platform. Your current plan: <strong className="text-[#F4F7FA] capitalize">{currentTier}</strong>
        </p>
      </div>

      {/* Plans */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl w-full mb-8">
        {PLANS.map(plan => {
          const isCurrent = plan.name.toLowerCase() === currentTier;
          return (
            <div key={plan.name} className="rounded-xl p-6 relative" style={{
              background: '#141C26',
              border: `2px solid ${plan.recommended ? plan.color : isCurrent ? '#243140' : '#243140'}`,
              boxShadow: plan.recommended ? `0 8px 32px ${plan.color}20` : 'none',
            }} data-testid={`plan-${plan.name.toLowerCase()}`}>
              {plan.recommended && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-semibold px-3 py-1 rounded-full text-white" style={{ background: plan.color, fontFamily: MONO }}>
                  RECOMMENDED
                </span>
              )}
              <h3 className="text-lg font-semibold text-[#F4F7FA] mb-1" style={{ fontFamily: HEAD }}>{plan.name}</h3>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-3xl font-bold" style={{ color: plan.color, fontFamily: MONO }}>{plan.price}</span>
                <span className="text-xs text-[#64748B]" style={{ fontFamily: MONO }}>{plan.period}</span>
              </div>
              <div className="space-y-2 mb-6">
                {plan.features.map(f => (
                  <div key={f} className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 shrink-0" style={{ color: plan.color }} />
                    <span className="text-xs text-[#9FB0C3]">{f}</span>
                  </div>
                ))}
              </div>
              {isCurrent ? (
                <span className="block text-center text-xs text-[#64748B] py-2" style={{ fontFamily: MONO }}>Current Plan</span>
              ) : (
                <button className="w-full py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2" style={{ background: plan.color }} data-testid={`select-${plan.name.toLowerCase()}`}>
                  {plan.name === 'Free' ? 'Downgrade' : 'Upgrade'} <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Back link */}
      <Link to="/advisor" className="text-xs text-[#64748B] hover:text-[#9FB0C3] transition-colors" style={{ fontFamily: MONO }}>
        Back to dashboard
      </Link>
    </div>
  );
};

export default SubscribePage;
