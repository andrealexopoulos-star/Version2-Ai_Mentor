import React, { useState, useCallback } from "react";
import { useCalibrationState } from "../hooks/useCalibrationState";
import { useSupabaseAuth } from "../context/SupabaseAuthContext";
import { apiClient } from "../lib/api";
import {
  CalibrationLoading, WelcomeHandshake, ManualSummaryFallback,
  AuditProgress,
} from "../components/calibration/CalibrationComponents";
import { WowSummary, DissolveTransition } from "../components/calibration/WowSummary";
import { ExecutiveReveal } from "../components/calibration/ExecutiveReveal";
import { ContinuitySuite } from "../components/calibration/ContinuitySuite";
import { CalibratingSession } from "../components/calibration/CalibratingSession";
import { CalibrationTutorial } from "../components/TutorialOverlay";
import { CognitiveIgnitionScreen } from "../components/CognitiveLoadingScreen";
import { ExecutiveCMOSnapshot, ForensicCalibrationUI } from "../components/calibration/IntelligencePhases";
import { SkipForward, ArrowLeft, CheckCircle2 } from 'lucide-react';

const CREAM = '#0F1720';
const CHARCOAL = '#F4F7FA';
const MUTED = '#9FB0C3';
const CARD_BORDER = '#243140';

const CalibrationAdvisor = () => {
  const cal = useCalibrationState();
  const { user } = useSupabaseAuth();
  const [skipping, setSkipping] = useState(false);

  const isSuperAdmin = user?.role === 'superadmin' || user?.role === 'admin' || user?.email === 'andre@thestrategysquad.com.au';

  const handleSkipCalibration = async () => {
    setSkipping(true);
    try {
      await apiClient.post('/calibration/skip');
      window.location.href = '/advisor';
    } catch {
      setSkipping(false);
    }
  };

  const handleIgnitionComplete = useCallback(() => {
    cal.setEntry("welcome");
  }, [cal]);

  // Pick the right tutorial key based on current entry
  const tutorialKey = cal.entry === 'welcome' ? 'calibration-welcome'
    : (cal.entry === 'calibrating') ? 'calibration-chat'
    : (cal.entry === 'wow_summary') ? 'calibration-wow'
    : null;

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: CREAM }} data-testid="calibration-page">
      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>

      {/* Tutorial overlay for calibration stages */}
      {tutorialKey && <CalibrationTutorial pageKey={tutorialKey} />}

      {cal.entry !== "loading" && cal.user && (
        <div className="flex items-center justify-between px-5 py-2.5" style={{ borderBottom: `1px solid ${CARD_BORDER}` }} data-testid="identity-bar">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ background: '#10B981' }} />
            <span className="text-xs" style={{ color: MUTED }}>
              Signed in as <span style={{ color: CHARCOAL }}>{cal.userEmail}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            {isSuperAdmin && (
              <>
                {cal.entry !== 'welcome' && cal.entry !== 'loading' && (
                  <button onClick={() => cal.setEntry('welcome')} className="text-xs px-3 py-1 rounded-full flex items-center gap-1 transition-colors"
                    style={{ color: '#9FB0C3', border: '1px solid #243140' }} data-testid="admin-back-btn">
                    <ArrowLeft className="w-3 h-3" /> Back
                  </button>
                )}
                <button onClick={handleSkipCalibration} disabled={skipping}
                  className="text-xs px-3 py-1 rounded-full flex items-center gap-1 transition-colors"
                  style={{ color: '#FF6A00', border: '1px solid #FF6A0040', background: '#FF6A0010' }} data-testid="admin-skip-btn">
                  <SkipForward className="w-3 h-3" /> {skipping ? 'Skipping...' : 'Skip (Admin)'}
                </button>
              </>
            )}
            <button onClick={cal.handleSignOut} className="text-xs px-3 py-1 rounded-full transition-colors"
              style={{ color: MUTED, border: `1px solid ${CARD_BORDER}` }} data-testid="sign-out-btn">Sign out</button>
          </div>
        </div>
      )}

      {cal.entry === "loading" && <CalibrationLoading />}

      {/* PHASE 1: Cognitive Ignition — cinematic entry before welcome */}
      {cal.entry === "ignition" && (
        <CognitiveIgnitionScreen onComplete={handleIgnitionComplete} ownerName={cal.firstName} />
      )}

      {cal.entry === "welcome" && (
        <WelcomeHandshake firstName={cal.firstName} websiteUrl={cal.websiteUrl} setWebsiteUrl={cal.setWebsiteUrl}
          onSubmit={cal.handleAuditSubmit} onManualFallback={() => cal.setEntry("manual_summary")}
          isSubmitting={cal.isSubmitting} error={cal.error} />
      )}

      {cal.entry === "manual_summary" && (
        <ManualSummaryFallback firstName={cal.firstName} onSubmit={cal.handleManualSummary} isSubmitting={cal.isSubmitting} />
      )}

      {cal.entry === "analyzing" && <AuditProgress />}

      {cal.entry === "wow_summary" && cal.wowSummary && !cal.transitioning && (
        <WowSummary firstName={cal.firstName} wowSummary={cal.wowSummary} editedFields={cal.editedFields}
          editingKey={cal.editingKey} editValue={cal.editValue} setEditValue={cal.setEditValue}
          startEdit={cal.startEdit} commitEdit={cal.commitEdit}
          handleConfirmWow={cal.handleConfirmWow} isSubmitting={cal.isSubmitting} error={cal.error} />
      )}

      {cal.transitioning && <DissolveTransition firstName={cal.firstName} />}

      {/* FLOW GATE: Business Identity Verification */}
      {cal.entry === "approve_identity" && cal.wowSummary && (
        <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-8" data-testid="approve-identity">
          <div className="max-w-xl mx-auto space-y-6">
            <div className="text-center mb-6">
              <h1 className="text-2xl sm:text-3xl font-semibold mb-2" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#F4F7FA' }}>
                Is this your business?
              </h1>
              <p className="text-sm" style={{ color: '#9FB0C3' }}>
                Confirm the details below so BIQc can calibrate accurately.
              </p>
            </div>

            <div className="rounded-xl p-6" style={{ background: '#141C26', border: '1px solid #243140' }}>
              {cal.wowSummary.business_name && (
                <div className="mb-4">
                  <span className="text-[10px] uppercase tracking-wider block mb-1" style={{ color: '#FF6A00', fontFamily: "'JetBrains Mono', monospace" }}>Business Name</span>
                  <span className="text-lg font-semibold text-[#F4F7FA]" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>{cal.wowSummary.business_name}</span>
                </div>
              )}
              <div className="mb-4">
                <span className="text-[10px] uppercase tracking-wider block mb-1" style={{ color: '#64748B', fontFamily: "'JetBrains Mono', monospace" }}>Website</span>
                <span className="text-sm text-[#9FB0C3]">{cal.websiteUrl || 'Not provided'}</span>
              </div>
              {cal.wowSummary.what_you_do && (
                <div className="mb-4">
                  <span className="text-[10px] uppercase tracking-wider block mb-1" style={{ color: '#64748B', fontFamily: "'JetBrains Mono', monospace" }}>What You Do</span>
                  <span className="text-sm text-[#9FB0C3]">{typeof cal.wowSummary.what_you_do === 'string' ? cal.wowSummary.what_you_do.substring(0, 200) : ''}</span>
                </div>
              )}
              {cal.wowSummary.who_you_serve && (
                <div>
                  <span className="text-[10px] uppercase tracking-wider block mb-1" style={{ color: '#64748B', fontFamily: "'JetBrains Mono', monospace" }}>Who You Serve</span>
                  <span className="text-sm text-[#9FB0C3]">{cal.wowSummary.who_you_serve}</span>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <button onClick={cal.handleApproveIdentity}
                className="w-full py-3.5 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 flex items-center justify-center gap-2"
                style={{ background: '#FF6A00' }}
                data-testid="approve-identity-yes">
                <CheckCircle2 className="w-4 h-4" /> Yes, this is my business
              </button>
              <button onClick={cal.handleRejectIdentity}
                className="w-full py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
                style={{ color: '#9FB0C3', border: '1px solid #243140' }}
                data-testid="approve-identity-edit">
                <ArrowLeft className="w-4 h-4" /> Edit details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CMO Snapshot — must view before dashboard */}
      {cal.entry === "intelligence-first" && (
        <ExecutiveCMOSnapshot intelligenceData={cal.intelligenceData} onContinue={cal.proceedFromIntelligence} />
      )}

      {/* PHASE 8: Forensic Calibration UI Shell (premium teaser) */}
      {cal.entry === "forensic" && (
        <ForensicCalibrationUI onSkip={() => cal.proceedFromIntelligence()} />
      )}

      {cal.entry === "completing" && (
        <ExecutiveReveal firstName={cal.firstName} lastResponse={cal.lastResponse} revealPhase={cal.revealPhase} />
      )}

      {cal.entry === "continuity" && (
        <ContinuitySuite firstName={cal.firstName} calStep={cal.calStep} error={cal.error} onResume={cal.startCalibration} />
      )}

      {cal.entry === "calibrating" && (
        <CalibratingSession calMode={cal.calMode} error={cal.error} question={cal.question} options={cal.options}
          allowText={cal.allowText} insight={cal.insight} selectedOption={cal.selectedOption}
          setSelectedOption={cal.setSelectedOption} textValue={cal.textValue} setTextValue={cal.setTextValue}
          isSubmitting={cal.isSubmitting} handleWizardContinue={cal.handleWizardContinue}
          messages={cal.messages} inputValue={cal.inputValue} setInputValue={cal.setInputValue}
          handleChatSubmit={cal.handleChatSubmit}
          currentStep={cal.currentStep} />
      )}
    </div>
  );
};

export default CalibrationAdvisor;
