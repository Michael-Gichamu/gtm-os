# ============================================================================
# scripts/db-backup.ps1 - dump the GTM-OS Postgres database to a timestamped
# SQL file in ./backups/. Run any time you want a safety snapshot — before a
# risky Docker operation, before a Prisma reset, or just as a weekly habit.
#
# Output:  .\backups\gtm-os_YYYYMMDD-HHmmss.sql
#
# Restore: .\scripts\db-restore.ps1 .\backups\gtm-os_<timestamp>.sql
# ============================================================================
$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

function Log($msg) { Write-Host "[..] $msg" -ForegroundColor Cyan }
function Ok($msg)  { Write-Host "[OK] $msg" -ForegroundColor Green }
function Err($msg) { Write-Host "[!!] $msg" -ForegroundColor Red }

# 1. Quick sanity — is the Postgres container running?
$prev = $ErrorActionPreference
$ErrorActionPreference = "SilentlyContinue"
$null = docker exec gtm-os-postgres pg_isready -U gtm 2>$null
$pgUp = ($LASTEXITCODE -eq 0)
$ErrorActionPreference = $prev
if (-not $pgUp) {
  Err "Postgres container is not running. Start the stack first: .\scripts\start.ps1"
  exit 1
}

# 2. Backup
New-Item -ItemType Directory -Force -Path .\backups | Out-Null
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$outFile = ".\backups\gtm-os_$timestamp.sql"

Log "Dumping gtm_os -> $outFile"
# --clean + --if-exists makes the dump self-restoring (drops then recreates).
# pg_dump output streams to stdout; PowerShell redirects to the host file.
docker exec gtm-os-postgres pg_dump -U gtm -d gtm_os --clean --if-exists | Out-File -FilePath $outFile -Encoding utf8
if ($LASTEXITCODE -ne 0) {
  Err "pg_dump exited non-zero. Check Docker + Postgres logs."
  exit 1
}

$sizeKB = [math]::Round((Get-Item $outFile).Length / 1KB, 1)
Ok "Backup created: $outFile ($sizeKB KB)"
Write-Host ""
Write-Host "Restore with:  .\scripts\db-restore.ps1 $outFile" -ForegroundColor DarkGray
