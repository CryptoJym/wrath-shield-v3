"""
TimescaleDB Client for EEG Tokenizer

Provides a clean interface for all database operations:
- EEG token storage
- Whoop metrics logging
- Limitless event logging
- Chat log storage
- Alert creation
- Brain state queries

Usage:
    from db_client import DatabaseClient

    db = DatabaseClient("postgresql://localhost/eeg_tokenizer")
    db.insert_eeg_tokens(timestamp, channel, tokens, pe_t, se, gate_weight)
    brain_state = db.get_brain_state()
"""

import os
import psycopg2
from psycopg2.extras import execute_batch
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple
import json


class DatabaseClient:
    """Client for TimescaleDB time-series database."""

    def __init__(self, connection_string: str = "postgresql://localhost/eeg_tokenizer"):
        """
        Initialize database client.

        Args:
            connection_string: PostgreSQL connection string
        """
        self.connection_string = os.getenv("TIMESCALE_URL", connection_string)
        self.conn = None
        self._connect()

    def _connect(self):
        """Establish database connection."""
        try:
            self.conn = psycopg2.connect(self.connection_string)
            print("✅ Connected to TimescaleDB")
        except Exception as e:
            print(f"❌ Database connection failed: {e}")
            raise

    def _ensure_conn(self):
        """Ensure connection exists and is open; reconnect if closed."""
        if not self.conn or getattr(self.conn, "closed", 0):
            self._connect()

    def reconnect(self):
        """Reconnect to database if connection is lost."""
        try:
            if self.conn:
                self.conn.close()
        except:
            pass
        self._connect()

    def insert_eeg_token(
        self,
        timestamp: datetime,
        channel: int,
        token_level_1: int,
        token_level_2: int,
        token_level_3: int,
        pe_t: float,
        se: float,
        gate_weight: float,
        metadata: Optional[Dict] = None
    ):
        """
        Insert single EEG token into database.

        Args:
            timestamp: Token timestamp
            channel: Channel index (0-11)
            token_level_1: RVQ level 1 code (0-127)
            token_level_2: RVQ level 2 code (0-127)
            token_level_3: RVQ level 3 code (0-127)
            pe_t: Prediction error value
            se: Spectral exponent value
            gate_weight: SE gating weight (0-1)
            metadata: Optional metadata dict (phase features, etc.)
        """
        try:
            query = """
                INSERT INTO eeg_tokens
                (timestamp, channel, token_level_1, token_level_2, token_level_3,
                 pe_t, se, gate_weight, metadata)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """

            self._ensure_conn()
            with self.conn.cursor() as cur:
                cur.execute(query, (
                    timestamp, channel, token_level_1, token_level_2, token_level_3,
                    pe_t, se, gate_weight, json.dumps(metadata) if metadata else None
                ))
                self.conn.commit()

        except Exception as e:
            print(f"❌ Failed to insert EEG token: {e}")
            self.conn.rollback()
            raise

    def insert_eeg_tokens_batch(self, tokens: List[Tuple]):
        """
        Insert batch of EEG tokens efficiently.

        Args:
            tokens: List of tuples (timestamp, channel, token_l1, token_l2, token_l3,
                                    pe_t, se, gate_weight, metadata_json)
        """
        try:
            query = """
                INSERT INTO eeg_tokens
                (timestamp, channel, token_level_1, token_level_2, token_level_3,
                 pe_t, se, gate_weight, metadata)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """

            self._ensure_conn()
            with self.conn.cursor() as cur:
                execute_batch(cur, query, tokens, page_size=1000)
                self.conn.commit()

        except Exception as e:
            print(f"❌ Failed to batch insert EEG tokens: {e}")
            self.conn.rollback()
            raise

    def insert_whoop_metric(
        self,
        timestamp: datetime,
        hrv_ms: Optional[int] = None,
        strain: Optional[float] = None,
        recovery: Optional[int] = None,
        sleep_stage: Optional[str] = None
    ):
        """
        Insert Whoop biometric data.

        Args:
            timestamp: Measurement timestamp
            hrv_ms: Heart rate variability in milliseconds
            strain: Strain score (0-21)
            recovery: Recovery score (0-100)
            sleep_stage: Sleep stage ('awake', 'light', 'deep', 'rem', 'unknown')
        """
        try:
            query = """
                INSERT INTO whoop_metrics (timestamp, hrv_ms, strain, recovery, sleep_stage)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (timestamp) DO UPDATE SET
                    hrv_ms = EXCLUDED.hrv_ms,
                    strain = EXCLUDED.strain,
                    recovery = EXCLUDED.recovery,
                    sleep_stage = EXCLUDED.sleep_stage
            """

            self._ensure_conn()
            with self.conn.cursor() as cur:
                cur.execute(query, (timestamp, hrv_ms, strain, recovery, sleep_stage))
                self.conn.commit()

        except Exception as e:
            print(f"❌ Failed to insert Whoop metric: {e}")
            self.conn.rollback()
            raise

    def insert_limitless_event(
        self,
        timestamp: datetime,
        meeting_id: str,
        transcript: str,
        speaker: Optional[str] = None
    ):
        """
        Insert Limitless meeting event.

        Args:
            timestamp: Event timestamp
            meeting_id: Meeting identifier
            transcript: Transcript text
            speaker: Speaker name (optional)
        """
        try:
            query = """
                INSERT INTO limitless_events (timestamp, meeting_id, transcript, speaker)
                VALUES (%s, %s, %s, %s)
            """

            self._ensure_conn()
            with self.conn.cursor() as cur:
                cur.execute(query, (timestamp, meeting_id, transcript, speaker))
                self.conn.commit()

        except Exception as e:
            print(f"❌ Failed to insert Limitless event: {e}")
            self.conn.rollback()
            raise

    def insert_chat_log(
        self,
        timestamp: datetime,
        role: str,
        content: str,
        token_window_start: Optional[datetime] = None
    ):
        """
        Insert chat log (Grok 4 conversation).

        Args:
            timestamp: Message timestamp
            role: 'user' or 'assistant'
            content: Message content
            token_window_start: Link to EEG token window (optional)
        """
        try:
            query = """
                INSERT INTO chat_logs (timestamp, role, content, token_window_start)
                VALUES (%s, %s, %s, %s)
            """

            self._ensure_conn()
            with self.conn.cursor() as cur:
                cur.execute(query, (timestamp, role, content, token_window_start))
                self.conn.commit()

        except Exception as e:
            print(f"❌ Failed to insert chat log: {e}")
            self.conn.rollback()
            raise

    def create_alert(
        self,
        timestamp: datetime,
        alert_type: str,
        severity: str,
        message: str,
        metadata: Optional[Dict] = None
    ):
        """
        Create an alert event.

        Args:
            timestamp: Alert timestamp
            alert_type: Type of alert (e.g., 'pe_t_spike', 'se_anomaly')
            severity: Severity level ('info', 'warning', 'critical')
            message: Human-readable alert message
            metadata: Additional context (e.g., PE_t value, threshold)
        """
        try:
            query = """
                INSERT INTO alert_events (timestamp, alert_type, severity, message, metadata)
                VALUES (%s, %s, %s, %s, %s)
            """

            self._ensure_conn()
            with self.conn.cursor() as cur:
                cur.execute(query, (
                    timestamp, alert_type, severity, message,
                    json.dumps(metadata) if metadata else None
                ))
                self.conn.commit()

        except Exception as e:
            print(f"❌ Failed to create alert: {e}")
            self.conn.rollback()
            raise

    def get_brain_state(self) -> Dict:
        """
        Get current brain state (last 10 seconds).

        Returns:
            Dict with keys: avg_pe_t, stddev_pe_t, avg_se, avg_gate_weight, dominant_tokens
        """
        try:
            self._ensure_conn()
            with self.conn.cursor() as cur:
                cur.execute("SELECT * FROM get_current_brain_state();")
                result = cur.fetchone()

            if not result:
                return {
                    'avg_pe_t': None,
                    'stddev_pe_t': None,
                    'avg_se': None,
                    'avg_gate_weight': None,
                    'dominant_tokens': [None, None, None]
                }

            avg_pe_t, stddev_pe_t, avg_se, avg_gate_weight, dominant_tokens = result

            return {
                'avg_pe_t': float(avg_pe_t) if avg_pe_t is not None else None,
                'stddev_pe_t': float(stddev_pe_t) if stddev_pe_t is not None else None,
                'avg_se': float(avg_se) if avg_se is not None else None,
                'avg_gate_weight': float(avg_gate_weight) if avg_gate_weight is not None else None,
                'dominant_tokens': dominant_tokens if dominant_tokens else [None, None, None]
            }

        except Exception as e:
            print(f"❌ Failed to get brain state: {e}")
            raise

    def get_historical_brain_state(
        self,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        window_seconds: int = 10
    ) -> Dict:
        """
        Get historical brain state for a specific time window.

        Args:
            start_time: Start of time window (if None, uses end_time - window_seconds)
            end_time: End of time window (if None, uses start_time + window_seconds)
            window_seconds: Size of time window (default: 10 seconds)

        Returns:
            Dict with keys: avg_pe_t, stddev_pe_t, avg_se, avg_gate_weight,
                           dominant_tokens, start_time, end_time, sample_count
        """
        try:
            # Calculate time window
            if start_time is None and end_time is None:
                raise ValueError("Must provide either start_time or end_time")

            if start_time is None:
                start_time = end_time - timedelta(seconds=window_seconds)
            if end_time is None:
                end_time = start_time + timedelta(seconds=window_seconds)

            # Query aggregates for the time window
            query = """
                SELECT
                    AVG(pe_t) as avg_pe_t,
                    STDDEV(pe_t) as stddev_pe_t,
                    AVG(se) as avg_se,
                    AVG(gate_weight) as avg_gate_weight,
                    MODE() WITHIN GROUP (ORDER BY token_level_1) as dominant_l1,
                    MODE() WITHIN GROUP (ORDER BY token_level_2) as dominant_l2,
                    MODE() WITHIN GROUP (ORDER BY token_level_3) as dominant_l3,
                    COUNT(*) as sample_count
                FROM eeg_tokens
                WHERE timestamp >= %s AND timestamp < %s
            """

            self._ensure_conn()
            with self.conn.cursor() as cur:
                cur.execute(query, (start_time, end_time))
                result = cur.fetchone()

            if not result or result[7] == 0:  # No data in this window
                return {
                    'avg_pe_t': None,
                    'stddev_pe_t': None,
                    'avg_se': None,
                    'avg_gate_weight': None,
                    'dominant_tokens': [None, None, None],
                    'start_time': start_time,
                    'end_time': end_time,
                    'sample_count': 0
                }

            avg_pe_t, stddev_pe_t, avg_se, avg_gate_weight, dom_l1, dom_l2, dom_l3, sample_count = result

            return {
                'avg_pe_t': float(avg_pe_t) if avg_pe_t is not None else None,
                'stddev_pe_t': float(stddev_pe_t) if stddev_pe_t is not None else None,
                'avg_se': float(avg_se) if avg_se is not None else None,
                'avg_gate_weight': float(avg_gate_weight) if avg_gate_weight is not None else None,
                'dominant_tokens': [dom_l1, dom_l2, dom_l3],
                'start_time': start_time,
                'end_time': end_time,
                'sample_count': sample_count
            }

        except Exception as e:
            print(f"❌ Failed to get historical brain state: {e}")
            raise

    def get_recent_alerts(self, minutes: int = 10) -> List[Dict]:
        """
        Get recent alerts.

        Args:
            minutes: How many minutes back to query

        Returns:
            List of alert dicts with keys: timestamp, type, severity, message, metadata
        """
        try:
            query = """
                SELECT timestamp, alert_type, severity, message, metadata
                FROM alert_events
                WHERE timestamp > NOW() - INTERVAL '%s minutes'
                ORDER BY timestamp DESC
            """

            self._ensure_conn()
            with self.conn.cursor() as cur:
                cur.execute(query, (minutes,))
                results = cur.fetchall()

            alerts = []
            for row in results:
                timestamp, alert_type, severity, message, metadata = row
                alerts.append({
                    'timestamp': timestamp,
                    'type': alert_type,
                    'severity': severity,
                    'message': message,
                    'metadata': metadata
                })

            return alerts

        except Exception as e:
            print(f"❌ Failed to get recent alerts: {e}")
            raise

    def get_eeg_aggregates(self, minutes: int = 60) -> List[Dict]:
        """
        Get EEG token aggregates from continuous aggregate.

        Args:
            minutes: Time window to query

        Returns:
            List of aggregate dicts with keys: bucket, channel, avg_pe_t, stddev_pe_t, etc.
        """
        try:
            query = """
                SELECT bucket, channel, avg_pe_t, stddev_pe_t, avg_se,
                       avg_gate_weight, sample_count
                FROM eeg_tokens_1min
                WHERE bucket > NOW() - INTERVAL '%s minutes'
                ORDER BY bucket DESC, channel
            """

            self._ensure_conn()
            with self.conn.cursor() as cur:
                cur.execute(query, (minutes,))
                results = cur.fetchall()

            aggregates = []
            for row in results:
                bucket, channel, avg_pe_t, stddev_pe_t, avg_se, avg_gate_weight, sample_count = row
                aggregates.append({
                    'bucket': bucket,
                    'channel': channel,
                    'avg_pe_t': float(avg_pe_t) if avg_pe_t else None,
                    'stddev_pe_t': float(stddev_pe_t) if stddev_pe_t else None,
                    'avg_se': float(avg_se) if avg_se else None,
                    'avg_gate_weight': float(avg_gate_weight) if avg_gate_weight else None,
                    'sample_count': sample_count
                })

            return aggregates

        except Exception as e:
            print(f"❌ Failed to get EEG aggregates: {e}")
            raise

    def get_whoop_series(self, minutes: int = 60) -> List[Dict]:
        """
        Get WHOOP metrics time series for the last N minutes.

        Returns: list of dicts with keys: timestamp, hrv_ms, strain, recovery, sleep_stage
        """
        try:
            self._ensure_conn()
            query = """
                SELECT timestamp, hrv_ms, strain, recovery, sleep_stage
                FROM whoop_metrics
                WHERE timestamp > NOW() - INTERVAL '%s minutes'
                ORDER BY timestamp ASC
            """
            with self.conn.cursor() as cur:
                cur.execute(query, (minutes,))
                rows = cur.fetchall()
            out = []
            for ts, hrv, strain, rec, stage in rows:
                out.append({
                    'timestamp': ts,
                    'hrv_ms': hrv,
                    'strain': float(strain) if strain is not None else None,
                    'recovery': int(rec) if rec is not None else None,
                    'sleep_stage': stage,
                })
            return out
        except Exception as e:
            print(f"❌ Failed to get WHOOP series: {e}")
            raise

    def get_limitless_events(self, minutes: int = 60) -> List[Dict]:
        """
        Get Limitless lifelog events for the last N minutes.

        Returns: list of dicts with keys: timestamp, meeting_id, speaker, transcript
        """
        try:
            self._ensure_conn()
            query = """
                SELECT timestamp, meeting_id, speaker, transcript
                FROM limitless_events
                WHERE timestamp > NOW() - INTERVAL '%s minutes'
                ORDER BY timestamp ASC
            """
            with self.conn.cursor() as cur:
                cur.execute(query, (minutes,))
                rows = cur.fetchall()
            out = []
            for ts, meeting_id, speaker, transcript in rows:
                out.append({
                    'timestamp': ts,
                    'meeting_id': meeting_id,
                    'speaker': speaker,
                    'transcript': transcript
                })
            return out
        except Exception as e:
            print(f"❌ Failed to get Limitless events: {e}")
            raise

    def get_data_status(self) -> Dict[str, Dict[str, any]]:
        """
        Get status of all data sources in the database.

        Returns:
            Dictionary with status for each data source:
            {
                'eeg_tokens': {'has_data': bool, 'row_count': int},
                'whoop_metrics': {'has_data': bool, 'row_count': int},
                'limitless_events': {'has_data': bool, 'row_count': int},
                'chat_logs': {'has_data': bool, 'row_count': int}
            }
        """
        try:
            status = {}

            # Check EEG tokens
            self._ensure_conn()
            with self.conn.cursor() as cur:
                cur.execute("SELECT COUNT(*) FROM eeg_tokens")
                eeg_count = cur.fetchone()[0]
            status['eeg_tokens'] = {'has_data': eeg_count > 0, 'row_count': eeg_count}

            # Check WHOOP metrics
            with self.conn.cursor() as cur:
                cur.execute("SELECT COUNT(*) FROM whoop_metrics")
                whoop_count = cur.fetchone()[0]
            status['whoop_metrics'] = {'has_data': whoop_count > 0, 'row_count': whoop_count}

            # Check Limitless events
            with self.conn.cursor() as cur:
                cur.execute("SELECT COUNT(*) FROM limitless_events")
                limitless_count = cur.fetchone()[0]
            status['limitless_events'] = {'has_data': limitless_count > 0, 'row_count': limitless_count}

            # Check chat logs
            with self.conn.cursor() as cur:
                cur.execute("SELECT COUNT(*) FROM chat_logs")
                chat_count = cur.fetchone()[0]
            status['chat_logs'] = {'has_data': chat_count > 0, 'row_count': chat_count}

            return status

        except Exception as e:
            print(f"❌ Failed to get data status: {e}")
            raise

    def close(self):
        """Close database connection."""
        if self.conn:
            self.conn.close()
        print("✅ Database connection closed")

    def __enter__(self):
        """Context manager entry."""
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit."""
        self.close()


# Example usage
if __name__ == "__main__":
    print("=" * 60)
    print("Testing Database Client")
    print("=" * 60)

    with DatabaseClient() as db:
        # Test brain state query
        print("\n1. Getting current brain state...")
        state = db.get_brain_state()
        print(f"   Brain state: {state}")

        # Test token insertion
        print("\n2. Inserting sample EEG token...")
        db.insert_eeg_token(
            timestamp=datetime.now(),
            channel=0,
            token_level_1=42,
            token_level_2=108,
            token_level_3=73,
            pe_t=1.5,
            se=-1.2,
            gate_weight=0.75,
            metadata={'test': True}
        )
        print("   ✅ Token inserted")

        # Test alert creation
        print("\n3. Creating test alert...")
        db.create_alert(
            timestamp=datetime.now(),
            alert_type='system_error',  # Valid: pe_t_spike, se_anomaly, connection_lost, system_error
            severity='low',  # Valid: low, medium, high, critical
            message='Database client test alert',
            metadata={'source': 'db_client.py'}
        )
        print("   ✅ Alert created")

        # Get recent alerts
        print("\n4. Fetching recent alerts...")
        alerts = db.get_recent_alerts(minutes=1)
        print(f"   Found {len(alerts)} recent alerts")

        print("\n" + "=" * 60)
        print("✅ Database Client Tests Passed!")
        print("=" * 60)
