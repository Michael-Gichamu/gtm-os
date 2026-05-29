# ============================================================================
# scripts/stop.ps1 - stop Postgres + Redis containers (PowerShell)
#
# Use this after pressing Ctrl+C in the start.ps1 terminal. Stops the
# Docker containers. Your data (DB volume) is preserved - next start.ps1
# resumes with everything intact.
#
# Usage:  .\scripts\stop.ps1
# ============================================================================
$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot
Write-Host "[..] Stopping Postgres + Redis containers (data preserved)..." -ForegroundColor Cyan
npm run --silent docker:down | Out-Null
Write-Host "[OK] Containers stopped" -ForegroundColor Green
