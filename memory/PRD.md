# BIQc Platform - PRD (Final State)
## 1 March 2026

## Cognition-as-a-Platform Architecture

### Layers Implemented
1. **Data Layer**: Supabase PostgreSQL (35+ tables)
2. **Vector Store**: pgvector (rag_embeddings with HNSW index, similarity search)
3. **Ingestion**: Hybrid crawl (static + Playwright headless), DSEE, SDD
4. **Retrieval**: RAG via pgvector similarity search, memory retrieval
5. **Reasoning/Generation**: GPT-4o/4o-mini via Edge Functions + emergentintegrations
6. **Memory**: Episodic (events), Semantic (knowledge triples), Context summaries
7. **Observability**: llm_call_log (tokens, latency, model, validation)
8. **Guardrails**: Input sanitisation, output filtering, schema validation

### New This Session
- `038_rag_infrastructure.sql` — pgvector extension, rag_embeddings table, HNSW index, similarity search function
- `037_cognition_platform.sql` — memory tables, marketing benchmarks, action log, llm_call_log, feature flags
- RAG Service (embed, search, bulk embed, profile ingestion)
- SoundBoard RAG upgrade (retrieves from vector store + memory before generating)
- Marketing Intelligence page (5-pillar radar chart, competitor benchmarking)
- Guardrails module (OWASP injection patterns, credential detection, output filtering)

### SQL Migrations to Deploy
```
037_cognition_platform.sql  → Memory, marketing, observability tables
038_rag_infrastructure.sql  → pgvector + embeddings + search function
PURGE_ALL_DATA.sql         → Fresh testing reset (already run)
```

### API Endpoints Added
- POST /rag/embed, /rag/embed-bulk, /rag/search, /rag/ingest-profile, GET /rag/stats
- POST /marketing/benchmark, GET /marketing/benchmark/latest
- POST /memory/episodic, /memory/semantic, /memory/summarise, GET /memory/retrieve

### Frontend Added
- Marketing Intelligence page at /marketing-intelligence (radar chart + 5 pillars)
- Sidebar: "Marketing Intel" under Systems

### Remaining from Master Plan
- Marketing Automation agents (ad/blog/social generation)
- Observability frontend dashboard
- A/B testing framework
- Vendor-agnostic migration preparation
