#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

export XAI_API_KEY="${XAI_API_KEY:-}"
export AGENTIC_GROK_URL="${AGENTIC_GROK_URL:-http://localhost:8001}"

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

