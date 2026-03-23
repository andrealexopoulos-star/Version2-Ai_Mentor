# Deploy Verification

Use this checklist to prove a change is pushed and deployed correctly.

## 1) Confirm branch and push target

- Local branch should be `dev`
- Upstream should be `origin/dev`

Commands:

```powershell
git branch --show-current
git rev-parse --abbrev-ref --symbolic-full-name "@{u}"
```

## 2) Verify push + deploy status for your exact commit

Run:

```powershell
powershell -ExecutionPolicy Bypass -File "./scripts/verify-dev-deploy.ps1"
```

This script reports both:

- push check: whether local `HEAD` is already on `origin/dev`
- deploy check: whether the same SHA has a successful `Build & Deploy BIQc` run on `main`

Current defaults:

- push branch = `dev`
- deploy branch = `main`

Override example:

```powershell
powershell -ExecutionPolicy Bypass -File "./scripts/verify-dev-deploy.ps1" -PushBranch dev -DeployBranch main
```

## 3) Verify deployment summary in GitHub Actions

Open the workflow run and check `Deploy to Azure` -> `Summary` for:

- branch
- commit SHA
- frontend image tag
- backend image tag
- run URL

If that summary is present, all deploy verification/smoke steps completed successfully for that run.
