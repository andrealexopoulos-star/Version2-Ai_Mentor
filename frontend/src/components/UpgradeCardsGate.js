import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { resolveTier, hasAccess, TIER_RANK } from '../lib/tierResolver';
import { Check, ArrowRight } from 'lucide-react';
import { PRICING_TIERS } from '../config/pricingTiers';
import { fontFamily } from '../design-system/tokens';


const PLANS = PRICING_TIERS;

export default function UpgradeCardsGate({ children, requiredTier = 'starter', featureName = 'This feature' }) {
  const { user } = useSupabaseAuth();
  const navigate = useNavigate();
  const tier = resolveTier(user);

  if (hasAccess(tier, requiredTier)) return children;

  const currentRank = TIER_RANK[tier] || 0;

  const handlePlanClick = (plan) => {
    if (plan.id === 'super_admin') {
      navigate('/contact');
    } else {
      navigate(`/subscribe?plan=${plan.id}&from=${encodeURIComponent(window.location.pathname)}`);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4" style={{ background: '#FF6A0015', border: '1px solid #FF6A0030' }}>
          <span className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: '#FF6A00', fontFamily: fontFamily.mono }}>Upgrade Required</span>
        </div>
        <h1 className="text-3xl font-normal mb-2" style={{ color: '#F4F7FA', fontFamily: fontFamily.display }}>{featureName}</h1>
        <p className="text-sm max-w-md mx-auto" style={{ color: '#9FB0C3', fontFamily: fontFamily.body }}>
          Unlock this feature by upgrading to the right plan. Choose the tier that fits your business.
        </p>
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {PLANS.filter(p => p.id !== 'free').map((plan) => {
          const planRank = TIER_RANK[plan.id] || 0;
          const isCurrent = plan.id === tier;
          const isRecommended = plan.popular;
          const isUpgrade = planRank > currentRank;
          const ctaLabel = plan.cta || (plan.price ? `Upgrade to ${plan.name}` : 'Speak to Sales');

          return (
            <div key={plan.id}
              className={`relative rounded-2xl p-5 flex flex-col transition-all ${isUpgrade ? 'cursor-pointer hover:brightness-110 hover:-translate-y-1' : 'opacity-60'}`}
              style={{
                background: isRecommended ? '#0F1720' : '#141C26',
                border: `1.5px solid ${isRecommended ? plan.color : isCurrent ? plan.color + '40' : '#243140'}`,
                boxShadow: isRecommended ? `0 0 30px ${plan.color}20` : 'none',
              }}
              onClick={() => isUpgrade && handlePlanClick(plan)}
              data-testid={`upgrade-plan-${plan.id}`}>
              {isRecommended && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase"
                  style={{ background: plan.color, color: 'white', fontFamily: fontFamily.mono }}>Most Adopted</div>
              )}
              {isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase"
                  style={{ background: '#243140', color: '#9FB0C3', fontFamily: fontFamily.mono }}>Current Plan</div>
              )}
              <div className="w-7 h-1 rounded-full mb-4" style={{ background: plan.color }} />
              <div>
                <p className="text-base font-semibold text-[#F4F7FA] mb-0.5" style={{ fontFamily: fontFamily.display }}>{plan.name}</p>
                <p className="text-[11px] mb-4" style={{ color: plan.color, fontFamily: fontFamily.mono }}>{plan.subtitle || ''}</p>
              </div>
              <div className="mb-4">
                {plan.price ? (
                  <><span className="text-3xl font-bold" style={{ color: '#F4F7FA', fontFamily: fontFamily.mono }}>{plan.price}</span><span className="text-xs text-[#64748B]">/mo</span></>
                ) : (
                  <span className="text-xl font-bold" style={{ color: '#F4F7FA', fontFamily: fontFamily.mono }}>Contact Sales</span>
                )}
              </div>
              <button
                className="w-full py-2.5 rounded-xl text-sm font-semibold mb-4 transition-all flex items-center justify-center gap-2"
                style={{
                  background: isUpgrade ? (isRecommended ? plan.color : '#FF6A00') : '#243140',
                  color: isUpgrade ? 'white' : '#64748B',
                  fontFamily: fontFamily.body,
                }}
                onClick={e => { e.stopPropagation(); isUpgrade && handlePlanClick(plan); }}>
                {ctaLabel} {isUpgrade && <ArrowRight className="w-3.5 h-3.5" />}
              </button>
              <div className="space-y-2 flex-1">
                {plan.features.map((f, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <Check className="w-3 h-3 mt-0.5 shrink-0" style={{ color: plan.color }} />
                    <span className="text-[11px] leading-relaxed" style={{ color: '#9FB0C3', fontFamily: fontFamily.body }}>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-center text-xs mt-6" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>
        All plans billed monthly · Cancel anytime · Australian owned & operated
      </p>
    </div>
  );
}
