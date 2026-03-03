import { useRef } from 'react';

const MONO = "'JetBrains Mono', monospace";
const INTER = "'Inter', sans-serif";

// Real logos with brand colors — using logo.clearbit.com for actual colored logos
// No blocks, no borders — just logos + colored brand names flowing
const BRANDS = [
  { name: 'HubSpot', domain: 'hubspot.com', color: '#FF7A59' },
  { name: 'Salesforce', domain: 'salesforce.com', color: '#00A1E0' },
  { name: 'Xero', domain: 'xero.com', color: '#13B5EA' },
  { name: 'Stripe', domain: 'stripe.com', color: '#635BFF' },
  { name: 'Slack', domain: 'slack.com', color: '#E01E5A' },
  { name: 'Google', domain: 'google.com', color: '#4285F4' },
  { name: 'Shopify', domain: 'shopify.com', color: '#96BF48' },
  { name: 'Notion', domain: 'notion.so', color: '#FFFFFF' },
  { name: 'Microsoft', domain: 'microsoft.com', color: '#00A4EF' },
  { name: 'QuickBooks', domain: 'quickbooks.intuit.com', color: '#2CA01C' },
  { name: 'Monday', domain: 'monday.com', color: '#FF3D57' },
  { name: 'Asana', domain: 'asana.com', color: '#F06A6A' },
  { name: 'Trello', domain: 'trello.com', color: '#0079BF' },
  { name: 'Zoom', domain: 'zoom.us', color: '#2D8CFF' },
  { name: 'Dropbox', domain: 'dropbox.com', color: '#0061FF' },
  { name: 'Atlassian', domain: 'atlassian.com', color: '#0052CC' },
  { name: 'Zendesk', domain: 'zendesk.com', color: '#03363D' },
  { name: 'Freshworks', domain: 'freshworks.com', color: '#F26522' },
  { name: 'Mailchimp', domain: 'mailchimp.com', color: '#FFE01B' },
  { name: 'Twilio', domain: 'twilio.com', color: '#F22F46' },
  { name: 'Intercom', domain: 'intercom.com', color: '#6AFDEF' },
  { name: 'Calendly', domain: 'calendly.com', color: '#006BFF' },
  { name: 'Airtable', domain: 'airtable.com', color: '#18BFFF' },
  { name: 'ClickUp', domain: 'clickup.com', color: '#7B68EE' },
  { name: 'Pipedrive', domain: 'pipedrive.com', color: '#1A1A1A' },
  { name: 'Canva', domain: 'canva.com', color: '#00C4CC' },
  { name: 'Figma', domain: 'figma.com', color: '#F24E1E' },
  { name: 'Miro', domain: 'miro.com', color: '#FFD02F' },
  { name: 'Loom', domain: 'loom.com', color: '#625DF5' },
  { name: 'GitHub', domain: 'github.com', color: '#FFFFFF' },
  { name: 'Zapier', domain: 'zapier.com', color: '#FF4A00' },
  { name: 'Snowflake', domain: 'snowflake.com', color: '#29B5E8' },
  { name: 'Tableau', domain: 'tableau.com', color: '#E97627' },
  { name: 'AWS', domain: 'aws.amazon.com', color: '#FF9900' },
  { name: 'DocuSign', domain: 'docusign.com', color: '#FFCE00' },
  { name: 'Okta', domain: 'okta.com', color: '#007DC1' },
  { name: 'NetSuite', domain: 'netsuite.com', color: '#B4D0E7' },
  { name: 'Sage', domain: 'sage.com', color: '#00D639' },
  { name: 'SAP', domain: 'sap.com', color: '#0FAAFF' },
  { name: 'ServiceNow', domain: 'servicenow.com', color: '#81B5A1' },
  { name: 'Azure', domain: 'azure.microsoft.com', color: '#0089D6' },
  { name: 'Jira', domain: 'atlassian.com', color: '#0052CC' },
  { name: 'Wrike', domain: 'wrike.com', color: '#08CF65' },
  { name: 'Square', domain: 'squareup.com', color: '#FFFFFF' },
  { name: 'PayPal', domain: 'paypal.com', color: '#003087' },
  { name: 'Gusto', domain: 'gusto.com', color: '#F45D48' },
  { name: 'BambooHR', domain: 'bamboohr.com', color: '#73C41D' },
  { name: 'Workday', domain: 'workday.com', color: '#0875E1' },
  { name: 'ADP', domain: 'adp.com', color: '#D0271D' },
  { name: 'Hootsuite', domain: 'hootsuite.com', color: '#143059' },
  { name: 'Semrush', domain: 'semrush.com', color: '#FF642D' },
  { name: 'HotJar', domain: 'hotjar.com', color: '#FD3A5C' },
  { name: 'Mixpanel', domain: 'mixpanel.com', color: '#7856FF' },
  { name: 'Segment', domain: 'segment.com', color: '#52BD94' },
  { name: 'Datadog', domain: 'datadog.com', color: '#632CA6' },
  { name: 'PagerDuty', domain: 'pagerduty.com', color: '#06AC38' },
  { name: 'Sentry', domain: 'sentry.io', color: '#362D59' },
  { name: 'Braze', domain: 'braze.com', color: '#000000' },
  { name: 'Klaviyo', domain: 'klaviyo.com', color: '#000000' },
  { name: 'Rippling', domain: 'rippling.com', color: '#FED200' },
  { name: 'Deel', domain: 'deel.com', color: '#15357A' },
];

