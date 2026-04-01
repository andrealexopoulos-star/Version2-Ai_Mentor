param(
  [Parameter(Mandatory = $false)]
  [string]$SourceRoot = "$env:USERPROFILE\.cursor\projects",

  [Parameter(Mandatory = $false)]
  [string]$WorkspaceHint = "c-Users-andre-cursor-worktrees-Version2-Ai-Mentor-tpn",

  [Parameter(Mandatory = $false)]
  [string]$Destination = ".\transcripts\cursor-agent-transcripts",

  [Parameter(Mandatory = $false)]
  [switch]$IncludeSubagents
)

$ErrorActionPreference = "Stop"

if (!(Test-Path $SourceRoot)) {
  throw "Source root not found: $SourceRoot"
}

$projectPath = Join-Path $SourceRoot $WorkspaceHint
if (!(Test-Path $projectPath)) {
  throw "Workspace project folder not found: $projectPath"
}

$transcriptRoot = Join-Path $projectPath "agent-transcripts"
if (!(Test-Path $transcriptRoot)) {
  throw "Transcript folder not found: $transcriptRoot"
}

New-Item -ItemType Directory -Force -Path $Destination | Out-Null

if ($IncludeSubagents) {
  Copy-Item -Path (Join-Path $transcriptRoot "*") -Destination $Destination -Recurse -Force
  Write-Output "Copied parent + subagent transcripts to: $Destination"
} else {
  $parentJsonl = Get-ChildItem -Path $transcriptRoot -Recurse -File -Filter "*.jsonl" |
    Where-Object { $_.FullName -notmatch "\\subagents\\" }
  foreach ($file in $parentJsonl) {
    $relative = $file.FullName.Substring($transcriptRoot.Length).TrimStart('\')
    $target = Join-Path $Destination $relative
    $targetDir = Split-Path $target -Parent
    if (!(Test-Path $targetDir)) { New-Item -ItemType Directory -Force -Path $targetDir | Out-Null }
    Copy-Item -Path $file.FullName -Destination $target -Force
  }
  Write-Output "Copied parent transcripts only to: $Destination"
}

Write-Output "Done."
