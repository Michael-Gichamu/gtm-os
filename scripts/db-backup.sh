#!/usr/bin/env bash
# ============================================================================
# scripts/db-backup.sh - dump the GTM-OS Postgres database to a timestamped
# SQL file in ./backups/. See db-backup.ps1 for the matching Windows version.
# ============================================================================
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if ! docker exec gtm-os-postgres pg_isready -U gtm >/dev/null 2>&1; then
  echo "[!!] Postgres container is not running. Start the stack first: bash scripts/start.sh" >&2
  exit 1
fi

mkdir -p backups
ts="$(date +%Y%m%d-%H%M%S)"
out="backups/gtm-os_${ts}.sql"

echo "[..] Dumping gtm_os -> $out"
docker exec gtm-os-postgres pg_dump -U gtm -d gtm_os --clean --if-exists > "$out"
size="$(du -k "$out" | cut -f1)"
echo "[OK] Backup created: $out (${size} KB)"
echo
echo "Restore with:  bash scripts/db-restore.sh $out"
