import React from "react";
import { useCalibrationState } from "../hooks/useCalibrationState";
import {
  CalibrationLoading, WelcomeHandshake, ManualSummaryFallback,
  AuditProgress,
} from "../components/calibration/CalibrationComponents";
import { WowSummary, DissolveTransition } from "../components/calibration/WowSummary";
import { ExecutiveReveal } from "../components/calibration/ExecutiveReveal";
import { ContinuitySuite } from "../components/calibration/ContinuitySuite";
import { CalibratingSession } from "../components/calibration/CalibratingSession";

const CREAM = '#FBFBF9';
const CHARCOAL = '#1E293B';
const MUTED = '#64748B';
const CARD_BORDER = '#E8E6E1';

const CalibrationAdvisor = () => {
  const cal = useCalibrationState();

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: CREAM }} data-testid="calibration-page">
      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>

      {cal.entry !== "loading" && cal.user && (
        <div className="flex items-center justify-between px-5 py-2.5" style={{ borderBottom: `1px solid ${CARD_BORDER}` }} data-testid="identity-bar">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ background: '#10B981' }} />
            <span className="text-xs" style={{ color: MUTED }}>
              Signed in as <span style={{ color: CHARCOAL }}>{cal.userEmail}</span>
            </span>
          </div>
          <button onClick={cal.handleSignOut} className="text-xs px-3 py-1 rounded-full transition-colors"
            style={{ color: MUTED, border: `1px solid ${CARD_BORDER}` }} data-testid="sign-out-btn">Sign out</button>
        </div>
      )}

      {cal.entry === "loading" && <CalibrationLoading />}

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
