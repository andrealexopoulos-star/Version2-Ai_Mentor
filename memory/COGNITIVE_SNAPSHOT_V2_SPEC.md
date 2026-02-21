# BIQc COGNITIVE SNAPSHOT v2 — FULL EXECUTIVE COGNITION SYSTEM
## Design Specification for Review & Sign-Off
### Prepared: 21 February 2026

---

## THE UPGRADE: From Strategic Awareness → Executive Cognition

### Current (v1): Diagnoses
### Target (v2): Diagnoses + Governs + Decides + Allocates + Enforces

---

## COMPLETE OUTPUT STRUCTURE

The Edge Function will return this JSON. Every field is consumed by the UI.

```json
{
  "system_state": {
    "status": "STABLE | DRIFT | COMPRESSION | CRITICAL",
    "confidence": 82,
    "interpretation": "One sentence. Why this state.",
    "velocity": "improving | stable | worsening",
    "velocity_detail": "Moved from COMPRESSION to DRIFT in 5 days. Trajectory improving.",
    "burn_rate_overlay": "At current spend, 4.2 months runway. Stable."
  },

  "inevitabilities": [
    {
      "domain": "Revenue | Operations | People | Financial | Market",
      "signal": "What is becoming inevitable",
      "intensity": "forming | accelerating | imminent",
      "probability": 75,
      "financial_impact": { "low": 15000, "high": 45000, "currency": "AUD" },
      "intervention_window": "12 days",
      "owner": "Founder | Operations Lead | Sales | Finance",
      "if_ignored": "What happens if no action taken"
    }
  ],

  "priority_compression": {
    "primary_focus": "The ONE thing. One sentence.",
    "primary_hours": "~6 hrs this week",
    "primary_impact": "high",
    "secondary_focus": "The second thing. One sentence.",
    "secondary_hours": "~2 hrs this week",
    "delegate_to": "Operations manager or VA",
    "noise_to_ignore": "What looks urgent but isn't."
  },

  "opportunity_decay": {
    "decaying": "What opportunity is being lost. Reference specific deals/contacts.",
    "value": { "estimated": 28000, "currency": "AUD" },
    "velocity": "3-5 days before lost",
    "competitive_risk": "Competitor X is actively pursuing this segment.",
    "recovery_action": "What to do. One sentence."
  },

  "capital_allocation": {
    "cash_runway_months": 4.2,
    "margin_trend": "compressing | stable | expanding",
    "margin_detail": "Margins compressed 3% over 60 days due to rising subcontractor costs.",
    "scenario_30d": {
      "best": "Revenue up 8% if Deal A closes. Runway extends to 5.1 months.",
      "base": "Revenue flat. Runway 4.2 months. No immediate risk.",
      "worst": "Deal A lost + Client B churns. Runway drops to 2.8 months."
    },
    "spend_efficiency": "Marketing spend returning $4.20 per $1 (above benchmark). Maintain.",
    "hiring_affordability": "Can absorb 1 FTE at current margin. Not recommended until Deal A resolved.",
    "alerts": [
      { "type": "margin_compression", "detail": "Subcontractor costs up 12% in 45 days", "severity": "medium" }
    ]
  },

  "execution_governance": {
    "sla_breaches": 2,
    "sla_detail": "2 client deliverables past deadline: Project Alpha (3 days), Invoice #1847 (7 days overdue).",
    "task_aging_index": "14% of open tasks older than 14 days. Threshold: 10%.",
    "bottleneck": "Proposal generation — 3 proposals stalled awaiting pricing sign-off.",
    "velocity_trend": "Task completion rate down 8% vs last 30 days.",
    "resource_load": "Founder at 112% capacity. Operations at 78%. Sales at 45%.",
    "recommendations": [
      "Delegate pricing authority for proposals under $5,000",
      "Automate invoice follow-up for amounts under $2,000"
    ]
  },

  "revenue_forecast": {
    "pipeline_total": 185000,
    "weighted_forecast": 74000,
    "pipeline_entropy": "medium",
    "entropy_detail": "60% of pipeline value concentrated in 2 deals. High concentration risk.",
    "close_probability": [
      { "deal": "Deal Alpha", "value": 45000, "probability": 65, "stall_days": 0 },
      { "deal": "Deal Beta", "value": 28000, "probability": 40, "stall_days": 12 },
      { "deal": "Deal Gamma", "value": 15000, "probability": 80, "stall_days": 0 }
    ],
    "lead_quality_trend": "stable",
    "churn_signals": [
      { "client": "Client B", "risk": "medium", "signal": "Response time increased 3x over 30 days" }
    ]
  },

  "decision_forcing": {
    "decision_required": "Should you hire a junior operations person or invest in automation tools?",
    "options": [
      {
        "option": "Hire junior ops (Part-time $35K/yr)",
        "risk": "medium — adds fixed cost, 6-week ramp",
        "capital_impact": "-$35K annual, -$3K/mo",
        "timeline_impact": "Operational relief in 8 weeks",
        "upside": "Human judgment for edge cases. Scalable.",
        "downside": "Fixed cost. Management overhead."
      },
      {
        "option": "Invest in automation ($500/mo tooling)",
        "risk": "low — variable cost, immediate",
        "capital_impact": "-$6K annual, -$500/mo",
        "timeline_impact": "Operational relief in 2 weeks",
        "upside": "Immediate. No management. Scales infinitely.",
        "downside": "Cannot handle judgment calls. Setup effort."
      },
      {
        "option": "Do nothing for 30 days. Reassess.",
        "risk": "medium — founder burnout continues",
        "capital_impact": "$0",
        "timeline_impact": "No change. Current trajectory continues.",
        "upside": "Preserves cash. More data before deciding.",
        "downside": "Burnout risk accelerates. 2 SLA breaches may become 5."
      }
    ],
    "recommendation": "Option B (automation) as immediate action + revisit hiring in 60 days after Deal A resolved.",
    "deadline": "Decide by end of this week. Each week of delay = ~4 hrs founder time lost."
  },

  "risk_compliance": {
    "single_points_of_failure": [
      "All client relationships depend on founder. No backup contact.",
      "Accounting runs through 1 Xero login with no redundancy."
    ],
    "vendor_concentration": "85% of revenue comes from 3 clients. Threshold: max 40% from any single client.",
    "regulatory_alerts": [
      { "item": "BAS Q3 due in 18 days", "severity": "medium" },
      { "item": "Workers comp renewal due in 45 days", "severity": "low" }
    ],
    "contract_exposure": "2 contracts expire within 60 days. No renewal discussion started.",
    "data_security": "All integrations use OAuth read-only. No write access granted. Compliant."
  },

  "resource_reallocation": {
    "triggered_by": "Operations DRIFT detected + Founder at 112% capacity",
    "recommendations": [
      { "action": "Move $2K/mo from paid ads to automation tooling", "rationale": "Ads returning diminishing. Automation solves bottleneck.", "impact": "Frees ~8 hrs/week founder time" },
      { "action": "Kill Project Delta proposal", "rationale": "12 days stalled. Client unresponsive. Opportunity cost too high.", "impact": "Recovers 6 hrs of sales effort" },
      { "action": "Raise hourly rate for Service B by 15%", "rationale": "Margin compression on this service. Below market rate.", "impact": "+$800/mo margin, minimal churn risk" }
    ]
  },

  "founder_vitals": {
    "capacity_index": 112,
    "capacity_status": "overloaded",
    "email_stress_signals": "Response latency up 40% vs 30-day average. 3 emails flagged with stressed tone.",
    "calendar_compression": "42 meetings this week vs 28 average. 6 back-to-back blocks.",
    "decision_fatigue_risk": "high — 14 open decisions pending. Threshold: 8.",
    "recommendation": "Block 2 hours Friday for decision clearing. Cancel or delegate 3 lowest-value meetings."
  },

  "executive_memo": "2-3 paragraphs. Written as a strategic partner. References specific data. This is clarity, not information.",

  "strategic_alignment": {
    "narrative": "One paragraph. Does stated intent match actual behaviour?",
    "kpi_contradiction_index": 2,
    "contradictions": [
      "Goal: grow revenue 20%. Reality: 0 new outbound activities in 14 days.",
      "Goal: improve ops. Reality: no SOP documented for top 3 processes."
    ]
  },

  "market_position": {
    "narrative": "Market summary paragraph.",
    "competitors_tracked": 3,
    "competitor_signals": [
      { "name": "Competitor A", "signal": "Launched new pricing page this week", "source": "perplexity" },
      { "name": "Competitor B", "signal": "Hiring 2 sales roles (LinkedIn)", "source": "perplexity" }
    ],
    "pricing_benchmark": "Your pricing is 15% below market average for this service category.",
    "sentiment_trend": "Neutral. No significant brand mentions detected this week."
  },

  "blind_spots": {
    "no_data": [
      { "area": "Financial", "detail": "No accounting tool connected. Cash analysis unavailable.", "fix": "Connect Xero or QuickBooks" },
      { "area": "HR", "detail": "No HR/payroll connected. Team metrics unavailable.", "fix": "Connect BambooHR or similar" }
    ],
    "stale_data": [
      { "area": "Email", "detail": "Last sync 3 days ago. Recent signals may be missed.", "freshness": "stale" }
    ],
    "confidence_score": 68,
    "confidence_detail": "68% — Limited by missing financial data and stale email sync."
  },

  "data_sources": ["business_profile", "calibration_persona", "emails (25)", "CRM (42 contacts, 8 deals)", "signals (18)"],
  "generated_at": "2026-02-21T10:00:00Z"
}
```

