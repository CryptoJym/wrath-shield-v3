#!/bin/bash
# Setup script for Local DeepSeek Agent with MyCase Scraper

set -e  # Exit on error

echo "🚀 Setting up Local DeepSeek Agent for Legal Case Analysis"
echo "=" "================================================================"
echo

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "⚠️  This script is optimized for macOS. Adjust commands for your OS."
fi

# Step 1: Check if Ollama is installed
echo "📦 Step 1: Checking for Ollama..."
if command -v ollama &> /dev/null; then
    echo "✅ Ollama already installed: $(ollama --version)"
else
    echo "📥 Installing Ollama..."
    curl -fsSL https://ollama.com/install.sh | sh
    echo "✅ Ollama installed successfully"
fi

# Step 2: Pull DeepSeek-R1 model
echo
echo "🤖 Step 2: Installing DeepSeek-R1 model..."
echo "   (This may take 5-10 minutes depending on your internet speed)"

if ollama list | grep -q "deepseek-r1"; then
    echo "✅ DeepSeek-R1 already installed"
else
    echo "📥 Downloading DeepSeek-R1 (~3.5GB)..."
    ollama pull deepseek-r1:latest
    echo "✅ DeepSeek-R1 installed successfully"
fi

# Step 3: Install Python dependencies
echo
echo "🐍 Step 3: Installing Python dependencies..."

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "📦 Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install packages
echo "📥 Installing required Python packages..."
pip install --upgrade pip
pip install ollama chromadb langchain langchain-community sentence-transformers
pip install python-dotenv beautifulsoup4 lxml

echo "✅ Python dependencies installed"

# Step 4: Initialize case memory directory
echo
echo "📁 Step 4: Setting up case memory storage..."
MEMORY_DIR="$HOME/.legal_advocate_ai/case_memory"
mkdir -p "$MEMORY_DIR"
echo "✅ Created: $MEMORY_DIR"

# Step 5: Test Ollama connection
echo
echo "🔍 Step 5: Testing Ollama + DeepSeek..."
ollama run deepseek-r1 "Hello! Please respond with 'I am ready to analyze legal cases.' and nothing else." --verbose=false

# Step 6: Display next steps
echo
echo "=" "================================================================"
echo "🎉 Setup Complete!"
echo "=" "================================================================"
echo
echo "📋 Quick Start:"
echo "   1. Run scraper: python mycase_scraper.py"
echo "   2. Analyze case: python analyze_with_deepseek.py scraped_data/case_*.json"
echo
echo "🔧 Manual Test:"
echo "   ollama run deepseek-r1 'Analyze this legal scenario: ...'"
echo
echo "📚 Documentation:"
echo "   - README.md - Scraper usage"
echo "   - LOCAL_AGENT_ARCHITECTURE.md - Full architecture details"
echo
echo "🗂️  Case Memory Location:"
echo "   $MEMORY_DIR"
echo
