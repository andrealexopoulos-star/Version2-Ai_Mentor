# BIQc WEBSITE vs PLATFORM CAPABILITY — FORENSIC GAP AUDIT
## Date: 27 February 2026
## Scope: Every public website page vs actual delivered platform capability

---

## METHODOLOGY
Every claim, feature, statistic, and capability listed on the public website was extracted and compared against the actual platform codebase. Each item is classified as:

- **DELIVERED** — Feature exists and is operational in the platform
- **PARTIALLY DELIVERED** — Feature exists but incomplete or limited
- **NOT DELIVERED** — Claimed on website but does NOT exist in platform
- **OVERSTATED** — Feature exists but website description exceeds actual capability

---

## PAGE 1: HOMEPAGE (`/`)

### Stats Bar Claims
| Claim | Website Says | Reality | Status |
|-------|-------------|---------|--------|
| "40% Operational Improvement" | Stat displayed | No measurement system exists to verify this | **OVERSTATED** |
| "50% Reduced Manual Work" | Stat displayed | No time tracking or task automation measurement | **OVERSTATED** |
| "80% Lower Processing Costs" | Stat displayed | No cost tracking capability | **NOT DELIVERED** |
| "3x Faster Anomaly Detection" | Stat displayed | No benchmark comparison exists | **OVERSTATED** |
| "25% Fewer Preventable Errors" | Stat displayed | No error tracking system | **NOT DELIVERED** |

### Feature Claims
| Claim | Status | Evidence |
|-------|--------|----------|
| "Your Digital Leadership team surfacing risk & preventing problems weeks in advance" | **PARTIALLY** | Risk signals exist but no "weeks in advance" predictive engine |
| "Not a chatbot. Not a dashboard. Not another tool." | **DELIVERED** | Accurate — it's a cognitive platform |
| "No credit card required" | **DELIVERED** | Free tier exists |
| "Australian owned & operated" | **DELIVERED** | Supabase AU hosting confirmed |
| "Connects to your accounting, CRM, email, and operations. Watches every signal 24/7." | **PARTIALLY** | CRM/Accounting/Email connected via Merge.dev. "Operations" and "24/7 watching" overstated — pg_cron runs every 6-12 hours, not continuous |
| "Recommends actions, drafts communications, and automates corrective workflows" | **PARTIALLY** | Recommends actions (yes). Drafts communications (Soundboard can). **Automates corrective workflows — NOT DELIVERED** |
| "Daily intelligence briefs compiled from all your data sources" | **NOT DELIVERED** | No daily email brief system. pg_cron builds summary at 2am but doesn't deliver it |
| "Auto-Generated Briefings" | **NOT DELIVERED** | Executive memo exists in snapshot but no automated delivery mechanism (no email, no push, no Slack) |
| "14-day trial" | **NOT DELIVERED** | No trial tier implemented. Only Free and Paid tiers exist |
| "15+ Hrs/Week Reclaimed" | **OVERSTATED** | No time tracking. Cannot be verified |
| "Sentinel Active" | **OVERSTATED** | pg_cron runs periodically, not a real-time sentinel |

### Architecture Diagram Claims
| Claim | Status |
|-------|--------|
| Connected Systems: "Accounting, CRM, Email, HR, Operations" | **PARTIALLY** — HR not connected. Operations not a distinct integration |
| Intelligence Outputs: "Exec Alerts, Revenue Warnings, Compliance Flags, Cash Flow Risks, Auto-Generated Briefings" | **PARTIALLY** — Alerts exist in UI but no push notifications. No automated briefing delivery |

---

## PAGE 2: PLATFORM PAGE (`/platform`)

| Claim | Status | Evidence |
|-------|--------|----------|
| "Connects Your Systems — Secure OAuth integration with accounting, CRM, communication, and HR platforms" | **PARTIALLY** | Accounting + CRM + Email via Merge.dev/OAuth. **HR not connected** |
| "Monitors In Real Time" | **OVERSTATED** | pg_cron every 6-12 hours, not real-time. Supabase Realtime used for snapshot updates only |
| "Automates Correction" | **NOT DELIVERED** | No automated corrective actions. Platform recommends but does not execute |
| "Auto-Generated Briefings — Daily executive intelligence summaries" | **NOT DELIVERED** | No daily email/delivery system |
| "Executive Alerts" | **PARTIALLY** | Alert system exists in UI (`/alerts`) but no push/email/SMS notifications |
| "Revenue Warnings" | **DELIVERED** | RevenuePage shows warnings from CRM data |
| "Compliance Flags" | **PARTIALLY** | CompliancePage reads snapshot data but no active compliance monitoring |
| "Cash Flow Risks" | **PARTIALLY** | Only available if accounting integration connected. No independent cash analysis |

---

## PAGE 3: INTELLIGENCE PAGE (`/intelligence`)

