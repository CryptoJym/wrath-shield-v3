#!/usr/bin/env python3
"""
Database Restore Script for Legal Advocate AI

Restores database from backup files
Handles PostgreSQL and SQLite databases
"""

import os
import sys
import subprocess
import logging
import gzip
import shutil
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from config import get_config
from dotenv import load_dotenv

# Load environment
load_dotenv()

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class DatabaseRestore:
    """Database restore utility"""

    def __init__(self, config_name: str = None):
        """Initialize restore utility"""
        self.config = get_config(config_name or os.getenv('ENVIRONMENT', 'production'))
        self.database_url = self.config.DATABASE_URL

    def decompress_backup(self, backup_file: Path) -> Path:
        """Decompress gzipped backup file"""
        if not backup_file.suffix == '.gz':
            return backup_file

        decompressed_file = backup_file.with_suffix('')
        logger.info(f"Decompressing {backup_file.name}")

        with gzip.open(backup_file, 'rb') as f_in:
            with open(decompressed_file, 'wb') as f_out:
                shutil.copyfileobj(f_in, f_out)

        return decompressed_file

    def restore_postgres(self, backup_file: Path):
        """Restore PostgreSQL database"""
        logger.info(f"Starting PostgreSQL restore from {backup_file}")

        try:
            # Decompress if needed
            sql_file = self.decompress_backup(backup_file)

            # Parse DATABASE_URL
            url_parts = self.database_url.replace('postgresql://', '').split('@')
            user_pass = url_parts[0].split(':')
            host_parts = url_parts[1].split('/')
            host_port = host_parts[0].split(':')

            username = user_pass[0]
            password = user_pass[1] if len(user_pass) > 1 else ''
            host = host_port[0]
            port = host_port[1] if len(host_port) > 1 else '5432'
            dbname = host_parts[1]

            # Set password environment variable
            env = os.environ.copy()
            env['PGPASSWORD'] = password

            # Drop and recreate database (WARNING: DESTRUCTIVE)
            logger.warning(f"⚠️  Dropping database '{dbname}' and recreating...")

            # Connect to postgres database to drop/create target database
            drop_cmd = [
                'psql',
                '-h', host,
                '-p', port,
                '-U', username,
                '-d', 'postgres',
                '-c', f"DROP DATABASE IF EXISTS {dbname};"
            ]
            subprocess.run(drop_cmd, env=env, check=True, capture_output=True)

            create_cmd = [
                'psql',
                '-h', host,
                '-p', port,
                '-U', username,
                '-d', 'postgres',
                '-c', f"CREATE DATABASE {dbname};"
            ]
            subprocess.run(create_cmd, env=env, check=True, capture_output=True)

            # Restore from backup
            restore_cmd = [
                'psql',
                '-h', host,
                '-p', port,
                '-U', username,
                '-d', dbname,
                '-f', str(sql_file)
            ]

            result = subprocess.run(restore_cmd, env=env, capture_output=True, text=True)

            if result.returncode != 0:
                raise Exception(f"psql restore failed: {result.stderr}")

            logger.info(f"✅ Database restored successfully")

            # Cleanup decompressed file if it was created
            if sql_file != backup_file:
                sql_file.unlink()

        except Exception as e:
            logger.error(f"❌ Restore failed: {e}")
            raise

    def restore_sqlite(self, backup_file: Path):
        """Restore SQLite database"""
        logger.info(f"Starting SQLite restore from {backup_file}")

        try:
            # Decompress if needed
            db_file = self.decompress_backup(backup_file)

            # Extract SQLite file path from URL
            target_path = self.database_url.replace('sqlite:///', '')
            target_path = os.path.expanduser(target_path)

            # Backup existing database
            if os.path.exists(target_path):
                backup_existing = f"{target_path}.backup_before_restore"
                logger.warning(f"⚠️  Backing up existing database to {backup_existing}")
                shutil.copy2(target_path, backup_existing)

            # Copy restored database
            shutil.copy2(db_file, target_path)
            logger.info(f"✅ Database restored successfully to {target_path}")

            # Cleanup decompressed file if it was created
            if db_file != backup_file:
                db_file.unlink()

        except Exception as e:
            logger.error(f"❌ Restore failed: {e}")
            raise

    def restore(self, backup_file: Path):
        """Auto-detect database type and restore"""
        if not backup_file.exists():
            raise FileNotFoundError(f"Backup file not found: {backup_file}")

        if self.database_url.startswith('postgresql://'):
            self.restore_postgres(backup_file)
        elif self.database_url.startswith('sqlite://'):
            self.restore_sqlite(backup_file)
        else:
            raise ValueError(f"Unsupported database URL: {self.database_url}")


def main():
    """Main entry point"""
    import argparse

    parser = argparse.ArgumentParser(description='Restore Legal Advocate AI database')
    parser.add_argument(
        'backup_file',
        type=Path,
        help='Path to backup file to restore'
    )
    parser.add_argument(
        '--env',
        choices=['development', 'production', 'testing'],
        default=os.getenv('ENVIRONMENT', 'production'),
        help='Environment to restore to'
    )
    parser.add_argument(
        '--yes',
        action='store_true',
        help='Skip confirmation prompt (DANGEROUS)'
    )

    args = parser.parse_args()

    # Safety confirmation
    if not args.yes:
        print(f"⚠️  WARNING: This will REPLACE the {args.env} database!")
        print(f"   Backup file: {args.backup_file}")
        response = input("Are you sure you want to continue? (yes/no): ")
        if response.lower() != 'yes':
            print("❌ Restore cancelled")
            return 1

    try:
        restore_util = DatabaseRestore(args.env)
        restore_util.restore(args.backup_file)
        logger.info("✅ Restore completed successfully")
        return 0

    except Exception as e:
        logger.error(f"❌ Restore failed: {e}")
        return 1


if __name__ == '__main__':
    sys.exit(main())
