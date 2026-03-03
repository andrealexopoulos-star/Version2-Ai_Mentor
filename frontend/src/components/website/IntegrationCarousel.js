import { useEffect, useRef } from 'react';

const MONO = "'JetBrains Mono', monospace";

// 80+ real companies — logos fetched via logo.clearbit.com
const COMPANIES = [
  'xero.com','hubspot.com','salesforce.com','stripe.com','shopify.com','quickbooks.intuit.com',
  'myob.com','slack.com','asana.com','monday.com','notion.so','trello.com',
  'microsoft.com','google.com','zoom.us','dropbox.com','box.com','atlassian.com',
  'zendesk.com','freshworks.com','pipedrive.com','mailchimp.com','sendgrid.com',
  'twilio.com','intercom.com','drift.com','calendly.com','typeform.com',
  'airtable.com','clickup.com','basecamp.com','wrike.com','teamwork.com',
  'harvest.harvestapp.com','toggl.com','freshbooks.com','wave.com','gusto.com',
  'bamboohr.com','workday.com','adp.com','paylocity.com','paychex.com',
  'square.com','paypal.com','braintreepayments.com','afterpay.com',
  'canva.com','figma.com','miro.com','loom.com','vidyard.com',
  'hootsuite.com','buffer.com','sproutsocial.com','semrush.com','ahrefs.com',
  'hotjar.com','mixpanel.com','amplitude.com','segment.com','heap.io',
  'datadog.com','pagerduty.com','opsgenie.com','statuspage.io',
  'github.com','gitlab.com','bitbucket.org','jira.atlassian.com',
  'zapier.com','make.com','tray.io','workato.com',
  'snowflake.com','tableau.com','looker.com','powerbi.com',
  'aws.amazon.com','cloud.google.com','azure.microsoft.com',
  'docusign.com','pandadoc.com','hellosign.com',
  'surveymonkey.com','qualtrics.com','delighted.com',
  'recurly.com','chargebee.com','zuora.com',
  'gong.io','chorus.ai','outreach.io','salesloft.com',
  'linkedin.com','facebook.com','instagram.com','twitter.com',
  'yelp.com','trustpilot.com','g2.com','capterra.com',
  'cloudflare.com','fastly.com','vercel.com','netlify.com',
  'sentry.io','launchdarkly.com','split.io',
  'braze.com','iterable.com','customer.io','klaviyo.com',
  'okta.com','auth0.com','onelogin.com',
  'netsuite.com','sage.com','sap.com','oracle.com',
  'coupa.com','procurify.com','tipalti.com',
  'lever.co','greenhouse.io','workable.com','breezy.hr',
  'rippling.com','deel.com','remote.com','oysterhr.com',
];

const LogoItem = ({ domain }) => {
  const name = domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1);
  return (
    <div
      className="flex items-center justify-center shrink-0 rounded-lg group"
      style={{
        width: 88, height: 44,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <img
        src={`https://logo.clearbit.com/${domain}?size=64`}
        alt={name}
        className="max-w-[52px] max-h-[28px] object-contain opacity-40 group-hover:opacity-80 transition-opacity"
        loading="lazy"
        onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }}
      />
      <span className="text-[9px] text-[#9FB0C3]/30 hidden" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{name}</span>
    </div>
  );
};

export const IntegrationCarousel = () => {
  const row1Ref = useRef(null);
  const row2Ref = useRef(null);

  // Split into 2 rows
  const mid = Math.ceil(COMPANIES.length / 2);
  const row1 = COMPANIES.slice(0, mid);
  const row2 = COMPANIES.slice(mid);

  useEffect(() => {
    // CSS animation handles the scroll — no JS timers needed
  }, []);

  return (
    <section className="py-10 sm:py-14 overflow-hidden" style={{ background: '#0F1720' }} data-testid="integration-carousel">
      <div className="max-w-5xl mx-auto px-6 mb-8 text-center">
        <span className="text-[11px] sm:text-xs font-medium tracking-widest uppercase text-[#FF6A00]" style={{ fontFamily: MONO }}>
          500+ Integrations
        </span>
        <p className="text-sm text-[#9FB0C3]/50 mt-2" style={{ fontFamily: MONO }}>
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
        .carousel-row-left { animation: scrollLeft 60s linear infinite; }
        .carousel-row-right { animation: scrollRight 60s linear infinite; }
        .carousel-row-left:hover, .carousel-row-right:hover { animation-play-state: paused; }
      `}</style>

      {/* Row 1 — scrolls left */}
      <div className="overflow-hidden mb-3" ref={row1Ref}>
        <div className="carousel-row-left flex gap-3" style={{ width: 'max-content' }}>
          {[...row1, ...row1].map((domain, i) => (
            <LogoItem key={`r1-${i}`} domain={domain} />
          ))}
        </div>
      </div>

      {/* Row 2 — scrolls right */}
      <div className="overflow-hidden" ref={row2Ref}>
        <div className="carousel-row-right flex gap-3" style={{ width: 'max-content' }}>
          {[...row2, ...row2].map((domain, i) => (
            <LogoItem key={`r2-${i}`} domain={domain} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default IntegrationCarousel;
