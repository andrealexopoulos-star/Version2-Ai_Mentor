# BIQc Production Security & Launch Checklist

Use this checklist before launching **biqc.ai** (or any production deployment). It covers IP hardening, security headers, auth, and common vulnerability fixes.

---

## 1. Environment & Secrets

- [ ] **Backend**: Set `ENVIRONMENT=production` or `PRODUCTION=1` on the host (e.g. Azure App Service). This disables dev auth bypass even if `DEV_BYPASS_AUTH` is ever set.
- [ ] **Backend**: Never set `DEV_BYPASS_AUTH` or `DEV_BYPASS_SECRET` in production.
- [ ] **Backend**: Use a long, random `JWT_SECRET_KEY` (e.g. 32+ chars). Rotate if ever exposed.
- [ ] **Backend**: Store all secrets in env vars or a secrets manager (Azure Key Vault, etc.). No secrets in code or in repo.
- [ ] **Optional**: Set `BIQC_MASTER_ADMIN_EMAIL` only if you need rate-limit bypass for a specific admin; leave unset for strict rate limiting.

---

## 2. Security Headers (Backend)

The FastAPI app already sends these via `NoCacheAPIMiddleware` in `backend/core/config.py`:

- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()`
- For `/api` routes: `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'`

- [ ] If you use **nginx** or another reverse proxy in front, ensure it does not strip these headers. Prefer adding headers at the app layer (already done) and not overwriting them at the proxy.

---

## 3. CORS & Network

- [ ] **CORS**: Backend allows origins via regex: `thestrategysquad.com`, `preview.emergentagent.com`, and `localhost:3000`. Optional: set `CORS_ALLOW_ORIGINS=https://biqc.ai` for an explicit list.
- [ ] **HTTPS**: Serve the app only over HTTPS. Enforce redirect HTTP → HTTPS at the proxy/load balancer.
- [ ] **Firewall / IP hardening**: Restrict admin or sensitive endpoints by IP if required; use WAF rules (e.g. Azure WAF) for DDoS and common attacks.

---

## 4. Authentication & Authorization

- [ ] **Supabase**: Use production Supabase project; keep `SUPABASE_SERVICE_ROLE_KEY` server-side only and never in frontend.
- [ ] **Frontend**: Uses Supabase Auth (email/password + OAuth). No dev bypass in production build (`NODE_ENV=production`).
- [ ] **Rate limiting**: Login and high-cost AI endpoints are rate-limited (see `RATE_LIMIT_RULES` in `backend/core/config.py`). Adjust limits if needed.

---

## 5. Pen Testing & Vulnerability Fixes Addressed in Code

- **Credentials in repo**: Test scripts no longer hardcode passwords. Use env vars `BIQC_TEST_EMAIL` and `BIQC_TEST_PASSWORD` for forensic/commercial tests; never commit real credentials.
- **Dev bypass**: Backend ignores `DEV_BYPASS_AUTH` when `ENVIRONMENT=production` or `PRODUCTION=1`.
- **Admin email**: Master admin / rate-limit bypass is configurable via `BIQC_MASTER_ADMIN_EMAIL`; no hardcoded production email in repo.
- **Headers**: XSS, clickjacking, MIME sniffing, and HSTS are mitigated via headers above.

---

## 6. Optional: Supabase Edge Functions

Edge functions use `Access-Control-Allow-Origin: *` for CORS. For stricter hardening, consider restricting to your app origin (e.g. `https://biqc.ai`) when deploying to production.

---

## 7. Post-Launch

- [ ] Rotate any credentials that may have been shared or stored in logs.
- [ ] Monitor auth failures and rate-limit hits.
- [ ] Run dependency audits (`npm audit`, `pip audit` or similar) and fix high/critical issues.

---

*Last updated: March 2025*
