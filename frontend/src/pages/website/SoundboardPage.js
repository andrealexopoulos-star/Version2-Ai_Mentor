import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import WebsiteLayout from '../../components/website/WebsiteLayout';
import { ArrowRight, Briefcase, BarChart3, Zap, Shield, Users, Search, ChevronRight, Radio, Mic } from 'lucide-react';
import { fontFamily } from '../../design-system/tokens';

// â"€â"€â"€ Mode definitions â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

const MODES = [
  {
    id: 'boardroom',
    label: 'Boardroom',
    icon: Briefcase,
    color: '#C65F2E',
    glow: 'rgba(198,95,46,0.15)',
    tagline: 'Five AI agents. One strategic verdict.',
    description: 'CEO, Finance, Sales, Ops, and Risk agents analyse your business simultaneously and deliver a unified strategic recommendation.',
    badge: 'MULTI-AGENT',
  },
  {
    id: 'strategic',
    label: 'Strategic',
    icon: BarChart3,
    color: '#3B82F6',
    glow: 'rgba(59,130,246,0.15)',
    tagline: 'Long-range thinking for your business.',
    description: 'Evaluate market opportunities, competitive positioning, and 12-month growth strategies calibrated to your exact business.',
    badge: 'GROWTH',
  },
  {
    id: 'finance',
    label: 'Finance',
    icon: Zap,
    color: '#10B981',
    glow: 'rgba(16,185,129,0.15)',
    tagline: 'Sharp financial clarity in seconds.',
    description: 'Cash flow analysis, margin pressure detection, runway modelling, and cost optimisation â€" all grounded in your live data.',
    badge: 'FINANCIAL',
  },
  {
    id: 'operations',
    label: 'Operations',
    icon: Users,
    color: '#8B5CF6',
    glow: 'rgba(139,92,246,0.15)',
    tagline: 'Fix execution before it breaks delivery.',
    description: 'Staff utilisation, SOP compliance, delivery timelines, and bottleneck detection â€" answered in plain language.',
    badge: 'EXECUTION',
  },
  {
    id: 'risk',
    label: 'Risk & Compliance',
    icon: Shield,
    color: '#EF4444',
    glow: 'rgba(239,68,68,0.15)',
    tagline: 'Know your risks before they surface.',
    description: 'Regulatory deadlines, policy gaps, SLA breaches, and compliance exposure â€" detected and explained with clear actions.',
    badge: 'RISK',
  },
];

// â"€â"€â"€ Example conversations (10+ per mode) â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

