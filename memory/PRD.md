# BIQc Platform — PRD
## 2 March 2026

## Platform Overview
BIQc is an AI-driven "Cognition-as-a-Platform" for SMBs, featuring a "Liquid Steel" dark theme executive operating system. It connects business tools (CRM, Accounting, Email, E-Commerce) and surfaces unified intelligence across all pages.

## Master Plan Status: All Core Workstreams COMPLETE

| # | Workstream | Status |
|---|-----------|--------|
| 1 | RAG Vector/Graph Store | Done - pgvector + embeddings + HNSW search |
| 2 | Marketing Intelligence Tab | Done - 5-pillar radar + benchmarking |
| 3 | Marketing Automation | Done - Backend + Frontend UI |
| 4 | Memory & Summarisation | Done - Episodic + semantic + context summaries |
| 5 | SoundBoard RAG Upgrade | Done - Vector retrieval + memory context |
| 6 | Observability Dashboard | Done - Token/latency/model metrics |
| 7 | A/B Testing Framework | Done - Backend + Frontend UI |
| 8 | Vendor-Agnostic Migration | Done - Service layer abstraction |
| 9 | Unified Intelligence Engine | Done - Backend + Frontend integration |
| 10 | Integrations Page Overhaul | Done - Dark theme + Shopify/WooCommerce |

## What's Been Implemented (Latest Session - 2 March 2026)

### P0: Integrations Page UI Overhaul + Shopify
- Redesigned Integrations page to match "Liquid Steel" dark theme
- Removed all light-theme CSS artifacts (bg-blue-50, bg-green-50, text-green-600, etc.)
- Added Shopify and WooCommerce as E-Commerce integrations (Coming Soon)
- Added E-Commerce category to category navigator

### P0: Unified Intelligence Frontend
- Refactored RevenuePage with new "Cross-Domain" tab showing unified CRM + Accounting signals
- Refactored RiskPage with new "Cross-Domain Risk" tab aggregating all integration risks
- Refactored OperationsPage with unified operations bottleneck and capacity alert sections
- All pages now fetch from /api/unified/* endpoints

### P1: Marketing Automation UI
- Built MarketingAutomationPage at /marketing-automation
- 5 content types: Google Ads, Blog Post, Social Media, Landing Page, Job Description
- Content generation form with topic, tone, audience, context parameters
- Output viewer with copy-to-clipboard

### P1: A/B Testing Framework UI
- Built ABTestingPage at /ab-testing
- Experiment list with status badges (Draft/Active/Paused/Completed)
- Create form with name, description, primary metric
- Start/stop controls and expanded detail views
- Dashboard sidebar links added for both new pages

## Architecture
```
Supabase ($25/mo): 40+ tables, pgvector, Auth, Edge Functions, Realtime
Azure App Service ($13/mo): FastAPI (220+ endpoints), Guardrails, RAG, Memory, Automation
Total: ~$38/mo
```

## Key API Endpoints
- `/api/unified/*` - Unified Intelligence (revenue, risk, operations, people, market, advisor)
- `/api/automation/*` - Marketing content generation
- `/api/experiments/*` - A/B testing management
- `/api/integrations/*` - Integration management (Merge.dev, Outlook, Gmail)
- `/api/dsee/scan` - Deterministic Structural Exposure Engine

## Remaining Backlog (Prioritized)

### P1
- Mobile App Build-out (React Native/Expo skeleton exists at /app/mobile/)
- Production auth fix (user needs to set SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY in Azure)

### P2
- Vendor-Agnostic Migration (continue abstracting from Supabase)
- More integrations (Riff Analytics, Semrush)
- Shopify OAuth implementation (currently "Coming Soon")

### P3
- CSS Consolidation (merge mobile-fixes.css, mobile-enhancements.css, mobile-reconstruction.css)
- WooCommerce OAuth implementation

## Known Issues
- Production environment (biqc.thestrategysquad.com) has auth loop due to missing Azure env vars
- Supabase auth may not work in Emergent preview environment
