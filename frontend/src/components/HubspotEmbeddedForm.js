import { useEffect, useMemo, useState } from 'react';

const HUBSPOT_SCRIPT_ID = 'biqc-hubspot-forms-v2';
const HUBSPOT_SCRIPT_SRC = 'https://js-ap1.hsforms.net/forms/embed/v2.js';

const ensureHubspotScript = () => new Promise((resolve, reject) => {
  if (window.hbspt?.forms?.create) {
    resolve();
    return;
  }

  const existing = document.getElementById(HUBSPOT_SCRIPT_ID);
  if (existing) {
    existing.addEventListener('load', () => resolve(), { once: true });
    existing.addEventListener('error', () => reject(new Error('Failed to load HubSpot forms script')), { once: true });
    return;
  }

  const script = document.createElement('script');
  script.id = HUBSPOT_SCRIPT_ID;
  script.charset = 'utf-8';
  script.type = 'text/javascript';
  script.src = HUBSPOT_SCRIPT_SRC;
  script.async = true;
  script.defer = true;
  script.onload = () => resolve();
  script.onerror = () => reject(new Error('Failed to load HubSpot forms script'));
  document.head.appendChild(script);
});

export default function HubspotEmbeddedForm({
  portalId = '443060578',
  formId = 'eb9354e4-d3a9-4182-85f9-f8ea69949366',
  region = 'ap1',
  testId = 'biqc-hubspot-embedded-form',
}) {
  const [failed, setFailed] = useState(false);
  const targetId = useMemo(() => `biqc-hubspot-form-${Math.random().toString(36).slice(2)}`, []);

  useEffect(() => {
    let alive = true;
    setFailed(false);

    const mount = async () => {
      try {
        await ensureHubspotScript();
        if (!alive) return;
        const target = document.getElementById(targetId);
        if (!target || !window.hbspt?.forms?.create) {
          throw new Error('HubSpot target unavailable');
        }

        target.innerHTML = '';
        window.hbspt.forms.create({
          portalId,
          formId,
          region,
          target: `#${targetId}`,
        });
      } catch {
        if (alive) {
          setFailed(true);
        }
      }
    };

    mount();
    return () => {
      alive = false;
    };
  }, [formId, portalId, region, targetId]);

  return (
    <div data-testid={testId} className="biqc-hubspot-embed">
      <div id={targetId} />
      {failed && (
        <p className="text-xs mt-2" style={{ color: '#DC2626' }}>
          Form is temporarily unavailable. Please refresh and try again.
        </p>
      )}
      <style>{`
        .biqc-hubspot-embed .hs-form fieldset { max-width: 100% !important; }
        .biqc-hubspot-embed .hs-form .hs-form-field { margin-bottom: 14px !important; }
        .biqc-hubspot-embed .hs-form label {
          color: var(--ink-display, #0A0A0A) !important;
          font-family: var(--font-marketing-ui, "Geist", sans-serif) !important;
          font-weight: 600 !important;
          letter-spacing: -0.005em !important;
          margin-bottom: 6px !important;
        }
        .biqc-hubspot-embed .hs-form input,
        .biqc-hubspot-embed .hs-form select,
        .biqc-hubspot-embed .hs-form textarea {
          width: 100% !important;
          background: #FFFFFF !important;
          border: 1px solid rgba(10,10,10,0.1) !important;
          color: var(--ink-display, #0A0A0A) !important;
          border-radius: 8px !important;
          padding: 10px 12px !important;
          font-size: 14px !important;
          font-family: var(--font-marketing-ui, "Geist", sans-serif) !important;
          letter-spacing: -0.005em !important;
          box-sizing: border-box !important;
        }
        .biqc-hubspot-embed .hs-form textarea { min-height: 120px !important; }
        .biqc-hubspot-embed .hs-error-msgs label,
        .biqc-hubspot-embed .hs-error-msg {
          color: #DC2626 !important;
          font-size: 12px !important;
          margin-top: 4px !important;
        }
        .biqc-hubspot-embed .hs_submit {
          margin-top: 14px !important;
        }
        .biqc-hubspot-embed .hs-button {
          width: 100% !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 8px !important;
          padding: 12px 16px !important;
          border-radius: 999px !important;
          border: 1px solid #0A0A0A !important;
          background: #0A0A0A !important;
          color: #FFFFFF !important;
          font-family: var(--font-marketing-ui, "Geist", sans-serif) !important;
          letter-spacing: -0.005em !important;
          box-shadow: 0 4px 12px rgba(10,10,10,0.08) !important;
          cursor: pointer !important;
        }
      `}</style>
    </div>
  );
}