const EXAMPLES = {
  boardroom: [
    { q: 'A competitor just cut pricing by 12%. Should we respond this week?', a: 'CEO: Hold on a reactive cut â€" you\u2019ll compress margins without guaranteeing retention.\nFinance: Margin is currently at 34%. A 12% price drop brings it to ~22%, which is below your operating floor.\nSales: 3 at-risk accounts flagged. A targeted retention offer to those accounts is lower-cost than a broad price cut.\nOps: Delivery capacity is at 91% â€" protecting margin matters more than volume right now.\nVerdict: Hold headline price. Launch a targeted retention micro-offer for the 3 at-risk accounts. Review competitor churn data in 72 hours before any broader move.' },
    { q: 'Q3 revenue is 18% below target. What is our fastest recovery move?', a: 'CEO: Two paths â€" accelerate pipeline or cut costs. Given lead time on new deals, pipeline is the lever.\nSales: 3 proposals stalled at >7 days. Deal Beta and Alpha are the highest weighted value. Prioritise manager-led close push this week.\nFinance: $45K gap. Collecting Invoice #1847 ($3,200) and stalled receivables ($9,400) covers 28% of the shortfall immediately.\nOps: don\u2019t sacrifice delivery quality chasing volume â€" one client complaint right now costs more than it saves.\nVerdict: Activate close push on top 3 stalled deals. Collect overdue invoices this week. Reassess forecast by Friday.' },
    { q: 'Should we make an offer to a key staff member who is showing signs of leaving?', a: 'CEO: Retaining a high performer is almost always cheaper than replacing them â€" replacement cost is typically 1.5â€"2Ã— salary.\nOps: Utilisation data shows this person is carrying 127% of average load. Burnout risk is real and may be the root cause.\nFinance: If fully loaded salary is $95K, a 10â€"15% retention offer costs $9,500â€"$14,250 â€" well below replacement cost.\nRisk: Losing this role creates an SPOF in delivery. 3 client accounts depend directly on this individual.\nVerdict: Make the retention offer. But pair it with a workload review â€" address the root cause, not just the symptom.' },
    { q: 'We have $80K cash available. Should we hire, invest in marketing, or hold reserves?', a: 'CEO: With 4.2 months of runway, holding a buffer is prudent before committing to ongoing costs.\nFinance: A new hire adds $7â€"12K/month in fixed costs. That reduces runway by 1.5â€"2 months. Marketing spend is variable â€" easier to pause.\nSales: Pipeline is healthy but conversion is slow. Marketing spend on re-targeting warm prospects is highest ROI right now.\nOps: Current team is at 91% capacity â€" adding a hire without fixing process bottlenecks won\u2019t fully solve the output problem.\nVerdict: Allocate $15K to targeted marketing (warm pipeline), keep $65K in reserve. Reassess hiring in 60 days.' },
    { q: 'Two clients represent 60% of our revenue. Is this a problem?', a: 'CEO: Yes â€" this is a concentration risk that warrants immediate diversification action.\nFinance: If either account reduces spend by 30%, revenue drops by 18%. Your break-even point becomes very tight.\nSales: Pipeline diversification should target mid-market clients with $25â€"50K ARR potential. 3 warm leads match that profile now.\nRisk: No written renewal agreements detected for either account. Verbal agreements create legal and financial exposure.\nVerdict: Formalise renewal agreements with both accounts this month. Run 60-day pipeline push to add 3+ new mid-market clients.' },
    { q: 'Should we launch a new service line in Q4?', a: 'CEO: The timing question hinges on capacity and capital â€" both are tight right now.\nOps: Team utilisation is at 91%. Adding a new service line without dedicated resources risks quality degradation on existing clients.\nFinance: New service lines typically take 3â€"6 months to become cash-flow positive. Q4 cash position doesn\u2019t support that runway comfortably.\nSales: Market signal shows demand for the new service â€" but test it with 5â€"10 clients before full launch to validate margin.\nVerdict: Run a 45-day limited pilot with 5 clients. Measure margin and delivery load before committing to a full Q4 launch.' },
    { q: 'Our biggest client just asked for a 15% discount to renew. What do we do?', a: 'CEO: don\u2019t reflexively agree â€" understand what\u2019s driving the request before responding.\nSales: Engagement data shows no decline in usage or satisfaction. The request may be a procurement tactic, not a genuine budget constraint.\nFinance: A 15% discount on a $120K account costs $18K/year. If margin on this account is 38%, you\u2019re giving back nearly half the profit.\nOps: Offering enhanced service delivery or additional integrations as a counter has higher perceived value than a discount.\nVerdict: Counter with a value-add (priority support, additional user seats) rather than a price cut. Escalate to decision-maker if procurement is gatekeeping.' },
    { q: 'Is now the right time to raise prices?', a: 'CEO: Market signals and cost pressure both suggest yes â€" but execution timing matters.\nFinance: Input costs are up 9% YTD. Margins have compressed from 38% to 34%. Pricing needs to recover ground.\nSales: Competitor B raised prices 8% last month with no visible churn. Market has more tolerance than expected.\nOps: Grandfathering existing clients for 90 days is standard practice and reduces churn risk during the transition.\nVerdict: Increase prices 8â€"10% for new clients immediately. Notify existing clients with 60-day notice and a grandfather period of 90 days.' },
    { q: 'We have a major proposal going to a new client next week. How do we improve our close rate?', a: 'CEO: Win rate on proposals over $50K is currently 28%. Industry benchmark is 42%. There are specific gaps to fix.\nSales: Proposals that include a video walkthrough close at 2.1Ã— the rate of PDF-only proposals. Add a Loom or live demo component.\nFinance: Offer milestone billing (50/25/25) rather than upfront â€" reduces perceived risk for the client.\nOps: Include a specific implementation timeline with named milestones â€" clients associate it with reduced delivery risk.\nVerdict: Add video walkthrough, milestone billing structure, and a named delivery timeline. Brief the account manager on objection handling for the pricing discussion.' },
    { q: 'Key clients are asking about AI in our service. How should we respond?', a: 'CEO: This is a trust and differentiation moment â€" handle it deliberately.\nSales: 73% of enterprise buyers now evaluate AI capability before signing. A clear, transparent answer builds confidence.\nOps: You currently use AI for internal analysis and quality checks â€" this is responsible use that can be disclosed with confidence.\nRisk: Avoid overpromising AI capability in client-facing materials. Ensure any AI output is human-reviewed before delivery.\nVerdict: Develop a 1-page "How We Use AI" statement. Lead with transparency â€" what AI assists with, what humans review, and how client data is protected.' },
    { q: 'Staff are reporting feeling overloaded. What should leadership prioritise this week?', a: 'CEO: Overload signals often precede delivery failures and attrition. Act before it compounds.\nOps: Utilisation data shows 3 team members above 120% load. Two projects have overlapping deadlines this week.\nFinance: The cost of one error-driven client complaint or one resignation far exceeds the cost of pausing a low-priority project.\nRisk: SPOF alert â€" if either over-capacity team member is unavailable, delivery on Key Account #1 is at risk.\nVerdict: Stop or defer 2 low-priority internal projects this week. Redistribute 1 deliverable from the top 2 overloaded staff. Hold a 30-minute team reset by Wednesday.' },
    { q: 'Should we expand to a second city?', a: 'CEO: Geographic expansion works when your core market unit economics are proven and repeatable. let\u2019s check.\nFinance: Current market margin is 34%. Expansion typically depresses margin by 8â€"15% in the first year due to setup costs and lower utilisation.\nSales: Demand signals show inbound inquiry from the target city, but volume is unvalidated. Run a 60-day digital demand test before committing.\nOps: Remote delivery capability isn\u2019t fully documented. Expanding geography before SOPs are repeatable multiplies operational risk.\nVerdict: Run a 60-day demand validation campaign in the target city. Commit only if inbound demand validates a 12-month pipeline of $200K+.' },
  ],

  strategic: [
    { q: 'What should our 12-month growth focus be?', a: 'Based on your current market position, pipeline data, and competitive landscape, the three highest-leverage growth moves are:\n\n1. Increase average deal size â€" your win rate on $25â€"50K contracts is 3Ã— higher than sub-$10K deals. Repositioning messaging toward mid-market could lift revenue 22% without adding volume.\n\n2. Improve renewal rate â€" current renewal rate is estimated at 76%. Moving to 88% (industry median) adds $34K ARR without any new sales.\n\n3. Develop a second service line â€" market signals show strong demand in an adjacent category where you have existing capability.\n\nRecommendation: Focus on renewal optimisation in Q1, deal size repositioning in Q2, and pilot the second service in Q3.' },
    { q: 'Should we target enterprise clients or stay in the SMB market?', a: 'Enterprise is attractive but the switching cost is high â€" here is the honest analysis:\n\nSMB (current): Lower ACV, faster sales cycle, higher volume. Your operations are tuned for this. Margin is 34%.\n\nEnterprise: ACV 4â€"6Ã— higher, but sales cycles are 6â€"9 months, procurement is complex, and delivery requirements are significantly higher. You would need a dedicated enterprise sales motion.\n\nYour current capacity: 91% utilised. Moving upmarket without capacity investment creates delivery risk.\n\nRecommendation: Add 2â€"3 enterprise clients as a controlled pilot over 12 months. don\u2019t restructure for enterprise until you have 5 clients and can model the delivery requirements accurately.' },
    { q: 'How do we create a defensible competitive moat?', a: 'Three moat-building strategies matched to your current position:\n\n1. Data depth moat â€" the longer clients use BIQc, the more valuable the personalisation becomes. Encourage deeper integrations (payroll, HR) to increase switching cost.\n\n2. Relationship moat â€" your NPS and retention are above average for the category. Formalise client success touchpoints to make the relationship harder to leave.\n\n3. Speed moat â€" calibration-to-insight time of 48 hours is a differentiator. Document and market this explicitly.\n\nMost defensible combination: deepen integration hooks (data moat) + formalise client success programme (relationship moat). Both are implementable in 90 days.' },
    { q: 'What are the three biggest strategic risks we are ignoring?', a: '1. Revenue concentration â€" 60% of revenue from 2 clients with no written renewal agreements. A single non-renewal creates a survival event.\n\n2. Capacity ceiling â€" at 91% utilisation, any growth initiative competes directly with delivery quality. You are one key resignation away from a delivery failure.\n\n3. No documented IP â€" if your key operators left, what proprietary methodology or process would remain? Competitors can replicate undocumented delivery.\n\nPriority action: Address revenue concentration risk first â€" it has the highest probability of materialising and the most severe downside.' },
    { q: 'We want to build a referral programme. Where do we start?', a: 'Start with the clients most likely to refer â€" not the biggest, but the most engaged.\n\nStep 1: Identify your top 5 promoters â€" look at email response rates, renewal history, and direct positive feedback.\n\nStep 2: Offer a simple incentive â€" a service credit or fee reduction is more effective than cash for B2B referrals. 15â€"20% off next month is the benchmark.\n\nStep 3: Make the referral frictionless â€" a single-line email template they can forward takes 30 seconds. don\u2019t ask them to fill in a form.\n\nExpected outcome: A well-targeted referral programme with 5 promoters typically generates 1â€"3 qualified leads in the first 90 days. At your average deal size, that is $25â€"75K pipeline.' },
    { q: 'How do we compete against a new well-funded competitor?', a: 'Funded competitors have a predictable playbook â€" and it has exploitable weaknesses:\n\nTheir likely moves: aggressive pricing, high marketing spend, rapid feature announcements, poaching talent.\n\nYour advantages: Client relationships (they cannot replicate yours overnight), delivery reputation, speed of personalisation.\n\nDefensive plays:\nâ€¢ Secure renewals early â€" lock in existing clients with 12â€"24 month agreements before the competitor reaches them.\nâ€¢ Lean into your Australian sovereignty and data privacy positioning â€" a well-funded overseas competitor will struggle here.\nâ€¢ Accelerate your onboarding differentiation â€" time-to-value is where new entrants are weakest.\n\nDo not compete on price. Compete on depth of relationship and trust.' },
    { q: 'Should we productise what we do to enable self-serve sales?', a: 'Productisation makes sense when three conditions are met: your delivery is repeatable, your clients are self-sufficient post-onboarding, and acquisition cost of self-serve is lower than sales-assisted. Let\'s check:\n\nRepeatability: Your calibration process is 9 steps â€" partially documented, but not fully self-serve ready. This needs 60 days of work.\n\nSelf-sufficiency: Current client success data suggests 40% of clients need hand-holding in month 1â€"2. Too high for pure self-serve.\n\nAcquisition cost: Self-serve typically requires significant content/SEO investment to generate organic volume.\n\nVerdict: Build a self-serve motion for the bottom 20% of deal size (<$5K ACV). Keep human-assisted onboarding for everything above that. Revisit when repeatability score is >90%.' },
    { q: 'What is our positioning statement for the next 12 months?', a: 'Based on your business data, competitive landscape, and client feedback, here is a positioning statement for the next 12 months:\n\n"For Australian SMB owners who are making growth decisions without complete information â€" BIQc is the AI business intelligence platform that turns your disconnected business systems into a single, live strategic picture. Unlike generic BI dashboards, BIQc understands your specific business, monitors risk before it surfaces, and delivers a daily executive briefing that helps you decide faster and lead with confidence."\n\nKey differentiation pillars to lead with:\nâ€¢ Australian owned and data-sovereign\nâ€¢ Personalised to your business (not generic templates)\nâ€¢ Proactive intelligence (not reactive reporting)\nâ€¢ Executive-grade insight at SMB cost' },
    { q: 'How do we increase our average contract value without losing deals?', a: 'Three ACV-uplift strategies with the lowest deal-risk:\n\n1. Tiered onboarding â€" offer a premium onboarding tier ($2,500â€"5,000) that includes a 2-hour calibration session and 30-day dedicated support. 30â€"40% of clients will upgrade when it is framed as "faster time to value."\n\n2. Seat expansion â€" if your product supports multi-seat, identify accounts with multiple stakeholders and offer a team licence. Average uplift is 35%.\n\n3. Annual billing discount â€" clients who commit annually typically pay 10â€"15% less but your ACV increases because you capture the full year upfront. Cash flow improves significantly.\n\nStart with annual billing conversion â€" it is the easiest to implement and has no delivery cost.' },
    { q: 'How do we build a category in the market rather than just selling a product?', a: 'Category creation is a 3â€"5 year play, but you can start building the narrative now:\n\nName the category: "Cognition-as-a-Service" or "AI Business Intelligence for SMBs" â€" give it a label competitors can\'t easily own.\n\nEducate before selling: Publish content about the problem (disconnected tools, reactive decision-making, executive blind spots) before mentioning BIQc. Category creators teach the market what to want.\n\nOwn the language: Phrases like "intelligence briefing," "business health score," and "silent killers" become associated with BIQc when used consistently across all channels.\n\nPartner with credibility anchors: Australian accounting firms, business coaches, and industry associations give the category legitimacy.\n\nExpected timeline: 12 months to establish the language, 24 months to see inbound category demand.' },
  ],

  finance: [
    { q: 'Where are we leaking margin right now?', a: 'Three active margin leaks detected from your connected data:\n\n1. Subcontractor cost creep â€" subcontractor spend is up 12% over 45 days with no corresponding revenue increase. This is compressing gross margin by approximately 1.8 percentage points.\n\n2. Underutilised licence fees â€" 4 SaaS tools show zero activity in the last 30 days. Estimated cost: $340/month. No evidence of value generation.\n\n3. Overtime accumulation â€" staff overtime is 15% above target this month, adding approximately $2,800 in payroll cost above plan.\n\nCombined annual impact: ~$68K. Addressing all three over 60 days would recover 2.4 percentage points of margin.' },
    { q: 'Is our cash runway healthy enough to hire a new account manager?', a: 'Current runway: 4.2 months at current burn rate.\n\nIf you add a fully-loaded account manager at $7,500/month, runway drops to approximately 3.1 months â€" which is below the 4-month minimum I would recommend before making a fixed-cost commitment.\n\nHowever, if the account manager generates revenue within 90 days (which requires a strong pipeline hand-off), payback period is achievable.\n\nRecommendation: Do not hire in the next 30 days. First, collect the $12,400 in overdue receivables, which would restore runway to 5.1 months. Then revisit the hire decision from a stronger cash position.' },
    { q: 'Which clients are most profitable and which are costing us money?', a: 'Based on your available data, here is the profitability breakdown:\n\nHigh margin (>40% estimated): Key Account #1, Client B, Client D â€" long-term, low-touch, high repeat value. Protect these aggressively.\n\nMedium margin (25â€"40%): 4 clients in the mid-market tier. Healthy but require active account management to prevent churn.\n\nBelow target margin (<25%): 2 clients flagged â€" delivery time exceeds quoted scope, and one requires disproportionate support hours.\n\nAction: For the below-target clients, either reprice at next renewal or reduce scope. Do not continue absorbing delivery cost without adjustment.' },
    { q: 'We have three invoices more than 30 days overdue. What is the best approach?', a: 'Invoice #1847 ($3,200 â€" 12 days): Escalate immediately. Client #47 has a history of late payment â€" a phone call outperforms email by 3Ã— for this profile. Send a formal notice today.\n\nInvoice #1831 ($4,700 â€" 22 days): This is a relationship-sensitive account. Use a soft tone â€" frame it as an "accounts reconciliation" check rather than a collections call.\n\nInvoice #1819 ($2,500 â€" 31 days): This invoice is approaching the point where external debt recovery becomes relevant. Send a final notice with a 5-day deadline before escalating to a collections letter.\n\nTotal outstanding: $10,400. Collecting all three this week restores 2.1 months of breathing room in receivables ageing.' },
    { q: 'Should we offer early payment discounts to improve cash flow?', a: 'Early payment discounts (2/10 net 30 â€" 2% discount if paid within 10 days) are effective when your cost of capital exceeds 2%. At your current runway position, the answer is yes â€" marginally.\n\nCost: Offering 2% early payment discount on $120K of annual receivables costs ~$2,400/year.\nBenefit: If 40% of clients take it, you recover approximately $48K of receivables 20 days earlier. That is meaningful given your 4.2-month runway.\n\nRecommendation: Offer the discount to your top 5 accounts by invoice value for the next 90 days. Measure take-up rate. If >30% take it, consider making it standard.' },
    { q: 'Our expenses are growing faster than revenue. What do we cut first?', a: 'Revenue growth: +6% last quarter. Expense growth: +14% last quarter. The gap is unsustainable within 2 quarters at this rate.\n\nImmediate cuts (low impact, fast execution):\nâ€¢ Unused SaaS tools: $340/month (confirmed zero usage, cancel today)\nâ€¢ Paused advertising campaigns returning <1Ã— ROAS: Estimated $800/month\n\nMedium-term review (60 days):\nâ€¢ Subcontractor costs: Up 12% â€" negotiate fixed-rate agreements to cap future increases\nâ€¢ Overtime: Policy enforcement reduces this by 40â€"60% within 30 days\n\nProtect: Delivery capacity, client-facing tools, and compliance software. Cutting these creates downstream risk.\n\nProjected savings: $1,500â€"2,500/month from immediate cuts, $3,000â€"5,000/month from medium-term actions.' },
    { q: 'What is the impact on profit if we win the two largest proposals?', a: 'Deal Beta ($45K) + Deal Alpha ($28K) = $73K new contract value.\n\nAssuming your current gross margin of 34%:\nâ€¢ Gross profit contribution: ~$24,800\nâ€¢ Less delivery cost above 91% utilisation: You\'ll need contractor support to deliver. Estimated additional cost: $6,500\nâ€¢ Net profit contribution: ~$18,300\n\nCash flow timing: If both are milestone-billed, first payment would arrive in approximately 45 days. That extends runway by 1.8 months.\n\nBottom line: Winning both deals significantly improves your financial position. Prioritise these above any other sales activity this week.' },
    { q: 'How do we reduce our reliance on a single revenue source?', a: 'Revenue concentration risk is your highest financial risk right now. Here is a 90-day diversification plan:\n\nMonth 1: Identify 5 warm prospects in a different industry segment. Activate outreach. Goal: 2 discovery calls.\n\nMonth 2: Close at least 1 new client in a segment where you currently have zero revenue. Even a small contract ($5â€"10K) reduces concentration.\n\nMonth 3: Formalise written renewal agreements with your top 2 accounts. Concentration risk is much lower when renewals are contractually secured.\n\nFinancial target: Move from 60% concentration in top 2 clients to <45% over 6 months. That is a meaningful reduction in fragility.' },
    { q: 'Is our pricing model right for our margin targets?', a: 'Your current average project margin is 34%. Your stated target is 40%. The gap comes from two structural issues:\n\n1. Scope creep absorption â€" approximately 22% of projects exceed quoted hours, and most of the overage is not billed. This costs you 4â€"6 margin points per affected project.\n\n2. Pricing below market â€" your average rate is 8â€"12% below the market median for comparable services in your segment based on competitor intelligence.\n\nFix 1: Introduce a change order process for scope expansions >10%. Bill changes at your standard rate.\nFix 2: Increase rates for new clients by 10% immediately. Grandfather existing clients at renewal.\n\nProjected impact: +6 margin points over 12 months if both changes are implemented.' },
    { q: 'What would happen to our business if we lost our top client tomorrow?', a: 'Current dependency: Top client represents approximately 35% of monthly revenue.\n\nImmediate impact (month 1): Revenue drops by 35%. At current fixed costs, you move from a profitable position to burning $8,400/month.\n\nRunway impact: Existing 4.2-month runway collapses to 2.1 months â€" not enough time to replace the revenue through normal sales cycle.\n\nSurvival actions required within 30 days:\nâ€¢ Draw on credit facility if available\nâ€¢ Defer all non-essential spend immediately\nâ€¢ Activate emergency pipeline push â€" every warm prospect needs contact this week\n\nRecommendation: This scenario needs to be stress-tested and mitigated now, not after it happens. Securing a 12-month written agreement with this client is the single highest-value action you can take this quarter.' },
  ],

  operations: [
    { q: 'Which team member is closest to burnout?', a: 'Based on utilisation and overtime data:\n\n1. Jordan P â€" 127% of average load, 52 hours logged this week. Flagged for 3 consecutive weeks of >110% utilisation. Highest burnout risk.\n\n2. Sam K â€" 118% load, carrying delivery for two simultaneous projects with overlapping deadlines this week. Second highest risk.\n\nContributing factors: Both are working on Key Account #1 delivery AND a new client onboarding simultaneously. No one below 100% utilisation has been identified as able to absorb work from either.\n\nImmediate action: Defer 1 internal project for 2 weeks. Redistribute 1 client deliverable from Jordan to a capacity review with the wider team today.' },
    { q: 'Our delivery on a major client slipped 3 days. What is the impact?', a: 'A 3-day slip on Key Account #1 has the following business impact:\n\nClient risk: This client has flagged timeline sensitivity in previous communication. A 3-day slip without proactive communication raises churn probability from 18% to 34%.\n\nContractual: No SLA penalty clause detected in the available documents â€" but reputational impact is real.\n\nCascade risk: 2 downstream tasks for other clients depend on resources freed by this delivery. A 3-day slip cascades to a 5-day delay on the next project.\n\nRecommendation: Contact the client today with a proactive update and revised timeline â€" do not wait for them to ask. Clients who receive proactive communication on delays have 2.3Ã— better retention than those who discover it themselves.' },
    { q: 'How do I know if my team is actually following our SOPs?', a: 'SOP compliance data from your connected systems shows:\n\nEmail response SOP (4-hour rule): 61% compliance this month. 3 leads were not contacted within the required window.\n\nInvoice follow-up SOP (7-day rule): 78% compliance. Invoice #1847 has been outstanding 12 days without the escalation step being triggered.\n\nOnboarding checklist: No digital completion data available â€" this SOP is not tracked in any connected system.\n\nRecommendation: The fastest improvement is to add the onboarding checklist to HubSpot as a tracked task sequence â€" it gives you compliance visibility without process change. The email response SOP needs a daily stand-up reminder added to the team calendar.' },
    { q: 'We are onboarding 2 new clients at the same time. Can we handle it?', a: 'Current capacity: 91% utilised across the delivery team.\n\nOnboarding 2 new clients simultaneously will require approximately 60â€"80 hours of onboarding effort over the next 3 weeks.\n\nAt 91% current utilisation, there is no unallocated capacity. Taking on both clients means:\nâ€¢ Existing client delivery will be deprioritised â€" delay risk on at least 2 current projects\nâ€¢ Onboarding quality for both new clients will be compromised by divided attention\n\nOptions:\n1. Stagger onboarding â€" start Client A, begin Client B in 3 weeks\n2. Bring in a contractor for onboarding support ($3,500 estimated cost)\n3. Accept the delivery risk and monitor daily\n\nRecommendation: Stagger or use contractor support. Compromised onboarding is the single fastest path to early churn.' },
    { q: 'How do I fix a bottleneck that is slowing down our delivery?', a: 'The most common bottleneck pattern I detect in your operation:\n\nSingle point of failure: One team member is the sole approver or technical resource for 3 different workflows. Any absence or overload stops all three.\n\nTo identify your specific bottleneck:\nâ€¢ Which tasks in your pipeline have the longest waiting time before they start?\nâ€¢ Which team member\'s capacity most frequently appears as the constraint?\n\nOnce identified, the fix is almost always one of:\n1. Document and delegate â€" if only one person can do it, they need to train a backup\n2. Automate the trigger â€" if waiting for a human approval, can that approval be automated with a rule?\n3. Batch the work â€" if the bottleneck is task-switching, dedicate 2-hour blocks instead of responding on demand\n\nWhich workflow would you like me to analyse in more detail?' },
    { q: 'Staff performance has dropped. What should I investigate first?', a: 'When performance drops across a team (rather than one individual), the root cause is almost always systemic, not motivational. Investigate in this order:\n\n1. Workload distribution â€" is the drop correlated with a period of high utilisation? Burnout depresses output before it triggers visible complaints.\n\n2. Process clarity â€" have SOPs changed recently, or is there ambiguity about who owns what after a recent reorganisation?\n\n3. Tool friction â€" has any software been changed or broken? Tool friction is invisible in output data but devastating to morale.\n\n4. Management bandwidth â€" if a manager is overloaded, their team loses direction and prioritisation support.\n\nRecommendation: Hold a 20-minute anonymous team pulse check this week. Ask one question: "What is the biggest thing slowing you down right now?" The answers will tell you more than any metric.' },
    { q: 'How do I improve our client onboarding to reduce early churn?', a: 'Early churn (months 1â€"3) is almost always caused by one of three things: unmet expectations, slow time-to-value, or lack of a clear success owner.\n\nFix 1: Expectation setting â€" send a one-page "What to Expect in Your First 30 Days" document at contract signing. Clients with documented expectations churn at half the rate.\n\nFix 2: Time-to-value â€" identify the single fastest win you can deliver in the first week. Celebrate it with the client explicitly. This "quick win" anchors the relationship.\n\nFix 3: Success ownership â€" assign one named person as the client\'s point of contact for the first 90 days. Faceless onboarding has 3Ã— the early churn rate.\n\nMeasurable target: Reduce 30-day churn rate to <5% within 2 quarters using these three changes.' },
    { q: 'We need to hire but cannot afford a full-time employee. What are our options?', a: 'Four options ranked by cost and flexibility:\n\n1. Part-time contractor (most flexible): $50â€"80/hour, no fixed cost, skills match exactly to need. Best for specialist skills you need irregularly.\n\n2. Fractional employee (good middle ground): Shared across 2â€"3 businesses, typically 2 days/week. 40â€"60% of full-time cost. Works well for operations, finance, or marketing roles.\n\n3. Virtual assistant (lowest cost): $15â€"30/hour, offshore. Excellent for admin, scheduling, and repeatable tasks. Not suited to judgment-dependent work.\n\n4. Automation-first (no hire): Before hiring, identify which tasks could be automated. BIQc has flagged 3 recurring manual tasks that could be automated within 30 days â€" this alone could free up 6 hours/week.\n\nRecommendation: Start with automation review. Then hire a part-time contractor for the residual need.' },
    { q: 'How do I ensure quality when we are delivering at speed?', a: 'Quality under speed pressure requires structured checkpoints, not effort â€" here is the framework:\n\nBefore: Define "done" explicitly before starting. A clear definition of completion prevents scope ambiguity, which is the #1 source of quality errors under pressure.\n\nDuring: Use a 15-minute daily stand-up to surface blockers early. Problems caught in the first 20% of a project cost 10Ã— less to fix than those discovered at delivery.\n\nAfter: Run a 20-minute retrospective after every delivery. One question: "What would we do differently?" Capture the answer in a living SOP document.\n\nQuality kill switches: Always preserve time for a final human review â€" regardless of deadline pressure. Automated checks (spell, format, data validation) should run before anything leaves the team.\n\nTarget: <3% rework rate on delivered work. If you are above that, the retrospective data will show the root cause.' },
    { q: 'How do we scale delivery without compromising quality?', a: 'Scaling delivery quality has three phases:\n\nPhase 1 â€" Systematise (0â€"3 months): Document your top 10 most common delivery tasks as SOPs. Record a 5-minute Loom for each. This is the foundation â€" nothing scales without it.\n\nPhase 2 â€" Delegate (3â€"6 months): Identify which SOPs can be executed by a junior or lower-cost resource with supervision. Start transferring. Your senior capacity should move to judgment-only tasks.\n\nPhase 3 â€" Automate (6â€"12 months): Once SOPs are stable and executed by juniors, identify which steps can be automated or tooled. Automation of a documented SOP is reliable â€" automation of an undocumented process creates chaos.\n\nWarning: Do not skip Phase 1. The #1 scaling failure is delegating before systematising. The quality problems that result are harder to fix than the original bottleneck.' },
  ],

  risk: [
    { q: 'What is our biggest unmitigated risk right now?', a: 'Based on all connected data, your highest unmitigated risk is:\n\nRevenue concentration with no contractual protection.\n\nTwo clients represent 60% of monthly revenue. Neither has a written renewal agreement. If either account does not renew, you move from profitable to burning $8,400/month within 30 days â€" and your 4.2-month runway falls to 2.1 months before you can replace the revenue.\n\nThis risk is:\nâ€¢ High probability (unwritten agreements create ambiguity)\nâ€¢ High severity (survival-level financial impact)\nâ€¢ Immediately mitigable (a renewal agreement can be drafted and signed within 2 weeks)\n\nAction: Contact both accounts this week to initiate the renewal discussion. Frame it as a "partnership review" rather than a contract negotiation.' },
    { q: 'BAS Q3 is due in 18 days. Are we prepared?', a: 'BAS Q3 status check:\n\nDocumentation: No BAS preparation document detected in connected systems. This does not mean it hasn\'t been prepared â€" but it is not visible to BIQc.\n\nXero data: GST coding appears up to date as of last sync (2 minutes ago). Accounts receivable and payable are reconciled to date.\n\nAction required: Confirm with your accountant or bookkeeper that the BAS draft has been prepared and reviewed. If not started, 18 days is workable but leaves no buffer for corrections.\n\nCompliance note: Late BAS lodgement attracts ATO penalties from day 1. Given your current compliance score of 96%, this would be the only active gap. Do not let it slip.\n\nSuggested: Schedule a 30-minute bookkeeper call this week to confirm readiness.' },
    { q: 'Do we have any single points of failure in the business?', a: 'Three single points of failure detected:\n\n1. Key personnel SPOF: One team member is the sole owner of delivery for Key Account #1, your largest client. No documented handover process or backup capacity.\n\n2. Integration SPOF: Your Xero connection is the source of truth for all financial intelligence. If it disconnects, your cash flow and margin data becomes stale within 24 hours. No backup data pipeline.\n\n3. Sales SPOF: All new business is currently sourced through one channel (referrals). Zero inbound pipeline diversification â€" if referral flow stops, pipeline dries up immediately.\n\nPriority: Address SPOF #1 first â€" personnel SPOFs carry the highest probability of materialising and the most severe client impact.' },
    { q: 'Are our data privacy practices compliant with Australian law?', a: 'Privacy Act compliance assessment based on available information:\n\nStrengths:\nâ€¢ Data hosted in Australia â€" compliant with Australian Privacy Principles\nâ€¢ Sub-processor agreements in place for primary integrations\nâ€¢ AES-256 encryption at rest and TLS 1.3 in transit\n\nGaps detected:\nâ€¢ Staff privacy notice: Not found in connected documents. Employees must be notified of what data is collected and how it is used.\nâ€¢ Data retention policy: No documented policy found. APP 11 requires personal data to be destroyed or de-identified when no longer needed.\nâ€¢ Privacy policy review: Last reviewed date not detected â€" annual review is best practice.\n\nAction: Update staff privacy notice (1 day effort) and document data retention policy (2â€"3 hours). These two items move compliance from ~88% to ~97%.' },
    { q: 'What legal risks are we exposed to right now?', a: 'Active legal exposure detected across four areas:\n\n1. Contract risk: No written agreements detected for 2 major client relationships. Without contracts, scope disputes, IP ownership, and payment terms are unenforceable.\n\n2. Employment risk: Overtime data shows 3 staff members consistently above 45 hours/week. Sustained overwork without compensation creates Fair Work exposure.\n\n3. Privacy risk: Staff privacy notice is not up to date (see compliance report). This is a minor but real breach of the Privacy Act.\n\n4. IP risk: No IP assignment clauses detected in contractor agreements. Work product created by contractors may not legally belong to your company.\n\nHighest priority: Client contracts and contractor IP clauses. Both can be drafted with a 2-hour legal consultation â€" cost-effective relative to the risk.' },
    { q: 'A key staff member just resigned. What do we do in the next 72 hours?', a: 'First 72 hours â€" step by step:\n\nHour 1: Secure access. Change all shared passwords this person had access to. Revoke system access as soon as notice is received.\n\nDay 1: Identify the SPOF impact. Which clients, projects, and processes are dependent on this person? Map the dependency before anyone else knows.\n\nDay 1: Begin knowledge capture. A structured handover interview in the first 48 hours captures 3Ã— more institutional knowledge than documentation alone. Record it.\n\nDay 2: Communicate to affected clients proactively â€" before they notice a change in service quality. Clients informed by you stay. Clients who find out themselves leave.\n\nDay 3: Begin talent sourcing. Do not wait until the last day of notice period. Parallel-path â€" internal reallocation AND external search.\n\nDo not: Ask the resigning employee to stay in a role they are leaving. Do offer a consulting arrangement for knowledge transfer if the relationship is positive.' },
    { q: 'How do we protect ourselves if the economy slows down?', a: 'Recession-resilient positioning â€" five moves:\n\n1. Extend runway now: Target 6+ months of cash runway before conditions tighten. Collect outstanding receivables, reduce discretionary spend, defer non-essential hires.\n\n2. Lock in clients: Offer 10â€"15% discount for 12-month upfront payment. Cash now beats revenue later in a slowdown.\n\n3. Identify recession-resistant service lines: Which of your services are "must-have" rather than "nice-to-have" for clients? Double down on these. Pause investment in premium or discretionary offerings.\n\n4. Protect relationships: In a downturn, clients cut vendors they barely know. Increase touchpoint frequency with top 5 accounts starting now.\n\n5. Build a cost-flex model: Know exactly which costs you can cut within 30 days without impacting delivery. Having this plan ready means you can act immediately â€" not after 3 months of deliberation.' },
    { q: 'We have a disgruntled client threatening to leave. What is the risk?', a: 'Assess the risk on three dimensions:\n\nRevenue impact: What percentage of your monthly revenue does this client represent? If >15%, this is a survival-relevant risk.\n\nReferral network: High-visibility clients who leave unhappy have an outsized negative referral effect â€" particularly in tight B2B markets. One vocal departure can affect 3â€"5 future prospects.\n\nLegal exposure: Review your contract for service level commitments. If delivery fell short of documented SLAs, there may be a refund or credit obligation.\n\nImmediate action: Escalate to the most senior relationship holder in your business â€" not the account manager. Request a 30-minute call this week. Come with a specific remediation offer (service credit, additional support hours, priority access).\n\nDo not: Let this sit in email threads. Phone calls resolve client conflict 4Ã— faster than written communication.' },
    { q: 'What are the top risks to our business that we cannot currently see?', a: 'Blind spots â€" risks that exist but are not visible in your current data:\n\n1. Reputational risk: No review monitoring detected. If negative reviews appear on Google or industry forums, you have no early warning system. A single 1-star review in a niche market can affect 10â€"20% of inbound leads.\n\n2. Dependency risk (supplier): Your operations depend on 3 third-party tools. If any of them increase pricing by 30%+ or shut down, your delivery capacity is affected. No contingency plans detected.\n\n3. Regulatory change risk: Two regulatory changes relevant to your industry are expected in the next 12 months (data privacy amendments, employment law updates). No monitoring or response plan detected.\n\n4. Founder health risk: No business continuity plan detected. If the primary decision-maker is unavailable for 2+ weeks, who makes time-sensitive calls? Especially relevant for clients who deal directly with the founder.\n\nRecommendation: Add Google review alerts (15 minutes), and draft a 1-page business continuity plan (2 hours). Both are low-effort, high-protection actions.' },
    { q: 'How do we handle a data breach if one occurs?', a: 'Data breach response â€" first 24 hours:\n\nHour 1: Contain. Identify what was accessed and isolate the affected system. Do not delete logs â€" you will need them.\n\nHour 2: Assess. Determine whether personal information was involved. Under the Privacy Act (Notifiable Data Breaches scheme), breaches involving personal information that are likely to cause serious harm must be reported.\n\nHour 4: Notify your legal counsel and cyber insurance provider (if applicable) before making any public statements.\n\nHour 8: If notification is required, the NDB scheme gives you 72 hours to notify the OAIC after becoming aware of an eligible breach.\n\nPreparation (do now): Ensure you have a documented Incident Response Plan and know who your Data Protection contact is. This turns a chaotic event into a managed one. A 2-hour session to draft this plan is worth more than any security tool you could buy.' },
  ],
};

