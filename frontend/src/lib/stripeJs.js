// Stripe.js loader — uses the CDN-injected window.Stripe from index.html.
//
// We load Stripe from the CDN rather than the @stripe/stripe-js npm package
// for two reasons:
//   1. Stripe recommends CDN loading because their fraud detection uses the
//      presence of js.stripe.com across sessions (same user, same browser).
//   2. Avoids adding an npm dependency that would need yarn.lock regen.
//
// Publishable key comes from REACT_APP_STRIPE_PUBLISHABLE_KEY, baked in at
// build time. Safe to expose — publishable keys are designed to be public.

const PUBLISHABLE_KEY = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY || '';

let cachedStripe = null;
let loadPromise = null;

/**
 * Waits for window.Stripe to be available, then returns a Stripe instance
 * initialized with the publishable key. Memoized — calling it multiple
 * times returns the same Stripe object.
 *
 * Throws if REACT_APP_STRIPE_PUBLISHABLE_KEY is missing at build time.
 */
export async function getStripe() {
  if (cachedStripe) return cachedStripe;
  if (loadPromise) return loadPromise;

  if (!PUBLISHABLE_KEY) {
    throw new Error(
      'Stripe publishable key missing. Set REACT_APP_STRIPE_PUBLISHABLE_KEY in Azure App Service config.'
    );
  }

  loadPromise = new Promise((resolve, reject) => {
    const deadline = Date.now() + 8000;
    const tick = () => {
      if (window.Stripe) {
        try {
          cachedStripe = window.Stripe(PUBLISHABLE_KEY);
          resolve(cachedStripe);
        } catch (err) {
          reject(err);
        }
        return;
      }
      if (Date.now() > deadline) {
        reject(new Error('Stripe.js failed to load within 8s'));
        return;
      }
      setTimeout(tick, 80);
    };
    tick();
  });

  return loadPromise;
}

export function hasStripeKey() {
  return Boolean(PUBLISHABLE_KEY);
}
