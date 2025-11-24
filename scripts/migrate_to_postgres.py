#!/usr/bin/env python3
"""
SQLite to PostgreSQL Migration Script for Legal Advocate AI

Migrates existing SQLite data to PostgreSQL for production deployment
"""

import os
import sys
from pathlib import Path
from datetime import datetime
import logging

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import create_engine, MetaData
from sqlalchemy.orm import sessionmaker
from models.database import Base, Deadline, Request, Alert, Case, CompletionTracking
from dotenv import load_dotenv

# Load environment
load_dotenv()

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class DatabaseMigration:
    """SQLite to PostgreSQL migration utility"""

    def __init__(self, sqlite_url: str, postgres_url: str):
        """Initialize migration"""
        self.sqlite_url = sqlite_url
        self.postgres_url = postgres_url

        # Handle postgres:// -> postgresql:// conversion
        if self.postgres_url.startswith('postgres://'):
            self.postgres_url = self.postgres_url.replace('postgres://', 'postgresql://', 1)

        # Create engines
        self.sqlite_engine = create_engine(sqlite_url)
        self.postgres_engine = create_engine(postgres_url)

        # Create sessions
        SQLiteSession = sessionmaker(bind=self.sqlite_engine)
        PostgresSession = sessionmaker(bind=self.postgres_engine)

        self.sqlite_session = SQLiteSession()
        self.postgres_session = PostgresSession()

    def create_postgres_schema(self):
        """Create PostgreSQL schema"""
        logger.info("Creating PostgreSQL schema...")
        Base.metadata.create_all(self.postgres_engine)
        logger.info("✅ Schema created")

    def migrate_table(self, model_class):
        """Migrate a single table"""
        table_name = model_class.__tablename__
        logger.info(f"Migrating {table_name}...")

        try:
            # Read from SQLite
            records = self.sqlite_session.query(model_class).all()
            record_count = len(records)

            if record_count == 0:
                logger.info(f"  No records to migrate in {table_name}")
                return 0

            # Write to PostgreSQL
            for record in records:
                # Make a dict of the record
                record_dict = {
                    c.name: getattr(record, c.name)
                    for c in model_class.__table__.columns
                }

                # Create new record in PostgreSQL
                new_record = model_class(**record_dict)
                self.postgres_session.add(new_record)

            # Commit batch
            self.postgres_session.commit()
            logger.info(f"✅ Migrated {record_count} records from {table_name}")
            return record_count

        except Exception as e:
            self.postgres_session.rollback()
            logger.error(f"❌ Error migrating {table_name}: {e}")
            raise

    def migrate_all(self):
        """Migrate all tables in order (respecting foreign keys)"""
        logger.info("Starting migration...")

        total_records = 0

        # Migrate in order (foreign key dependencies)
        migration_order = [
            Case,           # No dependencies
            Deadline,       # No dependencies (alerts reference it)
            Alert,          # Depends on Deadline
            Request,        # No dependencies
            CompletionTracking  # No dependencies
        ]

        for model_class in migration_order:
            count = self.migrate_table(model_class)
            total_records += count

        logger.info(f"✅ Migration complete! Total records migrated: {total_records}")

    def verify_migration(self):
        """Verify migration by comparing record counts"""
        logger.info("Verifying migration...")

        models = [Case, Deadline, Alert, Request, CompletionTracking]
        all_match = True

        for model_class in models:
            table_name = model_class.__tablename__
            sqlite_count = self.sqlite_session.query(model_class).count()
            postgres_count = self.postgres_session.query(model_class).count()

            if sqlite_count == postgres_count:
                logger.info(f"✅ {table_name}: {sqlite_count} records (match)")
            else:
                logger.error(
                    f"❌ {table_name}: SQLite={sqlite_count}, PostgreSQL={postgres_count} (mismatch)"
                )
                all_match = False

        return all_match

    def close(self):
        """Close database connections"""
        self.sqlite_session.close()
        self.postgres_session.close()
        self.sqlite_engine.dispose()
        self.postgres_engine.dispose()


def main():
    """Main entry point"""
    import argparse

    parser = argparse.ArgumentParser(
        description='Migrate Legal Advocate AI from SQLite to PostgreSQL'
    )
    parser.add_argument(
        '--sqlite',
        default=os.getenv('SQLITE_URL', 'sqlite:///~/.legal_advocate_ai/action_items.db'),
        help='SQLite database URL'
    )
    parser.add_argument(
        '--postgres',
        default=os.getenv('DATABASE_URL'),
        help='PostgreSQL database URL'
    )
    parser.add_argument(
        '--verify-only',
        action='store_true',
        help='Only verify migration, do not migrate'
    )
    parser.add_argument(
        '--yes',
        action='store_true',
        help='Skip confirmation prompt'
    )

    args = parser.parse_args()

    if not args.postgres:
        logger.error("❌ PostgreSQL URL is required (--postgres or DATABASE_URL env var)")
        return 1

    # Expand user path
    sqlite_url = args.sqlite.replace('~', os.path.expanduser('~'))

    # Safety confirmation
    if not args.yes and not args.verify_only:
        print(f"⚠️  WARNING: This will migrate data to PostgreSQL database!")
        print(f"   Source (SQLite): {sqlite_url}")
        print(f"   Target (PostgreSQL): {args.postgres}")
        response = input("Are you sure you want to continue? (yes/no): ")
        if response.lower() != 'yes':
            print("❌ Migration cancelled")
            return 1

    try:
        migrator = DatabaseMigration(sqlite_url, args.postgres)

        if args.verify_only:
            # Only verify
            if migrator.verify_migration():
                logger.info("✅ Verification passed")
                return 0
            else:
                logger.error("❌ Verification failed")
                return 1
        else:
            # Create schema
            migrator.create_postgres_schema()

            # Migrate data
            migrator.migrate_all()

            # Verify
            if migrator.verify_migration():
                logger.info("✅ Migration completed successfully")
                return 0
            else:
                logger.error("❌ Migration verification failed")
                return 1

    except Exception as e:
        logger.error(f"❌ Migration failed: {e}")
        return 1

    finally:
        migrator.close()


if __name__ == '__main__':
    sys.exit(main())
