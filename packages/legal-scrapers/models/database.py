"""
SQLAlchemy ORM models for Legal Advocate AI Action Item Detector
Database schema for deadlines, attorney requests, and alerts
"""

from sqlalchemy import (
    Column, Integer, String, Float, DateTime, Text,
    ForeignKey, Index, create_engine, Boolean
)
from sqlalchemy.orm import declarative_base, relationship, sessionmaker
from datetime import datetime
import uuid

Base = declarative_base()


class Deadline(Base):
    """Court deadlines extracted from legal documents"""
    __tablename__ = 'deadlines'

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    case_number = Column(String(50), nullable=False, index=True)
    user_id = Column(String(100), nullable=False, index=True)
    deadline_type = Column(String(20), nullable=False)  # 'filing', 'hearing', 'response', 'discovery'
    deadline_date = Column(DateTime, nullable=False, index=True)
    action_required = Column(Text, nullable=False)
    responsible_party = Column(String(50))  # 'self', 'attorney', 'opposing_party'
    source_document = Column(Text)  # Reference to source document in ChromaDB
    source_text = Column(Text)  # Actual text that was extracted
    extraction_confidence = Column(Float)  # 0.0-1.0 confidence score
    status = Column(String(20), nullable=False, default='pending')  # 'pending', 'completed', 'cancelled', 'overdue'
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    alerted_at = Column(DateTime)
    completed_at = Column(DateTime)

    # Relationship to alerts
    alerts = relationship("Alert", back_populates="deadline", cascade="all, delete-orphan")

    # Composite indexes for common queries
    __table_args__ = (
        Index('idx_user_status', 'user_id', 'status'),
        Index('idx_case_deadline', 'case_number', 'deadline_date'),
        Index('idx_user_deadline', 'user_id', 'deadline_date'),
    )

    def __repr__(self):
        return f"<Deadline(id={self.id}, type={self.deadline_type}, date={self.deadline_date}, status={self.status})>"


class Request(Base):
    """Attorney requests extracted from email communications"""
    __tablename__ = 'requests'

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    case_number = Column(String(50), nullable=False, index=True)
    user_id = Column(String(100), nullable=False, index=True)
    request_type = Column(String(50), nullable=False)  # 'document', 'information', 'action', 'meeting'
    what_is_needed = Column(Text, nullable=False)
    requested_by = Column(String(200), nullable=False)  # Email address or name
    requested_date = Column(DateTime, nullable=False)
    deadline = Column(DateTime)  # If attorney specified a deadline
    urgency = Column(String(20), default='normal')  # 'low', 'normal', 'high', 'urgent'
    source_email_id = Column(String(200))  # Gmail message ID
    source_text = Column(Text)  # Actual text that was extracted
    status = Column(String(20), nullable=False, default='pending')  # 'pending', 'completed', 'cancelled'
    completed_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Composite indexes for common queries
    __table_args__ = (
        Index('idx_user_status_requests', 'user_id', 'status'),
        Index('idx_case_urgency', 'case_number', 'urgency'),
        Index('idx_user_deadline_requests', 'user_id', 'deadline'),
    )

    def __repr__(self):
        return f"<Request(id={self.id}, type={self.request_type}, urgency={self.urgency}, status={self.status})>"


class Alert(Base):
    """Alert records for deadline notifications"""
    __tablename__ = 'alerts'

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    deadline_id = Column(String(36), ForeignKey('deadlines.id', ondelete='CASCADE'), nullable=False)
    alert_type = Column(String(20), nullable=False)  # '30_days', '14_days', '7_days', '3_days', '1_day'
    scheduled_at = Column(DateTime, nullable=False, index=True)
    sent_at = Column(DateTime)
    status = Column(String(20), nullable=False, default='scheduled')  # 'scheduled', 'sent', 'failed', 'cancelled'
    channel = Column(String(20), default='email')  # 'email', 'sms', 'push', 'in_app'
    error_message = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationship to deadline
    deadline = relationship("Deadline", back_populates="alerts")

    # Composite indexes for alert processing
    __table_args__ = (
        Index('idx_status_scheduled', 'status', 'scheduled_at'),
        Index('idx_deadline_alert', 'deadline_id', 'alert_type'),
    )

    def __repr__(self):
        return f"<Alert(id={self.id}, type={self.alert_type}, status={self.status}, scheduled={self.scheduled_at})>"


