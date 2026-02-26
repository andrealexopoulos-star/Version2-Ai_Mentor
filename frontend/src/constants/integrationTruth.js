// Integration truth constants — shared across components
// CRM-dependent terms that must be suppressed without integration
export const CRM_TERMS = ['pipeline', 'stale lead', 'churn', 'follow-up', 'cashflow', 'follow up', 'leads'];

export function containsCRMClaim(text) {
  if (!text || typeof text !== 'string') return false;
  const lower = text.toLowerCase();
  return CRM_TERMS.some(term => lower.includes(term));
}