### Financial Intelligence Claims
| Claim | Status |
|-------|--------|
| "Cash flow monitoring" | **PARTIALLY** — requires accounting integration, shows snapshot data only |
| "Invoice tracking & aged receivables" | **NOT DELIVERED** — no dedicated invoice view or aging report |
| "Expense anomaly detection" | **NOT DELIVERED** — no expense analysis engine |
| "Margin variance analysis" | **NOT DELIVERED** — no margin tracking over time |
| "Tax liability flags" | **NOT DELIVERED** — no tax calculation or alerting |
| "Runway projections" | **PARTIALLY** — shown in snapshot if accounting connected, not independently computed |

### Revenue Intelligence Claims
| Claim | Status |
|-------|--------|
| "Pipeline velocity tracking" | **DELIVERED** — RevenuePage shows deal velocity from CRM |
| "Lead conversion analysis" | **NOT DELIVERED** — no lead-to-deal conversion tracking |
| "Revenue concentration risk" | **DELIVERED** — RevenuePage Concentration tab |
| "Customer churn prediction" | **PARTIALLY** — churn signals shown from AI snapshot, not predictive model |
| "Deal stall detection" | **DELIVERED** — deals stalled >7 days detected |
| "Pricing optimisation signals" | **NOT DELIVERED** — no pricing analysis engine |

### Operations Intelligence Claims
| Claim | Status |
|-------|--------|
| "Staff utilisation rates" | **NOT DELIVERED** — no time tracking integration |
| "Overtime anomaly detection" | **NOT DELIVERED** — no payroll/timesheet integration |
| "SOP compliance monitoring" | **NOT DELIVERED** — SOP generator exists but no compliance tracking |
| "Delivery timeline tracking" | **NOT DELIVERED** — no project management integration |
| "Bottleneck identification" | **PARTIALLY** — shown in snapshot data, not real-time |
| "Task aging & SLA breaches" | **PARTIALLY** — shown if in snapshot, no direct PM tool integration |

### Risk & Compliance Claims
| Claim | Status |
|-------|--------|
| "Missing documentation alerts" | **NOT DELIVERED** |
| "Regulatory exposure detection" | **PARTIALLY** — shown in snapshot if detected |
| "Policy drift monitoring" | **NOT DELIVERED** |
| "Certification expiry tracking" | **NOT DELIVERED** |
| "Audit trail maintenance" | **DELIVERED** — governance_events audit log |
| "Compliance gap analysis" | **NOT DELIVERED** |

### Market Intelligence Claims
| Claim | Status |
|-------|--------|
| "Industry benchmark comparisons" | **NOT DELIVERED** — no benchmark database |
| "Competitor movement tracking" | **PARTIALLY** — competitor-monitor Edge Function exists but scheduled, not real-time |
| "Demand shift detection" | **PARTIALLY** — pressure levels computed but no demand shift model |
| "Pricing position analysis" | **NOT DELIVERED** |
| "Market sentiment tracking" | **NOT DELIVERED** — no sentiment analysis engine |
| "Regulatory change alerts" | **NOT DELIVERED** |

### People Intelligence Claims
| Claim | Status |
|-------|--------|
| "Response delay monitoring" | **NOT DELIVERED** — no email response time tracking |
| "Escalation trigger detection" | **PARTIALLY** — escalation_history table exists, basic tracking |
| "Client engagement decline" | **PARTIALLY** — shown in snapshot churn signals |
| "Sentiment shift detection" | **NOT DELIVERED** |

---

## PAGE 4: INTEGRATIONS PAGE (`/our-integrations`)

| Claim | Status |
|-------|--------|
| "Connect any platform with a REST or GraphQL API" | **NOT DELIVERED** — only Merge.dev + OAuth integrations |
| "Webhook Ingestion — Receive real-time events from any system" | **NOT DELIVERED** — only Stripe webhook exists |
| "CSV Ingestion — Bulk import structured data from spreadsheets" | **NOT DELIVERED** |
| "Secure Data Sync — Encrypted, role-based continuous synchronisation" | **PARTIALLY** — Merge.dev syncs periodically, not continuous |
| "Revoke Anytime — Disconnect any integration instantly. Data removed within 24 hours" | **PARTIALLY** — Disconnect exists. 24-hour data removal not implemented |
| "Transparent Permissions — Clear visibility into exactly what data BIQc accesses" | **NOT DELIVERED** — no permissions visibility UI |

---

## PAGE 5: PRICING PAGE (`/pricing`)

### Complimentary Tier Claims
| Feature | Status |
|---------|--------|
| "13-layer digital footprint scan" | **OVERSTATED** — ingestion engine has 3 layers, not 13 |
| "Market Presence Score" | **NOT DELIVERED** — no dedicated market presence score |
| "Competitive positioning overview" | **DELIVERED** — engagement scan provides this |
| "Category positioning map" | **NOT DELIVERED** — no visual positioning map |
| "Funnel friction flags" | **DELIVERED** — MarketPage friction tab |
| "Trust footprint comparison" | **NOT DELIVERED** — no trust footprint metric |
| "Market saturation visibility" | **DELIVERED** — MarketPage saturation tab |
| "Data confidence indicator" | **DELIVERED** — DataConfidence component |

