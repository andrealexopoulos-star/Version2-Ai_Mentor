import React, { useState } from 'react';
import { CalibrationLoading, WelcomeHandshake, AuditProgress, ManualSummaryFallback } from '../components/calibration/CalibrationComponents';
import { CalibratingSession } from '../components/calibration/CalibratingSession';
import { ExecutiveReveal, REVEAL_PHASES } from '../components/calibration/ExecutiveReveal';
import { WowSummary } from '../components/calibration/WowSummary';
import { ContinuitySuite } from '../components/calibration/ContinuitySuite';
import { CognitiveLoadingScreen } from '../components/CognitiveLoadingScreen';

const SCREENS = [
  'auth-loading', 'cognitive-first', 'cognitive-return',
  'welcome', 'manual-summary', 'analyzing', 'wow-summary', 'continuity',
  'wizard-q1', 'wizard-q2', 'wizard-q3', 'chat',
  'reveal-progress', 'reveal-complete',
  'onboard-decision', 'onboard-welcome', 'onboard-identity', 'onboard-market', 'onboard-goals',
  'first-login-notif', 'checkin-alert',
];

const MONO = "'JetBrains Mono', monospace";
const HEAD = "'Cormorant Garamond', Georgia, serif";
const BODY = "'Inter', sans-serif";