const BrandItem = ({ brand }) => (
  <div className="flex items-center gap-2.5 shrink-0 px-2 group cursor-default">
    <img
      src={`https://logo.clearbit.com/${brand.domain}?size=80`}
      alt={brand.name}
      className="w-7 h-7 sm:w-8 sm:h-8 object-contain"
      loading="lazy"
      onError={e => { e.target.style.display = 'none'; }}
    />
    <span
      className="text-[14px] sm:text-[16px] font-medium whitespace-nowrap transition-opacity group-hover:opacity-100"
      style={{ fontFamily: INTER, color: brand.color, opacity: 0.75 }}
    >
      {brand.name}
    </span>
  </div>
);

export const IntegrationCarousel = () => {
  const mid = Math.ceil(BRANDS.length / 2);
  const row1 = BRANDS.slice(0, mid);
  const row2 = BRANDS.slice(mid);

  return (
    <section className="py-12 sm:py-16 overflow-hidden" style={{ background: '#07121E' }} data-testid="integration-carousel">
      <div className="max-w-5xl mx-auto px-6 mb-10 text-center">
        <span className="text-[11px] sm:text-xs font-medium tracking-widest uppercase" style={{ fontFamily: MONO, color: '#FF7A18' }}>
          500+ Integrations
        </span>
        <p className="text-sm mt-3" style={{ fontFamily: INTER, color: '#A6B2C1', opacity: 0.5, fontWeight: 300 }}>
          Connects to the tools your business already uses
        </p>
      </div>

      <style>{`
        @keyframes scrollLeft {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes scrollRight {
          0% { transform: translateX(-50%); }
          100% { transform: translateX(0); }
        }
        .logo-row-left { animation: scrollLeft 100s linear infinite; }
        .logo-row-right { animation: scrollRight 100s linear infinite; }
        .logo-row-left:hover, .logo-row-right:hover { animation-play-state: paused; }
      `}</style>

      {/* Row 1 — scrolls left, slow */}
      <div className="overflow-hidden mb-6 sm:mb-8">
        <div className="logo-row-left flex gap-8 sm:gap-12" style={{ width: 'max-content' }}>
          {[...row1, ...row1].map((brand, i) => (
            <BrandItem key={`r1-${i}`} brand={brand} />
          ))}
        </div>
      </div>

      {/* Row 2 — scrolls right, slow */}
      <div className="overflow-hidden">
        <div className="logo-row-right flex gap-8 sm:gap-12" style={{ width: 'max-content' }}>
          {[...row2, ...row2].map((brand, i) => (
            <BrandItem key={`r2-${i}`} brand={brand} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default IntegrationCarousel;
