const LOGOS = {
  HubSpot: {
    color: '#E85D00',
    svg: (
      <svg viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="16" r="4.5" stroke="#E85D00" strokeWidth="2.5" fill="none" />
        <circle cx="24.5" cy="8" r="2" fill="#E85D00" />
        <path d="M20 13L24 9" stroke="#E85D00" strokeWidth="1.8" />
        <path d="M16 11.5V6" stroke="#E85D00" strokeWidth="2" />
        <path d="M11 14L7 10" stroke="#E85D00" strokeWidth="1.8" />
        <path d="M11 18L7 22" stroke="#E85D00" strokeWidth="1.8" />
        <path d="M16 20.5V26" stroke="#E85D00" strokeWidth="2" />
        <path d="M21 18L25 22" stroke="#E85D00" strokeWidth="1.8" />
      </svg>
    ),
  },
  Salesforce: {
    color: '#00A1E0',
    svg: (
      <svg viewBox="0 0 32 32" fill="none">
        <path d="M13.5 8C15.5 6 18.5 6 20.5 8C22 6.5 24.5 6.5 26 8.5C27.5 10.5 27 13 25 14.5C26 16.5 25 19 22.5 19.5C22 21.5 19.5 22.5 17.5 21.5C16 23 13 23 11.5 21C9.5 22 7 20.5 7 18C5 17 4.5 14.5 6 12.5C5 10.5 6 8 8.5 7.5C10 6 12 6.5 13.5 8Z" fill="#00A1E0" />
      </svg>
    ),
  },
  Xero: {
    color: '#13B5EA',
    svg: (
      <svg viewBox="0 0 32 32" fill="none">
        <path d="M10 10L22 22M22 10L10 22" stroke="#13B5EA" strokeWidth="3.5" strokeLinecap="round" />
      </svg>
    ),
  },
  Stripe: {
    color: '#635BFF',
    svg: (
      <svg viewBox="0 0 32 32" fill="none">
        <rect x="4" y="4" width="24" height="24" rx="5" fill="#635BFF" />
        <path d="M16.5 11C14 11 13 12.2 13 13.5C13 16.5 19 15.5 19 18C19 19 18 20.5 15.5 20.5C13.5 20.5 12.5 19.5 12.5 19.5" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" />
      </svg>
    ),
  },
  Slack: {
    color: '#36C5F0',
    svg: (
      <svg viewBox="0 0 32 32" fill="none">
        <rect x="6" y="12" width="6" height="9" rx="3" fill="#E01E5A" />
        <rect x="12" y="6" width="9" height="6" rx="3" fill="#36C5F0" />
        <rect x="20" y="10" width="6" height="9" rx="3" fill="#2EB67D" />
        <rect x="10" y="20" width="9" height="6" rx="3" fill="#ECB22E" />
        <rect x="6" y="6" width="6" height="6" rx="3" fill="#36C5F0" />
        <rect x="20" y="6" width="6" height="6" rx="3" fill="#2EB67D" />
        <rect x="20" y="20" width="6" height="6" rx="3" fill="#ECB22E" />
        <rect x="6" y="20" width="6" height="6" rx="3" fill="#E01E5A" />
      </svg>
    ),
  },
  Google: {
    color: '#4285F4',
    svg: (
      <svg viewBox="0 0 32 32" fill="none">
        <path d="M16.3 13.8V18.5H23.1C22.7 20.5 20.8 24.3 16.3 24.3C12.4 24.3 9.2 21 9.2 16.8C9.2 12.6 12.4 9.3 16.3 9.3C18.5 9.3 20 10.2 20.8 11L24 7.9C21.8 5.9 19.3 4.8 16.3 4.8C9.9 4.8 4.7 10.2 4.7 16.8C4.7 23.4 9.9 28.8 16.3 28.8C23 28.8 27.3 24.2 27.3 17.1C27.3 16.2 27.2 15.5 27.1 14.8H16.3V13.8Z" fill="#4285F4" />
        <path d="M4.7 16.8C4.7 14.5 5.5 12.3 6.9 10.6L3.2 7.6C1.2 10.2 0 13.4 0 16.8C0 20.2 1.2 23.4 3.2 26L6.9 23C5.5 21.3 4.7 19.1 4.7 16.8Z" fill="#FBBC05" />
        <path d="M16.3 28.8C19.3 28.8 21.8 27.8 23.8 26L20.2 23.2C19.1 24 17.8 24.4 16.3 24.4C12.5 24.4 9.3 21.2 9.2 16.9" fill="#34A853" />
        <path d="M27.1 14.8H16.3V18.5H22.8C22.3 20.8 20 23.2 16.3 24.4L20.2 27.2C22.2 25.4 27.3 21.5 27.3 17.1C27.3 16.2 27.2 15.5 27.1 14.8Z" fill="#4285F4" />
        <path d="M6.9 10.6C8.5 8.8 10.7 7.6 13.2 7.2L16.3 4.8C13.3 4.8 10.5 5.8 8.2 7.5L6.9 10.6Z" fill="#EF4444" />
      </svg>
    ),
  },
  Shopify: {
    color: '#96BF48',
    svg: (
      <svg viewBox="0 0 32 32" fill="none">
        <path d="M22 6L21 5C20.8 4.8 20.5 4.7 20.2 4.7C20 4.7 19.8 4.8 19.6 5C19.6 5 18 6.5 17.5 7C17.2 6.3 16.5 5.3 15 5C14.8 5 14.5 5 14.3 5C13.5 4 12.5 4 12 4C9 4 7.5 8 7 10L5 10.5C4.5 10.7 4.3 10.8 4.3 11.3L3 23L18 26L27 24C27 24 22.2 6.3 22 6ZM17 8L16 8.3C16 7.8 15.8 7 15.5 6.5C16.3 6.7 16.8 7.5 17 8ZM14.5 8.5L12.5 9C12.8 8 13.3 7 14 6.5C14.3 6.7 14.5 7.3 14.5 8.5ZM12.5 5.5C12.7 5.5 12.8 5.5 13 5.6C12 6.3 11 7.5 10.8 9.5L9 10C9.5 8.3 10.5 5.5 12.5 5.5Z" fill="#96BF48" />
        <path d="M20.2 4.7C20 4.7 19.8 4.8 19.6 5C19.6 5 18 6.5 17.5 7L18 26L27 24C27 24 22.2 6.3 22 6L21 5C20.8 4.8 20.5 4.7 20.2 4.7Z" fill="#5E8E3E" />
        <path d="M15 12L14 16C14 16 13 15 11.5 15C9.5 15.2 9.5 16.5 9.5 17C9.7 18.5 14 19 14.3 22.5C14.5 25 13 27 10.5 27C8 27 6.5 25.5 6.5 25.5L7 23C7 23 8.5 24 9.5 24C10.5 24 11 23 10.8 22.5C10.5 20.5 7 20.5 6.8 17.5C6.5 15 8 12.5 11.5 12.3C13 12.2 15 12 15 12Z" fill="white" />
      </svg>
    ),
  },
  QuickBooks: {
    color: '#2CA01C',
    svg: (
      <svg viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="16" r="12" fill="#2CA01C" />
        <path d="M10 12V20H12.5V18H14C16.2 18 18 16.5 18 15C18 13.5 16.2 12 14 12H10Z" fill="white" />
        <path d="M22 20V12H19.5V14H18C15.8 14 14 15.5 14 17C14 18.5 15.8 20 18 20H22Z" fill="white" />
      </svg>
    ),
  },
  Notion: {
    color: '#E6E6E6',
    svg: (
      <svg viewBox="0 0 32 32" fill="none">
        <path d="M6 5.5C6 4.7 6.7 4 7.5 4H20L26 10V26.5C26 27.3 25.3 28 24.5 28H7.5C6.7 28 6 27.3 6 26.5V5.5Z" fill="#E6E6E6" stroke="#E6E6E6" strokeWidth="0.5" />
        <path d="M10 8H18L10 28H10V8Z" fill="#333" opacity="0.8" />
        <path d="M20 4V10H26" fill="none" stroke="#999" strokeWidth="1" />
      </svg>
    ),
  },
  Microsoft: {
    color: '#F25022',
    svg: (
      <svg viewBox="0 0 32 32" fill="none">
        <rect x="5" y="5" width="10" height="10" fill="#F25022" />
        <rect x="17" y="5" width="10" height="10" fill="#7FBA00" />
        <rect x="5" y="17" width="10" height="10" fill="#00A4EF" />
        <rect x="17" y="17" width="10" height="10" fill="#FFB900" />
      </svg>
    ),
  },
  AWS: {
    color: '#FF9900',
    svg: (
      <svg viewBox="0 0 32 32" fill="none">
        <path d="M9 18C9 18 11 20 16 20C21 20 23 18 23 18" stroke="#FF9900" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M21 17L24 18.5L21 20" stroke="#FF9900" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M8 9L11 14L14 10L17 15L20 9L23 14L26 10" stroke="#252F3E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    ),
  },
  DocuSign: {
    color: '#FFC43A',
    svg: (
      <svg viewBox="0 0 32 32" fill="none">
        <rect x="6" y="4" width="20" height="24" rx="2" fill="#1B3046" />
        <path d="M10 20L14 16L18 18L22 12" stroke="#FFC43A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <circle cx="22" cy="12" r="2" fill="#FFC43A" />
      </svg>
    ),
  },
  Snowflake: {
    color: '#29B5E8',
    svg: (
      <svg viewBox="0 0 32 32" fill="none">
        <path d="M16 4V28M4 16H28M8 8L24 24M24 8L8 24" stroke="#29B5E8" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="16" cy="4" r="2" fill="#29B5E8" />
        <circle cx="16" cy="28" r="2" fill="#29B5E8" />
        <circle cx="4" cy="16" r="2" fill="#29B5E8" />
        <circle cx="28" cy="16" r="2" fill="#29B5E8" />
        <circle cx="8" cy="8" r="1.5" fill="#29B5E8" />
        <circle cx="24" cy="24" r="1.5" fill="#29B5E8" />
        <circle cx="24" cy="8" r="1.5" fill="#29B5E8" />
        <circle cx="8" cy="24" r="1.5" fill="#29B5E8" />
      </svg>
    ),
  },
  Tableau: {
    color: '#E97627',
    svg: (
      <svg viewBox="0 0 32 32" fill="none">
        <rect x="14" y="4" width="4" height="10" fill="#E97627" />
        <rect x="8" y="8" width="4" height="7" fill="#C72037" />
        <rect x="20" y="8" width="4" height="7" fill="#5B879B" />
        <rect x="14" y="17" width="4" height="11" fill="#5B879B" />
        <rect x="8" y="18" width="4" height="7" fill="#E97627" />
        <rect x="20" y="18" width="4" height="7" fill="#C72037" />
        <rect x="2" y="12" width="4" height="8" fill="#EB912B" />
        <rect x="26" y="12" width="4" height="8" fill="#59879B" />
      </svg>
    ),
  },
  Monday: {
    color: '#FF3D57',
    svg: (
      <svg viewBox="0 0 32 32" fill="none">
        <circle cx="8" cy="22" r="3" fill="#FF3D57" />
        <circle cx="16" cy="22" r="3" fill="#FFCB00" />
        <circle cx="24" cy="22" r="3" fill="#00CA72" />
        <path d="M8 22V10" stroke="#FF3D57" strokeWidth="3" strokeLinecap="round" />
        <path d="M16 22V14" stroke="#FFCB00" strokeWidth="3" strokeLinecap="round" />
        <path d="M24 22V8" stroke="#00CA72" strokeWidth="3" strokeLinecap="round" />
      </svg>
    ),
  },
  Asana: {
    color: '#F06A6A',
    svg: (
      <svg viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="8" r="5" fill="#F06A6A" />
        <circle cx="9" cy="22" r="5" fill="#F06A6A" />
        <circle cx="23" cy="22" r="5" fill="#F06A6A" />
      </svg>
    ),
  },
  Zoom: {
    color: '#2D8CFF',
    svg: (
      <svg viewBox="0 0 32 32" fill="none">
        <rect x="3" y="7" width="26" height="18" rx="5" fill="#2D8CFF" />
        <rect x="7" y="11" width="12" height="10" rx="2" fill="white" />
        <path d="M21 13L26 10V22L21 19V13Z" fill="white" />
      </svg>
    ),
  },
  Dropbox: {
    color: '#0061FF',
    svg: (
      <svg viewBox="0 0 32 32" fill="none">
        <path d="M10 5L16 9L22 5L28 9L22 13L28 17L22 21L16 17L10 21L4 17L10 13L4 9L10 5Z" fill="#0061FF" />
      </svg>
    ),
  },
  Zendesk: {
    color: '#78D9AE',
    svg: (
      <svg viewBox="0 0 32 32" fill="none">
        <path d="M16 6L6 18H16V26L26 14H16V6Z" fill="#78D9AE" />
      </svg>
    ),
  },
  Mailchimp: {
    color: '#FFE01B',
    svg: (
      <svg viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="16" r="12" fill="#FFE01B" />
        <circle cx="12" cy="14" r="2" fill="#241C15" />
        <circle cx="20" cy="14" r="2" fill="#241C15" />
        <path d="M11 19C11 19 13 22 16 22C19 22 21 19 21 19" stroke="#241C15" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      </svg>
    ),
  },
  Pipedrive: {
    color: '#017737',
    svg: (
      <svg viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="16" r="12" fill="#017737" />
        <path d="M16 8V24M12 12L16 8L20 12M12 20L16 24L20 20" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    ),
  },
};

export const BrandLogo = ({ name, size = 32 }) => {
  const logo = LOGOS[name];
  if (!logo) return null;
  return (
    <div style={{ width: size, height: size }} data-testid={`brand-logo-${name.toLowerCase()}`}>
      {logo.svg}
    </div>
  );
};

export const getAllBrandNames = () => Object.keys(LOGOS);
export const getBrandColor = (name) => LOGOS[name]?.color || '#E85D00';
export default LOGOS;
