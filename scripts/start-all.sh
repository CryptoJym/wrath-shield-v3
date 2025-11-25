#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
NODE_BIN="$(command -v node || true)"
PY_BIN="$(command -v python3 || command -v python || true)"

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

# Helpers
ensure_node_modules() {
  if [ ! -d "$ROOT_DIR/node_modules" ]; then
    echo "==> Installing Node dependencies (npm ci)"
    (cd "$ROOT_DIR" && npm ci)
  fi
}

ensure_py_venv() {
  local path="$1"; shift || true
  local req="${1:-}"
  if [ -z "$PY_BIN" ]; then
    echo "WARNING: python3 not found; skipping venv for $path"
    return 0
  fi
  local created=0
  if [ ! -d "$path/venv" ]; then
    echo "==> Creating Python venv: $path/venv"
    (cd "$path" && "$PY_BIN" -m venv venv)
    created=1
  fi
  if [ -n "$req" ] && [ -f "$path/$req" ]; then
    if [ "$created" = "1" ] || [ "${FORCE_PIP:-0}" = "1" ]; then
      echo "==> Installing Python deps: $path/$req"
      (cd "$path" && source venv/bin/activate && python -m pip install -U pip wheel && pip install -r "$req")
    fi
  fi
}

wait_for() {
  local name="$1"; local url="$2"; local timeout="${3:-60}"; local i=0
  echo "==> Waiting for $name at $url (timeout ${timeout}s)"
  until curl -fsS "$url" >/dev/null 2>&1; do
    i=$((i+1)); if [ "$i" -ge "$timeout" ]; then echo "[TIMEOUT] $name"; return 1; fi; sleep 1;
  done
  echo "[READY] $name"
}

ensure_node_modules

echo "==> Starting Agentic Grok (FastAPI on :8001)"
(
  cd "$ROOT_DIR/services/agentic-grok"
  ensure_py_venv "$PWD" "requirements.txt"
  source venv/bin/activate
  PORT=8001 python agentic_service.py > "$ROOT_DIR/.grok.log" 2>&1 &
)

sleep 2

echo "==> Starting Streamlit EEG (Streamlit on :8501)"
(
  cd "$ROOT_DIR/services/eeg-tokenizer"
  ensure_py_venv "$PWD" "requirements.txt"
  source venv/bin/activate
  streamlit run app.py --server.port 8501 --server.headless true > "$ROOT_DIR/.streamlit.log" 2>&1 &
)

echo "==> Starting Next.js (dev on :4242)"
(
  cd "$ROOT_DIR"
  npm run dev > .next-dev.log 2>&1 &
)

wait_for "Agentic Grok" "http://localhost:8001/api/agentic/health" 60 || true
wait_for "Next.js" "http://localhost:4242/api/system/status" 60 || true
wait_for "Streamlit" "http://localhost:8501/healthz" 20 || true

echo "All services started in background. Logs: .grok.log, .streamlit.log, .next-dev.log"
echo "Open: http://localhost:4242"
