#!/usr/bin/env bash
# ============================================================================
# scripts/db-restore.sh - restore a previously-taken pg_dump into the running
# gtm_os database. DESTRUCTIVE: replaces existing data.
#
# Usage:
#   bash scripts/db-restore.sh                       # list backups
#   bash scripts/db-restore.sh backups/gtm-os_<ts>.sql
# ============================================================================
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if [[ $# -eq 0 ]]; then
  echo "[..] Available backups in ./backups/:"
  if [[ -d backups ]]; then
    if compgen -G "backups/*.sql" > /dev/null; then
      ls -lh backups/*.sql | awk '{ printf "  %-50s %8s   %s %s %s\n", $9, $5, $6, $7, $8 }'
    else
      echo "  (no .sql files yet — run bash scripts/db-backup.sh first)"
    fi
  else
    echo "  (the ./backups folder doesn't exist yet — run bash scripts/db-backup.sh)"
  fi
  echo
  echo "Usage: bash scripts/db-restore.sh ./backups/<file>.sql"
  exit 0
fi

backup="$1"
if [[ ! -f "$backup" ]]; then
  echo "[!!] Backup file not found: $backup" >&2
  exit 1
fi

if ! docker exec gtm-os-postgres pg_isready -U gtm >/dev/null 2>&1; then
  echo "[!!] Postgres container is not running. Start the stack first: bash scripts/start.sh" >&2
  exit 1
fi

echo "[!!] About to REPLACE all data in gtm_os with the contents of:"
echo "     $(realpath "$backup")"
read -r -p "Type 'yes' to continue, anything else to cancel: " confirm
if [[ "$confirm" != "yes" ]]; then
  echo "Cancelled."
  exit 0
fi

echo "[..] Restoring..."
docker exec -i gtm-os-postgres psql -U gtm -d gtm_os --quiet < "$backup"
echo "[OK] Restore complete from $backup"