class Case(Base):
    """MyCase case data and metadata"""
    __tablename__ = 'cases'

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    case_number = Column(String(50), nullable=False, unique=True, index=True)
    user_id = Column(String(100), nullable=False, index=True)
    case_title = Column(String(200))
    case_type = Column(String(50))  # 'family', 'civil', 'criminal', etc.
    court_name = Column(String(200))
    filing_date = Column(DateTime)
    status = Column(String(50), default='active')  # 'active', 'closed', 'archived'
    mycase_url = Column(Text)  # Link to MyCase portal
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Indexes for common queries
    __table_args__ = (
        Index('idx_user_case_number', 'user_id', 'case_number'),
        Index('idx_case_user_status', 'user_id', 'status'),
    )

    def __repr__(self):
        return f"<Case(case_number={self.case_number}, title={self.case_title}, status={self.status})>"


class CompletionTracking(Base):
    """Track completion of deadlines and requests"""
    __tablename__ = 'completion_tracking'

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    item_type = Column(String(20), nullable=False)  # 'deadline', 'request'
    item_id = Column(String(36), nullable=False, index=True)
    user_id = Column(String(100), nullable=False, index=True)
    completed_at = Column(DateTime, nullable=False)
    completion_method = Column(String(50))  # 'manual', 'auto', 'email_confirmation', etc.
    completion_notes = Column(Text)
    verified_by = Column(String(100))  # Email or user who verified
    verification_source = Column(Text)  # Email ID, document ID, etc.
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Composite indexes
    __table_args__ = (
        Index('idx_item_type_id', 'item_type', 'item_id'),
        Index('idx_user_completed', 'user_id', 'completed_at'),
    )

    def __repr__(self):
        return f"<CompletionTracking(item_type={self.item_type}, item_id={self.item_id}, completed={self.completed_at})>"


# Database initialization functions
def get_engine(database_url: str = None, echo: bool = False):
    """
    Create SQLAlchemy engine

    Args:
        database_url: Database connection string (defaults to DATABASE_URL env var, then SQLite)
        echo: Whether to log SQL queries

    Returns:
        SQLAlchemy engine
    """
    import os

    if database_url is None:
        # First, check for DATABASE_URL environment variable (Railway, Heroku, etc.)
        database_url = os.getenv("DATABASE_URL")

        if database_url is None:
            # Fall back to SQLite in user's home directory
            db_dir = os.path.expanduser("~/.legal_advocate_ai")
            os.makedirs(db_dir, exist_ok=True)
            database_url = f"sqlite:///{db_dir}/action_items.db"

    return create_engine(database_url, echo=echo)


def get_session(engine=None):
    """
    Create database session

    Args:
        engine: SQLAlchemy engine (optional, creates default if not provided)

    Returns:
        SQLAlchemy session
    """
    if engine is None:
        engine = get_engine()
    Session = sessionmaker(bind=engine)
    return Session()


def init_db(database_url: str = None, echo: bool = False):
    """
    Initialize database schema

    Args:
        database_url: Database connection string
        echo: Whether to log SQL queries

    Returns:
        SQLAlchemy engine
    """
    engine = get_engine(database_url, echo)
    Base.metadata.create_all(engine)
    print(f"✅ Database initialized at {engine.url}")
    return engine


def drop_all_tables(database_url: str = None):
    """
    Drop all tables (for testing/reset)

    Args:
        database_url: Database connection string
    """
    engine = get_engine(database_url)
    Base.metadata.drop_all(engine)
    print("⚠️  All tables dropped")


if __name__ == "__main__":
    # Test database creation
    print("Creating database schema...")
    engine = init_db(echo=True)

    # Test session creation
    session = get_session(engine)
    print(f"✅ Session created: {session}")
    session.close()

    print("\n✅ Database schema setup complete!")
    print(f"   Tables: {list(Base.metadata.tables.keys())}")
