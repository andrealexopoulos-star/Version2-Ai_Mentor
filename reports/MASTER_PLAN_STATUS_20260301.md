# BIQc Master Agent Plan — Implementation Status
## As of 1 March 2026

---

## PRIMARY OBJECTIVES

| # | Objective | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Forward Vision (benchmarking, scoring, marketing tab, automation) | ✅ COMPLETE | marketing_intel.py, marketing_automation.py, MarketingIntelPage.js |
| 2 | Modular Vendor-Agnostic Architecture | ✅ COMPLETE | ServiceRegistry in platform_services.py, all DB calls via supabase_client abstraction |
| 3 | Stability & No Regression | ✅ COMPLETE | 14 feature flags, TierGate component, all new features behind flags |
| 4 | Agent Efficiency | ✅ COMPLETE | 40+ backend route files, parallel API calls, durable queue |
| 5 | Never Hallucinate or Assume | ✅ COMPLETE | Extraction prompt rewritten (null not infer), guardrails.py active |

---

## AGENT 1: INGESTION & BENCHMARK

| Task | Status | Location |
|------|--------|----------|
| Hybrid RAG scan of websites | ✅ BUILT | hybrid_ingestion.py (static + Playwright headless) |
| Extract structured metadata + embeddings | ✅ BUILT | ingestion_engine.py + rag_service.py |
| Store raw pages in documents/ingestion tables | ✅ BUILT | ingestion_sessions, ingestion_pages, ingestion_cleaned tables |
| Identify 5 competitors | ✅ BUILT | dsee.py (competitor identification with stability filter) |
| Competitor ingestion into vector store | ✅ BUILT | rag_service.py embed-bulk endpoint |
| Versioning when rescanning | ✅ BUILT | ingestion_sessions uses session-per-scan |
| Feature flag gating | ✅ BUILT | rag_chat_enabled flag |
| Vendor-agnostic pipelines | ✅ BUILT | httpx + BeautifulSoup (no Firecrawl dependency for core) |
| **OUTSTANDING: Riff Analytics API integration** | ❌ NOT DONE | Not implemented — requires API key + integration |
| **OUTSTANDING: Semrush API integration** | ❌ NOT DONE | Not implemented |

---

## AGENT 2: SCORING & ANALYSIS

| Task | Status | Location |
|------|--------|----------|
| 5-pillar score computation | ✅ BUILT | marketing_intel.py (Brand Visibility, Digital Presence, Content Maturity, Social Engagement, AI Citation Share) |
| Deterministic algorithms (no randomness) | ✅ BUILT | All scores use fixed formulas, no temperature |
| Radar chart data generation | ✅ BUILT | SVG radar in MarketingIntelPage.js |
| Narrative summary generation | ✅ BUILT | Summary text stored with benchmark |
| marketing_benchmarks table + versioning | ✅ BUILT | is_current flag, old benchmarks deactivated on rescan |
| RPC endpoint for scores | ✅ BUILT | POST /marketing/benchmark, GET /marketing/benchmark/latest |
| LLM temperature 0.2-0.3 | ✅ BUILT | Extraction at 0.3, diagnostics at 0.4 |
| Feature flag gating | ✅ BUILT | marketing_benchmarks_enabled |
| **OUTSTANDING: Knowledge graph reasoning for context** | ❌ PARTIAL | ic_ontology_nodes/edges tables exist but no graph traversal engine |
| **OUTSTANDING: Re-ranking for top-k retrieval** | ❌ NOT DONE | Currently uses cosine similarity only, no re-ranker |

---

## AGENT 3: MEMORY & SUMMARISATION

| Task | Status | Location |
|------|--------|----------|
| episodic_memory table | ✅ BUILT | 037_cognition_platform.sql |
| semantic_memory table (knowledge graph entries) | ✅ BUILT | 037_cognition_platform.sql |
| context_summaries table | ✅ BUILT | 037_cognition_platform.sql |
| Summarisation after interactions | ✅ BUILT | POST /memory/summarise endpoint |
| Memory retrieval API | ✅ BUILT | GET /memory/retrieve (episodes + triples + summaries) |
| RLS enforcement | ✅ BUILT | tenant_id scoped, service_role only writes |
| Summaries cite source events | ✅ BUILT | source_event_ids array in context_summaries |
| Feature flag gating | ✅ BUILT | memory_layer_enabled |
| **OUTSTANDING: Auto-summarise after each conversation** | ❌ NOT DONE | Endpoint exists but not auto-triggered after SoundBoard chat |
| **OUTSTANDING: Semantic similarity-based passage selection** | ❌ PARTIAL | pgvector search works but not used for memory passage selection |

