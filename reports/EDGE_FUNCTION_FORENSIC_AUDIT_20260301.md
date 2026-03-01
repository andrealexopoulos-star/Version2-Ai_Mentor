# BIQc Edge Function Forensic Architecture Audit
## Date: 1 March 2026
## Mode: Read-Only Analysis. Zero Modifications.

---

## SECTION 1 — EXECUTIVE VERDICT

**18 Edge Functions audited. 9 backend route files reviewed.**

| Finding | Severity |
|---------|----------|
| Extraction prompt explicitly instructs hallucination ("make intelligent inferences") | **CRITICAL** |
| Context truncation at 8000 chars for cognitive snapshot — signal loss | **HIGH** |
| SoundBoard has no RAG/vector retrieval — pure LLM with minimal context | **HIGH** |
| Perplexity (sonar) used for market analysis at temperature 0.6 — high variability | **MEDIUM** |
| No token usage tracking on any Edge Function call | **MEDIUM** |
| Firecrawl as secondary scrape with no error-to-user reporting | **LOW** |

---

## SECTION 2 — WEBSITE SCAN PIPELINE ANALYSIS

### Execution Trace (calibration-business-dna)

```
1. URL Input → normalize
2. PRIMARY: 5x Perplexity (sonar) queries:
   - "What is the business at {domain}?" (identity)
   - "What services does {domain} offer?" (services)
   - "What is the market position of {domain}?" (market)
   - "Who is on the team at {domain}?" (team)
   - "Who are the competitors of {domain}?" (competitors)
3. SECONDARY: Firecrawl scrape (supplemental if available)
4. Context assembly: All Perplexity responses + Firecrawl content
5. GPT-4o-mini extraction: EXTRACTION_PROMPT + combined context
6. JSON parse → store in business_profiles
```

### CRITICAL FINDING: Extraction Prompt Instructs Hallucination

**Line in EXTRACTION_PROMPT:**
```
"You must fill ALL fields. If information is not explicitly available, 
make intelligent inferences based on context."
```

This is a **direct instruction to hallucinate**. The model is told to INFER missing data rather than return null. This contradicts the entire platform's "zero fake data" discipline.

**Impact:** Revenue range, customer count, team size, business type may be AI-fabricated when not found in source content.

### Other Pipeline Issues

| Issue | Severity | Detail |
|-------|----------|--------|
| Perplexity temperature 0.3 | OK | Appropriate for factual extraction |
| Perplexity max_tokens 2500 | OK | Sufficient for identity extraction |
| GPT-4o-mini temperature 0.3 | OK | Low variability for extraction |
| Firecrawl as fallback only | OK | Perplexity-first is correct |
| No explicit citation of extracted content | HIGH | Output doesn't reference which source provided each field |
| 5 separate Perplexity calls = ~5s latency | MEDIUM | Sequential, not parallel |

---

## SECTION 3 — SOCIAL SIGNAL HANDLING

**No dedicated social scraping Edge Function exists.**

Social signals are only gathered if:
- Perplexity returns social URLs in its identity response
- Firecrawl captures social links from the website DOM

**Missing:**
- No LinkedIn company page scraping
- No Google Business Profile data extraction
- No review aggregation from social platforms
- No social engagement metrics

---

## SECTION 4 — CMO SUMMARY / COGNITIVE SNAPSHOT FORENSICS

### Function: `biqc-insights-cognitive` (843 lines)

**Execution Trace:**
```
1. Fetch context: business_profiles, CRM deals, emails, observations, 
   escalations, pressure states, strategic positions, calibration
2. Perplexity market query (sonar, temp 0.5, 400 tokens) — market narrative
3. Context assembly: truncated to 8000 chars via JSON.stringify().substring(0, 8000)
4. GPT-4o-mini call (temp 0.5, 3000 tokens, JSON response format)
5. Parse JSON → store as intelligence_snapshot
```

