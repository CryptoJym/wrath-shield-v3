#!/usr/bin/env bash
set -euo pipefail

BASE_NEXT=${BASE_NEXT:-http://localhost:4242}
BASE_GROK=${BASE_GROK:-http://localhost:8001}
BASE_QDRANT=${BASE_QDRANT:-http://localhost:6333}

check() {
  local name="$1" url="$2"
  if curl -fsS "$url" >/dev/null 2>&1; then
    echo "[OK]  $name => $url"
  else
    echo "[ERR] $name => $url"
  fi
}

echo "==> Health checks"
check "Next system status"   "$BASE_NEXT/api/system/status"
check "EEG status"           "$BASE_NEXT/api/eeg/status"
check "Psych latest"         "$BASE_NEXT/api/analysis/psych"
check "Baselines"            "$BASE_NEXT/api/metrics/baselines"
check "Agentic Grok health"  "$BASE_GROK/api/agentic/health"

# Qdrant: try /readyz then /healthz
if curl -fsS "$BASE_QDRANT/readyz" >/dev/null 2>&1; then
  echo "[OK]  Qdrant => $BASE_QDRANT/readyz"
elif curl -fsS "$BASE_QDRANT/healthz" >/dev/null 2>&1; then
  echo "[OK]  Qdrant => $BASE_QDRANT/healthz"
else
  echo "[WARN] Qdrant not reachable at $BASE_QDRANT"
fi

echo "==> Done"

