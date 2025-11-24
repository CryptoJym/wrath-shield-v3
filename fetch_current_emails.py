#!/usr/bin/env python3
"""Fetch current emails from Gmail with full details"""
from gmail_scraper import GmailScraper
import json
from datetime import datetime

print("Initializing Gmail scraper...")
scraper = GmailScraper(credentials_path='credentials.json')

# Search for emails from the last 60 days
print("Searching for recent emails...")
query = "after:2025/09/05"
message_list = scraper.search_messages(query=query, max_results=100)

print(f"Found {len(message_list)} message IDs")
print("Fetching full message details...")

messages = []
for i, msg in enumerate(message_list):
    msg_id = msg.get('id')
    if msg_id:
        details = scraper.get_message_details(msg_id)
        if details:
            messages.append(details)
        if (i + 1) % 10 == 0:
            print(f"  Fetched {i + 1}/{len(message_list)} messages...")

print(f"\n✅ Successfully fetched {len(messages)} complete emails")

# Save to file
with open('gmail_current_emails.json', 'w') as f:
    json.dump(messages, f, indent=2, default=str)

# Find and display most recent emails
print("\n=== MOST RECENT EMAILS (Sept-Oct 2025) ===\n")
sorted_msgs = sorted(messages, key=lambda x: x.get('timestamp', ''), reverse=True)

for msg in sorted_msgs[:20]:
    timestamp = msg.get('timestamp', 'Unknown')
    from_addr = msg.get('from', 'Unknown')
    subject = msg.get('subject', '(no subject)')
    print(f"{timestamp} | {from_addr}")
    print(f"  Subject: {subject}")
    print()

# Find emails from Zack Starr
print("\n=== EMAILS FROM ZACK STARR (Attorney) ===\n")
zack_emails = [m for m in messages if 'zstarr@moodybrown.com' in m.get('from', '').lower()]
print(f"Found {len(zack_emails)} emails from Zack Starr")

for msg in sorted(zack_emails, key=lambda x: x.get('timestamp', ''), reverse=True):
    print(f"\n📧 {msg.get('timestamp')}")
    print(f"Subject: {msg.get('subject')}")
    print(f"Snippet: {msg.get('snippet', '')[:200]}...")

# Save Zack's emails separately
with open('zack_emails_current.json', 'w') as f:
    json.dump(zack_emails, f, indent=2, default=str)

print(f"\n✅ Saved {len(zack_emails)} emails from Zack to zack_emails_current.json")
