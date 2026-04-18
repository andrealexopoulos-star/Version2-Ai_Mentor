// Sentry React init — uses the CDN Loader Script from index.html.
//
// The loader exposes a global `window.Sentry` stub that queues calls until
// the SDK bundle finishes downloading, then replays them. We call init()
// once; the loader handles the lazy-load.
//
// Why CDN / loader vs npm:
//   - No yarn.lock regen (prod ships immediately, no dep bump)
//   - Sentry recommends the loader for SPAs that want small initial bundle
//   - Errors fired BEFORE the loader finishes are queued by the loader
//     stub and replayed when ready, so we still capture page-load crashes
//
// DSN is public by Sentry's design (like a Stripe publishable key) —
// safe to commit. Project: biqc-frontend.

const FRONTEND_DSN =
  'https://58a5d042cef4f47cfdbf0a7d15f5b1e0@o4511243287658496.ingest.us.sentry.io/4511243301814272';

function bootSentry() {
  if (!window.Sentry || typeof window.Sentry.init !== 'function') return;
  try {
    window.Sentry.init({
      dsn: FRONTEND_DSN,
      environment:
        (process.env.REACT_APP_ENV || process.env.NODE_ENV || 'production').toLowerCase(),
      release: process.env.REACT_APP_RELEASE_SHA || undefined,
      // Sample rates kept conservative — bump when we have volume.
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0.0,
      replaysOnErrorSampleRate: 1.0,
      // Identify as browser SPA, not just "node_error".
      integrations: [
        // Replay captures the DOM just before an error — huge for
        // reproducing React crashes like PR #335.
        window.Sentry.replayIntegration && window.Sentry.replayIntegration({
          maskAllText: false,
          blockAllMedia: false,
        }),
      ].filter(Boolean),
      // Reduce noise from browser extensions + third-party scripts.
      ignoreErrors: [
        'ResizeObserver loop limit exceeded',
        'ResizeObserver loop completed with undelivered notifications.',
        'Non-Error promise rejection captured',
        // Google Tag Manager + Ads pixels fire a lot of benign errors.
        /googletagmanager/i,
        /doubleclick/i,
      ],
    });
  } catch (err) {
    // Never let Sentry init crash the app.
    // eslint-disable-next-line no-console
    console.warn('[Sentry] init failed:', err);
  }
}

// If the loader is already ready, init now; else wait for onLoad hook.
if (typeof window !== 'undefined') {
  if (window.Sentry && typeof window.Sentry.init === 'function') {
    bootSentry();
  } else {
    // Overwrite the stub defined in index.html so the loader fires our
    // real init when the SDK bundle is ready.
    window.sentryOnLoad = bootSentry;
  }
}

// Thin wrapper so callers don't need to check window.Sentry existence.
export function captureException(err, context) {
  try {
    if (window.Sentry && typeof window.Sentry.captureException === 'function') {
      window.Sentry.captureException(err, context);
    }
  } catch {
    // swallow
  }
}

export function setUserContext(user) {
  try {
    if (window.Sentry && typeof window.Sentry.setUser === 'function') {
      window.Sentry.setUser(
        user && user.id
          ? { id: user.id, email: user.email, username: user.full_name }
          : null,
      );
    }
  } catch {
    // swallow
  }
}
