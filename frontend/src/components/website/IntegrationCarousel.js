const MONO = "'JetBrains Mono', monospace";
const INTER = "'Inter', sans-serif";

// Actual brand logos via logo.clearbit.com — displayed as images only, no text blocks
const BRANDS_ROW1 = [
  'hubspot.com','salesforce.com','xero.com','stripe.com','slack.com','google.com',
  'shopify.com','notion.so','microsoft.com','quickbooks.intuit.com','monday.com',
  'asana.com','trello.com','zoom.us','dropbox.com','atlassian.com','zendesk.com',
  'freshworks.com','mailchimp.com','twilio.com','intercom.com','calendly.com',
  'airtable.com','clickup.com','pipedrive.com','canva.com','figma.com','miro.com',
  'github.com','zapier.com',
];

const BRANDS_ROW2 = [
  'snowflake.com','tableau.com','aws.amazon.com','docusign.com','okta.com',
  'netsuite.com','sage.com','sap.com','servicenow.com','azure.microsoft.com',
  'wrike.com','squareup.com','paypal.com','gusto.com','bamboohr.com','workday.com',
  'adp.com','hootsuite.com','semrush.com','hotjar.com','mixpanel.com','segment.com',
  'datadog.com','pagerduty.com','sentry.io','braze.com','klaviyo.com','rippling.com',
  'deel.com','loom.com',
];

const LogoImg = ({ domain }) => (
  <img
    src={`https://logo.clearbit.com/${domain}?size=80`}
    alt={domain.split('.')[0]}
    className="h-8 sm:h-10 w-auto object-contain shrink-0 opacity-70 hover:opacity-100 transition-opacity duration-300"
    loading="lazy"
    onError={e => { e.target.style.display = 'none'; }}
  />
);

export const IntegrationCarousel = () => (
  <section className="py-14 sm:py-20 overflow-hidden" style={{ background: '#07121E' }} data-testid="integration-carousel">
    <div className="max-w-5xl mx-auto px-6 mb-12 text-center">
      <span className="text-[11px] sm:text-xs font-medium tracking-widest uppercase" style={{ fontFamily: MONO, color: '#FF7A18' }}>
        500+ Integrations
      </span>
      <p className="text-sm sm:text-base mt-3" style={{ fontFamily: INTER, color: '#A6B2C1', opacity: 0.45, fontWeight: 300 }}>
        Connects to the tools your business already uses
      </p>
    </div>

    <style>{`
      @keyframes scrollLeft { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
      @keyframes scrollRight { 0% { transform: translateX(-50%); } 100% { transform: translateX(0); } }
      .logo-scroll-left { animation: scrollLeft 120s linear infinite; }
      .logo-scroll-right { animation: scrollRight 120s linear infinite; }
      .logo-scroll-left:hover, .logo-scroll-right:hover { animation-play-state: paused; }
    `}</style>

    {/* Row 1 — slow left scroll */}
    <div className="overflow-hidden mb-8 sm:mb-12">
      <div className="logo-scroll-left flex items-center gap-12 sm:gap-16" style={{ width: 'max-content' }}>
        {[...BRANDS_ROW1, ...BRANDS_ROW1].map((d, i) => <LogoImg key={`a-${i}`} domain={d} />)}
      </div>
    </div>

    {/* Row 2 — slow right scroll */}
    <div className="overflow-hidden">
      <div className="logo-scroll-right flex items-center gap-12 sm:gap-16" style={{ width: 'max-content' }}>
        {[...BRANDS_ROW2, ...BRANDS_ROW2].map((d, i) => <LogoImg key={`b-${i}`} domain={d} />)}
      </div>
    </div>
  </section>
);

export default IntegrationCarousel;
