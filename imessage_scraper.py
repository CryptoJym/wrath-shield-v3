#!/usr/bin/env python3
"""
iMessage Scraper for Legal Advocate AI

Extracts iMessage conversations from macOS Messages.app database
and indexes them for case context building.

Database location: ~/Library/Messages/chat.db (SQLite)

Usage:
  python imessage_scraper.py --contact "Destiny Brady" --days 90
  python imessage_scraper.py --all --output messages_context.json
"""

import sqlite3
import json
import argparse
from pathlib import Path
from datetime import datetime, timedelta
from typing import List, Dict, Optional


class iMessageScraper:
    """Extract iMessages from macOS Messages.app database"""

    # iMessages use macOS Cocoa epoch (Jan 1, 2001 00:00:00 GMT)
    COCOA_EPOCH = 978307200

    def __init__(self):
        """Initialize scraper with Messages database path"""
        self.db_path = Path.home() / "Library" / "Messages" / "chat.db"

        if not self.db_path.exists():
            raise FileNotFoundError(
                f"Messages database not found: {self.db_path}\n"
                "This tool requires macOS with Messages.app enabled."
            )

    def _cocoa_to_datetime(self, cocoa_timestamp: float) -> Optional[datetime]:
        """Convert macOS Cocoa timestamp to Python datetime

        Note: Newer macOS versions store timestamps in nanoseconds,
        older versions in seconds. We detect and handle both.
        """
        try:
            # Cocoa timestamps can be 0 or negative for some system messages
            if cocoa_timestamp is None or cocoa_timestamp == 0:
                return None

            # Convert from nanoseconds to seconds if needed
            # Timestamps > 1 trillion (12+ digits) are likely in nanoseconds
            if cocoa_timestamp > 1_000_000_000_000:  # Nanoseconds threshold (1 trillion)
                cocoa_timestamp = cocoa_timestamp / 1_000_000_000

            unix_timestamp = cocoa_timestamp + self.COCOA_EPOCH

            # Validate timestamp is within reasonable range
            # (after 1970 and before 2100)
            if unix_timestamp < 0 or unix_timestamp > 4102444800:
                return None

            return datetime.fromtimestamp(unix_timestamp)
        except (OSError, ValueError, OverflowError):
            # Handle invalid timestamps gracefully
            return None

    def get_contacts(self) -> List[Dict[str, str]]:
        """Get all contacts from Messages database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        query = """
        SELECT DISTINCT
            handle.id as contact_id,
            handle.service as service
        FROM handle
        WHERE handle.id IS NOT NULL
        ORDER BY handle.id
        """

        cursor.execute(query)
        contacts = [
            {"contact_id": row[0], "service": row[1]}
            for row in cursor.fetchall()
        ]

        conn.close()
        return contacts

    def get_messages(
        self,
        contact: Optional[str] = None,
        days: Optional[int] = None,
        limit: Optional[int] = None
    ) -> List[Dict]:
        """
        Extract messages from database

        Args:
            contact: Filter by contact (phone number or email)
            days: Only include messages from last N days
            limit: Maximum number of messages to return
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        # Base query
        query = """
        SELECT
            message.ROWID as message_id,
            message.date as timestamp,
            message.text as content,
            message.is_from_me as is_sent,
            handle.id as contact_id,
            message.service as service,
            message.cache_has_attachments as has_attachments
        FROM message
        LEFT JOIN handle ON message.handle_id = handle.ROWID
        WHERE message.text IS NOT NULL
        """

        params = []

        # Filter by contact
        if contact:
            query += " AND handle.id LIKE ?"
            params.append(f"%{contact}%")

        # Filter by date range
        if days:
            cutoff = datetime.now() - timedelta(days=days)
            cocoa_cutoff = cutoff.timestamp() - self.COCOA_EPOCH

            # Check if database uses nanosecond timestamps
            # Query one message to determine timestamp scale
            cursor.execute("SELECT date FROM message WHERE date IS NOT NULL LIMIT 1")
            sample_row = cursor.fetchone()
            if sample_row and sample_row[0] > 1_000_000_000_000:  # 1 trillion threshold
                # Database uses nanoseconds - convert cutoff to nanoseconds
                cocoa_cutoff = cocoa_cutoff * 1_000_000_000

            query += " AND message.date > ?"
            params.append(cocoa_cutoff)

        # Order by date
        query += " ORDER BY message.date DESC"

        # Apply limit
        if limit:
            query += f" LIMIT {limit}"

        cursor.execute(query, params)

        messages = []
        for row in cursor.fetchall():
            msg_id, timestamp, content, is_sent, contact_id, service, has_attachments = row

            # Convert timestamp
            msg_datetime = self._cocoa_to_datetime(timestamp) if timestamp else None

            messages.append({
                "message_id": msg_id,
                "timestamp": msg_datetime.isoformat() if msg_datetime else None,
                "content": content,
                "is_sent": bool(is_sent),
                "contact": contact_id,
                "service": service,
                "has_attachments": bool(has_attachments),
                "direction": "sent" if is_sent else "received"
            })

        conn.close()
        return messages

    def search_messages(self, keyword: str, days: Optional[int] = None) -> List[Dict]:
        """Search messages for keyword"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        query = """
        SELECT
            message.ROWID as message_id,
            message.date as timestamp,
            message.text as content,
            message.is_from_me as is_sent,
            handle.id as contact_id
        FROM message
        LEFT JOIN handle ON message.handle_id = handle.ROWID
        WHERE message.text LIKE ?
        """

        params = [f"%{keyword}%"]

        if days:
            cutoff = datetime.now() - timedelta(days=days)
            cocoa_cutoff = cutoff.timestamp() - self.COCOA_EPOCH

            # Check if database uses nanosecond timestamps
            cursor.execute("SELECT date FROM message WHERE date IS NOT NULL LIMIT 1")
            sample_row = cursor.fetchone()
            if sample_row and sample_row[0] > 1_000_000_000_000:  # 1 trillion threshold
                # Database uses nanoseconds - convert cutoff to nanoseconds
                cocoa_cutoff = cocoa_cutoff * 1_000_000_000

            query += " AND message.date > ?"
            params.append(cocoa_cutoff)

        query += " ORDER BY message.date DESC LIMIT 100"

        cursor.execute(query, params)

        messages = []
        for row in cursor.fetchall():
            msg_id, timestamp, content, is_sent, contact_id = row
            msg_datetime = self._cocoa_to_datetime(timestamp) if timestamp else None

            messages.append({
                "message_id": msg_id,
                "timestamp": msg_datetime.isoformat() if msg_datetime else None,
                "content": content,
                "is_sent": bool(is_sent),
                "contact": contact_id,
                "direction": "sent" if is_sent else "received"
            })

        conn.close()
        return messages

    def get_conversation_summary(self, contact: str, days: int = 90) -> Dict:
        """Get summary statistics for a conversation"""
        messages = self.get_messages(contact=contact, days=days)

        sent = [m for m in messages if m["is_sent"]]
        received = [m for m in messages if not m["is_sent"]]

        return {
            "contact": contact,
            "period_days": days,
            "total_messages": len(messages),
            "sent": len(sent),
            "received": len(received),
            "latest_message": messages[0] if messages else None,
            "oldest_message": messages[-1] if messages else None
        }


def main():
    """CLI interface for iMessage scraper"""
    parser = argparse.ArgumentParser(
        description="Extract iMessages for Legal Advocate AI context"
    )
    parser.add_argument(
        "--contact",
        help="Filter by contact (name, phone, or email)"
    )
    parser.add_argument(
        "--days",
        type=int,
        help="Only messages from last N days"
    )
    parser.add_argument(
        "--limit",
        type=int,
        help="Maximum messages to return"
    )
    parser.add_argument(
        "--search",
        help="Search for keyword in messages"
    )
    parser.add_argument(
        "--list-contacts",
        action="store_true",
        help="List all contacts"
    )
    parser.add_argument(
        "--summary",
        action="store_true",
        help="Show conversation summary instead of messages"
    )
    parser.add_argument(
        "--output",
        help="Save to JSON file instead of printing"
    )

    args = parser.parse_args()

    try:
        scraper = iMessageScraper()

        # List contacts
        if args.list_contacts:
            contacts = scraper.get_contacts()
            print(f"📱 Found {len(contacts)} contacts:\n")
            for contact in contacts[:50]:  # Show first 50
                print(f"  • {contact['contact_id']} ({contact['service']})")
            if len(contacts) > 50:
                print(f"\n  ... and {len(contacts) - 50} more")
            return

        # Search messages
        if args.search:
            print(f"🔍 Searching for '{args.search}'...")
            messages = scraper.search_messages(args.search, days=args.days)

            if args.output:
                with open(args.output, 'w') as f:
                    json.dump(messages, f, indent=2)
                print(f"💾 Saved {len(messages)} messages to {args.output}")
            else:
                print(f"\n📨 Found {len(messages)} messages:\n")
                for msg in messages[:20]:
                    direction = "→" if msg["is_sent"] else "←"
                    print(f"{direction} {msg['timestamp'][:19]} | {msg['contact']}")
                    print(f"  {msg['content'][:100]}\n")
            return

        # Conversation summary
        if args.summary and args.contact:
            summary = scraper.get_conversation_summary(
                args.contact,
                days=args.days or 90
            )

            print("=" * 70)
            print(f"📊 CONVERSATION SUMMARY: {summary['contact']}")
            print("=" * 70)
            print(f"Period: Last {summary['period_days']} days")
            print(f"Total Messages: {summary['total_messages']}")
            print(f"  Sent: {summary['sent']}")
            print(f"  Received: {summary['received']}")

            if summary['latest_message']:
                print(f"\nLatest: {summary['latest_message']['timestamp'][:19]}")
                print(f"  {summary['latest_message']['content'][:100]}")

            return

        # Get messages
        messages = scraper.get_messages(
            contact=args.contact,
            days=args.days,
            limit=args.limit
        )

        if args.output:
            with open(args.output, 'w') as f:
                json.dump(messages, f, indent=2)
            print(f"💾 Saved {len(messages)} messages to {args.output}")
        else:
            print(f"📱 Found {len(messages)} messages:\n")
            for msg in messages[:50]:  # Show first 50
                direction = "→" if msg["is_sent"] else "←"
                print(f"{direction} {msg['timestamp'][:19]} | {msg['contact']}")
                print(f"  {msg['content'][:150]}")
                print()

            if len(messages) > 50:
                print(f"... and {len(messages) - 50} more messages")

    except FileNotFoundError as e:
        print(f"❌ Error: {e}")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == '__main__':
    main()