---

## UI LAYOUT — HOW THE ADVISOR DASHBOARD DISPLAYS THIS

The dashboard renders top-to-bottom in this order. Each section is a card/panel.

### 1. HEADER BAR (Sticky)
```
┌─────────────────────────────────────────────────────────────┐
│ [●] DRIFT  ↗ improving  Confidence: 82%  Runway: 4.2mo     │
│     "Cash stable but ops drifting. Founder at 112%."        │
└─────────────────────────────────────────────────────────────┘
```
- System state dot (colour-coded)
- Velocity arrow (↗ improving, → stable, ↘ worsening)
- Confidence percentage
- Cash runway months
- One-line interpretation

### 2. DECISION FORCING (Top priority — demands action)
```
┌─────────────────────────────────────────────────────────────┐
│ DECISION REQUIRED                          Decide by: Fri   │
│                                                             │
│ "Should you hire a junior ops person or invest in           │
│  automation tools?"                                         │
│                                                             │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│ │ OPTION A    │ │ OPTION B    │ │ OPTION C    │           │
│ │ Hire PT     │ │ Automate    │ │ Wait 30d    │           │
│ │ Risk: Med   │ │ Risk: Low   │ │ Risk: Med   │           │
│ │ -$3K/mo     │ │ -$500/mo    │ │ $0          │           │
│ │ 8 weeks     │ │ 2 weeks     │ │ No change   │           │
│ └─────────────┘ └─────────────┘ └─────────────┘           │
│                                                             │
│ BIQc Recommends: Option B + revisit in 60 days             │
└─────────────────────────────────────────────────────────────┘
```

