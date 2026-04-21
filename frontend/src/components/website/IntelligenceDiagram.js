// ─── IntelligenceDiagram — ported from /tmp/biqc-mockups/biqc_homepage_mockup.html ───
// Class names scoped with the `biqc-diagram-` prefix to avoid collisions. All colour
// tokens consumed as CSS custom properties that are already defined in prod by the
// marketing design system (--lava, --canvas-sage, --ink-display, --font-mono, …).
//
// Source fidelity: engine + left systems box + right rotating feature panel +
// SVG connector paths with animated signal dots. Everything else on the homepage
// (hero, customer-logo carousel, what-you-get, footer) lives outside this file.

export const IntelligenceDiagram = ({ embedded = false }) => {
  return (
    <section
      className={`biqc-diagram-section ${embedded ? 'biqc-diagram-embedded' : 'biqc-diagram-standalone'}`}
      data-testid="intelligence-diagram"
    >
      <style>{`
        /* ═════════════════════════════ ROOT ═════════════════════════════ */
        .biqc-diagram-section {
          background: var(--canvas-sage);
          position: relative;
          z-index: 10;
        }
        .biqc-diagram-section.biqc-diagram-standalone {
          padding: 24px 24px 80px;
        }
        .biqc-diagram-section.biqc-diagram-embedded {
          padding: 24px 24px 32px;
        }

        .biqc-diagram-grid {
          display: grid;
          grid-template-columns: 1fr 1.1fr 1fr;
          gap: 24px;
          align-items: start;
          position: relative;
          max-width: 1440px;
          margin: 0 auto;
        }

        /* ═════════════════════════════ SYSTEMS BOX (left column) ═════════════════════════════ */
        .biqc-diagram-systems-box {
          background: linear-gradient(180deg, rgba(255,255,255,0.85) 0%, rgba(242,244,236,0.6) 100%);
          border: 1px solid rgba(10,10,10,0.08);
          border-radius: 20px;
          padding: 22px 20px 20px;
          box-shadow: 0 1px 2px rgba(10,10,10,0.03), 0 8px 24px -12px rgba(10,10,10,0.06);
          position: relative;
        }
        .biqc-diagram-systems-box-eyebrow {
          font-family: var(--font-mono);
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.14em;
          color: var(--ink-muted);
          font-weight: 600;
          margin: 0 0 14px 6px;
        }
        .biqc-diagram-col-left,
        .biqc-diagram-col-right {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 0 8px;
          position: relative;
          z-index: 2;
        }
        .biqc-diagram-col-right { gap: 10px; }
        .biqc-diagram-source-card {
          display: flex;
          align-items: center;
          gap: 20px;
          padding: 10px 6px;
          min-height: 52px;
          transition: transform 0.3s;
        }
        .biqc-diagram-source-card:hover {
          transform: translateX(-2px);
        }
        .biqc-diagram-brand-row {
          display: flex;
          gap: 14px;
          align-items: center;
          flex-shrink: 0;
          width: 170px;
        }
        .biqc-diagram-brand-logo {
          width: 22px;
          height: 22px;
          opacity: 0.78;
          transition: opacity 0.2s, transform 0.2s;
          filter: saturate(0.88);
        }
        .biqc-diagram-brand-logo:hover {
          opacity: 1;
          transform: scale(1.1);
        }
        .biqc-diagram-brand-text {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 22px;
          height: 22px;
          padding: 0 6px;
          border-radius: 5px;
          background: rgba(10,10,10,0.05);
          border: 1px solid rgba(10,10,10,0.08);
          color: var(--ink-secondary, #525252);
          font-family: var(--font-marketing-ui, system-ui), sans-serif;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.01em;
          line-height: 1;
          white-space: nowrap;
          opacity: 0.78;
          transition: opacity 0.2s, transform 0.2s, background 0.2s;
        }
        .biqc-diagram-brand-text:hover {
          opacity: 1;
          transform: scale(1.05);
          background: rgba(10,10,10,0.08);
        }
        .biqc-diagram-source-label {
          font-family: var(--font-marketing-ui);
          font-size: 15px;
          font-weight: 500;
          color: var(--ink-display);
          letter-spacing: -0.005em;
        }

        /* ═════════════════════════════ ENGINE (center column) ═════════════════════════════ */
        .biqc-diagram-engine-wrap {
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding: 24px 18px 0;
          position: relative;
          z-index: 3;
        }
        .biqc-diagram-engine {
          width: 100%;
          max-width: 400px;
          background:
            radial-gradient(ellipse 140% 60% at 50% 0%, rgba(232,93,0,0.08) 0%, transparent 55%),
            radial-gradient(ellipse 80% 60% at 20% 15%, rgba(125,163,209,0.22) 0%, transparent 55%),
            linear-gradient(155deg, #F5F9FD 0%, #E4EDF7 35%, #DDE9F5 55%, #E8F0F8 75%, #F0F6FB 100%);
          border: 1px solid rgba(125,163,209,0.35);
          border-radius: 28px;
          padding: 0;
          box-shadow:
            0 0 0 1px rgba(125,163,209,0.12),
            0 10px 28px rgba(125,163,209,0.18),
            0 32px 72px -18px rgba(125,163,209,0.28),
            inset 0 1px 0 rgba(255,255,255,0.85),
            inset 0 -1px 0 rgba(125,163,209,0.18);
          position: relative;
          overflow: hidden;
        }
        .biqc-diagram-engine::before {
          content: "";
          position: absolute;
          inset: -8px;
          border-radius: 36px;
          background: radial-gradient(circle at 50% 50%, rgba(232,93,0,0.18), transparent 65%);
          opacity: 0.25;
          animation: biqcDiagramEnginePulse 3.8s ease-in-out infinite;
          z-index: -1;
          pointer-events: none;
        }
        .biqc-diagram-engine::after {
          content: "";
          position: absolute;
          top: 0;
          left: -30%;
          right: -30%;
          bottom: 0;
          background: linear-gradient(75deg,
            transparent 35%,
            rgba(125,163,209,0.10) 47%,
            rgba(232,93,0,0.08) 50%,
            rgba(125,163,209,0.10) 53%,
            transparent 65%
          );
          animation: biqcDiagramLiquidSheen 7s ease-in-out infinite;
          pointer-events: none;
        }
        @keyframes biqcDiagramLiquidSheen {
          0%,100% { transform: translateX(-30%); opacity: 0; }
          30%,60% { opacity: 1; }
          100% { transform: translateX(30%); }
        }
        @keyframes biqcDiagramEnginePulse {
          0%,100% { opacity: 0.2; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.025); }
        }

        .biqc-diagram-engine-inner {
          padding: 26px 26px 24px;
          position: relative;
          z-index: 3;
        }

        .biqc-diagram-engine-live {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin: 0 auto 20px;
          width: fit-content;
          padding: 5px 12px;
          border-radius: 999px;
          background: rgba(232,93,0,0.12);
          border: 1px solid rgba(232,93,0,0.3);
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: var(--lava-deep);
        }
        .biqc-diagram-engine-live-dot {
          position: relative;
          width: 6px;
          height: 6px;
          display: inline-flex;
        }
        .biqc-diagram-engine-live-dot::before {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background: var(--lava);
          animation: biqcDiagramLivePing 1.6s cubic-bezier(0,0,0.2,1) infinite;
        }
        .biqc-diagram-engine-live-dot::after {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background: var(--lava);
        }
        @keyframes biqcDiagramLivePing {
          0% { opacity: 0.9; transform: scale(0.8); }
          80%,100% { opacity: 0; transform: scale(2.6); }
        }

        .biqc-diagram-engine-brand {
          font-family: var(--font-marketing-display);
          font-size: 38px;
          font-weight: 700;
          letter-spacing: -0.028em;
          color: var(--ink-display);
          text-align: center;
          margin: 0;
          line-height: 1;
        }
        .biqc-diagram-engine-brand .biqc-diagram-dot { color: var(--lava); }
        .biqc-diagram-engine-brand-sub {
          font-family: var(--font-marketing-display);
          font-style: italic;
          font-weight: 500;
          font-size: 18px;
          text-align: center;
          color: var(--lava);
          margin: 6px 0 22px;
          letter-spacing: -0.015em;
        }
        .biqc-diagram-engine-sparkle {
          color: var(--lava-warm, var(--lava));
          font-size: 14px;
          margin-left: 2px;
        }
        .biqc-diagram-engine-divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(125,163,209,0.4), rgba(232,93,0,0.3), rgba(125,163,209,0.4), transparent);
          margin: 0 -4px 22px;
        }

        .biqc-diagram-engine-steps {
          display: flex;
          flex-direction: column;
          gap: 14px;
          margin: 0 0 22px;
        }
        .biqc-diagram-step {
          display: flex;
          gap: 12px;
          align-items: flex-start;
        }
        .biqc-diagram-step-icon {
          width: 30px;
          height: 30px;
          border-radius: 8px;
          background: linear-gradient(145deg, rgba(232,93,0,0.14), rgba(232,93,0,0.06));
          border: 1px solid rgba(232,93,0,0.28);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--lava-deep);
          flex-shrink: 0;
          box-shadow:
            0 0 6px rgba(232,93,0,0.1),
            inset 0 1px 0 rgba(255,255,255,0.7);
        }
        .biqc-diagram-step-title {
          font-family: var(--font-marketing-ui);
          font-size: 13.5px;
          font-weight: 600;
          color: var(--ink-display);
          line-height: 1.3;
          margin: 0;
          letter-spacing: -0.005em;
        }
        .biqc-diagram-step-sub {
          font-family: var(--font-marketing-ui);
          font-size: 11.5px;
          color: var(--ink-secondary);
          line-height: 1.45;
          margin: 2px 0 0;
        }

        .biqc-diagram-engine-stats {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 0;
          padding: 14px 0;
          margin: 0 0 20px;
          border-top: 1px solid rgba(125,163,209,0.28);
          border-bottom: 1px solid rgba(125,163,209,0.28);
        }
        .biqc-diagram-engine-stat {
          text-align: center;
          position: relative;
        }
        .biqc-diagram-engine-stat + .biqc-diagram-engine-stat::before {
          content: "";
          position: absolute;
          left: 0;
          top: 20%;
          bottom: 20%;
          width: 1px;
          background: rgba(125,163,209,0.28);
        }
        .biqc-diagram-engine-stat-num {
          font-family: var(--font-marketing-display);
          font-size: 20px;
          font-weight: 700;
          color: var(--ink-display);
          letter-spacing: -0.02em;
          line-height: 1;
        }
        .biqc-diagram-engine-stat-label {
          font-family: var(--font-mono);
          font-size: 9px;
          font-weight: 600;
          color: var(--lava-deep);
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin-top: 5px;
        }

        .biqc-diagram-engine-tagline {
          text-align: center;
          font-family: var(--font-marketing-display);
          font-style: italic;
          font-size: 17px;
          line-height: 1.45;
          color: var(--ink-secondary);
          max-width: 320px;
          margin: 0 auto;
        }
        .biqc-diagram-engine-tagline strong {
          color: var(--ink-display);
          font-style: normal;
          font-weight: 600;
          letter-spacing: -0.005em;
        }

        /* ═════════════════════════════ CONNECTORS (animated SVG) ═════════════════════════════ */
        .biqc-diagram-connectors {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 1;
        }
        .biqc-diagram-connector-path {
          stroke: rgba(10,10,10,0.20);
          stroke-width: 1.25;
          stroke-dasharray: 4 5;
          fill: none;
          stroke-linecap: round;
        }
        .biqc-diagram-signal-dot {
          fill: var(--lava);
          filter: drop-shadow(0 0 3px rgba(232,93,0,0.55));
        }
        .biqc-diagram-signal-dot.biqc-diagram-signal-out {
          fill: var(--lava-warm, var(--lava));
        }

        /* ═════════════════════════════ FEATURES BOX (right column) ═════════════════════════════ */
        .biqc-diagram-features-box {
          background: linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(242,244,236,0.55) 100%);
          border: 1px solid rgba(10,10,10,0.08);
          border-radius: 20px;
          padding: 20px 20px 18px;
          box-shadow: 0 1px 2px rgba(10,10,10,0.03), 0 8px 24px -12px rgba(10,10,10,0.06);
          position: relative;
          overflow: hidden;
          min-height: 680px;
        }
        .biqc-diagram-features-box-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin: 0 6px 18px;
        }
        .biqc-diagram-features-box-eyebrow {
          font-family: var(--font-mono);
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.14em;
          color: var(--ink-muted);
          font-weight: 600;
        }
        .biqc-diagram-features-box-counter {
          font-family: var(--font-mono);
          font-size: 9px;
          letter-spacing: 0.12em;
          color: var(--lava-deep);
          font-weight: 600;
        }

        .biqc-diagram-features-stage {
          position: relative;
          min-height: 560px;
          perspective: 1400px;
        }
        .biqc-diagram-feature-panel {
          position: absolute;
          inset: 0;
          opacity: 0;
          transform-origin: center center;
          animation: biqcDiagramFeatureRotate 30s infinite;
          animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
          will-change: opacity, transform;
        }
        .biqc-diagram-feature-panel:nth-child(1) { animation-delay: 0s; }
        .biqc-diagram-feature-panel:nth-child(2) { animation-delay: 10s; }
        .biqc-diagram-feature-panel:nth-child(3) { animation-delay: 20s; }
        @keyframes biqcDiagramFeatureRotate {
          0%, 3%    { opacity: 0; transform: rotateY(-18deg) translateX(15px); }
          8%, 30%   { opacity: 1; transform: rotateY(0deg) translateX(0); }
          35%       { opacity: 1; transform: rotateY(0deg) translateX(0); }
          40%, 100% { opacity: 0; transform: rotateY(18deg) translateX(-15px); }
        }
        .biqc-diagram-features-box:hover .biqc-diagram-feature-panel,
        .biqc-diagram-features-box:hover .biqc-diagram-features-nav-dot {
          animation-play-state: paused;
        }

        .biqc-diagram-feature-panel-head {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 4px;
        }
        .biqc-diagram-feature-panel-icon {
          width: 32px;
          height: 32px;
          border-radius: 9px;
          background: var(--lava-wash);
          border: 1px solid rgba(232,93,0,0.22);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--lava-deep);
          flex-shrink: 0;
        }
        .biqc-diagram-feature-panel-title {
          font-family: var(--font-marketing-display);
          font-size: 22px;
          font-weight: 600;
          letter-spacing: -0.02em;
          color: var(--ink-display);
          margin: 0;
          line-height: 1.15;
        }
        .biqc-diagram-feature-panel-sub {
          font-family: var(--font-marketing-ui);
          font-size: 13px;
          color: var(--ink-secondary);
          line-height: 1.5;
          margin: 10px 0 16px;
        }
        .biqc-diagram-feature-panel-bullets {
          list-style: none;
          padding: 0;
          margin: 14px 0 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .biqc-diagram-feature-panel-bullets li {
          font-family: var(--font-marketing-ui);
          font-size: 13px;
          color: var(--ink-secondary);
          line-height: 1.5;
          padding-left: 22px;
          position: relative;
        }
        .biqc-diagram-feature-panel-bullets li::before {
          content: "";
          position: absolute;
          left: 2px;
          top: 6px;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--lava-wash);
          border: 2px solid var(--lava);
        }
        .biqc-diagram-feature-panel-bullets li strong {
          color: var(--ink-display);
          font-weight: 600;
        }

        /* ═════════════════════════════ MINI UI (inside rotating panels) ═════════════════════════════ */
        .biqc-diagram-mini-ui {
          background: var(--surface, #FFFFFF);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 12px 14px;
          box-shadow: 0 1px 2px rgba(10,10,10,0.03);
        }
        .biqc-diagram-mini-ui-caption {
          font-family: var(--font-mono);
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--ink-muted);
          margin: 0 0 8px;
        }
        .biqc-diagram-mini-comp-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 7px 0;
          border-top: 1px solid rgba(10,10,10,0.05);
        }
        .biqc-diagram-mini-comp-row:first-of-type {
          border-top: none;
        }
        .biqc-diagram-mini-comp-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--lava);
          flex-shrink: 0;
        }
        .biqc-diagram-mini-comp-dot.biqc-diagram-mini-comp-dot-neutral {
          background: var(--ink-muted);
        }
        .biqc-diagram-mini-comp-dot.biqc-diagram-mini-comp-dot-up {
          background: var(--positive, #16A34A);
        }
        .biqc-diagram-mini-comp-name {
          font-family: var(--font-marketing-ui);
          font-size: 12px;
          font-weight: 600;
          color: var(--ink-display);
          flex: 1;
        }
        .biqc-diagram-mini-comp-meta {
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--ink-muted);
        }
        .biqc-diagram-mini-comp-delta {
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 4px;
        }
        .biqc-diagram-mini-comp-delta.biqc-diagram-mini-comp-delta-up {
          color: var(--lava-deep);
          background: var(--lava-wash);
        }
        .biqc-diagram-mini-comp-delta.biqc-diagram-mini-comp-delta-down {
          color: var(--positive, #0F7A3A);
          background: rgba(22,163,74,0.1);
        }

        /* Chat mini UI */
        .biqc-diagram-mini-chat-bubble {
          padding: 9px 12px;
          border-radius: 11px;
          font-family: var(--font-marketing-ui);
          font-size: 12px;
          line-height: 1.45;
          margin-bottom: 8px;
          max-width: 88%;
        }
        .biqc-diagram-mini-chat-bubble.biqc-diagram-mini-chat-user {
          background: var(--canvas-sage);
          color: var(--ink-display);
          margin-left: auto;
          border-bottom-right-radius: 3px;
        }
        .biqc-diagram-mini-chat-bubble.biqc-diagram-mini-chat-biqc {
          background: var(--lava-wash);
          color: var(--ink-display);
          border: 1px solid rgba(232,93,0,0.18);
          border-bottom-left-radius: 3px;
        }
        .biqc-diagram-mini-chat-bubble.biqc-diagram-mini-chat-biqc strong {
          color: var(--lava-deep);
        }
        .biqc-diagram-mini-chat-cite {
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--ink-muted);
          margin-top: 6px;
        }

        /* Split 3-tile */
        .biqc-diagram-mini-split {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 8px;
        }
        .biqc-diagram-mini-tile {
          background: var(--surface, #FFFFFF);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 10px;
          text-align: center;
        }
        .biqc-diagram-mini-tile-icon {
          width: 28px;
          height: 28px;
          margin: 0 auto 6px;
          border-radius: 8px;
          background: var(--lava-wash);
          color: var(--lava-deep);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .biqc-diagram-mini-tile-name {
          font-family: var(--font-marketing-ui);
          font-size: 11px;
          font-weight: 700;
          color: var(--ink-display);
          margin: 0 0 3px;
        }
        .biqc-diagram-mini-tile-desc {
          font-family: var(--font-marketing-ui);
          font-size: 10px;
          color: var(--ink-secondary);
          line-height: 1.35;
        }

        /* Navigation dots */
        .biqc-diagram-features-nav {
          display: flex;
          gap: 8px;
          justify-content: center;
          margin-top: 14px;
          padding-top: 14px;
          border-top: 1px solid rgba(10,10,10,0.06);
        }
        .biqc-diagram-features-nav-dot {
          width: 6px;
          height: 6px;
          border-radius: 999px;
          background: rgba(10,10,10,0.15);
          animation: biqcDiagramDotCycle 30s infinite;
          animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
          will-change: background, width;
        }
        .biqc-diagram-features-nav-dot:nth-child(1) { animation-delay: 0s; }
        .biqc-diagram-features-nav-dot:nth-child(2) { animation-delay: 10s; }
        .biqc-diagram-features-nav-dot:nth-child(3) { animation-delay: 20s; }
        @keyframes biqcDiagramDotCycle {
          0%, 2%    { background: rgba(10,10,10,0.15); width: 6px; }
          5%, 30%   { background: var(--lava); width: 20px; }
          33%, 100% { background: rgba(10,10,10,0.15); width: 6px; }
        }

        /* ═════════════════════════════ RESPONSIVE + REDUCED MOTION ═════════════════════════════ */
        @media (prefers-reduced-motion: reduce) {
          .biqc-diagram-engine::before,
          .biqc-diagram-signal-dot {
            animation: none;
          }
          .biqc-diagram-signal-dot { display: none; }
        }
        @media (max-width: 1100px) {
          .biqc-diagram-grid { grid-template-columns: 1fr; gap: 32px; }
          .biqc-diagram-connectors { display: none; }
        }
      `}</style>

      <div className="biqc-diagram-grid">
        {/* ═══ SVG CONNECTOR PATHS (decorative, hidden ≤1100px) ═══ */}
        <svg
          className="biqc-diagram-connectors"
          viewBox="0 0 1400 820"
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
        >
          <defs>
            <path id="biqc-diagram-p1" d="M 340 50  C 420 50, 480 260, 560 290" />
            <path id="biqc-diagram-p2" d="M 340 115 C 420 115, 480 275, 560 320" />
            <path id="biqc-diagram-p3" d="M 340 180 C 420 180, 480 295, 560 350" />
            <path id="biqc-diagram-p4" d="M 340 245 C 420 245, 480 325, 560 380" />
            <path id="biqc-diagram-p5" d="M 340 310 C 420 310, 480 365, 560 410" />
            <path id="biqc-diagram-p6" d="M 340 375 C 420 375, 480 400, 560 440" />
            <path id="biqc-diagram-p7" d="M 340 440 C 420 440, 480 430, 560 470" />
            <path id="biqc-diagram-p8" d="M 340 505 C 420 505, 480 460, 560 500" />
            <path id="biqc-diagram-p9" d="M 340 570 C 420 570, 480 500, 560 530" />
            <path id="biqc-diagram-r1" d="M 820 290 C 920 290, 980 80,  1060 60" />
            <path id="biqc-diagram-r2" d="M 820 320 C 920 320, 980 150, 1060 140" />
            <path id="biqc-diagram-r3" d="M 820 350 C 920 350, 980 220, 1060 220" />
            <path id="biqc-diagram-r4" d="M 820 380 C 920 380, 980 290, 1060 300" />
            <path id="biqc-diagram-r5" d="M 820 410 C 920 410, 980 360, 1060 380" />
            <path id="biqc-diagram-r6" d="M 820 440 C 920 440, 980 430, 1060 460" />
            <path id="biqc-diagram-r7" d="M 820 470 C 920 470, 980 500, 1060 540" />
            <path id="biqc-diagram-r8" d="M 820 500 C 920 500, 980 570, 1060 620" />
          </defs>
          <use className="biqc-diagram-connector-path" href="#biqc-diagram-p1" />
          <use className="biqc-diagram-connector-path" href="#biqc-diagram-p2" />
          <use className="biqc-diagram-connector-path" href="#biqc-diagram-p3" />
          <use className="biqc-diagram-connector-path" href="#biqc-diagram-p4" />
          <use className="biqc-diagram-connector-path" href="#biqc-diagram-p5" />
          <use className="biqc-diagram-connector-path" href="#biqc-diagram-p6" />
          <use className="biqc-diagram-connector-path" href="#biqc-diagram-p7" />
          <use className="biqc-diagram-connector-path" href="#biqc-diagram-p8" />
          <use className="biqc-diagram-connector-path" href="#biqc-diagram-p9" />
          <use className="biqc-diagram-connector-path" href="#biqc-diagram-r1" />
          <use className="biqc-diagram-connector-path" href="#biqc-diagram-r2" />
          <use className="biqc-diagram-connector-path" href="#biqc-diagram-r3" />
          <use className="biqc-diagram-connector-path" href="#biqc-diagram-r4" />
          <use className="biqc-diagram-connector-path" href="#biqc-diagram-r5" />
          <use className="biqc-diagram-connector-path" href="#biqc-diagram-r6" />
          <use className="biqc-diagram-connector-path" href="#biqc-diagram-r7" />
          <use className="biqc-diagram-connector-path" href="#biqc-diagram-r8" />

          <circle className="biqc-diagram-signal-dot" r="3.5">
            <animateMotion dur="3.2s" repeatCount="indefinite" begin="0s">
              <mpath xlinkHref="#biqc-diagram-p1" />
            </animateMotion>
          </circle>
          <circle className="biqc-diagram-signal-dot" r="3.5">
            <animateMotion dur="3.2s" repeatCount="indefinite" begin="0.35s">
              <mpath xlinkHref="#biqc-diagram-p2" />
            </animateMotion>
          </circle>
          <circle className="biqc-diagram-signal-dot" r="3.5">
            <animateMotion dur="3.2s" repeatCount="indefinite" begin="0.7s">
              <mpath xlinkHref="#biqc-diagram-p3" />
            </animateMotion>
          </circle>
          <circle className="biqc-diagram-signal-dot" r="3.5">
            <animateMotion dur="3.2s" repeatCount="indefinite" begin="1.05s">
              <mpath xlinkHref="#biqc-diagram-p4" />
            </animateMotion>
          </circle>
          <circle className="biqc-diagram-signal-dot" r="3.5">
            <animateMotion dur="3.2s" repeatCount="indefinite" begin="1.4s">
              <mpath xlinkHref="#biqc-diagram-p5" />
            </animateMotion>
          </circle>
          <circle className="biqc-diagram-signal-dot" r="3.5">
            <animateMotion dur="3.2s" repeatCount="indefinite" begin="1.75s">
              <mpath xlinkHref="#biqc-diagram-p6" />
            </animateMotion>
          </circle>
          <circle className="biqc-diagram-signal-dot" r="3.5">
            <animateMotion dur="3.2s" repeatCount="indefinite" begin="2.1s">
              <mpath xlinkHref="#biqc-diagram-p7" />
            </animateMotion>
          </circle>
          <circle className="biqc-diagram-signal-dot" r="3.5">
            <animateMotion dur="3.2s" repeatCount="indefinite" begin="2.45s">
              <mpath xlinkHref="#biqc-diagram-p8" />
            </animateMotion>
          </circle>
          <circle className="biqc-diagram-signal-dot" r="3.5">
            <animateMotion dur="3.2s" repeatCount="indefinite" begin="2.8s">
              <mpath xlinkHref="#biqc-diagram-p9" />
            </animateMotion>
          </circle>

          <circle className="biqc-diagram-signal-dot biqc-diagram-signal-out" r="3.5">
            <animateMotion dur="3.2s" repeatCount="indefinite" begin="1.6s">
              <mpath xlinkHref="#biqc-diagram-r1" />
            </animateMotion>
          </circle>
          <circle className="biqc-diagram-signal-dot biqc-diagram-signal-out" r="3.5">
            <animateMotion dur="3.2s" repeatCount="indefinite" begin="2.0s">
              <mpath xlinkHref="#biqc-diagram-r2" />
            </animateMotion>
          </circle>
          <circle className="biqc-diagram-signal-dot biqc-diagram-signal-out" r="3.5">
            <animateMotion dur="3.2s" repeatCount="indefinite" begin="2.4s">
              <mpath xlinkHref="#biqc-diagram-r3" />
            </animateMotion>
          </circle>
          <circle className="biqc-diagram-signal-dot biqc-diagram-signal-out" r="3.5">
            <animateMotion dur="3.2s" repeatCount="indefinite" begin="2.8s">
              <mpath xlinkHref="#biqc-diagram-r4" />
            </animateMotion>
          </circle>
          <circle className="biqc-diagram-signal-dot biqc-diagram-signal-out" r="3.5">
            <animateMotion dur="3.2s" repeatCount="indefinite" begin="0s">
              <mpath xlinkHref="#biqc-diagram-r5" />
            </animateMotion>
          </circle>
          <circle className="biqc-diagram-signal-dot biqc-diagram-signal-out" r="3.5">
            <animateMotion dur="3.2s" repeatCount="indefinite" begin="0.4s">
              <mpath xlinkHref="#biqc-diagram-r6" />
            </animateMotion>
          </circle>
          <circle className="biqc-diagram-signal-dot biqc-diagram-signal-out" r="3.5">
            <animateMotion dur="3.2s" repeatCount="indefinite" begin="0.8s">
              <mpath xlinkHref="#biqc-diagram-r7" />
            </animateMotion>
          </circle>
          <circle className="biqc-diagram-signal-dot biqc-diagram-signal-out" r="3.5">
            <animateMotion dur="3.2s" repeatCount="indefinite" begin="1.2s">
              <mpath xlinkHref="#biqc-diagram-r8" />
            </animateMotion>
          </circle>
        </svg>

        {/* ═══ LEFT: ALL YOUR SYSTEMS ═══ */}
        <div className="biqc-diagram-col-left">
          <div className="biqc-diagram-systems-box">
            <p className="biqc-diagram-systems-box-eyebrow">All your systems</p>

            <div className="biqc-diagram-source-card">
              <div className="biqc-diagram-brand-row">
                <img className="biqc-diagram-brand-logo" src="https://cdn.simpleicons.org/xero" alt="Xero" />
                <img className="biqc-diagram-brand-logo" src="https://cdn.simpleicons.org/quickbooks" alt="QuickBooks" />
                <img className="biqc-diagram-brand-logo" src="https://cdn.simpleicons.org/intuit" alt="Intuit" />
                <img className="biqc-diagram-brand-logo" src="https://cdn.simpleicons.org/sage" alt="Sage" />
              </div>
              <div className="biqc-diagram-source-label">Accounting</div>
            </div>

            <div className="biqc-diagram-source-card">
              <div className="biqc-diagram-brand-row">
                <img className="biqc-diagram-brand-logo" src="https://cdn.simpleicons.org/gmail" alt="Gmail" />
                <span className="biqc-diagram-brand-text" title="Outlook">Outlook</span>
                <img className="biqc-diagram-brand-logo" src="https://cdn.simpleicons.org/googlecalendar" alt="Calendar" />
                <img className="biqc-diagram-brand-logo" src="https://cdn.simpleicons.org/icloud" alt="iCloud" />
              </div>
              <div className="biqc-diagram-source-label">Email & communications</div>
            </div>

            <div className="biqc-diagram-source-card">
              <div className="biqc-diagram-brand-row">
                <span className="biqc-diagram-brand-text" title="Salesforce">Salesforce</span>
                <img className="biqc-diagram-brand-logo" src="https://cdn.simpleicons.org/hubspot" alt="HubSpot" />
                <span className="biqc-diagram-brand-text" title="Pipedrive">Pipedrive</span>
                <img className="biqc-diagram-brand-logo" src="https://cdn.simpleicons.org/zoho" alt="Zoho" />
              </div>
              <div className="biqc-diagram-source-label">CRM</div>
            </div>

            <div className="biqc-diagram-source-card">
              <div className="biqc-diagram-brand-row">
                <img className="biqc-diagram-brand-logo" src="https://cdn.simpleicons.org/googledrive" alt="Drive" />
                <img className="biqc-diagram-brand-logo" src="https://cdn.simpleicons.org/dropbox" alt="Dropbox" />
                <img className="biqc-diagram-brand-logo" src="https://cdn.simpleicons.org/box" alt="Box" />
                <span className="biqc-diagram-brand-text" title="OneDrive">OneDrive</span>
              </div>
              <div className="biqc-diagram-source-label">File storage</div>
            </div>

            <div className="biqc-diagram-source-card">
              <div className="biqc-diagram-brand-row">
                <span className="biqc-diagram-brand-text" title="BambooHR">BambooHR</span>
                <span className="biqc-diagram-brand-text" title="Workday">Workday</span>
                <img className="biqc-diagram-brand-logo" src="https://cdn.simpleicons.org/gusto" alt="Gusto" />
                <span className="biqc-diagram-brand-text" title="Rippling">Rippling</span>
              </div>
              <div className="biqc-diagram-source-label">HR & payroll</div>
            </div>

            <div className="biqc-diagram-source-card">
              <div className="biqc-diagram-brand-row">
                <img className="biqc-diagram-brand-logo" src="https://cdn.simpleicons.org/zendesk" alt="Zendesk" />
                <img className="biqc-diagram-brand-logo" src="https://cdn.simpleicons.org/intercom" alt="Intercom" />
                <img className="biqc-diagram-brand-logo" src="https://cdn.simpleicons.org/jira" alt="Jira" />
                <span className="biqc-diagram-brand-text" title="Freshworks">Freshworks</span>
              </div>
              <div className="biqc-diagram-source-label">Support tickets</div>
            </div>

            <div className="biqc-diagram-source-card">
              <div className="biqc-diagram-brand-row">
                <img className="biqc-diagram-brand-logo" src="https://cdn.simpleicons.org/notion" alt="Notion" />
                <img className="biqc-diagram-brand-logo" src="https://cdn.simpleicons.org/confluence" alt="Confluence" />
                <span className="biqc-diagram-brand-text" title="SharePoint">SharePoint</span>
                <img className="biqc-diagram-brand-logo" src="https://cdn.simpleicons.org/coda" alt="Coda" />
              </div>
              <div className="biqc-diagram-source-label">Knowledge base</div>
            </div>

            <div className="biqc-diagram-source-card">
              <div className="biqc-diagram-brand-row">
                <span className="biqc-diagram-brand-text" title="Slack">Slack</span>
                <span className="biqc-diagram-brand-text" title="Teams">Teams</span>
                <img className="biqc-diagram-brand-logo" src="https://cdn.simpleicons.org/discord" alt="Discord" />
                <img className="biqc-diagram-brand-logo" src="https://cdn.simpleicons.org/whatsapp" alt="WhatsApp" />
              </div>
              <div className="biqc-diagram-source-label">Team chat</div>
            </div>

            <div className="biqc-diagram-source-card">
              <div className="biqc-diagram-brand-row">
                <img className="biqc-diagram-brand-logo" src="https://cdn.simpleicons.org/googleanalytics" alt="GA" />
                <img className="biqc-diagram-brand-logo" src="https://cdn.simpleicons.org/facebook" alt="FB" />
                <img className="biqc-diagram-brand-logo" src="https://cdn.simpleicons.org/instagram" alt="IG" />
                <span className="biqc-diagram-brand-text" title="LinkedIn">LinkedIn</span>
              </div>
              <div className="biqc-diagram-source-label">Marketing & analytics</div>
            </div>
          </div>
        </div>

        {/* ═══ CENTER: THE ENGINE ═══ */}
        <div className="biqc-diagram-engine-wrap">
          <div className="biqc-diagram-engine">
            <div className="biqc-diagram-engine-inner">

              <div className="biqc-diagram-engine-live">
                <span className="biqc-diagram-engine-live-dot" />
                Live · 9 systems online
              </div>

              <h3 className="biqc-diagram-engine-brand">
                BIQ<span className="biqc-diagram-dot">c</span>.ai<span className="biqc-diagram-engine-sparkle">{'\u2728'}</span>
              </h3>
              <p className="biqc-diagram-engine-brand-sub">The decision engine</p>
              <div className="biqc-diagram-engine-divider" />

              <div className="biqc-diagram-engine-steps">
                <div className="biqc-diagram-step">
                  <div className="biqc-diagram-step-icon">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 5v14M5 12l7 7 7-7" />
                    </svg>
                  </div>
                  <div>
                    <p className="biqc-diagram-step-title">System Ingest</p>
                    <p className="biqc-diagram-step-sub">Connects every tool you run — quietly, in the background.</p>
                  </div>
                </div>

                <div className="biqc-diagram-step">
                  <div className="biqc-diagram-step-icon">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9.5 2A3.5 3.5 0 0 0 6 5.5v13A3.5 3.5 0 0 0 9.5 22h5a3.5 3.5 0 0 0 3.5-3.5v-13A3.5 3.5 0 0 0 14.5 2zM9 7h6M9 12h6M9 17h6" />
                    </svg>
                  </div>
                  <div>
                    <p className="biqc-diagram-step-title">Semantic Reading Engine</p>
                    <p className="biqc-diagram-step-sub">Reads what's actually being said — context, intent, urgency — not just keywords.</p>
                  </div>
                </div>

                <div className="biqc-diagram-step">
                  <div className="biqc-diagram-step-icon">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="6" cy="6" r="2.5" />
                      <circle cx="18" cy="6" r="2.5" />
                      <circle cx="6" cy="18" r="2.5" />
                      <circle cx="18" cy="18" r="2.5" />
                      <path d="M8.2 7.8l7.6 8.4M15.8 7.8l-7.6 8.4" />
                    </svg>
                  </div>
                  <div>
                    <p className="biqc-diagram-step-title">Intelligence Spines</p>
                    <p className="biqc-diagram-step-sub">The connective layer that links Finance, Sales, People & Market signals into one view.</p>
                  </div>
                </div>

                <div className="biqc-diagram-step">
                  <div className="biqc-diagram-step-icon">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 17l6-6 4 4 8-8M14 7h7v7" />
                    </svg>
                  </div>
                  <div>
                    <p className="biqc-diagram-step-title">Action Intelligence</p>
                    <p className="biqc-diagram-step-sub">Weighs your options and ranks the call — with impact and confidence scored.</p>
                  </div>
                </div>

                <div className="biqc-diagram-step">
                  <div className="biqc-diagram-step-icon">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="9" />
                      <circle cx="12" cy="12" r="4" />
                      <path d="M12 3v2M12 19v2M3 12h2M19 12h2" />
                    </svg>
                  </div>
                  <div>
                    <p className="biqc-diagram-step-title">Intelligence Snapshots</p>
                    <p className="biqc-diagram-step-sub">Your whole business, live. Always on.</p>
                  </div>
                </div>
              </div>

              <div className="biqc-diagram-engine-stats">
                <div className="biqc-diagram-engine-stat">
                  <div className="biqc-diagram-engine-stat-num">1,247</div>
                  <div className="biqc-diagram-engine-stat-label">Signals today</div>
                </div>
                <div className="biqc-diagram-engine-stat">
                  <div className="biqc-diagram-engine-stat-num">47</div>
                  <div className="biqc-diagram-engine-stat-label">Decisions ranked</div>
                </div>
                <div className="biqc-diagram-engine-stat">
                  <div className="biqc-diagram-engine-stat-num">2.3s</div>
                  <div className="biqc-diagram-engine-stat-label">Avg response</div>
                </div>
              </div>

              <p className="biqc-diagram-engine-tagline">
                <strong>No noise.</strong><br />Just what matters next.
              </p>
            </div>
          </div>
        </div>

        {/* ═══ RIGHT: WHAT BIQc GIVES YOU (rotating features) ═══ */}
        <div className="biqc-diagram-col-right">
          <div className="biqc-diagram-features-box">
            <div className="biqc-diagram-features-box-header">
              <span className="biqc-diagram-features-box-eyebrow">What BIQc gives you</span>
              <span className="biqc-diagram-features-box-counter">3 features · rotating</span>
            </div>

            <div className="biqc-diagram-features-stage">

              {/* PANEL 1 — Marketing Scan */}
              <div className="biqc-diagram-feature-panel">
                <div className="biqc-diagram-feature-panel-head">
                  <div className="biqc-diagram-feature-panel-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="7" />
                      <path d="M21 21l-4.3-4.3" />
                      <path d="M11 7v4l2.5 2.5" />
                    </svg>
                  </div>
                  <p className="biqc-diagram-feature-panel-title">Marketing Scan</p>
                </div>
                <p className="biqc-diagram-feature-panel-sub">
                  Every move your market makes online leaves a trace. You'll never see all of them yourself. We do — and tell you the ones that actually matter.
                </p>

                <div className="biqc-diagram-mini-ui">
                  <p className="biqc-diagram-mini-ui-caption">Live market signals · last 24h</p>
                  <div className="biqc-diagram-mini-comp-row">
                    <span className="biqc-diagram-mini-comp-dot" />
                    <span className="biqc-diagram-mini-comp-name">New landing page detected</span>
                    <span className="biqc-diagram-mini-comp-meta">Direct rival · your category</span>
                    <span className="biqc-diagram-mini-comp-delta biqc-diagram-mini-comp-delta-up">+23% traffic</span>
                  </div>
                  <div className="biqc-diagram-mini-comp-row">
                    <span className="biqc-diagram-mini-comp-dot biqc-diagram-mini-comp-dot-neutral" />
                    <span className="biqc-diagram-mini-comp-name">Google Ads spend lifted</span>
                    <span className="biqc-diagram-mini-comp-meta">Your bidded keywords</span>
                    <span className="biqc-diagram-mini-comp-delta biqc-diagram-mini-comp-delta-up">+A$4.2K wk</span>
                  </div>
                  <div className="biqc-diagram-mini-comp-row">
                    <span className="biqc-diagram-mini-comp-dot biqc-diagram-mini-comp-dot-up" />
                    <span className="biqc-diagram-mini-comp-name">Meta campaign paused</span>
                    <span className="biqc-diagram-mini-comp-meta">Indirect rival · retail</span>
                    <span className="biqc-diagram-mini-comp-delta biqc-diagram-mini-comp-delta-down">{'\u2212'}18% reach</span>
                  </div>
                </div>

                <ul className="biqc-diagram-feature-panel-bullets">
                  <li><strong>Every move, captured live</strong> — Intelligence Snapshots log the day rivals launch, pause, or pivot.</li>
                  <li><strong>Spend benchmarks, not gut feel</strong> — what your closest rival spent this week, across every channel.</li>
                  <li><strong>Quiet until it matters</strong> — you only hear about what actually changes your week.</li>
                </ul>
              </div>

              {/* PANEL 2 — Ask BIQc */}
              <div className="biqc-diagram-feature-panel">
                <div className="biqc-diagram-feature-panel-head">
                  <div className="biqc-diagram-feature-panel-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                    </svg>
                  </div>
                  <p className="biqc-diagram-feature-panel-title">Ask BIQc</p>
                </div>
                <p className="biqc-diagram-feature-panel-sub">
                  The questions you'd ask a CFO at 9pm, if you had one. Ask them here instead — in plain language, with the working shown.
                </p>

                <div className="biqc-diagram-mini-ui">
                  <p className="biqc-diagram-mini-ui-caption">Live conversation</p>
                  <div className="biqc-diagram-mini-chat-bubble biqc-diagram-mini-chat-user">
                    Why did revenue drop 8% last month?
                  </div>
                  <div className="biqc-diagram-mini-chat-bubble biqc-diagram-mini-chat-biqc">
                    Three things going on, in order of impact. <strong>A$47K is sitting in deals that stalled at proposal stage</strong> — I'd start there tonight. <strong>Customer X churned quietly</strong>, no warning from the CRM. And your <strong>Q1 onboarding lag</strong> is now showing up in expansion revenue. Want me to draft the first follow-up?
                    <div className="biqc-diagram-mini-chat-cite">Reasoned across HubSpot · Xero · Gmail threads · Intercom · Semantic Reading Engine</div>
                  </div>
                </div>

                <ul className="biqc-diagram-feature-panel-bullets">
                  <li><strong>Plain language in, evidence out</strong> — no SQL, no dashboards, no two-week analyst queue.</li>
                  <li><strong>Reads the whole business</strong> — our Semantic Reading Engine interprets invoices, emails, and tickets, not just tables.</li>
                  <li><strong>Cited, not guessed</strong> — every answer links back to the exact records it used.</li>
                </ul>
              </div>

              {/* PANEL 3 — Warroom · Boardroom · Automation */}
              <div className="biqc-diagram-feature-panel">
                <div className="biqc-diagram-feature-panel-head">
                  <div className="biqc-diagram-feature-panel-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <path d="M3 9h18M9 21V9" />
                    </svg>
                  </div>
                  <p className="biqc-diagram-feature-panel-title">Warroom · Boardroom · Automation</p>
                </div>
                <p className="biqc-diagram-feature-panel-sub">Crisis. Strategy. Day-to-day. BIQc runs with you in all three.</p>

                <div className="biqc-diagram-mini-split">
                  <div className="biqc-diagram-mini-tile">
                    <div className="biqc-diagram-mini-tile-icon">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 9v4M12 17h.01M10.3 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                      </svg>
                    </div>
                    <p className="biqc-diagram-mini-tile-name">Warroom</p>
                    <p className="biqc-diagram-mini-tile-desc">One triage list when it's on fire. Intelligence Spines trace every move.</p>
                  </div>
                  <div className="biqc-diagram-mini-tile">
                    <div className="biqc-diagram-mini-tile-icon">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="7" width="20" height="14" rx="2" />
                        <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" />
                      </svg>
                    </div>
                    <p className="biqc-diagram-mini-tile-name">Boardroom</p>
                    <p className="biqc-diagram-mini-tile-desc">Board packs pre-drafted from live Intelligence Snapshots.</p>
                  </div>
                  <div className="biqc-diagram-mini-tile">
                    <div className="biqc-diagram-mini-tile-icon">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
                      </svg>
                    </div>
                    <p className="biqc-diagram-mini-tile-name">Automation</p>
                    <p className="biqc-diagram-mini-tile-desc">SOPs, digests, GA watching — handled by Action Intelligence.</p>
                  </div>
                </div>

                <ul className="biqc-diagram-feature-panel-bullets">
                  <li><strong>Nothing slips</strong> — every open thread accounted for, with the name and the deadline.</li>
                  <li><strong>Ready before the meeting</strong> — walk in with numbers already drafted, not pulled last night.</li>
                  <li><strong>Runs in the background</strong> — small tasks handled before they become problems.</li>
                </ul>
              </div>

            </div>

            <div className="biqc-diagram-features-nav">
              <span className="biqc-diagram-features-nav-dot" />
              <span className="biqc-diagram-features-nav-dot" />
              <span className="biqc-diagram-features-nav-dot" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default IntelligenceDiagram;
