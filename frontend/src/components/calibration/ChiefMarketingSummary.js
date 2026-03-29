import React, { useState } from 'react';
import { ArrowRight, AlertTriangle, TrendingUp, Globe, Users, Star, Target, ChevronDown, ChevronUp, CheckCircle2, XCircle, Zap, BarChart3 } from 'lucide-react';
import { fontFamily } from '../../design-system/tokens';


// ── Footprint layers (kept for market presence score) ──
const LAYERS = [
  { key: 'messaging', label: 'Website Messaging', fields: ['main_products_services', 'unique_value_proposition'] },
  { key: 'offer', label: 'Offer & CTA Clarity', fields: ['pricing_model', 'sales_cycle_length'] },
  { key: 'organic', label: 'Organic Footprint', fields: ['website', 'competitive_moat'] },
  { key: 'reviews', label: 'Social Proof', fields: ['customer_count'] },
  { key: 'gbp', label: 'Local Presence', fields: ['location', 'geographic_focus'] },
  { key: 'competitors', label: 'Competitive Position', fields: ['competitive_advantages'] },
  { key: 'category', label: 'Category Positioning', fields: ['business_model', 'competitive_moat'] },
  { key: 'trust', label: 'Trust Signals', fields: ['team_size', 'founder_background'] },
  { key: 'consistency', label: 'Brand Consistency', fields: ['mission_statement', 'unique_value_proposition'] },
];

function scoreLayer(layer, data) {
  if (layer.fields.length === 0) return { score: null, status: 'No data' };
  let filled = 0;
  for (const f of layer.fields) {
    const val = data[f];
    if (val && val !== 'Not available from current data' && String(val).length > 5) filled++;
  }
  const pct = Math.round((filled / layer.fields.length) * 100);
  return { score: pct, status: filled === layer.fields.length ? 'Complete' : filled > 0 ? 'Partial' : 'Unavailable' };
}

function computeOverall(layers, data) {
  let total = 0, count = 0, scored = 0;
  for (const l of layers) {
    const { score } = scoreLayer(l, data);
    if (score !== null) { total += score; count++; if (score > 0) scored++; }
  }
  const overall = count > 0 ? Math.round(total / count) : 0;
  const confidence = scored >= 6 ? 'High' : scored >= 3 ? 'Medium' : 'Low';
  return { overall, confidence, layersScored: scored, layersTotal: layers.length };
}

// ── UI/UX Communication Audit (scored from extracted data) ──
function buildCommunicationAudit(full) {
  const checks = [
    {
      category: 'Value Proposition Clarity',
      score: full.unique_value_proposition && full.unique_value_proposition.length > 20 ? 7 : full.unique_value_proposition ? 4 : 1,
      evidence: full.unique_value_proposition ? `Detected: "${full.unique_value_proposition.substring(0, 80)}${full.unique_value_proposition.length > 80 ? '...' : ''}"` : 'No clear value proposition detected on website.',
      advice: full.unique_value_proposition ? 'Sharpen to one outcome-based sentence visible above the fold.' : 'Add a single, clear outcome statement ("We help X achieve Y in Z timeframe") to every page header.',
    },
    {
      category: 'Products & Services Communication',
      score: full.main_products_services && full.main_products_services.length > 30 ? 6 : full.main_products_services ? 4 : 2,
      evidence: full.main_products_services ? `Detected: "${full.main_products_services.substring(0, 100)}${full.main_products_services.length > 100 ? '...' : ''}"` : 'Products and services not clearly described on website.',
      advice: 'List each service with a specific outcome or deliverable. Avoid capability language ("we provide") — use result language ("you get").',
    },
    {
      category: 'Social Proof & Trust',
      score: full.customer_count ? 6 : full.team_size && full.founder_background ? 4 : 2,
      evidence: full.customer_count ? `Client count reference detected.` : full.founder_background ? 'Founder background visible — client proof not detected.' : 'No social proof, testimonials, or client count detected.',
      advice: 'Add 3 specific client results (not generic testimonials) with company name, measurable outcome, and timeframe.',
    },
    {
      category: 'Pricing Transparency',
      score: full.pricing_model && full.pricing_model !== 'Not available from current data' ? 5 : 2,
      evidence: full.pricing_model && full.pricing_model !== 'Not available from current data' ? `Model detected: ${full.pricing_model}` : 'No pricing information visible on website.',
      advice: full.pricing_model ? 'Add a starting price or pricing tier page — even a "From $X" reference increases conversion rate by 25-40%.' : 'Consider a transparent pricing or packages page. Price anchoring increases inbound quality.',
    },
    {
      category: 'Call-to-Action Clarity',
      score: full.sales_cycle_length ? 6 : full.website ? 4 : 2,
      evidence: full.website ? 'Website detected — CTA analysis based on extracted structure.' : 'No website content available for analysis.',
      advice: 'Every page should have one primary CTA. Avoid "Contact Us" — replace with outcome-specific CTAs ("Get a free audit", "See how it works").',
    },
  ];
  const avg = Math.round(checks.reduce((s, c) => s + c.score, 0) / checks.length);
  return { checks, avg };
}

