#!/usr/bin/env bash
set -euo pipefail

# Simple helper to start a local Qdrant instance for vector memory.
# Usage:
#   bash scripts/start-qdrant.sh
#
# Data dir: .data/qdrant
# Port: 6333

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA="$ROOT/.data/qdrant"
mkdir -p "$DATA"

docker run -d --name qdrant-local \
  -p 6333:6333 \
  -v "$DATA":/qdrant/storage:z \
  qdrant/qdrant:latest

echo "Qdrant started on http://localhost:6333 (data in $DATA)"
