import React from 'react';
import { ArrowRight, CheckCircle2, AlertTriangle, TrendingUp, Shield, Target, Globe } from 'lucide-react';

const HEAD = "'Cormorant Garamond', Georgia, serif";
const BODY = "'Inter', sans-serif";
const MONO = "'JetBrains Mono', monospace";

// 13 footprint layers — mapped to directive specification
const LAYERS = [
  { key: 'messaging', label: 'Website Messaging', fields: ['main_products_services', 'unique_value_proposition', 'business_name'] },
  { key: 'offer', label: 'Offer & CTA Clarity', fields: ['pricing_model', 'sales_cycle_length'] },
  { key: 'paid', label: 'Paid Ad Presence', fields: [] },
  { key: 'organic', label: 'Organic Footprint', fields: ['website', 'competitive_moat'] },
  { key: 'reviews', label: 'Reviews & Sentiment', fields: ['customer_count'] },
  { key: 'social', label: 'Social Activity', fields: [] },
  { key: 'gbp', label: 'Google Business Presence', fields: ['location', 'geographic_focus'] },
  { key: 'competitors', label: 'Local Competitor Map', fields: ['industry', 'competitive_advantages'] },
  { key: 'category', label: 'Category Positioning', fields: ['business_model', 'competitive_moat'] },
  { key: 'funnel', label: 'Funnel Friction', fields: ['growth_strategy', 'growth_goals'] },
  { key: 'saturation', label: 'Market Density', fields: ['location', 'industry'] },
  { key: 'trust', label: 'Trust Signals', fields: ['team_size', 'founder_background', 'key_team_members'] },
  { key: 'consistency', label: 'Cross-Channel Consistency', fields: ['mission_statement', 'vision_statement', 'unique_value_proposition'] },
];

function scoreLayer(layer, data) {
  if (layer.fields.length === 0) return { score: null, status: 'No detectable activity' };
  let filled = 0;
  for (const f of layer.fields) {
    const val = data[f];
    if (val && val !== 'Not available from current data' && val.length > 5) filled++;
  }
  const pct = Math.round((filled / layer.fields.length) * 100);
  const status = filled === layer.fields.length ? 'Complete' : filled > 0 ? 'Partial' : 'Unavailable';
  return { score: pct, status };
}

function computeOverall(layers, data) {
  let total = 0, count = 0;
  for (const l of layers) {
    const { score } = scoreLayer(l, data);
    if (score !== null) { total += score; count++; }
  }
  const overall = count > 0 ? Math.round(total / count) : 0;
  const confidence = count >= 10 ? 'High' : count >= 6 ? 'Medium' : 'Low';
  return { overall, confidence, layersScored: count, layersTotal: layers.length };
}

