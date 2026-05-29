#!/usr/bin/env bash
# ============================================================================
# scripts/stop.sh — stop Postgres + Redis containers
#
# Use this AFTER pressing Ctrl+C in the start.sh terminal. Stops the
# Docker containers. Your data (DB volume) is preserved — next start.sh
# resumes with everything intact.
#
# Usage:  bash scripts/stop.sh
# ============================================================================
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"
echo "▸ Stopping Postgres + Redis containers (data preserved)..."
npm run --silent docker:down >/dev/null
echo "✓ Containers stopped"
