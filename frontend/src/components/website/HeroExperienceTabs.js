import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, BarChart3, Briefcase, MessageSquare, Shield, Users } from 'lucide-react';
import { fontFamily } from '../../design-system/tokens';
import mascotImageNew from '../../assets/biqc-agent-mascot-new-cutout.png';

const LEADERS = [
  { role: 'CEO', line: 'Checking strategic priorities', icon: Briefcase },
  { role: 'Finance Manager', line: 'Checking margin and cash pressure', icon: BarChart3 },
  { role: 'Sales Manager', line: 'Checking CRM', icon: Users },
  { role: 'Marketing Manager', line: 'Checking competitor threats', icon: Shield },
];

const SMB_SUMMARY_LINES = [
  '1) Connect finance, sales, operations, and communication tools once.',
  '2) BIQc continuously monitors performance, risk, and market change.',
  '3) BIQc converts live signals into leadership-grade intelligence and insights.',
  '4) You and your team get clear priorities, decisions, and next actions in real time.',
];

const CHAT_OPTIONS = [
  { prompt: 'A competitor dropped pricing by 12%. Do we respond this week?', response: 'Hold headline price, launch a retention offer for at-risk segments, and review churn in 72 hours.' },
  { prompt: 'Cash is tightening. Which expense should we cut first?', response: 'Pause low-return campaigns, protect delivery capacity, and renegotiate two supplier contracts this week.' },
  { prompt: 'Sales velocity fell 18% this month. What is the fastest recovery move?', response: 'Re-target warm pipeline with urgency offers and deploy a manager-led close plan for top deals.' },
  { prompt: 'Should we hire another account manager right now?', response: 'Delay hiring 30 days, automate reporting first, and re-check utilization against forecast demand.' },
  { prompt: 'Our ad spend rose but revenue stayed flat. What do we change first?', response: 'Shift budget to the two highest-converting channels and stop underperforming creative immediately.' },
  { prompt: 'Two key clients are late on payment. What is the safest action?', response: 'Trigger collection playbook now, add milestone billing for new work, and prioritize cash visibility daily.' },
  { prompt: 'Is this the right quarter to launch a new service line?', response: 'Run a limited pilot with 10 customers first and validate margin before full rollout.' },
  { prompt: 'Customer support tickets spiked by 30%. How do we stabilize?', response: 'Create triage queues by urgency, publish quick fixes, and assign a daily incident owner.' },
  { prompt: 'Our team is overloaded. Where should leadership focus this week?', response: 'Stop low-impact projects, protect core delivery, and reset priorities with one owner per objective.' },
  { prompt: 'Should we increase prices next month?', response: 'Test a targeted increase on low-sensitivity segments and pair with value messaging before broad rollout.' },
  { prompt: 'Our NPS dropped from 48 to 39. What should we do now?', response: 'Call detractors within 48 hours, identify top 3 root causes, and publish an action plan to customers.' },
  { prompt: 'Can we afford to expand into a second city?', response: 'Proceed only with partner-led entry and monthly break-even checkpoints to protect cash runway.' },
  { prompt: 'Pipeline looks healthy but close rate fell. Why?', response: 'Audit proposal quality, tighten qualification criteria, and coach reps on objection handling this sprint.' },
  { prompt: 'Do we prioritize margin or growth in the next 90 days?', response: 'Prioritize margin protection with selective growth bets so you keep optionality under volatile demand.' },
  { prompt: 'Our churn is creeping up. What is the quickest mitigation?', response: 'Launch renewal save offers for top-value accounts and assign executive outreach to highest-risk customers.' },
  { prompt: 'Which KPI should leadership watch daily this quarter?', response: 'Track cash runway, gross margin trend, and weekly qualified pipeline to keep decisions grounded.' },
  { prompt: 'Should we keep this underperforming product tier?', response: 'Sunset it in phases, migrate loyal users, and reinvest support effort into your highest-margin tier.' },
  { prompt: 'How do we respond to a sudden supplier price increase?', response: 'Negotiate term discounts, reprice low-margin contracts, and diversify vendor risk in parallel.' },
  { prompt: 'Website traffic is up but conversions are down. Fix?', response: 'Simplify the first CTA path, reduce form friction, and run conversion tests on intent-heavy pages.' },
  { prompt: 'What is the first move when forecast confidence drops?', response: 'Freeze non-critical spend, re-baseline pipeline assumptions, and trigger weekly forecast reviews.' },
  { prompt: 'Can we speed up invoicing without hurting customer trust?', response: 'Move to milestone invoicing and send value summaries with each invoice to reduce payment friction.' },
  { prompt: 'How should we prioritize strategic projects this quarter?', response: 'Score projects by revenue impact, execution risk, and time-to-value, then cut the bottom third.' },
  { prompt: 'We are getting mixed market signals. What now?', response: 'Use scenario planning across best, base, and downside cases and attach trigger points to each.' },
  { prompt: 'Should marketing shift from acquisition to retention now?', response: 'Yes for this cycle: protect current revenue first while preserving a lean acquisition baseline.' },
  { prompt: 'Do we need a promotional campaign before end of month?', response: 'Run a targeted offer only for high-intent cohorts and avoid broad discounting that hurts margin.' },
  { prompt: 'Operations errors increased after a process change. Next step?', response: 'Rollback the highest-risk step, retrain team leads, and reintroduce the change in controlled phases.' },
  { prompt: 'How do we reduce executive decision latency?', response: 'Set a weekly decision cadence, pre-brief with evidence packs, and assign a final accountable owner.' },
  { prompt: 'Should we pause expansion and consolidate?', response: 'Consolidate now, improve core unit economics, and reopen expansion once run-rate stability is proven.' },
  { prompt: 'What should we do when campaign CPL rises sharply?', response: 'Shift budget to proven audience pockets, refresh creative immediately, and tighten lead qualification.' },
  { prompt: 'Can we safely increase contractor utilization?', response: 'Increase only where margin remains healthy and lock QA checkpoints to avoid service quality drift.' },
  { prompt: 'How do we improve board reporting quality quickly?', response: 'Standardize one evidence template, show trend direction, and include explicit risk-confidence statements.' },
  { prompt: 'Should we delay this platform migration?', response: 'Delay broad migration; run a parallel pilot first to protect uptime and customer experience.' },
  { prompt: 'Our top account may churn. What is the immediate play?', response: 'Deploy executive save motion today with a custom value plan and 14-day milestone checkpoints.' },
  { prompt: 'How do we manage rising CAC with flat LTV?', response: 'Improve onboarding retention first, then scale acquisition only in channels with proven payback.' },
  { prompt: 'Do we launch the new pricing page now?', response: 'Ship to 30% traffic, compare conversion and ACV, and only then graduate to full rollout.' },
  { prompt: 'What is the smartest weekly rhythm for leadership?', response: 'Run Monday risk review, Wednesday commercial pulse, and Friday execution closeout with actions.' },
  { prompt: 'How should we respond to negative public reviews?', response: 'Respond within 24 hours, acknowledge specifics, and route recurring issues into a weekly fix list.' },
  { prompt: 'Can we cut meeting load without losing alignment?', response: 'Replace status meetings with async updates and keep only decision-critical forums on calendar.' },
  { prompt: 'Should we raise minimum contract value this quarter?', response: 'Raise gradually for new clients, keep flexibility for strategic accounts, and monitor win-rate impact.' },
  { prompt: 'Our onboarding takes too long. What changes first?', response: 'Automate document collection, shorten handoff steps, and measure time-to-first-value weekly.' },
  { prompt: 'How do we stabilize gross margin under pressure?', response: 'Reprice low-margin work, reduce scope leakage, and track delivery hours against contract assumptions.' },
  { prompt: 'Do we need a formal escalation path for risks?', response: 'Yes: define risk tiers, response SLAs, and clear owners so critical issues are resolved fast.' },
  { prompt: 'What is the best move after a weak month-end close?', response: 'Start a 30-day recovery sprint focused on pipeline hygiene, receivables, and cost containment.' },
  { prompt: 'Should we expand paid social or partner channels?', response: 'Prioritize the channel with shorter payback and stronger attribution clarity this cycle.' },
  { prompt: 'How can we reduce rework in operations?', response: 'Introduce quality gates at intake and handoff, then coach teams on top three repeat failures.' },
  { prompt: 'Is now the right time to add a second product bundle?', response: 'Launch a narrow bundle test tied to current buyer intent before committing full packaging changes.' },
  { prompt: 'What should we do with stale leads older than 90 days?', response: 'Run a focused reactivation campaign and purge non-responsive segments to improve sales focus.' },
  { prompt: 'How do we improve confidence in forecasts?', response: 'Use stage-weighted pipeline rules, weekly variance reviews, and explicit uncertainty bands.' },
  { prompt: 'Can we improve retention without discounting?', response: 'Deliver proactive success check-ins and targeted value milestones instead of broad pricing concessions.' },
  { prompt: 'What is the first action when conversion drops suddenly?', response: 'Inspect traffic quality and checkout friction immediately, then deploy a same-day rollback if needed.' },
];