### Foundation Tier ($197) Claims
| Feature | Status |
|---------|--------|
| "Live market metrics (with integrations)" | **DELIVERED** |
| "Revenue intelligence" | **DELIVERED** |
| "Workforce baseline monitoring" | **DELIVERED** — Workforce Intelligence tab |
| "Cash discipline visibility" | **PARTIALLY** — requires accounting integration |

### Performance Tier ($297) Claims
| Feature | Status |
|---------|--------|
| "60-day forecasting" | **NOT DELIVERED** — no time-based forecasting engine |
| "Service-line profitability insight" | **NOT DELIVERED** — no service-line breakdown |
| "Hiring trigger detection" | **NOT DELIVERED** — no HR integration |
| "Capacity strain modelling" | **PARTIALLY** — workforce tab shows capacity |
| "Margin compression alerts" | **NOT DELIVERED** — no margin tracking |

### Growth Tier ($497) Claims
| Feature | Status |
|---------|--------|
| "90-day projections" | **NOT DELIVERED** — scenario modeling exists but not time-based |
| "Hiring vs outsource modelling" | **NOT DELIVERED** |
| "Payroll yield analysis" | **NOT DELIVERED** — no payroll integration |
| "Revenue expansion simulation" | **NOT DELIVERED** — scenario modeling is probability-based, not simulation |
| "Market saturation scoring" | **DELIVERED** |
| "Scenario planning capability" | **DELIVERED** — RevenuePage Scenarios tab |

### Enterprise Tier Claims
| Feature | Status |
|---------|--------|
| "Multi-division reporting" | **NOT DELIVERED** |
| "Custom KPI frameworks" | **NOT DELIVERED** |
| "Governance controls" | **PARTIALLY** — basic governance events, not full governance framework |
| "Executive reporting automation" | **NOT DELIVERED** — PDF export exists but not automated |
| "Custom integrations" | **NOT DELIVERED** — only Merge.dev |
| "Sovereign data options" | **DELIVERED** — Australian hosting |
| "Advanced AI Modelling" | **OVERSTATED** — uses GPT-4o, no custom models |
| "Multi-Location Benchmarking" | **NOT DELIVERED** |

---

## PAGE 6: TRUST PAGES (`/trust/*`)

| Claim | Status |
|-------|--------|
| "Sydney-based data centres" | **DELIVERED** — Supabase AU |
| "Australian-owned infrastructure" | **DELIVERED** |
| "Compliant with the Privacy Act 1988" | **CLAIMED** — no compliance certification shown |
| "No data processed offshore" | **DELIVERED** — Supabase AU region |
| "Full data sovereignty guarantee" | **DELIVERED** |
| "TLS 1.3 for all communications" | **DELIVERED** — Supabase default |
| "Role-based access, MFA enforcement" | **PARTIALLY** — role-based yes (admin/user). **MFA not implemented** |
| "Complete audit trail of all data access, modifications, and system events" | **PARTIALLY** — governance_events tracks events but not all data access/modifications |

---

## SUMMARY SCORECARD

### By Category
| Category | Delivered | Partial | Not Delivered | Overstated |
|----------|-----------|---------|---------------|------------|
| Homepage | 3 | 4 | 4 | 5 |
| Platform Page | 1 | 4 | 2 | 1 |
| Intelligence Page | 5 | 8 | 15 | 0 |
| Integrations Page | 0 | 2 | 4 | 0 |
| Pricing Page | 8 | 3 | 13 | 1 |
| Trust Pages | 4 | 2 | 0 | 0 |
| **TOTAL** | **21** | **23** | **38** | **7** |

### Critical Gaps (NOT DELIVERED features prominently displayed)
1. **Daily intelligence briefing delivery** — Claimed on homepage + platform page. No email/push delivery system exists
2. **Automated corrective workflows** — Claimed on homepage + platform page. Platform recommends only
3. **14-day trial** — Claimed on homepage. Not implemented
4. **Invoice tracking & aged receivables** — Claimed on intelligence page
5. **Expense anomaly detection** — Claimed on intelligence page
6. **Staff utilisation rates** — Claimed on intelligence page
7. **Lead conversion analysis** — Claimed on intelligence page
8. **60-day / 90-day forecasting** — Claimed on pricing page
9. **CSV ingestion** — Claimed on integrations page
10. **Webhook ingestion from any system** — Claimed on integrations page
11. **Open API support** — Claimed on integrations page
12. **13-layer digital footprint scan** — Claimed on pricing page (actual: 3 layers)
13. **Hiring trigger/outsource modelling** — Claimed on pricing page
14. **Multi-division reporting** — Claimed on pricing page
15. **MFA enforcement** — Claimed on trust page

### Integrity Risk Level: HIGH
38 features claimed on website but not delivered in platform.
7 features overstated beyond actual capability.
Website copy needs alignment with actual platform state.