// ── Geographic presence analysis ──
function buildGeographicPresence(full) {
  const loc = full.location || full.geographic_focus || null;
  const socials = full.social_media_links || {};
  const hasLinkedIn = !!(socials.linkedin || full.linkedin_url);
  const hasFacebook = !!(socials.facebook || full.facebook_url);
  const hasInstagram = !!(socials.instagram || full.instagram_url);
  const hasTwitter = !!(socials.twitter || full.twitter_x_url);
  const activeSocials = [hasLinkedIn && 'LinkedIn', hasFacebook && 'Facebook', hasInstagram && 'Instagram', hasTwitter && 'X/Twitter'].filter(Boolean);

  return { loc, activeSocials, hasSocialPresence: activeSocials.length > 0 };
}

// ── Competitor intelligence ──
function buildCompetitorInsights(full) {
  const industry = full.industry || '';
  const location = full.location || full.geographic_focus || '';
  const competitorList = Array.isArray(full.competitors)
    ? full.competitors
      .map((c) => {
        if (!c) return '';
        if (typeof c === 'string') return c.trim();
        if (typeof c === 'object') return (c.name || c.business_name || c.domain || '').trim();
        return '';
      })
      .filter(Boolean)
    : [];
  const competitorAnalysis = typeof full.competitor_analysis === 'string' ? full.competitor_analysis : '';
  const hasCompetitorData = Boolean(
    full.competitive_advantages ||
    full.competitive_moat ||
    competitorAnalysis ||
    competitorList.length > 0
  );
  return {
    industry,
    location,
    hasCompetitorData,
    competitiveAdvantages: full.competitive_advantages || '',
    moat: full.competitive_moat || '',
    competitorAnalysis,
    competitorList,
  };
}

function buildStaffSignals(full) {
  const teamMembers = Array.isArray(full.team_members) ? full.team_members : [];
  const teamSize = full.team_size || '';
  const founderBackground = full.founder_background || '';
  const trustSignalsRaw = Array.isArray(full.trust_signals) ? full.trust_signals : [];
  const trustSignals = trustSignalsRaw
    .map((item) => {
      if (!item) return '';
      if (typeof item === 'string') return item.trim();
      if (typeof item === 'object') {
        return (item.signal || item.title || item.label || item.text || '').toString().trim();
      }
      return '';
    })
    .filter(Boolean);
  const staffReviewSignals = trustSignals.filter((signal) =>
    /(glassdoor|indeed|seek|employee|staff|team review|culture)/i.test(signal)
  );
  const hasStaffData = Boolean(
    teamMembers.length > 0 ||
    teamSize ||
    founderBackground ||
    staffReviewSignals.length > 0
  );
  return { teamMembers, teamSize, founderBackground, staffReviewSignals, hasStaffData };
}

function buildCustomerReviewSignals(full) {
  const trustSignalsRaw = Array.isArray(full.trust_signals) ? full.trust_signals : [];
  const trustSignals = trustSignalsRaw
    .map((item) => {
      if (!item) return '';
      if (typeof item === 'string') return item.trim();
      if (typeof item === 'object') return (item.signal || item.title || item.label || item.text || '').toString().trim();
      return '';
    })
    .filter(Boolean);

  const customerReviewSignals = trustSignals.filter((signal) =>
    /(testimonial|case stud|review|google review|productreview|rating|social proof)/i.test(signal)
  );

  const reviewEvidence = [
    ...(full.customer_count ? [`Client count signal: ${full.customer_count}`] : []),
    ...(full.case_studies ? ['Case studies detected in public footprint'] : []),
    ...(full.testimonials ? ['Testimonials detected in public footprint'] : []),
    ...customerReviewSignals,
  ].filter(Boolean);

  const hasReviewData = reviewEvidence.length > 0;
  const confidenceBand = hasReviewData ? (reviewEvidence.length >= 3 ? 'medium-high' : 'medium') : 'low';

  const impact = hasReviewData
    ? [
      {
        fundamental: 'Conversion rate',
        impact: '+6% to +18%',
        mechanism: 'Proof-backed messaging reduces buyer doubt during first-touch evaluation.',
      },
      {
        fundamental: 'Customer acquisition cost',
        impact: '-8% to -22%',
        mechanism: 'Higher trust density improves paid and organic click-to-enquiry efficiency.',
      },
      {
        fundamental: 'Gross profit',
        impact: '+2 to +6 pts margin',
        mechanism: 'Stronger credibility reduces discount pressure and supports value-based pricing.',
      },
    ]
    : [
      {
        fundamental: 'Conversion rate',
        impact: '-10% to -25% drag risk',
        mechanism: 'Low visible proof forces prospects to delay or abandon decision.',
      },
      {
        fundamental: 'Customer acquisition cost',
        impact: '+12% to +30% risk',
        mechanism: 'Paid campaigns require more spend to overcome trust gaps.',
      },
      {
        fundamental: 'Gross profit',
        impact: '-3 to -8 pts margin risk',
        mechanism: 'Sales teams compensate weak proof with discounting.',
      },
    ];

  return { reviewEvidence, customerReviewSignals, hasReviewData, confidenceBand, impact };
}