const USER_INTENTS = ['User request', 'User comment', 'User question'];
const CONNECTOR_PAIRS = [
  ['Salesforce', 'QuickBooks'],
  ['Pipedrive', 'Stripe'],
  ['Zoho CRM', 'MYOB'],
  ['Microsoft Dynamics', 'NetSuite'],
  ['Freshsales', 'Xero'],
  ['HubSpot', 'Cin7'],
  ['Copper', 'Sage Intacct'],
  ['Monday CRM', 'Shopify'],
  ['Capsule CRM', 'Deputy'],
  ['Close CRM', 'Square'],
];

const RESPONSE_SUGGESTIONS = [
  'Re-prioritize at-risk accounts first and protect margin before broad pricing moves.',
  'Assign a single accountable owner and run a 72-hour review on churn, pipeline, and cash flow.',
  'Target retention offers to vulnerable segments rather than discounting across your full customer base.',
  'Use a two-week test window with clear success thresholds before scaling any major change.',
  'Shift spend to high-conversion channels and pause initiatives that are adding cost without lift.',
  'Tighten operating cadence with daily signal checks and one executive decision checkpoint.',
  'Sequence actions by impact first: customer retention, margin protection, then controlled growth.',
  'Document assumptions now and re-forecast after initial interventions to avoid reactive decisions.',
];

