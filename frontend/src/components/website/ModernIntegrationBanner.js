import React from 'react';
import { getBrandColor } from './BrandLogos';
import { fontFamily } from '../../design-system/tokens';

const TRACK_A = [
  'HubSpot', 'Salesforce', 'Xero', 'Stripe', 'Slack', 'Google', 'Shopify', 'QuickBooks',
];

const TRACK_B = [
  'Notion', 'Microsoft', 'AWS', 'DocuSign', 'Snowflake', 'Tableau', 'Monday', 'Asana', 'Zoom', 'Dropbox',
];

const ICON_SLUGS = {
  HubSpot: 'hubspot',
  Salesforce: 'salesforce',
  Xero: 'xero',
  Stripe: 'stripe',
  Slack: 'slack',
  Google: 'google',
  Shopify: 'shopify',
  QuickBooks: 'intuit',
  Notion: 'notion',
  Microsoft: 'microsoft',
  AWS: 'amazonaws',
  DocuSign: 'docusign',
  Snowflake: 'snowflake',
  Tableau: 'tableau',
  Monday: 'mondaydotcom',
  Asana: 'asana',
  Zoom: 'zoom',
  Dropbox: 'dropbox',
};

const LogoChip = ({ name }) => (
  <div
    className="integration-chip flex items-center gap-2.5 shrink-0"
    style={{
      minWidth: 132,
      height: 52,
      padding: '0 14px',
      borderRadius: 14,
      border: '1px solid rgba(91,143,168,0.24)',
      background: 'linear-gradient(145deg, rgba(20,28,38,0.9), rgba(15,23,32,0.88))',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
    }}
  >
    <img
      src={`https://cdn.simpleicons.org/${ICON_SLUGS[name] || 'google'}`}
      alt={`${name} logo`}
      width="18"
      height="18"
      style={{ filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.18))' }}
      onError={(event) => {
        event.currentTarget.style.display = 'none';
      }}
    />
    <span className="text-xs font-medium" style={{ color: getBrandColor(name), fontFamily: fontFamily.body }}>
      {name}
    </span>
  </div>
);

export const ModernIntegrationBanner = () => (
  <section className="py-14 sm:py-18 overflow-hidden" style={{ background: '#0B1120' }} data-testid="modern-integration-banner">
    <style>{`
      @keyframes modernTrackLeft {
        0% { transform: translateX(0); }
        100% { transform: translateX(-50%); }
      }
      @keyframes modernTrackRight {
        0% { transform: translateX(-50%); }
        100% { transform: translateX(0); }
      }
      @keyframes modernGlowPulse {
        0%,100% { opacity: 0.55; transform: scale(1); }
        50% { opacity: 0.95; transform: scale(1.08); }
      }
      .modern-track-left { animation: modernTrackLeft 24s linear infinite; }
      .modern-track-right { animation: modernTrackRight 28s linear infinite; }
      .modern-track-left:hover, .modern-track-right:hover { animation-play-state: paused; }
      .integration-chip:hover {
        border-color: rgba(198,95,46,0.38) !important;
        transform: translateY(-1px);
        transition: transform 180ms ease, border-color 180ms ease;
      }
      @media (prefers-reduced-motion: reduce) {
        .modern-track-left, .modern-track-right { animation: none !important; }
      }
    `}</style>

    <div className="max-w-6xl mx-auto px-6 mb-9 text-center">
      <p className="text-[11px] uppercase tracking-[0.18em]" style={{ color: '#C65F2E', fontFamily: fontFamily.mono }}>
        Integrations
      </p>
      <h3 className="mt-2 text-2xl sm:text-3xl font-semibold" style={{ color: '#EDF1F7', fontFamily: fontFamily.display }}>
        One connection layer across your operating stack.
      </h3>
      <p className="mt-3 text-sm sm:text-base max-w-2xl mx-auto" style={{ color: '#8FA0B8', fontFamily: fontFamily.body }}>
        BIQc ingests signal from finance, sales, operations, and communication tools so Soundboard can reason on live evidence.
      </p>
    </div>

    <div className="relative max-w-6xl mx-auto px-2 sm:px-6">
      <div
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 -top-4 h-24 w-[70%]"
        style={{ background: 'radial-gradient(ellipse, rgba(91,143,168,0.2), transparent 70%)' }}
      />
      <div
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-12 h-28 w-[55%]"
        style={{
          borderRadius: '999px',
          background: 'radial-gradient(ellipse, rgba(198,95,46,0.2), transparent 70%)',
          animation: 'modernGlowPulse 6s ease-in-out infinite',
        }}
      />

      <div className="overflow-hidden rounded-2xl border p-4 sm:p-5" style={{ borderColor: 'rgba(36,49,64,0.8)', background: 'rgba(11,16,24,0.65)' }}>
        <div className="overflow-hidden mb-3">
          <div className="modern-track-left flex items-center gap-3" style={{ width: 'max-content' }}>
            {[...TRACK_A, ...TRACK_A].map((name, idx) => <LogoChip key={`a-${idx}`} name={name} />)}
          </div>
        </div>
        <div className="overflow-hidden">
          <div className="modern-track-right flex items-center gap-3" style={{ width: 'max-content' }}>
            {[...TRACK_B, ...TRACK_B].map((name, idx) => <LogoChip key={`b-${idx}`} name={name} />)}
          </div>
        </div>
      </div>
    </div>
  </section>
);

export default ModernIntegrationBanner;
