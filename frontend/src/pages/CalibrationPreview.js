import React, { useState } from 'react';
import { CalibrationLoading, WelcomeHandshake, AuditProgress } from '../components/calibration/CalibrationComponents';
import { CalibratingSession } from '../components/calibration/CalibratingSession';
import { ExecutiveReveal, REVEAL_PHASES } from '../components/calibration/ExecutiveReveal';

/**
 * CalibrationPreview — Preview all calibration screens without auth.
 * Temporary route for visual review. Remove after review.
 */
const CalibrationPreview = () => {
  const [screen, setScreen] = useState('welcome');

  const SCREENS = ['welcome', 'analyzing', 'wizard', 'chat', 'reveal'];

  return (
    <div className="min-h-screen" style={{ background: '#0F1720' }}>
      {/* Screen selector */}
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center gap-2 px-4 py-2" style={{ background: '#0A1018', borderBottom: '1px solid #243140' }}>
        <span className="text-xs text-[#64748B] mr-2" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Preview:</span>
        {SCREENS.map(s => (
          <button key={s} onClick={() => setScreen(s)} className="px-3 py-1 rounded text-xs font-medium"
            style={{ background: screen === s ? '#FF6A00' : '#141C26', color: screen === s ? 'white' : '#9FB0C3', border: `1px solid ${screen === s ? '#FF6A00' : '#243140'}` }}>
            {s}
          </button>
        ))}
      </div>

      <div className="pt-10 h-screen flex flex-col" style={{ background: '#0F1720' }}>
        {screen === 'welcome' && (
          <WelcomeHandshake
            firstName="Andre"
            websiteUrl=""
            setWebsiteUrl={() => {}}
            onSubmit={(e) => { e.preventDefault(); setScreen('analyzing'); }}
            onManualFallback={() => {}}
            isSubmitting={false}
            error={null}
          />
        )}

        {screen === 'analyzing' && <AuditProgress />}

        {screen === 'wizard' && (
          <CalibratingSession
            calMode="wizard"
            error={null}
            question="How do you prefer to receive information?"
            options={[
              "Bullet points — Just the key facts, fast",
              "Narrative — Tell me the story, I'll find the insight",
              "Data-first — Numbers, charts, evidence, then conclusions",
              "Conversational — Talk to me like a trusted advisor"
            ]}
            allowText={true}
            insight="Understanding your communication style helps BIQc deliver intelligence the way you process it best."
            selectedOption={null}
            setSelectedOption={() => {}}
            textValue=""
            setTextValue={() => {}}
            isSubmitting={false}
            handleWizardContinue={() => {}}
            messages={[]}
            inputValue=""
            setInputValue={() => {}}
            handleChatSubmit={() => {}}
            currentStep={1}
          />
        )}

        {screen === 'chat' && (
          <CalibratingSession
            calMode="chat"
            error={null}
            question={null}
            options={[]}
            allowText={false}
            insight={null}
            selectedOption={null}
            setSelectedOption={() => {}}
            textValue=""
            setTextValue={() => {}}
            isSubmitting={false}
            handleWizardContinue={() => {}}
            messages={[
              { role: "edge", text: "Good to meet you, Andre. Let's calibrate how BIQc communicates with you. How do you prefer to receive business updates — bullet points, narrative summaries, or data-first?" },
              { role: "user", text: "Bullet points. I'm time-poor and need the key facts fast." },
              { role: "edge", text: "Noted — concise and direct. How blunt should I be when flagging problems? Do you want me to soften bad news or give it to you straight?" },
            ]}
            inputValue=""
            setInputValue={() => {}}
            handleChatSubmit={(e) => e.preventDefault()}
            currentStep={3}
          />
        )}

        {screen === 'reveal' && (
          <ExecutiveReveal
            firstName="Andre"
            lastResponse="Data-driven decision making"
            revealPhase={REVEAL_PHASES.length - 1}
          />
        )}
      </div>
    </div>
  );
};

export default CalibrationPreview;
