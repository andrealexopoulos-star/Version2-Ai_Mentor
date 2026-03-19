# AGENTS.md

## Cursor Cloud specific instructions

### Architecture overview

BIQc is a B2B AI-powered Strategic Intelligence Platform with three surfaces:

| Component | Tech Stack | Port | Start command |
|-----------|-----------|------|---------------|
| **Backend API** | Python 3 / FastAPI / Uvicorn | 8001 | `cd backend && python3 -m uvicorn server:app --host 0.0.0.0 --port 8001` |
| **Frontend** | React 19 / CRA via Craco / Tailwind | 3000 | `cd frontend && yarn start` |
| **Mobile** (optional) | React Native / Expo 52 | — | `cd mobile && expo start` |

### Required environment variables

The backend **will crash at import time** if `JWT_SECRET_KEY` is not set (`core/config.py` line 35 uses `os.environ['JWT_SECRET_KEY']`). For local dev without Supabase, set placeholder values:

```sh
export JWT_SECRET_KEY="dev-secret-key-for-local-testing-only"
export SUPABASE_URL="https://placeholder.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="placeholder-key"
export REACT_APP_SUPABASE_URL="https://placeholder.supabase.co"
export REACT_APP_SUPABASE_ANON_KEY="placeholder-key"
export REACT_APP_BACKEND_URL="http://localhost:8001"
```

The backend gracefully degrades when Supabase or Redis are unreachable — health endpoints (`/health`, `/api/health`) will still respond `{"status":"ok"}`.

### Linting

- **Backend**: `ruff check .` or `flake8` from `backend/`. Pre-existing warnings are normal.
- **Frontend**: ESLint v9 is installed but has no standalone config file. Lint runs through Craco during `yarn start` / `yarn build`. There is no separate `yarn lint` script.

### Testing

- **Backend**: `cd backend && python3 -m pytest tests/ -x -q`. Many tests need a running backend or real Supabase. `test_sdk_integrity.py` is a quick smoke test.
- **Frontend**: No test files exist currently.

### Gotchas

- `python` is not aliased — always use `python3`.
- `~/.local/bin` must be on `PATH` for `ruff`, `flake8`, `pytest`, `uvicorn` CLI commands (pip installs there). Run `export PATH="$HOME/.local/bin:$PATH"`.
- The root `package.json` only contains `ajv` dependencies (a resolution workaround); it is not the frontend entry point.
- The frontend lockfile is `yarn.lock` — use `yarn install`, not `npm install`.
