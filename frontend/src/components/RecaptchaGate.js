import { useEffect, useRef, useState } from 'react';

const SCRIPT_ID = 'google-recaptcha-script';

const ensureScript = () => {
  if (window.grecaptcha?.render) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load reCAPTCHA')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = 'https://www.google.com/recaptcha/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load reCAPTCHA'));
    document.head.appendChild(script);
  });
};

const RecaptchaGate = ({ onTokenChange, testId = 'recaptcha-gate' }) => {
  const siteKey = process.env.REACT_APP_RECAPTCHA_SITE_KEY || '';
  const containerRef = useRef(null);
  const widgetRef = useRef(null);
  const [error, setError] = useState('');

  useEffect(() => {
    onTokenChange('');
    if (!siteKey) {
      setError('reCAPTCHA site key is missing');
      return;
    }

    let alive = true;
    ensureScript()
      .then(() => {
        if (!alive || !containerRef.current || !window.grecaptcha?.render) return;
        widgetRef.current = window.grecaptcha.render(containerRef.current, {
          sitekey: siteKey,
          callback: (token) => onTokenChange(token || ''),
          'expired-callback': () => onTokenChange(''),
          'error-callback': () => onTokenChange(''),
        });
        setError('');
      })
      .catch(() => {
        if (alive) setError('Failed to load reCAPTCHA');
      });

    return () => {
      alive = false;
      onTokenChange('');
      try {
        if (widgetRef.current !== null && window.grecaptcha?.reset) {
          window.grecaptcha.reset(widgetRef.current);
        }
      } catch {}
    };
  }, [onTokenChange, siteKey]);

  return (
    <div className="space-y-2" data-testid={testId}>
      <div ref={containerRef} />
      {error && (
        <p className="text-xs" style={{ color: '#F59E0B' }}>
          {error}
        </p>
      )}
    </div>
  );
};

export default RecaptchaGate;
