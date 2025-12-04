#!/bin/bash
#
# Start Proactive Enablement System
#
# This script starts the proactive tick process via PM2.
# It runs every minute to check scheduled tasks and threshold monitors.
#
# Usage:
#   ./scripts/start-proactive.sh
#   ./scripts/start-proactive.sh --secret YOUR_SECRET
#
# Environment:
#   PROACTIVE_SECRET - Secret token for tick endpoint (optional in dev)
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Parse arguments
SECRET=""
while [[ $# -gt 0 ]]; do
  case $1 in
    --secret)
      SECRET="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Set secret in environment if provided
if [ -n "$SECRET" ]; then
  export PROACTIVE_SECRET="$SECRET"
fi

echo "🚀 Starting Proactive Enablement System..."

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
  echo "❌ PM2 is not installed. Install with: npm install -g pm2"
  exit 1
fi

# Check if proactive-tick is already running
if pm2 list | grep -q "proactive-tick"; then
  echo "⚠️  proactive-tick is already running. Restarting..."
  pm2 restart proactive-tick
else
  echo "📦 Starting proactive-tick process..."
  pm2 start ecosystem.config.js --only proactive-tick
fi

echo ""
echo "✅ Proactive system started!"
echo ""
echo "Useful commands:"
echo "  pm2 logs proactive-tick     # View logs"
echo "  pm2 status                  # Check status"
echo "  pm2 stop proactive-tick     # Stop the process"
echo "  pm2 restart proactive-tick  # Restart"
echo ""
echo "Test the tick endpoint:"
echo "  curl http://localhost:4242/api/proactive/tick"
echo ""
echo "View status:"
echo "  curl http://localhost:4242/api/proactive/status"
