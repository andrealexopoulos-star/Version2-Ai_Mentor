# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

BIQc (Business Intelligence & Quality Control) is an AI-powered strategic advisory platform. The codebase is a monorepo with three services: a **Python/FastAPI backend**, a **React (CRA + CRACO) frontend**, and an early-stage **React Native/Expo mobile app**.

### Services

| Service | Directory | Start command | Port | Notes |
|---------|-----------|---------------|------|-------|
| Backend | `backend/` | `uvicorn server:app --reload --port 8000` | 8000 | Requires `backend/.env`; runs without Supabase (auth/data routes fail gracefully) |
| Frontend | `frontend/` | `yarn start` | 3000 | Requires `frontend/.env`; uses CRACO over CRA |
| Mobile | `mobile/` | `expo start` | 19000 | Early stage; optional for most dev work |

### Environment files

No `.env.example` files exist in the repo. See `SECRETS_AND_DEPENDENCIES.md` for the full registry. Minimal `.env` files to start:

- **`backend/.env`**: Must set `JWT_SECRET_KEY` (mandatory — accessed via `os.environ['JWT_SECRET_KEY']`). All other vars use `os.environ.get()` and degrade gracefully. Without `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`, the server boots but auth/data routes fail.
- **`frontend/.env`**: Set `REACT_APP_BACKEND_URL=http://localhost:8000`, plus `REACT_APP_SUPABASE_URL` and `REACT_APP_SUPABASE_ANON_KEY` (can be placeholders if no Supabase project is available).

### Lint

- **Backend**: `ruff check backend/` or `flake8 backend/` (both installed). The codebase has many pre-existing lint warnings (line length, unused imports, etc.) — these are not regressions.
- **Frontend**: ESLint runs implicitly during `yarn start` and `yarn build` via CRA's built-in config. The standalone ESLint v9 in `devDependencies` has no flat config file — do not run `npx eslint` directly.

### Tests

- **Backend**: `pytest backend/tests/ --timeout=30` — 83 test files. Most are integration tests requiring live Supabase/API connections. ~75 tests pass without external services; the rest fail with connection errors (expected).
- **Frontend**: `yarn test` (CRA test runner). No dedicated test suite beyond CRA defaults.

### Required secrets (environment variables)

These must be available as environment variables (or in `backend/.env` / `frontend/.env`) for full functionality:

| Secret | Used by | Required for |
|--------|---------|-------------|
| `SUPABASE_URL` | Backend + Frontend | All auth/data routes |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend | Database writes (bypasses RLS) |
| `SUPABASE_ANON_KEY` | Frontend + Backend | Client-side Supabase auth |
| `OPENAI_API_KEY` | Backend | AI chat (SoundBoard), analysis, voice |

Without these, the backend starts but returns errors on auth/data/AI endpoints. The frontend renders but login/signup fail.

### Hello-world test

After starting both servers with valid secrets, verify the stack works end to end:
1. `curl -s http://localhost:8000/health` — should return `{"status":"ok"}`
2. Register: `curl -X POST http://localhost:8000/api/auth/supabase/signup -H "Content-Type: application/json" -d '{"email":"test@example.com","password":"Test123!","full_name":"Test"}'`
3. Login: `curl -X POST http://localhost:8000/api/auth/supabase/login -H "Content-Type: application/json" -d '{"email":"test@example.com","password":"Test123!"}'`
4. Use the returned `access_token` to hit `/api/auth/supabase/me` with `Authorization: Bearer <token>`
5. Open `http://localhost:3000` in Chrome, click "Log In", enter credentials — should redirect to `/advisor` dashboard

### Gotchas

- Python tools (`pytest`, `ruff`, `flake8`, `uvicorn`, etc.) install to `~/.local/bin`. Ensure this is on `PATH`.
- The backend uses `dotenv` and loads from `backend/.env` automatically.
- The frontend uses `yarn` (v1.22.22, declared in `packageManager`). Do not use `npm` for the frontend.
- `app` is created at module-level in `backend/server.py` — `FastAPI()` is instantiated twice (line 34 and line 87). The uvicorn entrypoint is `server:app`.
- Redis is optional; the job queue (`biqc_jobs.py`) logs a warning and degrades gracefully without it.
- MongoDB references are legacy/dead code. No MongoDB is needed.
- When Supabase connects successfully, the backend logs `Cognitive Core initialized with Supabase PostgreSQL` and initializes Watchtower, Escalation Memory, Contradiction Engine, and Snapshot Agent.
- The SoundBoard AI chat enforces a "coverage guardrail" — new users with no business profile data get prompted to complete calibration before receiving personalized advice.
