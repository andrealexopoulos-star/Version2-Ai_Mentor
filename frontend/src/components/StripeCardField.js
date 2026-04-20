import React, { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';
import { getStripe } from '../lib/stripeJs';
import { fontFamily } from '../design-system/tokens';

/**
 * Phase 6.11 — Stripe PaymentElement wrapper for CC-mandatory signup.
 *
 * Uses Stripe's "deferred intent" initialization pattern: we mount the
 * PaymentElement in setup mode without a client_secret, let the user fill
 * the card, then confirm against a SetupIntent client_secret at submit
 * time.
 *
 *   const cardRef = useRef();
 *   <StripeCardField ref={cardRef} onReady={...} onError={...} />
 *   // later on submit:
 *   const { error, paymentMethodId } = await cardRef.current.confirmWith(clientSecret);
 *
 * Parent handles the surrounding flow (createSetupIntent → confirmWith →
 * confirmTrialSignup). This component owns Stripe instance + Elements
 * lifecycle only.
 */

const MONO = 'var(--font-mono, ' + fontFamily.mono + ')';

const StripeCardField = forwardRef(({ onReady, onError, disabled = false }, ref) => {
  const mountDivRef = useRef(null);
  const stripeRef = useRef(null);
  const elementsRef = useRef(null);
  const paymentElementRef = useRef(null);
  const [loadError, setLoadError] = useState('');
  const [mounted, setMounted] = useState(false);

  // Stable refs for callbacks so the init effect does NOT re-run when the
  // parent passes new inline-lambda handlers each render (Codex P1).
  const onReadyRef = useRef(onReady);
  const onErrorRef = useRef(onError);
  useEffect(() => { onReadyRef.current = onReady; onErrorRef.current = onError; });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stripe = await getStripe();
        if (cancelled) return;
        stripeRef.current = stripe;

        const elements = stripe.elements({
          mode: 'setup',
          currency: 'aud',
          appearance: {
            theme: 'stripe',
            variables: {
              colorPrimary: '#0A0A0A',
              colorBackground: '#FFFFFF',
              colorText: '#0A0A0A',
              colorDanger: '#EF4444',
              fontFamily: 'Geist, Inter, system-ui, sans-serif',
              fontSizeBase: '14px',
              borderRadius: '8px',
              spacingUnit: '4px',
            },
            rules: {
              '.Input': {
                border: '1px solid rgba(10,10,10,0.1)',
                boxShadow: 'none',
              },
              '.Input:focus': {
                border: '1px solid #0A0A0A',
                boxShadow: '0 0 0 2px rgba(10,10,10,0.08)',
              },
              '.Label': {
                fontWeight: '500',
                fontSize: '12px',
                color: 'rgba(10,10,10,0.6)',
              },
            },
          },
        });
        elementsRef.current = elements;

        // 2026-04-20 Andreas P0: stripe.confirmSetup was hanging across
        // TWO different live cards with no request ever reaching Stripe
        // (verified via Stripe API — 7 SetupIntents stuck at
        // requires_payment_method with no last_setup_error). Cause:
        // Stripe Link's email/phone capture widget was hanging
        // elements.submit() before Stripe's confirm call was made.
        //
        // `paymentMethodOrder` only reorders the visible tabs — it does
        // NOT hide Link. The explicit kill is `wallets.link: 'never'`.
        // We also strip the save-info-for-Link upsell via the fields +
        // terms overrides.
        const paymentElement = elements.create('payment', {
          layout: { type: 'tabs', defaultCollapsed: false },
          wallets: { link: 'never', applePay: 'auto', googlePay: 'auto' },
          fields: { billingDetails: { email: 'never' } },
          terms: { card: 'never' },
        });
        paymentElementRef.current = paymentElement;
        paymentElement.on('ready', () => {
          if (cancelled) return;
          setMounted(true);
          if (onReadyRef.current) onReadyRef.current();
        });
        paymentElement.on('loaderror', (evt) => {
          const msg = evt?.error?.message || 'Could not load card form.';
          if (cancelled) return;
          setLoadError(msg);
          if (onErrorRef.current) onErrorRef.current(msg);
        });

        if (mountDivRef.current && !cancelled) {
          paymentElement.mount(mountDivRef.current);
        }
      } catch (err) {
        if (cancelled) return;
        const msg = err?.message || 'Failed to load Stripe.';
        setLoadError(msg);
        if (onErrorRef.current) onErrorRef.current(msg);
      }
    })();
    return () => {
      cancelled = true;
      // Properly unmount the PaymentElement so Stripe releases the DOM
      // node instead of leaving a detached iframe in the tree (Codex P1).
      try {
        if (paymentElementRef.current) {
          paymentElementRef.current.unmount();
          paymentElementRef.current = null;
        }
      } catch (err) {
        // Unmount may throw during rapid re-renders; swallow — the next
        // effect cycle replaces the element regardless.
      }
    };
    // Intentionally empty deps — Elements is mounted once per component
    // lifetime. Callback handlers flow through stable refs above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(ref, () => ({
    /**
     * Confirm the mounted PaymentElement against a SetupIntent client_secret.
     * Returns { paymentMethodId } on success or { error } on failure.
     *
     * Uses redirect: 'if_required'. In the 3DS redirect case, the browser
     * leaves this page; caller should handle the ?setup_intent=... return
     * via a separate useEffect on mount.
     */
    confirmWith: async (clientSecret) => {
      const stripe = stripeRef.current;
      const elements = elementsRef.current;
      if (!stripe || !elements) {
        return { error: 'Stripe not initialized yet.', rawError: { type: 'local', message: 'stripe_not_initialized' } };
      }
      // Force elements to validate + submit internally before confirmSetup.
      const submitResult = await elements.submit();
      if (submitResult && submitResult.error) {
        return {
          error: submitResult.error.message || 'Card validation failed.',
          rawError: submitResult.error,
        };
      }
      const { error, setupIntent } = await stripe.confirmSetup({
        elements,
        clientSecret,
        redirect: 'if_required',
      });
      if (error) {
        return {
          error: error.message || 'Card could not be confirmed.',
          rawError: error,
        };
      }
      if (!setupIntent || !setupIntent.payment_method) {
        return { error: 'Stripe did not return a payment method.', rawError: { type: 'local', message: 'no_payment_method_returned', setupIntent } };
      }
      return { paymentMethodId: setupIntent.payment_method };
    },
  }), []);

  // P1 HOTFIX (2026-04-19): Keep the mount div EMPTY from React's
  // perspective. Previously a `{!mounted && ...}` conditional child lived
  // inside this div, but Stripe's paymentElement.mount() wipes the div and
  // inserts its own iframe, leaving the React virtual DOM out of sync. On
  // the next reconciliation React tries to remove a node that is no longer
  // its child → `NotFoundError: Failed to execute 'removeChild'` →
  // AppErrorBoundary catches → every CTA-driven signup was blocked. Moving
  // the placeholder and error text to sibling elements fixes it.
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
      <label style={{
        fontFamily: MONO,
        fontSize: 10,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: 'var(--ink-muted, #737373)',
        fontWeight: 500,
      }}>
        Card on file (no charge for 14 days)
      </label>
      {/* Mount container — REACT MUST NOT PUT CHILDREN IN HERE. Stripe
          injects its iframe directly into this div and manages its
          children. Any React child would collide with Stripe's DOM. */}
      <div
        ref={mountDivRef}
        data-testid="stripe-card-field"
        style={{
          minHeight: mounted ? 'auto' : 48,
          background: '#FFFFFF',
          border: '1px solid rgba(10,10,10,0.1)',
          borderRadius: 8,
          opacity: disabled ? 0.6 : 1,
          pointerEvents: disabled ? 'none' : 'auto',
        }}
      />
      {!mounted && !loadError && (
        <div style={{ fontSize: 12, color: 'var(--ink-muted, #737373)', fontFamily: MONO }}>
          Loading secure card field...
        </div>
      )}
      {loadError && (
        <div style={{ fontSize: 12, color: 'var(--danger, #EF4444)', fontFamily: MONO }}>
          {loadError}
        </div>
      )}
    </div>
  );
});

StripeCardField.displayName = 'StripeCardField';
export default StripeCardField;
