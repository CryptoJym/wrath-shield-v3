#!/bin/bash
# HYRO Memory Layer Service Startup Script
#
# This script starts the Python-based memory service on port 8789.
# The service provides Mem0 semantic memory for the HYRO Forge system.
#
# Usage:
#   ./start.sh           # Start in foreground
#   ./start.sh --daemon  # Start in background
#   ./start.sh --check   # Check dependencies only

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check Qdrant (required for Mem0)
check_qdrant() {
    if curl -s http://localhost:6333/readyz > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Qdrant is running on port 6333"
        return 0
    else
        echo -e "${RED}✗${NC} Qdrant is not running"
        echo "  Start it with: docker-compose up -d qdrant"
        return 1
    fi
}

# Check Ollama (required for local mode)
check_ollama() {
    if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Ollama is running on port 11434"

        # Check for recommended models (December 2025)
        if ollama list 2>/dev/null | grep -q "qwen3:8b"; then
            echo -e "${GREEN}✓${NC} qwen3:8b model available (recommended LLM)"
        elif ollama list 2>/dev/null | grep -q "deepseek-r1:8b"; then
            echo -e "${GREEN}✓${NC} deepseek-r1:8b model available (alternative LLM)"
        elif ollama list 2>/dev/null | grep -q "llama3.1:8b"; then
            echo -e "${YELLOW}!${NC} llama3.1:8b available but consider upgrading to qwen3:8b"
        else
            echo -e "${YELLOW}!${NC} No LLM found - run: ollama pull qwen3:8b"
        fi

        if ollama list 2>/dev/null | grep -q "bge-m3"; then
            echo -e "${GREEN}✓${NC} bge-m3 model available (recommended embeddings)"
        elif ollama list 2>/dev/null | grep -q "nomic-embed-text"; then
            echo -e "${YELLOW}!${NC} nomic-embed-text available but consider upgrading to bge-m3"
        else
            echo -e "${YELLOW}!${NC} No embedding model found - run: ollama pull bge-m3"
        fi
        return 0
    else
        echo -e "${YELLOW}!${NC} Ollama is not running (required for local mode)"
        echo "  Start it with: ollama serve"
        return 1
    fi
}

# Dependency check only
if [ "$1" == "--check" ]; then
    echo "Checking HYRO Memory Layer dependencies..."
    echo ""
    check_qdrant
    QDRANT_OK=$?
    check_ollama
    OLLAMA_OK=$?
    echo ""
    if [ $QDRANT_OK -eq 0 ]; then
        echo -e "${GREEN}Ready to start!${NC}"
        exit 0
    else
        echo -e "${RED}Please fix the issues above before starting.${NC}"
        exit 1
    fi
fi

# Check for virtual environment
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
    source venv/bin/activate
    pip install --upgrade pip
    pip install -r requirements.txt
else
    source venv/bin/activate
fi

# Check for .env file
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        echo -e "${YELLOW}Warning:${NC} .env file not found. Creating from .env.example..."
        cp .env.example .env
        echo "Created .env with default local mode settings."
    fi
fi

# Pre-flight checks
echo "Checking dependencies..."
check_qdrant || { echo -e "${RED}Qdrant is required. Start it first.${NC}"; exit 1; }
check_ollama || echo -e "${YELLOW}Warning: Ollama not running. Cloud mode will be used if configured.${NC}"
echo ""

# Create logs directory
mkdir -p logs

# Start the service
PORT=${HYRO_MEMORY_PORT:-8789}

if [ "$1" == "--daemon" ]; then
    echo "Starting HYRO Memory Layer on port $PORT (background)..."
    nohup uvicorn main:app --host 0.0.0.0 --port $PORT > logs/memory-service.log 2>&1 &
    echo $! > .pid
    echo "Service started with PID $(cat .pid)"
    echo "Logs: tail -f logs/memory-service.log"
else
    echo "Starting HYRO Memory Layer on port $PORT..."
    echo "Press Ctrl+C to stop."
    uvicorn main:app --host 0.0.0.0 --port $PORT --reload
fi
