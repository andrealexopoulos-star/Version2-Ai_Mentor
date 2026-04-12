import { BrandLogo, getBrandColor } from './BrandLogos';
import { fontFamily } from '../../design-system/tokens';


const ROW1_BRANDS = [
  'HubSpot','Salesforce','Xero','Stripe','Slack','Google','Shopify',
  'QuickBooks','Notion','Microsoft','AWS','DocuSign','Snowflake','Tableau',
];

const ROW2_BRANDS = [
  'Monday','Asana','Zoom','Dropbox','Zendesk','Mailchimp','Pipedrive',
  'HubSpot','Salesforce','Xero','Stripe','Slack','Google','Shopify',
];

const LogoCard = ({ name }) => (
  <div
    className="logo-card flex flex-col items-center justify-center gap-2 shrink-0"
    style={{
      width: 100,
      height: 90,
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.05)',
      borderRadius: 10,
      transition: 'all 0.3s ease',
      cursor: 'default',
    }}
    data-testid={`integration-card-${name.toLowerCase()}`}
  >
    <BrandLogo name={name} size={36} />
    <span className="font-medium" style={{ fontFamily: fontFamily.mono, color: getBrandColor(name), opacity: 0.8, fontSize: '11px' }}>
      {name}
    </span>
  </div>
);

export const IntegrationCarousel = () => (
  <section className="py-14 sm:py-20 overflow-hidden" style={{ background: '#0B1120' }} data-testid="integration-carousel">
    <div className="max-w-5xl mx-auto px-6 mb-12 text-center">
      <span className="font-medium tracking-widest uppercase" style={{ fontFamily: fontFamily.mono, color: '#E85D00', fontSize: '12px' }}>
        500+ Integrations
      </span>
      <p className="text-sm sm:text-base mt-3" style={{ fontFamily: fontFamily.body, color: '#8FA0B8', opacity: 0.45, fontWeight: 300 }}>
        Connects to the tools your business already uses
      </p>
    </div>

    <style>{`
      @keyframes carouselLeft {
        0% { transform: translateX(0); }
        100% { transform: translateX(-50%); }
      }
      @keyframes carouselRight {
        0% { transform: translateX(-50%); }
        100% { transform: translateX(0); }
      }
      .carousel-row-left {
        animation: carouselLeft 25s linear infinite;
      }
      .carousel-row-right {
        animation: carouselRight 25s linear infinite;
      }
      .carousel-row-left:hover,
      .carousel-row-right:hover {
        animation-play-state: paused;
      }
      .logo-card:hover {
        background: rgba(232,93,0,0.35) !important;
        border-color: rgba(232,93,0,0.5) !important;
        transform: translateY(-2px);
      }
    `}</style>

    {/* Row 1 — slow left scroll */}
    <div className="overflow-hidden mb-6 sm:mb-10">
      <div className="carousel-row-left flex items-center gap-4 sm:gap-6" style={{ width: 'max-content' }}>
        {[...ROW1_BRANDS, ...ROW1_BRANDS].map((name, i) => (
          <LogoCard key={`r1-${i}`} name={name} />
        ))}
      </div>
    </div>

    {/* Row 2 — slow right scroll */}
    <div className="overflow-hidden">
      <div className="carousel-row-right flex items-center gap-4 sm:gap-6" style={{ width: 'max-content' }}>
        {[...ROW2_BRANDS, ...ROW2_BRANDS].map((name, i) => (
          <LogoCard key={`r2-${i}`} name={name} />
        ))}
      </div>
    </div>
  </section>
);

export default IntegrationCarousel;