### CRITICAL FINDING: 8000 Character Context Truncation

```javascript
content: `Precompute snapshot.\n${JSON.stringify(ctx).substring(0, 8000)}`
```

The entire business context (deals, emails, observations, escalations, positions) is serialized to JSON and **hard-truncated at 8000 characters**. This means:

- If CRM deals are listed first, emails may be completely lost
- If business profile is verbose, CRM data may be cut
- No intelligent chunking — raw character cut
- No priority-based context selection

**Impact:** The cognitive snapshot may generate conclusions based on incomplete data with no indication of what was truncated.

### Other Issues

| Issue | Detail |
|-------|--------|
| Temperature 0.5 | MEDIUM — for a "deterministic" system, 0.5 introduces variability. Re-run same context = different output. |
| max_tokens 3000 | OK — sufficient for structured JSON output |
| JSON response format enforced | GOOD — prevents free-text drift |
| Perplexity market query at 400 tokens | LOW — may truncate market narrative |
| System prompt is 2000+ chars | OK — detailed, structured |

---

## SECTION 5 — SOUNDBOARD CHAT PIPELINE ANALYSIS

### Execution Trace:
```
1. User message received
2. Load system prompt from system_prompts table (fallback to _SOUNDBOARD_FALLBACK)
3. Resolve "known facts" via fact_resolution module
4. Build user_context from business_profiles + recent snapshot
5. Assemble: system_message = prompt + fact_block + context
6. Load conversation history (prior messages in session)
7. GPT-4o call via emergentintegrations LlmChat
8. Store response in soundboard_conversations
```

### Key Findings

| Issue | Severity | Detail |
|-------|----------|--------|
| **No RAG/vector retrieval** | HIGH | SoundBoard sends the system prompt + fact block + user context as flat text. No embeddings. No semantic search. No document retrieval. At scale, context window will saturate. |
| **No memory retrieval** | HIGH | Each conversation starts fresh. Previous conversation insights are not retrieved. The model has no cross-session learning. |
| **Model: GPT-4o** | OK | Appropriate tier for conversational advisory |
| **No temperature setting** | MEDIUM | Using emergentintegrations default. Likely 0.7 or 1.0. Not explicitly controlled. |
| **No max_tokens setting** | MEDIUM | Using default. Could produce excessively long or truncated responses. |
| **Fact resolution** | GOOD | `resolve_facts` + `build_known_facts_prompt` prevents re-asking known information |
| **Context assembly** | OK | `user_context` includes business name, industry, recent snapshot data |
| **Cross-tenant risk** | NONE | Conversations scoped by user_id + conversation_id |

### Actual SoundBoard System Prompt (Fallback):
```
You are MySoundBoard.
You exist as a thinking partner for a business owner.
You are NOT an advisor. You are NOT a coach.
Output: Observation → Question. NO advice. NO lists.
```

**Assessment:** This is a minimal coaching-style prompt. It intentionally avoids advisory language. However, it provides no business context structure, no industry awareness, and no signal-anchoring instructions. The model is free to generate generic observations.

---

## SECTION 6 — MODEL CONFIGURATION REVIEW

| Function | Model | Temp | Max Tokens | Assessment |
|----------|-------|------|-----------|------------|
| calibration-business-dna | Perplexity sonar + GPT-4o-mini | 0.3 | 2500/unset | OK — low temp for extraction |
| biqc-insights-cognitive | Perplexity sonar + GPT-4o-mini | 0.5/0.5 | 400/3000 | **MEDIUM** — 0.5 introduces variability for "deterministic" claims |
| boardroom-diagnosis | GPT-4o-mini | 0.7 | 800 | **HIGH** — 0.7 is high for diagnostic claims |
| market-analysis-ai | Perplexity sonar | 0.6 | 500 | **MEDIUM** — 0.6 for market analysis introduces opinion drift |
| strategic-console-ai | Perplexity sonar | 0.7 | 400 | **HIGH** — 0.7 + 400 tokens = variable + truncated |
| cfo-cash-analysis | GPT-4o-mini | 0.2 | unset | OK — low temp for financial |
| calibration-sync | GPT-4o-mini | 0.1 | unset | OK — very low temp |
| query-integrations-data | GPT-4o-mini | 0.3 | 500 | OK |
| sop-generator | GPT-4o-mini | 0.4 | 3000 | OK |
| watchtower-brain | GPT-4o-mini | 0.5 | unset | MEDIUM — unset tokens risky |
| competitor-monitor | Perplexity sonar | 0.2 | 1500 | OK — low temp, good tokens |
| SoundBoard (backend) | GPT-4o | default | default | **HIGH** — no explicit temp or token control |

