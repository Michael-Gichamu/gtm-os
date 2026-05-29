#!/usr/bin/env bash
# ============================================================================
# scripts/start.sh — one-command local startup for GTM-OS
#
# Brings up Docker (launches Docker Desktop if needed), starts Postgres +
# Redis, applies any pending migrations, regenerates the Prisma client, and
# launches the web + API dev servers.
#
# Usage (from anywhere):
#   bash scripts/start.sh
#
# Press Ctrl+C in this terminal to stop the dev servers. To stop the
# containers afterwards: bash scripts/stop.sh
# ============================================================================
set -euo pipefail

# Resolve repo root regardless of where the script is invoked from.
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

log() { printf '\033[1;36m▸ %s\033[0m\n' "$*"; }
ok()  { printf '\033[1;32m✓ %s\033[0m\n' "$*"; }
err() { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; }

# ---------------------------------------------------------------------------
# 1. Ensure Docker Desktop is running
# ---------------------------------------------------------------------------
log "Checking Docker..."
if ! docker info >/dev/null 2>&1; then
  DOCKER_EXE="/c/Program Files/Docker/Docker/Docker Desktop.exe"
  if [[ -f "$DOCKER_EXE" ]]; then
    log "Docker daemon not reachable — launching Docker Desktop"
    "$DOCKER_EXE" >/dev/null 2>&1 &
  else
    err "Docker Desktop not found at default path. Start it manually then re-run."
    exit 1
  fi
  log "Waiting for Docker daemon (this can take 30-90 seconds)..."
  for i in {1..60}; do
    if docker info >/dev/null 2>&1; then break; fi
    sleep 3
  done
  if ! docker info >/dev/null 2>&1; then
    err "Docker did not start within 3 minutes. Check Docker Desktop, then re-run."
    exit 1
  fi
fi
ok "Docker is up"

# ---------------------------------------------------------------------------
# 2. Bring up Postgres + Redis
# ---------------------------------------------------------------------------
log "Starting Postgres + Redis..."
npm run --silent docker:up >/dev/null
ok "Containers running"

# ---------------------------------------------------------------------------
# 3. Wait for Postgres to accept connections
# ---------------------------------------------------------------------------
log "Waiting for Postgres to be ready..."
for i in {1..30}; do
  if docker exec gtm-os-postgres pg_isready -U gtm >/dev/null 2>&1; then
    ok "Postgres ready"
    break
  fi
  sleep 2
  if [[ $i -eq 30 ]]; then
    err "Postgres did not become ready in 60s. Run 'docker logs gtm-os-postgres'."
    exit 1
  fi
done

# ---------------------------------------------------------------------------
# 4. Apply any pending migrations (idempotent, non-interactive)
# ---------------------------------------------------------------------------
log "Applying pending migrations..."
npm run --silent db:migrate:deploy >/dev/null
ok "Schema in sync"

# ---------------------------------------------------------------------------
# 5. Ensure the Prisma client is generated (idempotent, fast)
# ---------------------------------------------------------------------------
log "Generating Prisma client..."
npm run --silent db:generate >/dev/null
ok "Prisma client ready"

# ---------------------------------------------------------------------------
# 6. Launch dev servers (web :3000, api :4000) in the foreground
# ---------------------------------------------------------------------------
log "Starting web (http://localhost:3000) + API (http://localhost:4000)"
log "First page compile takes ~30-70 seconds on this machine — then fast."
log "Press Ctrl+C to stop the dev servers."
echo
exec npm run dev