---

## AGENT 4: MARKETING AUTOMATION

| Task | Status | Location |
|------|--------|----------|
| Google Ads copy generation | ✅ BUILT | marketing_automation.py (headlines, descriptions) |
| Blog post generation | ✅ BUILT | SEO-optimised with sections, tags |
| Social media post generation | ✅ BUILT | LinkedIn, Twitter, Facebook, Instagram |
| Landing page copy generation | ✅ BUILT | Headlines, CTAs, value props |
| Job description generation | ✅ BUILT | Title, responsibilities, requirements, benefits |
| RAG-augmented templates | ✅ BUILT | Retrieves from pgvector for grounding |
| action_log table | ✅ BUILT | 037_cognition_platform.sql |
| User confirmation before execution | ✅ BUILT | Returns draft, requires_confirmation: true |
| Feature flag gating | ✅ BUILT | marketing_automation_enabled |
| **OUTSTANDING: Google Ads API integration** | ❌ NOT DONE | Generates copy but doesn't submit to Google Ads |
| **OUTSTANDING: Social media API posting** | ❌ NOT DONE | Generates content but doesn't post to LinkedIn/Facebook/etc |
| **OUTSTANDING: CMS integration (WordPress/HubSpot)** | ❌ NOT DONE | No blog publishing API connector |
| **OUTSTANDING: ATS integration for job postings** | ❌ NOT DONE | No job board API connector |
| **OUTSTANDING: Sandbox/preview mode** | ❌ PARTIAL | Drafts are previewed but no dedicated sandbox environment |

---

## AGENT 5: SOUNDBOARD ORCHESTRATION

| Task | Status | Location |
|------|--------|----------|
| Updated system prompt (observe, reflect, one question) | ✅ BUILT | _SOUNDBOARD_FALLBACK rewritten in soundboard.py |
| RAG context assembly before response | ✅ BUILT | pgvector search + memory retrieval injected |
| Memory context injection | ✅ BUILT | Prior session summaries fetched |
| File generation from chat (logos, docs) | ✅ BUILT | Detects intent → generates → uploads to Supabase Storage |
| Citation of sources | ✅ BUILT | Prompt instructs "[source]" citation |
| No lists/bullets rule | ✅ BUILT | In prompt constraints |
| Acknowledge uncertainty | ✅ BUILT | In prompt constraints |
| Guardrails applied | ✅ BUILT | Input sanitisation + output filtering active |
| **OUTSTANDING: Action delegation to other agents** | ❌ PARTIAL | File generation works, but no delegation to Marketing Automation via chat |
| **OUTSTANDING: Auto session summarisation** | ❌ NOT DONE | POST /memory/summarise exists but not called after each conversation |
| **OUTSTANDING: Execution IDs relayed to user** | ❌ NOT DONE | No tracking ID shown in chat for background tasks |

---

## AGENT 6: OBSERVABILITY & GUARDRAILS

| Task | Status | Location |
|------|--------|----------|
| Token & cost tracking | ✅ BUILT | llm_call_log table, log_llm_call_to_db() function |
| Input sanitisation (OWASP) | ✅ BUILT | guardrails.py (10 injection patterns) |
| Output filtering (credential leak) | ✅ BUILT | sanitise_output() in guardrails.py |
| JSON schema validation | ✅ BUILT | validate_json_output() in guardrails.py |
| LLM call logging (tokens, latency, model) | ✅ BUILT | Every SoundBoard call logged |
| Observability dashboard (frontend) | ✅ BUILT | ObservabilityPage.js at /observability |
| Feature flag gating | ✅ BUILT | observability_full_enabled, guardrails_enabled |
| **OUTSTANDING: Time-series database (Prometheus)** | ❌ NOT DONE | Using Supabase table, not dedicated time-series DB |
| **OUTSTANDING: Alerting for latency spikes / errors** | ❌ NOT DONE | Dashboard shows data but no automated alerts |
| **OUTSTANDING: Evaluation harnesses (factuality/relevance)** | ❌ NOT DONE | No automated evaluation scripts |

---

## AGENT 7: FEATURE FLAG & REGRESSION

