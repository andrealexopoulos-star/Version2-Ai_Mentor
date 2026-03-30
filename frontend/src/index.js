import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import "@/App.css";
import "@/mobile.css";
import App from "@/App";

if (process.env.NODE_ENV === "production") {
  // Prevent leaking internal implementation details in end-user browser consoles.
  /* eslint-disable no-console */
  console.log = () => {};
  console.info = () => {};
  console.debug = () => {};
  console.warn = () => {};
  console.error = () => {};
  /* eslint-enable no-console */
}

// ═══════════════════════════════════════════════════════════════
// LAYER 0: PRE-REACT SCROLL UNLOCK — runs synchronously before CSS paint
// Inline styles on DOM elements override ALL stylesheets (CSS specificity law).
// This fires BEFORE React renders anything.
// ═══════════════════════════════════════════════════════════════
(function unlockScroll() {
  var html = document.documentElement;
  var body = document.body;
  // HTML is the ONLY scroll container
  html.style.overflowY = 'scroll';
  html.style.overflowX = 'hidden';
  html.style.height = 'auto';
  html.style.position = 'static';
  html.style.overscrollBehavior = 'auto';
  // Body must NOT be a scroll container
  body.style.overflowY = 'visible';
  body.style.overflowX = 'hidden';
  body.style.height = 'auto';
  body.style.position = 'static';
  body.style.overscrollBehavior = 'auto';
})();

// ═══════════════════════════════════════════════════════════════
// OPERATION "CACHE KILL" — LAYER 1: THE KILL SWITCH
// Blocking service worker destruction before ANY React code runs.
// This MUST execute synchronously before render.
// ═══════════════════════════════════════════════════════════════
(function scorchServiceWorkers() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function(registrations) {
      for (let registration of registrations) {
        registration.unregister();
        // console.log('%c SERVICE WORKER FORCE-KILLED:', 'color: red; font-weight: bold', registration.scope);
      }
    });
  }
  // Nuke ALL caches
  if ('caches' in window) {
    caches.keys().then(function(names) {
      for (let name of names) {
        caches.delete(name);
        // console.log('%c CACHE DESTROYED:', 'color: red; font-weight: bold', name);
      }
    });
  }
})();

const root = ReactDOM.createRoot(document.getElementById("root"));
// Dev perf: StrictMode intentionally double-invokes effects, which can trigger
// duplicate polling/network traffic and make the platform feel slow locally.
const app = <App />;
if (process.env.NODE_ENV === "production") {
  root.render(<React.StrictMode>{app}</React.StrictMode>);
} else {
  root.render(app);
}
