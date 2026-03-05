/**
 * BIQc Telemetry — Frontend observability hooks
 * Sends events only. Processing happens in infrastructure (Datadog/OTel/Grafana).
 */

let telemetryEndpoint = null;
const perfMarks = {};

/**
 * Initialize telemetry with optional endpoint for sending metrics.
 */
export function initTelemetry(config = {}) {
  telemetryEndpoint = config.endpoint || null;
}

/**
 * Record page render time.
 */
export function trackPageRender(pageName) {
  const entry = performance.getEntriesByType('navigation')[0];
  const renderTime = entry ? Math.round(entry.domContentLoadedEventEnd - entry.fetchStart) : null;

  sendTelemetry({
    type: 'page_render_time',
    page: pageName,
    render_ms: renderTime,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Start timing an API call.
 */
export function startApiTimer(requestId) {
  perfMarks[requestId] = performance.now();
}

/**
 * End timing and record API response time.
 */
export function endApiTimer(requestId, endpoint, status) {
  const start = perfMarks[requestId];
  if (!start) return;
  const elapsed = Math.round(performance.now() - start);
  delete perfMarks[requestId];

  sendTelemetry({
    type: 'api_response_time',
    endpoint,
    status,
    latency_ms: elapsed,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Record a component error.
 */
export function trackComponentError(componentName, error) {
  sendTelemetry({
    type: 'component_error',
    component: componentName,
    error: error?.message || String(error),
    stack: error?.stack?.substring(0, 500),
    timestamp: new Date().toISOString(),
  });
}

/**
 * Record user action latency (time between click and result).
 */
export function trackActionLatency(actionName, latencyMs) {
  sendTelemetry({
    type: 'user_action_latency',
    action: actionName,
    latency_ms: latencyMs,
    timestamp: new Date().toISOString(),
  });
}

function sendTelemetry(data) {
  // Development: console log
  if (process.env.NODE_ENV === 'development') {
    console.debug(`[telemetry] ${data.type}`, data);
  }

  // Production: send to telemetry endpoint
  if (telemetryEndpoint) {
    try {
      navigator.sendBeacon(telemetryEndpoint, JSON.stringify(data));
    } catch {
      // Fallback: fetch
      fetch(telemetryEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        keepalive: true,
      }).catch(() => {});
    }
  }
}
