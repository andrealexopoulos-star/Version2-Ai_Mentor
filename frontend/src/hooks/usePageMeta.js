import { useEffect } from 'react';

const DEFAULT_TITLE = 'BIQc — Business Intelligence Centre';
const DEFAULT_DESC = 'AI-powered business intelligence that continuously learns your business. Strategic advice, diagnostics, and growth planning for Australian SMEs.';

/**
 * Sets document title and meta description for the current page.
 * Lightweight alternative to react-helmet — no extra dependency.
 *
 * @param {{ title?: string, description?: string }} opts
 */
export default function usePageMeta({ title, description } = {}) {
  useEffect(() => {
    const prev = document.title;
    if (title) document.title = `${title} | BIQc`;

    const metaDesc = document.querySelector('meta[name="description"]');
    const prevDesc = metaDesc?.getAttribute('content');
    if (description && metaDesc) metaDesc.setAttribute('content', description);

    return () => {
      document.title = prev || DEFAULT_TITLE;
      if (prevDesc && metaDesc) metaDesc.setAttribute('content', prevDesc);
    };
  }, [title, description]);
}
