# Feature list consolidation proposal — PricingPage.js + HomePage

**Date:** 2026-04-19 (overnight work, review morning of 2026-04-20)
**Driving source:** external BIQc Website Review, item #1

---

## The reviewer's critique (verbatim)

> The Pricing page lists eighteen distinct product surfaces for $69/month, before you get to the Pro tier which adds another fourteen running in parallel. A sophisticated SMB buyer might read the list and conclude one of two things: either the product is a mile wide and an inch deep (each feature is a thin wrapper around an LLM call), or the list is aspirational and most features don't really exist yet.

> Proposed Fix: Collapse the feature list to 5–7 genuine capabilities. Anything that's really just a different prompt hitting the same LLM against the same data (Forensic Audit, Exposure Scan, Decision Tracker, Marketing Intelligence, Ops Advisory, Intel Centre, Analysis Suite) should be merged into one or two named surfaces.

## Current counts (actual, not estimated)

From [frontend/src/pages/website/PricingPage.js](frontend/src/pages/website/PricingPage.js):

- **Growth $69/mo:** 20 bullets
- **Pro $199/mo:** +14 bullets (so 34 cumulative)
- **Business $349/mo:** +7 bullets (so 41 cumulative)
- **Enterprise Custom:** +7 bullets (48 cumulative)

The reviewer was undercounting slightly. The credibility problem is real.

## Proposed consolidation — 20 → 6 on Growth

| # | New capability | Promise | Collapses these existing bullets |
|---|---|---|---|
| 1 | **Daily Operating Brief** | One morning brief of what changed overnight and what needs your attention today. | Market Intelligence Brief, Actions & Alerts, Data Health Monitor, Reports Library |
| 2 | **Unified Inbox & Calendar** | All your email and calendar intelligence in one thread, read-only, prioritised by business impact. | Email Inbox & Calendar |
| 3 | **Ask BIQc — Business Advisor Chat** | One conversation interface that knows your data. Ask anything from revenue trends to SOP drafting. | AI Business Advisor, Ask BIQc AI Chat, Board Room (single-model AI), Decision Tracker, SOP Generator |
| 4 | **Revenue & Ops Command** | Live view of revenue, billing, and operational risks. Forensic audit and exposure scan run nightly. | Revenue Analytics, Operations Centre, Billing Management, Forensic Audit, Exposure Scan |
| 5 | **Market & Competitive Intelligence** | Know what your competitors are doing and where your market is moving, weekly. | Competitive Benchmark, Business Profile & DNA, Marketing Intelligence, Marketing Automation |
| 6 | **40+ integrations (Merge.dev)** | Xero, HubSpot, Outlook, Gmail, Salesforce, and 35+ others. Read-only by default. | "Up to 5 integrations" (reframed as capability, with the integration-count limit shown as a small sub-line) |

**Pitch line at the top of the Growth tier:** *"Everything you need to protect, understand, and grow your business in one operating intelligence platform — powered by frontier AI models across 40+ connected tools."*

## Pro tier: 14 → 3

| # | New capability | Collapses |
|---|---|---|
| 1 | **Multi-model War Room** — three frontier models cross-check each other on complex questions | War Room, Analysis Suite, Intel Centre, Intelligence Baseline |
| 2 | **Risk & Compliance Centre** | Risk Intelligence, Compliance Centre, Watchtower, Audit Log, Document Library |
| 3 | **Operator Dashboard + unlimited integrations** | Operator Dashboard, Market Analysis, Ops Advisory, Data Centre, Unlimited integrations |

## Business tier: 7 → 2

| # | New capability | Collapses |
|---|---|---|
| 1 | **Premium AI pool + priority routing** (frontier models, highest token quotas) | Access to frontier models from OpenAI, Anthropic, and Google; 15M input + 6M output tokens/month; Priority model routing; Advanced risk & compliance modules |
| 2 | **Team & dedicated onboarding** (5 seats, 15 integrations, white-glove start) | Up to 15 integrations; Team collaboration (up to 5 seats); Dedicated onboarding session |

## Enterprise tier: 7 → 4 (already concise; minor grouping)

| # | New capability | Collapses |
|---|---|---|
| 1 | **Dedicated success + priority support** | Dedicated success manager; Priority support |
| 2 | **Custom integrations + SLA** | Custom integrations; SLA guarantees |
| 3 | **SSO + advanced security** | SSO & advanced security |
| 4 | **Custom AI model training + multi-seat** | Custom AI model training; Multi-seat team access |

## Comparison-table handling

The current Pricing page has a big comparison table (`COMPARE_GROUPS`) with rows like "AI Business Advisor · Ask BIQc AI Chat · Board Room · War Room · Custom AI model training". Under the consolidated approach these rows stay **under-the-fold** as optional detail for buyers who click "Compare all features" — but the hero tier cards only show the 6/3/2/4 bullets above.

This preserves the detail for thorough buyers without making the initial scan feel like a warehouse inventory.

## What I'd still keep visible

- Price ($69 / $199 / $349) — reviewer called the pricing ladder "legible"
- "14 days free · Cancel anytime" badge — just shipped
- Trust strip (Australian hosted, AES-256, SOC 2 in progress) — reviewer praised
- Read-only-by-default claim — reviewer praised

## What this asks of you

1. **Approve or adjust** the 6 / 3 / 2 / 4 consolidation labels above.
2. **Decide on the Pro tier "War Room" claim** — do we really run three models in parallel for every Pro user, or is that a marquee capability for a subset of workflows? If the latter, reword "Multi-model War Room" to be accurate about when/how the three models fire.
3. **Decide what to do with the names we're retiring** ("Forensic Audit", "Exposure Scan", "Decision Tracker", etc.). Three options:
   - (a) Drop completely — they were placeholders for features that are actually one LLM call
   - (b) Keep as section headings *inside* one of the consolidated surfaces (e.g., "Revenue & Ops Command includes Forensic Audit, Exposure Scan, and Billing Management")
   - (c) Keep on the marketing page as badges but not as tier bullets
4. **Decide whether to update PricingPage.js + HomePage.js in one PR** or stage separately. My recommendation: one PR after positioning (#2) is locked, so both changes land together.

## Guardrails

- Don't ship this without (1) positioning locked and (2) Andreas signing off on which features are real vs. placeholder. Feature-list shrinkage is a legal representation question — claiming a feature that's not delivered is risky.
- Once approved, I'll land as a single PR that changes PricingPage.js + HomePage's "What You Get" quadrants + the Platform page feature grid, so the consolidated story lands atomically.
