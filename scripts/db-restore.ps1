# ============================================================================
# scripts/db-restore.ps1 - restore a previously-taken pg_dump into the
# running gtm_os database. DESTRUCTIVE: the existing data is dropped and
# replaced with the contents of the backup file.
#
# Usage:
#   .\scripts\db-restore.ps1                              # list backups
#   .\scripts\db-restore.ps1 .\backups\gtm-os_<ts>.sql    # restore from one
# ============================================================================
param([string]$BackupFile)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

function Log($msg)  { Write-Host "[..] $msg" -ForegroundColor Cyan }
function Ok($msg)   { Write-Host "[OK] $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "[!!] $msg" -ForegroundColor Yellow }
function Err($msg)  { Write-Host "[!!] $msg" -ForegroundColor Red }

# No file argument → list available backups and exit.
if (-not $BackupFile) {
  Log "Available backups in .\backups\:"
  if (Test-Path .\backups) {
    $items = Get-ChildItem .\backups\*.sql -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending
    if ($items) {
      $items | ForEach-Object {
        $sz = [math]::Round($_.Length / 1KB, 1)
        Write-Host ("  {0,-50} {1,8} KB   {2}" -f $_.Name, $sz, $_.LastWriteTime)
      }
    } else {
      Write-Host "  (no .sql files yet — run .\scripts\db-backup.ps1 first)"
    }
  } else {
    Write-Host "  (the .\backups folder doesn't exist yet — run .\scripts\db-backup.ps1)"
  }
  Write-Host ""
  Write-Host "Usage:  .\scripts\db-restore.ps1 .\backups\<file>.sql" -ForegroundColor DarkGray
  exit 0
}

if (-not (Test-Path $BackupFile)) {
  Err "Backup file not found: $BackupFile"
  exit 1
}

# Check Postgres is running.
$prev = $ErrorActionPreference
$ErrorActionPreference = "SilentlyContinue"
$null = docker exec gtm-os-postgres pg_isready -U gtm 2>$null
$pgUp = ($LASTEXITCODE -eq 0)
$ErrorActionPreference = $prev
if (-not $pgUp) {
  Err "Postgres container is not running. Start the stack first: .\scripts\start.ps1"
  exit 1
}

# Destructive — require an explicit "yes".
$abs = (Resolve-Path $BackupFile).Path
Warn "About to REPLACE all data in gtm_os with the contents of:"
Warn "  $abs"
$confirm = Read-Host "Type 'yes' to continue, anything else to cancel"
if ($confirm -ne "yes") {
  Write-Host "Cancelled." -ForegroundColor DarkGray
  exit 0
}

Log "Restoring..."
# Stream the SQL into psql inside the container. The backup is --clean
# --if-exists so it drops and recreates objects cleanly.
Get-Content $BackupFile -Raw | docker exec -i gtm-os-postgres psql -U gtm -d gtm_os --quiet
if ($LASTEXITCODE -ne 0) {
  Err "Restore failed. The database may be in a partial state — restore from a known-good backup or run npm run db:migrate:deploy."
  exit 1
}
Ok "Restore complete from $abs"
