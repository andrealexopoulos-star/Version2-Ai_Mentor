import React from "react";
import { Shield, Search, Target, FileText, CheckCircle2, AlertTriangle, Link2, Clock3 } from "lucide-react";

const CARD = { background: "var(--biqc-bg-card)", border: "1px solid var(--biqc-border)" };

const Pill = ({ children, tone = "default" }) => {
  const styles = {
    default: { color: "#9FB0C3", background: "#1A2430" },
    ok: { color: "#10B981", background: "#10B98118" },
    warn: { color: "#F59E0B", background: "#F59E0B18" },
    accent: { color: "#3B82F6", background: "#3B82F618" },
  };
  const s = styles[tone] || styles.default;
  return (
    <span className="text-[10px] px-2 py-1 rounded-full" style={{ ...s, fontFamily: "monospace" }}>
      {children}
    </span>
  );
};

const StageShell = ({ title, subtitle, icon: Icon, children, cta, onContinue, disabled = false }) => (
  <div className="flex-1 overflow-y-auto" style={{ background: "var(--biqc-bg)" }}>
    <div className="max-w-3xl mx-auto px-4 sm:px-8 py-10 space-y-5">
      <div className="rounded-xl p-6" style={CARD}>
        <div className="flex items-center gap-2 mb-2">
          <Icon className="w-4 h-4 text-[#FF6A00]" />
          <h2 className="text-xl font-semibold text-[#F4F7FA]">{title}</h2>
        </div>
        <p className="text-sm text-[#9FB0C3]">{subtitle}</p>
      </div>
      {children}
      <div className="rounded-xl p-5 flex items-center justify-between gap-3" style={CARD}>
        <p className="text-xs text-[#64748B]">Deterministic output only. No guessed identity. No fabricated social.</p>
        <button
          onClick={onContinue}
          disabled={disabled}
          className="px-8 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 disabled:opacity-40"
          style={{ background: "#FF6A00" }}
        >
          {cta}
        </button>
      </div>
    </div>
  </div>
);

export const WowCardsStage = ({ wowSummary, identitySignals, onContinue }) => {
  const full = wowSummary?._full || {};
  const cards = [
    {
      title: "Identity Integrity",
      icon: Shield,
      headline: identitySignals?.abn_verified ? "Verified legal identity present" : "Identity unresolved but evidence logged",
      detail: `ABN status: ${identitySignals?.abn_status || "not_found"} | Source: ${identitySignals?.abn_source || "gud_api"}`,
      tone: identitySignals?.abn_verified ? "ok" : "warn",
    },
    {
      title: "Digital Presence",
      icon: Search,
      headline: (identitySignals?.social_enrichment?.social_status || "not_detected") === "not_detected" ? "No verified social footprint" : "Multi-source social footprint detected",
      detail: `Status: ${identitySignals?.social_enrichment?.social_status || "not_detected"} | Source: ${identitySignals?.social_enrichment?.source || "search"}`,
      tone: (identitySignals?.social_enrichment?.social_status || "not_detected") === "not_detected" ? "warn" : "ok",
    },
    {
      title: "Positioning Clarity",
      icon: Target,
      headline: full.unique_value_proposition ? "Value proposition detected" : "Value proposition missing",
      detail: full.unique_value_proposition ? String(full.unique_value_proposition).slice(0, 120) : "Insufficient verified data",
      tone: full.unique_value_proposition ? "accent" : "warn",
    },
    {
      title: "Executive Readiness",
      icon: FileText,
      headline: full.cmo_executive_brief ? "Executive narrative available" : "Narrative evidence incomplete",
      detail: full.cmo_executive_brief ? "CMO brief generated from verified sources." : "Insufficient verified data",
      tone: full.cmo_executive_brief ? "ok" : "warn",
    },
  ];

  return (
    <StageShell
      title="Immediate WOW Moment"
      subtitle="Four forensic cards generated from verified identity, social evidence, and website intelligence."
      icon={Target}
      cta="Continue to Deep Narrative"
      onContinue={onContinue}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cards.map((c) => (
          <div key={c.title} className="rounded-xl p-5" style={CARD}>
            <div className="flex items-center gap-2 mb-2">
              <c.icon className="w-4 h-4 text-[#3B82F6]" />
              <span className="text-sm font-semibold text-[#F4F7FA]">{c.title}</span>
            </div>
            <p className="text-sm text-[#9FB0C3] mb-2">{c.headline}</p>
            <p className="text-xs text-[#64748B] mb-3">{c.detail}</p>
            <Pill tone={c.tone}>{c.tone === "ok" ? "Verified" : c.tone === "warn" ? "Attention required" : "Evidence detected"}</Pill>
          </div>
        ))}
      </div>
    </StageShell>
  );
};

