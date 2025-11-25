#!/usr/bin/env bash
set -euo pipefail

echo "==> Stopping services on ports 4242 (Next), 8001 (Agentic Grok), 8501 (Streamlit)"

kill_by_port() {
  local port="$1"
  if pids=$(lsof -ti tcp:"$port" 2>/dev/null); then
    if [ -n "$pids" ]; then
      echo "Killing port $port: $pids"
      kill $pids 2>/dev/null || true
      sleep 0.5
      if pids2=$(lsof -ti tcp:"$port" 2>/dev/null); then
        kill -9 $pids2 2>/dev/null || true
      fi
    fi
  fi
}

kill_by_port 4242
kill_by_port 8001
kill_by_port 8501

echo "==> Done."

