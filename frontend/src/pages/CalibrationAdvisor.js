import React, { useState, useCallback, useEffect } from "react";
import { useCalibrationState } from "../hooks/useCalibrationState";
import { useSupabaseAuth } from "../context/SupabaseAuthContext";
import { useSearchParams } from "react-router-dom";
import { apiClient } from "../lib/api";
import {
  CalibrationLoading, WelcomeHandshake, ManualSummaryFallback,
  AuditProgress,
} from "../components/calibration/CalibrationComponents";
import { WowSummary, DissolveTransition } from "../components/calibration/WowSummary";
import ChiefMarketingSummary from "../components/calibration/ChiefMarketingSummary";
import PostCMOIntegrationOverlay from "../components/calibration/PostCMOIntegrationOverlay";
import AgentCalibrationChat from "../components/calibration/AgentCalibrationChat";
import ForensicIdentityCard from "../components/calibration/ForensicIdentityCard";
import { ExecutiveReveal } from "../components/calibration/ExecutiveReveal";
import { ContinuitySuite } from "../components/calibration/ContinuitySuite";
import { CalibratingSession } from "../components/calibration/CalibratingSession";
import { CalibrationTutorial } from "../components/TutorialOverlay";
import { CognitiveIgnitionScreen } from "../components/CognitiveLoadingScreen";
import { ExecutiveCMOSnapshot, ForensicCalibrationUI } from "../components/calibration/IntelligencePhases";
import { SkipForward, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

const CREAM = '#0F1720';
const CHARCOAL = '#F4F7FA';
const MUTED = '#9FB0C3';
const CARD_BORDER = '#243140';

const CalibrationAdvisor = () => {
  const cal = useCalibrationState();
  const { user, clearBootstrapCache } = useSupabaseAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [skipping, setSkipping] = useState(false);

  const isSuperAdmin = user?.role === 'superadmin' || user?.role === 'admin' || user?.email === 'andre@thestrategysquad.com.au';

  // Handle OAuth return from email connect — resume at integration_connect step
  useEffect(() => {
    const step = searchParams.get('step');
    const outlookConnected = searchParams.get('outlook_connected');
    const gmailConnected = searchParams.get('gmail_connected');

    if (step === 'integration_connect' && cal.entry !== 'integration_connect' && cal.entry !== 'loading') {
      if (outlookConnected === 'true') toast.success('Outlook connected! Continue to your intelligence.');
      if (gmailConnected === 'true') toast.success('Gmail connected! Continue to your intelligence.');
      setSearchParams({});
      cal.setEntry('integration_connect');
    }
  }, [searchParams, cal.entry]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSkipCalibration = async () => {
    setSkipping(true);
    try {
      await apiClient.post('/calibration/skip');
      try { clearBootstrapCache(); } catch {}
      window.location.href = '/advisor';
    } catch {
      setSkipping(false);
    }
  };

  const handleIgnitionComplete = useCallback(() => {
    cal.setEntry("welcome");
  }, [cal]);

  const tutorialKey = cal.entry === 'welcome' ? 'calibration-welcome'
    : (cal.entry === 'calibrating') ? 'calibration-chat'
    : (cal.entry === 'wow_summary') ? 'calibration-wow'
    : null;

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: CREAM }} data-testid="calibration-page">
      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>

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
                    style={{ color: 'var(--biqc-text-2)', border: '1px solid var(--biqc-border)' }} data-testid="admin-back-btn">
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

      {cal.entry === "analyzing" && <AuditProgress onManualFallback={() => cal.setEntry('manual_summary')} />}

      {/* ═══ PHASE 3: Forensic Identity Verification (BEFORE footprint report) ═══ */}
      {cal.entry === "identity_verification" && cal.identitySignals && (
        <ForensicIdentityCard
          identitySignals={cal.identitySignals}
          websiteUrl={cal.websiteUrl}
          onConfirm={cal.handleConfirmIdentity}
          onRegenerate={cal.handleRegenerateIdentity}
          onReject={cal.handleRejectIdentity}
          isRegenerating={cal.isRegenerating}
          onAbnLookup={cal.handleAbnLookup}
        />
      )}

      {/* ═══ PHASE 4: Chief Marketing Summary (CMO Report) ═══ */}
      {cal.entry === "wow_summary" && cal.identityConfirmed && !cal.transitioning && (
        cal.wowSummary ? (
          <ChiefMarketingSummary
            wowSummary={cal.wowSummary}
            onConfirm={cal.handleConfirmWow}
            isSubmitting={cal.isSubmitting}
            identityConfidence={cal.identityConfidence}
          />
        ) : (
          /* Fallback: scan returned no data — use manual summary then proceed */
          <ManualSummaryFallback
            firstName={cal.firstName}
            onSubmit={async (summary) => {
              await cal.handleManualSummary(summary);
              cal.setEntry("wow_summary");
            }}
            isSubmitting={cal.isSubmitting}
          />
        )
      )}

      {/* ═══ PHASE 4b: Agent Calibration Chat (builds personalised AI agent) ═══ */}
      {cal.entry === "agent_calibration" && (
        <AgentCalibrationChat
          callEdge={cal.callEdge}
          firstName={cal.firstName}
          onComplete={cal.handleAgentCalibrationComplete}
        />
      )}

      {cal.entry === "integration_connect" && (
        <PostCMOIntegrationOverlay
          firstName={cal.firstName}
          onSkip={() => cal.setEntry('intelligence-first')}
          onComplete={() => cal.setEntry('intelligence-first')}
        />
      )}

      {cal.transitioning && <DissolveTransition firstName={cal.firstName} />}

      {/* ═══ PHASE 5: Executive CMO Snapshot — "Here's What BIQc Found" ═══ */}
      {cal.entry === "intelligence-first" && (
        <ExecutiveCMOSnapshot intelligenceData={cal.intelligenceData} onContinue={cal.proceedFromIntelligence} />
      )}

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
