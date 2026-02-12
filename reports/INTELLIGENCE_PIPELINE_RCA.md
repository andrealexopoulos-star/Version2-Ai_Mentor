# BIQC Stability Audit — Intelligence Pipeline Fix

## Root Cause Analysis

### Problem
3 integrations connected (HubSpot, Xero, Outlook) but 0 intelligence output.

### Root Causes Found

| # | Root Cause | Location | Fix |
|---|-----------|----------|-----|
| 1 | **Emission layer never called** | `server.py:9578` | Added `emission_layer.run_emission()` as Stage 1 before cold-read |
| 2 | **Status filter blocked all tokens** | `merge_emission_layer.py:587` | Removed `.eq("status", "active")` — column doesn't exist |
| 3 | **Watchtower Engine never called** | `server.py` | Added `engine.run_analysis()` as Stage 2 between emission and cold-read |
| 4 | **Xero 403 permissions** | Merge.dev config | Not a code bug — Xero integration needs re-auth with correct scopes |
| 5 | **Outlook token expired** | `outlook_oauth_tokens` | Token refresh needed on production |

### Pipeline Before Fix
```
cold-read → generate_cold_read() → "no patterns" (empty input)
```

### Pipeline After Fix
```
Stage 1: emission_layer.run_emission() → 86 observation_events (from HubSpot CRM)
Stage 2: watchtower_engine.run_analysis() → Sales: CRITICAL (confidence 0.845)
Stage 3: generate_cold_read() → Canonical moments analysis
```

## Evidence

| Metric | Before | After |
|--------|--------|-------|
| observation_events | 1 | **176** |
| watchtower_insights | 0 | **1 (Sales: CRITICAL)** |
| Watchtower positions | empty | **sales: CRITICAL, confidence 0.845** |
| has_events | false | **true** |
| signals_extracted per run | 0 | **86** |

## Files Modified
- `backend/server.py` — 3-stage pipeline in cold-read endpoint
- `backend/merge_emission_layer.py` — removed broken status filter

## Remaining Issues
- Xero: 403 permissions error (Merge.dev config, not code)
- Outlook: Token expired, needs refresh on production
- Finance/operations domains: No observation events yet (need Xero data)