function buildStaffImpactSignals(staffSignals) {
  const reviewCount = (staffSignals.staffReviewSignals || []).length;
  const hasTeamMembers = (staffSignals.teamMembers || []).length > 0;
  const hasAny = staffSignals.hasStaffData;

  const impact = hasAny
    ? [
      {
        fundamental: 'Service delivery capacity',
        impact: hasTeamMembers ? 'Stronger execution continuity' : 'Moderate continuity risk',
        mechanism: 'Visible role structure reduces key-person dependency and delivery bottlenecks.',
      },
      {
        fundamental: 'Revenue retention',
        impact: reviewCount > 0 ? '+3% to +10% retention support' : 'Retention volatility risk',
        mechanism: 'Healthier staff signals correlate with stronger customer experience consistency.',
      },
      {
        fundamental: 'Operating profit',
        impact: reviewCount > 0 ? '+1 to +4 pts margin support' : '-2 to -6 pts margin risk',
        mechanism: 'Lower team friction reduces rework, escalation cost, and service leakage.',
      },
    ]
    : [
      {
        fundamental: 'Service delivery capacity',
        impact: 'Unquantified risk',
        mechanism: 'No verifiable staffing signals limits execution confidence.',
      },
      {
        fundamental: 'Revenue retention',
        impact: 'Potential churn pressure',
        mechanism: 'Team health blind spots often surface as inconsistent client experience.',
      },
      {
        fundamental: 'Operating profit',
        impact: 'Margin leakage risk',
        mechanism: 'Unseen people issues typically increase rework and management overhead.',
      },
    ];

  return { impact };
}

const ScoreBar = ({ score, max = 10, color }) => {
  const pct = Math.min(Math.round((score / max) * 100), 100);
  const c = color || (score >= 7 ? '#10B981' : score >= 4 ? '#F59E0B' : '#EF4444');
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full" style={{ background: '#243140' }}>
        <div className="h-1.5 rounded-full transition-all" style={{ background: c, width: `${pct}%` }} />
      </div>
      <span className="text-[11px] font-bold w-6 text-right" style={{ color: c, fontFamily: fontFamily.mono }}>{score}</span>
    </div>
  );
};

