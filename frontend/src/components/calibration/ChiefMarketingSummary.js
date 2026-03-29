import React, { useState } from 'react';
import { ArrowRight, AlertTriangle, TrendingUp, Globe, Users, Star, Target, ChevronDown, ChevronUp, CheckCircle2, XCircle, Zap, BarChart3, Shield, Activity } from 'lucide-react';
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
      advice: full.pricing_model ? 'Add a starting price or pricing tier page — even a "From $X" reference reduces friction and improves lead quality.' : 'Consider a transparent pricing or packages page. Price anchoring increases inbound quality.',
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
  const handles = full.social_handles || {};
  const hasLinkedIn = !!(socials.linkedin || full.linkedin_url || handles.linkedin);
  const hasFacebook = !!(socials.facebook || full.facebook_url || handles.facebook);
  const hasInstagram = !!(socials.instagram || full.instagram_url || handles.instagram);
  const hasTwitter = !!(socials.twitter || full.twitter_x_url || handles.twitter || handles.x);
  const activeSocials = [hasLinkedIn && 'LinkedIn', hasFacebook && 'Facebook', hasInstagram && 'Instagram', hasTwitter && 'X/Twitter'].filter(Boolean);

  const industry = (full.industry || '').toLowerCase();
  const model = (full.business_model || '').toLowerCase();
  const services = full.main_products_services || '';
  const targetMarket = full.target_market || '';

  const isDigital = /(saas|software|platform|digital|online|cloud|subscription|app)/i.test(`${industry} ${model} ${services}`);
  const isLocal = /(local|physical|brick|mortar|clinic|salon|restaurant|retail|tradie|plumber|electrician|builder|landscap)/i.test(`${industry} ${model} ${services}`);
  const isConsulting = /(consult|advisory|agency|professional services|coaching|mentor|strateg)/i.test(`${industry} ${model} ${services}`);

  const expansionRecommendations = [];

  if (isDigital) {
    expansionRecommendations.push(
      { region: 'North America (US/Canada)', rationale: 'Largest SaaS/digital market globally. English-speaking reduces localization cost. High average contract values.', evidence: services ? `Current offering "${services.substring(0, 80)}" translates directly to NA buyer expectations.` : 'Digital delivery model supports frictionless NA expansion.' },
      { region: 'United Kingdom & Europe', rationale: 'Strong B2B digital adoption, especially UK/DACH/Nordics. Similar business culture to AU/NZ.', evidence: targetMarket ? `Target market "${targetMarket.substring(0, 60)}" has direct parallels in UK enterprise.` : 'English-first product can enter UK immediately.' },
      { region: 'Southeast Asia (SG/MY/PH)', rationale: 'Rapidly growing digital economy. Lower competition density. Strong English business language.', evidence: 'Timezone proximity to AU base supports real-time service delivery.' },
    );
  } else if (isLocal) {
    const region = loc || 'current region';
    expansionRecommendations.push(
      { region: `Adjacent suburbs/cities near ${region}`, rationale: 'Expand service radius incrementally. Lowest risk, highest brand trust carryover.', evidence: loc ? `Strong local presence detected in ${loc} — adjacent areas benefit from existing reputation.` : 'Local service model suggests adjacent geographic expansion.' },
      { region: 'State/territory expansion', rationale: 'Replicate proven local model in similar demographic markets within the same state.', evidence: 'Use Google Business Profile multi-location strategy to dominate local search in new areas.' },
      { region: 'National franchise/licensing model', rationale: 'Scale proven local playbook through operator partnerships without proportional overhead increase.', evidence: `Service model in ${industry || 'this sector'} has demonstrated franchise scalability in AU market.` },
    );
  } else if (isConsulting) {
    expansionRecommendations.push(
      { region: 'Remote/national (AU-wide)', rationale: 'Advisory/consulting translates to remote delivery immediately. Expand beyond local geography.', evidence: services ? `"${services.substring(0, 60)}" can be delivered nationally via digital channels.` : 'Consulting model supports immediate national reach.' },
      { region: 'UK & North America', rationale: 'English-speaking markets with high willingness to pay for specialized advisory.', evidence: targetMarket ? `Target market "${targetMarket.substring(0, 60)}" exists in larger scale in US/UK.` : 'Professional services export well to English-speaking markets.' },
      { region: 'APAC enterprise partnerships', rationale: 'SG/HK regional hubs value AU-based advisory for cross-border strategy.', evidence: 'APAC expansion via partnership reduces client acquisition cost versus direct entry.' },
    );
  } else {
    expansionRecommendations.push(
      { region: loc ? `Broader ${loc} metropolitan area` : 'Adjacent regions', rationale: 'Start with geographic adjacency to leverage existing brand awareness.', evidence: 'Incremental geographic growth carries lowest risk and highest trust transfer.' },
      { region: 'National digital presence', rationale: 'Invest in content marketing and SEO to capture demand beyond local area.', evidence: 'Digital-first lead generation enables national reach without physical expansion.' },
    );
  }

  return { loc, activeSocials, hasSocialPresence: activeSocials.length > 0, isDigital, isLocal, isConsulting, expansionRecommendations };
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

  const evidenceCount = reviewEvidence.length;
  const strongEvidence = evidenceCount >= 3;
  const weakEvidence = evidenceCount > 0 && evidenceCount < 3;
  const evidenceSummary = reviewEvidence.slice(0, 3).join(', ');

  let impact;
  if (strongEvidence) {
    impact = [
      {
        fundamental: 'Conversion rate',
        impact: 'Positive lift expected',
        mechanism: `Found ${evidenceCount} social-proof signals (${evidenceSummary}) — strong visible trust markers typically support higher visitor-to-enquiry conversion.`,
      },
      {
        fundamental: 'Customer acquisition cost',
        impact: 'Efficiency gain expected',
        mechanism: `${evidenceCount} verified proof points reduce the trust gap in paid and organic funnels, lowering cost per qualified lead.`,
      },
      {
        fundamental: 'Gross profit',
        impact: 'Margin support likely',
        mechanism: `Multiple proof signals (${evidenceCount} detected) strengthen value-based pricing and reduce discount pressure during sales.`,
      },
    ];
  } else if (weakEvidence) {
    impact = [
      {
        fundamental: 'Conversion rate',
        impact: 'Modest lift possible',
        mechanism: `Found ${evidenceCount} proof signal${evidenceCount === 1 ? '' : 's'} (${evidenceSummary}) — limited social proof may partially support conversion but leaves trust gaps.`,
      },
      {
        fundamental: 'Customer acquisition cost',
        impact: 'Minor efficiency gain',
        mechanism: `Only ${evidenceCount} visible proof marker${evidenceCount === 1 ? '' : 's'} detected — insufficient density to materially reduce acquisition cost.`,
      },
      {
        fundamental: 'Gross profit',
        impact: 'Neutral to slight support',
        mechanism: `Thin proof layer (${evidenceCount} signal${evidenceCount === 1 ? '' : 's'}) provides limited pricing leverage — expanding case studies would strengthen margin.`,
      },
    ];
  } else {
    impact = [
      {
        fundamental: 'Conversion rate',
        impact: 'Drag risk — no proof detected',
        mechanism: 'No visible customer reviews, testimonials, or case studies found — prospects lack third-party validation to support purchase decisions.',
      },
      {
        fundamental: 'Customer acquisition cost',
        impact: 'Elevated cost risk',
        mechanism: 'No detected social proof means paid campaigns must work harder to build trust, increasing cost per acquisition.',
      },
      {
        fundamental: 'Gross profit',
        impact: 'Margin pressure risk',
        mechanism: 'Absence of verifiable proof often forces sales to compensate with discounting. No review footprint detected in this scan.',
      },
    ];
  }
  const topEvidence = reviewEvidence.slice(0, 3).join(' | ');
  const depthNarrative = hasReviewData
    ? `Observed ${reviewEvidence.length} customer-proof marker${reviewEvidence.length === 1 ? '' : 's'} in public footprint${topEvidence ? `: ${topEvidence}.` : '.'} Revenue impact model uses only detected signals and scales confidence to ${confidenceBand}.`
    : 'No verifiable customer review footprint detected in this scan, so BIQc suppresses deep narrative claims until stronger evidence is observed.';

  return { reviewEvidence, customerReviewSignals, hasReviewData, confidenceBand, impact, depthNarrative };
}