// â"€â"€â"€ Chat simulator â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

function ChatDisplay({ mode, example }) {
  const [displayedAnswer, setDisplayedAnswer] = useState('');
  const [done, setDone] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    setDisplayedAnswer('');
    setDone(false);
    const words = example.a.split(' ');
    let i = 0;
    const timer = setInterval(() => {
      if (i < words.length) {
        setDisplayedAnswer(p => p + (i === 0 ? '' : ' ') + words[i]);
        i++;
      } else {
        setDone(true);
        clearInterval(timer);
      }
    }, 18);
    return () => clearInterval(timer);
  }, [example]);

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [displayedAnswer]);

  return (
    <div ref={ref} style={{ display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto', maxHeight: 480, paddingRight: 4 }}>
      {/* User bubble */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ background: `${mode.color}22`, border: `1px solid ${mode.color}40`, borderRadius: '16px 16px 4px 16px', padding: '12px 16px', maxWidth: '78%', fontFamily: fontFamily.body, color: '#EDF1F7', fontSize: 14, lineHeight: 1.6 }}>
          {example.q}
        </div>
      </div>

      {/* BIQc typing indicator or answer */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: `${mode.color}20`, border: `1px solid ${mode.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <mode.icon size={14} style={{ color: mode.color }} />
        </div>
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px 16px 16px 16px', padding: '12px 16px', maxWidth: '85%', flex: 1 }}>
          <div style={{ fontFamily: fontFamily.mono, color: mode.color, fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Radio size={10} />
            BIQC Â· {mode.label.toUpperCase()} MODE
          </div>
          <div style={{ fontFamily: fontFamily.body, color: '#CBD5E1', fontSize: 14, lineHeight: 1.75, whiteSpace: 'pre-line' }}>
            {displayedAnswer}
            {!done && <span style={{ display: 'inline-block', width: 2, height: 14, background: mode.color, marginLeft: 2, animation: 'blink 0.8s step-end infinite', verticalAlign: 'middle' }} />}
          </div>
        </div>
      </div>
    </div>
  );
}

// â"€â"€â"€ Page â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

export default function SoundboardPage() {
  const [activeMode, setActiveMode] = useState(0);
  const [activeExample, setActiveExample] = useState(0);
  const [search, setSearch] = useState('');
  const mode = MODES[activeMode];
  const allExamples = EXAMPLES[mode.id] || [];
  const filtered = search
    ? allExamples.filter(e => e.q.toLowerCase().includes(search.toLowerCase()))
    : allExamples;
  const currentExample = filtered[activeExample] || filtered[0];

  return (
    <WebsiteLayout>
      <style>{`
        @keyframes blink { 0%,100% { opacity: 1 } 50% { opacity: 0 } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:translateY(0) } }
        .fade-up { animation: fadeUp 0.4s ease both; }
        .ex-item:hover { background: rgba(255,255,255,0.06) !important; }
        .mode-tab:hover { border-color: rgba(255,255,255,0.2) !important; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
      `}</style>

      {/* â"€â"€ Hero â"€â"€ */}
      <section style={{ background: 'linear-gradient(180deg, #080C14 0%, #0B1120 100%)', padding: '80px 24px 56px', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(198,95,46,0.08)', border: '1px solid rgba(198,95,46,0.25)', borderRadius: 20, padding: '6px 14px', marginBottom: 20 }}>
          <Mic size={12} style={{ color: '#C65F2E' }} />
          <span style={{ fontFamily: fontFamily.mono, color: '#C65F2E', fontSize: 11, fontWeight: 700, letterSpacing: '0.18em' }}>SOUNDBOARD â€" LIVE DEMO</span>
        </div>
        <h1 style={{ fontFamily: fontFamily.display, color: '#EDF1F7', fontSize: 'clamp(30px, 5vw, 54px)', lineHeight: 1.08, fontWeight: 700, margin: '0 auto 16px', maxWidth: 700 }}>
          Ask anything.<br />
          <span style={{ background: 'linear-gradient(135deg, #FF8C3A, #C65F2E)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            Get boardroom-grade answers.
          </span>
        </h1>
        <p style={{ fontFamily: fontFamily.body, color: '#8FA0B8', fontSize: 16, lineHeight: 1.6, maxWidth: 560, margin: '0 auto 32px' }}>
          Five AI modes. Infinite conversations. Each response is calibrated to your exact business â€" not generic advice.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/register-supabase" style={{ background: 'linear-gradient(135deg, #D06832, #A64F26)', color: '#fff', borderRadius: 12, padding: '12px 28px', fontSize: 14, fontWeight: 600, fontFamily: fontFamily.body, textDecoration: 'none', boxShadow: '0 6px 24px rgba(198,95,46,0.3)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            Try With Your Business <ArrowRight size={15} />
          </Link>
        </div>
      </section>

      {/* â"€â"€ Mode selector â"€â"€ */}
      <div style={{ background: '#0B1120', borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '0 16px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', gap: 8, overflowX: 'auto', padding: '12px 0', scrollbarWidth: 'none' }}>
          {MODES.map((m, i) => (
            <button
              key={m.id}
              className="mode-tab"
              onClick={() => { setActiveMode(i); setActiveExample(0); setSearch(''); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 18px', borderRadius: 10, border: `1px solid ${i === activeMode ? m.color + '60' : 'rgba(255,255,255,0.08)'}`, background: i === activeMode ? `${m.color}12` : 'transparent', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, transition: 'all 0.2s',
              }}
            >
              <m.icon size={13} style={{ color: i === activeMode ? m.color : '#64748B' }} />
              <span style={{ fontFamily: fontFamily.mono, color: i === activeMode ? m.color : '#64748B', fontSize: 12, fontWeight: i === activeMode ? 700 : 500 }}>
                {m.label}
              </span>
              {i === activeMode && (
                <span style={{ background: `${m.color}20`, color: m.color, fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 3, letterSpacing: '0.1em' }}>
                  {m.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* â"€â"€ Main demo area â"€â"€ */}
      <section style={{ background: '#080C14', padding: '32px 16px 64px', minHeight: 600 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: '320px 1fr', gap: 24, alignItems: 'start' }}>

          {/* LEFT: Example browser */}
          <div className="fade-up" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, overflow: 'hidden' }}>
            {/* Mode info */}
            <div style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.07)', background: `${mode.color}08` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <mode.icon size={15} style={{ color: mode.color }} />
                <span style={{ fontFamily: fontFamily.display, color: '#EDF1F7', fontSize: 14, fontWeight: 700 }}>{mode.label}</span>
              </div>
              <p style={{ fontFamily: fontFamily.body, color: '#8FA0B8', fontSize: 12, lineHeight: 1.5, margin: 0 }}>
                {mode.description}
              </p>
            </div>

            {/* Search */}
            <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Search size={13} style={{ color: '#64748B', flexShrink: 0 }} />
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setActiveExample(0); }}
                placeholder="Search examples..."
                style={{ border: 'none', background: 'none', color: '#CBD5E1', fontFamily: fontFamily.body, fontSize: 13, outline: 'none', width: '100%', '::placeholder': { color: '#64748B' } }}
              />
            </div>

            {/* Example list */}
            <div style={{ maxHeight: 440, overflowY: 'auto' }}>
              {filtered.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: '#64748B', fontFamily: fontFamily.body, fontSize: 13 }}>No examples match your search.</div>
              ) : (
                filtered.map((ex, i) => (
                  <button
                    key={i}
                    className="ex-item"
                    onClick={() => setActiveExample(i)}
                    style={{
                      width: '100%', border: 'none', background: i === activeExample ? `${mode.color}10` : 'transparent', cursor: 'pointer', padding: '11px 14px', display: 'flex', alignItems: 'flex-start', gap: 8, borderBottom: '1px solid rgba(255,255,255,0.05)', textAlign: 'left', borderLeft: `2px solid ${i === activeExample ? mode.color : 'transparent'}`, transition: 'all 0.15s',
                    }}
                  >
                    <ChevronRight size={12} style={{ color: i === activeExample ? mode.color : '#64748B', flexShrink: 0, marginTop: 2 }} />
                    <span style={{ fontFamily: fontFamily.body, color: i === activeExample ? '#EDF1F7' : '#8FA0B8', fontSize: 12, lineHeight: 1.5 }}>
                      {ex.q}
                    </span>
                  </button>
                ))
              )}
            </div>

            <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: fontFamily.mono, color: '#64748B', fontSize: 10 }}>{filtered.length} EXAMPLES</span>
              <span style={{ fontFamily: fontFamily.mono, color: mode.color, fontSize: 10 }}>{mode.badge} MODE</span>
            </div>
          </div>

          {/* RIGHT: Chat display */}
          {currentExample && (
            <div key={`${activeMode}-${activeExample}`} className="fade-up" style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${mode.color}20`, borderRadius: 14, padding: 24, minHeight: 400 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid rgba(255,255,255,0.07)` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: mode.color, boxShadow: `0 0 8px ${mode.color}` }} />
                  <span style={{ fontFamily: fontFamily.mono, color: mode.color, fontSize: 11, fontWeight: 700, letterSpacing: '0.12em' }}>
                    SOUNDBOARD Â· {mode.label.toUpperCase()}
                  </span>
                </div>
                <span style={{ fontFamily: fontFamily.mono, color: '#64748B', fontSize: 10 }}>
                  {activeExample + 1} of {filtered.length}
                </span>
              </div>
              <ChatDisplay mode={mode} example={currentExample} />
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ fontFamily: fontFamily.body, color: '#64748B', fontSize: 12, margin: 0 }}>
                  In your account, BIQc responds using your live business data â€" not generic examples.
                </p>
                <Link to="/register-supabase" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: `${mode.color}18`, color: mode.color, border: `1px solid ${mode.color}35`, borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, fontFamily: fontFamily.body, textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  Try with my business <ArrowRight size={12} />
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* â"€â"€ Bottom CTA â"€â"€ */}
      <section style={{ background: '#080C14', padding: '64px 24px', textAlign: 'center' }}>
        <h2 style={{ fontFamily: fontFamily.display, color: '#E6EEF7', fontSize: 28, fontWeight: 700, marginBottom: 12 }}>
          Your Soundboard is calibrated to your business.
        </h2>
        <p style={{ fontFamily: fontFamily.body, color: '#8FA0B8', fontSize: 15, marginBottom: 28, maxWidth: 480, margin: '0 auto 28px' }}>
          These examples use generic data. Your account uses live signals from Xero, HubSpot, Outlook, and every other connected tool.
        </p>
        <Link to="/register-supabase" style={{ background: 'linear-gradient(135deg, #E85D00, #E56A08)', color: '#fff', borderRadius: 12, padding: '14px 32px', fontSize: 15, fontWeight: 600, fontFamily: fontFamily.body, textDecoration: 'none', boxShadow: '0 8px 32px rgba(232,93,0,0.25)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          Start Free Trial <ArrowRight size={16} />
        </Link>
        <p style={{ fontFamily: fontFamily.mono, color: '#4A5568', fontSize: 11, marginTop: 16 }}>
          14-day trial Â· Australian hosted Â· No credit card
        </p>
      </section>
    </WebsiteLayout>
  );
}
