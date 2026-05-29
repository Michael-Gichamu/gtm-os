# ============================================================================
# scripts/start.ps1 - one-command local startup for GTM-OS (PowerShell)
#
# Brings up Docker (launches Docker Desktop if needed), starts Postgres +
# Redis, applies any pending migrations, regenerates the Prisma client, and
# launches the web + API dev servers in this terminal.
#
# Usage (from anywhere):
#   .\scripts\start.ps1
#
# All dev-server output (Next.js compile progress, API logs, errors) streams
# to this terminal. Press Ctrl+C to stop. Run .\scripts\stop.ps1 afterwards
# to shut the containers down.
# ============================================================================

$ErrorActionPreference = "Stop"

# Resolve repo root regardless of where the script is invoked from.
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

function Log($msg) { Write-Host "[..] $msg" -ForegroundColor Cyan }
function Ok($msg)  { Write-Host "[OK] $msg" -ForegroundColor Green }
function Err($msg) { Write-Host "[!!] $msg" -ForegroundColor Red }

# ---------------------------------------------------------------------------
# 1. Ensure Docker Desktop is running
# ---------------------------------------------------------------------------
Log "Checking Docker..."
docker info > $null 2> $null
if ($LASTEXITCODE -ne 0) {
  $DockerExe = "C:\Program Files\Docker\Docker\Docker Desktop.exe"
  if (Test-Path $DockerExe) {
    Log "Docker daemon not reachable - launching Docker Desktop"
    Start-Process $DockerExe -WindowStyle Hidden
  } else {
    Err "Docker Desktop not found at $DockerExe. Start it manually then re-run."
    exit 1
  }
  Log "Waiting for Docker daemon (this can take 30-90 seconds)..."
  $up = $false
  for ($i = 0; $i -lt 60; $i++) {
    docker info > $null 2> $null
    if ($LASTEXITCODE -eq 0) { $up = $true; break }
    Start-Sleep -Seconds 3
  }
  if (-not $up) {
    Err "Docker did not start within 3 minutes. Check Docker Desktop, then re-run."
    exit 1
  }
}
Ok "Docker is up"

# ---------------------------------------------------------------------------
# 2. Bring up Postgres + Redis
# ---------------------------------------------------------------------------
Log "Starting Postgres + Redis..."
npm run --silent docker:up | Out-Null
Ok "Containers running"

# ---------------------------------------------------------------------------
# 3. Wait for Postgres to accept connections
# ---------------------------------------------------------------------------
Log "Waiting for Postgres to be ready..."
$pgReady = $false
for ($i = 0; $i -lt 30; $i++) {
  docker exec gtm-os-postgres pg_isready -U gtm > $null 2> $null
  if ($LASTEXITCODE -eq 0) { $pgReady = $true; break }
  Start-Sleep -Seconds 2
}
if (-not $pgReady) {
  Err "Postgres did not become ready in 60s. Run: docker logs gtm-os-postgres"
  exit 1
}
Ok "Postgres ready"

# ---------------------------------------------------------------------------
# 4. Apply any pending migrations (idempotent, non-interactive)
# ---------------------------------------------------------------------------
Log "Applying pending migrations..."
npm run --silent db:migrate:deploy | Out-Null
if ($LASTEXITCODE -ne 0) {
  Err "Migration failed. Run 'npm run db:migrate:deploy' for full output."
  exit 1
}
Ok "Schema in sync"

# ---------------------------------------------------------------------------
# 5. Ensure the Prisma client is generated (idempotent, fast)
# ---------------------------------------------------------------------------
Log "Generating Prisma client..."
npm run --silent db:generate | Out-Null
Ok "Prisma client ready"

# ---------------------------------------------------------------------------
# 6. Launch dev servers (web :3000, API :4000) - output streams here
# ---------------------------------------------------------------------------
Log "Starting web (http://localhost:3000) + API (http://localhost:4000)"
Log "First page compile takes 30-70 seconds on this machine, then fast."
Log "All Next.js + API output appears below. Press Ctrl+C to stop."
Write-Host ""
npm run dev
