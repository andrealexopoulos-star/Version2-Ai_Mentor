# Production Website Lock Policy

## Goal

Protect the public pre-auth website (homepage to login/signup boundary) from accidental changes when merging branches into `main`.

## Protected Surface

- `frontend/src/pages/website/**`
- `frontend/src/components/website/**`
- `frontend/src/pages/LoginSupabase.js`
- `frontend/src/pages/RegisterSupabase.js`
- `frontend/src/App.js`

## Enforcement

1. `CODEOWNERS` requires owner review for protected surface.
2. Main deploy workflow runs a website-change gate:
   - if protected files changed and commit message does **not** include `[website-approved]`
   - frontend build/deploy is skipped
   - backend/platform deploy can continue
3. Website changes require explicit release via manual workflow:
   - `.github/workflows/website-release.yml`
   - requires typed approval phrase: `APPROVE_WEBSITE_RELEASE`

## Operational Rule

Any merge into `main` is allowed, but protected website changes only go live after explicit approval.

## Canonical Reference

Use `correct-homepage-reference-3menu-local.png` as visual baseline for header/menu integrity.
