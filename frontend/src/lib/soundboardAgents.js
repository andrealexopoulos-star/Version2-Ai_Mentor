export const AGENT_DEFINITIONS = {
  auto: { label: "BIQc Auto", icon: "⚡", description: "BIQc picks the right advisor for your question", minTier: "free" },
  general: { label: "Advisor", icon: "🎯", description: "Full business picture — priorities, trade-offs, what to focus on next", minTier: "free" },
  finance: { label: "Finance", icon: "💰", description: "Cash flow, margins, invoices, runway, and financial risk", minTier: "free" },
  sales: { label: "Sales", icon: "📈", description: "Pipeline, deals, leads, CRM data, and close rates", minTier: "free" },
  marketing: { label: "Marketing", icon: "📣", description: "Campaigns, channels, positioning, and competitive landscape", minTier: "free" },
  risk: { label: "Risk", icon: "🛡️", description: "Compliance, exposure, operational risk, and incident response", minTier: "free" },
  operations: { label: "Ops", icon: "⚙️", description: "Workflow, delivery, capacity, and process improvement", minTier: "free" },
  strategy: { label: "Strategy", icon: "🔭", description: "Planning, forecasts, scenarios, and quarterly priorities", minTier: "free" },
  boardroom: { label: "Boardroom", icon: "🏛️", description: "CEO + CFO + COO + CMO council — every angle on one question", minTier: "starter" },
};

export const MODE_DEFINITIONS = {
  auto: { label: "Auto", description: "BIQc selects the best model", minTier: "free" },
  fast: { label: "Fast", description: "Quick answers, lower latency", minTier: "free" },
  normal: { label: "Normal", description: "Balanced quality and speed", minTier: "free" },
  thinking: { label: "Thinking", description: "Deep reasoning for complex questions", minTier: "starter" },
  pro: { label: "Pro", description: "Long-context analysis", minTier: "starter" },
  trinity: { label: "Trinity", description: "Three AI models, one fused answer", minTier: "pro" },
};

export const TIER_RANK = { free: 0, starter: 1, pro: 2, enterprise: 3 };
