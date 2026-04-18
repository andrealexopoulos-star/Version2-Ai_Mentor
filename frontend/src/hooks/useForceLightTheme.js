import { useEffect } from 'react';

/**
 * Force `<html data-theme="light">` while this component is mounted.
 *
 * Why this exists: if a user toggled dark theme in-app (`/advisor` etc),
 * `document.documentElement[data-theme]` stays `"dark"`. Coming back to an
 * auth / marketing surface inherits dark-theme tokens — `--ink-display`
 * resolves to white, and body copy on the sage canvas becomes invisible.
 *
 * Used on:
 *   - Auth pages (Login, Register, Reset, Update, AuthCallback)
 *   - Any public-facing surface outside the app shell
 *
 * Also used (inline, with the same pattern) in WebsiteLayout.js for
 * marketing pages.
 *
 * Restores the prior theme on unmount so the app-side toggle is preserved
 * when the user navigates back into the app.
 */
export default function useForceLightTheme() {
  useEffect(() => {
    const root = document.documentElement;
    const prev = root.getAttribute('data-theme');
    root.setAttribute('data-theme', 'light');
    return () => {
      if (prev) root.setAttribute('data-theme', prev);
      else root.removeAttribute('data-theme');
    };
  }, []);
}
