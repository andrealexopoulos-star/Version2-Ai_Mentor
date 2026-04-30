// ─── IntelligenceDiagram — v4.4 mock-up parity (Andreas 2026-04-30) ─────────
// 4 glossy corner cards orbit a larger central decision-engine card.
// Animated lava-coloured connector dots flow from each card into the engine.
// Engine carries the new BIQc.ai branded logo + "What BIQc is built to do"
// value-pillar summary (Protect / Grow / Operate / Profit).
// Class names scoped with `biqc-diagram-` prefix to avoid collisions.
// All design tokens come from CSS custom properties already defined in prod.

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
        .biqc-diagram-section.biqc-diagram-standalone { padding: 24px 24px 80px; }
        .biqc-diagram-section.biqc-diagram-embedded   { padding: 8px 24px 48px; }

        .biqc-diagram-shell {
          max-width: 1400px;
          margin: 0 auto;
          position: relative;
        }
        .biqc-diagram-grid {
          display: grid;
          grid-template-columns: 1fr 1.55fr 1fr;
          grid-template-rows: 1fr 1fr;
          grid-template-areas:
            "c1 engine c2"
            "c3 engine c4";
          gap: 48px 56px;
          position: relative;
          z-index: 2;
        }
        .biqc-diagram-c1 { grid-area: c1; }
        .biqc-diagram-c2 { grid-area: c2; }
        .biqc-diagram-c3 { grid-area: c3; }
        .biqc-diagram-c4 { grid-area: c4; }
        .biqc-diagram-engine-wrap { grid-area: engine; display: flex; align-items: stretch; }

        /* ═════════════════════════════ GLOSSY GLASS CARD ═════════════════════════════ */
        .biqc-diagram-glass-card {
          position: relative;
          background:
            linear-gradient(155deg, rgba(255,255,255,0.95) 0%, rgba(245,247,240,0.78) 50%, rgba(255,255,255,0.92) 100%);
          border: 1px solid rgba(10,10,10,0.09);
          border-radius: 20px;
          padding: 22px 22px 20px;
          overflow: hidden;
          box-shadow:
            0 1px 2px rgba(10,10,10,0.04),
            0 12px 32px -14px rgba(10,10,10,0.10),
            inset 0 1px 0 rgba(255,255,255,0.95),
            inset 0 -1px 0 rgba(10,10,10,0.04);
          display: flex; flex-direction: column;
          min-height: 256px;
        }
        .biqc-diagram-glass-card::after {
          content: '';
          position: absolute;
          top: 0; left: -50%; right: -50%; bottom: 0;
          background: linear-gradient(75deg,
            transparent 32%,
            rgba(255,255,255,0.6) 47%,
            rgba(232,93,0,0.12) 50%,
            rgba(255,255,255,0.6) 53%,
            transparent 68%);
          animation: biqcDiagramCardSheen 9s ease-in-out infinite;
          pointer-events: none;
          mix-blend-mode: screen;
        }
        .biqc-diagram-c1.biqc-diagram-glass-card::after { animation-delay: 0s; }
        .biqc-diagram-c2.biqc-diagram-glass-card::after { animation-delay: 2.25s; }
        .biqc-diagram-c3.biqc-diagram-glass-card::after { animation-delay: 4.5s; }
        .biqc-diagram-c4.biqc-diagram-glass-card::after { animation-delay: 6.75s; }
        @keyframes biqcDiagramCardSheen {
          0%   { transform: translateX(-30%); opacity: 0; }
          20%  { opacity: 1; }
          60%  { opacity: 0.9; }
          100% { transform: translateX(30%); opacity: 0; }
        }
        .biqc-diagram-card-head {
          display: flex; align-items: center; gap: 10px;
          margin-bottom: 6px;
          position: relative; z-index: 2;
        }
        .biqc-diagram-card-icon {
          width: 32px; height: 32px;
          border-radius: 9px;
          background: var(--lava-wash);
          border: 1px solid rgba(232,93,0,0.22);
          display: flex; align-items: center; justify-content: center;
          color: var(--lava-deep);
          flex-shrink: 0;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.6);
        }
        .biqc-diagram-card-title {
          font-family: var(--font-marketing-display);
          font-size: 19px;
          font-weight: 600;
          letter-spacing: -0.02em;
          color: var(--ink-display);
          margin: 0;
          line-height: 1.2;
        }
        .biqc-diagram-card-sub {
          font-family: var(--font-marketing-ui);
          font-size: 12.5px;
          color: var(--ink-secondary);
          line-height: 1.45;
          margin: 0 0 12px;
          letter-spacing: -0.003em;
          position: relative; z-index: 2;
          font-weight: 500;
        }
        .biqc-diagram-card-bullets {
          list-style: none;
          padding: 0;
          margin: 4px 0 0;
          display: flex; flex-direction: column;
          gap: 9px;
          position: relative; z-index: 2;
        }
        .biqc-diagram-card-bullets li {
          font-family: var(--font-marketing-ui);
          font-size: 12.5px;
          color: var(--ink-secondary);
          line-height: 1.4;
          padding-left: 20px;
          position: relative;
          letter-spacing: -0.003em;
        }
        .biqc-diagram-card-bullets li::before {
          content: '';
          position: absolute;
          left: 1px; top: 5px;
          width: 8px; height: 8px;
          border-radius: 50%;
          background: var(--lava-wash);
          border: 2px solid var(--lava);
        }
        .biqc-diagram-card-bullets li strong { color: var(--ink-display); font-weight: 600; }

        /* ═════════════════════════════ LOGO GRID (Card 2) ═════════════════════════════ */
        .biqc-diagram-logo-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          grid-template-rows: repeat(3, 1fr);
          gap: 8px;
          margin-top: 6px;
          flex: 1;
          position: relative; z-index: 2;
          align-items: center;
        }
        .biqc-diagram-logo-tile {
          position: relative;
          background: rgba(255,255,255,0.85);
          border: 1px solid rgba(10,10,10,0.06);
          border-radius: 11px;
          display: flex; align-items: center; justify-content: center;
          padding: 6px;
          min-height: 48px;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.7);
          animation: biqcDiagramLogoBreathe 9s ease-in-out infinite;
          will-change: transform, box-shadow;
        }
        .biqc-diagram-logo-tile:nth-child(1) { animation-delay: 0s; }
        .biqc-diagram-logo-tile:nth-child(2) { animation-delay: 1s; }
        .biqc-diagram-logo-tile:nth-child(3) { animation-delay: 2s; }
        .biqc-diagram-logo-tile:nth-child(4) { animation-delay: 3s; }
        .biqc-diagram-logo-tile:nth-child(5) { animation-delay: 4s; }
        .biqc-diagram-logo-tile:nth-child(6) { animation-delay: 5s; }
        .biqc-diagram-logo-tile:nth-child(7) { animation-delay: 6s; }
        .biqc-diagram-logo-tile:nth-child(8) { animation-delay: 7s; }
        .biqc-diagram-logo-tile:nth-child(9) { animation-delay: 8s; }
        @keyframes biqcDiagramLogoBreathe {
          0%, 90%, 100% {
            transform: scale(1);
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.7);
            border-color: rgba(10,10,10,0.06);
          }
          4%, 8% {
            transform: scale(1.07);
            box-shadow: 0 6px 18px rgba(232,93,0,0.22), inset 0 1px 0 rgba(255,255,255,0.9);
            border-color: rgba(232,93,0,0.4);
          }
        }
        .biqc-diagram-logo-tile img,
        .biqc-diagram-logo-tile svg.biqc-diagram-brand-svg { width: 28px; height: 28px; }
        .biqc-diagram-logo-tile-text {
          font-family: var(--font-marketing-ui);
          font-size: 10px;
          font-weight: 700;
          color: var(--ink-secondary);
          letter-spacing: 0.01em;
          text-align: center;
          line-height: 1.1;
          white-space: nowrap;
        }

        /* ═════════════════════════════ ENGINE (centre, dominant) ═════════════════════════════ */
        .biqc-diagram-engine {
          width: 100%;
          display: flex; flex-direction: column;
          background:
            radial-gradient(ellipse 140% 50% at 50% 0%, rgba(232,93,0,0.10) 0%, transparent 55%),
            radial-gradient(ellipse 80% 60% at 20% 15%, rgba(125,163,209,0.22) 0%, transparent 55%),
            linear-gradient(155deg, #F5F9FD 0%, #E4EDF7 35%, #DDE9F5 55%, #E8F0F8 75%, #F0F6FB 100%);
          border: 1px solid rgba(125,163,209,0.4);
          border-radius: 28px;
          box-shadow:
            0 0 0 1px rgba(125,163,209,0.12),
            0 14px 36px rgba(125,163,209,0.24),
            0 40px 90px -18px rgba(125,163,209,0.34),
            inset 0 1px 0 rgba(255,255,255,0.9),
            inset 0 -1px 0 rgba(125,163,209,0.2);
          position: relative;
          overflow: hidden;
        }
        .biqc-diagram-engine::before {
          content: '';
          position: absolute; inset: -8px;
          border-radius: 36px;
          background: radial-gradient(circle at 50% 50%, rgba(232,93,0,0.18), transparent 65%);
          opacity: 0.25;
          animation: biqcDiagramEnginePulse 3.8s ease-in-out infinite;
          z-index: -1;
          pointer-events: none;
        }
        .biqc-diagram-engine::after {
          content: '';
          position: absolute;
          top: 0; left: -30%; right: -30%; bottom: 0;
          background: linear-gradient(75deg,
            transparent 35%,
            rgba(255,255,255,0.5) 47%,
            rgba(232,93,0,0.10) 50%,
            rgba(255,255,255,0.5) 53%,
            transparent 65%);
          animation: biqcDiagramLiquidSheen 7s ease-in-out infinite;
          pointer-events: none;
          mix-blend-mode: screen;
        }
        @keyframes biqcDiagramLiquidSheen {
          0%,100% { transform: translateX(-30%); opacity: 0; }
          30%,60% { opacity: 1; }
          100% { transform: translateX(30%); }
        }
        @keyframes biqcDiagramEnginePulse {
          0%,100% { opacity: 0.2; transform: scale(1); }
          50%     { opacity: 0.5; transform: scale(1.025); }
        }
        .biqc-diagram-engine-inner {
          padding: 26px 30px 26px;
          position: relative; z-index: 3;
          display: flex; flex-direction: column;
          flex: 1;
        }
        .biqc-diagram-engine-live {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          margin: 0 auto 14px;
          width: fit-content;
          padding: 6px 14px;
          border-radius: 999px;
          background: rgba(232,93,0,0.12);
          border: 1px solid rgba(232,93,0,0.3);
          font-family: var(--font-mono);
          font-size: 10.5px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: var(--lava-deep);
        }
        .biqc-diagram-engine-live-dot {
          position: relative;
          width: 7px; height: 7px;
          display: inline-flex;
        }
        .biqc-diagram-engine-live-dot::before,
        .biqc-diagram-engine-live-dot::after {
          content: ''; position: absolute; inset: 0;
          border-radius: 50%; background: var(--lava);
        }
        .biqc-diagram-engine-live-dot::before {
          animation: biqcDiagramLivePing 1.6s cubic-bezier(0,0,0.2,1) infinite;
        }
        @keyframes biqcDiagramLivePing {
          0% { opacity: 0.9; transform: scale(0.8); }
          80%,100% { opacity: 0; transform: scale(2.6); }
        }
        .biqc-diagram-engine-logo-wrap {
          display: flex; align-items: center; justify-content: center;
          margin: 4px 0 4px;
        }
        .biqc-diagram-engine-logo {
          height: 88px;
          width: auto;
          filter: drop-shadow(0 6px 16px rgba(232,93,0,0.20));
        }
        .biqc-diagram-engine-tagline-top {
          font-family: var(--font-marketing-display);
          font-style: italic;
          font-weight: 500;
          font-size: 18px;
          text-align: center;
          color: var(--lava);
          margin: 0 0 18px;
          letter-spacing: -0.015em;
          line-height: 1.3;
        }
        .biqc-diagram-engine-divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(125,163,209,0.4), rgba(232,93,0,0.3), rgba(125,163,209,0.4), transparent);
          margin: 0 -4px 18px;
        }
        .biqc-diagram-engine-summary-label {
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.14em;
          color: var(--ink-muted);
          text-align: center;
          margin: 0 0 14px;
        }
        .biqc-diagram-engine-pillars {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin: 0 0 18px;
        }
        .biqc-diagram-engine-pillar {
          display: flex; gap: 10px;
          align-items: flex-start;
          background: rgba(255,255,255,0.55);
          border: 1px solid rgba(125,163,209,0.22);
          border-radius: 12px;
          padding: 10px 12px;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.8);
        }
        .biqc-diagram-engine-pillar-icon {
          width: 28px; height: 28px;
          border-radius: 8px;
          background: linear-gradient(145deg, rgba(232,93,0,0.16), rgba(232,93,0,0.06));
          border: 1px solid rgba(232,93,0,0.3);
          display: flex; align-items: center; justify-content: center;
          color: var(--lava-deep);
          flex-shrink: 0;
          box-shadow: 0 0 6px rgba(232,93,0,0.1), inset 0 1px 0 rgba(255,255,255,0.8);
        }
        .biqc-diagram-engine-pillar-title {
          font-family: var(--font-marketing-ui);
          font-size: 13px;
          font-weight: 700;
          color: var(--ink-display);
          letter-spacing: -0.005em;
          line-height: 1.2;
          margin: 0;
        }
        .biqc-diagram-engine-pillar-sub {
          font-family: var(--font-marketing-ui);
          font-size: 11.5px;
          color: var(--ink-secondary);
          line-height: 1.35;
          margin: 2px 0 0;
        }
        .biqc-diagram-engine-stats {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          padding: 12px 0;
          margin: 0 0 14px;
          border-top: 1px solid rgba(125,163,209,0.28);
          border-bottom: 1px solid rgba(125,163,209,0.28);
        }
        .biqc-diagram-engine-stat { text-align: center; position: relative; }
        .biqc-diagram-engine-stat + .biqc-diagram-engine-stat::before {
          content: '';
          position: absolute;
          left: 0; top: 20%; bottom: 20%;
          width: 1px;
          background: rgba(125,163,209,0.28);
        }
        .biqc-diagram-engine-stat-num {
          font-family: var(--font-marketing-display);
          font-size: 22px;
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
          line-height: 1.4;
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

        /* ═════════════════════════════ CONNECTORS (lava, obvious) ═════════════════════════════ */
        .biqc-diagram-connectors {
          position: absolute;
          inset: 0;
          width: 100%; height: 100%;
          pointer-events: none;
          z-index: 1;
          overflow: visible;
        }
        .biqc-diagram-connector-path {
          stroke: rgba(232,93,0,0.34);
          stroke-width: 2;
          stroke-dasharray: 5 6;
          fill: none;
          stroke-linecap: round;
          filter: drop-shadow(0 0 6px rgba(232,93,0,0.18));
          animation: biqcDiagramConnectorFlow 3s linear infinite;
        }
        @keyframes biqcDiagramConnectorFlow { to { stroke-dashoffset: -22; } }
        .biqc-diagram-signal-dot {
          fill: var(--lava);
          filter: drop-shadow(0 0 8px rgba(232,93,0,0.85)) drop-shadow(0 0 3px rgba(232,93,0,1));
        }

        /* ═════════════════════════════ REDUCED MOTION ═════════════════════════════ */
        @media (prefers-reduced-motion: reduce) {
          .biqc-diagram-engine::before,
          .biqc-diagram-engine::after,
          .biqc-diagram-glass-card::after,
          .biqc-diagram-logo-tile,
          .biqc-diagram-signal-dot,
          .biqc-diagram-connector-path {
            animation: none;
          }
          .biqc-diagram-signal-dot { display: none; }
        }

        /* ═════════════════════════════ RESPONSIVE ═════════════════════════════ */
        @media (max-width: 1100px) {
          .biqc-diagram-grid {
            grid-template-columns: 1fr 1fr;
            grid-template-rows: auto auto auto;
            grid-template-areas:
              "engine engine"
              "c1 c2"
              "c3 c4";
            gap: 24px;
          }
          .biqc-diagram-connectors { display: none; }
        }
        @media (max-width: 640px) {
          .biqc-diagram-grid {
            grid-template-columns: 1fr;
            grid-template-areas:
              "engine"
              "c1"
              "c2"
              "c3"
              "c4";
          }
          .biqc-diagram-engine-pillars { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="biqc-diagram-shell">
        {/* ═══ Connector lines: 4 cards → engine (decorative, ≤1100px hidden) ═══ */}
        <svg
          className="biqc-diagram-connectors"
          viewBox="0 0 1400 700"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <path id="biqc-diagram-path-c1" d="M 360 130 C 480 130, 530 220, 580 280" />
            <path id="biqc-diagram-path-c2" d="M 1040 130 C 920 130, 870 220, 820 280" />
            <path id="biqc-diagram-path-c3" d="M 360 570 C 480 570, 530 480, 580 420" />
            <path id="biqc-diagram-path-c4" d="M 1040 570 C 920 570, 870 480, 820 420" />
          </defs>
          <use className="biqc-diagram-connector-path" href="#biqc-diagram-path-c1" />
          <use className="biqc-diagram-connector-path" href="#biqc-diagram-path-c2" />
          <use className="biqc-diagram-connector-path" href="#biqc-diagram-path-c3" />
          <use className="biqc-diagram-connector-path" href="#biqc-diagram-path-c4" />

          <circle className="biqc-diagram-signal-dot" r="5">
            <animateMotion dur="2.6s" repeatCount="indefinite" begin="0s">
              <mpath xlinkHref="#biqc-diagram-path-c1" />
            </animateMotion>
          </circle>
          <circle className="biqc-diagram-signal-dot" r="4">
            <animateMotion dur="2.6s" repeatCount="indefinite" begin="1.3s">
              <mpath xlinkHref="#biqc-diagram-path-c1" />
            </animateMotion>
          </circle>
          <circle className="biqc-diagram-signal-dot" r="5">
            <animateMotion dur="2.6s" repeatCount="indefinite" begin="0.4s">
              <mpath xlinkHref="#biqc-diagram-path-c2" />
            </animateMotion>
          </circle>
          <circle className="biqc-diagram-signal-dot" r="4">
            <animateMotion dur="2.6s" repeatCount="indefinite" begin="1.7s">
              <mpath xlinkHref="#biqc-diagram-path-c2" />
            </animateMotion>
          </circle>
          <circle className="biqc-diagram-signal-dot" r="5">
            <animateMotion dur="2.6s" repeatCount="indefinite" begin="0.8s">
              <mpath xlinkHref="#biqc-diagram-path-c3" />
            </animateMotion>
          </circle>
          <circle className="biqc-diagram-signal-dot" r="4">
            <animateMotion dur="2.6s" repeatCount="indefinite" begin="2.1s">
              <mpath xlinkHref="#biqc-diagram-path-c3" />
            </animateMotion>
          </circle>
          <circle className="biqc-diagram-signal-dot" r="5">
            <animateMotion dur="2.6s" repeatCount="indefinite" begin="1.2s">
              <mpath xlinkHref="#biqc-diagram-path-c4" />
            </animateMotion>
          </circle>
          <circle className="biqc-diagram-signal-dot" r="4">
            <animateMotion dur="2.6s" repeatCount="indefinite" begin="2.5s">
              <mpath xlinkHref="#biqc-diagram-path-c4" />
            </animateMotion>
          </circle>
        </svg>

        <div className="biqc-diagram-grid">

          {/* ═══ CARD 1: MARKETING SCAN ═══ */}
          <div className="biqc-diagram-c1 biqc-diagram-glass-card">
            <div className="biqc-diagram-card-head">
              <div className="biqc-diagram-card-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M21 21l-4.3-4.3" />
                  <path d="M11 7v4l2.5 2.5" />
                </svg>
              </div>
              <p className="biqc-diagram-card-title">Marketing Scan</p>
            </div>
            <p className="biqc-diagram-card-sub">See where competitors are stealing share — and the moves that close the gap.</p>
            <ul className="biqc-diagram-card-bullets">
              <li><strong>Stop wasting marketing spend</strong> — the channels working, the leaks draining the rest.</li>
              <li><strong>Out-rank rivals</strong> — full SEO, AEO, GA &amp; conversion gap audit.</li>
              <li><strong>A weekly action plan</strong> — exact moves, ranked by impact.</li>
            </ul>
          </div>

          {/* ═══ CARD 2: ALL YOUR SYSTEMS — colour brand logos ═══ */}
          <div className="biqc-diagram-c2 biqc-diagram-glass-card">
            <div className="biqc-diagram-card-head">
              <div className="biqc-diagram-card-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" rx="1.5" />
                  <rect x="14" y="3" width="7" height="7" rx="1.5" />
                  <rect x="3" y="14" width="7" height="7" rx="1.5" />
                  <rect x="14" y="14" width="7" height="7" rx="1.5" />
                </svg>
              </div>
              <p className="biqc-diagram-card-title">All Your Systems</p>
            </div>
            <p className="biqc-diagram-card-sub">100+ business tools and custom integrations — nothing lives in a silo.</p>
            <div className="biqc-diagram-logo-grid">
              <div className="biqc-diagram-logo-tile"><img src="https://cdn.simpleicons.org/hubspot/FF7A59" alt="HubSpot" /></div>
              <div className="biqc-diagram-logo-tile"><img src="https://cdn.simpleicons.org/xero/13B5EA" alt="Xero" /></div>
              <div className="biqc-diagram-logo-tile">
                <svg className="biqc-diagram-brand-svg" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-label="Salesforce">
                  <path fill="#00A1E0" d="M10.006 5.415a4.195 4.195 0 013.045-1.306c1.56 0 2.954.9 3.69 2.205.63-.3 1.35-.45 2.1-.45 2.85 0 5.159 2.34 5.159 5.22s-2.31 5.22-5.176 5.22c-.345 0-.69-.044-1.02-.104a3.75 3.75 0 01-3.3 1.95c-.6 0-1.155-.15-1.65-.375A4.314 4.314 0 018.88 20.4a4.302 4.302 0 01-4.05-2.82c-.27.062-.54.076-.825.076-2.204 0-4.005-1.8-4.005-4.05 0-1.5.811-2.805 2.01-3.51-.255-.57-.39-1.2-.39-1.846 0-2.58 2.1-4.65 4.65-4.65 1.53 0 2.85.705 3.72 1.8" />
                </svg>
              </div>
              <div className="biqc-diagram-logo-tile"><span className="biqc-diagram-logo-tile-text">NetSuite</span></div>
              <div className="biqc-diagram-logo-tile"><img src="https://cdn.simpleicons.org/googleads/4285F4" alt="Google Ads" /></div>
              <div className="biqc-diagram-logo-tile"><img src="https://cdn.simpleicons.org/notion/000000" alt="Notion" /></div>
              <div className="biqc-diagram-logo-tile"><span className="biqc-diagram-logo-tile-text">OneDrive</span></div>
              <div className="biqc-diagram-logo-tile"><img src="https://cdn.simpleicons.org/googledrive/0F9D58" alt="Google Drive" /></div>
              <div className="biqc-diagram-logo-tile"><img src="https://cdn.simpleicons.org/zendesk/03363D" alt="Zendesk" /></div>
            </div>
          </div>

          {/* ═══ CARD 3: ASK BIQc ═══ */}
          <div className="biqc-diagram-c3 biqc-diagram-glass-card">
            <div className="biqc-diagram-card-head">
              <div className="biqc-diagram-card-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                </svg>
              </div>
              <p className="biqc-diagram-card-title">Ask BIQc</p>
            </div>
            <p className="biqc-diagram-card-sub">The CFO question at 9pm — answered with the working shown.</p>
            <ul className="biqc-diagram-card-bullets">
              <li><strong>Stop digging through systems</strong> — ask in plain English; answers from every deal, email and integration.</li>
              <li><strong>Drafts the work</strong> — board reports, SOPs, JDs, schedules — done in seconds.</li>
              <li><strong>Bring your AI memory in</strong> — Claude &amp; ChatGPT context, finally secure.</li>
            </ul>
          </div>

          {/* ═══ CARD 4: ADVISOR CENTRE ═══ */}
          <div className="biqc-diagram-c4 biqc-diagram-glass-card">
            <div className="biqc-diagram-card-head">
              <div className="biqc-diagram-card-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7v6c0 5.5 3.8 10.7 10 12 6.2-1.3 10-6.5 10-12V7L12 2z" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
              </div>
              <p className="biqc-diagram-card-title">Advisor Centre</p>
            </div>
            <p className="biqc-diagram-card-sub">Runs 24/7 across every system you use — and tells you what to fix first.</p>
            <ul className="biqc-diagram-card-bullets">
              <li><strong>Always watching, never sleeping</strong> — across finance, sales, ops, comms &amp; marketing.</li>
              <li><strong>The one thing that matters today</strong> — out of thousands of signals, the priority surfaces — ranked by impact.</li>
              <li><strong>Spots cause, not symptom</strong> — connects what's happening into one clear story.</li>
            </ul>
          </div>

          {/* ═══ CENTRE: BIQc DECISION ENGINE — with value summary ═══ */}
          <div className="biqc-diagram-engine-wrap">
            <div className="biqc-diagram-engine">
              <div className="biqc-diagram-engine-inner">
                <div className="biqc-diagram-engine-live">
                  <span className="biqc-diagram-engine-live-dot" />
                  Live · 9 systems online
                </div>

                <div className="biqc-diagram-engine-logo-wrap">
                  <img className="biqc-diagram-engine-logo" src="/biqc-horizontal-light.svg" alt="BIQc.ai" />
                </div>
                <p className="biqc-diagram-engine-tagline-top">
                  An advisor, a 24/7 operations team,<br />
                  and a profit engine — in one.
                </p>
                <div className="biqc-diagram-engine-divider" />

                <p className="biqc-diagram-engine-summary-label">What BIQc is built to do</p>
                <div className="biqc-diagram-engine-pillars">
                  <div className="biqc-diagram-engine-pillar">
                    <div className="biqc-diagram-engine-pillar-icon">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2L4 6v6c0 5 3 9 8 10 5-1 8-5 8-10V6l-8-4z" />
                      </svg>
                    </div>
                    <div>
                      <p className="biqc-diagram-engine-pillar-title">Protect</p>
                      <p className="biqc-diagram-engine-pillar-sub">Risks, leaks &amp; gaps surfaced before they hit.</p>
                    </div>
                  </div>

                  <div className="biqc-diagram-engine-pillar">
                    <div className="biqc-diagram-engine-pillar-icon">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 17l6-6 4 4 8-8M14 7h7v7" />
                      </svg>
                    </div>
                    <div>
                      <p className="biqc-diagram-engine-pillar-title">Grow</p>
                      <p className="biqc-diagram-engine-pillar-sub">Opportunities ranked, with the next move ready.</p>
                    </div>
                  </div>

                  <div className="biqc-diagram-engine-pillar">
                    <div className="biqc-diagram-engine-pillar-icon">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="9" />
                        <path d="M12 7v5l3 3" />
                      </svg>
                    </div>
                    <div>
                      <p className="biqc-diagram-engine-pillar-title">Operate</p>
                      <p className="biqc-diagram-engine-pillar-sub">24/7 ops team, working in the background.</p>
                    </div>
                  </div>

                  <div className="biqc-diagram-engine-pillar">
                    <div className="biqc-diagram-engine-pillar-icon">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                      </svg>
                    </div>
                    <div>
                      <p className="biqc-diagram-engine-pillar-title">Profit</p>
                      <p className="biqc-diagram-engine-pillar-sub">Strengthens cashflow by lifting margin.</p>
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
                  <strong>No noise.</strong> Just what matters next.
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};

export default IntelligenceDiagram;