const OnboardPreview = ({ step }) => {
  const stepConfigs = {
    'onboard-welcome': { title: 'Welcome to BIQc', sub: 'Your continuous business intelligence system.', items: ['BIQc Insights — Real-time intelligence on business health', 'Business DNA — Your core identity and strategy', 'Goals & Objectives — What BIQc monitors for you', 'How BIQc works — Observes signals, forms positions, escalates findings'] },
    'onboard-identity': { title: 'Business Identity', sub: 'Tell us about your company.', fields: ['Business Name', 'Industry', 'Business Stage', 'Location', 'Team Size'] },
    'onboard-market': { title: 'Market & Customers', sub: 'Who do you serve?', fields: ['Target Market', 'Ideal Customer Profile', 'Business Model', 'Geographic Focus', 'Revenue Range'] },
    'onboard-goals': { title: 'Goals & Strategy', sub: 'What are you working towards?', fields: ['Primary Goal', 'Revenue Target', 'Growth Strategy', 'Biggest Challenge', 'Timeline'] },
  };
  const cfg = stepConfigs[step];
  if (!cfg) return null;
  const stepNum = step === 'onboard-welcome' ? 0 : step === 'onboard-identity' ? 1 : step === 'onboard-market' ? 3 : 6;
  return (
    <div className="min-h-[calc(100vh-40px)] flex flex-col" style={{ background: '#0F1720' }}>
      <header className="px-6 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #243140' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#FF6A00' }}>
            <span className="text-white font-bold text-xs" style={{ fontFamily: MONO }}>B</span>
          </div>
          <div>
            <h3 className="font-semibold text-sm text-[#F4F7FA]" style={{ fontFamily: HEAD }}>BIQc Setup</h3>
            <p className="text-xs text-[#64748B]" style={{ fontFamily: MONO }}>{cfg.title}</p>
          </div>
        </div>
        {stepNum > 0 && <div className="flex items-center gap-3">
          <span className="text-xs text-[#64748B]" style={{ fontFamily: MONO }}>{stepNum}/7</span>
          <div className="w-24 h-1.5 rounded-full" style={{ background: '#243140' }}>
            <div className="h-full rounded-full" style={{ background: '#FF6A00', width: `${Math.round((stepNum/7)*100)}%` }} />
          </div>
        </div>}
      </header>
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-2xl rounded-xl p-8" style={{ background: '#141C26', border: '1px solid #243140' }}>
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ background: '#FF6A0020' }}>
              <span className="text-2xl" style={{ color: '#FF6A00' }}>&#9889;</span>
            </div>
            <h1 className="text-2xl font-bold text-[#F4F7FA] mb-2" style={{ fontFamily: HEAD }}>{cfg.title}</h1>
            <p className="text-sm text-[#9FB0C3]" style={{ fontFamily: BODY }}>{cfg.sub}</p>
          </div>
          {cfg.items && <div className="space-y-3 max-w-lg mx-auto">{cfg.items.map((item, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-lg" style={{ background: '#0F1720', border: '1px solid #243140' }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#FF6A0015' }}>
                <span className="text-xs text-[#FF6A00]" style={{ fontFamily: MONO }}>{i+1}</span>
              </div>
              <p className="text-sm text-[#9FB0C3]">{item}</p>
            </div>
          ))}</div>}
          {cfg.fields && <div className="space-y-4 max-w-lg mx-auto">{cfg.fields.map((f, i) => (
            <div key={i}>
              <label className="text-xs font-semibold text-[#9FB0C3] uppercase tracking-wider block mb-1" style={{ fontFamily: MONO }}>{f}</label>
              <div className="h-10 rounded-lg" style={{ background: '#0F1720', border: '1px solid #243140' }} />
            </div>
          ))}</div>}
          <div className="flex justify-between mt-8">
            {stepNum > 0 && <button className="px-5 py-2.5 rounded-xl text-sm" style={{ color: '#9FB0C3', border: '1px solid #243140' }}>Back</button>}
            <button className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white ml-auto" style={{ background: '#FF6A00' }}>
              {stepNum === 0 ? 'Begin Setup' : 'Continue'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const AuthLoadingPreview = () => (
  <div className="min-h-[calc(100vh-40px)] flex items-center justify-center" style={{ background: '#0F1720' }}>
    <div className="text-center space-y-6">
      <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto" style={{ background: '#FF6A00' }}>
        <span className="text-white font-bold text-xl" style={{ fontFamily: MONO }}>B</span>
      </div>
      <div>
        <p className="text-lg font-semibold text-[#F4F7FA]" style={{ fontFamily: HEAD }}>Good evening.</p>
        <p className="text-sm text-[#64748B] mt-1" style={{ fontFamily: BODY }}>Establishing secure connection...</p>
      </div>
      <div className="w-48 mx-auto">
        <div className="h-1 rounded-full overflow-hidden" style={{ background: '#243140' }}>
          <div className="h-full rounded-full" style={{ background: '#FF6A00', width: '60%' }} />
        </div>
      </div>
    </div>
  </div>
);

const CalibrationPreview = () => {
  const [screen, setScreen] = useState('auth-loading');

  return (
    <div className="min-h-screen" style={{ background: '#0F1720' }}>
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center gap-1 px-3 py-1.5 overflow-x-auto" style={{ background: '#0A1018', borderBottom: '1px solid #243140' }}>
        <span className="text-[10px] text-[#64748B] mr-1 shrink-0" style={{ fontFamily: MONO }}>Screen:</span>
        {SCREENS.map(s => (
          <button key={s} onClick={() => setScreen(s)} className="px-2 py-1 rounded text-[10px] font-medium shrink-0"
            style={{ background: screen === s ? '#FF6A00' : '#141C26', color: screen === s ? 'white' : '#64748B', border: `1px solid ${screen === s ? '#FF6A00' : '#243140'}` }}>
            {s}
          </button>
        ))}
      </div>

      <div className="pt-10" style={{ minHeight: 'calc(100vh - 40px)' }}>
        {screen === 'auth-loading' && <AuthLoadingPreview />}

        {screen === 'cognitive-first' && <CognitiveLoadingScreen mode="first" ownerName="Andre" />}
        {screen === 'cognitive-return' && <CognitiveLoadingScreen mode="returning" ownerName="Andre" />}

        {screen === 'welcome' && (
          <div className="h-[calc(100vh-40px)] flex flex-col" style={{ background: '#0F1720' }}>
            <WelcomeHandshake firstName="Andre" websiteUrl="" setWebsiteUrl={() => {}} onSubmit={(e) => e.preventDefault()} onManualFallback={() => setScreen('manual-summary')} isSubmitting={false} error={null} />
          </div>
        )}

        {screen === 'manual-summary' && (
          <div className="h-[calc(100vh-40px)] flex flex-col" style={{ background: '#0F1720' }}>
            <ManualSummaryFallback firstName="Andre" onSubmit={() => {}} isSubmitting={false} />
          </div>
        )}

        {screen === 'analyzing' && (
          <div className="h-[calc(100vh-40px)] flex flex-col" style={{ background: '#0F1720' }}>
            <AuditProgress />
          </div>
        )}

        {screen === 'wow-summary' && (
          <div className="h-[calc(100vh-40px)] flex flex-col overflow-y-auto" style={{ background: '#0F1720' }}>
            <WowSummary firstName="Andre" wowSummary={{
              business_overview: "The Strategy Squad is a management consulting firm specialising in AI-driven business intelligence for Australian SMBs.",
              industry_position: "Positioned as a pioneer in autonomous business intelligence, bridging the gap between enterprise-grade tools and SMB accessibility.",
              competitive_advantages: "Australian data sovereignty, AI-first approach, integrated CRM/accounting intelligence, proactive risk detection.",
              target_market: "Australian SMBs with 5-50 employees in professional services, technology, and consulting sectors.",
              key_challenges: "Market education on AI-driven intelligence, scaling customer acquisition, building trust in autonomous decision support.",
            }} editedFields={{}} editingKey={null} editValue="" setEditValue={() => {}} startEdit={() => {}} commitEdit={() => {}} handleConfirmWow={() => {}} isSubmitting={false} error={null} />
          </div>
        )}

        {screen === 'continuity' && (
          <div className="h-[calc(100vh-40px)] flex flex-col" style={{ background: '#0F1720' }}>
            <ContinuitySuite firstName="Andre" calStep={5} error={null} onResume={() => {}} />
          </div>
        )}

        {screen === 'wizard-q1' && (
          <div className="h-[calc(100vh-40px)] flex flex-col" style={{ background: '#0F1720' }}>
            <CalibratingSession calMode="wizard" error={null}
              question="How do you prefer to receive information?"
              options={["Bullet points — Just the key facts, fast", "Narrative — Tell me the story, I'll find the insight", "Data-first — Numbers, charts, evidence, then conclusions", "Conversational — Talk to me like a trusted advisor"]}
              allowText={true} insight="Understanding your communication style helps BIQc deliver intelligence the way you process it best."
              selectedOption={null} setSelectedOption={() => {}} textValue="" setTextValue={() => {}} isSubmitting={false} handleWizardContinue={() => {}}
              messages={[]} inputValue="" setInputValue={() => {}} handleChatSubmit={() => {}} currentStep={1} />
          </div>
        )}

        {screen === 'wizard-q2' && (
          <div className="h-[calc(100vh-40px)] flex flex-col" style={{ background: '#0F1720' }}>
            <CalibratingSession calMode="wizard" error={null}
              question="How much detail do you want in your intelligence briefings?"
              options={["Minimal — Headlines and actions only", "Moderate — Key context with recommendations", "Comprehensive — Full analysis with supporting evidence"]}
              allowText={false} insight="This determines how deep your daily briefings go."
              selectedOption={null} setSelectedOption={() => {}} textValue="" setTextValue={() => {}} isSubmitting={false} handleWizardContinue={() => {}}
              messages={[]} inputValue="" setInputValue={() => {}} handleChatSubmit={() => {}} currentStep={2} />
          </div>
        )}

        {screen === 'wizard-q3' && (
          <div className="h-[calc(100vh-40px)] flex flex-col" style={{ background: '#0F1720' }}>
            <CalibratingSession calMode="wizard" error={null}
              question="When it comes to risk, where do you sit?"
              options={["Conservative — Protect what we have, minimise exposure", "Moderate — Balanced approach, calculated risks only", "Aggressive — Move fast, accept higher risk for higher reward"]}
              allowText={true} insight="Your risk posture shapes how BIQc prioritises alerts and recommendations."
              selectedOption={null} setSelectedOption={() => {}} textValue="" setTextValue={() => {}} isSubmitting={false} handleWizardContinue={() => {}}
              messages={[]} inputValue="" setInputValue={() => {}} handleChatSubmit={() => {}} currentStep={4} />
          </div>
        )}

        {screen === 'chat' && (
          <div className="h-[calc(100vh-40px)] flex flex-col" style={{ background: '#0F1720' }}>
            <CalibratingSession calMode="chat" error={null} question={null} options={[]} allowText={false} insight={null}
              selectedOption={null} setSelectedOption={() => {}} textValue="" setTextValue={() => {}} isSubmitting={false} handleWizardContinue={() => {}}
              messages={[
                { role: "edge", text: "Good to meet you, Andre. Let's calibrate how BIQc communicates with you. How do you prefer to receive business updates — bullet points, narrative summaries, or data-first?" },
                { role: "user", text: "Bullet points. I'm time-poor and need the key facts fast." },
                { role: "edge", text: "Noted — concise and direct. How blunt should I be when flagging problems? Do you want me to soften bad news or give it to you straight?" },
              ]}
              inputValue="" setInputValue={() => {}} handleChatSubmit={(e) => e.preventDefault()} currentStep={3} />
          </div>
        )}

        {screen === 'reveal-progress' && (
          <div className="h-[calc(100vh-40px)] flex flex-col" style={{ background: '#0F1720' }}>
            <ExecutiveReveal firstName="Andre" lastResponse="Data-driven decision making" revealPhase={2} />
          </div>
        )}

        {screen === 'reveal-complete' && (
          <div className="h-[calc(100vh-40px)] flex flex-col" style={{ background: '#0F1720' }}>
            <ExecutiveReveal firstName="Andre" lastResponse="Data-driven decision making" revealPhase={REVEAL_PHASES.length - 1} />
          </div>
        )}

        {screen.startsWith('onboard-') && <OnboardPreview step={screen} />}
      </div>
    </div>
  );
};

export default CalibrationPreview;
