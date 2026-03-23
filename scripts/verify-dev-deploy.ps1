param(
  [string]$WorkflowName = "Build & Deploy BIQc",
  [string]$PushBranch = "dev",
  [string]$DeployBranch = "main",
  [int]$Limit = 30
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  Write-Error "GitHub CLI (gh) is required."
  exit 1
}

$repoRoot = (git rev-parse --show-toplevel).Trim()
if (-not $repoRoot) {
  Write-Error "Not inside a git repository."
  exit 1
}

$localBranch = (git branch --show-current).Trim()
$headSha = (git rev-parse HEAD).Trim()

Write-Host "Repo: $repoRoot"
Write-Host "Local branch: $localBranch"
Write-Host "HEAD SHA: $headSha"
Write-Host "Expected push branch: $PushBranch"
Write-Host "Expected deploy branch: $DeployBranch"

$remoteLine = git ls-remote origin "refs/heads/$PushBranch" | Select-Object -First 1
$remotePushSha = ""
if ($remoteLine) {
  $remotePushSha = (($remoteLine -split "`t")[0]).Trim()
}
if (-not $remotePushSha) {
  Write-Error "Could not read origin/$PushBranch."
  exit 2
}

if ($headSha -eq $remotePushSha) {
  Write-Host "PUSH CHECK: PASS (HEAD is on origin/$PushBranch)."
} else {
  Write-Warning "PUSH CHECK: HEAD does not match origin/$PushBranch."
  Write-Host "origin/$PushBranch HEAD: $remotePushSha"
}

if ($DeployBranch -ne $PushBranch) {
  Write-Host "DEPLOY CHECK: Deployment is configured from '$DeployBranch'."
  Write-Host "Merge/push commit to '$DeployBranch' before expecting deploy runs."
}

Write-Host "Checking workflow '$WorkflowName' on deploy branch '$DeployBranch'..."
$runsJson = gh run list --workflow "$WorkflowName" --branch "$DeployBranch" --limit $Limit --json databaseId,headSha,status,conclusion,url,displayTitle
$runs = $runsJson | ConvertFrom-Json

if (-not $runs -or $runs.Count -eq 0) {
  Write-Warning "No workflow runs found for '$WorkflowName' on '$DeployBranch'."
  exit 0
}

$exact = $runs | Where-Object { $_.headSha -eq $headSha } | Select-Object -First 1
if (-not $exact) {
  Write-Warning "No deploy run for this SHA on '$DeployBranch' yet."
  Write-Host "Latest deploy run: $($runs[0].displayTitle) | $($runs[0].status)/$($runs[0].conclusion)"
  Write-Host "URL: $($runs[0].url)"
  exit 0
}

Write-Host "Matched deploy run: $($exact.displayTitle)"
Write-Host "Run status: $($exact.status)"
Write-Host "Run conclusion: $($exact.conclusion)"
Write-Host "Run URL: $($exact.url)"

if ($exact.status -eq "completed" -and $exact.conclusion -eq "success") {
  Write-Host "DEPLOY CHECK: PASS for this SHA."
  exit 0
}

if ($exact.status -ne "completed") {
  Write-Warning "DEPLOY CHECK: run for this SHA is still in progress."
  exit 0
}

Write-Error "DEPLOY CHECK: run for this SHA completed without success."
exit 5