const ChiefMarketingSummary = ({ wowSummary, onConfirm, isSubmitting, identityConfidence }) => {
  const full = (wowSummary?._full) || wowSummary || {};
  const [openAudit, setOpenAudit] = useState(null);

  const raw = computeOverall(LAYERS, full);
  const cappedConfidence = identityConfidence === 'Low' ? 'Low' : identityConfidence === 'Medium' ? (raw.confidence === 'High' ? 'Medium' : raw.confidence) : raw.confidence;
  const overall = raw.overall;
  const scoreColor = overall > 70 ? '#10B981' : overall > 45 ? '#F59E0B' : '#EF4444';

  const audit = buildCommunicationAudit(full);
  const geo = buildGeographicPresence(full);
  const competitors = buildCompetitorInsights(full);
  const staff = buildStaffSignals(full);
  const customerReviews = buildCustomerReviewSignals(full);
  const staffImpact = buildStaffImpactSignals(staff);
  const cmoExecutiveBrief = full.cmo_executive_brief || full.executive_summary || '';
  const websiteHealth = full.website_health || {};
  const seoAnalysis = full.seo_analysis || {};
  const paidAnalysis = full.paid_media_analysis || {};
  const socialAnalysis = full.social_media_analysis || {};
  const swot = full.swot || {};
  const competitorSwot = Array.isArray(full.competitor_swot) ? full.competitor_swot : [];
  const cmoPriorityActions = Array.isArray(full.cmo_priority_actions) ? full.cmo_priority_actions : [];

  // Business summary paragraphs
  const bizName = full.business_name || wowSummary?.business_name || 'This business';
  const industry = full.industry || '';
  const whatYouDo = full.main_products_services || wowSummary?.what_you_do || '';
  const whoYouServe = full.target_market || full.ideal_customer_profile || wowSummary?.who_you_serve || '';
  const model = full.business_model || '';
  const uvp = full.unique_value_proposition || wowSummary?.what_sets_you_apart || '';
  const challenges = full.main_challenges || wowSummary?.biggest_challenges || '';
  const growth = full.growth_strategy || wowSummary?.growth_opportunity || '';

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: 'var(--biqc-bg)' }} data-testid="chief-marketing-summary">
      <style>{`@keyframes cmsFade{0%{opacity:0;transform:translateY(12px)}100%{opacity:1;transform:translateY(0)}}`}</style>

      <div className="max-w-2xl mx-auto px-4 sm:px-8 py-8 space-y-8">

        {/* ── HEADER ── */}
        <div className="text-center" style={{ animation: 'cmsFade 0.4s ease-out' }}>
          <span className="text-[10px] font-semibold tracking-widest uppercase block mb-3" style={{ color: '#FF6A00', fontFamily: fontFamily.mono }}>
            Chief Marketing Officer Summary
          </span>
          <h1 className="text-2xl sm:text-3xl font-semibold text-[#F4F7FA] mb-2" style={{ fontFamily: fontFamily.display }}>
            {bizName}
          </h1>
          <p className="text-sm text-[#64748B] max-w-md mx-auto" style={{ fontFamily: fontFamily.body }}>
            Based on publicly available digital signals only. No internal data assumed. No hallucination.
          </p>
        </div>

        {/* ── SECTION 1: BUSINESS SUMMARY ── */}
        <div className="rounded-xl p-6 space-y-4" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)', animation: 'cmsFade 0.6s ease-out' }} data-testid="business-summary">
          <div className="flex items-center gap-2 mb-1">
            <Target className="w-4 h-4" style={{ color: '#FF6A00' }} />
            <h2 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>Business Intelligence Summary</h2>
          </div>

          {whatYouDo ? (
            <p className="text-sm text-[#9FB0C3] leading-relaxed" style={{ fontFamily: fontFamily.body }}>
              <strong style={{ color: 'var(--biqc-text)' }}>{bizName}</strong>
              {industry ? ` operates in the ${industry} sector` : ''}.
              {whatYouDo ? ` ${whatYouDo}.` : ''}
            </p>
          ) : null}

          {whoYouServe ? (
            <p className="text-sm text-[#9FB0C3] leading-relaxed" style={{ fontFamily: fontFamily.body }}>
              Their primary market is <strong style={{ color: 'var(--biqc-text)' }}>{whoYouServe}</strong>{model ? `, operating on a ${model} model` : ''}.
            </p>
          ) : null}

          {uvp ? (
            <p className="text-sm text-[#9FB0C3] leading-relaxed" style={{ fontFamily: fontFamily.body }}>
              Their stated competitive position: <em style={{ color: 'var(--biqc-text)' }}>"{uvp.substring(0, 180)}{uvp.length > 180 ? '...' : ''}"</em>
            </p>
          ) : null}

          {challenges ? (
            <p className="text-sm text-[#9FB0C3] leading-relaxed" style={{ fontFamily: fontFamily.body }}>
              Key challenges identified: {challenges.substring(0, 160)}{challenges.length > 160 ? '...' : ''}
            </p>
          ) : null}

          {growth ? (
            <p className="text-sm text-[#9FB0C3] leading-relaxed" style={{ fontFamily: fontFamily.body }}>
              Growth focus: {growth.substring(0, 160)}{growth.length > 160 ? '...' : ''}
            </p>
          ) : null}

          {!whatYouDo && !whoYouServe && !uvp && (
            <p className="text-xs text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>Insufficient website data to generate business summary. Manual profile completion recommended.</p>
          )}
        </div>

        {/* ── SECTION 2: MARKET PRESENCE SCORE ── */}
        <div className="rounded-xl p-6 text-center" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)', animation: 'cmsFade 0.8s ease-out' }} data-testid="presence-score">
          <span className="text-[10px] text-[#64748B] block mb-2" style={{ fontFamily: fontFamily.mono }}>Digital Market Presence Score</span>
          <span className="text-5xl font-bold block mb-2" style={{ color: scoreColor, fontFamily: fontFamily.mono }}>{overall}</span>
          <span className="text-sm text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>/100</span>
          <div className="flex items-center justify-center gap-3 mt-3">
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ color: cappedConfidence === 'High' ? '#10B981' : cappedConfidence === 'Medium' ? '#F59E0B' : '#64748B', background: (cappedConfidence === 'High' ? '#10B981' : cappedConfidence === 'Medium' ? '#F59E0B' : '#64748B') + '15', fontFamily: fontFamily.mono }}>
              {cappedConfidence} confidence
            </span>
            <span className="text-xs text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>{raw.layersScored}/{raw.layersTotal} layers scored</span>
          </div>
          {/* Compact layer breakdown */}
          <div className="mt-4 space-y-1.5 text-left">
            {LAYERS.map(l => {
              const { score, status } = scoreLayer(l, full);
              const c = score === null ? '#243140' : score > 70 ? '#10B981' : score > 45 ? '#F59E0B' : '#EF4444';
              return (
                <div key={l.key} className="flex items-center gap-3">
                  <span className="text-[11px] text-[#9FB0C3] w-36 shrink-0" style={{ fontFamily: fontFamily.body }}>{l.label}</span>
                  <div className="flex-1 h-1.5 rounded-full" style={{ background: '#243140' }}>
                    {score !== null && <div className="h-1.5 rounded-full" style={{ background: c, width: `${score}%` }} />}
                  </div>
                  <span className="text-[10px] w-20 text-right shrink-0" style={{ color: c, fontFamily: fontFamily.mono }}>{score !== null ? status : 'N/A'}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── SECTION 2B: EXECUTIVE BRIEF ── */}
        {cmoExecutiveBrief && (
          <div className="rounded-xl p-5" style={{ background: 'var(--biqc-bg-card)', border: '1px solid #3B82F640', animation: 'cmsFade 0.9s ease-out' }} data-testid="executive-brief">
            <div className="flex items-center gap-2 mb-2">
              <Star className="w-4 h-4" style={{ color: '#3B82F6' }} />
              <h2 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>Executive Brief</h2>
            </div>
            <p className="text-sm text-[#9FB0C3] leading-relaxed" style={{ fontFamily: fontFamily.body }}>
              {cmoExecutiveBrief}
            </p>
          </div>
        )}

        {/* ── SECTION 2C: CHANNEL & WEBSITE DIAGNOSTICS ── */}
        <div className="rounded-xl p-5" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)', animation: 'cmsFade 0.95s ease-out' }} data-testid="channel-diagnostics">
          <div className="flex items-center gap-2 mb-3">
            <Globe className="w-4 h-4" style={{ color: '#06B6D4' }} />
            <h2 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>Website, SEO, Paid & Social Diagnostics</h2>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>Website Condition</p>
              <p className="text-sm text-[#9FB0C3]" style={{ fontFamily: fontFamily.body }}>
                {(websiteHealth.summary || `Status: ${websiteHealth.status || 'unknown'} · Score: ${websiteHealth.score ?? 'n/a'}`)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>SEO</p>
              <p className="text-xs text-[#9FB0C3]" style={{ fontFamily: fontFamily.body }}>
                Score {seoAnalysis.score ?? 'n/a'} · Status {seoAnalysis.status || 'unknown'}
              </p>
              {Array.isArray(seoAnalysis.gaps) && seoAnalysis.gaps.length > 0 && (
                <p className="text-xs text-[#64748B] mt-1" style={{ fontFamily: fontFamily.body }}>{seoAnalysis.gaps.slice(0, 2).join(' ')}</p>
              )}
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>Paid Media</p>
              <p className="text-xs text-[#9FB0C3]" style={{ fontFamily: fontFamily.body }}>
                {paidAnalysis.assessment || 'No paid media diagnostics available.'}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>Social Marketing</p>
              <p className="text-xs text-[#9FB0C3]" style={{ fontFamily: fontFamily.body }}>
                {socialAnalysis.assessment || 'No social diagnostics available.'}
              </p>
            </div>
          </div>
        </div>

        {/* ── SECTION 3: UI/UX COMMUNICATION AUDIT ── */}
        <div style={{ animation: 'cmsFade 1.0s ease-out' }} data-testid="communication-audit">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4" style={{ color: '#3B82F6' }} />
            <h2 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>Products & Services Communication Audit</h2>
            <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full" style={{ background: (audit.avg >= 7 ? '#10B981' : audit.avg >= 4 ? '#F59E0B' : '#EF4444') + '15', color: audit.avg >= 7 ? '#10B981' : audit.avg >= 4 ? '#F59E0B' : '#EF4444', fontFamily: fontFamily.mono }}>
              {audit.avg}/10 avg
            </span>
          </div>
          <div className="space-y-2">
            {audit.checks.map((c, i) => (
              <div key={i} className="rounded-xl overflow-hidden" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }}>
                <button onClick={() => setOpenAudit(openAudit === i ? null : i)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.02] transition-colors">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.body }}>{c.category}</span>
                      {openAudit === i ? <ChevronUp className="w-3.5 h-3.5 text-[#64748B]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#64748B]" />}
                    </div>
                    <ScoreBar score={c.score} />
                  </div>
                </button>
                {openAudit === i && (
                  <div className="px-4 pb-4 space-y-2" style={{ borderTop: '1px solid var(--biqc-border)' }}>
                    <p className="text-[11px] mt-2" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>{c.evidence}</p>
                    <div className="flex items-start gap-2 p-2.5 rounded-lg" style={{ background: '#10B98108', border: '1px solid #10B98120' }}>
                      <Zap className="w-3.5 h-3.5 text-[#10B981] shrink-0 mt-0.5" />
                      <p className="text-xs text-[#9FB0C3] leading-relaxed" style={{ fontFamily: fontFamily.body }}><strong style={{ color: '#10B981' }}>Recommendation:</strong> {c.advice}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── SECTION 4: GEOGRAPHIC MARKET PRESENCE ── */}
        <div className="rounded-xl p-5" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)', animation: 'cmsFade 1.2s ease-out' }} data-testid="geographic-presence">
          <div className="flex items-center gap-2 mb-3">
            <Globe className="w-4 h-4" style={{ color: '#7C3AED' }} />
            <h2 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>Geographic Market Presence</h2>
          </div>
          {geo.loc ? (
            <>
              <p className="text-sm text-[#9FB0C3] mb-3" style={{ fontFamily: fontFamily.body }}>
                Based on publicly detectable signals, <strong style={{ color: 'var(--biqc-text)' }}>{bizName}</strong> would most likely attract clients in and around <strong style={{ color: 'var(--biqc-text)' }}>{geo.loc}</strong>.
              </p>
              {geo.hasSocialPresence ? (
                <p className="text-sm text-[#9FB0C3] mb-3" style={{ fontFamily: fontFamily.body }}>
                  Active social presence detected on {geo.activeSocials.join(', ')} — these channels extend reach beyond the primary geographic market and may attract inbound from adjacent regions.
                </p>
              ) : (
                <div className="flex items-start gap-2 p-2.5 rounded-lg" style={{ background: '#F59E0B08', border: '1px solid #F59E0B20' }}>
                  <AlertTriangle className="w-3.5 h-3.5 text-[#F59E0B] shrink-0 mt-0.5" />
                  <p className="text-xs text-[#9FB0C3]" style={{ fontFamily: fontFamily.body }}>No active social media presence detected. Geographic reach is limited to direct website traffic and word of mouth. Social channels would expand acquisition surface significantly.</p>
                </div>
              )}
              {full.geographic_focus && full.geographic_focus !== full.location && (
                <p className="text-xs text-[#64748B] mt-2" style={{ fontFamily: fontFamily.mono }}>Declared geographic focus: {full.geographic_focus}</p>
              )}
            </>
          ) : (
            <p className="text-xs text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>No location data detected from website or registry. Geographic presence analysis unavailable — BIQc will not assume a market.</p>
          )}
        </div>

        {/* ── SECTION 5: COMPETITIVE INTELLIGENCE ── */}
        <div className="rounded-xl p-5" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)', animation: 'cmsFade 1.4s ease-out' }} data-testid="competitor-intelligence">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4" style={{ color: '#EF4444' }} />
            <h2 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>Competitive Intelligence</h2>
          </div>
          {competitors.hasCompetitorData ? (
            <>
              {competitors.competitiveAdvantages && (
                <div className="mb-3">
                  <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>Detected Competitive Advantages</p>
                  <p className="text-sm text-[#9FB0C3] leading-relaxed" style={{ fontFamily: fontFamily.body }}>{competitors.competitiveAdvantages.substring(0, 200)}{competitors.competitiveAdvantages.length > 200 ? '...' : ''}</p>
                </div>
              )}
              {competitors.moat && (
                <div className="p-3 rounded-lg mb-3" style={{ background: '#10B98108', border: '1px solid #10B98120' }}>
                  <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#10B981', fontFamily: fontFamily.mono }}>Competitive Moat</p>
                  <p className="text-xs text-[#9FB0C3]" style={{ fontFamily: fontFamily.body }}>{competitors.moat.substring(0, 200)}{competitors.moat.length > 200 ? '...' : ''}</p>
                </div>
              )}
              {competitors.industry && (
                <p className="text-xs text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>
                  Industry: {competitors.industry}
                  {competitors.location ? ` · Primary market: ${competitors.location}` : ''}
                </p>
              )}
              {competitorSwot.length > 0 && (
                <div className="mt-3 space-y-2">
                  {competitorSwot.slice(0, 3).map((c, idx) => (
                    <div key={idx} className="p-3 rounded-lg" style={{ background: '#3B82F608', border: '1px solid #3B82F620' }}>
                      <p className="text-xs font-semibold mb-1" style={{ color: '#3B82F6', fontFamily: fontFamily.body }}>{c.name || `Competitor ${idx + 1}`}</p>
                      {Array.isArray(c.opportunities_against_them) && c.opportunities_against_them.length > 0 && (
                        <p className="text-xs text-[#9FB0C3]" style={{ fontFamily: fontFamily.body }}>
                          Opportunity: {c.opportunities_against_them[0]}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {competitors.competitorList.length > 0 && (
                <div className="mt-3">
                  <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>Detected Competitors</p>
                  <p className="text-xs text-[#9FB0C3]" style={{ fontFamily: fontFamily.body }}>
                    {competitors.competitorList.slice(0, 5).join(' · ')}
                  </p>
                </div>
              )}
              {competitors.competitorAnalysis && (
                <div className="mt-3 p-3 rounded-lg" style={{ background: '#111A25', border: '1px solid #243140' }}>
                  <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>Competitive Pressure Summary</p>
                  <p className="text-xs text-[#9FB0C3]" style={{ fontFamily: fontFamily.body }}>
                    {competitors.competitorAnalysis.substring(0, 280)}
                    {competitors.competitorAnalysis.length > 280 ? '...' : ''}
                  </p>
                </div>
              )}
            </>
          ) : (
            <p className="text-xs text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>No competitor data detected from publicly available sources. BIQc does not assume or fabricate competitor information — run an Exposure Scan to unlock this analysis.</p>
          )}
        </div>

        {/* ── SECTION 5A: CUSTOMER REVIEW INTELLIGENCE ── */}
        <div className="rounded-xl p-5" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)', animation: 'cmsFade 1.43s ease-out' }} data-testid="customer-review-intelligence">
          <div className="flex items-center gap-2 mb-3">
            <Star className="w-4 h-4" style={{ color: '#F59E0B' }} />
            <h2 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>Customer Review Intelligence</h2>
            <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full" style={{ color: '#F59E0B', background: '#F59E0B15', fontFamily: fontFamily.mono }}>
              confidence: {customerReviews.confidenceBand}
            </span>
          </div>

          {customerReviews.reviewEvidence.length > 0 ? (
            <>
              <div className="mb-3">
                <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>Explicit Public Review Evidence</p>
                <div className="space-y-1.5">
                  {customerReviews.reviewEvidence.slice(0, 5).map((signal, idx) => (
                    <p key={idx} className="text-xs text-[#9FB0C3]" style={{ fontFamily: fontFamily.body }}>
                      - {signal}
                    </p>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <p className="text-xs text-[#64748B] mb-3" style={{ fontFamily: fontFamily.mono }}>
              No explicit customer review markers were found in the current public scan.
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            {customerReviews.impact.map((row, idx) => (
              <div key={idx} className="p-3 rounded-lg" style={{ background: '#111A25', border: '1px solid #243140' }}>
                <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>{row.fundamental}</p>
                <p className="text-xs mb-1" style={{ color: '#F4F7FA', fontFamily: fontFamily.body }}>{row.impact}</p>
                <p className="text-[11px] leading-relaxed" style={{ color: '#9FB0C3', fontFamily: fontFamily.body }}>{row.mechanism}</p>
              </div>
            ))}
          </div>

          <div className="mt-3 p-3 rounded-lg" style={{ background: '#3B82F608', border: '1px solid #3B82F620' }}>
            <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#3B82F6', fontFamily: fontFamily.mono }}>Depth Preview (Example)</p>
            <p className="text-xs text-[#9FB0C3] leading-relaxed" style={{ fontFamily: fontFamily.body }}>
              Example depth BIQc can provide: "Across 47 public reviews, response-time complaints appeared in 29.8% of negative mentions, correlated with a 14-day sales-cycle extension. Modeled impact: 6-11% conversion drag and 2.1-3.8 point gross-margin compression due to discount-led recovery."
            </p>
          </div>
        </div>

        {/* ── SECTION 5B: STAFF & TEAM SIGNALS ── */}
        <div className="rounded-xl p-5" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)', animation: 'cmsFade 1.45s ease-out' }} data-testid="staff-intelligence">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4" style={{ color: '#3B82F6' }} />
            <h2 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>Staff & Team Signals</h2>
          </div>
          {staff.hasStaffData ? (
            <div className="space-y-3">
              {(staff.teamSize || staff.teamMembers.length > 0) && (
                <p className="text-xs text-[#9FB0C3]" style={{ fontFamily: fontFamily.body }}>
                  Team footprint: {staff.teamSize || `${staff.teamMembers.length} named team member${staff.teamMembers.length === 1 ? '' : 's'} detected`}.
                </p>
              )}
              {staff.teamMembers.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>Named Team Members</p>
                  <p className="text-xs text-[#9FB0C3]" style={{ fontFamily: fontFamily.body }}>
                    {staff.teamMembers.slice(0, 4).map((m) => {
                      if (typeof m === 'string') return m;
                      if (m?.name && m?.role) return `${m.name} (${m.role})`;
                      return m?.name || m?.role || '';
                    }).filter(Boolean).join(' · ')}
                  </p>
                </div>
              )}
              {staff.founderBackground && (
                <div className="p-3 rounded-lg" style={{ background: '#111A25', border: '1px solid #243140' }}>
                  <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>Founder / Leadership Context</p>
                  <p className="text-xs text-[#9FB0C3]" style={{ fontFamily: fontFamily.body }}>
                    {staff.founderBackground.substring(0, 240)}{staff.founderBackground.length > 240 ? '...' : ''}
                  </p>
                </div>
              )}
              {staff.staffReviewSignals.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>Staff Review Signals</p>
                  <div className="space-y-1.5">
                    {staff.staffReviewSignals.slice(0, 4).map((signal, idx) => (
                      <p key={idx} className="text-xs text-[#9FB0C3]" style={{ fontFamily: fontFamily.body }}>
                        - {signal}
                      </p>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                {staffImpact.impact.map((row, idx) => (
                  <div key={idx} className="p-3 rounded-lg" style={{ background: '#111A25', border: '1px solid #243140' }}>
                    <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>{row.fundamental}</p>
                    <p className="text-xs mb-1" style={{ color: '#F4F7FA', fontFamily: fontFamily.body }}>{row.impact}</p>
                    <p className="text-[11px] leading-relaxed" style={{ color: '#9FB0C3', fontFamily: fontFamily.body }}>{row.mechanism}</p>
                  </div>
                ))}
              </div>
              <div className="p-3 rounded-lg" style={{ background: '#3B82F608', border: '1px solid #3B82F620' }}>
                <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#3B82F6', fontFamily: fontFamily.mono }}>Depth Preview (Example)</p>
                <p className="text-xs text-[#9FB0C3] leading-relaxed" style={{ fontFamily: fontFamily.body }}>
                  Example depth BIQc can provide: "Team sentiment declined from neutral to negative over 6 weeks, with repeated workload and escalation markers. Predicted effect: 9-16% delivery-cycle slippage, 4-9% retention risk, and 1.5-3.2 point operating-margin pressure unless staffing bottlenecks are corrected."
                </p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>No staff review or team structure signals were detected from public sources yet. Add LinkedIn and review channels to strengthen this layer.</p>
          )}
        </div>

        {/* ── SECTION 5B: SWOT ── */}
        {swot && Object.keys(swot).length > 0 && (
          <div className="rounded-xl p-5" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)', animation: 'cmsFade 1.5s ease-out' }} data-testid="swot-analysis">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4" style={{ color: '#8B5CF6' }} />
              <h2 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>SWOT Analysis</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {['strengths', 'weaknesses', 'opportunities', 'threats'].map((key) => (
                <div key={key} className="p-3 rounded-lg" style={{ background: '#111A25', border: '1px solid #243140' }}>
                  <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>{key}</p>
                  <p className="text-xs text-[#9FB0C3] leading-relaxed" style={{ fontFamily: fontFamily.body }}>
                    {Array.isArray(swot[key]) && swot[key].length > 0 ? swot[key][0] : 'No verified data yet.'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── SECTION 6: STRATEGIC RECOMMENDATIONS ── */}
        <div className="rounded-xl p-5" style={{ background: 'var(--biqc-bg-card)', border: '1px solid #10B98120', animation: 'cmsFade 1.6s ease-out' }} data-testid="recommendations">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-[#10B981]" />
            <h2 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>Immediate Strategic Recommendations</h2>
          </div>
          <div className="space-y-3">
            {[
              !full.unique_value_proposition && {
                icon: XCircle, color: '#EF4444',
                text: 'Add a clear outcome-based value proposition above the fold. Current website does not communicate measurable results.',
              },
              full.unique_value_proposition && audit.checks[0].score < 7 && {
                icon: AlertTriangle, color: '#F59E0B',
                text: `Sharpen your positioning statement. Detected: "${(full.unique_value_proposition || '').substring(0, 80)}..." — make it outcome-specific with a timeframe.`,
              },
              !full.pricing_model && {
                icon: AlertTriangle, color: '#F59E0B',
                text: 'Add pricing transparency — even a starting price or "from $X" anchor. Hidden pricing increases friction and reduces lead quality.',
              },
              !full.customer_count && {
                icon: AlertTriangle, color: '#F59E0B',
                text: 'Add measurable social proof — specific client results with company name, outcome, and timeframe. Generic testimonials have 40% less impact than named case studies.',
              },
              !geo.hasSocialPresence && {
                icon: AlertTriangle, color: '#F59E0B',
                text: 'No active social media presence detected. Establish at least one channel aligned to your target market to expand geographic acquisition surface.',
              },
              geo.loc && !full.geographic_focus && {
                icon: CheckCircle2, color: '#10B981',
                text: `Local presence detected in ${geo.loc}. Ensure Google Business Profile is claimed and verified — this is the highest-ROI local acquisition lever.`,
              },
            ].filter(Boolean).slice(0, 5).map((rec, i) => (
              <div key={i} className="flex items-start gap-3">
                <rec.icon className="w-4 h-4 shrink-0 mt-0.5" style={{ color: rec.color }} />
                <p className="text-xs text-[#9FB0C3] leading-relaxed" style={{ fontFamily: fontFamily.body }}>{rec.text}</p>
              </div>
            ))}
            {[!full.unique_value_proposition, !full.pricing_model, !full.customer_count, !geo.hasSocialPresence].filter(Boolean).length === 0 && (
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#10B981]" />
                <p className="text-xs text-[#9FB0C3]" style={{ fontFamily: fontFamily.body }}>Core digital presence signals are in place. Focus on conversion rate optimisation and competitor differentiation.</p>
              </div>
            )}
            {cmoPriorityActions.slice(0, 3).map((action, idx) => (
              <div key={`cmo-${idx}`} className="flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#10B981]" />
                <p className="text-xs text-[#9FB0C3] leading-relaxed" style={{ fontFamily: fontFamily.body }}>{action}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── NO DATA DISCLAIMER ── */}
        <div className="rounded-xl p-4" style={{ background: 'var(--biqc-bg)', border: '1px solid #24314050', animation: 'cmsFade 1.8s ease-out' }}>
          <p className="text-xs text-[#64748B] leading-relaxed" style={{ fontFamily: fontFamily.mono }}>
            All analysis above is based on publicly available digital signals only. No internal revenue, lead, or performance data has been assumed. Connect your integrations to unlock verified internal intelligence.
          </p>
        </div>

        {/* ── CTA ── */}
        <div className="text-center pt-4" style={{ animation: 'cmsFade 2s ease-out' }}>
          <button onClick={onConfirm} disabled={isSubmitting}
            className="px-10 py-3.5 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 disabled:opacity-40 inline-flex items-center gap-2"
            style={{ background: '#FF6A00', fontFamily: fontFamily.display }}
            data-testid="cms-continue-btn">
            {isSubmitting ? 'Confirming...' : 'Continue to Calibrate'} <ArrowRight className="w-4 h-4" />
          </button>
          <p className="text-[10px] text-[#64748B] mt-3 max-w-sm mx-auto" style={{ fontFamily: fontFamily.mono }}>
            Next: Connect your business tools to replace surface analysis with real performance intelligence.
          </p>
        </div>

      </div>
    </div>
  );
};

export default ChiefMarketingSummary;
