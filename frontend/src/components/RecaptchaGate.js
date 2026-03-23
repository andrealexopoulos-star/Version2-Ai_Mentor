import { useEffect, useRef, useState } from 'react';

const SCRIPT_ID = 'google-recaptcha-script';
const MODE_AUTO = 'auto';
const MODE_V2 = 'v2';
const MODE_V3 = 'v3';

const normalizeMode = (mode) => {
  const value = String(mode || '').trim().toLowerCase();
  if (value === MODE_V2 || value === 'checkbox') return MODE_V2;
  if (value === MODE_V3 || value === 'invisible') return MODE_V3;
  return MODE_AUTO;
};

const scriptSrcForMode = (mode, siteKey) => {
  if (mode === MODE_V3) {
    return `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
  }
  return 'https://www.google.com/recaptcha/api.js?render=explicit';
};

const ensureScript = (mode, siteKey) => {
  const expectedSrc = scriptSrcForMode(mode, siteKey);
  const existing = document.getElementById(SCRIPT_ID);

  if (existing) {
    const currentMode = existing.getAttribute('data-recaptcha-mode');
    const currentSrc = existing.getAttribute('data-recaptcha-src');
    if (currentMode !== mode || currentSrc !== expectedSrc) {
      existing.remove();
    } else if (window.grecaptcha) {
      return Promise.resolve();
    } else {
      return new Promise((resolve, reject) => {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error('Failed to load reCAPTCHA')), { once: true });
      });
    }
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.setAttribute('data-recaptcha-mode', mode);
    script.setAttribute('data-recaptcha-src', expectedSrc);
    script.src = expectedSrc;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load reCAPTCHA'));
    document.head.appendChild(script);
  });
};

const RecaptchaGate = ({ onTokenChange, testId = 'recaptcha-gate' }) => {
  const siteKey = process.env.REACT_APP_RECAPTCHA_SITE_KEY || '';
  const configuredMode = normalizeMode(process.env.REACT_APP_RECAPTCHA_MODE);
  const containerRef = useRef(null);
  const widgetRef = useRef(null);
  const refreshRef = useRef(null);
  const activeModeRef = useRef(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const clearRefresh = () => {
      if (refreshRef.current) {
        clearInterval(refreshRef.current);
        refreshRef.current = null;
      }
    };

    const resetWidget = () => {
      try {
        if (widgetRef.current !== null && window.grecaptcha?.reset) {
          window.grecaptcha.reset(widgetRef.current);
        }
      } catch {}
      widgetRef.current = null;
    };

    const startV3Refresh = (actionName) => {
      clearRefresh();
      refreshRef.current = setInterval(async () => {
        try {
          if (activeModeRef.current !== MODE_V3 || !window.grecaptcha?.execute) return;
          const token = await window.grecaptcha.execute(siteKey, { action: actionName });
          onTokenChange(token || '');
        } catch {
          onTokenChange('');
        }
      }, 90000);
    };

    const tryV3 = async () => {
      await ensureScript(MODE_V3, siteKey);
      if (!window.grecaptcha?.ready || !window.grecaptcha?.execute) {
        throw new Error('reCAPTCHA v3 unavailable');
      }
      await new Promise((resolve) => window.grecaptcha.ready(resolve));
      const token = await window.grecaptcha.execute(siteKey, { action: 'auth' });
      if (!token) throw new Error('Empty reCAPTCHA token');
      activeModeRef.current = MODE_V3;
      onTokenChange(token);
      setError('');
      startV3Refresh('auth');
    };

    const tryV2 = async () => {
      await ensureScript(MODE_V2, siteKey);
      if (!containerRef.current || !window.grecaptcha?.render) {
        throw new Error('reCAPTCHA v2 unavailable');
      }
      activeModeRef.current = MODE_V2;
      widgetRef.current = window.grecaptcha.render(containerRef.current, {
        sitekey: siteKey,
        callback: (token) => onTokenChange(token || ''),
        'expired-callback': () => onTokenChange(''),
        'error-callback': () => onTokenChange(''),
      });
      setError('');
    };

    onTokenChange('');
    if (!siteKey) {
      setError('reCAPTCHA site key is missing');
      return;
    }

    let alive = true;
    (async () => {
      try {
        if (configuredMode === MODE_V2) {
          await tryV2();
          return;
        }
        if (configuredMode === MODE_V3) {
          await tryV3();
          return;
        }

        // Auto mode: prefer v3, then fall back to v2 checkbox.
        try {
          await tryV3();
          return;
        } catch {
          await tryV2();
        }
      } catch {
        if (alive) setError('Failed to initialize reCAPTCHA. Check key type and domain settings.');
      }
    })();

    return () => {
      alive = false;
      activeModeRef.current = null;
      onTokenChange('');
      clearRefresh();
      resetWidget();
    };
  }, [configuredMode, onTokenChange, siteKey]);

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
