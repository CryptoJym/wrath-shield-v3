"""
Background Worker for Document Processing Pipeline
Standalone process for processing documents from queue
"""

import signal
import sys
import time
from pathlib import Path

from document_processor import DocumentProcessor
from repositories.deadline_repository import DeadlineRepository
from repositories.request_repository import RequestRepository
from repositories.case_repository import CaseRepository
from alert_engine import AlertEngine, AlertConfig
from models.database import get_session, get_engine

from utils import get_logger

logger = get_logger(__name__)


class BackgroundWorker:
    """
    Background worker process for document processing

    Features:
    - Graceful shutdown on SIGTERM/SIGINT
    - Health check endpoint
    - Automatic recovery from errors
    - Performance monitoring
    """

    def __init__(
        self,
        database_url: str = None,
        num_workers: int = 2,
        max_retries: int = 3,
        retry_base_delay: float = 2.0
    ):
        """
        Initialize background worker

        Args:
            database_url: Database connection string
            num_workers: Number of worker threads
            max_retries: Maximum retry attempts
            retry_base_delay: Base delay for exponential backoff
        """
        self.database_url = database_url
        self.num_workers = num_workers
        self.max_retries = max_retries
        self.retry_base_delay = retry_base_delay

        # Initialize components
        self.engine = get_engine(database_url)
        self.session_factory = get_session

        # Initialize repositories
        with self.session_factory() as session:
            self.deadline_repo = DeadlineRepository(session)
            self.request_repo = RequestRepository(session)
            self.case_repo = CaseRepository(session)

        # Initialize alert engine
        alert_config = AlertConfig()
        self.alert_engine = AlertEngine(config=alert_config, database_url=database_url)

        # Initialize document processor
        with self.session_factory() as session:
            self.processor = DocumentProcessor(
                deadline_repo=DeadlineRepository(session),
                request_repo=RequestRepository(session),
                case_repo=CaseRepository(session),
                alert_engine=self.alert_engine,
                num_workers=num_workers,
                max_retries=max_retries,
                retry_base_delay=retry_base_delay
            )

        # Control flags
        self.running = False
        self.shutdown_requested = False

        # Register signal handlers
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)

        logger.info(
            f"BackgroundWorker initialized: {num_workers} workers, "
            f"max_retries={max_retries}, retry_delay={retry_base_delay}s"
        )

    def _signal_handler(self, signum, frame):
        """Handle shutdown signals"""
        signal_name = signal.Signals(signum).name
        logger.info(f"Received {signal_name}, initiating graceful shutdown...")
        self.shutdown_requested = True

    def start(self):
        """Start the background worker"""
        if self.running:
            logger.warning("Worker already running")
            return

        try:
            logger.info("🚀 Starting background worker...")

            # Start alert engine
            self.alert_engine.start()

            # Start document processor workers
            self.processor.start_workers()

            self.running = True
            logger.info("✅ Background worker started successfully")

            # Main loop
            self._run_loop()

        except Exception as e:
            logger.error(f"Failed to start background worker: {e}", exc_info=True)
            raise
        finally:
            self.stop()

    def _run_loop(self):
        """Main worker loop"""
        logger.info("Entering main worker loop...")

        check_interval = 10  # seconds
        last_stats_log = time.time()
        stats_interval = 60  # Log stats every 60 seconds

        while not self.shutdown_requested:
            try:
                # Check for shutdown
                if self.shutdown_requested:
                    break

                # Log stats periodically
                now = time.time()
                if now - last_stats_log >= stats_interval:
                    stats = self.processor.get_stats()
                    logger.info(
                        f"Worker stats: "
                        f"total_jobs={stats['total_jobs']}, "
                        f"successful={stats['successful_jobs']}, "
                        f"failed={stats['failed_jobs']}, "
                        f"queue_size={stats['queue_size']}, "
                        f"active_workers={stats['active_workers']}"
                    )
                    last_stats_log = now

                # Sleep before next check
                time.sleep(check_interval)

            except KeyboardInterrupt:
                logger.info("Keyboard interrupt received")
                break
            except Exception as e:
                logger.error(f"Error in worker loop: {e}", exc_info=True)
                # Continue running unless shutdown requested
                if not self.shutdown_requested:
                    time.sleep(5)  # Wait before retrying

        logger.info("Exiting main worker loop")

    def stop(self, timeout: float = 30.0):
        """Stop the background worker gracefully"""
        if not self.running:
            return

        logger.info("⏹️  Stopping background worker...")

        try:
            # Stop document processor workers
            self.processor.stop_workers(timeout=timeout)

            # Stop alert engine
            self.alert_engine.stop()

            self.running = False

            # Log final stats
            stats = self.processor.get_stats()
            logger.info(
                f"Final stats: "
                f"total_jobs={stats['total_jobs']}, "
                f"successful={stats['successful_jobs']}, "
                f"failed={stats['failed_jobs']}, "
                f"total_deadlines={stats['total_deadlines']}, "
                f"total_requests={stats['total_requests']}, "
                f"duplicates_prevented={stats['duplicates_prevented']}"
            )

            logger.info("✅ Background worker stopped successfully")

        except Exception as e:
            logger.error(f"Error stopping background worker: {e}", exc_info=True)

    def health_check(self) -> dict:
        """
        Perform health check

        Returns:
            Health status dictionary
        """
        stats = self.processor.get_stats()

        return {
            'status': 'healthy' if self.running else 'stopped',
            'running': self.running,
            'workers': {
                'active': stats['active_workers'],
                'total': stats['total_workers']
            },
            'queue': {
                'size': stats['queue_size']
            },
            'stats': {
                'total_jobs': stats['total_jobs'],
                'successful_jobs': stats['successful_jobs'],
                'failed_jobs': stats['failed_jobs'],
                'total_deadlines': stats['total_deadlines'],
                'total_requests': stats['total_requests']
            }
        }