### 3. FOUNDER VITALS (If overloaded)
```
┌─────────────────────────────────────────────────────────────┐
│ FOUNDER VITALS                            Capacity: 112% ▲  │
│                                                             │
│ Calendar: 42 meetings (avg 28)  │  Decisions pending: 14   │
│ Email response: +40% slower     │  Fatigue risk: HIGH      │
│                                                             │
│ → Block 2hrs Friday for decision clearing                   │
│ → Cancel/delegate 3 lowest-value meetings                   │
└─────────────────────────────────────────────────────────────┘
```

### 4. ACTIVE INEVITABILITIES (Max 3)
```
┌─────────────────────────────────────────────────────────────┐
│ INEVITABILITIES                                             │
│                                                             │
│ ┌ REVENUE · accelerating · 75% · $15K-$45K impact ───────┐ │
│ │ Three enterprise deals stalled at proposal stage.        │ │
│ │ Window: 12 days  │  Owner: Sales  │  If ignored: Q2 gap │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌ OPERATIONS · forming · 60% · $5K-$12K impact ──────────┐ │
│ │ Task completion rate down 8%. SOP adherence dropping.    │ │
│ │ Window: 3 weeks  │  Owner: Ops Lead  │  If ignored: ... │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 5. CAPITAL ALLOCATION (CFO Brain)
```
┌─────────────────────────────────────────────────────────────┐
│ CAPITAL POSITION                                            │
│                                                             │
│ Runway: 4.2 months  │  Margins: compressing (-3%)          │
│                                                             │
│ 30-DAY SCENARIOS:                                           │
│   Best:  Revenue +8%. Runway → 5.1mo                       │
│   Base:  Flat. 4.2mo. No risk.                              │
│   Worst: Deal A lost + Client B churns. → 2.8mo            │
│                                                             │
│ Spend: Marketing $4.20 return per $1 (✓ above benchmark)   │
│ Hiring: Can absorb 1 FTE. Not recommended until Deal A.    │
│                                                             │
│ ⚠ Subcontractor costs up 12% in 45 days                    │
└─────────────────────────────────────────────────────────────┘
```

### 6. EXECUTION GOVERNANCE (COO Brain)
```
┌─────────────────────────────────────────────────────────────┐
│ EXECUTION STATUS                                            │
│                                                             │
│ SLA Breaches: 2  │  Task aging: 14% (⚠ above 10%)         │
│ Bottleneck: Proposal pricing sign-off (3 stalled)          │
│ Velocity: -8% vs 30-day average                            │
│                                                             │
│ Load: Founder 112% │ Ops 78% │ Sales 45%                   │
│                                                             │
│ → Delegate pricing authority for proposals under $5K        │
│ → Automate invoice follow-up for amounts under $2K          │
└─────────────────────────────────────────────────────────────┘
```

### 7. REVENUE FORECAST (CRO Brain)
```
┌─────────────────────────────────────────────────────────────┐
│ REVENUE PIPELINE                                            │
│                                                             │
│ Total: $185K  │  Weighted: $74K  │  Entropy: MEDIUM        │
│ "60% of value in 2 deals. High concentration risk."        │
│                                                             │
│ Deal Alpha   $45K  65% ████████░░  0 days stalled          │
│ Deal Beta    $28K  40% ████░░░░░░  12 days stalled ⚠       │
│ Deal Gamma   $15K  80% █████████░  Active                  │
│                                                             │
│ Churn risk: Client B — response time up 3x in 30 days      │
└─────────────────────────────────────────────────────────────┘
```

### 8. RESOURCE REALLOCATION
```
┌─────────────────────────────────────────────────────────────┐
│ REALLOCATION RECOMMENDATIONS     Triggered by: Ops DRIFT    │
│                                                             │
│ 1. Move $2K/mo ads → automation  │  Frees 8 hrs/week       │
│ 2. Kill Deal Delta proposal      │  Recovers 6 hrs sales   │
│ 3. Raise Service B rate +15%     │  +$800/mo margin        │
└─────────────────────────────────────────────────────────────┘
```

### 9. PRIORITY COMPRESSION
```
┌─────────────────────────────────────────────────────────────┐
│ THIS WEEK                                                   │
│                                                             │
│ PRIMARY: Close Deal Alpha pricing sign-off     ~6 hrs       │
│ SECONDARY: Fix SLA breach on Project Alpha     ~2 hrs       │
│            → Delegate to: Operations manager                │
│ IGNORE: Social media rebrand discussion (noise)             │
└─────────────────────────────────────────────────────────────┘
```

### 10. RISK & COMPLIANCE
```
┌─────────────────────────────────────────────────────────────┐
│ RISK REGISTER                                               │
│                                                             │
│ Single Points of Failure:                                   │
│   • All client relationships depend on founder              │
│   • Accounting: 1 Xero login, no redundancy                │
│                                                             │
│ Revenue Concentration: 85% from 3 clients (threshold: 40%) │
│                                                             │
│ Upcoming: BAS Q3 due in 18 days │ Workers comp in 45 days  │
│ Contracts: 2 expire within 60 days, no renewal started     │
└─────────────────────────────────────────────────────────────┘
```

### 11. STRATEGIC ALIGNMENT
```
┌─────────────────────────────────────────────────────────────┐
│ ALIGNMENT CHECK                    Contradictions: 2        │
│                                                             │
│ ⚠ Goal: grow revenue 20%.                                   │
│   Reality: 0 new outbound activities in 14 days.            │
│                                                             │
│ ⚠ Goal: improve operations.                                 │
│   Reality: no SOP documented for top 3 processes.           │
└─────────────────────────────────────────────────────────────┘
```

### 12. MARKET POSITION
```
┌─────────────────────────────────────────────────────────────┐
│ MARKET INTELLIGENCE              3 competitors tracked      │
│                                                             │
│ • Competitor A: Launched new pricing page this week         │
│ • Competitor B: Hiring 2 sales roles (LinkedIn)             │
│                                                             │
│ Your pricing: 15% below market average for this category    │
│ Sentiment: Neutral. No significant mentions this week.      │
└─────────────────────────────────────────────────────────────┘
```

### 13. EXECUTIVE MEMO
```
┌─────────────────────────────────────────────────────────────┐
│ EXECUTIVE MEMO                                              │
│                                                             │
│ 2-3 paragraphs. Written as a strategic partner.             │
│ References specific deal names, email subjects,             │
│ contact names, financial positions. Forward-looking         │
│ with 30/60/90 day scenario modeling.                        │
│ Ends with hard recommendation, not just briefing.           │
└─────────────────────────────────────────────────────────────┘
```

### 14. BLIND SPOTS (Bottom — transparency)
```
┌─────────────────────────────────────────────────────────────┐
│ BLIND SPOTS                      Overall Confidence: 68%    │
│                                                             │
│ 🔴 No financial data — Connect Xero or QuickBooks           │
│ 🔴 No HR data — Connect BambooHR                            │
│ 🟡 Email sync stale (3 days) — Re-sync recommended          │
│                                                             │
│ Sources: business_profile, calibration, emails (25),        │
│          CRM (42 contacts, 8 deals), signals (18)           │
└─────────────────────────────────────────────────────────────┘
```

---

## WHAT CHANGES vs CURRENT

| Section | Current v1 | Upgraded v2 |
|---|---|---|
| System State | Status + interpretation | + confidence %, velocity trend, burn rate |
| Inevitabilities | Domain + signal + window | + probability %, financial impact range, ownership |
| Priority Compression | Focus + noise | + time allocation, delegation, impact weight |
| Opportunity Decay | What's decaying | + dollar value, competitive risk, acceleration |
| **Capital Allocation** | NOT EXIST | NEW — runway, margins, 30/60/90 scenarios, spend efficiency |
| **Execution Governance** | NOT EXIST | NEW — SLA breaches, bottlenecks, resource load, velocity |
| **Revenue Forecast** | NOT EXIST | NEW — pipeline, weighted forecast, entropy, deal tracking, churn |
| **Decision Forcing** | NOT EXIST | NEW — 3 options with risk/cost/timeline, recommendation, deadline |
| **Resource Reallocation** | NOT EXIST | NEW — triggered recommendations to move budget/people/projects |
| **Founder Vitals** | NOT EXIST | NEW — capacity index, email stress, calendar compression, fatigue |
| **Risk & Compliance** | NOT EXIST | NEW — SPOFs, vendor concentration, regulatory deadlines, contracts |
| Strategic Alignment | Narrative only | + KPI contradiction index, scored divergences |
| Market Position | Narrative only | + competitor tracking, pricing benchmark, sentiment |
| Executive Memo | Briefing only | + 30/60/90 scenarios, hard recommendation |
| **Blind Spots** | NOT EXIST | NEW — missing data, stale data, confidence score |

---

## DATA REQUIREMENTS

| Section | Data Source | Available Today? |
|---|---|---|
| System State + Velocity | `escalation_memory`, `intelligence_snapshots` history | YES |
| Inevitabilities + Probability | `observation_events`, `decision_pressure` | YES |
| Capital Allocation | Merge.dev Accounting (Xero/QuickBooks) | PARTIAL (needs connection) |
| Execution Governance | `observation_events`, email patterns, calendar | YES (email/calendar connected) |
| Revenue Forecast | Merge.dev CRM (deals, contacts) | PARTIAL (needs connection) |
| Decision Forcing | All above combined | YES (AI synthesises) |
| Resource Reallocation | All above combined | YES (AI synthesises) |
| Founder Vitals | Email metadata, calendar, response patterns | YES (email/calendar connected) |
| Risk & Compliance | Business profile, integrations, Perplexity regulatory | YES |
| Market Position | Perplexity API live search | YES |
| Blind Spots | Check which integrations are connected vs missing | YES |

---

**Ready for your review. Shall I proceed with building this, or do you want adjustments to the structure?**
