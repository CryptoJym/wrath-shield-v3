#!/bin/bash
# Complete Legal Advocate Analysis Workflow
# Combines MyCase + Gmail + iMessages + DeepSeek AI Analysis

set -e  # Exit on error

echo "========================================"
echo "Legal Advocate AI - Complete Analysis"
echo "========================================"
echo ""

# Configuration
CASE_NUMBER="${1:-164400524}"
CONTACT="${2:-Destiny}"
DAYS="${3:-90}"

echo "📋 Configuration:"
echo "   Case Number: $CASE_NUMBER"
echo "   Contact: $CONTACT"
echo "   Days Back: $DAYS"
echo ""

# Activate virtual environment
if [ -d "venv" ]; then
    echo "🔧 Activating virtual environment..."
    source venv/bin/activate
fi

# Step 1: Scrape MyCase (or use existing data)
echo "📁 Step 1: Court Filings (MyCase)"
if [ -f "scraped_data/case_${CASE_NUMBER}_*.json" ]; then
    echo "   ✓ Using existing court data"
else
    echo "   → Scraping MyCase portal..."
    python mycase_scraper.py --headless || echo "   ⚠️  Scraper failed, using existing data"
fi
echo ""

# Step 2: Fetch Gmail emails
echo "📧 Step 2: Attorney Emails (Gmail)"
if [ -f "zack_emails_current.json" ]; then
    echo "   ✓ Using existing email data"
else
    echo "   → Fetching emails..."
    python fetch_current_emails.py || echo "   ⚠️  Email fetch failed"
fi
echo ""

# Step 3: Load iMessages
echo "💬 Step 3: Text Messages (iMessages)"
if [ -f "gmail_destiny_messages.json" ] || [ -f "*destiny*.json" ]; then
    echo "   ✓ Using existing text data"
else
    echo "   → Loading iMessages..."
    python imessage_scraper.py "$CONTACT" || echo "   ⚠️  iMessage load failed"
fi
echo ""

# Step 4: Run unified analysis
echo "🤖 Step 4: AI Strategic Analysis (DeepSeek-R1)"
echo "   → Combining all sources..."
python unified_legal_analyzer.py --case "$CASE_NUMBER" --contact "$CONTACT" --days "$DAYS"
echo ""

# Step 5: Load into database
echo "💾 Step 5: Loading into database..."
python load_current_case.py
echo ""

# Step 6: Start dashboard (optional)
if [ "$4" == "--dashboard" ]; then
    echo "🎯 Step 6: Starting dashboard..."
    echo "   Dashboard will be available at: http://localhost:8501"
    streamlit run action_item_dashboard.py
else
    echo "✅ Analysis complete!"
    echo ""
    echo "To view dashboard, run:"
    echo "   ./run_complete_analysis.sh $CASE_NUMBER $CONTACT $DAYS --dashboard"
    echo ""
    echo "Or manually:"
    echo "   streamlit run action_item_dashboard.py"
fi

echo ""
echo "========================================"
echo "📊 Analysis artifacts saved in:"
echo "   - scraped_data/analysis/"
echo "   - scraped_data/"
echo "========================================"
