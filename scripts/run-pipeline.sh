#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Load env for credentials and execution flags
set -a
if [ -f ".env.local" ]; then
  source .env.local
fi
set +a

# Prefer system Node via nvm if available
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  . "$HOME/.nvm/nvm.sh"
  nvm use system >/dev/null 2>&1 || true
fi

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

log "pipeline start"
npm run ingest:gmail
npm run ingest:outlook
npm run ingest:imessages
npm run sync:lifelogs
npm run normalize:events
npm run forecaster
npm run executors
log "pipeline done"
