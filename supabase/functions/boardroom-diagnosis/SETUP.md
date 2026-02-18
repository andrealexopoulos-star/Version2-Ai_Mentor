# Board Room Diagnosis — Edge Function Setup Guide

## 1. Secrets Required

Set these in **Supabase Dashboard → Edge Functions → Secrets**:

```
OPENAI_API_KEY=sk-proj-your-openai-key-here
SUPABASE_URL=https://uxyqpdfftxpkzeppqtvk.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...your-service-role-key
MERGE_API_KEY=vVXg9EXkp7_MhXeo...your-merge-key (optional, for CRM/Xero data)
```

## 2. Deploy the Edge Function

From your local machine (with Supabase CLI installed):

```bash
# If not already linked
supabase link --project-ref uxyqpdfftxpkzeppqtvk

# Deploy
supabase functions deploy boardroom-diagnosis
```

Or copy the code from `/app/supabase/functions/boardroom-diagnosis/index.ts` 
into the Supabase Dashboard → Edge Functions → New Function → paste code → Deploy.

## 3. What the Function Does

When a user clicks a diagnosis card in the Board Room:

1. **Authenticates** the user via their JWT
2. **Reads from Supabase tables**: business_profiles, observation_events, strategy_profiles, outlook_emails
3. **Reads from Merge.dev** (if connected): HubSpot contacts/deals, Xero accounts/invoices
4. **Sends context to GPT-4o** with briefing criteria specific to the focus area
5. **Returns** a human, conversational diagnosis briefing

## 4. Focus Areas Supported

| ID | Label | Data Sources |
|----|-------|-------------|
| cash_flow_financial_risk | Cash Flow & Financial Risk | Xero accounts + invoices + emails |
| revenue_momentum | Revenue Momentum | HubSpot deals + contacts |
| strategy_effectiveness | Strategy Effectiveness | Strategy profiles + signals |
| operations_delivery | Operations & Delivery | Observation events + emails |
| people_retention_capacity | People & Capacity | Observation events + emails |
| customer_relationships | Customer Relationships | HubSpot contacts + emails |
| risk_compliance | Risk & Compliance | Observation events + emails |
| systems_technology | Systems & Technology | Observation events |
| market_position | Market Position | HubSpot deals + signals |

## 5. Response Shape

```json
{
  "status": "ok",
  "focus_area": "cash_flow_financial_risk",
  "confidence": "medium",
  "headline": "Your cash position is stable, but payment cycles are stretching.",
  "narrative": "Based on your Xero accounts, you have sufficient operating capital...",
  "what_to_watch": "Receivables aging beyond 45 days...",
  "if_ignored": "Potential cash gap of $15-25K in 8 weeks...",
  "data_sources_used": ["xero", "outlook"],
  "generated_at": "2026-02-18T..."
}
```

## 6. Test

After deploying, go to Board Room → click any diagnosis card. It should:
- Show "Analysing..." spinner
- Return a human, conversational briefing within 5-10 seconds
- Show the data sources used at the bottom

If you see "Edge Function not deployed yet" — the function hasn't been deployed to Supabase.