const ChiefMarketingSummary = ({ wowSummary, onConfirm, isSubmitting, identityConfidence }) => {
  const full = wowSummary?._full || wowSummary || {};
  const raw = computeOverall(LAYERS, full);
  // Cap report confidence based on identity confidence (Section 8.3)
  const cappedConfidence = identityConfidence === 'Low' ? 'Low'
    : identityConfidence === 'Medium' ? (raw.confidence === 'High' ? 'Medium' : raw.confidence)
    : raw.confidence;
  const overall = raw.overall;
  const confidence = cappedConfidence;
  const layersScored = raw.layersScored;
  const layersTotal = raw.layersTotal;
  const scoreColor = overall > 70 ? '#10B981' : overall > 45 ? '#F59E0B' : '#EF4444';

  // Executive blocks
  const positioning = full.unique_value_proposition || full.competitive_advantages || '';
  const challenges = full.main_challenges || full.biggest_challenges || '';
  const growthStrategy = full.growth_strategy || '';
  const teamGaps = full.team_gaps || '';
  const pricingModel = full.pricing_model || '';

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: '#0F1720' }} data-testid="chief-marketing-summary">
      <style>{`@keyframes cmsFade{0%{opacity:0;transform:translateY(12px)}100%{opacity:1;transform:translateY(0)}}`}</style>

      <div className="max-w-2xl mx-auto px-4 sm:px-8 py-8 space-y-8">
        {/* Header */}
        <div className="text-center" style={{ animation: 'cmsFade 0.5s ease-out' }}>
          <span className="text-[10px] font-semibold tracking-widest uppercase block mb-3" style={{ color: '#FF6A00', fontFamily: MONO }}>
            Chief Marketing Summary
          </span>
          <h1 className="text-2xl sm:text-3xl font-semibold text-[#F4F7FA] mb-2" style={{ fontFamily: HEAD }}>
            Digital Footprint & Market Position
          </h1>
          <p className="text-sm text-[#64748B] max-w-md mx-auto" style={{ fontFamily: BODY }}>
            Based on publicly available digital signals. No internal performance data assumed.
          </p>
        </div>

        {/* Market Presence Score */}
        <div className="rounded-xl p-6 text-center" style={{ background: '#141C26', border: '1px solid #243140', animation: 'cmsFade 0.7s ease-out' }} data-testid="presence-score">
          <span className="text-[10px] text-[#64748B] block mb-2" style={{ fontFamily: MONO }}>Market Presence Score</span>
          <span className="text-5xl font-bold block mb-2" style={{ color: scoreColor, fontFamily: MONO }}>{overall}</span>
          <span className="text-sm text-[#64748B]" style={{ fontFamily: MONO }}>/100</span>
          <div className="flex items-center justify-center gap-3 mt-3">
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ color: confidence === 'High' ? '#10B981' : confidence === 'Medium' ? '#F59E0B' : '#64748B', background: (confidence === 'High' ? '#10B981' : confidence === 'Medium' ? '#F59E0B' : '#64748B') + '15', fontFamily: MONO }}>
              {confidence} confidence
            </span>
            <span className="text-xs text-[#64748B]" style={{ fontFamily: MONO }}>{layersScored}/{layersTotal} layers scored</span>
          </div>
        </div>

        {/* Insufficient Footprint Warning */}
        {overall < 40 && (
          <div className="rounded-xl p-5" style={{ background: '#EF444408', border: '1px solid #EF444425', animation: 'cmsFade 0.8s ease-out' }} data-testid="insufficient-warning">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-[#EF4444] shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-[#F4F7FA] mb-2" style={{ fontFamily: HEAD }}>
                  Your digital footprint is too thin for BIQc to confidently map your market position.
                </p>
                <p className="text-xs text-[#9FB0C3] leading-relaxed mb-2">
                  Customer acquisition will likely be harder until your online positioning is clearer.
                </p>
                <div className="space-y-1">
                  {LAYERS.filter(l => scoreLayer(l, full).score === null || scoreLayer(l, full).score < 30).slice(0, 3).map((l, i) => (
                    <span key={i} className="text-[11px] text-[#EF4444] block" style={{ fontFamily: MONO }}>
                      Missing: {l.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Score Breakdown */}
        <div style={{ animation: 'cmsFade 0.9s ease-out' }}>
          <h3 className="text-[10px] font-semibold tracking-widest uppercase mb-3" style={{ color: '#64748B', fontFamily: MONO }}>Footprint Breakdown</h3>
          <div className="space-y-1.5">
            {LAYERS.map(l => {
              const { score, status } = scoreLayer(l, full);
              const barColor = score === null ? '#243140' : score > 70 ? '#10B981' : score > 45 ? '#F59E0B' : '#EF4444';
              return (
                <div key={l.key} className="flex items-center gap-3 py-1.5">
                  <span className="text-xs text-[#9FB0C3] w-40 shrink-0" style={{ fontFamily: BODY }}>{l.label}</span>
                  <div className="flex-1 h-1.5 rounded-full" style={{ background: '#243140' }}>
                    {score !== null && <div className="h-1.5 rounded-full transition-all" style={{ background: barColor, width: `${score}%` }} />}
                  </div>
                  <span className="text-[11px] w-16 text-right shrink-0" style={{ color: score !== null ? barColor : '#64748B', fontFamily: MONO }}>{score !== null ? `${score}` : 'N/A'}</span>
                  <span className="text-[10px] w-20 text-right shrink-0 hidden sm:block" style={{ color: '#64748B', fontFamily: MONO }}>{status}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Executive Block 1 — Market Position */}
        {positioning && (
          <div className="rounded-xl p-5" style={{ background: '#141C26', border: '1px solid #243140', animation: 'cmsFade 1.1s ease-out' }}>
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4 text-[#3B82F6]" />
              <h3 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: HEAD }}>Your Market Position</h3>
            </div>
            <p className="text-sm text-[#9FB0C3] leading-relaxed">{positioning}</p>
          </div>
        )}

        {/* Executive Block 2 — Digital Gaps */}
        <div className="rounded-xl p-5" style={{ background: '#141C26', border: '1px solid #F59E0B20', animation: 'cmsFade 1.3s ease-out' }}>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />
            <h3 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: HEAD }}>Digital Gaps Detected</h3>
          </div>
          <div className="space-y-2">
            {[
              !full.competitive_advantages && 'No clear differentiation proof detected on website',
              !full.pricing_model && 'Pricing model not visible — may increase enquiry friction',
              !full.customer_count && 'No social proof or client count visible',
              challenges && `Challenge identified: ${typeof challenges === 'string' ? challenges.substring(0, 100) : ''}`,
              teamGaps && `Team gap: ${teamGaps.substring(0, 100)}`,
            ].filter(Boolean).slice(0, 4).map((gap, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: '#F59E0B' }} />
                <span className="text-xs text-[#9FB0C3] leading-relaxed">{gap}</span>
              </div>
            ))}
            {LAYERS.filter(l => scoreLayer(l, full).score === null).length > 0 && (
              <div className="flex items-start gap-2 mt-2">
                <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: '#64748B' }} />
                <span className="text-xs text-[#64748B] leading-relaxed">
                  {LAYERS.filter(l => scoreLayer(l, full).score === null).length} layers could not be scored — connect integrations for complete analysis
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Executive Block 3 — Leverage Points */}
        <div className="rounded-xl p-5" style={{ background: '#141C26', border: '1px solid #10B98120', animation: 'cmsFade 1.5s ease-out' }}>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-[#10B981]" />
            <h3 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: HEAD }}>Immediate Leverage Points</h3>
          </div>
          <div className="space-y-2">
            {[
              positioning && 'Clarify outcome before consultation request',
              growthStrategy && `Align growth strategy: ${growthStrategy.substring(0, 80)}`,
              full.location && 'Evaluate paid acquisition in local competitor radius',
            ].filter(Boolean).slice(0, 3).map((point, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: '#10B981' }} />
                <span className="text-xs text-[#9FB0C3] leading-relaxed">{point}</span>
              </div>
            ))}
          </div>
        </div>

        {/* No-data notice */}
        <div className="rounded-xl p-4" style={{ background: '#0F1720', border: '1px solid #24314050', animation: 'cmsFade 1.7s ease-out' }}>
          <p className="text-xs text-[#64748B] leading-relaxed" style={{ fontFamily: MONO }}>
            Live performance metrics unavailable — connect CRM and marketing platforms to unlock internal performance analysis. No lead velocity, churn risk, or revenue data has been assumed.
          </p>
        </div>

        {/* CTA */}
        <div className="text-center pt-4" style={{ animation: 'cmsFade 2s ease-out' }}>
          <button onClick={onConfirm} disabled={isSubmitting}
            className="px-10 py-3.5 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 disabled:opacity-40 inline-flex items-center gap-2"
            style={{ background: '#FF6A00', fontFamily: HEAD }}
            data-testid="cms-continue-btn">
            {isSubmitting ? 'Confirming...' : 'Continue to Calibrate'} <ArrowRight className="w-4 h-4" />
          </button>
          <p className="text-[10px] text-[#64748B] mt-3 max-w-sm mx-auto" style={{ fontFamily: MONO }}>
            Connect your systems to replace surface analysis with real performance tracking.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ChiefMarketingSummary;
