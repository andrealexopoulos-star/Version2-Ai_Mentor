# BIQc Dev Full Migration Runbook (Windows -> Mac)

## Objective

Move dev capability to Mac with zero regression:

- code,
- env templates,
- Supabase migration alignment,
- Azure dev deployment ability,
- transcript portability (optional but supported).

## Source of Truth

- Branch: `dDev`
- Repo path (current machine): `C:\Users\andre\.cursor\worktrees\tpn\fbn`

## Step 1 - Clone on Mac

```bash
git clone <your-repo-url>
cd <repo-folder>
git checkout dDev
```

## Step 2 - Create Env Files (No Secrets in Git)

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Fill both files with dev-only values.

## Step 3 - Supabase Dev Alignment

1. Use a dedicated dev Supabase project.
2. Apply schema from repo migrations (`supabase/migrations` and your approved migration process).
3. Set backend + frontend Supabase env values to that dev project.

## Step 4 - Local Runtime Boot

```bash
bash scripts/migration/bootstrap_mac_dev.sh
```

Then run:

```bash
cd backend
source .venv/bin/activate
uvicorn server:app --reload --port 8001
```

```bash
cd frontend
yarn start
```

## Step 5 - Regression Verification (Minimum)

1. `GET /api/health` returns `200`.
2. Unauthenticated protected route redirects to login.
3. Auth callback resolves to Ask BIQc flow.
4. Market page shows calibration CTA.
5. Forensic calibration:
   - first run succeeds,
   - second run (free tier inside 30 days) blocks with clear message.

## Step 6 - Azure Dev Deployment (Optional)

Prepare new images then rollout using:

```bash
bash scripts/migration/azure_dev_rollout.sh
```

with:

- `RG`
- `WEB_APP`
- `API_APP`
- `ACR`
- `FRONTEND_TAG`
- `BACKEND_TAG`

## Step 7 - Transcript Portability (Optional)

From Windows source machine, export local Cursor transcripts into repo tree:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/migration/export_cursor_transcripts.ps1
```

This writes to:

- `transcripts/cursor-agent-transcripts`

Commit/push to make transcripts available on Mac clone.

## Security Controls

1. Never commit real secrets.
2. Keep JWT secure mode active.
3. Use dev URLs/keys only in dev branch.
4. Keep prod resources isolated.

## Next Agent Entry Point

Direct next agent to:

- `docs/NEXT_AGENT_FORENSIC_HANDOVER.md`

This file is the mission handover with constraints, preserved behavior, and must-pass gates.