const buildBoardroomResponse = (scenario, idx) => {
  const [crmName, pluginName] = CONNECTOR_PAIRS[idx % CONNECTOR_PAIRS.length];
  return (
  `After reviewing ${crmName} and ${pluginName} in your connected stack, here are suggestions:\n` +
  `1) ${scenario.response}\n` +
  `2) ${RESPONSE_SUGGESTIONS[idx % RESPONSE_SUGGESTIONS.length]}\n` +
  `3) ${RESPONSE_SUGGESTIONS[(idx + 3) % RESPONSE_SUGGESTIONS.length]}`
  );
};

const HeroExperienceTabs = () => {
  const [activeTab, setActiveTab] = useState('meet');
  const animatedSummary = useMemo(() => SMB_SUMMARY_LINES, []);
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [typedPromptLen, setTypedPromptLen] = useState(0);
  const [typedResponseLen, setTypedResponseLen] = useState(0);
  const flowRef = useRef({ stage: 'typingPrompt', pause: 0, hold: 0, index: 0, pLen: 0, rLen: 0 });

  useEffect(() => {
    if (activeTab !== 'soundboard') return undefined;
    flowRef.current = { stage: 'typingPrompt', pause: 0, hold: 0, index: 0, pLen: 0, rLen: 0 };
    setScenarioIndex(0);
    setTypedPromptLen(0);
    setTypedResponseLen(0);

    const tick = window.setInterval(() => {
      const runtime = flowRef.current;
      const current = CHAT_OPTIONS[runtime.index];
      const fullResponse = buildBoardroomResponse(current, runtime.index);

      if (runtime.stage === 'typingPrompt') {
        if (runtime.pLen < current.prompt.length) {
          runtime.pLen += 1;
          setTypedPromptLen(runtime.pLen);
          return;
        }
        runtime.stage = 'preResponse';
        return;
      }

      if (runtime.stage === 'preResponse') {
        runtime.pause += 1;
        if (runtime.pause > 20) runtime.stage = 'typingResponse';
        return;
      }

      if (runtime.stage === 'typingResponse') {
        if (runtime.rLen < fullResponse.length) {
          runtime.rLen += 1;
          setTypedResponseLen(Math.min(runtime.rLen, fullResponse.length));
          return;
        }
        runtime.stage = 'hold';
        return;
      }

      runtime.hold += 1;
      if (runtime.hold > 92) {
        runtime.index = (runtime.index + 1) % CHAT_OPTIONS.length;
        runtime.pLen = 0;
        runtime.rLen = 0;
        runtime.pause = 0;
        runtime.hold = 0;
        runtime.stage = 'typingPrompt';
        setScenarioIndex(runtime.index);
        setTypedPromptLen(0);
        setTypedResponseLen(0);
      }
    }, 68);

    return () => window.clearInterval(tick);
  }, [activeTab]);

  const currentChat = CHAT_OPTIONS[scenarioIndex];
  const fullResponse = buildBoardroomResponse(currentChat, scenarioIndex);
  const userIntent = USER_INTENTS[scenarioIndex % USER_INTENTS.length];
  const promptText = currentChat.prompt.slice(0, typedPromptLen);
  const responseText = fullResponse.slice(0, typedResponseLen);

  return (
    <div
      className="w-full max-w-[620px] rounded-2xl border p-5 sm:p-6"
      style={{
        background: 'linear-gradient(160deg, rgba(26,36,48,0.92), rgba(18,27,38,0.9))',
        borderColor: 'rgba(198,95,46,0.22)',
        boxShadow: '0 12px 36px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.03)',
      }}
      data-testid="hero-experience-tabs"
    >
      <style>{`
        @keyframes liveCursor {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.08; }
        }
        @keyframes lineFadeIn {
          0% { opacity: 0; transform: translateY(5px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes thinkingGlow {
          0%, 100% {
            box-shadow: inset 0 0 0 1px rgba(91,143,168,0.24), 0 0 0 rgba(91,143,168,0);
            border-color: rgba(91,143,168,0.24);
          }
          50% {
            box-shadow: inset 0 0 0 1px rgba(91,143,168,0.44), 0 0 16px rgba(91,143,168,0.18);
            border-color: rgba(91,143,168,0.44);
          }
        }
        @keyframes typingDots {
          0%, 20% { opacity: 0.2; }
          50% { opacity: 1; }
          100% { opacity: 0.2; }
        }
        .meet-line {
          animation: lineFadeIn 420ms ease forwards;
          opacity: 0;
        }
      `}</style>

        <div className="flex items-center justify-center mb-5">
        <div className="inline-flex rounded-xl p-1" style={{ background: 'rgba(15,23,32,0.82)', border: '1px solid rgba(91,143,168,0.25)' }}>
          <button
            type="button"
            onClick={() => setActiveTab('meet')}
            className="px-4 sm:px-6 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors"
            style={{
              fontFamily: fontFamily.body,
              color: activeTab === 'meet' ? 'var(--ink-display, #EDF1F7)' : '#8FA0B8',
              background: activeTab === 'meet' ? 'rgba(198,95,46,0.18)' : 'transparent',
            }}
          >
            Meet BIQc
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('soundboard')}
            className="px-4 sm:px-6 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors"
            style={{
              fontFamily: fontFamily.body,
              color: activeTab === 'soundboard' ? 'var(--ink-display, #EDF1F7)' : '#8FA0B8',
              background: activeTab === 'soundboard' ? 'rgba(198,95,46,0.18)' : 'transparent',
            }}
          >
            Ask BIQc
          </button>
        </div>
      </div>

      {activeTab === 'meet' ? (
        <div className="space-y-4">
          <div className="text-left rounded-xl border p-4" style={{ borderColor: 'rgba(91,143,168,0.24)', background: 'rgba(15,23,32,0.78)' }}>
            <h3 className="text-xl sm:text-2xl font-semibold mb-3" style={{ color: 'var(--ink-display, #EDF1F7)', fontFamily: fontFamily.display }}>
              How BIQc works
            </h3>
            <div className="space-y-2.5">
              {animatedSummary.map((line, idx) => (
                <p
                  key={line}
                  className="meet-line text-sm sm:text-[15px]"
                  style={{
                    color: 'var(--ink-secondary, #525252)',
                    fontFamily: fontFamily.body,
                    animationDelay: `${idx * 110}ms`,
                  }}
                >
                  {line}
                </p>
              ))}
            </div>
          </div>

          <div className="relative rounded-xl border p-3 overflow-hidden" style={{ borderColor: 'rgba(91,143,168,0.24)', background: 'rgba(20,30,43,0.4)' }}>
            <div className="relative w-full h-[260px] sm:h-[300px] rounded-lg" style={{ background: 'transparent' }}>
              <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 70%, rgba(198,95,46,0.18), transparent 60%)' }} />
              <img
                src={mascotImageNew}
                alt="BIQc agents"
                className="absolute left-1/2 top-1/2 w-[94%] h-[94%] object-contain -translate-x-1/2 -translate-y-1/2"
                style={{ animation: 'biqcFloat 7s ease-in-out infinite' }}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-[12px] sm:text-[13px] leading-relaxed" style={{ color: 'var(--ink-secondary, #525252)', fontFamily: fontFamily.body }}>
            Ask BIQc unifies your finance, sales, marketing, operations, and communication platforms into one live decision layer. It reasons across current evidence, surfaces what matters now, and gives owners and leaders confident answers, smarter prioritization, and practical next steps in real time.
          </p>
          <div className="space-y-2">
            {LEADERS.map((item, idx) => (
              <div
                key={item.role}
                className="rounded-lg border px-2.5 py-2"
                style={{
                  borderColor: 'rgba(91,143,168,0.24)',
                  background: 'rgba(20,28,38,0.82)',
                  opacity: 1 - (idx * 0.06),
                  animation: `thinkingGlow 2.8s ease-in-out ${idx * 0.35}s infinite`,
                }}
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md border" style={{ borderColor: 'rgba(91,143,168,0.32)', background: 'rgba(91,143,168,0.1)' }}>
                    <item.icon className="h-3 w-3" style={{ color: '#5B8FA8' }} />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold" style={{ color: 'var(--ink-display, #0A0A0A)', fontFamily: fontFamily.body }}>{item.role}</p>
                    <p className="text-[10px]" style={{ color: 'var(--ink-secondary, #8FA0B8)', fontFamily: fontFamily.body }}>{item.line}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border p-3" style={{ borderColor: 'rgba(91,143,168,0.25)', background: 'rgba(15,23,32,0.82)' }}>
            <div className="space-y-2">
              <div className="ml-auto max-w-[92%] rounded-xl border px-3 py-2" style={{ borderColor: 'rgba(91,143,168,0.25)', background: 'rgba(20,28,38,0.9)' }}>
                <p className="text-[10px] uppercase tracking-[0.12em] mb-1" style={{ color: 'var(--ink-secondary, #8FA0B8)', fontFamily: fontFamily.mono }}>
                  {userIntent}
                </p>
                <p className="text-xs sm:text-sm" style={{ color: 'var(--ink-display, #0A0A0A)', fontFamily: fontFamily.body }}>
                  &ldquo;{promptText}
                  <span style={{ animation: 'liveCursor 1.3s ease-in-out infinite' }}>|</span>&rdquo;
                </p>
              </div>
              <div className="flex justify-center">
                <span className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[10px]" style={{ color: 'var(--ink-display, #EDF1F7)', background: 'rgba(198,95,46,0.14)', border: '1px solid rgba(198,95,46,0.3)', fontFamily: fontFamily.mono }}>
                  Boardroom Mode <ArrowRight className="h-3 w-3" /> <span className="opacity-80">live</span>
                </span>
              </div>
              <div className="mr-auto max-w-[96%] rounded-xl border px-3 py-2.5" style={{ borderColor: 'rgba(198,95,46,0.28)', background: 'rgba(198,95,46,0.08)' }}>
                <div className="flex items-start gap-2">
                  <MessageSquare className="h-3.5 w-3.5 mt-0.5" style={{ color: '#C65F2E' }} />
                  <div className="min-w-0">
                    <p className="text-[11px] sm:text-xs mb-1 leading-relaxed whitespace-pre-line" style={{ color: 'var(--ink-display, #EDF1F7)', fontFamily: fontFamily.body }}>
                      {responseText}
                      <span style={{ animation: 'liveCursor 1.3s ease-in-out infinite' }}>|</span>
                    </p>
                    <span className="inline-flex items-center gap-1 text-[10px]" style={{ color: 'var(--ink-secondary, #8FA0B8)', fontFamily: fontFamily.mono }}>
                      drafting
                      <span style={{ animation: 'typingDots 1.2s linear infinite' }}>.</span>
                      <span style={{ animation: 'typingDots 1.2s linear infinite 0.2s' }}>.</span>
                      <span style={{ animation: 'typingDots 1.2s linear infinite 0.4s' }}>.</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HeroExperienceTabs;