function buildStaffImpactSignals(staffSignals) {
  const reviewCount = (staffSignals.staffReviewSignals || []).length;
  const teamMemberCount = (staffSignals.teamMembers || []).length;
  const hasTeamMembers = teamMemberCount > 0;
  const hasFounder = Boolean(staffSignals.founderBackground);
  const hasTeamSize = Boolean(staffSignals.teamSize);
  const hasAny = staffSignals.hasStaffData;

  const signalParts = [];
  if (hasTeamMembers) signalParts.push(`${teamMemberCount} named team member${teamMemberCount === 1 ? '' : 's'}`);
  if (hasTeamSize) signalParts.push(`team size: ${staffSignals.teamSize}`);
  if (hasFounder) signalParts.push('founder background detected');
  if (reviewCount > 0) signalParts.push(`${reviewCount} staff review signal${reviewCount === 1 ? '' : 's'}`);
  const signalSummary = signalParts.join(', ');

  let impact;
  if (hasAny && (hasTeamMembers || reviewCount > 0)) {
    impact = [
      {
        fundamental: 'Service delivery capacity',
        impact: hasTeamMembers ? 'Execution continuity supported' : 'Partial visibility only',
        mechanism: hasTeamMembers
          ? `${teamMemberCount} named team member${teamMemberCount === 1 ? '' : 's'} detected — visible role structure reduces key-person dependency risk.`
          : `No named team members found but ${signalSummary} provides partial staffing visibility.`,
      },
      {
        fundamental: 'Revenue retention',
        impact: reviewCount > 0 ? 'Retention support indicated' : 'Limited retention signal',
        mechanism: reviewCount > 0
          ? `${reviewCount} staff review signal${reviewCount === 1 ? '' : 's'} detected — positive team culture markers correlate with consistent client experience.`
          : `No staff review signals found. Team health is not publicly verifiable — retention impact cannot be assessed from available data.`,
      },
      {
        fundamental: 'Operating profit',
        impact: reviewCount > 0 && hasTeamMembers ? 'Margin support indicated' : 'Insufficient data for margin assessment',
        mechanism: reviewCount > 0 && hasTeamMembers
          ? `Combined evidence (${signalSummary}) suggests manageable team friction — lower rework and escalation costs support operating margin.`
          : `Only partial team signals found (${signalSummary}). Insufficient evidence to assess margin impact with confidence.`,
      },
    ];
  } else if (hasAny) {
    impact = [
      {
        fundamental: 'Service delivery capacity',
        impact: 'Partial visibility — risk not quantifiable',
        mechanism: `Detected: ${signalSummary}. Insufficient structure data to assess delivery continuity with confidence.`,
      },
      {
        fundamental: 'Revenue retention',
        impact: 'Insufficient data',
        mechanism: `Only foundational signals found (${signalSummary}). No staff review or team structure data to assess retention impact.`,
      },
      {
        fundamental: 'Operating profit',
        impact: 'Cannot assess from available signals',
        mechanism: `Limited staffing evidence (${signalSummary}) does not support a margin impact estimate. More data needed.`,
      },
    ];
  } else {
    impact = [
      {
        fundamental: 'Service delivery capacity',
        impact: 'Unverified — no signals detected',
        mechanism: 'No public staffing, team structure, or employee review signals were found in this scan.',
      },
      {
        fundamental: 'Revenue retention',
        impact: 'Blind spot — no team health data',
        mechanism: 'Without visible team signals, client experience consistency cannot be assessed from public data.',
      },
      {
        fundamental: 'Operating profit',
        impact: 'Unknown risk exposure',
        mechanism: 'No staff data detected. BIQc does not fabricate team dynamics — connect internal HR or review channels to unlock this analysis.',
      },
    ];
  }

  const depthNarrative = hasAny
    ? `Staff intelligence is derived from ${signalSummary}. Impact assessments are scoped strictly to verified public signals — no assumptions about internal team dynamics.`
    : 'No public staff-review or structure markers were verified. BIQc reports risk posture only and does not infer hidden team dynamics.';

  return { impact, depthNarrative };
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
  const fieldProvenance = full._field_provenance || {};
  const analysisGaps = Array.isArray(full.analysis_gaps) ? full.analysis_gaps : [];
  const marketIntelScore = typeof full.market_intelligence_score === 'number' ? full.market_intelligence_score : null;
  const marketTrajectory = full.market_trajectory || '';
  const marketEvidence = Array.isArray(full.market_evidence) ? full.market_evidence : [];
  const marketAnalysis = full.market_analysis || null;
  const deepReconSummary = full.deep_recon_summary || '';
  const deepReconSignals = Array.isArray(full.deep_recon_signals) ? full.deep_recon_signals : [];
  const hasDeepRecon = Boolean(deepReconSummary || deepReconSignals.length > 0);
  const competitorMonitorData = full.competitor_monitor_data || null;
  const competitorMonitorSummary = full.competitor_monitor_summary || '';

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

        {/* ── SECTION 2B2: DEEP INTELLIGENCE SIGNALS ── */}
        {hasDeepRecon && (
          <div className="rounded-xl p-5" style={{ background: 'var(--biqc-bg-card)', border: '1px solid #8B5CF640', animation: 'cmsFade 0.92s ease-out' }} data-testid="deep-intelligence-signals">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-4 h-4" style={{ color: '#8B5CF6' }} />
              <h2 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>Deep Intelligence Signals</h2>
            </div>
            {deepReconSummary && (
              <p className="text-sm text-[#9FB0C3] leading-relaxed mb-3" style={{ fontFamily: fontFamily.body }}>
                {deepReconSummary}
              </p>
            )}
            {deepReconSignals.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>Detected Signals</p>
                {deepReconSignals.map((signal, idx) => (
                  <p key={idx} className="text-xs text-[#9FB0C3]" style={{ fontFamily: fontFamily.body }}>
                    • {typeof signal === 'string' ? signal : (signal?.text || signal?.description || signal?.signal || JSON.stringify(signal))}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── SECTION 2C: CHANNEL & WEBSITE DIAGNOSTICS ── */}
        <div className="rounded-xl p-5" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)', animation: 'cmsFade 0.95s ease-out' }} data-testid="channel-diagnostics">
          <div className="flex items-center gap-2 mb-3">
            <Globe className="w-4 h-4" style={{ color: '#06B6D4' }} />
            <h2 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>Website, SEO, Paid & Social Diagnostics</h2>
          </div>
          <div className="space-y-4">

            {/* Website Condition */}
            <div>
              <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>Website Condition</p>
              {(websiteHealth.score != null || websiteHealth.status) ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    {websiteHealth.score != null && (
                      <span className="text-sm font-bold" style={{ color: websiteHealth.score >= 75 ? '#10B981' : websiteHealth.score >= 45 ? '#F59E0B' : '#EF4444', fontFamily: fontFamily.mono }}>
                        {websiteHealth.score}/100
                      </span>
                    )}
                    {websiteHealth.status && (
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{
                        color: websiteHealth.status === 'strong' ? '#10B981' : websiteHealth.status === 'moderate' ? '#F59E0B' : '#EF4444',
                        background: (websiteHealth.status === 'strong' ? '#10B981' : websiteHealth.status === 'moderate' ? '#F59E0B' : '#EF4444') + '15',
                        fontFamily: fontFamily.mono,
                      }}>
                        {websiteHealth.status}
                      </span>
                    )}
                  </div>
                  {websiteHealth.summary && (
                    <p className="text-xs text-[#9FB0C3]" style={{ fontFamily: fontFamily.body }}>{websiteHealth.summary}</p>
                  )}
                  {(websiteHealth.title_tag != null || websiteHealth.meta_description != null || websiteHealth.ssl != null || websiteHealth.mobile_responsive != null) && (
                    <div className="grid grid-cols-2 gap-1.5 mt-1">
                      {[
                        { label: 'Title Tag', val: websiteHealth.title_tag },
                        { label: 'Meta Description', val: websiteHealth.meta_description },
                        { label: 'SSL/HTTPS', val: websiteHealth.ssl },
                        { label: 'Mobile Responsive', val: websiteHealth.mobile_responsive },
                      ].filter(item => item.val != null).map((item, idx) => (
                        <div key={idx} className="flex items-center gap-1.5">
                          {item.val ? <CheckCircle2 className="w-3 h-3 text-[#10B981]" /> : <XCircle className="w-3 h-3 text-[#EF4444]" />}
                          <span className="text-[11px] text-[#9FB0C3]" style={{ fontFamily: fontFamily.body }}>{item.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : websiteHealth.assessment ? (
                <p className="text-xs text-[#9FB0C3]" style={{ fontFamily: fontFamily.body }}>{websiteHealth.assessment}</p>
              ) : (
                <p className="text-xs text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>No website health data available.</p>
              )}
            </div>

            {/* SEO */}
            <div>
              <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>SEO</p>
              {(seoAnalysis.score != null || seoAnalysis.status) ? (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-3">
                    {seoAnalysis.score != null && (
                      <span className="text-sm font-bold" style={{ color: seoAnalysis.score >= 75 ? '#10B981' : seoAnalysis.score >= 45 ? '#F59E0B' : '#EF4444', fontFamily: fontFamily.mono }}>
                        {seoAnalysis.score}/100
                      </span>
                    )}
                    {seoAnalysis.status && (
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{
                        color: seoAnalysis.status === 'strong' ? '#10B981' : seoAnalysis.status === 'moderate' ? '#F59E0B' : '#EF4444',
                        background: (seoAnalysis.status === 'strong' ? '#10B981' : seoAnalysis.status === 'moderate' ? '#F59E0B' : '#EF4444') + '15',
                        fontFamily: fontFamily.mono,
                      }}>
                        {seoAnalysis.status}
                      </span>
                    )}
                  </div>
                  {Array.isArray(seoAnalysis.strengths) && seoAnalysis.strengths.length > 0 && (
                    <div className="space-y-0.5">
                      {seoAnalysis.strengths.slice(0, 4).map((s, idx) => (
                        <p key={idx} className="text-[11px] text-[#9FB0C3] flex items-center gap-1" style={{ fontFamily: fontFamily.body }}>
                          <CheckCircle2 className="w-3 h-3 text-[#10B981] shrink-0" /> {s}
                        </p>
                      ))}
                    </div>
                  )}
                  {Array.isArray(seoAnalysis.gaps) && seoAnalysis.gaps.length > 0 && (
                    <div className="space-y-0.5">
                      {seoAnalysis.gaps.slice(0, 4).map((g, idx) => (
                        <p key={idx} className="text-[11px] text-[#9FB0C3] flex items-center gap-1" style={{ fontFamily: fontFamily.body }}>
                          <XCircle className="w-3 h-3 text-[#EF4444] shrink-0" /> {g}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ) : seoAnalysis.assessment ? (
                <p className="text-xs text-[#9FB0C3]" style={{ fontFamily: fontFamily.body }}>{seoAnalysis.assessment}</p>
              ) : (
                <p className="text-xs text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>No SEO analysis data available.</p>
              )}
              {Array.isArray(seoAnalysis.priority_actions) && seoAnalysis.priority_actions.length > 0 && (
                <div className="mt-1.5 space-y-0.5">
                  {seoAnalysis.priority_actions.slice(0, 2).map((a, idx) => (
                    <p key={idx} className="text-[11px] text-[#64748B]" style={{ fontFamily: fontFamily.body }}>→ {a}</p>
                  ))}
                </div>
              )}
            </div>

            {/* Paid Media */}
            <div>
              <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>Paid Media</p>
              {(paidAnalysis.maturity || paidAnalysis.signals_detected) ? (
                <div className="space-y-1.5">
                  {paidAnalysis.maturity && (
                    <span className="text-xs px-2 py-0.5 rounded-full inline-block" style={{
                      color: paidAnalysis.maturity === 'active' ? '#10B981' : '#F59E0B',
                      background: (paidAnalysis.maturity === 'active' ? '#10B981' : '#F59E0B') + '15',
                      fontFamily: fontFamily.mono,
                    }}>
                      {paidAnalysis.maturity}
                    </span>
                  )}
                  {paidAnalysis.assessment && (
                    <p className="text-xs text-[#9FB0C3]" style={{ fontFamily: fontFamily.body }}>{paidAnalysis.assessment}</p>
                  )}
                  {Array.isArray(paidAnalysis.signals_detected) && paidAnalysis.signals_detected.length > 0 && (
                    <p className="text-[11px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>Signals: {paidAnalysis.signals_detected.join(', ')}</p>
                  )}
                  {Array.isArray(paidAnalysis.priority_actions) && paidAnalysis.priority_actions.length > 0 && (
                    <div className="space-y-0.5">
                      {paidAnalysis.priority_actions.slice(0, 2).map((a, idx) => (
                        <p key={idx} className="text-[11px] text-[#64748B]" style={{ fontFamily: fontFamily.body }}>→ {a}</p>
                      ))}
                    </div>
                  )}
                </div>
              ) : paidAnalysis.assessment ? (
                <p className="text-xs text-[#9FB0C3]" style={{ fontFamily: fontFamily.body }}>{paidAnalysis.assessment}</p>
              ) : paidAnalysis.score != null ? (
                <p className="text-xs text-[#9FB0C3]" style={{ fontFamily: fontFamily.body }}>
                  Score: {paidAnalysis.score} · {paidAnalysis.status || 'Unknown status'}
                </p>
              ) : (
                <p className="text-xs text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>No paid media diagnostics available.</p>
              )}
            </div>

            {/* Social Marketing */}
            <div>
              <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>Social Marketing</p>
              {(socialAnalysis.active_channels || socialAnalysis.channel_count != null) ? (
                <div className="space-y-1.5">
                  {Array.isArray(socialAnalysis.active_channels) && socialAnalysis.active_channels.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {socialAnalysis.active_channels.map((ch, idx) => (
                        <span key={idx} className="text-[11px] px-2 py-0.5 rounded-full" style={{ color: '#06B6D4', background: '#06B6D415', fontFamily: fontFamily.mono }}>{ch}</span>
                      ))}
                    </div>
                  )}
                  {socialAnalysis.assessment && (
                    <p className="text-xs text-[#9FB0C3]" style={{ fontFamily: fontFamily.body }}>{socialAnalysis.assessment}</p>
                  )}
                  {Array.isArray(socialAnalysis.content_signals_detected) && socialAnalysis.content_signals_detected.length > 0 && (
                    <p className="text-[11px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>Content signals: {socialAnalysis.content_signals_detected.join(', ')}</p>
                  )}
                  {Array.isArray(socialAnalysis.priority_actions) && socialAnalysis.priority_actions.length > 0 && (
                    <div className="space-y-0.5">
                      {socialAnalysis.priority_actions.slice(0, 2).map((a, idx) => (
                        <p key={idx} className="text-[11px] text-[#64748B]" style={{ fontFamily: fontFamily.body }}>→ {a}</p>
                      ))}
                    </div>
                  )}
                </div>
              ) : socialAnalysis.assessment ? (
                <p className="text-xs text-[#9FB0C3]" style={{ fontFamily: fontFamily.body }}>{socialAnalysis.assessment}</p>
              ) : socialAnalysis.score != null ? (
                <p className="text-xs text-[#9FB0C3]" style={{ fontFamily: fontFamily.body }}>
                  Score: {socialAnalysis.score} · {socialAnalysis.status || 'Unknown status'}
                </p>
              ) : (
                <p className="text-xs text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>No social diagnostics available.</p>
              )}
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
            <h2 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>Geographic Market Presence & Expansion</h2>
          </div>

          {/* Current presence */}
          {geo.loc ? (
            <p className="text-sm text-[#9FB0C3] mb-3" style={{ fontFamily: fontFamily.body }}>
              Based on publicly detectable signals, <strong style={{ color: 'var(--biqc-text)' }}>{bizName}</strong> currently serves clients in and around <strong style={{ color: 'var(--biqc-text)' }}>{geo.loc}</strong>.
              {full.industry ? ` Operating in the ${full.industry} sector` : ''}{full.business_model ? ` with a ${full.business_model} model.` : '.'}
            </p>
          ) : (
            <p className="text-xs text-[#64748B] mb-3" style={{ fontFamily: fontFamily.mono }}>No location data detected from website or registry.</p>
          )}

          {geo.hasSocialPresence ? (
            <p className="text-xs text-[#9FB0C3] mb-3" style={{ fontFamily: fontFamily.body }}>
              Active social presence on {geo.activeSocials.join(', ')} extends reach beyond primary geography.
            </p>
          ) : (
            <div className="flex items-start gap-2 p-2.5 rounded-lg mb-3" style={{ background: '#F59E0B08', border: '1px solid #F59E0B20' }}>
              <AlertTriangle className="w-3.5 h-3.5 text-[#F59E0B] shrink-0 mt-0.5" />
              <p className="text-xs text-[#9FB0C3]" style={{ fontFamily: fontFamily.body }}>No active social media presence detected. Geographic reach is limited to direct traffic and word of mouth.</p>
            </div>
          )}

          {full.geographic_focus && full.geographic_focus !== full.location && (
            <p className="text-xs text-[#64748B] mb-3" style={{ fontFamily: fontFamily.mono }}>Declared geographic focus: {full.geographic_focus}</p>
          )}

          {/* Business type classification */}
          <div className="p-3 rounded-lg mb-3" style={{ background: '#111A25', border: '1px solid #243140' }}>
            <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#7C3AED', fontFamily: fontFamily.mono }}>Business Type Assessment</p>
            <p className="text-xs text-[#9FB0C3]" style={{ fontFamily: fontFamily.body }}>
              {geo.isDigital && 'Digital/SaaS business model detected — global expansion is viable with low marginal cost per new market.'}
              {geo.isLocal && !geo.isDigital && 'Local/physical service model detected — geographic expansion follows adjacency and replication strategies.'}
              {geo.isConsulting && !geo.isDigital && !geo.isLocal && 'Consulting/advisory model detected — remote delivery enables national and international reach.'}
              {!geo.isDigital && !geo.isLocal && !geo.isConsulting && 'General business model — expansion strategy depends on digital capability and service delivery method.'}
            </p>
            {full.main_products_services && (
              <p className="text-[11px] text-[#64748B] mt-1" style={{ fontFamily: fontFamily.body }}>
                Based on offering: "{full.main_products_services.substring(0, 120)}{full.main_products_services.length > 120 ? '...' : ''}"
              </p>
            )}
          </div>

          {/* Expansion recommendations */}
          {geo.expansionRecommendations.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: '#10B981', fontFamily: fontFamily.mono }}>Recommended Expansion Markets</p>
              <div className="space-y-2">
                {geo.expansionRecommendations.map((rec, idx) => (
                  <div key={idx} className="p-3 rounded-lg" style={{ background: '#10B98108', border: '1px solid #10B98120' }}>
                    <p className="text-xs font-semibold mb-1" style={{ color: '#10B981', fontFamily: fontFamily.body }}>{rec.region}</p>
                    <p className="text-[11px] text-[#9FB0C3] leading-relaxed" style={{ fontFamily: fontFamily.body }}>{rec.rationale}</p>
                    <p className="text-[10px] text-[#64748B] mt-1" style={{ fontFamily: fontFamily.mono }}>Evidence: {rec.evidence}</p>
                  </div>
                ))}
              </div>
            </div>
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
              {(competitorMonitorSummary || competitorMonitorData) && (
                <div className="mt-3 p-3 rounded-lg" style={{ background: '#3B82F608', border: '1px solid #3B82F620' }}>
                  <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#3B82F6', fontFamily: fontFamily.mono }}>Competitor Monitor</p>
                  {competitorMonitorSummary && (
                    <p className="text-xs text-[#9FB0C3] mb-2" style={{ fontFamily: fontFamily.body }}>
                      {competitorMonitorSummary}
                    </p>
                  )}
                  {competitorMonitorData && typeof competitorMonitorData === 'object' && (
                    <div className="space-y-2 mt-2">
                      {Array.isArray(competitorMonitorData.competitors) && competitorMonitorData.competitors.map((comp, idx) => (
                        <div key={idx} className="p-2 rounded-lg" style={{ background: '#111A25', border: '1px solid #243140' }}>
                          <p className="text-xs font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.body }}>
                            {comp.name || comp.domain || `Competitor ${idx + 1}`}
                          </p>
                          {comp.summary && <p className="text-[11px] text-[#9FB0C3] mt-1" style={{ fontFamily: fontFamily.body }}>{comp.summary}</p>}
                          {comp.threat_level && <p className="text-[10px] mt-1" style={{ color: '#F59E0B', fontFamily: fontFamily.mono }}>Threat level: {comp.threat_level}</p>}
                          {comp.signals && Array.isArray(comp.signals) && comp.signals.length > 0 && (
                            <p className="text-[11px] text-[#64748B] mt-1" style={{ fontFamily: fontFamily.body }}>
                              Signals: {comp.signals.join(', ')}
                            </p>
                          )}
                        </div>
                      ))}
                      {competitorMonitorData.summary && !competitorMonitorSummary && (
                        <p className="text-xs text-[#9FB0C3]" style={{ fontFamily: fontFamily.body }}>{competitorMonitorData.summary}</p>
                      )}
                      {typeof competitorMonitorData === 'string' && (
                        <p className="text-xs text-[#9FB0C3]" style={{ fontFamily: fontFamily.body }}>{competitorMonitorData}</p>
                      )}
                    </div>
                  )}
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

          {/* Google Reviews + Glassdoor aggregated scores */}
          {(full.google_reviews?.has_data || full.glassdoor_reviews?.has_data || full.review_aggregation?.has_data) && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-4">
              {full.google_reviews?.has_data && (
                <div className="p-3 rounded-lg" style={{ background: '#111A25', border: '1px solid #F59E0B30' }}>
                  <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#F59E0B', fontFamily: fontFamily.mono }}>Google Reviews</p>
                  {full.google_reviews.star_rating != null && (
                    <p className="text-lg font-bold" style={{ color: '#F59E0B', fontFamily: fontFamily.mono }}>
                      {full.google_reviews.star_rating}<span className="text-xs font-normal text-[#64748B]">/5</span>
                    </p>
                  )}
                  {full.google_reviews.review_count != null && (
                    <p className="text-[11px] text-[#9FB0C3]" style={{ fontFamily: fontFamily.body }}>{full.google_reviews.review_count.toLocaleString()} reviews</p>
                  )}
                  {!full.google_reviews.star_rating && !full.google_reviews.review_count && full.google_reviews.snippets?.length > 0 && (
                    <p className="text-[11px] text-[#9FB0C3]" style={{ fontFamily: fontFamily.body }}>{full.google_reviews.snippets.length} review signal{full.google_reviews.snippets.length === 1 ? '' : 's'} detected</p>
                  )}
                </div>
              )}
              {full.glassdoor_reviews?.has_data && (
                <div className="p-3 rounded-lg" style={{ background: '#111A25', border: '1px solid #8B5CF630' }}>
                  <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#8B5CF6', fontFamily: fontFamily.mono }}>Glassdoor</p>
                  {full.glassdoor_reviews.rating != null && (
                    <p className="text-lg font-bold" style={{ color: '#8B5CF6', fontFamily: fontFamily.mono }}>
                      {full.glassdoor_reviews.rating}<span className="text-xs font-normal text-[#64748B]">/5</span>
                    </p>
                  )}
                  {full.glassdoor_reviews.snippets?.length > 0 && (
                    <p className="text-[11px] text-[#9FB0C3]" style={{ fontFamily: fontFamily.body }}>{full.glassdoor_reviews.snippets.length} employee review signal{full.glassdoor_reviews.snippets.length === 1 ? '' : 's'}</p>
                  )}
                </div>
              )}
              {full.review_aggregation?.has_data && (
                <div className="p-3 rounded-lg" style={{ background: '#111A25', border: '1px solid #10B98130' }}>
                  <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#10B981', fontFamily: fontFamily.mono }}>Aggregated</p>
                  {full.review_aggregation.combined_score != null && (
                    <p className="text-lg font-bold" style={{ color: '#10B981', fontFamily: fontFamily.mono }}>
                      {full.review_aggregation.combined_score}<span className="text-xs font-normal text-[#64748B]">/5</span>
                    </p>
                  )}
                  <p className="text-[11px] text-[#9FB0C3]" style={{ fontFamily: fontFamily.body }}>
                    <span style={{ color: '#10B981' }}>{full.review_aggregation.positive_count || 0}</span> positive · <span style={{ color: '#EF4444' }}>{full.review_aggregation.negative_count || 0}</span> negative
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Top 3 recent reviews */}
          {full.review_aggregation?.top_recent?.length > 0 && (
            <div className="mb-4">
              <p className="text-[10px] uppercase tracking-widest mb-1.5" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>Most Recent Review Signals</p>
              <div className="space-y-1.5">
                {full.review_aggregation.top_recent.slice(0, 3).map((snippet, idx) => (
                  <p key={idx} className="text-xs text-[#9FB0C3] leading-relaxed" style={{ fontFamily: fontFamily.body }}>
                    "{snippet}"
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Positive vs Negative split */}
          {(full.google_reviews?.positive?.length > 0 || full.google_reviews?.negative?.length > 0 || full.glassdoor_reviews?.positive?.length > 0 || full.glassdoor_reviews?.negative?.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 mb-4">
              {((full.google_reviews?.positive?.length || 0) + (full.glassdoor_reviews?.positive?.length || 0)) > 0 && (
                <div className="p-3 rounded-lg" style={{ background: '#10B98108', border: '1px solid #10B98120' }}>
                  <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#10B981', fontFamily: fontFamily.mono }}>Positive Signals</p>
                  {[...(full.google_reviews?.positive || []), ...(full.glassdoor_reviews?.positive || [])].slice(0, 3).map((s, idx) => (
                    <p key={idx} className="text-[11px] text-[#9FB0C3] leading-relaxed mb-1" style={{ fontFamily: fontFamily.body }}>"{s}"</p>
                  ))}
                </div>
              )}
              {((full.google_reviews?.negative?.length || 0) + (full.glassdoor_reviews?.negative?.length || 0)) > 0 && (
                <div className="p-3 rounded-lg" style={{ background: '#EF444408', border: '1px solid #EF444420' }}>
                  <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#EF4444', fontFamily: fontFamily.mono }}>Negative Signals</p>
                  {[...(full.google_reviews?.negative || []), ...(full.glassdoor_reviews?.negative || [])].slice(0, 3).map((s, idx) => (
                    <p key={idx} className="text-[11px] text-[#9FB0C3] leading-relaxed mb-1" style={{ fontFamily: fontFamily.body }}>"{s}"</p>
                  ))}
                </div>
              )}
            </div>
          )}

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
          ) : !full.google_reviews?.has_data && !full.glassdoor_reviews?.has_data ? (
            <p className="text-xs text-[#64748B] mb-3" style={{ fontFamily: fontFamily.mono }}>
              No explicit customer review markers were found in the current public scan.
            </p>
          ) : null}

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
            <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#3B82F6', fontFamily: fontFamily.mono }}>Review Intelligence Depth</p>
            <p className="text-xs text-[#9FB0C3] leading-relaxed" style={{ fontFamily: fontFamily.body }}>
              {customerReviews.depthNarrative}
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
                <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#3B82F6', fontFamily: fontFamily.mono }}>Staff Intelligence Depth</p>
                <p className="text-xs text-[#9FB0C3] leading-relaxed" style={{ fontFamily: fontFamily.body }}>
                  {staffImpact.depthNarrative}
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
                  {Array.isArray(swot[key]) && swot[key].length > 0 ? (
                    <ul className="space-y-1">
                      {swot[key].map((item, idx) => (
                        <li key={idx} className="text-xs text-[#9FB0C3] leading-relaxed" style={{ fontFamily: fontFamily.body }}>
                          {swot[key].length > 1 ? '• ' : ''}{typeof item === 'string' ? item : (item?.text || item?.description || JSON.stringify(item))}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>Insufficient verified data.</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── SECTION 5C: MARKET INTELLIGENCE ANALYSIS ── */}
        {(marketAnalysis || marketIntelScore !== null || marketEvidence.length > 0) && (
          <div className="rounded-xl p-5" style={{ background: 'var(--biqc-bg-card)', border: '1px solid #06B6D440', animation: 'cmsFade 1.52s ease-out' }} data-testid="market-intelligence-analysis">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-4 h-4" style={{ color: '#06B6D4' }} />
              <h2 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>Market Intelligence Analysis</h2>
              {marketIntelScore !== null && (
                <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full" style={{
                  color: marketIntelScore >= 70 ? '#10B981' : marketIntelScore >= 40 ? '#F59E0B' : '#EF4444',
                  background: (marketIntelScore >= 70 ? '#10B981' : marketIntelScore >= 40 ? '#F59E0B' : '#EF4444') + '15',
                  fontFamily: fontFamily.mono,
                }}>
                  score: {marketIntelScore}/100
                </span>
              )}
            </div>

            {marketTrajectory && (
              <p className="text-xs text-[#9FB0C3] mb-3" style={{ fontFamily: fontFamily.body }}>
                Market trajectory: <strong style={{ color: '#F4F7FA' }}>{marketTrajectory}</strong>
              </p>
            )}

            {marketAnalysis && (
              <div className="space-y-3">
                {marketAnalysis.analysis_title && (
                  <p className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.body }}>{marketAnalysis.analysis_title}</p>
                )}
                {marketAnalysis.market_size && (
                  <div className="p-3 rounded-lg" style={{ background: '#111A25', border: '1px solid #243140' }}>
                    <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>Market Size</p>
                    <p className="text-xs text-[#9FB0C3]" style={{ fontFamily: fontFamily.body }}>
                      {typeof marketAnalysis.market_size === 'string' ? marketAnalysis.market_size : JSON.stringify(marketAnalysis.market_size)}
                    </p>
                  </div>
                )}
                {marketAnalysis.competitor_landscape && (
                  <div className="p-3 rounded-lg" style={{ background: '#111A25', border: '1px solid #243140' }}>
                    <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>Competitor Landscape</p>
                    <p className="text-xs text-[#9FB0C3]" style={{ fontFamily: fontFamily.body }}>
                      {typeof marketAnalysis.competitor_landscape === 'string' ? marketAnalysis.competitor_landscape : JSON.stringify(marketAnalysis.competitor_landscape)}
                    </p>
                  </div>
                )}
                {marketAnalysis.customer_insight && (
                  <div className="p-3 rounded-lg" style={{ background: '#111A25', border: '1px solid #243140' }}>
                    <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>Customer Insight</p>
                    <p className="text-xs text-[#9FB0C3]" style={{ fontFamily: fontFamily.body }}>
                      {typeof marketAnalysis.customer_insight === 'string' ? marketAnalysis.customer_insight : JSON.stringify(marketAnalysis.customer_insight)}
                    </p>
                  </div>
                )}
                {marketAnalysis.revenue_opportunity && (
                  <div className="p-3 rounded-lg" style={{ background: '#10B98108', border: '1px solid #10B98120' }}>
                    <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#10B981', fontFamily: fontFamily.mono }}>Revenue Opportunity</p>
                    <p className="text-xs text-[#9FB0C3]" style={{ fontFamily: fontFamily.body }}>
                      {typeof marketAnalysis.revenue_opportunity === 'string' ? marketAnalysis.revenue_opportunity : JSON.stringify(marketAnalysis.revenue_opportunity)}
                    </p>
                  </div>
                )}
                {Array.isArray(marketAnalysis.recommendations) && marketAnalysis.recommendations.length > 0 && (
                  <div className="p-3 rounded-lg" style={{ background: '#10B98108', border: '1px solid #10B98120' }}>
                    <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#10B981', fontFamily: fontFamily.mono }}>Recommendations</p>
                    <ul className="space-y-1">
                      {marketAnalysis.recommendations.map((rec, idx) => (
                        <li key={idx} className="text-xs text-[#9FB0C3]" style={{ fontFamily: fontFamily.body }}>• {typeof rec === 'string' ? rec : (rec?.text || rec?.recommendation || JSON.stringify(rec))}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {Array.isArray(marketAnalysis.risks_to_watch) && marketAnalysis.risks_to_watch.length > 0 && (
                  <div className="p-3 rounded-lg" style={{ background: '#EF444408', border: '1px solid #EF444420' }}>
                    <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#EF4444', fontFamily: fontFamily.mono }}>Risks to Watch</p>
                    <ul className="space-y-1">
                      {marketAnalysis.risks_to_watch.map((risk, idx) => (
                        <li key={idx} className="text-xs text-[#9FB0C3]" style={{ fontFamily: fontFamily.body }}>• {typeof risk === 'string' ? risk : (risk?.text || risk?.risk || JSON.stringify(risk))}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {marketAnalysis.swot && typeof marketAnalysis.swot === 'object' && Object.keys(marketAnalysis.swot).length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>Market SWOT</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {['strengths', 'weaknesses', 'opportunities', 'threats'].map((k) => (
                        Array.isArray(marketAnalysis.swot[k]) && marketAnalysis.swot[k].length > 0 && (
                          <div key={k} className="p-2 rounded-lg" style={{ background: '#111A25', border: '1px solid #243140' }}>
                            <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>{k}</p>
                            <ul className="space-y-0.5">
                              {marketAnalysis.swot[k].map((item, idx) => (
                                <li key={idx} className="text-[11px] text-[#9FB0C3]" style={{ fontFamily: fontFamily.body }}>• {typeof item === 'string' ? item : JSON.stringify(item)}</li>
                              ))}
                            </ul>
                          </div>
                        )
                      ))}
                    </div>
                  </div>
                )}
                {marketAnalysis.data_quality_note && (
                  <p className="text-[11px] text-[#64748B] mt-2" style={{ fontFamily: fontFamily.mono }}>
                    Data quality: {marketAnalysis.data_quality_note}
                  </p>
                )}
              </div>
            )}

            {marketEvidence.length > 0 && (
              <div className="mt-3">
                <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>Market Evidence Signals</p>
                <div className="space-y-1">
                  {marketEvidence.map((ev, idx) => (
                    <p key={idx} className="text-xs text-[#9FB0C3]" style={{ fontFamily: fontFamily.body }}>
                      • {typeof ev === 'string' ? ev : (ev?.text || ev?.signal || ev?.description || JSON.stringify(ev))}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {!marketAnalysis && marketIntelScore === null && marketEvidence.length === 0 && (
              <p className="text-xs text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>Insufficient verified data for market intelligence analysis.</p>
            )}
          </div>
        )}

        {Object.keys(fieldProvenance).length > 0 && (
          <div className="rounded-xl p-5" style={{ background: 'var(--biqc-bg-card)', border: '1px solid #3B82F620', animation: 'cmsFade 1.55s ease-out' }} data-testid="data-provenance">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-4 h-4" style={{ color: '#3B82F6' }} />
              <h2 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>Data Provenance</h2>
            </div>
            <div className="space-y-1.5">
              {Object.entries(fieldProvenance).slice(0, 12).map(([field, meta]) => (
                <p key={field} className="text-xs text-[#9FB0C3]" style={{ fontFamily: fontFamily.body }}>
                  {field} -> {meta?.source_fn || 'unknown-source'} (confidence: {typeof meta?.confidence === 'number' ? Math.round(meta.confidence * 100) : 'n/a'}%)
                </p>
              ))}
            </div>
          </div>
        )}

        {(marketIntelScore !== null || analysisGaps.length > 0) && (
          <div className="rounded-xl p-5" style={{ background: 'var(--biqc-bg-card)', border: '1px solid #F59E0B30', animation: 'cmsFade 1.58s ease-out' }} data-testid="intelligence-quality">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4" style={{ color: '#F59E0B' }} />
              <h2 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>Intelligence Quality & Gaps</h2>
            </div>
            {marketIntelScore !== null && (
              <p className="text-xs text-[#9FB0C3] mb-2" style={{ fontFamily: fontFamily.body }}>
                Market intelligence score: <span className="text-[#F4F7FA]">{marketIntelScore}/100</span>{marketTrajectory ? ` (${marketTrajectory})` : ''}.
              </p>
            )}
            {analysisGaps.length > 0 ? (
              <div className="space-y-1.5">
                {analysisGaps.slice(0, 6).map((gap, idx) => (
                  <p key={idx} className="text-xs text-[#9FB0C3]" style={{ fontFamily: fontFamily.body }}>
                    - {gap}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#9FB0C3]" style={{ fontFamily: fontFamily.body }}>
                No critical public-data gaps detected in this scan cycle.
              </p>
            )}
          </div>
        )}

        {Array.isArray(full._trace) && full._trace.length > 0 && (
          <div className="rounded-xl p-5" style={{ background: 'var(--biqc-bg-card)', border: '1px solid #243140', animation: 'cmsFade 1.57s ease-out' }} data-testid="scan-observability">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4" style={{ color: '#FF6A00' }} />
              <h2 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>Scan Observability</h2>
            </div>
            <div className="space-y-1.5">
              {full._trace.slice(-8).map((t, idx) => (
                <p key={`${t.step}-${idx}`} className="text-xs text-[#9FB0C3]" style={{ fontFamily: fontFamily.body }}>
                  {t.step} -> {t.function} ({t.ok ? 'ok' : 'failed'}) {t.request_id ? ` [${t.request_id}]` : ''}
                </p>
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
                text: 'Add measurable social proof — specific client results with company name, outcome, and timeframe. Named case studies consistently outperform generic testimonials.',
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
