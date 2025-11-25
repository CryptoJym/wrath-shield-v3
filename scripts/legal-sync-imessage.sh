#!/usr/bin/env bash
set -euo pipefail

# Daily sync of Destiny iMessages into legal context store.
# Adjust paths or LIMIT as needed; defaults cover the full export.

IMSG_JSON=${IMSG_JSON:-"/Users/jamesbrady/legal-advocate-ai/scraped_data/analysis/destiny_8016086861_full.json"}
LIMIT=${LIMIT:-15000}

cd "$(dirname "$0")/.."

echo "[legal-sync-imessage] source: $IMSG_JSON limit: $LIMIT"
IMSG_JSON="$IMSG_JSON" LIMIT="$LIMIT" npx tsx scripts/legal-bulk-import-imessage.ts

echo "[legal-sync-imessage] done"
