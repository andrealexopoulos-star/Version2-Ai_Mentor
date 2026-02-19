import React, { useRef } from 'react';

const CHARCOAL = '#1E293B';
const MUTED = '#64748B';
const GOLD = '#B8860B';
const CARD_BG = '#FFFFFF';
const CARD_BORDER = '#E8E6E1';
const SERIF = "var(--font-heading)";

const TOTAL_STEPS = 9;

const CalibratingSession = ({
  calMode, error, question, options, allowText, insight,
  selectedOption, setSelectedOption, textValue, setTextValue,
  isSubmitting, handleWizardContinue,
  messages, inputValue, setInputValue, handleChatSubmit,
  currentStep,
}) => {
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  const stepNum = Math.min(currentStep || 1, TOTAL_STEPS);
  const progressPct = Math.round(((stepNum - 1) / TOTAL_STEPS) * 100);

  return (
    <>
      <header className="px-6 sm:px-8 py-3" style={{ borderBottom: `1px solid ${CARD_BORDER}` }}>
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-sm font-medium tracking-wide uppercase" style={{ color: MUTED, letterSpacing: '0.12em' }}>
            Calibration
          </h1>
          <span className="text-xs font-semibold" style={{ color: GOLD }}>
            Question {stepNum} of {TOTAL_STEPS}
          </span>
        </div>
        {/* Progress bar */}
        <div className="h-1 rounded-full overflow-hidden" style={{ background: CARD_BORDER }}>
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{ width: `${progressPct}%`, background: GOLD }}
          />
        </div>
      </header>

      {!calMode && !error && (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-5 h-5 border rounded-full animate-spin" style={{ borderColor: CARD_BORDER, borderTopColor: CHARCOAL }} />
        </div>
      )}

      {error && (
        <div className="flex-1 flex items-center justify-center px-4">
          <p className="text-sm" style={{ color: '#EF4444' }}>{error}</p>
        </div>
      )}

      {/* Wizard Mode */}
      {calMode === "wizard" && !error && (
        <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-8" style={{ animation: 'fadeIn 0.5s ease' }}>
          <div className="w-full max-w-2xl mx-auto space-y-8">
            {insight && (
              <div className="text-center" style={{ animation: 'fadeIn 0.6s ease' }}>
                <p className="text-sm leading-relaxed" style={{ color: MUTED, maxWidth: 480, margin: '0 auto' }}>{insight}</p>
              </div>
            )}
            {question && (
              <div className="text-center" style={{ animation: 'fadeIn 0.7s ease' }}>
                <p className="text-xl sm:text-2xl leading-relaxed" style={{ fontFamily: SERIF, color: CHARCOAL, fontWeight: 500, maxWidth: 560, margin: '0 auto' }}
                  data-testid="calibration-question">
                  {question}
                </p>
              </div>
            )}
            {options.length > 0 && (
              <div className={`${options.length === 2 ? 'grid grid-cols-1 sm:grid-cols-2 gap-4' : 'space-y-3'}`}
                style={{ animation: 'fadeIn 0.8s ease' }} data-testid="calibration-options">
                {options.map((opt, i) => {
                  const isSelected = selectedOption === opt;
                  const optParts = typeof opt === 'string' ? opt.split(' — ') : [opt];
                  const title = optParts[0];
                  const subtitle = optParts.length > 1 ? optParts[1] : null;
                  return (
                    <button key={i} onClick={() => setSelectedOption(opt)} disabled={isSubmitting}
                      className="w-full text-left rounded-xl px-6 py-5 transition-all duration-200"
                      style={{
                        background: isSelected ? '#FFFCF5' : CARD_BG,
                        border: `2px solid ${isSelected ? '#B8860B' : CARD_BORDER}`,
                        boxShadow: isSelected ? '0 0 0 1px #B8860B40' : 'none',
                      }}
                      onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.borderColor = '#B8860B80'; }}
                      onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.borderColor = CARD_BORDER; }}
                      data-testid={`calibration-option-${i}`}
                    >
                      <p className="text-sm font-semibold" style={{ color: CHARCOAL }}>{title}</p>
                      {subtitle && <p className="text-xs mt-1 leading-relaxed" style={{ color: MUTED }}>{subtitle}</p>}
                    </button>
                  );
                })}
              </div>
            )}
            {allowText && (
              <div style={{ animation: 'fadeIn 0.9s ease' }}>
                <textarea value={textValue} onChange={(e) => setTextValue(e.target.value)} disabled={isSubmitting} rows={3}
                  className="w-full rounded-xl px-5 py-4 text-sm focus:outline-none resize-none"
                  style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, color: CHARCOAL }}
                  data-testid="calibration-textarea" />
              </div>
            )}
            <div className="text-center pt-2">
              <button onClick={handleWizardContinue} disabled={isSubmitting || !selectedOption}
                className="px-10 py-3.5 rounded-full text-sm font-medium transition-opacity disabled:opacity-30"
                style={{ background: CHARCOAL, color: '#FFFFFF' }}
                data-testid="calibration-continue-btn">
                {isSubmitting ? 'Processing...' : 'Continue'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chat Mode */}
      {calMode === "chat" && !error && (
        <>
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 space-y-4" data-testid="calibration-messages">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`} data-testid={`message-${i}`}>
                <div className="max-w-[85%] sm:max-w-[70%] px-4 py-3 rounded-xl text-sm leading-relaxed"
                  style={{ background: msg.role === "user" ? '#F0F4FF' : CARD_BG, border: `1px solid ${msg.role === "user" ? '#BFDBFE' : CARD_BORDER}`, color: CHARCOAL }}>
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                </div>
              </div>
            ))}
            {isSubmitting && (
              <div className="flex justify-start">
                <div className="px-4 py-3 rounded-xl" style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
                  <div className="w-4 h-4 border rounded-full animate-spin" style={{ borderColor: CARD_BORDER, borderTopColor: MUTED }} />
                </div>
              </div>
            )}
          </div>
          <form onSubmit={handleChatSubmit} className="px-4 sm:px-8 py-4" style={{ borderTop: `1px solid ${CARD_BORDER}` }} data-testid="calibration-form">
            <div className="flex gap-2">
              <input ref={inputRef} type="text" inputMode="text" enterKeyHint="send" autoComplete="off"
                value={inputValue} onChange={(e) => setInputValue(e.target.value)} disabled={isSubmitting}
                className="flex-1 rounded-xl px-4 py-3 text-base focus:outline-none"
                style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, color: CHARCOAL }}
                autoFocus data-testid="calibration-input" />
              <button type="submit" disabled={isSubmitting || !inputValue.trim()}
                className="px-6 py-3 rounded-xl text-sm font-medium transition-opacity disabled:opacity-30"
                style={{ background: CHARCOAL, color: '#FFFFFF' }} data-testid="calibration-send-btn">
                Send
              </button>
            </div>
          </form>
        </>
      )}
    </>
  );
};

export { CalibratingSession };
