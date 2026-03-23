import { useCallback, useEffect, useRef, useState } from 'react';

const SCRIPT_ID = 'google-recaptcha-script';
const MODE_AUTO = 'auto';
const MODE_V2 = 'v2';
const MODE_V3 = 'v3';
const PROVIDER_AUTO = 'auto';
const PROVIDER_STANDARD = 'standard';
const PROVIDER_ENTERPRISE = 'enterprise';

const normalizeMode = (mode) => {
  const value = String(mode || '').trim().toLowerCase();
  if (value === MODE_V2 || value === 'checkbox') return MODE_V2;
  if (value === MODE_V3 || value === 'invisible') return MODE_V3;
  return MODE_AUTO;
};

const normalizeProvider = (provider) => {
  const value = String(provider || '').trim().toLowerCase();
  if (value === PROVIDER_ENTERPRISE) return PROVIDER_ENTERPRISE;
  if (value === PROVIDER_STANDARD) return PROVIDER_STANDARD;
  return PROVIDER_AUTO;
};

const scriptSrcForConfig = (mode, provider, siteKey) => {
  if (provider === PROVIDER_ENTERPRISE) {
    if (mode === MODE_V3) {
      return `https://www.google.com/recaptcha/enterprise.js?render=${encodeURIComponent(siteKey)}`;
    }
    return 'https://www.google.com/recaptcha/enterprise.js?render=explicit';
  }
  if (mode === MODE_V3) {
    return `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
  }
  return 'https://www.google.com/recaptcha/api.js?render=explicit';
};

const getRecaptchaApi = (provider) => {
  if (!window.grecaptcha) return null;
  if (provider === PROVIDER_ENTERPRISE) return window.grecaptcha.enterprise || null;
  return window.grecaptcha;
};

const ensureScript = (mode, provider, siteKey) => {
  const expectedSrc = scriptSrcForConfig(mode, provider, siteKey);
  const existing = document.getElementById(SCRIPT_ID);

  if (existing) {
    const currentMode = existing.getAttribute('data-recaptcha-mode');
    const currentProvider = existing.getAttribute('data-recaptcha-provider');
    const currentSrc = existing.getAttribute('data-recaptcha-src');
    if (currentMode !== mode || currentProvider !== provider || currentSrc !== expectedSrc) {
      existing.remove();
    } else if (getRecaptchaApi(provider)) {
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
    script.setAttribute('data-recaptcha-provider', provider);
    script.setAttribute('data-recaptcha-src', expectedSrc);
    script.src = expectedSrc;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load reCAPTCHA'));
    document.head.appendChild(script);
  });
};

const RecaptchaGate = ({ onTokenChange, onStatusChange, action = 'auth', testId = 'recaptcha-gate' }) => {
  const siteKey = process.env.REACT_APP_RECAPTCHA_SITE_KEY || '';
  const actionName = String(action || 'auth').trim() || 'auth';
  const configuredMode = normalizeMode(process.env.REACT_APP_RECAPTCHA_MODE);
  const configuredProvider = normalizeProvider(process.env.REACT_APP_RECAPTCHA_PROVIDER);
  const containerRef = useRef(null);
  const widgetRef = useRef(null);
  const refreshRef = useRef(null);
  const activeModeRef = useRef(null);
  const activeProviderRef = useRef(null);
  const [error, setError] = useState('');
  const reportStatus = useCallback((status, reason = '') => {
    if (typeof onStatusChange === 'function') {
      onStatusChange({ status, reason });
    }
  }, [onStatusChange]);

  useEffect(() => {
    reportStatus('initializing');
    const clearRefresh = () => {
      if (refreshRef.current) {
        clearInterval(refreshRef.current);
        refreshRef.current = null;
      }
    };

    const resetWidget = () => {
      try {
        const api = getRecaptchaApi(activeProviderRef.current || configuredProvider);
        if (widgetRef.current !== null && api?.reset) {
          api.reset(widgetRef.current);
        }
      } catch {}
      widgetRef.current = null;
    };

    const startV3Refresh = (actionName, provider) => {
      clearRefresh();
      refreshRef.current = setInterval(async () => {
        try {
          const api = getRecaptchaApi(provider);
          if (activeModeRef.current !== MODE_V3 || !api?.execute) return;
          const token = await api.execute(siteKey, { action: actionName });
          onTokenChange(token || '');
        } catch {
          onTokenChange('');
        }
      }, 90000);
    };

    const tryV3 = async (provider) => {
      await ensureScript(MODE_V3, provider, siteKey);
      const api = getRecaptchaApi(provider);
      if (!api?.ready || !api?.execute) {
        throw new Error('reCAPTCHA v3 unavailable');
      }
      await new Promise((resolve) => api.ready(resolve));
      const token = await api.execute(siteKey, { action: actionName });
      if (!token) throw new Error('Empty reCAPTCHA token');
      activeModeRef.current = MODE_V3;
      activeProviderRef.current = provider;
      onTokenChange(token);
      setError('');
      reportStatus('ready', `${provider}:v3`);
      startV3Refresh(actionName, provider);
    };

    const tryV2 = async (provider) => {
      await ensureScript(MODE_V2, provider, siteKey);
      const api = getRecaptchaApi(provider);
      if (!containerRef.current || !api?.render) {
        throw new Error('reCAPTCHA v2 unavailable');
      }
      activeModeRef.current = MODE_V2;
      activeProviderRef.current = provider;
      widgetRef.current = api.render(containerRef.current, {
        sitekey: siteKey,
        callback: (token) => onTokenChange(token || ''),
        'expired-callback': () => onTokenChange(''),
        'error-callback': () => onTokenChange(''),
      });
      setError('');
      reportStatus('ready', `${provider}:v2`);
    };

    onTokenChange('');
    if (!siteKey) {
      setError('reCAPTCHA site key is missing');
      reportStatus('error', 'site_key_missing');
      return;
    }

    let alive = true;
    (async () => {
      try {
        const runConfiguredMode = async (provider) => {
          if (configuredMode === MODE_V2) {
            await tryV2(provider);
            return true;
          }
          if (configuredMode === MODE_V3) {
            await tryV3(provider);
            return true;
          }
          return false;
        };

        if (configuredProvider === PROVIDER_STANDARD) {
          if (await runConfiguredMode(PROVIDER_STANDARD)) return;
          try {
            await tryV3(PROVIDER_STANDARD);
            return;
          } catch {
            await tryV2(PROVIDER_STANDARD);
            return;
          }
        }

        if (configuredProvider === PROVIDER_ENTERPRISE) {
          if (await runConfiguredMode(PROVIDER_ENTERPRISE)) return;
          try {
            await tryV3(PROVIDER_ENTERPRISE);
            return;
          } catch {
            await tryV2(PROVIDER_ENTERPRISE);
            return;
          }
        }

        // Auto provider/mode: try standard first, then enterprise.
        if (configuredMode === MODE_V2) {
          // Resilience: many production incidents are caused by a v3 site key
          // being paired with MODE_V2. Try v3 first, then gracefully fall back.
          try {
            await tryV3(PROVIDER_STANDARD);
            return;
          } catch {}
          try {
            await tryV2(PROVIDER_STANDARD);
            return;
          } catch {
            await tryV2(PROVIDER_ENTERPRISE);
            return;
          }
        }
        if (configuredMode === MODE_V3) {
          try {
            await tryV3(PROVIDER_STANDARD);
            return;
          } catch {
            await tryV3(PROVIDER_ENTERPRISE);
            return;
          }
        }

        try {
          await tryV3(PROVIDER_STANDARD);
          return;
        } catch {}
        try {
          await tryV2(PROVIDER_STANDARD);
          return;
        } catch {}
        try {
          await tryV3(PROVIDER_ENTERPRISE);
          return;
        } catch {
          await tryV2(PROVIDER_ENTERPRISE);
          return;
        }
      } catch {
        if (alive) {
          setError('Failed to initialize reCAPTCHA. Check key type, provider (standard/enterprise), and allowed domains.');
          reportStatus('error', 'init_failed');
        }
      }
    })();

    return () => {
      alive = false;
      activeModeRef.current = null;
      activeProviderRef.current = null;
      onTokenChange('');
      clearRefresh();
      resetWidget();
    };
  }, [actionName, configuredMode, configuredProvider, onTokenChange, reportStatus, siteKey]);

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
