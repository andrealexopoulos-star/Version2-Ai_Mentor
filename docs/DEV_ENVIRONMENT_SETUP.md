# Dev environment setup (Git dev branch + Supabase + Azure)

How to create a **dev environment** using a Git `dev` branch, and whether you need to clone production.

---

## Short answer

- **Git:** Use a `dev` branch for development; merge to `main` for production.
- **Supabase:** Use a **separate Supabase project** for dev (do **not** point dev at prod). Same schema via migrations; no need to “clone” prod data.
- **Azure:** Use a **separate App Service** (or slot) for dev, or run the backend **locally**. Do not run dev code against prod Azure.

You do **not** need to clone production data. Use separate dev resources and the same schema (migrations).

---

## 1. Git dev branch

```bash
# Create and use dev branch
git checkout -b dev
# Do work on dev, then merge to main for release
git push -u origin dev
```

- **main** (or **production**): what runs on biqc.ai.  
- **dev**: where you develop; CI can run tests here; when stable, merge to main.

---

## 2. Supabase: separate dev project (recommended)

**Do not** use the production Supabase project for daily dev. Use a second project.

| Step | Action |
|------|--------|
| 1 | In [Supabase Dashboard](https://supabase.com/dashboard), create a **new project** (e.g. “BIQc Dev”). |
| 2 | Apply the **same schema**: run your migrations on the dev project (e.g. `supabase db push` or run `supabase/migrations/*.sql` in order). |
| 3 | In **dev**, set env to the **dev** project: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and in the frontend `REACT_APP_SUPABASE_URL`, `REACT_APP_SUPABASE_ANON_KEY` from the dev project’s Settings → API. |

**Do you clone prod?**  
- **Schema:** No “clone” needed. Your migrations *are* the schema; run them on dev.  
- **Data:** Usually **no**. Dev uses empty or seeded/fake data. If you ever need a copy of prod (e.g. to debug an issue), use a one-off export/import and treat it as sensitive.

Result: **dev branch + dev Supabase project**; **main + prod Supabase project**.

---

## 3. Azure: separate dev backend (or local)

**Do not** run the dev branch against the production Azure App Service.

**Option A – Backend runs locally (simplest for dev)**  
- On your machine: `dev` branch, backend runs at `http://localhost:8000`.  
- Frontend `.env`: `REACT_APP_BACKEND_URL=http://localhost:8000`.  
- Backend `.env`: points to **dev Supabase** (above).  
- No Azure “clone”; prod stays on Azure, dev is local.

**Option B – Azure “dev” slot or second App Service**  
- Create a **staging slot** or a **second App Service** (e.g. “biqc-backend-dev”).  
- Deploy the **dev** branch to it.  
- Set that app’s env to **dev Supabase** and (if needed) dev-only keys.  
- Frontend dev can point to this backend URL instead of localhost.

You do **not** need to clone Azure prod; you use a separate deployment (or local) with dev config.

---

## 4. Recommended dev setup (summary)

| Layer      | Prod                          | Dev                                      |
|-----------|--------------------------------|------------------------------------------|
| **Git**   | `main`                         | `dev`                                    |
| **Supabase** | One project (prod)         | **Second project** (dev), same migrations |
| **Backend**  | Azure App Service (prod)    | Local (e.g. `uvicorn`) or Azure dev slot  |
| **Frontend** | Hosted (e.g. Vercel/Azure) | `npm start` (localhost:3000)             |
| **Env**   | `ENVIRONMENT=production`, prod URLs/keys | No `ENVIRONMENT=production`, dev URLs/keys |

**Do we clone Supabase prod and Azure prod to make them “dev”?**  
- **No.** You don’t clone them. You create **separate** dev resources (new Supabase project, local or second Azure app) and point the **dev branch** at those via env. Schema comes from migrations; data in dev is usually empty or seeded.

---

## 5. Quick start: local dev with dev Supabase

1. **Create dev Supabase project** and run migrations (see above).  
2. **Backend** (from repo root, `dev` branch):
   - Copy `backend/.env.example` → `backend/.env`.
   - Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to the **dev** project.
   - Do **not** set `ENVIRONMENT=production`.
   - Run: `cd backend && pip install -r requirements.txt && uvicorn server:app --reload --port 8000`.  
3. **Frontend** (from repo root):
   - Copy `frontend/.env.example` → `frontend/.env`.
   - Set `REACT_APP_SUPABASE_URL` and `REACT_APP_SUPABASE_ANON_KEY` to the **dev** project.
   - Set `REACT_APP_BACKEND_URL=http://localhost:8000`.
   - Run: `cd frontend && npm install && npm start`.  
4. Work on the **dev** branch; when ready, merge to **main** and deploy prod as you do today.

---

## 6. Optional: seed dev Supabase with test data

If you want dev to have users/data without touching prod:

- Add **seed scripts** (e.g. `supabase/seed.sql` or a small script that inserts test users and minimal data).  
- Run the seed only against the **dev** project.  
- Never run it against prod.

This is still **not** “cloning” prod; it’s controlled, minimal test data.
