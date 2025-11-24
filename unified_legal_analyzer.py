#!/usr/bin/env python3
"""
Unified Legal Analyzer - Combines ALL sources for complete case context
Uses local DeepSeek-R1 for private AI analysis
"""

import json
import os
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Any
import subprocess

class UnifiedLegalAnalyzer:
    """Combines court filings, emails, and texts for AI analysis"""

    def __init__(self, case_number: str = "164400524"):
        self.case_number = case_number
        self.data_dir = Path('scraped_data')
        self.context = {
            'court_filings': {},
            'emails': [],
            'texts': [],
            'unified_timeline': []
        }

    def load_court_filings(self):
        """Load MyCase court data"""
        print("📁 Loading court filings...")

        # Find most recent case file
        case_files = list(self.data_dir.glob(f'case_{self.case_number}_*.json'))
        if case_files:
            latest = sorted(case_files)[-1]
            with open(latest, 'r') as f:
                self.context['court_filings'] = json.load(f)
            print(f"   ✓ Loaded: {latest.name}")
            return True
        else:
            print(f"   ⚠️  No court data found for case {self.case_number}")
            return False

    def load_emails(self, contact_name: str = "zstarr@moodybrown.com", days: int = 90):
        """Load Gmail emails from attorney"""
        print(f"📧 Loading emails from {contact_name}...")

        email_files = [
            'zack_emails_current.json',
            'gmail_current_emails.json'
        ]

        for email_file in email_files:
            file_path = Path(email_file)
            if file_path.exists():
                with open(file_path, 'r') as f:
                    emails = json.load(f)
                    if isinstance(emails, list):
                        self.context['emails'].extend(emails)
                print(f"   ✓ Loaded: {email_file} ({len(emails)} emails)")

        print(f"   ✓ Total emails: {len(self.context['emails'])}")
        return len(self.context['emails']) > 0

    def load_texts(self, contact_name: str = "Destiny", days: int = 90):
        """Load iMessage texts"""
        print(f"💬 Loading texts with {contact_name}...")

        text_files = list(Path('.').glob('*destiny*.json')) + list(Path('.').glob('*messages*.json'))

        for text_file in text_files:
            try:
                with open(text_file, 'r') as f:
                    texts = json.load(f)
                    if isinstance(texts, list):
                        self.context['texts'].extend(texts)
                    print(f"   ✓ Loaded: {text_file.name}")
            except:
                pass

        if self.context['texts']:
            print(f"   ✓ Total texts: {len(self.context['texts'])}")
        else:
            print(f"   ⚠️  No text messages found")

        return len(self.context['texts']) > 0

    def build_unified_timeline(self):
        """Combine all events into chronological timeline"""
        print("📅 Building unified timeline...")

        timeline = []

        # Add court events
        if 'recent_critical_events' in self.context['court_filings']:
            for event in self.context['court_filings']['recent_critical_events']:
                timeline.append({
                    'date': event['date'],
                    'source': 'COURT',
                    'type': event['type'],
                    'description': event['description'],
                    'urgency': event.get('urgency', 'NORMAL')
                })

        # Add emails
        for email in self.context['emails']:
            timeline.append({
                'date': email.get('timestamp', email.get('date', '')),
                'source': 'EMAIL',
                'type': 'Communication',
                'description': f"From {email.get('from', 'Unknown')}: {email.get('subject', 'No subject')}",
                'content': email.get('snippet', email.get('body', ''))[:200]
            })

        # Add texts
        for text in self.context['texts']:
            if isinstance(text, dict):
                timeline.append({
                    'date': text.get('date', ''),
                    'source': 'TEXT',
                    'type': 'Message',
                    'description': text.get('text', '')[:100]
                })

        # Sort by date
        timeline.sort(key=lambda x: x.get('date', ''), reverse=True)
        self.context['unified_timeline'] = timeline

        print(f"   ✓ Timeline events: {len(timeline)}")
        return timeline

    def analyze_with_deepseek(self):
        """Run DeepSeek analysis on complete context"""
        print("\n🤖 Analyzing with DeepSeek-R1...")

        # Build analysis prompt
        prompt = self._build_analysis_prompt()

        # Check if Ollama is running
        try:
            subprocess.run(['ollama', 'list'], capture_output=True, check=True)
        except:
            print("   ⚠️  Ollama not running. Starting it...")
            subprocess.Popen(['ollama', 'serve'])
            import time
            time.sleep(3)

        # Run DeepSeek analysis
        try:
            result = subprocess.run(
                ['ollama', 'run', 'deepseek-r1', prompt],
                capture_output=True,
                text=True,
                timeout=120
            )

            analysis = result.stdout

            # Save analysis
            analysis_file = self.data_dir / 'analysis' / f'analysis_{datetime.now().strftime("%Y%m%d_%H%M%S")}.txt'
            analysis_file.parent.mkdir(exist_ok=True)
            analysis_file.write_text(analysis)

            print(f"   ✓ Analysis saved: {analysis_file}")
            return analysis

        except subprocess.TimeoutExpired:
            print("   ⚠️  Analysis timed out")
            return None
        except Exception as e:
            print(f"   ❌ Analysis failed: {e}")
            return None

    def _build_analysis_prompt(self) -> str:
        """Build comprehensive analysis prompt"""

        # Get court info
        court_data = self.context['court_filings']
        next_hearing = court_data.get('key_dates', {}).get('next_hearing', {})

        # Get recent events
        recent_events = '\n'.join([
            f"- {e['date']}: {e['description']}"
            for e in self.context['unified_timeline'][:10]
        ])

        # Get critical filings
        critical_docs = '\n'.join([
            f"- {d['date']}: {d['description']}"
            for d in court_data.get('recent_critical_events', [])
        ])

        prompt = f"""You are a legal strategist analyzing a child custody relocation case.

CASE: Brady v. Hyte (Case {self.case_number})
COURT: {court_data.get('court', {}).get('name', 'Unknown')}
JUDGE: {court_data.get('court', {}).get('assigned_judge', 'Unknown')}

UPCOMING HEARING:
Date: {next_hearing.get('date', 'Unknown')}
Time: {next_hearing.get('time', 'Unknown')}
Type: {next_hearing.get('description', 'Unknown')}

CRITICAL RECENT FILINGS:
{critical_docs}

RECENT TIMELINE (All Sources):
{recent_events}

ANALYZE AND PROVIDE:

1. 🚨 URGENT ACTIONS (next 7 days):
   - What must James do immediately?
   - What deadlines are approaching?
   - What documents need review?

2. ⚠️ WARNINGS:
   - What risks exist?
   - What weaknesses in current position?
   - What has Destiny's attorney set up?

3. 💡 OPPORTUNITIES:
   - What strategic advantages exist?
   - What evidence strengthens James's case?
   - What arguments should be emphasized?

4. 📋 RECOMMENDED NEXT STEPS:
   - Priority order actions
   - Evidence to gather
   - Arguments to prepare

Be specific. Reference actual dates, filings, and events from the data provided.
"""
        return prompt

    def generate_strategic_brief(self) -> Dict[str, Any]:
        """Generate complete strategic briefing"""
        print("\n" + "="*70)
        print("🎯 UNIFIED LEGAL STRATEGIC BRIEF")
        print("="*70)

        # Load all sources
        self.load_court_filings()
        self.load_emails()
        self.load_texts()

        # Build timeline
        self.build_unified_timeline()

        # Get AI analysis
        analysis = self.analyze_with_deepseek()

        # Build brief
        brief = {
            'generated_at': datetime.now().isoformat(),
            'case_number': self.case_number,
            'next_hearing': self.context['court_filings'].get('key_dates', {}).get('next_hearing', {}),
            'sources_analyzed': {
                'court_filings': len(self.context['court_filings'].get('recent_critical_events', [])),
                'emails': len(self.context['emails']),
                'texts': len(self.context['texts']),
                'timeline_events': len(self.context['unified_timeline'])
            },
            'ai_analysis': analysis,
            'context': self.context
        }

        # Save brief
        brief_file = self.data_dir / 'analysis' / f'strategic_brief_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
        brief_file.parent.mkdir(exist_ok=True)
        with open(brief_file, 'w') as f:
            json.dump(brief, f, indent=2)

        print(f"\n💾 Strategic brief saved: {brief_file}")

        # Print summary
        print("\n📊 ANALYSIS SUMMARY:")
        print(f"   Next Hearing: {brief['next_hearing'].get('date', 'Unknown')} at {brief['next_hearing'].get('time', 'Unknown')}")
        print(f"   Court Filings: {brief['sources_analyzed']['court_filings']}")
        print(f"   Emails: {brief['sources_analyzed']['emails']}")
        print(f"   Timeline Events: {brief['sources_analyzed']['timeline_events']}")

        if analysis:
            print("\n🤖 AI STRATEGIC ANALYSIS:")
            print(analysis[:1000])
            if len(analysis) > 1000:
                print(f"\n... (see full analysis in {brief_file})")

        print("\n" + "="*70)

        return brief


def main():
    """Run unified legal analysis"""
    import argparse

    parser = argparse.ArgumentParser(description='Unified legal case analyzer')
    parser.add_argument('--case', default='164400524', help='Case number')
    parser.add_argument('--contact', default='Destiny', help='Contact name for texts')
    parser.add_argument('--days', type=int, default=90, help='Days to look back')

    args = parser.parse_args()

    analyzer = UnifiedLegalAnalyzer(case_number=args.case)
    brief = analyzer.generate_strategic_brief()

    return brief


if __name__ == '__main__':
    main()
