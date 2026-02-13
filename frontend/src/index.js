import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import "@/App.css";
import "@/mobile-enhancements.css";
import "@/mobile-ux-overhaul.css";
import "@/landing-mobile-ux.css";
import "@/executive-refinement.css";
import App from "@/App";

// ═══ LAYER 1: AGGRESSIVE SERVICE WORKER KILL ═══
// Force-unregister ALL service workers on every page load.
// Stale service workers intercept API calls and serve cached HTML.
(async function killServiceWorkers() {
  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        await reg.unregister();
      }
      if (registrations.length > 0) {
        console.log(`[SW-KILL] Unregistered ${registrations.length} service worker(s)`);
      }
    } catch (e) {
      console.warn('[SW-KILL] Failed:', e.message);
    }
  }
  if ('caches' in window) {
    try {
      const names = await caches.keys();
      await Promise.all(names.map(n => caches.delete(n)));
      if (names.length > 0) {
        console.log(`[SW-KILL] Cleared ${names.length} cache(s)`);
      }
    } catch (e) {
      console.warn('[SW-KILL] Cache clear failed:', e.message);
    }
  }
})();

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
