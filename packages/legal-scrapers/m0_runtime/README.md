# M0 Runtime Directory

This directory documents the M0 milestone runtime environment.

## Runtime Location
All M0 components are installed at: `/Users/jamesbrady/legal-advocate-ai/`

## Components

### Database
- **case_memory.db** - SQLite database with full schema (7 tables)
- Tables: documents, snippets, messages, events, event_links, people, orders
- Contains placeholder data for M0 testing

### Configuration Files
- **llm_config.json** - Local LLM configuration (Ollama/LM Studio)
- **remote_config.json** - OpenRouter API configuration (GPT-5, Perplexity, Grok)

### Python Modules
- **pii_redaction.py** - Presidio-based PII redaction module
- **hello_brief.py** - Daily strategic briefing generator
- **daily_brief.json** - Latest generated brief output

## Testing M0 Exit Criteria

From the runtime directory:
```bash
cd ~/LegalAdvocateAI
~/.pyenv/versions/3.12.11/bin/python3 hello_brief.py
```

Expected output:
- Markdown-formatted brief with Urgent/Opportunities/Warnings
- Utah Title 81 citations
- Saved JSON output

## Dependencies Installed
- Python 3.12.11 (via pyenv)
- presidio-analyzer v2.2.360
- presidio-anonymizer v2.2.360
- spacy v3.8.7
- en_core_web_lg language model

## Privacy & Security
- Directory permissions: 700 (owner-only access)
- PII redaction active for all log outputs
- Database not encrypted in M0 (SQLCipher upgrade in M6)
- API keys stored in parent project .env (git-ignored)

## Next Steps (M1)
- Install Memgraph for graph database
- Add PDF parsing modules (unstructured, pdfminer.six)
- Implement Event Builder service
- Test document ingestion pipeline