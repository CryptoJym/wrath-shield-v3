#!/usr/bin/env bash
set -euo pipefail

echo "==> Setting up local dev (Agentic Grok + Streamlit)"

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "-- Agentic Grok --"
cd "$ROOT_DIR/services/agentic-grok"
python3 -m venv venv || true
source venv/bin/activate
pip install -r requirements.txt
deactivate

echo "-- Streamlit EEG --"
cd "$ROOT_DIR/services/eeg-tokenizer"
python3 -m venv venv || true
source venv/bin/activate
pip install -r requirements.local.txt
deactivate

echo "Done. Use scripts/start-all.sh to run services."

