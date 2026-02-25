# BIQc Platform — PRD
## Updated: 2026-02-25

## Architecture
- Supabase-first: 5 SQL engines + Edge Functions + RLS
- Frontend: React + Tailwind (Liquid Steel) — renders only
- Backend: FastAPI (routing/auth proxy only)
- Production: biqc.thestrategysquad.com

## Completed (This Session)
### Trust + Flow Integrity
- Flow gate: wow_summary → approve_identity → cmo_snapshot → dashboard (no skips)
- Business identity verification gate with approve/edit/reject
- WOW summary quality floor (≥3 fields, SMB-friendly labels)
- WOW fields: What You Do, Who You Serve, What Sets You Apart, Challenges, Growth Opportunity
- Manual summary path also goes through wow→approve flow

### SMB Market Tab
- Status: On Track / Slipping / Under Pressure / At Risk (replaced DRIFT/COMPRESSION)
- Sections: Status → Focus → Risk → Opportunity → Track → Gaps → Calibration → Brief
- Fake data removed, channel grid collapsed, duplicate insights eliminated
- Integration truth from channelsData canonical source

### Platform Infrastructure
- 5 SQL deterministic engines deployed + wired into Edge Function chain
- Mobile bottom nav, soundboard modal, responsive grids
- Password reset flow, auth resilience, branding fixes
- 10 authenticated pages wired to live cognitive data
- Desktop flex layout ready for soundboard console

## Pending
- P1: Desktop right-panel Soundboard console (layout ready, content needed)
- P1: Soundboard integrated queries (Google Ads YoY, leads YoY) — needs query-integrations-data Edge Function
- P1: Soundboard BNA updates (update Business DNA fields via chat)
- P2: Stripe paid gating
- P2: Real channel APIs (Google Ads, Meta, LinkedIn)
- P2: Tutorial modal persistence fix
- P3: Legacy page consolidation
- P3: Python engine deprecation
