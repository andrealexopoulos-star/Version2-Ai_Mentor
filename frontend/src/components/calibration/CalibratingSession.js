import React, { useRef, useEffect } from 'react';
import { CheckCircle2, ArrowRight } from 'lucide-react';

const MONO = "'JetBrains Mono', monospace";
const HEAD = "'Cormorant Garamond', Georgia, serif";
const BODY = "'Inter', sans-serif";

const TOTAL_STEPS = 9;

const STEP_LABELS = {
  1: 'Communication Style',
  2: 'Detail Level',
  3: 'Directness',
  4: 'Risk Appetite',
  5: 'Decision Making',
  6: 'Accountability',
  7: 'Time Pressure',
  8: 'Challenge Level',
  9: 'Boundaries',
};

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

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isSubmitting]);

  useEffect(() => {
    if (!isSubmitting && calMode === 'chat' && inputRef.current) inputRef.current.focus();
  }, [isSubmitting, calMode]);

  return (
    <>
      {/* Header — Liquid Steel themed */}
      <header className="px-6 sm:px-8 py-3" style={{ borderBottom: '1px solid #243140' }}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: '#FF6A00' }}>
              <span className="text-white font-bold text-[10px]" style={{ fontFamily: MONO }}>B</span>
            </div>
            <h1 className="text-sm font-medium tracking-wide uppercase" style={{ color: '#9FB0C3', letterSpacing: '0.12em', fontFamily: MONO }}>
              Calibration
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px]" style={{ color: '#64748B', fontFamily: MONO }}>
              {STEP_LABELS[stepNum] || `Step ${stepNum}`}
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{ color: '#FF6A00', background: '#FF6A0015', fontFamily: MONO }}>
              {stepNum}/{TOTAL_STEPS}
            </span>
          </div>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#243140' }}>
          <div className="h-full rounded-full transition-all duration-700 ease-out"
            style={{ width: `${progressPct}%`, background: 'linear-gradient(90deg, #FF6A00, #FF8C33)' }} />
        </div>
        {/* Step indicators */}
        <div className="flex gap-1 mt-2">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <div key={i} className="flex-1 h-1 rounded-full transition-all" style={{
              background: i < stepNum - 1 ? '#FF6A00' : i === stepNum - 1 ? '#FF6A0060' : '#243140'
            }} />
          ))}
        </div>
      </header>

      {/* Loading state — NO spinner */}
      {!calMode && !error && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-3" style={{ background: '#FF6A0020' }}>
              <div className="w-3 h-3 rounded-full" style={{ background: '#FF6A00', animation: 'pulse 1.5s ease-in-out infinite' }} />
            </div>
            <p className="text-sm" style={{ color: '#9FB0C3', fontFamily: BODY }}>Preparing your next question...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="flex-1 flex items-center justify-center px-4">
          <p className="text-sm" style={{ color: '#EF4444' }}>{error}</p>
        </div>
      )}

      {/* Wizard Mode — Multiple Choice */}
      {calMode === "wizard" && !error && (
        <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-8" style={{ animation: 'fadeIn 0.5s ease' }}>
          <div className="w-full max-w-2xl mx-auto space-y-8">
            {insight && (
              <div className="text-center" style={{ animation: 'fadeIn 0.6s ease' }}>
                <p className="text-sm leading-relaxed" style={{ color: '#9FB0C3', fontFamily: BODY, maxWidth: 480, margin: '0 auto' }}>{insight}</p>
              </div>
            )}
            {question && (
              <div className="text-center" style={{ animation: 'fadeIn 0.7s ease' }}>
                <p className="text-xl sm:text-2xl leading-relaxed" style={{ fontFamily: HEAD, color: '#F4F7FA', fontWeight: 500, maxWidth: 560, margin: '0 auto' }}
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
                      className="w-full text-left rounded-xl px-6 py-5 transition-all duration-200 group"
                      style={{
                        background: isSelected ? '#FF6A0010' : '#141C26',
                        border: `2px solid ${isSelected ? '#FF6A00' : '#243140'}`,
                        boxShadow: isSelected ? '0 0 0 1px #FF6A0040' : 'none',
                      }}
                      onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.borderColor = '#FF6A0060'; }}
                      onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.borderColor = isSelected ? '#FF6A00' : '#243140'; }}
                      data-testid={`calibration-option-${i}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{
                          border: `2px solid ${isSelected ? '#FF6A00' : '#64748B'}`,
                          background: isSelected ? '#FF6A00' : 'transparent',
                        }}>
                          {isSelected && <CheckCircle2 className="w-3 h-3 text-white" />}
                        </div>
                        <div>
                          <p className="text-sm font-semibold" style={{ color: '#F4F7FA' }}>{title}</p>
                          {subtitle && <p className="text-xs mt-1 leading-relaxed" style={{ color: '#9FB0C3' }}>{subtitle}</p>}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            {allowText && (
              <div style={{ animation: 'fadeIn 0.9s ease' }}>
                <textarea value={textValue} onChange={(e) => setTextValue(e.target.value)} disabled={isSubmitting} rows={3}
                  placeholder="Add additional context (optional)..."
                  className="w-full rounded-xl px-5 py-4 text-sm focus:outline-none resize-none"
                  style={{ background: '#141C26', border: '1px solid #243140', color: '#F4F7FA', fontFamily: BODY }}
                  data-testid="calibration-textarea" />
              </div>
            )}
            <div className="text-center pt-2">
              <button onClick={handleWizardContinue} disabled={isSubmitting || !selectedOption}
                className="px-10 py-3.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-30 flex items-center gap-2 mx-auto"
                style={{ background: '#FF6A00', color: '#FFFFFF' }}
                data-testid="calibration-continue-btn">
                {isSubmitting ? 'Processing...' : 'Continue'}
                {!isSubmitting && <ArrowRight className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chat Mode — ARCHIVED: All calibration now uses wizard mode */}
    </>
  );
};

export { CalibratingSession };
