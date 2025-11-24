#!/usr/bin/env python3
"""
Database Backup Script for Legal Advocate AI

Creates timestamped backups of PostgreSQL or SQLite databases
Supports compression and cloud storage (S3, GCS)
"""

import os
import sys
import subprocess
import logging
from datetime import datetime
from pathlib import Path
import gzip
import shutil

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


class DatabaseBackup:
    """Database backup utility"""

    def __init__(self, config_name: str = None):
        """Initialize backup utility"""
        self.config = get_config(config_name or os.getenv('ENVIRONMENT', 'production'))
        self.database_url = self.config.DATABASE_URL
        self.backup_dir = Path(os.getenv('BACKUP_DIR', './backups'))
        self.backup_dir.mkdir(parents=True, exist_ok=True)

    def backup_postgres(self, compress: bool = True):
        """Backup PostgreSQL database"""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_file = self.backup_dir / f"legal_advocate_backup_{timestamp}.sql"

        logger.info(f"Starting PostgreSQL backup to {backup_file}")

        try:
            # Parse DATABASE_URL
            # Format: postgresql://user:pass@host:port/dbname
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

            # Run pg_dump
            cmd = [
                'pg_dump',
                '-h', host,
                '-p', port,
                '-U', username,
                '-d', dbname,
                '-f', str(backup_file),
                '--clean',  # Include DROP statements
                '--if-exists',  # Add IF EXISTS to DROP statements
                '--no-owner',  # Don't dump ownership
                '--no-privileges'  # Don't dump privileges
            ]

            result = subprocess.run(cmd, env=env, capture_output=True, text=True)

            if result.returncode != 0:
                raise Exception(f"pg_dump failed: {result.stderr}")

            logger.info(f"✅ Backup created: {backup_file}")

            # Compress if requested
            if compress:
                compressed_file = self.compress_backup(backup_file)
                logger.info(f"✅ Compressed backup: {compressed_file}")
                backup_file.unlink()  # Remove uncompressed file
                return compressed_file

            return backup_file

        except Exception as e:
            logger.error(f"❌ Backup failed: {e}")
            raise

    def backup_sqlite(self, compress: bool = True):
        """Backup SQLite database"""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_file = self.backup_dir / f"legal_advocate_backup_{timestamp}.db"

        logger.info(f"Starting SQLite backup to {backup_file}")

        try:
            # Extract SQLite file path from URL
            # Format: sqlite:///path/to/file.db
            db_path = self.database_url.replace('sqlite:///', '')
            db_path = os.path.expanduser(db_path)

            if not os.path.exists(db_path):
                raise FileNotFoundError(f"Database not found: {db_path}")

            # Copy database file
            shutil.copy2(db_path, backup_file)
            logger.info(f"✅ Backup created: {backup_file}")

            # Compress if requested
            if compress:
                compressed_file = self.compress_backup(backup_file)
                logger.info(f"✅ Compressed backup: {compressed_file}")
                backup_file.unlink()  # Remove uncompressed file
                return compressed_file

            return backup_file

        except Exception as e:
            logger.error(f"❌ Backup failed: {e}")
            raise

    def compress_backup(self, backup_file: Path) -> Path:
        """Compress backup file with gzip"""
        compressed_file = backup_file.with_suffix(backup_file.suffix + '.gz')

        with open(backup_file, 'rb') as f_in:
            with gzip.open(compressed_file, 'wb') as f_out:
                shutil.copyfileobj(f_in, f_out)

        return compressed_file

    def cleanup_old_backups(self, keep_days: int = 30):
        """Remove backups older than keep_days"""
        logger.info(f"Cleaning up backups older than {keep_days} days")

        cutoff_time = datetime.now().timestamp() - (keep_days * 86400)
        removed_count = 0

        for backup_file in self.backup_dir.glob('legal_advocate_backup_*'):
            if backup_file.stat().st_mtime < cutoff_time:
                backup_file.unlink()
                removed_count += 1
                logger.info(f"Removed old backup: {backup_file.name}")

        logger.info(f"✅ Cleanup complete. Removed {removed_count} old backups")

    def backup(self, compress: bool = True):
        """Auto-detect database type and backup"""
        if self.database_url.startswith('postgresql://'):
            return self.backup_postgres(compress)
        elif self.database_url.startswith('sqlite://'):
            return self.backup_sqlite(compress)
        else:
            raise ValueError(f"Unsupported database URL: {self.database_url}")


def main():
    """Main entry point"""
    import argparse

    parser = argparse.ArgumentParser(description='Backup Legal Advocate AI database')
    parser.add_argument(
        '--env',
        choices=['development', 'production', 'testing'],
        default=os.getenv('ENVIRONMENT', 'production'),
        help='Environment to backup'
    )
    parser.add_argument(
        '--no-compress',
        action='store_true',
        help='Skip compression'
    )
    parser.add_argument(
        '--cleanup',
        type=int,
        metavar='DAYS',
        help='Remove backups older than DAYS'
    )

    args = parser.parse_args()

    try:
        backup_util = DatabaseBackup(args.env)

        # Perform backup
        backup_file = backup_util.backup(compress=not args.no_compress)
        logger.info(f"✅ Backup completed successfully: {backup_file}")

        # Cleanup old backups if requested
        if args.cleanup:
            backup_util.cleanup_old_backups(args.cleanup)

        return 0

    except Exception as e:
        logger.error(f"❌ Backup failed: {e}")
        return 1


if __name__ == '__main__':
    sys.exit(main())