---

## SECTION 7 — HALLUCINATION RISK MAP

| Source | Risk | Mechanism |
|--------|------|-----------|
| EXTRACTION_PROMPT "make intelligent inferences" | **CRITICAL** | Direct instruction to fabricate |
| Context truncation at 8000 chars | **HIGH** | Model generates from incomplete data |
| Temperature 0.7 on boardroom-diagnosis | **HIGH** | High variability on diagnostic claims |
| Temperature 0.6 on market-analysis-ai | **MEDIUM** | Opinion drift in market positioning |
| No citation anchoring in snapshot output | **HIGH** | Claims not traced to source data |
| SoundBoard no RAG | **MEDIUM** | Model relies on training data, not user data |
| Perplexity market query at 400 tokens | **LOW** | May truncate competitive intelligence |

---

## SECTION 8 — SECURITY & RLS EXPOSURE

| Check | Status |
|-------|--------|
| Service role key used in Edge Functions | YES — required for Supabase operations. Acceptable if functions are server-side only. |
| Anon key exposed to frontend | YES — standard Supabase pattern. RLS enforced. |
| RLS on intelligence_snapshots | Assumed YES — standard Supabase setup |
| Cross-workspace queries | NOT FOUND — all queries scoped by user_id |
| Unscoped vector queries | N/A — no vector store implemented |
| Supabase client misuse | NOT FOUND |
| Prompt injection protection | NOT FOUND — no input sanitization before LLM calls |

---

## SECTION 9 — PERFORMANCE CONSTRAINTS

| Operation | Estimated Latency |
|-----------|-------------------|
| 5x Perplexity queries (sequential) | 3-8 seconds |
| Firecrawl scrape (supplemental) | 2-5 seconds |
| GPT-4o-mini extraction | 2-4 seconds |
| **Total signup scan** | **7-17 seconds** |
| Cognitive snapshot generation | 5-12 seconds |
| SoundBoard response | 1-3 seconds |
| Edge Function cold start | 3-8 seconds (first call after sleep) |

---

## SECTION 10 — CRITICAL WEAKNESS RANKING

| Rank | Weakness | Impact | Location |
|------|----------|--------|----------|
| 1 | **EXTRACTION_PROMPT instructs hallucination** | Fabricated business data enters DNA | `calibration-business-dna/index.ts` line ~85 |
| 2 | **8000 char context truncation** | Incomplete data → incomplete snapshot | `biqc-insights-cognitive/index.ts` |
| 3 | **No RAG/vector for SoundBoard** | Generic responses, no deep business memory | `routes/soundboard.py` |
| 4 | **No citation anchoring** | Claims not traceable to source | All LLM output paths |
| 5 | **Temperature 0.7 on diagnostics** | Variable outputs on re-run | `boardroom-diagnosis`, `strategic-console-ai` |
| 6 | **No token usage tracking** | Cannot measure cost or drift | All Edge Functions |
| 7 | **No prompt injection protection** | User input goes directly to LLM | `soundboard.py`, all chat endpoints |
| 8 | **Sequential Perplexity queries** | 5x serial = slow signup | `calibration-business-dna` |
