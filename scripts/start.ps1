# ============================================================================
# scripts/start.ps1 - one-command local startup for GTM-OS (PowerShell)
#
# Auto-detects Docker state, launches Docker Desktop if it isn't running,
# brings up Postgres + Redis, applies pending migrations, regenerates the
# Prisma client, and launches web + API + worker dev servers. You should
# never have to start Docker Desktop or any container by hand.
#
# Usage (from anywhere):
#   .\scripts\start.ps1
# ============================================================================

$ErrorActionPreference = "Stop"

# Resolve repo root regardless of where the script is invoked from.
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

function Log($msg)  { Write-Host "[..] $msg" -ForegroundColor Cyan }
function Ok($msg)   { Write-Host "[OK] $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "[!!] $msg" -ForegroundColor Yellow }
function Err($msg)  { Write-Host "[!!] $msg" -ForegroundColor Red }

# ----------------------------------------------------------------------------
# Helpers for running native commands without PowerShell 5.1 turning every
# stderr line into a NativeCommandError. The pattern: drop ErrorActionPreference
# locally, swallow stderr with 2>$null, then check $LASTEXITCODE.
# ----------------------------------------------------------------------------
function Test-DockerReady {
  $prev = $ErrorActionPreference
  $ErrorActionPreference = "SilentlyContinue"
  try {
    $null = docker info 2>$null
    return $LASTEXITCODE -eq 0
  } catch {
    return $false
  } finally {
    $ErrorActionPreference = $prev
  }
}

function Test-PostgresReady {
  $prev = $ErrorActionPreference
  $ErrorActionPreference = "SilentlyContinue"
  try {
    $null = docker exec gtm-os-postgres pg_isready -U gtm 2>$null
    return $LASTEXITCODE -eq 0
  } catch {
    return $false
  } finally {
    $ErrorActionPreference = $prev
  }
}

function Test-DockerDesktopRunning {
  return (Get-Process "Docker Desktop" -ErrorAction SilentlyContinue).Count -gt 0
}

# ---------------------------------------------------------------------------
# 1. Ensure Docker Desktop is running AND the engine responds
# ---------------------------------------------------------------------------
Log "Checking Docker..."
if (-not (Test-DockerReady)) {
  $DockerExe = "C:\Program Files\Docker\Docker\Docker Desktop.exe"
  if (-not (Test-Path $DockerExe)) {
    Err "Docker Desktop not found at $DockerExe."
    Err "Install it from https://www.docker.com/products/docker-desktop or start it manually, then re-run this script."
    exit 1
  }

  if (Test-DockerDesktopRunning) {
    Log "Docker Desktop is already running but the engine isn't reachable yet."
    Log "Waiting for the daemon to come online..."
  } else {
    Log "Docker Desktop isn't running. Launching it now..."
    Start-Process $DockerExe -WindowStyle Hidden
    Log "Waiting for it to boot (typically 30-90 seconds, longer on a cold start)..."
  }

  $up = $false
  for ($i = 1; $i -le 60; $i++) {
    if (Test-DockerReady) { $up = $true; break }
    if (($i % 5) -eq 0) {
      $elapsed = $i * 3
      Log "  still waiting... ($elapsed seconds elapsed, will give up at 180s)"
    }
    Start-Sleep -Seconds 3
  }
  if (-not $up) {
    Err "Docker did not become reachable in 3 minutes."
    Err "Open Docker Desktop manually, wait for the whale icon to stop animating, then re-run."
    exit 1
  }
}
Ok "Docker is up"

# ---------------------------------------------------------------------------
# 2. Bring up Postgres + Redis (idempotent; no-op if already running)
# ---------------------------------------------------------------------------
Log "Starting Postgres + Redis containers..."
npm run --silent docker:up | Out-Null
if ($LASTEXITCODE -ne 0) {
  Err "docker:up failed. Run 'npm run docker:up' to see the full output."
  exit 1
}
Ok "Containers running"

# ---------------------------------------------------------------------------
# 3. Wait for Postgres to accept connections
# ---------------------------------------------------------------------------
Log "Waiting for Postgres to accept connections..."
$pgReady = $false
for ($i = 1; $i -le 30; $i++) {
  if (Test-PostgresReady) { $pgReady = $true; break }
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
  Err "Migration failed. Run 'npm run db:migrate:deploy' for the full output."
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
# 6. Launch dev servers (web :3000, API :4000, worker) - output streams here
# ---------------------------------------------------------------------------
Log "Starting web (http://localhost:3000) + API (http://localhost:4000) + worker"
Log "First page compile takes 30-70 seconds on this machine, then fast."
Log "All Next.js, API, and worker output appears below. Press Ctrl+C to stop."
Write-Host ""
npm run dev
