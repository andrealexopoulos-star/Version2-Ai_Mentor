const DATA_QUERY_PATTERNS = [
  /^show me (my )?(pipeline|deals|invoices|revenue|leads|contacts|spend)/i,
  /^what (is|was|are) (my |our )?(total |current )?(pipeline|revenue|spend|overdue|outstanding)/i,
  /^how much (did|have|has|do)/i,
  /^how many (deals|leads|contacts|invoices|clients)/i,
  /^(list|give me|pull up) (my |our )?(deals|invoices|pipeline|leads|contacts)/i,
  /^what('s| is) (my |our )?(pipeline value|revenue figure|total spend)/i,
];

const REPORT_QUERY_PATTERNS = [
  /\b(board report|board pack|board summary|performance report|monthly report|quarterly report)\b/i,
  /\b(last|past)\s+(12|twelve)\s+months?\b/i,
  /\b12[- ]month\b/i,
  /\bexecutive report\b/i,
  /\b(review|analyse|analyze|summari[sz]e)\b.*\b(last|past)\s+(12|twelve)\s+months?\b/i,
  /\b12[- ]month\s+(review|performance|narrative|summary)\b/i,
  /\bhow the business performed\b/i,
  /analy[sz]e.*\b(inbox|sent|deleted|trash)\b/i,
  /cross[- ]integration analytics/i,
  /(merge|integration).*(insights|analytics|analysis)/i,
];

export function isSoundboardDataQuery(message) {
  const lower = String(message || '').trim().toLowerCase();
  return DATA_QUERY_PATTERNS.some((pattern) => pattern.test(lower));
}

export function isSoundboardReportQuery(message) {
  const lower = String(message || '').trim().toLowerCase();
  return REPORT_QUERY_PATTERNS.some((pattern) => pattern.test(lower));
}

export function shouldUseGroundedDataQuery(message) {
  return isSoundboardDataQuery(message) && !isSoundboardReportQuery(message);
}

export function deriveSoundboardRequestScope(message = '') {
  const text = String(message || '').toLowerCase();
  return {
    mailbox_scope: {
      inbox: /\binbox\b/.test(text),
      sent: /\bsent\b/.test(text) || /\bsent items\b/.test(text),
      deleted: /\bdeleted\b/.test(text) || /\btrash\b/.test(text),
    },
    wants_integration_analytics: /(merge|integration|insight|analytics|trend|breakdown|compare)/.test(text),
  };
}