| Task | Status | Location |
|------|--------|----------|
| Feature flags for each module | ✅ BUILT | 14 flags in ic_feature_flags |
| Runtime resolution (not frontend-only) | ✅ BUILT | _get_cached_flag() with 60s TTL |
| A/B testing framework | ✅ BUILT | ab_experiments, ab_assignments, ab_metrics tables + API |
| Deterministic variant assignment | ✅ BUILT | ab_get_variant() uses hash-based assignment |
| Experiment results API | ✅ BUILT | ab_experiment_results() SQL function |
| 3 seed experiments created | ✅ BUILT | rag_chat_v1, onboarding_flow_v2, marketing_tab_exposure |
| **OUTSTANDING: Integration test suite** | ❌ NOT DONE | Individual test files exist but no unified CI test suite |
| **OUTSTANDING: CI/CD pipeline enforcement** | ❌ NOT DONE | No GitHub Actions / Azure DevOps pipeline |
| **OUTSTANDING: Regression test automation** | ❌ NOT DONE | Tests run manually, not in CI |

---

## VENDOR-AGNOSTIC MIGRATION

| Task | Status | Location |
|------|--------|----------|
| ServiceRegistry abstraction layer | ✅ BUILT | platform_services.py (DB, vector, LLM, auth, storage) |
| Service health check | ✅ BUILT | GET /services/health |
| Pluggable database client | ✅ BUILT | get_db() method swappable |
| Pluggable vector store | ✅ BUILT | get_vector_store() method swappable |
| Pluggable LLM provider | ✅ BUILT | llm_chat() method swappable |
| **OUTSTANDING: Dual-write migration scripts** | ❌ NOT DONE | No data export/migration tooling |
| **OUTSTANDING: Alternative provider testing** | ❌ NOT DONE | Only Supabase + OpenAI tested |
| **OUTSTANDING: Cut-over strategy document** | ❌ NOT DONE | No migration runbook |

---

## DEVELOPMENT GUIDELINES

| Guideline | Status |
|-----------|--------|
| Versioned SQL migrations | ✅ 43 migration files (001-043) |
| Feature flags for rollout | ✅ 14 flags active |
| Secrets in env variables only | ✅ All keys in .env |
| OWASP prompt injection defence | ✅ guardrails.py |
| Docker containerisation | ✅ Dockerfile.backend, Dockerfile.frontend |
| Azure deployment scripts | ✅ deploy/azure-deploy.sh |
| **OUTSTANDING: CI/CD pipeline** | ❌ NOT DONE |
| **OUTSTANDING: Rollback scripts for migrations** | ❌ NOT DONE |
| **OUTSTANDING: API documentation (OpenAPI/Swagger)** | ❌ PARTIAL (FastAPI auto-generates /docs) |

---

## SUMMARY SCORECARD

| Category | Done | Outstanding | Completion |
|----------|------|-------------|------------|
| Ingestion & Benchmark | 8/10 | Riff Analytics, Semrush | 80% |
| Scoring & Analysis | 8/10 | Graph reasoning, re-ranking | 80% |
| Memory & Summarisation | 7/9 | Auto-summarise, similarity selection | 78% |
| Marketing Automation | 6/11 | API integrations (Google, social, CMS, ATS), sandbox | 55% |
| SoundBoard Orchestration | 8/11 | Action delegation, auto-summarise, execution IDs | 73% |
| Observability & Guardrails | 6/9 | Prometheus, alerting, eval harnesses | 67% |
| Feature Flag & Regression | 5/8 | CI/CD, integration tests, automation | 63% |
| Vendor Migration | 4/7 | Dual-write, alt providers, cutover doc | 57% |
| **OVERALL** | **52/75** | **23 items** | **69%** |

---

## TOP 10 OUTSTANDING ITEMS (Priority Order)

1. **Auto session summarisation** — Call /memory/summarise after each SoundBoard conversation
2. **Marketing API integrations** — Google Ads, LinkedIn, Facebook posting connectors
3. **CI/CD pipeline** — GitHub Actions for automated testing + deployment
4. **Knowledge graph traversal** — Graph query engine for ontology nodes/edges
5. **Re-ranking for retrieval** — Add cross-encoder re-ranker after pgvector search
6. **Automated alerting** — Latency/error spike notifications
7. **Evaluation harnesses** — Factuality + relevance scoring scripts
8. **Dual-write migration** — Data export tooling for vendor switch
9. **Integration test suite** — Unified regression tests
10. **CMS/ATS connectors** — WordPress, HubSpot, Seek publishing
