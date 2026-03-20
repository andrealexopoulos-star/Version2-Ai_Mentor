/**
 * BIQc Analytics — Provider-agnostic event dispatch
 * Supports: Mixpanel, Amplitude, PostHog
 * Keys will be provided later — this is the instrumentation layer only.
 */

const PROVIDERS = {
  mixpanel: null,
  amplitude: null,
  posthog: null,
};

let initialized = false;
let userId = null;
let sessionMetadata = {};

/**
 * Initialize analytics with provider keys.
 * Call once on app load.
 */
export function initAnalytics(config = {}) {
  if (config.mixpanelToken) {
    PROVIDERS.mixpanel = { token: config.mixpanelToken };
  }
  if (config.amplitudeKey) {
    PROVIDERS.amplitude = { key: config.amplitudeKey };
  }
  if (config.posthogKey) {
    PROVIDERS.posthog = { key: config.posthogKey, host: config.posthogHost || 'https://app.posthog.com' };
  }
  initialized = true;
}

/**
 * Identify the current user.
 */
export function identifyUser(id, properties = {}) {
  userId = id;
  sessionMetadata = { ...sessionMetadata, ...properties };
}

/**
 * Track an event — dispatches to all configured providers.
 * @param {string} eventName - Event name (e.g., 'soundboard_query')
 * @param {object} metadata - Event metadata
 */
export function trackEvent(eventName, metadata = {}) {
  const event = {
    event: eventName,
    userId,
    timestamp: new Date().toISOString(),
    properties: {
      ...sessionMetadata,
      ...metadata,
      page: typeof window !== 'undefined' ? window.location.pathname : null,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    },
  };

  // Queue events if not initialized — they'll be sent when provider is configured
  if (!initialized) {
    eventQueue.push(event);
    return;
  }

  dispatch(event);
}

const eventQueue = [];

function dispatch(event) {
  // Mixpanel dispatch
  if (PROVIDERS.mixpanel && typeof window !== 'undefined' && window.mixpanel) {
    try { window.mixpanel.track(event.event, event.properties); } catch {}
  }

  // Amplitude dispatch
  if (PROVIDERS.amplitude && typeof window !== 'undefined' && window.amplitude) {
    try { window.amplitude.track(event.event, event.properties); } catch {}
  }

  // PostHog dispatch
  if (PROVIDERS.posthog && typeof window !== 'undefined' && window.posthog) {
    try { window.posthog.capture(event.event, event.properties); } catch {}
  }

  // Console log in development
  if (process.env.NODE_ENV === 'development') {
    console.debug(`[analytics] ${event.event}`, event.properties);
  }
}

/**
 * Flush queued events after initialization.
 */
export function flushQueue() {
  while (eventQueue.length > 0) {
    dispatch(eventQueue.shift());
  }
}

// ═══ PREDEFINED EVENTS ═══

export const EVENTS = {
  USER_LOGIN: 'user_login',
  DASHBOARD_VIEW: 'dashboard_view',
  TAB_SWITCH: 'tab_switch',
  INTEGRATION_CONNECT_CLICK: 'integration_connect_click',
  SOUNDBOARD_OPEN: 'soundboard_open',
  SOUNDBOARD_QUERY: 'soundboard_query',
  DECISION_RECORDED: 'decision_recorded',
  AUTOMATION_TRIGGER_CLICK: 'automation_trigger_click',
  DAILY_BRIEF_OPEN: 'daily_brief_open',
  ALERT_OPEN: 'alert_open',
  // ── Snapshot telemetry ──
  SNAPSHOT_START: 'snapshot_start',
  SNAPSHOT_STAGE_COMPLETE: 'snapshot_stage_complete',
  SNAPSHOT_FINISH: 'snapshot_finish',
  SNAPSHOT_ERROR: 'snapshot_error',
  SNAPSHOT_TIMEOUT: 'snapshot_timeout',
  SNAPSHOT_RESUME: 'snapshot_resume',
  // ── Page telemetry ──
  PAGE_LOAD_START: 'page_load_start',
  PAGE_LOAD_COMPLETE: 'page_load_complete',
  PAGE_LOAD_ERROR: 'page_load_error',
  PAGE_RETRY: 'page_retry',
  // ── AI response gating ──
  AI_RESPONSE_BLOCKED: 'ai_response_blocked',
  AI_RESPONSE_DEGRADED: 'ai_response_degraded',
  AI_RESPONSE_FULL: 'ai_response_full',
  ACTIVATION_SIGNUP_COMPLETE: 'activation_signup_complete',
  ACTIVATION_CALIBRATION_COMPLETE: 'activation_calibration_complete',
  ACTIVATION_FIRST_SOUNDBOARD_USE: 'activation_first_soundboard_use',
  ACTIVATION_FIRST_REPORT: 'activation_first_report',
};

/**
 * Track a snapshot timing event with standardised payload.
 * @param {string} type - EVENTS.SNAPSHOT_*
 * @param {object} payload - { stage, elapsed_ms, error, state, ... }
 */
export function trackSnapshotEvent(type, payload = {}) {
  trackEvent(type, {
    module: payload.module || 'executive_snapshot',
    ...payload,
  });
}

export function trackActivationStep(step, metadata = {}) {
  trackEvent('activation_funnel_step', { step, ...metadata });
}

export function trackOnceForUser(eventName, userId, metadata = {}) {
  if (!userId) return;
  try {
    const key = `biqc_analytics_once_${userId}_${eventName}`;
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, '1');
    trackEvent(eventName, metadata);
  } catch {
    trackEvent(eventName, metadata);
  }
}
