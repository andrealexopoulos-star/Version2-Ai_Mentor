# BIQc Platform - PRD

## Access Control Architecture (NEW)

### Central Tier Resolver
- **Backend**: `/app/backend/tier_resolver.py` — SINGLE source of truth
- **Frontend**: `/app/frontend/src/lib/tierResolver.js` — mirrors backend exactly
- Super admin: `andre@thestrategysquad.com.au` — immutable, email-based, overrides DB

### Tiers: free → starter → professional → enterprise → super_admin

### Free Tier Includes
- BIQc Overview, Market (basic), Business DNA, Forensic Audit (1/mo), Snapshots (3/mo), Email Integration, Data Health, Integrations, Settings, Calibration

### Free Tier Excludes (redirects to /subscribe)
- Revenue, Operations, Risk, Compliance, Reports, Audit Log, Soundboard, War Room, Board Room, SOP Generator, Priority Inbox, Calendar, Alerts, Actions, Automations

### Enforcement Layers
1. Frontend TierGate component wraps all paid routes
2. Backend tier_resolver checks API access
3. SQL atomic counters for monthly limits (increment_snapshot_counter, increment_audit_counter)
4. Super admin override at all layers

### SQL: `028_access_control.sql`
- subscription_tier, monthly_snapshot_count, monthly_audit_refresh_count, billing_cycle_start on business_profiles
- increment_snapshot_counter() — atomic, transaction-safe
- increment_audit_counter() — atomic
- reset_monthly_counters() — pg_cron daily

## Deployment Queue
| File | Status |
|------|--------|
| `028_access_control.sql` | **NEEDS DEPLOY** |
| `027_ingestion_engine.sql` | **NEEDS DEPLOY** |

## Backlog
### P1: Stripe checkout integration (wire upgrade buttons)
### P2: Signal Provenance, CSS cleanup
