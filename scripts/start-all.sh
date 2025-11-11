#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

export XAI_API_KEY="${XAI_API_KEY:-}"
export AGENTIC_GROK_URL="${AGENTIC_GROK_URL:-http://localhost:8001}"

# Qdrant preflight: require healthy vector DB to avoid in-memory fallback
QH="${QDRANT_HOST:-}"
QP="${QDRANT_PORT:-}"
if [ -z "$QH" ] || [ -z "$QP" ]; then
  if [ -f "$ROOT_DIR/.env.local" ]; then
    QH="${QH:-$(grep -E '^QDRANT_HOST=' "$ROOT_DIR/.env.local" | head -n1 | cut -d'=' -f2)}"
    QP="${QP:-$(grep -E '^QDRANT_PORT=' "$ROOT_DIR/.env.local" | head -n1 | cut -d'=' -f2)}"
  fi
fi
QH="${QH:-localhost}"
QP="${QP:-6333}"

echo "==> Checking Qdrant at http://$QH:$QP/healthz"
if ! curl -fsS "http://$QH:$QP/healthz" >/dev/null 2>&1; then
  echo "ERROR: Qdrant not reachable at http://$QH:$QP"
  echo "       Memory would fall back to in-memory and be non-persistent."
  echo "       Start Qdrant (e.g., docker run -p 6333:6333 qdrant/qdrant) or set QDRANT_HOST/PORT."
  if [ "${ALLOW_INMEMORY:-0}" != "1" ]; then
    echo "Exiting. Set ALLOW_INMEMORY=1 to bypass this check."
    exit 1
  else
    echo "WARNING: ALLOW_INMEMORY=1 set; proceeding without Qdrant."
  fi
fi

echo "==> Starting Agentic Grok"
(
  cd "$ROOT_DIR/services/agentic-grok"
  source venv/bin/activate
  ./start.sh &
)

sleep 2

echo "==> Starting Streamlit EEG"
(
  cd "$ROOT_DIR/services/eeg-tokenizer"
  source venv/bin/activate
  streamlit run app.py &
)

echo "==> Starting Next.js"
(
  cd "$ROOT_DIR"
  npm run dev &
)

echo "All services started in background. Press Ctrl+C to exit this shell."