export const DeepNarrativeStage = ({ wowSummary, onContinue }) => {
  const full = wowSummary?._full || {};
  const narrative = full.cmo_executive_brief || full.executive_summary || "Insufficient verified data";
  const whyNow = full.main_challenges || "Insufficient verified data";
  return (
    <StageShell
      title="Deep CMO Narrative"
      subtitle="Executive status quo with evidence-based interpretation and no inferred claims."
      icon={FileText}
      cta="Continue to 7/30/90 Roadmap"
      onContinue={onContinue}
    >
      <div className="rounded-xl p-5" style={CARD}>
        <div className="flex items-center gap-2 mb-2">
          <FileText className="w-4 h-4 text-[#3B82F6]" />
          <span className="text-sm font-semibold text-[#F4F7FA]">Executive Narrative</span>
        </div>
        <p className="text-sm text-[#9FB0C3] leading-relaxed">{narrative}</p>
      </div>
      <div className="rounded-xl p-5" style={CARD}>
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />
          <span className="text-sm font-semibold text-[#F4F7FA]">Why This Matters Now</span>
        </div>
        <p className="text-sm text-[#9FB0C3] leading-relaxed">{whyNow}</p>
      </div>
    </StageShell>
  );
};

export const RoadmapStage = ({ wowSummary, onContinue }) => {
  const actions = Array.isArray(wowSummary?._full?.cmo_priority_actions) ? wowSummary._full.cmo_priority_actions : [];
  const a7 = actions[0] || "Insufficient verified data";
  const a30 = actions[1] || "Insufficient verified data";
  const a90 = actions[2] || "Insufficient verified data";
  return (
    <StageShell
      title="7 / 30 / 90 Day Strategic Plan"
      subtitle="Action sequence anchored to verified digital signals and identity context."
      icon={Clock3}
      cta="Continue to Report Generation"
      onContinue={onContinue}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl p-5" style={CARD}>
          <Pill tone="accent">Day 7</Pill>
          <p className="text-sm text-[#9FB0C3] mt-3">{a7}</p>
        </div>
        <div className="rounded-xl p-5" style={CARD}>
          <Pill tone="accent">Day 30</Pill>
          <p className="text-sm text-[#9FB0C3] mt-3">{a30}</p>
        </div>
        <div className="rounded-xl p-5" style={CARD}>
          <Pill tone="accent">Day 90</Pill>
          <p className="text-sm text-[#9FB0C3] mt-3">{a90}</p>
        </div>
      </div>
    </StageShell>
  );
};

export const ReportGenerationStage = ({ isGenerating, reportCount, onGenerate }) => (
  <StageShell
    title="Report Generation"
    subtitle="Persisting monetisable deep CMO report with quota enforcement and PDF linkage."
    icon={CheckCircle2}
    cta={isGenerating ? "Generating..." : "Generate Report and Continue"}
    onContinue={onGenerate}
    disabled={isGenerating}
  >
    <div className="rounded-xl p-5" style={CARD}>
      <div className="flex items-center gap-2 mb-2">
        <Link2 className="w-4 h-4 text-[#3B82F6]" />
        <span className="text-sm font-semibold text-[#F4F7FA]">Conversion Hook</span>
      </div>
      <p className="text-sm text-[#9FB0C3]">
        Report value increases with integrations. Connect email, CRM, and accounting to replace surface-level assumptions with internal performance truth.
      </p>
      <div className="mt-3 flex gap-2 flex-wrap">
        <Pill tone="ok">Persisted reports: {reportCount}</Pill>
        <Pill tone="accent">ABN + Social evidence embedded</Pill>
        <Pill tone="warn">Quota enforced</Pill>
      </div>
    </div>
  </StageShell>
);
