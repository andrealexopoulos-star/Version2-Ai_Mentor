# BIQc Platform — PRD (Final State)
## 27 February 2026

## Architecture
- **Web**: React + Tailwind + Shadcn/UI (88 routes, 199 API endpoints)
- **Mobile**: Expo React Native (6 screens, bottom tab nav)
- **Backend**: FastAPI → Supabase SQL Functions
- **Database**: Supabase PostgreSQL (17+ tables, 27 SQL functions, 4 pg_cron jobs, 3 triggers)
- **Intelligence Spine**: 10 ic_* tables, durable queue, feature flags, risk baseline engine
- **AI**: GPT-4o/4o-mini via Edge Functions + emergentintegrations
- **Payments**: Stripe (emergentintegrations)
- **Search**: Serper API (competitive intelligence)
- **Scraping**: Playwright Chromium (headless) + httpx (static)

## Completed This Session

### Phase 1: Integrity Lockdown
- Zero fake data across all platform pages
- Blog (16 articles, verified citations)
- Knowledge Base (public, 7 guides + 10 FAQs)
- Password dots, signup errors, routing fixes

### Phase 2: Trust Reconstruction
- workspace_integrations, governance_events, report_exports tables
- AuditLog/Reports/Memo hard-gated behind integrations
- PDF export engine, deterministic scrape engine
- Synthetic string purge (zero remaining)

### Phase 3: Intelligence Modules (SQL-Backed)
- 10 SQL functions replacing Python modules
- 3 database triggers, 4 pg_cron jobs
- Workforce Intelligence, Growth/Scenario Planning, Weighted Scoring
- Deep Market Modeling (Saturation, Demand, Friction)
- Merge.dev → governance_events auto-emission

### Phase 4: Access Control
- Central tier resolver (single source of truth)
- TierGate component on all paid routes
- Free/Starter/Professional/Enterprise tiers
- Super admin immutable override
- Stripe checkout integration
- Subscribe page with plan comparison

### Phase 5: Forensic Engines
- 3-layer ingestion audit (Extraction → Cleaning → Synthesis)
- Hybrid crawl engine (static + Playwright headless)
- Forensic engagement scan (competitive intelligence via Serper)
- Business structure classification (franchise/multi-location/product-led/service)
- Hallucination detection, lost signal analysis, quality scoring

### Phase 6: Intelligence Spine
- ic_* tables (events, snapshots, ontology, decisions, model registry)
- Append-only governance_events (UPDATE trigger blocks mutations)
- Postgres-backed durable queue (replaces in-memory)
- Tenant-scoped feature flags with 60s TTL cache
- Event-to-snapshot correlation validation
- LLM call instrumentation (prompt length, tokens, latency)

### Phase 7: Deterministic Risk Baseline
- 4 indices: RVI, EDS, CDR, ADS (all 0–1 normalized)
- Composite risk score with configurable weights
- 6 industry-specific weight configs (immutable, versioned)
- Backtest capability (config_id override)
- Calibration analytics (distribution, industry separation, index dominance)
- 14-day validation window before probabilistic activation

### Phase 8: Mobile App (Expo React Native)
- 6 screens: Login, Home, Chat, Market, Alerts, Settings
- Bottom tab navigation, haptic feedback, pull-to-refresh
- Liquid Steel dark theme (exact match to web)
- ChatGPT-grade chat interface with quick prompts
- Risk baseline gauges, status banners, metric cards

## SQL Migration Chain
```
020 → insight_outcomes
021 → trust_reconstruction (workspace_integrations, governance_events, report_exports)
022 → intelligence_modules (6 SQL functions)
023 → complete_intelligence_sql (10 functions + triggers + pg_cron)
024 → sql_hotfix
025 → pg_cron enablement
026 → ingestion_audits
027 → ingestion_engine (sessions, pages, cleaned)
028 → access_control (subscription_tier, counters)
029 → payment_transactions
030 → intelligence_spine (schema attempt)
031 → intelligence_spine_public (ic_* tables)
032 → spine_hardening (append-only, durable queue, correlation)
033 → risk_baseline (deterministic function)
034 → configurable_risk_weights (immutable configs)
035 → risk_baseline_hardening (backtest, industry codes, unique constraint)
036 → risk_calibration_analytics (distribution, dominance, calibration report)
```

## Backlog
### P1
- Enable spine + 14-day observation
- Deterministic Risk Baseline activation
- Mobile app: biometric login, push notifications, App Store submission

### P2
- Probabilistic forecasting (after calibration PASS)
- Churn scoring model
- RAG engine (vector embeddings)
- Anomaly detection (statistical)

### P3
- CSS consolidation
- Legacy page cleanup
- Website copy alignment with actual capabilities
