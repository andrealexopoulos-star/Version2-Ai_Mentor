# Calibration Secret Matrix (Canonical)

Last updated: Apr 2026

This is the single source of truth for calibration-critical secret requirements.
Do not duplicate concrete values in other markdown files.

## Security Rules

- Never commit live credentials to git.
- Store values only in managed secret stores (GitHub Secrets, Azure App Settings, Supabase Edge Function Secrets).
- Use placeholder format in docs: `<secret-value>`.

## Canonical Secret Inventory

| Secret | Where it must exist | Purpose |
|---|---|---|
| `SUPABASE_ACCESS_TOKEN` | GitHub Actions (`supabase-functions-deploy`) | Auth for `supabase` CLI deploy and secret introspection |
| `SUPABASE_PROJECT_REF` | GitHub Actions (`supabase-functions-deploy`) | Target project for edge deploy + health smoke |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Edge Secrets, backend env, GitHub Actions | Server-to-server auth for edge calls and health checks |
| `SUPABASE_URL` | Supabase Edge Secrets, backend env | Base URL used by calibration orchestration and DB clients |
| `SUPABASE_ANON_KEY` | Backend/frontend env (where required) | Public client auth for frontend/browser flows |
| `OPENAI_API_KEY` | Supabase Edge Secrets, backend env | LLM processing in calibration/recon/analysis functions |
| `FIRECRAWL_API_KEY` | Supabase Edge Secrets | Website crawl/extraction for calibration + deep recon |
| `PERPLEXITY_API_KEY` | Supabase Edge Secrets | Social/market/competitor enrichment |
| `BROWSE_AI_API_KEY` | Supabase Edge Secrets | Review aggregation (`browse-ai-reviews`) |
| `SEMRUSH_API_KEY` | Supabase Edge Secrets | SEO/domain intelligence (`semrush-domain-intel`) |
| `MERGE_API_KEY` | Supabase Edge Secrets (optional in calibration path) | CRM/financial context enrichment in market analysis |
| `OPENAI_MODEL` | Supabase Edge Secrets (optional) | Model override for OpenAI-backed functions |
| `QA_BYPASS_AUTH`, `QA_BYPASS_SECRET`, `QA_BYPASS_USER_ID`, `QA_BYPASS_EMAIL` | Supabase Edge Secrets (non-prod only) | QA bypass controls for controlled testing only |

## Calibration Function -> Secret Mapping

| Edge function | Required secrets | Optional/degradation secrets |
|---|---|---|
| `calibration-business-dna` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY` | `FIRECRAWL_API_KEY`, `PERPLEXITY_API_KEY`, `QA_BYPASS_*`, `OPENAI_MODEL` |
| `scrape-business-profile` | None | None |
| `deep-web-recon` | `OPENAI_API_KEY` | `FIRECRAWL_API_KEY`, `OPENAI_MODEL` |
| `social-enrichment` | `PERPLEXITY_API_KEY` | None |
| `browse-ai-reviews` | `BROWSE_AI_API_KEY` | None |
| `semrush-domain-intel` | `SEMRUSH_API_KEY` | None |
| `market-analysis-ai` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY` | `MERGE_API_KEY`, `PERPLEXITY_API_KEY`, `OPENAI_MODEL` |
| `market-signal-scorer` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | None |
| `calibration-psych` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY` | `OPENAI_MODEL` |
| `calibration-sync` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY` | None |
| `calibration-engine` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | None |
| `competitor-monitor` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `PERPLEXITY_API_KEY` | None |

## CI Enforcement Scope

The calibration deploy pipelines fail fast if the following health prerequisites are missing:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `FIRECRAWL_API_KEY`
- `PERPLEXITY_API_KEY`
- `BROWSE_AI_API_KEY`
- `SEMRUSH_API_KEY`

If you add a new calibration-critical provider, update:

- `.github/workflows/supabase-functions-deploy.yml`
- `.github/workflows/deploy.yml`
- this matrix file
