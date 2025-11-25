#!/bin/bash
#
# run-with-op.sh - Run commands with secrets injected from 1Password or local env files
#
# Usage:
#   ./scripts/run-with-op.sh <command>
#   ./scripts/run-with-op.sh pm-agent-sync
#   ./scripts/run-with-op.sh pm-agent-sync --dry-run
#
# Environment files are loaded from ~/.secrets/<name>.env
# Falls back to 1Password if local file doesn't exist
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SECRETS_DIR="${HOME}/.secrets"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Load secrets from local file or 1Password
load_secrets() {
    local name="$1"
    local env_file="${SECRETS_DIR}/${name}.env"

    if [ -f "$env_file" ]; then
        log_info "Loading secrets from ${env_file}"
        # Export each line as an environment variable
        set -a
        source "$env_file"
        set +a
    elif command -v op &> /dev/null; then
        log_info "Loading secrets from 1Password for ${name}"
        # Load from 1Password - adjust vault/item names as needed
        eval "$(op run --env-file="${SECRETS_DIR}/${name}.op.env" -- printenv)"
    else
        log_warn "No secrets file found at ${env_file} and 1Password CLI not available"
    fi
}

# Command handlers
run_pm_agent_sync() {
    log_info "Running PM Agent Sync"

    # Load PM agent secrets
    load_secrets "pm-agent"

    # Also load GitHub token if not already set
    if [ -z "$GITHUB_TOKEN" ]; then
        load_secrets "github"
    fi

    # Change to project root
    cd "$PROJECT_ROOT"

    # Run the sync
    npx tsx packages/pm-agent/index.ts sync "$@"
}

run_pm_agent_init() {
    log_info "Initializing PM Agent Mappings"

    load_secrets "pm-agent"

    cd "$PROJECT_ROOT"

    npx tsx packages/pm-agent/index.ts init "$@"
}

run_pm_agent_status() {
    log_info "PM Agent Status"

    load_secrets "pm-agent"

    cd "$PROJECT_ROOT"

    npx tsx packages/pm-agent/index.ts status "$@"
}

run_legal_sync() {
    log_info "Running Legal Domain Sync"

    load_secrets "legal"

    cd "$PROJECT_ROOT"

    npx tsx lib/legal/sync.ts "$@"
}

run_finance_sync() {
    log_info "Running Finance Domain Sync"

    load_secrets "finance"

    cd "$PROJECT_ROOT"

    npx tsx lib/finance/sync.ts "$@"
}

# Main dispatcher
main() {
    if [ $# -eq 0 ]; then
        echo "Usage: $0 <command> [options]"
        echo ""
        echo "Commands:"
        echo "  pm-agent-sync     Run GitHub ↔ Motion sync"
        echo "  pm-agent-init     Initialize project mappings"
        echo "  pm-agent-status   Show sync status"
        echo "  legal-sync        Run legal domain sync"
        echo "  finance-sync      Run finance domain sync"
        echo ""
        echo "Options are passed through to the underlying command."
        exit 1
    fi

    local command="$1"
    shift

    case "$command" in
        pm-agent-sync)
            run_pm_agent_sync "$@"
            ;;
        pm-agent-init)
            run_pm_agent_init "$@"
            ;;
        pm-agent-status)
            run_pm_agent_status "$@"
            ;;
        legal-sync)
            run_legal_sync "$@"
            ;;
        finance-sync)
            run_finance_sync "$@"
            ;;
        *)
            log_error "Unknown command: $command"
            exit 1
            ;;
    esac
}

main "$@"