def main():
    """Main entry point for background worker"""
    import argparse
    import os
    from dotenv import load_dotenv

    # Load environment variables
    load_dotenv()

    parser = argparse.ArgumentParser(description='Legal Advocate AI - Background Worker')
    parser.add_argument(
        '--database-url',
        default=os.getenv('DATABASE_URL', 'sqlite:///legal_advocate.db'),
        help='Database connection string'
    )
    parser.add_argument(
        '--workers',
        type=int,
        default=int(os.getenv('WORKER_THREADS', '2')),
        help='Number of worker threads'
    )
    parser.add_argument(
        '--max-retries',
        type=int,
        default=int(os.getenv('MAX_RETRIES', '3')),
        help='Maximum retry attempts'
    )
    parser.add_argument(
        '--retry-delay',
        type=float,
        default=float(os.getenv('RETRY_BASE_DELAY', '2.0')),
        help='Base delay for exponential backoff (seconds)'
    )
    parser.add_argument(
        '--daemon',
        action='store_true',
        help='Run as daemon (suppress interactive output)'
    )

    args = parser.parse_args()

    # Create and start worker
    worker = BackgroundWorker(
        database_url=args.database_url,
        num_workers=args.workers,
        max_retries=args.max_retries,
        retry_base_delay=args.retry_delay
    )

    try:
        if not args.daemon:
            print("=" * 70)
            print("Legal Advocate AI - Background Worker")
            print("=" * 70)
            print(f"Database: {args.database_url}")
            print(f"Workers: {args.workers}")
            print(f"Max Retries: {args.max_retries}")
            print(f"Retry Delay: {args.retry_delay}s")
            print("=" * 70)
            print("\nPress Ctrl+C to stop\n")

        worker.start()

    except KeyboardInterrupt:
        logger.info("Keyboard interrupt - shutting down")
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)
    finally:
        if not args.daemon:
            print("\nShutdown complete")


if __name__ == "__main__":
    main()
