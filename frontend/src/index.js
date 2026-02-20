import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import "@/App.css";
import "@/mobile-enhancements.css";
import "@/mobile-ux-overhaul.css";
import "@/landing-mobile-ux.css";
import "@/executive-refinement.css";
import "@/scroll-fix-critical.css"; // MUST BE LAST CSS - critical scroll fix
import App from "@/App";

// ═══════════════════════════════════════════════════════════════
// LAYER 0: PRE-REACT SCROLL UNLOCK — runs synchronously before CSS paint
// Inline styles on DOM elements override ALL stylesheets (CSS specificity law).
// This fires BEFORE React renders anything.
// ═══════════════════════════════════════════════════════════════
(function unlockScroll() {
  var html = document.documentElement;
  var body = document.body;
  html.style.overflowY = 'auto';
  html.style.overflowX = 'hidden';
  html.style.height = 'auto';
  html.style.position = 'static';
  body.style.overflowY = 'auto';
  body.style.overflowX = 'hidden';
  body.style.height = 'auto';
  body.style.position = 'static';
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
        console.log('%c SERVICE WORKER FORCE-KILLED:', 'color: red; font-weight: bold', registration.scope);
      }
    });
  }
  // Nuke ALL caches
  if ('caches' in window) {
    caches.keys().then(function(names) {
      for (let name of names) {
        caches.delete(name);
        console.log('%c CACHE DESTROYED:', 'color: red; font-weight: bold', name);
      }
    });
  }
})();

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
