# BIQc Platform — Final PRD
## 1 March 2026

## Master Plan Status: 8/8 Workstreams COMPLETE

| # | Workstream | Status |
|---|-----------|--------|
| 1 | RAG Vector/Graph Store | ✅ pgvector + embeddings + HNSW search |
| 2 | Marketing Intelligence Tab | ✅ 5-pillar radar + benchmarking |
| 3 | Marketing Automation | ✅ 5 content types + action logging |
| 4 | Memory & Summarisation | ✅ Episodic + semantic + context summaries |
| 5 | SoundBoard RAG Upgrade | ✅ Vector retrieval + memory context |
| 6 | Observability Dashboard | ✅ Token/latency/model metrics |
| 7 | A/B Testing Framework | ✅ Experiments + variants + metrics |
| 8 | Vendor-Agnostic Migration | ✅ Service layer abstraction |

## Platform Metrics
- 90+ frontend routes
- 220+ API endpoints
- 40+ Supabase tables
- 25+ SQL functions
- 18 Edge Functions
- 4 pg_cron jobs
- 3 database triggers
- 7 feature flags (all ON)
- 3 A/B experiments (draft)

## SQL Migrations to Deploy
- `039_ab_testing.sql` → A/B testing tables + functions + seed experiments

## Architecture
```
Supabase ($25/mo): 40+ tables, pgvector, Auth, Edge Functions, Realtime
Azure App Service ($13/mo): FastAPI (220+ endpoints), Guardrails, RAG, Memory, Automation
Total: ~$38/mo
```
